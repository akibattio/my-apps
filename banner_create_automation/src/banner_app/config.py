"""Application configuration loaded from environment."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
TEMPLATES_DIR = PROJECT_ROOT / "templates"
ASSETS_DIR = PROJECT_ROOT / "assets"
FONTS_DIR = ASSETS_DIR / "fonts"
CACHE_DIR = PROJECT_ROOT / ".cache"

load_dotenv(PROJECT_ROOT / ".env")


class Config:
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    gcp_project: str | None = os.getenv("GOOGLE_CLOUD_PROJECT")
    gcp_location: str = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    output_dir: Path = Path(os.getenv("BANNER_OUTPUT_DIR", PROJECT_ROOT / "output"))

    @classmethod
    def ensure_dirs(cls) -> None:
        cls.output_dir.mkdir(parents=True, exist_ok=True)
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    @classmethod
    def openai_available(cls) -> bool:
        return bool(cls.openai_api_key)

    @classmethod
    def vertex_available(cls) -> bool:
        return bool(cls.gcp_project)
