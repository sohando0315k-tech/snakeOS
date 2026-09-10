-- =============================================================================
-- SNAKEOS LEADERBOARD DATABASE SCHEMA FOR SUPABASE
-- Run this entire script in Supabase Dashboard -> SQL Editor -> New query
-- =============================================================================

-- 1. Create the leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    high_score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create index for fast leaderboard rank queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_high_score 
ON leaderboard (high_score DESC, updated_at ASC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Allow public read access (view leaderboard)
CREATE POLICY "Allow public read access" 
ON leaderboard 
FOR SELECT 
USING (true);

-- Allow public insert (register new player)
CREATE POLICY "Allow public insert" 
ON leaderboard 
FOR INSERT 
WITH CHECK (true);

-- Allow public update (submit new high score)
CREATE POLICY "Allow public update" 
ON leaderboard 
FOR UPDATE 
USING (true);

-- Optional: Seed demo players so your leaderboard is not empty to start
INSERT INTO leaderboard (username, high_score) VALUES
  ('ViperQueen', 420),
  ('PythonMaster', 360),
  ('RetroGamer', 290),
  ('NeonCobra', 180),
  ('ShadowSnake', 120)
ON CONFLICT (username) DO NOTHING;
