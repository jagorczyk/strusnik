import os


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "development-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://strusnik:strusnik@mysql_db:3306/strusnik",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    TOKEN_MAX_AGE = 7 * 24 * 60 * 60
    SESSION_COOKIE_SECURE = os.getenv(
        "SESSION_COOKIE_SECURE",
        "true" if os.getenv("FLASK_ENV") == "production" else "false",
    ).lower() in {"1", "true", "yes", "on"}
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:3000/api/auth/google/callback",
    )
