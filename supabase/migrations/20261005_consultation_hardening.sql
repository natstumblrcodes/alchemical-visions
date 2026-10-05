-- Prevent a client/provider pair from having multiple live requests at once.
create unique index if not exists communication_sessions_one_live_per_pair
on public.communication_sessions (client_id, provider_id)
where status in ('pending', 'accepted', 'active');
