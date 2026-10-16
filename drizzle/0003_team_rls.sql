-- Team management: invitations, role/status changes, audit log.
-- Rules: docs/ROLES-PERMISSIONS.md · Enforcement: docs/SECURITY.md (ADR-013 pattern)
-- All writes go through SECURITY DEFINER functions that check the caller's
-- role, make the change and write the audit entry in ONE transaction.

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on public.invitations, public.audit_log from anon, authenticated;
--> statement-breakpoint
-- token_hash is never readable by users, even owners.
grant select (id, org_id, email, role, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at)
  on public.invitations to authenticated;
--> statement-breakpoint
grant select on public.audit_log to authenticated;
--> statement-breakpoint
-- The invitation preview is readable by anyone holding a valid link.
grant usage on schema app to anon;
--> statement-breakpoint

create policy invitations_select_org_admin on public.invitations
  for select to authenticated
  using (app.is_org_member(org_id, '{owner,admin}'));
--> statement-breakpoint
create policy audit_log_select_org_admin on public.audit_log
  for select to authenticated
  using (app.is_org_member(org_id, '{owner,admin}'));
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Internal helpers (not executable by users)
-- ---------------------------------------------------------------------------
create function app.write_audit(
  p_org_id uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_org_id, (select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;
--> statement-breakpoint
revoke all on function app.write_audit(uuid, text, text, uuid, jsonb) from public;
--> statement-breakpoint

create function app.current_email() returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
$$;
--> statement-breakpoint
revoke all on function app.current_email() from public;
--> statement-breakpoint

create function app.mask_email(p_email text) returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when position('@' in p_email) < 2 then '***'
    else left(p_email, 1) || '***' || substring(p_email from position('@' in p_email))
  end;
$$;
--> statement-breakpoint

create function app.caller_role(p_org_id uuid) returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.memberships m
  where m.org_id = p_org_id and m.user_id = (select auth.uid()) and m.status = 'active';
$$;
--> statement-breakpoint
revoke all on function app.caller_role(uuid) from public;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
-- Owners invite admins or teachers; admins invite teachers only.
create function app.create_invitation(
  p_org_id uuid, p_email text, p_role public.member_role, p_token_hash text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller public.member_role := app.caller_role(p_org_id);
  v_email text := lower(btrim(p_email));
  v_id uuid;
begin
  if v_caller is null or v_caller = 'teacher' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_role = 'owner' or (v_caller = 'admin' and p_role <> 'teacher') then
    raise exception 'Role not allowed' using errcode = '42501', hint = 'role';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then
    raise exception 'Invalid email' using errcode = '22023', hint = 'email';
  end if;
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.org_id = p_org_id and m.status = 'active' and lower(u.email) = v_email
  ) then
    raise exception 'Already a member' using errcode = 'P0001', hint = 'already_member';
  end if;
  if (select count(*) from public.invitations i
      where i.org_id = p_org_id and i.created_at > now() - interval '1 day') >= 50 then
    raise exception 'Too many invitations' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  -- A new invite replaces any pending one for the same person (old link stops working).
  update public.invitations set revoked_at = now()
  where org_id = p_org_id and email = v_email and accepted_at is null and revoked_at is null;

  insert into public.invitations (org_id, email, role, token_hash, invited_by, expires_at)
  values (p_org_id, v_email, p_role, p_token_hash, (select auth.uid()), now() + interval '7 days')
  returning id into v_id;

  perform app.write_audit(p_org_id, 'invitation.created', 'invitation', v_id,
    jsonb_build_object('role', p_role));
  return v_id;
end;
$$;
--> statement-breakpoint

create function app.revoke_invitation(p_invitation_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_caller public.member_role;
begin
  select * into v_inv from public.invitations where id = p_invitation_id for update;
  v_caller := case when v_inv.id is null then null else app.caller_role(v_inv.org_id) end;
  if v_caller is null or v_caller = 'teacher' or (v_caller = 'admin' and v_inv.role <> 'teacher') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_inv.accepted_at is not null or v_inv.revoked_at is not null then
    return; -- already final
  end if;
  update public.invitations set revoked_at = now() where id = p_invitation_id;
  perform app.write_audit(v_inv.org_id, 'invitation.revoked', 'invitation', v_inv.id,
    jsonb_build_object('role', v_inv.role));
end;
$$;
--> statement-breakpoint

-- What a link holder may see: org name, role, masked email, status. Nothing else.
create function app.invitation_preview(p_token_hash text)
returns table (org_name text, role public.member_role, email_masked text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, i.role, app.mask_email(i.email),
    case
      when i.revoked_at is not null then 'revoked'
      when i.accepted_at is not null then 'used'
      when i.expires_at <= now() then 'expired'
      else 'pending'
    end
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  where i.token_hash = p_token_hash and o.archived_at is null;
$$;
--> statement-breakpoint

-- Pending invitations addressed to the caller's verified email (no link needed).
create function app.my_pending_invitations()
returns table (id uuid, org_name text, role public.member_role, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, o.name, i.role, i.expires_at
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  where i.email = app.current_email()
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    and o.archived_at is null
  order by i.created_at desc;
$$;
--> statement-breakpoint

-- Accept by link token OR by id (from my_pending_invitations). Either way the
-- caller's VERIFIED email must equal the invited email.
create function app.accept_invitation(
  p_token_hash text default null, p_invitation_id uuid default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := app.current_email();
  v_inv public.invitations;
  v_member public.memberships;
  v_slug text;
begin
  if v_user is null or v_email is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_inv from public.invitations
  where (p_token_hash is not null and token_hash = p_token_hash)
     or (p_token_hash is null and id = p_invitation_id)
  for update;

  if v_inv.id is null or v_inv.revoked_at is not null or v_inv.accepted_at is not null
     or v_inv.expires_at <= now() then
    raise exception 'Invalid invitation' using errcode = 'P0001', hint = 'invalid_invitation';
  end if;
  if v_inv.email <> v_email then
    raise exception 'Invitation is for another email' using errcode = 'P0001', hint = 'email_mismatch';
  end if;

  select * into v_member from public.memberships
  where org_id = v_inv.org_id and user_id = v_user for update;

  if v_member.id is null then
    insert into public.memberships (org_id, user_id, role, status)
    values (v_inv.org_id, v_user, v_inv.role, 'active')
    returning * into v_member;
    perform app.write_audit(v_inv.org_id, 'member.joined', 'membership', v_member.id,
      jsonb_build_object('role', v_inv.role, 'via', 'invitation'));
  elsif v_member.status = 'inactive' then
    update public.memberships set status = 'active', role = v_inv.role
    where id = v_member.id;
    perform app.write_audit(v_inv.org_id, 'member.reactivated', 'membership', v_member.id,
      jsonb_build_object('role', v_inv.role, 'via', 'invitation'));
  end if;
  -- An already-active member keeps their current role (never downgraded by an invite).

  update public.invitations set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  perform app.write_audit(v_inv.org_id, 'invitation.accepted', 'invitation', v_inv.id, '{}'::jsonb);

  select slug into v_slug from public.organizations where id = v_inv.org_id;
  return v_slug;
end;
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------
-- Team list. Owners/admins: everyone incl. inactive, with emails.
-- Teachers: active members' names and roles only (ROLES-PERMISSIONS).
create function app.list_team(p_org_id uuid)
returns table (
  membership_id uuid, user_id uuid, full_name text, email text,
  role public.member_role, status public.member_status, joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller public.member_role := app.caller_role(p_org_id);
  v_admin boolean := v_caller in ('owner', 'admin');
begin
  if v_caller is null then
    return; -- not a member: empty, indistinguishable from an empty org
  end if;
  return query
    select m.id, m.user_id, p.full_name,
      case when v_admin then lower(u.email) else null end,
      m.role, m.status, m.created_at
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.org_id = p_org_id and (v_admin or m.status = 'active')
    order by (m.status = 'active') desc,
      array_position(array['owner','admin','teacher']::public.member_role[], m.role),
      p.full_name;
end;
$$;
--> statement-breakpoint

-- Only owners change roles (incl. promoting another owner = ownership transfer).
-- The last-owner trigger still applies.
create function app.change_member_role(p_membership_id uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.memberships;
begin
  select * into v_target from public.memberships where id = p_membership_id for update;
  if v_target.id is null or app.caller_role(v_target.org_id) is distinct from 'owner' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_target.role = p_role then
    return;
  end if;
  update public.memberships set role = p_role where id = p_membership_id;
  perform app.write_audit(v_target.org_id, 'member.role_changed', 'membership', v_target.id,
    jsonb_build_object('from', v_target.role, 'to', p_role));
end;
$$;
--> statement-breakpoint

-- Deactivate / reactivate. Owners: anyone. Admins: teachers only.
-- Anyone may deactivate THEMSELVES (leave). Last-owner trigger still applies.
create function app.set_member_status(p_membership_id uuid, p_status public.member_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.memberships;
  v_caller public.member_role;
  v_self boolean;
begin
  select * into v_target from public.memberships where id = p_membership_id for update;
  if v_target.id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_caller := app.caller_role(v_target.org_id);
  v_self := v_target.user_id = (select auth.uid());

  if not (
    v_caller = 'owner'
    or (v_caller = 'admin' and v_target.role = 'teacher')
    or (v_self and v_target.status = 'active' and p_status = 'inactive')
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_target.status = p_status then
    return;
  end if;

  update public.memberships set status = p_status where id = p_membership_id;
  perform app.write_audit(v_target.org_id,
    case when p_status = 'active' then 'member.reactivated'
         when v_self then 'member.left'
         else 'member.deactivated' end,
    'membership', v_target.id, jsonb_build_object('role', v_target.role));
end;
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Execute grants
-- ---------------------------------------------------------------------------
revoke all on function app.create_invitation(uuid, text, public.member_role, text) from public;
--> statement-breakpoint
revoke all on function app.revoke_invitation(uuid) from public;
--> statement-breakpoint
revoke all on function app.invitation_preview(text) from public;
--> statement-breakpoint
revoke all on function app.my_pending_invitations() from public;
--> statement-breakpoint
revoke all on function app.accept_invitation(text, uuid) from public;
--> statement-breakpoint
revoke all on function app.list_team(uuid) from public;
--> statement-breakpoint
revoke all on function app.change_member_role(uuid, public.member_role) from public;
--> statement-breakpoint
revoke all on function app.set_member_status(uuid, public.member_status) from public;
--> statement-breakpoint
grant execute on function
  app.create_invitation(uuid, text, public.member_role, text),
  app.revoke_invitation(uuid),
  app.invitation_preview(text),
  app.my_pending_invitations(),
  app.accept_invitation(text, uuid),
  app.list_team(uuid),
  app.change_member_role(uuid, public.member_role),
  app.set_member_status(uuid, public.member_status)
to authenticated;
--> statement-breakpoint
grant execute on function app.invitation_preview(text) to anon;
