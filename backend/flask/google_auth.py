import base64
import hashlib
import json
import secrets
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer


GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state"
GOOGLE_ONBOARDING_COOKIE = "google_onboarding"
GOOGLE_LINK_PENDING_COOKIE = "google_link_pending"
GOOGLE_REAUTH_COOKIE = "google_reauth"
GOOGLE_OAUTH_MAX_AGE = 10 * 60
MAX_AVATAR_BYTES = 2 * 1024 * 1024

_AVATAR_SIGNATURES = {
    "image/png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
    "image/webp": lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP",
}


class GoogleOAuthError(Exception):
    def __init__(self, code, message="Google authentication failed."):
        super().__init__(message)
        self.code = code
        self.message = message


def google_is_configured():
    return all(
        current_app.config.get(name)
        for name in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI")
    )


def _serializer(salt):
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt=salt)


def sign_timed_payload(payload, salt):
    return _serializer(salt).dumps(payload)


def load_timed_payload(value, salt, max_age):
    if not value:
        return None
    try:
        return _serializer(salt).loads(value, max_age=max_age)
    except (BadSignature, SignatureExpired, TypeError, ValueError):
        return None


def normalize_return_to(value, fallback="/"):
    if not isinstance(value, str) or not value.startswith("/") or value.startswith("//"):
        return fallback
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc:
        return fallback
    return value


def create_oauth_transaction(mode, user_id=None, return_to="/"):
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode("ascii")).digest()
    ).rstrip(b"=").decode("ascii")
    payload = {
        "state": state,
        "nonce": nonce,
        "code_verifier": code_verifier,
        "mode": mode,
        "user_id": int(user_id) if user_id is not None else None,
        "return_to": normalize_return_to(return_to),
    }
    authorization_params = {
        "client_id": current_app.config["GOOGLE_CLIENT_ID"],
        "redirect_uri": current_app.config["GOOGLE_REDIRECT_URI"],
        "response_type": "code",
        "scope": "openid profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "access_type": "online",
        "prompt": "login" if mode.startswith("reauth_") else "select_account",
    }
    authorization_url = f"{GOOGLE_AUTHORIZATION_ENDPOINT}?{urlencode(authorization_params)}"
    return payload, authorization_url


def exchange_code(code, code_verifier):
    body = urlencode(
        {
            "code": code,
            "client_id": current_app.config["GOOGLE_CLIENT_ID"],
            "client_secret": current_app.config["GOOGLE_CLIENT_SECRET"],
            "redirect_uri": current_app.config["GOOGLE_REDIRECT_URI"],
            "grant_type": "authorization_code",
            "code_verifier": code_verifier,
        }
    ).encode("utf-8")
    request = Request(
        GOOGLE_TOKEN_ENDPOINT,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as error:
        raise GoogleOAuthError("GOOGLE_TOKEN_EXCHANGE_FAILED") from error

    if not isinstance(data, dict) or not data.get("id_token"):
        raise GoogleOAuthError("GOOGLE_TOKEN_EXCHANGE_FAILED")
    return data


def verify_identity(id_token_value, nonce):
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
    except ImportError as error:
        raise GoogleOAuthError("GOOGLE_AUTH_UNAVAILABLE") from error

    try:
        claims = id_token.verify_oauth2_token(
            id_token_value,
            google_requests.Request(),
            current_app.config["GOOGLE_CLIENT_ID"],
        )
    except Exception as error:
        raise GoogleOAuthError("GOOGLE_TOKEN_INVALID") from error

    if claims.get("nonce") != nonce:
        raise GoogleOAuthError("GOOGLE_NONCE_INVALID")
    if claims.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise GoogleOAuthError("GOOGLE_ISSUER_INVALID")
    if not isinstance(claims.get("sub"), str) or not claims["sub"].strip():
        raise GoogleOAuthError("GOOGLE_IDENTITY_INVALID")
    return claims


def avatar_from_picture(picture):
    if not isinstance(picture, str) or not picture.startswith("https://"):
        return None

    parsed = urlsplit(picture)
    hostname = (parsed.hostname or "").lower().rstrip(".")
    if not (hostname == "googleusercontent.com" or hostname.endswith(".googleusercontent.com")):
        return None

    request = Request(picture, headers={"User-Agent": "Strusnik/1.0"})
    try:
        with urlopen(request, timeout=5) as response:
            final_host = (urlsplit(response.geturl()).hostname or "").lower().rstrip(".")
            if not (final_host == "googleusercontent.com" or final_host.endswith(".googleusercontent.com")):
                return None
            image_bytes = response.read(MAX_AVATAR_BYTES + 1)
    except (HTTPError, URLError, TimeoutError, OSError, ValueError):
        return None

    if not image_bytes or len(image_bytes) > MAX_AVATAR_BYTES:
        return None

    mime_type = next(
        (mime for mime, signature in _AVATAR_SIGNATURES.items() if signature(image_bytes)),
        None,
    )
    if not mime_type:
        return None

    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def set_signed_cookie(response, name, value, max_age):
    response.set_cookie(
        name,
        value=value,
        max_age=max_age,
        httponly=True,
        secure=current_app.config.get("SESSION_COOKIE_SECURE", False),
        samesite="Lax",
        path="/",
    )
    return response
