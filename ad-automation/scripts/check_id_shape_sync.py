#!/usr/bin/env python3
"""番号の桁の決まりが3か所（media_accounts.py・console/_worker.js・console/ad_ops_console.jsx）で同じかを確かめる。
ずれていたら終了コード1。日次のデプロイの前に動かす（画面・保存の入口・取得の側で、通す口座が食い違うのを防ぐ）。"""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from media_accounts import ID_SHAPE  # noqa: E402

CONSOLE = Path(__file__).resolve().parent.parent / "console"


def _shapes(text: str, start: str) -> dict:
    i = text.find(start)
    if i < 0:
        return {}
    block = text[i:text.find("};", i)]
    return {k: "^" + v + "$" for k, v in re.findall(r"(\w+):\s*(?:\{\s*re:\s*)?/\^(.+?)\$/", block)}


def main() -> int:
    worker = _shapes((CONSOLE / "_worker.js").read_text(encoding="utf-8"), "const ID_SHAPE")
    screen = _shapes((CONSOLE / "ad_ops_console.jsx").read_text(encoding="utf-8"), "const MEDIA_ID_SHAPE")
    ng = [name for name, got in (("_worker.js", worker), ("ad_ops_console.jsx", screen)) if got != ID_SHAPE]
    if ng:
        print("番号の桁の決まりが media_accounts.py とずれている:", ", ".join(ng))
        return 1
    print(f"番号の桁の決まりは3か所で同じ（{len(ID_SHAPE)}媒体）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
