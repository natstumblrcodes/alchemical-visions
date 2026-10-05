create table if not exists public.provider_notification_settings (
  provider_id uuid primary key references public.profiles(id) on delete cascade,
  phone_e164 text,
  sms_enabled boolean not null default true,
  voice_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.provider_notification_settings enable row level security;

create policy "providers manage own notification settings"
on public.provider_notification_settings
for all
using (auth.uid() = provider_id)
with check (auth.uid() = provider_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "providers manage own push subscriptions"
on public.push_subscriptions
for all
using (auth.uid() = provider_id)
with check (auth.uid() = provider_id);
