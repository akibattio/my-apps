#!/usr/bin/env python3
"""GA4（Google Analytics Data API）からLP別ユーザー/セッションを取得 → console/ga4.json。読み取りのみ。

既存クライアントレポートの「ページタイトル別 ユーザーの合計数・セッション（前月差分）」相当を、
コンソールの「レポート」タブに表示するためのデータ。直近3ヶ月を月別に保持。

認証: GA4_REFRESH_TOKEN（analytics.readonly・ga4_generate_refresh_token.pyで取得）＋
      既存の GOOGLE_ADS_CLIENT_ID / _CLIENT_SECRET を再利用。
プロパティ対応: clients/ga4_properties.json（{ "clientの表示名": "123456789" }）。
      未整備時は Admin API で見えるプロパティ一覧を表示（対応表づくりの補助）。

使い方: python3 scripts/fetch_ga4.py [months=3]
   接続情報が無ければ安全にスキップ（CIでも自動スキップ）。
"""
from __future__ import annotations
import os, re, sys, json, urllib.request, urllib.error, datetime
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
ADMIN = "https://analyticsadmin.googleapis.com/v1beta"
DATA = "https://analyticsdata.googleapis.com/v1beta"
TOP_PAGES = 20


def load_env(path=PROJ / ".env"):
    if not path.exists():
        return
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def ga4_enabled() -> bool:
    return all(os.environ.get(k, "").strip() for k in
               ("GA4_REFRESH_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET"))


def access_token() -> str:
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    creds = Credentials(
        None, refresh_token=os.environ["GA4_REFRESH_TOKEN"].strip(),
        client_id=os.environ["GOOGLE_ADS_CLIENT_ID"].strip(),
        client_secret=os.environ["GOOGLE_ADS_CLIENT_SECRET"].strip(),
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/analytics.readonly"])
    creds.refresh(Request())
    return creds.token


def _get(url, tok):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def _post(url, tok, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), method="POST",
                                 headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def list_properties(tok):
    """アクセス可能な GA4 プロパティ一覧 [(propertyId, displayName)] を返す。"""
    out = []
    data = _get(f"{ADMIN}/accountSummaries?pageSize=200", tok)
    for acc in data.get("accountSummaries", []):
        for ps in acc.get("propertySummaries", []):
            pid = (ps.get("property") or "").split("/")[-1]
            out.append((pid, ps.get("displayName", "")))
    return out


def lp_report(tok, property_id, start, end):
    """LP(ページタイトル)別 × 月 の totalUsers/sessions。{month: [{page,users,sessions}]}（上位）。"""
    body = {
        "dateRanges": [{"startDate": start, "endDate": end}],
        "dimensions": [{"name": "yearMonth"}, {"name": "pageTitle"}],
        "metrics": [{"name": "totalUsers"}, {"name": "sessions"}],
        "orderBys": [{"metric": {"metricName": "totalUsers"}, "desc": True}],
        "limit": 500,
    }
    resp = _post(f"{DATA}/properties/{property_id}:runReport", tok, body)
    bym = {}
    for row in resp.get("rows", []):
        dv = [d.get("value") for d in row.get("dimensionValues", [])]
        mv = [m.get("value") for m in row.get("metricValues", [])]
        ym = dv[0]  # YYYYMM
        mo = f"{ym[:4]}-{ym[4:6]}" if ym and len(ym) >= 6 else ym
        page = dv[1] if len(dv) > 1 else ""
        users = int(mv[0] or 0); sessions = int(mv[1] or 0) if len(mv) > 1 else 0
        bym.setdefault(mo, []).append({"page": page, "users": users, "sessions": sessions})
    for mo in bym:
        bym[mo] = sorted(bym[mo], key=lambda x: x["users"], reverse=True)[:TOP_PAGES]
    return bym


def main():
    months = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    load_env()
    if not ga4_enabled():
        print("GA4接続情報が未設定です（GA4_REFRESH_TOKEN 等）。ga4_generate_refresh_token.py で取得してください。")
        return 2
    tok = access_token()

    cfg_path = PROJ / "clients" / "ga4_properties.json"
    mapping = {}
    if cfg_path.exists():
        try:
            mapping = json.loads(cfg_path.read_text(encoding="utf-8"))
            mapping = {k: v for k, v in mapping.items() if not k.startswith("_")}
        except Exception as e:
            print("ga4_properties.json 読み込み失敗:", e)

    if not mapping:
        print("clients/ga4_properties.json が未整備です。アクセス可能なGA4プロパティ一覧:")
        for pid, name in list_properties(tok):
            print(f"  {pid}  {name}")
        print("→ この一覧を参考に {\"clientの表示名\": \"propertyId\"} を作成してください。")
        return 0

    today = datetime.date.today()
    y, m = today.year, today.month - (months - 1)
    while m <= 0:
        m += 12; y -= 1
    start = datetime.date(y, m, 1).isoformat()
    end = today.isoformat()

    out = {}
    for client, pid in mapping.items():
        pid = re.sub(r"\D", "", str(pid))
        try:
            out[client] = lp_report(tok, pid, start, end)
            nmo = len(out[client])
            print(f"  {client[:20]:22} property={pid} {nmo}ヶ月")
        except urllib.error.HTTPError as e:
            print(f"  取得失敗 {client}(property={pid}): HTTP{e.code} {e.read().decode('utf-8','replace')[:120]}")

    (PROJ / "console" / "ga4.json").write_text(
        json.dumps({"generated": end, "byClient": out}, ensure_ascii=False), encoding="utf-8")
    print(f"console/ga4.json 出力: {len(out)}クライアント / {start}〜{end}")


if __name__ == "__main__":
    main()
