import time
from typing import List, Dict, Any, Optional, Tuple

import chess as pychess
from flask import current_app

from .base import MultiplayerGame
from models import db
from utils import record_multiplayer_result


Color = str


def _now() -> float:
    return time.time()


def _other(color: Color) -> Color:
    return "b" if color == "w" else "w"


def _turn_to_color(turn_bool: bool) -> Color:
    return "w" if turn_bool else "b"


def _color_to_turn(color: Color) -> bool:
    return True if color == "w" else False


class chess(MultiplayerGame):

    player_range = [2]

    def __init__(self, players: List[str]) -> None:
        super().__init__(players)
        self.seats: List[Optional[Dict[str, Any]]] = [None, None]

        self.board: pychess.Board = pychess.Board()
        self.time_control_min: int = 10
        self.white_ms: Optional[int] = None
        self.black_ms: Optional[int] = None
        self._last_clock_ts: Optional[float] = None

        self.draw_offer_by: Optional[Color] = None

        self.last_client_move_id: Optional[str] = None

        self.game_state = self.init_board()

    def set_time_control(self, minutes: int) -> None:
        
        try:
            m = int(minutes)
        except Exception:
            return
        if m <= 0:
            return
        self.time_control_min = m


        if self.white_ms is None or self.black_ms is None:
            initial_ms = self.time_control_min * 60 * 1000
            if self.white_ms is None:
                self.white_ms = initial_ms
            if self.black_ms is None:
                self.black_ms = initial_ms

    def init_board(self) -> Dict[str, Any]:
        return {
            "stage": "waiting_for_players",
            "seats": self.seats,
            "fen": "start",
            "turn": "w",
            "clocks": {"w": None, "b": None},
            "timeControlMin": self.time_control_min,
            "draw": {"offeredBy": None},
            "draw_offer_by": None,
            "ended": False,
            "result": None,
            "lastClientMoveId": None,
            "msg": "",
        }

    def start_game(self) -> Dict[str, Any]:
        if self.game_state.get("stage") != "waiting_for_players":
            return {"success": False, "msg": "GRA JUZ WYSTARTOWALA."}

        if self.seats[0] is None or self.seats[1] is None:
            return {"success": False, "msg": "ZA MALO GRACZY."}


        if not self.seats[0].get("connected", True) or not self.seats[1].get("connected", True):
            return {"success": False, "msg": "OBAJ GRACZE MUSZA BYC POLACZENI."}

        self.board = pychess.Board()
        self.draw_offer_by = None
        self.last_client_move_id = None

        initial_ms = self.time_control_min * 60 * 1000
        self.white_ms = initial_ms
        self.black_ms = initial_ms
        self._last_clock_ts = _now()

        self.game_state["stage"] = "active"
        self.game_state["fen"] = self.board.fen()
        self.game_state["turn"] = "w"
        self.game_state["clocks"] = {"w": self.white_ms, "b": self.black_ms}
        self.game_state["timeControlMin"] = self.time_control_min
        self.game_state["draw"] = {"offeredBy": None}
        self.game_state["draw_offer_by"] = None
        self.game_state["ended"] = False
        self.game_state["result"] = None
        self.game_state["lastClientMoveId"] = None
        self.game_state["msg"] = ""

        return {"success": True}

    def sit_player(self, player_id: str, player_name: str, seat_index: int, user_token: str) -> Dict[str, Any]:
        if seat_index not in (0, 1):
            return {"success": False, "msg": "NIEPRAWIDLOWE MIEJSCE."}

        if self.game_state.get("stage") != "waiting_for_players":
            return {"success": False, "msg": "NIE MOZNA USIASC PO STARCIE GRY."}

        if self.seats[seat_index] is not None:
            return {"success": False, "msg": "MIEJSCE ZAJETE."}

        for s in self.seats:
            if s and s.get("userId") == user_token:
                return {"success": False, "msg": "JUZ SIEDZISZ PRZY STOLE."}

        self.seats[seat_index] = {
            "socketId": player_id,
            "userId": user_token,
            "name": player_name,
            "connected": True,
            "disconnect_timestamp": None,
            "hand": [],
        }

        self.game_state["seats"] = self.seats
        return {"success": True, "msg": "USIADLES."}

    def set_player_connection_status(self, user_token: str, is_connected: bool, sid: str = None):

        for i, seat in enumerate(self.seats):
            if seat and seat.get("userId") == user_token:


                if is_connected and sid:
                    seat["socketId"] = sid
                    seat["disconnect_timestamp"] = None


                if seat.get("connected") == is_connected:
                    return False

                seat["connected"] = is_connected
                if not is_connected:
                    seat["disconnect_timestamp"] = _now()
                    
                return True
        return False
    
    def _seat_by_sid(self, sid: str) -> Tuple[Optional[int], Optional[Dict[str, Any]]]:
        for i, s in enumerate(self.seats):
            if s and s.get("socketId") == sid:
                return i, s
        return None, None

    def _color_by_sid(self, sid: str) -> Optional[Color]:
        idx, _ = self._seat_by_sid(sid)
        if idx is None:
            return None
        return "w" if idx == 0 else "b"

    def _ensure_active(self) -> bool:
        return self.game_state.get("stage") == "active" and not self.game_state.get("ended", False)

    def _update_clock(self) -> None:
        
        if not self._ensure_active():
            return
        if self.white_ms is None or self.black_ms is None:
            return
        if self._last_clock_ts is None:
            self._last_clock_ts = _now()
            return

        now = _now()
        dt_ms = int(max(0.0, (now - self._last_clock_ts)) * 1000)
        self._last_clock_ts = now

        side = _turn_to_color(self.board.turn)
        if side == "w":
            self.white_ms = max(0, int(self.white_ms) - dt_ms)
            if self.white_ms <= 0:
                self._end_game(status="loss", reason="timeout", winner="b")
        else:
            self.black_ms = max(0, int(self.black_ms) - dt_ms)
            if self.black_ms <= 0:
                self._end_game(status="loss", reason="timeout", winner="w")

    def _sync_state_fields(self) -> None:
        
        self.game_state["seats"] = self.seats
        self.game_state["fen"] = self.board.fen()
        self.game_state["turn"] = _turn_to_color(self.board.turn)
        self.game_state["clocks"] = {"w": self.white_ms, "b": self.black_ms}
        self.game_state["timeControlMin"] = self.time_control_min
        self.game_state["draw"] = {"offeredBy": self.draw_offer_by}
        self.game_state["draw_offer_by"] = self.draw_offer_by
        self.game_state["lastClientMoveId"] = self.last_client_move_id

    def _record_win(self, winner_color: Color) -> None:
        try:
            winner_index = 0 if winner_color == "w" else 1
            record_multiplayer_result(
                "chess",
                self.seats,
                [winner_index],
                mode=getattr(self, "matchmaking_mode", "casual"),
            )
        except Exception as error:
            db.session.rollback()
            if current_app:
                current_app.logger.exception("Error saving chess stats", exc_info=error)

    def _record_draw(self) -> None:
        try:
            record_multiplayer_result(
                "chess",
                self.seats,
                draw=True,
                mode=getattr(self, "matchmaking_mode", "casual"),
            )
        except Exception as error:
            db.session.rollback()
            if current_app:
                current_app.logger.exception("Error saving chess draw stats", exc_info=error)

    def _end_game(self, status: str, reason: str, winner: Optional[Color]) -> None:
        if self.game_state.get("ended"):
            return

        self.game_state["ended"] = True
        self.game_state["stage"] = "ended"
        self.game_state["result"] = {
            "status": status,
            "reason": reason,
            "winner": winner,
        }
        self.game_state["msg"] = ""

        self._last_clock_ts = None

        if winner in ("w", "b") and reason in ("checkmate", "timeout", "resign", "disconnect_timeout"):
            self._record_win(winner)
        elif status == "draw":
            self._record_draw()

    def _check_end_conditions_after_move(self) -> None:
        
        if self.board.is_checkmate():
            loser = _turn_to_color(self.board.turn)
            winner = _other(loser)
            self._end_game(status="win", reason="checkmate", winner=winner)
            return

        if self.board.is_stalemate():
            self._end_game(status="draw", reason="stalemate", winner=None)
            return

        if self.board.is_insufficient_material():
            self._end_game(status="draw", reason="insufficient_material", winner=None)
            return

    def handle_move(self, player_id: str, move_data: Dict[str, Any]) -> Dict[str, Any]:

        if not move_data or not isinstance(move_data, dict):
            return {"success": False, "msg": "NIEPRAWIDLOWY RUCH."}

        mtype = str(move_data.get("type") or "").strip()

        if self.game_state.get("stage") != "active":
            return {"success": False, "msg": "GRA JESZCZE SIE NIE ROZPOCZELA."}

        if self.game_state.get("ended"):
            return {"success": False, "msg": "GRA JEST ZAKONCZONA."}

        player_color = self._color_by_sid(player_id)
        if player_color is None:
            return {"success": False, "msg": "NIE SIEDZISZ PRZY STOLE."}

        self._update_clock()
        
        if self.game_state.get("ended"):
            self._sync_state_fields()
            return {"success": True, "msg": "OK"}

        if mtype == "resign":
            self.draw_offer_by = None
            self.last_client_move_id = None
            self._end_game(status="win", reason="resign", winner=_other(player_color))
            self._sync_state_fields()
            return {"success": True, "msg": "OK"}

        if mtype == "draw_offer":
            
            if self.draw_offer_by is None:
                self.draw_offer_by = player_color
            self._sync_state_fields()
            return {"success": True, "msg": "OK"}

        if mtype == "draw_decline":
            
            if self.draw_offer_by is None:
                self._sync_state_fields()
                return {"success": True, "msg": "OK"}
            if self.draw_offer_by == player_color:
                return {"success": False, "msg": "NIE MOZESZ ODRZUCIC WLASNEJ OFERTY."}
            self.draw_offer_by = None
            self._sync_state_fields()
            return {"success": True, "msg": "OK"}

        if mtype == "draw_accept":
            if self.draw_offer_by is None:
                return {"success": False, "msg": "BRAK OFERTY REMISU."}
            if self.draw_offer_by == player_color:
                return {"success": False, "msg": "NIE MOZESZ ZAAKCEPTOWAC WLASNEJ OFERTY."}

            self.draw_offer_by = None
            self._end_game(status="draw", reason="draw_agreed", winner=None)
            self._sync_state_fields()
            return {"success": True, "msg": "OK"}

        if mtype != "move":
            return {"success": False, "msg": "NIEZNANY TYP RUCHU."}

        to_move = _turn_to_color(self.board.turn)
        if to_move != player_color:
            return {"success": False, "msg": "NIE TWOJA TURA."}

        frm = str(move_data.get("from") or "").strip()
        to = str(move_data.get("to") or "").strip()
        promo = move_data.get("promotion")
        client_id = move_data.get("clientMoveId")
        if client_id is not None and str(client_id) == str(self.last_client_move_id):
            self._sync_state_fields()
            return {"success": True, "msg": "OK", "duplicate": True}

        if len(frm) != 2 or len(to) != 2:
            return {"success": False, "msg": "NIEPRAWIDLOWY RUCH."}

        prom = None
        if promo:
            p = str(promo).strip().lower()
            if p in ("q", "r", "b", "n"):
                prom = p

        try:
            piece = self.board.piece_at(pychess.parse_square(frm))
            if piece and piece.piece_type == pychess.PAWN:
                to_rank = int(to[1])
                if (piece.color == pychess.WHITE and to_rank == 8) or (piece.color == pychess.BLACK and to_rank == 1):
                    if prom is None:
                        prom = "q"
        except Exception:
            pass

        uci = f"{frm}{to}{prom or ''}"

        try:
            move = pychess.Move.from_uci(uci)
        except Exception:
            return {"success": False, "msg": "NIEPRAWIDLOWY RUCH."}

        if move not in self.board.legal_moves:
            return {"success": False, "msg": "NIELEGALNY RUCH."}

        self.draw_offer_by = None

        self.board.push(move)

        self._last_clock_ts = _now()

        self.last_client_move_id = str(client_id) if client_id is not None else None

        self._check_end_conditions_after_move()

        self._sync_state_fields()
        return {"success": True, "msg": "OK"}

    def forfeit_player(self, user_token: str, reason: str = "resign") -> Dict[str, Any]:
        if self.game_state.get("ended") or self.game_state.get("stage") != "active":
            return {"success": False, "msg": "Gra nie jest aktywna."}
        loser_idx = next((index for index, seat in enumerate(self.seats) if seat and str(seat.get("userId")) == str(user_token)), None)
        if loser_idx is None:
            return {"success": False, "msg": "Gracz nie siedzi przy stole."}
        winner = "b" if loser_idx == 0 else "w"
        result_reason = "resign" if reason == "resign" else "disconnect_timeout"
        self._end_game(status="loss", reason=result_reason, winner=winner)
        self._sync_state_fields()
        return {"success": True}

    def get_state(self) -> Dict[str, Any]:
        
        self._update_clock()
        self._sync_state_fields()
        return self.game_state
