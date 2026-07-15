#!/usr/bin/env python3
"""月次時系列（過去14ヶ月・アカウント別）→ console/monthly.json。前年同月比・長期トレンド用。読み取りのみ。

console/data.json のアカウント一覧をもとに Google/Meta の月別実績を取得。
前年同月比（当月 vs 12ヶ月前）と月次トレンドグラフをクライアント詳細で表示する。

使い方: python3 scripts/fetch_monthly_series.py
"""
from __future__ import annotations
import os, re, sys, json, urllib.request, urllib.parse, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_daily_series import load_env, google_service, META_BASE, CV_ACTIONS, sum_action  # noqa: E402

PROJ = Path(__file__).resolve().parent.parent


def _row(mo, v):
    return {"month": mo, "imp": v["imp"], "clk": v["clk"], "cost": round(v["cost"]),
            "cv": round(v["cv"], 1), "cpa": round(v["cost"] / v["cv"]) if v["cv"] else None}


def google_monthly(cid, start, end):
    ga = google_service()
    agg = {}
    for r in ga.search(customer_id=re.sub(r"\D", "", cid), query=f"""
        SELECT segments.month, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM campaign WHERE segments.date BETWEEN '{start}' AND '{end}'"""):
        m = r.metrics
        mo = str(r.segments.month)[:7]
        e = agg.setdefault(mo, {"imp": 0, "clk": 0, "cost": 0.0, "cv": 0.0})
        e["imp"] += int(m.impressions or 0); e["clk"] += int(m.clicks or 0)
        e["cost"] += (m.cost_micros or 0) / 1e6; e["cv"] += m.conversions or 0
    return [_row(k, v) for k, v in sorted(agg.items())]


def meta_monthly(acc, tok, start, end):
    params = {"level": "account", "time_increment": "monthly",
              "time_range": json.dumps({"since": start, "until": end}),
              "fields": "spend,impressions,clicks,actions", "limit": "500", "access_token": tok}
    url = f"{META_BASE}/{acc}/insights?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            data = json.loads(r.read())
    except Exception:
        return []
    out = []
    for row in data.get("data", []):
        cost = round(float(row.get("spend", 0) or 0))
        cv = int(sum_action(row.get("actions"), CV_ACTIONS))
        out.append({"month": (row.get("date_start", "") or "")[:7],
                    "imp": int(float(row.get("impressions", 0) or 0)),
                    "clk": int(float(row.get("clicks", 0) or 0)),
                    "cost": cost, "cv": cv, "cpa": round(cost / cv) if cv else None})
    return out


def main():
    load_env()
    dpath = PROJ / "console" / "data.json"
    if not dpath.exists():
        print("console/data.json が無い（先に取得を実行）"); raise SystemExit(1)
    accounts = json.loads(dpath.read_text(encoding="utf-8")).get("accounts", [])
    today = datetime.date.today()
    y, mth = today.year, today.month - 13
    while mth <= 0:
        mth += 12; y -= 1
    start = datetime.date(y, mth, 1).isoformat()
    end = today.isoformat()
    tok = os.environ.get("SOFCOM_META_SYSTEM_USER_TOKEN", "").strip()

    out = {}
    for a in accounts:
        media, acct, client = a.get("media"), a.get("acct"), a.get("client")
        try:
            if media == "google":
                series = google_monthly(acct, start, end)
            elif media == "meta":
                series = meta_monthly(acct, tok, start, end) if tok else []
            else:
                continue
        except Exception as e:
            print(f"  取得失敗 {client}({media}): {str(e)[:80]}"); series = []
        out[f"{client}|{media}"] = series
        print(f"  {client[:18]:20}[{media}] {len(series)}ヶ月")

    (PROJ / "console" / "monthly.json").write_text(
        json.dumps({"generated": end, "range": f"{start}〜{end}", "byAccount": out}, ensure_ascii=False), encoding="utf-8")
    print(f"console/monthly.json 出力: {len(out)}アカウント / 期間 {start}〜{end}")


if __name__ == "__main__":
    main()
