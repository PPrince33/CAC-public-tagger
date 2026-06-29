-- Migration: Add goalkeeper position columns for shot events
-- Run this in your Supabase SQL editor.

ALTER TABLE match_events
    ADD COLUMN IF NOT EXISTS gk_x NUMERIC,
    ADD COLUMN IF NOT EXISTS gk_y NUMERIC;

ALTER TABLE processed_match_events
    ADD COLUMN IF NOT EXISTS gk_x NUMERIC,
    ADD COLUMN IF NOT EXISTS gk_y NUMERIC;

COMMENT ON COLUMN match_events.gk_x IS 'Goalkeeper X coordinate at moment of shot (pitch units)';
COMMENT ON COLUMN match_events.gk_y IS 'Goalkeeper Y coordinate at moment of shot (pitch units)';
COMMENT ON COLUMN processed_match_events.gk_x IS 'Goalkeeper X coordinate (normalised L2R)';
COMMENT ON COLUMN processed_match_events.gk_y IS 'Goalkeeper Y coordinate (normalised L2R)';
