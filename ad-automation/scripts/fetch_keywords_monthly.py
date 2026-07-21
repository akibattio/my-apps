#!/usr/bin/env python3
"""月次キーワード別実績（直近数ヶ月・アカウント別）→ console/keywords.json。読み取りのみ。

クライアント提出レポート（コンソールの「レポート」タブ）のキーワード分析用。
Google広告(keyword_view)を月別に取得。Yahoo検索広告のキーワードレポートは follow-up（YAHOO_SETUP.md 参照）。

使い方: python3 scripts/fetch_keywords_monthly.py [months=4]
"""
from __future__ import annotations
import os, re, sys, json, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_daily_series import load_env, google_service  # noqa: E402

PROJ = Path(__file__).resolve().parent.parent
TOP_N = 30  # 月ごとの上位キーワード数（費用順）


def _month_starts(n):
    """直近nヶ月＋当月の (YYYY-MM, 月初, 月末) を返す。"""
    today = datetime.date.today()
    out = []
    y, m = today.year, today.month
    for _ in range(n + 1):
        first = datetime.date(y, m, 1)
        nxt = datetime.date(y + (m // 12), (m % 12) + 1, 1)
        last = min(nxt - datetime.timedelta(days=1), today)
        out.append((f"{y:04d}-{m:02d}", first.isoformat(), last.isoformat()))
        m -= 1
        if m == 0:
            m = 12; y -= 1
    return out


def google_keywords(cid, start, end):
    """期間内のキーワード×月を集計し、月ごと上位TOP_N（費用順）を返す。"""
    ga = google_service()
    agg = {}  # (month, text, match) -> sums
    for r in ga.search(customer_id=re.sub(r"\D", "", cid), query=f"""
        SELECT segments.month, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
               metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM keyword_view WHERE segments.date BETWEEN '{start}' AND '{end}'"""):
        k = r.ad_group_criterion.keyword
        mo = str(r.segments.month)[:7]
        key = (mo, k.text, k.match_type.name)
        e = agg.setdefault(key, {"imp": 0, "clk": 0, "cost": 0.0, "cv": 0.0})
        m = r.metrics
        e["imp"] += int(m.impressions or 0); e["clk"] += int(m.clicks or 0)
        e["cost"] += (m.cost_micros or 0) / 1e6; e["cv"] += float(m.conversions or 0)
    by_month = {}
    for (mo, text, match), v in agg.items():
        row = {"text": text, "match": match, "imp": v["imp"], "clk": v["clk"],
               "ctr": round(v["clk"] / v["imp"] * 100, 2) if v["imp"] else 0,
               "cpc": round(v["cost"] / v["clk"]) if v["clk"] else 0,
               "cost": round(v["cost"]), "cv": round(v["cv"], 1),
               "cpa": round(v["cost"] / v["cv"]) if v["cv"] else None}
        by_month.setdefault(mo, []).append(row)
    for mo in by_month:
        by_month[mo] = sorted(by_month[mo], key=lambda x: x["cost"], reverse=True)[:TOP_N]
    return by_month


def main():
    months = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    load_env()
    dpath = PROJ / "console" / "data.json"
    if not dpath.exists():
        print("console/data.json が無い（先に取得を実行）"); raise SystemExit(1)
    accounts = json.loads(dpath.read_text(encoding="utf-8")).get("accounts", [])
    spans = _month_starts(months)
    start = spans[-1][1]
    end = spans[0][2]

    out = {}
    for a in accounts:
        media, acct, client = a.get("media"), a.get("acct"), a.get("client")
        try:
            if media == "google":
                bm = google_keywords(acct, start, end)
            elif media in ("yahoo_search",):
                # Yahoo検索のキーワードレポートは follow-up（YAHOO_SETUP.md）。今は空。
                bm = {}
            else:
                continue  # Meta/ディスプレイはキーワードなし
        except Exception as e:
            print(f"  取得失敗 {client}({media}): {str(e)[:70]}"); bm = {}
        if bm:
            out[f"{client}|{media}"] = bm
            print(f"  {client[:18]:20}[{media}] {sum(len(v) for v in bm.values())}件 / {len(bm)}ヶ月")

    (PROJ / "console" / "keywords.json").write_text(
        json.dumps({"generated": end, "topN": TOP_N, "byAccount": out}, ensure_ascii=False), encoding="utf-8")
    print(f"console/keywords.json 出力: {len(out)}アカウント / 期間 {start}〜{end}")


if __name__ == "__main__":
    main()
