#!/usr/bin/env python3
"""Google Ads MCC 接続テスト＆配下アカウント一覧（読み取りのみ）。

.env の認証情報で接続し、
  1) list_accessible_customers（認可ユーザーがアクセスできる顧客）
  2) MCC(LOGIN_CUSTOMER_ID)配下の子アカウント一覧（customer_client）
を取得して表示する。Basic access 未承認なら DEVELOPER_TOKEN_NOT_APPROVED を明示する。
"""
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
    need = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET",
            "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_LOGIN_CUSTOMER_ID"]
    miss = [k for k in need if not os.environ.get(k, "").strip()]
    if miss:
        print("未設定の環境変数:", ", ".join(miss), file=sys.stderr)
        raise SystemExit(2)

    from google.ads.googleads.client import GoogleAdsClient
    from google.ads.googleads.errors import GoogleAdsException

    mcc = digits(os.environ["GOOGLE_LOGIN_CUSTOMER_ID"])
    cfg = {
        "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"].strip(),
        "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"].strip(),
        "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"].strip(),
        "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"].strip(),
        "login_customer_id": mcc,
        "use_proto_plus": True,
    }
    client = GoogleAdsClient.load_from_dict(cfg)
    print(f"接続先MCC: {mcc}")

    # 1) アクセス可能な顧客
    try:
        cs = client.get_service("CustomerService")
        acc = cs.list_accessible_customers()
        print(f"\n[1] アクセス可能な顧客: {len(acc.resource_names)}件")
        for rn in acc.resource_names:
            print("   ", rn)
    except GoogleAdsException as e:
        print("\n[1] list_accessible_customers エラー:")
        for err in e.failure.errors:
            print("   -", err.error_code, "/", err.message)

    # 2) MCC配下の子アカウント
    query = """
        SELECT customer_client.id, customer_client.descriptive_name,
               customer_client.manager, customer_client.level,
               customer_client.currency_code, customer_client.status
        FROM customer_client
        WHERE customer_client.status = 'ENABLED'
    """
    try:
        ga = client.get_service("GoogleAdsService")
        rows = list(ga.search(customer_id=mcc, query=query))
        print(f"\n[2] MCC配下アカウント: {len(rows)}件")
        for r in rows:
            c = r.customer_client
            kind = "MCC" if c.manager else "アカウント"
            print(f"   [{kind}] {c.descriptive_name}  id={c.id}  L{c.level}  {c.currency_code}")
    except GoogleAdsException as e:
        print("\n[2] 子アカウント取得エラー:")
        for err in e.failure.errors:
            code = str(err.error_code)
            print("   -", code, "/", err.message)
            if "NOT_APPROVED" in code or "NOT_APPROVED" in (err.message or ""):
                print("     → 開発者トークンが未承認（Basic access 審査中/未承認）。承認後に本番アカウントを読めます。")


if __name__ == "__main__":
    main()
