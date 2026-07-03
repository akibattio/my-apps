#!/usr/bin/env python3
"""管理コンソール(ad_ops_console)の実データJSONを生成する。

アクセス可能な Meta 広告アカウントの実績を取得し、コンソールが読む console/data.json を出力。
読み取り専用・トークンは .env から・実値は出力しない（数値のみ）。

出力: console/data.json  { period, label, generatedAt, accounts:[...], proposals:[...] }
"""
from __future__ import annotations
import os, re, json, urllib.request, urllib.parse, urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

JST = timezone(timedelta(hours=9))
BASE = "https://graph.facebook.com/v21.0"
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


def main():
    load_env()
    tok = os.environ.get("SOFCOM_META_SYSTEM_USER_TOKEN", "").strip()
    if not tok:
        print("SOFCOM_META_SYSTEM_USER_TOKEN が未設定です（.env）。", flush=True)
        raise SystemExit(2)

    accts_resp = get("me/adaccounts", {"fields": "name,account_id", "limit": "100"}, tok)
    accts = accts_resp.get("data", []) if "__error__" not in accts_resp else []
    if not accts:
        print("読み取り可能な広告アカウントがありません:", accts_resp.get("__error__"))
        raise SystemExit(1)

    accounts, proposals = [], []
    for i, a in enumerate(accts, 1):
        acc = "act_" + a.get("account_id", "")
        name = a.get("name", acc)
        ins = get(f"{acc}/insights", {"level": "account", "date_preset": "last_30d",
                  "fields": "spend,impressions,clicks,ctr,actions,action_values"}, tok)
        row = (ins.get("data") or [{}])[0] if "__error__" not in ins else {}
        spend = round(float(row.get("spend", 0) or 0))
        clicks = int(float(row.get("clicks", 0) or 0))
        ctr = round(float(row.get("ctr", 0) or 0), 2)
        cv = int(sum_action(row.get("actions"), CV_ACTIONS))
        rev = sum_action(row.get("action_values"), CV_ACTIONS)
        cpa = round(spend / cv) if cv else 0
        roas = round(rev / spend, 1) if spend and rev else None
        camps = get(f"{acc}/campaigns", {"fields": "status", "limit": "200"}, tok)
        cp = sum(1 for c in camps.get("data", []) if c.get("status") == "ACTIVE") if "__error__" not in camps else 0
        status = "ok"
        accounts.append({
            "id": i, "client": name, "tier": "mid", "monthly": None, "media": "meta",
            "acct": acc, "status": status, "tokenDays": 60, "cp": cp,
            "sync": datetime.now(JST).strftime("%H:%M 取得"),
            "spend": spend, "cpa": cpa, "target": None, "roas": roas,
            "cv": cv, "ctr": ctr, "is": None,
        })
        # 実データからの提案(下書き)：CV0で費用消化
        if cv == 0 and spend > 0:
            proposals.append({
                "id": f"live-{i}", "client": name, "media": "meta", "kind": "計測確認/配信見直し",
                "cur": f"直近30日 CV0 で ¥{spend:,} 消化",
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
        print(f"  {a['client'][:24]:26} 消化¥{a['spend']:>8,} CV{a['cv']:>3} CTR{a['ctr']:>5}% ACTIVE{a['cp']}本")


if __name__ == "__main__":
    main()
