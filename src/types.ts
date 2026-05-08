export type GameStatus = 'waiting' | 'blackout' | 'revealing' | 'night' | 'press' | 'tribunal' | 'mafia_win' | 'town_win' | 'in_game' | 'ended';

export type Role = 'mafia' | 'doctor' | 'detective' | 'gossip' | 'townie';

export type Room = {
  id: string;
  code: string;
  status: GameStatus;
  created_at: string;
};

export type Player = {
  id: string;
  room_id: string;
  nickname: string;
  role: Role | null;
  is_alive: boolean;
  joined_at: string;
};

export type NightAction = {
  id: string;
  room_id: string;
  actor_id: string;
  target_id: string;
  action_type: 'hit' | 'save';
  created_at: string;
};

export type Vote = {
  id: string;
  room_id: string;
  voter_id: string;
  target_id: string;
  created_at: string;
};
