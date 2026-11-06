#!/usr/bin/env python3
"""クリエイティブ（広告）ごとの週次推移 → console/creatives_weekly.json。読み取りのみ。

修正依頼(2026-10-26 ノノミヤ)「クリエイティブのクリック率などを週単位でみられるようにしたい」への対応。
Google（ad_group_ad × segments.week）と Meta（level=ad × time_increment=7）を、月曜始まりの週で揃えて保持する。
直近 WEEKS 週（完了週）＋今週（途中・昨日まで）。広告は期間合計の費用上位 TOP_N 件。

出力: {"generated", "weeks":[{"start","end","partial"}], "byAccount": {"<client>|google|meta": [
         {"id","name","sub","media","thumb", "w": {"<週の月曜>": {"imp","clk","lclk","cost","cv"}}}]}}
  - キーは他のコンソールJSONと同じ "<クライアント名>|<媒体>"（Googleはdata.jsonのclient名、MetaはMeta広告アカウント名）
  - lclk は Meta のリンククリック（CTR(リンク)用）。Google は clk と同値。
  - 指標の計算（CTR/CPC/CPA）は表示側で行う。

使い方: python3 scripts/fetch_creative_weekly.py [weeks=8]
"""
from __future__ import annotations
import os, re, sys, json, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_daily_series import load_env, google_service  # noqa: E402
from build_console_data import get as meta_get, sum_action, CV_ACTIONS, EXCLUDE_ACCOUNTS  # noqa: E402

PROJ = Path(__file__).resolve().parent.parent
TOP_N = 15  # 1アカウントあたりの表示広告数（期間合計の費用順）


def week_spans(weeks: int):
    """月曜始まりの週。直近 weeks 週（完了週）＋今週（昨日まで・途中）。昨日が日曜なら今週は無し。"""
    yday = datetime.date.today() - datetime.timedelta(days=1)
    this_mon = yday - datetime.timedelta(days=yday.weekday())
    spans = []
    for k in range(weeks, 0, -1):
        s = this_mon - datetime.timedelta(days=7 * k)
        spans.append({"start": s.isoformat(), "end": (s + datetime.timedelta(days=6)).isoformat(), "partial": False})
    spans.append({"start": this_mon.isoformat(), "end": yday.isoformat(), "partial": yday.weekday() != 6})
    return spans


def _top(ads: dict) -> list:
    rows = list(ads.values())
    for r in rows:
        r["_cost"] = sum(v["cost"] for v in r["w"].values())
    rows = [r for r in rows if r["_cost"] > 0 or any(v["imp"] for v in r["w"].values())]
    rows.sort(key=lambda r: r["_cost"], reverse=True)
    for r in rows:
        r.pop("_cost", None)
        for v in r["w"].values():
            v["cost"] = round(v["cost"]); v["cv"] = round(v["cv"], 1)
    return rows[:TOP_N]


def google_account(ga, cid: str, start: str, end: str) -> list:
    q = ("SELECT segments.week, campaign.name, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.name, "
         "ad_group_ad.ad.type, ad_group_ad.ad.responsive_search_ad.headlines, "
         "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM ad_group_ad "
         f"WHERE segments.date BETWEEN '{start}' AND '{end}' AND metrics.impressions > 0")
    ads = {}
    for r in ga.search(customer_id=cid, query=q):
        ad = r.ad_group_ad.ad
        try:
            hls = [h.text for h in ad.responsive_search_ad.headlines][:2]
        except Exception:
            hls = []
        kind = getattr(getattr(ad, "type_", None), "name", "") or "広告"
        name = ad.name or " / ".join([h for h in hls if h]) or f"{kind} #{ad.id}"
        e = ads.setdefault(str(ad.id), {"id": str(ad.id), "name": name, "media": "google", "thumb": "",
                                        "sub": f"{r.campaign.name} ／ {r.ad_group.name}", "w": {}})
        wk = e["w"].setdefault(str(r.segments.week), {"imp": 0, "clk": 0, "lclk": 0, "cost": 0.0, "cv": 0.0})
        m = r.metrics
        wk["imp"] += int(m.impressions or 0); wk["clk"] += int(m.clicks or 0); wk["lclk"] = wk["clk"]
        wk["cost"] += (m.cost_micros or 0) / 1e6; wk["cv"] += float(m.conversions or 0)
    return _top(ads)


def _label_duplicates(rows: list) -> None:
    """広告名が重複して見分けられない行（例: 広告名も広告セット名も「Meta」）は、キャンペーン名を主表示にする。
    それでも重複するなら広告IDの末尾を添える。"""
    names = [r["name"] for r in rows]
    for r in rows:
        if names.count(r["name"]) > 1:
            camp, _, adset = r["sub"].partition(" ／ ")
            r["sub"] = r["name"] if adset in ("", r["name"]) else f"{adset} ／ {r['name']}"
            r["name"] = camp or r["name"]
    names = [r["name"] for r in rows]
    for r in rows:
        if names.count(r["name"]) > 1:
            r["name"] = f"{r['name']}（#{r['id'][-4:]}）"


def meta_account(act: str, tok: str, start: str, end: str) -> list:
    """level=ad を7日刻みで取得。since を月曜にしているので各バケットは月曜始まりの週になる。"""
    params = {"level": "ad", "time_increment": "7", "limit": "500",
              "time_range": json.dumps({"since": start, "until": end}),
              "fields": "ad_id,ad_name,campaign_name,adset_name,impressions,clicks,inline_link_clicks,spend,actions"}
    ads, path = {}, f"{act}/insights"
    while True:
        j = meta_get(path, dict(params), tok)
        if "__error__" in j:
            raise RuntimeError(j["__error__"])
        for d in j.get("data", []):
            e = ads.setdefault(d["ad_id"], {"id": d["ad_id"], "name": d.get("ad_name") or d["ad_id"], "media": "meta",
                                            "thumb": "", "sub": f"{d.get('campaign_name', '')} ／ {d.get('adset_name', '')}", "w": {}})
            e["w"][d["date_start"]] = {"imp": int(d.get("impressions") or 0), "clk": int(d.get("clicks") or 0),
                                       "lclk": int(d.get("inline_link_clicks") or 0), "cost": float(d.get("spend") or 0),
                                       "cv": sum_action(d.get("actions"), CV_ACTIONS)}
        nxt = (j.get("paging") or {}).get("cursors", {}).get("after")
        if not (j.get("paging") or {}).get("next") or not nxt:
            break
        params["after"] = nxt
    rows = _top(ads)
    _label_duplicates(rows)
    # サムネイル（画面でどの絵か分かるように）。URLは期限付きなので毎回取り直す
    for r in rows:
        c = meta_get(r["id"], {"fields": "creative{thumbnail_url}"}, tok)
        r["thumb"] = ((c.get("creative") or {}).get("thumbnail_url") or "") if "__error__" not in c else ""
    return rows


def main():
    weeks = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    load_env(PROJ / ".env")
    spans = week_spans(weeks)
    start, end = spans[0]["start"], spans[-1]["end"]
    out, issues = {}, []

    # Google：data.json の Google アカウント（client名でキーを揃える）
    dpath = PROJ / "console" / "data.json"
    accounts = json.loads(dpath.read_text(encoding="utf-8")).get("accounts", []) if dpath.exists() else []
    g_accts = [a for a in accounts if a.get("media") == "google" and a.get("acct")]
    if g_accts:
        try:
            ga = google_service()
            for a in g_accts:
                cid = re.sub(r"\D", "", a["acct"])
                try:
                    rows = google_account(ga, cid, start, end)
                    if rows:
                        out[f"{a['client']}|google"] = rows
                    print(f"  [google] {a['client'][:20]:22} {len(rows)}広告")
                except Exception as e:
                    print(f"  [google] {a['client'][:20]:22} 取得失敗: {str(e)[:80]}")
        except Exception as e:
            issues.append(f"google: {str(e)[:120]}"); print("Google接続不可:", str(e)[:120])

    # Meta：トークンで読める広告アカウント（名前でキー。build_console_data と同じ除外）
    tok = os.environ.get("SOFCOM_META_SYSTEM_USER_TOKEN", "").strip()
    if tok:
        r = meta_get("me/adaccounts", {"fields": "name,account_id", "limit": "100"}, tok)
        if "__error__" in r:
            issues.append(f"meta: {str(r['__error__'])[:120]}"); print("Meta取得失敗:", str(r["__error__"])[:120])
        for a in r.get("data", []):
            name = a.get("name", "")
            if name in EXCLUDE_ACCOUNTS:
                continue
            try:
                rows = meta_account("act_" + a["account_id"], tok, start, end)
                if rows:
                    out[f"{name}|meta"] = rows
                print(f"  [meta]   {name[:20]:22} {len(rows)}広告")
            except Exception as e:
                print(f"  [meta]   {name[:20]:22} 取得失敗: {str(e)[:80]}")
    else:
        issues.append("meta: SOFCOM_META_SYSTEM_USER_TOKEN 未設定")

    # 全滅（ネット不通・トークン切れ）のときは前回ファイルを残す
    opath = PROJ / "console" / "creatives_weekly.json"
    if not out and opath.exists():
        print("取得0件のため前回の creatives_weekly.json を温存"); return
    opath.write_text(json.dumps({"generated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
                                 "weeks": spans, "issues": issues, "byAccount": out}, ensure_ascii=False), encoding="utf-8")
    print(f"console/creatives_weekly.json 出力: {len(out)}アカウント / {start}〜{end}")


if __name__ == "__main__":
    main()
