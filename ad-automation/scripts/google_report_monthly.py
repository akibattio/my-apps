#!/usr/bin/env python3
"""Google 月次報告HTML（先月）：当月KPI＋前月比＋前年同月比、当月キーワード、直近6ヶ月ミニ推移。
使い方: python3 scripts/google_report_monthly.py <monthly.json> <kw_month.json> <account_label> <YYYY-MM> <out.html>"""
import sys, json, html
from pathlib import Path

mon = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))["monthly"]
KW = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
label = sys.argv[3]; target = sys.argv[4]; out = Path(sys.argv[5])
CH = json.loads(Path(sys.argv[6]).read_text(encoding="utf-8")) if len(sys.argv) > 6 else None
AUD = json.loads(Path(sys.argv[7]).read_text(encoding="utf-8")) if len(sys.argv) > 7 else None
PMAX = json.loads(Path(sys.argv[8]).read_text(encoding="utf-8")) if len(sys.argv) > 8 else None

y, m = int(target[:4]), int(target[5:7])
prev = f"{y-(m==1):04d}-{(12 if m==1 else m-1):02d}"
prevY = f"{y-1:04d}-{m:02d}"
bym = {d["m"]: d for d in mon}
def cpa(d): return (d["cost"]/d["cv"]) if d and d["cv"] else None
def get(mm): return bym.get(mm)
C, P, Y = get(target), get(prev), get(prevY)
if not C: print("対象月データなし:", target); sys.exit(1)

def yen(n): return "¥"+format(round(n), ",") if n is not None else "—"
def num(n): return format(round(n), ",") if n is not None else "—"
def delta(cur, base, good):
    if base in (None, 0) or cur is None: return ("—", "#64748b")
    p = (cur/base-1)*100; up = p >= 0
    col = "#64748b" if good == 0 else ("#3C7A52" if (up if good == 1 else not up) else "#AE4A26")
    return (("↑+" if up else "↓")+str(round(abs(p)))+"%", col)

MET = [("費用","cost",yen,0),("表示回数","imp",num,1),("クリック","clk",num,1),
       ("CTR","ctr",lambda v:f"{v:.2f}%",1),("平均CPC","cpc",yen,-1),
       ("CV","cv",lambda v:f"{v:.0f}",1),("CPA","cpa",yen,-1)]
def val(d, k): return cpa(d) if k == "cpa" else (d[k] if d else None)
def cards():
    out = []
    for name, k, f, good in MET:
        cv_, pv, yv = val(C, k), val(P, k), val(Y, k)
        dm, cm = delta(cv_, pv, good); dy, cy = delta(cv_, yv, good)
        out.append(f'<div class="card"><div class="lab">{name}</div><div class="val num">{f(cv_) if cv_ is not None else "—"}</div>'
                   f'<div class="dl"><span style="color:{cm}">前月比 {dm}</span><span style="color:{cy}">前年同月比 {dy}</span></div></div>')
    return "\n".join(out)

def kw_rows():
    r = []
    for k in KW:
        cost, cv, c = k["cost"], k["cv"], k["cpa"]
        if cost >= 8000 and cv == 0: j, cls = "無駄消化", "p-fail"
        elif c is not None and c <= 3000: j, cls = "高効率", "p-pass"
        elif cv == 0 and cost == 0: j, cls = "停止/低", "p-mut"
        elif cv == 0: j, cls = "CV0", "p-warn"
        else: j, cls = "標準", "p-mut"
        r.append(f"<tr><td class='kw'>{html.escape(k['text'])}</td><td class='mt'>{k['match'][:1]}</td>"
                 f"<td class='num'>{yen(cost)}</td><td class='num'>{num(k['clk'])}</td><td class='num'>{k['ctr']}%</td>"
                 f"<td class='num'>{yen(k['cpc'])}</td><td class='num'>{k['cv']:.0f}</td>"
                 f"<td class='num'>{yen(c) if c is not None else '—'}</td><td><span class='pill {cls}'>{j}</span></td></tr>")
    return "\n".join(r)

CH_NAMES = {"PERFORMANCE_MAX":"P-MAX（AIおまかせ）","SEARCH":"検索","DISPLAY":"ディスプレイ",
            "VIDEO":"動画","DEMAND_GEN":"デマンドジェン","MULTI_CHANNEL":"マルチチャネル","SHOPPING":"ショッピング"}
def channel_section():
    ch = (CH or {}).get("june")  # 対象月の配信方法別
    if not ch: return ""
    rows = []; tc = ti = tk = tv = 0.0
    for t, a in sorted(ch.items(), key=lambda x: -x[1]["cost"]):
        if a["cost"] == 0 and a["cv"] == 0: continue
        cp = a["cost"]/a["cv"] if a["cv"] else None
        tc += a["cost"]; ti += a["imp"]; tk += a["clk"]; tv += a["cv"]
        share = f"{a['cv']/tv*100:.0f}%" if False else ""
        rows.append(f"<tr><td class='kw'>{CH_NAMES.get(t,t)}</td><td class='num'>{yen(a['cost'])}</td>"
                    f"<td class='num'>{num(a['imp'])}</td><td class='num'>{num(a['clk'])}</td>"
                    f"<td class='num'>{a['cv']:.0f}</td><td class='num'>{yen(cp) if cp else '—'}</td></tr>")
    tcp = tc/tv if tv else None
    rows.append(f"<tr class='tot'><td class='kw'>合計</td><td class='num'>{yen(tc)}</td><td class='num'>{num(ti)}</td>"
                f"<td class='num'>{num(tk)}</td><td class='num'>{tv:.0f}</td><td class='num'>{yen(tcp) if tcp else '—'}</td></tr>")
    return ("<div class='tbl'><table><thead><tr><th>配信方法</th><th>費用</th><th>表示</th><th>クリック</th>"
            "<th>CV</th><th>CPA</th></tr></thead><tbody>" + "\n".join(rows) + "</tbody></table></div>")

def audit_section():
    if not AUD: return ""
    SEV = {"pass":("#3C7A52","#E9F2EC","良好"),"warn":("#B7791F","#FBF1DD","注意"),"fail":("#AE4A26","#FBECE4","要対応")}
    items = []
    for f in AUD["findings"]:
        c, bg, lab = SEV.get(f["sev"], SEV["warn"])
        items.append(f"<div class='afind'><span class='pill' style='color:{c};background:{bg}'>{lab}</span> "
                     f"<b>{html.escape(f['title'])}</b><div class='ad'>{html.escape(f['detail'])}</div></div>")
    return (f"<div class='auditbox'><div class='ascore'><span class='sv'>{AUD['score']}</span><span class='sd'>/100</span>"
            f"<span class='sg'>{html.escape(str(AUD['grade']))}</span></div>"
            f"<div class='asum'>{html.escape(AUD['summary'])}<div class='aeng'>監査エンジン：{html.escape(AUD.get('engine',''))}</div></div></div>"
            f"<div class='afinds'>" + "\n".join(items) + "</div>")

STRENGTH_JP = {"EXCELLENT": ("#3C7A52", "優良"), "GOOD": ("#3C7A52", "良好"),
               "AVERAGE": ("#B7791F", "平均"), "POOR": ("#AE4A26", "低い"),
               "PENDING": ("#8b95a3", "評価中"), "UNKNOWN": ("#8b95a3", "—"), "UNSPECIFIED": ("#8b95a3", "—")}
def pmax_section():
    if not PMAX or not PMAX.get("asset_groups"): return ""
    groups = [g for g in PMAX["asset_groups"] if g["status"] == "ENABLED" or g["cost"] > 0]
    if not groups: return "<p class='caption'>稼働中のP-MAXアセットグループはありません。</p>"
    ST = {"ok": ("○", "cov ok"), "low": ("△", "cov low"), "none": ("✗", "cov none")}
    blocks = []
    for g in groups:
        sc, sl = STRENGTH_JP.get(g["ad_strength"], ("#8b95a3", g["ad_strength"]))
        cpa_s = "¥"+format(g["cpa"], ",") if g["cpa"] else "—"
        head = (f"<div class='ag-head'><div><b>{html.escape(g['name'])}</b>"
                f"<span class='ag-camp'>{html.escape(g['campaign'])}</span></div>"
                f"<span class='ag-str' style='color:{sc};border-color:{sc}'>広告の有効性：{sl}</span></div>")
        met = (f"<div class='ag-met'><span>費用 <b>{yen(g['cost'])}</b></span>"
               f"<span>表示 <b>{num(g['imp'])}</b></span><span>クリック <b>{num(g['clk'])}</b></span>"
               f"<span>CV <b>{g['cv']:.0f}</b></span><span>CPA <b>{cpa_s}</b></span></div>")
        cov = "".join(f"<span class='{ST[c['state']][1]}'>{ST[c['state']][0]} {c['jp']} {c['have']}/{c['rec']}</span>"
                      for c in g["coverage"])
        cov = f"<div class='cov-wrap'>{cov}</div>"
        imgs = []
        for ft in ["MARKETING_IMAGE", "SQUARE_MARKETING_IMAGE", "PORTRAIT_MARKETING_IMAGE", "AD_IMAGE"]:
            for a in g["assets"].get(ft, []):
                src = a.get("data") or a.get("url")
                if src:
                    imgs.append(f"<a href='{a.get('url') or src}' target='_blank'><img src='{src}' "
                                f"alt='{ft}' title='{ft} {a.get('w')}x{a.get('h')}'></a>")
        for a in g["assets"].get("YOUTUBE_VIDEO", []):
            src = a.get("data") or a.get("thumb")
            imgs.append(f"<a href='{a['url']}' target='_blank' class='vid'><img src='{src}' "
                        f"alt='動画' title='{html.escape(a.get('title') or '動画')}'><span>▶ 動画</span></a>")
        gal = f"<div class='gal'>{''.join(imgs)}</div>" if imgs else ""
        def txts(ft, lbl):
            xs = [html.escape(a["text"]) for a in g["assets"].get(ft, []) if a.get("text")]
            if not xs: return ""
            return f"<div class='txtcol'><h5>{lbl}（{len(xs)}）</h5><ul>" + "".join(f"<li>{t}</li>" for t in xs) + "</ul></div>"
        texts = txts("HEADLINE", "見出し") + txts("LONG_HEADLINE", "長い見出し") + txts("DESCRIPTION", "説明文")
        txt = f"<div class='txts'>{texts}</div>" if texts else ""
        blocks.append(f"<div class='agbox'>{head}{met}{cov}{gal}{txt}</div>")
    return "\n".join(blocks)

def ai_comment():
    """実データ＋監査からAIコメント（下書き）を自動生成。敬体・事実ベース・推定は明記（CLAUDE.md §6/§7）。"""
    cp = cpa(C); parts = [f"{m}月は費用{yen(C['cost'])}・CV{C['cv']:.0f}件（CPA{yen(cp) if cp else '—'}）でした。"]
    if Y and Y["cv"]:
        dd = (C["cv"]/Y["cv"]-1)*100
        parts.append(f"前年同月比ではCVが{('+'+str(round(dd))) if dd>=0 else str(round(dd))}%で、"
                     + ("改善傾向と考えられます。" if dd >= 0 else "低下しています。"))
    ch = (CH or {}).get("june")
    if ch:
        act = {t: a for t, a in ch.items() if a["cost"] > 0}
        if act:
            top = max(act, key=lambda t: act[t]["cost"])
            tcp = act[top]["cost"]/act[top]["cv"] if act[top]["cv"] else None
            parts.append(f"配信方法別では{CH_NAMES.get(top,top)}が主力（CV{act[top]['cv']:.0f}件・CPA{yen(tcp) if tcp else '—'}）です。")
            eff = {t: (a["cost"]/a["cv"]) for t, a in act.items() if a["cv"] >= 3 and a["cost"] >= 10000}
            if len(eff) >= 2:
                hi, lo = max(eff, key=eff.get), min(eff, key=eff.get)
                if eff[hi]/eff[lo] >= 3:
                    parts.append(f"一方で{CH_NAMES.get(hi,hi)}はCPA{yen(eff[hi])}と{CH_NAMES.get(lo,lo)}（{yen(eff[lo])}）より効率が低く、"
                                 "見直しまたは予算配分の再検討の余地があると考えられます（推定）。")
    if PMAX:
        eg = [g for g in PMAX.get("asset_groups", []) if g["status"] == "ENABLED" and g["cost"] > 0]
        if eg:
            g = eg[0]; miss = [c["jp"] for c in g["coverage"] if c["state"] == "none"]
            note = f"P-MAXの広告の有効性は「{STRENGTH_JP.get(g['ad_strength'],('','') )[1]}」"
            note += (f"で、{'・'.join(miss)}が未設定です。素材の追加で改善余地があると考えられます（推定）。"
                     if miss else "です。")
            parts.append(note)
    if AUD:
        fails = [f for f in AUD["findings"] if f["sev"] == "fail"]
        warns = [f for f in AUD["findings"] if f["sev"] == "warn"]
        if fails:
            parts.append(f"監査では要対応「{fails[0]['title']}」が検出されており、優先確認をお願いします。")
        elif warns:
            parts.append(f"監査（{AUD['score']}/100・{AUD['grade']}）では注意{len(warns)}件（例：{warns[0]['title']}）が挙がっています。")
    parts.append("いずれも下書きの所感であり、施策の適用は承認後に行います。")
    return "".join(parts)

# 直近6ヶ月（当月まで）
recent = [d for d in mon if d["m"] <= target][-6:]

CSS = """
:root{--ink:#18222E;--slate:#586374;--muted:#8b95a3;--line:#E5E8EC;--line-soft:#EEF1F4;--paper:#FBFBFC;--panel:#FFFFFF;--accent:#1E6B77;--accent-ink:#134851;--warn:#AE4A26;--warn-soft:#FBECE4;--ok:#3C7A52;--jp:"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Noto Sans JP","Meiryo",sans-serif;}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--jp);line-height:1.7;font-size:15px}
.sheet{max-width:900px;margin:0 auto;padding:52px 40px 72px}.num{font-variant-numeric:tabular-nums}
.eyebrow{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--accent-ink);font-weight:700}
h1{font-size:26px;margin:.35em 0 .5em}
.draft{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--warn);background:var(--warn-soft);border:1px solid #EAC7B4;padding:3px 10px;border-radius:999px}
.draft::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--warn)}
.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:2px 28px;margin:20px 0 0;border-top:1px solid var(--line);padding-top:16px}
.meta div{display:flex;gap:10px;padding:4px 0;font-size:12.5px}.meta dt{color:var(--muted);min-width:64px}.meta dd{margin:0;color:var(--slate)}
section{margin-top:40px}.sec-label{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--accent-ink);font-weight:700;display:flex;align-items:center;gap:10px;margin-bottom:14px}
.sec-label::after{content:"";height:1px;flex:1;background:var(--line)}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:14px 15px}
.card .lab{font-size:11.5px;color:var(--muted)}.card .val{font-size:21px;font-weight:700;margin-top:3px}
.card .dl{display:flex;flex-direction:column;gap:1px;margin-top:4px;font-size:11px;font-weight:700}
.grid-sm{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.mini{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:13px 14px 8px}
.mini h4{font-size:12.5px;margin:0 0 2px;font-weight:600}.mini canvas{width:100%;height:96px;display:block}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
table{border-collapse:collapse;width:100%;font-size:13px;min-width:640px}
th{font-size:11px;color:var(--muted);font-weight:600;text-align:right;padding:10px;border-bottom:1px solid var(--line);background:#FAFBFC;white-space:nowrap}th:first-child{text-align:left}
td{padding:8px 10px;border-bottom:1px solid var(--line-soft);text-align:right;color:var(--slate)}td.kw{text-align:left;color:var(--ink);font-weight:600}td.mt{text-align:center;color:var(--muted);font-size:11px}tr:last-child td{border-bottom:none}
.pill{font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;white-space:nowrap}
.p-fail{color:var(--warn);background:var(--warn-soft)}.p-warn{color:#B7791F;background:#FBF1DD}.p-pass{color:var(--ok);background:#E9F2EC}.p-mut{color:var(--muted);background:var(--line-soft)}
tr.tot td{font-weight:700;color:var(--ink);border-top:2px solid var(--line);background:#FAFBFC}
.auditbox{display:flex;gap:20px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 20px;margin-bottom:12px}
.ascore{text-align:center;flex:none}.ascore .sv{font-size:34px;font-weight:800;color:var(--accent)}.ascore .sd{font-size:13px;color:var(--muted)}.ascore .sg{display:block;font-size:12px;font-weight:800;color:#fff;background:var(--accent);border-radius:999px;padding:1px 10px;margin-top:4px}
.asum{font-size:13.5px;color:var(--slate)}.aeng{font-size:11px;color:var(--muted);margin-top:5px}
.afinds{display:grid;gap:8px}.afind{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:11px 14px;font-size:13.5px;color:var(--ink)}.afind .ad{color:var(--slate);font-size:12.5px;margin-top:3px}
.cmt{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.cmt-bar{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;background:#FAFBFC;border-bottom:1px solid var(--line)}
.cmt-status{font-size:11.5px;font-weight:700;color:var(--accent-ink)}.cmt-status.edited{color:var(--warn)}
.cmt-actions{display:flex;gap:8px}
.cmt-actions button{font-family:var(--jp);font-size:12px;font-weight:700;border:1px solid var(--line);background:#fff;color:var(--slate);border-radius:7px;padding:4px 12px;cursor:pointer}
.cmt-actions button:hover{border-color:var(--accent);color:var(--accent-ink)}
.cmt-actions .primary{background:var(--accent);color:#fff;border-color:var(--accent)}.cmt-actions .primary:hover{color:#fff;background:var(--accent-ink)}
.cmt-body{padding:14px 16px;font-size:14px;line-height:1.9;color:var(--ink);min-height:60px;outline:none}
.cmt-body:focus{background:#FCFDFD}.cmt-badge{display:inline-block;font-size:10px;font-weight:700;color:var(--accent);background:var(--accent-soft,#E7F0F1);border-radius:5px;padding:1px 7px;margin-left:8px}
.agbox{border:1px solid var(--line);border-radius:12px;padding:16px 18px;background:var(--panel);margin-bottom:14px}
.ag-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
.ag-head b{font-size:15px;color:var(--ink)}.ag-camp{font-size:11.5px;color:var(--muted);margin-left:8px}
.ag-str{font-size:11.5px;font-weight:700;border:1px solid;border-radius:999px;padding:2px 10px;white-space:nowrap}
.ag-met{display:flex;flex-wrap:wrap;gap:6px 18px;margin:11px 0;font-size:12.5px;color:var(--slate)}.ag-met b{color:var(--ink);font-size:14px}
.cov-wrap{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 2px}
.cov{font-size:11px;font-weight:700;border-radius:6px;padding:2px 8px}
.cov.ok{color:var(--ok);background:#E9F2EC}.cov.low{color:#B7791F;background:#FBF1DD}.cov.none{color:var(--warn);background:var(--warn-soft)}
.gal{display:flex;flex-wrap:wrap;gap:8px;margin:13px 0 4px}
.gal img{height:78px;width:auto;border-radius:8px;border:1px solid var(--line);object-fit:cover;display:block;background:#f4f5f7}
.gal a{position:relative;display:inline-block;text-decoration:none;line-height:0}
.gal .vid span{position:absolute;left:6px;bottom:6px;font-size:10px;font-weight:700;color:#fff;background:rgba(0,0,0,.62);border-radius:5px;padding:1px 6px}
.txts{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:12px;border-top:1px solid var(--line-soft);padding-top:12px}
.txtcol h5{font-size:11.5px;margin:0 0 5px;color:var(--accent-ink);font-weight:700}
.txtcol ul{margin:0;padding-left:16px}.txtcol li{font-size:12px;color:var(--slate);margin-bottom:3px;line-height:1.5}
.caption{font-size:12px;color:var(--muted);margin:12px 2px 0;line-height:1.6}
footer{margin-top:44px;padding-top:16px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}
@media(max-width:600px){.sheet{padding:34px 18px 52px}.cards{grid-template-columns:1fr 1fr}.grid-sm,.meta,.txts{grid-template-columns:1fr}}
"""
RMET = [("費用","cost","yen"),("クリック","clk","num"),("CV","cv","num"),("CPA","cpa","yen")]
mini = "\n".join(f'<div class="mini"><h4>{n}（直近6ヶ月）</h4><canvas id="c_{k}" width="600" height="180"></canvas></div>' for n,k,_ in RMET)

HTML = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>月次報告 {target} — {html.escape(label)}</title>
<style>{CSS}</style></head><body><main class="sheet">
<header>
  <div class="eyebrow">Google広告 月次報告 ・ {y}年{m}月</div>
  <h1>月次報告：{html.escape(label)}</h1>
  <span class="draft">参考／下書き ・ 実データ（Google Ads API）</span>
  <dl class="meta">
    <div><dt>対象</dt><dd>customer {json.loads(Path(sys.argv[1]).read_text())["customer"]}</dd></div>
    <div><dt>対象月</dt><dd>{y}年{m}月</dd></div>
    <div><dt>比較</dt><dd>前月（{prev}）／前年同月（{prevY}）</dd></div>
    <div><dt>作成日</dt><dd class="num">2026-07-04</dd></div>
  </dl>
</header>
<section>
  <div class="sec-label">01 — 今月のコメント<span class="cmt-badge">AI下書き・編集可</span></div>
  <div class="cmt">
    <div class="cmt-bar">
      <span class="cmt-status" id="cmtStatus">AI下書き</span>
      <div class="cmt-actions">
        <button class="primary" id="cmtSave">保存</button>
        <button id="cmtReset">AI下書きに戻す</button>
        <button id="cmtCopy">コピー</button>
      </div>
    </div>
    <div class="cmt-body" id="cmtBody" contenteditable="true">{html.escape(ai_comment())}</div>
  </div>
  <p class="caption">AIが実データ・監査から所感を自動下書き。担当が編集し「保存」で反映（この端末に保存）。適用は承認後のみ（CLAUDE.md §0）。</p>
</section>
<section>
  <div class="sec-label">02 — {m}月サマリ（前月比 / 前年同月比）</div>
  <div class="cards">{cards()}</div>
</section>
<section>
  <div class="sec-label">03 — 配信方法別（キャンペーンタイプ別・当月）</div>
  {channel_section()}
  <p class="caption">配信方法ごとの内訳と合計。検索(Search)＝キーワード配信、P-MAX＝AIおまかせ（Googleの全面横断・非キーワード）。効率(CPA)は配信方法で大きく異なるため、合計だけでなく方法別に評価する。</p>
</section>
<section>
  <div class="sec-label">04 — P-MAX クリエイティブ（稼働中の素材と有効性）</div>
  {pmax_section()}
  <p class="caption">稼働中のアセットグループ・実績・素材の充足度（○充足／△本数不足／✗未設定）と、実際に配信中のクリエイティブ（画像・動画・見出し・説明文）。<b>P-MAXは1素材ごとのCV/CPAをGoogleが公開していない</b>ため、素材単位は「広告の有効性(ad strength)」と本数で評価。画像はクリックで原寸表示。</p>
</section>
<section>
  <div class="sec-label">05 — {m}月 キーワード別（費用上位・検索KWのみ）</div>
  <div class="tbl"><table>
    <thead><tr><th>キーワード</th><th>型</th><th>費用</th><th>クリック</th><th>CTR</th><th>CPC</th><th>CV</th><th>CPA</th><th>判定</th></tr></thead>
    <tbody>{kw_rows()}</tbody></table></div>
  <p class="caption">※ <b>検索キーワードのみ</b>。P-MAX等の非キーワード配信は上の「配信方法別」を参照（KW費用合計＜当月費用となる）。判定：高効率=CPA≤¥3,000／無駄消化=費用¥8k+でCV0。</p>
</section>
<section>
  <div class="sec-label">06 — 監査サマリ（Claude Ads）</div>
  {audit_section()}
  <p class="caption">Claude Ads（OSS/MIT・ads-google監査）の観点で実データを点検した要約。スコアは相対目安。要対応・注意項目は人間が確認し、適用は承認後のみ（CLAUDE.md §0）。</p>
</section>
<section>
  <div class="sec-label">07 — 参考：直近6ヶ月ミニ推移</div>
  <div class="grid-sm">{mini}</div>
</section>
<section>
  <div class="sec-label">08 — 注記</div>
  <p class="caption">実データ（Google Ads API）。当月＝{target}。出力は参考／下書き、適用は人間の承認後のみ（CLAUDE.md §0）。年次(今年vs昨年)は別レポート参照。目標CPA未設定のため良否は相対評価。</p>
</section>
<footer><span>ソフトコミュニケーションズ ／ 広告運用 半自動化</span><span class="num">2026-07-04</span></footer>
</main>
<script>
const R={json.dumps(recent, ensure_ascii=False)};
const RMET={json.dumps([{"k":k,"f":f} for _,k,f in RMET], ensure_ascii=False)};
const fmt={{yen:v=>'¥'+Math.round(v).toLocaleString(),num:v=>Math.round(v).toLocaleString()}};
const afmt={{yen:v=>v>=1000?'¥'+(v/1000).toFixed(0)+'k':'¥'+Math.round(v),num:v=>v>=1000?(v/1000).toFixed(0)+'k':''+Math.round(v)}};
RMET.forEach(mt=>{{
  const cv=document.getElementById('c_'+mt.k); if(!cv)return; const ctx=cv.getContext('2d');
  const W=cv.width,H=cv.height,padL=50,padR=8,padT=12,padB=20,plotW=W-padL-padR,plotH=H-padT-padB;
  const vals=R.map(d=> mt.k==='cpa' ? (d.cv? d.cost/d.cv : 0) : d[mt.k]);
  let mn=Math.min(...vals,0),mx=Math.max(...vals); if(mx===mn)mx=mn+1;
  const n=vals.length,X=i=>padL+plotW*(n<=1?0.5:i/(n-1)),Y=v=>padT+plotH*(1-(v-mn)/(mx-mn));
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='#EEF1F4';ctx.lineWidth=1;ctx.fillStyle='#aab2bd';ctx.font='15px sans-serif';ctx.textAlign='right';
  for(let g=0;g<=2;g++){{const yy=padT+plotH*g/2, vv=mx-(mx-mn)*g/2;ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(W-padR,yy);ctx.stroke();ctx.fillText(afmt[mt.f](vv),padL-5,yy+5);}}
  ctx.beginPath();ctx.moveTo(X(0),H-padB);vals.forEach((v,i)=>ctx.lineTo(X(i),Y(v)));ctx.lineTo(X(n-1),H-padB);ctx.closePath();ctx.fillStyle='rgba(30,107,119,.09)';ctx.fill();
  ctx.beginPath();vals.forEach((v,i)=>{{const x=X(i),y=Y(v);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}});ctx.strokeStyle='#1E6B77';ctx.lineWidth=2.4;ctx.lineJoin='round';ctx.stroke();
  ctx.fillStyle='#1E6B77';ctx.beginPath();ctx.arc(X(n-1),Y(vals[n-1]),3.5,0,7);ctx.fill();
  ctx.fillStyle='#aab2bd';ctx.font='15px sans-serif';ctx.textAlign='center';R.forEach((d,i)=>ctx.fillText(d.m.slice(5)+'月',X(i),H-4));
}});
// --- 担当コメント（AI下書き・編集・保存） ---
const AI_DRAFT={json.dumps(ai_comment())};
const CMT_KEY='cmt:'+{json.dumps(str(json.loads(Path(sys.argv[1]).read_text())["customer"]))}+':{target}';
(function(){{
  const body=document.getElementById('cmtBody'),st=document.getElementById('cmtStatus');
  const saved=localStorage.getItem(CMT_KEY);
  if(saved){{try{{const o=JSON.parse(saved);body.innerText=o.text;st.textContent='編集済み（保存 '+o.at+'）';st.classList.add('edited');}}catch(e){{}}}}
  document.getElementById('cmtSave').onclick=()=>{{const at=new Date().toLocaleString('ja-JP');localStorage.setItem(CMT_KEY,JSON.stringify({{text:body.innerText,at:at}}));st.textContent='編集済み（保存 '+at+'）';st.classList.add('edited');}};
  document.getElementById('cmtReset').onclick=()=>{{body.innerText=AI_DRAFT;localStorage.removeItem(CMT_KEY);st.textContent='AI下書き';st.classList.remove('edited');}};
  document.getElementById('cmtCopy').onclick=()=>{{if(navigator.clipboard)navigator.clipboard.writeText(body.innerText);const b=document.getElementById('cmtCopy'),t=b.textContent;b.textContent='コピー済';setTimeout(()=>b.textContent=t,1200);}};
  body.addEventListener('input',()=>{{st.textContent='編集中（未保存）';st.classList.add('edited');}});
}})();
</script></body></html>"""
out.write_text(HTML, encoding="utf-8")
print(f"生成: {out}  当月{target} 費用{yen(C['cost'])} CV{C['cv']:.0f} CPA{yen(cpa(C))}")
