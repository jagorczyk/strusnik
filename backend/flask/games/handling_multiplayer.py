from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Type
from uuid import uuid4

from games.base import MultiplayerGame


class GameType(Enum):
    Multiplayer = "Multiplayer"


@dataclass
class Room:
    uuid: str
    host_id: str
    game_name: str
    players: List[str]
    maxPlayers: int
    password: Optional[str] = None
    room_name: Optional[str] = None
    game_instance: Optional[MultiplayerGame] = None
    player_tokens: Set[str] = field(default_factory=set)
    time_control_min: Optional[int] = None
    host_user_token: Optional[str] = None
    host_color_pref: Optional[str] = None
    host_seat_index: Optional[int] = None
    observers_allowed: bool = True
    max_observers: int = 20
    observers: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    map_id: Optional[str] = None
    match_mode: Optional[str] = None
    duration_min: Optional[int] = None
    matchmaking_mode: Optional[str] = None
    matchmaking_id: Optional[str] = None
    rating_recorded: bool = False
    is_matchmaking: bool = False

    def to_dict(self):
        seated = len(self.player_tokens)
        stage = None
        if self.game_instance:
            stage = self.game_instance.game_state.get("stage")
            if hasattr(self.game_instance, "seats"):
                seated = max(seated, sum(seat is not None for seat in self.game_instance.seats))

        return {
            "id": self.uuid,
            "game": self.game_name,
            "room_name": self.room_name,
            "players_count": seated,
            "max_players": self.maxPlayers,
            "observers_count": len(self.observers),
            "max_observers": self.max_observers,
            "observers_allowed": self.observers_allowed,
            "is_active": stage not in {"game_over", "finished", "ended"},
            "stage": stage,
            "host_id": self.host_id,
            "has_password": self.password is not None,
            "time_control_min": self.time_control_min,
            "time_min": self.time_control_min,
            "host_user_token": self.host_user_token,
            "host_color_pref": self.host_color_pref,
            "host_seat_index": self.host_seat_index,
            "map_id": self.map_id,
            "match_mode": self.match_mode,
            "duration_min": self.duration_min,
            "matchmaking_mode": self.matchmaking_mode,
            "is_matchmaking": self.is_matchmaking,
        }


@dataclass
class Lobby:
    game: Any
    game_class: Type[MultiplayerGame]
    rooms: Dict[str, Room] = field(default_factory=dict)

    def create_room(
        self,
        host_id: str,
        room_name: str,
        game_name: str,
        max_players: int,
        password: Optional[str] = None,
        time_control_min: Optional[int] = None,
        host_user_token: Optional[str] = None,
        host_color_pref: Optional[str] = None,
        host_seat_index: Optional[int] = None,
        observers_allowed: bool = True,
        max_observers: int = 20,
        map_id: Optional[str] = None,
        match_mode: Optional[str] = None,
        duration_min: Optional[int] = None,
    ):
        room_uuid = str(uuid4())
        room = Room(
            uuid=room_uuid,
            game_name=game_name,
            room_name=room_name,
            host_id=host_id,
            players=[host_id],
            maxPlayers=max_players,
            password=password,
            player_tokens=set(),
            time_control_min=time_control_min,
            host_user_token=host_user_token,
            host_color_pref=host_color_pref,
            host_seat_index=host_seat_index,
            observers_allowed=bool(observers_allowed),
            max_observers=max(1, int(max_observers or 20)),
            map_id=map_id,
            match_mode=match_mode,
            duration_min=duration_min,
        )
        self.rooms[room_uuid] = room
        return room

    def join_room(self, room_uuid: str, player_id: str, user_token: str):
        room = self.rooms.get(room_uuid)
        if not room or not user_token:
            return None

        if user_token in room.player_tokens:
            if player_id not in room.players:
                room.players.append(player_id)
            return room

        if len(room.player_tokens) >= max(1, int(room.maxPlayers or 0)):
            return None

        room.player_tokens.add(user_token)
        if player_id not in room.players:
            room.players.append(player_id)
        return room

    def remove_player(self, room_uuid: str, player_sid: str, user_token: str, keep_membership: bool = False):
        room = self.rooms.get(room_uuid)
        if not room:
            return False

        if user_token and not keep_membership:
            room.player_tokens.discard(user_token)
        if player_sid in room.players:
            room.players.remove(player_sid)
        return True

    def join_observer(self, room_uuid: str, sid: str, user_token: str, name: str, has_avatar: bool = False):
        room = self.rooms.get(room_uuid)
        if not room or not user_token or not room.observers_allowed:
            return None
        if user_token not in room.observers and len(room.observers) >= room.max_observers:
            return None
        room.observers[user_token] = {
            "socketId": sid,
            "userId": user_token,
            "name": name,
            "hasAvatar": bool(has_avatar),
            "connected": True,
        }
        return room

    def remove_observer(self, room_uuid: str, user_token: str):
        room = self.rooms.get(room_uuid)
        if not room:
            return False
        return room.observers.pop(user_token, None) is not None

    def transfer_host(self, room_uuid: str):
        room = self.rooms.get(room_uuid)
        if not room:
            return None
        next_token = next(iter(room.player_tokens), None)
        if not next_token:
            room.host_user_token = None
            room.host_id = ""
            return None
        room.host_user_token = next_token
        session = None
        return next_token

    def destroy_room(self, room_uuid: str):
        return self.rooms.pop(room_uuid, None) is not None


@dataclass
class LobbyManager:
    lobbies: Dict[str, Lobby] = field(default_factory=dict)

    def register_game(self, game_name: str, game_type: GameType, game_class: Type[MultiplayerGame]):
        @dataclass
        class GameStub:
            name: str
            type: GameType

        self.lobbies[game_name] = Lobby(
            game=GameStub(name=game_name, type=game_type),
            game_class=game_class,
        )

    def get_lobby(self, game_name: str) -> Optional[Lobby]:
        return self.lobbies.get(game_name)
