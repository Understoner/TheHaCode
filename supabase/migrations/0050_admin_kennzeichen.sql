-- 0050: Admin-Kennzeichen setzen (06.11.2026).
--
-- Wunsch des Users: Angemeldete Nutzer lassen sich in der Datenbank als Admin
-- kennzeichnen; nur sie sehen bei den News den Knopf zum Bearbeiten.
--
-- Das Kennzeichen ist das, was es schon gibt: app_metadata.role = 'admin'. Daran
-- haengen is_admin() und alle Schreib-Policies (News, Kurse, Team, Storage), auch
-- news_admin_write aus 0002. Eine zweite Spalte waere eine zweite Wahrheit.
--
-- Bisher liess es sich nur ueber die Auth-Admin-API setzen. Diese Funktion ist der
-- Weg dafuer im SQL Editor. BEWUSSTE, ENGE AUSNAHME von CLAUDE.md "auth.users wird
-- nie direkt beschrieben": sie aendert genau einen Schluessel in app_metadata, und
-- kein Client darf sie aufrufen. Sie laeuft nur als service_role oder Eigentuemer.
--
-- Wirksam wird die Aenderung mit dem naechsten Token: nach erneuter Anmeldung,
-- spaetestens beim naechsten Erneuern der Sitzung.
--
-- Additiv (SAD §2.6): nur eine neue Funktion.

create or replace function public.set_user_admin(p_email text, p_is_admin boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update auth.users u
     set raw_app_meta_data = case
           when p_is_admin
             then coalesce(u.raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
           else coalesce(u.raw_app_meta_data, '{}'::jsonb) - 'role'
         end
   where lower(u.email) = lower(btrim(p_email));

  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'Kein Konto mit dieser E-Mail-Adresse' using errcode = 'no_data_found';
  end if;
  return p_is_admin;
end $$;

revoke execute on function public.set_user_admin(text, boolean) from public, anon, authenticated;
grant execute on function public.set_user_admin(text, boolean) to service_role;

comment on function public.set_user_admin(text, boolean) is
  'Setzt oder entfernt app_metadata.role = admin. Nur service_role und SQL Editor (0050).';
