#!/usr/bin/env python3
"""Google 広告 読み取り雛形 — キャンペーン実績を取得し、generate_proposals.py 用CSVに書き出す。

方針(Metaの雛形と統一):
  - **読み取り専用**。広告への書き込みは一切しない(CLAUDE.md §0)。
  - 認証情報は .env から読む(実値はコード/MDに書かない・§8)。
  - 認証情報が欠けている/未接続なら安全に停止し、何が必要かを表示する(推測でデータを作らない)。

前提:
  - Google Ads API の Basic access 承認後に使用可能(それ以前はテスト枠のみ)。
  - 依存: pip install google-ads   (Python 3.12+ 推奨)
  - .env に以下(scripts/google_generate_refresh_token.py 等で取得済み):
      GOOGLE_ADS_DEVELOPER_TOKEN
      GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET / GOOGLE_ADS_REFRESH_TOKEN
      GOOGLE_LOGIN_CUSTOMER_ID   (MCC・ハイフン無し)
      SOFCOM_GOOGLE_CUSTOMER_ID  (テスト対象=自社アカウント・10桁ハイフン無し)

使い方:
  python3 scripts/fetch_google_insights.py \
      --customer-env SOFCOM_GOOGLE_CUSTOMER_ID \
      --days 7 \
      --out data/sofcom_$(date +%F).csv

  # 承認前/未接続の疎通確認は generate_proposals.py にサンプルCSVを渡す:
  #   python3 scripts/generate_proposals.py --input data/samples/metrics_sample.csv --client 自社
"""
from __future__ import annotations

import argparse
import csv
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path

# generate_proposals.py が期待するCSVカラム順(Metaの雛形と共通)
CSV_COLUMNS = [
    "level", "campaign", "entity", "status",
    "spend_7d", "conversions_7d", "revenue_7d",
    "impressions_7d", "clicks_7d", "daily_budget", "days_active",
]

_DATE_PRESETS = {7: "LAST_7_DAYS", 14: "LAST_14_DAYS", 30: "LAST_30_DAYS"}


def load_dotenv(path: Path = Path(".env")) -> None:
    """.env を os.environ に読み込む(既存の環境変数は上書きしない・簡易パーサ)。"""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def _require(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        print(
            f"環境変数 {name} が未設定です。\n"
            f"  → .env に設定してください(.env.example 参照)。\n"
            f"  → Basic access 承認前や未接続なら、サンプルCSVで疎通確認できます:\n"
            f"     python3 scripts/generate_proposals.py --input data/samples/metrics_sample.csv --client 自社",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return val


def _digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def build_client():
    try:
        from google.ads.googleads.client import GoogleAdsClient
    except ImportError:
        print("google-ads が未インストールです。\n  pip install google-ads", file=sys.stderr)
        raise SystemExit(2)

    cfg = {
        "developer_token": _require("GOOGLE_ADS_DEVELOPER_TOKEN"),
        "client_id": _require("GOOGLE_ADS_CLIENT_ID"),
        "client_secret": _require("GOOGLE_ADS_CLIENT_SECRET"),
        "refresh_token": _require("GOOGLE_ADS_REFRESH_TOKEN"),
        "login_customer_id": _digits(_require("GOOGLE_LOGIN_CUSTOMER_ID")),
        "use_proto_plus": True,
    }
    return GoogleAdsClient.load_from_dict(cfg)


def fetch(client, customer_id: str, days: int) -> list[dict]:
    from google.ads.googleads.errors import GoogleAdsException

    preset = _DATE_PRESETS.get(days, "LAST_7_DAYS")
    # キャンペーン単位・期間集計(segments.date を SELECT しないので期間合算の1行/キャンペーン)
    query = f"""
        SELECT
          campaign.name,
          campaign.status,
          campaign.start_date,
          campaign_budget.amount_micros,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value,
          metrics.impressions,
          metrics.clicks
        FROM campaign
        WHERE segments.date DURING {preset}
    """
    ga = client.get_service("GoogleAdsService")
    today = date.today()
    rows: list[dict] = []
    try:
        stream = ga.search_stream(customer_id=customer_id, query=query)
        for batch in stream:
            for r in batch.results:
                c, m, b = r.campaign, r.metrics, r.campaign_budget
                # 配信日数(学習期間判定用): 開始日から今日まで(上限は集計期間)
                try:
                    start = datetime.strptime(c.start_date, "%Y-%m-%d").date()
                    active = max(0, (today - start).days)
                except (ValueError, TypeError):
                    active = days
                rows.append({
                    "level": "campaign",
                    "campaign": c.name,
                    "entity": c.name,
                    "status": c.status.name,               # ENABLED / PAUSED / REMOVED
                    "spend_7d": (m.cost_micros or 0) / 1_000_000,
                    "conversions_7d": m.conversions or 0,
                    "revenue_7d": m.conversions_value or 0,
                    "impressions_7d": m.impressions or 0,
                    "clicks_7d": m.clicks or 0,
                    "daily_budget": (b.amount_micros or 0) / 1_000_000,
                    "days_active": active,
                })
    except GoogleAdsException as e:
        print("Google Ads APIエラー:", file=sys.stderr)
        for err in e.failure.errors:
            print(f"  - {err.message}", file=sys.stderr)
        print("(開発者トークンのアクセスレベル・顧客ID・権限を確認。推測でデータは作りません。)",
              file=sys.stderr)
        raise SystemExit(1)
    return rows


def write_csv(rows: list[dict], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in CSV_COLUMNS})


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Google広告 読み取り雛形(書き込みしない)")
    p.add_argument("--customer-env", default="SOFCOM_GOOGLE_CUSTOMER_ID",
                   help="対象アカウントの10桁IDが入った環境変数名")
    p.add_argument("--days", type=int, default=7, choices=[7, 14, 30], help="集計期間(日)")
    p.add_argument("--out", required=True, help="出力CSV(generate_proposals.py に渡す)")
    a = p.parse_args(argv)

    load_dotenv()
    customer_id = _digits(_require(a.customer_env))
    if len(customer_id) != 10:
        print(f"警告: 顧客IDは10桁想定です(現在 {len(customer_id)}桁: {customer_id})", file=sys.stderr)

    client = build_client()
    rows = fetch(client, customer_id, a.days)
    if not rows:
        print("取得結果が空でした。期間・権限・顧客IDを確認してください(推測でデータは作りません)。",
              file=sys.stderr)
        return 1

    out = Path(a.out)
    write_csv(rows, out)
    print(f"読み取り完了: {len(rows)} 件を {out} に書き出しました(書き込みは行っていません)。")
    print(f"次: python3 scripts/generate_proposals.py --input {out} --client 自社 "
          f"--config clients/<社名>_thresholds.json --out out/proposals_<日付>.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
