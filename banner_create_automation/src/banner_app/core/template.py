"""Template data model and JSON loader."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal, Union

from pydantic import BaseModel, Field

from ..config import TEMPLATES_DIR


class Size(BaseModel):
    width: int
    height: int


class Background(BaseModel):
    type: Literal["ai", "color", "image"] = "ai"
    prompt: str | None = None
    color: tuple[int, int, int] | None = None
    image_path: str | None = None


class TextLayer(BaseModel):
    type: Literal["text"] = "text"
    content: str
    xy: tuple[int, int]
    font_size: int = 48
    color: tuple[int, int, int] = (255, 255, 255)
    weight: Literal["normal", "bold"] = "normal"
    align: Literal["left", "center", "right"] = "left"
    max_width: int | None = None  # for wrapping
    line_spacing: int = 6
    stroke_width: int = 0
    stroke_color: tuple[int, int, int] = (0, 0, 0)


class RectLayer(BaseModel):
    type: Literal["rect"] = "rect"
    xy: tuple[int, int, int, int]  # x0, y0, x1, y1
    fill: tuple[int, int, int, int] = (0, 0, 0, 180)  # RGBA
    radius: int = 0


class ImageLayer(BaseModel):
    type: Literal["image"] = "image"
    path: str
    xy: tuple[int, int]
    size: tuple[int, int] | None = None  # resize target


Layer = Union[TextLayer, RectLayer, ImageLayer]


class Template(BaseModel):
    name: str
    size: Size
    background: Background
    layers: list[Layer] = Field(default_factory=list)
    variables: list[str] = Field(default_factory=list)

    def aspect(self) -> str:
        w, h = self.size.width, self.size.height
        if w == h:
            return "square"
        return "portrait" if h > w else "landscape"


def load_template(path: Path) -> Template:
    data = json.loads(path.read_text(encoding="utf-8"))
    return Template.model_validate(data)


def list_templates() -> list[Path]:
    if not TEMPLATES_DIR.exists():
        return []
    return sorted(TEMPLATES_DIR.glob("*.json"))


def substitute_variables(template: Template, values: dict[str, str]) -> Template:
    """Return a copy of the template with {var} placeholders replaced."""
    data = template.model_dump()
    if data["background"].get("prompt"):
        data["background"]["prompt"] = _fmt(data["background"]["prompt"], values)
    for layer in data["layers"]:
        if layer["type"] == "text":
            layer["content"] = _fmt(layer["content"], values)
    return Template.model_validate(data)


def _fmt(text: str, values: dict[str, str]) -> str:
    out = text
    for key, val in values.items():
        out = out.replace("{" + key + "}", val)
    return out
