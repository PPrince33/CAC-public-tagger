-- Phase 1: lets the tagger mark a match as processed without claiming QC is done.
-- Set by src/lib/finalizeMatch.js every time a match is processed (tagger, QC or backfill).
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
