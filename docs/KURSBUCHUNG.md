# Kursbuchung — Ablauf, Entscheidungen, Handgriffe

Gehört zu T20. Was hier steht, ist die Betriebsanleitung: was die App macht,
was von Hand passiert und warum es so geschnitten ist.

Technische Begründungen stehen im Kopf von `supabase/migrations/0011_course_bookings.sql`.

---

## Die vier Entscheidungen vom 21.08.2026

| Frage | Entscheidung |
|---|---|
| Anzahlung nach § 11 AGB | **Zwei Zahlungen.** Anzahlung im Checkout, Restbetrag später von Hand über einen Stripe-Zahlungslink. Die AGB bleiben unverändert. |
| Teilnehmerbegrenzung | **Reservierung vor der Zahlung**, verfällt nach 40 Minuten. Gezählt wird in der Datenbank unter Sperre. |
| Storno nach § 12 AGB | **Von Hand.** Der Nutzer storniert per E-Mail, die Erstattung passiert im Stripe-Dashboard, der Status im Studio. Keine Erstattungslogik im Code. |
| Bestätigung nach § 11 AGB | **Der Zahlungsbeleg von Stripe.** Dazu eine Bestätigungsseite in der App. Kein eigener E-Mail-Versanddienst. |

---

## Was beim Buchen passiert

```
Nutzer klickt "Verbindlich buchen"
   │
   ├─ 1. create-course-checkout prüft: angemeldet? AGB bestätigt?
   │
   ├─ 2. reserve_course_seat() in der Datenbank
   │        sperrt die Kurszeile  ->  zählt belegte Plätze  ->  legt die
   │        Buchung als 'reserved' an, 40 Minuten gültig
   │        Absagen: PT001 nicht buchbar · PT002 ausgebucht
   │                 PT003 schon gebucht · PT004 AGB fehlen
   │
   ├─ 3. Stripe-Checkout, mode = 'payment', gültig 32 Minuten
   │        metadata.booking_id ist die Brücke zurück
   │
   └─ 4. stripe-webhook macht aus 'reserved' ein 'confirmed'
            checkout.session.completed  -> bestätigt und verbucht
            checkout.session.expired    -> gibt den Platz wieder frei
```

Bricht Schritt 3 ab, wird die Reservierung sofort freigegeben. Zahlt jemand
nicht, verfällt sie von selbst — der nächste Buchungsversuch räumt sie weg.

**Die Reservierung ist nicht der Vertrag.** Verbindlich wird die Anmeldung
nach § 11 AGB erst mit der Bestätigung, also mit der Zahlung.

---

## Einen Kurs buchbar machen (Supabase Studio)

Table Editor → `courses`. Buchbar wird ein Kurs erst, wenn **alle** Pflichtfelder
stehen; die Datenbank lässt den Haken sonst nicht setzen.

| Feld | Bedeutung |
|---|---|
| `price_cents` | Gesamtpreis in **Cent**, brutto. 240 € → `24000`. Pflicht. |
| `starts_at` | Beginn. Pflicht — daran hängen Anzahlungs- und Stornofristen. |
| `capacity` | Teilnehmerzahl. Leer = unbegrenzt. |
| `deposit_cents` | Anzahlung in Cent. Leer = voller Betrag im Checkout. |
| `booking_enabled` | Der Haken. Erst damit erscheint der Buchungsteil. |

**§ 11 AGB verlangt die Anzahlung bei Offline-Terminen über 130 €** — 50 % des
Preises. Die Datenbank rechnet das nicht aus, weil sie nicht weiß, ob ein Kurs
offline stattfindet: bei einem Präsenztermin über 13000 Cent also
`deposit_cents` auf die Hälfte setzen.

Solange `booking_enabled` aus ist, bleibt der alte Weg über `signup_url` — der
externe Link ist ab jetzt der Rückfall, nicht der Regelweg.

### Was die Datenbank verhindert

- `booking_enabled` ohne Preis oder ohne Beginn → abgelehnt
- Anzahlung ≥ Preis, oder Anzahlung ohne Preis → abgelehnt
- Preis oder Teilnehmerzahl ≤ 0 → abgelehnt
- einen Kurs löschen, auf den jemand gebucht hat → abgelehnt

---

## Restbetrag einsammeln (von Hand)

Bei einer Anzahlung steht der Rest offen. **Es gibt keine Automatik und keine
Erinnerungsmail** — das ist die Kehrseite der Entscheidung für zwei Zahlungen.

Wer offen ist, steht im Studio:

```sql
select b.id, b.user_id, c.title, c.starts_at,
       (b.amount_total_cents - b.amount_paid_cents) / 100.0 as offen_eur,
       b.balance_due_at
  from public.course_bookings b
  join public.courses c on c.id = b.course_id
 where b.status = 'confirmed'
   and b.balance_paid_at is null
   and b.amount_paid_cents < b.amount_total_cents
 order by b.balance_due_at;
```

`balance_due_at` ist vier Wochen vor Beginn — **einmal pro Woche nachsehen**,
sonst fällt es erst am Kurstag auf.

Dann im Stripe-Dashboard einen **Zahlungslink** über den Restbetrag anlegen und
dem Teilnehmer schicken. Damit die Zahlung von selbst verbucht wird, braucht der
Link zwei Metadaten:

```
booking_id    = die id aus course_bookings
payment_kind  = course_balance
```

Kommt das Geld an, setzt der Webhook `amount_paid_cents` hoch und
`balance_paid_at`. Ohne die Metadaten geht die Zahlung bei Stripe trotzdem ein —
sie wird nur nicht zugeordnet, und die Buchung sieht weiter offen aus.

**Wer später als vier Wochen vor Beginn bucht, zahlt sofort voll.** Eine
Anzahlung, deren Restbetrag schon fällig wäre, gibt es nicht.

---

## Storno (von Hand)

§ 12 AGB, Staffel gerechnet ab Eingang der Stornierung:

| Zeitpunkt | Erstattung |
|---|---|
| mehr als 12 Wochen vor Beginn | voll, abzüglich 5 % Bearbeitung |
| 12 bis 6 Wochen vor Beginn | die Hälfte |
| weniger als 6 Wochen vor Beginn | keine |

Dazu der Nachweisvorbehalt: wer zeigt, dass kein oder ein geringerer Schaden
entstanden ist, zahlt entsprechend weniger.

Ablauf:

1. Stornierung kommt per E-Mail an `office@thehacode.com`.
2. Betrag nach der Staffel bestimmen.
3. Im **Stripe-Dashboard** die Zahlung ganz oder teilweise erstatten.
4. Im **Studio** die Buchung nachziehen: `status = 'canceled'`,
   `canceled_at = jetzt`. Der Platz ist damit sofort wieder frei.

Schritt 4 nicht vergessen — solange die Buchung `confirmed` ist, bleibt der
Platz belegt.

---

## Was in Stripe eingestellt sein muss

Zusätzlich zu dem, was `supabase/functions/_HINWEIS.md` fürs Abo nennt:

- **Zahlungsbelege per E-Mail einschalten.** Sie sind nach der Entscheidung vom
  21.08.2026 die Bestätigung nach § 11 AGB. Dashboard → Einstellungen →
  Kundenbenachrichtigungen → „Erfolgreiche Zahlungen".
- **Der Webhook-Endpunkt braucht zwei Ereignisse mehr:**
  `checkout.session.expired` und `checkout.session.async_payment_succeeded` —
  je Umgebung, wie die anderen.
- Preise werden **nicht** im Dashboard gepflegt. Sie stehen am Kurs in der
  Datenbank und gehen als `price_data` mit; sonst müsste die Redaktion jeden
  Kurs an zwei Stellen pflegen.

Neue Function Secrets braucht `create-course-checkout` keine — sie nutzt
dieselben wie `create-checkout`.

---

## Was bewusst fehlt

- **Warteliste.** Ausgebucht heißt ausgebucht; der Hinweis nennt die
  E-Mail-Adresse.
- **Erinnerung an den Restbetrag.** Siehe oben, das ist Handarbeit.
- **Stornoknopf in der App.** Eine falsch gerechnete Staffel wäre ein
  Geldfehler.
- **Teilnehmerliste in der App.** Die steht im Studio.
- **AGB-Bestätigung im Stripe-Checkout** (`consent_collection`). Bei
  Kursbuchungen wird stattdessen in der App bestätigt und der Zeitpunkt in
  `course_bookings.agb_accepted_at` festgehalten. Für das Abo bleibt es bei
  T19a.
