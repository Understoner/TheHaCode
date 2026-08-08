#!/usr/bin/env bash
# Wartet, bis Hostinger den neuen Build ausliefert.
#
# V1 ist statischer Export (SAD §2.5) — kein Server, kein Prozess, der einen
# Health-Endpunkt bedienen koennte. Der Wartepunkt fragt deshalb eine
# gewoehnliche statische Datei ab: dist/build-info.json, geschrieben von
# scripts/write-build-info.mjs am Ende von `npm run build:web`.
#
# Hostinger baut unabhaengig von GitHub Actions. Wir fragen ab, bis der dort
# gemeldete Build-Zeitstempel nach dem Start des Workflows liegt. Ohne diesen
# Wartepunkt wuerden die Smoke-Tests die ALTE Version pruefen und faelschlich
# gruen melden — der gefaehrlichste denkbare Fehlerfall.
#
#   $1 = Basis-URL (z. B. https://staging.deine-domain.at)
#   $2 = Unix-Zeitstempel des Workflow-Starts

set -euo pipefail

BASE_URL="${1:?Basis-URL fehlt}"
STARTED_AT="${2:?Startzeitstempel fehlt}"

MAX_WAIT_SECONDS=600
INTERVAL=10
elapsed=0

echo "Warte auf Deployment unter ${BASE_URL} (Start: ${STARTED_AT})"

while [ "$elapsed" -lt "$MAX_WAIT_SECONDS" ]; do
  body="$(curl -fsS --max-time 10 "${BASE_URL}/build-info.json" 2>/dev/null || echo '')"

  if [ -n "$body" ]; then
    built_at="$(echo "$body" | jq -r '.builtAt // empty')"
    commit="$(echo "$body" | jq -r '.commit // "unknown"')"

    if [ -n "$built_at" ]; then
      built_ts="$(date -u -d "$built_at" +%s 2>/dev/null || echo 0)"
      if [ "$built_ts" -ge "$STARTED_AT" ]; then
        echo "Neues Deployment aktiv: commit=${commit} builtAt=${built_at}"
        exit 0
      fi
      echo "  noch die vorherige Version (builtAt=${built_at}) — warte ${INTERVAL}s"
    else
      echo "  build-info.json ohne builtAt — Build unvollstaendig? warte ${INTERVAL}s"
    fi
  else
    echo "  /build-info.json noch nicht erreichbar — warte ${INTERVAL}s"
  fi

  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
done

echo "::error::Nach ${MAX_WAIT_SECONDS}s kein neues Deployment unter ${BASE_URL}."
echo "::error::In hPanel unter Deployments das Build-Protokoll pruefen."
exit 1
