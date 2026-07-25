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
# 都道府県 英→日（geo_target_constant.name は英語で返るため）
PREF_JP = {
    "Hokkaido": "北海道", "Aomori": "青森県", "Iwate": "岩手県", "Miyagi": "宮城県", "Akita": "秋田県",
    "Yamagata": "山形県", "Fukushima": "福島県", "Ibaraki": "茨城県", "Tochigi": "栃木県", "Gunma": "群馬県",
    "Saitama": "埼玉県", "Chiba": "千葉県", "Tokyo": "東京都", "Kanagawa": "神奈川県", "Niigata": "新潟県",
    "Toyama": "富山県", "Ishikawa": "石川県", "Fukui": "福井県", "Yamanashi": "山梨県", "Nagano": "長野県",
    "Gifu": "岐阜県", "Shizuoka": "静岡県", "Aichi": "愛知県", "Mie": "三重県", "Shiga": "滋賀県",
    "Kyoto": "京都府", "Osaka": "大阪府", "Hyogo": "兵庫県", "Nara": "奈良県", "Wakayama": "和歌山県",
    "Tottori": "鳥取県", "Shimane": "島根県", "Okayama": "岡山県", "Hiroshima": "広島県", "Yamaguchi": "山口県",
    "Tokushima": "徳島県", "Kagawa": "香川県", "Ehime": "愛媛県", "Kochi": "高知県", "Fukuoka": "福岡県",
    "Saga": "佐賀県", "Nagasaki": "長崎県", "Kumamoto": "熊本県", "Oita": "大分県", "Miyazaki": "宮崎県",
    "Kagoshima": "鹿児島県", "Okinawa": "沖縄県",
}
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


def geo_breakdown(ga, cid, start, end):
    """都道府県別。geographic_view の地域criterion→geo_target_constantで日本語都道府県名に解決。"""
    agg = {}  # month -> {gid: sums}
    ids = set()
    q = (f"SELECT segments.month, segments.geo_target_region, metrics.impressions, metrics.clicks, "
         f"metrics.cost_micros, metrics.conversions FROM geographic_view "
         f"WHERE segments.date BETWEEN '{start}' AND '{end}'")
    for r in ga.search(customer_id=cid, query=q):
        rid = r.segments.geo_target_region
        if not rid:
            continue
        gid = rid.split("/")[-1]; ids.add(gid)
        mo = str(r.segments.month)[:7]
        e = agg.setdefault(mo, {}).setdefault(gid, {"imp": 0, "clk": 0, "cost": 0.0, "cv": 0.0})
        m = r.metrics
        e["imp"] += int(m.impressions or 0); e["clk"] += int(m.clicks or 0)
        e["cost"] += (m.cost_micros or 0) / 1e6; e["cv"] += float(m.conversions or 0)
    names = {}
    if ids:
        idlist = ",".join(sorted(ids))
        for r in ga.search(customer_id=cid, query=(
                f"SELECT geo_target_constant.id, geo_target_constant.name, geo_target_constant.canonical_name "
                f"FROM geo_target_constant WHERE geo_target_constant.id IN ({idlist})")):
            g = r.geo_target_constant
            # canonical例 "Hyogo,Japan" / "Kobe,Hyogo,Japan"。県名は末尾Japanの直前。
            parts = [p.strip() for p in (g.canonical_name or g.name or "").split(",")]
            pref_en = parts[-2] if len(parts) >= 2 and parts[-1] == "Japan" else (parts[0] if parts else g.name)
            names[str(g.id)] = PREF_JP.get(pref_en, g.name or pref_en)
    # 都道府県名で再集計（市区町村ターゲティングも県に丸める）
    res = {}
    for mo, d in agg.items():
        bucket = {}
        for gid, v in d.items():
            nm = names.get(gid, "その他")
            e = bucket.setdefault(nm, {"imp": 0, "clk": 0, "cost": 0.0, "cv": 0.0})
            for k in ("imp", "clk", "cost", "cv"):
                e[k] += v[k]
        rows = [{"name": k, **_row(v)} for k, v in bucket.items()]
        rows.sort(key=lambda x: x["cost"], reverse=True)
        res[mo] = rows[:TOP_N]
    return res


def ad_breakdown(ga, cid, start, end):
    """広告別（クリエイティブ）。RSAは見出し先頭2つ、その他は広告名/種別をプレビューに。上位。"""
    agg = {}  # month -> {adid: [sums, preview]}
    q = (f"SELECT segments.month, ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, "
         f"ad_group_ad.ad.responsive_search_ad.headlines, metrics.impressions, metrics.clicks, "
         f"metrics.cost_micros, metrics.conversions FROM ad_group_ad "
         f"WHERE segments.date BETWEEN '{start}' AND '{end}'")
    for r in ga.search(customer_id=cid, query=q):
        ad = r.ad_group_ad.ad
        try:
            hls = [h.text for h in ad.responsive_search_ad.headlines][:2]
        except Exception:
            hls = []
        preview = ad.name or " / ".join([h for h in hls if h]) or f"{ad.type.name} #{ad.id}"
        mo = str(r.segments.month)[:7]
        e = agg.setdefault(mo, {}).setdefault(str(ad.id), {"imp": 0, "clk": 0, "cost": 0.0, "cv": 0.0, "name": preview})
        m = r.metrics
        e["imp"] += int(m.impressions or 0); e["clk"] += int(m.clicks or 0)
        e["cost"] += (m.cost_micros or 0) / 1e6; e["cv"] += float(m.conversions or 0)
    res = {}
    for mo, d in agg.items():
        rows = [{"name": v["name"], **_row(v)} for v in d.values()]
        rows.sort(key=lambda x: x["cost"], reverse=True)
        res[mo] = rows[:TOP_N]
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
    # 広告グループ別（上位）
    agp = _agg(ga, cid, start, end, "ad_group.name", "ad_group", lambda r: r.ad_group.name)
    b["adGroup"] = _to_list(agp, top=TOP_N)
    # 広告別（クリエイティブ・上位）
    b["ad"] = ad_breakdown(ga, cid, start, end)
    # 検索クエリ（上位）
    st = _agg(ga, cid, start, end, "search_term_view.search_term", "search_term_view",
              lambda r: r.search_term_view.search_term)
    b["searchTerm"] = _to_list(st, top=TOP_N)
    # 都道府県別
    b["prefecture"] = geo_breakdown(ga, cid, start, end)
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
