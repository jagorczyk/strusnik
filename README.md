# Strusnik

[![CI/CD](https://github.com/jagorczyk/strusnik/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/jagorczyk/strusnik/actions/workflows/ci-cd.yml)

Strusnik is a browser-based game platform for playing classic games alone or with friends. It combines a Next.js web application with a Flask API, a Socket.IO real-time game server, and MySQL persistence.

**Production:** [https://strusnik.pl](https://strusnik.pl)

## Features

- Multiplayer rooms for Chess, Haxball, Stratego, Thousand, Battleships, and Set.
- Single-player Blackjack, Snake, and Tic-Tac-Toe.
- Registered accounts and guest identities.
- JWT-based authentication with an HTTP-only cookie.
- Profiles, avatars, multiplayer statistics, single-player scores, and rankings.
- Friends and friend-request management.
- Room passwords, spectators, invitations, in-game chat, and online-player presence.
- Administrator tools for moderation, bans, statistics, notifications, and account management.
- Responsive web UI with Polish and English translations.
- SEO metadata, Open Graph previews, `robots.txt`, and `sitemap.xml`.

## Tech stack

### Frontend

- **Next.js 16** with the App Router and server-side route handlers.
- **React 19** and **TypeScript 5**.
- **Tailwind CSS 4** through PostCSS.
- **Socket.IO Client** for multiplayer communication.
- **chess.js** for chess rules and move validation.
- **Lucide React** for interface icons.
- **Playwright** for end-to-end tests.
- **TypeDoc** for generated TypeScript documentation.

### Backend

- **Python 3.11**.
- **Flask 3.1** for the REST API.
- **Flask-SocketIO** with **Eventlet** for real-time communication.
- **SQLAlchemy / Flask-SQLAlchemy** for database access.
- **MySQL 8** for persistent data.
- **PyJWT** and Werkzeug password hashing for authentication.
- **python-chess** for chess-related server functionality.

### Infrastructure

- Docker and Docker Compose.
- Nginx as the public reverse proxy.
- HTTPS with Let's Encrypt.
- GitHub Actions for CI/CD.
- Amazon EC2 for production hosting.

## Architecture

```text
Browser
  |
  | HTTPS
  v
Nginx
  |-------------------------------> Next.js :3000
  |                                   |
  |                                   | server-side API requests
  |                                   v
  |                                Flask :5000 ---- MySQL :3306
  |
  `--------------------------------> Socket.IO /socket.io/
```

The browser loads the Next.js application through Nginx. Next.js route handlers act as a same-origin backend-for-frontend for browser API calls and forward requests to Flask using the internal `API_URL`. Socket.IO traffic is proxied directly to Flask so multiplayer updates can use a WebSocket connection.

Persistent user data, profiles, friendships, statistics, moderation records, and Haxball history are stored in MySQL. Active rooms and in-progress game state are held in server memory and are not intended to survive a backend restart.

## Repository layout

```text
.
├── backend/
│   ├── docker-compose.yml       # Local MySQL + Flask development stack
│   └── flask/
│       ├── app.py               # Flask application and blueprint registration
│       ├── routes/              # REST API blueprints
│       ├── sockets/              # Socket.IO handlers and real-time events
│       ├── games/                # Multiplayer game implementations
│       ├── models/               # SQLAlchemy models
│       └── tests/                # Python unit tests
├── frontend/
│   └── strusnik/
│       ├── src/app/             # Next.js pages, layouts, components, and API handlers
│       ├── public/               # Game assets and social preview image
│       └── e2e/                  # Playwright tests, when present
├── deploy/
│   ├── docker-compose.prod.yml  # Production MySQL, Flask, and Next.js services
│   ├── deploy.sh                # Build, health-check, and rollback script
│   └── nginx-strusnik.conf      # Public Nginx configuration
├── docs/                         # Architecture and UI documentation
└── .github/workflows/ci-cd.yml  # Tests and production deployment workflow
```

## Local development

### Prerequisites

- Git.
- Docker Desktop with Docker Compose.
- Node.js 22 or a compatible current Node.js release.
- Python 3.11 if you want to run the backend outside Docker.

### 1. Configure the backend

Create `backend/.env`. This file is ignored by Git and must never contain values committed to the repository.

```dotenv
DB_DATABASE=strusnik
DB_USER=strusnik
DB_PASSWORD=change-this-password
DB_HOST=mysql_db
MYSQL_ROOT_PASSWORD=change-this-root-password
SECRET_KEY=replace-with-a-long-random-secret
```

For a direct Flask process outside Docker, also set a database URL such as:

```dotenv
DATABASE_URL=mysql+pymysql://strusnik:change-this-password@localhost:3306/strusnik
```

### 2. Start MySQL and Flask

```bash
cd backend
docker compose up --build
```

The local backend will be available at:

- REST API: `http://localhost:5000`
- Health check: `http://localhost:5000/health`
- Socket.IO: `http://localhost:5000/socket.io/`

To stop the stack:

```bash
docker compose down
```

Add `-v` only when you intentionally want to remove the local MySQL volume and all local database data.

### 3. Start the frontend

```bash
cd frontend/strusnik
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

By default, server-side API handlers use `http://localhost:5000` and the browser Socket.IO client uses the same URL. To set the values explicitly in a shell:

**macOS/Linux:**

```bash
API_URL=http://localhost:5000 \
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000 \
npm run dev
```

**PowerShell:**

```powershell
$env:API_URL = "http://localhost:5000"
$env:NEXT_PUBLIC_SOCKET_URL = "http://localhost:5000"
npm run dev
```

Run the frontend on port `3000` when using the local Flask CORS configuration.

## Frontend commands

Run these commands from `frontend/strusnik`:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint. |
| `npm run test:e2e` | Run Playwright end-to-end tests. |
| `npm run doc` | Generate TypeDoc documentation. |

## Backend tests

The CI workflow runs the backend tests without starting a Flask server:

```bash
python -m pip install -r backend/flask/requirements.txt
PYTHONPATH=backend/flask python -m unittest discover \
  -s backend/flask/tests \
  -p "test_*.py"
```

## REST API

The Flask API is mounted under `/api`. In production, browser requests should normally use the same-origin Next.js routes. The Flask contract below is the source of truth for the backend services.

### API conventions

- JSON request and response bodies are used for application data.
- Authentication accepts the `jwtToken` cookie or `Authorization: Bearer <token>`.
- Successful login and registration set the `jwtToken` HTTP-only cookie.
- Authentication cookies are valid for seven days.
- Most errors use the shape `{ "error": "message" }`.
- HTTP status codes follow the result: `400` for invalid input, `401` for unauthenticated requests, `403` for forbidden actions, `404` for missing resources, `409` for state conflicts, and `500` for server errors.

### Health

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Checks that Flask can reach MySQL. Returns `{ "status": "ok" }` when healthy. |

### Authentication and account settings

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Create an account. Body: `{ "username", "password" }`. |
| `POST` | `/api/auth/login` | No | Log in and set the authentication cookie. Body: `{ "username", "password" }`. |
| `GET` | `/api/auth/token` | Cookie or token | Read the current JWT claims and the user's avatar URL. |
| `POST` | `/api/auth/validate` | Token in body or cookie | Validate a token. Body: `{ "token" }`. |
| `PUT` | `/api/auth/password` | Yes | Change the password. Requires `current_password`, `new_password`, and `confirm_password`. |
| `DELETE` | `/api/auth/account` | Yes | Delete the current account after password and confirmation checks. |
| `POST` | `/api/auth/logout` | No | Clear the authentication cookie. |

The Next.js application exposes small same-origin handlers for these operations, including `/api/auth/parse` as the browser-facing token parsing route.

### Single-player games

Blackjack and Snake game sessions are stored in memory and identified by a UUID.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/games/blackjack/start` | No | Start a Blackjack game. Body may contain `{ "bet" }`. |
| `POST` | `/api/games/blackjack/hit` | No | Draw a card. Body: `{ "uuid" }`. |
| `POST` | `/api/games/blackjack/stand` | No | Resolve the dealer's hand. Body: `{ "uuid" }`. |
| `POST` | `/api/games/blackjack/double` | No | Double the bet and draw one card. Body: `{ "uuid" }`. |
| `POST` | `/api/snake/start` | No | Start a Snake game and return board dimensions and a UUID. |
| `POST` | `/api/snake/finish` | No | Finish Snake. Body: `{ "uuid", "foodsEaten" }`. |
| `POST` | `/api/games/tictactoe/create` | No | Create a Tic-Tac-Toe game. Body: `{ "player_id" }`. |
| `POST` | `/api/games/tictactoe/move/<game_id>` | No | Submit a move. Body: `{ "player_id", "position" }`, where position is `0`–`8`. |
| `GET` | `/api/games/tictactoe/state/<game_id>` | No | Read the current Tic-Tac-Toe state. |

The Next.js Snake route handlers forward to the Flask Snake blueprint, so the browser-facing paths are `/api/games/snake/start` and `/api/games/snake/finish`.

### Rankings and scores

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/rankings/<game_name>` | No | Return the top ten players for a game. Supported names include `chess`, `haxball`, `stratego`, `battleships`, `set`, and `tysiac`. |
| `POST` | `/api/rankings/add_win` | No | Add a win for a username and game. Body: `{ "username", "game_name" }`. |
| `POST` | `/api/profile/singleplayer/score` | Yes | Save a single-player score. Body: `{ "game_name", "score" }`. |

### Profiles and avatars

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/profile/me` | Yes | Return the current user's profile and aggregated statistics. |
| `GET` | `/api/profile/<username>` | No | Return a public user profile. |
| `GET` | `/api/profile/haxball/history` | Yes | Return the current user's Haxball match history. |
| `PUT` / `POST` | `/api/profile/avatar` | Yes | Set an avatar from a base64 data URL. PNG, JPEG, and WebP are supported; the limit is 2 MB. |
| `DELETE` | `/api/profile/avatar` | Yes | Remove the current user's avatar. |
| `GET` | `/api/profile/avatar/<user_id>` | No | Return an avatar by user ID. |
| `GET` | `/api/profile/<username>/avatar` | No | Return an avatar by username. |

### Friends

All friends endpoints require authentication.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/friends` | List friends, incoming requests, outgoing requests, and the pending count. |
| `GET` | `/api/friends/search?q=<query>` | Search for users. Queries shorter than three characters return no results. |
| `POST` | `/api/friends/requests` | Send a request. Body: `{ "recipient_id" }`. |
| `POST` | `/api/friends/requests/<request_id>/accept` | Accept an incoming request. |
| `POST` | `/api/friends/requests/<request_id>/reject` | Reject an incoming request. |
| `POST` | `/api/friends/requests/<request_id>/cancel` | Cancel an outgoing request. |
| `DELETE` | `/api/friends/<friend_id>` | Remove a friendship. |

### Administration

All endpoints below require an authenticated administrator, except `GET /api/admin/check`, which returns the current user's admin status.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/admin/check` | Return `{ "is_admin": boolean }` and basic identity data when available. |
| `GET` | `/api/admin/users` | Paginated users. Supports `page`, `per_page`, `search`, and `status`. |
| `GET` | `/api/admin/users/<user_id>` | User details, ban history, and game statistics. |
| `POST` | `/api/admin/ban` | Ban a registered user. |
| `POST` | `/api/admin/unban` | Remove a registered-user ban. |
| `POST` | `/api/admin/kick` | Kick a registered user from a room or the service. |
| `POST` | `/api/admin/guest-kick` | Kick an online guest. |
| `POST` | `/api/admin/guest-ban` | Ban an online guest. |
| `GET` | `/api/admin/guest-bans` | Paginated guest-ban history. |
| `POST` | `/api/admin/guest-unban` | Remove a guest ban. |
| `GET` | `/api/admin/bans` | Paginated registered-user bans. |
| `GET` | `/api/admin/logs` | Paginated moderation logs. |
| `GET` | `/api/admin/stats` | User, ban, activity, and online-user statistics. |
| `GET` | `/api/admin/online` | List connected users and guests. |
| `POST` | `/api/admin/make-admin` | Grant administrator privileges. |
| `POST` | `/api/admin/revoke-admin` | Revoke administrator privileges. |
| `POST` | `/api/admin/reset-stats` | Reset a user's multiplayer win/loss/draw counters. |
| `POST` | `/api/admin/notify` | Send a live notification to one user or all online users. |

## Socket.IO API

The real-time server uses the default Socket.IO namespace and the `/socket.io` path. The frontend connects using WebSocket transport and sends authentication data during the connection handshake:

```ts
io(SOCKET_URL, {
  path: "/socket.io",
  transports: ["websocket"],
  auth: {
    token,
    username,
    hasAvatar,
  },
});
```

### Client-to-server events

| Event | Purpose |
| --- | --- |
| `get_rooms` | Request the current rooms for a game lobby. |
| `create_room` | Create a room and its game instance. |
| `join_room` | Join as a player or observer. |
| `leave_room` | Leave a room or resign from an active game. |
| `update_identity` | Change a guest display name. |
| `update_room_settings` | Change observer settings as the host. |
| `sit_down` | Take a seat in a waiting room. |
| `start_game` | Start a game when the room is ready. |
| `get_game_state` | Request the current game state. |
| `sync_state` | Request a state synchronization after reconnecting. |
| `player_move` | Submit a move for Chess, Thousand, Stratego, Battleships, or Set. |
| `haxball_input` | Send real-time Haxball controls. |
| `haxball_choose_team` | Choose a Haxball team. |
| `haxball_ready` | Mark a Haxball player ready or not ready. |
| `haxball_update_settings` | Change Haxball map or duration as host. |
| `haxball_rematch` | Start a Haxball rematch as host. |
| `get_online_players` | Request online-player presence. |
| `send_chat_message` | Send a room chat message. |
| `validate_invite_room` | Validate an invitation target room. |
| `send_invite` | Invite an online player to a room. |
| `send_friend_invite` | Send a friend invitation notification. |

### Server-to-client events

Important events include:

- `rooms_list`, `room_created`, and `join_room_response` for room discovery and membership.
- `game_state_update`, `game_stage_changed`, and `your_active_game` for game state.
- `room_presence_update`, `online_players_update`, and `friends_updated` for presence.
- `chat_message_update` for room chat.
- `incoming_invite`, `friend_request_received`, and `friend_request_accepted` for invitations.
- `player_disconnected`, `opponent_reconnected`, `opponent_returned`, and `player_forfeited` for connection changes.
- `room_closed` and `game_ended_timeout` when a room is removed.
- `error` for validation and authorization errors.

The complete event handlers live in `backend/flask/sockets/socket_manager.py` and the game-specific modules under `backend/flask/games/`.

## Public web routes

| Route | Purpose |
| --- | --- |
| `/` | Home page. |
| `/multiplayer` | Multiplayer game selection and active rooms. |
| `/singleplayer` | Single-player game selection. |
| `/singleplayer/Blackjack` | Blackjack. |
| `/singleplayer/Snake` | Snake. |
| `/singleplayer/TicTacToe` | Tic-Tac-Toe. |
| `/rankings` | Player rankings. |
| `/profile` | Current profile. |
| `/settings` | Account settings. |
| `/auth` | Sign in and registration. |
| `/lobby/<game>` | Lobby for Chess, Haxball, Stratego, Thousand, Battleships, or Set. |
| `/lobby/<game>/createRoom` | Room creation flow. |
| `/games/<Game>/<roomId>` | Active multiplayer game route. |
| `/admin` | Administrator panel. |

Account and admin pages render their own authorization state. Room creation, private account areas, and API routes are not intended for search-engine indexing.

## Production deployment

Production deployment is triggered automatically by GitHub Actions after a push to `main` or a manual workflow dispatch.

The workflow:

1. Installs Python 3.11 dependencies and runs backend tests.
2. Installs Node.js 22 dependencies and runs frontend lint and build.
3. Connects to the EC2 host through a GitHub Actions SSH secret.
4. Resets the deployment checkout to the target commit.
5. Builds the production Docker images.
6. Starts MySQL, Flask, and Next.js with health checks.
7. Rolls back to the previous image tag if deployment health checks fail.
8. Keeps the three newest image versions.

Production configuration is intentionally kept outside Git:

- `/home/deploy/strusnik/.env` contains deployment variables such as `STRUSNIK_PUBLIC_ORIGIN`.
- `/home/deploy/strusnik/backend/.env` contains database credentials and `SECRET_KEY`.
- The existing infrastructure-owned Nginx container loads `deploy/nginx-strusnik.conf`.

Do not commit private keys, production `.env` files, database credentials, or deployment state.

See [`deploy/README.md`](deploy/README.md) for deployment-specific details.

## SEO and sharing

The application exposes:

- `https://strusnik.pl/robots.txt`
- `https://strusnik.pl/sitemap.xml`
- `https://strusnik.pl/og-image.jpg`

The Open Graph image is a 1200×630 JPEG containing the Strusnik logo and game description, so links shared through Messenger and other social platforms have a branded preview.

## License

No open-source license has been added to this repository yet.
