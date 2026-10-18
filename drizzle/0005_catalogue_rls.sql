-- Catalogue (subjects, grade levels, locations): privileges + RLS.
-- ROLES-PERMISSIONS: owners/admins manage; every active member reads.
-- Plain CRUD, so ordinary policies suffice (no SECURITY DEFINER needed).
-- No DELETE: items are archived (classes reference them from M5).

revoke all on public.subjects, public.grade_levels, public.locations from anon, authenticated;
--> statement-breakpoint
grant select, insert on public.subjects, public.grade_levels, public.locations to authenticated;
--> statement-breakpoint
-- org_id, id and created_at are never updatable (moving rows between orgs is impossible).
grant update (name, code, archived_at) on public.subjects to authenticated;
--> statement-breakpoint
grant update (name, sort_order, archived_at) on public.grade_levels to authenticated;
--> statement-breakpoint
grant update (name, kind, address, archived_at) on public.locations to authenticated;
--> statement-breakpoint

create trigger subjects_set_updated_at before update on public.subjects
  for each row execute function app.set_updated_at();
--> statement-breakpoint
create trigger grade_levels_set_updated_at before update on public.grade_levels
  for each row execute function app.set_updated_at();
--> statement-breakpoint
create trigger locations_set_updated_at before update on public.locations
  for each row execute function app.set_updated_at();
--> statement-breakpoint

create policy subjects_select_member on public.subjects
  for select to authenticated using (app.is_org_member(org_id));
--> statement-breakpoint
create policy subjects_insert_manager on public.subjects
  for insert to authenticated with check (app.is_org_member(org_id, '{owner,admin}'));
--> statement-breakpoint
create policy subjects_update_manager on public.subjects
  for update to authenticated
  using (app.is_org_member(org_id, '{owner,admin}'))
  with check (app.is_org_member(org_id, '{owner,admin}'));
--> statement-breakpoint

create policy grade_levels_select_member on public.grade_levels
  for select to authenticated using (app.is_org_member(org_id));
--> statement-breakpoint
create policy grade_levels_insert_manager on public.grade_levels
  for insert to authenticated with check (app.is_org_member(org_id, '{owner,admin}'));
--> statement-breakpoint
create policy grade_levels_update_manager on public.grade_levels
  for update to authenticated
  using (app.is_org_member(org_id, '{owner,admin}'))
  with check (app.is_org_member(org_id, '{owner,admin}'));
--> statement-breakpoint

create policy locations_select_member on public.locations
  for select to authenticated using (app.is_org_member(org_id));
--> statement-breakpoint
create policy locations_insert_manager on public.locations
  for insert to authenticated with check (app.is_org_member(org_id, '{owner,admin}'));
--> statement-breakpoint
create policy locations_update_manager on public.locations
  for update to authenticated
  using (app.is_org_member(org_id, '{owner,admin}'))
  with check (app.is_org_member(org_id, '{owner,admin}'));
