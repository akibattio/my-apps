#!/usr/bin/env python3
"""Google検索の診断データ取得（IS変動・不要検索クエリ用）。読み取りのみ。
console/data.json の Google アカウントごとに:
  - 検索インプレッションシェア(IS)：直近7日 と 前7日（imp加重平均）
  - 不要検索クエリ：直近30日で CV0 かつ 費用¥3,000超（費用順）
を取得し data/search_diag.json に保存。監視(monitor.py)の改善系アラートが使う。

使い方: python3 scripts/fetch_search_diagnostics.py
"""
from __future__ import annotations
import os, re, json, datetime
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
WASTE_MIN_COST = 3000
_GA = {"svc": None}


def load_env(path=PROJ / ".env"):
    if not path.exists():
        return
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def ga_service():
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


def is_weighted(cid, dr):
    """検索キャンペーンのIS(imp加重平均, %)。取得不可なら None。"""
    ga = ga_service(); num = den = 0.0
    for r in ga.search(customer_id=cid, query=f"""
        SELECT metrics.search_impression_share, metrics.impressions FROM campaign
        WHERE campaign.advertising_channel_type = 'SEARCH' AND segments.date {dr}"""):
        m = r.metrics
        isv = m.search_impression_share
        imp = int(m.impressions or 0)
        if isv and imp:
            num += isv * imp; den += imp
    return round(num / den * 100, 1) if den else None


def waste_terms(cid, dr):
    ga = ga_service(); out = []
    for r in ga.search(customer_id=cid, query=f"""
        SELECT search_term_view.search_term, metrics.cost_micros, metrics.clicks, metrics.conversions
        FROM search_term_view WHERE segments.date {dr} ORDER BY metrics.cost_micros DESC LIMIT 80"""):
        m = r.metrics; cost = (m.cost_micros or 0) / 1e6; cv = m.conversions or 0
        if cv == 0 and cost >= WASTE_MIN_COST:
            out.append({"text": r.search_term_view.search_term, "cost": round(cost), "clk": int(m.clicks or 0)})
    return out


def main():
    load_env()
    dpath = PROJ / "console" / "data.json"
    accts = json.loads(dpath.read_text(encoding="utf-8")).get("accounts", [])
    today = datetime.date.today()
    d = datetime.timedelta
    last7 = f"BETWEEN '{(today-d(7)).isoformat()}' AND '{(today-d(1)).isoformat()}'"
    prev7 = f"BETWEEN '{(today-d(14)).isoformat()}' AND '{(today-d(8)).isoformat()}'"
    last30 = f"BETWEEN '{(today-d(30)).isoformat()}' AND '{(today-d(1)).isoformat()}'"

    out = []
    for a in accts:
        if a.get("media") != "google":
            continue
        cid = re.sub(r"\D", "", a.get("acct", ""))
        client = a.get("client")
        try:
            is7 = is_weighted(cid, last7)
            isp = is_weighted(cid, prev7)
            waste = waste_terms(cid, last30)
        except Exception as e:
            print(f"  取得失敗 {client}: {str(e)[:70]}")
            continue
        out.append({"client": client, "acct": cid, "is7": is7, "isPrev7": isp,
                    "waste": waste, "wasteTotal": sum(w["cost"] for w in waste)})

    (PROJ / "data").mkdir(exist_ok=True)
    payload = {"generated": today.isoformat(), "accounts": out}
    (PROJ / "data" / "search_diag.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"data/search_diag.json 出力: {len(out)}アカウント")
    for x in out:
        chg = (f"{x['isPrev7']}→{x['is7']}%" if x["is7"] is not None and x["isPrev7"] is not None else "IS取得不可")
        print(f"  {x['client'][:20]:22} IS {chg} / 不要クエリ {len(x['waste'])}件 ¥{x['wasteTotal']:,}")


if __name__ == "__main__":
    main()
