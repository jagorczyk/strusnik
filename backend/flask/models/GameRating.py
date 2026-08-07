from datetime import datetime

from sqlalchemy import UniqueConstraint

from models import db


DEFAULT_RANKED_RATING = 500


class GameRating(db.Model):
    __tablename__ = "game_ratings"
    __table_args__ = (UniqueConstraint("user_id", "game_name", name="uq_game_ratings_user_game"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    game_name = db.Column(db.String(50), nullable=False)
    rating = db.Column(db.Integer, default=DEFAULT_RANKED_RATING, nullable=False)
    games_played = db.Column(db.Integer, default=0, nullable=False)
    wins = db.Column(db.Integer, default=0, nullable=False)
    losses = db.Column(db.Integer, default=0, nullable=False)
    draws = db.Column(db.Integer, default=0, nullable=False)
    peak_rating = db.Column(db.Integer, default=DEFAULT_RANKED_RATING, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    user = db.relationship("User", backref="game_ratings")

    def to_dict(self):
        effective_rating = self.rating if (self.games_played or 0) > 0 else DEFAULT_RANKED_RATING
        return {
            "user_id": self.user.id,
            "username": self.user.username,
            "avatar_url": self.user.avatar_url,
            "game_name": self.game_name,
            "rating": effective_rating,
            "games_played": self.games_played,
            "wins": self.wins,
            "losses": self.losses,
            "draws": self.draws,
            "peak_rating": self.peak_rating,
            "provisional": self.games_played < 10,
        }
