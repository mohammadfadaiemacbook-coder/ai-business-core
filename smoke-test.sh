#!/usr/bin/env bash
# Usage: ./smoke-test.sh (no secrets needed; optional APP_ACCESS_TOKEN tests session exchange)
set -euo pipefail
BASE="https://ai-business-core.mohammadfadaiemacbook.workers.dev"
U="$BASE/api/generate"
O="https://mohammadfadaiemacbook-coder.github.io"
t(){ printf '%-34s expected %s got ' "$1" "$2"; shift 2; curl -s -o /dev/null -w '%{http_code}\n' "$@"; }
t "OPTIONS" 204 -X OPTIONS "$U" -H "Origin: $O" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type"
t "GET" 405 "$U"
t "Session exchange bad token" 401 -X POST "$BASE/api/auth/session" -H "Origin: $O" -H "Authorization: Bearer wrong"
echo "--- CORS headers on OPTIONS:"
curl -s -D - -o /dev/null -X OPTIONS "$U" -H "Origin: $O" -H "Access-Control-Request-Method: POST" | grep -i '^access-control'
if [[ -n "${APP_ACCESS_TOKEN:-}" ]]; then
  SESSION=$(curl -fsS -X POST "$BASE/api/auth/session?workspace=default" -H "Authorization: Bearer $APP_ACCESS_TOKEN" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).sessionToken))')
  printf '%-34s expected %s got ' "Session-authenticated AI request" "200/503"
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$U" -H "Origin: $O" -H "Authorization: Bearer $SESSION" -H "Content-Type: application/json" -d '{"task":"video_outline","inputs":{"topic":"smoke test"}}'
  unset SESSION
else
  echo "Set APP_ACCESS_TOKEN in your shell to test a real session; the value is never printed."
fi
