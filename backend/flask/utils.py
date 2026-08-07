from datetime import datetime, timedelta, timezone
import json
from uuid import uuid4

import jwt
from flask import current_app


def create_jwt_token(user_id: int, login: str):
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": user_id,
        "login": login,
        "iat": now,
        "exp": now + timedelta(seconds=current_app.config["TOKEN_MAX_AGE"]),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def parse_jwt_token(token: str):
    return jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])


GAME_NAME_ALIASES = {
    "thousand": "tysiac",
    "tysiac": "tysiac",
    "setgame": "set",
}


def canonical_game_name(game_name):
    normalized = str(game_name or "").strip().lower()
    return GAME_NAME_ALIASES.get(normalized, normalized)


def record_match_history(game_name, seats, winner_indices=None, draw=False, mode="casual"):
    """Add one profile history row for every authenticated participant."""
    from models import GameMatchHistory, User, db

    if not isinstance(seats, (list, tuple)):
        return None

    winner_indices = set(winner_indices or [])
    match_id = uuid4().hex
    canonical_name = canonical_game_name(game_name)
    normalized_mode = "ranked" if str(mode or "").lower() == "ranked" else "casual"
    participants = []

    for index, seat in enumerate(seats):
        if not seat or not seat.get("userId"):
            continue
        try:
            user = db.session.get(User, int(seat.get("userId")))
        except (TypeError, ValueError):
            user = None
        if user:
            participants.append((index, user))

    for index, user in participants:
        opponents = [
            str(seat.get("name") or "GOSC")[:100]
            for seat_index, seat in enumerate(seats)
            if seat and seat_index != index
        ]
        player_draw = draw or (len(winner_indices) > 1 and index in winner_indices)
        result = "draw" if player_draw else ("win" if index in winner_indices else "loss")
        db.session.add(GameMatchHistory(
            match_id=match_id,
            user_id=user.id,
            game_name=canonical_name,
            mode=normalized_mode,
            result=result,
            opponents_json=json.dumps(opponents, ensure_ascii=False),
        ))

    return match_id


def record_multiplayer_result(game_name, seats, winner_indices=None, draw=False, mode="casual"):
    """Persist one completed multiplayer result and its profile history."""
    from models import GameStats, User, db

    winner_indices = set(winner_indices or [])
    record_match_history(game_name, seats, winner_indices=winner_indices, draw=draw, mode=mode)
    for index, seat in enumerate(seats):
        if not seat or not seat.get("userId"):
            continue

        user = User.query.get(seat.get("userId"))
        if not user:
            continue

        stat = GameStats.query.filter_by(user_id=user.id, game_name=game_name).first()
        if not stat:
            stat = GameStats(user_id=user.id, game_name=game_name)
            db.session.add(stat)

        if draw:
            stat.draws = (stat.draws or 0) + 1
            stat.points = (stat.points or 0) + 1
        elif index in winner_indices:
            stat.wins = (stat.wins or 0) + 1
            stat.points = (stat.points or 0) + 3
        else:
            stat.losses = (stat.losses or 0) + 1

    db.session.commit()


RANKED_GAME_NAMES = {"chess", "battleships", "stratego"}
RANKED_GAME_ORDER = ("chess", "battleships", "stratego")
RANKED_INITIAL_RATING = 500
LEGACY_RANKED_INITIAL_RATING = 1200
RANKED_PROVISIONAL_GAMES = 10


def canonical_ranked_game_name(game_name):
    normalized = str(game_name or "").strip().lower()
    return normalized if normalized in RANKED_GAME_NAMES else None


def get_game_rating(user_id, game_name):
    from models import GameRating, db

    canonical_name = canonical_ranked_game_name(game_name)
    if canonical_name is None or user_id is None:
        return None

    try:
        numeric_user_id = int(user_id)
    except (TypeError, ValueError):
        return None

    rating = GameRating.query.filter_by(user_id=numeric_user_id, game_name=canonical_name).first()
    if rating:
        if (
            (rating.games_played or 0) == 0
            and rating.rating == LEGACY_RANKED_INITIAL_RATING
            and (rating.peak_rating or LEGACY_RANKED_INITIAL_RATING) == LEGACY_RANKED_INITIAL_RATING
        ):
            rating.rating = RANKED_INITIAL_RATING
            rating.peak_rating = RANKED_INITIAL_RATING
            db.session.commit()
        return rating

    rating = GameRating(
        user_id=numeric_user_id,
        game_name=canonical_name,
        rating=RANKED_INITIAL_RATING,
        peak_rating=RANKED_INITIAL_RATING,
    )
    db.session.add(rating)
    db.session.commit()
    return rating


def calculate_elo_change(player_rating, opponent_rating, score, games_played):
    import math

    k_factor = 40 if int(games_played or 0) < RANKED_PROVISIONAL_GAMES else 32
    expected = 1 / (1 + math.pow(10, (opponent_rating - player_rating) / 400))
    return round(k_factor * (score - expected))


def record_ranked_result(game_name, seats, winner_index=None, draw=False):
    """Update the separate rating for both authenticated players in a ranked match."""
    from models import GameMatchHistory, GameRating, User, db

    canonical_name = canonical_ranked_game_name(game_name)
    if canonical_name is None or not isinstance(seats, (list, tuple)) or len(seats) < 2:
        return []

    users = []
    for seat in seats[:2]:
        if not seat or str(seat.get("userId", "")).startswith("guest_"):
            return []
        try:
            user_id = int(seat.get("userId"))
        except (TypeError, ValueError):
            return []
        user = db.session.get(User, user_id)
        if not user:
            return []
        users.append(user)

    ratings = []
    for user in users:
        rating = GameRating.query.filter_by(user_id=user.id, game_name=canonical_name).first()
        if not rating:
            rating = GameRating(
                user_id=user.id,
                game_name=canonical_name,
                rating=RANKED_INITIAL_RATING,
                peak_rating=RANKED_INITIAL_RATING,
            )
            db.session.add(rating)
            db.session.flush()
        ratings.append(rating)

    scores = [0.5, 0.5] if draw else [1.0 if winner_index == 0 else 0.0, 1.0 if winner_index == 1 else 0.0]
    previous = [rating.rating for rating in ratings]
    deltas = [
        calculate_elo_change(previous[0], previous[1], scores[0], ratings[0].games_played),
        calculate_elo_change(previous[1], previous[0], scores[1], ratings[1].games_played),
    ]

    result = []
    for index, rating in enumerate(ratings):
        rating.rating = max(0, previous[index] + deltas[index])
        rating.games_played = (rating.games_played or 0) + 1
        if draw:
            rating.draws = (rating.draws or 0) + 1
        elif index == winner_index:
            rating.wins = (rating.wins or 0) + 1
        else:
            rating.losses = (rating.losses or 0) + 1
        rating.peak_rating = max(rating.peak_rating or RANKED_INITIAL_RATING, rating.rating)
        history = (
            GameMatchHistory.query
            .filter_by(user_id=users[index].id, game_name=canonical_name, mode="ranked")
            .filter(GameMatchHistory.elo_after.is_(None))
            .order_by(GameMatchHistory.played_at.desc(), GameMatchHistory.id.desc())
            .first()
        )
        if history:
            history.elo_before = previous[index]
            history.elo_after = rating.rating
            history.elo_delta = deltas[index]
        result.append({
            "user_id": users[index].id,
            "rating": rating.rating,
            "previous_rating": previous[index],
            "delta": deltas[index],
            "games_played": rating.games_played,
            "provisional": rating.games_played < RANKED_PROVISIONAL_GAMES,
        })

    db.session.commit()
    return result


def record_haxball_match(
    match_id,
    room_id,
    map_id,
    mode,
    duration_min,
    score,
    winner_team,
    reason,
    participants,
    started_at=None,
):
    """Persist one Haxball match and its aggregate stats exactly once."""
    from sqlalchemy.exc import IntegrityError

    from models import GameStats, HaxballMatch, HaxballMatchParticipant, User, db

    if not match_id:
        return False

    if HaxballMatch.query.filter_by(match_id=str(match_id)).first():
        return False

    score = score if isinstance(score, dict) else {}
    winner_team = winner_team if winner_team in {"red", "blue"} else None
    match = HaxballMatch(
        match_id=str(match_id),
        room_id=str(room_id) if room_id else None,
        map_id=str(map_id or "classic-arena"),
        mode=str(mode or "1v1"),
        duration_min=int(duration_min or 5),
        score_red=int(score.get("red", 0) or 0),
        score_blue=int(score.get("blue", 0) or 0),
        winner_team=winner_team,
        reason=str(reason or "time"),
        started_at=datetime.fromtimestamp(float(started_at)) if started_at else None,
    )
    db.session.add(match)

    for participant in participants or []:
        user_id = participant.get("userId")
        user = None
        try:
            if user_id is not None and not str(user_id).startswith("guest_"):
                user = db.session.get(User, int(user_id))
        except (TypeError, ValueError):
            user = None

        team = participant.get("team") if participant.get("team") in {"red", "blue"} else "red"
        result = "draw" if winner_team is None else ("win" if team == winner_team else "loss")
        goals = int(participant.get("goals", 0) or 0)
        assists = int(participant.get("assists", 0) or 0)
        own_goals = int(participant.get("ownGoals", 0) or 0)

        db.session.add(HaxballMatchParticipant(
            match=match,
            user=user,
            player_name=str(participant.get("name") or "GOSC")[:100],
            team=team,
            goals=goals,
            assists=assists,
            own_goals=own_goals,
            result=result,
        ))

        if not user:
            continue

        stat = GameStats.query.filter_by(user_id=user.id, game_name="Haxball").first()
        if not stat:
            stat = GameStats(user_id=user.id, game_name="Haxball")
            db.session.add(stat)

        if result == "win":
            stat.wins = (stat.wins or 0) + 1
            stat.points = (stat.points or 0) + 3
        elif result == "draw":
            stat.draws = (stat.draws or 0) + 1
            stat.points = (stat.points or 0) + 1
        else:
            stat.losses = (stat.losses or 0) + 1
        stat.goals = (stat.goals or 0) + goals
        stat.assists = (stat.assists or 0) + assists

    try:
        db.session.commit()
        return True
    except IntegrityError:
        db.session.rollback()
        return False
    except Exception:
        db.session.rollback()
        raise


def is_token_valid(token: str):
    if not isinstance(token, str) or not token:
        return False

    try:
        payload = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
        if "exp" in payload:
            return True

        # Accept tokens issued by the previous version while they are still valid.
        expires = payload.get("expires")
        if not expires:
            return False
        expires_at = datetime.fromisoformat(expires)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) < expires_at
    except (jwt.InvalidTokenError, TypeError, ValueError):
        return False
