#!/usr/bin/env python3
"""ad-report（クライアント向けHTMLレポート・Node）へ Yahoo!広告データを受け渡す。読み取りのみ。

役割分担: 取得=ad-automation(このリポ) / 表示=ad-report。契約: ad-report/docs/yahoo-ingest-contract.md
出力: <AD_REPORT_DIR>/<slug>-<YYYY-MM>.json  形式: {"campaigns":[{name,type,cost,impressions,clicks,conversions}]}
  - slug は clients/yahoo_accounts.json の "slug"（ad-report/pipeline/clients.json と一致）
  - 検索(kind=search→type「検索」)/ディスプレイ(kind=display→type「ディスプレイ」)を1ファイルに混在

使い方:
  python3 scripts/export_yahoo_for_adreport.py [YYYY-MM]     # 省略時は先月
  python3 scripts/export_yahoo_for_adreport.py 2026-06 --sample   # creds無しでサンプルJSONを書き出し（疎通確認）

環境変数:
  AD_REPORT_DIR   既定 ~/ClaudeCode/ad-report/pipeline/yahoo
  （Yahoo接続情報は fetch_yahoo_insights.py と同じ YAHOO_ADS_* を使用）

※ 未接続(creds無し)なら実データは出さず終了（--sample 指定時のみサンプルを書く）。書き込みは ad-report の
  取り込み用ディレクトリのみ。広告媒体へis一切書き込まない（CLAUDE.md §0）。
"""
from __future__ import annotations
import os, sys, json, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetch_yahoo_insights as Y  # noqa: E402

PROJ = Path(__file__).resolve().parent.parent
DEFAULT_DIR = Path(os.path.expanduser("~/ClaudeCode/ad-report/pipeline/yahoo"))


def _last_month() -> str:
    t = datetime.date.today().replace(day=1) - datetime.timedelta(days=1)
    return f"{t.year:04d}-{t.month:02d}"


def _month_span(ym: str):
    y, m = int(ym[:4]), int(ym[5:7])
    start = datetime.date(y, m, 1)
    end = datetime.date(y + (m // 12), (m % 12) + 1, 1) - datetime.timedelta(days=1)
    end = min(end, datetime.date.today())  # 当月は未来日を渡さない（ディスプレイAPIは未来日でV0001）
    return start.isoformat(), end.isoformat()


def _months_ago_start(ym: str, n: int) -> str:
    """ym の (n-1)ヶ月前の月初（月次推移レンジ用）。"""
    y, m = int(ym[:4]), int(ym[5:7])
    m -= (n - 1)
    while m <= 0:
        m += 12; y -= 1
    return datetime.date(y, m, 1).isoformat()


def _build_payload(slug, accs, ym, start, end):
    """スラッグ配下（検索＋ディスプレイ）を合算し ad-report契約のリッチJSONを組む。取れる項目だけ入れる。"""
    campaigns, dev, daily, monthly, kws, qrs = [], {}, {}, {}, {}, {}
    mon_start = _months_ago_start(ym, 12)  # monthly は直近12ヶ月

    def add(bucket, key, cost=0, imp=None, clk=0, cv=0):
        e = bucket.setdefault(key, {"cost": 0, "imp": 0, "clk": 0, "cv": 0})
        e["cost"] += cost or 0; e["imp"] += imp or 0; e["clk"] += clk or 0; e["cv"] += cv or 0

    for a in accs:
        kind = "display" if a.get("kind") == "display" else "search"
        acct = str(a["accountId"])
        def safe(fn, *args):
            try:
                return fn(*args)
            except Exception as ex:
                print(f"  取得失敗 {slug}/{kind}/{fn.__name__}: {str(ex)[:60]}")
                return []
        campaigns += safe(Y.yahoo_campaigns, acct, kind, start, end)
        for d in safe(Y.yahoo_devices, acct, kind, start, end):
            add(dev, d["name"], d["cost"], d["impressions"], d["clicks"], d["conversions"])
        for d in safe(Y.yahoo_daily, acct, kind, start, end):
            add(daily, d["date"], d.get("cost"), d.get("imp"), d.get("clk"), d.get("cv"))
        for m in safe(Y.yahoo_monthly, acct, kind, mon_start, end):
            add(monthly, m["month"], m.get("cost"), m.get("imp"), m.get("clk"), m.get("cv"))
        if kind == "search":
            for k in safe(Y.yahoo_search_keywords, acct, start, end):
                add(kws, k["kw"], k["cost"], 0, k["clicks"], k.get("conversions", 0))
            for q in safe(Y.yahoo_search_queries, acct, start, end):
                add(qrs, q["q"], q["cost"], 0, q["clicks"], 0)

    if not campaigns and not any([dev, daily, monthly]):
        return None
    payload = {"campaigns": campaigns}
    if dev:
        payload["devices"] = [{"name": n, "cost": v["cost"], "impressions": v["imp"], "clicks": v["clk"], "conversions": v["cv"]}
                              for n, v in sorted(dev.items(), key=lambda kv: kv[1]["cost"], reverse=True)]
    if daily:
        payload["daily"] = [{"date": d, "cost": v["cost"], "clicks": v["clk"], "conversions": v["cv"]}
                            for d, v in sorted(daily.items())]
    if monthly:
        payload["monthly"] = [{"ym": m[:7], "cost": v["cost"], "clicks": v["clk"], "conversions": v["cv"]}
                              for m, v in sorted(monthly.items())]
    if kws:
        payload["keywords"] = [{"kw": n, "clicks": v["clk"], "cost": v["cost"], "conversions": v["cv"]}
                               for n, v in sorted(kws.items(), key=lambda kv: kv[1]["cost"], reverse=True)[:30]]
    if qrs:
        payload["queries"] = [{"q": n, "clicks": v["clk"], "cost": v["cost"]}
                              for n, v in sorted(qrs.items(), key=lambda kv: kv[1]["cost"], reverse=True)[:30]]
    return payload


def _sample(slug: str) -> dict:
    return {"campaigns": [
        {"name": f"検索_一般（{slug}）", "type": "検索", "cost": 42000, "impressions": 15000, "clicks": 520, "conversions": 4},
        {"name": f"ディスプレイ_リターゲ（{slug}）", "type": "ディスプレイ", "cost": 18000, "impressions": 380000, "clicks": 640, "conversions": 1},
    ]}


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sample = "--sample" in sys.argv
    ym = args[0] if args else _last_month()
    out_dir = Path(os.environ.get("AD_REPORT_DIR", str(DEFAULT_DIR)))
    Y.load_env()

    cfg_path = PROJ / "clients" / "yahoo_accounts.json"
    if not cfg_path.exists():
        print("clients/yahoo_accounts.json が無い（アカウント対応表を用意）。例: clients/yahoo_accounts.example.json")
        return 2
    entries = [e for e in json.loads(cfg_path.read_text(encoding="utf-8")) if isinstance(e, dict) and e.get("slug") and e.get("accountId")]
    if not entries:
        print("slug付きのYahooアカウントが未設定です（yahoo_accounts.json に slug/accountId を記入）。")
        return 2

    # slug ごとにアカウントをまとめる
    by_slug: dict[str, list] = {}
    for e in entries:
        by_slug.setdefault(e["slug"], []).append(e)

    if not sample and not Y.yahoo_enabled():
        print("Yahoo接続情報が未設定です。実データを出すには creds を .env に設定してください。")
        print("（疎通確認だけなら --sample でサンプルJSONを書き出せます）")
        return 2

    start, end = _month_span(ym)
    out_dir.mkdir(parents=True, exist_ok=True)
    wrote = 0
    for slug, accs in sorted(by_slug.items()):
        if sample:
            payload = _sample(slug)
        else:
            payload = _build_payload(slug, accs, ym, start, end)
            if payload is None:
                print(f"  {slug}: {ym} の実績なし → 出力スキップ（推測で埋めない）")
                continue
        out = out_dir / f"{slug}-{ym}.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        extra = "+".join(k for k in ("devices", "daily", "keywords", "queries", "monthly") if payload.get(k))
        print(f"  出力 {out}  （{len(payload['campaigns'])}キャンペーン{'・' + extra if extra else ''}{'・サンプル' if sample else ''}）")
        wrote += 1

    print(f"完了: {wrote}ファイルを {out_dir} に出力（{ym}）。")
    print(f"→ ad-report側で再生成: node generate.js --customer=<ID> --month={ym}（この操作はad-report側）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
