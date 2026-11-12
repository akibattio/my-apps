"""定時実行の記録に、取引先の情報を出さないための出力の決まり。

akibattio/my-apps は公開リポジトリで、GitHub Actions の実行の記録は GitHub にログインした誰でも読める。
記録（標準出力・標準エラー）に出してよいのは「件数・媒体の名前・処理の成否・所要時間」だけ。
取引先の名前・識別名・アカウントID・金額・成果の数値・検索語・広告の名前・アラートの本文・API の応答本文や URL は出さない。
取引先を区別したいときは順番の番号（1件目、2件目）にする。

- detail(...)  : 取引先の情報を含む行。手元で ADOPS_VERBOSE=1 のときだけ出す。GitHub Actions 上（GITHUB_ACTIONS あり）では
                 ADOPS_VERBOSE があっても出さない。
- err(e)       : 例外を「種類（状態番号）」だけの短い文にする。
- 未処理の例外 : 詳細モード以外では、トレースバック（例外の文に API の応答が入りうる）を出さず、種類と発生行だけ出す。
"""
from __future__ import annotations

import os
import re
import sys
import time

VERBOSE = os.environ.get("ADOPS_VERBOSE", "").strip() == "1" and not os.environ.get("GITHUB_ACTIONS")


def detail(*args, **kwargs) -> None:
    """取引先の名前・金額・検索語などを含む行。詳細モードのときだけ出す。"""
    if VERBOSE:
        print(*args, **kwargs)


def _status(e) -> int | None:
    for v in (getattr(e, "code", None), getattr(e, "status", None),
              getattr(getattr(e, "response", None), "status_code", None)):
        if isinstance(v, int):
            return v
    return None


def err(e) -> str:
    """例外 → 「種類」または「種類（状態 400）」。文字列（__error__ の値など）なら状態番号だけ拾う。"""
    if isinstance(e, BaseException):
        code = _status(e)
        return type(e).__name__ + (f"（状態 {code}）" if code else "")
    m = re.search(r"\b([1-5]\d\d)\b", str(e or ""))
    return f"取得エラー（状態 {m.group(1)}）" if m else "取得エラー"


class Timer:
    """所要時間（秒）。記録に出してよい情報。"""

    def __init__(self):
        self.t0 = time.monotonic()

    def __str__(self):
        return f"{time.monotonic() - self.t0:.0f}秒"


def _quiet_excepthook(etype, value, tb):
    last = None
    while tb is not None:
        last, tb = tb, tb.tb_next
    where = f"{os.path.basename(last.tb_frame.f_code.co_filename)}:{last.tb_lineno}" if last else "?"
    print(f"未処理の例外: {etype.__name__}（{where}・詳細は記録に出さない）", file=sys.stderr)


if not VERBOSE:
    sys.excepthook = _quiet_excepthook
