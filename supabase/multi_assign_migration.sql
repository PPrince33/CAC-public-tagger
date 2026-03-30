-- ============================================================
-- Migration: Multi-Analyst Assignment
-- Replaces single assigned_to UUID with a junction table
-- ============================================================

-- 1. Create junction table
CREATE TABLE IF NOT EXISTS public.match_assignments (
    match_id UUID NOT NULL REFERENCES public.matches(match_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_assignments_user ON match_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_match_assignments_match ON match_assignments(match_id);

-- 2. Migrate existing assigned_to data into junction table
INSERT INTO match_assignments (match_id, user_id)
SELECT match_id, assigned_to
FROM matches
WHERE assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. RLS policies for match_assignments
ALTER TABLE match_assignments ENABLE ROW LEVEL SECURITY;

-- Admins and match creators can manage assignments
CREATE POLICY "assignments_select"
    ON match_assignments FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM matches WHERE matches.match_id = match_assignments.match_id AND matches.created_by = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'qc'))
    );

CREATE POLICY "assignments_insert"
    ON match_assignments FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM matches WHERE matches.match_id = match_assignments.match_id AND matches.created_by = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "assignments_delete"
    ON match_assignments FOR DELETE
    USING (
        EXISTS (SELECT 1 FROM matches WHERE matches.match_id = match_assignments.match_id AND matches.created_by = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 4. Update match SELECT policy to include junction table
DROP POLICY IF EXISTS "matches_select_own_or_assigned_or_admin" ON matches;
CREATE POLICY "matches_select_own_or_assigned_or_admin"
    ON matches FOR SELECT
    USING (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM match_assignments WHERE match_assignments.match_id = matches.match_id AND match_assignments.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'qc'))
    );

-- 5. Update match UPDATE policy to include junction table
DROP POLICY IF EXISTS "matches_update_own_or_assigned_or_admin" ON matches;
CREATE POLICY "matches_update_own_or_assigned_or_admin"
    ON matches FOR UPDATE
    USING (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM match_assignments WHERE match_assignments.match_id = matches.match_id AND match_assignments.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'qc'))
    );

-- 6. Drop the old column (run AFTER verifying migration works)
-- ALTER TABLE matches DROP COLUMN IF EXISTS assigned_to;
