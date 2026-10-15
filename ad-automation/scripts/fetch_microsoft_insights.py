#!/usr/bin/env python3
"""Microsoft広告(Microsoft Advertising / 旧Bing Ads) Reporting API 読み取り雛形。読み取りのみ・媒体へ書き込まない。

方針（Yahoo版 fetch_yahoo_insights.py に合わせる）:
  - **読み取り専用**。予算/入札/ON-OFF/作成などの書き込みは一切しない。
  - Client Secret / refresh token は環境変数から読む。実値はコード/MD/チャットに出さない。
  - 接続情報が無い/未接続でも安全に停止（推測でデータを作らない）。
  - 取得は bingads SDK(v13) の ReportingServiceManager を使う（submit→poll→download→csv parse を内包）。
  - bingads 未インストールの環境でも import では落ちない。取得関数を呼んだ時に分かりやすく失敗する。

公開する関数（Yahoo の fetch と同じ戻り値キーで返す。呼ぶ側（export_microsoft_for_adreport）が同形で使える）:
  - ms_enabled()                               … 接続情報が揃っているか
  - ms_campaigns(account_id, start, end)       … [{name,type,cost,impressions,clicks,conversions}]
  - ms_keywords(account_id, start, end)        … [{kw,clicks,cost,conversions,quality,rank,avgcpc}]
  - ms_queries(account_id, start, end)         … [{q,clicks,cost}]  （SearchQueryPerformance）
  - ms_devices(account_id, start, end)         … [{name,cost,impressions,clicks,conversions}]（DeviceType列）
  - ms_daily(account_id, start, end)           … [{date,cost,imp,clk,cv}]（TimePeriod=Daily）
  - ms_monthly(account_id, start, end)         … [{month,cost,imp,clk,cv,cpa}]（TimePeriod=Monthly）
  - ms_ages(account_id, start, end)            … [{name,cost,impressions,clicks,conversions}]
  - ms_genders(account_id, start, end)         … [{name,cost,impressions,clicks,conversions}]（AgeGenderAudienceReport）
  - ms_regions(account_id, start, end)         … [{name,cost,impressions,clicks,conversions}]（GeographicPerformance）
  - ms_adgroups(account_id, start, end)        … [{name,cost,impressions,clicks,conversions}]（AdGroupPerformance）
  - ms_ads(account_id, start, end)             … [{name,title,desc,cost,impressions,clicks,conversions}]（AdPerformance）
  - ms_hourly(account_id, start, end)          … [{h,cost,clk,cv,imp}]（Aggregation=HourOfDay）

環境変数（.env / Secrets で注入。実値はGit管理外）:
  MS_ADS_DEVELOPER_TOKEN   開発者トークン（Microsoft Advertising で発行）
  MS_ADS_CLIENT_ID         アプリ(クライアント)ID
  MS_ADS_CLIENT_SECRET     クライアントシークレット（public client なら空可）
  MS_ADS_REFRESH_TOKEN     OAuth認可で取得した refresh token（秘密）
  MS_ADS_CUSTOMER_ID       顧客ID（MCC配下の管理顧客ID）
  MS_ADS_ACCOUNT_ID        既定アカウントID（関数引数で上書き可）
  # 任意:
  MS_ADS_ENVIRONMENT       既定 production
  MS_ADS_REDIRECT_URI      OAuthWebAuthCodeGrant 用（confidential client のとき）

注意（稼働前に要確認）:
  - 列挙名（*ReportColumn のメンバ）とレポート種別は bingads v13 リファレンスで最新を確認すること。
    金額: Microsoft の Spend はアカウント通貨の実額（日本アカウントなら円）。そのまま cost に入れる。
    conversions は Conversions 列。
  - campaigns / keywords / queries / devices / daily / monthly を確実に通し、
    ages/genders/regions/adgroups/ads/hourly は「取れれば入れる・失敗しても空配列で握りつぶす（安全）」。
"""
from __future__ import annotations
import os, io, csv, sys, json, tempfile, datetime
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent

ENVIRONMENT = os.environ.get("MS_ADS_ENVIRONMENT", "production").strip() or "production"

# CSVヘッダ（Microsoftレポートの列名）→ 内部キーの対応。英名ベース（CSVは英語ヘッダ）。
COL_ALIASES = {
    "date": {"TimePeriod", "GregorianDate"},          # Daily集計時の日付列
    "month": {"TimePeriod", "GregorianDate"},          # Monthly集計時（同じ列名で粒度が月）
    "hour": {"TimePeriod", "HourOfDay"},               # HourOfDay集計時（0〜23）
    "name": {"CampaignName", "KeywordText", "Keyword", "SearchQuery",
             "DeviceType", "AdGroupName", "State", "Province", "County", "City",
             "MetroArea", "Country", "AgeGroup", "Gender"},
    "ctype": {"CampaignType"},
    "cost": {"Spend", "Cost"},
    "imp": {"Impressions", "Impr"},
    "clk": {"Clicks"},
    "cv": {"Conversions", "Conv"},
    "quality": {"QualityScore"},
    "avgcpc": {"AverageCpc", "AvgCpc"},
    "ctr": {"Ctr"},
    "title": {"AdTitle", "TitlePart1", "Title"},
    "desc": {"AdDescription", "Description", "Text"},
}


# ---- env ロード（Yahoo版 load_env を流用）----
def load_env(path=PROJ / ".env"):
    import re
    if not path.exists():
        return
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def ms_enabled() -> bool:
    """接続情報が揃っているか（揃っていなければパイプラインは Microsoft をスキップ）。"""
    need = ("MS_ADS_DEVELOPER_TOKEN", "MS_ADS_CLIENT_ID",
            "MS_ADS_REFRESH_TOKEN", "MS_ADS_CUSTOMER_ID")
    return all(os.environ.get(k, "").strip() for k in need)


def _require_bingads():
    """bingads SDK を遅延 import。未インストール時は分かりやすいメッセージで停止。"""
    try:
        import bingads  # noqa: F401
        from bingads.authorization import AuthorizationData  # noqa: F401
        from bingads.service_client import ServiceClient  # noqa: F401
        from bingads.v13.reporting import ReportingServiceManager, ReportingDownloadParameters  # noqa: F401
        return True
    except Exception as e:  # ImportError 等
        raise RuntimeError(
            "bingads SDK が見つかりません。`pip install bingads`（requirements.txt に追記済み）で導入してください。"
            f" 詳細: {type(e).__name__}: {str(e)[:120]}"
        )


def _authorization_data(account_id: str):
    """refresh_token から OAuth を復元し AuthorizationData を組む。読み取りのみ。"""
    _require_bingads()
    from bingads.authorization import AuthorizationData, OAuthDesktopMobileAuthCodeGrant, OAuthWebAuthCodeGrant
    client_id = os.environ["MS_ADS_CLIENT_ID"].strip()
    client_secret = os.environ.get("MS_ADS_CLIENT_SECRET", "").strip()
    refresh_token = os.environ["MS_ADS_REFRESH_TOKEN"].strip()
    dev_token = os.environ["MS_ADS_DEVELOPER_TOKEN"].strip()
    customer_id = int(str(os.environ["MS_ADS_CUSTOMER_ID"]).replace("-", "").strip())
    acct = int(str(account_id).replace("-", "").strip())

    # client_secret があれば confidential(Web) フロー、無ければ public(Desktop/Mobile) フロー。
    if client_secret:
        redirect_uri = os.environ.get("MS_ADS_REDIRECT_URI", "https://login.microsoftonline.com/common/oauth2/nativeclient").strip()
        auth = OAuthWebAuthCodeGrant(client_id, client_secret, redirect_uri, env=ENVIRONMENT)
    else:
        auth = OAuthDesktopMobileAuthCodeGrant(client_id, env=ENVIRONMENT)
    # refresh_token から access/refresh を更新（ここでのみトークンを使う。保存しない）。
    auth.request_oauth_tokens_by_refresh_token(refresh_token)

    from bingads.authorization import AuthorizationData
    return AuthorizationData(account_id=acct, customer_id=customer_id,
                             developer_token=dev_token, authentication=auth)


def _reporting_service(auth_data):
    from bingads.service_client import ServiceClient
    return ServiceClient(service="ReportingService", version=13,
                         authorization_data=auth_data, environment=ENVIRONMENT)


def _mk_date(svc, d: datetime.date):
    dd = svc.factory.create("Date")
    dd.Day = d.day
    dd.Month = d.month
    dd.Year = d.year
    return dd


def _run_report(account_id: str, report_type: str, scope_type: str,
                columns: list[str], aggregation: str, start: str, end: str) -> list[dict]:
    """1レポートを submit→poll→download(CSV)→parse して行dictのリストで返す。読み取りのみ。

    report_type : 例 'CampaignPerformanceReport'（末尾 Request は付けない）
    scope_type  : 'AccountThroughCampaignReportScope' / 'AccountThroughAdGroupReportScope'
    columns     : 要求する列挙名（例 ['CampaignName','Spend','Impressions','Clicks','Conversions']）
    aggregation : 'Summary' / 'Daily' / 'Monthly' / 'HourOfDay' など
    """
    auth_data = _authorization_data(account_id)
    svc = _reporting_service(auth_data)
    from bingads.v13.reporting import ReportingServiceManager, ReportingDownloadParameters

    req = svc.factory.create(f"{report_type}Request")
    req.Format = "Csv"
    req.ReturnOnlyCompleteData = False
    req.Aggregation = aggregation
    req.Language = "English"  # CSVヘッダを英語で固定（COL_ALIASES は英名）

    # Scope（アカウント配下すべて）
    scope = svc.factory.create(scope_type)
    scope.AccountIds = {"long": [int(str(account_id).replace("-", ""))]}
    scope.Campaigns = None
    if hasattr(scope, "AdGroups"):
        scope.AdGroups = None
    req.Scope = scope

    # Time（カスタム期間）
    rtime = svc.factory.create("ReportTime")
    y0, m0, d0 = int(start[:4]), int(start[5:7]), int(start[8:10])
    y1, m1, d1 = int(end[:4]), int(end[5:7]), int(end[8:10])
    rtime.CustomDateRangeStart = _mk_date(svc, datetime.date(y0, m0, d0))
    rtime.CustomDateRangeEnd = _mk_date(svc, datetime.date(y1, m1, d1))
    rtime.PredefinedTime = None
    # 週/月の開始曜日（Monthly集計で使用）
    try:
        rtime.ReportTimeZone = None
    except Exception:
        pass
    req.Time = rtime

    # Columns
    cols = svc.factory.create(f"ArrayOf{report_type}Column")
    col_list = getattr(cols, f"{report_type}Column")
    for c in columns:
        col_list.append(c)
    req.Columns = cols

    # submit → poll → download（SDK が内包）。一時ディレクトリにCSVを落として読む。
    with tempfile.TemporaryDirectory() as tmp:
        params = ReportingDownloadParameters(
            report_request=req,
            result_file_directory=tmp,
            result_file_name=f"{report_type}.csv",
            overwrite_result_file=True,
            timeout_in_milliseconds=3600000,
        )
        mgr = ReportingServiceManager(authorization_data=auth_data, environment=ENVIRONMENT)
        result_path = mgr.download_file(params)
        if not result_path or not os.path.exists(result_path):
            return []  # データ無し（期間に実績が無い等）
        text = Path(result_path).read_text(encoding="utf-8-sig", errors="replace")
    return _parse_csv(text)


def _parse_csv(text: str) -> list[dict]:
    """Microsoftレポートの CSV を列別名で正規化して行dictへ。
    Microsoft の CSV は先頭に数行のメタ情報（Report Name 等）と末尾にコピーライト行が付く。
    既知の列名を含む行をヘッダとして検出し、その後のデータ行だけを読む。"""
    def keyname(header: str) -> str | None:
        h = (header or "").strip().strip('"')
        for k, aliases in COL_ALIASES.items():
            if h in aliases:
                return k
        return None

    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return []

    # ヘッダ行を探す（既知列を2つ以上含む最初の行）
    header_idx = -1
    for i, r in enumerate(rows):
        hits = sum(1 for c in r if keyname(c))
        if hits >= 2:
            header_idx = i
            break
    if header_idx < 0:
        return []

    header = rows[header_idx]
    idx = {}
    for i, col in enumerate(header):
        k = keyname(col)
        # date/month/hour は TimePeriod を共有するため、最初に確定したものを優先しない。
        # 呼び出し側の aggregation に応じて使う側で date/month/hour を読み分ける。
        if k and k not in idx:
            idx[k] = i

    def num(r, k):
        if k not in idx or idx[k] >= len(r):
            return 0.0
        v = (r[idx[k]] or "").replace(",", "").replace("¥", "").replace("%", "").strip()
        try:
            return float(v)
        except ValueError:
            return 0.0

    out = []
    for r in rows[header_idx + 1:]:
        if not r or all((c or "").strip() == "" for c in r):
            continue
        first = (r[0] or "").strip()
        if first.startswith("©") or "Microsoft Corporation" in first:
            break  # 末尾コピーライト行
        rec = {
            "imp": int(num(r, "imp")),
            "clk": int(num(r, "clk")),
            "cost": round(num(r, "cost")),
            "cv": round(num(r, "cv"), 1),
        }
        if "name" in idx and idx["name"] < len(r):
            rec["name"] = (r[idx["name"]] or "").strip().strip('"')
        if "ctype" in idx and idx["ctype"] < len(r):
            rec["ctype"] = (r[idx["ctype"]] or "").strip().strip('"')
        # 日付/月/時間帯（同じ TimePeriod 列を使う）
        tp_i = idx.get("date", idx.get("month", idx.get("hour")))
        if tp_i is not None and tp_i < len(r):
            raw = (r[tp_i] or "").strip()
            rec["_tp"] = raw
        for ek in ("quality", "avgcpc", "ctr"):
            if ek in idx and idx[ek] < len(r):
                v = (r[idx[ek]] or "").replace(",", "").replace("¥", "").replace("%", "").strip()
                try:
                    rec[ek] = float(v)
                except ValueError:
                    pass
        for tk in ("title", "desc"):
            if tk in idx and idx[tk] < len(r):
                rec[tk] = (r[idx[tk]] or "").strip().strip('"')
        out.append(rec)
    return out


def _norm_date(raw: str) -> str:
    """'2026/06/01' や '2026-06-01' → 'YYYY-MM-DD'。"""
    s = (raw or "").strip().replace("/", "-")
    parts = s.split("-")
    if len(parts) >= 3:
        return f"{int(parts[0]):04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"
    return s


def _norm_month(raw: str) -> str:
    """Monthly の TimePeriod（'2026/06/01' や '2026/06' 等）→ 'YYYY-MM'。"""
    s = (raw or "").strip().replace("/", "-")
    parts = s.split("-")
    if len(parts) >= 2:
        return f"{int(parts[0]):04d}-{int(parts[1]):02d}"
    return s


def _agg(rows: list[dict]) -> dict:
    """name をキーに cost/imp/clk/cv を合算。"""
    agg = {}
    for x in rows:
        n = x.get("name")
        if n is None or n == "":
            continue
        e = agg.setdefault(n, {"cost": 0, "imp": 0, "clk": 0, "cv": 0.0})
        e["cost"] += x["cost"]; e["imp"] += x["imp"]; e["clk"] += x["clk"]; e["cv"] += x["cv"]
    return agg


# ============ 公開関数（Yahoo fetch と同形） ============
def ms_campaigns(account_id: str, start: str, end: str) -> list[dict]:
    """キャンペーン別（期間合計）。type は CampaignType（Search→検索 / Audience→オーディエンス 等）。"""
    rows = _run_report(account_id, "CampaignPerformanceReport", "AccountThroughCampaignReportScope",
                       ["CampaignName", "CampaignType", "Spend", "Impressions", "Clicks", "Conversions"],
                       "Summary", start, end)
    _type_map = {"Search": "検索", "Audience": "オーディエンス", "Shopping": "ショッピング",
                 "DynamicSearchAds": "動的検索", "SearchAndContent": "検索＋コンテンツ"}
    agg = {}
    for x in rows:
        name = x.get("name")
        if not name:
            continue
        e = agg.setdefault(name, {"type": _type_map.get(x.get("ctype", ""), x.get("ctype", "") or ""),
                                  "cost": 0, "imp": 0, "clk": 0, "cv": 0.0})
        e["cost"] += x["cost"]; e["imp"] += x["imp"]; e["clk"] += x["clk"]; e["cv"] += x["cv"]
    return [{"name": n, "type": v["type"], "cost": round(v["cost"]), "impressions": v["imp"],
             "clicks": v["clk"], "conversions": round(v["cv"])} for n, v in agg.items()]


def ms_keywords(account_id: str, start: str, end: str, top: int = 30) -> list[dict]:
    """キーワード別（上位・費用順）。品質スコア/平均CPCつき。rank は Microsoft に相当列が無いため null。"""
    rows = _run_report(account_id, "KeywordPerformanceReport", "AccountThroughAdGroupReportScope",
                       ["Keyword", "Clicks", "Spend", "Conversions", "QualityScore", "AverageCpc", "Impressions"],
                       "Summary", start, end)
    agg = {}
    for x in rows:
        n = x.get("name")
        if not n:
            continue
        e = agg.setdefault(n, {"cost": 0, "clk": 0, "cv": 0.0, "quality": None, "avgcpc": None})
        e["cost"] += x["cost"]; e["clk"] += x["clk"]; e["cv"] += x["cv"]
        if x.get("quality") is not None:
            e["quality"] = x["quality"]
        if x.get("avgcpc") is not None:
            e["avgcpc"] = x["avgcpc"]
    out = []
    for n, v in agg.items():
        row = {"kw": n, "clicks": v["clk"], "cost": round(v["cost"]), "conversions": round(v["cv"]),
               "quality": round(v["quality"]) if v["quality"] is not None else None,
               "rank": None,
               "avgcpc": round(v["avgcpc"]) if v["avgcpc"] is not None else None}
        out.append(row)
    return sorted(out, key=lambda r: r["cost"], reverse=True)[:top]


def ms_queries(account_id: str, start: str, end: str, top: int = 30) -> list[dict]:
    """検索クエリ別（上位・費用順）。SearchQueryPerformanceReport。"""
    rows = _run_report(account_id, "SearchQueryPerformanceReport", "AccountThroughAdGroupReportScope",
                       ["SearchQuery", "Clicks", "Spend", "Impressions", "Conversions"],
                       "Summary", start, end)
    agg = {}
    for x in rows:
        n = x.get("name")
        if not n:
            continue
        e = agg.setdefault(n, {"cost": 0, "clk": 0})
        e["cost"] += x["cost"]; e["clk"] += x["clk"]
    out = [{"q": n, "clicks": v["clk"], "cost": round(v["cost"])} for n, v in agg.items()]
    return sorted(out, key=lambda r: r["cost"], reverse=True)[:top]


def ms_devices(account_id: str, start: str, end: str) -> list[dict]:
    """デバイス別（DeviceType列）。"""
    rows = _run_report(account_id, "CampaignPerformanceReport", "AccountThroughCampaignReportScope",
                       ["DeviceType", "Spend", "Impressions", "Clicks", "Conversions"],
                       "Summary", start, end)
    agg = _agg(rows)
    return [{"name": n, "cost": round(v["cost"]), "impressions": v["imp"], "clicks": v["clk"], "conversions": round(v["cv"])}
            for n, v in agg.items()]


def ms_daily(account_id: str, start: str, end: str) -> list[dict]:
    """日次（Aggregation=Daily）。TimePeriod を日付へ。"""
    rows = _run_report(account_id, "CampaignPerformanceReport", "AccountThroughCampaignReportScope",
                       ["TimePeriod", "Spend", "Impressions", "Clicks", "Conversions"],
                       "Daily", start, end)
    agg = {}
    for x in rows:
        tp = x.get("_tp")
        if not tp:
            continue
        d = _norm_date(tp)
        e = agg.setdefault(d, {"cost": 0, "imp": 0, "clk": 0, "cv": 0.0})
        e["cost"] += x["cost"]; e["imp"] += x["imp"]; e["clk"] += x["clk"]; e["cv"] += x["cv"]
    return [{"date": d, "imp": v["imp"], "clk": v["clk"], "cost": round(v["cost"]), "cv": round(v["cv"], 1)}
            for d, v in sorted(agg.items())]


def ms_monthly(account_id: str, start: str, end: str) -> list[dict]:
    """月次（Aggregation=Monthly）。直近24ヶ月は呼び出し側で期間指定。"""
    rows = _run_report(account_id, "CampaignPerformanceReport", "AccountThroughCampaignReportScope",
                       ["TimePeriod", "Spend", "Impressions", "Clicks", "Conversions"],
                       "Monthly", start, end)
    agg = {}
    for x in rows:
        tp = x.get("_tp")
        if not tp:
            continue
        mo = _norm_month(tp)
        e = agg.setdefault(mo, {"cost": 0, "imp": 0, "clk": 0, "cv": 0.0})
        e["cost"] += x["cost"]; e["imp"] += x["imp"]; e["clk"] += x["clk"]; e["cv"] += x["cv"]
    out = []
    for mo, v in sorted(agg.items()):
        cv = round(v["cv"], 1)
        out.append({"month": mo, "imp": v["imp"], "clk": v["clk"], "cost": round(v["cost"]),
                    "cv": cv, "cpa": round(v["cost"] / cv) if cv else None})
    return out


def ms_ages(account_id: str, start: str, end: str) -> list[dict]:
    """年齢層別（AgeGenderAudienceReport の AgeGroup）。"""
    rows = _run_report(account_id, "AgeGenderAudienceReport", "AccountThroughAdGroupReportScope",
                       ["AgeGroup", "Impressions", "Clicks", "Spend", "Conversions"],
                       "Summary", start, end)
    agg = _agg(rows)
    return [{"name": n, "cost": round(v["cost"]), "impressions": v["imp"], "clicks": v["clk"], "conversions": round(v["cv"])}
            for n, v in agg.items()]


def ms_genders(account_id: str, start: str, end: str) -> list[dict]:
    """性別別（AgeGenderAudienceReport の Gender）。"""
    rows = _run_report(account_id, "AgeGenderAudienceReport", "AccountThroughAdGroupReportScope",
                       ["Gender", "Impressions", "Clicks", "Spend", "Conversions"],
                       "Summary", start, end)
    agg = _agg(rows)
    return [{"name": n, "cost": round(v["cost"]), "impressions": v["imp"], "clicks": v["clk"], "conversions": round(v["cv"])}
            for n, v in agg.items()]


def ms_regions(account_id: str, start: str, end: str) -> list[dict]:
    """地域別（GeographicPerformance の State/都道府県相当）。"""
    rows = _run_report(account_id, "GeographicPerformanceReport", "AccountThroughAdGroupReportScope",
                       ["State", "Spend", "Impressions", "Clicks", "Conversions"],
                       "Summary", start, end)
    agg = _agg(rows)
    return [{"name": n, "cost": round(v["cost"]), "impressions": v["imp"], "clicks": v["clk"], "conversions": round(v["cv"])}
            for n, v in agg.items()]


def ms_adgroups(account_id: str, start: str, end: str) -> list[dict]:
    """広告グループ別（AdGroupPerformance）。"""
    rows = _run_report(account_id, "AdGroupPerformanceReport", "AccountThroughAdGroupReportScope",
                       ["AdGroupName", "Spend", "Impressions", "Clicks", "Conversions"],
                       "Summary", start, end)
    agg = _agg(rows)
    return [{"name": n, "cost": round(v["cost"]), "impressions": v["imp"], "clicks": v["clk"], "conversions": round(v["cv"])}
            for n, v in agg.items()]


def ms_ads(account_id: str, start: str, end: str, top: int = 20) -> list[dict]:
    """広告別（AdPerformance）。見出し/説明文つき・費用順。"""
    rows = _run_report(account_id, "AdPerformanceReport", "AccountThroughAdGroupReportScope",
                       ["AdTitle", "AdDescription", "Spend", "Impressions", "Clicks", "Conversions"],
                       "Summary", start, end)
    agg = {}
    for x in rows:
        title = x.get("title", "")
        key = title or x.get("name", "")
        if not key:
            continue
        e = agg.setdefault(key, {"title": title, "desc": x.get("desc", ""), "cost": 0, "imp": 0, "clk": 0, "cv": 0.0})
        e["cost"] += x["cost"]; e["imp"] += x["imp"]; e["clk"] += x["clk"]; e["cv"] += x["cv"]
        if not e["title"] and title:
            e["title"] = title
        if not e["desc"] and x.get("desc"):
            e["desc"] = x["desc"]
    out = [{"name": n, "title": v["title"], "desc": v["desc"], "cost": round(v["cost"]),
            "impressions": v["imp"], "clicks": v["clk"], "conversions": round(v["cv"])} for n, v in agg.items()]
    return sorted(out, key=lambda r: r["cost"], reverse=True)[:top]


def ms_hourly(account_id: str, start: str, end: str) -> list[dict]:
    """時間帯別（Aggregation=HourOfDay）。TimePeriod が 0〜23 の時。"""
    rows = _run_report(account_id, "CampaignPerformanceReport", "AccountThroughCampaignReportScope",
                       ["TimePeriod", "Spend", "Impressions", "Clicks", "Conversions"],
                       "HourOfDay", start, end)
    agg = {}
    for x in rows:
        tp = (x.get("_tp") or "").strip()
        try:
            h = int(float(tp))
        except ValueError:
            continue
        e = agg.setdefault(h, {"cost": 0, "imp": 0, "clk": 0, "cv": 0.0})
        e["cost"] += x["cost"]; e["imp"] += x["imp"]; e["clk"] += x["clk"]; e["cv"] += x["cv"]
    return [{"h": h, "cost": round(v["cost"]), "clk": v["clk"], "cv": round(v["cv"], 1), "imp": v["imp"]}
            for h, v in sorted(agg.items())]


def main():
    """単体疎通確認: 接続情報の有無と、既定アカウントの直近7日キャンペーンを表示（読み取りのみ）。"""
    load_env()
    if not ms_enabled():
        print("Microsoft接続情報が未設定です（MS_ADS_DEVELOPER_TOKEN / _CLIENT_ID / _REFRESH_TOKEN / _CUSTOMER_ID）。")
        print("→ scripts/microsoft_generate_refresh_token.py で refresh_token を取得し .env に設定してください。")
        return 2
    acct = os.environ.get("MS_ADS_ACCOUNT_ID", "").strip()
    if not acct:
        print("MS_ADS_ACCOUNT_ID が未設定です（疎通確認対象のアカウントIDを .env に設定してください）。")
        return 2
    end = datetime.date.today().isoformat()
    start = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
    print(f"アカウント {acct} の {start}〜{end} のキャンペーンを取得中…")
    try:
        c = ms_campaigns(acct, start, end)
        print("結果:", json.dumps(c, ensure_ascii=False)[:500])
    except Exception as e:
        print(f"取得失敗: {type(e).__name__}: {str(e)[:200]}", file=sys.stderr)
        print("→ bingadsの導入・列挙名・レポート種別をリファレンスで確認してください。", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
