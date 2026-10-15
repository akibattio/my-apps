#!/usr/bin/env python3
"""report-glass（クライアント向けHTMLレポート・Node）へ Microsoft広告データを受け渡す。読み取りのみ。

役割分担: 取得=ad-automation(このリポ) / 表示=report-glass。
出力: <AD_REPORT_DIR>/<slug>-<YYYY-MM>.json
  形式は report-glass の readYahoo が読む形と完全一致（キー名）:
    {"campaigns":[{name,type,cost,impressions,clicks,conversions}],
     "devices":[{name,cost,impressions,clicks,conversions}],
     "keywords":[{kw,clicks,cost,conversions,quality,rank,avgcpc}],
     "queries":[{q,clicks,cost}],
     "adGroups":[{name,cost,impressions,clicks,conversions}],
     "ads":[{name,title,desc,cost,impressions,clicks,conversions}],
     "daily":[{date,cost,clicks,conversions}],
     "monthly":[{ym,cost,impressions,clicks,conversions}],
     "genders":[{name,cost,impressions,clicks,conversions}],
     "ages":[{name,cost,impressions,clicks,conversions}],
     "regions":[{name,cost,impressions,clicks,conversions}],
     "hourly":[{h,cost,clicks,conversions}]}
  - slug は clients/microsoft_accounts.json の "slug"
  - 取れないキーは空配列/null（推測で埋めない）

使い方:
  python3 scripts/export_microsoft_for_adreport.py [YYYY-MM]            # 省略時は先月
  python3 scripts/export_microsoft_for_adreport.py 2026-06 --sample     # creds無しでサンプルJSONを書き出し（疎通確認）
  python3 scripts/export_microsoft_for_adreport.py 2026-06 --only=tenjikai  # slug 絞り込み

環境変数:
  AD_REPORT_DIR   既定 ~/dev/report-glass/pipeline/microsoft
  （Microsoft接続情報は fetch_microsoft_insights.py と同じ MS_ADS_* を使用）

※ 未接続(creds無し)なら実データは出さず終了（--sample 指定時のみサンプルを書く）。
  書き込みは report-glass の取り込み用ディレクトリのみ。広告媒体へは一切書き込まない。
"""
from __future__ import annotations
import os, sys, json, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetch_microsoft_insights as M  # noqa: E402

PROJ = Path(__file__).resolve().parent.parent
# report-glass の実体は ~/dev/report-glass。取り込みディレクトリは pipeline/microsoft。
DEFAULT_DIR = Path(os.path.expanduser("~/dev/report-glass/pipeline/microsoft"))


def _last_month() -> str:
    t = datetime.date.today().replace(day=1) - datetime.timedelta(days=1)
    return f"{t.year:04d}-{t.month:02d}"


def _month_span(ym: str):
    y, m = int(ym[:4]), int(ym[5:7])
    start = datetime.date(y, m, 1)
    end = datetime.date(y + (m // 12), (m % 12) + 1, 1) - datetime.timedelta(days=1)
    end = min(end, datetime.date.today())  # 当月は未来日を渡さない
    return start.isoformat(), end.isoformat()


def _months_ago_start(ym: str, n: int) -> str:
    """ym の (n-1)ヶ月前の月初（月次推移レンジ用）。"""
    y, m = int(ym[:4]), int(ym[5:7])
    m -= (n - 1)
    while m <= 0:
        m += 12; y -= 1
    return datetime.date(y, m, 1).isoformat()


def _build_payload(slug, accs, ym, start, end):
    """スラッグ配下のアカウントを合算し report-glass契約のリッチJSONを組む。取れる項目だけ入れる。"""
    campaigns, dev, daily, monthly, kws, qrs = [], {}, {}, {}, {}, {}
    gender, age, region, hourly = {}, {}, {}, {}
    adg, ads = {}, {}
    mon_start = _months_ago_start(ym, 24)  # monthly は直近24ヶ月（前年比のため）

    def add(bucket, key, cost=0, imp=None, clk=0, cv=0):
        e = bucket.setdefault(key, {"cost": 0, "imp": 0, "clk": 0, "cv": 0})
        e["cost"] += cost or 0; e["imp"] += imp or 0; e["clk"] += clk or 0; e["cv"] += cv or 0

    for a in accs:
        acct = str(a["accountId"])

        def safe(fn, *args):
            try:
                return fn(*args)
            except Exception as ex:
                print(f"  取得失敗 {slug}/{fn.__name__}: {str(ex)[:60]}")
                return []

        campaigns += safe(M.ms_campaigns, acct, start, end)
        for d in safe(M.ms_devices, acct, start, end):
            add(dev, d["name"], d["cost"], d["impressions"], d["clicks"], d["conversions"])
        for d in safe(M.ms_daily, acct, start, end):
            add(daily, d["date"], d.get("cost"), d.get("imp"), d.get("clk"), d.get("cv"))
        for m in safe(M.ms_monthly, acct, mon_start, end):
            add(monthly, m["month"], m.get("cost"), m.get("imp"), m.get("clk"), m.get("cv"))
        for d in safe(M.ms_genders, acct, start, end):
            add(gender, d["name"], d["cost"], d["impressions"], d["clicks"], d["conversions"])
        for d in safe(M.ms_ages, acct, start, end):
            add(age, d["name"], d["cost"], d["impressions"], d["clicks"], d["conversions"])
        for d in safe(M.ms_regions, acct, start, end):
            add(region, d["name"], d["cost"], d["impressions"], d["clicks"], d["conversions"])
        for d in safe(M.ms_hourly, acct, start, end):
            add(hourly, d["h"], d.get("cost"), d.get("imp"), d.get("clk"), d.get("cv"))
        # キーワードは quality/rank/avgcpc を保持するため bucket合算でなく個別に積む
        for k in safe(M.ms_keywords, acct, start, end):
            e = kws.setdefault(k["kw"], {"cost": 0, "clk": 0, "cv": 0,
                                         "quality": None, "rank": None, "avgcpc": None})
            e["cost"] += k.get("cost", 0); e["clk"] += k.get("clicks", 0); e["cv"] += k.get("conversions", 0)
            for mk in ("quality", "rank", "avgcpc"):
                if k.get(mk) is not None:
                    e[mk] = k[mk]
        for q in safe(M.ms_queries, acct, start, end):
            add(qrs, q["q"], q["cost"], 0, q["clicks"], 0)
        for g in safe(M.ms_adgroups, acct, start, end):
            add(adg, g["name"], g["cost"], g["impressions"], g["clicks"], g["conversions"])
        for ad in (safe(M.ms_ads, acct, start, end) or []):
            key = ad.get("title") or ad.get("name")
            if not key:
                continue
            e = ads.setdefault(key, {"title": ad.get("title", ""), "desc": ad.get("desc", ""),
                                     "cost": 0, "imp": 0, "clk": 0, "cv": 0})
            e["cost"] += ad["cost"]; e["imp"] += ad["impressions"]; e["clk"] += ad["clicks"]; e["cv"] += ad["conversions"]

    if not campaigns and not any([dev, daily, monthly]):
        return None
    payload = {"campaigns": campaigns}
    if dev:
        payload["devices"] = [{"name": n, "cost": v["cost"], "impressions": v["imp"], "clicks": v["clk"], "conversions": v["cv"]}
                              for n, v in sorted(dev.items(), key=lambda kv: kv[1]["cost"], reverse=True)]
    if daily:
        payload["daily"] = [{"date": d, "cost": v["cost"], "clicks": v["clk"], "conversions": v["cv"]}
                            for d, v in sorted(daily.items())]
    if monthly:
        payload["monthly"] = [{"ym": m[:7], "cost": v["cost"], "impressions": v["imp"], "clicks": v["clk"], "conversions": v["cv"]}
                              for m, v in sorted(monthly.items())]
    if kws:
        def _kwrow(n, v):
            row = {"kw": n, "clicks": v["clk"], "cost": v["cost"], "conversions": v["cv"]}
            if v.get("quality") is not None:
                row["quality"] = round(v["quality"])
            if v.get("rank") is not None:
                row["rank"] = round(v["rank"], 1)
            if v.get("avgcpc") is not None:
                row["avgcpc"] = round(v["avgcpc"])
            return row
        payload["keywords"] = [_kwrow(n, v) for n, v in sorted(kws.items(), key=lambda kv: kv[1]["cost"], reverse=True)[:30]]
    if adg:
        payload["adGroups"] = [{"name": n, "cost": v["cost"], "impressions": v["imp"], "clicks": v["clk"], "conversions": v["cv"]}
                               for n, v in sorted(adg.items(), key=lambda kv: kv[1]["cost"], reverse=True)[:30]]
    if ads:
        payload["ads"] = [{"name": n, "title": v["title"], "desc": v["desc"], "cost": v["cost"], "impressions": v["imp"], "clicks": v["clk"], "conversions": v["cv"]}
                          for n, v in sorted(ads.items(), key=lambda kv: kv[1]["cost"], reverse=True)[:20]]
    if qrs:
        payload["queries"] = [{"q": n, "clicks": v["clk"], "cost": v["cost"]}
                              for n, v in sorted(qrs.items(), key=lambda kv: kv[1]["cost"], reverse=True)[:30]]
    if gender:
        payload["genders"] = [{"name": n, "cost": v["cost"], "impressions": v["imp"], "clicks": v["clk"], "conversions": v["cv"]}
                              for n, v in sorted(gender.items(), key=lambda kv: kv[1]["cost"], reverse=True)]
    if age:
        payload["ages"] = [{"name": n, "cost": v["cost"], "impressions": v["imp"], "clicks": v["clk"], "conversions": v["cv"]}
                           for n, v in sorted(age.items(), key=lambda kv: kv[1]["cost"], reverse=True)]
    if region:
        payload["regions"] = [{"name": n, "cost": v["cost"], "impressions": v["imp"], "clicks": v["clk"], "conversions": v["cv"]}
                              for n, v in sorted(region.items(), key=lambda kv: kv[1]["cost"], reverse=True)[:15]]
    if hourly:
        payload["hourly"] = [{"h": h, "cost": v["cost"], "clicks": v["clk"], "conversions": v["cv"]}
                             for h, v in sorted(hourly.items())]
    return payload


def _sample(slug: str) -> dict:
    return {
        "campaigns": [
            {"name": f"検索_一般（{slug}）", "type": "検索", "cost": 38000, "impressions": 14000, "clicks": 480, "conversions": 4},
            {"name": f"オーディエンス_リマケ（{slug}）", "type": "オーディエンス", "cost": 15000, "impressions": 320000, "clicks": 560, "conversions": 1},
        ],
        "devices": [
            {"name": "Computer", "cost": 30000, "impressions": 200000, "clicks": 620, "conversions": 3},
            {"name": "Smartphone", "cost": 20000, "impressions": 130000, "clicks": 400, "conversions": 2},
            {"name": "Tablet", "cost": 3000, "impressions": 4000, "clicks": 20, "conversions": 0},
        ],
        "keywords": [
            {"kw": "ブース 装飾", "clicks": 120, "cost": 14000, "conversions": 2, "quality": 7, "rank": None, "avgcpc": 117},
            {"kw": "展示会 ブース", "clicks": 90, "cost": 11000, "conversions": 1, "quality": 6, "rank": None, "avgcpc": 122},
        ],
        "queries": [
            {"q": "展示会 ブース 制作", "clicks": 40, "cost": 5200},
            {"q": "ブース デザイン 会社", "clicks": 28, "cost": 3600},
        ],
        "adGroups": [
            {"name": "一般ワード", "cost": 22000, "impressions": 90000, "clicks": 320, "conversions": 2},
            {"name": "指名ワード", "cost": 9000, "impressions": 20000, "clicks": 140, "conversions": 2},
        ],
        "ads": [
            {"name": "ad-1", "title": "展示会ブースの装飾・制作", "desc": "集客できるブースを一括サポート", "cost": 18000, "impressions": 70000, "clicks": 260, "conversions": 2},
        ],
        "genders": [
            {"name": "Male", "cost": 30000, "impressions": 190000, "clicks": 620, "conversions": 3},
            {"name": "Female", "cost": 21000, "impressions": 150000, "clicks": 420, "conversions": 2},
            {"name": "Unknown", "cost": 2000, "impressions": 8000, "clicks": 18, "conversions": 0},
        ],
        "ages": [
            {"name": "25-34", "cost": 19000, "impressions": 110000, "clicks": 350, "conversions": 2},
            {"name": "35-44", "cost": 16000, "impressions": 100000, "clicks": 310, "conversions": 2},
            {"name": "45-54", "cost": 10000, "impressions": 80000, "clicks": 200, "conversions": 1},
        ],
        "regions": [
            {"name": "Tokyo", "cost": 24000, "impressions": 170000, "clicks": 500, "conversions": 3},
            {"name": "Aichi", "cost": 13000, "impressions": 110000, "clicks": 280, "conversions": 1},
            {"name": "Osaka", "cost": 8000, "impressions": 70000, "clicks": 160, "conversions": 1},
        ],
        "daily": [
            {"date": f"2026-06-{d:02d}", "cost": 1500 + (d % 5) * 400, "clicks": 15 + (d % 5) * 6, "conversions": 0}
            for d in range(1, 8)
        ],
        "monthly": [
            {"ym": "2026-04", "cost": 48000, "impressions": 330000, "clicks": 1000, "conversions": 5},
            {"ym": "2026-05", "cost": 51000, "impressions": 340000, "clicks": 1050, "conversions": 6},
            {"ym": "2026-06", "cost": 53000, "impressions": 350000, "clicks": 1080, "conversions": 5},
        ],
        "hourly": [{"h": h, "cost": 1800 + (h % 6) * 800, "clicks": 18 + (h % 6) * 7, "conversions": 0} for h in range(24)],
    }


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sample = "--sample" in sys.argv
    ym = args[0] if args else _last_month()
    out_dir = Path(os.environ.get("AD_REPORT_DIR", str(DEFAULT_DIR)))
    M.load_env()

    cfg_path = PROJ / "clients" / "microsoft_accounts.json"
    if not cfg_path.exists():
        print("clients/microsoft_accounts.json が無い（アカウント対応表を用意）。")
        return 2
    entries = [e for e in json.loads(cfg_path.read_text(encoding="utf-8"))
               if isinstance(e, dict) and e.get("slug") and e.get("accountId") and not str(e.get("accountId")).startswith("<")]
    if not entries and not sample:
        print("slug付きのMicrosoftアカウントが未設定です（microsoft_accounts.json に slug/accountId を記入）。")
        print("（疎通確認だけなら --sample でサンプルJSONを書き出せます）")
        return 2

    # --sample 時は accountId が未設定でも slug だけでサンプルを書けるようにする
    sample_entries = [e for e in json.loads(cfg_path.read_text(encoding="utf-8"))
                      if isinstance(e, dict) and e.get("slug")]

    # slug ごとにアカウントをまとめる
    by_slug: dict[str, list] = {}
    for e in (sample_entries if sample else entries):
        by_slug.setdefault(e["slug"], []).append(e)

    only = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), "")
    if only:
        by_slug = {k: v for k, v in by_slug.items() if k == only}
        if not by_slug:
            print(f"--only={only} に一致するslugがありません（microsoft_accounts.json を確認）")
            return 2

    if not sample and not M.ms_enabled():
        print("Microsoft接続情報が未設定です。実データを出すには creds を .env に設定してください。")
        print("（疎通確認だけなら --sample でサンプルJSONを書き出せます）")
        return 2

    start, end = _month_span(ym)
    out_dir.mkdir(parents=True, exist_ok=True)
    wrote = 0
    for slug, accs in sorted(by_slug.items()):
        if sample:
            payload = _sample(slug)
        else:
            payload = _build_payload(slug, accs, ym, start, end)
            if payload is None:
                print(f"  {slug}: {ym} の実績なし → 出力スキップ（推測で埋めない）")
                continue
        out = out_dir / f"{slug}-{ym}.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        extra = "+".join(k for k in ("devices", "daily", "keywords", "queries", "monthly", "genders", "ages", "regions", "hourly") if payload.get(k))
        print(f"  出力 {out}  （{len(payload['campaigns'])}キャンペーン{'・' + extra if extra else ''}{'・サンプル' if sample else ''}）")
        wrote += 1

    print(f"完了: {wrote}ファイルを {out_dir} に出力（{ym}）。")
    print(f"→ report-glass側で再生成: node generate.js --customer=<ID> --month={ym}（この操作はreport-glass側）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
