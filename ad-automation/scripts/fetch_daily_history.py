#!/usr/bin/env python3
"""過去13か月の日次実績を蓄積する（コンソールの「期間集計」＝任意の開始日〜終了日で集計する機能用）。
読み取りのみ・媒体へは書き込まない（CLAUDE.md §0）。

対象: console/data.json の口座（Google / Meta / Yahoo!検索 / Yahoo!ディスプレイ）＋ Microsoft広告の口座表。
蓄積の仕方:
  - 初回・新しく増えた口座 … 13か月分（13か月前の月初〜今日）をまとめて取得
  - 2回目以降 … 直近40日だけ取り直して上書き（CVの遅れ計上や媒体側の数値修正を反映）
  - 取得に失敗した口座は前回までの蓄積をそのまま残す（推測で埋めない）
保存:
  data/history.json    … 蓄積の正（毎回これに追記・上書き）
  console/history.json … コンソール配信用の軽量版（実績がある日だけ）

修正依頼 2026-11-06（今井）「任意で設定した日付や期間で数値が集計できるように」への対応。

使い方: python3 scripts/fetch_daily_history.py [--full]   … --full は全口座を13か月分取り直す
"""
from __future__ import annotations
import sys, json, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_daily_series import load_env, google_daily, meta_daily  # noqa: E402

PROJ = Path(__file__).resolve().parent.parent
MONTHS = 13          # 何か月さかのぼって保持するか
REFRESH_DAYS = 40    # 2回目以降に取り直す直近日数
STORE = PROJ / "data" / "history.json"
OUT = PROJ / "console" / "history.json"


def window_start(today: datetime.date) -> datetime.date:
    """13か月前の月初（例: 2026-11-07 → 2025-10-01）。"""
    idx = today.year * 12 + (today.month - 1) - MONTHS
    return datetime.date(idx // 12, idx % 12 + 1, 1)


def target_accounts() -> list[dict]:
    """[{client, media, acct}]。Microsoft はコンソールの data.json に無いので口座表から足す。"""
    out = []
    dpath = PROJ / "console" / "data.json"
    if dpath.exists():
        for a in json.loads(dpath.read_text(encoding="utf-8")).get("accounts", []):
            if a.get("media") in ("google", "meta", "yahoo_search", "yahoo_display") and a.get("acct"):
                out.append({"client": a.get("client"), "media": a.get("media"), "acct": str(a.get("acct"))})
    try:
        from fetch_microsoft_insights import ms_enabled
        import media_accounts
        if ms_enabled():
            for e in media_accounts.load("microsoft"):
                out.append({"client": e.get("client"), "media": "microsoft", "acct": str(e.get("accountId"))})
    except Exception as e:
        print("  Microsoft口座の読み込みをスキップ:", str(e)[:100])
    return out


def fetch(a: dict, start: str, end: str):
    """媒体ごとの日次 [{date, imp, clk, cost, cv}]。失敗時は {'__error__': ...}。"""
    import os
    media, acct = a["media"], a["acct"]
    try:
        if media == "google":
            series, _ = google_daily(acct, start, end)
            return series
        if media == "meta":
            tok = os.environ.get("SOFCOM_META_SYSTEM_USER_TOKEN", "").strip()
            if not tok:
                return {"__error__": "Metaトークン未設定"}
            # Meta は13か月を一括で取ると費用・表示・クリックが0で返る日がある（2026-11-07 確認）。
            # 1か月ずつ取れば正しい値になる（週ごとの合計と一致）ので、月単位に分割して取得する。
            out, s = [], datetime.date.fromisoformat(start)
            last = datetime.date.fromisoformat(end)
            while s <= last:
                nxt = datetime.date(s.year + (s.month == 12), s.month % 12 + 1, 1)
                e = min(last, nxt - datetime.timedelta(days=1))
                part = meta_daily(acct, tok, s.isoformat(), e.isoformat())
                if isinstance(part, dict):
                    return part
                out += part
                s = nxt
            return out
        if media in ("yahoo_search", "yahoo_display"):
            from fetch_yahoo_insights import yahoo_daily, yahoo_enabled
            if not yahoo_enabled():
                return {"__error__": "Yahoo接続情報なし"}
            return yahoo_daily(acct, "display" if media == "yahoo_display" else "search", start, end)
        if media == "microsoft":
            from fetch_microsoft_insights import ms_daily
            return ms_daily(acct, start, end)
    except Exception as e:
        return {"__error__": str(e)[:120]}
    return {"__error__": f"未対応の媒体 {media}"}


def main():
    full = "--full" in sys.argv
    load_env()
    today = datetime.date.today()
    w_start = window_start(today)
    end = today.isoformat()
    store = json.loads(STORE.read_text(encoding="utf-8")) if STORE.exists() else {}
    accts = store.get("accounts", {})

    ok = ng = 0
    for a in target_accounts():
        key = f"{a['media']}|{a['acct']}"
        prev = accts.get(key) or {}
        rows = prev.get("rows", {})
        # 13か月分そろっていない口座（初回・新規）はまとめて取得、そろっていれば直近だけ取り直す
        backfill = full or not prev or (prev.get("from") or "9999") > w_start.isoformat()
        f_start = w_start if backfill else max(w_start, today - datetime.timedelta(days=REFRESH_DAYS))
        series = fetch(a, f_start.isoformat(), end)
        if isinstance(series, dict) and "__error__" in series:
            print(f"  取得失敗（前回までの蓄積を維持）{a['client']}[{a['media']}]: {series['__error__']}")
            ng += 1
            if prev:
                accts[key] = {**prev, "client": a["client"], "error": series["__error__"]}
            continue
        # 取り直した範囲は丸ごと置き換える（実績0の日が返らない媒体でも古い値が残らないように）
        rows = {d: v for d, v in rows.items() if not (f_start.isoformat() <= d <= end)}
        for r in series:
            d = str(r.get("date") or "")[:10]
            if d:
                rows[d] = [round(r.get("cost") or 0), int(r.get("imp") or 0), int(r.get("clk") or 0),
                           round(float(r.get("cv") or 0), 1)]
        rows = {d: v for d, v in rows.items() if d >= w_start.isoformat()}
        accts[key] = {"client": a["client"], "media": a["media"], "acct": a["acct"],
                      "from": w_start.isoformat() if backfill else (prev.get("from") or w_start.isoformat()),
                      "updated": end, "rows": rows}
        ok += 1
        print(f"  {a['client'][:22]:24}[{a['media']}] {'13か月取得' if backfill else '直近更新'} "
              f"{f_start.isoformat()}〜{end} / 蓄積{len(rows)}日")

    # 13か月より古い日を落とす（口座ごと）
    for v in accts.values():
        v["rows"] = {d: x for d, x in (v.get("rows") or {}).items() if d >= w_start.isoformat()}

    STORE.parent.mkdir(exist_ok=True)
    STORE.write_text(json.dumps({"generated": end, "from": w_start.isoformat(), "to": end, "accounts": accts},
                                ensure_ascii=False), encoding="utf-8")

    # 配信用の軽量版：[日付, 費用, 表示, クリック, CV]・実績がある日だけ
    light = []
    for v in accts.values():
        d = [[day, *x] for day, x in sorted((v.get("rows") or {}).items()) if any(x)]
        light.append({"client": v.get("client"), "media": v.get("media"), "acct": v.get("acct"),
                      "updated": v.get("updated"), "error": v.get("error"), "d": d})
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"generated": end, "from": w_start.isoformat(), "to": end,
                               "cols": ["date", "cost", "imp", "clk", "cv"], "accounts": light},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"console/history.json 出力: {len(light)}口座（取得OK {ok} / 失敗 {ng}）期間 {w_start}〜{end}"
          f" / {OUT.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
