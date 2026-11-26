
-- Explicit deny policies make the server-only boundary visible to auditors.
create policy subscription_provider_events_deny_clients
  on public.subscription_provider_events for all to anon, authenticated
  using (false) with check (false);
create policy call_capacity_reservations_deny_clients
  on public.call_capacity_reservations for all to anon, authenticated
  using (false) with check (false);

-- Cover every tenant-composite and user foreign key for efficient deletes/joins.
create index if not exists activity_events_actor_user_id_idx
  on public.activity_events(actor_user_id);
create index if not exists call_capacity_reservations_org_call_idx
  on public.call_capacity_reservations(organization_id, call_id);
create index if not exists call_capacity_reservations_org_instance_idx
  on public.call_capacity_reservations(organization_id, receptionist_instance_id);
create index if not exists calls_org_phone_number_idx
  on public.calls(organization_id, phone_number_id);
create index if not exists calls_org_receptionist_idx
  on public.calls(organization_id, receptionist_instance_id);
create index if not exists organization_phone_numbers_created_by_idx
  on public.organization_phone_numbers(created_by);
create index if not exists organization_subscriptions_plan_id_idx
  on public.organization_subscriptions(plan_id);
create index if not exists organization_subscriptions_price_id_idx
  on public.organization_subscriptions(price_id);
create index if not exists receptionist_instances_created_by_idx
  on public.receptionist_instances(created_by);
create index if not exists receptionist_routes_org_number_idx
  on public.receptionist_number_routes(organization_id, phone_number_id);
create index if not exists receptionist_routes_org_instance_idx
  on public.receptionist_number_routes(organization_id, receptionist_instance_id);
create index if not exists receptionist_routes_org_number_channel_idx
  on public.receptionist_number_routes(organization_id, phone_number_id, channel);
create index if not exists reservations_created_by_idx
  on public.reservations(created_by);
create index if not exists reservations_org_room_idx
  on public.reservations(organization_id, room_id);
create index if not exists reservations_org_guest_fk_idx
  on public.reservations(organization_id, guest_id);
