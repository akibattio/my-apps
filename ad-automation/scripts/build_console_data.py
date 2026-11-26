#!/usr/bin/env python3
"""管理コンソール(ad_ops_console)の実データJSONを生成する。

アクセス可能な Meta 広告アカウントの実績を取得し、コンソールが読む console/data.json を出力。
- 概要/一覧用のサマリ（直近30日）
- クライアント詳細用に「直近7日／先月」の各指標＋日予算（予算消化・先月比の表示に使用）
読み取り専用・トークンは .env から・実値は出力しない（数値のみ）。
"""
from __future__ import annotations
import os, re, json, urllib.request, urllib.parse, urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path
from adops_log import detail, err  # noqa: E402  記録に取引先の情報を出さない（adops_log.py）

JST = timezone(timedelta(hours=9))
BASE = "https://graph.facebook.com/v21.0"
# 監視対象から外すアカウント（未使用など）。名前で完全一致。
# ※これは自社システムの表示/取得除外。Meta側の権限解除は Business設定で別途行う。
# 公開リポジトリに口座名を置かないため、環境変数 ADOPS_EXCLUDE_ACCOUNTS（JSON の配列 または 改行/カンマ区切り）から読む。
# 手元は .env、GitHub Actions は Secret ADOPS_EXCLUDE_ACCOUNTS。未設定なら除外なし。
def _exclude_accounts() -> set:
    raw = os.environ.get("ADOPS_EXCLUDE_ACCOUNTS", "")
    if not raw:  # 手元：.env にだけ書いてある場合（load_env より先に読まれるため直接見る）
        try:
            for ln in (Path(__file__).resolve().parent.parent / ".env").read_text(encoding="utf-8").splitlines():
                if ln.strip().startswith("ADOPS_EXCLUDE_ACCOUNTS="):
                    raw = ln.split("=", 1)[1].strip()
        except Exception:
            pass
    raw = raw.strip()
    if raw.startswith("["):
        try:
            return {str(x).strip() for x in json.loads(raw) if str(x).strip()}
        except Exception:
            return set()
    return {x.strip() for x in re.split(r"[,\n]", raw) if x.strip()}


EXCLUDE_ACCOUNTS = _exclude_accounts()
CV_ACTIONS = ("offsite_conversion.fb_pixel_lead", "lead", "complete_registration",
              "offsite_conversion.fb_pixel_complete_registration", "purchase",
              "offsite_conversion.fb_pixel_purchase")


def load_env(path=Path(".env")):
    if not path.exists():
        return
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def get(path, params, tok):
    params["access_token"] = tok
    url = f"{BASE}/{path}?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return {"__error__": json.loads(e.read().decode()).get("error", {}).get("message")}
        except Exception:
            return {"__error__": str(e.code)}


def sum_action(actions, types):
    if not actions:
        return 0.0
    return sum(float(a.get("value", 0)) for a in actions if a.get("action_type") in types)


def metrics_for(acc, preset, tok):
    ins = get(f"{acc}/insights", {"level": "account", "date_preset": preset,
              "fields": "spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions,action_values"}, tok)
    err = ins.get("__error__") if isinstance(ins, dict) else "invalid response"
    row = (ins.get("data") or [{}])[0] if not err else {}
    spend = round(float(row.get("spend", 0) or 0))
    imp = int(float(row.get("impressions", 0) or 0))
    clk = int(float(row.get("clicks", 0) or 0))
    ctr = round(float(row.get("ctr", 0) or 0), 2)
    cpc = round(float(row.get("cpc", 0) or 0), 1)
    cpm = round(float(row.get("cpm", 0) or 0))
    freq = round(float(row.get("frequency", 0) or 0), 2)
    cv = int(sum_action(row.get("actions"), CV_ACTIONS))
    rev = sum_action(row.get("action_values"), CV_ACTIONS)
    cpa = round(spend / cv) if cv else None
    roas = round(rev / spend, 1) if spend and rev else None
    # 取得失敗を 0 実績と誤認させないため ok/error を返す（呼び出し側が status に反映）
    return {"spend": spend, "imp": imp, "clk": clk, "ctr": ctr, "cpc": cpc,
            "cpm": cpm, "freq": freq, "cv": cv, "cpa": cpa, "roas": roas,
            "ok": err is None, "error": err}


# 全社既定の基準（CLAUDE.md §2）。個社は clients/<社名> の目標で上書きする想定。
DEFAULT_BENCH = {
    "targetCpa": None, "targetRoas": None,
    "ctrMin": 1.0, "freqMax": 3.5,
    "cpaWarnPct": 0.20, "cpaSeverePct": 0.50,
    "pacingLow": 0.7, "pacingHigh": 1.1,
    "source": "全社既定（要確認）",
}


def daily_budget(acc, tok):
    """ACTIVEなキャンペーン(CBO)＋広告セットの日予算合計（JPY/日）。取れなければ0。
    CBO時はキャンペーン側、非CBO時は広告セット側に予算があるため両方を合算(片方は0)。"""
    total = 0
    for edge, fields in (("campaigns", "daily_budget,effective_status"),
                         ("adsets", "daily_budget,effective_status")):
        d = get(f"{acc}/{edge}", {"fields": fields, "limit": "300"}, tok)
        if "__error__" in d:
            continue
        for a in d.get("data", []):
            if a.get("effective_status") == "ACTIVE":
                total += float(a.get("daily_budget", 0) or 0)
    return round(total)


# ---- Google Ads（MCC配下の稼働アカウント）----
def _g_rows(ga, cid, preset):
    q = (f"SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, "
         f"metrics.conversions, metrics.conversions_value FROM customer "
         f"WHERE segments.date DURING {preset} ORDER BY segments.date")
    out = []
    for r in ga.search(customer_id=cid, query=q):
        m = r.metrics
        out.append({"date": r.segments.date, "spend": (m.cost_micros or 0)/1e6,
                    "imp": int(m.impressions or 0), "clk": int(m.clicks or 0),
                    "cv": m.conversions or 0, "rev": m.conversions_value or 0})
    return out


def _g_agg(rows):
    spend = sum(x["spend"] for x in rows); imp = sum(x["imp"] for x in rows)
    clk = sum(x["clk"] for x in rows); cv = sum(x["cv"] for x in rows); rev = sum(x["rev"] for x in rows)
    return {"spend": round(spend), "imp": imp, "clk": clk,
            "ctr": round(clk/imp*100, 2) if imp else 0, "cpc": round(spend/clk) if clk else 0,
            "cpm": round(spend/imp*1000) if imp else 0, "freq": 0, "cv": round(cv, 1),
            "cpa": round(spend/cv) if cv else None, "roas": round(rev/spend, 1) if spend and rev else None}


def pull_google(bench_cfg, lm_days, start_id):
    """MCC配下の稼働(=直近90日か先月に費用あり)アカウントを取得。(accounts, proposals) を返す。読み取りのみ。"""
    need = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET",
            "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_LOGIN_CUSTOMER_ID"]
    if not all(os.environ.get(k) for k in need):
        print("Google接続情報が未設定のためGoogleはスキップ"); return [], []
    try:
        from google.ads.googleads.client import GoogleAdsClient
    except Exception:
        print("google-ads 未導入のためGoogleはスキップ"); return [], []
    import re as _re
    mcc = _re.sub(r"\D", "", os.environ["GOOGLE_LOGIN_CUSTOMER_ID"])
    cli = GoogleAdsClient.load_from_dict({
        "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"].strip(),
        "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"].strip(),
        "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"].strip(),
        "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"].strip(),
        "login_customer_id": mcc, "use_proto_plus": True})
    ga = cli.get_service("GoogleAdsService")
    clients = []
    for r in ga.search(customer_id=mcc, query=(
            "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager "
            "FROM customer_client WHERE customer_client.status='ENABLED'")):
        c = r.customer_client
        if c.manager:
            continue
        clients.append((str(c.id), c.descriptive_name or str(c.id)))
    accounts, proposals = [], []
    i = start_id
    for cid, name in clients:
        if name in EXCLUDE_ACCOUNTS:
            continue
        try:
            r30 = _g_rows(ga, cid, "LAST_30_DAYS")
            d30 = _g_agg(r30)
            d7 = _g_agg(r30[-7:] if len(r30) >= 7 else r30)
            lm = _g_agg(_g_rows(ga, cid, "LAST_MONTH"))
        except Exception as e:
            print(f"  Google取得失敗: {err(e)}")
            detail(f"    {name}: {str(e)[:60]}")
            continue
        if d30["spend"] == 0 and lm["spend"] == 0:
            continue  # 休止アカウントは除外
        db, cp = 0.0, 0
        try:
            for r in ga.search(customer_id=cid, query=(
                    "SELECT campaign.status, campaign_budget.amount_micros FROM campaign "
                    "WHERE campaign.status='ENABLED'")):
                db += (r.campaign_budget.amount_micros or 0)/1e6; cp += 1
        except Exception:
            pass
        bench = dict(DEFAULT_BENCH); ov = bench_cfg.get(name)
        if ov:
            bench.update({k: v for k, v in ov.items() if not k.startswith("_")}); bench["source"] = "個社目標"
        i += 1
        accounts.append({
            "id": i, "client": name, "tier": ov.get("tier", "mid") if ov else "mid",
            "monthly": ov.get("monthly") if ov else None, "media": "google",
            "acct": cid, "status": "ok", "tokenDays": None, "cp": cp,
            "sync": datetime.now(JST).strftime("%H:%M 取得"),
            "spend": d30["spend"], "cpa": d30["cpa"] or 0, "target": bench.get("targetCpa"),
            "roas": d30["roas"], "cv": d30["cv"], "ctr": d30["ctr"], "is": None,
            "dailyBudget": round(db), "lmDays": lm_days,
            "metrics": {"d7": d7, "lm": lm}, "bench": bench,
        })
        if d30["cv"] == 0 and d30["spend"] > 0:
            proposals.append({
                "id": f"g-{i}", "client": name, "media": "google", "kind": "計測確認/配信見直し",
                "cur": f"直近30日 CV0 で ¥{d30['spend']:,} 消化",
                "next": "CV計測(コンバージョン設定)を確認、正常なら配信/KW見直し",
                "reason": "コンバージョンが記録されていない。まず計測の健全性を確認（推測で断定せず計測担当へ）。",
                "severity": "critical", "twoStep": False,
            })
    return accounts, proposals


# ---- LINEヤフー広告（検索/ディスプレイ）----
def pull_yahoo(bench_cfg, lm_days, start_id):
    """設定済みのYahooアカウント（clients/yahoo_accounts.json）の実績を取得。(accounts, proposals) を返す。読み取りのみ。

    clients/yahoo_accounts.json の形（accountIdの実値のみ。トークンは.env）:
      [{"client":"社名","kind":"search","accountId":"1234567"},
       {"client":"社名","kind":"display","accountId":"1002817859"}]
    未設定/未接続なら安全にスキップ（推測でデータを作らない）。"""
    try:
        import sys as _sys
        _sys.path.insert(0, str(Path(__file__).resolve().parent))
        from fetch_yahoo_insights import yahoo_enabled, yahoo_summary
    except Exception:
        print("fetch_yahoo_insights 読込不可のためYahooはスキップ"); return [], []
    if not yahoo_enabled():
        print("Yahoo接続情報が未設定のためYahooはスキップ"); return [], []
    try:
        from media_accounts import load as load_media_accounts  # ファイル＋コンソール追加分
        entries = load_media_accounts("yahoo")
    except Exception as e:
        print("yahoo_accounts 読み込み失敗:", err(e)); return [], []
    if not entries:
        print("Yahooアカウントが未設定のためYahooはスキップ"); return [], []

    import datetime as _dt
    today = _dt.date.today()
    d30s = (today - _dt.timedelta(days=30)).isoformat()
    d7s = (today - _dt.timedelta(days=7)).isoformat()
    first_this = today.replace(day=1)
    lm_end = (first_this - _dt.timedelta(days=1))
    lm_start = lm_end.replace(day=1)
    end = today.isoformat()

    accounts, proposals = [], []
    i = start_id
    for e in entries:
        name, kind, acct = e.get("client"), (e.get("kind") or "search"), str(e.get("accountId") or "")
        if not name or not acct:
            continue
        media = "yahoo_display" if kind == "display" else "yahoo_search"
        try:
            d30 = yahoo_summary(acct, kind, d30s, end)
            d7 = yahoo_summary(acct, kind, d7s, end)
            lm = yahoo_summary(acct, kind, lm_start.isoformat(), lm_end.isoformat())
        except Exception as ex:
            print(f"  Yahoo取得失敗（{kind}）: {err(ex)}")
            detail(f"    {name}: {str(ex)[:60]}")
            accounts.append({"id": i + 1, "client": name, "tier": "mid", "monthly": None,
                             "media": media, "kind": kind, "acct": acct, "status": "error",
                             "tokenDays": None, "cp": 0, "sync": datetime.now(JST).strftime("%H:%M 取得"),
                             "spend": 0, "cpa": 0, "target": None, "roas": None, "cv": 0, "ctr": 0, "is": None,
                             "dailyBudget": 0, "lmDays": lm_days, "metrics": {"d7": {}, "lm": {}},
                             "bench": dict(DEFAULT_BENCH), "error": str(ex)[:80]})
            i += 1
            continue
        bench = dict(DEFAULT_BENCH); ov = bench_cfg.get(name)
        if ov:
            bench.update({k: v for k, v in ov.items() if not k.startswith("_")}); bench["source"] = "個社目標"
        i += 1
        accounts.append({
            "id": i, "client": name, "tier": ov.get("tier", "mid") if ov else "mid",
            "monthly": ov.get("monthly") if ov else None, "media": media, "kind": kind,
            "acct": acct, "status": "ok", "tokenDays": None, "cp": 0,
            "sync": datetime.now(JST).strftime("%H:%M 取得"),
            "spend": d30["spend"], "cpa": d30["cpa"] or 0, "target": bench.get("targetCpa"),
            "roas": d30["roas"], "cv": d30["cv"], "ctr": d30["ctr"], "is": None,
            "dailyBudget": 0, "lmDays": lm_days,
            "metrics": {"d7": d7, "lm": lm}, "bench": bench,
        })
        if d30["cv"] == 0 and d30["spend"] > 0:
            proposals.append({
                "id": f"y-{i}", "client": name, "media": media, "kind": "計測確認/配信見直し",
                "cur": f"直近30日 CV0 で ¥{d30['spend']:,} 消化",
                "next": "CV計測(コンバージョン設定)を確認、正常なら配信/KW見直し",
                "reason": "コンバージョンが記録されていない。まず計測の健全性を確認（推測で断定せず計測担当へ）。",
                "severity": "critical", "twoStep": False,
            })
    return accounts, proposals


def pull_microsoft(bench_cfg, lm_days, start_id):
    """Microsoft広告の実績（直近30日・直近7日・先月）。(accounts, proposals) を返す。読み取りのみ。
    これまで Microsoft はコンソールの基のデータに入っておらず、接続ステータス・成果・アラートに出なかった（2026-11-25 秋葉さん判断で足す）。
    日次を1回だけ取って3つの期間に集計する（API の呼び出しを少なくする）。顧客IDは口座ごと（無ければ .env の既定）で、終わったら既定に戻す。"""
    try:
        import sys as _sys, os as _os
        _sys.path.insert(0, str(Path(__file__).resolve().parent))
        from fetch_microsoft_insights import ms_enabled, ms_daily
    except Exception:
        print("fetch_microsoft_insights 読込不可のためMicrosoftはスキップ"); return [], []
    if not ms_enabled():
        print("Microsoft接続情報が未設定のためMicrosoftはスキップ"); return [], []
    try:
        from media_accounts import load as load_media_accounts  # ファイル＋コンソール追加分（形・桁・組の確かめ済み）
        entries = load_media_accounts("microsoft")
    except Exception as e:
        print("microsoft_accounts 読み込み失敗:", err(e)); return [], []
    if not entries:
        print("Microsoftアカウントが未設定のためMicrosoftはスキップ"); return [], []

    import datetime as _dt
    today = _dt.date.today()
    d30s = (today - _dt.timedelta(days=30)).isoformat()
    d7s = (today - _dt.timedelta(days=7)).isoformat()
    lm_end = today.replace(day=1) - _dt.timedelta(days=1)
    lm_start = lm_end.replace(day=1)
    end = today.isoformat()

    def summ(days, s, e):
        rows = [x for x in days if s <= x["date"] <= e]
        spend = sum(x["cost"] for x in rows); imp = sum(x["imp"] for x in rows)
        clk = sum(x["clk"] for x in rows); cv = sum(x["cv"] for x in rows)
        return {"spend": round(spend), "imp": imp, "clk": clk,
                "ctr": round(clk / imp * 100, 2) if imp else 0, "cpc": round(spend / clk) if clk else 0,
                "cpm": round(spend / imp * 1000) if imp else 0, "freq": 0, "cv": round(cv, 1),
                "cpa": round(spend / cv) if cv else None, "roas": None}

    default_cid = _os.environ.get("MS_ADS_CUSTOMER_ID", "")
    accounts, proposals = [], []
    i = start_id
    try:
        for e in entries:
            name, acct = e.get("client"), str(e.get("accountId") or "")
            if not name or not acct:
                continue
            _os.environ["MS_ADS_CUSTOMER_ID"] = str(e.get("customerId") or default_cid)
            try:
                days = ms_daily(acct, min(lm_start.isoformat(), d30s), end)
            except Exception as ex:
                print(f"  Microsoft取得失敗: {err(ex)}")
                detail(f"    {name}: {str(ex)[:60]}")
                i += 1
                accounts.append({"id": i, "client": name, "tier": "mid", "monthly": None, "media": "microsoft",
                                 "acct": acct, "status": "error", "tokenDays": None, "cp": 0,
                                 "sync": datetime.now(JST).strftime("%H:%M 取得"), "lmDays": lm_days,
                                 "bench": dict(DEFAULT_BENCH), "error": str(ex)[:80]})
                continue
            d30, d7, lm = summ(days, d30s, end), summ(days, d7s, end), summ(days, lm_start.isoformat(), lm_end.isoformat())
            bench = dict(DEFAULT_BENCH); ov = bench_cfg.get(name)
            if ov:
                bench.update({k: v for k, v in ov.items() if not k.startswith("_")}); bench["source"] = "個社目標"
            i += 1
            accounts.append({
                "id": i, "client": name, "tier": ov.get("tier", "mid") if ov else "mid",
                "monthly": ov.get("monthly") if ov else None, "media": "microsoft",
                "acct": acct, "status": "ok", "tokenDays": None, "cp": 0,
                "sync": datetime.now(JST).strftime("%H:%M 取得"),
                "spend": d30["spend"], "cpa": d30["cpa"] or 0, "target": bench.get("targetCpa"),
                "roas": d30["roas"], "cv": d30["cv"], "ctr": d30["ctr"], "is": None,
                "dailyBudget": 0, "lmDays": lm_days,
                "metrics": {"d7": d7, "lm": lm}, "bench": bench,
            })
            if d30["cv"] == 0 and d30["spend"] > 0:
                proposals.append({
                    "id": f"m-{i}", "client": name, "media": "microsoft", "kind": "計測確認/配信見直し",
                    "cur": f"直近30日 CV0 で ¥{d30['spend']:,} 消化",
                    "next": "CV計測(コンバージョン設定)を確認、正常なら配信/KW見直し",
                    "reason": "コンバージョンが記録されていない。まず計測の健全性を確認（推測で断定せず計測担当へ）。",
                    "severity": "critical", "twoStep": False,
                })
    finally:
        _os.environ["MS_ADS_CUSTOMER_ID"] = default_cid  # 後の処理へ顧客IDを持ち越さない
    return accounts, proposals


def main():
    load_env()
    tok = os.environ.get("SOFCOM_META_SYSTEM_USER_TOKEN", "").strip()
    if not tok:
        print("SOFCOM_META_SYSTEM_USER_TOKEN が未設定です（.env）。")
        raise SystemExit(2)

    conn_issues = []  # 媒体ごとの接続/トークン失効。全体を止めず記録し、monitorで重大アラート化する（サイレント障害防止）。
    try:
        accts_resp = get("me/adaccounts", {"fields": "name,account_id", "limit": "100"}, tok)
    except Exception as e:
        accts_resp = {"__error__": str(e)[:200]}
    if "__error__" in accts_resp:
        err_detail = str(accts_resp.get("__error__"))[:200]
        print("Meta 取得失敗（トークン失効の可能性・後続媒体は継続）:", err(err_detail))
        detail("   ", err_detail)
        conn_issues.append({"media": "meta", "detail": err_detail})
        accts = []
    else:
        accts = accts_resp.get("data", [])
        if not accts:
            print("Metaに読み取り可能な広告アカウントがありません（0件）")
    # 除外アカウントをスキップ
    excluded = [a.get("name") for a in accts if a.get("name") in EXCLUDE_ACCOUNTS]
    accts = [a for a in accts if a.get("name") not in EXCLUDE_ACCOUNTS]
    if excluded:
        print(f"除外（監視対象外）: {len(excluded)}件")
        detail("   ", ", ".join(excluded))

    # 先月の日数（1日あたり比較に使用）
    _first_this = datetime.now(JST).replace(day=1)
    lm_days = (_first_this - timedelta(days=1)).day

    # 個社基準（目標）の読み込み：全社既定を上書き
    bench_cfg = {}
    bpath = Path("clients/benchmarks.json")
    if bpath.exists():
        try:
            bench_cfg = json.loads(bpath.read_text(encoding="utf-8")).get("byClient", {})
        except Exception as e:
            print("benchmarks.json 読み込み失敗（全社既定を使用）:", err(e))

    accounts, proposals = [], []
    for i, a in enumerate(accts, 1):
        acc = "act_" + a.get("account_id", "")
        name = a.get("name", acc)
        d30 = metrics_for(acc, "last_30d", tok)
        d7 = metrics_for(acc, "last_7d", tok)
        lm = metrics_for(acc, "last_month", tok)
        dbudget = daily_budget(acc, tok)
        camps = get(f"{acc}/campaigns", {"fields": "status", "limit": "200"}, tok)
        cp = sum(1 for c in camps.get("data", []) if c.get("status") == "ACTIVE") if "__error__" not in camps else 0
        # 基準：全社既定 ← 個社目標で上書き
        bench = dict(DEFAULT_BENCH)
        ov = bench_cfg.get(name)
        if ov:
            bench.update({k: v for k, v in ov.items() if not k.startswith("_")})
            bench["source"] = "個社目標"
        accounts.append({
            "id": i, "client": name, "tier": ov.get("tier", "mid") if ov else "mid",
            "monthly": ov.get("monthly") if ov else None, "media": "meta",
            "acct": acc, "status": "ok" if (d30.get("ok") and d7.get("ok") and lm.get("ok")) else "error", "tokenDays": 60, "cp": cp,
            "sync": datetime.now(JST).strftime("%H:%M 取得"),
            # 概要/一覧用サマリ（直近30日）
            "spend": d30["spend"], "cpa": d30["cpa"] or 0, "target": bench.get("targetCpa"),
            "roas": d30["roas"], "cv": d30["cv"], "ctr": d30["ctr"], "is": None,
            # 詳細（レポート状態）用
            "dailyBudget": dbudget, "lmDays": lm_days,
            "metrics": {"d7": d7, "lm": lm},
            "bench": bench,
        })
        if d30.get("ok") and d30["cv"] == 0 and d30["spend"] > 0:
            proposals.append({
                "id": f"live-{i}", "client": name, "media": "meta", "kind": "計測確認/配信見直し",
                "cur": f"直近30日 CV0 で ¥{d30['spend']:,} 消化",
                "next": "CV計測(登録完了等)を確認、正常なら配信/クリエイティブ見直し",
                "reason": "コンバージョンが記録されていない。まず計測の健全性を確認（推測で断定せず計測担当へ）。",
                "severity": "critical", "twoStep": False,
            })

    meta_n = len(accounts)
    # Google（MCC配下の稼働アカウント）を統合
    print("Google Ads を取得中…")
    try:
        g_accounts, g_proposals = pull_google(bench_cfg, lm_days, len(accounts))
    except Exception as e:
        print("Google 取得失敗（後続は継続）:", err(e)); g_accounts, g_proposals = [], []
        conn_issues.append({"media": "google", "detail": str(e)[:200]})
    accounts += g_accounts
    proposals += g_proposals
    google_n = len(g_accounts)

    # LINEヤフー広告（検索/ディスプレイ）を統合（未接続なら自動スキップ）
    print("LINEヤフー広告 を取得中…")
    try:
        y_accounts, y_proposals = pull_yahoo(bench_cfg, lm_days, len(accounts))
    except Exception as e:
        print("Yahoo 取得失敗（後続は継続）:", err(e)); y_accounts, y_proposals = [], []
        conn_issues.append({"media": "yahoo", "detail": str(e)[:200]})
    accounts += y_accounts
    proposals += y_proposals
    yahoo_n = len(y_accounts)

    # Microsoft広告（未接続なら自動スキップ）
    print("Microsoft広告 を取得中…")
    try:
        m_accounts, m_proposals = pull_microsoft(bench_cfg, lm_days, len(accounts))
    except Exception as e:
        print("Microsoft 取得失敗（後続は継続）:", err(e)); m_accounts, m_proposals = [], []
        conn_issues.append({"media": "microsoft", "detail": str(e)[:200]})
    accounts += m_accounts
    proposals += m_proposals
    ms_n = len(m_accounts)

    # 口座の番号の桁（2026-11-21）：桁が媒体と合わずに取りに行かなかった口座と、桁の決まりの3か所のずれを知らせる。
    # どちらも取得は止めない（monitor が運用コンソールと朝の社内通知に出す）。記録に出すのは件数だけ。
    try:
        import media_accounts as _ma
        _ma.load("microsoft")  # 桁・組の確かめの件数を数える（Yahoo は pull_yahoo、Microsoft は pull_microsoft で読み済み）
        for m in ("yahoo", "microsoft"):
            if _ma.SHAPE_SKIPPED.get(m):
                conn_issues.append({"media": m, "kind": "id_shape", "detail": f"{_ma.SHAPE_SKIPPED[m]}件"})
            if _ma.FORM_SKIPPED.get(m):  # 管理画面の追加分で、形の検査（項目・識別名の重複）に落ちた行
                conn_issues.append({"media": m, "kind": "form_skipped", "detail": f"{_ma.FORM_SKIPPED[m]}件"})
        # Microsoft の側に見当たらない口座・口座の一覧を引けなかった（案A・2026-11-21）
        if _ma.MS_CHECK.get("missing"):
            conn_issues.append({"media": "microsoft", "kind": "ms_missing", "detail": f"{_ma.MS_CHECK['missing']}件"})
        if _ma.MS_CHECK.get("list_failed"):
            conn_issues.append({"media": "microsoft", "kind": "ms_list_failed", "detail": ""})
        from check_id_shape_sync import mismatches
        ng = mismatches()
        if ng:
            conn_issues.append({"media": "console", "kind": "id_shape_rules", "detail": ",".join(ng)})
    except Exception as e:
        print("番号の桁の確かめに失敗（取得は継続）:", err(e))
        conn_issues.append({"media": "console", "kind": "id_shape_rules", "detail": "確かめられず"})

    out = {
        "label": "Meta＋Google" + ("＋Yahoo" if yahoo_n else "") + ("＋Microsoft" if ms_n else "") + " 実データ",
        "period": "直近30日",
        "generatedAt": datetime.now(JST).strftime("%Y-%m-%d %H:%M JST"),
        "googleMcc": re.sub(r"\D", "", os.environ.get("GOOGLE_LOGIN_CUSTOMER_ID", "") or ""),  # 媒体ページへのリンク用
        "accounts": accounts,
        "proposals": proposals,
        "connectionIssues": conn_issues,  # 媒体の取得失敗（トークン失効等）→ monitorが重大アラート化
    }
    # 社名の名寄せ（Meta口座名→運用名）＋REPORT GLASSの社別リンク用slug
    from client_map import canonical, report_slug
    for a in accounts:
        if a.get("media") == "meta":
            name = canonical(a["client"], a.get("acct", ""))
            if name != a["client"]:
                a["acctName"], a["client"] = a["client"], name
        a["reportSlug"] = report_slug(a["client"])
    # 全媒体が0件（全滅）のときは前回データを温存して画面を空にしない（generatedAtに注記＝古さが分かる）
    out_path = Path("console/data.json")
    if not accounts and out_path.exists():
        try:
            prev = json.loads(out_path.read_text(encoding="utf-8"))
            if prev.get("accounts"):
                out["accounts"] = prev["accounts"]
                out["proposals"] = prev.get("proposals", [])
                out["generatedAt"] = (prev.get("generatedAt") or out["generatedAt"]) + "（更新失敗・前回値）"
                out["stale"] = True
        except Exception:
            pass
    Path("console").mkdir(exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"console/data.json を出力: {len(accounts)}アカウント（Meta {meta_n} / Google {google_n} / Yahoo {yahoo_n} / Microsoft {ms_n}） / 提案{len(proposals)}件")
    print(f"  うち取得失敗 {sum(1 for a in accounts if 'spend' not in a)}件")
    for a in accounts:
        if "spend" not in a:  # 取得失敗の行（数値なし）。一覧表示だけ飛ばす
            detail(f"  [{a.get('media', '?'):6}] {str(a.get('client', ''))[:20]:22} 取得失敗")
            continue
        # ログ表示だけなので、欠けた数字（取得失敗の期間など）は0で出す。ここで止めない
        mt = a.get("metrics") or {}
        m7, ml = mt.get("d7") or {}, mt.get("lm") or {}
        detail(f"  [{a['media']:6}] {a['client'][:20]:22} 日予算¥{a.get('dailyBudget') or 0:>6,}/日 | 30日:¥{a['spend']:>7,} CV{a.get('cv', 0):>4} | 7日:¥{m7.get('spend', 0):>7,} | 先月:¥{ml.get('spend', 0):>7,}")


if __name__ == "__main__":
    main()
