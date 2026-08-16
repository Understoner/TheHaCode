#!/usr/bin/env bash
# Wartet, bis Hostinger den neuen Build ausliefert.
#
# V1 ist statischer Export (SAD §2.5) — kein Server, kein Prozess, der einen
# Health-Endpunkt bedienen koennte. Der Wartepunkt fragt deshalb eine
# gewoehnliche statische Datei ab: dist/build-info.json, geschrieben von
# scripts/write-build-info.mjs am Ende von `npm run build:web`.
#
# Hostinger baut unabhaengig von GitHub Actions. Wir fragen ab, bis dort der
# Commit steht, der ausgerollt werden sollte. Ohne diesen Wartepunkt wuerden
# die Smoke-Tests die ALTE Version pruefen und faelschlich gruen melden — der
# gefaehrlichste denkbare Fehlerfall.
#
#   $1 = Basis-URL (z. B. https://staging.deine-domain.at)
#   $2 = Unix-Zeitstempel des Workflow-Starts (Rueckfall)
#   $3 = erwarteter Commit (optional, aber im Workflow immer gesetzt)
#
# Zur Diagnosefaehigkeit (14.08.2026): Dieser Schritt lief einmal 20 Minuten in
# den Abbruch und meldete 60-mal "noch nicht erreichbar", ohne je den Grund zu
# nennen — die Fehlerausgabe von curl wurde nach /dev/null geworfen. Ob DNS,
# TLS, Timeout oder 404: nicht zu unterscheiden. Seitdem gilt hier:
#
#   * jeder Fehlversuch nennt Exitcode und Meldung von curl,
#   * der Abbruch wiederholt den zuletzt gesehenen Grund,
#   * ein unlesbarer Zeitstempel ist ein eigener Fall und nicht laenger
#     ununterscheidbar von "noch die alte Version" (date schlug fehl -> 0,
#     und 0 ist immer kleiner als der Startzeitpunkt),
#   * die Frist ist echte Uhrzeit statt Summe der sleeps. Vorher zaehlte nur
#     der sleep mit, ein haengender Abruf kam obendrauf: aus 10 Minuten
#     Budget wurden real 20.
#
# Zur Richtigkeit (15.08.2026): Der Zeitstempel-Vergleich hat einen falschen
# Alarm produziert und ein fertiges, korrektes Deployment als Fehlschlag
# gemeldet. Hostinger baut beim Push; dieser Job merkt sich seine Startzeit.
# Liegen die beiden auseinander - hier 32 Minuten, weil der Lauf hinter einer
# wartenden Befoerderung in der concurrency-Warteschlange stand -, dann ist der
# fertige Build ALTER als der Jobstart, und die Bedingung kann nie mehr wahr
# werden. Der Lauf lief in den Abbruch, obwohl die Seite laengst den richtigen
# Stand auslieferte.
#
# Deshalb ist die Hauptpruefung jetzt der Commit: build-info.json traegt ihn
# ohnehin (scripts/write-build-info.mjs), und "ist es genau dieser Stand?" ist
# die Frage, die eigentlich gemeint war. Sie ist exakt statt heuristisch und
# vollstaendig unabhaengig davon, wann welcher Teil gestartet ist.
#
# Der Zeitstempel bleibt als Rueckfall: wird waehrend eines laufenden Deploys
# erneut gepusht, baut Hostinger schon den naechsten Commit. Dann stimmt der
# erwartete Stand nicht mehr, aber der ausgelieferte ist trotzdem neuer als der
# Jobstart - und das genuegt.

set -euo pipefail

BASE_URL="${1:?Basis-URL fehlt}"
STARTED_AT="${2:?Startzeitstempel fehlt}"
EXPECTED_SHA="${3:-}"

# Die Variablen STAGING_URL/PRODUCTION_URL duerfen mit oder ohne Schraegstrich
# enden — ohne das hier wird daraus ein doppelter Schraegstrich im Pfad.
BASE_URL="${BASE_URL%/}"
URL="${BASE_URL}/build-info.json"

MAX_WAIT_SECONDS=600
INTERVAL=10
CURL_TIMEOUT=15

deadline=$(( $(date -u +%s) + MAX_WAIT_SECONDS ))
last_reason="(noch kein Versuch)"

if [ -n "$EXPECTED_SHA" ]; then
  echo "Warte auf Deployment unter ${URL} (erwarteter Commit: ${EXPECTED_SHA})"
else
  echo "Warte auf Deployment unter ${URL} (Start: ${STARTED_AT}, kein Commit uebergeben)"
fi

while [ "$(date -u +%s)" -lt "$deadline" ]; do
  err_file="$(mktemp)"

  # -L folgt Weiterleitungen (www-Redirect, http->https), -A meldet ehrlich,
  # wer da fragt — manche CDN-Regeln behandeln namenlose Clients anders.
  if body="$(curl -fsSL --max-time "$CURL_TIMEOUT" \
        -A 'thehacode-deploy-check (GitHub Actions)' \
        "$URL" 2>"$err_file")"; then

    built_at="$(printf '%s' "$body" | jq -r '.builtAt // empty')"
    commit="$(printf '%s' "$body" | jq -r '.commit // "unbekannt"')"

    # Hauptpruefung: ist es genau der Stand, der ausgerollt werden sollte?
    if [ -n "$EXPECTED_SHA" ] && [ "$commit" = "$EXPECTED_SHA" ]; then
      echo "Neues Deployment aktiv: commit=${commit} builtAt=${built_at}"
      rm -f "$err_file"
      exit 0
    fi

    if [ -z "$built_at" ]; then
      last_reason="build-info.json ohne builtAt — Build unvollstaendig?"
      echo "  ${last_reason} — warte ${INTERVAL}s"
    else
      built_ts="$(date -u -d "$built_at" +%s 2>/dev/null || echo 0)"

      if [ "$built_ts" -eq 0 ]; then
        last_reason="builtAt nicht als Datum lesbar: ${built_at}"
        echo "  ${last_reason} — warte ${INTERVAL}s"
      elif [ "$built_ts" -ge "$STARTED_AT" ]; then
        # Rueckfall: nicht der erwartete Commit, aber juenger als dieser Lauf -
        # also ein noch neuerer Stand. Auch gut.
        echo "Neueres Deployment aktiv (anderer Commit): commit=${commit} builtAt=${built_at}"
        rm -f "$err_file"
        exit 0
      else
        last_reason="noch ein anderer Stand (commit=${commit}, builtAt=${built_at})"
        echo "  ${last_reason} — warte ${INTERVAL}s"
      fi
    fi
  else
    curl_code=$?
    last_reason="curl-Exitcode ${curl_code}: $(tr '\n' ' ' < "$err_file" | sed 's/[[:space:]]\+/ /g;s/ $//')"
    echo "  nicht erreichbar — ${last_reason} — warte ${INTERVAL}s"
  fi

  rm -f "$err_file"
  sleep "$INTERVAL"
done

echo "::error::Nach ${MAX_WAIT_SECONDS}s kein neues Deployment unter ${URL}."
echo "::error::Zuletzt: ${last_reason}"
echo "::error::Haengt JEDER Abruf im Timeout (curl-Exitcode 28), ist die Seite vom"
echo "::error::Runner aus nicht erreichbar — CDN- oder Bot-Schutz in hPanel. Das ist"
echo "::error::etwas anderes als ein fehlgeschlagener Build: dann antwortet die Seite"
echo "::error::und meldet nur weiter den alten Zeitstempel."
echo "::error::Steht dort ein ANDERER Commit als der erwartete und ist der Zeitstempel"
echo "::error::aelter als dieser Lauf, hat Hostinger den Build schon vorher fertig"
echo "::error::gehabt - dann stimmt etwas mit der Reihenfolge nicht, nicht mit dem Build."
echo "::error::Im Zweifel in hPanel unter Deployments das Build-Protokoll pruefen."
exit 1
