import os
from pathlib import Path

APP_VERSION = "1.0.0"
DATA_DIR = Path(os.getenv("QAVORYNTH_DATA_DIR", str(Path(__file__).parent / "data")))


def cors_origins() -> list:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [o.strip() for o in raw.split(",") if o.strip()]


def cors_origin_regex():
    """Optional regex (e.g. for Vercel preview URLs). Empty/unset disables it."""
    return os.getenv("CORS_ORIGIN_REGEX") or None
