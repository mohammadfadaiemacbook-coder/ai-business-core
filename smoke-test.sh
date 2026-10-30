#!/usr/bin/env bash
# Usage: ./smoke-test.sh (no secrets needed; the 401 test uses a deliberately wrong token)
U="https://ai-business-core.mohammadfadaiemacbook.workers.dev/api/generate"
O="https://mohammadfadaiemacbook-coder.github.io"
t(){ printf '%-34s expected %s got ' "$1" "$2"; shift 2; curl -s -o /dev/null -w '%{http_code}\n' "$@"; }
t "OPTIONS" 204 -X OPTIONS "$U" -H "Origin: $O" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type"
t "GET" 405 "$U"
t "POST bad token" 401 -X POST "$U" -H "Origin: $O" -H "Authorization: Bearer wrong" -H "Content-Type: application/json" -d '{}'
echo "--- CORS headers on OPTIONS:"
curl -s -D - -o /dev/null -X OPTIONS "$U" -H "Origin: $O" -H "Access-Control-Request-Method: POST" | grep -i '^access-control'
echo "(400 / 503 / success need your real token: run those from your own terminal.)"
