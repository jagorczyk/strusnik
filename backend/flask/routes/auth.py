from datetime import datetime, timezone
import unicodedata

from flask import Blueprint, current_app, make_response, jsonify, request
from sqlalchemy import or_
from werkzeug.security import check_password_hash, generate_password_hash

from api_utils import error_response, json_body, log_exception
from models import (
    AdminLog,
    Ban,
    FriendRequest,
    Friendship,
    GameMatchHistory,
    GameRating,
    GameStats,
    GuestBan,
    HaxballMatchParticipant,
    SinglePlayerStats,
    User,
    db,
)
from utils import create_jwt_token, is_token_valid, parse_jwt_token

authentication = Blueprint("authentication", __name__)


def _credential_values():
    data = json_body()
    username = data.get("username")
    password = data.get("password")
    if not isinstance(username, str) or not isinstance(password, str):
        return None, None
    return username.strip(), password


def _set_auth_cookie(response, token):
    response.set_cookie(
        "jwtToken",
        value=token,
        max_age=current_app.config["TOKEN_MAX_AGE"],
        httponly=True,
        secure=current_app.config.get("SESSION_COOKIE_SECURE", False),
        samesite="Lax",
    )
    return response


def _current_user():
    token = request.cookies.get("jwtToken")
    if not token:
        authorization = request.headers.get("Authorization", "")
        if authorization.lower().startswith("bearer "):
            token = authorization.split(" ", 1)[1].strip()
    if not token or not is_token_valid(token):
        return None

    try:
        payload = parse_jwt_token(token)
        return User.query.get(payload.get("user_id"))
    except Exception:
        return None


def _settings_error(message, status, code):
    return jsonify({"error": message, "code": code}), status


def _normalized_confirmation(value):
    if not isinstance(value, str):
        return ""
    return unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").upper().strip()


def _user_has_room(user_id):
    from sockets.socket_manager import active_sessions, manager

    token = str(user_id)
    session = active_sessions.get(token)
    session_room_id = session.get("room_id") if session else None

    for lobby in manager.lobbies.values():
        for room in lobby.rooms.values():
            if token in room.player_tokens or token in room.observers:
                return True
            if session_room_id and room.uuid == session_room_id:
                return True
    return False


@authentication.route("/register", methods=["POST"])
def register():
    username, password = _credential_values()
    if not username or not password:
        return error_response("Nazwa uzytkownika i haslo sa wymagane.", 400)
    if len(username) < 3 or len(username) > 100:
        return error_response("Nazwa uzytkownika musi miec od 3 do 100 znakow.", 400)
    if len(password) < 8:
        return error_response("Haslo musi miec co najmniej 8 znakow.", 400)

    try:
        if User.query.filter_by(username=username).first():
            return error_response("Uzytkownik juz istnieje.", 409)

        user = User(username=username, password=generate_password_hash(password))
        db.session.add(user)
        db.session.commit()

        token = create_jwt_token(user.id, username)
        response = make_response(jsonify({"token": token, "user": user.to_dict()}), 201)
        return _set_auth_cookie(response, token)
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to register user", error)
        return error_response("Nie udalo sie utworzyc konta.", 500)


@authentication.route("/login", methods=["POST"])
def login():
    username, password = _credential_values()
    if not username or not password:
        return error_response("Nazwa uzytkownika i haslo sa wymagane.", 400)

    try:
        user = User.query.filter_by(username=username).first()
        if not user or not check_password_hash(user.password, password):
            return error_response("Nieprawidlowa nazwa uzytkownika lub haslo.", 401)

        if user.is_banned:
            active_ban = Ban.query.filter_by(user_id=user.id, is_active=True).first()
            if active_ban and active_ban.expires_at and active_ban.expires_at <= datetime.now(timezone.utc).replace(tzinfo=None):
                active_ban.is_active = False
                user.is_banned = False
                db.session.commit()
                active_ban = None

            if active_ban:
                ban_msg = f"Konto zablokowane. Powod: {active_ban.reason or 'Nie podano powodu'}."
                if active_ban.expires_at:
                    ban_msg += f" Blokada wygasa: {active_ban.expires_at.strftime('%Y-%m-%d %H:%M')}."
                else:
                    ban_msg += " Blokada jest bezterminowa."
                return error_response(ban_msg, 403)

        user.last_login = datetime.now()
        db.session.commit()

        token = create_jwt_token(user.id, username)
        response = make_response(
            jsonify({"message": "Zalogowano pomyslnie.", "is_admin": bool(user.is_admin)}),
            200,
        )
        return _set_auth_cookie(response, token)
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to log in user", error)
        return error_response("Nie udalo sie zalogowac.", 500)


@authentication.route("/token", methods=["GET"])
def parse_token_claims():
    token = request.cookies.get("jwtToken")
    if not token:
        token = json_body().get("token")
    if not token:
        return error_response("Brak tokenu.", 401)

    try:
        parsed_token = parse_jwt_token(token)
        if not is_token_valid(token):
            return error_response("Sesja wygasla.", 401)
        user = User.query.get(parsed_token.get("user_id"))
        if not user:
            return error_response("Sesja wygasla.", 401)
        parsed_token["avatar_url"] = user.avatar_url
        return jsonify(parsed_token), 200
    except Exception:
        return error_response("Nieprawidlowa sesja.", 401)


@authentication.route("/validate", methods=["POST"])
def validate_token():
    data = json_body()
    token = data.get("token") or request.cookies.get("jwtToken")
    if not isinstance(token, str) or not token:
        return jsonify({"valid": False, "error": "Brak tokenu."}), 401

    valid = is_token_valid(token)
    if valid:
        try:
            payload = parse_jwt_token(token)
            valid = User.query.get(payload.get("user_id")) is not None
        except Exception:
            valid = False
    return jsonify({"valid": valid}), 200 if valid else 401


@authentication.route("/password", methods=["PUT"])
def change_password():
    user = _current_user()
    if not user:
        return _settings_error("Brak autoryzacji.", 401, "UNAUTHORIZED")

    data = json_body()
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    confirm_password = data.get("confirm_password")
    if not all(isinstance(value, str) for value in (current_password, new_password, confirm_password)):
        return _settings_error("Wypelnij wszystkie pola hasla.", 400, "PASSWORD_FIELDS_REQUIRED")
    if not check_password_hash(user.password, current_password):
        return _settings_error("Aktualne haslo jest nieprawidlowe.", 400, "INVALID_CURRENT_PASSWORD")
    if len(new_password) < 8:
        return _settings_error("Nowe haslo musi miec co najmniej 8 znakow.", 400, "PASSWORD_TOO_SHORT")
    if len(new_password) > 128:
        return _settings_error("Nowe haslo jest za dlugie.", 400, "PASSWORD_TOO_LONG")
    if new_password != confirm_password:
        return _settings_error("Hasla nie sa takie same.", 400, "PASSWORD_MISMATCH")
    if new_password == current_password:
        return _settings_error("Nowe haslo musi byc inne.", 400, "PASSWORD_UNCHANGED")

    try:
        user.password = generate_password_hash(new_password)
        db.session.commit()
        return jsonify({"message": "Haslo zostalo zmienione."}), 200
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to change password", error)
        return _settings_error("Nie udalo sie zmienic hasla.", 500, "PASSWORD_CHANGE_FAILED")


@authentication.route("/account", methods=["DELETE"])
def delete_account():
    user = _current_user()
    if not user:
        return _settings_error("Brak autoryzacji.", 401, "UNAUTHORIZED")

    if _user_has_room(user.id):
        return _settings_error("Najpierw opusc aktywna rozgrywke.", 409, "ACTIVE_GAME")
    if user.is_admin and User.query.filter_by(is_admin=True).count() <= 1:
        return _settings_error("Nie mozna usunac ostatniego administratora.", 409, "LAST_ADMIN")

    data = json_body()
    password = data.get("password")
    confirmation = data.get("confirmation")
    if not isinstance(password, str) or not check_password_hash(user.password, password):
        return _settings_error("Haslo jest nieprawidlowe.", 400, "INVALID_CURRENT_PASSWORD")
    if _normalized_confirmation(confirmation) not in {"USUN KONTO", "DELETE ACCOUNT"}:
        return _settings_error("Wpisz USUN KONTO, aby potwierdzic.", 400, "INVALID_DELETE_CONFIRMATION")

    user_id = user.id
    try:
        db.session.query(FriendRequest).filter(
            or_(FriendRequest.sender_id == user_id, FriendRequest.recipient_id == user_id)
        ).delete(synchronize_session=False)
        db.session.query(Friendship).filter(
            or_(Friendship.user_one_id == user_id, Friendship.user_two_id == user_id)
        ).delete(synchronize_session=False)
        db.session.query(GameStats).filter(GameStats.user_id == user_id).delete(synchronize_session=False)
        db.session.query(GameRating).filter(GameRating.user_id == user_id).delete(synchronize_session=False)
        db.session.query(GameMatchHistory).filter(GameMatchHistory.user_id == user_id).delete(synchronize_session=False)
        db.session.query(HaxballMatchParticipant).filter(HaxballMatchParticipant.user_id == user_id).update(
            {"user_id": None}, synchronize_session=False
        )
        db.session.query(SinglePlayerStats).filter(SinglePlayerStats.user_id == user_id).delete(synchronize_session=False)
        db.session.query(Ban).filter(
            or_(Ban.user_id == user_id, Ban.banned_by_id == user_id, Ban.unbanned_by_id == user_id)
        ).delete(synchronize_session=False)
        db.session.query(GuestBan).filter(
            or_(GuestBan.banned_by_id == user_id, GuestBan.unbanned_by_id == user_id)
        ).delete(synchronize_session=False)
        db.session.query(AdminLog).filter(AdminLog.target_user_id == user_id).update(
            {"target_user_id": None}, synchronize_session=False
        )
        db.session.query(AdminLog).filter(AdminLog.admin_id == user_id).delete(synchronize_session=False)
        db.session.delete(user)
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to delete account", error)
        return _settings_error("Nie udalo sie usunac konta.", 500, "ACCOUNT_DELETE_FAILED")

    try:
        from sockets.socket_manager import active_sessions, socket

        session = active_sessions.pop(str(user_id), None)
        if session and session.get("sid"):
            socket.disconnect(session["sid"])
    except Exception:
        current_app.logger.warning("Unable to disconnect deleted account session", exc_info=True)

    response = make_response(jsonify({"message": "Konto zostalo usuniete."}), 200)
    response.delete_cookie("jwtToken", httponly=True, samesite="Lax")
    return response


@authentication.route("/logout", methods=["POST"])
def logout():
    response = make_response(jsonify({"message": "Wylogowano pomyslnie."}), 200)
    response.delete_cookie("jwtToken", httponly=True, samesite="Lax")
    return response
