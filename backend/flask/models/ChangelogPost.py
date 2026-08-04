from datetime import date as date_type, datetime

from sqlalchemy import Text
from sqlalchemy.dialects.mysql import LONGTEXT

from models import db


class ChangelogPost(db.Model):
    __tablename__ = "changelog_posts"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, default=date_type.today, nullable=False)
    title_pl = db.Column(db.String(200), nullable=False)
    title_en = db.Column(db.String(200), nullable=False)
    summary_pl = db.Column(Text().with_variant(LONGTEXT(), "mysql"), nullable=False)
    summary_en = db.Column(Text().with_variant(LONGTEXT(), "mysql"), nullable=False)
    category = db.Column(db.String(20), nullable=False)
    item_pl = db.Column(Text().with_variant(LONGTEXT(), "mysql"), nullable=False)
    item_en = db.Column(Text().with_variant(LONGTEXT(), "mysql"), nullable=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now, nullable=False)

    created_by = db.relationship("User", foreign_keys=[created_by_id])

    def to_dict(self, include_admin_meta=False):
        data = {
            "id": self.id,
            "date": self.date.isoformat(),
            "title": {"pl": self.title_pl, "en": self.title_en},
            "summary": {"pl": self.summary_pl, "en": self.summary_en},
            "groups": [
                {
                    "category": self.category,
                    "items": [{"pl": self.item_pl, "en": self.item_en}],
                }
            ],
        }
        if include_admin_meta:
            data["created_at"] = self.created_at.isoformat() if self.created_at else None
            data["created_by"] = self.created_by.username if self.created_by else None
        return data
