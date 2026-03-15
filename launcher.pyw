"""
Double-click this file to start autoCV.
Opens the backend server and your default browser.
"""

import os
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

# Set working directory to the project root
os.chdir(Path(__file__).parent)

# Find the Python executable in the venv
python = Path(".venv/Scripts/python.exe")
if not python.exists():
    python = Path(".venv/bin/python")
if not python.exists():
    python = Path(sys.executable)

# Start the backend server
server = subprocess.Popen(
    [str(python), "-m", "backend.server"],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)

# Wait for server to be ready (up to 30 seconds)
for _ in range(30):
    try:
        urllib.request.urlopen("http://localhost:8000/api/health", timeout=1)
        break
    except Exception:
        time.sleep(1)

# Open browser
webbrowser.open("http://localhost:8000")

# Keep running until the server exits or user kills the process
try:
    server.wait()
except KeyboardInterrupt:
    server.terminate()
