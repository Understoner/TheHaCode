-- 0027: Aus dem Habit Tracker wird das Tagebuch (26.10.2026).
--
-- Der Habit Tracker bekommt einen eigenen Eintrag in der Navigation und
-- heisst dort und ueberall sonst "Tagebuch". Wie in 0025 aendert sich der
-- Name auch in den beiden Fassungen, die ihn nennen - als NEUE Versionen,
-- weil veroeffentlichte Fassungen seit 0022 unveraenderlich sind. Die alten
-- Versionen bleiben als Nachweis stehen.
--
-- Wer health_data schon zugestimmt hat, muss nicht neu einwilligen:
-- has_consent() fragt nach der Art, nicht nach der Version (0012). Inhalt
-- und Umfang der Einwilligung sind unveraendert, nur der Name ist neu.

-- ===================================================================
-- 1. Datenschutzerklaerung, Fassung 4
-- ===================================================================
insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values (
  'privacy', 4, 'de', 'Datenschutzerklärung',
  'Ich habe die Datenschutzerklärung in der Fassung 4 vom 26.10.2026 zur Kenntnis '
  'genommen. Sie ist unter /datenschutz abrufbar und beschreibt, welche Daten '
  'zu welchem Zweck verarbeitet werden.',
  true, now()
)
on conflict (kind, version, locale) do nothing;

-- ===================================================================
-- 2. Einwilligung Tagebuch (health_data v3)
-- ===================================================================
insert into public.consent_definitions (kind, version, locale, title, body_md, is_required, published_at)
values (
  'health_data', 3, 'de', 'Einwilligung Tagebuch',
  'Ich willige ausdrücklich ein, dass meine Einträge im Tagebuch '
  '(zum Beispiel BOLT-Wert und erledigte Atemübungen) und die Habits, die ich '
  'selbst anlege, als Gesundheitsdaten nach Art. 9 Abs. 2 lit. a DSGVO '
  'gespeichert und für meine eigenen Auswertungen verarbeitet werden. Die '
  'Einwilligung ist freiwillig und keine Voraussetzung für die übrige Nutzung '
  'der App. Ich kann sie jederzeit unter „Konto“ widerrufen; bereits '
  'gespeicherte Einträge kann ich danach weiter ansehen, exportieren und '
  'löschen. Einzelheiten stehen in der Datenschutzerklärung unter /datenschutz.',
  false, now()
)
on conflict (kind, version, locale) do nothing;
