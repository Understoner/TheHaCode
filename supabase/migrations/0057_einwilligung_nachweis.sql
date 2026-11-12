-- 0057: Einwilligungen - der Nachweis zeigt auf den richtigen Text und traegt
-- die Zeit des Servers (Review 11.11.2026, Befund S7).
--
-- WORUM ES GEHT
-- -------------
-- Eine Zeile in user_consents ist ein Nachweis nach Art. 7 Abs. 1 DSGVO: wer
-- hat wann in welchen Wortlaut eingewilligt. Zwei Dinge daran kamen bisher
-- ungeprueft vom Client:
--
--   1. DIE ART. Die Zeile nennt definition_id (den Wortlaut) UND kind (die
--      Art, denormalisiert fuer has_consent()). Die Policy aus 0012 prueft,
--      dass die Fassung veroeffentlicht ist - nicht, dass beides
--      zusammenpasst. Ein Client konnte kind = 'health_data' mit der
--      definition_id der AGB schicken. has_consent('health_data') sagte dann
--      ja, und der Nachweis zeigte auf den falschen Text.
--      Ein Recht verschafft sich damit niemand - die Einwilligung ist die
--      eigene Erklaerung. Aber ein Nachweis, der auf einen anderen Wortlaut
--      zeigt, ist keiner.
--
--   2. DIE ZEIT. granted_at und revoked_at kamen von der Uhr des Geraets
--      (useConsents.ts: new Date()). Eine falsch gestellte Uhr - oder Absicht -
--      setzt die Einwilligung auf einen beliebigen Zeitpunkt.
--
-- WAS SICH AENDERT
-- ----------------
--   1. Eine ZUSAETZLICHE, einschraenkende Policy: kind muss die Art der
--      genannten Fassung sein. "as restrictive" heisst: sie gilt neben
--      user_consents_insert aus 0012, beide muessen erfuellt sein. Die alte
--      Policy bleibt unangetastet (additiv, SAD §2.6).
--   2. Ein Trigger setzt die Zeitpunkte auf now(), wenn ein angemeldeter
--      Nutzer schreibt. OB erteilt oder widerrufen wird, bestimmt weiter die
--      Eingabe - nur WANN bestimmt jetzt der Server.
--
-- WAS BLEIBT, WIE ES IST
-- ----------------------
--   * Die Einwilligung bei der Registrierung (handle_new_user_consents, 0013)
--     uebernimmt den Zeitpunkt weiter aus den Metadaten der Anmeldung. Dort
--     ruft kein angemeldeter Nutzer, der Trigger hier greift nicht. Das ist
--     der offene Rest von S7: die Funktion sitzt im Anlegen JEDES Kontos, eine
--     Aenderung daran gehoert einzeln geprueft.
--   * Die App vom 07.11.2026 schickt kind passend zur Fassung und beide
--     Zeitpunkte wie bisher. Sie merkt von dieser Migration nichts.

-- ---------------------------------------------------------------------------
-- 1. Art und Fassung muessen zusammenpassen
-- ---------------------------------------------------------------------------
-- Missbrauchsfall (057_einwilligung_nachweis.test.sql): kind = 'health_data'
-- mit der definition_id einer AGB-Fassung.

create policy user_consents_insert_kind_matches on public.user_consents
  as restrictive
  for insert
  with check (
    kind = (
      select d.kind
        from public.consent_definitions d
       where d.id = definition_id
    )
  );

comment on policy user_consents_insert_kind_matches on public.user_consents is
  'Einschraenkend (0057): kind muss die Art der genannten Fassung sein - '
  'sonst zeigt der Nachweis auf den falschen Wortlaut.';

-- ---------------------------------------------------------------------------
-- 2. Die Zeit kommt vom Server
-- ---------------------------------------------------------------------------
-- security invoker: die Funktion braucht kein Recht, das der Schreibende nicht
-- hat. auth.uid() ist genau dann gesetzt, wenn ein angemeldeter Nutzer ueber
-- die Schnittstelle schreibt - nicht beim Anlegen eines Kontos (dort schreibt
-- der Trigger aus 0013) und nicht bei Arbeiten im SQL Editor.

create or replace function public.stamp_consent_times()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if new.granted_at is not null then
      new.granted_at := now();
    end if;
    if new.revoked_at is not null then
      new.revoked_at := now();
    end if;
  end if;
  return new;
end $$;

-- Eine Triggerfunktion ruft niemand direkt auf (0031, 0055).
revoke execute on function public.stamp_consent_times() from public, anon, authenticated;

create trigger trg_user_consents_stamp
  before insert on public.user_consents
  for each row execute function public.stamp_consent_times();

comment on function public.stamp_consent_times() is
  'Setzt granted_at/revoked_at auf die Serverzeit, wenn ein angemeldeter Nutzer '
  'eine Einwilligung schreibt (0057). Die Uhr des Geraets ist kein Nachweis.';
