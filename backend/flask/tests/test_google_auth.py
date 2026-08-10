import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from flask import Flask
from werkzeug.security import generate_password_hash

from models import User, db
from routes.auth import authentication
from utils import create_jwt_token


class GoogleAuthTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True,
            SECRET_KEY="test-secret",
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            TOKEN_MAX_AGE=3600,
            SESSION_COOKIE_SECURE=False,
            GOOGLE_CLIENT_ID="client-id",
            GOOGLE_CLIENT_SECRET="client-secret",
            GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback",
        )
        db.init_app(self.app)
        self.app.register_blueprint(authentication, url_prefix="/api/auth")
        self.context = self.app.app_context()
        self.context.push()
        db.create_all()
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def _state_from_start(self, mode="login", headers=None):
        response = self.client.get(f"/api/auth/google/start?mode={mode}", headers=headers or {})
        self.assertEqual(response.status_code, 200)
        authorization_url = response.json["authorization_url"]
        return parse_qs(urlparse(authorization_url).query)["state"][0]

    @patch("routes.auth.avatar_from_picture", return_value=None)
    @patch("routes.auth.verify_identity")
    @patch("routes.auth.exchange_code", return_value={"id_token": "signed-id-token"})
    def test_new_google_identity_requires_username_before_account_creation(
        self,
        _exchange,
        verify_identity,
        _avatar,
    ):
        verify_identity.return_value = {
            "sub": "google-sub-1",
            "name": "Jan Kowalski",
            "picture": "https://lh3.googleusercontent.com/avatar",
        }
        state = self._state_from_start()

        callback = self.client.get(f"/api/auth/google/callback?code=code-1&state={state}")
        self.assertEqual(callback.status_code, 200)
        self.assertEqual(callback.json["status"], "onboarding")
        self.assertEqual(User.query.count(), 0)

        pending = self.client.get("/api/auth/google/pending")
        self.assertEqual(pending.status_code, 200)
        self.assertEqual(pending.json["suggested_username"], "Jan Kowalski")

        complete = self.client.post("/api/auth/google/complete", json={"username": "JanK"})
        self.assertEqual(complete.status_code, 201)
        user = User.query.one()
        self.assertEqual(user.google_sub, "google-sub-1")
        self.assertIsNone(user.password)
        self.assertEqual(complete.json["status"], "authenticated")

    @patch("routes.auth.verify_identity")
    @patch("routes.auth.exchange_code", return_value={"id_token": "signed-id-token"})
    def test_google_link_requires_current_password_after_oauth(self, _exchange, verify_identity):
        user = User(username="LocalUser", password=generate_password_hash("correct-password"))
        db.session.add(user)
        db.session.commit()
        headers = {"Authorization": f"Bearer {create_jwt_token(user.id, user.username)}"}
        verify_identity.return_value = {"sub": "google-sub-2", "name": "Local User"}

        state = self._state_from_start("link", headers)
        callback = self.client.get(
            f"/api/auth/google/callback?code=code-2&state={state}",
            headers=headers,
        )
        self.assertEqual(callback.status_code, 200)
        self.assertEqual(callback.json["status"], "link_confirmation")
        self.assertIsNone(user.google_sub)

        linked = self.client.post(
            "/api/auth/google/link",
            headers=headers,
            json={"password": "correct-password"},
        )
        self.assertEqual(linked.status_code, 200)
        self.assertEqual(user.google_sub, "google-sub-2")

    @patch("routes.auth.verify_identity")
    @patch("routes.auth.exchange_code", return_value={"id_token": "signed-id-token"})
    def test_google_only_user_can_set_password_after_reauthentication(self, _exchange, verify_identity):
        user = User(username="GoogleUser", password=None, google_sub="google-sub-3")
        db.session.add(user)
        db.session.commit()
        headers = {"Authorization": f"Bearer {create_jwt_token(user.id, user.username)}"}

        before = self.client.put(
            "/api/auth/password",
            headers=headers,
            json={"new_password": "new-password", "confirm_password": "new-password"},
        )
        self.assertEqual(before.status_code, 428)
        self.assertEqual(before.json["code"], "GOOGLE_REAUTH_REQUIRED")

        verify_identity.return_value = {"sub": "google-sub-3", "name": "Google User"}
        state = self._state_from_start("reauth_password", headers)
        reauth = self.client.get(
            f"/api/auth/google/callback?code=code-3&state={state}",
            headers=headers,
        )
        self.assertEqual(reauth.status_code, 200)
        self.assertEqual(reauth.json["status"], "reauthenticated")

        after = self.client.put(
            "/api/auth/password",
            headers=headers,
            json={"new_password": "new-password", "confirm_password": "new-password"},
        )
        self.assertEqual(after.status_code, 200)
        self.assertTrue(user.password)
