-- Identity & tenancy: privileges, RLS policies, helper functions, triggers.
-- Rules: docs/ROLES-PERMISSIONS.md · Enforcement: docs/SECURITY.md
-- Tables were created with RLS already enabled (0000_identity.sql), so they
-- were never exposed without policies.

-- ---------------------------------------------------------------------------
-- Private schema for helpers (not exposed through the Supabase Data API).
-- ---------------------------------------------------------------------------
create schema if not exists app;
--> statement-breakpoint
revoke all on schema app from public;
--> statement-breakpoint
grant usage on schema app to authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Table privileges. Supabase grants ALL on new public tables to anon and
-- authenticated by default; RLS would still filter rows, but we also remove
-- privileges that no policy should ever need (defence in depth).
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.organizations, public.memberships from anon;
--> statement-breakpoint
revoke all on public.profiles, public.organizations, public.memberships from authenticated;
--> statement-breakpoint
grant select on public.profiles, public.organizations, public.memberships to authenticated;
--> statement-breakpoint
-- Only user-editable columns; id/created_at etc. can never be changed by users.
grant update (full_name, phone, locale, avatar_path) on public.profiles to authenticated;
--> statement-breakpoint
grant update (name, kind, country, timezone, currency, default_locale, week_start)
  on public.organizations to authenticated;
--> statement-breakpoint
-- Organizations and memberships are created only through app.create_organization
-- (and, from M3, invitation acceptance). No direct insert/delete privileges.

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function app.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
--> statement-breakpoint
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();
--> statement-breakpoint
create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function app.set_updated_at();
--> statement-breakpoint
create trigger memberships_set_updated_at before update on public.memberships
  for each row execute function app.set_updated_at();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Profile row for every new auth user.
-- ---------------------------------------------------------------------------
create function app.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120)
  );
  return new;
end;
$$;
--> statement-breakpoint
revoke all on function app.handle_new_user() from public;
--> statement-breakpoint
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- RLS helper: is the current user an ACTIVE member of the org (optionally
-- with one of the given roles)? SECURITY DEFINER so policies on memberships
-- can use it without recursive RLS evaluation.
-- ---------------------------------------------------------------------------
create function app.is_org_member(
  p_org_id uuid,
  p_roles public.member_role[] default null
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (p_roles is null or m.role = any (p_roles))
  );
$$;
--> statement-breakpoint
revoke all on function app.is_org_member(uuid, public.member_role[]) from public;
--> statement-breakpoint
grant execute on function app.is_org_member(uuid, public.member_role[]) to authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
-- profiles: read your own; owners/admins read profiles of their org's members.
-- (Teachers seeing teammates' names arrives in M3 via a narrow function.)
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
--> statement-breakpoint
create policy profiles_select_org_admin on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.user_id = profiles.id
        and app.is_org_member(m.org_id, '{owner,admin}')
    )
  );
--> statement-breakpoint
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
--> statement-breakpoint

-- organizations: active members read; only owners update settings.
create policy organizations_select_member on public.organizations
  for select to authenticated
  using (app.is_org_member(id));
--> statement-breakpoint
create policy organizations_update_owner on public.organizations
  for update to authenticated
  using (app.is_org_member(id, '{owner}'))
  with check (app.is_org_member(id, '{owner}'));
--> statement-breakpoint

-- memberships: read your own rows; owners/admins read their org's rows.
create policy memberships_select_self on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()));
--> statement-breakpoint
create policy memberships_select_org_admin on public.memberships
  for select to authenticated
  using (app.is_org_member(org_id, '{owner,admin}'));
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Every org keeps at least one active owner (PRD rule 11). Skipped when the
-- org itself is being deleted (cascade from organizations).
-- ---------------------------------------------------------------------------
create function app.guard_last_owner() returns trigger
language plpgsql
security definer -- must see every row regardless of the caller's RLS
set search_path = ''
as $$
begin
  if old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active')
     and exists (select 1 from public.organizations o where o.id = old.org_id)
     and not exists (
       select 1 from public.memberships m
       where m.org_id = old.org_id
         and m.id <> old.id
         and m.role = 'owner'
         and m.status = 'active'
     )
  then
    raise exception 'An organisation must keep at least one active owner'
      using errcode = 'P0001', hint = 'last_owner';
  end if;
  return coalesce(new, old);
end;
$$;
--> statement-breakpoint
revoke all on function app.guard_last_owner() from public;
--> statement-breakpoint
create trigger memberships_guard_last_owner
  before update or delete on public.memberships
  for each row execute function app.guard_last_owner();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Org creation: inserts the org and the caller's owner membership atomically.
-- Runs as definer because the caller is not yet a member (no insert policy
-- exists for users). Validates inputs again in SQL; the app validates first.
-- ---------------------------------------------------------------------------
create function app.create_organization(
  p_name text,
  p_slug text,
  p_kind public.org_kind,
  p_country text,
  p_timezone text,
  p_currency text,
  p_default_locale text,
  p_week_start smallint
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown timezone' using errcode = '22023', hint = 'timezone';
  end if;

  -- Abuse limit: a person rarely needs more than a handful of workspaces.
  if (select count(*) from public.organizations o where o.created_by = v_user) >= 10 then
    raise exception 'Organisation limit reached' using errcode = 'P0001', hint = 'org_limit';
  end if;

  insert into public.organizations
    (name, slug, kind, country, timezone, currency, default_locale, week_start, created_by)
  values
    (btrim(p_name), p_slug, p_kind, p_country, p_timezone, p_currency, p_default_locale, p_week_start, v_user)
  returning id into v_org;

  insert into public.memberships (org_id, user_id, role, status)
  values (v_org, v_user, 'owner', 'active');

  return v_org;
end;
$$;
--> statement-breakpoint
revoke all on function app.create_organization(text, text, public.org_kind, text, text, text, text, smallint) from public;
--> statement-breakpoint
grant execute on function app.create_organization(text, text, public.org_kind, text, text, text, text, smallint) to authenticated;
