#!/usr/bin/env python3
"""LINEヤフー広告 API 読み取り雛形（検索広告＋ディスプレイ広告）。読み取りのみ・媒体へ書き込まない。

方針（CLAUDE.md §0/§8 準拠）:
  - **読み取り専用**。予算/入札/ON-OFF/作成などの書き込みは一切しない。
  - Client Secret / refresh token は環境変数から読む。実値はコード/MD/チャットに出さない。
  - 接続情報が無い/未接続でも安全に停止（推測でデータを作らない）。CIでは自動スキップ。
  - 標準ライブラリのみ（urllib）。依存を増やさない。

このモジュールが公開する関数（Google/Meta と同じ形の行を返し、パイプラインに合流）:
  - yahoo_enabled()                        … 接続情報が揃っているか
  - yahoo_access_token()                    … refresh_token から access_token を取得
  - yahoo_summary(account_id, kind, start, end)   … 期間合計（build_console_data 用）
  - yahoo_daily(account_id, kind, start, end)     … 日次時系列（fetch_daily_series 用）
  - yahoo_monthly(account_id, kind, start, end)   … 月次時系列（fetch_monthly_series 用）
    kind = "search"(検索広告) / "display"(ディスプレイ広告)

環境変数（.env / GitHub Secrets で注入。実値はGit管理外）:
  YAHOO_ADS_CLIENT_ID          アプリケーションの Client ID
  YAHOO_ADS_CLIENT_SECRET      アプリケーションの Client Secret（秘密）
  YAHOO_ADS_REFRESH_TOKEN      OAuth認可で取得した refresh token（秘密）
  YAHOO_ADS_BASE_ACCOUNT_ID    ベースアカウントID（ヘッダ x-z-base-account-id）。テスト時は 1001994926
  YAHOO_ADS_API_VERSION        APIバージョン（例 v13 / v202XXX）。※稼働前にリファレンスで最新値を要確認
  # 任意（既定値を上書きしたい場合のみ）:
  YAHOO_OAUTH_TOKEN_URL        既定 https://biz-oauth.yahoo.co.jp/oauth/v1/token
  YAHOO_SEARCH_API_HOST        既定 https://ads-search.yahooapis.jp
  YAHOO_DISPLAY_API_HOST       既定 https://ads-display.yahooapis.jp

⚠️ 稼働前チェック（creds取得後に1回のライブ実行で確定させる）:
  - YAHOO_ADS_API_VERSION の最新値（検索/ディスプレイのリファレンス）
  - OAuthトークンエンドポイントのホスト（LINEヤフー最新仕様）
  - レポート定義のフィールド列挙名（COST/IMPS/CLICKS/CONVERSIONS/DAY/MONTH 等）とレポート種別
  これらは下の CONFIG 定数に集約してあるので、確定後はここだけ直せばよい。
"""
from __future__ import annotations
import os, io, csv, sys, json, time, urllib.request, urllib.parse, urllib.error
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent

# ===== CONFIG（稼働前に要確認・確定したらここだけ直す）=====
OAUTH_TOKEN_URL = os.environ.get("YAHOO_OAUTH_TOKEN_URL", "https://biz-oauth.yahoo.co.jp/oauth/v1/token")
SEARCH_HOST = os.environ.get("YAHOO_SEARCH_API_HOST", "https://ads-search.yahooapis.jp")
DISPLAY_HOST = os.environ.get("YAHOO_DISPLAY_API_HOST", "https://ads-display.yahooapis.jp")
API_VERSION = os.environ.get("YAHOO_ADS_API_VERSION", "").strip()  # 空なら実行時に警告して停止

# レポート定義のフィールド（列挙名は稼働前にリファレンスで確認）。日次は DAY、月次は MONTH を先頭に。
REPORT_FIELDS_DAILY = ["DAY", "COST", "IMPS", "CLICKS", "CONVERSIONS"]
REPORT_FIELDS_MONTHLY = ["MONTH", "COST", "IMPS", "CLICKS", "CONVERSIONS"]
# CSVヘッダ→内部キーの対応（NAME/FIELD_NAME どちらのヘッダでも拾えるよう別名を許容）
COL_ALIASES = {
    "date": {"DAY", "Day", "日", "日付"},
    "month": {"MONTH", "Month", "月"},
    "cost": {"COST", "Cost", "コスト", "費用"},
    "imp": {"IMPS", "IMPRESSIONS", "Impressions", "インプレッション数", "インプレッション"},
    "clk": {"CLICKS", "Clicks", "クリック数", "クリック"},
    "cv": {"CONVERSIONS", "CONV", "Conversions", "コンバージョン数", "コンバージョン"},
}
POLL_INTERVAL_SEC = 3
POLL_MAX_TRIES = 40
# ============================================================

_TOKEN = {"value": None, "exp": 0}


def load_env(path=PROJ / ".env"):
    import re
    if not path.exists():
        return
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def yahoo_enabled() -> bool:
    """接続情報が揃っているか（揃っていなければパイプラインは Yahoo をスキップ）。"""
    need = ("YAHOO_ADS_CLIENT_ID", "YAHOO_ADS_CLIENT_SECRET",
            "YAHOO_ADS_REFRESH_TOKEN", "YAHOO_ADS_BASE_ACCOUNT_ID")
    return all(os.environ.get(k, "").strip() for k in need)


def _base_url(kind: str) -> str:
    if not API_VERSION:
        raise RuntimeError("YAHOO_ADS_API_VERSION 未設定（例 v13 / v202XXX）。リファレンスで最新版を確認して .env に設定してください。")
    host = SEARCH_HOST if kind == "search" else DISPLAY_HOST
    return f"{host}/api/{API_VERSION}"


def yahoo_access_token() -> str:
    """refresh_token から access_token を取得（有効期限内はキャッシュ）。読み取りのみ。"""
    now = time.time()
    if _TOKEN["value"] and now < _TOKEN["exp"] - 60:
        return _TOKEN["value"]
    data = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "client_id": os.environ["YAHOO_ADS_CLIENT_ID"].strip(),
        "client_secret": os.environ["YAHOO_ADS_CLIENT_SECRET"].strip(),
        "refresh_token": os.environ["YAHOO_ADS_REFRESH_TOKEN"].strip(),
    }).encode()
    req = urllib.request.Request(OAUTH_TOKEN_URL, data=data, method="POST",
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as r:
        j = json.loads(r.read().decode("utf-8"))
    tok = j.get("access_token")
    if not tok:
        raise RuntimeError(f"access_token 取得失敗: {json.dumps(j, ensure_ascii=False)[:200]}")
    _TOKEN["value"] = tok
    _TOKEN["exp"] = now + int(j.get("expires_in", 3600) or 3600)
    return tok


def _post(url: str, account_id: str, body: dict) -> dict:
    """JSON POST（読み取り系サービスのみ呼ぶ）。Authorization: Bearer + x-z-base-account-id。"""
    tok = yahoo_access_token()
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), method="POST", headers={
        "Authorization": f"Bearer {tok}",
        "Content-Type": "application/json; charset=UTF-8",
        "x-z-base-account-id": str(os.environ.get("YAHOO_ADS_BASE_ACCOUNT_ID", "")).strip(),
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def _download(url: str) -> str:
    tok = yahoo_access_token()
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {tok}",
        "x-z-base-account-id": str(os.environ.get("YAHOO_ADS_BASE_ACCOUNT_ID", "")).strip(),
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode("utf-8", "replace")


def _rval(resp: dict) -> dict:
    """LINEヤフー広告APIの標準レスポンス封筒 rval を取り出す（形が違えばそのまま返す）。"""
    return (resp or {}).get("rval", resp or {})


def _report_csv(account_id: str, kind: str, fields: list[str], start: str, end: str) -> str:
    """レポート定義 add → get(ポーリング) → download の非同期フローでCSV文字列を得る。読み取りのみ。

    ⚠️ operand の各キー名/種別は稼働前にリファレンスで要確認（CONFIG参照）。ここは1系統で書いてあるが
       検索/ディスプレイで差異があれば kind で分岐すること。"""
    base = _base_url(kind)
    date_range = {"startDate": start.replace("-", ""), "endDate": end.replace("-", "")}  # YYYYMMDD
    add_body = {"accountId": int(str(account_id).replace("-", "")), "operand": [{
        "reportName": f"adops_{kind}_{date_range['startDate']}_{date_range['endDate']}",
        "reportType": "ACCOUNT",
        "reportDateRangeType": "CUSTOM_DATE",
        "dateRange": date_range,
        "fields": fields,
        "format": "CSV",
        "reportColumnHeader": "FIELD_NAME",   # 列見出しをフィールド列挙名にして解析を安定化（要確認）
        "reportCompressType": "NONE",
        "reportSkipColumnHeader": "FALSE",
        "reportSkipReportSummary": "TRUE",
    }]}
    add = _rval(_post(f"{base}/ReportDefinitionService/add", account_id, add_body))
    try:
        job_id = add["values"][0]["reportDefinition"]["reportJobId"]
    except Exception:
        raise RuntimeError(f"reportJobId 取得失敗: {json.dumps(add, ensure_ascii=False)[:300]}")

    # ポーリング（COMPLETED まで）
    dl_url = None
    for _ in range(POLL_MAX_TRIES):
        get = _rval(_post(f"{base}/ReportDefinitionService/get", account_id,
                          {"accountId": int(str(account_id).replace("-", "")), "reportJobIds": [job_id]}))
        val = (get.get("values") or [{}])[0].get("reportDefinition", {})
        status = val.get("reportJobStatus")
        if status == "COMPLETED":
            dl_url = val.get("downloadUrl") or val.get("reportDownloadUrl")
            break
        if status in ("FAILED", "ABORTED"):
            raise RuntimeError(f"レポート生成失敗 status={status} job={job_id}")
        time.sleep(POLL_INTERVAL_SEC)
    if not dl_url:
        raise RuntimeError(f"レポート未完了（タイムアウト） job={job_id}")
    return _download(dl_url)


def _parse_csv(text: str) -> list[dict]:
    """CSVを列別名で正規化して行dictへ。cost/imp/clk/cv と date|month を持つ行を返す。"""
    def keyname(header: str) -> str | None:
        h = (header or "").strip().strip('"')
        for k, aliases in COL_ALIASES.items():
            if h in aliases:
                return k
        return None

    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return []
    idx = {}
    for i, col in enumerate(rows[0]):
        k = keyname(col)
        if k:
            idx[k] = i
    out = []
    for r in rows[1:]:
        if not r or all((c or "").strip() == "" for c in r):
            continue
        def num(k):
            if k not in idx or idx[k] >= len(r):
                return 0.0
            v = (r[idx[k]] or "").replace(",", "").replace("¥", "").strip()
            try:
                return float(v)
            except ValueError:
                return 0.0
        rec = {"imp": int(num("imp")), "clk": int(num("clk")),
               "cost": round(num("cost")), "cv": round(num("cv"), 1)}
        if "date" in idx and idx["date"] < len(r):
            d = (r[idx["date"]] or "").strip()
            rec["date"] = d if "-" in d else (f"{d[:4]}-{d[4:6]}-{d[6:8]}" if len(d) >= 8 else d)
        if "month" in idx and idx["month"] < len(r):
            m = (r[idx["month"]] or "").strip().replace("/", "-")
            rec["month"] = m if "-" in m else (f"{m[:4]}-{m[4:6]}" if len(m) >= 6 else m)
        out.append(rec)
    return out


# ---- パイプラインが呼ぶ公開関数（Google/Meta と同じ行の形）----
def yahoo_daily(account_id: str, kind: str, start: str, end: str) -> list[dict]:
    rows = _parse_csv(_report_csv(account_id, kind, REPORT_FIELDS_DAILY, start, end))
    return [{"date": x["date"], "imp": x["imp"], "clk": x["clk"], "cost": x["cost"], "cv": x["cv"]}
            for x in rows if x.get("date")]


def yahoo_monthly(account_id: str, kind: str, start: str, end: str) -> list[dict]:
    rows = _parse_csv(_report_csv(account_id, kind, REPORT_FIELDS_MONTHLY, start, end))
    out = []
    for x in rows:
        mo = x.get("month")
        if not mo:
            continue
        cv = x["cv"]
        out.append({"month": mo, "imp": x["imp"], "clk": x["clk"], "cost": x["cost"],
                    "cv": round(cv, 1), "cpa": round(x["cost"] / cv) if cv else None})
    return sorted(out, key=lambda r: r["month"])


def yahoo_summary(account_id: str, kind: str, start: str, end: str) -> dict:
    """期間合計（build_console_data のサマリ用）。"""
    days = yahoo_daily(account_id, kind, start, end)
    spend = sum(d["cost"] for d in days); imp = sum(d["imp"] for d in days)
    clk = sum(d["clk"] for d in days); cv = sum(d["cv"] for d in days)
    return {"spend": round(spend), "imp": imp, "clk": clk,
            "ctr": round(clk / imp * 100, 2) if imp else 0, "cpc": round(spend / clk) if clk else 0,
            "cpm": round(spend / imp * 1000) if imp else 0, "freq": 0, "cv": round(cv, 1),
            "cpa": round(spend / cv) if cv else None, "roas": None}


def main():
    """単体疎通確認: 接続情報の有無と、テストアカウントの直近7日サマリを表示（読み取りのみ）。"""
    load_env()
    if not yahoo_enabled():
        print("Yahoo接続情報が未設定です（YAHOO_ADS_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN / _BASE_ACCOUNT_ID）。")
        print("→ scripts/yahoo_generate_refresh_token.py で refresh_token を取得し .env に設定してください。")
        return 2
    import datetime
    end = datetime.date.today().isoformat()
    start = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
    acct = os.environ.get("YAHOO_ADS_TEST_SEARCH_ACCOUNT_ID", "1462425")  # 検索テストアカウント
    print(f"検索広告テストアカウント {acct} の {start}〜{end} を取得中…（version={API_VERSION or '未設定'}）")
    try:
        s = yahoo_summary(acct, "search", start, end)
        print("結果:", json.dumps(s, ensure_ascii=False))
    except Exception as e:
        print(f"取得失敗: {type(e).__name__}: {str(e)[:200]}", file=sys.stderr)
        print("→ CONFIG（API_VERSION / エンドポイント / レポート列挙名）をリファレンスで確認してください。", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
