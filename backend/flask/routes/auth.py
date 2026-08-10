from datetime import datetime, timezone
import unicodedata

from flask import Blueprint, current_app, make_response, jsonify, request
from sqlalchemy import func, or_
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
from google_auth import (
    GOOGLE_LINK_PENDING_COOKIE,
    GOOGLE_OAUTH_MAX_AGE,
    GOOGLE_OAUTH_STATE_COOKIE,
    GOOGLE_ONBOARDING_COOKIE,
    GOOGLE_REAUTH_COOKIE,
    GoogleOAuthError,
    avatar_from_picture,
    create_oauth_transaction,
    exchange_code,
    google_is_configured,
    load_timed_payload,
    normalize_return_to,
    set_signed_cookie,
    sign_timed_payload,
    verify_identity,
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
        path="/",
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


def _google_error(code, status=400, return_to=None, mode=None):
    payload = {"error": "Nie udalo sie zalogowac przez Google.", "code": code}
    if return_to:
        payload["return_to"] = normalize_return_to(return_to, "/")
    if mode:
        payload["mode"] = mode
    return jsonify(payload), status


def _username_exists(username):
    return db.session.query(User.id).filter(func.lower(User.username) == username.lower()).first() is not None


def _suggested_username(display_name):
    candidate = " ".join(str(display_name or "").split())[:100].strip()
    if len(candidate) < 3:
        candidate = "Gracz"

    base = candidate
    suffix = 2
    while _username_exists(candidate):
        suffix_text = str(suffix)
        candidate = f"{base[:100 - len(suffix_text)]}{suffix_text}"
        suffix += 1
    return candidate


def _active_ban_message(user):
    if not user.is_banned:
        return None

    active_ban = Ban.query.filter_by(user_id=user.id, is_active=True).first()
    if active_ban and active_ban.expires_at and active_ban.expires_at <= datetime.now(timezone.utc).replace(tzinfo=None):
        active_ban.is_active = False
        user.is_banned = False
        db.session.commit()
        return None

    if not active_ban:
        return None

    if active_ban.expires_at:
        return (
            f"Konto zablokowane. Powod: {active_ban.reason or 'Nie podano powodu'}. "
            f"Blokada wygasa: {active_ban.expires_at.strftime('%Y-%m-%d %H:%M')}."
        )
    return f"Konto zablokowane. Powod: {active_ban.reason or 'Nie podano powodu'}. Blokada jest bezterminowa."


def _google_transaction():
    transaction = load_timed_payload(
        request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE),
        "google-oauth-state",
        GOOGLE_OAUTH_MAX_AGE,
    )
    if not transaction or transaction.get("state") != request.args.get("state"):
        raise GoogleOAuthError("GOOGLE_STATE_INVALID")
    if not transaction.get("code_verifier") or not transaction.get("nonce"):
        raise GoogleOAuthError("GOOGLE_STATE_INVALID")
    return transaction


def _current_user_for_transaction(transaction):
    user = _current_user()
    expected_user_id = transaction.get("user_id")
    if expected_user_id is not None and (not user or user.id != int(expected_user_id)):
        raise GoogleOAuthError("GOOGLE_SESSION_INVALID")
    return user


def _google_reauth_is_valid(user, purpose):
    payload = load_timed_payload(
        request.cookies.get(GOOGLE_REAUTH_COOKIE),
        "google-reauth",
        GOOGLE_OAUTH_MAX_AGE,
    )
    return bool(
        payload
        and payload.get("user_id") == user.id
        and payload.get("purpose") == purpose
        and payload.get("google_sub") == user.google_sub
    )


def _apply_google_avatar(user, picture):
    if user.avatar_url or not picture:
        return
    try:
        user.avatar_url = avatar_from_picture(picture)
    except Exception:
        current_app.logger.warning("Unable to import Google avatar", exc_info=True)


@authentication.route("/google/start", methods=["GET"])
def google_start():
    if not google_is_configured():
        return _google_error("GOOGLE_NOT_CONFIGURED", 503)

    mode = request.args.get("mode", "login")
    if mode not in {"login", "link", "reauth_password", "reauth_account"}:
        return _google_error("GOOGLE_FLOW_INVALID", 400)

    user = _current_user()
    if mode != "login" and not user:
        return _settings_error("Brak autoryzacji.", 401, "UNAUTHORIZED")
    if mode == "link":
        if not user.password:
            return _google_error("LINK_PASSWORD_REQUIRED", 400)
        if user.google_sub:
            return _google_error("GOOGLE_ALREADY_LINKED", 409)
    if mode.startswith("reauth_") and not user.google_sub:
        return _google_error("GOOGLE_NOT_LINKED", 400)

    transaction, authorization_url = create_oauth_transaction(
        mode,
        user_id=user.id if mode != "login" and user else None,
        return_to=normalize_return_to(request.args.get("return_to"), "/"),
    )
    response = make_response(jsonify({"authorization_url": authorization_url}))
    return set_signed_cookie(
        response,
        GOOGLE_OAUTH_STATE_COOKIE,
        sign_timed_payload(transaction, "google-oauth-state"),
        GOOGLE_OAUTH_MAX_AGE,
    )


@authentication.route("/google/callback", methods=["GET"])
def google_callback():
    if request.args.get("error"):
        transaction = load_timed_payload(
            request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE),
            "google-oauth-state",
            GOOGLE_OAUTH_MAX_AGE,
        )
        code = "GOOGLE_CANCELLED" if request.args.get("error") == "access_denied" else "GOOGLE_AUTH_FAILED"
        return _google_error(
            code,
            400,
            transaction.get("return_to") if transaction else None,
            transaction.get("mode") if transaction else None,
        )

    if not google_is_configured():
        return _google_error("GOOGLE_NOT_CONFIGURED", 503)

    transaction = None
    try:
        transaction = _google_transaction()
        current_user = _current_user_for_transaction(transaction)
        code = request.args.get("code")
        if not code:
            raise GoogleOAuthError("GOOGLE_CODE_MISSING")
        token_data = exchange_code(code, transaction["code_verifier"])
        claims = verify_identity(token_data["id_token"], transaction["nonce"])
    except GoogleOAuthError as error:
        return _google_error(
            error.code,
            400,
            transaction.get("return_to") if transaction else None,
            transaction.get("mode") if transaction else None,
        )

    google_sub = claims["sub"]
    picture = claims.get("picture")
    mode = transaction.get("mode", "login")
    return_to = normalize_return_to(transaction.get("return_to"), "/")

    if mode == "link":
        if not current_user:
            return _google_error("GOOGLE_SESSION_INVALID", 401)
        if current_user.google_sub:
            return _google_error("GOOGLE_ALREADY_LINKED", 409)
        if User.query.filter_by(google_sub=google_sub).first():
            return _google_error("GOOGLE_ACCOUNT_ALREADY_USED", 409)

        pending = {
            "user_id": current_user.id,
            "google_sub": google_sub,
            "picture": picture,
        }
        response = make_response(jsonify({"status": "link_confirmation", "return_to": return_to}))
        return set_signed_cookie(
            response,
            GOOGLE_LINK_PENDING_COOKIE,
            sign_timed_payload(pending, "google-link-pending"),
            GOOGLE_OAUTH_MAX_AGE,
        )

    if mode in {"reauth_password", "reauth_account"}:
        if not current_user or not current_user.google_sub:
            return _google_error("GOOGLE_NOT_LINKED", 400)
        if current_user.google_sub != google_sub:
            return _google_error("GOOGLE_ACCOUNT_MISMATCH", 403)

        purpose = "password" if mode == "reauth_password" else "account"
        reauth = {
            "user_id": current_user.id,
            "google_sub": google_sub,
            "purpose": purpose,
        }
        response = make_response(jsonify({"status": "reauthenticated", "mode": mode, "return_to": return_to}))
        return set_signed_cookie(
            response,
            GOOGLE_REAUTH_COOKIE,
            sign_timed_payload(reauth, "google-reauth"),
            GOOGLE_OAUTH_MAX_AGE,
        )

    user = User.query.filter_by(google_sub=google_sub).first()
    if user:
        ban_message = _active_ban_message(user)
        if ban_message:
            return error_response(ban_message, 403)

        _apply_google_avatar(user, picture)
        user.last_login = datetime.now()
        db.session.commit()
        token = create_jwt_token(user.id, user.username)
        response = make_response(jsonify({"status": "authenticated", "user": user.to_dict(), "return_to": return_to}))
        return _set_auth_cookie(response, token)

    pending = {
        "google_sub": google_sub,
        "display_name": str(claims.get("name") or "").strip()[:200],
        "picture": picture,
        "return_to": return_to,
    }
    response = make_response(jsonify({"status": "onboarding", "return_to": return_to}))
    return set_signed_cookie(
        response,
        GOOGLE_ONBOARDING_COOKIE,
        sign_timed_payload(pending, "google-onboarding"),
        GOOGLE_OAUTH_MAX_AGE,
    )


@authentication.route("/google/pending", methods=["GET"])
def google_pending():
    pending = load_timed_payload(
        request.cookies.get(GOOGLE_ONBOARDING_COOKIE),
        "google-onboarding",
        GOOGLE_OAUTH_MAX_AGE,
    )
    if not pending:
        return _google_error("GOOGLE_ONBOARDING_EXPIRED", 400)
    if User.query.filter_by(google_sub=pending.get("google_sub")).first():
        return _google_error("GOOGLE_ACCOUNT_ALREADY_USED", 409)
    return jsonify({"suggested_username": _suggested_username(pending.get("display_name"))})


@authentication.route("/google/complete", methods=["POST"])
def google_complete():
    pending = load_timed_payload(
        request.cookies.get(GOOGLE_ONBOARDING_COOKIE),
        "google-onboarding",
        GOOGLE_OAUTH_MAX_AGE,
    )
    if not pending:
        return _google_error("GOOGLE_ONBOARDING_EXPIRED", 400)

    data = json_body()
    username = data.get("username")
    if not isinstance(username, str):
        return _settings_error("Nazwa uzytkownika jest wymagana.", 400, "USERNAME_REQUIRED")
    username = username.strip()
    if len(username) < 3 or len(username) > 100:
        return _settings_error("Nazwa uzytkownika musi miec od 3 do 100 znakow.", 400, "USERNAME_INVALID")
    if _username_exists(username):
        return _settings_error("Ta nazwa uzytkownika jest juz zajeta.", 409, "USERNAME_TAKEN")

    google_sub = pending.get("google_sub")
    if not isinstance(google_sub, str) or User.query.filter_by(google_sub=google_sub).first():
        return _google_error("GOOGLE_ACCOUNT_ALREADY_USED", 409)

    try:
        user = User(
            username=username,
            password=None,
            google_sub=google_sub,
            avatar_url=avatar_from_picture(pending.get("picture")),
            last_login=datetime.now(),
        )
        db.session.add(user)
        db.session.commit()
        token = create_jwt_token(user.id, user.username)
        response = make_response(jsonify({"status": "authenticated", "user": user.to_dict(), "return_to": normalize_return_to(pending.get("return_to"), "/")}), 201)
        response.delete_cookie(GOOGLE_ONBOARDING_COOKIE, path="/")
        return _set_auth_cookie(response, token)
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to complete Google registration", error)
        return _google_error("GOOGLE_ONBOARDING_FAILED", 500)


@authentication.route("/google/link", methods=["POST"])
def google_link():
    user = _current_user()
    if not user:
        return _settings_error("Brak autoryzacji.", 401, "UNAUTHORIZED")
    pending = load_timed_payload(
        request.cookies.get(GOOGLE_LINK_PENDING_COOKIE),
        "google-link-pending",
        GOOGLE_OAUTH_MAX_AGE,
    )
    if not pending or pending.get("user_id") != user.id:
        return _google_error("GOOGLE_LINK_EXPIRED", 400)
    if user.google_sub:
        return _google_error("GOOGLE_ALREADY_LINKED", 409)

    data = json_body()
    password = data.get("password")
    if not user.password or not isinstance(password, str) or not check_password_hash(user.password, password):
        return _settings_error("Haslo jest nieprawidlowe.", 400, "INVALID_CURRENT_PASSWORD")
    if User.query.filter_by(google_sub=pending.get("google_sub")).first():
        return _google_error("GOOGLE_ACCOUNT_ALREADY_USED", 409)

    try:
        user.google_sub = pending["google_sub"]
        _apply_google_avatar(user, pending.get("picture"))
        db.session.commit()
        response = make_response(jsonify({"status": "linked", "user": user.to_dict()}))
        response.delete_cookie(GOOGLE_LINK_PENDING_COOKIE, path="/")
        return response
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to link Google account", error)
        return _google_error("GOOGLE_LINK_FAILED", 500)


@authentication.route("/google/reauth/status", methods=["GET"])
def google_reauth_status():
    user = _current_user()
    if not user:
        return _settings_error("Brak autoryzacji.", 401, "UNAUTHORIZED")
    purpose = request.args.get("purpose")
    if purpose not in {"password", "account"}:
        return _google_error("GOOGLE_FLOW_INVALID", 400)
    return jsonify({"valid": _google_reauth_is_valid(user, purpose)})


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
        if not user or not user.password or not check_password_hash(user.password, password):
            return error_response("Nieprawidlowa nazwa uzytkownika lub haslo.", 401)

        ban_message = _active_ban_message(user)
        if ban_message:
            return error_response(ban_message, 403)

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
        parsed_token["has_password"] = bool(user.password)
        parsed_token["has_google"] = bool(user.google_sub)
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

    if not isinstance(new_password, str) or not isinstance(confirm_password, str):
        return _settings_error("Wypelnij wszystkie pola hasla.", 400, "PASSWORD_FIELDS_REQUIRED")
    if user.password:
        if not isinstance(current_password, str):
            return _settings_error("Wypelnij wszystkie pola hasla.", 400, "PASSWORD_FIELDS_REQUIRED")
        if not check_password_hash(user.password, current_password):
            return _settings_error("Aktualne haslo jest nieprawidlowe.", 400, "INVALID_CURRENT_PASSWORD")
    elif not _google_reauth_is_valid(user, "password"):
        return _settings_error("Potwierdz konto przez Google.", 428, "GOOGLE_REAUTH_REQUIRED")

    if len(new_password) < 8:
        return _settings_error("Nowe haslo musi miec co najmniej 8 znakow.", 400, "PASSWORD_TOO_SHORT")
    if len(new_password) > 128:
        return _settings_error("Nowe haslo jest za dlugie.", 400, "PASSWORD_TOO_LONG")
    if new_password != confirm_password:
        return _settings_error("Hasla nie sa takie same.", 400, "PASSWORD_MISMATCH")
    if user.password and new_password == current_password:
        return _settings_error("Nowe haslo musi byc inne.", 400, "PASSWORD_UNCHANGED")

    try:
        user.password = generate_password_hash(new_password)
        db.session.commit()
        response = make_response(jsonify({"message": "Haslo zostalo zmienione."}), 200)
        response.delete_cookie(GOOGLE_REAUTH_COOKIE, path="/")
        return response
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
    if user.password:
        if not isinstance(password, str) or not check_password_hash(user.password, password):
            return _settings_error("Haslo jest nieprawidlowe.", 400, "INVALID_CURRENT_PASSWORD")
    elif not _google_reauth_is_valid(user, "account"):
        return _settings_error("Potwierdz konto przez Google.", 428, "GOOGLE_REAUTH_REQUIRED")
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
    response.delete_cookie("jwtToken", httponly=True, samesite="Lax", path="/")
    response.delete_cookie(GOOGLE_REAUTH_COOKIE, httponly=True, samesite="Lax", path="/")
    return response


@authentication.route("/logout", methods=["POST"])
def logout():
    response = make_response(jsonify({"message": "Wylogowano pomyslnie."}), 200)
    response.delete_cookie("jwtToken", httponly=True, samesite="Lax", path="/")
    response.delete_cookie(GOOGLE_REAUTH_COOKIE, httponly=True, samesite="Lax", path="/")
    response.delete_cookie(GOOGLE_LINK_PENDING_COOKIE, httponly=True, samesite="Lax", path="/")
    response.delete_cookie(GOOGLE_ONBOARDING_COOKIE, httponly=True, samesite="Lax", path="/")
    response.delete_cookie(GOOGLE_OAUTH_STATE_COOKIE, httponly=True, samesite="Lax", path="/")
    return response
