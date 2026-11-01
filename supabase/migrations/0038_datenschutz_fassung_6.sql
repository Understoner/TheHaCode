-- 0038: Datenschutzerklaerung Fassung 6 und Einwilligung Tagebuch v4 (01.11.2026).
--
-- Anlass: Challenges (0036) und Wertgrenzen im Tagebuch-Score (0035).
--   * Datenschutzerklaerung (src/i18n/locales/de/legal.json): Challenges als
--     weitere Gesundheitsdaten im Tagebuch (was gespeichert wird, Widerruf,
--     Loeschen); der Satz "Punkte gibt es fuer das Durchfuehren einer
--     Gewohnheit, nicht fuer die Hoehe eines Messwerts" stimmte seit 0035
--     nicht mehr und beschreibt jetzt die Grenzen - und dass es sie bei
--     Messwerten wie dem BOLT-Wert nie gibt.
--   * Einwilligung Tagebuch (health_data v4): nennt die Challenges
--     ausdruecklich.
--
-- Entscheidung des Users vom 01.11.2026: v4 OHNE erneute Zustimmung.
-- has_consent() fragt nach der Art, nicht nach der Version (0012), wie schon
-- bei v2 (0025) und v3 (0027). Wer neu einwilligt, sieht v4.
--
-- Als NEUE Versionen, weil veroeffentlichte Fassungen seit 0022
-- unveraenderlich sind; die alten bleiben als Nachweis stehen.

-- ===================================================================
-- 1. Datenschutzerklaerung, Fassung 6
-- ===================================================================
insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values (
  'privacy', 6, 'de', 'Datenschutzerklärung',
  'Ich habe die Datenschutzerklärung in der Fassung 6 vom 01.11.2026 zur Kenntnis '
  'genommen. Sie ist unter /datenschutz abrufbar und beschreibt, welche Daten '
  'zu welchem Zweck verarbeitet werden.',
  true, now()
)
on conflict (kind, version, locale) do nothing;

-- ===================================================================
-- 2. Einwilligung Tagebuch (health_data v4)
-- ===================================================================
insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values (
  'health_data', 4, 'de', 'Einwilligung Tagebuch',
  'Ich willige ausdrücklich ein, dass meine Einträge im Tagebuch '
  '(zum Beispiel BOLT-Wert und erledigte Atemübungen), die Habits, die ich '
  'selbst anlege, und die Challenges, die ich plane, als Gesundheitsdaten nach '
  'Art. 9 Abs. 2 lit. a DSGVO gespeichert und für meine eigenen Auswertungen '
  'verarbeitet werden. Die Einwilligung ist freiwillig und keine Voraussetzung '
  'für die übrige Nutzung der App. Ich kann sie jederzeit unter „Konto“ '
  'widerrufen; bereits gespeicherte Einträge und Challenges kann ich danach '
  'weiter ansehen, exportieren und löschen. Einzelheiten stehen in der '
  'Datenschutzerklärung unter /datenschutz.',
  false, now()
)
on conflict (kind, version, locale) do nothing;
