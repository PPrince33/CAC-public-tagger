-- ============================================================
-- OPEN ACCESS RLS MIGRATION
-- Replaces academy-scoped policies with open access for all
-- authenticated users. Run AFTER multi_academy_rls.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- HELPER: Check if user is authenticated
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;


-- ============================================================
-- 1. PROFILES — anyone can see all profiles, update own
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_select_open" ON profiles;
CREATE POLICY "profiles_select_open" ON profiles FOR SELECT
    USING (is_authenticated());

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
DROP POLICY IF EXISTS "profiles_update_open" ON profiles;
CREATE POLICY "profiles_update_open" ON profiles FOR UPDATE
    USING (
        id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'super_admin'))
    );


-- ============================================================
-- 2. TEAMS — any authenticated user can CRUD
-- ============================================================
DROP POLICY IF EXISTS "teams_select_scoped" ON teams;
DROP POLICY IF EXISTS "teams_select_all" ON teams;
DROP POLICY IF EXISTS "teams_select_open" ON teams;
CREATE POLICY "teams_select_open" ON teams FOR SELECT
    USING (is_authenticated());

DROP POLICY IF EXISTS "teams_insert_scoped" ON teams;
DROP POLICY IF EXISTS "teams_insert_auth" ON teams;
DROP POLICY IF EXISTS "teams_insert_open" ON teams;
CREATE POLICY "teams_insert_open" ON teams FOR INSERT
    WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "teams_update_scoped" ON teams;
DROP POLICY IF EXISTS "teams_update_creator_or_admin" ON teams;
DROP POLICY IF EXISTS "teams_update_open" ON teams;
CREATE POLICY "teams_update_open" ON teams FOR UPDATE
    USING (is_authenticated());

DROP POLICY IF EXISTS "teams_delete_scoped" ON teams;
DROP POLICY IF EXISTS "teams_delete_open" ON teams;
CREATE POLICY "teams_delete_open" ON teams FOR DELETE
    USING (is_authenticated());


-- ============================================================
-- 3. PLAYERS — any authenticated user can CRUD
-- ============================================================
DROP POLICY IF EXISTS "players_select_scoped" ON players;
DROP POLICY IF EXISTS "players_select_all" ON players;
DROP POLICY IF EXISTS "players_select_open" ON players;
CREATE POLICY "players_select_open" ON players FOR SELECT
    USING (is_authenticated());

DROP POLICY IF EXISTS "players_insert_scoped" ON players;
DROP POLICY IF EXISTS "players_insert_auth" ON players;
DROP POLICY IF EXISTS "players_insert_open" ON players;
CREATE POLICY "players_insert_open" ON players FOR INSERT
    WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "players_update_scoped" ON players;
DROP POLICY IF EXISTS "players_update_admin" ON players;
DROP POLICY IF EXISTS "players_update_open" ON players;
CREATE POLICY "players_update_open" ON players FOR UPDATE
    USING (is_authenticated());

DROP POLICY IF EXISTS "players_delete_scoped" ON players;
DROP POLICY IF EXISTS "players_delete_open" ON players;
CREATE POLICY "players_delete_open" ON players FOR DELETE
    USING (is_authenticated());


-- ============================================================
-- 4. MATCHES — any authenticated user can CRUD
-- ============================================================
DROP POLICY IF EXISTS "matches_select_scoped" ON matches;
DROP POLICY IF EXISTS "matches_select_own_or_admin" ON matches;
DROP POLICY IF EXISTS "matches_select_own_or_assigned_or_admin" ON matches;
DROP POLICY IF EXISTS "matches_select_open" ON matches;
CREATE POLICY "matches_select_open" ON matches FOR SELECT
    USING (is_authenticated());

DROP POLICY IF EXISTS "matches_insert_scoped" ON matches;
DROP POLICY IF EXISTS "matches_insert_own" ON matches;
DROP POLICY IF EXISTS "matches_insert_open" ON matches;
CREATE POLICY "matches_insert_open" ON matches FOR INSERT
    WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "matches_update_scoped" ON matches;
DROP POLICY IF EXISTS "matches_update_own_or_admin" ON matches;
DROP POLICY IF EXISTS "matches_update_own_or_assigned_or_admin" ON matches;
DROP POLICY IF EXISTS "matches_update_open" ON matches;
CREATE POLICY "matches_update_open" ON matches FOR UPDATE
    USING (is_authenticated());

DROP POLICY IF EXISTS "matches_delete_scoped" ON matches;
DROP POLICY IF EXISTS "matches_delete_own_or_admin" ON matches;
DROP POLICY IF EXISTS "matches_delete_open" ON matches;
CREATE POLICY "matches_delete_open" ON matches FOR DELETE
    USING (is_authenticated());


-- ============================================================
-- 5. MATCH_EVENTS — any authenticated user can CRUD
-- ============================================================
DROP POLICY IF EXISTS "events_select_scoped" ON match_events;
DROP POLICY IF EXISTS "events_select_match_owner_or_admin" ON match_events;
DROP POLICY IF EXISTS "events_select_open" ON match_events;
CREATE POLICY "events_select_open" ON match_events FOR SELECT
    USING (is_authenticated());

DROP POLICY IF EXISTS "events_insert_scoped" ON match_events;
DROP POLICY IF EXISTS "events_insert_match_owner" ON match_events;
DROP POLICY IF EXISTS "events_insert_open" ON match_events;
CREATE POLICY "events_insert_open" ON match_events FOR INSERT
    WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "events_update_scoped" ON match_events;
DROP POLICY IF EXISTS "events_update_match_owner_or_admin" ON match_events;
DROP POLICY IF EXISTS "events_update_open" ON match_events;
CREATE POLICY "events_update_open" ON match_events FOR UPDATE
    USING (is_authenticated());

DROP POLICY IF EXISTS "events_delete_scoped" ON match_events;
DROP POLICY IF EXISTS "events_delete_match_owner_or_admin" ON match_events;
DROP POLICY IF EXISTS "events_delete_open" ON match_events;
CREATE POLICY "events_delete_open" ON match_events FOR DELETE
    USING (is_authenticated());


-- ============================================================
-- 6. PROCESSED_MATCH_EVENTS — any authenticated user can CRUD
-- ============================================================
DROP POLICY IF EXISTS "processed_select_scoped" ON processed_match_events;
DROP POLICY IF EXISTS "processed_select" ON processed_match_events;
DROP POLICY IF EXISTS "processed_select_open" ON processed_match_events;
CREATE POLICY "processed_select_open" ON processed_match_events FOR SELECT
    USING (is_authenticated());

DROP POLICY IF EXISTS "processed_insert_scoped" ON processed_match_events;
DROP POLICY IF EXISTS "processed_insert" ON processed_match_events;
DROP POLICY IF EXISTS "processed_insert_open" ON processed_match_events;
CREATE POLICY "processed_insert_open" ON processed_match_events FOR INSERT
    WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "processed_delete_scoped" ON processed_match_events;
DROP POLICY IF EXISTS "processed_delete" ON processed_match_events;
DROP POLICY IF EXISTS "processed_delete_open" ON processed_match_events;
CREATE POLICY "processed_delete_open" ON processed_match_events FOR DELETE
    USING (is_authenticated());


-- ============================================================
-- 7. LINEUPS — any authenticated user can CRUD
-- ============================================================
DROP POLICY IF EXISTS "lineups_select_scoped" ON lineups;
DROP POLICY IF EXISTS "lineups_select" ON lineups;
DROP POLICY IF EXISTS "lineups_select_open" ON lineups;
CREATE POLICY "lineups_select_open" ON lineups FOR SELECT
    USING (is_authenticated());

DROP POLICY IF EXISTS "lineups_insert_scoped" ON lineups;
DROP POLICY IF EXISTS "lineups_insert" ON lineups;
DROP POLICY IF EXISTS "lineups_insert_open" ON lineups;
CREATE POLICY "lineups_insert_open" ON lineups FOR INSERT
    WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "lineups_update_scoped" ON lineups;
DROP POLICY IF EXISTS "lineups_update_open" ON lineups;
CREATE POLICY "lineups_update_open" ON lineups FOR UPDATE
    USING (is_authenticated());

DROP POLICY IF EXISTS "lineups_delete_scoped" ON lineups;
DROP POLICY IF EXISTS "lineups_delete_open" ON lineups;
CREATE POLICY "lineups_delete_open" ON lineups FOR DELETE
    USING (is_authenticated());


-- ============================================================
-- 8. TOURNAMENTS — any authenticated user can CRUD
-- ============================================================
DROP POLICY IF EXISTS "tournaments_select" ON tournaments;
DROP POLICY IF EXISTS "tournaments_select_open" ON tournaments;
CREATE POLICY "tournaments_select_open" ON tournaments FOR SELECT
    USING (is_authenticated());

DROP POLICY IF EXISTS "tournaments_insert" ON tournaments;
DROP POLICY IF EXISTS "tournaments_insert_open" ON tournaments;
CREATE POLICY "tournaments_insert_open" ON tournaments FOR INSERT
    WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "tournaments_update" ON tournaments;
DROP POLICY IF EXISTS "tournaments_update_open" ON tournaments;
CREATE POLICY "tournaments_update_open" ON tournaments FOR UPDATE
    USING (is_authenticated());

DROP POLICY IF EXISTS "tournaments_delete" ON tournaments;
DROP POLICY IF EXISTS "tournaments_delete_open" ON tournaments;
CREATE POLICY "tournaments_delete_open" ON tournaments FOR DELETE
    USING (is_authenticated());


-- ============================================================
-- 9. MATCH_ASSIGNMENTS — any authenticated user can CRUD
-- ============================================================
DROP POLICY IF EXISTS "match_assignments_select" ON match_assignments;
DROP POLICY IF EXISTS "match_assignments_select_open" ON match_assignments;
CREATE POLICY "match_assignments_select_open" ON match_assignments FOR SELECT
    USING (is_authenticated());

DROP POLICY IF EXISTS "match_assignments_insert" ON match_assignments;
DROP POLICY IF EXISTS "match_assignments_insert_open" ON match_assignments;
CREATE POLICY "match_assignments_insert_open" ON match_assignments FOR INSERT
    WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "match_assignments_delete" ON match_assignments;
DROP POLICY IF EXISTS "match_assignments_delete_open" ON match_assignments;
CREATE POLICY "match_assignments_delete_open" ON match_assignments FOR DELETE
    USING (is_authenticated());


-- ============================================================
-- 10. ACADEMIES — keep readable but not required
-- ============================================================
DROP POLICY IF EXISTS "academies_select" ON academies;
DROP POLICY IF EXISTS "academies_insert_admin" ON academies;
DROP POLICY IF EXISTS "academies_select_open" ON academies;
CREATE POLICY "academies_select_open" ON academies FOR SELECT
    USING (is_authenticated());

DROP POLICY IF EXISTS "academies_insert" ON academies;
DROP POLICY IF EXISTS "academies_insert_open" ON academies;
CREATE POLICY "academies_insert_open" ON academies FOR INSERT
    WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "academies_update" ON academies;
DROP POLICY IF EXISTS "academies_update_open" ON academies;
CREATE POLICY "academies_update_open" ON academies FOR UPDATE
    USING (is_authenticated());


-- ============================================================
-- 11. ACADEMY_MEMBERS — keep readable
-- ============================================================
DROP POLICY IF EXISTS "academy_members_select" ON academy_members;
DROP POLICY IF EXISTS "academy_members_select_open" ON academy_members;
CREATE POLICY "academy_members_select_open" ON academy_members FOR SELECT
    USING (is_authenticated());

DROP POLICY IF EXISTS "academy_members_insert" ON academy_members;
DROP POLICY IF EXISTS "academy_members_insert_open" ON academy_members;
CREATE POLICY "academy_members_insert_open" ON academy_members FOR INSERT
    WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "academy_members_update" ON academy_members;
DROP POLICY IF EXISTS "academy_members_update_open" ON academy_members;
CREATE POLICY "academy_members_update_open" ON academy_members FOR UPDATE
    USING (is_authenticated());

DROP POLICY IF EXISTS "academy_members_delete" ON academy_members;
DROP POLICY IF EXISTS "academy_members_delete_open" ON academy_members;
CREATE POLICY "academy_members_delete_open" ON academy_members FOR DELETE
    USING (is_authenticated());


-- ============================================================
-- 12. USER_ACCESS — keep readable
-- ============================================================
DROP POLICY IF EXISTS "user_access_select" ON user_access;
DROP POLICY IF EXISTS "user_access_select_open" ON user_access;
CREATE POLICY "user_access_select_open" ON user_access FOR SELECT
    USING (is_authenticated());

DROP POLICY IF EXISTS "user_access_insert" ON user_access;
DROP POLICY IF EXISTS "user_access_insert_open" ON user_access;
CREATE POLICY "user_access_insert_open" ON user_access FOR INSERT
    WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "user_access_delete" ON user_access;
DROP POLICY IF EXISTS "user_access_delete_open" ON user_access;
CREATE POLICY "user_access_delete_open" ON user_access FOR DELETE
    USING (is_authenticated());


-- ============================================================
-- 13. TEAM_STAFF — keep readable
-- ============================================================
DROP POLICY IF EXISTS "team_staff_select" ON team_staff;
DROP POLICY IF EXISTS "team_staff_select_open" ON team_staff;
CREATE POLICY "team_staff_select_open" ON team_staff FOR SELECT
    USING (is_authenticated());

DROP POLICY IF EXISTS "team_staff_insert" ON team_staff;
DROP POLICY IF EXISTS "team_staff_insert_open" ON team_staff;
CREATE POLICY "team_staff_insert_open" ON team_staff FOR INSERT
    WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "team_staff_delete" ON team_staff;
DROP POLICY IF EXISTS "team_staff_delete_open" ON team_staff;
CREATE POLICY "team_staff_delete_open" ON team_staff FOR DELETE
    USING (is_authenticated());
