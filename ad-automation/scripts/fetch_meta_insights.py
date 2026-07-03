#!/usr/bin/env python3
"""Meta 広告 読み取り雛形 — adset実績を取得し、generate_proposals.py 用CSVに書き出す。

方針:
  - **読み取り専用**。広告への書き込みは一切しない（CLAUDE.md §0）。
  - トークン/IDは環境変数から読む。実値はコード/MDに書かない（§8）。
  - トークンが無い/未接続でも安全に停止し、何が必要かを表示する（推測でデータを作らない）。

前提:
  - HANDOFF §6 の通り、実運用では Meta 公式Adsコネクタ(MCP/CLI, `pip install meta-ads`)が推奨。
    本スクリプトは依存を増やさずパイプラインを通すための Graph API(読み取り)雛形。
  - 環境変数（.env / Secret Manager で注入。.env はGit管理外）:
      HARUNA_META_AD_ACCOUNT_ID   例: act_1234567890
      HARUNA_META_ACCESS_TOKEN    テスト用(手動OAuth・60日失効) / または
      HARUNA_META_SYSTEM_USER_TOKEN  無人運用用(組織所有・無期限)

使い方:
  python3 scripts/fetch_meta_insights.py \
      --account-env HARUNA_META_AD_ACCOUNT_ID \
      --token-env HARUNA_META_ACCESS_TOKEN \
      --days 7 \
      --conversion-action offsite_conversion.fb_pixel_lead \
      --out data/haruna_$(date +%F).csv

  # トークン未取得の間の疎通確認は generate_proposals.py にサンプルCSVを渡す:
  #   python3 scripts/generate_proposals.py --input data/samples/metrics_sample.csv --client ハルナ美容外科

Python 3.12+ 推奨（標準ライブラリのみで動作）。
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

GRAPH_VERSION = "v21.0"  # 稼働時に最新の安定版へ更新すること
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_VERSION}"

# generate_proposals.py が期待するCSVカラム順
CSV_COLUMNS = [
    "level", "campaign", "entity", "status",
    "spend_7d", "conversions_7d", "revenue_7d",
    "impressions_7d", "clicks_7d", "daily_budget", "days_active",
]


def load_dotenv(path: Path = Path(".env")) -> None:
    """.env を os.environ に読み込む（既存の環境変数は上書きしない・簡易パーサ）。"""
    import re
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def _require_env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        print(
            f"環境変数 {name} が未設定です。\n"
            f"  → .env に設定してください（実値はGit管理外・{'.env.example'} を参照）。\n"
            f"  → Metaトークンが未取得の間は、サンプルCSVで疎通確認できます:\n"
            f"     python3 scripts/generate_proposals.py --input data/samples/metrics_sample.csv --client <社名>",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return val


def _get(url: str) -> dict:
    """Graph API GET（読み取りのみ）。"""
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        print(f"Meta APIエラー {e.code}: {body}", file=sys.stderr)
        raise SystemExit(1)
    except urllib.error.URLError as e:
        print(f"接続エラー: {e.reason}", file=sys.stderr)
        raise SystemExit(1)


def _paged(url: str) -> list[dict]:
    out: list[dict] = []
    while url:
        data = _get(url)
        out.extend(data.get("data", []))
        url = data.get("paging", {}).get("next", "")
    return out


def _sum_action(actions: list[dict] | None, action_type: str) -> float:
    if not actions:
        return 0.0
    return sum(float(a.get("value", 0)) for a in actions if a.get("action_type") == action_type)


def fetch(account_id: str, token: str, days: int, conversion_action: str) -> list[dict]:
    # 1) adset のメタ情報（名前・状態・日予算・所属キャンペーン）
    adset_url = f"{GRAPH_BASE}/{account_id}/adsets?" + urllib.parse.urlencode({
        "fields": "id,name,status,daily_budget,campaign{name}",
        "limit": "200",
        "access_token": token,
    })
    adsets = _paged(adset_url)
    meta = {a["id"]: a for a in adsets}

    # 2) adset単位のインサイト（直近N日）
    insights_url = f"{GRAPH_BASE}/{account_id}/insights?" + urllib.parse.urlencode({
        "level": "adset",
        "date_preset": "maximum" if days == 0 else (f"last_{days}d" if days in (7, 14, 28, 30, 90) else "last_7d"),
        "fields": "adset_id,adset_name,spend,impressions,clicks,actions,action_values",
        "limit": "500",
        "access_token": token,
    })
    insights = _paged(insights_url)

    rows: list[dict] = []
    for ins in insights:
        aid = ins.get("adset_id", "")
        m = meta.get(aid, {})
        # daily_budget はMeta仕様で「最小通貨単位（円なら円、ドルならセント）」。円運用前提でそのまま採用。
        daily_budget = float(m.get("daily_budget", 0) or 0)
        rows.append({
            "level": "adset",
            "campaign": (m.get("campaign") or {}).get("name", ""),
            "entity": ins.get("adset_name") or m.get("name", aid),
            "status": m.get("status", ""),
            "spend_7d": float(ins.get("spend", 0) or 0),
            "conversions_7d": _sum_action(ins.get("actions"), conversion_action),
            "revenue_7d": _sum_action(ins.get("action_values"), conversion_action),
            "impressions_7d": float(ins.get("impressions", 0) or 0),
            "clicks_7d": float(ins.get("clicks", 0) or 0),
            "daily_budget": daily_budget,
            "days_active": 999 if days == 0 else days,  # 0=全期間(maximum)。実日数はentity別に別途要取得・暫定値。
        })
    return rows


def write_csv(rows: list[dict], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in CSV_COLUMNS})


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Meta広告 読み取り雛形（書き込みしない）")
    p.add_argument("--account-env", default="HARUNA_META_AD_ACCOUNT_ID",
                   help="広告アカウントIDが入った環境変数名")
    p.add_argument("--token-env", default="HARUNA_META_ACCESS_TOKEN",
                   help="アクセストークンが入った環境変数名")
    p.add_argument("--days", type=int, default=7, help="集計期間(日)。0=全期間(maximum)")
    p.add_argument("--conversion-action", default="offsite_conversion.fb_pixel_lead",
                   help="CVとして数える action_type（クライアントのCVイベントに合わせる・要確認）")
    p.add_argument("--out", required=True, help="出力CSV（generate_proposals.py に渡す）")
    a = p.parse_args(argv)

    load_dotenv()
    account_id = _require_env(a.account_env)
    token = _require_env(a.token_env)
    if not account_id.startswith("act_"):
        print(f"警告: 広告アカウントIDは 'act_' 始まりが想定です（現在: {account_id}）", file=sys.stderr)

    rows = fetch(account_id, token, a.days, a.conversion_action)
    if not rows:
        print("取得結果が空でした。権限・アカウントID・期間を確認してください（推測でデータは作りません）。",
              file=sys.stderr)
        return 1

    out = Path(a.out)
    write_csv(rows, out)
    print(f"読み取り完了: {len(rows)} 件を {out} に書き出しました（書き込みは行っていません）。")
    print(f"次: python3 scripts/generate_proposals.py --input {out} --client <社名> "
          f"--config clients/<社名>_thresholds.json --out out/proposals_<日付>.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
