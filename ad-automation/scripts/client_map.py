#!/usr/bin/env python3
"""クライアント名の名寄せ。REPORT GLASS の対応表（report-glass/pipeline/client_slug_map.json）を正とする。

- Meta広告アカウント名（例「TOOGU.shop」）→ 運用名（例「【東海グランド】TOOGU」）。コンソールで媒体別でなく社別にまとめるため
  修正依頼 2026-11-09（今井）「東海グランドとTOOGU.shopを統合」
- 運用名 → REPORT GLASS の slug（社別レポートへのリンク用）
対応表が無い環境では何もしない（名前はそのまま）。
"""
from __future__ import annotations
import json
from pathlib import Path

# 正は report-glass/pipeline/client_slug_map.json。GitHub Actions には report-glass が無いので、写しを clients/ に置く
# （社やMeta口座を足したら写しも更新する）。Macでは本体があれば本体を優先。
SLUGMAPS = [Path.home() / "dev" / "report-glass" / "pipeline" / "client_slug_map.json",
            Path(__file__).resolve().parent.parent / "clients" / "report_glass_slug_map.json"]


def _load() -> dict:
    for p in SLUGMAPS:
        try:
            return json.loads(p.read_text(encoding="utf-8")).get("clients", {})
        except Exception:
            continue
    return {}


_MAP = _load()
_META = {act: name for name, v in _MAP.items() for act in (v.get("metaAccountIds") or [])}


def canonical(name: str, acct: str = "") -> str:
    """Metaアカウント（act_...）なら対応表の運用名に寄せる。それ以外は名前のまま。"""
    return _META.get(acct, name)


def report_slug(name: str) -> str:
    return (_MAP.get(name) or {}).get("slug", "")
