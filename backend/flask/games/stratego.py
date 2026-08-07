import random
import time
from typing import List, Dict, Any, Optional
from .base import MultiplayerGame

from flask import current_app
from models import db
from utils import record_multiplayer_result


class Stratego(MultiplayerGame):
    player_range = [2]

    RANKS_STRENGTH = {
        'F': 0, 'B': 100, 'S': 1,
        '2': 2, '3': 3, '4': 4, '5': 5,
        '6': 6, '7': 7, '8': 8, '9': 9, '10': 10
    }
    SETUP_COUNTS = {
        'F': 1, 'B': 6, '10': 1, '9': 1, '8': 2,
        '7': 3, '6': 4, '5': 4, '4': 4, '3': 5,
        '2': 8, 'S': 1
    }
    LAKES = [
        (4, 2), (4, 3), (5, 2), (5, 3),
        (4, 6), (4, 7), (5, 6), (5, 7)
    ]

    def __init__(self, players: List[str]) -> None:
        super().__init__(players)
        self.seats = [None] * 2
        self.board = [[None for _ in range(10)] for _ in range(10)]

        self.game_state = {
            "stage": "waiting_for_players",
            "current_player_idx": 0,
            "setup_ready": [False, False],
            "winner": None,
            "last_move": None,
            "turn_count": 0
        }

    def init_board(self) -> Dict[str, Any]:
        return self.get_state()

    def set_player_connection_status(self, user_token: str, is_connected: bool, sid: str = None):
        for i, seat in enumerate(self.seats):
            if seat and seat.get('userId') == user_token:

                if is_connected and sid:
                    seat['socketId'] = sid
                    seat['disconnect_timestamp'] = None

                if seat.get('connected') == is_connected:
                    return False

                seat['connected'] = is_connected

                if not is_connected:
                    seat['disconnect_timestamp'] = time.time()

                return True
        return False

    def sit_player(self, player_id: str, player_name: str, seat_index: int, user_token: str) -> Dict[str, Any]:
        if not (0 <= seat_index < 2):
            return {"success": False, "msg": "Nieprawidlowe miejsce."}
        if self.seats[seat_index] is not None:
            return {"success": False, "msg": "Miejsce zajete."}

        for s in self.seats:
            if s and s.get('userId') == user_token:
                return {"success": False, "msg": "Juz siedzisz."}

        self.seats[seat_index] = {
            "socketId": player_id,
            "userId": user_token,
            "name": player_name,
            "connected": True,
            "captured_pieces": [],
            "disconnect_timestamp": None
        }

        return {"success": True}

    def start_game(self) -> Dict[str, Any]:
        if self.game_state['stage'] == 'waiting_for_players' and all(s is not None for s in self.seats):
            self.game_state['stage'] = 'setup'
            return {"success": True}
        return {"success": False, "msg": "Czekamy na graczy."}

    def handle_move(self, player_id: str, move_data: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(move_data, dict):
            return {"success": False, "msg": "Nieprawidlowy ruch."}
        player_idx = self._get_player_idx(player_id)
        if player_idx == -1: return {"success": False, "msg": "Nie jestes graczem."}
        move_type = move_data.get('type')

        if self.game_state['stage'] == 'setup':
            if move_type == 'submit_setup': return self._handle_setup_submit(player_idx, move_data.get('pieces'))
        elif self.game_state['stage'] == 'playing':
            if move_type == 'move': return self._handle_game_move(player_idx, move_data)

        return {"success": False, "msg": "Nieprawidlowy ruch."}

    def _handle_setup_submit(self, player_idx: int, pieces: List[Dict]) -> Dict[str, Any]:
        if self.game_state['setup_ready'][player_idx]:
            return {"success": False, "msg": "Juz zatwierdziles."}
        if not isinstance(pieces, list) or len(pieces) != 40:
            count = len(pieces) if isinstance(pieces, list) else 0
            return {"success": False, "msg": f"Musisz ustawic 40 (masz {count})."}

        valid_rows = set(range(0, 4) if player_idx == 0 else range(6, 10))
        piece_counts = {rank: 0 for rank in self.SETUP_COUNTS}
        proposed = {}

        for piece in pieces:
            if not isinstance(piece, dict):
                return {"success": False, "msg": "Nieprawidlowa figura."}
            r, c, rank = piece.get('r'), piece.get('c'), piece.get('rank')
            if isinstance(r, bool) or isinstance(c, bool) or not isinstance(r, int) or not isinstance(c, int):
                return {"success": False, "msg": "Nieprawidlowe pole."}
            if r not in valid_rows or not (0 <= c < 10):
                return {"success": False, "msg": "Figura jest poza strefa."}
            if rank not in piece_counts:
                return {"success": False, "msg": f"Nieznana figura {rank}."}
            if (r, c) in proposed:
                return {"success": False, "msg": "Dwie figury zajmuja to samo pole."}
            proposed[(r, c)] = {'player': player_idx, 'rank': rank, 'revealed': False}
            piece_counts[rank] += 1

        for rank, count in piece_counts.items():
            if count != self.SETUP_COUNTS[rank]:
                return {"success": False, "msg": f"Nieprawidlowa liczba figur {rank}."}

        for r in valid_rows:
            for c in range(10):
                if self.board[r][c] and self.board[r][c].get('player') == player_idx:
                    self.board[r][c] = None
        for position, piece in proposed.items():
            self.board[position[0]][position[1]] = piece

        self.game_state['setup_ready'][player_idx] = True
        if all(self.game_state['setup_ready']):
            self.game_state['stage'] = 'playing'
            self.game_state['current_player_idx'] = 0
        return {"success": True}

    def _handle_game_move(self, player_idx: int, move_data: Dict) -> Dict[str, Any]:
        if player_idx != self.game_state['current_player_idx']: return {"success": False, "msg": "Nie Twoja tura."}
        start, end = move_data.get('from'), move_data.get('to')
        if not isinstance(start, dict) or not isinstance(end, dict):
            return {"success": False, "msg": "Nieprawidlowe pole ruchu."}
        r1, c1 = start.get('r'), start.get('c')
        r2, c2 = end.get('r'), end.get('c')
        coords = (r1, c1, r2, c2)
        if any(isinstance(value, bool) or not isinstance(value, int) for value in coords):
            return {"success": False, "msg": "Nieprawidlowe pole ruchu."}
        if not all(0 <= value < 10 for value in coords):
            return {"success": False, "msg": "Nieprawidlowe pole ruchu."}
        if (r1, c1) == (r2, c2):
            return {"success": False, "msg": "Wybierz inne pole."}
        piece = self.board[r1][c1]

        if not piece or piece['player'] != player_idx: return {"success": False, "msg": "To nie Twoj pionek."}
        if piece['rank'] in ['F', 'B']: return {"success": False, "msg": "Stacjonarna."}
        if (r2, c2) in self.LAKES: return {"success": False, "msg": "Jezioro."}

        dist = abs(r2 - r1) + abs(c2 - c1)
        if piece['rank'] == '2':
            if r1 != r2 and c1 != c2: return {"success": False, "msg": "Tylko prosto."}
            dr = 0 if r1 == r2 else (1 if r2 > r1 else -1)
            dc = 0 if c1 == c2 else (1 if c2 > c1 else -1)
            cr, cc = r1 + dr, c1 + dc
            while (cr, cc) != (r2, c2):
                if self.board[cr][cc]: return {"success": False, "msg": "Blokada."}
                if (cr, cc) in self.LAKES: return {"success": False, "msg": "Jezioro."}
                cr += dr
                cc += dc
        elif dist != 1:
            return {"success": False, "msg": "Za daleko."}

        target = self.board[r2][c2]
        if target and target['player'] == player_idx: return {"success": False, "msg": "Zajete przez Ciebie."}

        combat_info = None
        if target:
            res = self._resolve_combat(piece['rank'], target['rank'])
            combat_info = {'attacker': {'rank': piece['rank'], 'player': player_idx},
                           'defender': {'rank': target['rank'], 'player': target['player']},
                           'result': res}
            piece['revealed'] = True
            target['revealed'] = True

            if res == 'win':
                self.board[r2][c2] = piece
                if target['rank'] == 'F': self._end_game(player_idx, "Zdobycie flagi")
            elif res == 'loss':
                pass
            else:
                self.board[r2][c2] = None
            self.board[r1][c1] = None
        else:
            self.board[r2][c2] = piece
            self.board[r1][c1] = None

        self.game_state['last_move'] = {'combat': combat_info, 'from': start, 'to': end}
        if not self._player_has_moves(1 - player_idx): self._end_game(player_idx, "Brak ruchow przeciwnika")

        if self.game_state['stage'] == 'playing':
            self.game_state['current_player_idx'] = 1 - self.game_state['current_player_idx']
            self.game_state['turn_count'] += 1

        return {"success": True}

    def _resolve_combat(self, att, deff):
        if att == 'S' and deff == '10': return 'win'
        if att == '3' and deff == 'B': return 'win'
        sa, sd = self.RANKS_STRENGTH[att], self.RANKS_STRENGTH[deff]
        if sa > sd: return 'win'
        if sa < sd: return 'loss'
        return 'draw'

    def _player_has_moves(self, p_idx):
        for r in range(10):
            for c in range(10):
                pc = self.board[r][c]
                if pc and pc['player'] == p_idx and pc['rank'] not in ['F', 'B']: return True
        return False

    def _end_game(self, winner_idx, reason):
        self.game_state['stage'] = 'game_over'
        self.game_state['winner'] = {
            'name': self.seats[winner_idx]['name'],
            'userId': self.seats[winner_idx].get('userId'),
            'reason': reason,
        }
        self._record_win(winner_idx)

    def _record_win(self, winner_idx: int) -> None:
        try:
            record_multiplayer_result(
                'Stratego',
                self.seats,
                [winner_idx],
                mode=getattr(self, 'matchmaking_mode', 'casual'),
            )
        except Exception as error:
            db.session.rollback()
            if current_app:
                current_app.logger.exception("Error saving Stratego stats", exc_info=error)

    def _get_player_idx(self, sid):
        for i, s in enumerate(self.seats):
            if s and s['socketId'] == sid: return i
        return -1

    def _get_player_idx_by_token(self, user_token):
        for i, s in enumerate(self.seats):
            if s and s.get('userId') == user_token: return i
        return -1

    def forfeit_player(self, user_token: str, reason: str = "resign") -> Dict[str, Any]:
        if self.game_state.get('stage') in {'waiting_for_players', 'game_over'}:
            return {'success': False, 'msg': 'Gra nie jest aktywna.'}
        loser_idx = self._get_player_idx_by_token(user_token)
        if loser_idx == -1:
            return {'success': False, 'msg': 'Gracz nie siedzi przy stole.'}
        self._end_game(1 - loser_idx, 'Poddanie' if reason == 'resign' else 'Rozlaczenie')
        return {'success': True}

    def get_state(self):
        return {
            "board": self.board,
            "seats": self.seats,
            "stage": self.game_state['stage'],
            "current_player_idx": self.game_state['current_player_idx'],
            "setup_ready": self.game_state['setup_ready'],
            "last_move": self.game_state.get('last_move'),
            "winner": self.game_state.get('winner')
        }

    def get_player_view(self, player_sid, user_token=None):
        state = self.get_state()

        if user_token:
            pid = self._get_player_idx_by_token(user_token)
        else:
            pid = self._get_player_idx(player_sid)

        if pid == -1 and player_sid:
            pid = self._get_player_idx(player_sid)

        masked = [[None for _ in range(10)] for _ in range(10)]
        for r in range(10):
            for c in range(10):
                p = self.board[r][c]
                if p:
                    pc = p.copy()
                    if pid != -1 and state['stage'] != 'game_over' and p['player'] != pid and not p['revealed']:
                        pc['rank'] = '?'
                    if pid == -1 and not p['revealed']:
                        pc['rank'] = '?'
                    masked[r][c] = pc
        state['board'] = masked
        state['my_idx'] = pid
        return state