#!/usr/bin/env python3
"""Google広告 監査の機械抽出（Claude Ads / ads-google の観点をルール化）。読み取りのみ。
実データからチェックを走らせ、スコア＋所見(findings)を audit.json として出力する。
レポート生成器（google_report_monthly.py / google_report_html.py）がそのまま消費できる形。

使い方:
  python3 scripts/google_audit.py <customer_id> <label> <out_audit.json> [start YYYY-MM-DD] [end YYYY-MM-DD]
  日付省略時は直近90日。
"""
from __future__ import annotations
import os, re, sys, json, datetime
from pathlib import Path


def load_env(path=Path(".env")):
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def client():
    from google.ads.googleads.client import GoogleAdsClient
    mcc = re.sub(r"\D", "", os.environ["GOOGLE_LOGIN_CUSTOMER_ID"])
    return GoogleAdsClient.load_from_dict({
        "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"].strip(),
        "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"].strip(),
        "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"].strip(),
        "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"].strip(),
        "login_customer_id": mcc, "use_proto_plus": True})


CH_JP = {"PERFORMANCE_MAX": "P-MAX", "SEARCH": "検索", "DISPLAY": "ディスプレイ",
         "VIDEO": "動画", "DEMAND_GEN": "デマンドジェン", "MULTI_CHANNEL": "動画/複合",
         "SHOPPING": "ショッピング"}


def pull(ga, cid, dr):
    """監査に必要な実データを取得して dict で返す。"""
    d = {}
    # コンバージョンアクション（計測の健全性）
    ca = []
    for r in ga.search(customer_id=cid, query="""
        SELECT conversion_action.name, conversion_action.status,
               conversion_action.primary_for_goal, conversion_action.type
        FROM conversion_action"""):
        a = r.conversion_action
        ca.append({"name": a.name, "status": a.status.name,
                   "primary": bool(a.primary_for_goal), "type": a.type_.name})
    d["conv_actions"] = ca
    # キャンペーン（構造・入札）
    camps = []
    for r in ga.search(customer_id=cid, query="""
        SELECT campaign.name, campaign.status, campaign.advertising_channel_type,
               campaign.bidding_strategy_type FROM campaign WHERE campaign.status != 'REMOVED'"""):
        c = r.campaign
        camps.append({"name": c.name, "status": c.status.name,
                      "channel": c.advertising_channel_type.name,
                      "bid": c.bidding_strategy_type.name})
    d["campaigns"] = camps
    # 配信方法別 実績（期間内）
    chan = {}
    for r in ga.search(customer_id=cid, query=f"""
        SELECT campaign.advertising_channel_type, metrics.cost_micros, metrics.impressions,
               metrics.clicks, metrics.conversions FROM campaign WHERE segments.date {dr}"""):
        t = r.campaign.advertising_channel_type.name; m = r.metrics
        a = chan.setdefault(t, {"cost": 0.0, "imp": 0, "clk": 0, "cv": 0.0})
        a["cost"] += (m.cost_micros or 0) / 1e6; a["imp"] += int(m.impressions or 0)
        a["clk"] += int(m.clicks or 0); a["cv"] += m.conversions or 0
    d["channels"] = chan
    # キーワード（無駄消化・マッチタイプ・品質スコア）
    kws = []
    for r in ga.search(customer_id=cid, query=f"""
        SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
               ad_group_criterion.quality_info.quality_score,
               metrics.cost_micros, metrics.clicks, metrics.conversions
        FROM keyword_view WHERE segments.date {dr}"""):
        k = r.ad_group_criterion.keyword; m = r.metrics
        kws.append({"text": k.text, "match": k.match_type.name,
                    "qs": int(r.ad_group_criterion.quality_info.quality_score or 0),
                    "cost": (m.cost_micros or 0) / 1e6, "clk": int(m.clicks or 0),
                    "cv": m.conversions or 0})
    d["keywords"] = kws
    # 検索の予算による機会損失（インプレッションシェア）※取得できない環境もあるので防御的に
    sis = []
    try:
        for r in ga.search(customer_id=cid, query=f"""
            SELECT metrics.impressions, metrics.search_budget_lost_impression_share
            FROM campaign
            WHERE segments.date {dr} AND campaign.advertising_channel_type = 'SEARCH'"""):
            m = r.metrics
            sis.append({"imp": int(m.impressions or 0), "blis": float(m.search_budget_lost_impression_share or 0)})
    except Exception:
        pass
    d["search_is"] = sis
    # 広告表示オプション（有効なアセットの種類）
    atypes = set()
    try:
        for r in ga.search(customer_id=cid, query="""
            SELECT campaign_asset.field_type FROM campaign_asset
            WHERE campaign_asset.status = 'ENABLED'"""):
            atypes.add(r.campaign_asset.field_type.name)
    except Exception:
        pass
    d["asset_types"] = sorted(atypes)
    return d


def audit(d, period_label):
    """データからチェックを実行 → findings と score を返す。"""
    F = []  # findings: {sev, title, detail, penalty}
    def add(sev, title, detail, penalty):
        F.append({"sev": sev, "title": title, "detail": detail, "_p": penalty})

    chan = d["channels"]
    tot_cost = sum(a["cost"] for a in chan.values())
    tot_cv = sum(a["cv"] for a in chan.values())
    tot_cpa = tot_cost / tot_cv if tot_cv else None

    # --- 1. コンバージョン計測が機能しているか（最重要） ---
    if tot_cost > 0 and tot_cv == 0:
        add("fail", "コンバージョンが計測されていない",
            f"期間内 費用¥{tot_cost:,.0f} に対しCV=0。計測タグ/連携の不具合の可能性。配信最適化が効かず要即確認。", 30)
    else:
        add("pass", "コンバージョン計測は機能",
            f"期間内 {tot_cv:.0f}件 を記録（CPA {('¥'+format(round(tot_cpa),',')) if tot_cpa else '—'}）。", 0)

    # --- 2. コンバージョンアクションの整理状況 ---
    enabled = [a for a in d["conv_actions"] if a["status"] == "ENABLED"]
    primary = [a for a in enabled if a["primary"]]
    if len(enabled) > 10:
        add("warn", f"コンバージョンアクションが{len(enabled)}個と多い",
            f"有効{len(enabled)}個（うち主要{len(primary)}個）。重複・不要の整理で最適化の精度が上がる。計測自体は機能。", 6)
    elif len(primary) == 0 and enabled:
        add("warn", "主要コンバージョンが未設定",
            f"有効{len(enabled)}個あるが「主要(primary)」指定なし。入札最適化の対象が曖昧。", 8)
    else:
        add("pass", "コンバージョン設定は整理済み",
            f"有効{len(enabled)}個・主要{len(primary)}個。", 0)

    # --- 3. 配信方法間の効率差（合計だけで判断しない） ---
    eff = {t: (a["cost"]/a["cv"]) for t, a in chan.items() if a["cv"] >= 3 and a["cost"] >= 10000}
    if len(eff) >= 2:
        hi = max(eff, key=eff.get); lo = min(eff, key=eff.get)
        ratio = eff[hi] / eff[lo] if eff[lo] else 0
        if ratio >= 3:
            add("warn", "配信方法間でCPA効率差が大きい",
                f"{CH_JP.get(lo,lo)} CPA¥{eff[lo]:,.0f} に対し {CH_JP.get(hi,hi)} CPA¥{eff[hi]:,.0f}（約{ratio:.1f}倍）。"
                f"非効率側の見直し、または効率側への予算再配分を検討。", 8)
        else:
            add("pass", "配信方法間の効率差は許容範囲", f"最大/最小CPA比 {ratio:.1f}倍。", 0)

    # --- 4. 無駄消化キーワード（費用ありCV0） ---
    search_cost = chan.get("SEARCH", {}).get("cost", 0)
    waste = [k for k in d["keywords"] if k["cv"] == 0 and k["cost"] >= 5000]
    waste_cost = sum(k["cost"] for k in waste)
    ratio_w = waste_cost / search_cost if search_cost else 0
    if waste and ratio_w >= 0.5:
        top = sorted(waste, key=lambda x: -x["cost"])[0]
        add("fail", "無駄消化キーワードが多い",
            f"CV0で費用¥5k超のKWが{len(waste)}件・計¥{waste_cost:,.0f}（検索費用の{ratio_w*100:.0f}%）。"
            f"最大は「{top['text']}」¥{top['cost']:,.0f}。除外/停止候補。", 15)
    elif waste and ratio_w >= 0.25:
        add("warn", "無駄消化ぎみのキーワードあり",
            f"CV0で費用¥5k超のKWが{len(waste)}件・計¥{waste_cost:,.0f}（検索費用の{ratio_w*100:.0f}%）。見直し候補。", 8)
    elif search_cost > 0:
        add("pass", "検索KWの無駄消化は限定的",
            f"CV0で費用¥5k超のKWは{len(waste)}件（計¥{waste_cost:,.0f}）。", 0)

    # --- 5. 入札戦略とマッチタイプの整合 ---
    active = [c for c in d["campaigns"] if c["status"] == "ENABLED"]
    smart = {"MAXIMIZE_CONVERSIONS", "MAXIMIZE_CONVERSION_VALUE", "TARGET_CPA", "TARGET_ROAS", "TARGET_SPEND"}
    manual = [c for c in active if c["bid"] == "MANUAL_CPC"]
    broad_cost = sum(k["cost"] for k in d["keywords"] if k["match"] == "BROAD")
    broad_share = broad_cost / search_cost if search_cost else 0
    if manual and broad_share > 0.5:
        add("warn", "手動入札×部分一致の組み合わせ",
            f"稼働{len(active)}件中{len(manual)}件が手動CPC、かつ部分一致が検索費用の{broad_share*100:.0f}%。"
            f"部分一致はスマート入札との併用が前提。制御不足の恐れ。", 8)
    elif active:
        sb = [c for c in active if c["bid"] in smart]
        add("pass", "入札戦略は目的と整合",
            f"稼働{len(active)}件中{len(sb)}件がスマート入札。部分一致比率{broad_share*100:.0f}%との相性も適切。", 0)

    # --- 6. アカウント構造（停止跡の残置） ---
    paused = [c for c in d["campaigns"] if c["status"] == "PAUSED"]
    if len(paused) > len(active) and len(paused) >= 3:
        add("warn", "停止キャンペーンの残置が多い",
            f"稼働{len(active)}件に対し停止{len(paused)}件。棚卸し（アーカイブ）で管理が明確になる。", 4)

    # --- 7. 品質スコア（費用加重の平均QS） ---
    qkw = [k for k in d["keywords"] if k.get("qs") and k["cost"] > 0]
    if qkw:
        wsum = sum(k["cost"] for k in qkw)
        wqs = sum(k["qs"] * k["cost"] for k in qkw) / wsum if wsum else 0
        low = [k for k in qkw if k["qs"] <= 3]
        lowcost = sum(k["cost"] for k in low)
        if wqs and wqs < 5 and search_cost and lowcost / search_cost >= 0.2:
            add("warn", "品質スコアが低い",
                f"費用加重の平均QS {wqs:.1f}。QS≤3のKWが{len(low)}件・費用¥{lowcost:,.0f}（検索費用の{lowcost/search_cost*100:.0f}%）。"
                f"広告文とLPの関連性・遷移先の改善余地。", 6)
        else:
            add("pass", "品質スコアは概ね良好", f"費用加重の平均QS {wqs:.1f}（QS≤3は{len(low)}件）。", 0)

    # --- 8. 予算による機会損失（検索インプレッションシェア） ---
    sis = d.get("search_is") or []
    tot_imp = sum(x["imp"] for x in sis)
    if tot_imp > 0:
        blis = sum(x["blis"] * x["imp"] for x in sis) / tot_imp
        if blis >= 0.2:
            add("warn", "予算による機会損失が大きい",
                f"検索の「予算による損失IS」{blis*100:.0f}%。予算増額または効率改善で表示機会を回収できる可能性。", 6)
        else:
            add("pass", "予算による機会損失は限定的", f"検索の予算損失IS {blis*100:.0f}%。", 0)

    # --- 9. 広告表示オプション（アセット）の設定状況 ---
    at = set(d.get("asset_types") or [])
    if "SEARCH" in chan:
        key_assets = {"SITELINK": "サイトリンク", "CALLOUT": "コールアウト", "STRUCTURED_SNIPPET": "構造化スニペット"}
        present = [jp for k, jp in key_assets.items() if k in at]
        if len(present) < 2:
            miss = [jp for k, jp in key_assets.items() if k not in at]
            add("warn", "広告表示オプションが不足",
                f"検索の主要アセットのうち設定は{len(present)}種（{'/'.join(present) or 'なし'}）。未設定：{'/'.join(miss)}。CTR・占有率の改善余地。", 5)
        else:
            add("pass", "広告表示オプションは設定済み", f"主要アセット{len(present)}種を設定（{'/'.join(present)}）。", 0)

    # スコア算出
    score = max(0, min(100, 100 - sum(f["_p"] for f in F)))
    grade = "A" if score >= 85 else "B" if score >= 75 else "C" if score >= 65 else "D" if score >= 55 else "F"

    # サマリ自動生成
    fails = [f for f in F if f["sev"] == "fail"]
    warns = [f for f in F if f["sev"] == "warn"]
    parts = []
    if tot_cv:
        parts.append(f"期間内{tot_cv:.0f}CV / CPA{('¥'+format(round(tot_cpa),',')) if tot_cpa else '—'}")
    if fails:
        parts.append(f"要対応{len(fails)}件（{fails[0]['title']}）")
    elif warns:
        parts.append(f"注意{len(warns)}件（{warns[0]['title']}）")
    else:
        parts.append("重大な問題は検出なし")
    summary = "。".join(parts) + "。"

    for f in F:
        f.pop("_p", None)
    return {"engine": "Claude Ads観点の機械監査（ads-google ルール）",
            "score": score, "grade": grade, "summary": summary,
            "period": period_label, "generated": datetime.date.today().isoformat(),
            "findings": F}


def main():
    cid = re.sub(r"\D", "", sys.argv[1]); label = sys.argv[2]; outp = sys.argv[3]
    if len(sys.argv) > 5:
        start, end = sys.argv[4], sys.argv[5]
    else:
        end = datetime.date.today(); start = end - datetime.timedelta(days=90)
        start, end = start.isoformat(), end.isoformat()
    dr = f"BETWEEN '{start}' AND '{end}'"
    load_env()
    ga = client().get_service("GoogleAdsService")
    d = pull(ga, cid, dr)
    res = audit(d, f"{start}〜{end}")
    Path(outp).write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"監査完了: {label} ({cid})  期間 {start}〜{end}")
    print(f"  スコア {res['score']}/100（{res['grade']}）  {res['summary']}")
    for f in res["findings"]:
        mark = {"fail": "✗", "warn": "△", "pass": "○"}.get(f["sev"], "・")
        print(f"  {mark} {f['title']}")
    print(f"出力: {outp}")


if __name__ == "__main__":
    main()
