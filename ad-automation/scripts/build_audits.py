#!/usr/bin/env python3
"""全Googleアカウントの機械監査(google_audit のルール)を実行し console/audit.json に集約。

各アカウントを ads-google 観点のルールでチェックし、スコア/グレード/所見(findings)を出力。
クライアント詳細ページ（コンソール）がこれを読み、監査チェックの現状を表示する。読み取りのみ。

使い方: python3 scripts/build_audits.py [days=90]
"""
from __future__ import annotations
import json, re, sys, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from google_audit import pull, audit, client, load_env  # noqa: E402

PROJ = Path(__file__).resolve().parent.parent


def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 90
    load_env(PROJ / ".env")
    dpath = PROJ / "console" / "data.json"
    if not dpath.exists():
        print("console/data.json が無い（先に取得を実行）"); raise SystemExit(1)
    accounts = json.loads(dpath.read_text(encoding="utf-8")).get("accounts", [])
    end = datetime.date.today()
    start = end - datetime.timedelta(days=days)
    dr = f"BETWEEN '{start.isoformat()}' AND '{end.isoformat()}'"
    label = f"{start.isoformat()}〜{end.isoformat()}"

    ga = client().get_service("GoogleAdsService")
    out = {}
    for a in accounts:
        if a.get("media") != "google":
            continue
        cid = re.sub(r"\D", "", a.get("acct", "") or "")
        if not cid:
            continue
        try:
            d = pull(ga, cid, dr)
            res = audit(d, label)
            out[f"{a['client']}|{a['media']}"] = res
            print(f"  {a['client'][:18]:20} スコア{res['score']}/100({res['grade']}) 所見{len(res['findings'])}件")
        except Exception as e:
            print(f"  監査失敗 {a['client']}: {str(e)[:100]}")
            out[f"{a['client']}|{a['media']}"] = {"error": str(e)[:120]}

    payload = {"generated": end.isoformat(), "period": label, "byAccount": out}
    (PROJ / "console" / "audit.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"console/audit.json 出力: {len(out)}アカウント / 期間 {label}")


if __name__ == "__main__":
    main()
