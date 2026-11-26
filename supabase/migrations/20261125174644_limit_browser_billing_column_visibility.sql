
-- Keep billing provider identifiers and internal metadata out of browser-readable columns.
revoke select on public.organization_subscriptions from authenticated;
grant select (
  id, organization_id, plan_id, status,
  current_period_start, current_period_end, trial_start, trial_end,
  cancel_at_period_end, canceled_at, ended_at,
  phone_number_limit, receptionist_instance_limit, concurrent_call_limit,
  team_member_limit, entitlements_configured, created_at, updated_at
) on public.organization_subscriptions to authenticated;

revoke select on public.subscription_prices from anon, authenticated;
grant select (
  id, plan_id, currency, billing_interval, amount_minor,
  is_active, effective_from, effective_until, created_at
) on public.subscription_prices to anon, authenticated;
