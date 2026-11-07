# Geräte-Anbindung Oura und Garmin

Stand 07.11.2026 · Migrationen `0053`, `0054` · **nur Testsystem (Staging)**

Wer mag, verbindet seinen Oura-Ring und/oder seine Garmin-Uhr. Die App füllt
dann die gewählten Lebensstil-Habits selbst aus und zeigt weitere Tageswerte in
der Auswertung. Es werden nur **Tageswerte** übertragen, keine Verläufe und
keine Einzelmessungen.

## Was gefüllt wird

| Wert | Oura | Garmin | Im Tagebuch als Habit |
|---|---|---|---|
| Schritte | `daily_activity.steps` | `dailies.steps` | `schritte` |
| Schlafdauer (Std.) | Summe `long_sleep` | Tief + Leicht + REM | `schlafdauer` |
| Schlafwert (0–100) | `daily_sleep.score` | `sleeps.overallSleepScore` | `schlafqualitaet-wearable` |
| Etagen | – | `dailies.floorsClimbed` | `etagen` (neu, `docs/inhalte/wearables.sql`) |
| Intensitätsminuten | mäßig + 2 × intensiv | mäßig + 2 × intensiv | `intensitaetsminuten` (neu) |
| Gewicht (kg) | – (Oura misst kein Gewicht) | `bodyComps.weightInGrams`, letzte Messung des Tages | `gewicht` (neu, ohne Punkte, `is_health_measure`) |
| Ruhepuls | niedrigster Wert im Hauptschlaf | `restingHeartRate…` | nur Auswertung |
| Body Battery | – | Tagesdurchschnitt aus `stressDetails` | nur Auswertung |
| Stress (0–100) | – | `averageStressLevel` | nur Auswertung |
| Zeit mit hohem Stress | `daily_stress.stress_high` | – | nur Auswertung |
| Atemfrequenz im Schlaf | `average_breath` | Durchschnitt `timeOffsetSleepRespiration` | nur Auswertung |

Liefern beide Geräte denselben Wert, steht im Tagebuch der **Durchschnitt**.
Die Diagramme in der Auswertung zeigen Durchschnitt, Oura und Garmin. Stress
und Body Battery mischen wir nicht mit Oura: Oura misst etwas anderes (Minuten
statt einer Skala von 0 bis 100), ein Durchschnitt wäre irreführend.

**Regeln, die in der Datenbank sitzen** (`0053`, geprüft in
`supabase/tests/053_wearables.test.sql`):

- Gespeichert wird nur mit Einwilligung `health_data` und bestehender Verbindung.
- Ein Habit wird nur gefüllt, wenn es im Tagebuch steht und die Person es
  benutzen darf (`can_use_habit_template()`, also Plus für Schritte & Co.).
- Was die Person selbst einträgt oder korrigiert, überschreibt der Abgleich nie
  (`habit_logs.source`, den der Client nicht setzen kann).
- Werte außerhalb der Grenzen eines Habits entfallen.
- Trennen löscht die Tageswerte des Anbieters. Die Tagebuch-Einträge bleiben,
  wo der andere Anbieter Werte hat, wird neu gemittelt.
- Widerruf von `health_data` löscht auch Verbindungen, Schlüssel und Tageswerte.

## Aufbau

```
App (/habit-tracker/geraete)
  │  start → Adresse zum Anbieter (state verschlüsselt: Person, Anbieter, PKCE, 10 min)
  ▼
Oura / Garmin  ── Freigabe ──►  zurück auf /habit-tracker/geraete?code&state
  │                               │ finish (mit Sitzung der Person — state muss zu ihr passen)
  ▼                               ▼
Edge Function wearables ──► wearable_secrets (Tokens AES-GCM-verschlüsselt)
  │  sync (Oura, still beim Öffnen des Tagebuchs, höchstens alle 3 h)
  ▼
save_wearable_days() ──► wearable_daily ──► apply_wearable_days() ──► habit_logs

Garmin ── Push ──► Edge Function wearables-garmin (?key=…)   Starter-Zugang
                    └─ Daten stehen im Körper, gespeichert für bekannte Garmin-IDs
Garmin ── Ping ──► dieselbe Funktion                         Enterprise-Zugang
                    └─ holt bei apis.garmin.com mit dem Token der Person ab
```

## Einrichtung auf Staging

### 1. Oura

1. Unter <https://cloud.ouraring.com/oauth/applications> eine Anwendung anlegen.
2. Redirect URI: `https://dev.deratemcode.at/habit-tracker/geraete`
   (für lokal zusätzlich `http://localhost:8081/habit-tracker/geraete`).
3. Scope: `daily`.
4. Client ID und Secret notieren.

Hinweis: Oura gibt API-Daten nur mit **aktiver Oura-Mitgliedschaft** heraus.
Ohne sie zeigt die App „Oura gibt die Werte nur mit aktiver Mitgliedschaft heraus“.

### 2. Garmin

Garmin hat das Developer Program im Oktober 2026 neu geordnet (Stand 07.11.2026):

| Stufe | Für | Lieferung | Rückschau | Kosten |
|---|---|---|---|---|
| Personal | eigene Daten einer Person | nur Pull | – | frei |
| **Starter** | Firmen, Einstieg | **nur Push** | **keine** | frei (laut Fachpresse) |
| Enterprise | Firmen im großen Stil | Push oder Ping/Pull | ab 1 Monat | nach Vereinbarung |

**Personal scheidet aus:** laut Garmin-FAQ „not intended for commercial
applications serving multiple end users“; Schlüssel laufen nach höchstens
einem Jahr ab. Nur zum Prüfen der Feldnamen mit den eigenen Daten nutzbar.

**Wir nutzen Starter.** Die Funktion `wearables-garmin` nimmt Push und Ping an
(`splitGarminNotification`), so passt sie ohne Umbau auch zu Enterprise.
Ohne Rückschau stehen Garmin-Werte erst ab dem Tag des Verbindens im
Tagebuch; die Rückschau-Anfrage nach dem Verbinden lehnt Garmin bei Starter ab,
folgenlos.

1. Beim **Garmin Connect Developer Program** eine App mit **Starter Access**
   beantragen: <https://developer.garmin.com/gc-developer-program/>. Nötig sind
   eine öffentliche Website und eine veröffentlichte Datenschutzerklärung.
2. Im Portal OAuth 2.0 (PKCE) wählen, Redirect URI wie bei Oura.
3. Summary-Typen **Dailies, Sleeps, Stress Details, Body Compositions** im
   Modus **Push** sowie **Deregistrations** und **User Permissions** auf diese
   Adresse stellen:
   `https://tlhjtkmfdzylzpkqdkrn.supabase.co/functions/v1/wearables-garmin?key=<GARMIN_WEBHOOK_KEY>`
4. **Schlüssel schützen:** Bei Push ist `GARMIN_WEBHOOK_KEY` der einzige Schutz
   gegen eingeschleuste Werte. Nie weitergeben; bei Verdacht neu erzeugen und
   im Portal tauschen.
5. **Nach der Freischaltung prüfen:** Adressen (`GARMIN` in
   `supabase/functions/_shared/wearables.ts`), Feldnamen und das Push-Format
   gegen echte Daten. Sie sind nach bestem Wissen gesetzt, aber noch nicht
   gegen echte Antworten getestet.

### 2a. Garmin mit persönlichem Schlüssel (Test, erster Import)

Auf der Garmin-Karte unter „Geräte“: Die Person fügt ihren **Personal API
Key** ein (Garmin Connect im Browser → Einstellungen → Personal API Token,
am besten 30 Tage Laufzeit). Die Funktion `wearables` (`action:
"garmin_personal"`) tauscht ihn gegen ein Zugriffstoken, lädt die letzten
30 Tage in 10-Tage-Stücken und speichert sie über `save_wearable_days()`.
**Der Schlüssel wird nicht gespeichert und nicht geloggt.** Gibt es noch
keine Garmin-Verbindung, legt der Import eine ohne Schlüssel an; „Trennen“
löscht die Werte wie gewohnt.

- Braucht **keine** Garmin-Secrets, nur `WEARABLES_ENABLED`, `WEARABLE_TOKEN_KEY`
  und die Einwilligung `health_data`.
- Adressen aus Garmins Beispiel-Client
  (<https://github.com/garmin/connect-personal-api-python>); die
  **Antwortformate sind nicht veröffentlicht**. `garminPersonalToDays()`
  versucht deshalb mehrere Feldnamen. Das Log der Funktion
  (`garmin-personal shapes`, nur Feldnamen) zeigt, was wirklich kommt –
  danach nachschärfen.
- **Bedingungen:** Garmin schreibt zur Personal API „not intended for
  commercial applications serving multiple end users“. Für Tests mit eigenen
  Daten unproblematisch; für Endnutzer vor einem Livegang mit Garmin klären.

### 3. Function Secrets (nur Staging)

```bash
supabase secrets set --project-ref tlhjtkmfdzylzpkqdkrn \
  WEARABLES_ENABLED=true \
  WEARABLE_TOKEN_KEY="$(openssl rand -base64 32)" \
  OURA_CLIENT_ID=... OURA_CLIENT_SECRET=... \
  GARMIN_CLIENT_ID=... GARMIN_CLIENT_SECRET=... \
  GARMIN_WEBHOOK_KEY="$(openssl rand -hex 24)"
```

`WEARABLE_TOKEN_KEY` **nie wechseln**, solange Verbindungen bestehen: ohne ihn
lassen sich die gespeicherten Tokens nicht mehr entschlüsseln (dann alle
Verbindungen trennen und neu verbinden). Auf Live wird **nichts** davon gesetzt.

### 4. Inhalte (nur Staging)

`docs/inhalte/wearables.sql` im SQL Editor von Staging ausführen: legt die
Habits „Etagen gestiegen“, „Intensitätsminuten“ und „Gewicht“ an.

## Warum Live aus bleibt

Drei Schalter, jeder für sich reicht:

1. `src/features/wearables/flag.ts`: `WEARABLES_ENABLED` ist auf Live `false`.
   Keine Einstellung, keine Geräte-Seite, keine Diagramme, kein Abgleich.
2. Die Edge Functions antworten ohne Secret `WEARABLES_ENABLED=true` mit 404.
3. Ohne `docs/inhalte/wearables.sql` gibt es auf Live die zwei neuen Habits nicht.

Die Tabellen aus `0053` kommen mit der nächsten Beförderung nach Live. Sie
bleiben dort leer und ändern nichts am Verhalten. Einzig `0053` setzt
`wearable_metric` an drei bestehenden Vorlagen und ersetzt
`delete_my_diary_data()` durch eine Fassung, die zusätzlich die (leeren)
Gerätetabellen löscht.

## Rücknahme

Wenn es nicht funktioniert oder nicht gefällt — in dieser Reihenfolge, alles
ohne zerstörende Migration (SAD §2.6):

1. **Sofort aus:** auf Staging `supabase secrets unset --project-ref <staging-ref> WEARABLES_ENABLED`.
   Die Functions antworten dann mit 404, die App zeigt bei Verbinden und
   Abgleichen eine Fehlermeldung, sonst bleibt alles wie es ist.
2. **Oberfläche aus:** in `flag.ts` `export const WEARABLES_ENABLED = false;`
   (PR nach `develop`).
3. **Daten weg:** bestehende Verbindungen auf Staging löschen, als postgres im SQL Editor:
   ```sql
   select public.remove_wearable(user_id, provider) from public.wearable_connections;
   ```
   Die Tokens bei Oura/Garmin verfallen dann von selbst; Nutzer können den
   Zugriff zusätzlich in der Oura- bzw. Garmin-Connect-App entfernen.
4. **Habits zurückziehen:** Block am Ende von `docs/inhalte/wearables.sql`.
5. Code entfernen: den PR mit `git revert` zurücknehmen — **ohne** die
   Migration `0053`. Sie bleibt im Repo (die Datenbank kennt sie schon), ihre
   Tabellen bleiben leer. Ein späteres Entfernen der Tabellen wäre eine eigene,
   bewusst geplante Migration nach dem Dreischritt aus CLAUDE.md.

## Offen, bevor das nach Live dürfte

- **Datenschutz:** Datenschutzerklärung, Text der Einwilligung `health_data`
  und Verarbeitungsverzeichnis um Oura und Garmin als Quelle ergänzen;
  Auftragsverarbeitung bzw. Rolle der Anbieter klären (beide sind eigene
  Verantwortliche, die Person gibt ihre Daten frei); DSFA ergänzen.
- **Medizinprodukt (SAD §5.7):** Die App bewertet die Werte nicht, keine
  Normbereiche. Punkte gibt es weiter nur über die Wertgrenzen der Habits
  (Schritte, Schlaf). Die offene MDR-Einordnung des Schlafwerts (0048) gilt
  hier genauso.
- Garmin-Freischaltung und Prüfung der Felder gegen echte Antworten.
- Erinnerung: `WEARABLE_TOKEN_KEY` gehört zu den Function Secrets wie der
  `service_role`-Key — nirgends sonst.
