from datetime import datetime

from sqlalchemy import Text
from sqlalchemy.dialects.mysql import LONGTEXT

from models import db

class User(db.Model):
    __tablename__ = "users"
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True)
    password = db.Column(db.String(255), nullable=True)
    google_sub = db.Column(db.String(255), unique=True, nullable=True)
    is_admin = db.Column(db.Boolean, default=False)
    is_banned = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    last_login = db.Column(db.DateTime, nullable=True)
    avatar_url = db.Column(Text().with_variant(LONGTEXT(), "mysql"), nullable=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.username,
            "is_admin": self.is_admin,
            "is_banned": self.is_banned,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "avatar_url": self.avatar_url,
            "has_password": bool(self.password),
            "has_google": bool(self.google_sub),
        }
        