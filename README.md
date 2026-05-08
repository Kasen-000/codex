# Mafia Realtime Lobby

A high-performance realtime lobby with:
- Host TV view at `/host/:roomCode`
- Mobile join view at `/join/:roomCode`
- Supabase Realtime sync for instant player card updates
- Framer Motion spring animations for joining players

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create environment file:
   ```bash
   cp .env.example .env
   ```
3. Fill values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Run SQL in your Supabase SQL editor:
   - `supabase/schema.sql`
5. Start app:
   ```bash
   npm run dev
   ```

## Notes on low-latency behavior

- Uses direct Postgres changes subscription for `players` insert events.
- Inserts are idempotently merged by player `id` to avoid duplicates.
- Spring animation only runs for newly inserted cards.
