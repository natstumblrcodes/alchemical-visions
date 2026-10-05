-- Alchemical Visions consultation core
create extension if not exists pgcrypto;
create type public.user_role as enum ('client','provider','admin');
create type public.session_type as enum ('chat','audio','video');
create type public.session_status as enum ('pending','accepted','active','ended','cancelled','payment_failed');
create type public.appointment_status as enum ('pending','confirmed','cancelled','completed');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role public.user_role not null default 'client',
  avatar_url text,
  is_online boolean not null default false,
  accepting_sessions boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  bio text not null default '',
  price_per_minute numeric(10,2) not null default 2.99 check (price_per_minute >= 0),
  minimum_minutes integer not null default 1 check (minimum_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, provider_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create table if not exists public.communication_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  session_type public.session_type not null,
  status public.session_status not null default 'pending',
  price_per_minute numeric(10,2) not null check (price_per_minute >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  subtotal numeric(10,2) not null default 0 check (subtotal >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.session_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.communication_sessions(id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status public.appointment_status not null default 'pending',
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index if not exists sessions_client_idx on public.communication_sessions(client_id, created_at desc);
create index if not exists sessions_provider_idx on public.communication_sessions(provider_id, created_at desc);
create index if not exists appointments_provider_time_idx on public.appointments(provider_id, start_time);

alter table public.profiles enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.communication_sessions enable row level security;
alter table public.session_events enable row level security;
alter table public.appointments enable row level security;

create policy "profiles self read" on public.profiles for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);
create policy "providers public read" on public.provider_profiles for select using (true);
create policy "provider self write" on public.provider_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "conversation participants read" on public.conversations for select using (auth.uid() = client_id or auth.uid() = provider_id);
create policy "conversation participants insert" on public.conversations for insert with check (auth.uid() = client_id or auth.uid() = provider_id);
create policy "conversation messages read" on public.messages for select using (exists (select 1 from public.conversations c where c.id = conversation_id and (c.client_id = auth.uid() or c.provider_id = auth.uid())));
create policy "conversation messages insert" on public.messages for insert with check (auth.uid() = sender_id and exists (select 1 from public.conversations c where c.id = conversation_id and (c.client_id = auth.uid() or c.provider_id = auth.uid())));
create policy "session participants read" on public.communication_sessions for select using (auth.uid() = client_id or auth.uid() = provider_id);
create policy "session participants insert" on public.communication_sessions for insert with check (auth.uid() = client_id or auth.uid() = provider_id);
create policy "session participants update" on public.communication_sessions for update using (auth.uid() = client_id or auth.uid() = provider_id);
create policy "session events participants read" on public.session_events for select using (exists (select 1 from public.communication_sessions s where s.id = session_id and (s.client_id = auth.uid() or s.provider_id = auth.uid())));
create policy "session events participants insert" on public.session_events for insert with check (auth.uid() = actor_id and exists (select 1 from public.communication_sessions s where s.id = session_id and (s.client_id = auth.uid() or s.provider_id = auth.uid())));
create policy "appointment participants" on public.appointments for all using (auth.uid() = client_id or auth.uid() = provider_id) with check (auth.uid() = client_id or auth.uid() = provider_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.communication_sessions;
alter publication supabase_realtime add table public.profiles;
