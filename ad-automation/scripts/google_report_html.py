#!/usr/bin/env python3
"""Google レポートHTML生成（今年 vs 昨年）：今年サマリ(前年同期比)＋月次で今年/昨年重ね＋今年キーワード分析。
使い方: python3 scripts/google_report_html.py <data.json> <account_label> <out.html> [this_year] [last_year]"""
import sys, json, html
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
label = sys.argv[2]; out = Path(sys.argv[3])
TY = int(sys.argv[4]) if len(sys.argv) > 4 else 2026
LY = int(sys.argv[5]) if len(sys.argv) > 5 else 2025
CH = json.loads(Path(sys.argv[6]).read_text(encoding="utf-8")) if len(sys.argv) > 6 else None
AUD = json.loads(Path(sys.argv[7]).read_text(encoding="utf-8")) if len(sys.argv) > 7 else None
M = data["monthly"]; K = data["keywords"]
# 集計途中の当月は除外（完全月のみで比較）
CUR_MONTH = "2026-07"
M = [d for d in M if d["m"] != CUR_MONTH]

ty = [d for d in M if d["m"].startswith(str(TY))]
present = sorted({int(d["m"][5:7]) for d in ty})           # 今年の対象月
ly_same = [d for d in M if d["m"].startswith(str(LY)) and int(d["m"][5:7]) in present]  # 昨年同期

def agg(rows):
    cost = sum(x["cost"] for x in rows); clk = sum(x["clk"] for x in rows)
    imp = sum(x["imp"] for x in rows); cv = sum(x["cv"] for x in rows)
    return {"cost": cost, "imp": imp, "clk": clk, "cv": cv,
            "ctr": (clk/imp*100 if imp else 0), "cpc": (cost/clk if clk else 0),
            "cpa": (cost/cv if cv else 0)}
A, B = agg(ty), agg(ly_same)
def yen(n): return "¥"+format(round(n), ",")
def num(n): return format(round(n), ",")
def yoy(a, b, good):  # good: 1=増が良い,-1=減が良い,0=中立
    if not b: return ("—", "#64748b")
    p = (a/b-1)*100; up = p >= 0
    col = "#64748b" if good == 0 else ("#3C7A52" if (up if good==1 else not up) else "#AE4A26")
    return (("↑+" if up else "↓")+str(round(abs(p)))+"%", col)

period_ty = f"{TY}-{present[0]:02d}〜{TY}-{present[-1]:02d}" if present else str(TY)

CARDS = [("費用","cost",yen,0),("表示回数","imp",num,1),("クリック","clk",num,1),
         ("CTR","ctr",lambda v:f"{v:.2f}%",1),("平均CPC","cpc",yen,-1),
         ("CV","cv",lambda v:f"{v:.0f}",1),("CPA","cpa",yen,-1)]
def summary_cards():
    c=[]
    for name,k,f,good in CARDS:
        d,col=yoy(A[k],B[k],good)
        c.append(f'<div class="card"><div class="lab">{name}</div><div class="val num">{f(A[k])}</div>'
                 f'<div class="yy" style="color:{col}">前年同期比 {d}</div></div>')
    return "\n".join(c)

def kw_rows():
    r=[]
    for k in K:
        cost,cv,cpa=k["cost"],k["cv"],k["cpa"]
        if cost>=20000 and cv==0: j,cls="無駄消化","p-fail"
        elif cpa is not None and cpa<=3000: j,cls="高効率","p-pass"
        elif cpa is not None and cpa>=30000: j,cls="高CPA","p-fail"
        elif cv==0: j,cls="CV0","p-warn"
        else: j,cls="標準","p-mut"
        r.append(f"<tr><td class='kw'>{html.escape(k['text'])}</td><td class='mt'>{k['match'][:1]}</td>"
                 f"<td class='num'>{yen(cost)}</td><td class='num'>{num(k['clk'])}</td><td class='num'>{k['ctr']}%</td>"
                 f"<td class='num'>{yen(k['cpc'])}</td><td class='num'>{k['cv']:.0f}</td>"
                 f"<td class='num'>{yen(cpa) if cpa is not None else '—'}</td><td><span class='pill {cls}'>{j}</span></td></tr>")
    return "\n".join(r)

CH_NAMES = {"PERFORMANCE_MAX":"P-MAX（AIおまかせ）","SEARCH":"検索","DISPLAY":"ディスプレイ",
            "VIDEO":"動画","DEMAND_GEN":"デマンドジェン","MULTI_CHANNEL":"マルチチャネル","SHOPPING":"ショッピング"}
def channel_section():
    ch = (CH or {}).get("ytd")  # 今年YTDの配信方法別
    if not ch: return ""
    rows = []; tc = ti = tk = tv = 0.0
    for t, a in sorted(ch.items(), key=lambda x: -x[1]["cost"]):
        if a["cost"] == 0 and a["cv"] == 0: continue
        cp = a["cost"]/a["cv"] if a["cv"] else None
        tc += a["cost"]; ti += a["imp"]; tk += a["clk"]; tv += a["cv"]
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
.card .lab{font-size:11.5px;color:var(--muted)}.card .val{font-size:21px;font-weight:700;margin-top:3px}.card .yy{font-size:11.5px;font-weight:700;margin-top:3px}
.yrlegend{display:flex;gap:16px;margin-bottom:12px;font-size:12px;color:var(--slate)}.yrlegend span{display:inline-flex;align-items:center;gap:6px}.yrlegend i{width:15px;height:3px;border-radius:2px}
.grid-sm{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.mini{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:13px 14px 8px}
.mini .top{display:flex;justify-content:space-between;align-items:baseline}.mini h4{font-size:12.5px;margin:0;font-weight:600}
.mini .last{font-size:13px;font-weight:700;color:var(--accent-ink)}.mini .rng{font-size:10.5px;color:var(--muted);min-height:13px}
.mini canvas{width:100%;height:104px;margin-top:6px;display:block}
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
.caption{font-size:12px;color:var(--muted);margin:12px 2px 0;line-height:1.6}
footer{margin-top:44px;padding-top:16px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}
@media(max-width:600px){.sheet{padding:34px 18px 52px}.cards{grid-template-columns:1fr 1fr}.grid-sm,.meta{grid-template-columns:1fr}}
"""

METRICS = [("cost","費用","yen"),("imp","表示回数","k"),("clk","クリック","num"),
           ("ctr","CTR","pct"),("cpc","平均CPC","yen"),("cv","CV","num")]
def mini_cards():
    return "\n".join(
        f'<div class="mini"><div class="top"><h4>{name}</h4><span class="last" id="l_{k}"></span></div>'
        f'<div class="rng" id="r_{k}"></div><canvas id="c_{k}" width="620" height="200"></canvas></div>'
        for k,name,_ in METRICS)

HTML = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Google広告 今年vs昨年 — {html.escape(label)}</title>
<style>{CSS}</style></head><body><main class="sheet">
<header>
  <div class="eyebrow">Google広告 レポート ・ 今年({TY}) vs 昨年({LY})</div>
  <h1>Google広告：{html.escape(label)}</h1>
  <span class="draft">参考／下書き ・ 実データ（Google Ads API）</span>
  <dl class="meta">
    <div><dt>対象</dt><dd>customer {data['customer']}</dd></div>
    <div><dt>今年</dt><dd>{period_ty}（YTD）</dd></div>
    <div><dt>比較</dt><dd>昨年同期（{LY}年 同月）</dd></div>
    <div><dt>作成日</dt><dd class="num">2026-07-04</dd></div>
  </dl>
</header>

<section>
  <div class="sec-label">01 — 今年サマリ（YTD）／前年同期比</div>
  <div class="cards">{summary_cards()}</div>
</section>

<section>
  <div class="sec-label">02 — 月次推移（今年 vs 昨年）</div>
  <div class="yrlegend"><span><i style="background:#C2CDD1"></i>昨年 {LY}</span><span><i style="background:#1E6B77"></i>今年 {TY}</span></div>
  <div class="grid-sm">{mini_cards()}</div>
  <p class="caption">各指標を1〜12月で今年（濃線・点）と昨年（薄線）を重ね。見出しは今年の直近<b>完全月</b>値＋前年同月比。※集計途中の当月（7月）は除外。</p>
</section>

<section>
  <div class="sec-label">03 — 配信方法別（キャンペーンタイプ別・今年YTD）</div>
  {channel_section()}
  <p class="caption">今年(YTD)の配信方法ごとの内訳と合計。検索(Search)＝キーワード配信、P-MAX＝AIおまかせ（Googleの全面横断・非キーワード）。CPAは配信方法で大きく異なるため合計だけでなく方法別に評価する。</p>
</section>

<section>
  <div class="sec-label">04 — キーワード別分析（今年{TY}・費用上位30・検索KWのみ）</div>
  <div class="tbl"><table>
    <thead><tr><th>キーワード</th><th>型</th><th>費用</th><th>クリック</th><th>CTR</th><th>CPC</th><th>CV</th><th>CPA</th><th>判定</th></tr></thead>
    <tbody>{kw_rows()}</tbody></table></div>
  <p class="caption">※ <b>検索キーワードのみ</b>（P-MAX等は上の「配信方法別」参照）。型：B=部分一致 P=フレーズ E=完全一致。判定：無駄消化=費用¥20k+でCV0／高効率=CPA≤¥3,000／高CPA=CPA≥¥30,000。</p>
</section>

<section>
  <div class="sec-label">05 — 監査サマリ（Claude Ads）</div>
  {audit_section()}
  <p class="caption">Claude Ads（OSS/MIT・ads-google監査）の観点で実データを点検した要約。スコアは相対目安。要対応・注意項目は人間が確認し、適用は承認後のみ（CLAUDE.md §0）。</p>
</section>

<section>
  <div class="sec-label">06 — 注記</div>
  <p class="caption">実データ（Google Ads API）。今年={TY}（YTD）、比較=昨年同期（{LY}年同月）。出力は参考／下書き、適用は人間の承認後のみ（CLAUDE.md §0）。目標CPA未設定のため良否は相対評価。</p>
</section>

<footer><span>ソフトコミュニケーションズ ／ 広告運用 半自動化</span><span class="num">2026-07-04</span></footer>
</main>
<script>
const MONTHLY={json.dumps(M, ensure_ascii=False)};
const METRICS={json.dumps([{"k":k,"f":f} for k,_,f in METRICS], ensure_ascii=False)};
const TY={TY}, LY={LY};
const fmt={{yen:v=>'¥'+Math.round(v).toLocaleString(),k:v=>(v/1000).toFixed(v>=10000?0:1)+'k',num:v=>Math.round(v).toLocaleString(),pct:v=>v.toFixed(2)+'%'}};
const afmt={{yen:v=>v>=1000?'¥'+(v/1000).toFixed(0)+'k':'¥'+Math.round(v),k:v=>(v/1000).toFixed(0)+'k',num:v=>v>=1000?(v/1000).toFixed(0)+'k':''+Math.round(v),pct:v=>v.toFixed(1)+'%'}};
METRICS.forEach(mt=>{{
  const cv=document.getElementById('c_'+mt.k); if(!cv)return; const ctx=cv.getContext('2d');
  const W=cv.width,H=cv.height,padL=52,padR=8,padT=10,padB=20,plotW=W-padL-padR,plotH=H-padT-padB;
  const yr=y=>MONTHLY.filter(d=>+d.m.slice(0,4)===y).map(d=>({{mo:+d.m.slice(5,7),v:d[mt.k]}})).sort((a,b)=>a.mo-b.mo);
  const A=yr(TY),Bd=yr(LY); const all=[...A,...Bd].map(p=>p.v); let mn=Math.min(...all,0),mx=Math.max(...all); if(mx===mn)mx=mn+1;
  const X=m=>padL+plotW*((m-1)/11),Y=v=>padT+plotH*(1-(v-mn)/(mx-mn));
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='#EEF1F4';ctx.lineWidth=1;ctx.fillStyle='#aab2bd';ctx.font='15px sans-serif';ctx.textAlign='right';
  for(let g=0;g<=2;g++){{const yy=padT+plotH*g/2, vv=mx-(mx-mn)*g/2;ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(W-padR,yy);ctx.stroke();ctx.fillText(afmt[mt.f](vv),padL-5,yy+5);}}
  function line(p,col,w,dot){{ if(!p.length)return; ctx.beginPath();p.forEach((q,i)=>{{const x=X(q.mo),y=Y(q.v);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}});ctx.strokeStyle=col;ctx.lineWidth=w;ctx.lineJoin='round';ctx.stroke(); if(dot){{ctx.fillStyle=col;p.forEach(q=>{{ctx.beginPath();ctx.arc(X(q.mo),Y(q.v),3,0,7);ctx.fill();}});}} }}
  line(Bd,'#C2CDD1',1.8,false); line(A,'#1E6B77',2.8,true);
  ctx.fillStyle='#aab2bd';ctx.font='16px sans-serif';ctx.textAlign='center';[1,4,7,10,12].forEach(m=>ctx.fillText(m+'月',X(m),H-4));
  const cur=A[A.length-1]; const prev=cur?Bd.find(q=>q.mo===cur.mo):null;
  document.getElementById('l_'+mt.k).textContent=cur?("今年"+cur.mo+"月 "+fmt[mt.f](cur.v)):'';
  let yy='前年同月比 —'; if(cur&&prev&&prev.v){{const pc=(cur.v/prev.v-1)*100;yy='前年同月比 '+(pc>=0?'↑+':'↓')+Math.round(Math.abs(pc))+'%';}}
  document.getElementById('r_'+mt.k).textContent=yy;
}});
</script></body></html>"""

out.write_text(HTML, encoding="utf-8")
print(f"生成: {out}  今年{len(ty)}ヶ月 / 昨年同期{len(ly_same)}ヶ月 / KW{len(K)}")
print(f"今年YTD: 費用{yen(A['cost'])} CV{A['cv']:.0f} CPA{yen(A['cpa'])} ｜ 昨年同期: 費用{yen(B['cost'])} CV{B['cv']:.0f}")
