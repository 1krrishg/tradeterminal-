-- Allow public (unauthenticated) read access to regulations for the live dashboard
drop policy if exists "Authenticated users can read regulations" on regulations;

create policy "Anyone can read regulations"
  on regulations for select
  to anon, authenticated
  using (true);
