-- Phase 2: tagging modes and placeholder players.
-- Run in the Supabase SQL editor before testing the Phase 2 tagger / Create Match changes.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS tagging_mode TEXT NOT NULL DEFAULT 'full'
    CHECK (tagging_mode IN ('full','team','player')),
  ADD COLUMN IF NOT EXISTS focus_team_id UUID REFERENCES public.teams(team_id),
  ADD COLUMN IF NOT EXISTS focus_player_id UUID REFERENCES public.players(player_id),
  ADD COLUMN IF NOT EXISTS player_project_id UUID;   -- FK to player_projects added in Phase 3

-- "Opponent" / "Teammate" stand-ins. Kept in events (as reaction players),
-- excluded from every report list, leaderboard and percentile pool.
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS players_placeholder_idx
  ON public.players (team_id) WHERE is_placeholder;

-- Existing one-team matches (e.g. MKS Podlasie) can be backfilled by hand (Phase 5 does this with a script):
-- UPDATE matches SET tagging_mode='team', focus_team_id='<team uuid>' WHERE match_id IN (...);
