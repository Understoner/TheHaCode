-- 0034: Datenschutzerklaerung Fassung 5 vom 31.10.2026.
--
-- Drei Aenderungen im Text (src/i18n/locales/de/legal.json):
--   * Tagebuch: beim Widerruf wird angeboten, alles sofort zu loeschen (0033).
--   * Kursbuchungen: Gastbuchungs-Kennungen werden nicht exakt nach 24 Stunden
--     geloescht, sondern beim naechsten Buchungsversuch ohne Konto, sobald sie
--     aelter als 24 Stunden sind (so arbeitet take_guest_booking_slot(), 0022).
--   * Empfaenger: die Kontomails verschickt seit 31.10.2026 Hostinger
--     (eigener SMTP in Supabase Auth), nicht mehr Supabase.
--
-- Als NEUE Version, weil veroeffentlichte Fassungen seit 0022 unveraenderlich
-- sind; Fassung 4 bleibt als Nachweis stehen. Die Einwilligung health_data v3
-- bleibt gueltig: ihr Satz "bereits gespeicherte Eintraege kann ich danach
-- weiter ansehen, exportieren und loeschen" stimmt auch mit dem Loeschangebot.

insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values (
  'privacy', 5, 'de', 'Datenschutzerklärung',
  'Ich habe die Datenschutzerklärung in der Fassung 5 vom 31.10.2026 zur Kenntnis '
  'genommen. Sie ist unter /datenschutz abrufbar und beschreibt, welche Daten '
  'zu welchem Zweck verarbeitet werden.',
  true, now()
)
on conflict (kind, version, locale) do nothing;
