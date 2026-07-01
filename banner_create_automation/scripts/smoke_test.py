"""Render all templates with placeholder values & a generated background, no AI."""
from __future__ import annotations

from PIL import Image, ImageDraw

from banner_app.config import Config, TEMPLATES_DIR
from banner_app.core.exporter import export_all
from banner_app.core.template import list_templates


def fake_background(w: int = 1024, h: int = 1024) -> Image.Image:
    """Generate a colorful gradient background to stand in for AI output."""
    img = Image.new("RGB", (w, h))
    pixels = img.load()
    for y in range(h):
        for x in range(w):
            pixels[x, y] = (
                int(40 + 200 * x / w),
                int(60 + 150 * (1 - y / h)),
                int(120 + 100 * (y / h)),
            )
    # add a soft circle highlight
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(overlay).ellipse(
        (w // 4, h // 6, 3 * w // 4, 5 * h // 6),
        fill=(255, 230, 180, 60),
    )
    return Image.alpha_composite(img.convert("RGBA"), overlay)


def main() -> None:
    Config.ensure_dirs()
    templates = list_templates()
    print(f"Templates: {[p.name for p in templates]}")
    bg = fake_background()
    values = {
        "ai_prompt": "(skipped in smoke test)",
        "headline": "新商品リリース\n夏の限定キャンペーン",
        "subtitle": "今だけ最大30%OFF — 詳細はプロフィールから",
        "cta": "今すぐチェック",
    }
    paths = export_all(templates, values, bg)
    print("Generated:")
    for p in paths:
        print(" -", p)


if __name__ == "__main__":
    main()
