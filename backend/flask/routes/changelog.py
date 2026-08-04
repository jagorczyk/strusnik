from flask import Blueprint, jsonify

from models import ChangelogPost

changelog = Blueprint("changelog", __name__)


@changelog.route("", methods=["GET"])
def get_changelog():
    entries = ChangelogPost.query.order_by(ChangelogPost.date.desc(), ChangelogPost.created_at.desc()).all()
    return jsonify({"entries": [entry.to_dict() for entry in entries]})
