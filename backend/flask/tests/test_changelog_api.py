import unittest

from flask import Flask

from models import User, db
from routes.admin import admin
from routes.changelog import changelog
from utils import create_jwt_token


class ChangelogApiTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True,
            SECRET_KEY="test-secret",
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            TOKEN_MAX_AGE=3600,
        )
        db.init_app(self.app)
        self.app.register_blueprint(admin, url_prefix="/api/admin")
        self.app.register_blueprint(changelog, url_prefix="/api/changelog")
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()

        self.admin_user = User(username="Admin", password="hashed", is_admin=True)
        self.player = User(username="Player", password="hashed")
        db.session.add_all([self.admin_user, self.player])
        db.session.commit()
        self.admin_headers = {
            "Authorization": f"Bearer {create_jwt_token(self.admin_user.id, self.admin_user.username)}"
        }
        self.player_headers = {
            "Authorization": f"Bearer {create_jwt_token(self.player.id, self.player.username)}"
        }

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def test_admin_can_create_entry_and_public_api_returns_it(self):
        client = self.app.test_client()
        payload = {
            "date": "2026-08-04",
            "title": {"pl": "Nowa rzecz", "en": "New feature"},
            "summary": {"pl": "Dodano nowa rzecz.", "en": "Added a new feature."},
            "category": "new",
            "item": {"pl": "Haxball", "en": "Haxball"},
        }

        created = client.post("/api/admin/changelog", headers=self.admin_headers, json=payload)

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json["entry"]["title"]["en"], "New feature")
        self.assertEqual(created.json["entry"]["groups"][0]["category"], "new")

        admin_entries = client.get("/api/admin/changelog", headers=self.admin_headers)
        self.assertEqual(admin_entries.status_code, 200)
        self.assertEqual(len(admin_entries.json["entries"]), 1)

        public_entries = client.get("/api/changelog")
        self.assertEqual(public_entries.status_code, 200)
        self.assertEqual(public_entries.json["entries"][0]["summary"]["pl"], "Dodano nowa rzecz.")
        self.assertNotIn("created_by", public_entries.json["entries"][0])

    def test_only_admin_can_create_changelog_entry(self):
        client = self.app.test_client()
        payload = {
            "title": {"pl": "Nowa rzecz", "en": "New feature"},
            "summary": {"pl": "Opis.", "en": "Summary."},
            "category": "new",
            "item": {"pl": "Wpis", "en": "Entry"},
        }

        self.assertEqual(client.post("/api/admin/changelog", json=payload).status_code, 401)
        self.assertEqual(
            client.post("/api/admin/changelog", headers=self.player_headers, json=payload).status_code,
            403,
        )

    def test_invalid_changelog_payload_is_rejected(self):
        client = self.app.test_client()
        response = client.post(
            "/api/admin/changelog",
            headers=self.admin_headers,
            json={"title": {"pl": "Only one language"}},
        )

        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
