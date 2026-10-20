-- SMS (phone) login: OTP challenges + phone->user mapping.
-- Only the service_role key may touch these tables: the browser never talks to
-- them directly, the server does (server/smsAuth.ts).

create table if not exists public.sms_accounts (
  phone_e164    text primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  identity_kind text not null default 'phone' check (identity_kind in ('phone', 'email')),
  email         text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists sms_accounts_user_idx
  on public.sms_accounts (user_id);

create table if not exists public.sms_otp_challenges (
  id           uuid primary key default gen_random_uuid(),
  phone_e164   text not null,
  code_hash    text not null,
  attempts     integer not null default 0,
  max_attempts integer not null default 3,
  ip           text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  consumed_at  timestamptz
);

create index if not exists sms_otp_challenges_phone_idx
  on public.sms_otp_challenges (phone_e164, created_at desc);

create index if not exists sms_otp_challenges_ip_idx
  on public.sms_otp_challenges (ip, created_at desc);

create index if not exists sms_otp_challenges_created_idx
  on public.sms_otp_challenges (created_at desc);

alter table public.sms_accounts enable row level security;
alter table public.sms_otp_challenges enable row level security;

revoke all on public.sms_accounts from anon, authenticated;
revoke all on public.sms_otp_challenges from anon, authenticated;

grant select, insert, update, delete on public.sms_accounts to service_role;
grant select, insert, update, delete on public.sms_otp_challenges to service_role;

-- The auth schema is not exposed through PostgREST, so phone lookups and the
-- atomic OTP consumption must happen inside SQL.

-- Find a Supabase user by phone (the `auth` schema lookup needs SECURITY DEFINER).
create or replace function public.find_user_by_phone(p_phone text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  where u.phone = p_phone
  order by u.created_at
  limit 1;
$$;

-- Fallback lookup for the synthetic email identity (`sms+<digits>@phone.aqualedger.app`).
create or replace function public.find_user_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  where u.email = p_email
  order by u.created_at
  limit 1;
$$;

-- Send-rate statistics for the last hour (plus the newest challenge time,
-- used for the 60s resend cooldown).
create or replace function public.sms_otp_stats(p_phone text, p_ip text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'phone_sends', (
      select count(*) from public.sms_otp_challenges
      where phone_e164 = p_phone and created_at > now() - interval '1 hour'
    ),
    'ip_sends', (
      select count(*) from public.sms_otp_challenges
      where p_ip is not null and ip = p_ip and created_at > now() - interval '1 hour'
    ),
    'phone_fails', (
      select coalesce(sum(attempts), 0) from public.sms_otp_challenges
      where phone_e164 = p_phone and created_at > now() - interval '1 hour'
    ),
    'phone_last_at', (
      select max(created_at) from public.sms_otp_challenges
      where phone_e164 = p_phone
    )
  );
$$;

-- Atomic OTP consumption: the row is locked `for update`, so a code can never
-- be used twice. Returns the challenge id on success, NULL otherwise.
create or replace function public.consume_sms_otp(p_phone text, p_code_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.sms_otp_challenges
  where phone_e164 = p_phone
    and code_hash = p_code_hash
    and consumed_at is null
    and expires_at > now()
    and attempts < max_attempts
  order by created_at desc
  limit 1
  for update;

  if v_id is null then
    -- Wrong code: count the attempt on the newest live challenge of this phone.
    update public.sms_otp_challenges
    set attempts = attempts + 1
    where id = (
      select id from public.sms_otp_challenges
      where phone_e164 = p_phone
        and consumed_at is null
        and expires_at > now()
      order by created_at desc
      limit 1
    );
    return null;
  end if;

  update public.sms_otp_challenges
  set consumed_at = now()
  where id = v_id;

  return v_id;
end;
$$;

-- Upsert the phone -> user mapping and refresh the last login timestamp.
create or replace function public.sms_account_upsert(
  p_phone text,
  p_user_id uuid,
  p_identity_kind text,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sms_accounts (phone_e164, user_id, identity_kind, email, last_login_at)
  values (p_phone, p_user_id, p_identity_kind, p_email, now())
  on conflict (phone_e164)
  do update set
    user_id = excluded.user_id,
    identity_kind = excluded.identity_kind,
    email = excluded.email,
    last_login_at = now();
end;
$$;

revoke execute on function public.find_user_by_phone(text) from public, anon, authenticated;
revoke execute on function public.find_user_by_email(text) from public, anon, authenticated;
revoke execute on function public.sms_otp_stats(text, text) from public, anon, authenticated;
revoke execute on function public.consume_sms_otp(text, text) from public, anon, authenticated;
revoke execute on function public.sms_account_upsert(text, uuid, text, text) from public, anon, authenticated;

grant execute on function public.find_user_by_phone(text) to service_role;
grant execute on function public.find_user_by_email(text) to service_role;
grant execute on function public.sms_otp_stats(text, text) to service_role;
grant execute on function public.consume_sms_otp(text, text) to service_role;
grant execute on function public.sms_account_upsert(text, uuid, text, text) to service_role;
