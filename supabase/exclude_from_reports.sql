-- Hide a match from player reports and the /players list without deleting
-- anything. Its raw and processed events stay; the report app skips it.
-- Idempotent — safe to re-run.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS exclude_from_reports BOOLEAN NOT NULL DEFAULT false;

-- Test matches (9 and 26 tagged events)
UPDATE public.matches SET exclude_from_reports = true
 WHERE match_id IN (
   'db5c0b07-2904-4f4e-bcb3-45d4454cca8d',  -- PSG v Inter (2026-03-25)
   '5fb0ab89-1315-4e26-9542-1ee022d3733c'   -- VPS v AC Oulu (2026-06-23)
 );

-- To show a match again:
-- UPDATE public.matches SET exclude_from_reports = false WHERE match_id = '<id>';
