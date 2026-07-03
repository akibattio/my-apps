import React, { useState, useMemo, useEffect } from "react";
import {
  Bell, AlertTriangle, Check, X, Circle, TrendingUp, TrendingDown, Zap,
  ChevronRight, ShieldCheck, LayoutDashboard, Cable, Table2, KeyRound, Star,
  Users, ArrowLeft,
} from "lucide-react";

// ===== sample data (ダミー / 実データは Google Ads MCP・Meta Ads コネクタから供給) =====
const SAMPLE_DATA = [
  { id: 1, client: "エムライフ物販", tier: "large", monthly: 1800000, media: "google", acct: "742-118-9930", status: "ok", tokenDays: 55, cp: 8, sync: "今朝 09:00", spend: 341000, cpa: 3100, target: 3200, roas: 4.6, cv: 110, ctr: 4.1, is: 74 },
  { id: 2, client: "エムライフ物販", tier: "large", monthly: 1800000, media: "meta", acct: "act_60417", status: "ok", tokenDays: 999, cp: 6, sync: "今朝 09:00", spend: 288000, cpa: 2900, target: 3200, roas: 5.0, cv: 99, ctr: 1.8, is: null },
  { id: 3, client: "ハルナ美容外科", tier: "large", monthly: 2800000, media: "google", acct: "553-207-4412", status: "ok", tokenDays: 41, cp: 12, sync: "今朝 09:00", spend: 366000, cpa: 5900, target: 5500, roas: 3.4, cv: 62, ctr: 3.0, is: 63 },
  { id: 4, client: "ハルナ美容外科", tier: "large", monthly: 2800000, media: "meta", acct: "act_88120", status: "warn", tokenDays: 5, cp: 9, sync: "今朝 09:00", spend: 402000, cpa: 5200, target: 5500, roas: 3.9, cv: 77, ctr: 2.1, is: null },
  { id: 5, client: "ミナト水産EC", tier: "large", monthly: 1200000, media: "google", acct: "901-334-7781", status: "ok", tokenDays: 60, cp: 7, sync: "今朝 09:00", spend: 189000, cpa: 2800, target: 3000, roas: 5.1, cv: 67, ctr: 4.4, is: 79 },
  { id: 6, client: "ミナト水産EC", tier: "large", monthly: 1200000, media: "meta", acct: "act_33019", status: "ok", tokenDays: 999, cp: 5, sync: "今朝 09:00", spend: 156000, cpa: 2600, target: 3000, roas: 5.4, cv: 60, ctr: 2.3, is: null },
  { id: 7, client: "ヤマト保険相談", tier: "large", monthly: 1500000, media: "google", acct: "220-556-1043", status: "ok", tokenDays: 33, cp: 10, sync: "今朝 09:00", spend: 267000, cpa: 9800, target: 8000, roas: null, cv: 27, ctr: 1.7, is: 47 },
  { id: 8, client: "ソラ旅行", tier: "mid", monthly: 900000, media: "google", acct: "418-902-2277", status: "ok", tokenDays: 48, cp: 6, sync: "今朝 09:00", spend: 198000, cpa: 4700, target: 4500, roas: 3.8, cv: 42, ctr: 3.6, is: 66 },
  { id: 9, client: "ソラ旅行", tier: "mid", monthly: 900000, media: "meta", acct: "act_71554", status: "ok", tokenDays: 999, cp: 4, sync: "今朝 09:00", spend: 175000, cpa: 4400, target: 4500, roas: 4.1, cv: 40, ctr: 1.9, is: null },
  { id: 10, client: "サクラ不動産", tier: "mid", monthly: 600000, media: "meta", acct: "act_20881", status: "ok", tokenDays: 999, cp: 5, sync: "今朝 09:00", spend: 210000, cpa: 6100, target: 6000, roas: 2.8, cv: 34, ctr: 1.4, is: null },
  { id: 11, client: "アオヤマ歯科クリニック", tier: "small", monthly: 450000, media: "google", acct: "677-421-8890", status: "ok", tokenDays: 52, cp: 4, sync: "今朝 09:00", spend: 182000, cpa: 4200, target: 4000, roas: 3.1, cv: 43, ctr: 3.4, is: 68 },
  { id: 12, client: "アオヤマ歯科クリニック", tier: "small", monthly: 450000, media: "meta", acct: "act_50213", status: "ok", tokenDays: 999, cp: 3, sync: "今朝 09:00", spend: 96000, cpa: 5800, target: 4500, roas: 2.2, cv: 16, ctr: 1.1, is: null },
  { id: 13, client: "リクルートボックス採用", tier: "small", monthly: 400000, media: "google", acct: "339-771-6650", status: "ok", tokenDays: 29, cp: 5, sync: "今朝 09:00", spend: 154000, cpa: 8900, target: 7000, roas: null, cv: 17, ctr: 2.2, is: 51 },
  { id: 14, client: "フジ運送", tier: "small", monthly: 350000, media: "google", acct: "812-004-3391", status: "ok", tokenDays: 44, cp: 3, sync: "今朝 09:00", spend: 120000, cpa: 6600, target: 6000, roas: null, cv: 18, ctr: 2.0, is: 58 },
  { id: 15, client: "ノザワ整骨院", tier: "small", monthly: 250000, media: "meta", acct: "act_19007", status: "ok", tokenDays: 999, cp: 2, sync: "今朝 09:00", spend: 88000, cpa: 3300, target: 3500, roas: 3.6, cv: 27, ctr: 2.0, is: null },
  { id: 16, client: "カワイ楽器教室", tier: "small", monthly: 200000, media: "google", acct: "556-330-2218", status: "ok", tokenDays: 37, cp: 2, sync: "今朝 09:00", spend: 52000, cpa: 5100, target: 5000, roas: null, cv: 10, ctr: 2.5, is: 61 },
  { id: 17, client: "トキワ学習塾", tier: "small", monthly: 220000, media: "google", acct: "104-889-5567", status: "ok", tokenDays: 50, cp: 3, sync: "今朝 09:00", spend: 44000, cpa: 3800, target: 4000, roas: null, cv: 11, ctr: 2.8, is: 70 },
  { id: 18, client: "トキワ学習塾", tier: "small", monthly: 220000, media: "meta", acct: "act_44120", status: "error", tokenDays: 0, cp: 1, sync: "3日前", spend: 39000, cpa: 0, target: 4000, roas: 0, cv: 0, ctr: 0.6, is: null },
  { id: 19, client: "みどり工務店", tier: "small", monthly: 180000, media: "google", acct: "778-221-9934", status: "ok", tokenDays: 46, cp: 2, sync: "今朝 09:00", spend: 78000, cpa: 12400, target: 10000, roas: null, cv: 6, ctr: 1.9, is: 42 },
  { id: 20, client: "セント動物病院", tier: "small", monthly: 210000, media: "meta", acct: "act_66512", status: "ok", tokenDays: 999, cp: 2, sync: "今朝 09:00", spend: 71000, cpa: 4900, target: 5000, roas: 3.0, cv: 14, ctr: 1.5, is: null },
];

const SAMPLE_PROPOSALS = [
  { id: "p1", client: "トキワ学習塾", media: "meta", kind: "配信停止", cur: "CV 0件（7日）で ¥39,000 消化", next: "キャンペーンを一時停止", reason: "7日間CV0、CTRも0.6%と低くクリエイティブ疲弊。停止して原因を精査すべき。", severity: "critical", twoStep: false },
  { id: "p2", client: "ハルナ美容外科", media: "google", kind: "予算増額", cur: "日予算 ¥12,000 / IS損失(予算) 22%", next: "日予算を ¥14,500 に増額", reason: "ROAS3.4を維持しつつ予算による機会損失22%。大型のため二段階承認が必要。", severity: "info", twoStep: true },
  { id: "p3", client: "みどり工務店", media: "google", kind: "除外KW追加", cur: "「無料 diy」等 3語がCV0で費用消化", next: "除外KWに3語を追加", reason: "情報収集目的の語が費用の28%を占有。除外でCPAを目標¥10,000に近づく見込み。", severity: "warning", twoStep: false },
  { id: "p4", client: "ヤマト保険相談", media: "google", kind: "入札調整", cur: "CPA ¥9,800（目標比 +22%）", next: "上限CPAを ¥8,500 に引き下げ", reason: "CPAが目標を22%超過。大型のため二段階承認が必要。", severity: "warning", twoStep: true },
  { id: "p5", client: "アオヤマ歯科クリニック", media: "meta", kind: "クリエイティブ差し替え", cur: "訴求A：CTR 1.1%（低下傾向）", next: "新コピー2案を下書き作成（PAUSED）", reason: "主力のCTRが2週間で1.6%→1.1%へ低下。トーン&マナーに沿った新案を提案。", severity: "info", twoStep: false },
];

const yen = (n) => (n == null ? "—" : "¥" + n.toLocaleString("ja-JP"));
const man = (n) => (n ? (n / 10000).toLocaleString("ja-JP") + "万" : "—");
const SEV = {
  critical: { label: "要対応", dot: "#dc2626", chip: "#fef2f2", chipText: "#b91c1c" },
  warning: { label: "注意", dot: "#d97706", chip: "#fffbeb", chipText: "#b45309" },
  info: { label: "提案", dot: "#047857", chip: "#ecfdf5", chipText: "#047857" },
};
const CONN = {
  ok: { label: "正常", c: "#047857", bg: "#ecfdf5" },
  warn: { label: "期限接近", c: "#d97706", bg: "#fffbeb" },
  error: { label: "エラー", c: "#dc2626", bg: "#fef2f2" },
};
const HC = { good: "#047857", warning: "#d97706", critical: "#dc2626" };
const healthOf = (c) => (c.cv === 0 && c.spend > 0 ? "critical" : (c.target && c.cpa > c.target * 1.15) ? "warning" : "good");
const RANK = { good: 0, warning: 1, critical: 2 };
function alertsOf(accts) {
  const out = [];
  accts.forEach((c) => {
    if (c.cv === 0 && c.spend > 0) out.push({ sev: "critical", media: c.media, msg: `CV 0件で ${yen(c.spend)} 消化` });
    else if (c.target && c.cpa > c.target * 1.15) out.push({ sev: "warning", media: c.media, msg: `CPA ${yen(c.cpa)}（+${Math.round((c.cpa / c.target - 1) * 100)}%）` });
    else if (c.is != null && c.is < 50) out.push({ sev: "warning", media: c.media, msg: `IS ${c.is}%（機会損失大）` });
    if (c.status === "error") out.push({ sev: "critical", media: c.media, msg: "接続エラー（トークン失効）" });
    else if (c.status === "warn") out.push({ sev: "warning", media: c.media, msg: `トークン期限接近（残${c.tokenDays}日）` });
  });
  return out;
}
const worstHealth = (accts) => accts.reduce((w, c) => Math.max(w, RANK[healthOf(c)]), 0);

export default function AdOpsConsole() {
  const [view, setView] = useState("dash");
  const [media, setMedia] = useState("all");
  const [proposals, setProposals] = useState(SAMPLE_PROPOSALS);
  const [openClient, setOpenClient] = useState(null);
  const [DATA, setDATA] = useState(SAMPLE_DATA);
  const [dataInfo, setDataInfo] = useState(null);

  useEffect(() => {
    fetch("./data.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && Array.isArray(j.accounts) && j.accounts.length) {
          setDATA(j.accounts);
          if (Array.isArray(j.proposals)) setProposals(j.proposals);
          setDataInfo(j);
        }
      })
      .catch(() => {});
  }, []);

  const rows = useMemo(() => DATA.filter((c) => media === "all" || c.media === media), [media, DATA]);
  const totals = useMemo(() => agg(rows), [rows]);
  const pending = proposals.filter((p) => p.status == null);
  const connIssues = DATA.filter((c) => c.status !== "ok").length;
  const decide = (id, status) => setProposals((ps) => ps.map((p) => (p.id === id ? { ...p, status } : p)));

  const clients = useMemo(() => {
    const m = {};
    DATA.forEach((c) => {
      if (!m[c.client]) m[c.client] = { client: c.client, tier: c.tier, monthly: c.monthly, accts: [] };
      m[c.client].accts.push(c);
    });
    return Object.values(m);
  }, [DATA]);

  const goClient = (name) => { setOpenClient(name); setView("client"); };

  const alerts = rows.map((c) => {
    if (c.cv === 0 && c.spend > 0) return { c, sev: "critical", msg: `CV 0件のまま ${yen(c.spend)} を消化` };
    if (c.target && c.cpa > c.target * 1.15) return { c, sev: "warning", msg: `CPA ${yen(c.cpa)}（目標比 +${Math.round((c.cpa / c.target - 1) * 100)}%）` };
    if (c.is != null && c.is < 50) return { c, sev: "warning", msg: `IS ${c.is}%（機会損失大）` };
    return null;
  }).filter(Boolean);

  const NavBtn = ({ id, icon, label, badge }) => (
    <button onClick={() => { setView(id); if (id !== "client") setOpenClient(null); }} style={{
      display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8, border: "none",
      cursor: "pointer", fontSize: 13, fontWeight: 600,
      background: view === id ? "#0f2a1f" : "transparent", color: view === id ? "#fff" : "#a7c4b5" }}>
      {icon}{label}
      {badge > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
        background: view === id ? "#f4c542" : "#c98a2b", color: "#0f2a1f" }}>{badge}</span>}
    </button>
  );
  const MediaTab = ({ id, label }) => (
    <button onClick={() => setMedia(id)} style={{
      padding: "5px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
      border: "1px solid " + (media === id ? "#047857" : "#e2e8f0"),
      background: media === id ? "#047857" : "#fff", color: media === id ? "#fff" : "#475569" }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f6", color: "#0f172a",
      fontFamily: "-apple-system,'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif" }}>
      <div style={{ background: "#0f2a1f", color: "#fff", padding: "14px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>広告運用コンソール</div>
            <div style={{ fontSize: 11.5, color: "#a7c4b5" }}>ソフコミ ・ {dataInfo ? `実データ（${dataInfo.period || ""}・${dataInfo.generatedAt || ""}）` : "サンプルデータ"} ・ {clients.length}社 / {DATA.length}連携</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12.5 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#f4c542" }}><Bell size={15} /><b>{pending.length}</b><span style={{ color: "#a7c4b5" }}>承認待ち</span></span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: connIssues ? "#f4a3a3" : "#a7c4b5" }}><Cable size={15} /><b>{connIssues}</b><span style={{ color: "#a7c4b5" }}>接続要確認</span></span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#a7c4b5" }}><ShieldCheck size={14} /> 承認ゲート ON</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 12, flexWrap: "wrap" }}>
          <NavBtn id="dash" icon={<LayoutDashboard size={15} />} label="概要" badge={pending.length} />
          <NavBtn id="client" icon={<Users size={15} />} label="クライアント別" />
          <NavBtn id="conn" icon={<Cable size={15} />} label="接続ステータス" badge={connIssues} />
          <NavBtn id="list" icon={<Table2 size={15} />} label="費用・成果一覧" />
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1240, margin: "0 auto" }}>
        {(view === "dash" || view === "list") && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <MediaTab id="all" label="すべて" /><MediaTab id="google" label="Google" /><MediaTab id="meta" label="Meta" />
          </div>
        )}

        {/* ===== 概要 ===== */}
        {view === "dash" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { label: "総広告費", value: yen(totals.spend), sub: dataInfo ? dataInfo.period : "今月累計" },
                { label: "平均CPA", value: totals.cpa ? yen(totals.cpa) : "—", sub: totals.cv ? "" : "CV0のため算出不可" },
                { label: "合計CV", value: totals.cv + "件", sub: dataInfo ? dataInfo.period : "" },
                { label: "平均ROAS", value: totals.roas ? totals.roas.toFixed(1) + "x" : "—", sub: "計測対象のみ" },
                { label: "アラート", value: alerts.length + "件", sub: pending.length + "件が要判断", alert: true },
              ].map((k) => (
                <Card key={k.label}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: k.alert ? "#dc2626" : "#0f2a1f" }}>{k.value}</div>
                  <div style={{ fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 4, color: k.up ? "#047857" : k.down ? "#dc2626" : "#94a3b8" }}>
                    {k.up && <TrendingUp size={12} />}{k.down && <TrendingDown size={12} />}{k.sub}</div>
                </Card>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
              <div>
                <SectionTitle icon={<Zap size={16} color="#047857" />} title="承認キュー" note="AIの提案を確認して適用。適用されるのは承認した分だけ。" />
                {pending.length === 0 && <Empty text="承認待ちはありません。" />}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pending.map((p) => <ProposalCard key={p.id} p={p} decide={decide} onClient={goClient} />)}
                </div>
              </div>
              <div>
                <SectionTitle icon={<AlertTriangle size={16} color="#d97706" />} title="アラート" note="しきい値超えの項目。" />
                <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 10, overflow: "hidden" }}>
                  {alerts.map((a, i) => (
                    <div key={i} onClick={() => goClient(a.c.client)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", borderTop: i ? "1px solid #f1f5f4" : "none", cursor: "pointer" }}>
                      <Circle size={9} fill={SEV[a.sev].dot} color={SEV[a.sev].dot} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>{a.c.client}<MediaPill m={a.c.media} /></div>
                        <div style={{ fontSize: 11.5, color: "#64748b" }}>{a.msg}</div>
                      </div>
                      <ChevronRight size={14} color="#cbd5e1" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ===== クライアント別 ===== */}
        {view === "client" && !openClient && (
          <>
            <SectionTitle icon={<Users size={16} color="#047857" />} title="クライアント別" note="社をクリックすると、その社の接続・費用・成果・承認待ちがまとまって見えます。" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
              {[...clients].sort((x, y) => worstHealth(y.accts) - worstHealth(x.accts)).map((cl) => {
                const a = agg(cl.accts);
                const cAlerts = alertsOf(cl.accts);
                const wh = worstHealth(cl.accts);
                const hk = wh === 2 ? "critical" : wh === 1 ? "warning" : "good";
                const hlabel = hk === "good" ? "良好" : hk === "warning" ? "注意" : "要対応";
                return (
                  <button key={cl.client} onClick={() => setOpenClient(cl.client)} style={{ textAlign: "left", cursor: "pointer",
                    background: "#fff", border: "1px solid #e6ebe8", borderLeft: `3px solid ${HC[hk]}`, borderRadius: 12, padding: 15 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{cl.client}{cl.tier === "large" && <LargePill />}</div>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: HC[hk] }}>
                        <Circle size={8} fill={HC[hk]} color={HC[hk]} />{hlabel}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#64748b", margin: "3px 0 10px" }}>月額規模 {man(cl.monthly)}/月</div>
                    <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                      {cl.accts.map((x) => <MediaPill key={x.id} m={x.media} />)}
                    </div>
                    <div style={{ display: "flex", gap: 14, fontSize: 12, marginBottom: cAlerts.length ? 10 : 0 }}>
                      <MiniStat label="消化" value={yen(a.spend)} />
                      <MiniStat label="CPA" value={a.cpa ? yen(a.cpa) : "—"} bad={hk !== "good"} />
                      <MiniStat label="CV" value={a.cv + "件"} />
                    </div>
                    {cAlerts.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, borderTop: "1px solid #f1f5f4", paddingTop: 8 }}>
                        {cAlerts.map((al, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                            <Circle size={7} fill={SEV[al.sev].dot} color={SEV[al.sev].dot} />
                            <MediaPill m={al.media} /><span style={{ color: "#475569" }}>{al.msg}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {view === "client" && openClient && (() => {
          const cl = clients.find((c) => c.client === openClient);
          const a = agg(cl.accts);
          const cProps = proposals.filter((p) => p.client === openClient && p.status == null);
          const cAlerts = cl.accts.map((c) => {
            if (c.cv === 0 && c.spend > 0) return { c, sev: "critical", msg: `CV 0件のまま ${yen(c.spend)} を消化` };
            if (c.target && c.cpa > c.target * 1.15) return { c, sev: "warning", msg: `CPA ${yen(c.cpa)}（目標比 +${Math.round((c.cpa / c.target - 1) * 100)}%）` };
            if (c.is != null && c.is < 50) return { c, sev: "warning", msg: `IS ${c.is}%（機会損失大）` };
            return null;
          }).filter(Boolean);
          return (
            <>
              <button onClick={() => setOpenClient(null)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#047857", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12, padding: 0 }}>
                <ArrowLeft size={15} /> クライアント一覧に戻る
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 700 }}>{cl.client}</span>
                {cl.tier === "large" && <LargePill />}
                <span style={{ fontSize: 13, color: "#64748b" }}>月額規模 {man(cl.monthly)}/月</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, margin: "16px 0 22px" }}>
                <Card><MiniStat label="今月消化" value={yen(a.spend)} /></Card>
                <Card><MiniStat label="加重CPA" value={a.cpa ? yen(a.cpa) : "—"} /></Card>
                <Card><MiniStat label="平均ROAS" value={a.roas ? a.roas.toFixed(1) + "x" : "—"} /></Card>
                <Card><MiniStat label="合計CV" value={a.cv + "件"} /></Card>
                <Card><MiniStat label="接続" value={cl.accts.every((x) => x.status === "ok") ? "正常" : "要確認"} bad={!cl.accts.every((x) => x.status === "ok")} /></Card>
              </div>

              <SectionTitle icon={<Table2 size={16} color="#047857" />} title="媒体別" note="この社の各アカウントの接続と成果。" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12, marginBottom: 22 }}>
                {cl.accts.map((c) => {
                  const s = CONN[c.status]; const h = healthOf(c);
                  const tok = c.tokenDays >= 999 ? "無期限" : c.tokenDays === 0 ? "失効" : `残 ${c.tokenDays}日`;
                  const tokC = c.tokenDays >= 999 ? "#047857" : c.tokenDays === 0 ? "#dc2626" : c.tokenDays <= 7 ? "#d97706" : "#475569";
                  return (
                    <div key={c.id} style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, padding: 15 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <MediaPill m={c.media} />
                        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: s.c }}><Circle size={8} fill={s.c} color={s.c} />{s.label}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "#64748b", fontFamily: "monospace", marginBottom: 3 }}>{c.acct}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: tokC, fontWeight: 600, marginBottom: 12 }}>
                        <KeyRound size={12} />トークン {tok} ・ 稼働 {c.cp}本 ・ 同期 {c.sync}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12 }}>
                        <MiniStat label="消化" value={yen(c.spend)} />
                        <MiniStat label="CPA/目標" value={(c.cpa ? yen(c.cpa) : "—") } bad={c.cpa > c.target * 1.15} />
                        <MiniStat label="ROAS" value={c.roas ? c.roas + "x" : "—"} />
                        <MiniStat label="CV" value={c.cv + "件"} />
                        <MiniStat label="CTR" value={c.ctr + "%"} />
                        <MiniStat label="状態" value={h === "good" ? "良好" : h === "warning" ? "注意" : "要対応"} bad={h !== "good"} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <SectionTitle icon={<Zap size={16} color="#047857" />} title="この社の承認待ち" note={cProps.length ? "" : "承認待ちはありません。"} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: cProps.length ? 22 : 8 }}>
                {cProps.map((p) => <ProposalCard key={p.id} p={p} decide={decide} onClient={null} hideClient />)}
              </div>

              {cAlerts.length > 0 && (
                <>
                  <SectionTitle icon={<AlertTriangle size={16} color="#d97706" />} title="この社のアラート" />
                  <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 10, overflow: "hidden" }}>
                    {cAlerts.map((al, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", borderTop: i ? "1px solid #f1f5f4" : "none" }}>
                        <Circle size={9} fill={SEV[al.sev].dot} color={SEV[al.sev].dot} />
                        <MediaPill m={al.c.media} /><span style={{ fontSize: 12.5, color: "#475569" }}>{al.msg}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          );
        })()}

        {/* ===== 接続ステータス ===== */}
        {view === "conn" && (
          <>
            <SectionTitle icon={<Cable size={16} color="#047857" />} title="接続ステータス" note="何がアクティブで、どのアカウントに繋がっているか。行クリックで社別に。" />
            <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, overflow: "hidden" }}>
              <TableHead which="conn" cols={["クライアント", "連携先", "アカウントID", "接続状態", "トークン期限", "稼働CP", "最終同期"]} />
              {DATA.map((c, i) => {
                const s = CONN[c.status];
                const tok = c.tokenDays >= 999 ? "無期限" : c.tokenDays === 0 ? "失効" : `残 ${c.tokenDays}日`;
                const tokC = c.tokenDays >= 999 ? "#047857" : c.tokenDays === 0 ? "#dc2626" : c.tokenDays <= 7 ? "#d97706" : "#475569";
                return (
                  <div key={c.id} onClick={() => goClient(c.client)} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 1fr 0.9fr 0.9fr 0.6fr 0.8fr", alignItems: "center", padding: "10px 14px", fontSize: 12.5, borderTop: i ? "1px solid #f1f5f4" : "none", background: c.status !== "ok" ? s.bg : "#fff", cursor: "pointer" }}>
                    <span style={{ fontWeight: 600 }}>{c.client}{c.tier === "large" && <LargePill />}</span>
                    <span><MediaPill m={c.media} /></span>
                    <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 11.5 }}>{c.acct}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, color: s.c, fontWeight: 600 }}><Circle size={8} fill={s.c} color={s.c} />{s.label}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: tokC, fontWeight: 600 }}><KeyRound size={12} />{tok}</span>
                    <span style={{ color: "#475569" }}>{c.cp}本</span>
                    <span style={{ color: c.sync === "今朝 09:00" ? "#94a3b8" : "#dc2626" }}>{c.sync}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 12, fontSize: 11.5, color: "#64748b", lineHeight: 1.7 }}>
              ・Metaは無期限のSystem User Tokenを組織で保有（担当者の個人アカウントに依存しない）。<br />
              ・期限が近い／失効した接続は赤く表示。引き継ぎ時も一目で分かる。
            </div>
          </>
        )}

        {/* ===== 費用・成果一覧 ===== */}
        {view === "list" && (
          <>
            <SectionTitle icon={<Table2 size={16} color="#047857" />} title="費用・成果一覧" note="行クリックで社別ビューへ。大型は★。" />
            <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, overflow: "hidden" }}>
              <TableHead which="list" cols={["クライアント", "媒体", "月額規模", "今月消化", "CPA / 目標", "ROAS", "CV", "状態"]} />
              {rows.map((c, i) => {
                const h = healthOf(c);
                return (
                  <div key={c.id} onClick={() => goClient(c.client)} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.9fr 0.9fr 1.1fr 0.6fr 0.5fr 0.7fr", alignItems: "center", padding: "10px 14px", fontSize: 12.5, borderTop: i ? "1px solid #f1f5f4" : "none", cursor: "pointer" }}>
                    <span style={{ fontWeight: 600 }}>{c.client}{c.tier === "large" && <LargePill />}</span>
                    <span><MediaPill m={c.media} /></span>
                    <span style={{ color: "#475569" }}>{man(c.monthly)}/月</span>
                    <span style={{ color: "#0f2a1f" }}>{yen(c.spend)}</span>
                    <span style={{ color: c.cpa > c.target * 1.15 ? "#dc2626" : "#475569", fontWeight: c.cpa > c.target * 1.15 ? 700 : 400 }}>{c.cpa ? yen(c.cpa) : "—"} <span style={{ color: "#94a3b8", fontWeight: 400 }}>/ {yen(c.target)}</span></span>
                    <span style={{ color: "#475569" }}>{c.roas ? c.roas + "x" : "—"}</span>
                    <span style={{ color: "#475569" }}>{c.cv}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, color: HC[h], fontWeight: 600 }}><Circle size={8} fill={HC[h]} color={HC[h]} />{h === "good" ? "良好" : h === "warning" ? "注意" : "要対応"}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ marginTop: 20, fontSize: 11, color: "#94a3b8", lineHeight: 1.7 }}>
          ※ サンプルデータのプロトタイプ。実運用ではこの裏に Google Ads MCP / Meta Ads コネクタをつなぎ、毎朝のRoutinesで取得・分析・提案生成。判断基準はCLAUDE.mdルールブックに集約し、経験の浅い運用者でも同品質の提案が届く設計。書き込みは承認後にのみ実行。
        </div>
      </div>
    </div>
  );
}

function agg(list) {
  const spend = list.reduce((s, c) => s + c.spend, 0);
  const cv = list.reduce((s, c) => s + c.cv, 0);
  const cpa = cv ? Math.round(spend / cv) : 0;
  const r = list.filter((c) => c.roas);
  const roas = r.length ? r.reduce((s, c) => s + c.roas, 0) / r.length : 0;
  return { spend, cv, cpa, roas };
}
const btnP = { display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, border: "none", background: "#047857", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnS = { display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" };

function ProposalCard({ p, decide, onClient, hideClient }) {
  const s = SEV[p.severity];
  return (
    <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderLeft: `3px solid ${s.dot}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {!hideClient && <button onClick={() => onClient && onClient(p.client)} style={{ fontWeight: 700, fontSize: 14, background: "none", border: "none", padding: 0, cursor: onClient ? "pointer" : "default", color: "#0f2a1f" }}>{p.client}</button>}
          <MediaPill m={p.media} /><span style={{ fontSize: 11, color: "#64748b" }}>{p.kind}</span>
          {p.twoStep && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: "#eef2ff", color: "#4338ca" }}>二段階承認</span>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: s.chip, color: s.chipText }}>{s.label}</span>
      </div>
      <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ color: "#64748b" }}>{p.cur}</span><ChevronRight size={14} color="#94a3b8" /><span style={{ fontWeight: 700, color: "#0f2a1f" }}>{p.next}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "#475569", background: "#f8faf9", borderRadius: 8, padding: "8px 10px", marginBottom: 10, lineHeight: 1.6 }}><b style={{ color: "#047857" }}>AI </b>{p.reason}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => decide(p.id, "approved")} style={btnP}><Check size={15} />{p.twoStep ? "レビュー承認" : "承認して適用"}</button>
        <button onClick={() => decide(p.id, "rejected")} style={btnS}><X size={15} /> 却下</button>
      </div>
    </div>
  );
}
function Card({ children }) { return <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, padding: "14px 16px" }}>{children}</div>; }
function SectionTitle({ icon, title, note }) {
  return (<div style={{ marginBottom: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 7 }}>{icon}<span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span></div>{note && <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>{note}</div>}</div>);
}
function TableHead({ cols, which }) {
  const tmpl = which === "conn" ? "1.4fr 0.8fr 1fr 0.9fr 0.9fr 0.6fr 0.8fr" : "1.4fr 0.7fr 0.9fr 0.9fr 1.1fr 0.6fr 0.5fr 0.7fr";
  return (<div style={{ display: "grid", gridTemplateColumns: tmpl, padding: "9px 14px", background: "#f2f5f3", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 0.3 }}>{cols.map((c) => <span key={c}>{c}</span>)}</div>);
}
function MediaPill({ m }) {
  const g = m === "google";
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999, margin: "0 2px", background: g ? "#e8f0fe" : "#eef0ff", color: g ? "#1a56db" : "#4338ca" }}>{g ? "Google" : "Meta"}</span>;
}
function LargePill() {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, marginLeft: 6, background: "#fdf6e3", color: "#b45309" }}><Star size={9} fill="#b45309" color="#b45309" />大型</span>;
}
function MiniStat({ label, value, bad }) {
  return <div><div style={{ fontSize: 10.5, color: "#94a3b8" }}>{label}</div><div style={{ fontSize: 14, fontWeight: 700, color: bad ? "#dc2626" : "#0f2a1f" }}>{value}</div></div>;
}
function Empty({ text }) { return <div style={{ background: "#fff", border: "1px dashed #d7e0db", borderRadius: 10, padding: "18px 14px", fontSize: 12.5, color: "#94a3b8", textAlign: "center" }}>{text}</div>; }
