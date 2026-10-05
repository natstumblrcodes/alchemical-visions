drop policy if exists "provider status public read" on public.profiles;
create policy "provider status public read" on public.profiles for select using (role = 'provider');