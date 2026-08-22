# Verzeichnis von Verarbeitungstätigkeiten

Nach Art. 30 Abs. 1 DSGVO. Gehört zu **T19**.

> **Entwurf, noch nicht in Kraft.** Zusammengetragen aus dem, was im Repo
> tatsächlich steht — Migrationen, Edge Functions, Datenschutzerklärung. Was
> hier steht, ist damit belegbar; was nicht belegbar war, steht nicht drin.
> Die Auftragsverarbeitungsverträge sind inzwischen geschlossen (Abschnitt 4).
> Offen bleibt eine Prüfung, die nur ein Mensch machen kann: ob die
> Speicherdauern dem entsprechen, was tatsächlich passiert.

**Stand:** 22. August 2026 · **Nächste Prüfung:** bei jeder neuen Tabelle mit
Personenbezug, spätestens vor V1.1 (Atem-Tagebuch — dann fallen erstmals
Gesundheitsdaten nach Art. 9 an, und dieses Verzeichnis braucht einen eigenen
Eintrag samt Rechtsgrundlage).

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
| **Löschfrist** | nach den Vorgaben des Hosters; wir werten die Protokolle nicht aus und führen sie mit nichts zusammen |

### V2 · Nutzerkonto

| | |
|---|---|
| **Zweck** | Registrierung, Anmeldung, Sitzungen, Passwort zurücksetzen, Kontoführung |
| **Betroffene** | registrierte Nutzer:innen |
| **Datenkategorien** | E-Mail-Adresse, Passwort-Hash, Zeitpunkte von Registrierung und letzter Anmeldung (`auth.users`, verwaltet von Supabase Auth); Anzeigename, Sprache, Zeitzone, Tonschalter, Zugriffsmerkmal (`public.profiles`) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b — Erfüllung des Nutzungsvertrags |
| **Empfänger** | Supabase (Auftragsverarbeiter, betreibt auch den Versand der Kontomails) |
| **Drittland** | möglich, abgesichert über Standardvertragsklauseln |
| **Löschfrist** | mit der Löschung des Kontos; sie erfolgt sofort und vollständig über `on delete cascade` (Edge Function `delete-account`) |

> Kein eigenes Passwort-Hashing, keine eigene Sitzungstabelle — die
> Nutzerverwaltung liegt vollständig bei Supabase Auth (CLAUDE.md).

### V3 · Eigene Atemsequenzen

| | |
|---|---|
| **Zweck** | Speichern und Abspielen selbst gebauter Sequenzen (die bezahlte Funktion) |
| **Betroffene** | registrierte Nutzer:innen |
| **Datenkategorien** | Titel, Untertitel, Blöcke, Phasen, Dauern, Rundenzahlen, Pausen (`exercises`, `exercise_steps`, `exercise_phases`) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b |
| **Empfänger** | Supabase |
| **Löschfrist** | mit der Löschung des Kontos oder der einzelnen Sequenz |

> Diese Angaben beschreiben eine Übung, nicht die Person. Es wird **nicht**
> mitgeschrieben, ob, wann oder wie lange jemand geübt hat — ein
> Sitzungsprotokoll gibt es in V1 nicht.

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

> Zahlungsdaten — Kartennummer, Ablaufdatum, Prüfziffer — werden unmittelbar
> bei Stripe eingegeben und erreichen uns nie.

### V5 · Kursbuchungen

| | |
|---|---|
| **Zweck** | Anmeldung zu Workshops, Camps und Kursen, Platzvergabe, Anzahlung und Restzahlung |
| **Betroffene** | buchende Nutzer:innen |
| **Datenkategorien** | Kurs, Status, Gesamtbetrag, gezahlter Betrag, Anzahlung, Fälligkeit und Zahlung des Restbetrags, Reservierungsende, Zeitpunkt der AGB-Zustimmung, Stripe-Sitzungs- und Zahlungsnummer (`course_bookings`) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b; für die Aufzeichnung Art. 6 Abs. 1 lit. c |
| **Empfänger** | Stripe, Supabase |
| **Löschfrist** | mit der Löschung des Kontos; der steuerliche Beleg ist die Zahlung bei Stripe, nicht diese Zeile |

### V6 · Nachweis von Zustimmungen und Einwilligungen

| | |
|---|---|
| **Zweck** | Nachweisen, wer welcher Fassung von AGB und Datenschutzerklärung wann zugestimmt hat (Art. 7 Abs. 1, § 6 KSchG) |
| **Betroffene** | registrierte Nutzer:innen |
| **Datenkategorien** | Art der Erklärung, Fassung, Zeitpunkt der Erteilung oder des Widerrufs, Herkunft (`user_consents`, `consent_definitions`) |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. c in Verbindung mit Art. 7 Abs. 1 — Nachweispflicht |
| **Empfänger** | Supabase |
| **Löschfrist** | mit der Löschung des Kontos |

> Erklärungen werden nie überschrieben: Widerruf erzeugt eine **neue** Zeile.
> UPDATE und DELETE sind auf dieser Tabelle in der Datenbank verboten.
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
| **Löschfrist** | bis zum Widerruf oder Ausscheiden — `published_at = null` nimmt die Zeile sofort aus der Ansicht |

### V8 · Betroffenenrechte

| | |
|---|---|
| **Zweck** | Auskunft (Art. 15), Löschung (Art. 17), Datenübertragbarkeit (Art. 20) |
| **Betroffene** | registrierte Nutzer:innen |
| **Datenkategorien** | alle zum Konto gehörenden Zeilen; die Auskunft wird im Browser unter RLS zusammengestellt und als JSON-Datei ausgegeben |
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
| **Löschfrist** | wenn die Anfrage erledigt ist und keine Aufbewahrungspflicht besteht |

---

## 3. Was ausdrücklich **nicht** verarbeitet wird

Für die Vollständigkeit dieses Verzeichnisses ebenso wichtig wie die Liste oben,
weil dieselben Sätze in der Datenschutzerklärung stehen:

- **Keine Gesundheitsdaten nach Art. 9.** Kein Tagebuch, keine Messwerte, keine
  Angaben zum Befinden. Die Consent-Definition `health_data` ist angelegt, aber
  unveröffentlicht — sie wird erst mit V1.1 gebraucht.
- **Keine Analyse-, Tracking- oder Marketingwerkzeuge**, keine Werbenetzwerke,
  kein Profiling, keine automatisierte Entscheidungsfindung nach Art. 22.
- **Kein Fehler-Monitoring.** CLAUDE.md nennt Sentry als Ziel für technische
  Details; eingebunden ist es (Stand 21.08.2026) nicht. Kommt es dazu, braucht
  es hier einen Eintrag und einen in der Datenschutzerklärung.
- **Keine Sitzungsprotokolle** — wann und wie lange jemand übt, wird nicht
  gespeichert.
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
| Supabase | Datenbank, Auth, Storage, Edge Functions, Kontomails | geschlossen mit Annahme der Nutzungsbedingungen (DPA Klausel 12.2: „acceptance of the Agreement shall have the same effect as signing the SCCs") | Version 1, gültig ab 1. August 2026 |
| Hostinger | Hosting der Website | geschlossen als Anhang der Nutzungsbedingungen | Stand 18. August 2026 |
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
  an `auth.users`; ein Test prüft laufend, dass keine Zeile zurückbleibt.
- **Nachvollziehbarkeit der Änderungen.** Schemaänderungen ausschließlich als
  Migration im Repository, jede Änderung über einen Pull Request, automatische
  Prüfung vor der Auslieferung.
- **Datensparsamkeit als Voreinstellung.** Erhoben wird, was die Leistung
  braucht; alles Weitere steht in Abschnitt 3 als bewusste Auslassung.

---

## 6. Wann dieses Verzeichnis geändert werden muss

- Eine **neue Tabelle mit Personenbezug** entsteht → neuer Eintrag in
  Abschnitt 2, im selben Pull Request wie die Migration.
- Ein **neuer Dienstleister** kommt dazu → Zeile in Abschnitt 4 und Prüfung, ob
  die Datenschutzerklärung noch stimmt.
- Eine **Auslassung aus Abschnitt 3 fällt weg** → das ist der gefährliche Fall.
  Genau daran ist die Datenschutzerklärung schon einmal falsch geworden (die
  Annahme „keine Nutzerkonten in dieser Phase" überlebte die Einführung von
  Konten und Zahlungen um zwei Monate). Wer eine dieser Zeilen streicht, prüft
  zuerst, welche Sätze in `src/i18n/locales/de/legal.json` dadurch unwahr
  werden.
