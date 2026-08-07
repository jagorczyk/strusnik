from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from models.User import User
from models.GameStats import GameStats
from models.Ban import Ban
from models.AdminLog import AdminLog
from models.GuestBan import GuestBan
from models.SinglePlayerStats import SinglePlayerStats
from models.FriendRequest import FriendRequest
from models.Friendship import Friendship
from models.HaxballMatch import HaxballMatch, HaxballMatchParticipant
from models.ChangelogPost import ChangelogPost
from models.GameRating import GameRating
from models.GameMatchHistory import GameMatchHistory

__all__ = [
    "db",
    "User",
    "GameStats",
    "Ban",
    "AdminLog",
    "GuestBan",
    "SinglePlayerStats",
    "FriendRequest",
    "Friendship",
    "HaxballMatch",
    "HaxballMatchParticipant",
    "ChangelogPost",
    "GameRating",
    "GameMatchHistory",
]