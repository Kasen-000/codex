create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'waiting' check (status in ('waiting','blackout','revealing','night','press','tribunal','mafia_win','town_win','in_game','ended')),
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  role text check (role in ('mafia','doctor','detective','gossip','townie')),
  is_alive boolean not null default true,
  joined_at timestamptz not null default now()
);

create table if not exists public.night_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  actor_id uuid not null references public.players(id) on delete cascade,
  target_id uuid not null references public.players(id) on delete cascade,
  action_type text not null check (action_type in ('hit','save')),
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  voter_id uuid not null references public.players(id) on delete cascade,
  target_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (room_id, voter_id)
);

create index if not exists players_room_id_idx on public.players(room_id);
create index if not exists night_actions_room_id_idx on public.night_actions(room_id);
create index if not exists votes_room_id_idx on public.votes(room_id);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.night_actions enable row level security;
alter table public.votes enable row level security;

create policy "rooms public read/write" on public.rooms for all using (true) with check (true);
create policy "players public read/write" on public.players for all using (true) with check (true);
create policy "night actions public read/write" on public.night_actions for all using (true) with check (true);
create policy "votes public read/write" on public.votes for all using (true) with check (true);

alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.night_actions;
alter publication supabase_realtime add table public.votes;
