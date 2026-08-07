import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple
from uuid import uuid4

from utils import RANKED_INITIAL_RATING


MATCHMAKING_GAMES = {"chess", "battleships", "stratego"}
MATCHMAKING_MODES = {"ranked", "casual"}


@dataclass
class QueueEntry:
    token: str
    sid: str
    username: str
    game_name: str
    mode: str
    is_guest: bool
    rating: int = RANKED_INITIAL_RATING
    joined_at: float = field(default_factory=time.time)

    @property
    def queue_key(self) -> Tuple[str, str]:
        return self.game_name, self.mode


@dataclass
class Match:
    match_id: str
    game_name: str
    mode: str
    entries: List[QueueEntry]
    ready_tokens: Set[str] = field(default_factory=set)
    created_at: float = field(default_factory=time.time)
    room_id: Optional[str] = None


class MatchmakingManager:
    def __init__(self):
        self.queues: Dict[Tuple[str, str], List[QueueEntry]] = {}
        self.matches: Dict[str, Match] = {}
        self.token_to_match: Dict[str, str] = {}

    @staticmethod
    def normalize_game(game_name) -> Optional[str]:
        normalized = str(game_name or "").strip().lower()
        return normalized if normalized in MATCHMAKING_GAMES else None

    @staticmethod
    def normalize_mode(mode) -> Optional[str]:
        normalized = str(mode or "").strip().lower()
        return normalized if normalized in MATCHMAKING_MODES else None

    def remove_from_queue(self, token: str) -> Optional[QueueEntry]:
        for key, entries in list(self.queues.items()):
            for entry in list(entries):
                if entry.token == token:
                    entries.remove(entry)
                    if not entries:
                        self.queues.pop(key, None)
                    return entry
        return None

    def get_match_for_token(self, token: str) -> Optional[Match]:
        match_id = self.token_to_match.get(token)
        return self.matches.get(match_id) if match_id else None

    def cancel_token(self, token: str) -> Optional[Match]:
        self.remove_from_queue(token)
        match = self.get_match_for_token(token)
        if not match:
            return None
        self.remove_match(match.match_id)
        return match

    def remove_match(self, match_id: str) -> Optional[Match]:
        match = self.matches.pop(match_id, None)
        if not match:
            return None
        for entry in match.entries:
            self.token_to_match.pop(entry.token, None)
        return match

    def _rating_range(self, entry: QueueEntry) -> int:
        waited = max(0, int(time.time() - entry.joined_at))
        return min(300, 100 + (waited // 15) * 100)

    def _compatible(self, entry: QueueEntry, candidate: QueueEntry) -> bool:
        if entry.token == candidate.token:
            return False
        if entry.game_name != candidate.game_name or entry.mode != candidate.mode:
            return False
        if entry.mode == "casual":
            return True
        allowed_range = max(self._rating_range(entry), self._rating_range(candidate))
        return abs(entry.rating - candidate.rating) <= allowed_range

    def enqueue(self, entry: QueueEntry) -> Optional[Match]:
        self.cancel_token(entry.token)
        queue = self.queues.setdefault(entry.queue_key, [])
        candidates = [candidate for candidate in queue if self._compatible(entry, candidate)]
        if not candidates:
            queue.append(entry)
            return None

        candidate = min(
            candidates,
            key=lambda item: (abs(entry.rating - item.rating), item.joined_at),
        )
        queue.remove(candidate)
        if not queue:
            self.queues.pop(entry.queue_key, None)

        match = Match(
            match_id=str(uuid4()),
            game_name=entry.game_name,
            mode=entry.mode,
            entries=[candidate, entry],
        )
        self.matches[match.match_id] = match
        for participant in match.entries:
            self.token_to_match[participant.token] = match.match_id
        return match

    def mark_ready(self, match_id: str, token: str) -> Optional[Match]:
        match = self.matches.get(match_id)
        if not match or token not in {entry.token for entry in match.entries}:
            return None
        match.ready_tokens.add(token)
        return match

    def is_ready(self, match_id: str) -> bool:
        match = self.matches.get(match_id)
        return bool(match and len(match.ready_tokens) == len(match.entries))

    def requeue_entries(self, match: Match, exclude_tokens: Optional[Set[str]] = None) -> List[Tuple[QueueEntry, Optional[Match]]]:
        excluded = exclude_tokens or set()
        result = []
        for entry in match.entries:
            if entry.token in excluded:
                continue
            entry.joined_at = time.time()
            result.append((entry, self.enqueue(entry)))
        return result
