import base64
import binascii
from datetime import datetime

from flask import Blueprint, jsonify, make_response, request

from api_utils import error_response, json_body, log_exception
from models import (
    GameMatchHistory,
    GameRating,
    GameStats,
    HaxballMatch,
    HaxballMatchParticipant,
    SinglePlayerStats,
    User,
    db,
)
from utils import (
    RANKED_GAME_ORDER,
    RANKED_INITIAL_RATING,
    is_token_valid,
    parse_jwt_token,
)

profile = Blueprint("profile", __name__)

MAX_AVATAR_BYTES = 2 * 1024 * 1024
AVATAR_SIGNATURES = {
    "image/png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
    "image/webp": lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP",
}

DB_TO_FRONTEND_MAP = {
    "Thousand": "tysiac",
    "Tysiac": "tysiac",
    "Battleships": "battleships",
    "Stratego": "stratego",
    "TicTacToe": "tictactoe",
    "Chess": "chess",
    "chess": "chess",
    "SetGame": "set",
    "Set": "set",
    "Haxball": "haxball",
    "Snake": "snake",
    "Blackjack": "blackjack",
}


def _token_from_request():
    token = request.cookies.get("jwtToken")
    if token:
        return token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return None


def get_current_user():
    token = _token_from_request()
    if not token or not is_token_valid(token):
        return None
    try:
        payload = parse_jwt_token(token)
        return User.query.get(payload.get("user_id"))
    except Exception:
        return None


def _frontend_game_key(name):
    return DB_TO_FRONTEND_MAP.get(name, str(name).lower())


def _normalize_avatar(value):
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Avatar musi byc obrazem.")

    try:
        header, encoded = value.split(",", 1)
    except ValueError as error:
        raise ValueError("Nieprawidlowy format avatara.") from error

    parts = header.lower().split(";")
    mime_type = parts[0][5:] if parts and parts[0].startswith("data:") else ""
    if mime_type not in AVATAR_SIGNATURES or "base64" not in parts[1:]:
        raise ValueError("Dozwolone sa obrazy PNG, JPEG i WebP.")

    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("Nieprawidlowy obraz.") from error

    if not image_bytes or len(image_bytes) > MAX_AVATAR_BYTES:
        raise ValueError("Avatar nie moze przekraczac 2 MB.")
    if not AVATAR_SIGNATURES[mime_type](image_bytes):
        raise ValueError("Plik nie jest prawidlowym obrazem.")

    normalized = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime_type};base64,{normalized}"


@profile.route("/me", methods=["GET"])
def get_my_profile():
    user = get_current_user()
    if not user:
        return error_response("Brak autoryzacji.", 401)
    return get_profile_data(user)


@profile.route("/haxball/history", methods=["GET"])
def get_haxball_history():
    user = get_current_user()
    if not user:
        return error_response("Brak autoryzacji.", 401)

    matches = (
        HaxballMatch.query
        .join(HaxballMatchParticipant)
        .filter(HaxballMatchParticipant.user_id == user.id)
        .order_by(HaxballMatch.ended_at.desc())
        .all()
    )
    return jsonify([match.to_dict() for match in matches])


@profile.route("/avatar", methods=["PUT", "POST", "DELETE"])
def update_avatar():
    user = get_current_user()
    if not user:
        return error_response("Brak autoryzacji.", 401)

    if request.method == "DELETE":
        user.avatar_url = None
        db.session.commit()
        return jsonify({"avatar_url": None})

    data = json_body()
    if "avatar_url" not in data:
        return error_response("Avatar jest wymagany.", 400)

    try:
        user.avatar_url = _normalize_avatar(data["avatar_url"])
        db.session.commit()
        return jsonify({"avatar_url": user.avatar_url})
    except ValueError as error:
        db.session.rollback()
        return error_response(str(error), 400)
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to update avatar", error)
        return error_response("Nie udalo sie zapisac avatara.", 500)


def _avatar_response(user):
    if not user or not user.avatar_url:
        return error_response("Nie znaleziono avatara.", 404)

    try:
        header, encoded = user.avatar_url.split(",", 1)
        mime_type = header.split(";", 1)[0][5:].lower()
        image_bytes = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        return error_response("Nieprawidlowy avatar.", 404)

    if mime_type not in AVATAR_SIGNATURES or not AVATAR_SIGNATURES[mime_type](image_bytes):
        return error_response("Nieprawidlowy avatar.", 404)

    response = make_response(image_bytes)
    response.headers["Content-Type"] = mime_type
    response.headers["Cache-Control"] = "public, max-age=60"
    return response


@profile.route("/avatar/<int:user_id>", methods=["GET"])
def get_user_avatar_by_id(user_id):
    return _avatar_response(User.query.get(user_id))


@profile.route("/<username>/avatar", methods=["GET"])
def get_user_avatar(username):
    if not username or len(username) > 100:
        return error_response("Nieprawidlowa nazwa uzytkownika.", 400)
    return _avatar_response(User.query.filter_by(username=username).first())


@profile.route("/<username>", methods=["GET"])
def get_user_profile(username):
    if not username or len(username) > 100:
        return error_response("Nieprawidlowa nazwa uzytkownika.", 400)
    user = User.query.filter_by(username=username).first()
    if not user:
        return error_response("Nie znaleziono uzytkownika.", 404)
    return get_profile_data(user)


def get_profile_data(user):
    multiplayer_stats = GameStats.query.filter_by(user_id=user.id).all()
    multiplayer_by_game = {}
    for stat in multiplayer_stats:
        key = _frontend_game_key(stat.game_name)
        current = multiplayer_by_game.setdefault(key, {"wins": 0, "losses": 0, "draws": 0, "points": 0, "goals": 0, "assists": 0})
        current["wins"] += stat.wins or 0
        current["losses"] += stat.losses or 0
        current["draws"] += stat.draws or 0
        current["points"] += stat.points or 0
        current["goals"] += stat.goals or 0
        current["assists"] += stat.assists or 0

    total_wins = sum(item["wins"] for item in multiplayer_by_game.values())
    total_losses = sum(item["losses"] for item in multiplayer_by_game.values())
    total_draws = sum(item["draws"] for item in multiplayer_by_game.values())
    total_games = total_wins + total_losses + total_draws
    win_ratio = round((total_wins / total_games) * 100, 1) if total_games else 0

    singleplayer_stats = SinglePlayerStats.query.filter_by(user_id=user.id).all()
    singleplayer_by_game = {}
    for stat in singleplayer_stats:
        key = _frontend_game_key(stat.game_name)
        current = singleplayer_by_game.setdefault(key, {"best_score": 0, "games_played": 0})
        current["best_score"] = max(current["best_score"], stat.best_score or 0)
        current["games_played"] += stat.games_played or 0

    ratings_by_game = {
        rating.game_name: rating
        for rating in GameRating.query.filter_by(user_id=user.id).all()
    }
    elo = []
    for game_name in RANKED_GAME_ORDER:
        leaderboard = (
            GameRating.query
            .filter_by(game_name=game_name)
            .join(User)
            .order_by(GameRating.rating.desc(), GameRating.wins.desc(), User.username.asc())
            .all()
        )
        rating = ratings_by_game.get(game_name)
        games_played = (rating.games_played or 0) if rating else 0
        has_played_ranked_game = games_played > 0
        position = next(
            (index for index, entry in enumerate(leaderboard, start=1) if entry.user_id == user.id),
            None,
        )
        elo.append({
            "game": game_name,
            "rating": rating.rating if has_played_ranked_game else RANKED_INITIAL_RATING,
            "games_played": games_played,
            "wins": rating.wins if rating else 0,
            "losses": rating.losses if rating else 0,
            "draws": rating.draws if rating else 0,
            "peak_rating": rating.peak_rating if has_played_ranked_game else RANKED_INITIAL_RATING,
            "provisional": games_played < 10,
            "position": position,
            "rank": position,
            "total_players": len(leaderboard),
        })

    history_items = []
    for entry in GameMatchHistory.query.filter_by(user_id=user.id).all():
        history_items.append((entry.played_at or datetime.min, entry.to_dict()))

    haxball_matches = (
        HaxballMatch.query
        .join(HaxballMatchParticipant)
        .filter(HaxballMatchParticipant.user_id == user.id)
        .order_by(HaxballMatch.ended_at.desc())
        .all()
    )
    for match in haxball_matches:
        participant = next(
            (item for item in match.participants if item.user_id == user.id),
            None,
        )
        if not participant:
            continue
        history_items.append((match.ended_at or datetime.min, {
            "id": f"haxball:{match.match_id}",
            "match_id": match.match_id,
            "game": "haxball",
            "mode": "casual",
            "result": participant.result,
            "opponents": [
                item.player_name
                for item in match.participants
                if item.id != participant.id
            ],
            "played_at": match.ended_at.isoformat() if match.ended_at else None,
            "elo_before": None,
            "elo_after": None,
            "elo_delta": None,
            "details": {
                "map_id": match.map_id,
                "duration_min": match.duration_min,
                "score": {"red": match.score_red, "blue": match.score_blue},
                "goals": participant.goals,
                "assists": participant.assists,
            },
        }))

    history_items.sort(key=lambda item: item[0], reverse=True)
    history = [entry for _, entry in history_items]

    return jsonify({
        "username": user.username,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "avatar_url": user.avatar_url,
        "multiplayer": {
            "games": total_games,
            "wins": total_wins,
            "losses": total_losses,
            "draws": total_draws,
            "win_ratio": win_ratio,
            "total_wins": total_wins,
            "points": sum(item["points"] for item in multiplayer_by_game.values()),
            "goals": sum(item["goals"] for item in multiplayer_by_game.values()),
            "assists": sum(item["assists"] for item in multiplayer_by_game.values()),
            "by_game": multiplayer_by_game,
        },
        "elo": elo,
        "history": history,
        "singleplayer": {"by_game": singleplayer_by_game},
    })


@profile.route("/singleplayer/score", methods=["POST"])
def update_singleplayer_score():
    user = get_current_user()
    if not user:
        return error_response("Brak autoryzacji.", 401)

    data = json_body()
    game_name = data.get("game_name")
    score = data.get("score", 0)
    if not isinstance(game_name, str) or not game_name.strip():
        return error_response("Nazwa gry jest wymagana.", 400)
    if isinstance(score, bool):
        return error_response("Wynik musi byc liczba calkowita.", 400)
    try:
        score = int(score)
    except (TypeError, ValueError):
        return error_response("Wynik musi byc liczba calkowita.", 400)
    if score < 0 or score > 2_147_483_647:
        return error_response("Wynik jest poza dozwolonym zakresem.", 400)

    try:
        normalized_name = game_name.strip().lower()
        stat = SinglePlayerStats.query.filter_by(user_id=user.id, game_name=normalized_name).first()
        if not stat:
            stat = SinglePlayerStats(
                user_id=user.id,
                game_name=normalized_name,
                best_score=score,
                games_played=1,
            )
            db.session.add(stat)
        else:
            stat.games_played += 1
            stat.best_score = max(stat.best_score or 0, score)

        db.session.commit()
        return jsonify({
            "message": "Wynik zostal zapisany.",
            "best_score": stat.best_score,
            "games_played": stat.games_played,
        })
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to update singleplayer score", error)
        return error_response("Nie udalo sie zapisac wyniku.", 500)
