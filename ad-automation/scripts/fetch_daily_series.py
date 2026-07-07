#!/usr/bin/env python3
"""日次時系列の取得（過去35日・アカウント別）。読み取りのみ・媒体へは書き込まない。

console/data.json のアカウント一覧をもとに Google/Meta の日別実績を取得し
data/daily.json に保存する。急変検知（インプ急停止・消化大幅増減 ほか）のベースライン用。

使い方: python3 scripts/fetch_daily_series.py [days=35]
"""
from __future__ import annotations
import os, re, sys, json, urllib.request, urllib.parse, urllib.error, datetime
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
META_BASE = "https://graph.facebook.com/v21.0"
CV_ACTIONS = ("offsite_conversion.fb_pixel_lead", "lead", "complete_registration",
              "offsite_conversion.fb_pixel_complete_registration", "purchase",
              "offsite_conversion.fb_pixel_purchase")
_GA = {"svc": None}


def load_env(path=PROJ / ".env"):
    if not path.exists():
        return
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def google_service():
    if _GA["svc"] is None:
        from google.ads.googleads.client import GoogleAdsClient
        mcc = re.sub(r"\D", "", os.environ["GOOGLE_LOGIN_CUSTOMER_ID"])
        cli = GoogleAdsClient.load_from_dict({
            "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"].strip(),
            "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"].strip(),
            "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"].strip(),
            "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"].strip(),
            "login_customer_id": mcc, "use_proto_plus": True})
        _GA["svc"] = cli.get_service("GoogleAdsService")
    return _GA["svc"]


def google_daily(cid, start, end):
    ga = google_service()
    rows = []
    for r in ga.search(customer_id=re.sub(r"\D", "", cid), query=f"""
        SELECT segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros,
               metrics.conversions FROM customer
        WHERE segments.date BETWEEN '{start}' AND '{end}' ORDER BY segments.date"""):
        m = r.metrics
        rows.append({"date": r.segments.date, "imp": int(m.impressions or 0), "clk": int(m.clicks or 0),
                     "cost": round((m.cost_micros or 0) / 1e6), "cv": round(m.conversions or 0, 1)})
    return rows


def sum_action(actions, types):
    return sum(float(a.get("value", 0)) for a in (actions or []) if a.get("action_type") in types)


def meta_daily(acc, tok, start, end):
    params = {"level": "account", "time_increment": 1,
              "time_range": json.dumps({"since": start, "until": end}),
              "fields": "spend,impressions,clicks,actions", "limit": "100", "access_token": tok}
    url = f"{META_BASE}/{acc}/insights?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            data = json.loads(r.read())
    except Exception as e:
        return {"__error__": str(e)[:80]}
    rows = []
    for row in data.get("data", []):
        rows.append({"date": row.get("date_start"),
                     "imp": int(float(row.get("impressions", 0) or 0)),
                     "clk": int(float(row.get("clicks", 0) or 0)),
                     "cost": round(float(row.get("spend", 0) or 0)),
                     "cv": int(sum_action(row.get("actions"), CV_ACTIONS))})
    return rows


def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 35
    load_env()
    dpath = PROJ / "console" / "data.json"
    if not dpath.exists():
        print("console/data.json が無い（先に取得を実行）"); raise SystemExit(1)
    accounts = json.loads(dpath.read_text(encoding="utf-8")).get("accounts", [])
    today = datetime.date.today()
    start = (today - datetime.timedelta(days=days)).isoformat()
    end = today.isoformat()
    tok = os.environ.get("SOFCOM_META_SYSTEM_USER_TOKEN", "").strip()

    out = []
    for a in accounts:
        media, acct, client = a.get("media"), a.get("acct"), a.get("client")
        try:
            if media == "google":
                series = google_daily(acct, start, end)
            elif media == "meta":
                series = meta_daily(acct, tok, start, end) if tok else {"__error__": "no meta token"}
            else:
                continue
        except Exception as e:
            series = {"__error__": str(e)[:80]}
        if isinstance(series, dict) and "__error__" in series:
            print(f"  取得失敗 {client}({media}): {series['__error__']}")
            out.append({"client": client, "media": media, "acct": acct, "days": [], "error": series["__error__"]})
            continue
        out.append({"client": client, "media": media, "acct": acct, "days": series})

    (PROJ / "data").mkdir(exist_ok=True)
    payload = {"generated": today.isoformat(), "range": f"{start}〜{end}", "accounts": out}
    (PROJ / "data" / "daily.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"data/daily.json 出力: {len(out)}アカウント / 期間 {start}〜{end}")
    for x in out:
        n = len(x["days"]); last = x["days"][-1] if n else None
        print(f"  {x['client'][:20]:22}[{x['media']}] {n}日" + (f" 直近 {last['date']} imp{last['imp']:,} ¥{last['cost']:,}" if last else " (データなし)"))


if __name__ == "__main__":
    main()
