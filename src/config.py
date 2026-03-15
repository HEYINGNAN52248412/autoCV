from pathlib import Path
from dotenv import load_dotenv
import os
import sys

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = os.getenv("MODEL", "claude-sonnet-4-20250514")
KNOWLEDGE_BASE_PATH = Path(os.getenv("KNOWLEDGE_BASE_PATH", "./knowledge_base"))
JOBS_PATH = Path(os.getenv("JOBS_PATH", "./jobs"))
LATEX_COMPILER = os.getenv("LATEX_COMPILER", "xelatex")

if not ANTHROPIC_API_KEY:
    print(
        "ERROR: ANTHROPIC_API_KEY is not set.\n"
        "Create a .env file in the project root with:\n"
        "  ANTHROPIC_API_KEY=sk-ant-...\n"
        "Or export it as an environment variable.",
        file=sys.stderr,
    )
    raise SystemExit(1)
