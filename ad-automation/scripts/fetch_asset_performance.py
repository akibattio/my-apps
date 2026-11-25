#!/usr/bin/env python3
"""アセット別の成果（Google広告）→ console/assets.json。読み取りのみ。

修正依頼 #15（2026-11-12 今井）「アセットごとに数値を見れるように。画像や動画、キーイベント1つ1つの数値が確認できると」・
#11（ノノミヤ）「サムネイルなどで表示してパッと見でどれのことかわかるように」への対応。
- 当月（月初〜昨日）と先月の2か月分。口座ごとに、画像・動画・見出し・説明文などのアセットの表示・クリック・費用・CV。
- キーイベント（コンバージョンの種類）ごとの CV は別の問い合わせで取る（公式の説明では、キーイベントの区切りと
  表示・クリック・費用は同じ問い合わせで選べない可能性が高いため）。取れない口座は、キーイベントの欄なしで出す。
- P-MAX のアセットグループの中の素材は、Google が素材ごとの数値を出していないため入らない（Report GLASS の P-MAX 欄を参照）。
記録（公開の実行の記録）には件数だけを出す（adops_log）。
"""
from __future__ import annotations
import json, re, sys, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_daily_series import load_env, google_service  # noqa: E402
from adops_log import detail, err  # noqa: E402  記録に取引先の情報を出さない（adops_log.py）

PROJ = Path(__file__).resolve().parent.parent
OUT = PROJ / "console" / "assets.json"
TOP = 150  # 1口座・1か月あたり（表示回数の多い順）

FIELD_JP = {"HEADLINE": "見出し", "LONG_HEADLINE": "長い見出し", "DESCRIPTION": "説明文", "MARKETING_IMAGE": "画像",
            "SQUARE_MARKETING_IMAGE": "画像（正方形）", "PORTRAIT_MARKETING_IMAGE": "画像（縦長）", "LOGO": "ロゴ",
            "LANDSCAPE_LOGO": "ロゴ（横長）", "AD_IMAGE": "画像", "YOUTUBE_VIDEO": "動画", "VIDEO": "動画",
            "BUSINESS_NAME": "会社名", "CALL_TO_ACTION_SELECTION": "行動を促すボタン", "SITELINK": "サイトリンク",
            "CALLOUT": "コールアウト", "STRUCTURED_SNIPPET": "構造化スニペット"}


def month_spans(today: datetime.date):
    cur_s = today.replace(day=1)
    cur_e = today - datetime.timedelta(days=1)
    prev_e = cur_s - datetime.timedelta(days=1)
    prev_s = prev_e.replace(day=1)
    spans = []
    if cur_e >= cur_s:  # 月初の1日は当月分がまだ無い
        spans.append((cur_s.strftime("%Y-%m"), cur_s.isoformat(), cur_e.isoformat()))
    spans.append((prev_s.strftime("%Y-%m"), prev_s.isoformat(), prev_e.isoformat()))
    return spans


def _name(v) -> str:
    return getattr(v, "name", "") or str(v or "")


def account_assets(ga, cid: str, start: str, end: str) -> dict:
    """1口座・1期間。{"assets":[...], "events":[キーイベント名…], "eventsError": bool}"""
    q1 = ("SELECT asset.resource_name, asset.type, asset.name, asset.text_asset.text, asset.image_asset.full_size.url, "
          "asset.youtube_video_asset.youtube_video_id, asset.youtube_video_asset.youtube_video_title, "
          "ad_group_ad_asset_view.field_type, campaign.advertising_channel_type, "
          "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions "
          "FROM ad_group_ad_asset_view "
          f"WHERE segments.date BETWEEN '{start}' AND '{end}' AND metrics.impressions > 0")
    m = {}
    for r in ga.search(customer_id=cid, query=q1):
        a = r.asset
        e = m.setdefault(a.resource_name, {
            "id": a.resource_name.split("/")[-1], "type": _name(a.type_), "fields": set(), "channels": set(),
            "text": a.text_asset.text or "", "img": a.image_asset.full_size.url or "",
            "video": a.youtube_video_asset.youtube_video_id or "", "title": a.youtube_video_asset.youtube_video_title or a.name or "",
            "imp": 0, "clk": 0, "cost": 0.0, "cv": 0.0, "ev": {}})
        e["fields"].add(_name(r.ad_group_ad_asset_view.field_type))
        e["channels"].add(_name(r.campaign.advertising_channel_type))
        mt = r.metrics
        e["imp"] += int(mt.impressions or 0); e["clk"] += int(mt.clicks or 0)
        e["cost"] += (mt.cost_micros or 0) / 1e6; e["cv"] += float(mt.conversions or 0)

    ev_err = False
    q2 = ("SELECT asset.resource_name, segments.conversion_action_name, metrics.conversions "
          "FROM ad_group_ad_asset_view "
          f"WHERE segments.date BETWEEN '{start}' AND '{end}' AND metrics.conversions > 0")
    try:
        for r in ga.search(customer_id=cid, query=q2):
            e = m.get(r.asset.resource_name)
            if e is None:
                continue
            nm = r.segments.conversion_action_name or "（名前なし）"
            e["ev"][nm] = e["ev"].get(nm, 0.0) + float(r.metrics.conversions or 0)
    except Exception as e:
        ev_err = True
        print(f"  キーイベント別は取れず（アセットの数値は出す）: {err(e)}")
        detail(f"    {str(e)[:200]}")

    rows = sorted(m.values(), key=lambda x: -x["imp"])[:TOP]
    totals = {}
    for x in rows:
        for k, v in x["ev"].items():
            totals[k] = totals.get(k, 0.0) + v
    out = []
    for x in rows:
        fields = sorted(x["fields"])
        out.append({"id": x["id"], "type": x["type"], "field": " / ".join(FIELD_JP.get(f, f) for f in fields),
                    "channel": " / ".join(sorted(x["channels"])), "text": x["text"][:200], "img": x["img"],
                    "video": x["video"], "title": x["title"][:120], "imp": x["imp"], "clk": x["clk"],
                    "cost": round(x["cost"]), "cv": round(x["cv"], 2),
                    "ev": {k: round(v, 2) for k, v in x["ev"].items()}})
    return {"assets": out, "events": [k for k, _ in sorted(totals.items(), key=lambda kv: -kv[1])], "eventsError": ev_err}


def main():
    load_env()
    dpath = PROJ / "console" / "data.json"
    if not dpath.exists():
        print("console/data.json が無い（先に取得を実行）"); raise SystemExit(1)
    accounts = [a for a in json.loads(dpath.read_text(encoding="utf-8")).get("accounts", [])
                if a.get("media") == "google" and a.get("acct")]
    spans = month_spans(datetime.date.today())
    try:
        ga = google_service()
    except Exception as e:
        print("Google接続不可のためスキップ:", err(e)); return
    out, ng = {}, 0
    for a in accounts:
        cid = re.sub(r"\D", "", a["acct"])
        per = {}
        for ym, s, e in spans:
            try:
                per[ym] = account_assets(ga, cid, s, e)
            except Exception as ex:
                ng += 1
                print(f"  取得失敗（google）: {err(ex)}")
                detail(f"    {a['client']} {ym}: {str(ex)[:120]}")
        if per:
            out[f"{a['client']}|google"] = per
    OUT.write_text(json.dumps({"generated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
                               "months": [x[0] for x in spans], "byAccount": out}, ensure_ascii=False,
                              separators=(",", ":")), encoding="utf-8")
    n_assets = sum(len(v.get("assets", [])) for per in out.values() for v in per.values())
    print(f"console/assets.json 出力: {len(out)}口座 / アセット延べ{n_assets}件 / 失敗{ng}件 / {OUT.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
