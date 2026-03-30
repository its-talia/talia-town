-- 001_initial.sql
-- Initial schema: players and dialogue history

CREATE TABLE IF NOT EXISTS players (
  id          SERIAL PRIMARY KEY,
  discord_id  TEXT UNIQUE NOT NULL,
  username    TEXT NOT NULL,
  avatar      TEXT,
  pos_x       INTEGER NOT NULL DEFAULT 640,
  pos_y       INTEGER NOT NULL DEFAULT 480,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dialogue_history (
  id          SERIAL PRIMARY KEY,
  discord_id  TEXT NOT NULL,
  message     TEXT NOT NULL,
  response    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dialogue_discord_id ON dialogue_history(discord_id);
CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen DESC);
