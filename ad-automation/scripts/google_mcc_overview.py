#!/usr/bin/env python3
"""Google MCC 横断パフォーマンス分析（読み取りのみ）。
MCC配下の各アカウントの直近30日実績（費用/クリック/CV/CPA/CTR）を取得し、費用順に一覧＋要注意フラグ。"""
from __future__ import annotations
import os, re, sys
from pathlib import Path


def load_env(path=Path(".env")):
    if not path.exists():
        return
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def digits(s):
    return re.sub(r"\D", "", s or "")


def main():
    load_env()
    from google.ads.googleads.client import GoogleAdsClient
    from google.ads.googleads.errors import GoogleAdsException

    mcc = digits(os.environ["GOOGLE_LOGIN_CUSTOMER_ID"])
    client = GoogleAdsClient.load_from_dict({
        "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"].strip(),
        "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"].strip(),
        "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"].strip(),
        "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"].strip(),
        "login_customer_id": mcc,
        "use_proto_plus": True,
    })
    ga = client.get_service("GoogleAdsService")

    # 子アカウント（非MCC・ENABLED）
    children = []
    for r in ga.search(customer_id=mcc, query="""
        SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager
        FROM customer_client WHERE customer_client.status='ENABLED'"""):
        c = r.customer_client
        if not c.manager:
            children.append((str(c.id), c.descriptive_name))

    rows = []
    for cid, name in children:
        try:
            res = list(ga.search(customer_id=cid, query="""
                SELECT metrics.cost_micros, metrics.clicks, metrics.impressions,
                       metrics.conversions, metrics.conversions_value, metrics.ctr
                FROM customer WHERE segments.date DURING LAST_30_DAYS"""))
            if res:
                m = res[0].metrics
                spend = (m.cost_micros or 0) / 1_000_000
                clicks = m.clicks or 0
                conv = m.conversions or 0
                rows.append({"id": cid, "name": name, "spend": spend, "clicks": clicks,
                             "conv": conv, "cpa": (spend / conv if conv else None),
                             "ctr": (m.ctr or 0) * 100, "rev": m.conversions_value or 0})
            else:
                rows.append({"id": cid, "name": name, "spend": 0, "clicks": 0, "conv": 0, "cpa": None, "ctr": 0, "rev": 0})
        except GoogleAdsException as e:
            rows.append({"id": cid, "name": name, "err": e.failure.errors[0].message if e.failure.errors else "error"})

    rows.sort(key=lambda r: -r.get("spend", 0))
    print(f"MCC {mcc} 配下 {len(rows)}アカウント / 直近30日\n")
    print(f"{'アカウント':<34}{'費用':>10}{'クリック':>8}{'CV':>7}{'CPA':>9}{'CTR':>7}  フラグ")
    tot_s = tot_c = 0.0
    for r in rows:
        if "err" in r:
            print(f"{r['name'][:32]:<34}  取得エラー: {r['err'][:40]}")
            continue
        tot_s += r["spend"]; tot_c += r["conv"]
        flag = ""
        if r["spend"] > 0 and r["conv"] == 0:
            flag = "⚠ CV0で消化"
        cpa = f"¥{r['cpa']:,.0f}" if r["cpa"] else "—"
        print(f"{r['name'][:32]:<34}¥{r['spend']:>9,.0f}{r['clicks']:>8,.0f}{r['conv']:>7.0f}{cpa:>9}{r['ctr']:>6.1f}%  {flag}")
    print(f"\n合計：費用 ¥{tot_s:,.0f} / CV {tot_c:.0f}")


if __name__ == "__main__":
    main()
