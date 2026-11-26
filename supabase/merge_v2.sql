-- ============================================================
-- Phase 5: safer merge_players / merge_teams
-- Replaces the versions in normalization.sql. Needed because Phases 2–4 added
-- references to players and teams (focus fields, projects, profiles) that the
-- old functions did not move, so deleting the source row would fail.
-- Run AFTER player_reports.sql. Idempotent — safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION merge_players(source_id UUID, target_id UUID)
RETURNS VOID AS $$
BEGIN
  IF source_id = target_id THEN RETURN; END IF;

  -- Events (raw and processed)
  UPDATE match_events SET player_id = target_id WHERE player_id = source_id;
  UPDATE match_events SET reaction_player_id = target_id WHERE reaction_player_id = source_id;
  UPDATE processed_match_events SET player_id = target_id WHERE player_id = source_id;
  UPDATE processed_match_events SET reaction_player_id = target_id WHERE reaction_player_id = source_id;

  -- Lineups: if both were in the same match, keep the target's row
  DELETE FROM lineups s
   WHERE s.player_id = source_id
     AND EXISTS (SELECT 1 FROM lineups t WHERE t.match_id = s.match_id AND t.player_id = target_id);
  UPDATE lineups SET player_id = target_id WHERE player_id = source_id;

  -- Phase 2–4 references
  UPDATE matches SET focus_player_id = target_id WHERE focus_player_id = source_id;
  UPDATE player_projects SET player_id = target_id WHERE player_id = source_id;

  -- Optional details: fill the target's empty fields from the source
  IF EXISTS (SELECT 1 FROM player_profiles WHERE player_id = source_id) THEN
    INSERT INTO player_profiles (player_id) VALUES (target_id) ON CONFLICT (player_id) DO NOTHING;
    UPDATE player_profiles t SET
      date_of_birth  = COALESCE(t.date_of_birth,  s.date_of_birth),
      preferred_foot = COALESCE(t.preferred_foot, s.preferred_foot),
      height_cm      = COALESCE(t.height_cm,      s.height_cm),
      weight_kg      = COALESCE(t.weight_kg,      s.weight_kg),
      nationality    = COALESCE(t.nationality,    s.nationality),
      notes          = COALESCE(t.notes,          s.notes),
      updated_at     = now()
    FROM player_profiles s
    WHERE t.player_id = target_id AND s.player_id = source_id;
    DELETE FROM player_profiles WHERE player_id = source_id;
  END IF;

  -- Keep a position if only the source had one
  UPDATE players t SET position = s.position
    FROM players s
   WHERE t.player_id = target_id AND s.player_id = source_id AND t.position IS NULL AND s.position IS NOT NULL;

  DELETE FROM players WHERE player_id = source_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION merge_teams(source_id UUID, target_id UUID)
RETURNS VOID AS $$
BEGIN
  IF source_id = target_id THEN RETURN; END IF;

  UPDATE matches SET home_team_id  = target_id WHERE home_team_id  = source_id;
  UPDATE matches SET away_team_id  = target_id WHERE away_team_id  = source_id;
  UPDATE matches SET focus_team_id = target_id WHERE focus_team_id = source_id;
  UPDATE lineups SET team_id = target_id WHERE team_id = source_id;
  UPDATE players SET team_id = target_id WHERE team_id = source_id;

  DELETE FROM teams WHERE team_id = source_id;
END;
$$ LANGUAGE plpgsql;
