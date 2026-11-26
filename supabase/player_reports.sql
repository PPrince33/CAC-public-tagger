-- ============================================================
-- Phase 4: Player reports (used by CAC-Match-Report /player routes)
-- Run AFTER player_projects.sql. Idempotent — safe to re-run.
-- ============================================================

-- ── Scout summary on the project (draft → approved) ──────────
ALTER TABLE public.player_projects
  ADD COLUMN IF NOT EXISTS scout_summary      TEXT,
  ADD COLUMN IF NOT EXISTS summary_approved   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMPTZ;

-- ── Optional physical / personal details ─────────────────────
-- Separate from players so it can be filled in later, field by field.
-- Every column is optional; the report hides whatever is empty.
CREATE TABLE IF NOT EXISTS public.player_profiles (
  player_id      UUID PRIMARY KEY REFERENCES public.players(player_id) ON DELETE CASCADE,
  date_of_birth  DATE,
  preferred_foot TEXT CHECK (preferred_foot IN ('Left','Right','Both')),
  height_cm      SMALLINT CHECK (height_cm BETWEEN 100 AND 230),
  weight_kg      SMALLINT CHECK (weight_kg BETWEEN 30 AND 150),
  nationality    TEXT,
  notes          TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

-- Personal data (often minors): no anon read. Logged-in staff can read and edit;
-- the public share link gets it through get_shared_player_project() only.
DROP POLICY IF EXISTS ppr_select ON public.player_profiles;
DROP POLICY IF EXISTS ppr_write  ON public.player_profiles;
CREATE POLICY ppr_select ON public.player_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY ppr_write  ON public.player_profiles FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ── Public share link ────────────────────────────────────────
-- Returns one project by its unguessable share_token: the player, the match
-- ids, the profile, and the scout summary only once it is approved.
CREATE OR REPLACE FUNCTION public.get_shared_player_project(token uuid)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'project_id',    p.project_id,
    'player_id',     p.player_id,
    'title',         p.title,
    'status',        p.status,
    'scout_summary', CASE WHEN p.summary_approved THEN p.scout_summary END,
    'match_ids',     COALESCE((SELECT json_agg(ppm.match_id) FROM player_project_matches ppm WHERE ppm.project_id = p.project_id), '[]'::json),
    'profile',       (SELECT row_to_json(pr) FROM player_profiles pr WHERE pr.player_id = p.player_id)
  )
  FROM player_projects p
  WHERE p.share_token = token;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_player_project(uuid) TO anon, authenticated;
