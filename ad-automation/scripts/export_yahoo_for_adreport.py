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
    return start.isoformat(), end.isoformat()


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
            campaigns = []
            for a in accs:
                kind = "display" if a.get("kind") == "display" else "search"
                try:
                    campaigns += Y.yahoo_campaigns(str(a["accountId"]), kind, start, end)
                except Exception as ex:
                    print(f"  取得失敗 {slug}/{kind}: {str(ex)[:70]}")
            if not campaigns:
                print(f"  {slug}: {ym} のキャンペーン実績なし → 出力スキップ（推測で埋めない）")
                continue
            payload = {"campaigns": campaigns}
        out = out_dir / f"{slug}-{ym}.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        n = len(payload["campaigns"])
        print(f"  出力 {out}  （{n}キャンペーン{'・サンプル' if sample else ''}）")
        wrote += 1

    print(f"完了: {wrote}ファイルを {out_dir} に出力（{ym}）。")
    print(f"→ ad-report側で再生成: node generate.js --customer=<ID> --month={ym}（この操作はad-report側）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
