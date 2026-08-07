import time
from typing import Any, Dict, List, Optional

from flask import current_app

from .base import MultiplayerGame
from utils import record_multiplayer_result


class Battleships(MultiplayerGame):
    player_range = [2]

    def __init__(self, players: List[str]) -> None:
        super().__init__(players)
        self.seats: List[Optional[Dict[str, Any]]] = [None] * 2
        self.game_state = self.init_board()

    def init_board(self) -> Dict[str, Any]:
        return {
            "stage": "waiting_for_players",
            "current_player_idx": 0,
            "winner": None,
            "boards": [self._create_empty_board() for _ in range(2)],
            "ready_players": [],
        }

    @staticmethod
    def _create_empty_board():
        return [[0] * 10 for _ in range(10)]

    def sit_player(self, player_id: str, player_name: str, seat_index: int, user_token: str) -> Dict[str, Any]:
        if not (0 <= seat_index < 2):
            return {"success": False, "msg": "Nieprawidlowe miejsce."}
        if self.game_state["stage"] != "waiting_for_players":
            return {"success": False, "msg": "Gra juz sie rozpoczela."}
        if self.seats[seat_index] is not None:
            return {"success": False, "msg": "Miejsce zajete."}
        if any(seat and seat.get("userId") == user_token for seat in self.seats):
            return {"success": False, "msg": "Juz siedzisz przy stole."}

        self.seats[seat_index] = {
            "socketId": player_id,
            "userId": user_token,
            "name": player_name,
            "connected": True,
            "score": 0,
        }
        return {"success": True, "msg": "Usiadles."}

    def start_game(self) -> Dict[str, Any]:
        if self.game_state["stage"] != "waiting_for_players":
            return {"success": False, "msg": "Gra juz zostala rozpoczeta."}
        if any(seat is None for seat in self.seats):
            return {"success": False, "msg": "Potrzebnych jest dwoch graczy."}

        self.game_state["stage"] = "placement"
        self.game_state["boards"] = [self._create_empty_board() for _ in range(2)]
        self.game_state["ready_players"] = []
        return {"success": True}

    @staticmethod
    def _validate_board(board):
        if not isinstance(board, list) or len(board) != 10:
            return False, "Plansza musi miec 10 wierszy."
        if any(not isinstance(row, list) or len(row) != 10 for row in board):
            return False, "Kazdy wiersz planszy musi miec 10 pol."
        if any(cell not in (0, 1) for row in board for cell in row):
            return False, "Plansza zawiera nieprawidlowe pola."
        if not any(cell == 1 for row in board for cell in row):
            return False, "Ustaw przynajmniej jeden statek."
        return True, None

    def handle_move(self, player_id: str, move_data: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(move_data, dict):
            return {"success": False, "msg": "Nieprawidlowy ruch."}
        player_idx = self._get_player_idx(player_id)
        if player_idx == -1:
            return {"success": False, "msg": "Nie grasz."}

        move_type = move_data.get("type")
        if self.game_state["stage"] == "placement" and move_type == "confirm_placement":
            board = move_data.get("board")
            valid, message = self._validate_board(board)
            if not valid:
                return {"success": False, "msg": message}
            self.game_state["boards"][player_idx] = [list(row) for row in board]
            if player_idx not in self.game_state["ready_players"]:
                self.game_state["ready_players"].append(player_idx)
            if len(self.game_state["ready_players"]) == 2:
                self.game_state["stage"] = "playing"
                self.game_state["current_player_idx"] = 0
            return {"success": True}

        if self.game_state["stage"] == "playing" and move_type == "shoot":
            if self.game_state["current_player_idx"] != player_idx:
                return {"success": False, "msg": "Nie Twoja kolej."}
            x, y = move_data.get("x"), move_data.get("y")
            if isinstance(x, bool) or isinstance(y, bool) or not isinstance(x, int) or not isinstance(y, int) or not (0 <= x < 10 and 0 <= y < 10):
                return {"success": False, "msg": "Nieprawidlowe pole ostrzalu."}

            opponent_idx = 1 - player_idx
            opponent_board = self.game_state["boards"][opponent_idx]
            if opponent_board[y][x] in (2, 3):
                return {"success": False, "msg": "W to pole juz strzelano."}

            hit = opponent_board[y][x] == 1
            opponent_board[y][x] = 3 if hit else 2
            if hit and self._check_win(opponent_idx):
                self.game_state["stage"] = "game_over"
                winner = self.seats[player_idx]
                self.game_state["winner"] = {
                    "name": winner.get("name"),
                    "userId": winner.get("userId"),
                }
                self._record_win(player_idx)
            elif not hit:
                self.game_state["current_player_idx"] = opponent_idx
            return {"success": True, "hit": hit}

        return {"success": False, "msg": "Nieznany ruch albo gra zostala zakonczona."}

    def _get_player_idx(self, socket_id):
        for i, seat in enumerate(self.seats):
            if seat and seat.get("socketId") == socket_id:
                return i
        return -1

    def set_player_connection_status(self, user_token: str, is_connected: bool, sid: str = None):
        for i, seat in enumerate(self.seats):
            if seat and seat.get("userId") == user_token:
                if is_connected and sid:
                    seat["socketId"] = sid
                if seat.get("connected") == is_connected:
                    return False
                seat["connected"] = is_connected
                return True
        return False

    def update_player_sid(self, user_token: str, new_sid: str):
        for seat in self.seats:
            if seat and seat.get("userId") == user_token:
                seat["socketId"] = new_sid
                seat["connected"] = True
                return True
        return False

    def _check_win(self, victim_idx):
        return all(cell != 1 for row in self.game_state["boards"][victim_idx] for cell in row)

    def _record_win(self, winner_idx: int) -> None:
        try:
            record_multiplayer_result(
                "Battleships",
                self.seats,
                [winner_idx],
                mode=getattr(self, "matchmaking_mode", "casual"),
            )
        except Exception as error:
            from models import db

            db.session.rollback()
            if current_app:
                current_app.logger.exception("Error saving Battleships stats", exc_info=error)

    def forfeit_player(self, user_token: str, reason: str = "resign") -> Dict[str, Any]:
        if self.game_state.get("stage") in {"waiting_for_players", "game_over"}:
            return {"success": False, "msg": "Gra nie jest aktywna."}
        loser_idx = next((index for index, seat in enumerate(self.seats) if seat and str(seat.get("userId")) == str(user_token)), None)
        if loser_idx is None:
            return {"success": False, "msg": "Gracz nie siedzi przy stole."}
        winner_idx = 1 - loser_idx
        winner = self.seats[winner_idx]
        if winner is None:
            return {"success": False, "msg": "Brak zwyciezcy."}
        self.game_state["stage"] = "game_over"
        self.game_state["winner"] = {"name": winner.get("name"), "userId": winner.get("userId"), "reason": reason}
        self._record_win(winner_idx)
        return {"success": True}

    def get_state(self) -> Dict[str, Any]:
        return {
            "stage": self.game_state["stage"],
            "seats": self.seats,
            "current_player_idx": self.game_state["current_player_idx"],
            "boards": self.game_state["boards"],
            "winner": self.game_state.get("winner"),
            "ready_players": self.game_state.get("ready_players", []),
        }
