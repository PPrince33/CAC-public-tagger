-- ============================================================
-- Preserve original team direction on processed_match_events.
--
-- Before this change, processed_match_events.team_direction was
-- always 'L2R' (coords were mirrored so analytics could assume a
-- single attack direction). The raw direction was lost.
--
-- This adds `original_team_direction` so analytics can reconstruct
-- which way each team was actually attacking when the event was
-- logged, while `team_direction` remains the normalized 'L2R'.
--
-- Idempotent — safe to re-run.
-- ============================================================

alter table public.processed_match_events
  add column if not exists original_team_direction public.team_direction;

-- Backfill from match_events for already-processed rows
update public.processed_match_events p
   set original_team_direction = e.team_direction
  from public.match_events e
 where p.match_event_id = e.match_event_id
   and p.original_team_direction is null;
