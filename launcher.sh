#!/bin/bash
cd "$(dirname "$0")"
source .venv/bin/activate
python -m backend.server &
SERVER_PID=$!
sleep 2
open "http://localhost:8000" 2>/dev/null || xdg-open "http://localhost:8000" 2>/dev/null
wait $SERVER_PID
