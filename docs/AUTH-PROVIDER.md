# Anmeldung mit Google und Apple einrichten

Der Code ist fertig und braucht keine Änderung mehr. Was fehlt, sind
Zugangsdaten bei Google und Apple — die kann nur bekommen, wer Zugriff auf die
Konten hat.

**Die App merkt selbst, wann es so weit ist.** Sie fragt beim Laden der
Kontoseite `GET <SUPABASE_URL>/auth/v1/settings` und zeigt eine Schaltfläche
genau dann, wenn Supabase den Anbieter als eingeschaltet meldet
(`src/features/auth/useAuthProviders.ts`). Es gibt in der App keinen Schalter,
den man zusätzlich umlegen müsste, und keine Umgebungsvariable, die man in drei
Umgebungen synchron halten muss.

> **Warum überhaupt eine Sperre?** Ist ein Anbieter nicht eingerichtet, springt
> der Nutzer nicht mit einem Fehler zurück — `/authorize` antwortet mit nacktem
> JSON (`{"code":400,...,"msg":"Unsupported provider: provider is not
> enabled"}`). Der Nutzer steht dann auf einer fremden Adresse vor einer Zeile
> Technik. Aus der App ist das nicht abzufangen, der Browser hat die Seite
> längst verlassen.

## Die beiden sind unabhängig voneinander

Google allein einzurichten ist vollständig in Ordnung. Solange Apple aus ist,
erscheint der Apple-Knopf nicht — es gibt keine halbe Anmeldeseite, keinen
toten Knopf und nichts, was später „nachgezogen" werden müsste. Kommt Apple
irgendwann dazu, reicht das Einschalten im Supabase-Dashboard; **ein neues
Deployment braucht es dafür nicht.**

Zwei Dinge, die den Zeitpunkt bestimmen dürfen:

- Der **Apple Developer Account ist kostenpflichtig** (Jahresmitgliedschaft),
  Google nicht. Für eine reine Web-App ist das die einzige Hürde.
- **Zwingend wird Apple erst mit einer nativen App**: Apples
  App-Store-Richtlinie 4.8 verlangt „Sign in with Apple" nur dann, wenn eine
  App im Store eine andere Fremdanmeldung (z. B. Google) anbietet. Für die
  Website gilt das nicht — und native Apps sind ausdrücklich nicht Teil von V1
  (CLAUDE.md). Vor dem ersten App-Store-Release gehört Apple aber eingerichtet,
  sonst wird die App abgelehnt.

---

## Was für beide gilt

Die Rückruf-Adresse, die beim Anbieter hinterlegt wird, ist **immer die von
Supabase**, nie die der App:

```
https://<projekt-ref>.supabase.co/auth/v1/callback
```

Lokal entsprechend `http://127.0.0.1:54321/auth/v1/callback`.

Wohin es danach in der App weitergeht, entscheidet `redirectTo` im Client
(`<origin>/konto`) — und diese Adresse muss in den erlaubten Rücksprungzielen
stehen:

| Umgebung | Wo eingetragen |
|---|---|
| lokal | `supabase/config.toml`, `additional_redirect_urls` (steht schon drin) |
| Staging / Live | Supabase-Dashboard → Authentication → URL Configuration |

---

## Google

1. **Google Cloud Console** → Projekt anlegen oder wählen.
2. **APIs & Services → OAuth consent screen**: User Type „External",
   App-Name, Support-E-Mail, Logo. Ohne Veröffentlichung bleibt die App im
   Test-Modus und lässt nur eingetragene Testnutzer zu — für den Livebetrieb
   also veröffentlichen.
3. **Credentials → Create Credentials → OAuth client ID**, Typ
   „Web application".
   - *Authorized redirect URIs*: die Supabase-Callback-Adresse von oben.
4. Es fallen **Client ID** und **Client Secret** an.

Eintragen:

| Umgebung | Wohin |
|---|---|
| lokal | `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` und `…_SECRET` als Umgebungsvariablen setzen, in `supabase/config.toml` `[auth.external.google] enabled = true` |
| Staging / Live | Dashboard → Authentication → Providers → Google |

Lokal am einfachsten über eine gitignorierte `.env` im Projektstamm:

```bash
set -a; source .env; supabase start
```

---

## Apple

Aufwendiger als Google, und mit einer Falle.

1. **Apple Developer** → Certificates, Identifiers & Profiles.
2. **App ID** anlegen (Identifiers → App IDs), Capability „Sign in with Apple"
   aktivieren.
3. **Services ID** anlegen (Identifiers → Services IDs). *Das* ist die
   `client_id`, **nicht** die App ID.
   - „Sign in with Apple" konfigurieren:
     - *Primary App ID*: die aus Schritt 2
     - *Domains*: die Domain der App
     - *Return URLs*: die Supabase-Callback-Adresse von oben
4. **Key** anlegen (Keys → +), „Sign in with Apple" aktivieren, Key
   herunterladen (`.p8`, **nur einmal herunterladbar**). Notieren:
   Key ID und Team ID.

> ### Die Falle: das Secret läuft ab
>
> Apples „Client Secret" ist kein fester Schlüssel, sondern ein **JWT, das man
> selbst aus dem `.p8`-Key erzeugt** — und Apple begrenzt seine Gültigkeit auf
> **höchstens sechs Monate**. Läuft es ab, hört die Anmeldung mit Apple ohne
> Vorwarnung auf zu funktionieren; im Log steht nur ein Authentifizierungs­fehler.
>
> **Deshalb: beim Einrichten sofort eine Erinnerung auf ~5 Monate setzen.**
> Bestandsnutzer, die sich nur über Apple angemeldet haben, kommen sonst nicht
> mehr in ihr Konto.

Eintragen: Dashboard → Authentication → Providers → Apple (Services ID als
Client ID, das erzeugte JWT als Secret). Lokal analog über
`SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID` / `…_SECRET`.

---

## Danach prüfen

Ohne Klick durch die Oberfläche feststellbar:

```bash
curl -s "<SUPABASE_URL>/auth/v1/settings" -H "apikey: <ANON_KEY>" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['external'])"
```

Steht dort `'google': True`, erscheint die Schaltfläche beim nächsten Aufruf
von `/konto` von selbst.

Ein zweiter, härterer Test — er muss mit `302` auf den Anbieter zeigen und
nicht mit `400` antworten:

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" \
  "<SUPABASE_URL>/auth/v1/authorize?provider=google&redirect_to=<origin>/konto"
```

---

## Was beim ersten Anmelden passiert

- Supabase legt den Nutzer in `auth.users` an, der Trigger `handle_new_user`
  aus Migration `0001` legt die Zeile in `public.profiles` an und übernimmt
  `full_name` und `avatar_url` aus den Anbieterdaten. Dafür ist nichts zu tun.
- Meldet sich jemand mit derselben, beim Anbieter **bestätigten** E-Mail-Adresse
  an, mit der schon ein Konto per Passwort besteht, verknüpft Supabase beide
  Identitäten zu einem Konto. Auf der Kontoseite steht dann unter „Angemeldet
  über" beides.
- **Apple liefert den Namen nur beim allerersten Mal.** Wird das Konto beim
  Anbieter gelöst und neu verbunden, bleibt `full_name` leer. Das ist Apples
  Verhalten, kein Fehler der App.
