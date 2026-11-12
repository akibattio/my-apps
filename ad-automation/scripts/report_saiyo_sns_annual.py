#!/usr/bin/env python3
"""採用SNS 通年 分析・改善レポート HTML 生成（月次推移グラフ統合版）。

bespoke: 自社の採用SNS広告（1アカウント内の数キャンペーン）専用。所見/提案/除外KW候補・数値・対象の名前は
report_content.json（Git管理外）に置く。他アカウントへ流用する場合は report_content.json を書き換えること。

データ配置（既定 data/saiyo_sns/ ・第1引数でディレクトリ指定可）:
  report_content.json … 見出し・所見・提案・数値（見本: data/samples/saiyo_sns/report_content.example.json）
  mmn_pmax.json    … scripts/google_pmax_creatives.py <customer_id> <out> <開始日> <終了日>
  mmn_monthly.json … 対象キャンペーン（名前に report_content.json の campaign_match を含む）の月次(合算 monthly[]＋per_campaign{})
使い方: python3 scripts/report_saiyo_sns_annual.py [data_dir]  → out/google_kaizen_saiyo_sns.html
"""
import sys, json, html
from pathlib import Path

S = sys.argv[1] if len(sys.argv) > 1 else "data/saiyo_sns"
PMAX = json.loads(Path(f"{S}/mmn_pmax.json").read_text(encoding="utf-8"))
MON = json.loads(Path(f"{S}/mmn_monthly.json").read_text(encoding="utf-8"))
M = MON["monthly"]; PC = MON["per_campaign"]

# 社名・ID・数値・所見文は Git に入らない {S}/report_content.json から読む（公開リポジトリに実データを置かない）。
# 項目の見本（値は架空）: data/samples/saiyo_sns/report_content.example.json
from types import SimpleNamespace
C = json.loads(Path(f"{S}/report_content.json").read_text(encoding="utf-8"))
K = SimpleNamespace(**C)  # 本文（f-string）から {K.項目} で参照
OUT = Path("out/google_kaizen_saiyo_sns.html")

def yen(n): return "¥"+format(round(n), ",")
def num(n): return format(round(n), ",")

# 配信別実績（2026 YTD・採用SNS抽出）
ROWS = C["rows"]
TOT = C["total"]

def perf_rows():
    r = []
    for n, c, i, k, cv, cpa in ROWS:
        r.append(f"<tr><td class='kw'>{n}</td><td class='num'>{yen(c)}</td><td class='num'>{num(i)}</td>"
                 f"<td class='num'>{num(k)}</td><td class='num'>{cv}</td>"
                 f"<td class='num'>{yen(cpa) if cpa else '—'}</td></tr>")
    n, c, i, k, cv, cpa = TOT
    r.append(f"<tr class='tot'><td class='kw'>{n}</td><td class='num'>{yen(c)}</td><td class='num'>{num(i)}</td>"
             f"<td class='num'>{num(k)}</td><td class='num'>{cv}</td><td class='num'>{yen(cpa)}</td></tr>")
    return "\n".join(r)

# 目標CPA判定（担当合意値：有効問い合わせ ¥20,000/件）
TARGET_CPA = C["target_cpa"]
MBUDGET = C["monthly_budget"]  # 同予算の月次目安（直近ペース）
bym = {d["m"]: d for d in M}
def target_section():
    may, jun = bym.get(C["recent_months"][0]), bym.get(C["recent_months"][1])
    rc = (may["cost"] + jun["cost"]) if may and jun else 0
    rv = (may["cv"] + jun["cv"]) if may and jun else 0
    recent = rc/rv if rv else None
    jcpa = jun["cost"]/jun["cv"] if jun and jun["cv"] else None
    scen = [("通年(YTD)平均", C["ytd_cpa"], None), (C["recent_label"], recent, None),
            ("6月単月", jcpa, None), ("改善後(推定・保守〜楽観)", None, C["improved_range"])]
    rows = []
    for name, cp, txt in scen:
        if txt:
            disp, ok = txt, True
        else:
            disp = yen(cp); ok = cp is not None and cp <= TARGET_CPA
        diff = "" if txt or cp is None else f"{'+' if cp>TARGET_CPA else '−'}{abs(round((cp/TARGET_CPA-1)*100))}%"
        pill = "<span class='pill p-pass'>達成</span>" if ok else "<span class='pill p-fail'>未達</span>"
        rows.append(f"<tr><td class='kw'>{name}</td><td class='num'>{disp}</td><td class='num'>{diff}</td><td>{pill}</td></tr>")
    be_cv = MBUDGET / TARGET_CPA
    be_valid = (recent/TARGET_CPA*100) if recent else None
    cards = (f"<div class='cards'>"
             f"<div class='card'><div class='lab'>目標CPA（合意値）</div><div class='val num'>{K.card_target_val}</div></div>"
             f"<div class='card'><div class='lab'>直近実績CPA</div><div class='val num'>{yen(recent)}</div><div class='sub'>{K.card_recent_sub}</div></div>"
             f"<div class='card'><div class='lab'>損益分岐CV</div><div class='val num'>{be_cv:.1f}</div><div class='sub'>{K.card_breakeven_sub}</div></div>"
             f"<div class='card'><div class='lab'>必要な有効率</div><div class='val num'>{be_valid:.0f}%</div><div class='sub'>記録CVのうち有効なら達成</div></div></div>")
    tbl = ("<div class='tbl'><table><thead><tr><th>局面</th><th>CPA</th><th>対目標</th><th>判定</th></tr></thead><tbody>"
           + "\n".join(rows) + "</tbody></table></div>")
    return cards + tbl

# 月次推移
CAMPS = [("検索", "#1E6B77"), ("デマンドジェネ", "#C98A3B"), ("P-MAX", "#4E9A6B")]
months = [x["m"] for x in M]
stacked = {mo: {c: PC.get(c, {}).get(mo, 0) for c, _ in CAMPS} for mo in months}
METRICS = [("cost", "費用", "yen"), ("imp", "表示回数", "k"), ("clk", "クリック", "num"),
           ("ctr", "CTR", "pct"), ("cpc", "平均CPC", "yen"), ("cv", "CV", "num"), ("cpa", "CPA", "yen")]
def mini_cards():
    return "\n".join(
        f'<div class="mini"><div class="top"><h4>{name}</h4><span class="last" id="l_{k}"></span></div>'
        f'<canvas id="c_{k}" width="620" height="200"></canvas></div>' for k, name, _ in METRICS)

# 要対応
ISSUES = C["issues"]
def issues_html():
    SEV = {"fail": ("#AE4A26", "#FBECE4", "重度"), "warn": ("#B7791F", "#FBF1DD", "注意")}
    b = []
    for sev, title, appr, fact, cause, act in ISSUES:
        c, bg, lab = SEV[sev]
        b.append(f"<div class='issue'><div class='issue-h'><span class='pill' style='color:{c};background:{bg}'>{lab}</span>"
                 f"<b>{title}</b><span class='appr'>承認：{appr}</span></div>"
                 f"<div class='il'><span class='ik'>事実</span>{fact}</div>"
                 f"<div class='il'><span class='ik'>原因</span>{cause}</div>"
                 f"<div class='il'><span class='ik'>提案</span>{act}</div></div>")
    return "\n".join(b)

PROPS = C["props"]
def props_html():
    return "\n".join(f"<tr><td class='pid'>{p}</td><td class='kw'>{n}</td><td>{html.escape(ba)}</td><td class='ap'>{ap}</td></tr>"
                     for p, n, ba, ap in PROPS)

EXCLUDE_SAFE = C["exclude_safe"]
EXCLUDE_CHECK = C["exclude_check"]
def chips(xs, cls): return "".join(f"<span class='chip {cls}'>{html.escape(x)}</span>" for x in xs)

def pmax_html():
    g = next((x for x in PMAX["asset_groups"] if C["campaign_match"] in x["name"]), None)
    if not g: return ""
    STR = {"EXCELLENT": ("#3C7A52", "優良"), "GOOD": ("#3C7A52", "良好"), "AVERAGE": ("#B7791F", "平均"),
           "POOR": ("#AE4A26", "低い"), "UNKNOWN": ("#AE4A26", "未評価/不足"), "PENDING": ("#8b95a3", "評価中")}
    sc, sl = STR.get(g["ad_strength"], ("#8b95a3", g["ad_strength"]))
    ST = {"ok": ("○", "cov ok"), "low": ("△", "cov low"), "none": ("✗", "cov none")}
    cov = "".join(f"<span class='{ST[c['state']][1]}'>{ST[c['state']][0]} {c['jp']} {c['have']}/{c['rec']}</span>" for c in g["coverage"])
    imgs = []
    for ft in ["MARKETING_IMAGE", "SQUARE_MARKETING_IMAGE", "PORTRAIT_MARKETING_IMAGE", "AD_IMAGE"]:
        for a in g["assets"].get(ft, []):
            src = a.get("data") or a.get("url")
            if src: imgs.append(f"<a href='{a.get('url') or src}' target='_blank'><img src='{src}' alt='{ft}'></a>")
    gal = f"<div class='gal'>{''.join(imgs)}</div>" if imgs else "<p class='caption'>表示可能な画像素材なし。</p>"
    def txts(ft, lbl):
        xs = [html.escape(a["text"]) for a in g["assets"].get(ft, []) if a.get("text")]
        return "" if not xs else f"<div class='txtcol'><h5>{lbl}（{len(xs)}）</h5><ul>" + "".join(f"<li>{t}</li>" for t in xs) + "</ul></div>"
    texts = txts("HEADLINE", "見出し") + txts("LONG_HEADLINE", "長い見出し") + txts("DESCRIPTION", "説明文")
    cpa = "¥"+format(g["cpa"], ",") if g["cpa"] else "—"
    return (f"<div class='agbox'><div class='ag-head'><div><b>{html.escape(g['name'])}</b></div>"
            f"<span class='ag-str' style='color:{sc};border-color:{sc}'>広告の有効性：{sl}</span></div>"
            f"<div class='ag-met'><span>費用 <b>{yen(g['cost'])}</b></span><span>CV <b>{g['cv']:.0f}</b></span>"
            f"<span>CPA <b>{cpa}</b></span></div><div class='cov-wrap'>{cov}</div>{gal}"
            f"<div class='txts'>{texts}</div></div>")

# 着地ページ(LPO) 所見（report_content.json の lpo_url を実取得して評価）
LPO_URL = C["lpo_url"]
LPO_SCORES = C["lpo_scores"]
LPO_WINS = C["lpo_wins"]
def lpo_section():
    rows = []
    for name, sc, note in LPO_SCORES:
        if sc is None:
            bar = "<span class='lpo-track'></span>"; valv = "—"
        else:
            col = "#3C7A52" if sc >= 75 else ("#B7791F" if sc >= 60 else "#AE4A26")
            bar = f"<span class='lpo-track'><span class='lpo-fill' style='width:{sc}%;background:{col}'></span></span>"; valv = str(sc)
        rows.append(f"<div class='lpo-row'><span class='lpo-lab'>{name}</span>{bar}<span class='lpo-val'>{valv}</span></div>"
                    f"<div class='lpo-note'>{html.escape(note)}</div>")
    wins = "".join(f"<tr><td class='pid'>{p}</td><td>{html.escape(a)}</td><td class='ap'>{html.escape(e)}</td></tr>" for p, a, e in LPO_WINS)
    key = C["lpo_key_html"]
    return (f"<p class='caption' style='margin-top:0'>対象LP：<a href='{LPO_URL}' target='_blank'>{LPO_URL}</a>（実取得して評価）</p>"
            f"<div class='lpo'>{''.join(rows)}</div>{key}"
            f"<div class='tbl' style='margin-top:12px'><table><thead><tr><th>優先</th><th>クイックウィン（下書き）</th><th>期待効果</th></tr></thead><tbody>{wins}</tbody></table></div>")

CSS = """
:root{--ink:#18222E;--slate:#586374;--muted:#8b95a3;--line:#E5E8EC;--line-soft:#EEF1F4;--paper:#FBFBFC;--panel:#FFFFFF;--accent:#1E6B77;--accent-soft:#E7F0F1;--accent-ink:#134851;--warn:#AE4A26;--warn-soft:#FBECE4;--ok:#3C7A52;--jp:"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Noto Sans JP","Meiryo",sans-serif;}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--jp);line-height:1.75;font-size:15px}
.sheet{max-width:900px;margin:0 auto;padding:52px 40px 72px}.num{font-variant-numeric:tabular-nums}
.eyebrow{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--accent-ink);font-weight:700}
h1{font-size:26px;margin:.35em 0 .5em}
.draft{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--warn);background:var(--warn-soft);border:1px solid #EAC7B4;padding:3px 10px;border-radius:999px}
.draft::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--warn)}
.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:2px 28px;margin:20px 0 0;border-top:1px solid var(--line);padding-top:16px}
.meta div{display:flex;gap:10px;padding:4px 0;font-size:12.5px}.meta dt{color:var(--muted);min-width:64px}.meta dd{margin:0;color:var(--slate)}
section{margin-top:40px}.sec-label{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--accent-ink);font-weight:700;display:flex;align-items:center;gap:10px;margin-bottom:14px}
.sec-label::after{content:"";height:1px;flex:1;background:var(--line)}
.summary{background:var(--accent-soft);border:1px solid #CFE1E3;border-radius:12px;padding:16px 18px;font-size:14px;color:var(--accent-ink);line-height:1.9}
.lpo{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 18px}
.lpo-row{display:grid;grid-template-columns:118px 1fr 34px;align-items:center;gap:12px;margin-top:10px}
.lpo-lab{font-size:12.5px;font-weight:600;color:var(--ink)}
.lpo-track{background:var(--line-soft);border-radius:6px;height:10px;overflow:hidden}
.lpo-fill{display:block;height:100%;border-radius:6px}
.lpo-val{font-size:12.5px;font-weight:700;text-align:right;color:var(--ink)}
.lpo-note{font-size:11.5px;color:var(--muted);margin:3px 0 0 130px;line-height:1.6}
.lpo-key{background:var(--warn-soft);border:1px solid #EAC7B4;border-radius:10px;padding:12px 15px;margin-top:12px;font-size:13px;color:var(--ink);line-height:1.8}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:14px 15px}
.card .lab{font-size:11.5px;color:var(--muted)}.card .val{font-size:22px;font-weight:700;margin-top:3px}.card .sub{font-size:11px;color:var(--muted);margin-top:3px}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
table{border-collapse:collapse;width:100%;font-size:13px;min-width:560px}
th{font-size:11px;color:var(--muted);font-weight:600;text-align:right;padding:10px;border-bottom:1px solid var(--line);background:#FAFBFC;white-space:nowrap}th:first-child{text-align:left}
td{padding:9px 10px;border-bottom:1px solid var(--line-soft);text-align:right;color:var(--slate)}td.kw{text-align:left;color:var(--ink);font-weight:600}td.pid{color:var(--accent);font-weight:800;text-align:left}td.ap{text-align:left;font-size:12px;white-space:nowrap}td:nth-child(3){text-align:left;color:var(--slate)}
tr.tot td{font-weight:700;color:var(--ink);border-top:2px solid var(--line);background:#FAFBFC}
tr:last-child td{border-bottom:none}
.grid-sm{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.mini{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:13px 14px 8px}
.mini .top{display:flex;justify-content:space-between;align-items:baseline}.mini h4{font-size:12.5px;margin:0;font-weight:600}
.mini .last{font-size:13px;font-weight:700;color:var(--accent-ink)}.mini canvas{width:100%;height:104px;margin-top:6px;display:block}
.wide{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-top:14px}
.wide canvas{width:100%;height:260px;display:block}
.legend{display:flex;gap:16px;margin:0 0 10px;font-size:12px;color:var(--slate)}.legend span{display:inline-flex;align-items:center;gap:6px}.legend i{width:12px;height:12px;border-radius:3px}
.issue{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:10px}
.issue-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}.issue-h b{font-size:14.5px;color:var(--ink)}
.pill{font-size:10.5px;font-weight:800;padding:2px 9px;border-radius:6px;white-space:nowrap}
.appr{margin-left:auto;font-size:11px;font-weight:700;color:var(--slate);background:var(--line-soft);border-radius:6px;padding:2px 9px}
.il{display:flex;gap:8px;font-size:13px;color:var(--slate);margin-top:3px;line-height:1.7}
.ik{flex:none;width:34px;font-size:10.5px;font-weight:800;color:var(--accent-ink);padding-top:3px}
.chipwrap{display:flex;flex-wrap:wrap;gap:7px;margin:6px 0 2px}
.chip{font-size:12px;font-weight:600;border-radius:7px;padding:3px 10px}
.chip.safe{color:var(--warn);background:var(--warn-soft)}.chip.check{color:#B7791F;background:#FBF1DD}
.agbox{border:1px solid var(--line);border-radius:12px;padding:16px 18px;background:var(--panel)}
.ag-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.ag-head b{font-size:15px}
.ag-str{font-size:11.5px;font-weight:700;border:1px solid;border-radius:999px;padding:2px 10px;white-space:nowrap}
.ag-met{display:flex;flex-wrap:wrap;gap:6px 18px;margin:11px 0;font-size:12.5px;color:var(--slate)}.ag-met b{color:var(--ink);font-size:14px}
.cov-wrap{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 2px}.cov{font-size:11px;font-weight:700;border-radius:6px;padding:2px 8px}
.cov.ok{color:var(--ok);background:#E9F2EC}.cov.low{color:#B7791F;background:#FBF1DD}.cov.none{color:var(--warn);background:var(--warn-soft)}
.gal{display:flex;flex-wrap:wrap;gap:8px;margin:13px 0 4px}.gal img{height:78px;width:auto;border-radius:8px;border:1px solid var(--line);object-fit:cover;display:block}.gal a{line-height:0}
.txts{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:12px;border-top:1px solid var(--line-soft);padding-top:12px}
.txtcol h5{font-size:11.5px;margin:0 0 5px;color:var(--accent-ink);font-weight:700}.txtcol ul{margin:0;padding-left:16px}.txtcol li{font-size:12px;color:var(--slate);margin-bottom:3px;line-height:1.5}
.caption{font-size:12px;color:var(--muted);margin:12px 2px 0;line-height:1.7}
footer{margin-top:44px;padding-top:16px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}
@media(max-width:600px){.sheet{padding:34px 18px 52px}.cards{grid-template-columns:1fr 1fr}.meta,.txts,.grid-sm{grid-template-columns:1fr}}
"""

def meta_html():
    return "\n    ".join(f"<div><dt>{dt}</dt><dd>{dd}</dd></div>" for dt, dd in C["meta"])

def cards_html():
    return "".join(f'\n    <div class="card"><div class="lab">{lab}</div><div class="val num">{v}</div><div class="sub">{sub}</div></div>'
                   for lab, v, sub in C["cards"]) + "\n"

HTML = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{K.title}</title>
<style>{CSS}</style></head><body><main class="sheet">
<header>
  <div class="eyebrow">{K.eyebrow}</div>
  <h1>{K.title}</h1>
  <span class="draft">下書き（未適用）・ 実データ（Google Ads API）</span>
  <dl class="meta">
    {meta_html()}
  </dl>
</header>

<section>
  <div class="sec-label">01 — サマリ</div>
  <div class="summary">{K.summary_html}</div>
  <div class="cards">{cards_html()}  </div>
</section>

<section>
  <div class="sec-label">02 — 配信別実績（採用SNS抽出）</div>
  <div class="tbl"><table>
    <thead><tr><th>キャンペーン</th><th>費用</th><th>表示</th><th>クリック</th><th>CV</th><th>CPA</th></tr></thead>
    <tbody>{perf_rows()}</tbody></table></div>
  <p class="caption">{K.caption_perf}</p>
</section>

<section>
  <div class="sec-label">03 — {K.label_target}</div>
  {target_section()}
  <p class="caption">{K.caption_target_html}</p>
</section>

<section>
  <div class="sec-label">04 — {K.label_monthly}</div>
  <div class="grid-sm">{mini_cards()}</div>
  <div class="wide">
    <div class="legend">{''.join(f'<span><i style="background:{c}"></i>{n}</span>' for n,c in CAMPS)}</div>
    <canvas id="stack" width="860" height="360"></canvas>
  </div>
  <p class="caption">{K.caption_monthly}</p>
</section>

<section>
  <div class="sec-label">05 — 要対応（重要度順）</div>
  {issues_html()}
</section>

<section>
  <div class="sec-label">06 — 提案（下書き・すべて未適用）</div>
  <div class="tbl"><table>
    <thead><tr><th>#</th><th>提案</th><th>変更前 → 変更後</th><th>承認</th></tr></thead>
    <tbody>{props_html()}</tbody></table></div>
</section>

<section>
  <div class="sec-label">07 — 除外キーワード候補（下書き）</div>
  <p class="caption" style="margin-top:0">競合ブランド名は無価値のため<b>除外推奨（安全）</b>：</p>
  <div class="chipwrap">{chips(EXCLUDE_SAFE, "safe")}</div>
  <p class="caption">以下は<b>要確認</b>（御社が該当サービスを提供するか等の業務判断が必要・§0.4）：</p>
  <div class="chipwrap">{chips(EXCLUDE_CHECK, "check")}</div>
</section>

<section>
  <div class="sec-label">08 — P-MAX クリエイティブ 現状</div>
  {pmax_html()}
  <p class="caption">稼働アセットグループの実績・素材充足（○充足／△本数不足／✗未設定）と配信素材。<b>P-MAXは1素材ごとのCV/CPAをGoogleが公開していない</b>ため素材単位は有効性＋本数で評価。動画・ロゴ・縦型画像が未設定で、有効性が「未評価/不足」。</p>
</section>

<section>
  <div class="sec-label">09 — 着地ページ（LPO）</div>
  {lpo_section()}
  <p class="caption">着地ページを実取得しCRO観点で評価（ads-landing 手法）。ヘルススコアは相対目安。<b>表示速度・モバイルのタップ領域は未計測</b>（PageSpeed Insights/実機推奨・推測で断定しない）。LP改修は自社サイト側の変更のため<b>実装は担当承認後</b>（本内容は下書き）。</p>
</section>

<section>
  <div class="sec-label">10 — 注記</div>
  <p class="caption">{K.caption_notes_html}</p>
</section>

<footer><span>ソフトコミュニケーションズ ／ 広告運用 半自動化</span><span class="num">{K.footer_date}</span></footer>
</main>
<script>
const M={json.dumps(M, ensure_ascii=False)};
const METRICS={json.dumps([{"k":k,"f":f} for k,_,f in METRICS], ensure_ascii=False)};
const fmt={{yen:v=>'¥'+Math.round(v).toLocaleString(),k:v=>(v/1000).toFixed(v>=10000?0:1)+'k',num:v=>Math.round(v).toLocaleString(),pct:v=>v.toFixed(2)+'%'}};
const afmt={{yen:v=>v>=1000?'¥'+(v/1000).toFixed(0)+'k':'¥'+Math.round(v),k:v=>(v/1000).toFixed(0)+'k',num:v=>v>=1000?(v/1000).toFixed(0)+'k':''+Math.round(v),pct:v=>v.toFixed(1)+'%'}};
METRICS.forEach(mt=>{{
  const cv=document.getElementById('c_'+mt.k); if(!cv)return; const ctx=cv.getContext('2d');
  const W=cv.width,H=cv.height,padL=52,padR=10,padT=10,padB=22,plotW=W-padL-padR,plotH=H-padT-padB;
  const vals=M.map(d=>d[mt.k]); let mn=Math.min(...vals,0),mx=Math.max(...vals); if(mx===mn)mx=mn+1;
  const n=vals.length,X=i=>padL+plotW*(n<=1?0.5:i/(n-1)),Y=v=>padT+plotH*(1-(v-mn)/(mx-mn));
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='#EEF1F4';ctx.lineWidth=1;ctx.fillStyle='#aab2bd';ctx.font='15px sans-serif';ctx.textAlign='right';
  for(let g=0;g<=2;g++){{const yy=padT+plotH*g/2, vv=mx-(mx-mn)*g/2;ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(W-padR,yy);ctx.stroke();ctx.fillText(afmt[mt.f](vv),padL-5,yy+5);}}
  ctx.beginPath();ctx.moveTo(X(0),H-padB);vals.forEach((v,i)=>ctx.lineTo(X(i),Y(v)));ctx.lineTo(X(n-1),H-padB);ctx.closePath();ctx.fillStyle='rgba(30,107,119,.09)';ctx.fill();
  ctx.beginPath();vals.forEach((v,i)=>{{const x=X(i),y=Y(v);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}});ctx.strokeStyle='#1E6B77';ctx.lineWidth=2.6;ctx.lineJoin='round';ctx.stroke();
  ctx.fillStyle='#1E6B77';vals.forEach((v,i)=>{{ctx.beginPath();ctx.arc(X(i),Y(v),3,0,7);ctx.fill();}});
  ctx.fillStyle='#aab2bd';ctx.font='15px sans-serif';ctx.textAlign='center';M.forEach((d,i)=>ctx.fillText(d.m.slice(5)+'月',X(i),H-5));
  const last=M[M.length-1]; document.getElementById('l_'+mt.k).textContent=fmt[mt.f](last[mt.k]);
}});
(function(){{
  const CAMPS={json.dumps(CAMPS, ensure_ascii=False)};
  const STK={json.dumps(stacked, ensure_ascii=False)};
  const mos={json.dumps(months, ensure_ascii=False)};
  const cv=document.getElementById('stack'); const ctx=cv.getContext('2d');
  const W=cv.width,H=cv.height,padL=64,padR=14,padT=12,padB=28,plotW=W-padL-padR,plotH=H-padT-padB;
  const totals=mos.map(mo=>CAMPS.reduce((s,c)=>s+(STK[mo][c[0]]||0),0)); let mx=Math.max(...totals,1);
  const Y=v=>padT+plotH*(1-v/mx); ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='#EEF1F4';ctx.lineWidth=1;ctx.fillStyle='#aab2bd';ctx.font='14px sans-serif';ctx.textAlign='right';
  for(let g=0;g<=4;g++){{const yy=padT+plotH*g/4, vv=mx*(1-g/4);ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(W-padR,yy);ctx.stroke();ctx.fillText('¥'+(vv/1000).toFixed(0)+'k',padL-6,yy+5);}}
  const bw=plotW/mos.length*0.56;
  mos.forEach((mo,i)=>{{
    const x=padL+plotW*(i+0.5)/mos.length-bw/2; let yTop=H-padB;
    CAMPS.forEach(c=>{{const v=STK[mo][c[0]]||0; if(v<=0)return; const h=plotH*v/mx; ctx.fillStyle=c[1]; ctx.fillRect(x,yTop-h,bw,h); yTop-=h;}});
    ctx.fillStyle='#586374';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText(mo.slice(5)+'月',x+bw/2,H-9);
    const t=totals[i]; if(t>0){{ctx.fillStyle='#18222E';ctx.font='bold 13px sans-serif';ctx.fillText('¥'+(t/1000).toFixed(0)+'k',x+bw/2,Y(t)-6);}}
  }});
}})();
</script></body></html>"""
OUT.write_text(HTML, encoding="utf-8")
print("生成:", OUT)
