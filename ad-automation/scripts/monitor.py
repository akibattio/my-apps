#!/usr/bin/env python3
"""広告運用 監視チェック（読み取りのみ・媒体へは一切書き込まない・CLAUDE.md §0）。

console/data.json（毎朝の取得結果）を各アカウントの基準(CLAUDE.md §2 / benchmarks)と
照合し、しきい値抵触をアラートとして集約する。出力先:
  1) logs/monitor.log        … 追記ログ
  2) console/data.json.alerts … コンソール表示用に反映
  3) 通知(任意)              … Google Chat / メール / Slack（環境変数で選択）

通知は「送信先が設定され、かつ --send 指定時」のみ実際に送る（既定はドライラン）。
自動変更・書き込みはしない。各アラートは「事実＋重要度＋承認レベル」を持つ。

使い方:
  python3 scripts/monitor.py            # 判定＋ログ＋console反映（送信なし＝ドライラン）
  python3 scripts/monitor.py --send     # 上記＋通知先へ送信（通知先が設定済みのとき）

通知先（.env・いずれか）:
  NOTIFY_CHANNEL = googlechat | email | slack | none(既定)
  googlechat: GOOGLE_CHAT_WEBHOOK_URL
  slack:      SLACK_WEBHOOK_URL
  email:      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_FROM, ALERT_TO
"""
from __future__ import annotations
import os, re, sys, json, ssl, smtplib, statistics, urllib.request
from email.mime.text import MIMEText
from datetime import datetime, timezone, timedelta
from pathlib import Path

JST = timezone(timedelta(hours=9))
PROJ = Path(__file__).resolve().parent.parent
SEV_ORDER = {"critical": 0, "warn": 1, "info": 2}
SEV_JP = {"critical": "重度", "warn": "悪化", "info": "注意"}


def load_env(path=PROJ / ".env"):
    if not path.exists():
        return
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def check_account(a: dict) -> list[dict]:
    """1アカウントを基準照合してアラート配列を返す。"""
    b = a.get("bench") or {}
    out = []
    spend = a.get("spend") or 0
    cv = a.get("cv") or 0
    cpa = a.get("cpa") or 0
    ctr = a.get("ctr")
    roas = a.get("roas")
    tgt = b.get("targetCpa")
    warn_pct = b.get("cpaWarnPct", 0.20)
    sev_pct = b.get("cpaSeverePct", 0.50)
    daily = a.get("dailyBudget") or 0

    def add(sev, kind, fact, approve):
        out.append({"client": a.get("client"), "media": a.get("media"),
                    "severity": sev, "kind": kind, "fact": fact, "approve": approve})

    # 1) 無駄消化：CV0 で消化あり（日予算×3 を消化基準に）
    if cv == 0 and spend > 0:
        heavy = daily > 0 and spend > daily * 3
        add("critical" if heavy else "warn", "無駄消化",
            f"直近30日 CV0 で ¥{spend:,} 消化" + (f"（日予算×3=¥{daily*3:,}超）" if heavy else ""),
            "上長（計測確認・配信見直し）")

    # 2) CPA悪化（目標設定アカウントのみ）
    if tgt and cv > 0 and cpa:
        if cpa >= tgt * (1 + sev_pct):
            add("critical", "CPA重度悪化", f"CPA ¥{cpa:,}（目標¥{tgt:,}・+{round((cpa/tgt-1)*100)}%）", "上長（停止候補/入札）")
        elif cpa >= tgt * (1 + warn_pct):
            add("warn", "CPA悪化", f"CPA ¥{cpa:,}（目標¥{tgt:,}・+{round((cpa/tgt-1)*100)}%）", "担当（予算/入札調整）")

    # 3) ROAS悪化（目標設定時）
    if b.get("targetRoas") and roas is not None and roas < b["targetRoas"] * 0.8:
        add("warn", "ROAS悪化", f"ROAS {roas}（目標{b['targetRoas']}・-20%超）", "担当（配信/クリエイティブ見直し）")

    # 4) CTR低下（基準設定時）
    if b.get("ctrMin") and ctr is not None and ctr > 0 and ctr < b["ctrMin"]:
        add("info", "CTR低下", f"CTR {ctr}%（基準{b['ctrMin']}%未満）", "担当（クリエイティブ差替検討）")

    # 5) 予算ペース逸脱（日予算がある場合の目安）
    if daily > 0:
        expected = daily * 30
        if spend < expected * b.get("pacingLow", 0.7):
            add("info", "消化ペース低", f"直近30日 ¥{spend:,}（想定¥{expected:,}の{round(spend/expected*100)}%）", "担当（配信状況確認）")
        elif spend > expected * b.get("pacingHigh", 1.1):
            add("info", "消化ペース高", f"直近30日 ¥{spend:,}（想定¥{expected:,}の{round(spend/expected*100)}%）", "担当（予算/入札確認）")

    # 6) トークン失効接近（Meta System User 60日）
    td = a.get("tokenDays")
    if isinstance(td, (int, float)) and td <= 14:
        add("warn", "トークン失効接近", f"残り{int(td)}日（Meta System User）", "接続担当（無期限トークンへ）")

    return out


def _median(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else 0


def daily_checks(acct: dict, today, cadence=None) -> list[dict]:
    """日次時系列(data/daily.json)から急変を検知。クレーム直結＝インプ急停止・消化大幅増減、
    改善＝CPC高騰。当日は部分データのため除外し、完全日(昨日まで)で判定。過去35日を0埋め再構築。"""
    out = []
    days = acct.get("days") or []
    if len(days) < 10:  # データ不足/学習期間は対象外（早すぎる判定を避ける）
        return out
    bydate = {d["date"]: d for d in days}
    cal = []
    for i in range(35, 0, -1):
        ds = (today - timedelta(days=i)).isoformat()
        d = bydate.get(ds)
        cal.append({"date": ds, "imp": (d["imp"] if d else 0), "clk": (d["clk"] if d else 0), "cost": (d["cost"] if d else 0)})
    y = cal[-1]                       # 昨日（最新の完全日）
    prev14 = cal[-15:-1]             # 昨日の前14日
    imp_base = _median([d["imp"] for d in prev14])
    cost_base = _median([d["cost"] for d in prev14])
    active7 = sum(1 for d in cal[-8:-1] if d["imp"] > 0)
    active_days = sum(1 for d in cal if d["cost"] > 0)
    if cadence is None:
        cadence = "weekly" if active_days >= 21 else "daily"
    client, media = acct.get("client"), acct.get("media")

    def add(sev, kind, fact, approve):
        out.append({"client": client, "media": media, "severity": sev, "kind": kind, "fact": fact, "approve": approve})

    # ① インプ急停止（クレーム直結・頻度に関わらず毎日）
    #    直近まで配信ありで昨日が激減。長期停止アカ(直近7日ほぼ0)は"新規停止"でないので除外。
    if imp_base >= 100 and active7 >= 5 and y["imp"] < imp_base * 0.2:
        pct = round(y["imp"] / imp_base * 100) if imp_base else 0
        add("critical", "インプ急停止",
            f"{y['date']} 表示{y['imp']:,}（直近14日中央値{int(imp_base):,}の{pct}%）",
            "接続/配信担当へ即確認（意図的停止でないか）")

    # ② 消化 大幅増減（クレーム直結）— 安定=週次(月曜/前週比±30%)、日次=前日中央値比±50%
    if cadence == "daily":
        if cost_base >= 1000 and y["cost"] == 0:
            add("critical", "消化急減", f"{y['date']} 消化¥0（直近中央値¥{int(cost_base):,}）", "担当（配信停止を確認）")
        elif cost_base >= 1000:
            dev = y["cost"] / cost_base - 1
            if abs(dev) >= 0.5:
                add("critical", "消化" + ("急増" if dev > 0 else "急減"),
                    f"{y['date']} ¥{y['cost']:,}（直近中央値¥{int(cost_base):,}比 {'+' if dev > 0 else ''}{round(dev * 100)}%）",
                    "担当（予算/配信を確認）")
    elif today.weekday() == 0:  # weekly は月曜に前週比
        this7 = sum(d["cost"] for d in cal[-7:])
        prev7 = sum(d["cost"] for d in cal[-14:-7])
        if prev7 >= 7000:
            dev = this7 / prev7 - 1
            if abs(dev) >= 0.3:
                add("critical", "消化" + ("増" if dev > 0 else "減") + "(週次)",
                    f"直近7日¥{this7:,}（前週¥{prev7:,}比 {'+' if dev > 0 else ''}{round(dev * 100)}%）",
                    "担当（予算/配信を確認）")

    # ③ CPC高騰（改善・頻度準拠：日次は毎日／週次は月曜）
    if cadence == "daily" or today.weekday() == 0:
        clk7 = sum(d["clk"] for d in cal[-7:]); cost7 = sum(d["cost"] for d in cal[-7:])
        clkB = sum(d["clk"] for d in cal[-21:-7]); costB = sum(d["cost"] for d in cal[-21:-7])
        if clk7 >= 20 and clkB >= 20 and costB > 0:
            cpc7 = cost7 / clk7; cpcB = costB / clkB
            if cpcB > 0 and cpc7 / cpcB - 1 >= 0.4:
                add("warn", "CPC高騰",
                    f"直近7日CPC¥{round(cpc7):,}（前14日¥{round(cpcB):,}比 +{round((cpc7 / cpcB - 1) * 100)}%）",
                    "担当（入札/KW見直し）")
    return out


def search_check(a: dict, cadence, today) -> list[dict]:
    """Google検索の診断(data/search_diag.json)：IS大幅低下・不要検索クエリ。改善・頻度準拠。"""
    out = []
    if not (cadence == "daily" or today.weekday() == 0):
        return out
    client = a.get("client")

    def add(sev, kind, fact, approve):
        out.append({"client": client, "media": "google", "severity": sev, "kind": kind, "fact": fact, "approve": approve})

    is7, isp = a.get("is7"), a.get("isPrev7")
    if is7 is not None and isp is not None and (isp - is7) >= 15:
        add("warn", "IS大幅低下", f"検索IS {isp}%→{is7}%（{round(is7 - isp)}pt）", "担当（予算/入札/競合を確認）")
    w = a.get("waste") or []
    if w and a.get("wasteTotal", 0) >= 10000:
        top = max(w, key=lambda x: x["cost"])
        add("info", "不要検索クエリ",
            f"CV0×費用超 {len(w)}件・計¥{a['wasteTotal']:,}（最大「{top['text']}」¥{top['cost']:,}）",
            "担当（除外KW追加を検討）")
    return out


def build_message(alerts: list[dict], period: str, generated: str) -> str:
    crit = [x for x in alerts if x["severity"] == "critical"]
    warn = [x for x in alerts if x["severity"] == "warn"]
    info = [x for x in alerts if x["severity"] == "info"]
    head = (f"【広告運用 監視アラート】{generated}\n"
            f"対象:{period} ／ 重度{len(crit)}・悪化{len(warn)}・注意{len(info)}")
    if not alerts:
        return head + "\n\nしきい値抵触なし。全アカウント正常。"
    lines = [head, ""]
    for x in sorted(alerts, key=lambda y: SEV_ORDER[y["severity"]]):
        lines.append(f"[{SEV_JP[x['severity']]}] {x['client']}（{x['media']}）: {x['kind']} — {x['fact']} → 承認:{x['approve']}")
    lines.append("\n※すべて下書き（未適用）。適用は承認後のみ（CLAUDE.md §0）。")
    return "\n".join(lines)


def notify(msg: str) -> str:
    ch = os.environ.get("NOTIFY_CHANNEL", "none").strip().lower()
    if ch in ("none", ""):
        return "通知先未設定（送信スキップ）"
    try:
        if ch == "googlechat":
            url = os.environ["GOOGLE_CHAT_WEBHOOK_URL"].strip()
            req = urllib.request.Request(url, data=json.dumps({"text": msg}).encode("utf-8"),
                                         headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=20)
            return "Google Chat へ送信"
        if ch == "slack":
            url = os.environ["SLACK_WEBHOOK_URL"].strip()
            req = urllib.request.Request(url, data=json.dumps({"text": msg}).encode("utf-8"),
                                         headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=20)
            return "Slack へ送信"
        if ch == "email":
            mm = MIMEText(msg, "plain", "utf-8")
            mm["Subject"] = "【広告運用】監視アラート"
            mm["From"] = os.environ["ALERT_FROM"].strip()
            mm["To"] = os.environ["ALERT_TO"].strip()
            host = os.environ["SMTP_HOST"].strip(); port = int(os.environ.get("SMTP_PORT", "587"))
            with smtplib.SMTP(host, port, timeout=30) as s:
                s.starttls(context=ssl.create_default_context())
                s.login(os.environ["SMTP_USER"].strip(), os.environ["SMTP_PASS"].strip())
                s.send_message(mm)
            return "メール送信"
        return f"未知の通知先: {ch}"
    except Exception as e:
        return f"送信失敗（{ch}）: {str(e)[:80]}"


def main():
    send = "--send" in sys.argv
    load_env()
    data_path = PROJ / "console" / "data.json"
    if not data_path.exists():
        print("console/data.json が無い（先に取得を実行）"); raise SystemExit(1)
    data = json.loads(data_path.read_text(encoding="utf-8"))
    alerts = []
    for a in data.get("accounts", []):
        alerts += check_account(a)

    # cadence(日次/週次) 決定：benchmarks(=console bench.cadence)優先、無ければ配信日数で自動
    bench_cad = {}
    for a in data.get("accounts", []):
        cd = (a.get("bench") or {}).get("cadence")
        if cd:
            bench_cad[a.get("client")] = cd
    tdy = datetime.now(JST).date()
    cadence_map = {}

    # 日次時系列による急変検知（クレーム直結：インプ急停止・消化大幅増減／改善：CPC高騰）
    daily_path = PROJ / "data" / "daily.json"
    if daily_path.exists():
        try:
            dj = json.loads(daily_path.read_text(encoding="utf-8"))
            for acct in dj.get("accounts", []):
                name = acct.get("client")
                active_days = sum(1 for d in (acct.get("days") or []) if d.get("cost", 0) > 0)
                cad = bench_cad.get(name) or ("weekly" if active_days >= 21 else "daily")
                cadence_map[name] = cad
                alerts += daily_checks(acct, tdy, cad)
        except Exception as e:
            print("daily.json 判定失敗:", str(e)[:80])

    # Google検索の診断（改善：IS大幅低下・不要検索クエリ）
    sd_path = PROJ / "data" / "search_diag.json"
    if sd_path.exists():
        try:
            sd = json.loads(sd_path.read_text(encoding="utf-8"))
            for a in sd.get("accounts", []):
                cad = cadence_map.get(a.get("client")) or bench_cad.get(a.get("client")) or "daily"
                alerts += search_check(a, cad, tdy)
        except Exception as e:
            print("search_diag.json 判定失敗:", str(e)[:80])

    generated = datetime.now(JST).strftime("%Y-%m-%d %H:%M JST")
    msg = build_message(alerts, data.get("period", "直近30日"), generated)

    # 1) ログ
    (PROJ / "logs").mkdir(exist_ok=True)
    with open(PROJ / "logs" / "monitor.log", "a", encoding="utf-8") as f:
        f.write(f"\n=== {generated} ===\n{msg}\n")

    # 2) console/data.json の alerts に反映（重要度順・表示用）
    data["alerts"] = sorted(
        [{"client": x["client"], "media": x["media"], "severity": x["severity"],
          "kind": x["kind"], "fact": x["fact"], "approve": x["approve"]} for x in alerts],
        key=lambda y: SEV_ORDER[y["severity"]])
    data["alertsGeneratedAt"] = generated
    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    # 3) 通知（--send かつ 通知先設定時のみ）
    result = notify(msg) if send else "ドライラン（--send未指定・送信なし）"

    print(msg)
    print(f"\n[monitor] アラート{len(alerts)}件 / 通知: {result}")


if __name__ == "__main__":
    main()
