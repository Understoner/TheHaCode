-- 0041: AGB in der Fassung vom 03.11.2026 (Abschluss V1.1).
--
-- Anlass: § 14 AGB sagte noch, kostenpflichtig sei "ausschliesslich" das
-- Speichern eigener Atemsequenzen. Seit V1.1 gehoeren zu Plus auch alle
-- Habit-Vorlagen, eigene Habits, Uebungswege und der automatische Eintrag
-- einer Session im Tagebuch (SAD §3.14, PlanTiers.tsx). Der Text steht in
-- src/i18n/locales/de/legal.json (agb.sections, § 14), der Stand in
-- agb.stand.
--
-- terms v2 OHNE erneute Zustimmung: has_consent() fragt nach der Art, nicht
-- nach der Version (0012). Die Aenderung beschreibt den Leistungsumfang so,
-- wie er seit dem Livegang von V1.1 tatsaechlich ist, und schraenkt keine
-- bestehende Leistung ein. Neue Konten stimmen v2 zu.
--
-- Als NEUE Version, weil veroeffentlichte Fassungen seit 0022 unveraenderlich
-- sind; v1 bleibt als Nachweis stehen. Additiv (SAD §2.6): nur eine Zeile.

insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values (
  'terms', 2, 'de', 'Allgemeine Geschäftsbedingungen',
  'Ich habe die Allgemeinen Geschäftsbedingungen in der Fassung vom 03.11.2026 '
  'gelesen und stimme ihnen zu. Sie sind unter /agb abrufbar. Teil ihrer '
  'Geltung ist der Haftungsausschluss unter /haftungsausschluss (§ 5 AGB).',
  true, now()
)
on conflict (kind, version, locale) do nothing;
