# Rechtstexte für Onlinekurse (V1.2): Entwurf

**Stand:** 3. November 2026 · **Status:** Entwurf, noch **nicht** veröffentlicht.

Diese Texte gehören zu V1.2 (SAD §11.2). Sie werden erst mit dem Livegang der
Onlinekurse veröffentlicht. Vorher würden AGB und Datenschutzerklärung etwas
beschreiben, das es nicht gibt. Veröffentlicht wird im Schritt 9 des
Umsetzungsplans:

1. Den Text in `src/i18n/locales/de/legal.json` übernehmen (AGB Teil E,
   Änderungen in Teil A und B, Datenschutz-Abschnitt „Onlinekurse“,
   Empfänger), dazu `agb.stand` und `datenschutz.stand`.
2. Eine Migration nach dem Muster von 0040/0041 anlegen, mit `terms` v3 und
   `privacy` v8 und den Wortlauten aus Abschnitt 4. Die Prüfsummen kommen in
   einen pgTAP-Test, die Zählung in `013_consents.test.sql` wird angepasst.
3. Verarbeitungsverzeichnis V13: Entwurfsvermerk entfernen und gegen die
   Migrationen abgleichen.
4. Vor dem Livegang prüfen (offene Fragen, Abschnitt 5).

Platzhalter in eckigen Klammern sind beim Livegang festzulegen.

---

## 1. AGB: Änderungen und neuer Teil E

### Teil A, Einleitung (geändert)

> Teil A gilt für alle unsere Leistungen. Teil B enthält die zusätzlichen
> Regeln für Workshops, Camps, Kurse und Events mit festen Terminen, Teil C
> jene für die App und das Abonnement, Teil E jene für Onlinekurse in der App.
> Widersprechen sich eine allgemeine und eine besondere Regel, geht die
> besondere vor.

### § 2 Art unserer Leistungen (Absatz 3 neu)

> Onlinekurse in der App (Teil E) sind digitale Inhalte. Sie sind
> aufgezeichnet und jederzeit abrufbar; es handelt sich nicht um
> Live-Unterricht.

### § 4 Rücktrittsrecht (Absatz neu, nach dem bestehenden letzten Absatz)

> Bei Onlinekursen (Teil E) erlischt das Rücktrittsrecht, sobald wir den
> Zugang freigeschaltet haben, wenn Sie vor dem Kauf ausdrücklich verlangt
> haben, dass wir vor Ablauf der Rücktrittsfrist damit beginnen, und Sie
> bestätigt haben, dass Sie damit Ihr Rücktrittsrecht verlieren (§ 18 Abs. 1
> Z 11 FAGG). Diese Bestätigung erhalten Sie mit dem Kaufbeleg.

### § 11 Anmeldung und Zahlung (Absatz 1 geändert)

> Für Onlinekurse in der App gilt Teil E. Die Anmeldung zu sonstigen
> Online-Kursen erfolgt per E-Mail oder über das Anmeldeformular beim
> jeweiligen Kurs; die Bezahlung erfolgt per Überweisung.

### Teil E — Onlinekurse in der App

> Ergänzend zu Teil A gilt für Onlinekurse in der Anwendung DER ATEMCODE
> Folgendes.

**§ 22 Leistung**

> Ein Onlinekurs besteht aus aufgezeichneten Inhalten: Erklärvideos,
> gesprochenen Anleitungen, Texten mit Bildern, Unterlagen zum Herunterladen
> und einem Wissensquiz am Ende. Es gibt keine Live-Termine.
>
> Der vorgeschlagene Zeitverlauf ist eine Empfehlung. Alle Inhalte eines
> freigeschalteten Kurses sind sofort abrufbar.
>
> Für die Wiedergabe gesprochener Anleitungen muss der Bildschirm des Geräts
> eingeschaltet bleiben. Auf manchen Geräten, insbesondere iPhones, endet die
> Wiedergabe, sobald das Gerät gesperrt wird.

**§ 23 Zugang**

> Bei jedem Onlinekurs ist angegeben, wie er zugänglich ist:
> 1. für alle, auch ohne Konto (Fortschritt, Quiz und Zertifikat nur mit Konto),
> 2. kostenlos mit einem Konto,
> 3. im Abonnement „Plus“ enthalten, für die Dauer des Abonnements,
> 4. als Einzelkauf.
>
> Lernfortschritt, Planung im Tagebuch, Quiz und Zertifikat setzen ein Konto
> voraus.

**§ 24 Einzelkauf**

> Der Vertrag über einen einzeln gekauften Onlinekurs kommt zustande, wenn Sie
> den Bezahlvorgang bei unserem Zahlungsdienstleister abschließen. Die
> Freischaltung erfolgt unmittelbar nach Bestätigung der Zahlung.
>
> Der Preis ist ein Einmalpreis. Kundinnen und Kunden mit aufrechtem
> Abonnement „Plus“ erhalten zum Zeitpunkt des Kaufs 15 Prozent Rabatt.
>
> Der Zugang gilt **ein Jahr ab dem Kauf** und verlängert sich nicht. Ein
> erneuter Kauf nach Ablauf ist möglich. [Festlegen: erneuter Kauf ja/nein]
>
> Heruntergeladene Unterlagen dürfen Sie für eigene, nicht gewerbliche Zwecke
> auch nach Ablauf behalten (§ 7 gilt im Übrigen).

**§ 25 Wissensquiz und Zertifikat**

> Ein Zertifikat erhalten Sie, wenn alle Inhalte des Kurses als erledigt
> markiert sind und Sie das Wissensquiz mit mindestens 80 Prozent richtigen
> Antworten bestanden haben. Das Quiz lässt sich beliebig oft wiederholen.
>
> Das Zertifikat bestätigt die Teilnahme am Onlinekurs und das bestandene
> Quiz. Es ist keine staatlich anerkannte Qualifikation und keine Ausbildung
> zur Anleitung anderer.
>
> Den Namen auf dem Zertifikat wählen Sie bei der Ausstellung selbst; danach
> ist er nicht mehr änderbar. Über einen Prüfcode kann jede Person, der Sie
> ihn weitergeben, Name, Kurs und Ausstellungsdatum bestätigen lassen.
> Zertifikate bleiben abrufbar, solange Ihr Konto besteht, auch nach Ablauf
> des Kurszugangs.

**§ 26 Gesundheit**

> § 5 und der Haftungsausschluss gelten für Onlinekurse uneingeschränkt.
> Führen Sie Atemübungen nie beim Autofahren, im Wasser oder in anderen
> Situationen aus, in denen ein kurzer Schwindel gefährlich werden kann.

---

## 2. Datenschutzerklärung Fassung 8

### Neuer Abschnitt „Onlinekurse“ (nach „Kursbuchungen“)

> Wenn Sie einen Onlinekurs nutzen, speichern wir, welche Kurse Sie gekauft
> oder freigeschaltet haben (bei einem Kauf mit Kaufzeitpunkt und Ablauf des
> Zugangs), welche Inhalte Sie erledigt haben, welche Termine Sie im Tagebuch
> eingeplant haben, Ihre Antworten im Wissensquiz samt Ergebnis und, wenn Sie
> eines ausstellen lassen, Ihr Zertifikat mit dem gewählten Namen, dem Datum
> und einem Prüfcode.
>
> Rechtsgrundlage ist die Erfüllung des Vertrags (Art. 6 Abs. 1 lit. b DSGVO).
> Diese Angaben sind keine Gesundheitsdaten. Sie fließen nicht in Ihr
> Tagebuch und nicht in den Habit Score; eingeplante Kurstermine werden dort
> nur angezeigt.
>
> Rufen Sie mit einem Prüfcode die Prüfseite auf, zeigt sie Name, Kurs und
> Datum des Zertifikats. Weitere Daten gibt sie nicht preis. Den Prüfcode
> geben nur Sie selbst weiter.
>
> Kursvideos spielen wir über Vimeo (Vimeo.com, Inc., USA) aus, eingebettet
> mit der Einstellung „Do Not Track“: Vimeo setzt dabei keine Cookies zur
> Wiedererkennung, erhält beim Abspielen aber Ihre IP-Adresse und technische
> Gerätedaten. [Vor Livegang prüfen: Grundlage der Übermittlung (EU-US Data
> Privacy Framework) und ob Vimeo als Auftragsverarbeiter mit Vertrag oder als
> eigener Verantwortlicher einzuordnen ist.] Gesprochene Anleitungen,
> Bilder und Unterlagen liegen bei Supabase in der EU und werden nur nach
> Prüfung Ihres Zugangs über zeitlich begrenzte Links ausgeliefert.
>
> Gelöscht wird alles mit Ihrem Konto. Zahlungsbelege bewahrt der
> Zahlungsdienstleister nach den steuerrechtlichen Fristen auf (siehe
> „Zahlungsabwicklung“).

### Abschnitt „Empfänger und Auftragsverarbeiter“ (ergänzen)

> Vimeo.com, Inc., USA: Ausspielen von Kursvideos (siehe „Onlinekurse“).

### Abschnitt „Speicherdauer“ (ergänzen)

> Onlinekurse: bis zur Löschung des Kontos; Zertifikate bleiben bis dahin
> abrufbar.

---

## 3. Kaufdialog und Beleg (FAGG)

**Häkchen im Kaufdialog** (Pflicht, nicht vorausgewählt):

> Ich möchte sofort Zugang zu den Inhalten. Mir ist bewusst, dass ich damit
> mein Rücktrittsrecht verliere, sobald der Zugang freigeschaltet ist.

**Auf dem Stripe-Beleg** (`custom_text` bzw. `invoice_creation`, siehe
`supabase/functions/_HINWEIS.md`):

> Sie haben verlangt, dass der Zugang sofort freigeschaltet wird, und
> bestätigt, dass Ihr Rücktrittsrecht damit erlischt (§ 18 Abs. 1 Z 11 FAGG).
> Zugang bis [Datum].

Das schließt für Onlinekurse auch die Lücke aus T19a (Bestätigung auf dem
Beleg, §4.5 SAD).

---

## 4. Wortlaute der Einwilligungs-Definitionen

`terms` v3:

> Ich habe die Allgemeinen Geschäftsbedingungen in der Fassung vom
> [TT.MM.JJJJ] gelesen und stimme ihnen zu. Sie sind unter /agb abrufbar. Teil
> ihrer Geltung ist der Haftungsausschluss unter /haftungsausschluss (§ 5 AGB).

`privacy` v8:

> Ich habe die Datenschutzerklärung in der Fassung 8 vom [TT.MM.JJJJ] zur
> Kenntnis genommen. Sie ist unter /datenschutz abrufbar und beschreibt,
> welche Daten zu welchem Zweck verarbeitet werden.

Beides ohne erneute Zustimmung bestehender Konten (wie 0040/0041): Teil E
betrifft nur, wer einen Onlinekurs nutzt, und gilt für den einzelnen Kauf in
der Fassung beim Kauf (§ 10 Abs. 1 AGB).

---

## 5. Vor dem Livegang zu klären

- Erneuter Kauf nach Ablauf erlaubt? (§ 24)
- Gäste können `public`-Kurse ansehen, Speichern erst mit Konto? (§ 23)
- Vimeo: Einordnung (Auftragsverarbeiter oder eigener Verantwortlicher),
  Übermittlungsgrundlage, Einbettung mit `dnt=1`
- Bezahlter Vimeo-Tarif aktiv, bevor der erste `paid`- oder `plus`-Kurs online
  geht (SAD §11.2)
- Bezeichnung „Zertifikat“ mit dem Hinweis aus § 25 ausreichend? Im Zweifel
  vom Steuer- oder Rechtsberater bestätigen lassen
