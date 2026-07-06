#!/usr/bin/env python3
"""採用SNS（ミスマッチナッシー）月次報告（先月）HTML 生成。

bespoke: customer 3784292445 のミスマッチナッシー3キャンペーン専用（対象月は TARGET で指定）。
データ配置（既定 data/saiyo_sns/ ・第1引数でディレクトリ指定可）:
  mmn_monthly.json    … 月次(合算 monthly[]) ※通年生成器と共通
  mmn_chan_june.json  … 対象月の配信方法別 {"june": {SEARCH/PERFORMANCE_MAX/...}}
  mmn_kw_june.json    … 対象月の検索KW(検索_ミスマッチナッシー)
  mmn_pmax_june.json  … scripts/google_pmax_creatives.py 3784292445 <out> 2026-06-01 2026-06-30
使い方: python3 scripts/report_saiyo_sns_monthly.py [data_dir]  → out/google_month_saiyo_sns.html
"""
import sys, json, html
from pathlib import Path

S = sys.argv[1] if len(sys.argv) > 1 else "data/saiyo_sns"
MON = json.loads(Path(f"{S}/mmn_monthly.json").read_text(encoding="utf-8"))
CH = json.loads(Path(f"{S}/mmn_chan_june.json").read_text(encoding="utf-8"))
KW = json.loads(Path(f"{S}/mmn_kw_june.json").read_text(encoding="utf-8"))
PMAX = json.loads(Path(f"{S}/mmn_pmax_june.json").read_text(encoding="utf-8"))
OUT = Path("out/google_month_saiyo_sns.html")

TARGET, PREV = "2026-06", "2026-05"
bym = {d["m"]: d for d in MON["monthly"]}
C, P = bym.get(TARGET), bym.get(PREV)

def yen(n): return "¥"+format(round(n), ",") if n is not None else "—"
def num(n): return format(round(n), ",") if n is not None else "—"
def cvf(v): return f"{v:.1f}".rstrip("0").rstrip(".") if v is not None else "—"
def cpa(d): return (d["cost"]/d["cv"]) if d and d["cv"] else None
def val(d, k): return cpa(d) if k == "cpa" else (d[k] if d else None)
def delta(cur, base, good):
    if base in (None, 0) or cur is None: return ("—", "#64748b")
    p = (cur/base-1)*100; up = p >= 0
    col = "#64748b" if good == 0 else ("#3C7A52" if (up if good == 1 else not up) else "#AE4A26")
    return (("↑+" if up else "↓")+str(round(abs(p)))+"%", col)

MET = [("費用","cost",yen,0),("表示回数","imp",num,1),("クリック","clk",num,1),
       ("CTR","ctr",lambda v:f"{v:.2f}%",1),("平均CPC","cpc",yen,-1),
       ("CV","cv",lambda v:cvf(v),1),("CPA","cpa",yen,-1)]
def cards():
    out = []
    for name, k, f, good in MET:
        cv_, pv = val(C, k), val(P, k)
        dm, cm = delta(cv_, pv, good)
        out.append(f'<div class="card"><div class="lab">{name}</div><div class="val num">{f(cv_) if cv_ is not None else "—"}</div>'
                   f'<div class="dl"><span style="color:{cm}">前月比 {dm}</span><span class="mut">前年同月比 —</span></div></div>')
    return "\n".join(out)

CH_NAMES = {"PERFORMANCE_MAX":"P-MAX（AIおまかせ）","SEARCH":"検索","DEMAND_GEN":"デマンドジェネレーション","DISPLAY":"ディスプレイ","VIDEO":"動画"}
def channel_section():
    ch = CH.get("june", {}); rows = []; tc=ti=tk=tv=0.0
    for t, a in sorted(ch.items(), key=lambda x:-x[1]["cost"]):
        if a["cost"]==0 and a["cv"]==0: continue
        cp = a["cost"]/a["cv"] if a["cv"] else None
        tc+=a["cost"]; ti+=a["imp"]; tk+=a["clk"]; tv+=a["cv"]
        rows.append(f"<tr><td class='kw'>{CH_NAMES.get(t,t)}</td><td class='num'>{yen(a['cost'])}</td><td class='num'>{num(a['imp'])}</td><td class='num'>{num(a['clk'])}</td><td class='num'>{cvf(a['cv'])}</td><td class='num'>{yen(cp) if cp else '—'}</td></tr>")
    tcp = tc/tv if tv else None
    rows.append(f"<tr class='tot'><td class='kw'>合計</td><td class='num'>{yen(tc)}</td><td class='num'>{num(ti)}</td><td class='num'>{num(tk)}</td><td class='num'>{cvf(tv)}</td><td class='num'>{yen(tcp) if tcp else '—'}</td></tr>")
    return "<div class='tbl'><table><thead><tr><th>配信方法</th><th>費用</th><th>表示</th><th>クリック</th><th>CV</th><th>CPA</th></tr></thead><tbody>"+"\n".join(rows)+"</tbody></table></div>"

def kw_rows():
    r = []
    for k in KW:
        c = k["cpa"]
        if k["cost"] >= 8000 and k["cv"] == 0: j, cls = "無駄消化", "p-fail"
        elif c is not None and c <= 8000: j, cls = "成果", "p-pass"
        elif k["cv"] == 0 and k["cost"] == 0: j, cls = "配信なし", "p-mut"
        elif k["cv"] == 0: j, cls = "CV0", "p-warn"
        else: j, cls = "標準", "p-mut"
        r.append(f"<tr><td class='kw'>{html.escape(k['text'])}</td><td class='mt'>{k['match'][:1]}</td>"
                 f"<td class='num'>{yen(k['cost'])}</td><td class='num'>{num(k['clk'])}</td><td class='num'>{k['ctr']}%</td>"
                 f"<td class='num'>{yen(k['cpc'])}</td><td class='num'>{cvf(k['cv'])}</td>"
                 f"<td class='num'>{yen(c) if c is not None else '—'}</td><td><span class='pill {cls}'>{j}</span></td></tr>")
    return "\n".join(r)

STRENGTH = {"EXCELLENT":("#3C7A52","優良"),"GOOD":("#3C7A52","良好"),"AVERAGE":("#B7791F","平均"),"POOR":("#AE4A26","低い"),"UNKNOWN":("#AE4A26","未評価/不足"),"PENDING":("#8b95a3","評価中")}
def pmax_section():
    g = next((x for x in PMAX["asset_groups"] if "ミスマッチ" in x["name"] and (x["status"]=="ENABLED" or x["cost"]>0)), None)
    if not g: return "<p class='caption'>6月に稼働したP-MAXアセットグループはありません。</p>"
    sc, sl = STRENGTH.get(g["ad_strength"], ("#8b95a3", g["ad_strength"]))
    ST = {"ok":("○","cov ok"),"low":("△","cov low"),"none":("✗","cov none")}
    cov = "".join(f"<span class='{ST[c['state']][1]}'>{ST[c['state']][0]} {c['jp']} {c['have']}/{c['rec']}</span>" for c in g["coverage"])
    imgs = []
    for ft in ["MARKETING_IMAGE","SQUARE_MARKETING_IMAGE","PORTRAIT_MARKETING_IMAGE","AD_IMAGE"]:
        for a in g["assets"].get(ft, []):
            src = a.get("data") or a.get("url")
            if src: imgs.append(f"<a href='{a.get('url') or src}' target='_blank'><img src='{src}' alt='{ft}'></a>")
    gal = f"<div class='gal'>{''.join(imgs)}</div>" if imgs else ""
    def txts(ft, lbl):
        xs = [html.escape(a["text"]) for a in g["assets"].get(ft, []) if a.get("text")]
        return "" if not xs else f"<div class='txtcol'><h5>{lbl}（{len(xs)}）</h5><ul>"+"".join(f"<li>{t}</li>" for t in xs)+"</ul></div>"
    texts = txts("HEADLINE","見出し")+txts("LONG_HEADLINE","長い見出し")+txts("DESCRIPTION","説明文")
    cp = yen(g["cpa"]) if g["cpa"] else "—"
    return (f"<div class='agbox'><div class='ag-head'><div><b>{html.escape(g['name'])}</b></div>"
            f"<span class='ag-str' style='color:{sc};border-color:{sc}'>広告の有効性：{sl}</span></div>"
            f"<div class='ag-met'><span>費用 <b>{yen(g['cost'])}</b></span><span>CV <b>{cvf(g['cv'])}</b></span><span>CPA <b>{cp}</b></span></div>"
            f"<div class='cov-wrap'>{cov}</div>{gal}<div class='txts'>{texts}</div></div>")

def ai_comment():
    parts = [f"2026年6月は費用{yen(C['cost'])}・CV{cvf(C['cv'])}件（CPA{yen(cpa(C))}）でした。"]
    if P and P["cv"]:
        parts.append(f"前月比では費用{delta(C['cost'],P['cost'],0)[0]}に対しCVは{cvf(P['cv'])}→{cvf(C['cv'])}件（{delta(C['cv'],P['cv'],1)[0]}）、"
                     f"CPAは{yen(cpa(P))}→{yen(cpa(C))}（{delta(cpa(C),cpa(P),-1)[0]}）と、当月は効率がやや低下しています。")
    ch = CH.get("june", {})
    se, pm = ch.get("SEARCH", {}), ch.get("PERFORMANCE_MAX", {})
    if se and pm:
        parts.append(f"配信方法別では検索{yen(se.get('cost'))}（CV{cvf(se.get('cv',0))}）とP-MAX{yen(pm.get('cost'))}（CV{cvf(pm.get('cv',0))}）がほぼ均衡。検索は「sns 運用 外注」1KWに集中しています。")
    g = next((x for x in PMAX["asset_groups"] if "ミスマッチ" in x["name"] and x["cost"]>0), None)
    if g:
        miss = [c["jp"] for c in g["coverage"] if c["state"]=="none"]
        parts.append(f"P-MAXの広告の有効性は「{STRENGTH.get(g['ad_strength'],('','') )[1]}」で、{('・'.join(miss)+'が未設定です。' ) if miss else '素材は概ね充足。'}")
    parts.append("改善提案（除外KW・成果KW集約・PMax素材拡充）は通年レポート参照。全キャンペーン停止中につき、再開を前提とした下書き所感です。")
    return "".join(parts)

recent = [d for d in MON["monthly"] if d["m"] <= TARGET][-6:]
RMET = [("費用","cost","yen"),("クリック","clk","num"),("CV","cv","num"),("CPA","cpa","yen")]
mini = "\n".join(f'<div class="mini"><h4>{n}（1〜6月）</h4><canvas id="c_{k}" width="600" height="180"></canvas></div>' for n,k,_ in RMET)

CSS = """
:root{--ink:#18222E;--slate:#586374;--muted:#8b95a3;--line:#E5E8EC;--line-soft:#EEF1F4;--paper:#FBFBFC;--panel:#FFFFFF;--accent:#1E6B77;--accent-soft:#E7F0F1;--accent-ink:#134851;--warn:#AE4A26;--warn-soft:#FBECE4;--ok:#3C7A52;--jp:"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Noto Sans JP","Meiryo",sans-serif;}
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
.card .dl{display:flex;flex-direction:column;gap:1px;margin-top:4px;font-size:11px;font-weight:700}.card .mut{color:var(--muted)}
.grid-sm{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.mini{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:13px 14px 8px}
.mini h4{font-size:12.5px;margin:0 0 2px;font-weight:600}.mini canvas{width:100%;height:96px;display:block}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
table{border-collapse:collapse;width:100%;font-size:13px;min-width:560px}
th{font-size:11px;color:var(--muted);font-weight:600;text-align:right;padding:10px;border-bottom:1px solid var(--line);background:#FAFBFC;white-space:nowrap}th:first-child{text-align:left}
td{padding:8px 10px;border-bottom:1px solid var(--line-soft);text-align:right;color:var(--slate)}td.kw{text-align:left;color:var(--ink);font-weight:600}td.mt{text-align:center;color:var(--muted);font-size:11px}
tr.tot td{font-weight:700;color:var(--ink);border-top:2px solid var(--line);background:#FAFBFC}tr:last-child td{border-bottom:none}
.pill{font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;white-space:nowrap}
.p-fail{color:var(--warn);background:var(--warn-soft)}.p-warn{color:#B7791F;background:#FBF1DD}.p-pass{color:var(--ok);background:#E9F2EC}.p-mut{color:var(--muted);background:var(--line-soft)}
.cmt{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.cmt-bar{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;background:#FAFBFC;border-bottom:1px solid var(--line)}
.cmt-status{font-size:11.5px;font-weight:700;color:var(--accent-ink)}.cmt-status.edited{color:var(--warn)}
.cmt-actions{display:flex;gap:8px}.cmt-actions button{font-family:var(--jp);font-size:12px;font-weight:700;border:1px solid var(--line);background:#fff;color:var(--slate);border-radius:7px;padding:4px 12px;cursor:pointer}
.cmt-actions button:hover{border-color:var(--accent);color:var(--accent-ink)}.cmt-actions .primary{background:var(--accent);color:#fff;border-color:var(--accent)}
.cmt-body{padding:14px 16px;font-size:14px;line-height:1.9;color:var(--ink);min-height:60px;outline:none}.cmt-body:focus{background:#FCFDFD}
.cmt-badge{display:inline-block;font-size:10px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:5px;padding:1px 7px;margin-left:8px}
.agbox{border:1px solid var(--line);border-radius:12px;padding:16px 18px;background:var(--panel)}
.ag-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.ag-head b{font-size:15px}
.ag-str{font-size:11.5px;font-weight:700;border:1px solid;border-radius:999px;padding:2px 10px;white-space:nowrap}
.ag-met{display:flex;flex-wrap:wrap;gap:6px 18px;margin:11px 0;font-size:12.5px;color:var(--slate)}.ag-met b{color:var(--ink);font-size:14px}
.cov-wrap{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 2px}.cov{font-size:11px;font-weight:700;border-radius:6px;padding:2px 8px}
.cov.ok{color:var(--ok);background:#E9F2EC}.cov.low{color:#B7791F;background:#FBF1DD}.cov.none{color:var(--warn);background:var(--warn-soft)}
.gal{display:flex;flex-wrap:wrap;gap:8px;margin:13px 0 4px}.gal img{height:78px;width:auto;border-radius:8px;border:1px solid var(--line);object-fit:cover;display:block}.gal a{line-height:0}
.txts{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:12px;border-top:1px solid var(--line-soft);padding-top:12px}
.txtcol h5{font-size:11.5px;margin:0 0 5px;color:var(--accent-ink);font-weight:700}.txtcol ul{margin:0;padding-left:16px}.txtcol li{font-size:12px;color:var(--slate);margin-bottom:3px;line-height:1.5}
.caption{font-size:12px;color:var(--muted);margin:12px 2px 0;line-height:1.6}
footer{margin-top:44px;padding-top:16px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}
@media(max-width:600px){.sheet{padding:34px 18px 52px}.cards{grid-template-columns:1fr 1fr}.grid-sm,.meta,.txts{grid-template-columns:1fr}}
"""

HTML = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>採用SNS 月次報告 2026-06 — ミスマッチナッシー</title>
<style>{CSS}</style></head><body><main class="sheet">
<header>
  <div class="eyebrow">Google広告 月次報告 ・ 採用SNS ・ 2026年6月</div>
  <h1>月次報告：採用SNS（ミスマッチナッシー）</h1>
  <span class="draft">参考／下書き ・ 実データ（Google Ads API）</span>
  <dl class="meta">
    <div><dt>対象</dt><dd>customer 3784292445（ミスマッチナッシー3キャンペーン）</dd></div>
    <div><dt>対象月</dt><dd>2026年6月</dd></div>
    <div><dt>比較</dt><dd>前月（2026-05）／前年同月＝データなし</dd></div>
    <div><dt>状態</dt><dd>全キャンペーン停止中</dd></div>
  </dl>
</header>
<section>
  <div class="sec-label">01 — 今月のコメント<span class="cmt-badge">AI下書き・編集可</span></div>
  <div class="cmt">
    <div class="cmt-bar"><span class="cmt-status" id="cmtStatus">AI下書き</span>
      <div class="cmt-actions"><button class="primary" id="cmtSave">保存</button><button id="cmtReset">AI下書きに戻す</button><button id="cmtCopy">コピー</button></div>
    </div>
    <div class="cmt-body" id="cmtBody" contenteditable="true">{html.escape(ai_comment())}</div>
  </div>
  <p class="caption">AIが実データから所感を自動下書き。担当が編集し「保存」で反映（この端末に保存）。適用は承認後のみ（CLAUDE.md §0）。</p>
</section>
<section>
  <div class="sec-label">02 — 6月サマリ（前月比）</div>
  <div class="cards">{cards()}</div>
  <p class="caption">前年同月は配信データがないため「—」。当月はCVが前月より減り、CPAは上昇（¥10,563→¥15,121）。</p>
</section>
<section>
  <div class="sec-label">03 — 配信方法別（6月）</div>
  {channel_section()}
  <p class="caption">6月は検索とP-MAXがほぼ均衡。デマンドジェネレーションは3月で停止済み。</p>
</section>
<section>
  <div class="sec-label">04 — 6月 検索キーワード</div>
  <div class="tbl"><table>
    <thead><tr><th>キーワード</th><th>型</th><th>費用</th><th>クリック</th><th>CTR</th><th>CPC</th><th>CV</th><th>CPA</th><th>判定</th></tr></thead>
    <tbody>{kw_rows()}</tbody></table></div>
  <p class="caption">検索は「sns 運用 外注」1KWにほぼ集中。他は完全一致で配信ほぼなし。判定：成果=CPA≤¥8,000／無駄消化=費用¥8k+でCV0。</p>
</section>
<section>
  <div class="sec-label">05 — P-MAX クリエイティブ（6月稼働）</div>
  {pmax_section()}
  <p class="caption">P-MAXは1素材ごとのCV/CPAをGoogleが公開していないため、有効性＋本数で評価。動画・ロゴ・縦型画像が未設定。</p>
</section>
<section>
  <div class="sec-label">06 — 参考：月次推移（2026年1〜6月）</div>
  <div class="grid-sm">{mini}</div>
</section>
<section>
  <div class="sec-label">07 — 注記</div>
  <p class="caption">実データ（Google Ads API）。当月＝2026-06、ミスマッチナッシー3キャンペーン抽出。前年同月はデータなし。全キャンペーン停止中。詳細分析・改善提案・年間推移は「通年レポート（分析・改善）」を参照。出力は参考／下書き、適用は承認後のみ。</p>
</section>
<footer><span>ソフトコミュニケーションズ ／ 広告運用 半自動化</span><span class="num">2026-07-06</span></footer>
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
  ctx.fillStyle='#1E6B77';vals.forEach((v,i)=>{{ctx.beginPath();ctx.arc(X(i),Y(v),3,0,7);ctx.fill();}});
  ctx.fillStyle='#aab2bd';ctx.font='15px sans-serif';ctx.textAlign='center';R.forEach((d,i)=>ctx.fillText(d.m.slice(5)+'月',X(i),H-4));
}});
const AI_DRAFT={json.dumps(ai_comment())};
const CMT_KEY='cmt:mmn:2026-06';
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
OUT.write_text(HTML, encoding="utf-8")
print("生成:", OUT, "| 6月 費用", yen(C["cost"]), "CV", C["cv"], "CPA", yen(cpa(C)))
