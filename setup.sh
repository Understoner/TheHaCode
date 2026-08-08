#!/usr/bin/env bash
#
# TheHaCode — Entwicklungsumgebung für WSL2 (Ubuntu)
#
# Voraussetzung, die dieses Skript NICHT übernehmen kann:
#   - WSL2 selbst muss unter Windows bereits installiert sein
#       PowerShell (als Administrator): wsl --install
#   - Docker Desktop muss unter WINDOWS installiert sein (GUI-Installer,
#     keine Kommandozeile) mit aktiviertem WSL2-Backend:
#       Docker Desktop → Settings → General → "Use WSL 2 based engine"
#       Docker Desktop → Settings → Resources → WSL Integration →
#       Häkchen bei eurer Ubuntu-Distribution
#   Beides sind bewusste Windows-seitige Schritte mit GUI/Neustart —
#   ein Terminal-Skript kann sie nicht sicher automatisieren.
#
# Dieses Skript läuft INNERHALB von WSL2 (Ubuntu) und richtet den Rest ein:
# Git, nvm, Node 22 LTS, Supabase CLI, Stripe CLI, Claude Code, Playwright.
#
# Ausführen mit:
#   chmod +x setup.sh && ./setup.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
log()  { echo -e "${GREEN}==>${RESET} ${BOLD}$1${RESET}"; }
warn() { echo -e "${YELLOW}!!${RESET} $1"; }

NODE_VERSION="22"   # muss zur Hostinger-Node-Version aus docs/DEPLOYMENT.md passen

# ---------------------------------------------------------------------------
log "Prüfe, ob wir wirklich in WSL laufen"
if ! grep -qi microsoft /proc/version 2>/dev/null; then
  warn "Das sieht nicht nach WSL2 aus. Skript läuft trotzdem weiter,"
  warn "aber Docker-Integration könnte fehlen."
fi

# ---------------------------------------------------------------------------
log "System-Pakete aktualisieren"
sudo apt-get update -y
sudo apt-get upgrade -y

log "Grundwerkzeuge installieren (falls fehlend)"
sudo apt-get install -y \
  build-essential \
  curl \
  git \
  unzip \
  ca-certificates \
  gnupg \
  jq

# ---------------------------------------------------------------------------
log "Git-Grundkonfiguration"
if [ -z "$(git config --global user.name || true)" ]; then
  read -rp "Git user.name (z.B. Max Mustermann): " GIT_NAME
  git config --global user.name "$GIT_NAME"
fi
if [ -z "$(git config --global user.email || true)" ]; then
  read -rp "Git user.email: " GIT_EMAIL
  git config --global user.email "$GIT_EMAIL"
fi
git config --global init.defaultBranch main
git config --global pull.rebase false

# ---------------------------------------------------------------------------
log "nvm installieren (Node-Versionsverwaltung)"
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

log "Node ${NODE_VERSION} (LTS) installieren und als Standard setzen"
nvm install "$NODE_VERSION"
nvm alias default "$NODE_VERSION"
nvm use default

log "Node-Version:"
node --version
npm --version

# ---------------------------------------------------------------------------
log "Supabase CLI installieren"
if ! command -v supabase &> /dev/null; then
  curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh 2>/dev/null || {
    warn "Fallback: Supabase CLI über npm (Standardweg laut offizieller Doku ist ein Paketmanager, nicht npm global — bei Problemen: https://supabase.com/docs/guides/cli prüfen)"
    npm install -g supabase
  }
fi
supabase --version || warn "Supabase CLI nicht im PATH — Terminal neu starten und erneut prüfen"

# ---------------------------------------------------------------------------
log "Stripe CLI installieren"
if ! command -v stripe &> /dev/null; then
  curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | \
    gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg > /dev/null
  echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | \
    sudo tee -a /etc/apt/sources.list.d/stripe.list
  sudo apt-get update -y
  sudo apt-get install -y stripe
fi
stripe --version || warn "Stripe CLI-Installation prüfen: https://stripe.com/docs/stripe-cli"

# ---------------------------------------------------------------------------
log "Claude Code installieren"
npm install -g @anthropic-ai/claude-code
claude --version || warn "Claude Code nicht gefunden — 'npm install -g @anthropic-ai/claude-code' manuell prüfen"

# ---------------------------------------------------------------------------
log "GitHub CLI installieren (optional, aber empfohlen)"
if ! command -v gh &> /dev/null; then
  type -p curl >/dev/null || sudo apt-get install curl -y
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | \
    sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | \
    sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y gh
fi
gh --version || warn "GitHub CLI-Installation prüfen"

# ---------------------------------------------------------------------------
log "Docker-Verbindung aus WSL prüfen"
if command -v docker &> /dev/null; then
  docker --version
  docker info &> /dev/null && echo "Docker Desktop ist erreichbar." || \
    warn "Docker-Befehl gefunden, aber Docker Desktop antwortet nicht. \
Prüft: Docker Desktop läuft unter Windows UND WSL-Integration ist für diese \
Distribution aktiviert (Settings → Resources → WSL Integration)."
else
  warn "Docker nicht gefunden. Docker Desktop muss unter WINDOWS installiert \
werden (siehe Kommentar am Skriptanfang) — das kann dieses Skript nicht übernehmen."
fi

# ---------------------------------------------------------------------------
log "Playwright-Systemabhängigkeiten vormerken"
echo "Hinweis: Playwright-Browser werden PROJEKTBEZOGEN installiert, nicht global."
echo "Sobald das Repo geklont ist:"
echo "  cd thehacode-app && npm ci && npx playwright install --with-deps chromium"

# ---------------------------------------------------------------------------
echo ""
log "Fertig. Zusammenfassung:"
echo "  Node:      $(node --version 2>/dev/null || echo 'nicht gefunden')"
echo "  npm:       $(npm --version 2>/dev/null || echo 'nicht gefunden')"
echo "  Supabase:  $(supabase --version 2>/dev/null || echo 'nicht gefunden')"
echo "  Stripe:    $(stripe --version 2>/dev/null || echo 'nicht gefunden')"
echo "  Claude:    $(claude --version 2>/dev/null || echo 'nicht gefunden')"
echo "  gh:        $(gh --version 2>/dev/null | head -1 || echo 'nicht gefunden')"
echo "  Docker:    $(docker --version 2>/dev/null || echo 'nicht gefunden — siehe Hinweis oben')"
echo ""
echo "Nächste Schritte:"
echo "  1. Terminal neu starten (oder: source ~/.bashrc)"
echo "  2. git clone <euer-repo-url>"
echo "  3. cd thehacode-app && npm ci"
echo "  4. cp .env.example .env.local  →  Supabase-Staging-Werte eintragen"
echo "  5. supabase start"
echo "  6. npm run dev"
