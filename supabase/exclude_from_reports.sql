-- Hide a match from the public reports (match report list + page, player
-- reports, /players, percentiles) without deleting anything. Raw and
-- processed events stay. Toggled from Admin Portal → Matches.
-- Idempotent — safe to re-run.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS exclude_from_reports BOOLEAN NOT NULL DEFAULT false;
