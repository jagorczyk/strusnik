import random
import time
from typing import List, Dict, Any, Optional
from .base import MultiplayerGame

from models import db, User, GameStats
from utils import record_match_history
from flask import current_app


class SetGame(MultiplayerGame):
    player_range = [2, 3, 4]

    def __init__(self, players: List[str]) -> None:
        super().__init__(players)
        self.seats: List[Optional[Dict[str, Any]]] = [None] * 4
        self.deck: List[Dict[str, int]] = []
        self.table_cards: List[Optional[Dict[str, int]]] = []
        self.game_state = self.init_board()

    def init_board(self) -> Dict[str, Any]:
        return {
            "stage": "waiting_for_players",
            "seats": self.seats,
            "table_cards": [],
            "deck_remaining": 81,
            "last_set_by": None,
            "last_set_cards": [],
            "winner": None,
            "winners": [],
            "msg": "",
            "game_over": False
        }

    def _generate_deck(self) -> List[Dict[str, int]]:

        deck = []
        for shape in range(3):
            for color in range(3):
                for fill in range(3):
                    for count in range(3):
                        deck.append({
                            "shape": shape,
                            "color": color,
                            "fill": fill,
                            "count": count,
                            "id": f"{shape}{color}{fill}{count}"
                        })
        return deck

    def _is_valid_set(self, cards: List[Dict[str, int]]) -> bool:

        if len(cards) != 3:
            return False

        for prop in ["shape", "color", "fill", "count"]:
            values = [card[prop] for card in cards]

            if not (len(set(values)) == 1 or len(set(values)) == 3):
                return False
        return True

    def _find_set_on_table(self) -> Optional[List[int]]:

        active_cards = [(i, c) for i, c in enumerate(self.table_cards) if c is not None]
        
        for i in range(len(active_cards)):
            for j in range(i + 1, len(active_cards)):
                for k in range(j + 1, len(active_cards)):
                    idx_i, card_i = active_cards[i]
                    idx_j, card_j = active_cards[j]
                    idx_k, card_k = active_cards[k]
                    
                    if self._is_valid_set([card_i, card_j, card_k]):
                        return [idx_i, idx_j, idx_k]
        return None

    def _deal_initial_cards(self):

        self.deck = self._generate_deck()
        random.shuffle(self.deck)
        
        self.table_cards = []
        for _ in range(12):
            if self.deck:
                self.table_cards.append(self.deck.pop())
            else:
                self.table_cards.append(None)



        while not self._find_set_on_table() and self.deck and len([c for c in self.table_cards if c]) < 21:
            for _ in range(3):
                if self.deck:
                    self.table_cards.append(self.deck.pop())

    def _refill_table(self):


        self.table_cards = [c for c in self.table_cards if c is not None]
        

        while len(self.table_cards) < 12 and self.deck:
            self.table_cards.append(self.deck.pop())


        while not self._find_set_on_table() and self.deck:
            for _ in range(3):
                if self.deck:
                    self.table_cards.append(self.deck.pop())

    def sit_player(self, player_id: str, player_name: str, seat_index: int, user_token: str) -> Dict[str, Any]:
        if not (0 <= seat_index < 4):
            return {"success": False, "msg": "Invalid seat."}

        if self.seats[seat_index] is not None:
            return {"success": False, "msg": "Seat taken."}

        for s in self.seats:
            if s and s.get('userId') == user_token:
                return {"success": False, "msg": "You are already seated."}

        self.seats[seat_index] = {
            "socketId": player_id,
            "userId": user_token,
            "name": player_name,
            "score": 0,
            "sets_found": 0,
            "connected": True,
            "disconnect_timestamp": None
        }
        return {"success": True, "msg": "Seated."}

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

    def start_game(self) -> Dict[str, Any]:
        if self.game_state['stage'] != 'waiting_for_players':
            return {"success": False, "msg": "Gra juz zostala rozpoczeta."}
        seated_count = len([s for s in self.seats if s is not None])
        if seated_count < 2:
            return {"success": False, "msg": "Not enough players (min. 2)."}

        self._deal_initial_cards()
        
        self.game_state['stage'] = 'playing'
        self.game_state['table_cards'] = self.table_cards
        self.game_state['deck_remaining'] = len(self.deck)
        self.game_state['msg'] = "Game started! Find the SET!"
        
        return {"success": True}

    def handle_move(self, player_id: str, move_data: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(move_data, dict):
            return {"success": False, "msg": "Nieprawidlowy ruch."}

        action = move_data.get('action')

        if self.game_state['stage'] != 'playing':
            return {"success": False, "msg": "Game is not running."}


        player_seat = None
        player_idx = -1
        for i, seat in enumerate(self.seats):
            if seat and (seat.get('socketId') == player_id or seat.get('userId') == player_id):
                player_seat = seat
                player_idx = i
                break

        if not player_seat:
            return {"success": False, "msg": "You are not seated."}

        if action == 'claim_set':
            return self._handle_claim_set(player_seat, player_idx, move_data)
        elif action == 'no_set':
            return self._handle_no_set(player_seat, player_idx)
        else:
            return {"success": False, "msg": "Unknown action."}

    def _handle_claim_set(self, player_seat: Dict, player_idx: int, move_data: Dict) -> Dict[str, Any]:

        card_indices = move_data.get('card_indices', [])

        if (
            not isinstance(card_indices, list)
            or len(card_indices) != 3
            or any(not isinstance(idx, int) or isinstance(idx, bool) for idx in card_indices)
            or len(set(card_indices)) != 3
        ):
            return {"success": False, "msg": "Select exactly 3 cards."}


        for idx in card_indices:
            if not isinstance(idx, int) or isinstance(idx, bool) or idx < 0 or idx >= len(self.table_cards) or self.table_cards[idx] is None:
                return {"success": False, "msg": "Invalid card selection."}

        selected_cards = [self.table_cards[idx] for idx in card_indices]

        if self._is_valid_set(selected_cards):

            player_seat['score'] += 1
            player_seat['sets_found'] += 1

            self.game_state['last_set_by'] = player_seat['name']
            self.game_state['last_set_cards'] = [c['id'] for c in selected_cards]
            self.game_state['msg'] = f"{player_seat['name']} found a SET!"


            for idx in sorted(card_indices, reverse=True):
                self.table_cards[idx] = None


            self._refill_table()
            self.game_state['table_cards'] = self.table_cards
            self.game_state['deck_remaining'] = len(self.deck)


            if self._check_game_end():
                return {"success": True, "game_over": True}

            return {"success": True, "valid_set": True}
        else:

            player_seat['score'] -= 1
            self.game_state['msg'] = f"{player_seat['name']} made a mistake! (-1 pt)"
            return {"success": True, "valid_set": False}

    def _handle_no_set(self, player_seat: Dict, player_idx: int) -> Dict[str, Any]:

        existing_set = self._find_set_on_table()

        if existing_set is None:

            if self.deck:

                for _ in range(3):
                    if self.deck:
                        self.table_cards.append(self.deck.pop())
                
                self.game_state['table_cards'] = self.table_cards
                self.game_state['deck_remaining'] = len(self.deck)
                self.game_state['msg'] = "No SET - drew 3 cards."
                return {"success": True, "was_correct": True}
            else:

                self._check_game_end()
                return {"success": True, "was_correct": True, "game_over": True}
        else:

            player_seat['score'] -= 1
            self.game_state['msg'] = f"{player_seat['name']} made a mistake - SET is on the table! (-1 pt)"
            return {"success": True, "was_correct": False}

    def _check_game_end(self) -> bool:


        if not self.deck and not self._find_set_on_table():
            self.game_state['stage'] = 'finished'
            self.game_state['game_over'] = True
            

            max_score = max((s['score'] for s in self.seats if s), default=0)
            winners = [s['name'] for s in self.seats if s and s['score'] == max_score]
            
            self.game_state['winners'] = winners
            if len(winners) == 1:
                self.game_state['winner'] = winners[0]
                self.game_state['msg'] = f"Game over! {winners[0]} wins!"
            else:
                self.game_state['winner'] = None
                self.game_state['msg'] = f"Game over! Draw: {', '.join(winners)}!"
            

            self._save_game_stats()
            
            return True
        return False

    def _save_game_stats(self):
        try:
            winners = self.game_state.get('winners', [])
            for seat in self.seats:
                if not seat or not seat.get('userId'):
                    continue
                user = User.query.get(seat['userId'])
                if not user:
                    continue

                stats = GameStats.query.filter_by(user_id=user.id, game_name='Set').first()
                if not stats:
                    stats = GameStats(user_id=user.id, game_name='Set')
                    db.session.add(stats)

                is_winner = seat['name'] in winners
                if len(winners) == 1 and is_winner:
                    stats.wins = (stats.wins or 0) + 1
                elif len(winners) > 1 and is_winner:
                    stats.draws = (stats.draws or 0) + 1
                else:
                    stats.losses = (stats.losses or 0) + 1

            winner_indices = [
                index for index, seat in enumerate(self.seats)
                if seat and seat.get('name') in winners
            ]
            record_match_history(
                'Set',
                self.seats,
                winner_indices=winner_indices,
                mode=getattr(self, 'matchmaking_mode', 'casual'),
            )
            db.session.commit()
        except Exception as error:
            db.session.rollback()
            if current_app:
                current_app.logger.exception("Error saving Set game stats", exc_info=error)

    def forfeit_player(self, user_token: str, reason: str = "resign") -> Dict[str, Any]:
        if self.game_state.get('stage') in {'waiting_for_players', 'finished'}:
            return {'success': False, 'msg': 'Gra nie jest aktywna.'}
        loser = next((seat for seat in self.seats if seat and str(seat.get('userId')) == str(user_token)), None)
        if loser is None:
            return {'success': False, 'msg': 'Gracz nie siedzi przy stole.'}
        remaining = [seat for seat in self.seats if seat and str(seat.get('userId')) != str(user_token)]
        if not remaining:
            return {'success': False, 'msg': 'Brak zwyciezcy.'}
        highest_score = max(seat.get('score', 0) for seat in remaining)
        winners = [seat['name'] for seat in remaining if seat.get('score', 0) == highest_score]
        self.game_state['stage'] = 'finished'
        self.game_state['game_over'] = True
        self.game_state['winners'] = winners
        self.game_state['winner'] = winners[0] if len(winners) == 1 else None
        self.game_state['msg'] = f"Koniec gry. {', '.join(winners)} wygrywa przez poddanie." if reason == 'resign' else f"Koniec gry. {', '.join(winners)} wygrywa po rozlaczeniu gracza."
        self._save_game_stats()
        return {'success': True}

    def get_state(self) -> Dict[str, Any]:

        state = {
            "stage": self.game_state['stage'],
            "seats": [
                {
                    "socketId": s['socketId'],
                    "userId": s['userId'],
                    "name": s['name'],
                    "score": s['score'],
                    "sets_found": s['sets_found'],
                    "connected": s['connected'],
                } if s else None
                for s in self.seats
            ],
            "table_cards": self.game_state.get('table_cards', []),
            "deck_remaining": self.game_state.get('deck_remaining', 0),
            "last_set_by": self.game_state.get('last_set_by'),
            "last_set_cards": self.game_state.get('last_set_cards', []),
            "winner": self.game_state.get('winner'),
            "winners": self.game_state.get('winners', []),
            "msg": self.game_state.get('msg', ''),
            "game_over": self.game_state.get('game_over', False)
        }
        return state
