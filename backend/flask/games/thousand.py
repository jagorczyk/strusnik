import random
import time
from typing import List, Dict, Any, Optional
from .base import MultiplayerGame

from models import db
from flask import current_app
from utils import record_multiplayer_result

WINNING_SCORE = 1000
BARREL_THRESHOLD = 800

class Thousand(MultiplayerGame):
    player_range = [3, 4]

    def __init__(self, players: List[str]) -> None:
        super().__init__(players)
        self.seats: List[Optional[Dict[str, Any]]] = [None] * 4

        ranks = ['9', '10', 'J', 'Q', 'K', 'A']
        suits = ['H', 'D', 'C', 'S']
        self.deck = [r + s for s in suits for r in ranks]

        self.dealer_idx = 0
        self.game_state = self.init_board()

    def init_board(self) -> Dict[str, Any]:
        return {
            "stage": "waiting_for_players",
            "seats": self.seats,
            "current_player": None,
            "current_player_idx": 0,
            "dealer_idx": 0,
            "cards_on_table": [],
            "stock": [],
            "current_bid": 100,
            "highest_bidder_idx": None,
            "bidding_order": [],
            "cards_to_give": 2,
            "trump_suit": None,
            "stock_recipients": [],
            "winner": None,
            "msg": ""
        }

    def sit_player(self, player_id: str, player_name: str, seat_index: int, user_token: str) -> Dict[str, Any]:
        if not (0 <= seat_index < 4):
            return {"success": False, "msg": "NIEPRAWIDLOWE MIEJSCE."}

        if self.seats[seat_index] is not None:
            return {"success": False, "msg": "MIEJSCE ZAJETE."}

        for s in self.seats:
            if s and s.get('userId') == user_token:
                return {"success": False, "msg": "JUZ SIEDZISZ PRZY STOLE."}

        self.seats[seat_index] = {
            "socketId": player_id,
            "userId": user_token,
            "name": player_name,
            "score": 0,
            "round_points": 0,
            "hand": [],
            "hand_count": 0,
            "connected": True,
            "disconnect_timestamp": None
        }
        return {"success": True, "msg": "Usiadles."}

    def set_player_connection_status(self, user_token: str, is_connected: bool, sid: str = None):
        for i, seat in enumerate(self.seats):
            if seat and seat.get('userId') == user_token:


                if is_connected and sid:
                    seat['socketId'] = sid
                    seat['disconnect_timestamp'] = None
                    if i == self.game_state['current_player_idx']:
                        self.game_state['current_player'] = sid


                if seat.get('connected') == is_connected:
                    return False

                seat['connected'] = is_connected

                if not is_connected:
                    seat['disconnect_timestamp'] = time.time()
                    
                return True
        return False

    def start_game(self) -> Dict[str, Any]:
        seated_indices = [i for i, s in enumerate(self.seats) if s is not None]
        if len(seated_indices) < 3:
            return {"success": False, "msg": "Za malo graczy (min. 3)."}

        self.dealer_idx = seated_indices[0]
        self._setup_new_round()
        return {"success": True}

    def _setup_new_round(self):
        seated_indices = [i for i, s in enumerate(self.seats) if s is not None]
        player_count = len(seated_indices)

        active_indices = seated_indices.copy()
        if player_count == 4:
            if self.dealer_idx in active_indices:
                active_indices.remove(self.dealer_idx)
            else:
                self.dealer_idx = seated_indices[0]
                active_indices.remove(self.dealer_idx)

        self.game_state['stage'] = 'bidding'
        self.game_state['trump_suit'] = None
        self.game_state['cards_on_table'] = []
        self.game_state['stock_recipients'] = []
        self.game_state['cards_to_give'] = 2
        self.game_state['dealer_idx'] = self.dealer_idx

        for idx in seated_indices:
            self.seats[idx]['round_points'] = 0
            self.seats[idx]['hand'] = []
            self.seats[idx]['hand_count'] = 0

        current_deck = self.deck.copy()
        random.shuffle(current_deck)

        card_idx = 0
        for i in active_indices:
            hand = current_deck[card_idx: card_idx + 7]
            self.seats[i]['hand'] = list(hand)
            self.seats[i]['hand_count'] = len(hand)
            card_idx += 7

        self.game_state['stock'] = current_deck[card_idx:]

        current_dealer_pos_global = self.dealer_idx
        start_idx = -1
        check = (current_dealer_pos_global + 1) % 4
        while start_idx == -1:
            if check in active_indices:
                start_idx = check
            else:
                check = (check + 1) % 4
                if check == current_dealer_pos_global: break

        self.game_state['current_player_idx'] = start_idx
        self.game_state['current_player'] = self.seats[start_idx]['socketId']

        self.game_state['highest_bidder_idx'] = start_idx
        self.game_state['current_bid'] = 100

        sorted_bidding = []
        curr = start_idx
        while len(sorted_bidding) < len(active_indices):
            if curr in active_indices:
                sorted_bidding.append(curr)
            curr = (curr + 1) % 4

        self.game_state['bidding_order'] = sorted_bidding

    def is_round_over(self) -> bool:
        seated_indices = [i for i, s in enumerate(self.seats) if s is not None]
        active_indices = seated_indices.copy()
        if len(seated_indices) == 4 and self.dealer_idx in active_indices:
            active_indices.remove(self.dealer_idx)

        for i in active_indices:
            if len(self.seats[i]['hand']) > 0:
                return False
        return True

    def finalize_round(self):
        bidder_idx = self.game_state['highest_bidder_idx']
        final_bid = self.game_state['current_bid']
        seated_indices = [i for i, s in enumerate(self.seats) if s is not None]

        if bidder_idx is not None and self.seats[bidder_idx]:
            bidder = self.seats[bidder_idx]
            points_scored = bidder['round_points']

            if points_scored >= final_bid:
                bidder['score'] += final_bid
            else:
                bidder['score'] -= final_bid

        for i, seat in enumerate(self.seats):
            if seat is not None and i != bidder_idx:
                if seat['score'] >= BARREL_THRESHOLD:
                    continue
                raw_points = seat['round_points']
                remainder = raw_points % 10
                rounded = raw_points - remainder + (10 if remainder >= 5 else 0)
                seat['score'] += rounded

        potential_winner = None
        highest_score = -1

        for seat in self.seats:
            if seat is not None:
                if seat['score'] >= WINNING_SCORE:
                    if seat['score'] > highest_score:
                        highest_score = seat['score']
                        potential_winner = seat

        if potential_winner:
            self.game_state['winner'] = {
                'name': potential_winner['name'],
                'score': potential_winner['score'],
                'userId': potential_winner['userId']
            }
            self.game_state['stage'] = 'game_over'

            try:
                winner_idx = self.seats.index(potential_winner)
                record_multiplayer_result(
                    'Tysiac',
                    self.seats,
                    [winner_idx],
                    mode=getattr(self, 'matchmaking_mode', 'casual'),
                )
            except Exception as error:
                db.session.rollback()
                if current_app:
                    current_app.logger.exception("Error saving Thousand stats", exc_info=error)

            return

        if self.dealer_idx in seated_indices:
            current_pos = seated_indices.index(self.dealer_idx)
            next_pos = (current_pos + 1) % len(seated_indices)
            self.dealer_idx = seated_indices[next_pos]
        else:
            self.dealer_idx = seated_indices[0]

        self._setup_new_round()

    def assign_stock_to_winner(self):
        if self.game_state['stage'] != 'stock_reveal': return False

        player_idx = self.game_state['current_player_idx']
        winner_seat = self.seats[player_idx] if 0 <= player_idx < len(self.seats) else None
        if not winner_seat:
            return False
        stock_cards = self.game_state['stock']

        if stock_cards:
            winner_seat['hand'].extend(stock_cards)
            winner_seat['hand_count'] = len(winner_seat['hand'])

        self.game_state['stock_recipients'] = []
        self.game_state['stage'] = 'declaring'
        return True

    def handle_move(self, player_id: str, move_data: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(move_data, dict):
            return {"success": False, "msg": "Nieprawidlowy ruch."}
        move_type = move_data.get('type')
        player_idx = -1
        for i, seat in enumerate(self.seats):
            if seat and seat['socketId'] == player_id:
                player_idx = i
                break

        if player_idx == -1: return {"success": False, "msg": "Nie grasz."}

        if len([s for s in self.seats if s]) == 4 and player_idx == self.dealer_idx:
            return {"success": False, "msg": "Pauzujesz w tej rundzie."}

        if player_idx != self.game_state['current_player_idx']: return {"success": False, "msg": "Nie Twoja kolej."}

        stage = self.game_state['stage']
        if stage == 'bidding':
            return self._handle_bidding_move(player_idx, move_type, move_data)
        elif stage == 'declaring':
            if move_type == 'declare_score': return self._handle_declare_score(player_idx, move_data)
        elif stage == 'distributing':
            if move_type == 'give_card': return self._handle_give_card(player_idx, move_data)
        elif stage == 'playing':
            if move_type == 'play_card': return self._handle_card_play(player_idx, move_data)

        return {"success": False, "msg": "Nieznany ruch."}

    def _handle_declare_score(self, player_idx, move_data):
        amount = move_data.get('amount')
        current_bid = self.game_state['current_bid']
        if not isinstance(amount, int) or isinstance(amount, bool):
            return {"success": False, "msg": "Blad wartosci"}
        if amount % 10 != 0: return {"success": False, "msg": "Musi byc podzielne przez 10"}
        if amount < current_bid: return {"success": False, "msg": "Nie mozesz zadeklarowac mniej niz licytowales"}
        self.game_state['current_bid'] = amount
        self.game_state['stage'] = 'distributing'
        return {"success": True}

    def _handle_bidding_move(self, player_idx, move_type, move_data):
        current_bid = self.game_state['current_bid']
        bidding_order = self.game_state['bidding_order']

        if move_type == 'bid':
            amount = move_data.get('amount')
            if not isinstance(amount, int) or isinstance(amount, bool) or amount <= current_bid or amount % 10 != 0:
                return {"success": False, "msg": "Nieprawidlowa licytacja."}
            self.game_state['current_bid'] = amount
            self.game_state['highest_bidder_idx'] = player_idx
            self._next_bidder()
            return {"success": True}

        elif move_type == 'pass':
            if player_idx in bidding_order: bidding_order.remove(player_idx)

            if len(bidding_order) == 1:
                winner_idx = bidding_order[0]
                winner_seat = self.seats[winner_idx]
                self.game_state['highest_bidder_idx'] = winner_idx
                self.game_state['stage'] = 'stock_reveal'
                self.game_state['current_player_idx'] = winner_idx
                self.game_state['current_player'] = winner_seat['socketId']
                self.game_state['cards_to_give'] = 2
                return {"success": True}

            self._next_bidder()
            return {"success": True}
        return {"success": False}

    def _next_bidder(self):
        curr = self.game_state['current_player_idx']
        order = self.game_state['bidding_order']
        if not order: return

        check_idx = (curr + 1) % 4
        for _ in range(4):
            if check_idx in order:
                self.game_state['current_player_idx'] = check_idx
                if self.seats[check_idx]:
                    self.game_state['current_player'] = self.seats[check_idx]['socketId']
                return
            check_idx = (check_idx + 1) % 4

        if order:
            nxt = order[0]
            self.game_state['current_player_idx'] = nxt
            if self.seats[nxt]:
                self.game_state['current_player'] = self.seats[nxt]['socketId']

    def _handle_give_card(self, player_idx, move_data):
        card = move_data.get('card')
        target = move_data.get('target_idx')
        if not isinstance(card, str) or not isinstance(target, int) or isinstance(target, bool):
            return {"success": False, "msg": "Nieprawidlowa karta albo cel."}
        seat = self.seats[player_idx]
        if card not in seat['hand']: return {"success": False, "msg": "BRAK KARTY"}
        if target is None or not (0 <= target < 4) or not self.seats[target]: return {"success": False,
                                                                                      "msg": "BLEDNY CEL"}
        if target == player_idx: return {"success": False, "msg": "NIE SOBIE"}
        if len([s for s in self.seats if s]) == 4 and target == self.dealer_idx: return {"success": False,
                                                                                         "msg": "NIE MOZESZ DAC KARTY PAUZUJACEMU."}
        if target in self.game_state['stock_recipients']: return {"success": False,
                                                                  "msg": "TEN GRACZ JUZ DOSTAL KARTE."}

        seat['hand'].remove(card)
        seat['hand_count'] = len(seat['hand'])
        self.seats[target]['hand'].append(card)
        self.seats[target]['hand_count'] += 1
        self.game_state['stock_recipients'].append(target)
        self.game_state['cards_to_give'] -= 1

        if self.game_state['cards_to_give'] <= 0:
            self.game_state['stage'] = 'playing'
            self.game_state['stock_recipients'] = []
        return {"success": True}

    def _get_card_value(self, c):
        return {'A': 11, '10': 10, 'K': 4, 'Q': 3, 'J': 2, '9': 0}.get(c[:-1], 0)

    def _get_card_strength(self, c):
        return {'A': 5, '10': 4, 'K': 3, 'Q': 2, 'J': 1, '9': 0}.get(c[:-1], 0)

    def _get_marriage_points(self, s):
        return {'H': 100, 'D': 80, 'C': 60, 'S': 40}.get(s, 0)

    def _resolve_trick(self):
        table = self.game_state['cards_on_table']
        if not table: return
        points = sum(self._get_card_value(x['card']) for x in table)

        first = table[0]['card']
        lead = first[-1]
        trump = self.game_state.get('trump_suit')
        best_val = -1
        winner = None

        for item in table:
            c = item['card']
            s = c[-1]
            strength = self._get_card_strength(c)
            val = 0
            if s == trump:
                val = 100 + strength
            elif s == lead:
                val = 10 + strength
            else:
                val = 0

            if val > best_val:
                best_val = val
                winner = item

        if winner:
            wid = winner['player_id']
            for seat in self.seats:
                if seat and seat['socketId'] == wid:
                    seat['round_points'] += points
                    self.game_state['current_player'] = seat['socketId']
                    self.game_state['current_player_idx'] = self.seats.index(seat)
                    break

    def cleanup_table(self):
        self.game_state['cards_on_table'] = []

    def _validate_card_play(self, seat, card_to_play):
        cards_on_table = self.game_state['cards_on_table']
        if not cards_on_table: return True

        lead_card = cards_on_table[0]['card']
        lead_suit = lead_card[-1]
        play_suit = card_to_play[-1]
        trump_suit = self.game_state.get('trump_suit')
        hand = seat['hand']
        has_lead_suit = any(c.endswith(lead_suit) for c in hand)
        has_trump_suit = (trump_suit is not None) and any(c.endswith(trump_suit) for c in hand)

        if has_lead_suit: return play_suit == lead_suit
        if has_trump_suit: return play_suit == trump_suit
        return True

    def _handle_card_play(self, player_idx, move_data):
        card = move_data.get('card')
        seat = self.seats[player_idx]
        if not isinstance(card, str):
            return {"success": False, "msg": "Nieprawidlowa karta."}

        if card not in seat['hand']: return {"success": False, "msg": "Nie masz tej karty."}
        if not self._validate_card_play(seat, card): return {"success": False,
                                                             "msg": "Musisz dolozyc do koloru lub przebic atutem!"}

        seated_count = len([s for s in self.seats if s])
        TRICK_SIZE = 3 if seated_count >= 3 else seated_count

        if len(self.game_state['cards_on_table']) >= TRICK_SIZE:
            self.game_state['cards_on_table'] = []

        if len(self.game_state['cards_on_table']) == 0:
            rank, suit = card[:-1], card[-1]
            if rank == 'Q':
                king = 'K' + suit
                if king in seat['hand']:
                    pts = self._get_marriage_points(suit)
                    seat['round_points'] += pts
                    self.game_state['trump_suit'] = suit

        seat['hand'].remove(card)
        seat['hand_count'] = len(seat['hand'])
        self.game_state['cards_on_table'].append({
            "player_id": seat['socketId'],
            "userId": seat['userId'],
            "card": card
        })

        completed = False
        if len(self.game_state['cards_on_table']) >= TRICK_SIZE:
            self._resolve_trick()
            completed = True
        else:
            self._next_player_turn()
        return {"success": True, "trick_completed": completed}

    def _next_player_turn(self):
        curr = self.game_state['current_player_idx']
        seated_indices = [i for i, s in enumerate(self.seats) if s is not None]
        active_indices = seated_indices.copy()
        if len(seated_indices) == 4 and self.dealer_idx in active_indices:
            active_indices.remove(self.dealer_idx)

        if curr in active_indices:
            curr_idx_in_active = active_indices.index(curr)
            next_idx_in_active = (curr_idx_in_active + 1) % len(active_indices)
            nxt = active_indices[next_idx_in_active]
        else:
            nxt = active_indices[0]

        self.game_state['current_player_idx'] = nxt
        if self.seats[nxt]:
            self.game_state['current_player'] = self.seats[nxt]['socketId']

    def forfeit_player(self, user_token: str, reason: str = "resign") -> Dict[str, Any]:
        if self.game_state.get('stage') in {'waiting_for_players', 'game_over'}:
            return {'success': False, 'msg': 'Gra nie jest aktywna.'}
        loser_idx = next((index for index, seat in enumerate(self.seats) if seat and str(seat.get('userId')) == str(user_token)), None)
        if loser_idx is None:
            return {'success': False, 'msg': 'Gracz nie siedzi przy stole.'}
        remaining = [(index, seat) for index, seat in enumerate(self.seats) if seat and index != loser_idx]
        if not remaining:
            return {'success': False, 'msg': 'Brak zwyciezcy.'}
        winner_idx, winner = max(remaining, key=lambda item: item[1].get('score', 0))
        self.game_state['winner'] = {
            'name': winner.get('name'),
            'score': winner.get('score', 0),
            'userId': winner.get('userId'),
            'reason': reason,
        }
        self.game_state['stage'] = 'game_over'
        try:
            record_multiplayer_result(
                'Tysiac',
                self.seats,
                [winner_idx],
                mode=getattr(self, 'matchmaking_mode', 'casual'),
            )
        except Exception as error:
            db.session.rollback()
            if current_app:
                current_app.logger.exception("Error saving Thousand forfeit stats", exc_info=error)
        return {'success': True}

    def get_state(self) -> Dict[str, Any]:
        public_seats = []
        for seat in self.seats:
            if seat is None:
                public_seats.append(None)
            else:
                safe_seat = {k: v for k, v in seat.items() if k != 'hand'}
                if 'connected' not in safe_seat: safe_seat['connected'] = True
                if 'disconnect_timestamp' not in safe_seat: safe_seat['disconnect_timestamp'] = None
                public_seats.append(safe_seat)

        stock_to_show = None
        if self.game_state['stage'] == 'stock_reveal':
            stock_to_show = self.game_state['stock']

        active_user_id = None
        current_idx = self.game_state.get('current_player_idx')
        if current_idx is not None and 0 <= current_idx < 4:
            seat = self.seats[current_idx]
            if seat: active_user_id = seat['userId']

        return {
            "stage": self.game_state['stage'],
            "seats": public_seats,
            "current_player": self.game_state['current_player'],
            "active_user_id": active_user_id,
            "dealer_idx": self.game_state.get('dealer_idx', 0),
            "cards_on_table": self.game_state['cards_on_table'],
            "current_bid": self.game_state['current_bid'],
            "stock": stock_to_show,
            "cards_to_give": self.game_state.get('cards_to_give', 0),
            "trump_suit": self.game_state.get('trump_suit'),
            "stock_recipients": self.game_state.get('stock_recipients', []),
            "winner": self.game_state.get('winner')
        }

    def update_player_sid(self, user_token: str, new_sid: str):
        for seat in self.seats:
            if seat and seat.get('userId') == user_token:
                seat['socketId'] = new_sid
                if self.seats.index(seat) == self.game_state['current_player_idx']:
                    self.game_state['current_player'] = new_sid
                return True
        return False

    def get_player_hand_by_token(self, user_token: str):
        for seat in self.seats:
            if seat and seat.get('userId') == user_token:
                return seat.get('hand', [])
        return None