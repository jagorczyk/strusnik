from datetime import date, datetime, timedelta
from functools import wraps

from flask import Blueprint, jsonify, request

from api_utils import error_response, json_body, log_exception
from models import AdminLog, Ban, ChangelogPost, GameStats, GuestBan, User, db
from sockets.socket_manager import active_sessions, is_guest_token, socket
from utils import is_token_valid, parse_jwt_token

admin = Blueprint("admin", __name__)

_CHANGELOG_CATEGORIES = {"new", "improved", "fixed"}


def _localized_text(data, field, max_length):
    value = data.get(field)
    if not isinstance(value, dict):
        return None
    polish = value.get("pl")
    english = value.get("en")
    if not isinstance(polish, str) or not isinstance(english, str):
        return None
    polish = polish.strip()
    english = english.strip()
    if not polish or not english or len(polish) > max_length or len(english) > max_length:
        return None
    return polish, english


def get_current_user():
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


def _expire_bans():
    """Keep the denormalized user ban flag in sync with timed bans."""
    now = datetime.now()
    expired_bans = Ban.query.filter(
        Ban.is_active.is_(True),
        Ban.expires_at.isnot(None),
        Ban.expires_at <= now,
    ).all()
    if not expired_bans:
        return

    affected_user_ids = set()
    for ban in expired_bans:
        ban.is_active = False
        ban.unbanned_at = now
        affected_user_ids.add(ban.user_id)

    for user_id in affected_user_ids:
        has_active_ban = Ban.query.filter_by(user_id=user_id, is_active=True).first()
        if not has_active_ban:
            user = User.query.get(user_id)
            if user:
                user.is_banned = False
    db.session.commit()


def _expire_guest_bans():
    now = datetime.now()
    expired_bans = GuestBan.query.filter(
        GuestBan.is_active.is_(True),
        GuestBan.expires_at.isnot(None),
        GuestBan.expires_at <= now,
    ).all()
    if not expired_bans:
        return

    for ban in expired_bans:
        ban.is_active = False
        ban.unbanned_at = now
    db.session.commit()


def admin_required(func):
    @wraps(func)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return error_response("Brak autoryzacji.", 401)
        if not user.is_admin:
            return error_response("Wymagane sa uprawnienia administratora.", 403)
        try:
            _expire_bans()
            _expire_guest_bans()
        except Exception as error:
            db.session.rollback()
            log_exception("Unable to expire timed bans", error)
        return func(*args, **kwargs)
    return decorated_function


def log_admin_action(admin_id, action, target_user_id=None, details=None):
    try:
        db.session.add(AdminLog(
            admin_id=admin_id,
            action=action,
            target_user_id=target_user_id,
            details=details,
            ip_address=request.remote_addr,
        ))
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        log_exception("Failed to log admin action", error)


def _pagination_args(default_per_page=20):
    page = max(1, request.args.get("page", 1, type=int) or 1)
    per_page = max(1, min(100, request.args.get("per_page", default_per_page, type=int) or default_per_page))
    return page, per_page


def _admin_user_dict(user):
    data = user.to_dict()
    data.pop("avatar_url", None)
    return data


@admin.route("/changelog", methods=["GET"])
@admin_required
def get_changelog_entries():
    entries = ChangelogPost.query.order_by(ChangelogPost.date.desc(), ChangelogPost.created_at.desc()).all()
    return jsonify({
        "entries": [entry.to_dict(include_admin_meta=True) for entry in entries],
        "total": len(entries),
    })


@admin.route("/changelog", methods=["POST"])
@admin_required
def create_changelog_entry():
    current_user = get_current_user()
    data = json_body()
    title = _localized_text(data, "title", 200)
    summary = _localized_text(data, "summary", 2000)
    item = _localized_text(data, "item", 1000)
    category = data.get("category")
    raw_date = data.get("date")

    if not title:
        return error_response("Tytul musi zawierac wersje polska i angielska.", 400)
    if not summary:
        return error_response("Opis musi zawierac wersje polska i angielska.", 400)
    if not item:
        return error_response("Opis zmiany musi zawierac wersje polska i angielska.", 400)
    if category not in _CHANGELOG_CATEGORIES:
        return error_response("Kategoria zmiany jest nieprawidlowa.", 400)

    entry_date = date.today()
    if raw_date:
        if not isinstance(raw_date, str):
            return error_response("Data zmiany jest nieprawidlowa.", 400)
        try:
            entry_date = date.fromisoformat(raw_date)
        except ValueError:
            return error_response("Data zmiany jest nieprawidlowa.", 400)

    try:
        entry = ChangelogPost(
            date=entry_date,
            title_pl=title[0],
            title_en=title[1],
            summary_pl=summary[0],
            summary_en=summary[1],
            category=category,
            item_pl=item[0],
            item_en=item[1],
            created_by_id=current_user.id,
        )
        db.session.add(entry)
        db.session.commit()
        log_admin_action(current_user.id, "changelog_create", details=f"Title: {title[1]}")
        return jsonify({
            "message": "Wpis changelogu zostal dodany.",
            "entry": entry.to_dict(include_admin_meta=True),
        }), 201
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to create changelog entry", error)
        return error_response("Nie udalo sie dodac wpisu changelogu.", 500)


@admin.route("/users", methods=["GET"])
@admin_required
def get_users():
    page, per_page = _pagination_args()
    search = (request.args.get("search", "") or "").strip()
    status = (request.args.get("status", "all") or "all").lower()
    query = User.query
    if search:
        query = query.filter(User.username.ilike(f"%{search}%"))
    if status == "active":
        query = query.filter(User.is_banned.is_(False))
    elif status == "banned":
        query = query.filter(User.is_banned.is_(True))
    elif status == "admins":
        query = query.filter(User.is_admin.is_(True))
    elif status != "all":
        return error_response("Nieprawidlowy filtr uzytkownikow.", 400)

    pagination = query.order_by(User.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "users": [_admin_user_dict(user) for user in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": page,
    })


@admin.route("/users/<int:user_id>", methods=["GET"])
@admin_required
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return error_response("Nie znaleziono uzytkownika.", 404)
    bans = Ban.query.filter_by(user_id=user_id).order_by(Ban.banned_at.desc()).all()
    stats = GameStats.query.filter_by(user_id=user_id).order_by(GameStats.game_name.asc()).all()
    return jsonify({
        "user": _admin_user_dict(user),
        "ban_history": [ban.to_dict() for ban in bans],
        "stats": [stat.to_dict() for stat in stats],
    })


@admin.route("/ban", methods=["POST"])
@admin_required
def ban_user():
    current_user = get_current_user()
    data = json_body()
    user_id = data.get("user_id")
    reason = data.get("reason", "")
    duration_hours = data.get("duration_hours")
    if not isinstance(user_id, int) or isinstance(user_id, bool):
        return error_response("Id uzytkownika jest wymagane.", 400)
    if not isinstance(reason, str):
        return error_response("Powod blokady jest nieprawidlowy.", 400)

    user = User.query.get(user_id)
    if not user:
        return error_response("Nie znaleziono uzytkownika.", 404)
    if user.is_admin:
        return error_response("Nie mozna zablokowac administratora.", 400)

    expires_at = None
    if duration_hours is not None:
        try:
            duration_hours = float(duration_hours)
        except (TypeError, ValueError):
            return error_response("Czas blokady musi byc liczba.", 400)
        if duration_hours <= 0 or duration_hours > 24 * 365 * 10:
            return error_response("Czas blokady jest poza dozwolonym zakresem.", 400)
        expires_at = datetime.now() + timedelta(hours=duration_hours)

    try:
        Ban.query.filter_by(user_id=user_id, is_active=True).update({"is_active": False})
        ban = Ban(user_id=user_id, banned_by_id=current_user.id, reason=reason.strip(), expires_at=expires_at)
        user.is_banned = True
        db.session.add(ban)
        db.session.commit()
        socket.emit(
            "admin_ban",
            {"user_id": str(user_id), "reason": reason.strip() or "Konto zablokowane przez administratora"},
        )
        log_admin_action(current_user.id, "ban", user_id, f"Reason: {reason.strip()}")
        return jsonify({"message": f"Uzytkownik {user.username} zostal zablokowany.", "ban": ban.to_dict()})
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to ban user", error)
        return error_response("Nie udalo sie zablokowac uzytkownika.", 500)


@admin.route("/unban", methods=["POST"])
@admin_required
def unban_user():
    current_user = get_current_user()
    user_id = json_body().get("user_id")
    if not isinstance(user_id, int) or isinstance(user_id, bool):
        return error_response("Id uzytkownika jest wymagane.", 400)
    user = User.query.get(user_id)
    if not user:
        return error_response("Nie znaleziono uzytkownika.", 404)

    try:
        for ban in Ban.query.filter_by(user_id=user_id, is_active=True).all():
            ban.is_active = False
            ban.unbanned_at = datetime.now()
            ban.unbanned_by_id = current_user.id
        user.is_banned = False
        db.session.commit()
        log_admin_action(current_user.id, "unban", user_id, "User unbanned")
        return jsonify({"message": f"Blokada uzytkownika {user.username} zostala usunieta."})
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to unban user", error)
        return error_response("Nie udalo sie usunac blokady.", 500)


@admin.route("/kick", methods=["POST"])
@admin_required
def kick_user():
    current_user = get_current_user()
    data = json_body()
    user_id = data.get("user_id")
    room_id = data.get("room_id")
    reason = data.get("reason", "Wyrzucono przez administratora")
    if not isinstance(user_id, int) or isinstance(user_id, bool):
        return error_response("Id uzytkownika jest wymagane.", 400)
    if not isinstance(reason, str):
        return error_response("Powod wyrzucenia jest nieprawidlowy.", 400)
    user = User.query.get(user_id)
    if not user:
        return error_response("Nie znaleziono uzytkownika.", 404)

    from sockets.socket_manager import socket
    socket.emit("admin_kick", {"user_id": str(user_id), "reason": reason.strip(), "room_id": room_id})
    log_admin_action(current_user.id, "kick", user_id, f"Reason: {reason.strip()}. Room: {room_id or 'all'}")
    return jsonify({"message": f"Uzytkownik {user.username} zostal wyrzucony."})


@admin.route("/guest-kick", methods=["POST"])
@admin_required
def kick_guest():
    current_user = get_current_user()
    data = json_body()
    guest_token = data.get("guest_token")
    reason = data.get("reason", "Wyrzucono przez administratora")
    if not isinstance(guest_token, str) or not is_guest_token(guest_token):
        return error_response("Id goscia jest nieprawidlowe.", 400)
    if not isinstance(reason, str):
        return error_response("Powod wyrzucenia jest nieprawidlowy.", 400)

    session = active_sessions.get(guest_token)
    if not session or not session.get("is_guest") or not session.get("connected"):
        return error_response("Gosc nie jest juz online.", 404)

    reason = reason.strip() or "Wyrzucono przez administratora"
    socket.emit("admin_kick", {"user_id": guest_token, "reason": reason}, to=session.get("sid"))
    log_admin_action(current_user.id, "guest_kick", None, f"Guest: {session.get('username', 'GOSC')}. Reason: {reason}")
    return jsonify({"message": f"Gosc {session.get('username', 'GOSC')} zostal wyrzucony."})


@admin.route("/guest-ban", methods=["POST"])
@admin_required
def ban_guest():
    current_user = get_current_user()
    data = json_body()
    guest_token = data.get("guest_token")
    reason = data.get("reason", "")
    duration_hours = data.get("duration_hours")
    if not isinstance(guest_token, str) or not is_guest_token(guest_token):
        return error_response("Id goscia jest nieprawidlowe.", 400)
    if not isinstance(reason, str):
        return error_response("Powod blokady jest nieprawidlowy.", 400)

    session = active_sessions.get(guest_token)
    if not session or not session.get("is_guest") or not session.get("connected"):
        return error_response("Gosc nie jest juz online.", 404)

    expires_at = None
    if duration_hours is not None:
        try:
            duration_hours = float(duration_hours)
        except (TypeError, ValueError):
            return error_response("Czas blokady musi byc liczba.", 400)
        if duration_hours <= 0 or duration_hours > 24 * 365 * 10:
            return error_response("Czas blokady jest poza dozwolonym zakresem.", 400)
        expires_at = datetime.now() + timedelta(hours=duration_hours)

    reason = reason.strip()
    guest_name = session.get("username") or "GOSC"
    try:
        GuestBan.query.filter_by(guest_token=guest_token, is_active=True).update({"is_active": False})
        ban = GuestBan(
            guest_token=guest_token,
            guest_name=guest_name,
            banned_by_id=current_user.id,
            reason=reason,
            expires_at=expires_at,
        )
        db.session.add(ban)
        db.session.commit()
        socket.emit(
            "admin_ban",
            {"user_id": guest_token, "reason": reason or "Gosc zostal zablokowany przez administratora"},
            to=session.get("sid"),
        )
        log_admin_action(current_user.id, "guest_ban", None, f"Guest: {guest_name}. Reason: {reason}")
        return jsonify({"message": f"Gosc {guest_name} zostal zablokowany.", "ban": ban.to_dict()})
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to ban guest", error)
        return error_response("Nie udalo sie zablokowac goscia.", 500)


@admin.route("/guest-bans", methods=["GET"])
@admin_required
def get_guest_bans():
    page, per_page = _pagination_args()
    search = (request.args.get("search", "") or "").strip()
    query = GuestBan.query
    if (request.args.get("active_only", "false") or "").lower() == "true":
        query = query.filter_by(is_active=True)
    if search:
        query = query.filter(GuestBan.guest_name.ilike(f"%{search}%"))
    pagination = query.order_by(GuestBan.banned_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "bans": [ban.to_dict() for ban in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": page,
    })


@admin.route("/guest-unban", methods=["POST"])
@admin_required
def unban_guest():
    current_user = get_current_user()
    guest_ban_id = json_body().get("guest_ban_id")
    if not isinstance(guest_ban_id, int) or isinstance(guest_ban_id, bool):
        return error_response("Id blokady goscia jest wymagane.", 400)

    ban = GuestBan.query.get(guest_ban_id)
    if not ban:
        return error_response("Nie znaleziono blokady goscia.", 404)
    if not ban.is_active:
        return error_response("Ta blokada goscia jest juz zakonczona.", 400)

    try:
        ban.is_active = False
        ban.unbanned_at = datetime.now()
        ban.unbanned_by_id = current_user.id
        db.session.commit()
        log_admin_action(current_user.id, "guest_unban", None, f"Guest: {ban.guest_name}")
        return jsonify({"message": f"Blokada goscia {ban.guest_name} zostala usunieta."})
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to unban guest", error)
        return error_response("Nie udalo sie usunac blokady goscia.", 500)


@admin.route("/bans", methods=["GET"])
@admin_required
def get_bans():
    page, per_page = _pagination_args()
    query = Ban.query
    search = (request.args.get("search", "") or "").strip()
    if (request.args.get("active_only", "false") or "").lower() == "true":
        query = query.filter_by(is_active=True)
    if search:
        query = query.join(Ban.user).filter(User.username.ilike(f"%{search}%"))
    pagination = query.order_by(Ban.banned_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "bans": [ban.to_dict() for ban in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": page,
    })


@admin.route("/logs", methods=["GET"])
@admin_required
def get_logs():
    page, per_page = _pagination_args(50)
    query = AdminLog.query
    action_filter = (request.args.get("action") or "").strip()
    if action_filter:
        query = query.filter_by(action=action_filter)
    pagination = query.order_by(AdminLog.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "logs": [log.to_dict() for log in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": page,
    })


@admin.route("/stats", methods=["GET"])
@admin_required
def get_stats():
    total_users = User.query.count()
    banned_users = User.query.filter_by(is_banned=True).count()
    active_bans = Ban.query.filter_by(is_active=True).count()
    yesterday = datetime.now() - timedelta(hours=24)
    connected_sessions = [
        session for session in active_sessions.values()
        if session.get("connected") and not session.get("is_guest")
    ]
    return jsonify({
        "total_users": total_users,
        "banned_users": banned_users,
        "active_bans": active_bans,
        "admin_users": User.query.filter_by(is_admin=True).count(),
        "online_users": len(connected_sessions),
        "recent_bans_24h": Ban.query.filter(Ban.banned_at >= yesterday).count(),
        "recent_actions_24h": AdminLog.query.filter(AdminLog.created_at >= yesterday).count(),
        "new_users_24h": User.query.filter(User.created_at >= yesterday).count(),
    })


@admin.route("/online", methods=["GET"])
@admin_required
def get_online_users():
    online = []
    for token, session in active_sessions.items():
        if not session.get("connected"):
            continue
        user_id = None
        if not session.get("is_guest"):
            try:
                user_id = int(token)
            except (TypeError, ValueError):
                user_id = None
        online.append({
            "user_id": user_id,
            "guest_token": token if session.get("is_guest") else None,
            "username": session.get("username") or "GOSC",
            "is_guest": bool(session.get("is_guest")),
            "room_id": session.get("room_id"),
            "status": "w grze" if session.get("room_id") else "online",
        })
    online.sort(key=lambda player: (player["is_guest"], player["username"].lower()))
    return jsonify({"online": online, "total": len(online)})


@admin.route("/make-admin", methods=["POST"])
@admin_required
def make_admin():
    current_user = get_current_user()
    user_id = json_body().get("user_id")
    if not isinstance(user_id, int) or isinstance(user_id, bool):
        return error_response("Id uzytkownika jest wymagane.", 400)
    user = User.query.get(user_id)
    if not user:
        return error_response("Nie znaleziono uzytkownika.", 404)
    try:
        user.is_admin = True
        db.session.commit()
        log_admin_action(current_user.id, "make_admin", user_id, "Granted admin privileges")
        return jsonify({"message": f"Uzytkownik {user.username} jest teraz administratorem."})
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to grant admin privileges", error)
        return error_response("Nie udalo sie nadac uprawnien.", 500)


@admin.route("/reset-stats", methods=["POST"])
@admin_required
def reset_stats():
    current_user = get_current_user()
    user_id = json_body().get("user_id")
    if not isinstance(user_id, int) or isinstance(user_id, bool):
        return error_response("Id uzytkownika jest wymagane.", 400)
    user = User.query.get(user_id)
    if not user:
        return error_response("Nie znaleziono uzytkownika.", 404)
    try:
        stats = GameStats.query.filter_by(user_id=user_id).all()
        for stat in stats:
            stat.wins = 0
            stat.losses = 0
            stat.draws = 0
        db.session.commit()
        log_admin_action(current_user.id, "reset_stats", user_id, "Reset game statistics")
        return jsonify({"message": f"Wyzerowano statystyki uzytkownika {user.username}."})
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to reset user statistics", error)
        return error_response("Nie udalo sie wyzerowac statystyk.", 500)


@admin.route("/notify", methods=["POST"])
@admin_required
def notify_users():
    current_user = get_current_user()
    data = json_body()
    message = data.get("message")
    user_id = data.get("user_id")
    if not isinstance(message, str) or not message.strip():
        return error_response("Wiadomosc jest wymagana.", 400)
    if len(message.strip()) > 300:
        return error_response("Wiadomosc moze miec maksymalnie 300 znakow.", 400)
    if user_id is not None and (not isinstance(user_id, int) or isinstance(user_id, bool)):
        return error_response("Id uzytkownika jest nieprawidlowe.", 400)
    if user_id is not None and not User.query.get(user_id):
        return error_response("Nie znaleziono uzytkownika.", 404)

    payload = {
        "user_id": str(user_id) if user_id is not None else None,
        "message": message.strip(),
    }
    socket.emit("admin_notice", payload)
    log_admin_action(
        current_user.id,
        "notify",
        user_id,
        "Message sent to " + ("all online users" if user_id is None else "one user"),
    )
    return jsonify({"message": "Wiadomosc zostala wyslana."})


@admin.route("/revoke-admin", methods=["POST"])
@admin_required
def revoke_admin():
    current_user = get_current_user()
    user_id = json_body().get("user_id")
    if not isinstance(user_id, int) or isinstance(user_id, bool):
        return error_response("Id uzytkownika jest wymagane.", 400)
    if user_id == current_user.id:
        return error_response("Nie mozna odebrac sobie uprawnien.", 400)
    user = User.query.get(user_id)
    if not user:
        return error_response("Nie znaleziono uzytkownika.", 404)
    try:
        user.is_admin = False
        db.session.commit()
        log_admin_action(current_user.id, "revoke_admin", user_id, "Revoked admin privileges")
        return jsonify({"message": f"Odebrano uprawnienia administratora uzytkownikowi {user.username}."})
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to revoke admin privileges", error)
        return error_response("Nie udalo sie odebrac uprawnien.", 500)


@admin.route("/check", methods=["GET"])
def check_admin():
    user = get_current_user()
    if not user:
        return jsonify({"is_admin": False}), 200
    return jsonify({"is_admin": bool(user.is_admin), "user_id": user.id, "username": user.username})
