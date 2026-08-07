from flask import Blueprint, jsonify
from sqlalchemy import desc, func

from api_utils import error_response, json_body, log_exception
from models import GameRating, GameStats, User, db

rankings = Blueprint("rankings", __name__)

GAME_NAME_ALIASES = {
    "battleships": ("battleships",),
    "chess": ("chess",),
    "haxball": ("haxball",),
    "set": ("set", "setgame"),
    "stratego": ("stratego",),
    "tysiac": ("tysiac", "thousand"),
}


@rankings.route("/<game_name>", methods=["GET"])
def get_ranking(game_name):
    game_name = (game_name or "").strip()
    if not game_name:
        return error_response("Nazwa gry jest wymagana.", 400)

    normalized_game_names = GAME_NAME_ALIASES.get(game_name.lower(), (game_name.lower(),))

    try:
        stats = (
            GameStats.query
            .filter(func.lower(GameStats.game_name).in_(normalized_game_names))
            .join(User)
            .order_by(desc(GameStats.points), desc(GameStats.wins), desc(GameStats.goals), User.username.asc())
            .limit(10)
            .all()
        )
        ranking = []
        for stat in stats:
            entry = stat.to_dict()
            entry["avatar_url"] = f"/api/profile/avatar/{stat.user.id}" if stat.user.avatar_url else None
            ranking.append(entry)
        return jsonify(ranking), 200
    except Exception as error:
        log_exception("Unable to fetch ranking", error)
        return error_response("Nie udalo sie pobrac rankingu.", 500)


@rankings.route("/elo/<game_name>", methods=["GET"])
def get_elo_ranking(game_name):
    game_name = (game_name or "").strip().lower()
    if game_name not in {"chess", "battleships", "stratego"}:
        return error_response("Ta gra nie ma jeszcze rankingu ELO.", 400)

    try:
        all_ratings = (
            GameRating.query
            .filter(func.lower(GameRating.game_name) == game_name)
            .join(User)
            .order_by(desc(GameRating.rating), desc(GameRating.wins), User.username.asc())
            .all()
        )
        total_players = len(all_ratings)
        ranking = []
        for position, rating in enumerate(all_ratings[:100], start=1):
            entry = rating.to_dict()
            entry["position"] = position
            entry["rank"] = position
            entry["total_players"] = total_players
            entry["avatar_url"] = f"/api/profile/avatar/{rating.user.id}" if rating.user.avatar_url else None
            ranking.append(entry)
        return jsonify(ranking), 200
    except Exception as error:
        log_exception("Unable to fetch ELO ranking", error)
        return error_response("Nie udalo sie pobrac rankingu ELO.", 500)


@rankings.route("/add_win", methods=["POST"])
def add_win():
    data = json_body()
    username = data.get("username")
    game_name = data.get("game_name")
    if not isinstance(username, str) or not username.strip() or not isinstance(game_name, str) or not game_name.strip():
        return error_response("Nazwa uzytkownika i gry sa wymagane.", 400)

    try:
        user = User.query.filter_by(username=username.strip()).first()
        if not user:
            return error_response("Nie znaleziono uzytkownika.", 404)

        stat = GameStats.query.filter_by(user_id=user.id, game_name=game_name.strip()).first()
        if not stat:
            stat = GameStats(user_id=user.id, game_name=game_name.strip(), wins=1)
            db.session.add(stat)
        else:
            stat.wins = (stat.wins or 0) + 1

        db.session.commit()
        return jsonify({"message": "Wygrana zostala zapisana.", "new_wins": stat.wins}), 200
    except Exception as error:
        db.session.rollback()
        log_exception("Unable to save game win", error)
        return error_response("Nie udalo sie zapisac wygranej.", 500)
