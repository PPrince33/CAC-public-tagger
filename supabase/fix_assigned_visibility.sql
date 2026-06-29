-- ============================================================
-- REMOVE ACADEMY SCOPING — simple ownership + assignment model
--
-- Rules:
--   • super_admin can do anything
--   • analyst can see/edit a match if:
--       - they created it, OR
--       - they are assigned to it (via match_assignments)
--   • only the match creator (or super_admin) can assign analysts
--
-- Run this in Supabase Dashboard → SQL Editor.
-- Idempotent — safe to re-run.
-- ============================================================

-- ── Helper: is the caller assigned to this match? ────────────
create or replace function public.is_assigned_to_match(mid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.match_assignments
     where match_id = mid
       and user_id  = auth.uid()
  );
$$;

-- ── MATCHES ──────────────────────────────────────────────────
drop policy if exists matches_select on public.matches;
drop policy if exists matches_insert on public.matches;
drop policy if exists matches_update on public.matches;
drop policy if exists matches_delete on public.matches;

create policy matches_select on public.matches for select
  using (
    is_super_admin()
    or created_by = auth.uid()
    or is_assigned_to_match(match_id)
  );

create policy matches_insert on public.matches for insert
  with check (
    is_super_admin()
    or created_by = auth.uid()
  );

create policy matches_update on public.matches for update
  using (
    is_super_admin()
    or created_by = auth.uid()
    or is_assigned_to_match(match_id)
  )
  with check (
    is_super_admin()
    or created_by = auth.uid()
    or is_assigned_to_match(match_id)
  );

create policy matches_delete on public.matches for delete
  using (
    is_super_admin()
    or created_by = auth.uid()
  );


-- ── MATCH_EVENTS ─────────────────────────────────────────────
drop policy if exists match_events_select on public.match_events;
drop policy if exists match_events_insert on public.match_events;
drop policy if exists match_events_update on public.match_events;
drop policy if exists match_events_delete on public.match_events;

create policy match_events_select on public.match_events for select
  using (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = match_events.match_id
         and (m.created_by = auth.uid() or is_assigned_to_match(m.match_id))
    )
  );

create policy match_events_insert on public.match_events for insert
  with check (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = match_events.match_id
         and (m.created_by = auth.uid() or is_assigned_to_match(m.match_id))
    )
  );

create policy match_events_update on public.match_events for update
  using (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = match_events.match_id
         and (m.created_by = auth.uid() or is_assigned_to_match(m.match_id))
    )
  );

create policy match_events_delete on public.match_events for delete
  using (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = match_events.match_id
         and (m.created_by = auth.uid() or is_assigned_to_match(m.match_id))
    )
  );


-- ── PROCESSED_MATCH_EVENTS ───────────────────────────────────
drop policy if exists pme_select on public.processed_match_events;
drop policy if exists pme_insert on public.processed_match_events;
drop policy if exists pme_update on public.processed_match_events;
drop policy if exists pme_delete on public.processed_match_events;

create policy pme_select on public.processed_match_events for select
  using (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = processed_match_events.match_id
         and (m.created_by = auth.uid() or is_assigned_to_match(m.match_id))
    )
  );

create policy pme_insert on public.processed_match_events for insert
  with check (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = processed_match_events.match_id
         and (m.created_by = auth.uid() or is_assigned_to_match(m.match_id))
    )
  );

create policy pme_update on public.processed_match_events for update
  using (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = processed_match_events.match_id
         and (m.created_by = auth.uid() or is_assigned_to_match(m.match_id))
    )
  );

create policy pme_delete on public.processed_match_events for delete
  using (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = processed_match_events.match_id
         and (m.created_by = auth.uid() or is_assigned_to_match(m.match_id))
    )
  );


-- ── LINEUPS ───────────────────────────────────────────────────
drop policy if exists lineups_select on public.lineups;
drop policy if exists lineups_insert on public.lineups;
drop policy if exists lineups_update on public.lineups;
drop policy if exists lineups_delete on public.lineups;

create policy lineups_select on public.lineups for select
  using (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = lineups.match_id
         and (m.created_by = auth.uid() or is_assigned_to_match(m.match_id))
    )
  );

create policy lineups_insert on public.lineups for insert
  with check (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = lineups.match_id
         and (m.created_by = auth.uid() or is_assigned_to_match(m.match_id))
    )
  );

create policy lineups_update on public.lineups for update
  using (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = lineups.match_id
         and (m.created_by = auth.uid() or is_assigned_to_match(m.match_id))
    )
  );

create policy lineups_delete on public.lineups for delete
  using (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = lineups.match_id
         and (m.created_by = auth.uid() or is_assigned_to_match(m.match_id))
    )
  );


-- ── MATCH_ASSIGNMENTS ────────────────────────────────────────
-- Anyone authenticated can READ assignments (needed to build
-- "assigned" chips, dropdowns, and the creator's view).
-- Only the match creator or super_admin can INSERT/DELETE.
drop policy if exists ma_select on public.match_assignments;
drop policy if exists ma_insert on public.match_assignments;
drop policy if exists ma_delete on public.match_assignments;

create policy ma_select on public.match_assignments for select
  using (auth.uid() is not null);

create policy ma_insert on public.match_assignments for insert
  with check (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = match_assignments.match_id
         and m.created_by = auth.uid()
    )
  );

create policy ma_delete on public.match_assignments for delete
  using (
    is_super_admin()
    or exists (
      select 1 from public.matches m
       where m.match_id = match_assignments.match_id
         and m.created_by = auth.uid()
    )
  );


-- ── TEAMS / PLAYERS / TOURNAMENTS — make globally readable/writable ──
-- No academy scoping: any authenticated analyst can create and use these.
drop policy if exists teams_select on public.teams;
drop policy if exists teams_insert on public.teams;
drop policy if exists teams_update on public.teams;
drop policy if exists teams_delete on public.teams;
create policy teams_select on public.teams for select using (auth.uid() is not null);
create policy teams_insert on public.teams for insert with check (auth.uid() is not null);
create policy teams_update on public.teams for update using (auth.uid() is not null);
create policy teams_delete on public.teams for delete using (is_super_admin());

drop policy if exists players_select on public.players;
drop policy if exists players_insert on public.players;
drop policy if exists players_update on public.players;
drop policy if exists players_delete on public.players;
create policy players_select on public.players for select using (auth.uid() is not null);
create policy players_insert on public.players for insert with check (auth.uid() is not null);
create policy players_update on public.players for update using (auth.uid() is not null);
create policy players_delete on public.players for delete using (is_super_admin());

drop policy if exists tournaments_select on public.tournaments;
drop policy if exists tournaments_insert on public.tournaments;
drop policy if exists tournaments_update on public.tournaments;
drop policy if exists tournaments_delete on public.tournaments;
create policy tournaments_select on public.tournaments for select using (auth.uid() is not null);
create policy tournaments_insert on public.tournaments for insert with check (auth.uid() is not null);
create policy tournaments_update on public.tournaments for update using (auth.uid() is not null);
create policy tournaments_delete on public.tournaments for delete using (is_super_admin());


-- ── PROFILES — any authenticated user can read all profiles ──
-- (needed so creator dropdowns can list other analysts)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (auth.uid() is not null);


-- ── Drop academy-related check constraint on profiles ───────
-- (so analyst accounts don't need an academy_id set)
alter table public.profiles drop constraint if exists profiles_role_academy_check;

-- ── Drop the trigger that auto-stamps academy_id on new matches ──
-- (was created by simplify_roles_migration.sql; we no longer need it)
drop trigger  if exists trg_matches_set_academy_id on public.matches;
drop function if exists public.matches_set_academy_id();


-- ── VERIFY ───────────────────────────────────────────────────
-- Run these after applying to sanity check:
--   select policyname, cmd from pg_policies where tablename = 'matches';
--   select id, username, role, academy_id from public.profiles;
