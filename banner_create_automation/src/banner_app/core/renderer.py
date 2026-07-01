"""Compose banners with Pillow from a Template + optional background image."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from ..config import FONTS_DIR
from .template import (
    Background,
    ImageLayer,
    RectLayer,
    Template,
    TextLayer,
)

# Default font lookup: prefer Japanese-capable font if available
_FONT_CANDIDATES_NORMAL = [
    "NotoSansJP-Regular.ttf",
    "NotoSansJP-Regular.otf",
    "NotoSansCJKjp-Regular.otf",
]
_FONT_CANDIDATES_BOLD = [
    "NotoSansJP-Bold.ttf",
    "NotoSansJP-Bold.otf",
    "NotoSansCJKjp-Bold.otf",
]
# macOS system fallbacks
_SYSTEM_FALLBACKS_NORMAL = [
    "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
]
_SYSTEM_FALLBACKS_BOLD = [
    "/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
]


def _resolve_font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = _FONT_CANDIDATES_BOLD if weight == "bold" else _FONT_CANDIDATES_NORMAL
    system = _SYSTEM_FALLBACKS_BOLD if weight == "bold" else _SYSTEM_FALLBACKS_NORMAL
    for name in candidates:
        path = FONTS_DIR / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    for path_str in system:
        if Path(path_str).exists():
            return ImageFont.truetype(path_str, size)
    # ultimate fallback
    return ImageFont.load_default()


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Wrap text honoring explicit \\n first, then word/char wrap per paragraph."""
    if not text:
        return [""]
    out: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph:
            out.append("")
            continue
        if " " in paragraph:
            words = paragraph.split(" ")
            current = ""
            for word in words:
                candidate = word if not current else current + " " + word
                if _text_width(font, candidate) <= max_width:
                    current = candidate
                else:
                    if current:
                        out.append(current)
                    current = word
            if current:
                out.append(current)
        else:
            current = ""
            for ch in paragraph:
                candidate = current + ch
                if _text_width(font, candidate) <= max_width:
                    current = candidate
                else:
                    if current:
                        out.append(current)
                    current = ch
            if current:
                out.append(current)
    return out or [""]


def _text_width(font: ImageFont.FreeTypeFont, text: str) -> int:
    bbox = font.getbbox(text)
    return bbox[2] - bbox[0]


def _draw_background(canvas: Image.Image, bg: Background, bg_image: Image.Image | None) -> None:
    w, h = canvas.size
    if bg.type == "color" and bg.color:
        canvas.paste(Image.new("RGBA", canvas.size, (*bg.color, 255)), (0, 0))
        return
    img: Image.Image | None = bg_image
    if img is None and bg.type == "image" and bg.image_path:
        path = Path(bg.image_path)
        if path.exists():
            img = Image.open(path).convert("RGBA")
    if img is None:
        # default neutral background
        canvas.paste(Image.new("RGBA", canvas.size, (32, 32, 32, 255)), (0, 0))
        return
    img = img.convert("RGBA")
    # cover-fit
    src_w, src_h = img.size
    scale = max(w / src_w, h / src_h)
    new_size = (int(src_w * scale), int(src_h * scale))
    img = img.resize(new_size, Image.LANCZOS)
    left = (img.width - w) // 2
    top = (img.height - h) // 2
    cropped = img.crop((left, top, left + w, top + h))
    canvas.paste(cropped, (0, 0))


def _draw_text_layer(canvas: Image.Image, layer: TextLayer) -> None:
    draw = ImageDraw.Draw(canvas)
    font = _resolve_font(layer.weight, layer.font_size)
    x, y = layer.xy
    if layer.max_width:
        lines = _wrap_text(layer.content, font, layer.max_width)
    else:
        lines = layer.content.split("\n")
    for i, line in enumerate(lines):
        line_w = _text_width(font, line)
        if layer.align == "center":
            draw_x = x + (layer.max_width - line_w) // 2 if layer.max_width else x - line_w // 2
        elif layer.align == "right":
            draw_x = x + layer.max_width - line_w if layer.max_width else x - line_w
        else:
            draw_x = x
        ascent, descent = font.getmetrics()
        line_height = ascent + descent
        draw_y = y + i * (line_height + layer.line_spacing)
        draw.text(
            (draw_x, draw_y),
            line,
            fill=layer.color,
            font=font,
            stroke_width=layer.stroke_width,
            stroke_fill=layer.stroke_color,
        )


def _draw_rect_layer(canvas: Image.Image, layer: RectLayer) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    if layer.radius > 0:
        draw.rounded_rectangle(layer.xy, radius=layer.radius, fill=layer.fill)
    else:
        draw.rectangle(layer.xy, fill=layer.fill)
    canvas.alpha_composite(overlay)


def _draw_image_layer(canvas: Image.Image, layer: ImageLayer) -> None:
    path = Path(layer.path)
    if not path.exists():
        return
    img = Image.open(path).convert("RGBA")
    if layer.size:
        img = img.resize(layer.size, Image.LANCZOS)
    canvas.alpha_composite(img, dest=layer.xy)


def render(template: Template, background_image: Image.Image | None = None) -> Image.Image:
    """Render the banner. background_image overrides template.background when provided."""
    canvas = Image.new("RGBA", (template.size.width, template.size.height), (0, 0, 0, 255))
    _draw_background(canvas, template.background, background_image)
    for layer in template.layers:
        if isinstance(layer, TextLayer):
            _draw_text_layer(canvas, layer)
        elif isinstance(layer, RectLayer):
            _draw_rect_layer(canvas, layer)
        elif isinstance(layer, ImageLayer):
            _draw_image_layer(canvas, layer)
    return canvas


def image_to_png_bytes(img: Image.Image) -> bytes:
    buf = BytesIO()
    img.convert("RGBA").save(buf, format="PNG")
    return buf.getvalue()
