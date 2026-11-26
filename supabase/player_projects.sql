-- ============================================================
-- Phase 3: Player Projects
-- A project bundles one player's matches into one report order.
-- Run AFTER tagging_modes.sql. Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.player_projects (
  project_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID NOT NULL REFERENCES public.players(player_id),
  title       TEXT,
  client_type TEXT CHECK (client_type IN ('player','club','academy')),
  status      TEXT NOT NULL DEFAULT 'tagging' CHECK (status IN ('tagging','ready','delivered')),
  share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,   -- Phase 4 public link
  created_by  UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.player_project_matches (
  project_id UUID REFERENCES public.player_projects(project_id) ON DELETE CASCADE,
  match_id   UUID REFERENCES public.matches(match_id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, match_id)
);
CREATE INDEX IF NOT EXISTS ppm_match_idx ON public.player_project_matches (match_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_player_project_fk') THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_player_project_fk
      FOREIGN KEY (player_project_id) REFERENCES public.player_projects(project_id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Helper: can the caller see this project? ─────────────────
-- creator, super_admin, or assigned analyst on any of its matches
CREATE OR REPLACE FUNCTION public.can_see_player_project(pid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_super_admin()
      OR EXISTS (SELECT 1 FROM player_projects p WHERE p.project_id = pid AND p.created_by = auth.uid())
      OR EXISTS (
           SELECT 1 FROM player_project_matches ppm
             JOIN match_assignments ma ON ma.match_id = ppm.match_id
            WHERE ppm.project_id = pid AND ma.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.owns_player_project(pid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_super_admin()
      OR EXISTS (SELECT 1 FROM player_projects p WHERE p.project_id = pid AND p.created_by = auth.uid());
$$;

ALTER TABLE public.player_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_project_matches ENABLE ROW LEVEL SECURITY;

-- ── PLAYER_PROJECTS ──────────────────────────────────────────
DROP POLICY IF EXISTS pp_select ON public.player_projects;
DROP POLICY IF EXISTS pp_insert ON public.player_projects;
DROP POLICY IF EXISTS pp_update ON public.player_projects;
DROP POLICY IF EXISTS pp_delete ON public.player_projects;

CREATE POLICY pp_select ON public.player_projects FOR SELECT
  USING (can_see_player_project(project_id));

CREATE POLICY pp_insert ON public.player_projects FOR INSERT
  WITH CHECK (is_super_admin() OR created_by = auth.uid());

CREATE POLICY pp_update ON public.player_projects FOR UPDATE
  USING (owns_player_project(project_id))
  WITH CHECK (owns_player_project(project_id));

CREATE POLICY pp_delete ON public.player_projects FOR DELETE
  USING (owns_player_project(project_id));

-- ── PLAYER_PROJECT_MATCHES ───────────────────────────────────
DROP POLICY IF EXISTS ppm_select ON public.player_project_matches;
DROP POLICY IF EXISTS ppm_insert ON public.player_project_matches;
DROP POLICY IF EXISTS ppm_delete ON public.player_project_matches;

CREATE POLICY ppm_select ON public.player_project_matches FOR SELECT
  USING (can_see_player_project(project_id));

CREATE POLICY ppm_insert ON public.player_project_matches FOR INSERT
  WITH CHECK (owns_player_project(project_id));

CREATE POLICY ppm_delete ON public.player_project_matches FOR DELETE
  USING (owns_player_project(project_id));

-- No public/anon read on these tables: the Phase 4 share link will read a
-- project through a token-checked function instead.

-- ── Status: 'ready' once every match has processed events ────
-- SECURITY DEFINER so an assigned analyst (not the creator) can trigger it
-- from the tagger after Finish & Process. Never downgrades 'delivered'.
CREATE OR REPLACE FUNCTION public.refresh_player_project_status(pid uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total int; done int; cur text; nxt text;
BEGIN
  IF NOT can_see_player_project(pid) THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT status INTO cur FROM player_projects WHERE project_id = pid;
  IF cur IS NULL OR cur = 'delivered' THEN RETURN cur; END IF;

  SELECT count(*),
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM processed_match_events e WHERE e.match_id = ppm.match_id))
    INTO total, done
    FROM player_project_matches ppm WHERE ppm.project_id = pid;

  nxt := CASE WHEN total > 0 AND done = total THEN 'ready' ELSE 'tagging' END;
  IF nxt <> cur THEN UPDATE player_projects SET status = nxt WHERE project_id = pid; END IF;
  RETURN nxt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_player_project_status(uuid) TO authenticated;
