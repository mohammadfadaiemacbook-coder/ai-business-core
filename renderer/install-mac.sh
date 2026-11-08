#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required. Install it from https://brew.sh and run this script again."
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js..."
  brew install node
fi
node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$node_major" -lt 20 ]; then
  echo "Node.js 20 or newer is required. Run: brew upgrade node"
  exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Installing FFmpeg..."
  brew install ffmpeg
fi
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created renderer/.env from .env.example."
fi
echo
echo "Setup checks passed."
echo "1) Edit renderer/.env and set AIBC_RENDERER_TOKEN to the Worker RENDERER_SHARED_SECRET."
echo "2) Make sure Ollama is running locally and qwen3:4b is installed."
echo "3) Start the renderer with: node agent.mjs"
echo "Keep this Mac awake while queued videos are being processed."
