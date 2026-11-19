#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major < 22 || (major === 22 && minor < 9) ? 1 : 0)" \
  || { echo "Node.js 22.9 or newer is required." >&2; exit 1; }

python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" \
  || { echo "Python 3.11 or newer is required." >&2; exit 1; }

npm install
npm --prefix frontend install
npm --prefix backend install

if [[ ! -f backend/.env ]]; then
  cp .env.example backend/.env
  echo "Created backend/.env from .env.example; edit its database credentials and secrets."
else
  echo "Preserved existing backend/.env."
fi

if [[ ! -d ai-service/.venv ]]; then
  python3 -m venv ai-service/.venv
fi

if [[ "${INSTALL_AI_DEPENDENCIES:-0}" == "1" ]]; then
  ai-service/.venv/bin/python -m pip install --upgrade pip
  ai-service/.venv/bin/python -m pip install -r ai-service/requirements.txt
else
  echo "AI dependencies were not installed (they include large ML packages)."
  echo "Install with: ai-service/.venv/bin/python -m pip install -r ai-service/requirements.txt"
fi

echo "Setup complete. Start MySQL/Redis, configure backend/.env, then run npm run dev."
