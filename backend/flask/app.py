import eventlet

eventlet.monkey_patch()

from flask import Flask
from flask_cors import CORS
from sqlalchemy import inspect, text
from config import Config
from api_utils import register_error_handlers

from routes.auth import authentication
from routes.blackjack import blackjack
from routes.snake import snake
from routes.rankings import rankings
from routes.tictactoe import tictactoe
from routes.admin import admin
from routes.profile import profile
from routes.friends import friends
from models import db

from sockets.socket_manager import socket
import time

app = Flask(__name__)
app.config.from_object(Config)
register_error_handlers(app)

CORS(
    app, 
    origins=['http://localhost:3000'], 
    supports_credentials=True
)

socket.init_app(app)
db.init_app(app)


@app.get("/health")
def health():
    try:
        db.session.execute(text("SELECT 1"))
        return {"status": "ok"}, 200
    except Exception as error:
        app.logger.warning("Health check failed: %s", error)
        return {"status": "error"}, 503


app.register_blueprint(authentication, url_prefix="/api/auth")
app.register_blueprint(blackjack, url_prefix="/api/games/blackjack")
app.register_blueprint(rankings, url_prefix="/api/rankings")
app.register_blueprint(snake, url_prefix="/api/snake")
app.register_blueprint(tictactoe, url_prefix="/api/games/tictactoe")
app.register_blueprint(admin, url_prefix="/api/admin")
app.register_blueprint(profile, url_prefix="/api/profile")
app.register_blueprint(friends, url_prefix="/api/friends")

with app.app_context():
    for i in range(5):
        try:
            db.create_all()
            game_stats_columns = {column["name"] for column in inspect(db.engine).get_columns("game_stats")}
            user_columns = {column["name"] for column in inspect(db.engine).get_columns("users")}
            missing_columns = {
                "losses": (game_stats_columns, "ALTER TABLE game_stats ADD COLUMN losses INTEGER NOT NULL DEFAULT 0"),
                "draws": (game_stats_columns, "ALTER TABLE game_stats ADD COLUMN draws INTEGER NOT NULL DEFAULT 0"),
                "points": (game_stats_columns, "ALTER TABLE game_stats ADD COLUMN points INTEGER NOT NULL DEFAULT 0"),
                "goals": (game_stats_columns, "ALTER TABLE game_stats ADD COLUMN goals INTEGER NOT NULL DEFAULT 0"),
                "assists": (game_stats_columns, "ALTER TABLE game_stats ADD COLUMN assists INTEGER NOT NULL DEFAULT 0"),
            }
            with db.engine.begin() as connection:
                for name, (columns, statement) in missing_columns.items():
                    if name not in columns:
                        connection.execute(text(statement))

                if "avatar_url" not in user_columns:
                    connection.execute(text("ALTER TABLE users ADD COLUMN avatar_url LONGTEXT NULL"))
                elif db.engine.dialect.name == "mysql":
                    connection.execute(text("ALTER TABLE users MODIFY COLUMN avatar_url LONGTEXT NULL"))
            break
        except Exception as error:
            app.logger.warning("Database initialization attempt failed: %s", error)
            time.sleep(2)

if __name__ == '__main__':
    socket.run(app, debug=False, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)