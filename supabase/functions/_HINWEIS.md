# Edge Functions

Vier Stück, alle unter Deno. `supabase functions deploy` in `deploy.yml` rollt
sie bei jedem Durchlauf komplett aus — einzeln benennen muss man nichts.

| Funktion | Wozu | JWT |
|---|---|---|
| `delete-account` | Konto löschen (Apple-Anforderung, SAD §4.1) | ja |
| `create-checkout` | Bezahlseite bei Stripe bestellen | ja |
| `create-portal` | Kundenportal öffnen (kündigen, Rechnungen) | ja |
| `stripe-webhook` | **die einzige Stelle, die Abos schreibt** | **nein** |

`_shared/` wird nicht ausgerollt — Verzeichnisse mit `_` überspringt die CLI.
Die reine Logik daraus (`entitlement.ts`, `stripe-events.ts`) läuft unter
Vitest und ist damit die einzige Stripe-Fachlogik mit Tests.

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
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

Alles andere quittiert die Funktion mit 200 und tut nichts.

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

> Vorbehalt aus SAD §4.5: die Kleinunternehmerregelung greift für inländische
> Umsätze. Für digitale Leistungen an Privatpersonen in anderen EU-Ländern gilt
> das Bestimmungslandprinzip. Deshalb schreibt `subscriptions.country` das
> Käuferland von Anfang an mit — die steuerliche Bewertung selbst gehört zur
> Steuerberatung, nicht ins Repo.

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
