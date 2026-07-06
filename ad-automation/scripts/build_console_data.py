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

JST = timezone(timedelta(hours=9))
BASE = "https://graph.facebook.com/v21.0"
# 監視対象から外すアカウント（未使用など）。名前で完全一致。
# ※これは自社システムの表示/取得除外。Meta側の権限解除は Business設定で別途行う。
EXCLUDE_ACCOUNTS = {"【SC用】RiceLog2"}
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
    row = (ins.get("data") or [{}])[0] if "__error__" not in ins else {}
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
    return {"spend": spend, "imp": imp, "clk": clk, "ctr": ctr, "cpc": cpc,
            "cpm": cpm, "freq": freq, "cv": cv, "cpa": cpa, "roas": roas}


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


def main():
    load_env()
    tok = os.environ.get("SOFCOM_META_SYSTEM_USER_TOKEN", "").strip()
    if not tok:
        print("SOFCOM_META_SYSTEM_USER_TOKEN が未設定です（.env）。")
        raise SystemExit(2)

    accts_resp = get("me/adaccounts", {"fields": "name,account_id", "limit": "100"}, tok)
    accts = accts_resp.get("data", []) if "__error__" not in accts_resp else []
    if not accts:
        print("読み取り可能な広告アカウントがありません:", accts_resp.get("__error__"))
        raise SystemExit(1)
    # 除外アカウントをスキップ
    excluded = [a.get("name") for a in accts if a.get("name") in EXCLUDE_ACCOUNTS]
    accts = [a for a in accts if a.get("name") not in EXCLUDE_ACCOUNTS]
    if excluded:
        print("除外（監視対象外）:", ", ".join(excluded))

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
            print("benchmarks.json 読み込み失敗（全社既定を使用）:", e)

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
            "acct": acc, "status": "ok", "tokenDays": 60, "cp": cp,
            "sync": datetime.now(JST).strftime("%H:%M 取得"),
            # 概要/一覧用サマリ（直近30日）
            "spend": d30["spend"], "cpa": d30["cpa"] or 0, "target": bench.get("targetCpa"),
            "roas": d30["roas"], "cv": d30["cv"], "ctr": d30["ctr"], "is": None,
            # 詳細（レポート状態）用
            "dailyBudget": dbudget, "lmDays": lm_days,
            "metrics": {"d7": d7, "lm": lm},
            "bench": bench,
        })
        if d30["cv"] == 0 and d30["spend"] > 0:
            proposals.append({
                "id": f"live-{i}", "client": name, "media": "meta", "kind": "計測確認/配信見直し",
                "cur": f"直近30日 CV0 で ¥{d30['spend']:,} 消化",
                "next": "CV計測(登録完了等)を確認、正常なら配信/クリエイティブ見直し",
                "reason": "コンバージョンが記録されていない。まず計測の健全性を確認（推測で断定せず計測担当へ）。",
                "severity": "critical", "twoStep": False,
            })

    out = {
        "label": "Meta 実データ",
        "period": "直近30日",
        "generatedAt": datetime.now(JST).strftime("%Y-%m-%d %H:%M JST"),
        "accounts": accounts,
        "proposals": proposals,
    }
    Path("console").mkdir(exist_ok=True)
    Path("console/data.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"console/data.json を出力: {len(accounts)}アカウント / 提案{len(proposals)}件")
    for a in accounts:
        m7, ml = a["metrics"]["d7"], a["metrics"]["lm"]
        print(f"  {a['client'][:22]:24} 日予算¥{a['dailyBudget']:>6,}/日 | 7日:¥{m7['spend']:>7,} imp{m7['imp']:>6,} clk{m7['clk']:>5,} CPC¥{m7['cpc']:>5} | 先月:¥{ml['spend']:>7,}")


if __name__ == "__main__":
    main()
