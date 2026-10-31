# Verzeichnis von Verarbeitungstätigkeiten

Nach Art. 30 Abs. 1 DSGVO. Gehört zu **T19**.

> **In Kraft seit 23. August 2026.** Zusammengetragen aus dem, was im Repo
> tatsächlich steht — Migrationen, Edge Functions, Datenschutzerklärung. Was
> hier steht, ist damit belegbar; was nicht belegbar war, steht nicht drin.
> Die Auftragsverarbeitungsverträge sind geschlossen (Abschnitt 4).
>
> **Die Speicherdauern sind am 23. August 2026 gegen die Migrationen geprüft
> worden**, nicht gegen den eigenen Text. Die Löschung über
> `on delete cascade` greift bei allen Nutzertabellen tatsächlich; drei
> Angaben waren zu kurz gegriffen und stehen jetzt richtig (Sicherungskopien,
> Teamfoto, steuerliche Belege). Die beiden Fristen, die sich nicht aus dem
> Repository ableiten ließen, hat der Verantwortliche am selben Tag gesetzt:
> Server-Protokolle sieben Tage, E-Mail ohne Vertragsbezug zwölf Monate.
> Damit ist der Entwurfsvermerk gefallen.
>
> **Ergänzt am 31. Oktober 2026 für V1.1** (live seit demselben Tag, Commit
> `64f3f7b`). Abgeglichen gegen die Migrationen 0013 bis 0032 und die
> Datenschutzerklärung Fassung 4 vom 26.10.2026. Neu sind das Tagebuch mit
> Gesundheitsdaten nach Art. 9 (V10), das Übungsprotokoll (V11), der
> Missbrauchsschutz für Gastbuchungen (V12), Favoriten und Playlist-Links (V3)
> sowie Gastbuchungen und deren Aufbewahrung nach der Kontolöschung (V5).
> Abschnitt 3 hat zwei Auslassungen verloren („keine Gesundheitsdaten“, „keine
> Sitzungsprotokolle“). Zwei Punkte sind offen und stehen in Abschnitt 7.

**Stand:** 31. Oktober 2026 · **Nächste Prüfung:** bei jeder neuen Tabelle mit
Personenbezug, beim Wechsel auf Supabase Pro und sobald die offenen Punkte in
Abschnitt 7 entschieden sind.

---

## 1. Verantwortlicher

| | |
|---|---|
| Name | TheHaCode by Michael Untersteiner |
| Anschrift | Weinberg 15, 4674 Altenhof am Hausruck, Österreich |
| E-Mail | office@thehacode.com |
| Telefon | +43 664 4252322 |
| Datenschutzbeauftragter | nicht bestellt — die Voraussetzungen des Art. 37 DSGVO liegen nicht vor (keine umfangreiche regelmäßige Überwachung, keine umfangreiche Verarbeitung besonderer Kategorien) |

---

## 2. Verarbeitungstätigkeiten

### V1 · Auslieferung der Website

| | |
|---|---|
| **Zweck** | Anzeige der Seiten, Abwehr von Störungen und Missbrauch |
| **Betroffene** | Besucher:innen |
| **Datenkategorien** | IP-Adresse, Zeitpunkt, aufgerufene Adresse, Datenmenge, Browser- und Betriebssystemkennung (Server-Protokolle des Hosters) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. f — berechtigtes Interesse am sicheren Betrieb |
| **Empfänger** | Hostinger (Auftragsverarbeiter) |
| **Drittland** | möglich, abgesichert über Standardvertragsklauseln |
| **Löschfrist** | **7 Tage** — danach löscht Hostinger die Server-Protokolle automatisch (Auskunft des Hosters, 23.08.2026). Wir werten sie nicht aus und führen sie mit nichts zusammen. |

> Das vorgeschaltete CDN gehört demselben Auftragsverarbeiter und ist damit
> von derselben Vereinbarung erfasst. Es sitzt seit dem 22.08.2026 vor der
> Seite und sieht jede Besucher-IP vor dem Webserver — führt es dort eigene
> Protokolle, gilt für sie dieselbe Frist des Hosters.

### V2 · Nutzerkonto

| | |
|---|---|
| **Zweck** | Registrierung, Anmeldung, Sitzungen, Passwort zurücksetzen, Kontoführung |
| **Betroffene** | registrierte Nutzer:innen |
| **Datenkategorien** | E-Mail-Adresse, Passwort-Hash, Zeitpunkte von Registrierung und letzter Anmeldung (`auth.users`, verwaltet von Supabase Auth); Anzeigename, Sprache, Zeitzone, Einstellungen (Ton, Stimme, Tagebuch-Score an oder aus, eingeschaltete Habit-Bereiche), Zugriffsmerkmal (`public.profiles`) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b — Erfüllung des Nutzungsvertrags |
| **Empfänger** | Supabase (Auftragsverarbeiter, Kontoverwaltung); Hostinger (Auftragsverarbeiter, versendet seit 31.10.2026 die Kontomails über das Postfach der Domain `deratemcode.at`) |
| **Drittland** | möglich, abgesichert über Standardvertragsklauseln |
| **Löschfrist** | mit der Löschung des Kontos; sie erfolgt sofort und vollständig über `on delete cascade` (Edge Function `delete-account`) — zur Einschränkung siehe „Sicherungskopien" am Ende dieses Abschnitts |

> Kein eigenes Passwort-Hashing, keine eigene Sitzungstabelle — die
> Nutzerverwaltung liegt vollständig bei Supabase Auth (CLAUDE.md).
>
> **Versand der Kontomails seit 31.10.2026 über Hostinger.** Bestätigungs- und
> Passwort-Mails erzeugt weiterhin Supabase Auth, verschickt werden sie aber
> über den SMTP-Server von Hostinger (eigener SMTP in den Auth-Einstellungen).
> Der eingebaute Versand von Supabase schickt im kostenlosen Plan nur an
> Team-Adressen. Scheiterte der Versand, brach Supabase die ganze Registrierung
> ab, und Fremde konnten sich nicht per E-Mail registrieren. Hostinger sieht
> dabei Empfängeradresse und Inhalt der Mail (Bestätigungslink). Der Vertrag
> nach Art. 28 besteht bereits (Abschnitt 4). **Die Datenschutzerklärung nennt
> bisher nur Supabase als Versender und muss mit der nächsten Fassung angepasst
> werden** (Abschnitt 7).

### V3 · Eigene Atemsequenzen

| | |
|---|---|
| **Zweck** | Speichern und Abspielen selbst gebauter Sequenzen (die bezahlte Funktion), Merken von Favoriten, Hinterlegen einer Playlist |
| **Betroffene** | registrierte Nutzer:innen |
| **Datenkategorien** | Titel, Untertitel, Blöcke, Phasen, Dauern, Rundenzahlen, Pausen (`exercises`, `exercise_steps`, `exercise_phases`); Links zu einer Playlist bei Spotify oder Apple Music (`exercises.spotify_url`, `apple_music_url`, seit 0017); als Favorit markierte Sequenzen und seit wann (`exercise_favorites`, seit 0017) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b |
| **Empfänger** | Supabase |
| **Löschfrist** | mit der Löschung des Kontos oder der einzelnen Sequenz bzw. des Favoriten |

> Diese Angaben beschreiben eine Übung, nicht die Person. Ob, wann und wie
> lange jemand geübt hat, steht seit V1.1 im Übungsprotokoll (V11), nicht hier.
>
> Spotify und Apple Music sind **nicht** eingebunden und keine Empfänger: Die
> App speichert nur den Link. Erst wenn jemand ihn antippt, öffnet sich der
> Dienst, und ab dann gelten dessen Bestimmungen.

### V4 · Abonnement und Zahlungsabwicklung

| | |
|---|---|
| **Zweck** | Abschluss und Abrechnung des Abonnements, Freischaltung des Zugriffs, steuerliche Aufzeichnung |
| **Betroffene** | zahlende Nutzer:innen |
| **Datenkategorien** | Kunden- und Abonnementnummer, Sitzungsnummer des Bezahlvorgangs, Modell, Status, Ende der Abrechnungsperiode, Kündigungsmerkmal, Käuferland (`subscriptions`); Kennung und Zeitpunkt verarbeiteter Stripe-Ereignisse (`stripe_events`) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b; für die steuerliche Aufzeichnung Art. 6 Abs. 1 lit. c |
| **Empfänger** | Stripe Payments Europe Ltd. (für die Zahlungsdaten eigenverantwortlich), Supabase |
| **Drittland** | möglich, abgesichert über Standardvertragsklauseln |
| **Löschfrist** | Zeilen bei uns mit der Löschung des Kontos; die steuerlich aufzubewahrenden Belege liegen bei Stripe und unterliegen der siebenjährigen Frist des § 132 BAO |

> **Das ist eine Entscheidung, keine Selbstverständlichkeit.** Aufbewahrungs-
> pflichtiger nach § 132 BAO ist der Unternehmer, nicht Stripe. Weil unsere
> eigenen Zeilen mit dem Konto verschwinden, ist die Buchhaltung **allein**
> das Stripe-Dashboard. Das ist zulässig und im Kleinbetrieb üblich, hat aber
> eine Kehrseite: Zugang zu Unterlagen, die sieben Jahre vorzuhalten sind,
> hängt damit am Fortbestand eines fremden Kontos. Ein regelmäßiger Export der
> Stripe-Belege in die eigene Ablage schließt diese Lücke — er ist kein
> Datenschutzthema, sondern eines der Abgabenordnung.

> Zahlungsdaten — Kartennummer, Ablaufdatum, Prüfziffer — werden unmittelbar
> bei Stripe eingegeben und erreichen uns nie.

### V5 · Kursbuchungen

| | |
|---|---|
| **Zweck** | Anmeldung zu Workshops, Camps und Kursen, Platzvergabe, Anzahlung und Restzahlung |
| **Betroffene** | buchende Nutzer:innen mit Konto und Gäste ohne Konto |
| **Datenkategorien** | Kurs, Status, Gesamtbetrag, gezahlter Betrag, Anzahlung, Fälligkeit und Zahlung des Restbetrags, Reservierungsende, Zeitpunkt der AGB-Zustimmung, Stripe-Sitzungs- und Zahlungsnummer (`course_bookings`); bei Gästen zusätzlich E-Mail-Adresse und, falls angegeben, Name für die Teilnehmerliste (`guest_email`, `guest_name`) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b; für die Aufzeichnung Art. 6 Abs. 1 lit. c |
| **Empfänger** | Stripe, Supabase |
| **Löschfrist** | **sieben Jahre** nach § 132 BAO, gerechnet ab dem Ende des Kalenderjahres der Buchung. Löscht jemand das Konto, bleibt die Buchung ohne `user_id`, ohne Name und ohne E-Mail mit gesetztem `anonymized_at` stehen (seit 0022); eine unbezahlte Reservierung verfällt. Die Löschung nach Ablauf erfolgt einmal im Jahr im Jänner von Hand (SQL in `docs/INHALTE.md`, Abschnitt „Anonymisierte Kursbuchungen“). |

> **Geändert am 31.10.2026.** Bis 0022 verschwand die Buchung mit dem Konto
> (`on delete cascade`). Seitdem hängt sie mit `on delete set null` an
> `auth.users`, damit die Zahlungsaufzeichnung die Kontolöschung übersteht.
> Gastbuchungen behalten ihre E-Mail-Adresse bis zum Ablauf der Frist, weil
> sie zu keinem Konto gehören, das gelöscht werden könnte.

### V6 · Nachweis von Zustimmungen und Einwilligungen

| | |
|---|---|
| **Zweck** | Nachweisen, wer welcher Fassung von AGB und Datenschutzerklärung wann zugestimmt hat (Art. 7 Abs. 1, § 6 KSchG), und seit V1.1, wer wann in die Verarbeitung von Gesundheitsdaten im Tagebuch eingewilligt oder sie widerrufen hat (`health_data`) |
| **Betroffene** | registrierte Nutzer:innen |
| **Datenkategorien** | Art der Erklärung, Fassung, Zeitpunkt der Erteilung oder des Widerrufs, Herkunft (`user_consents`, `consent_definitions`) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. c in Verbindung mit Art. 7 Abs. 1 — Nachweispflicht |
| **Empfänger** | Supabase |
| **Löschfrist** | mit der Löschung des Kontos |

> Erklärungen werden nie überschrieben: Widerruf erzeugt eine **neue** Zeile.
> UPDATE und DELETE sind auf dieser Tabelle in der Datenbank verboten.
> Seit 0022 ist auch der Wortlaut einer **veröffentlichten** Fassung in
> `consent_definitions` per Trigger unveränderlich; eine Korrektur ist eine
> neue Version. Für das Tagebuch gilt derzeit `health_data` Version 3
> („Einwilligung Tagebuch“, 0027), die Datenschutzerklärung steht bei Version 4.
> Die Zustimmung im Bezahlvorgang (AGB und sofortiger Leistungsbeginn) liegt
> zusätzlich bei Stripe am jeweiligen Vorgang.

### V7 · Redaktionelle Inhalte

| | |
|---|---|
| **Zweck** | Öffentliche Darstellung von News, Kursen und Team |
| **Betroffene** | Teammitglieder (derzeit: der Inhaber selbst) |
| **Datenkategorien** | Name, Funktionsbezeichnung, Kurzvorstellung, Foto (`team_members`, Bucket `public-assets`) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. f — Darstellung des eigenen Angebots; bei künftigen Teammitgliedern Art. 6 Abs. 1 lit. a (Einwilligung, dann Eintrag in `user_consents`) |
| **Empfänger** | Supabase; öffentlich abrufbar |
| **Löschfrist** | bis zum Widerruf oder Ausscheiden — `published_at = null` nimmt die Zeile sofort aus der **Ansicht**; das Foto muss zusätzlich im Bucket gelöscht werden |

> **Korrigiert am 23.08.2026.** Der Bucket `public-assets` ist öffentlich
> (`public = true`, Migration 0004), und die Leseregel gilt für jeden. Wer die
> Bildadresse kennt, erreicht das Foto weiterhin — auch wenn die Zeile längst
> unveröffentlicht ist. Beim Ausscheiden oder Widerruf einer künftigen Person
> gehören deshalb **zwei** Handgriffe dazu: `published_at` leeren **und** die
> Datei im Bucket entfernen. Für den Inhaber selbst ist das folgenlos, für
> jede weitere Person ist es der Unterschied zwischen Löschung und Verstecken.

### V8 · Betroffenenrechte

| | |
|---|---|
| **Zweck** | Auskunft (Art. 15), Löschung (Art. 17), Datenübertragbarkeit (Art. 20) |
| **Betroffene** | registrierte Nutzer:innen |
| **Datenkategorien** | alle zum Konto gehörenden Zeilen; die Auskunft wird im Browser unter RLS zusammengestellt und als JSON-Datei ausgegeben. Seit V1.1 gehören dazu auch `exercise_favorites`, `user_habits`, `habit_logs`, `habit_templates` (nur eigene), `habit_favorites` und `exercise_sessions` (Liste `EXPORT_TABLES` in `src/features/auth/dataExport.ts`) — auch nach einem Widerruf der Einwilligung |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. c |
| **Empfänger** | keine — die Daten verlassen den Verantwortungsbereich nicht |
| **Löschfrist** | entfällt; es entsteht keine eigene Aufzeichnung über die Ausübung |

### V9 · E-Mail-Verkehr

| | |
|---|---|
| **Zweck** | Beantwortung von Anfragen an office@thehacode.com |
| **Betroffene** | Anfragende |
| **Datenkategorien** | Absenderadresse, Inhalt der Nachricht, Zeitpunkt |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b bei Vertragsbezug, sonst Art. 6 Abs. 1 lit. f |
| **Empfänger** | der Anbieter des Postfachs |
| **Löschfrist** | **ohne Vertragsbezug nach zwölf Monaten**; besteht Vertragsbezug, gilt die siebenjährige Frist des § 132 BAO für Geschäftsbriefe |

> Eine Zahl statt einer Bedingung, weil sich nur eine Zahl einhalten lässt.
> Vorher stand hier „wenn die Anfrage erledigt ist" — danach räumt niemand ein
> Postfach auf, und eine Frist, die im Verzeichnis steht, aber nie eintritt,
> ist schlechter als gar keine.

### V10 · Tagebuch (Gesundheitsdaten nach Art. 9) — seit V1.1

| | |
|---|---|
| **Zweck** | Den Nutzer:innen ihre eigenen Gewohnheiten, Einträge und Auswertungen anzeigen (Kalender, Serien, Verläufe, Übungsminuten, auf Wunsch Tagebuch-Score). Kein anderer Zweck. |
| **Betroffene** | registrierte Nutzer:innen, die das Tagebuch nutzen |
| **Datenkategorien** | **Gesundheitsdaten:** Einträge je Kalendertag — erledigt, Messwert (z. B. BOLT-Sekunden, Schritte), Text, Notiz (`habit_logs`); selbst angelegte Gewohnheiten mit Titel, Beschreibung, Kategorie, Erfassungsart, Einheit, Wertebereich, Punkten, Vorzeichen, Link (`habit_templates` mit `owner_id`). **Keine Gesundheitsdaten im engeren Sinn, aber im selben Zusammenhang:** gewählte Vorschläge, seit wann, Zielwert, Archivierung (`user_habits`); Habit-Favoriten (`habit_favorites`) |
| **Rechtsgrundlage** | Einträge und eigene Gewohnheiten: **Art. 9 Abs. 2 lit. a in Verbindung mit Art. 6 Abs. 1 lit. a** — ausdrückliche, gesonderte Einwilligung `health_data` vor dem ersten Eintrag, freiwillig und keine Voraussetzung für Konto oder Abonnement. Auswahl und Favoriten: Art. 6 Abs. 1 lit. b. Nachweis der Einwilligung: V6. |
| **Empfänger** | Supabase (Frankfurt). Keine Weitergabe, keine Werbung, keine Profilbildung, keine Forschung, keine Statistik über die Nutzer:innen. |
| **Drittland** | möglich über Unterauftragsverarbeiter von Supabase, abgesichert über Standardvertragsklauseln |
| **Löschfrist** | Einzelne Einträge: sofort beim Entfernen (echtes `DELETE`, Policy `habit_logs_delete_own`). Eigene Gewohnheit: verschwindet beim Löschen aus der Auswahl (`deleted_at`), bleibt mit ihren Einträgen für die Auswertungen bis zur Kontolöschung; auf Anfrage vorher vollständig (SQL in `docs/INHALTE.md`). Konto: alles sofort über `on delete cascade`. **Beim Widerruf** fragt die App, ob alles gelöscht werden soll; wer zustimmt, verliert sofort Einträge, Auswahl, Habit-Favoriten und eigene Habits (`delete_my_diary_data()`, 0033). Wer ablehnt, behält die Daten bis zur eigenen Löschung oder Kontolöschung. |

> **Wie die Einwilligung technisch durchgesetzt wird.** Schreiben in
> `habit_logs` erlaubt die Datenbank nur mit gültiger Einwilligung
> `health_data` und über `can_use_habit_template()` (Vorschau-Habit oder Plus);
> eigene Gewohnheiten anlegen nur mit Plus **und** Einwilligung (0025). Lesen
> erlaubt RLS ausschließlich dem Konto, dem die Zeile gehört. Ohne
> Einwilligung bleibt das Tagebuch leer, alle übrigen Funktionen bleiben
> nutzbar.
>
> **Keine Auswertung durch uns.** Score und Auswertungen werden in der App aus
> den eigenen Einträgen berechnet. Punkte gibt es für das Durchführen, nicht
> für die Höhe eines Messwerts. Wir ordnen keine Werte ein und treffen keine
> Entscheidungen auf ihrer Grundlage.
>
> **Datenschutz-Folgenabschätzung (Art. 35).** Einschätzung vom 31.10.2026,
> **vom Verantwortlichen zu bestätigen:** Art. 35 Abs. 3 lit. b verlangt eine
> DSFA bei *umfangreicher* Verarbeitung besonderer Kategorien. Das Tagebuch ist
> ein Nebenangebot eines Kleinbetriebs, die Daten sind von den Betroffenen
> selbst erfasst, nur für sie sichtbar und werden nicht ausgewertet. Daraus
> folgt nach dieser Einschätzung keine DSFA-Pflicht. Wächst die Nutzerzahl
> deutlich oder kommen Auswertungen durch uns dazu, ist das neu zu prüfen.

### V11 · Übungsprotokoll — seit V1.1

| | |
|---|---|
| **Zweck** | Übungsminuten pro Woche im Tagebuch anzeigen; nach Abschluss einer Sequenz das zugehörige Habit automatisch eintragen (nur mit Einwilligung, dann V10) |
| **Betroffene** | angemeldete Nutzer:innen, die eine Sequenz starten |
| **Datenkategorien** | welche Sequenz, Beginn, Abschluss, Dauer, abgeschlossene Runden, ob abgeschlossen (`exercise_sessions`) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b |
| **Empfänger** | Supabase |
| **Löschfrist** | mit der Löschung des Kontos (`on delete cascade`) |

> Das Protokoll sagt, *dass* geübt wurde, nicht wie es jemandem dabei ging.
> Darum behandeln wir es nicht als Gesundheitsdatum. Der automatische Eintrag
> ins Tagebuch dagegen ist eines und entsteht nur mit Einwilligung.

### V12 · Schutz vor missbräuchlichen Gastbuchungen — seit 0022

| | |
|---|---|
| **Zweck** | Verhindern, dass jemand einen Kurs mit erfundenen Gastreservierungen blockiert (höchstens fünf Versuche je Absender und Stunde; Gäste dürfen höchstens die Hälfte der Plätze offen halten) |
| **Betroffene** | Personen, die ohne Konto buchen |
| **Datenkategorien** | eine Kennung, die `create-course-checkout` als HMAC aus der IP-Adresse bildet, und der Zeitpunkt des Versuchs (`guest_booking_attempts`). Die IP-Adresse selbst wird nicht gespeichert. |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. f — faire Platzvergabe, Schutz vor Missbrauch |
| **Empfänger** | Supabase; kein Client kann die Tabelle lesen (RLS ohne Policy) |
| **Löschfrist** | 24 Stunden — **siehe Abschnitt 7**, wann genau gelöscht wird |

### Sicherungskopien — die Frist hinter allen anderen Fristen

| | |
|---|---|
| **Zweck** | Wiederherstellung nach technischem Ausfall |
| **Betroffene** | alle oben Genannten |
| **Datenkategorien** | vollständige Kopien der Datenbank |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. f in Verbindung mit Art. 32 Abs. 1 lit. c — Wiederherstellbarkeit ist selbst eine Pflicht |
| **Empfänger** | Supabase |
| **Löschfrist** | **derzeit gegenstandslos:** die Projekte laufen auf dem kostenlosen Plan, und der enthält **keine** automatischen Sicherungen |

> **Warum dieser Abschnitt trotzdem hier steht.** Ohne ihn liest sich die
> Zusage bei V2 — Löschung „sofort und vollständig" — wie ein Naturgesetz.
> Sie ist aber eine Eigenschaft des gebuchten Plans: Supabase sichert auf dem
> freien Plan gar nicht, auf **Pro** täglich mit sieben Tagen Vorhaltung, auf
> Team mit vierzehn. Heute stimmt der Satz also. **Am Tag des Wechsels auf Pro
> stimmt er nicht mehr** — dann überlebt eine gelöschte Zeile bis zu sieben
> Tage in den Sicherungen, und sowohl dieser Eintrag als auch die
> Datenschutzerklärung müssen das sagen.
>
> Der Wechsel ist bereits geplant (T17a, deutsche Auth-Mails brauchen Pro).
> Das ist genau der Fall aus Abschnitt 6: eine Auslassung fällt weg, ohne dass
> jemand eine Migration schreibt. Deshalb steht er dort jetzt als eigener
> Auslöser.

---

## 3. Was ausdrücklich **nicht** verarbeitet wird

Für die Vollständigkeit dieses Verzeichnisses ebenso wichtig wie die Liste oben,
weil dieselben Sätze in der Datenschutzerklärung stehen:

- ~~Keine Gesundheitsdaten nach Art. 9.~~ **Seit V1.1 (31.10.2026) entfallen:**
  Gesundheitsdaten gibt es jetzt, aber **nur im Tagebuch und nur mit
  ausdrücklicher Einwilligung** (V10). Außerhalb des Tagebuchs gilt weiter:
  keine Angaben zum Befinden.
- **Keine Analyse-, Tracking- oder Marketingwerkzeuge**, keine Werbenetzwerke,
  kein Profiling, keine automatisierte Entscheidungsfindung nach Art. 22.
- **Kein Fehler-Monitoring.** CLAUDE.md nennt Sentry als Ziel für technische
  Details; eingebunden ist es (Stand 21.08.2026) nicht. Kommt es dazu, braucht
  es hier einen Eintrag und einen in der Datenschutzerklärung.
- ~~Keine Sitzungsprotokolle.~~ **Seit V1.1 entfallen:** Für angemeldete
  Nutzer:innen gibt es das Übungsprotokoll (V11). Ohne Anmeldung wird
  weiterhin nichts mitgeschrieben.
- **Keine Einbindung von Musikdiensten.** Spotify und Apple Music erscheinen
  nur als gespeicherter Link (V3), nicht als eingebettetes Element.
- **Keine Cookies zu Analyse- oder Werbezwecken.** Im Browser liegt allein das
  Sitzungsmerkmal der Anmeldung, technisch notwendig und daher ohne
  Einwilligung zulässig.

---

## 4. Auftragsverarbeiter — Stand der Verträge

Alle drei Verträge sind **geschlossen**, und keiner davon wurde einzeln
angefordert oder unterschrieben. Bei allen dreien ist der Auftragsverarbeitungs-
vertrag Anhang der Nutzungsbedingungen, und deren Annahme gilt vertraglich als
Unterschrift — auch für die Standardvertragsklauseln. Art. 28 Abs. 9 DSGVO
lässt das ausdrücklich zu: schriftlich, „was auch in einem elektronischen Format
erfolgen kann".

| Dienstleister | Rolle | Vertrag nach Art. 28 | Fassung |
|---|---|---|---|
| Supabase | Datenbank, Auth, Storage, Edge Functions; erzeugt die Kontomails | geschlossen mit Annahme der Nutzungsbedingungen (DPA Klausel 12.2: „acceptance of the Agreement shall have the same effect as signing the SCCs") | Version 1, gültig ab 1. August 2026 |
| Hostinger | Hosting der Website; Versand der Kontomails (SMTP, seit 31.10.2026) | geschlossen als Anhang der Nutzungsbedingungen | Stand 18. August 2026 |
| Stripe | Zahlungsabwicklung (eigenverantwortlich für Zahlungsdaten, Auftragsverarbeiter im Übrigen) | geschlossen als Bestandteil des Services Agreement | Stand 18. November 2025 |

**Drittland.** Alle drei binden die Standardvertragsklauseln der EU ein, Modul 2
(Verantwortlicher an Auftragsverarbeiter). Die Supabase-Projekte liegen in
`eu-central-1` (Frankfurt); Supabase legt zusätzlich eine Transfer Impact
Assessment vor, die den Zugriff US-amerikanischer Behörden bewertet.

**Nachweise gehören als PDF mit Abrufdatum in die private Ablage, nicht ins
Repo** — dieses ist öffentlich. Anbieter überschreiben ihre Rechtstexte ohne
Ankündigung und ohne Archiv; Nachweis ist deshalb die abgerufene Fassung, nicht
der Link. Zur Ablage gehört je Dienst die Liste der Unterauftragsverarbeiter,
denn die Genehmigung, die wir mit dem Vertrag erteilen, bezieht sich auf genau
diese Liste.

**Was daraus folgt, aber noch aussteht:**

- **Änderungsbenachrichtigung abonnieren.** Supabase kündigt neue
  Unterauftragsverarbeiter 30 Tage im Voraus an — aber nur den Abonnenten der
  Liste. Ohne Abo läuft die Widerspruchsfrist ab, ohne dass wir davon erfahren.
- **Gegengezeichnete Einzelfassung**, falls gewünscht: bei Supabase über
  `privacy@supabase.com`, bei Hostinger über `gdpr@hostinger.com`. Rechtlich
  nicht nötig, im Ernstfall aber ein Dokument mit Namen und Datum statt eines
  Verweises auf fremde Nutzungsbedingungen.
- **Bei jedem neuen Dienst** gehört eine Zeile in diese Tabelle, bevor der
  erste Datensatz fließt. Sentry steht bewusst nicht hier — es ist genannt,
  aber nicht eingebunden.

---

## 5. Technische und organisatorische Maßnahmen (Art. 32)

Allgemeine Beschreibung, wie sie Art. 30 Abs. 1 lit. g verlangt:

- **Verschlüsselte Übertragung** durchgehend (HTTPS/TLS), erzwungen durch den
  Hoster; Schutz-Header werden bei jedem Durchlauf von einem Smoke-Test geprüft.
- **Zugriffsbeschränkung in der Datenbank selbst.** Jede Tabelle mit
  Personenbezug hat Row Level Security; Regeln ohne Nutzerbezug sind im Projekt
  verboten. Jede Regel wird mit einem Test auf den **Missbrauchsfall** belegt,
  nicht nur auf den Normalfall (pgTAP, läuft in der CI).
- **Trennung der Schlüssel.** Der `service_role`-Schlüssel liegt ausschließlich
  in den Function Secrets bei Supabase — nicht im Auslieferungspaket, nicht im
  Hosting-Panel, nicht in einer lokalen Datei. Der Browser kennt nur den
  öffentlichen Schlüssel, der ohne Anmeldung nichts sieht, was einer Person
  gehört.
- **Zahlungsdaten werden nie berührt.** Kartendaten gehen direkt an Stripe;
  eingehende Ereignisse werden gegen den Rohtext signaturgeprüft und sind
  gegen Doppelverarbeitung abgesichert.
- **Löschung durch Bauweise.** Jede Nutzertabelle hängt mit `on delete cascade`
  an `auth.users`; ein Test prüft laufend, dass keine Zeile zurückbleibt. Am
  23.08.2026 gegen die Migrationen nachgeprüft: `profiles`, `exercises`,
  `subscriptions`, `course_bookings` und `user_consents` hängen alle so. Am
  31.10.2026 ergänzt: `exercise_favorites`, `exercise_sessions`, `user_habits`,
  `habit_logs`, `habit_favorites` und eigene `habit_templates` hängen ebenfalls
  mit Kaskade daran. **Ausnahme seit 0022:** `course_bookings` hängt mit
  `on delete set null` daran und wird bei der Kontolöschung anonymisiert statt
  gelöscht (V5). Dass
  auf `user_consents` weder UPDATE noch DELETE erlaubt ist, steht dem nicht im
  Weg — die Sperre ist eine fehlende RLS-Regel, und der Kaskadenlauf der
  Datenbank unterliegt ihr nicht. Eine Löschsperre als Trigger hätte das
  Löschen des Kontos dagegen scheitern lassen.
- **Nachvollziehbarkeit der Änderungen.** Schemaänderungen ausschließlich als
  Migration im Repository, jede Änderung über einen Pull Request, automatische
  Prüfung vor der Auslieferung.
- **Gesundheitsdaten nur hinter Einwilligung.** Die Einwilligung `health_data`
  wird in der Datenbank selbst geprüft (RLS und `can_use_habit_template()`),
  nicht nur in der Oberfläche. Policies dazu sind mit pgTAP auf den
  Missbrauchsfall getestet.
- **Kein Klartext, wo eine Kennung reicht.** Für den Schutz vor Gastbuchungen
  wird die IP-Adresse nur als HMAC gespeichert (V12).
- **Härtung der Auslieferung** (seit Oktober 2026): HSTS, Referrer- und
  Permissions-Policy, Content-Security-Policy mit Hashes für Inline-Skripte,
  Edge Functions nehmen nur Anfragen der eigenen Domain an (CORS), Ausführungsrechte
  an `security definer`-Funktionen sind eingeschränkt (0031).
- **Security-Scan vor jedem Livegang** (Gitleaks, OSV-Scanner, GuardDog,
  zizmor, Opengrep, Splinter, ZAP; `docs/SECURITY-SCAN.md`). Er berichtet nur;
  Funde werden nach Absprache umgesetzt.
- **Datensparsamkeit als Voreinstellung.** Erhoben wird, was die Leistung
  braucht; alles Weitere steht in Abschnitt 3 als bewusste Auslassung.

---

## 6. Wann dieses Verzeichnis geändert werden muss

- Eine **neue Tabelle mit Personenbezug** entsteht → neuer Eintrag in
  Abschnitt 2, im selben Pull Request wie die Migration.
- Ein **neuer Dienstleister** kommt dazu → Zeile in Abschnitt 4 und Prüfung, ob
  die Datenschutzerklärung noch stimmt.
- Der **Supabase-Plan wechselt** → mit Pro entstehen tägliche Sicherungen mit
  sieben Tagen Vorhaltung. Ab diesem Tag ist die Löschung nicht mehr „sofort
  und vollständig", sondern sofort in der Datenbank und binnen sieben Tagen in
  den Sicherungen. Betrifft den Abschnitt „Sicherungskopien" **und** die
  Datenschutzerklärung. Der Satz, der dann unwahr wird, steht wörtlich in
  `src/i18n/locales/de/legal.json` unter `datenschutz.sections` → „Speicherdauer":
  „Löschen Sie Ihr Konto, werden Ihre Kontodaten und Ihre Sequenzen unmittelbar
  und vollständig entfernt." Kein Code ändert sich dabei — deshalb fällt es nur
  auf, wenn man hier nachsieht.
- **Ein Rechtstext ändert sich** → im selben Pull Request gehört das Feld
  `*.stand` in `src/i18n/locales/de/legal.json` mitgeändert. Am 23.08.2026
  aufgefallen, dass genau das einmal unterblieben ist: die
  Datenschutzerklärung wurde am 21.08. neu geschrieben (Commit `da75c58`), die
  AGB bekamen ihre neue Fassungsangabe, die Datenschutzerklärung nicht — sie
  wies sich weiter als Fassung vom 16. August aus, während die
  Zustimmungsdefinition in der Datenbank auf „die Fassung vom 21.08.2026"
  verweist. Der Nachweis zeigte damit auf ein Datum, das kein
  veröffentlichtes Dokument trug. Derselbe Ausrutscher traf den
  Haftungsausschluss: im selben Commit *angelegt*, aber mit „16. August"
  ausgewiesen, obwohl die AGB-Zustimmung ihn über § 5 AGB ausdrücklich in
  ihre Geltung einbezieht. Beide Daten stehen seit 23.08.2026 richtig.
  **Eine neue Zeile in `consent_definitions` braucht es dabei nur, wenn sich
  ändert, worauf sich die Zustimmung inhaltlich bezieht.** Eine Klarstellung
  wie die Speicherdauern vom 23.08. ist das nicht: sie beschreibt genauer,
  was ohnehin geschah, und niemand muss deshalb erneut gefragt werden. Die
  bestehenden Zustimmungen bleiben also bei Version 1 und beziehen sich
  weiterhin auf die Fassung vom 21.08. — das ist richtig so, denn zugestimmt
  wurde dem, was damals dastand.
- Eine **Auslassung aus Abschnitt 3 fällt weg** → das ist der gefährliche Fall.
  Genau daran ist die Datenschutzerklärung schon einmal falsch geworden (die
  Annahme „keine Nutzerkonten in dieser Phase" überlebte die Einführung von
  Konten und Zahlungen um zwei Monate). Wer eine dieser Zeilen streicht, prüft
  zuerst, welche Sätze in `src/i18n/locales/de/legal.json` dadurch unwahr
  werden.
- Eine **Entscheidung aus Abschnitt 7 fällt** → Eintrag hier anpassen und
  prüfen, ob die Datenschutzerklärung (Abschnitte „Tagebuch“, „Kursbuchungen“,
  „Speicherdauer“) noch stimmt.

---

## 7. Offene Punkte (Stand 31.10.2026)

1. ~~**Löschung nach Widerruf der Einwilligung `health_data`.**~~ **Entschieden
   am 31.10.2026:** Beim Widerruf bietet die App an, alles aus dem Tagebuch
   sofort zu löschen (Art. 17 Abs. 1 lit. b). Umgesetzt mit Migration 0033
   (`delete_my_diary_data()`, löscht nur Zeilen von `auth.uid()`) und dem
   Widerrufsdialog auf der Kontoseite. Erst wird widerrufen, dann gelöscht;
   scheitert das Löschen, bleibt ein Knopf für den neuen Versuch. Das
   Übungsprotokoll (V11) und der Nachweis des Widerrufs (V6) bleiben. **Noch
   offen:** In der Datenschutzerklärung (Abschnitt „Tagebuch“) gehört mit der
   nächsten Fassung ergänzt, dass beim Widerruf das sofortige Löschen angeboten
   wird (zusammen mit Punkt 3).
2. **24-Stunden-Frist bei Gastbuchungs-Kennungen (V12).** Die Datenschutz-
   erklärung sagt: „Die Kennung wird nach 24 Stunden gelöscht.“ Tatsächlich
   räumt `take_guest_booking_slot()` alte Kennungen nur **beim nächsten
   Gastbuchungsversuch** auf (0022, „Aufraeumen nebenbei“); einen
   zeitgesteuerten Job gibt es nicht (das Projekt verzichtet bewusst auf
   pg_cron, siehe 0010). Bucht tagelang niemand als Gast, bleiben Kennungen
   entsprechend länger liegen. Der Personenbezug ist gering (HMAC, keine IP),
   die Aussage ist aber nicht genau. **Zu entscheiden:** Aufräumen zusätzlich
   an einer regelmäßig aufgerufenen Stelle einbauen oder den Satz in der
   Datenschutzerklärung anpassen.3. **Datenschutzerklärung: Versand der Kontomails.** Abschnitt „Empfänger und
   Auftragsverarbeiter“ nennt Supabase für den „Versand der Kontomails“. Seit
   31.10.2026 verschickt sie Hostinger (V2). Mit der nächsten Fassung
   (`privacy` Version 5 per Migration, neues Datum in `legal.json`) anpassen,
   am besten zusammen mit den Entscheidungen zu Punkt 1 und 2. Außerdem fehlt
   im DNS von `deratemcode.at` noch der DKIM-Eintrag für den Hostinger-Versand.
