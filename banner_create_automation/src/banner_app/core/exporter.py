"""Render & export banners across multiple templates from one set of variables."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

from PIL import Image

from ..config import Config
from .renderer import render
from .template import Template, load_template, substitute_variables


def export_banner(
    template: Template,
    variables: dict[str, str],
    background: Image.Image | None,
    out_dir: Path | None = None,
) -> Path:
    """Render a single template with given variables and save PNG. Returns the path."""
    Config.ensure_dirs()
    target_dir = out_dir or Config.output_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    bound = substitute_variables(template, variables)
    img = render(bound, background_image=background)
    safe_name = template.name.replace(" ", "_").replace("/", "_")
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = target_dir / f"{safe_name}_{template.size.width}x{template.size.height}_{ts}.png"
    img.save(out_path, format="PNG")
    return out_path


def export_all(
    template_paths: list[Path],
    variables: dict[str, str],
    background: Image.Image | None,
    out_dir: Path | None = None,
) -> list[Path]:
    """Render the provided variables across many templates (different sizes)."""
    results: list[Path] = []
    for path in template_paths:
        tpl = load_template(path)
        results.append(export_banner(tpl, variables, background, out_dir))
    return results
