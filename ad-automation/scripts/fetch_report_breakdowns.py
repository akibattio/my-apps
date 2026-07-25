#!/usr/bin/env python3
"""クライアント提出レポート用の内訳（ブレイクダウン）取得 → console/breakdowns.json。読み取りのみ。

既存のSUBACO等クライアントレポート（Looker Studio）に相当する内訳を Google Ads API から取得し、
コンソールの「レポート」タブに媒体別詳細として表示する。直近3ヶ月分（当月＋前2ヶ月）を月別に保持。

ディメンション：キャンペーンタイプ(検索/PMax/デマンド)・デバイス・曜日・時間帯・キャンペーン(上位)・検索クエリ(上位)
指標：表示/クリック/費用/CV（CTR/CPC/CVR/CPAは表示側で算出）

使い方: python3 scripts/fetch_report_breakdowns.py [months=3]
"""
from __future__ import annotations
import os, re, sys, json, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_daily_series import load_env, google_service, CH_LABEL  # noqa: E402

PROJ = Path(__file__).resolve().parent.parent
TOP_N = 30  # キャンペーン/検索クエリの月別上位件数（費用順）

DEVICE_LABEL = {"MOBILE": "スマートフォン", "DESKTOP": "PC", "TABLET": "タブレット",
                "CONNECTED_TV": "テレビ", "OTHER": "その他"}
DOW_LABEL = {"MONDAY": "月", "TUESDAY": "火", "WEDNESDAY": "水", "THURSDAY": "木",
             "FRIDAY": "金", "SATURDAY": "土", "SUNDAY": "日"}
DOW_ORDER = ["月", "火", "水", "木", "金", "土", "日"]


def _months(n):
    """当月＋過去(n-1)ヶ月の (YYYY-MM, 月初, 月末) を新しい順で返す。"""
    today = datetime.date.today()
    y, m = today.year, today.month
    out = []
    for _ in range(n):
        first = datetime.date(y, m, 1)
        nxt = datetime.date(y + (m // 12), (m % 12) + 1, 1)
        last = min(nxt - datetime.timedelta(days=1), today)
        out.append((f"{y:04d}-{m:02d}", first.isoformat(), last.isoformat()))
        m -= 1
        if m == 0:
            m = 12; y -= 1
    return out


def _row(v):
    return {"imp": int(v["imp"]), "clk": int(v["clk"]), "cost": round(v["cost"]), "cv": round(v["cv"], 1)}


def _agg(ga, cid, start, end, select, from_, dimexpr):
    """(month, dimkey) で集計し {month: {dimkey: sums}} を返す。dimexpr(r)->キー。"""
    q = (f"SELECT segments.month, {select}, metrics.impressions, metrics.clicks, "
         f"metrics.cost_micros, metrics.conversions FROM {from_} "
         f"WHERE segments.date BETWEEN '{start}' AND '{end}'")
    out = {}
    for r in ga.search(customer_id=cid, query=q):
        mo = str(r.segments.month)[:7]
        key = dimexpr_val(r, dimexpr)
        e = out.setdefault(mo, {}).setdefault(key, {"imp": 0, "clk": 0, "cost": 0.0, "cv": 0.0})
        m = r.metrics
        e["imp"] += int(m.impressions or 0); e["clk"] += int(m.clicks or 0)
        e["cost"] += (m.cost_micros or 0) / 1e6; e["cv"] += float(m.conversions or 0)
    return out


def dimexpr_val(r, dimexpr):
    return dimexpr(r)


def _to_list(bymonth, order=None, top=None):
    res = {}
    for mo, d in bymonth.items():
        rows = [{"name": k, **_row(v)} for k, v in d.items()]
        if order:
            rows.sort(key=lambda x: order.index(x["name"]) if x["name"] in order else 999)
        else:
            rows.sort(key=lambda x: x["cost"], reverse=True)
        if top:
            rows = rows[:top]
        res[mo] = rows
    return res


def account_breakdowns(ga, cid, start, end):
    b = {}
    # キャンペーンタイプ（検索/PMax/デマンド 等）
    ct = _agg(ga, cid, start, end, "campaign.advertising_channel_type", "campaign",
              lambda r: CH_LABEL.get(r.campaign.advertising_channel_type.name, r.campaign.advertising_channel_type.name))
    b["campaignType"] = _to_list(ct)
    # デバイス
    dev = _agg(ga, cid, start, end, "segments.device", "customer",
               lambda r: DEVICE_LABEL.get(r.segments.device.name, r.segments.device.name))
    b["device"] = _to_list(dev)
    # 曜日
    dow = _agg(ga, cid, start, end, "segments.day_of_week", "customer",
               lambda r: DOW_LABEL.get(r.segments.day_of_week.name, r.segments.day_of_week.name))
    b["dayOfWeek"] = _to_list(dow, order=DOW_ORDER)
    # 時間帯
    hr = _agg(ga, cid, start, end, "segments.hour", "customer", lambda r: f"{r.segments.hour}時")
    b["hour"] = _to_list(hr, order=[f"{h}時" for h in range(24)])
    # キャンペーン別（上位）
    cp = _agg(ga, cid, start, end, "campaign.name", "campaign", lambda r: r.campaign.name)
    b["campaign"] = _to_list(cp, top=TOP_N)
    # 検索クエリ（上位）
    st = _agg(ga, cid, start, end, "search_term_view.search_term", "search_term_view",
              lambda r: r.search_term_view.search_term)
    b["searchTerm"] = _to_list(st, top=TOP_N)
    return b


def main():
    months = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    load_env()
    dpath = PROJ / "console" / "data.json"
    if not dpath.exists():
        print("console/data.json が無い（先に取得を実行）"); raise SystemExit(1)
    accounts = json.loads(dpath.read_text(encoding="utf-8")).get("accounts", [])
    spans = _months(months)
    start, end = spans[-1][1], spans[0][2]

    try:
        ga = google_service()
    except Exception as e:
        print("Google接続不可のためスキップ:", str(e)[:80]); return

    out = {}
    for a in accounts:
        if a.get("media") != "google":
            continue
        cid = re.sub(r"\D", "", a.get("acct", ""))
        client = a.get("client")
        try:
            b = account_breakdowns(ga, cid, start, end)
        except Exception as e:
            print(f"  取得失敗 {client}: {str(e)[:80]}"); continue
        # 月ごとに { dim: rows } へ組み替え（レポートは月選択で引く）
        by_month = {}
        for dim, permonth in b.items():
            for mo, rows in permonth.items():
                by_month.setdefault(mo, {})[dim] = rows
        out[f"{client}|google"] = by_month
        nmo = len(by_month)
        print(f"  {client[:18]:20} {nmo}ヶ月分")

    (PROJ / "console" / "breakdowns.json").write_text(
        json.dumps({"generated": end, "range": f"{start}〜{end}", "byAccount": out}, ensure_ascii=False), encoding="utf-8")
    print(f"console/breakdowns.json 出力: {len(out)}アカウント / {start}〜{end}")


if __name__ == "__main__":
    main()
