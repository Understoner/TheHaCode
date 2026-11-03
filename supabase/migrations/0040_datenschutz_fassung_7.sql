-- 0040: Datenschutzerklaerung Fassung 7 und Einwilligung Tagebuch v5 (03.11.2026).
--
-- Anlass:
--   * "Challenges" heissen in der App seit 02.11.2026 "Uebungswege" (#113).
--     Die Erklaerung (src/i18n/locales/de/legal.json) und die Einwilligung
--     nennen sie jetzt so. Datenbank und Funktionen bleiben challenge*.
--   * Widerruf heisst Loeschen (Verarbeitungsverzeichnis Abschnitt 7,
--     Punkt 1, entschieden 03.11.2026): Fuer Gesundheitsdaten nach Art. 9
--     gibt es nach dem Widerruf keine Rechtsgrundlage mehr. Die Wahl
--     "Widerrufen, Daten behalten" (0033, 31.10.2026) entfaellt in der App;
--     geloescht wird ueber dasselbe delete_my_diary_data() (0033/0036).
--     Vorher laesst sich im Widerrufsdialog eine Kopie herunterladen.
--
-- health_data v5 OHNE erneute Zustimmung, wie v2 bis v4: has_consent()
-- fragt nach der Art, nicht nach der Version (0012). Die Aenderung ist fuer
-- die Betroffenen ausschliesslich guenstiger (mehr Loeschung, nicht mehr
-- Verarbeitung). Wer neu einwilligt, sieht v5.
--
-- Als NEUE Versionen, weil veroeffentlichte Fassungen seit 0022
-- unveraenderlich sind; die alten bleiben als Nachweis stehen. Additiv
-- (SAD §2.6): nur zwei neue Zeilen.

-- ===================================================================
-- 1. Datenschutzerklaerung, Fassung 7
-- ===================================================================
insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values (
  'privacy', 7, 'de', 'Datenschutzerklärung',
  'Ich habe die Datenschutzerklärung in der Fassung 7 vom 03.11.2026 zur Kenntnis '
  'genommen. Sie ist unter /datenschutz abrufbar und beschreibt, welche Daten '
  'zu welchem Zweck verarbeitet werden.',
  true, now()
)
on conflict (kind, version, locale) do nothing;

-- ===================================================================
-- 2. Einwilligung Tagebuch (health_data v5)
-- ===================================================================
insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values (
  'health_data', 5, 'de', 'Einwilligung Tagebuch',
  'Ich willige ausdrücklich ein, dass meine Einträge im Tagebuch '
  '(zum Beispiel BOLT-Wert und erledigte Atemübungen), die Habits, die ich '
  'selbst anlege, und die Übungswege, die ich plane, als Gesundheitsdaten nach '
  'Art. 9 Abs. 2 lit. a DSGVO gespeichert und für meine eigenen Auswertungen '
  'verarbeitet werden. Die Einwilligung ist freiwillig und keine Voraussetzung '
  'für die übrige Nutzung der App. Ich kann sie jederzeit unter „Konto“ '
  'widerrufen. Mit dem Widerruf werden alle Daten im Tagebuch sofort gelöscht; '
  'vorher kann ich eine Kopie herunterladen. Einzelheiten stehen in der '
  'Datenschutzerklärung unter /datenschutz.',
  false, now()
)
on conflict (kind, version, locale) do nothing;
