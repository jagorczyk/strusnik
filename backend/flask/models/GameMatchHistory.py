import json
from datetime import datetime

from models import db


class GameMatchHistory(db.Model):
    __tablename__ = "game_match_history"

    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.String(64), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    game_name = db.Column(db.String(50), nullable=False, index=True)
    mode = db.Column(db.String(16), nullable=False, default="casual")
    result = db.Column(db.String(8), nullable=False)
    opponents_json = db.Column(db.Text, nullable=False, default="[]")
    played_at = db.Column(db.DateTime, default=datetime.now, nullable=False, index=True)
    elo_before = db.Column(db.Integer, nullable=True)
    elo_after = db.Column(db.Integer, nullable=True)
    elo_delta = db.Column(db.Integer, nullable=True)

    user = db.relationship("User", backref="game_match_history")

    @property
    def opponents(self):
        try:
            parsed = json.loads(self.opponents_json or "[]")
        except (TypeError, ValueError):
            return []
        return parsed if isinstance(parsed, list) else []

    def to_dict(self):
        return {
            "id": self.id,
            "match_id": self.match_id,
            "game": self.game_name,
            "mode": self.mode,
            "result": self.result,
            "opponents": self.opponents,
            "played_at": self.played_at.isoformat() if self.played_at else None,
            "elo_before": self.elo_before,
            "elo_after": self.elo_after,
            "elo_delta": self.elo_delta,
        }
