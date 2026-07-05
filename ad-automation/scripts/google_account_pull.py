#!/usr/bin/env python3
"""Google単一アカウントの監査用データを取得（読み取りのみ）。
使い方: python3 scripts/google_account_pull.py <customer_id(10桁)>
出力: アカウント情報 / CV計測(conversion_action) / キャンペーン構造 / 直近90日・過去累計の実績。"""
from __future__ import annotations
import os, re, sys
from pathlib import Path


def load_env(path=Path(".env")):
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def main():
    if len(sys.argv) < 2:
        print("usage: google_account_pull.py <customer_id>", file=sys.stderr); raise SystemExit(2)
    cid = re.sub(r"\D", "", sys.argv[1])
    load_env()
    from google.ads.googleads.client import GoogleAdsClient
    from google.ads.googleads.errors import GoogleAdsException
    mcc = re.sub(r"\D", "", os.environ["GOOGLE_LOGIN_CUSTOMER_ID"])
    cli = GoogleAdsClient.load_from_dict({
        "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"].strip(),
        "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"].strip(),
        "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"].strip(),
        "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"].strip(),
        "login_customer_id": mcc, "use_proto_plus": True})
    ga = cli.get_service("GoogleAdsService")

    def q(query):
        try:
            return list(ga.search(customer_id=cid, query=query))
        except GoogleAdsException as e:
            return [("__err__", e.failure.errors[0].message if e.failure.errors else "error")]

    print(f"=== アカウント {cid} ===")
    for r in q("SELECT customer.descriptive_name, customer.currency_code, customer.status, customer.auto_tagging_enabled FROM customer"):
        if isinstance(r, tuple): print(" 取得エラー:", r[1]); continue
        c = r.customer
        print(f" 名称:{c.descriptive_name} / 通貨:{c.currency_code} / 状態:{c.status.name} / 自動タグ:{c.auto_tagging_enabled}")

    print("\n=== CV計測（conversion_action）===")
    ca = q("SELECT conversion_action.name, conversion_action.status, conversion_action.type, conversion_action.category, conversion_action.counting_type FROM conversion_action")
    if ca and isinstance(ca[0], tuple): print(" 取得エラー:", ca[0][1])
    elif not ca: print(" コンバージョンアクションが1件も無い（＝CV計測未設定の疑い）")
    else:
        for r in ca:
            a = r.conversion_action
            print(f"  - {a.name} [{a.status.name}] type={a.type_.name} cat={a.category.name}")

    print("\n=== キャンペーン構造 ===")
    camps = q("SELECT campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign")
    if camps and isinstance(camps[0], tuple): print(" 取得エラー:", camps[0][1])
    elif not camps: print(" キャンペーンなし")
    else:
        for r in camps:
            c = r.campaign
            print(f"  - {c.name} [{c.status.name}] {c.advertising_channel_type.name}")

    print("\n=== 実績 ===")
    for label, dr in [("直近90日", "DURING LAST_90_DAYS"), ("2024-01-01〜現在", "BETWEEN '2024-01-01' AND '2026-07-04'")]:
        res = q(f"SELECT metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value FROM customer WHERE segments.date {dr}")
        if res and isinstance(res[0], tuple): print(f" {label}: 取得エラー:", res[0][1]); continue
        if not res: print(f" {label}: データなし"); continue
        m = res[0].metrics
        print(f" {label}: 費用¥{(m.cost_micros or 0)/1e6:,.0f} / 表示{int(m.impressions or 0):,} / クリック{int(m.clicks or 0):,} / CV{m.conversions or 0:.0f} / 売上¥{m.conversions_value or 0:,.0f}")


if __name__ == "__main__":
    main()
