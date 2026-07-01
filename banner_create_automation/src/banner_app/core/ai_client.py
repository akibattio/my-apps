"""AI background image generation: OpenAI (gpt-image-1) + Gemini Nano Banana (Vertex AI)."""
from __future__ import annotations

import base64
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
from io import BytesIO

from PIL import Image

from ..config import Config

OPENAI_MODEL = "gpt-image-1"
GEMINI_MODEL = "gemini-2.5-flash-image"


@dataclass
class GenerationResult:
    provider: str  # "openai" | "gemini"
    image: Image.Image | None
    error: str | None = None


def _aspect_to_openai_size(width: int, height: int) -> str:
    """Map banner aspect to a supported OpenAI image size.

    gpt-image-1 supports: 1024x1024, 1024x1536, 1536x1024 (and auto).
    """
    ratio = width / height
    if ratio > 1.2:
        return "1536x1024"
    if ratio < 0.83:
        return "1024x1536"
    return "1024x1024"


def generate_openai(prompt: str, width: int, height: int) -> GenerationResult:
    if not Config.openai_available():
        return GenerationResult("openai", None, "OPENAI_API_KEY is not set")
    try:
        from openai import OpenAI

        client = OpenAI(api_key=Config.openai_api_key)
        size = _aspect_to_openai_size(width, height)
        resp = client.images.generate(
            model=OPENAI_MODEL,
            prompt=prompt,
            size=size,
            n=1,
        )
        b64 = resp.data[0].b64_json
        if not b64:
            return GenerationResult("openai", None, "Empty response from OpenAI")
        img = Image.open(BytesIO(base64.b64decode(b64))).convert("RGBA")
        return GenerationResult("openai", img)
    except Exception as exc:  # noqa: BLE001
        return GenerationResult("openai", None, f"{type(exc).__name__}: {exc}")


def _aspect_to_gemini_ratio(width: int, height: int) -> str:
    """Map banner aspect to a Gemini-supported aspect ratio string."""
    ratio = width / height
    # Supported: "1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2", "5:4", "4:5", "21:9"
    candidates = [
        ("1:1", 1.0),
        ("9:16", 9 / 16),
        ("16:9", 16 / 9),
        ("3:4", 3 / 4),
        ("4:3", 4 / 3),
        ("2:3", 2 / 3),
        ("3:2", 3 / 2),
        ("4:5", 4 / 5),
        ("5:4", 5 / 4),
        ("21:9", 21 / 9),
    ]
    best = min(candidates, key=lambda c: abs(c[1] - ratio))
    return best[0]


def generate_gemini(prompt: str, width: int, height: int) -> GenerationResult:
    if not Config.vertex_available():
        return GenerationResult("gemini", None, "GOOGLE_CLOUD_PROJECT is not set")
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(
            vertexai=True,
            project=Config.gcp_project,
            location=Config.gcp_location,
        )
        aspect = _aspect_to_gemini_ratio(width, height)
        resp = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio=aspect),
            ),
        )
        for candidate in resp.candidates or []:
            for part in candidate.content.parts or []:
                inline = getattr(part, "inline_data", None)
                if inline and inline.data:
                    img = Image.open(BytesIO(inline.data)).convert("RGBA")
                    return GenerationResult("gemini", img)
        return GenerationResult("gemini", None, "No image in Gemini response")
    except Exception as exc:  # noqa: BLE001
        return GenerationResult("gemini", None, f"{type(exc).__name__}: {exc}")


def generate_both(prompt: str, width: int, height: int) -> tuple[GenerationResult, GenerationResult]:
    """Run both providers in parallel and return (openai, gemini)."""
    with ThreadPoolExecutor(max_workers=2) as pool:
        f_openai: Future = pool.submit(generate_openai, prompt, width, height)
        f_gemini: Future = pool.submit(generate_gemini, prompt, width, height)
        return f_openai.result(), f_gemini.result()
