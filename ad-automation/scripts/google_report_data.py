#!/usr/bin/env python3
"""Google単一アカウントのレポート用データ取得（月次時系列＋キーワード別）。読み取りのみ。
使い方: python3 scripts/google_report_data.py <customer_id> [out.json]"""
from __future__ import annotations
import os, re, sys, json
from pathlib import Path


def load_env(path=Path(".env")):
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def main():
    cid = re.sub(r"\D", "", sys.argv[1])
    outpath = sys.argv[2] if len(sys.argv) > 2 else None
    load_env()
    from google.ads.googleads.client import GoogleAdsClient
    mcc = re.sub(r"\D", "", os.environ["GOOGLE_LOGIN_CUSTOMER_ID"])
    cli = GoogleAdsClient.load_from_dict({
        "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"].strip(),
        "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"].strip(),
        "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"].strip(),
        "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"].strip(),
        "login_customer_id": mcc, "use_proto_plus": True})
    ga = cli.get_service("GoogleAdsService")
    # 月次は昨年頭〜今日（今年vs昨年の重ね用）。キーワードは今年(YTD)。
    MDR = "BETWEEN '2025-01-01' AND '2026-07-04'"
    KDR = "BETWEEN '2026-01-01' AND '2026-07-04'"

    # 月次
    monthly = []
    for r in ga.search(customer_id=cid, query=f"""
        SELECT segments.month, metrics.impressions, metrics.clicks, metrics.ctr,
               metrics.average_cpc, metrics.cost_micros, metrics.conversions, metrics.conversions_value
        FROM customer WHERE segments.date {MDR} ORDER BY segments.month"""):
        m = r.metrics
        monthly.append({
            "m": r.segments.month[:7],
            "imp": int(m.impressions or 0), "clk": int(m.clicks or 0),
            "ctr": round((m.ctr or 0) * 100, 2), "cpc": round((m.average_cpc or 0) / 1e6),
            "cost": round((m.cost_micros or 0) / 1e6), "cv": round(m.conversions or 0, 1),
            "rev": round((m.conversions_value or 0)),
        })

    # キーワード別（費用順・上位30）
    kws = []
    for r in ga.search(customer_id=cid, query=f"""
        SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
               metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc,
               metrics.cost_micros, metrics.conversions
        FROM keyword_view WHERE segments.date {KDR}
        ORDER BY metrics.cost_micros DESC LIMIT 30"""):
        k = r.ad_group_criterion.keyword; m = r.metrics
        cost = (m.cost_micros or 0) / 1e6; conv = m.conversions or 0
        kws.append({
            "text": k.text, "match": k.match_type.name,
            "imp": int(m.impressions or 0), "clk": int(m.clicks or 0),
            "ctr": round((m.ctr or 0) * 100, 2), "cpc": round((m.average_cpc or 0) / 1e6),
            "cost": round(cost), "cv": round(conv, 1),
            "cpa": (round(cost / conv) if conv else None),
        })

    data = {"customer": cid, "monthly": monthly, "keywords": kws}
    if outpath:
        Path(outpath).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"月次 {len(monthly)}ヶ月 / キーワード {len(kws)}件")
    print("月次(末尾6):")
    for x in monthly[-6:]:
        print(f"  {x['m']} 費用¥{x['cost']:,} 表示{x['imp']:,} クリック{x['clk']:,} CTR{x['ctr']}% CPC¥{x['cpc']} CV{x['cv']}")
    print("キーワード上位8:")
    for k in kws[:8]:
        print(f"  {k['text'][:24]:26}[{k['match']}] ¥{k['cost']:,} clk{k['clk']} CTR{k['ctr']}% CPC¥{k['cpc']} CV{k['cv']}")


if __name__ == "__main__":
    main()
