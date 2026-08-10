-- ---------- Storage-Bucket public-assets (SAD §3.13) ----------
-- Oeffentliche Bilder fuer News-, Kurs- und Teaminhalte. Name stand schon in
-- der Architekturuebersicht (SAD §1.1), wird hier erstmals angelegt.
-- Ordnerkonvention nach Inhaltstyp, in der Insert-Policy technisch
-- erzwungen statt nur Konvention.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-assets', 'public-assets', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy public_assets_read on storage.objects
  for select using (bucket_id = 'public-assets');

create policy public_assets_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-assets'
    and public.is_admin()
    and (storage.foldername(name))[1] in ('news', 'courses', 'team')
  );

create policy public_assets_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'public-assets' and public.is_admin())
  with check (bucket_id = 'public-assets' and public.is_admin());

create policy public_assets_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-assets' and public.is_admin());
