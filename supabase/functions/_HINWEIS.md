# Edge Functions

Sechs Stück, alle unter Deno. `supabase functions deploy` in `deploy.yml` rollt
sie bei jedem Durchlauf komplett aus — einzeln benennen muss man nichts.

| Funktion | Wozu | JWT |
|---|---|---|
| `delete-account` | Konto löschen (Apple-Anforderung, SAD §4.1) | ja |
| `create-checkout` | Bezahlseite fürs Abo bestellen | ja |
| `create-course-checkout` | Kursplatz halten und Bezahlseite bestellen (T20) | ja |
| `create-portal` | Kundenportal öffnen (kündigen, Rechnungen) | ja |
| `get-prices` | Was Plus kostet — gelesen bei Stripe (T17) | ja |
| `stripe-webhook` | **die einzige Stelle, die Abos und Buchungen schreibt** | **nein** |

`_shared/` wird nicht ausgerollt — Verzeichnisse mit `_` überspringt die CLI.
Die reine Logik daraus (`entitlement.ts`, `stripe-events.ts`,
`course-bookings.ts`) läuft unter Vitest und ist damit die einzige
Stripe-Fachlogik mit Tests.

Der Webhook hat seit T20 **zwei Zweige**, getrennt an `metadata.payment_kind`:
ist es gesetzt, gehört die Zahlung zu einer Kursbuchung und fasst
`subscriptions` nicht an; ist es leer, ist es ein Abo und `course_bookings`
bleibt unberührt. Der Betriebsablauf für Kurse steht in `docs/KURSBUCHUNG.md`.

`create-course-checkout` braucht **keine eigenen Secrets** — sie nutzt
dieselben wie `create-checkout`, ohne die Preis-Variablen: Kurspreise stehen
am Kurs in der Datenbank.

`get-prices` liest die beiden Abo-Preise dort, wo auch abgerechnet wird: an
`STRIPE_PRICE_MONTHLY` und `STRIPE_PRICE_YEARLY`. Damit kann die Preisseite
keinen anderen Betrag zeigen als den, der abgebucht wird. Sie ist öffentlich
erreichbar und braucht trotzdem **kein** `verify_jwt = false`: supabase-js
schickt den anon-Key als `Authorization` mit, und den nimmt das Gateway als
gültiges JWT. `stripe-webhook` bleibt die einzige Funktion ohne JWT-Prüfung.

## Warum der Webhook ohne JWT läuft

Stripe schickt kein Supabase-JWT. Die Echtheit kommt ausschließlich aus der
Signatur über den **Rohtext** der Anfrage, geprüft gegen
`STRIPE_WEBHOOK_SECRET`. Deshalb steht in `config.toml`:

```toml
[functions.stripe-webhook]
verify_jwt = false
```

Das ist die einzige Funktion ohne JWT-Prüfung, und sie ist damit für das ganze
Internet erreichbar. Ihre gesamte Sicherheit hängt an zwei Zeilen: `req.text()`
statt `req.json()` und `constructEventAsync`. Wer daran etwas ändert, hebt die
Zugangskontrolle auf.

## Secrets

Sie leben **ausschließlich in den Supabase Function Secrets** (CLAUDE.md) —
nicht in hPanel, nicht in einer lokalen `.env`, nicht im Repo. Zu setzen je
Projekt unter Edge Functions → Secrets, oder:

```bash
supabase secrets set --project-ref <ref> STRIPE_SECRET_KEY=sk_...
```

| Name | Wer braucht ihn | Anmerkung |
|---|---|---|
| `STRIPE_SECRET_KEY` | alle drei Stripe-Funktionen | Test-Key auf Staging, Live-Key auf Live |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | **pro Endpoint verschieden** — siehe unten |
| `STRIPE_PRICE_MONTHLY` | `create-checkout` | Price-ID, nicht Produkt-ID |
| `STRIPE_PRICE_YEARLY` | `create-checkout` | dito |
| `APP_URL` | `create-checkout`, `create-portal` | ohne Schrägstrich am Ende |
| `ALLOWED_ORIGINS` | optional, alle | leer = `*`; siehe `_shared/http.ts` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` setzt
Supabase selbst — nicht von Hand eintragen.

Fehlt einer der Werte, antworten die Funktionen mit `not_configured` und 500.
Sie raten nicht und arbeiten nicht halb.

## Getrennte Endpoints je Umgebung

SAD §4.3 Punkt 7, und der Grund ist unangenehm konkret: **Test-Events dürfen
die Live-Datenbank nie erreichen.** Im Stripe-Dashboard gehören deshalb zwei
Webhook-Endpoints angelegt, einer im Test- und einer im Live-Modus:

```
https://<staging-ref>.supabase.co/functions/v1/stripe-webhook
https://<live-ref>.supabase.co/functions/v1/stripe-webhook
```

Jeder bekommt beim Anlegen sein eigenes Signing Secret. Das gehört in das
jeweilige Supabase-Projekt — **nicht** in beide. Ein versehentlich geteiltes
Secret ist genau der Fall, den die Trennung verhindern soll.

Zu abonnieren sind die sechs Ereignisse aus SAD §4.3 Punkt 6:

```
checkout.session.completed
checkout.session.expired                 <- seit T20, gibt Kursplaetze frei
checkout.session.async_payment_succeeded <- seit T20, nachgelagerte Zahlungen
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

Alles andere quittiert die Funktion mit 200 und tut nichts.

Die beiden neuen sind am 21.08.2026 in beiden Umgebungen nachgetragen worden.
Fehlt `checkout.session.expired`, bleibt ein abgebrochener Kurs-Checkout bis
zum Ablauf der Haltezeit auf dem Platz sitzen. Die vollständige Checkliste
steht in `docs/KURSBUCHUNG.md`.

## Im Stripe-Dashboard einzustellen

Nichts davon steht im Code, und ohne diese Einstellungen stimmt die Rechnung
nicht (SAD §4.5, Kleinunternehmerregelung):

- **Stripe Tax aus** bzw. Steuersatz 0 %.
- **Preise als Bruttopreise**, `tax_behavior: inclusive` — das hängt am Preis,
  nicht am Checkout-Aufruf.
- **Rechnungsfußzeile:** „Umsatzsteuerbefreit — Kleinunternehmer gemäß § 6
  Abs. 1 Z 27 UStG."
- **Rabattcodes** anlegen, wer welche will. Der Code kennt sie nicht, er setzt
  nur `allow_promotion_codes: true`.
- **Zahlungsbelege per E-Mail einschalten** (Kundenbenachrichtigungen →
  „Erfolgreiche Zahlungen"). Seit T20 sind sie die Buchungsbestätigung nach
  § 11 AGB — ohne sie bekommt ein Kursteilnehmer gar nichts Schriftliches.
  Am 21.08.2026 eingeschaltet. Beachte: für Einmalzahlungen verschickt Stripe
  Belege **nur im Live-Modus**.
- **AGB-Adresse hinterlegen** (Einstellungen → Checkout und Payment Links →
  „Nutzungsbedingungen"): `https://deratemcode.at/agb`, in **beiden**
  Umgebungen. **Das muss vor dem Ausrollen von T19a geschehen.**
  `create-checkout` setzt seither `consent_collection.terms_of_service:
  'required'`; fehlt die Adresse, antwortet Stripe mit einem Fehler und
  **niemand kann mehr ein Abo kaufen**. Der Haken trägt zugleich die Erklärung
  zum sofortigen Leistungsbeginn (§ 18 Abs. 2 FAGG) — der Wortlaut steht als
  `tosHinweis()` in `create-checkout/index.ts`, nicht im Dashboard. Er bringt
  den Link zu den AGB selbst mit (aus `APP_URL`), denn eigener `custom_text`
  **ersetzt** den von Stripe erzeugten Satz samt dessen Verweis.
  Die Adresse gehört trotzdem hinterlegt: ohne sie verweigert Stripe
  `terms_of_service: 'required'` überhaupt.
  Danach einmal nachsehen, was in der Bestätigungsmail steht: § 18 Abs. 2 Z 3
  FAGG will diese Erklärung auf einem dauerhaften Datenträger wiederfinden.

> Vorbehalt aus SAD §4.5: die Kleinunternehmerregelung greift für inländische
> Umsätze. Für digitale Leistungen an Privatpersonen in anderen EU-Ländern gilt
> das Bestimmungslandprinzip. Deshalb schreibt `subscriptions.country` das
> Käuferland von Anfang an mit — die steuerliche Bewertung selbst gehört zur
> Steuerberatung, nicht ins Repo.

## CORS: was der Browser im Preflight verlangt

`Access-Control-Allow-Headers` muss **jede** Kopfzeile nennen, die supabase-js
mitschickt:

```
authorization, x-client-info, apikey, content-type
```

Fehlt eine davon, bricht der Browser den Preflight ab und die eigentliche
Anfrage geht nie los. In der App sieht das aus wie ein Netzwerkfehler.

**Am 21.08.2026 genau so passiert.** Die Liste stand auf
`authorization, content-type` — damit war **keine** Edge Function aus dem
Browser erreichbar: Preisabfrage, Checkout, Kundenportal, Kontolöschung.

Warum es monatelang niemandem auffiel: geprüft wurde mit `curl`, und **curl
schickt keinen Preflight**. Die Vitest-Tests reden nie mit dem Netz. Es gab
also grüne Tests, grüne curl-Aufrufe — und Funktionen, die im Browser nie
liefen.

Die Liste steht seitdem an einer Stelle (`_shared/http.ts`, Konstante
`ALLOWED_HEADERS`) und wird von `__tests__/http.test.ts` festgehalten.
`delete-account` hat weiterhin seine eigene Kopie; wer die eine ändert, ändert
die andere mit.

**So prüft man es von außen** — das ist der Aufruf, der den Fehler gefunden hat:

```bash
curl -s -o /dev/null -D - -X OPTIONS \
  https://<ref>.supabase.co/functions/v1/<funktion> \
  -H "Origin: https://dev.deratemcode.at" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization, content-type, apikey, x-client-info"
```

In der Antwort muss `access-control-allow-headers` alle vier nennen. Achtung:
Der **lokale** Runtime beantwortet Preflights selbst und spiegelt die Anfrage
zurück — dort sieht immer alles gut aus. Prüfen lässt sich das nur gegen eine
ausgerollte Umgebung.

## Kursbuchungen örtlich ausprobieren

Ohne Stripe-Konto, mit selbst signierten Ereignissen — dieselbe Machart wie
oben, nur gegen den Kurszweig. Vorbereitung: einen buchbaren Kurs anlegen und
`select public.reserve_course_seat('<kurs-id>', '<user-id>', true);` aufrufen,
dann ein Ereignis mit `metadata.booking_id` und
`metadata.payment_kind = 'course_deposit'` schicken.

Am 21.08.2026 so geprüft, alle vier Wege:

| Ereignis | Erwartung | Ergebnis |
|---|---|---|
| `checkout.session.completed` (course_deposit) | Buchung `confirmed`, Anzahlung verbucht | ✓ |
| dasselbe noch einmal, neue Event-ID | Betrag wird **nicht** doppelt addiert | ✓ |
| `checkout.session.completed` (course_balance) | Restbetrag verbucht, `balance_paid_at` gesetzt | ✓ |
| `checkout.session.expired` | Reservierung `expired`, Platz wieder frei | ✓ |

Gegenprobe in derselben Runde: ein Abo-Ereignis ohne `payment_kind` lief
weiterhin in den Abozweig (erkennbar daran, dass es dort am Dummy-Schlüssel
scheiterte). Und nach allen vier Kursereignissen stand in `subscriptions`
keine Zeile und in `profiles` kein Plus.

## Örtlich ausprobieren

```bash
supabase start
supabase functions serve stripe-webhook --no-verify-jwt
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

`stripe listen` gibt beim Start ein eigenes Signing Secret aus (`whsec_...`);
das gehört in die lokale Umgebung der Funktion, nicht in ein Projekt.

Ob es gewirkt hat, steht nicht im Log, sondern in der Datenbank:

```sql
select id, type, processed_at from public.stripe_events order by received_at desc limit 5;
select user_id, plan, status, current_period_end from public.subscriptions;
select id, has_active_subscription, plus_until from public.profiles;
```

Die dritte Abfrage ist die eigentliche: `has_active_subscription` schreibt kein
Code, sondern der Trigger aus Migration 0010. Steht dort nichts, hat der
Webhook zwar geantwortet, aber nichts bewirkt.
