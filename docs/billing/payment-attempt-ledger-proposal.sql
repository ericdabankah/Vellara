-- DESIGN REFERENCE ONLY.
-- Do not execute this file directly or apply it to the hosted VELLARA project.
-- Convert it into a CLI-generated migration after reviewing it against a local
-- Supabase stack and the complete billing flow.

create table public.subscription_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  subscription_id uuid not null references public.organization_subscriptions(id) on delete restrict,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  price_id uuid not null references public.subscription_prices(id) on delete restrict,
  provider text not null default 'paystack' check (provider = 'paystack'),
  reference text not null unique
    check (reference ~ '^[A-Za-z0-9.=\-]{8,100}$'),
  idempotency_key text,
  expected_amount_minor bigint not null check (expected_amount_minor > 0),
  currency char(3) not null default 'GHS' check (currency = 'GHS'),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  expected_channel text not null check (expected_channel in ('card', 'mobile_money')),
  provider_transaction_id text,
  provider_channel text,
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'expired', 'review_required')),
  provider_paid_at timestamptz,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_payment_attempts_expiry_check
    check (expires_at > created_at),
  constraint subscription_payment_attempts_provider_channel_check
    check (provider_channel is null or provider_channel in ('card', 'mobile_money'))
);

create unique index subscription_payment_attempts_org_idempotency_uidx
  on public.subscription_payment_attempts (organization_id, idempotency_key)
  where idempotency_key is not null;

create unique index subscription_payment_attempts_provider_transaction_uidx
  on public.subscription_payment_attempts (provider, provider_transaction_id)
  where provider_transaction_id is not null;

create index subscription_payment_attempts_org_created_idx
  on public.subscription_payment_attempts (organization_id, created_at desc);

create index subscription_payment_attempts_pending_expiry_idx
  on public.subscription_payment_attempts (expires_at)
  where status = 'pending';

alter table public.subscription_payment_attempts enable row level security;

revoke all on public.subscription_payment_attempts from anon, authenticated;
grant select on public.subscription_payment_attempts to authenticated;
grant select, insert, update on public.subscription_payment_attempts to service_role;

create policy subscription_payment_attempts_member_read
  on public.subscription_payment_attempts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = subscription_payment_attempts.organization_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    )
  );

-- The function is SECURITY INVOKER. It runs with the caller's service_role
-- privileges, locks both records, validates the verified Paystack facts against
-- the server-created attempt, and commits the payment + entitlement transition
-- in one Postgres transaction. It is not callable by anon/authenticated clients.
create or replace function public.apply_verified_paystack_payment(
  p_attempt_id uuid,
  p_verified_reference text,
  p_verified_status text,
  p_verified_amount_minor bigint,
  p_verified_currency text,
  p_provider_transaction_id text,
  p_provider_channel text,
  p_provider_paid_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_attempt public.subscription_payment_attempts%rowtype;
  v_subscription public.organization_subscriptions%rowtype;
  v_price public.subscription_prices%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_entitlements public.subscription_plan_entitlements%rowtype;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if current_user <> 'service_role' then
    raise exception 'billing_processor_role_required' using errcode = '42501';
  end if;

  select * into v_attempt
  from public.subscription_payment_attempts
  where id = p_attempt_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if v_attempt.status = 'succeeded' then
    if v_attempt.provider_transaction_id = p_provider_transaction_id then
      return jsonb_build_object('outcome', 'already_applied');
    end if;
    return jsonb_build_object('outcome', 'conflict');
  end if;

  if v_attempt.status <> 'pending' then
    return jsonb_build_object('outcome', 'not_pending', 'status', v_attempt.status);
  end if;

  if p_verified_status <> 'success'
     or p_verified_reference is distinct from v_attempt.reference
     or p_verified_amount_minor is distinct from v_attempt.expected_amount_minor
     or upper(coalesce(p_verified_currency, '')) <> v_attempt.currency
     or p_provider_transaction_id is null
     or length(btrim(p_provider_transaction_id)) = 0
     or p_provider_paid_at is null then
    update public.subscription_payment_attempts
      set status = 'review_required',
          failure_code = 'verified_transaction_mismatch',
          updated_at = now()
      where id = v_attempt.id;
    return jsonb_build_object('outcome', 'review_required', 'reason', 'verified_transaction_mismatch');
  end if;

  if p_provider_channel not in ('card', 'mobile_money')
     or p_provider_channel <> v_attempt.expected_channel then
    update public.subscription_payment_attempts
      set status = 'review_required',
          failure_code = 'payment_channel_mismatch',
          updated_at = now()
      where id = v_attempt.id;
    return jsonb_build_object('outcome', 'review_required', 'reason', 'payment_channel_mismatch');
  end if;

  if p_provider_paid_at < v_attempt.created_at - interval '5 minutes'
     or p_provider_paid_at > v_attempt.expires_at then
    update public.subscription_payment_attempts
      set status = 'review_required',
          failure_code = 'payment_outside_attempt_window',
          updated_at = now()
      where id = v_attempt.id;
    return jsonb_build_object('outcome', 'review_required', 'reason', 'payment_outside_attempt_window');
  end if;

  select * into v_subscription
  from public.organization_subscriptions
  where id = v_attempt.subscription_id
    and organization_id = v_attempt.organization_id
  for update;

  if not found
     or v_subscription.plan_id <> v_attempt.plan_id
     or v_subscription.price_id is distinct from v_attempt.price_id
     or v_subscription.status not in ('incomplete', 'pending', 'past_due', 'active')
     or v_subscription.cancel_at_period_end then
    update public.subscription_payment_attempts
      set status = 'review_required',
          failure_code = 'subscription_state_mismatch',
          updated_at = now()
      where id = v_attempt.id;
    return jsonb_build_object('outcome', 'review_required', 'reason', 'subscription_state_mismatch');
  end if;

  select * into v_price
  from public.subscription_prices
  where id = v_attempt.price_id
    and plan_id = v_attempt.plan_id
    and provider = 'paystack'
    and currency = v_attempt.currency
    and billing_interval = v_attempt.billing_interval
    and amount_minor = v_attempt.expected_amount_minor;

  if not found then
    update public.subscription_payment_attempts
      set status = 'review_required',
          failure_code = 'price_snapshot_mismatch',
          updated_at = now()
      where id = v_attempt.id;
    return jsonb_build_object('outcome', 'review_required', 'reason', 'price_snapshot_mismatch');
  end if;

  select * into v_plan
  from public.subscription_plans
  where id = v_attempt.plan_id
    and is_available_for_purchase;

  select * into v_entitlements
  from public.subscription_plan_entitlements
  where plan_id = v_attempt.plan_id
    and configuration_status = 'configured';

  if not found or v_plan.id is null then
    update public.subscription_payment_attempts
      set status = 'review_required',
          failure_code = 'plan_not_purchase_ready',
          updated_at = now()
      where id = v_attempt.id;
    return jsonb_build_object('outcome', 'review_required', 'reason', 'plan_not_purchase_ready');
  end if;

  v_period_start := case
    when v_subscription.status = 'active'
      and v_subscription.current_period_end > p_provider_paid_at
      then v_subscription.current_period_end
    else p_provider_paid_at
  end;

  v_period_end := case v_attempt.billing_interval
    when 'monthly' then v_period_start + interval '1 month'
    when 'yearly' then v_period_start + interval '1 year'
  end;

  update public.organization_subscriptions
    set plan_id = v_attempt.plan_id,
        price_id = v_attempt.price_id,
        billing_provider = 'paystack',
        status = 'active',
        current_period_start = v_period_start,
        current_period_end = v_period_end,
        phone_number_limit = v_entitlements.phone_number_limit,
        receptionist_instance_limit = v_entitlements.receptionist_instance_limit,
        concurrent_call_limit = v_entitlements.concurrent_call_limit,
        team_member_limit = v_entitlements.team_member_limit,
        entitlements_configured = true,
        updated_at = now()
    where id = v_subscription.id;

  update public.subscription_payment_attempts
    set status = 'succeeded',
        provider_transaction_id = p_provider_transaction_id,
        provider_channel = p_provider_channel,
        provider_paid_at = p_provider_paid_at,
        failure_code = null,
        updated_at = now()
    where id = v_attempt.id;

  return jsonb_build_object(
    'outcome', 'applied',
    'subscription_id', v_subscription.id,
    'period_start', v_period_start,
    'period_end', v_period_end
  );
end;
$$;

revoke all on function public.apply_verified_paystack_payment(
  uuid, text, text, bigint, text, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.apply_verified_paystack_payment(
  uuid, text, text, bigint, text, text, text, timestamptz
) to service_role;
