#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ ! -x .venv/bin/python ]]; then
  echo 'Missing .venv/bin/python' >&2
  exit 1
fi
if [[ -z "${API_KEY:-}" && ! -f .env ]]; then
  echo 'Set API_KEY through systemd EnvironmentFile or an ignored .env' >&2
  exit 1
fi
if [[ "${API_KEY:-}" == REPLACE_WITH_* ]] || { [[ -f .env ]] && grep -q '^API_KEY=REPLACE_WITH_' .env; }; then
  echo 'Replace the sample API_KEY before starting the service' >&2
  exit 1
fi
export HF_HOME="${HF_HOME:-$ROOT/.cache/huggingface}"
args=()
if [[ -f .env ]]; then args+=(--env-file .env); fi
exec .venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port "${PORT:-8000}" --workers 1 "${args[@]}"
