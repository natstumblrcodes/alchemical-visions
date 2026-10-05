create table if not exists public.webrtc_signals (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.communication_sessions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer','answer','ice')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists webrtc_signals_session_idx on public.webrtc_signals(session_id, created_at);
alter table public.webrtc_signals enable row level security;
create policy "webrtc participants read" on public.webrtc_signals for select using (exists (
  select 1 from public.communication_sessions s
  where s.id = session_id and (s.client_id = auth.uid() or s.provider_id = auth.uid())
));
create policy "webrtc participants insert" on public.webrtc_signals for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from public.communication_sessions s
    where s.id = session_id and (s.client_id = auth.uid() or s.provider_id = auth.uid())
  )
);
alter publication supabase_realtime add table public.webrtc_signals;
