import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Bell, AlertTriangle, Check, X, Circle, TrendingUp, TrendingDown, Zap,
  ChevronRight, ShieldCheck, LayoutDashboard, Cable, Table2, KeyRound, Star,
  Users, ArrowLeft, Target, Clock,
} from "lucide-react";

// ===== sample data（ダミー / 実データは Google Ads・Meta から供給） =====
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
const num = (n) => (n == null ? "—" : n.toLocaleString("ja-JP"));
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
const HC = { good: "#047857", unset: "#94a3b8", warning: "#d97706", critical: "#dc2626" };
const HLABEL = { good: "良好", unset: "目標未設定", warning: "注意", critical: "要対応" };
const cpcOf = (c) => (c.metrics && c.metrics.d7 ? c.metrics.d7.cpc : null);
const cpcOver = (c) => { const mx = c.bench && c.bench.cpcMax, v = cpcOf(c); return mx && v && v > mx; };
// 健全性判定：CV0(critical)／CPA超過・CPC超過・IS低下(warning)／目標未設定は判定不可(unset＝良好にしない)／それ以外good
const healthOf = (c) => {
  if (c.cv === 0 && (c.spend || 0) > 0) return "critical";
  if ((c.target && c.cpa > c.target * 1.15) || cpcOver(c) || (c.is != null && c.is < 50)) return "warning";
  if (!c.target && (c.spend || 0) > 0) return "unset";
  return "good";
};
const RANK = { good: 0, unset: 1, warning: 2, critical: 3 };
const rankToHk = (r) => (r >= 3 ? "critical" : r === 2 ? "warning" : r === 1 ? "unset" : "good");
// 配信ステータス：直近7日にインプレッション（or 消化）があれば配信中、無ければ停止中
const deliveryOf = (c) => { const m = (c.metrics && c.metrics.d7) || {}; return ((m.imp || 0) > 0 || (m.spend || 0) > 0) ? "active" : "paused"; };
// 媒体（Google広告/Meta広告マネージャ）の該当ページURL。alertの種類(kind)から「修正する画面」を選ぶ。
const onlyDigits = (s) => (s || "").replace(/\D/g, "");
function googleSection(kind) {
  const k = kind || "";
  if (/検索クエリ|不要検索|除外/.test(k)) return "keywords/searchterms";   // 検索語句（除外KW追加）
  if (/CTR|クリエイティブ|広告文|LP/.test(k)) return "ads";                 // 広告
  if (/コンバージョン|計測/.test(k)) return "conversions";                 // コンバージョン設定
  if (/アセット|広告表示オプション/.test(k)) return "assetgroup";           // アセット
  if (/CPC|品質スコア|キーワード|入札/.test(k)) return "keywords";          // キーワード
  if (/インプ|消化|予算|停止|アカウント整理|配信|再配分/.test(k)) return "campaigns"; // キャンペーン（予算/配信）
  return "overview";
}
function platformUrl(media, acct, mcc, kind) {
  const d = onlyDigits(acct);
  if (!d) return null;
  if (media === "google") return `https://ads.google.com/aw/${googleSection(kind)}?__c=${onlyDigits(mcc)}&uscid=${d}`;
  if (media === "meta") return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${d}`;
  // LINEヤフー広告：検索/ディスプレイで管理画面が別。アカウントIDでキャンペーン管理へ。
  if (media === "yahoo_search") return `https://ads-search.yahoo.co.jp/#/campaigns?accountId=${d}`;
  if (media === "yahoo_display") return `https://ads-display.yahoo.co.jp/#/campaigns?accountId=${d}`;
  return null;
}
// 媒体キー→表示ラベル/系統。yahoo_search/yahoo_display はまとめて "yahoo" 扱い（フィルタ用）。
function mediaFamily(m) { return (m || "").indexOf("yahoo") === 0 ? "yahoo" : m; }
function DeliveryBadge({ c }) {
  const on = deliveryOf(c) === "active";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: on ? "#ecfdf5" : "#f1f5f4", color: on ? "#047857" : "#64748b" }}>
      <Circle size={7} fill={on ? "#047857" : "#94a3b8"} color={on ? "#047857" : "#94a3b8"} />{on ? "配信中" : "停止中"}
    </span>
  );
}
function alertsOf(accts) {
  const out = [];
  accts.forEach((c) => {
    if (c.cv === 0 && c.spend > 0) out.push({ sev: "critical", media: c.media, msg: `CV 0件で ${yen(c.spend)} 消化` });
    else if (c.target && c.cpa > c.target * 1.15) out.push({ sev: "warning", media: c.media, msg: `CPA ${yen(c.cpa)}（+${Math.round((c.cpa / c.target - 1) * 100)}%）` });
    else if (c.is != null && c.is < 50) out.push({ sev: "warning", media: c.media, msg: `IS ${c.is}%（機会損失大）` });
    if (cpcOver(c)) out.push({ sev: "warning", media: c.media, msg: `CPC ${yen(cpcOf(c))}（上限${yen(c.bench.cpcMax)}超）` });
    if (c.status === "error") out.push({ sev: "critical", media: c.media, msg: "接続エラー（トークン失効）" });
    else if (c.status === "warn") out.push({ sev: "warning", media: c.media, msg: `トークン期限接近（残${c.tokenDays}日）` });
  });
  return out;
}
const worstHealth = (accts) => accts.reduce((w, c) => Math.max(w, RANK[healthOf(c)]), 0);

export default function AdOpsConsole() {
  const [view, setView] = useState("dash");
  const [media, setMedia] = useState("all");
  const [flagFilter, setFlagFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [proposals, setProposals] = useState(SAMPLE_PROPOSALS);
  const [openClient, setOpenClient] = useState(null);
  const [DATA, setDATA] = useState(SAMPLE_DATA);
  const [dataInfo, setDataInfo] = useState(null);
  const [targets, setTargets] = useState({});
  const [history, setHistory] = useState([]);
  const [operator, setOperator] = useState("");
  const [alertOps, setAlertOps] = useState({});
  const [approvals, setApprovals] = useState({});
  const [listMonth, setListMonth] = useState(() => new Date().toISOString().slice(0, 7)); // 契約一覧の対象月
  const [reportClient, setReportClient] = useState(""); // レポートタブの対象クライアント
  const [reportMonth, setReportMonth] = useState(""); // レポートタブの対象月（既定＝先月）
  const [budgets, setBudgets] = useState({}); // クライアント別 契約予算（媒体別内訳＋月次の変更/追加）
  const [showLog, setShowLog] = useState(false);
  useEffect(() => {
    try {
      setTargets(JSON.parse(localStorage.getItem("adops_targets") || "{}"));
      setHistory(JSON.parse(localStorage.getItem("adops_targets_history") || "[]"));
      setOperator(localStorage.getItem("adops_operator") || "");
      setAlertOps(JSON.parse(localStorage.getItem("adops_alert_ops") || "{}"));
      setApprovals(JSON.parse(localStorage.getItem("adops_approvals") || "{}"));
      setBudgets(JSON.parse(localStorage.getItem("adops_budgets") || "{}"));
    } catch (e) {}
  }, []);

  // 共有ストレージ(Cloudflare KV)：目標設定・アラート対応・承認をスタッフ間で同期。KV未バインド時はlocalStorageのまま。
  const putState = (section, data) => {
    fetch(`./api/state/${section}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).catch(() => {});
  };
  const applyShared = (j) => {
    if (!j || j.error) return false; // kv_unbound 等 → 共有なし
    if (j.targets) setTargets(j.targets);
    if (Array.isArray(j.targetsHistory)) setHistory(j.targetsHistory);
    if (j.alertOps) setAlertOps(j.alertOps);
    if (j.approvals) setApprovals(j.approvals);
    if (j.budgets) setBudgets(j.budgets);
    return true;
  };
  useEffect(() => {
    // 起動時：KVから共有状態を読み込み。空なら手元(localStorage)を初回移行としてKVへ。
    fetch("./api/state", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j || j.error) return;
      const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || d); } catch (e) { return JSON.parse(d); } };
      const has = (o) => o && (Array.isArray(o) ? o.length : Object.keys(o).length);
      if (has(j.targets)) setTargets(j.targets); else { const t = ls("adops_targets", "{}"); if (has(t)) putState("targets", t); }
      if (has(j.targetsHistory)) setHistory(j.targetsHistory); else { const h = ls("adops_targets_history", "[]"); if (has(h)) putState("targetsHistory", h); }
      if (has(j.alertOps)) setAlertOps(j.alertOps); else { const a = ls("adops_alert_ops", "{}"); if (has(a)) putState("alertOps", a); }
      if (has(j.approvals)) setApprovals(j.approvals); else { const a = ls("adops_approvals", "{}"); if (has(a)) putState("approvals", a); }
      if (has(j.budgets)) setBudgets(j.budgets); else { const bg = ls("adops_budgets", "{}"); if (has(bg)) putState("budgets", bg); }
    }).catch(() => {});
    // 定期同期：45秒ごとに共有状態を取得（他スタッフの変更を自分の画面へ反映）
    const id = setInterval(() => {
      fetch("./api/state", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(applyShared).catch(() => {});
    }, 45000);
    return () => clearInterval(id);
  }, []);
  // アラート対応（確認済み/様子見/メモ）— localStorage＋共有(KV)に保存
  const saveAlertOps = (next) => { setAlertOps(next); try { localStorage.setItem("adops_alert_ops", JSON.stringify(next)); } catch (e) {} putState("alertOps", next); };
  const setAlertOp = (key, patch) => {
    const cur = alertOps[key] || {};
    saveAlertOps({ ...alertOps, [key]: { ...cur, ...patch, at: new Date().toLocaleString("ja-JP"), by: (operator || "").trim() || "担当" } });
  };
  const clearAlertOp = (key) => { const n = { ...alertOps }; delete n[key]; saveAlertOps(n); };
  const saveOperator = (v) => { setOperator(v); try { localStorage.setItem("adops_operator", v); } catch (e) {} };
  const saveTargets = (t) => {
    // 変更差分を履歴に記録（誰が・いつ・何を・変更前後の値）— CLAUDE.md §4
    const at = new Date().toLocaleString("ja-JP");
    const by = (operator || "").trim() || "担当";
    const names = new Set([...Object.keys(targets), ...Object.keys(t)]);
    const entries = [];
    names.forEach((name) => {
      [["targetCpa", "目標CPA"], ["cpcMax", "CPC上限"], ["monthly", "月予算"], ["cadence", "監視頻度"]].forEach(([f, jp]) => {
        const o = targets[name] ? targets[name][f] : undefined;
        const n = t[name] ? t[name][f] : undefined;
        if ((o == null ? null : o) !== (n == null ? null : n))
          entries.push({ at, by, client: name, field: jp, from: o == null ? null : o, to: n == null ? null : n });
      });
    });
    setTargets(t);
    try { localStorage.setItem("adops_targets", JSON.stringify(t)); } catch (e) {}
    putState("targets", t); // 共有(KV)へ
    if (entries.length) {
      const h = [...entries, ...history];
      setHistory(h);
      try { localStorage.setItem("adops_targets_history", JSON.stringify(h)); } catch (e) {}
      putState("targetsHistory", h);
    }
  };

  const [daily, setDaily] = useState(null);
  const [audit, setAudit] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [keywords, setKeywords] = useState(null);
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
    fetch("./daily.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && Array.isArray(j.accounts)) setDaily(j); })
      .catch(() => {});
    fetch("./audit.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && j.byAccount) setAudit(j); })
      .catch(() => {});
    fetch("./monthly.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && j.byAccount) setMonthly(j); })
      .catch(() => {});
    fetch("./keywords.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && j.byAccount) setKeywords(j); })
      .catch(() => {});
  }, []);
  const auditMap = useMemo(() => (audit && audit.byAccount) || {}, [audit]);
  const monthlyMap = useMemo(() => (monthly && monthly.byAccount) || {}, [monthly]);
  const keywordMap = useMemo(() => (keywords && keywords.byAccount) || {}, [keywords]);
  const monthlyGen = monthly && monthly.generated;
  // 日次時系列を client|media で引けるマップに（{days, byType}。Googleのみ・Metaは空）
  const dailyMap = useMemo(() => {
    const m = {};
    if (daily && daily.accounts) daily.accounts.forEach((a) => { m[`${a.client}|${a.media}`] = { days: a.days || [], byType: a.byType || {} }; });
    return m;
  }, [daily]);

  // ブラウザの戻る/進むを効かせる（URLハッシュと画面状態を同期）
  useEffect(() => {
    const parse = () => {
      const h = decodeURIComponent((window.location.hash || "").replace(/^#/, ""));
      if (h.indexOf("client/") === 0) { setOpenClient(h.slice(7)); setView("client"); }
      else if (["dash", "list", "contracts", "report", "conn", "targets", "summary"].indexOf(h) >= 0) { setView(h); setOpenClient(null); }
      else { setView("dash"); setOpenClient(null); }
    };
    parse();
    window.addEventListener("hashchange", parse);
    return () => window.removeEventListener("hashchange", parse);
  }, []);
  // 画面状態が変わったらハッシュに反映（履歴に積まれ、戻るボタンで戻れる）
  const hashInit = useRef(false);
  useEffect(() => {
    if (!hashInit.current) { hashInit.current = true; return; } // 初回は上書きしない（深リンク保持）
    const target = (view === "client" && openClient) ? `#client/${encodeURIComponent(openClient)}` : `#${view}`;
    if (window.location.hash !== target) window.location.hash = target;
  }, [view, openClient]);

  // 手入力の目標(localStorage)を各アカウントに反映：target/monthly/bench.targetCpa を上書き
  const A = useMemo(() => DATA.map((c) => {
    const t = targets[c.client];
    if (!t) return c;
    return {
      ...c,
      target: t.targetCpa != null ? t.targetCpa : c.target,
      monthly: t.monthly != null ? t.monthly : c.monthly,
      bench: { ...(c.bench || {}), ...(t.targetCpa != null ? { targetCpa: t.targetCpa } : {}),
        source: t.targetCpa != null ? "個社目標(手入力)" : (c.bench && c.bench.source) },
    };
  }), [DATA, targets]);

  const rows = useMemo(() => A.filter((c) => media === "all" || mediaFamily(c.media) === media), [media, A]);
  const hasYahoo = useMemo(() => A.some((c) => mediaFamily(c.media) === "yahoo"), [A]);
  const totals = useMemo(() => agg(rows), [rows]);
  const pKey = (p) => `${p.client}|${p.media}|${p.kind}`;
  const acctOf = (client, media) => (A.find((c) => c.client === client && c.media === media) || {}).acct;
  const propUrl = (p) => platformUrl(p.media, acctOf(p.client, p.media), dataInfo && dataInfo.googleMcc, p.kind);
  const pending = proposals.filter((p) => !approvals[pKey(p)]);
  const connIssues = A.filter((c) => c.status !== "ok").length;
  const noTargetCount = A.filter((c) => !c.target && (c.spend || 0) > 0).length;
  // 承認/却下を記録（この端末＋ログ）。却下は理由を記録（CLAUDE.md §4）。書き込み(適用)はしない＝意思決定の記録のみ。
  const decide = (p, decision) => {
    let reason = "";
    if (decision === "rejected") { reason = (window.prompt("却下の理由（記録されます）", "") || "").trim(); }
    const key = pKey(p);
    const next = { ...approvals, [key]: { decision, reason, by: (operator || "").trim() || "担当", at: new Date().toLocaleString("ja-JP"), client: p.client, media: p.media, kind: p.kind, next: p.next } };
    setApprovals(next);
    try { localStorage.setItem("adops_approvals", JSON.stringify(next)); } catch (e) {}
    putState("approvals", next);
  };
  const undecide = (key) => { const n = { ...approvals }; delete n[key]; setApprovals(n); try { localStorage.setItem("adops_approvals", JSON.stringify(n)); } catch (e) {} putState("approvals", n); };
  const approvalLog = Object.entries(approvals).map(([key, v]) => ({ key, ...v }));
  // クライアント別 契約予算（契約ベース＋月次の変更/追加）— localStorage＋共有(KV)
  const saveBudgets = (next) => { setBudgets(next); try { localStorage.setItem("adops_budgets", JSON.stringify(next)); } catch (e) {} putState("budgets", next); };

  const clients = useMemo(() => {
    const m = {};
    A.forEach((c) => {
      if (!m[c.client]) m[c.client] = { client: c.client, tier: c.tier, monthly: c.monthly, accts: [] };
      m[c.client].accts.push(c);
    });
    return Object.values(m);
  }, [A]);

  const goClient = (name) => { setOpenClient(name); setView("client"); };

  const alerts = rows.map((c) => {
    if (c.cv === 0 && c.spend > 0) return { c, sev: "critical", msg: `CV 0件のまま ${yen(c.spend)} を消化` };
    if (c.target && c.cpa > c.target * 1.15) return { c, sev: "warning", msg: `CPA ${yen(c.cpa)}（目標比 +${Math.round((c.cpa / c.target - 1) * 100)}%）` };
    if (cpcOver(c)) return { c, sev: "warning", msg: `CPC ${yen(cpcOf(c))}（上限${yen(c.bench.cpcMax)}超）` };
    if (c.is != null && c.is < 50) return { c, sev: "warning", msg: `IS ${c.is}%（機会損失大）` };
    return null;
  }).filter(Boolean);

  // ① 今日の要対応：monitor.py が出したサーバー側アラート（急変検知・対応先つき）を最優先で表示。
  //   接続/トークンの問題（サーバー未検知）はクライアント側で補い、重要度順に並べる。
  const SEVRANK = { critical: 0, warning: 1, info: 2 };
  const serverAlerts = useMemo(() => {
    const hasServer = dataInfo && Array.isArray(dataInfo.alerts);
    let items;
    if (hasServer) {
      const normSev = (s) => (s === "warn" ? "warning" : (s === "crit" ? "critical" : (s || "warning")));
      items = dataInfo.alerts.map((a) => ({
        client: a.client, media: a.media, kind: a.kind || "",
        fact: a.fact || a.msg || "", severity: normSev(a.severity), action: a.approve || null,
      }));
      A.forEach((c) => {
        if (c.status === "error") items.push({ client: c.client, media: c.media, kind: "接続エラー", fact: `トークン失効（最終同期 ${c.sync}）`, severity: "critical", action: "接続担当へ即連絡" });
        else if (c.status === "warn") items.push({ client: c.client, media: c.media, kind: "トークン期限接近", fact: `残 ${c.tokenDays}日`, severity: "warning", action: "担当（トークン更新）" });
      });
    } else {
      items = alerts.map((a) => ({ client: a.c.client, media: a.c.media, kind: "", fact: a.msg, severity: a.sev, action: null }));
    }
    const mcc = dataInfo && dataInfo.googleMcc;
    return items
      .map((a) => {
        const acc = A.find((c) => c.client === a.client && c.media === a.media);
        return { ...a, key: `${a.client}|${a.media}|${a.kind}`, url: platformUrl(a.media, acc && acc.acct, mcc, a.kind) };
      })
      .filter((a) => media === "all" || mediaFamily(a.media) === media)
      .sort((x, y) => (SEVRANK[x.severity] ?? 3) - (SEVRANK[y.severity] ?? 3));
  }, [dataInfo, A, media, alerts]);
  // 対応管理で「確認済み/様子見(期限内)」は主リストから外す
  const alertActive = serverAlerts.filter((a) => {
    const op = alertOps[a.key];
    if (!op) return true;
    if (op.status === "ack") return false;
    if (op.status === "snooze" && op.until && new Date(op.until).getTime() > Date.now()) return false;
    return true;
  });
  const alertHandled = serverAlerts.filter((a) => !alertActive.includes(a));

  // クライアント別の健全性に「今日の要対応」を反映するため、社ごとの最悪アラート重要度を集計
  const alertRankByClient = useMemo(() => {
    const m = {};
    serverAlerts.forEach((a) => {
      const r = a.severity === "critical" ? 3 : a.severity === "warning" ? 2 : 0;
      if (r > (m[a.client] || 0)) m[a.client] = r;
    });
    return m;
  }, [serverAlerts]);
  // 社の健全性＝しきい値判定(worstHealth) と アラート の重い方
  const clientRank = (cl) => Math.max(worstHealth(cl.accts), alertRankByClient[cl.client] || 0);
  const clientHk = (cl) => rankToHk(clientRank(cl));
  // アカウント(client|media)ごとの最悪アラート重要度
  const alertRankByAcct = useMemo(() => {
    const m = {};
    serverAlerts.forEach((a) => {
      const k = `${a.client}|${a.media}`;
      const r = a.severity === "critical" ? 3 : a.severity === "warning" ? 2 : 0;
      if (r > (m[k] || 0)) m[k] = r;
    });
    return m;
  }, [serverAlerts]);
  // アカウントの健全性＝しきい値判定 と アラート の重い方
  const acctHk = (c) => rankToHk(Math.max(RANK[healthOf(c)], alertRankByAcct[`${c.client}|${c.media}`] || 0));

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
      <div className="no-print" style={{ background: "#0f2a1f", color: "#fff", padding: "14px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>広告運用コンソール</div>
            <div style={{ fontSize: 11.5, color: "#a7c4b5" }}>ソフコミ ・ {dataInfo ? `実データ（${dataInfo.period || ""}・${dataInfo.generatedAt || ""}）` : "サンプルデータ"} ・ {clients.length}社 / {A.length}連携</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12.5 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#f4c542" }}><Bell size={15} /><b>{pending.length}</b><span style={{ color: "#a7c4b5" }}>承認待ち</span></span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: connIssues ? "#f4a3a3" : "#a7c4b5" }}><Cable size={15} /><b>{connIssues}</b><span style={{ color: "#a7c4b5" }}>接続要確認</span></span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#a7c4b5" }}><ShieldCheck size={14} /> 承認ゲート ON</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 12, flexWrap: "wrap" }}>
          <NavBtn id="dash" icon={<LayoutDashboard size={15} />} label="ダッシュボード" badge={alertActive.length} />
          <NavBtn id="list" icon={<Table2 size={15} />} label="費用・成果一覧（媒体別）" />
          <NavBtn id="contracts" icon={<span style={{ fontSize: 14 }}>💰</span>} label="契約一覧" />
          <NavBtn id="report" icon={<span style={{ fontSize: 14 }}>📄</span>} label="レポート" />
          <NavBtn id="conn" icon={<Cable size={15} />} label="接続ステータス" badge={connIssues} />
          <NavBtn id="targets" icon={<Target size={15} />} label="目標設定" badge={noTargetCount} />
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1240, margin: "0 auto" }}>
        {view === "summary" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <MediaTab id="all" label="すべて" /><MediaTab id="google" label="Google" /><MediaTab id="meta" label="Meta" />{hasYahoo && <MediaTab id="yahoo" label="Yahoo!" />}
          </div>
        )}

        {/* ===== ダッシュボード（全運用アカウント一望） ===== */}
        {view === "dash" && (
          <>
            {/* ① 今日の要対応（画面トップ固定・最優先）— 運用者はまずここだけ見れば良い */}
            <TodayActions items={alertActive} handled={alertHandled} ops={alertOps} onClient={goClient}
              onAck={(k) => setAlertOp(k, { status: "ack" })}
              onSnooze={(k) => setAlertOp(k, { status: "snooze", until: new Date(Date.now() + 3 * 864e5).toISOString() })}
              onMemo={(k, v) => setAlertOp(k, { memo: v })}
              onClear={clearAlertOp}
              generatedAt={dataInfo && dataInfo.alertsGeneratedAt} />

            {/* 上部：全体集計(クリックで詳細ページ)・アラート・健全性 */}
            {(() => {
              const g = rows.filter((c) => acctHk(c) === "good").length;
              const w = rows.filter((c) => acctHk(c) === "warning").length;
              const cr = rows.filter((c) => acctHk(c) === "critical").length;
              const nt = rows.filter((c) => acctHk(c) === "unset").length;
              const crit = alertActive.filter((a) => a.severity === "critical").length;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 20 }}>
                  <button onClick={() => setView("summary")} style={{ textAlign: "left", cursor: "pointer", background: "#0f2a1f", color: "#fff", border: "none", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: "#a7c4b5", marginBottom: 6 }}>全体集計</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{yen(totals.spend)}</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: "#a7c4b5", display: "flex", alignItems: "center", gap: 3 }}>総広告費・{clients.length}社 ／ 詳細を見る <ChevronRight size={12} /></div>
                  </button>
                  <Card>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>今日の要対応</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: alertActive.length ? "#dc2626" : "#047857" }}>{alertActive.length}件</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: "#94a3b8" }}>{crit ? `うち要対応 ${crit}件` : (alertHandled.length ? `対応済/様子見 ${alertHandled.length}件` : "重大なし")}</div>
                  </Card>
                  <Card>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>健全性（{rows.length}アカウント）</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 12, fontWeight: 700 }}>
                      <span style={{ color: "#047857" }}>● 良好 {g}</span>
                      <span style={{ color: "#d97706" }}>● 注意 {w}</span>
                      <span style={{ color: "#dc2626" }}>● 要対応 {cr}</span>
                      {nt > 0 && <button onClick={() => setView("targets")} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", color: "#64748b", fontWeight: 700, fontSize: 12 }}>● 目標未設定 {nt}</button>}
                    </div>
                  </Card>
                </div>
              );
            })()}

            {/* 承認キュー（全幅）— 提案を確認して適用。適用は承認分のみ。 */}
            <div style={{ marginTop: 22 }}>
              <SectionTitle icon={<Zap size={16} color="#047857" />} title="承認キュー" note="AIの提案を確認して適用。適用されるのは承認した分だけ（書き込みは承認後のみ）。" />
              {pending.length === 0 && <Empty text="承認待ちはありません。" />}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 10 }}>
                {pending.map((p) => <ProposalCard key={p.id} p={p} decide={decide} onClient={goClient} url={propUrl(p)} />)}
              </div>
              {approvalLog.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <button onClick={() => setShowLog((v) => !v)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#64748b", padding: 0 }}>
                    <Clock size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />承認ログ {approvalLog.length}件 {showLog ? "▲" : "▼"}
                  </button>
                  {showLog && (
                    <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 10, overflow: "hidden", marginTop: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 0.9fr 1.4fr 0.8fr 0.5fr", padding: "8px 12px", background: "#f2f5f3", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                        <span>クライアント</span><span>媒体</span><span>提案</span><span>判断・理由</span><span>担当・日時</span><span></span>
                      </div>
                      {approvalLog.map((l, i) => (
                        <div key={l.key} style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 0.9fr 1.4fr 0.8fr 0.5fr", alignItems: "center", padding: "8px 12px", fontSize: 12, borderTop: i ? "1px solid #f1f5f4" : "none" }}>
                          <span style={{ fontWeight: 600 }}>{l.client}</span>
                          <span><MediaPill m={l.media} /></span>
                          <span style={{ color: "#475569" }}>{l.kind}</span>
                          <span style={{ color: l.decision === "approved" ? "#047857" : "#dc2626", fontWeight: 700 }}>{l.decision === "approved" ? "承認" : "却下"}{l.reason ? <span style={{ color: "#94a3b8", fontWeight: 400 }}>・{l.reason}</span> : null}</span>
                          <span style={{ color: "#94a3b8", fontSize: 11 }}>{l.by}・{l.at}</span>
                          <span><button onClick={() => undecide(l.key)} style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, border: "1px solid #d7e0db", background: "#fff", cursor: "pointer", color: "#475569" }}>戻す</button></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== 全体集計（ダッシュボードからのクリックで表示） ===== */}
        {view === "summary" && (
          <>
            <button onClick={() => setView("dash")} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#047857", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12, padding: 0 }}>
              <ArrowLeft size={15} /> ダッシュボードに戻る
            </button>
            <SectionTitle icon={<LayoutDashboard size={16} color="#047857" />} title="全体集計" note={dataInfo ? `${dataInfo.period || ""}・${dataInfo.generatedAt || ""}（媒体タブで絞込み可）` : "サンプルデータ"} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 22 }}>
              {[
                { label: "総広告費", value: yen(totals.spend), sub: dataInfo ? dataInfo.period : "今月累計" },
                { label: "平均CPA", value: totals.cpa ? yen(totals.cpa) : "—", sub: totals.cv ? "" : "CV0のため算出不可" },
                { label: "合計CV", value: totals.cv + "件", sub: dataInfo ? dataInfo.period : "" },
                { label: "平均ROAS", value: totals.roas ? totals.roas.toFixed(1) + "x" : "—", sub: "計測対象のみ" },
                { label: "アラート", value: alerts.length + "件", sub: pending.length + "件が承認待ち", alert: alerts.length > 0 },
              ].map((k) => (
                <Card key={k.label}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: k.alert ? "#dc2626" : "#0f2a1f" }}>{k.value}</div>
                  <div style={{ fontSize: 11, marginTop: 4, color: "#94a3b8" }}>{k.sub}</div>
                </Card>
              ))}
            </div>
            <SectionTitle icon={<Table2 size={16} color="#047857" />} title="媒体内訳" note="媒体（Google / Meta / Yahoo!）ごとの合計。" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              {[["google", "Google"], ["meta", "Meta"], ["yahoo", "Yahoo!"]].map(([mk, ml]) => {
                const t = agg(A.filter((c) => mediaFamily(c.media) === mk));
                const n = A.filter((c) => mediaFamily(c.media) === mk).length;
                if (n === 0) return null;
                return (
                  <Card key={mk}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><MediaPill m={mk} /><span style={{ fontSize: 12, color: "#64748b" }}>{n}アカウント</span></div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <MiniStat label="消化" value={yen(t.spend)} />
                      <MiniStat label="CPA" value={t.cpa ? yen(t.cpa) : "—"} />
                      <MiniStat label="CV" value={t.cv + "件"} />
                      <MiniStat label="ROAS" value={t.roas ? t.roas.toFixed(1) + "x" : "—"} />
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* ===== 社別詳細（費用・成果一覧の行クリックで表示） ===== */}
        {view === "client" && openClient && (() => {
          const cl = clients.find((c) => c.client === openClient);
          if (!cl) return <Empty text="データを読み込み中、または該当クライアントが見つかりません。" />;
          const a = agg(cl.accts);
          const cProps = proposals.filter((p) => p.client === openClient && !approvals[pKey(p)]);
          const cAlerts = cl.accts.map((c) => {
            if (c.cv === 0 && c.spend > 0) return { c, sev: "critical", msg: `CV 0件のまま ${yen(c.spend)} を消化` };
            if (c.target && c.cpa > c.target * 1.15) return { c, sev: "warning", msg: `CPA ${yen(c.cpa)}（目標比 +${Math.round((c.cpa / c.target - 1) * 100)}%）` };
            if (cpcOver(c)) return { c, sev: "warning", msg: `CPC ${yen(cpcOf(c))}（上限${yen(c.bench.cpcMax)}超）` };
            if (c.is != null && c.is < 50) return { c, sev: "warning", msg: `IS ${c.is}%（機会損失大）` };
            return null;
          }).filter(Boolean);
          return (
            <>
              <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <button onClick={() => { setView("list"); setOpenClient(null); }} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#047857", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  <ArrowLeft size={15} /> 一覧に戻る
                </button>
                <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid #047857", background: "#fff", color: "#047857", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  🖨 レポート印刷／PDF
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>ソフトコミュニケーションズ 広告運用レポート{dataInfo ? `（${dataInfo.generatedAt || ""}時点）` : ""}</div>
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

              <ClientBudgetCard cl={cl} bud={budgets[cl.client]} monthlyMap={monthlyMap} />

              <SectionTitle icon={<Table2 size={16} color="#047857" />} title="媒体別" note="この社の各アカウントの接続と成果。手法別（検索/PMax等）・週次も表示。" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 22 }}>
                {cl.accts.map((c) => {
                  const s = CONN[c.status]; const h = healthOf(c);
                  const tok = c.tokenDays >= 999 ? "無期限" : c.tokenDays === 0 ? "失効" : `残 ${c.tokenDays}日`;
                  const tokC = c.tokenDays >= 999 ? "#047857" : c.tokenDays === 0 ? "#dc2626" : c.tokenDays <= 7 ? "#d97706" : "#475569";
                  return (
                    <div key={c.id} style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, padding: 15 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <MediaPill m={c.media} /><DeliveryBadge c={c} />
                          {platformUrl(c.media, c.acct, dataInfo && dataInfo.googleMcc) && <a className="no-print" href={platformUrl(c.media, c.acct, dataInfo && dataInfo.googleMcc)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, fontWeight: 700, color: c.media === "google" ? "#1a56db" : "#4338ca", textDecoration: "none", border: "1px solid #c7d2fe", borderRadius: 6, padding: "2px 8px" }}>↗ {c.media === "google" ? "Google広告" : "Meta"}を開く</a>}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: s.c }}><Circle size={8} fill={s.c} color={s.c} />{s.label}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "#64748b", fontFamily: "monospace", marginBottom: 3 }}>{c.acct}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: tokC, fontWeight: 600, marginBottom: 12 }}>
                        <KeyRound size={12} />トークン {tok} ・ 稼働 {c.cp}本{c.dailyBudget ? ` ・ 日予算 ${yen(c.dailyBudget)}` : ""} ・ 同期 {c.sync}</div>
                      {c.metrics ? <AccountReport c={c} days={(dailyMap[`${c.client}|${c.media}`] || {}).days} byType={(dailyMap[`${c.client}|${c.media}`] || {}).byType} /> : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12 }}>
                        <MiniStat label="消化" value={yen(c.spend)} />
                        <MiniStat label="CPA/目標" value={(c.cpa ? yen(c.cpa) : "—") } bad={c.target && c.cpa > c.target * 1.15} />
                        <MiniStat label="ROAS" value={c.roas ? c.roas + "x" : "—"} />
                        <MiniStat label="CV" value={c.cv + "件"} />
                        <MiniStat label="CTR" value={c.ctr + "%"} />
                        <MiniStat label="状態" value={HLABEL[h]} bad={h !== "good" && h !== "unset"} />
                      </div>
                      )}
                      {((monthlyMap[`${c.client}|${c.media}`] || []).length > 0) && <MonthlyTrend series={monthlyMap[`${c.client}|${c.media}`]} generated={monthlyGen} target={c.target || (c.bench && c.bench.targetCpa)} bench={c.bench} />}
                      {auditMap[`${c.client}|${c.media}`] && <AuditReport a={auditMap[`${c.client}|${c.media}`]} />}
                    </div>
                  );
                })}
              </div>

              <div className="no-print">
                <SectionTitle icon={<Zap size={16} color="#047857" />} title="この社の承認待ち" note={cProps.length ? "" : "承認待ちはありません。"} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: cProps.length ? 22 : 8 }}>
                  {cProps.map((p) => <ProposalCard key={p.id} p={p} decide={decide} onClient={null} hideClient url={propUrl(p)} />)}
                </div>
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

        {/* ===== 契約一覧（全クライアントの契約＋追加＝今月の予算・消化） ===== */}
        {view === "contracts" && (() => {
          const nowMonth = new Date().toISOString().slice(0, 7);
          const monthSet = new Set([listMonth, nowMonth]);
          Object.values(budgets).forEach((b) => Object.keys((b && b.months) || {}).forEach((m) => monthSet.add(m)));
          const monthOpts = [...monthSet].sort().reverse();
          const [Y, M] = listMonth.split("-").map(Number);
          const daysInMonth = new Date(Y, M, 0).getDate();
          const elapsed = listMonth === nowMonth ? Math.min(daysInMonth, Math.max(1, new Date().getDate())) : daysInMonth;
          const rows = clients.map((cl) => ({ cl, eb: effectiveBudget(budgets[cl.client], listMonth, cl.monthly), act: clientMonthActual(cl.accts, monthlyMap, listMonth) }))
            .sort((a, b) => b.eb.total - a.eb.total);
          const totBudget = rows.reduce((s, r) => s + r.eb.total, 0);
          const totActual = rows.reduce((s, r) => s + (r.act ? r.act.cost : 0), 0);
          const sel = { padding: "6px 10px", border: "1px solid #d7e0db", borderRadius: 8, fontSize: 12.5, background: "#fff" };
          const tmpl = "1.4fr 2.1fr 0.9fr 1.2fr";
          const pctC = (p) => p == null ? "#94a3b8" : p > 110 ? "#dc2626" : p >= 90 ? "#d97706" : "#047857";
          return (
            <>
              <SectionTitle icon={<span style={{ fontSize: 15 }}>💰</span>} title="契約一覧（今月の予算）" note="全クライアントの契約（媒体別）＋追加（キャンペーン等）＝今月の予算を一覧。実消化との対比つき。契約・追加の登録は目標設定タブから。行クリックで社別詳細へ。" />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: "#64748b" }}>対象月</span>
                <select value={listMonth} onChange={(e) => setListMonth(e.target.value)} style={sel}>
                  {monthOpts.map((m) => <option key={m} value={m}>{m.replace("-", "年") + "月"}</option>)}
                </select>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>今月の予算 合計 <b style={{ color: "#0f2a1f" }}>{fmtYen(totBudget)}</b>{totActual ? ` ／ 実消化 ${fmtYen(totActual)}（${Math.round(totActual / totBudget * 100)}%）` : ""}</span>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: tmpl, gap: 10, padding: "9px 14px", background: "#f2f5f3", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                  <span>クライアント</span><span>契約（媒体別）＋追加</span><span style={{ textAlign: "right" }}>今月の予算</span><span style={{ textAlign: "right" }}>実消化 / 消化率</span>
                </div>
                {rows.map((r, i) => {
                  const pct = r.act && r.eb.total ? Math.round(r.act.cost / r.eb.total * 100) : null;
                  return (
                    <div key={r.cl.client} onClick={() => goClient(r.cl.client)} style={{ display: "grid", gridTemplateColumns: tmpl, gap: 10, alignItems: "start", padding: "11px 14px", borderTop: "1px solid #f1f5f4", cursor: "pointer" }}>
                      <span style={{ fontWeight: 700, fontSize: 12.5 }}>{r.cl.client}{r.cl.tier === "large" && <LargePill />}</span>
                      <div style={{ minWidth: 0 }}>
                        {r.eb.contract.map((l, j) => (
                          <div key={j} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155" }}>
                            <span style={{ color: "#cbd5e1" }}>└</span><span style={{ fontWeight: 600 }}>{l.media || "（媒体未記入）"}</span>
                            <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{fmtYen(l.amount)}</span>
                          </div>
                        ))}
                        {r.eb.fromBench && <div style={{ fontSize: 10.5, color: "#b45309" }}>契約未設定（月予算から仮置き）</div>}
                        {r.eb.adds.map((a, j) => (
                          <div key={"a" + j} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#1a56db" }}>
                            <span style={{ fontWeight: 700 }}>＋</span><span style={{ fontWeight: 600 }}>{a.label || "追加"}{a.media ? `（${a.media}）` : ""}</span>
                            <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{fmtYen(a.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f2a1f", fontVariantNumeric: "tabular-nums" }}>{fmtYen(r.eb.total)}</div>
                        {r.eb.addsTotal > 0 && <div style={{ fontSize: 10, color: "#64748b" }}>契約{fmtYen(r.eb.contractTotal)}＋追加{fmtYen(r.eb.addsTotal)}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {r.act ? (
                          <>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: pctC(pct), fontVariantNumeric: "tabular-nums" }}>{fmtYen(r.act.cost)}（{pct}%）</div>
                            <div style={{ height: 5, background: "#eef1f4", borderRadius: 999, overflow: "hidden", marginTop: 3 }}><div style={{ width: Math.min(pct || 0, 100) + "%", height: "100%", background: pctC(pct) }} /></div>
                          </>
                        ) : <span style={{ fontSize: 11.5, color: "#94a3b8" }}>実消化なし</span>}
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: "grid", gridTemplateColumns: tmpl, gap: 10, padding: "11px 14px", borderTop: "2px solid #e6ebe8", background: "#f8faf9", fontWeight: 700 }}>
                  <span style={{ fontSize: 12.5 }}>合計（{rows.length}社）</span><span></span>
                  <span style={{ textAlign: "right", fontSize: 13.5, color: "#0f2a1f", fontVariantNumeric: "tabular-nums" }}>{fmtYen(totBudget)}</span>
                  <span style={{ textAlign: "right", fontSize: 12.5, color: pctC(totBudget ? Math.round(totActual / totBudget * 100) : null), fontVariantNumeric: "tabular-nums" }}>{totActual ? `${fmtYen(totActual)}（${Math.round(totActual / totBudget * 100)}%）` : "—"}</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>実消化は monthly.json（当月分・Google/Meta）より。契約・追加は目標設定タブの「契約・予算」で登録すると全スタッフに共有されます。</div>
            </>
          );
        })()}

        {/* ===== レポート（クライアント提出用・媒体横断＋キーワード・PDF書き出し） ===== */}
        {view === "report" && (() => {
          const thisMonth = new Date().toISOString().slice(0, 7);
          const rc = reportClient || (clients[0] && clients[0].client) || "";
          const accts = A.filter((c) => c.client === rc);
          const seriesOf = (c) => monthlyMap[`${c.client}|${c.media}`] || [];
          const allMonths = [...new Set(accts.flatMap((c) => seriesOf(c).map((r) => r.month)))].filter(Boolean).sort();
          const completed = allMonths.filter((m) => m < thisMonth);
          const rm = (reportMonth && allMonths.includes(reportMonth)) ? reportMonth
            : (completed[completed.length - 1] || allMonths[allMonths.length - 1] || "");
          const yoy = rm ? `${+rm.slice(0, 4) - 1}-${rm.slice(5, 7)}` : "";
          const cl = clients.find((c) => c.client === rc);
          const rowOf = (c, mo) => seriesOf(c).find((r) => r.month === mo);
          const sumMonth = (mo) => accts.reduce((a, c) => { const r = rowOf(c, mo); if (r) { a.cost += r.cost || 0; a.imp += r.imp || 0; a.clk += r.clk || 0; a.cv += r.cv || 0; a.has = true; } return a; }, { cost: 0, imp: 0, clk: 0, cv: 0, has: false });
          const cur = sumMonth(rm), prev = sumMonth(yoy);
          const der = (s) => ({ ...s, ctr: s.imp ? s.clk / s.imp * 100 : 0, cpc: s.clk ? s.cost / s.clk : 0, cpa: s.cv ? s.cost / s.cv : null });
          const C = der(cur), P = der(prev);
          const dpct = (a, b) => (b ? Math.round((a - b) / b * 100) : null);
          const sel = { padding: "6px 10px", border: "1px solid #d7e0db", borderRadius: 8, fontSize: 12.5, background: "#fff" };
          const YoY = ({ a, b, invert }) => {
            const d = dpct(a, b);
            if (d == null) return <span style={{ fontSize: 10.5, color: "#cbd5e1" }}>前年同月 —</span>;
            const good = invert ? d <= 0 : d >= 0;
            return <span style={{ fontSize: 10.5, color: d === 0 ? "#94a3b8" : (good ? "#047857" : "#b45309") }}>前年同月 {d > 0 ? "+" : ""}{d}%</span>;
          };
          const kwAccts = accts.filter((c) => c.media === "google" || c.media === "yahoo_search");
          const kpi = (label, val, node) => (
            <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f2a1f", fontVariantNumeric: "tabular-nums" }}>{val}</div>
              <div style={{ marginTop: 2 }}>{node}</div>
            </div>
          );
          return (
            <>
              <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: "#64748b" }}>クライアント</span>
                <select value={rc} onChange={(e) => { setReportClient(e.target.value); setReportMonth(""); }} style={{ ...sel, minWidth: 200 }}>
                  {clients.map((c) => <option key={c.client} value={c.client}>{c.client}</option>)}
                </select>
                <span style={{ fontSize: 12.5, color: "#64748b" }}>対象月</span>
                <select value={rm} onChange={(e) => setReportMonth(e.target.value)} style={sel}>
                  {[...allMonths].reverse().map((m) => <option key={m} value={m}>{m.replace("-", "年") + "月"}</option>)}
                  {allMonths.length === 0 && <option value="">データなし</option>}
                </select>
                <button onClick={() => window.print()} style={{ ...btnP, marginLeft: "auto" }}>📄 PDFで書き出し</button>
              </div>

              {/* レポート本体（印刷対象） */}
              <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 14, padding: "22px 24px" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>ソフトコミュニケーションズ 広告運用レポート</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 22, fontWeight: 800 }}>{rc}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#0f766e" }}>{rm ? rm.replace("-", "年") + "月 レポート" : "（月データなし）"}</span>
                  {cl && <span style={{ fontSize: 12, color: "#64748b" }}>月額規模 {man(cl.monthly)}/月</span>}
                </div>
                <div style={{ fontSize: 11.5, color: "#94a3b8", margin: "3px 0 18px" }}>媒体：{accts.map((c) => <span key={c.id} style={{ marginRight: 6 }}><MediaPill m={c.media} /></span>)}</div>

                {!cur.has ? (
                  <Empty text="この月の実績データがありません。対象月を変更してください。" />
                ) : (
                  <>
                    {/* KPIサマリ（媒体横断・前年同月比） */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 22 }}>
                      {kpi("費用", yen(C.cost), <YoY a={C.cost} b={P.cost} />)}
                      {kpi("コンバージョン", Math.round(C.cv) + "件", <YoY a={C.cv} b={P.cv} />)}
                      {kpi("CPA", C.cpa ? yen(Math.round(C.cpa)) : "—", <YoY a={C.cpa || 0} b={P.cpa || 0} invert />)}
                      {kpi("表示回数", C.imp.toLocaleString("ja-JP"), <YoY a={C.imp} b={P.imp} />)}
                      {kpi("クリック", C.clk.toLocaleString("ja-JP"), <YoY a={C.clk} b={P.clk} />)}
                      {kpi("CTR", C.ctr.toFixed(2) + "%", <YoY a={C.ctr} b={P.ctr} />)}
                      {kpi("CPC", C.cpc ? yen(Math.round(C.cpc)) : "—", <YoY a={C.cpc || 0} b={P.cpc || 0} invert />)}
                    </div>

                    {/* 媒体別内訳 */}
                    <SectionTitle icon={<Table2 size={15} color="#047857" />} title="媒体別内訳" />
                    <div style={{ border: "1px solid #e6ebe8", borderRadius: 10, overflow: "hidden", marginBottom: 22 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr 0.7fr 0.7fr 0.9fr", gap: 8, padding: "8px 13px", background: "#f2f5f3", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                        <span>媒体</span><span style={{ textAlign: "right" }}>費用</span><span style={{ textAlign: "right" }}>CV</span><span style={{ textAlign: "right" }}>CPA</span><span style={{ textAlign: "right" }}>CTR / CPC</span>
                      </div>
                      {accts.map((c, i) => {
                        const r = rowOf(c, rm);
                        return (
                          <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr 0.7fr 0.7fr 0.9fr", gap: 8, padding: "9px 13px", borderTop: i ? "1px solid #f1f5f4" : "none", fontSize: 12.5, alignItems: "center" }}>
                            <span><MediaPill m={c.media} /></span>
                            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{r ? yen(r.cost) : "—"}</span>
                            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r ? Math.round(r.cv) : "—"}</span>
                            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r && r.cpa ? yen(r.cpa) : "—"}</span>
                            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#64748b" }}>{r && r.imp ? (r.clk / r.imp * 100).toFixed(2) + "% / " + yen(r.clk ? Math.round(r.cost / r.clk) : 0) : "—"}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* 月次推移（媒体ごと） */}
                    <SectionTitle icon={<TrendingUp size={15} color="#047857" />} title="月次推移" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 22 }}>
                      {accts.map((c) => seriesOf(c).length > 0 && (
                        <div key={c.id} style={{ border: "1px solid #e6ebe8", borderRadius: 10, padding: 13 }}>
                          <div style={{ marginBottom: 6 }}><MediaPill m={c.media} /></div>
                          <MonthlyTrend series={seriesOf(c)} generated={monthlyGen} target={c.target || (c.bench && c.bench.targetCpa)} bench={c.bench} />
                        </div>
                      ))}
                    </div>

                    {/* キーワード分析（検索：Google / Yahoo!検索） */}
                    {kwAccts.length > 0 && (
                      <>
                        <SectionTitle icon={<KeyRound size={15} color="#047857" />} title="キーワード分析（費用上位）" note="検索広告の当月キーワード。Google／Yahoo!検索が対象。" />
                        {kwAccts.map((c) => {
                          const kws = (keywordMap[`${c.client}|${c.media}`] || {})[rm] || [];
                          return (
                            <div key={c.id} style={{ marginBottom: 18 }}>
                              <div style={{ marginBottom: 6 }}><MediaPill m={c.media} /></div>
                              {kws.length === 0 ? (
                                <Empty text={`この月のキーワードデータがありません（毎日の取得で反映）。`} />
                              ) : (
                                <div style={{ border: "1px solid #e6ebe8", borderRadius: 10, overflow: "hidden" }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "1.8fr 0.7fr 0.6fr 0.6fr 0.6fr 0.6fr", gap: 6, padding: "7px 12px", background: "#f2f5f3", fontSize: 10.5, fontWeight: 700, color: "#64748b" }}>
                                    <span>キーワード</span><span style={{ textAlign: "right" }}>費用</span><span style={{ textAlign: "right" }}>クリック</span><span style={{ textAlign: "right" }}>CTR</span><span style={{ textAlign: "right" }}>CV</span><span style={{ textAlign: "right" }}>CPA</span>
                                  </div>
                                  {kws.map((k, i) => (
                                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1.8fr 0.7fr 0.6fr 0.6fr 0.6fr 0.6fr", gap: 6, padding: "6px 12px", borderTop: "1px solid #f5f7f6", fontSize: 11.5, alignItems: "center" }}>
                                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.text}<span style={{ fontSize: 9.5, color: "#94a3b8", marginLeft: 5 }}>{k.match}</span></span>
                                      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{yen(k.cost)}</span>
                                      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{k.clk}</span>
                                      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#64748b" }}>{k.ctr}%</span>
                                      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round(k.cv)}</span>
                                      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{k.cpa ? yen(k.cpa) : "—"}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                    <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 8 }}>数値は Google/Meta/Yahoo! の実データ（当月）。前年同月比は12ヶ月前との比較。CPA/CPCの前年同月比は「下降が改善」。</div>
                  </>
                )}
              </div>
            </>
          );
        })()}

        {/* ===== 接続ステータス ===== */}
        {view === "conn" && (
          <>
            <SectionTitle icon={<Cable size={16} color="#047857" />} title="接続ステータス" note="何がアクティブで、どのアカウントに繋がっているか。行クリックで社別に。" />
            <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, overflow: "hidden" }}>
              <TableHead which="conn" cols={["クライアント", "連携先", "アカウントID", "接続状態", "トークン期限", "稼働CP", "最終同期"]} />
              {A.map((c, i) => {
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

        {/* ===== 費用・成果一覧（媒体別・統合） ===== */}
        {view === "list" && (() => {
          const pct = (x, y) => (x == null || y == null || y === 0 ? null : Math.round((x / y - 1) * 100));
          const clientNames = [...new Set(A.map((c) => c.client))];
          const tmpl = "1.5fr 0.7fr 1fr 1fr 0.55fr 0.85fr";
          const listRows = A
            .filter((c) => media === "all" || c.media === media)
            .filter((c) => clientFilter === "all" || c.client === clientFilter)
            .filter((c) => flagFilter === "all" || acctHk(c) === flagFilter)
            .sort((x, y) => (RANK[acctHk(y)] - RANK[acctHk(x)]) || ((y.spend || 0) - (x.spend || 0)));
          const sel = { padding: "6px 10px", border: "1px solid #d7e0db", borderRadius: 8, fontSize: 12.5, background: "#fff", color: "#0f172a" };
          const head = { display: "grid", gridTemplateColumns: tmpl, padding: "9px 14px", background: "#f2f5f3", fontSize: 11, fontWeight: 700, color: "#64748b" };
          return (
            <>
              <SectionTitle icon={<Table2 size={16} color="#047857" />} title="費用・成果一覧（媒体別）" note="アカウント（媒体）単位の一覧。クライアント・状態・媒体で絞り込み。行クリックで社別詳細へ。" />
              {/* フィルタ */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <MediaTab id="all" label="すべて" /><MediaTab id="google" label="Google" /><MediaTab id="meta" label="Meta" />{hasYahoo && <MediaTab id="yahoo" label="Yahoo!" />}
                <span style={{ width: 1, height: 20, background: "#e2e8f0" }} />
                <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} style={sel}>
                  <option value="all">すべてのクライアント</option>
                  {clientNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <select value={flagFilter} onChange={(e) => setFlagFilter(e.target.value)} style={sel}>
                  <option value="all">すべての状態</option>
                  <option value="critical">要対応</option>
                  <option value="warning">注意</option>
                  <option value="unset">目標未設定</option>
                  <option value="good">良好</option>
                </select>
                {(clientFilter !== "all" || flagFilter !== "all" || media !== "all") &&
                  <button onClick={() => { setClientFilter("all"); setFlagFilter("all"); setMedia("all"); }} style={{ border: "none", background: "none", color: "#047857", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>絞り込み解除</button>}
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>{listRows.length}件</span>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, overflow: "hidden" }}>
                <div style={head}>
                  <span>クライアント</span><span>媒体</span><span>消化（前月比）</span><span>CPA（前月比）</span><span>CV</span><span>状態</span>
                </div>
                {listRows.length === 0 && <div style={{ padding: "18px 14px", fontSize: 12.5, color: "#94a3b8", textAlign: "center" }}>該当なし</div>}
                {listRows.map((c, i) => {
                  const h = acctHk(c);
                  const lm = (c.metrics && c.metrics.lm) || {};
                  const overT = c.target && c.cpa > c.target * 1.15;
                  return (
                    <div key={c.id} onClick={() => goClient(c.client)} style={{ display: "grid", gridTemplateColumns: tmpl, alignItems: "center", padding: "10px 14px", fontSize: 12.5, borderTop: i ? "1px solid #f1f5f4" : "none", cursor: "pointer" }}>
                      <span style={{ fontWeight: 600 }}>{c.client}{c.tier === "large" && <LargePill />}</span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}><MediaPill m={c.media} /><DeliveryBadge c={c} /></span>
                      <span><span style={{ color: "#0f2a1f", fontWeight: 600 }}>{yen(c.spend)}</span> <span style={{ fontSize: 10.5 }}><DeltaTag v={pct(c.spend, lm.spend)} dir={0} /></span></span>
                      <span><span style={{ color: overT ? "#dc2626" : "#0f2a1f", fontWeight: overT ? 700 : 600 }}>{c.cpa ? yen(c.cpa) : "—"}</span> <span style={{ fontSize: 10.5 }}><DeltaTag v={pct(c.cpa, lm.cpa)} dir={-1} /></span>{c.target ? <span style={{ color: "#94a3b8", fontSize: 10.5 }}> /目標{yen(c.target)}</span> : null}</span>
                      <span style={{ color: "#475569" }}>{c.cv}件</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5, color: HC[h], fontWeight: 600 }}><Circle size={8} fill={HC[h]} color={HC[h]} />{HLABEL[h]}</span>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        {/* ===== 目標設定 ===== */}
        {view === "targets" && (
          <>
            <SectionTitle icon={<Target size={16} color="#047857" />} title="目標設定" note="各クライアントの目標CPA・月予算を登録。保存するとアラート/基準チェックに即反映（この端末に保存）。恒久保存はエクスポートして benchmarks.json へ。" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 12.5, color: "#64748b" }}>担当者</span>
              <input value={operator} onChange={(e) => saveOperator(e.target.value)} placeholder="名前（変更履歴に記録）"
                style={{ padding: "6px 10px", border: "1px solid #d7e0db", borderRadius: 7, fontSize: 12.5, width: 200 }} />
            </div>
            <TargetEditor clients={clients} targets={targets} onSave={saveTargets} />
            <BudgetEditor clients={clients} budgets={budgets} onSave={saveBudgets} />
            <TargetHistory history={history} />
          </>
        )}

        <div className="no-print" style={{ marginTop: 20, fontSize: 11, color: "#94a3b8", lineHeight: 1.7 }}>
          {dataInfo
            ? "実データ（Google Ads / Meta）。毎日 8:30・12:00・16:00 に取得→監視。判断基準はCLAUDE.mdルールブック＋各社の目標設定に集約。書き込み（予算/入札/ON-OFF）は承認後にのみ実行。"
            : "サンプルデータのプロトタイプ。実運用では Google Ads / Meta を接続し、毎朝取得・分析・提案生成。書き込みは承認後にのみ実行。"}
        </div>
      </div>
    </div>
  );
}

function agg(list) {
  const spend = list.reduce((s, c) => s + (c.spend || 0), 0);
  const cvRaw = list.reduce((s, c) => s + (c.cv || 0), 0);
  const cpa = cvRaw ? Math.round(spend / cvRaw) : 0;
  const r = list.filter((c) => c.roas);
  const roas = r.length ? r.reduce((s, c) => s + c.roas, 0) / r.length : 0;
  return { spend, cv: Math.round(cvRaw), cpa, roas };
}
const btnP = { display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, border: "none", background: "#047857", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnS = { display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" };

function ProposalCard({ p, decide, onClient, hideClient, url }) {
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
        <button onClick={() => decide(p, "approved")} style={btnP}><Check size={15} />{p.twoStep ? "レビュー承認" : "承認"}</button>
        <button onClick={() => decide(p, "rejected")} style={btnS}><X size={15} /> 却下</button>
        {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...btnS, textDecoration: "none", marginLeft: "auto", color: p.media === "google" ? "#1a56db" : "#4338ca" }}>↗ 修正画面</a>}
      </div>
    </div>
  );
}
function Card({ children }) { return <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, padding: "14px 16px" }}>{children}</div>; }

// 全運用アカウント（社）のカードグリッド。健全性の低い順・アラート表示・クリックで社別詳細。
function PortfolioGrid({ clients, onOpen }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
      {[...clients].sort((x, y) => worstHealth(y.accts) - worstHealth(x.accts)).map((cl) => {
        const a = agg(cl.accts);
        const cAlerts = alertsOf(cl.accts);
        const hk = rankToHk(worstHealth(cl.accts));
        const hlabel = HLABEL[hk];
        return (
          <button key={cl.client} onClick={() => onOpen(cl.client)} style={{ textAlign: "left", cursor: "pointer",
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
  );
}
// ① 今日の要対応：運用者がまず見るパネル。重要度順・事実+推奨対応つき・確認済み/様子見/メモで対応管理。
function TodayActions({ items, handled, ops, onClient, onAck, onSnooze, onMemo, onClear, generatedAt }) {
  const [editKey, setEditKey] = useState(null);
  const [draft, setDraft] = useState("");
  const [showHandled, setShowHandled] = useState(false);
  const crit = items.filter((i) => i.severity === "critical").length;
  const warn = items.filter((i) => i.severity === "warning").length;
  const info = items.filter((i) => i.severity === "info").length;
  const accent = crit ? "#dc2626" : warn ? "#d97706" : "#047857";
  const nh = (handled || []).length;
  const btn = { fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, border: "1px solid #d7e0db", background: "#fff", cursor: "pointer", color: "#475569" };
  const stop = (e) => e.stopPropagation();

  const renderRow = (a) => {
    const s = SEV[a.severity] || SEV.warning;
    const op = (ops && ops[a.key]) || {};
    return (
      <div key={a.key} onClick={() => onClient && onClient(a.client)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", border: "1px solid #eef1f0", borderLeft: `3px solid ${s.dot}`, borderRadius: 8, background: "#fcfdfc", cursor: onClient ? "pointer" : "default" }}>
        <span style={{ flexShrink: 0, marginTop: 1, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: s.chip, color: s.chipText, minWidth: 44, textAlign: "center" }}>{s.label}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f2a1f" }}>
            {a.client}<MediaPill m={a.media} />
            {a.kind && <span style={{ fontSize: 11.5, fontWeight: 700, color: s.chipText, marginLeft: 4 }}>{a.kind}</span>}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{a.fact}</div>
          {a.action && <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}><b style={{ color: "#047857" }}>対応 </b>{a.action}</div>}
          {op.memo && editKey !== a.key && <div style={{ fontSize: 11.5, color: "#0f2a1f", marginTop: 3, background: "#fff8e1", borderRadius: 6, padding: "3px 7px" }}>📝 {op.memo}</div>}
          {editKey === a.key ? (
            <div onClick={stop} style={{ display: "flex", gap: 6, marginTop: 5 }}>
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="メモ（この端末に保存）"
                style={{ flex: 1, minWidth: 0, fontSize: 11.5, padding: "4px 8px", border: "1px solid #d7e0db", borderRadius: 6 }} />
              <button style={btn} onClick={() => { onMemo(a.key, draft.trim()); setEditKey(null); }}>保存</button>
              <button style={btn} onClick={() => setEditKey(null)}>取消</button>
            </div>
          ) : (
            <div onClick={stop} style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <button style={btn} onClick={() => onAck(a.key)}>✓ 確認済み</button>
              <button style={btn} onClick={() => onSnooze(a.key)}>様子見3日</button>
              <button style={btn} onClick={() => { setEditKey(a.key); setDraft(op.memo || ""); }}>メモ</button>
              {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: "none", color: a.media === "google" ? "#1a56db" : "#4338ca", borderColor: "#c7d2fe" }}>↗ {a.media === "google" ? "Google広告" : "Meta"}を開く</a>}
            </div>
          )}
        </div>
        {onClient && <ChevronRight size={15} color="#cbd5e1" style={{ flexShrink: 0, marginTop: 2 }} />}
      </div>
    );
  };

  if (!items.length && !nh) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderTop: "3px solid #047857", borderRadius: 12, padding: "16px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <ShieldCheck size={20} color="#047857" />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f2a1f" }}>本日、要対応はありません</div>
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>全アカウント基準内・急変なし。{generatedAt ? `（監視 ${generatedAt}）` : ""}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderTop: `3px solid ${items.length ? accent : "#047857"}`, borderRadius: 12, padding: "14px 16px 12px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={18} color={items.length ? accent : "#047857"} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0f2a1f" }}>今日の要対応 <span style={{ color: items.length ? accent : "#047857" }}>{items.length}件</span></span>
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 11.5, fontWeight: 700 }}>
          {crit > 0 && <span style={{ color: "#dc2626" }}>● 要対応 {crit}</span>}
          {warn > 0 && <span style={{ color: "#d97706" }}>● 注意 {warn}</span>}
          {info > 0 && <span style={{ color: "#047857" }}>● 提案 {info}</span>}
          {generatedAt && <span style={{ color: "#94a3b8", fontWeight: 400 }}>監視 {generatedAt}</span>}
        </div>
      </div>
      {items.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>{items.map(renderRow)}</div>
      ) : (
        <div style={{ fontSize: 12.5, color: "#64748b", padding: "4px 2px" }}>未対応はありません（対応済み・様子見 {nh}件）。</div>
      )}
      {nh > 0 && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setShowHandled((v) => !v)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#64748b", padding: 0 }}>
            対応済み・様子見 {nh}件 {showHandled ? "▲" : "▼"}
          </button>
          {showHandled && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8, marginTop: 8 }}>
              {handled.map((a) => {
                const op = (ops && ops[a.key]) || {};
                const st = op.status === "ack" ? "確認済み" : op.status === "snooze" ? `様子見〜${(op.until || "").slice(0, 10)}` : "";
                return (
                  <div key={a.key} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", border: "1px solid #f1f5f4", borderRadius: 8, background: "#fafbfa", opacity: 0.85 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{a.client}<MediaPill m={a.media} />{a.kind && <span style={{ marginLeft: 4, color: "#94a3b8" }}>{a.kind}</span>}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{st}{op.by ? `・${op.by}` : ""}{op.memo ? `・📝${op.memo}` : ""}</div>
                    </div>
                    <button style={{ ...btn, flexShrink: 0 }} onClick={() => onClear(a.key)}>戻す</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// 金額表示（円・負値は−）。予算/契約表示の共通フォーマッタ。
function fmtYen(n) { if (n == null || isNaN(n)) return "—"; return (n < 0 ? "−¥" : "¥") + Math.abs(n).toLocaleString("ja-JP"); }

// ===== 予算モデル =====
// budgets[client] = { base:[{media,amount}], months:{ "YYYY-MM":{ contract:[{media,amount}]|null, adds:[{label,media,amount}] } } }
// 契約は「変更した月だけ」記録し、以降の月は引き継ぐ（carry-forward）。追加はその月だけ有効（キャンペーン等）。
function sumLines(lines) { return (lines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0); }
// 指定月の実効予算：契約(当月変更→直近過去→base→benchmarks月予算)＋当月の追加。
function effectiveBudget(bud, month, fallbackMonthly) {
  bud = bud || {};
  const months = bud.months || {};
  let contract = null, contractMonth = null;
  if (months[month] && Array.isArray(months[month].contract) && months[month].contract.length) { contract = months[month].contract; contractMonth = month; }
  if (!contract) {
    const past = Object.keys(months).filter((m) => m < month && Array.isArray(months[m].contract) && months[m].contract.length).sort();
    if (past.length) { contractMonth = past[past.length - 1]; contract = months[contractMonth].contract; }
  }
  if (!contract && Array.isArray(bud.base) && bud.base.length) { contract = bud.base; contractMonth = "base"; }
  const fromBench = !contract;
  if (!contract) contract = fallbackMonthly != null ? [{ media: "（契約未設定）", amount: fallbackMonthly }] : [];
  const adds = (months[month] && Array.isArray(months[month].adds)) ? months[month].adds : [];
  const contractTotal = sumLines(contract);
  const addsTotal = adds.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  return { contract, contractMonth, adds, contractTotal, addsTotal, total: contractTotal + addsTotal, fromBench };
}
// monthly.json（Google/Meta両対応の月次）から当月(部分)の client 実消化・CV を合算。
function clientMonthActual(accts, monthlyMap, month) {
  let cost = 0, cv = 0, has = false;
  (accts || []).forEach((c) => {
    const arr = monthlyMap[`${c.client}|${c.media}`] || [];
    const e = arr.find((x) => x.month === month);
    if (e) { has = true; cost += e.cost || 0; cv += e.cv || 0; }
  });
  return has ? { cost, cv } : null;
}

// クライアントの契約予算パネル。契約(媒体別)＋追加(キャンペーン)＝今月の予算。実消化(monthly.json)と対比し、消化ペース・月末着地を「今月の予算」基準で表示。
function ClientBudgetCard({ cl, bud, monthlyMap, asOfDate }) {
  const now = asOfDate || new Date();
  const month = now.toISOString().slice(0, 7);
  const [Y, M] = month.split("-").map(Number);
  const daysInMonth = new Date(Y, M, 0).getDate();
  const elapsed = Math.min(daysInMonth, Math.max(1, now.getDate()));
  const eb = effectiveBudget(bud, month, cl.monthly);
  const act = clientMonthActual(cl.accts, monthlyMap, month);
  const spentMTD = act ? act.cost : null;
  const cvMTD = act ? act.cv : null;
  const pace = (spentMTD != null && eb.total) ? Math.round((spentMTD / eb.total) * 100) : null;
  const projSpend = spentMTD != null ? Math.round((spentMTD / elapsed) * daysInMonth) : null;
  const projPct = (projSpend != null && eb.total) ? Math.round((projSpend / eb.total) * 100) : null;
  const projCv = cvMTD != null ? Math.round((cvMTD / elapsed) * daysInMonth) : null;
  const projC = projPct == null ? "#475569" : Math.abs(projPct - 100) <= 10 ? "#047857" : projPct > 100 ? "#dc2626" : "#d97706";
  const paceC = pace == null ? "#94a3b8" : pace > 110 ? "#dc2626" : pace >= 45 ? "#047857" : "#d97706";
  const box = { background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, padding: 15, marginBottom: 22 };
  const lbl = { fontSize: 10.5, color: "#94a3b8" };
  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0f2a1f" }}>今月の予算（契約 ＋ 追加）</span>
        <span style={{ fontSize: 12, color: "#64748b" }}>{M}月</span>
        {eb.fromBench && <span style={{ fontSize: 10.5, color: "#b45309", background: "#fdf6e3", borderRadius: 6, padding: "1px 7px" }}>契約未設定（月予算から仮置き・目標設定で登録）</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.1fr 0.9fr", gap: 14, alignItems: "start" }}>
        {/* 契約 */}
        <div>
          <div style={{ ...lbl, marginBottom: 3 }}>契約（媒体別）{eb.contractMonth && eb.contractMonth !== month && eb.contractMonth !== "base" ? `・${eb.contractMonth.replace("-", "年")}月〜` : ""}</div>
          {eb.contract.length === 0 ? <div style={{ fontSize: 12, color: "#94a3b8" }}>—</div> : eb.contract.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#334155", padding: "1px 0" }}>
              <span style={{ color: "#cbd5e1" }}>└</span><span style={{ fontWeight: 600 }}>{l.media || "（媒体未記入）"}</span>
              <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmtYen(l.amount)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, fontSize: 12, color: "#64748b", borderTop: "1px dashed #eef2f0", marginTop: 3, paddingTop: 3 }}>契約計 <b style={{ color: "#0f2a1f" }}>{fmtYen(eb.contractTotal)}</b></div>
        </div>
        {/* 追加 */}
        <div>
          <div style={{ ...lbl, marginBottom: 3 }}>今月の追加（キャンペーン等）</div>
          {eb.adds.length === 0 ? <div style={{ fontSize: 12, color: "#94a3b8" }}>なし</div> : eb.adds.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#334155", padding: "1px 0" }}>
              <span style={{ color: "#1a56db", fontWeight: 700 }}>＋</span><span style={{ fontWeight: 600 }}>{a.label || "追加"}{a.media ? `（${a.media}）` : ""}</span>
              <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#1a56db" }}>{fmtYen(a.amount)}</span>
            </div>
          ))}
          {eb.adds.length > 0 && <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, fontSize: 12, color: "#64748b", borderTop: "1px dashed #eef2f0", marginTop: 3, paddingTop: 3 }}>追加計 <b style={{ color: "#1a56db" }}>{fmtYen(eb.addsTotal)}</b></div>}
        </div>
        {/* 今月の予算 */}
        <div style={{ background: "#f0f7f4", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
          <div style={lbl}>今月の予算</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f2a1f", fontVariantNumeric: "tabular-nums" }}>{fmtYen(eb.total)}</div>
          <div style={{ fontSize: 10.5, color: "#64748b" }}>契約 {fmtYen(eb.contractTotal)}{eb.addsTotal ? ` ＋ 追加 ${fmtYen(eb.addsTotal)}` : ""}</div>
        </div>
      </div>
      {/* 予算消化・月末着地（今月の予算基準） */}
      <div style={{ marginTop: 12, borderTop: "1px solid #f1f5f4", paddingTop: 10 }}>
        {spentMTD == null ? (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>当月の実消化データがありません（monthly.json 未取得）。</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 5, flexWrap: "wrap", gap: 4 }}>
              <span style={{ color: "#64748b" }}>予算消化（当月）</span>
              <span style={{ color: paceC, fontWeight: 700 }}>{fmtYen(spentMTD)} / {fmtYen(eb.total)}（{pace}%）・{elapsed}/{daysInMonth}日</span>
            </div>
            <div style={{ height: 7, background: "#eef1f4", borderRadius: 999, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ width: Math.min(pace || 0, 100) + "%", height: "100%", background: paceC }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              <div><div style={lbl}>着地見込（費用）</div><div style={{ fontSize: 14, fontWeight: 700, color: projC }}>{fmtYen(projSpend)}</div><div style={lbl}>今月の予算比 {projPct}%</div></div>
              <div><div style={lbl}>着地見込（CV）</div><div style={{ fontSize: 14, fontWeight: 700, color: "#0f2a1f" }}>{projCv}件</div><div style={lbl}>当月 {cvMTD}件</div></div>
              <div><div style={lbl}>残り予算</div><div style={{ fontSize: 14, fontWeight: 700, color: eb.total - spentMTD < 0 ? "#dc2626" : "#0f2a1f" }}>{fmtYen(eb.total - spentMTD)}</div><div style={lbl}>残 {daysInMonth - elapsed}日</div></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, note }) {
  return (<div style={{ marginBottom: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 7 }}>{icon}<span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span></div>{note && <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>{note}</div>}</div>);
}
function TableHead({ cols, which }) {
  const tmpl = which === "conn" ? "1.4fr 0.8fr 1fr 0.9fr 0.9fr 0.6fr 0.8fr" : "1.4fr 0.7fr 0.9fr 0.9fr 1.1fr 0.6fr 0.5fr 0.7fr";
  return (<div style={{ display: "grid", gridTemplateColumns: tmpl, padding: "9px 14px", background: "#f2f5f3", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 0.3 }}>{cols.map((c) => <span key={c}>{c}</span>)}</div>);
}
function MediaPill({ m }) {
  const S = {
    google: { bg: "#e8f0fe", c: "#1a56db", label: "Google" },
    meta: { bg: "#eef0ff", c: "#4338ca", label: "Meta" },
    yahoo_search: { bg: "#fdeaea", c: "#d1341f", label: "Yahoo!検索" },
    yahoo_display: { bg: "#fdeaea", c: "#b91c1c", label: "Yahoo!ディスプレイ" },
  };
  const s = S[m] || (String(m).indexOf("yahoo") === 0 ? { bg: "#fdeaea", c: "#d1341f", label: "Yahoo!" } : S.meta);
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999, margin: "0 2px", background: s.bg, color: s.c }}>{s.label}</span>;
}
function LargePill() {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, marginLeft: 6, background: "#fdf6e3", color: "#b45309" }}><Star size={9} fill="#b45309" color="#b45309" />大型</span>;
}
function MiniStat({ label, value, bad }) {
  return <div><div style={{ fontSize: 10.5, color: "#94a3b8" }}>{label}</div><div style={{ fontSize: 14, fontWeight: 700, color: bad ? "#dc2626" : "#0f2a1f" }}>{value}</div></div>;
}
// 値＋前月比つきのセル（クライアント別カード用・列が揃うようgridで使う）
function StatCell({ label, value, d, dir, bad }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: bad ? "#dc2626" : "#0f2a1f" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>前月 <DeltaTag v={d} dir={dir} /></div>
    </div>
  );
}
function Empty({ text }) { return <div style={{ background: "#fff", border: "1px dashed #d7e0db", borderRadius: 10, padding: "18px 14px", fontSize: 12.5, color: "#94a3b8", textAlign: "center" }}>{text}</div>; }

// 1クライアントの契約・追加の編集フォーム（対象月）。契約=媒体別内訳（自由記述）、追加=キャンペーン等。保存で months[月] に反映。
function BudgetClientEditor({ eb, onSave }) {
  const [contract, setContract] = useState(() => (eb.fromBench || !eb.contract.length ? [{ media: "", amount: "" }] : eb.contract.map((l) => ({ media: l.media || "", amount: l.amount == null ? "" : String(l.amount) }))));
  const [adds, setAdds] = useState(() => eb.adds.map((a) => ({ label: a.label || "", media: a.media || "", amount: a.amount == null ? "" : String(a.amount) })));
  const [saved, setSaved] = useState(false);
  const touch = () => setSaved(false);
  const setC = (i, k, v) => { touch(); setContract((p) => p.map((l, idx) => (idx === i ? { ...l, [k]: v } : l))); };
  const setA = (i, k, v) => { touch(); setAdds((p) => p.map((a, idx) => (idx === i ? { ...a, [k]: v } : a))); };
  const inp = { padding: "6px 9px", border: "1px solid #d7e0db", borderRadius: 7, fontSize: 12.5, background: "#fff" };
  const cTotal = contract.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const aTotal = adds.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const save = () => {
    const c = contract.map((l) => ({ media: l.media.trim(), amount: l.amount === "" ? 0 : Number(l.amount) })).filter((l) => l.media || l.amount);
    const a = adds.map((x) => ({ label: x.label.trim(), media: x.media.trim(), amount: x.amount === "" ? 0 : Number(x.amount) })).filter((x) => x.label || x.amount);
    onSave(c, a); setSaved(true);
  };
  return (
    <div style={{ background: "#f8faf9", borderTop: "1px solid #eef1f4", padding: 13 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* 契約 */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0f2a1f", marginBottom: 6 }}>契約（媒体別・この月の契約）</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {contract.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ color: "#cbd5e1", fontSize: 13 }}>└</span>
                <input value={l.media} onChange={(e) => setC(i, "media", e.target.value)} placeholder="媒体（例：Google検索 / Meta / Yahoo!）" style={{ ...inp, flex: 1, minWidth: 130 }} />
                <input type="number" value={l.amount} onChange={(e) => setC(i, "amount", e.target.value)} placeholder="金額(円)" style={{ ...inp, width: 120, textAlign: "right" }} />
                <button onClick={() => { touch(); setContract((p) => (p.length <= 1 ? [{ media: "", amount: "" }] : p.filter((_, idx) => idx !== i))); }} title="削除" style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 15, width: 18 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
            <button onClick={() => { touch(); setContract((p) => [...p, { media: "", amount: "" }]); }} style={{ border: "1px dashed #c7d2cc", background: "#fff", color: "#0f766e", borderRadius: 7, padding: "4px 9px", fontSize: 11.5, cursor: "pointer" }}>＋ 媒体を追加</button>
            <span style={{ fontSize: 11.5, color: "#64748b" }}>契約計 <b style={{ color: "#0f2a1f" }}>{fmtYen(cTotal)}</b></span>
          </div>
        </div>
        {/* 追加 */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0f2a1f", marginBottom: 6 }}>今月の追加（キャンペーン等）</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {adds.length === 0 && <div style={{ fontSize: 11.5, color: "#94a3b8" }}>追加なし</div>}
            {adds.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ color: "#1a56db", fontWeight: 700 }}>＋</span>
                <input value={a.label} onChange={(e) => setA(i, "label", e.target.value)} placeholder="名目（例：夏キャンペーン）" style={{ ...inp, flex: 1, minWidth: 110 }} />
                <input value={a.media} onChange={(e) => setA(i, "media", e.target.value)} placeholder="媒体(任意)" style={{ ...inp, width: 90 }} />
                <input type="number" value={a.amount} onChange={(e) => setA(i, "amount", e.target.value)} placeholder="金額(円)" style={{ ...inp, width: 110, textAlign: "right" }} />
                <button onClick={() => { touch(); setAdds((p) => p.filter((_, idx) => idx !== i)); }} title="削除" style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 15, width: 18 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
            <button onClick={() => { touch(); setAdds((p) => [...p, { label: "", media: "", amount: "" }]); }} style={{ border: "1px dashed #c7d2cc", background: "#fff", color: "#1a56db", borderRadius: 7, padding: "4px 9px", fontSize: 11.5, cursor: "pointer" }}>＋ キャンペーンを追加</button>
            {aTotal > 0 && <span style={{ fontSize: 11.5, color: "#64748b" }}>追加計 <b style={{ color: "#1a56db" }}>{fmtYen(aTotal)}</b></span>}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, borderTop: "1px dashed #e6ebe8", paddingTop: 10 }}>
        <span style={{ fontSize: 12.5 }}>今月の予算 <b style={{ fontSize: 15, color: "#0f2a1f" }}>{fmtYen(cTotal + aTotal)}</b></span>
        <button onClick={save} style={{ ...btnP, marginLeft: "auto" }}><Check size={15} /> この月を保存</button>
        {saved && <span style={{ fontSize: 12, color: "#047857", fontWeight: 700 }}>保存しました</span>}
      </div>
    </div>
  );
}

// 契約・予算エディタ（目標設定タブ）。対象月を選び、クライアント別に契約(媒体別)＋追加を編集。今月の予算＝契約＋追加。予算消化判定に連動。
function BudgetEditor({ clients, budgets, onSave }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [open, setOpen] = useState(null);
  const applyClient = (client, contract, adds) => {
    const cur = budgets[client] || {};
    const months = { ...(cur.months || {}) };
    const m = { ...(months[month] || {}) };
    if (contract && contract.length) m.contract = contract; else delete m.contract;
    if (adds && adds.length) m.adds = adds; else delete m.adds;
    if (Object.keys(m).length) months[month] = m; else delete months[month];
    onSave({ ...budgets, [client]: { ...cur, months } });
  };
  const inp = { padding: "6px 10px", border: "1px solid #d7e0db", borderRadius: 8, fontSize: 12.5, background: "#fff" };
  return (
    <div style={{ marginTop: 26 }}>
      <SectionTitle icon={<span style={{ fontSize: 15 }}>💰</span>} title="契約・予算（媒体別）" note="契約（ベース月額）と、その月の追加（キャンペーン等）を登録。今月の予算＝契約＋追加。予算消化・月末着地予測がこの予算に連動します。契約は変更した月だけ登録すれば以降は引き継ぎます。" />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "#64748b" }}>対象月</span>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ ...inp, width: 150 }} />
        <span style={{ fontSize: 11.5, color: "#94a3b8" }}>行をクリックで開閉。契約は変更月のみ・追加はその月のみ有効。</span>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, overflow: "hidden" }}>
        {clients.map((cl, i) => {
          const eb = effectiveBudget(budgets[cl.client], month, cl.monthly);
          const isOpen = open === cl.client;
          return (
            <div key={cl.client}>
              <div onClick={() => setOpen(isOpen ? null : cl.client)} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.9fr 1fr 24px", gap: 8, alignItems: "center", padding: "11px 14px", borderTop: i ? "1px solid #f1f5f4" : "none", cursor: "pointer", background: isOpen ? "#f8faf9" : "#fff" }}>
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>{cl.client}{cl.tier === "large" && <LargePill />}</span>
                <span style={{ fontSize: 12, color: "#475569" }}>契約 {fmtYen(eb.contractTotal)}{eb.fromBench ? <span style={{ color: "#b45309", fontSize: 10.5 }}> (仮)</span> : ""}</span>
                <span style={{ fontSize: 12, color: eb.addsTotal ? "#1a56db" : "#94a3b8" }}>追加 {eb.addsTotal ? fmtYen(eb.addsTotal) : "—"}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0f2a1f" }}>今月 {fmtYen(eb.total)}</span>
                <ChevronRight size={15} color="#cbd5e1" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              </div>
              {isOpen && <BudgetClientEditor key={cl.client + "|" + month} eb={eb} onSave={(c, a) => applyClient(cl.client, c, a)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 目標入力ボックス：目標CPA(円)・月予算(万円)。保存=この端末(localStorage)へ→アラートに即反映。エクスポート=benchmarks.json用JSONをコピー。
function TargetEditor({ clients, targets, onSave }) {
  const [draft, setDraft] = useState(() => {
    const d = {};
    clients.forEach((cl) => {
      const t = targets[cl.client] || {};
      const bench = (cl.accts[0] && cl.accts[0].bench) || {};   // benchmarks.json 由来の現行値
      const mo = t.monthly != null ? t.monthly : cl.monthly;
      d[cl.client] = {
        targetCpa: t.targetCpa ?? bench.targetCpa ?? "",
        cpcMax: t.cpcMax ?? bench.cpcMax ?? "",
        monthly: mo != null ? mo / 10000 : "",
        cadence: t.cadence ?? bench.cadence ?? "",
      };
    });
    return d;
  });
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = (name, key, val) => { setSaved(false); setDraft((p) => ({ ...p, [name]: { ...(p[name] || {}), [key]: val } })); };
  const build = () => {
    const out = {};
    clients.forEach((cl) => {
      const v = draft[cl.client] || {};
      const tc = v.targetCpa === "" || v.targetCpa == null ? null : Number(v.targetCpa);
      const mo = v.monthly === "" || v.monthly == null ? null : Math.round(Number(v.monthly) * 10000);
      const cm = v.cpcMax === "" || v.cpcMax == null ? null : Number(v.cpcMax);
      const o = {};
      if (tc != null && !isNaN(tc)) o.targetCpa = tc;
      if (cm != null && !isNaN(cm)) o.cpcMax = cm;
      if (mo != null && !isNaN(mo)) o.monthly = mo;
      if (v.cadence === "daily" || v.cadence === "weekly") o.cadence = v.cadence;
      if (Object.keys(o).length) out[cl.client] = o;
    });
    return out;
  };
  const save = () => { onSave(build()); setSaved(true); };
  const exportJson = () => {
    const json = JSON.stringify({ _comment: "個社の基準（目標）。consoleの目標設定からエクスポート。キーは広告アカウント名(=client)。", byClient: build() }, null, 2);
    if (navigator.clipboard) navigator.clipboard.writeText(json);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const inp = { width: "90%", maxWidth: 120, padding: "6px 8px", border: "1px solid #d7e0db", borderRadius: 7, fontSize: 12.5, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const tmpl = "1.35fr 0.6fr 0.35fr 0.8fr 0.8fr 0.8fr 0.75fr";
  const head = { display: "grid", gridTemplateColumns: tmpl, padding: "9px 12px", background: "#f2f5f3", fontSize: 11, fontWeight: 700, color: "#64748b" };
  const sel = { padding: "5px 6px", border: "1px solid #d7e0db", borderRadius: 7, fontSize: 12, background: "#fff" };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={save} style={btnP}><Check size={15} /> 保存（この端末）</button>
        <button onClick={exportJson} style={btnS}>{copied ? "コピー済" : "benchmarks.json をコピー"}</button>
        {saved && <span style={{ fontSize: 12, color: "#047857", fontWeight: 700 }}>保存しました。アラート/基準チェックに反映されます。</span>}
      </div>
      <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, overflow: "hidden" }}>
        <div style={head}>
          <span>クライアント</span><span style={{ textAlign: "right" }}>現CPA</span><span style={{ textAlign: "right" }}>CV</span>
          <span style={{ textAlign: "right" }}>目標CPA(円)</span><span style={{ textAlign: "right" }}>CPC上限(円)</span><span style={{ textAlign: "right" }}>月予算(万円)</span><span style={{ textAlign: "right" }}>監視頻度</span>
        </div>
        {clients.map((cl, i) => {
          const a = agg(cl.accts); const v = draft[cl.client] || {};
          return (
            <div key={cl.client} style={{ display: "grid", gridTemplateColumns: tmpl, alignItems: "center", padding: "8px 12px", borderTop: i ? "1px solid #f1f5f4" : "none" }}>
              <span style={{ fontWeight: 600, fontSize: 12.5 }}>{cl.client}{cl.tier === "large" && <LargePill />}</span>
              <span style={{ textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{a.cpa ? yen(a.cpa) : "—"}</span>
              <span style={{ textAlign: "right", color: "#94a3b8" }}>{a.cv}</span>
              <span style={{ textAlign: "right" }}><input type="number" value={v.targetCpa ?? ""} onChange={(e) => set(cl.client, "targetCpa", e.target.value)} placeholder="—" style={inp} /></span>
              <span style={{ textAlign: "right" }}><input type="number" value={v.cpcMax ?? ""} onChange={(e) => set(cl.client, "cpcMax", e.target.value)} placeholder="—" style={inp} /></span>
              <span style={{ textAlign: "right" }}><input type="number" value={v.monthly ?? ""} onChange={(e) => set(cl.client, "monthly", e.target.value)} placeholder="—" style={inp} /></span>
              <span style={{ textAlign: "right" }}>
                <select value={v.cadence ?? ""} onChange={(e) => set(cl.client, "cadence", e.target.value)} style={sel}>
                  <option value="">自動</option><option value="daily">日次</option><option value="weekly">週次</option>
                </select>
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8", lineHeight: 1.7 }}>
        ※「保存」はこの端末(ブラウザ)に保存し、アラート/基準チェックへ即反映。恒久保存は「benchmarks.json をコピー」→ <code>clients/benchmarks.json</code> に貼付けてコミット。目標CPAを入れると「+20%＝悪化／+50%＝重度」を自動判定します。
      </div>
    </div>
  );
}

// 目標の変更履歴（誰が・いつ・何を・変更前→後）— CLAUDE.md §4 準拠
function TargetHistory({ history }) {
  const [copied, setCopied] = useState(false);
  const fmt = (field, v) => (v == null ? "未設定" : field === "月予算" ? man(v)
    : field === "監視頻度" ? (v === "daily" ? "日次" : v === "weekly" ? "週次" : v) : yen(v));
  const copyCsv = () => {
    const rows = [["日時", "クライアント", "項目", "変更前", "変更後", "担当"],
      ...history.map((h) => [h.at, h.client, h.field, h.from == null ? "未設定" : h.from, h.to == null ? "未設定" : h.to, h.by])];
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    if (navigator.clipboard) navigator.clipboard.writeText(csv);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const tmpl = "1.2fr 1.6fr 0.7fr 1.5fr 0.7fr";
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Clock size={16} color="#047857" /><span style={{ fontSize: 15, fontWeight: 700 }}>変更履歴</span></div>
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>{history.length ? "目標の変更を記録（誰が・いつ・変更前→後）。" : "まだ変更履歴はありません。目標を保存すると記録されます。"}</div>
        </div>
        {history.length > 0 && <button onClick={copyCsv} style={btnS}>{copied ? "コピー済" : "履歴をCSVでコピー"}</button>}
      </div>
      {history.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: tmpl, padding: "9px 12px", background: "#f2f5f3", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
            <span>日時</span><span>クライアント</span><span>項目</span><span>変更前 → 変更後</span><span>担当</span>
          </div>
          {history.slice(0, 100).map((h, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: tmpl, alignItems: "center", padding: "8px 12px", fontSize: 12, borderTop: i ? "1px solid #f1f5f4" : "none" }}>
              <span style={{ color: "#94a3b8" }}>{h.at}</span>
              <span style={{ fontWeight: 600 }}>{h.client}</span>
              <span style={{ color: "#475569" }}>{h.field}</span>
              <span><span style={{ color: "#94a3b8" }}>{fmt(h.field, h.from)}</span> <span style={{ color: "#cbd5e1" }}>→</span> <span style={{ color: "#0f2a1f", fontWeight: 700 }}>{fmt(h.field, h.to)}</span></span>
              <span style={{ color: "#475569" }}>{h.by}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeltaTag({ v, dir }) {
  if (v == null) return <span style={{ color: "#94a3b8" }}>—</span>;
  const up = v >= 0;
  const good = dir === 0 ? null : (dir === 1 ? up : !up);
  const color = good == null ? "#64748b" : good ? "#047857" : "#dc2626";
  return <span style={{ color, fontWeight: 700 }}>{up ? "▲" : "▼"}{Math.abs(v).toFixed(0)}%</span>;
}

const JUDGE = {
  good: { label: "良好", c: "#047857", bg: "#ecfdf5" },
  warn: { label: "注意", c: "#d97706", bg: "#fffbeb" },
  crit: { label: "要対応", c: "#dc2626", bg: "#fef2f2" },
  none: { label: "未設定", c: "#94a3b8", bg: "#f1f5f4" },
};

// 各指標を基準と照合して判定（運用サポート）。直近7日の実績で評価。
function BenchmarkChecks({ c }) {
  const m = c.metrics.d7;
  const b = c.bench || {};
  const checks = [];

  if (c.dailyBudget) {
    const pace = (m.spend / (c.dailyBudget * 7)) * 100;
    const hi = (b.pacingHigh ?? 1.1) * 100, lo = (b.pacingLow ?? 0.7) * 100;
    checks.push({ name: "予算ペース", actual: Math.round(pace) + "%", std: `${Math.round(lo)}–${Math.round(hi)}%`,
      gap: pace > hi ? `+${Math.round(pace - hi)}pt 超過` : pace < lo ? `${Math.round(pace - lo)}pt 未消化` : "適正",
      j: pace > hi || pace < lo ? "warn" : "good" });
  }
  checks.push({ name: "コンバージョン", actual: m.cv + "件", std: "1件以上",
    gap: m.cv === 0 && m.spend > 0 ? "費用消化中でCV0" : "—",
    j: m.cv === 0 && m.spend > 0 ? "crit" : "good" });
  checks.push({ name: "CTR", actual: m.ctr + "%", std: `≥ ${b.ctrMin ?? 1.0}%`,
    gap: m.ctr < (b.ctrMin ?? 1.0) ? `${(m.ctr - (b.ctrMin ?? 1.0)).toFixed(2)}pt` : "基準クリア",
    j: m.ctr < (b.ctrMin ?? 1.0) ? "warn" : "good" });
  if (b.cpcMax) {
    checks.push({ name: "CPC", actual: yen(m.cpc), std: `≤ ${yen(b.cpcMax)}`,
      gap: m.cpc > b.cpcMax ? `+${Math.round((m.cpc / b.cpcMax - 1) * 100)}%` : "基準クリア",
      j: m.cpc > b.cpcMax * 1.3 ? "crit" : m.cpc > b.cpcMax ? "warn" : "good" });
  }
  if (m.freq != null && m.freq > 0) {
    const fmax = b.freqMax ?? 3.5;
    checks.push({ name: "フリークエンシー", actual: m.freq.toFixed(2), std: `≤ ${fmax}`,
      gap: m.freq > fmax ? `+${(m.freq - fmax).toFixed(2)} 超過` : "適正",
      j: m.freq > fmax ? "warn" : "good" });
  }
  if (b.targetCpa) {
    const over = m.cpa ? m.cpa / b.targetCpa - 1 : null;
    checks.push({ name: "CPA", actual: m.cpa ? yen(m.cpa) : "—", std: `≤ ${yen(b.targetCpa)}`,
      gap: over == null ? "—" : `${over >= 0 ? "+" : ""}${Math.round(over * 100)}%`,
      j: over == null ? "none" : over >= (b.cpaSeverePct ?? 0.5) ? "crit" : over >= (b.cpaWarnPct ?? 0.2) ? "warn" : "good" });
  } else {
    checks.push({ name: "CPA", actual: m.cpa ? yen(m.cpa) : "—", std: "目標未設定", gap: "—", j: "none" });
  }
  if (b.targetRoas) {
    const under = m.roas ? 1 - m.roas / b.targetRoas : null;
    checks.push({ name: "ROAS", actual: m.roas ? m.roas + "x" : "—", std: `≥ ${b.targetRoas}x`,
      gap: under == null ? "—" : `${under > 0 ? "-" : "+"}${Math.abs(Math.round(under * 100))}%`,
      j: under == null ? "none" : under >= 0.2 ? "warn" : "good" });
  } else {
    checks.push({ name: "ROAS", actual: m.roas ? m.roas + "x" : "—", std: "目標未設定", gap: "—", j: "none" });
  }

  const cell = { padding: "7px 8px", fontSize: 12, fontVariantNumeric: "tabular-nums" };
  const head = { ...cell, color: "#94a3b8", fontWeight: 600, fontSize: 11, borderBottom: "1px solid #eef1f4", textAlign: "left" };
  return (
    <div style={{ marginTop: 4, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#0f2a1f", marginBottom: 6 }}>
        <ShieldCheck size={14} color="#047857" /> 基準チェック（直近7日 / 基準：{b.source || "全社既定"}）
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 320 }}>
          <thead><tr>
            <th style={head}>指標</th><th style={{ ...head, textAlign: "right" }}>実績</th>
            <th style={{ ...head, textAlign: "right" }}>基準</th><th style={{ ...head, textAlign: "right" }}>ズレ</th>
            <th style={{ ...head, textAlign: "center" }}>判定</th>
          </tr></thead>
          <tbody>
            {checks.map((ch) => {
              const jj = JUDGE[ch.j];
              return (
                <tr key={ch.name} style={{ borderBottom: "1px solid #f6f8f7" }}>
                  <td style={{ ...cell, color: "#0f2a1f", fontWeight: 600 }}>{ch.name}</td>
                  <td style={{ ...cell, textAlign: "right", color: "#0f2a1f", fontWeight: 700 }}>{ch.actual}</td>
                  <td style={{ ...cell, textAlign: "right", color: "#64748b" }}>{ch.std}</td>
                  <td style={{ ...cell, textAlign: "right", color: jj.c }}>{ch.gap}</td>
                  <td style={{ ...cell, textAlign: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: jj.bg, color: jj.c }}>{jj.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 月次トレンド（前年同月比＋最大13ヶ月の推移）。長期の伸び/落ちを把握。
function MonthlyTrend({ series, generated, target, bench }) {
  if (!series || !series.length) return null;
  const curM = generated ? generated.slice(0, 7) : null;
  const complete = curM ? series.filter((m) => m.month !== curM) : series;
  const base = complete.length ? complete : series;
  const latest = base[base.length - 1];
  const [yy, mm] = latest.month.split("-");
  const prevYM = `${+yy - 1}-${mm}`;
  const prev = series.find((m) => m.month === prevYM);
  const mJp = (s) => (s ? `${+s.split("-")[0]}年${+s.split("-")[1]}月` : "—");
  const pct = (a, b) => (a == null || b == null || b === 0 ? null : Math.round((a / b - 1) * 100));
  const chart = series.slice(-13);
  const maxC = Math.max(1, ...chart.map((m) => m.cost || 0));
  const W = 560, H = 130, padL = 40, padT = 8, padB = 22;
  const iw = W - padL - 10, ih = H - padT - padB;
  const bw = iw / chart.length;
  const fmtY = (n) => (n >= 10000 ? Math.round(n / 10000) + "万" : n >= 1000 ? Math.round(n / 1000) + "k" : "" + n);
  const cpaCol = (cpa) => cpaColor(cpa, target, bench);
  const cards = [
    { k: "費用", cur: yen(latest.cost), prev: prev ? yen(prev.cost) : "—", d: prev ? pct(latest.cost, prev.cost) : null, dir: 0 },
    { k: "CV", cur: Math.round(latest.cv) + "件", prev: prev ? Math.round(prev.cv) + "件" : "—", d: prev ? pct(latest.cv, prev.cv) : null, dir: 1 },
    { k: "CPA", cur: latest.cpa ? yen(latest.cpa) : "—", prev: prev && prev.cpa ? yen(prev.cpa) : "—", d: prev ? pct(latest.cpa, prev.cpa) : null, dir: -1, col: cpaCol(latest.cpa) },
  ];
  return (
    <div style={{ marginTop: 14, borderTop: "1px solid #eef1f4", paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#0f2a1f", marginBottom: 2 }}>
        <TrendingUp size={14} color="#047857" /> 月次トレンド（前年同月比）
      </div>
      <div style={{ fontSize: 10.5, color: "#94a3b8", marginBottom: 8 }}>{prev ? `${mJp(latest.month)}（確定月）と ${mJp(prevYM)} を比較。` : `${mJp(latest.month)}（前年同月のデータなし）。`}緑＝改善／赤＝悪化。</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 12 }}>
        {cards.map((c) => (
          <div key={c.k}>
            <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{c.k}（{mJp(latest.month)}）</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.col || "#0f2a1f" }}>{c.cur}</div>
            <div style={{ fontSize: 10.5, color: "#94a3b8", display: "flex", gap: 5, alignItems: "center" }}>前年 {c.prev} {c.d != null && <DeltaTag v={c.d} dir={c.dir} />}</div>
          </div>
        ))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 420, height: "auto" }}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={padL} y1={padT + ih - f * ih} x2={W - 10} y2={padT + ih - f * ih} stroke="#eef1f4" />
              <text x={padL - 5} y={padT + ih - f * ih + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{fmtY(maxC * f)}</text>
            </g>
          ))}
          {chart.map((m, i) => {
            const h = (m.cost / maxC) * ih;
            const hot = m.month === latest.month || m.month === prevYM;
            return (
              <g key={m.month}>
                <rect x={padL + i * bw + 1} y={padT + ih - h} width={Math.max(1, bw - 3)} height={h} fill={m.month === latest.month ? "#0f7a52" : m.month === prevYM ? "#c9a227" : "#cfe0d7"} rx="1" />
                {(i === 0 || i === chart.length - 1 || m.month.endsWith("-01")) &&
                  <text x={padL + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="8.5" fill="#94a3b8">{m.month.slice(2).replace("-", "/")}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>棒＝月間費用（最大{chart.length}ヶ月）。<span style={{ color: "#0f7a52" }}>■</span>直近確定月 ／ <span style={{ color: "#c9a227" }}>■</span>前年同月。</div>
    </div>
  );
}

// 監査チェック（ads-google観点の機械監査）：スコア/グレード＋各項目の pass/warn/fail
function AuditReport({ a }) {
  if (!a || a.error) return null;
  const gradeColor = (a.grade === "A" || a.grade === "B") ? "#047857" : a.grade === "C" ? "#d97706" : "#dc2626";
  const SV = { pass: { c: "#047857", bg: "#ecfdf5", mk: "✓" }, warn: { c: "#d97706", bg: "#fffbeb", mk: "△" }, fail: { c: "#dc2626", bg: "#fef2f2", mk: "✗" } };
  const order = { fail: 0, warn: 1, pass: 2 };
  const fs = [...(a.findings || [])].sort((x, y) => (order[x.sev] ?? 3) - (order[y.sev] ?? 3));
  const nFail = fs.filter((f) => f.sev === "fail").length, nWarn = fs.filter((f) => f.sev === "warn").length, nPass = fs.filter((f) => f.sev === "pass").length;
  return (
    <div style={{ marginTop: 14, borderTop: "1px solid #eef1f4", paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <ShieldCheck size={15} color="#047857" />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0f2a1f" }}>監査チェック（ads-google 観点）</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: gradeColor, borderRadius: 6, padding: "1px 8px" }}>{a.grade} ・ {a.score}/100</span>
        <span style={{ fontSize: 11, color: "#64748b" }}>要対応{nFail}・注意{nWarn}・良好{nPass}</span>
      </div>
      <div style={{ fontSize: 11.5, color: "#475569", marginBottom: 8 }}>{a.summary}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {fs.map((f, i) => {
          const s = SV[f.sev] || SV.warn;
          return (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, background: s.bg, color: s.c, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.mk}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0f2a1f" }}>{f.title}</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>{f.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>※データから自動チェック（{a.period}）。コンバージョン計測・無駄消化KW・配信手法の効率差・入札整合・アカウント構造などを ads-google ルールで判定。表現/薬機など人の最終確認は別途。</div>
    </div>
  );
}

// 月末着地予測：当月の消化ペースから月末の 費用/CV/CPA を線形予測。予算・目標との対比つき。
function MonthEndProjection({ days, dailyBudget, target, bench }) {
  if (!days || !days.length) return null;
  const cur = days[days.length - 1].date.slice(0, 7);
  const md = days.filter((d) => d.date.slice(0, 7) === cur);
  if (!md.length) return null;
  const [Y, M] = cur.split("-").map(Number);
  const daysInMonth = new Date(Y, M, 0).getDate();
  const elapsed = Math.max(1, +md[md.length - 1].date.slice(8, 10));
  const spendMTD = md.reduce((s, d) => s + (d.cost || 0), 0);
  const cvMTD = md.reduce((s, d) => s + (d.cv || 0), 0);
  const projSpend = Math.round(spendMTD / elapsed * daysInMonth);
  const projCv = cvMTD / elapsed * daysInMonth;
  const projCpa = projCv ? Math.round(projSpend / projCv) : null;
  const expected = dailyBudget ? dailyBudget * daysInMonth : null;
  const overPct = expected ? Math.round((projSpend / expected - 1) * 100) : null;
  const overC = overPct == null ? "#475569" : Math.abs(overPct) <= 10 ? "#047857" : overPct > 0 ? "#dc2626" : "#d97706";
  const cell = { fontSize: 10.5, color: "#94a3b8" };
  return (
    <div style={{ marginBottom: 12, background: "#f8faf9", border: "1px solid #eef1f4", borderRadius: 8, padding: "9px 12px" }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0f2a1f", marginBottom: 6 }}>月末着地予測（{M}月・{elapsed}/{daysInMonth}日 経過）</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        <div>
          <div style={cell}>費用 着地予測</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: overC }}>{yen(projSpend)}</div>
          <div style={cell}>当月 {yen(spendMTD)}{expected ? ` / 予算 ${yen(expected)}${overPct != null ? `（${overPct > 0 ? "+" : ""}${overPct}%）` : ""}` : ""}</div>
        </div>
        <div>
          <div style={cell}>CV 着地予測</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f2a1f" }}>{Math.round(projCv)}件</div>
          <div style={cell}>当月 {Math.round(cvMTD)}件</div>
        </div>
        <div>
          <div style={cell}>CPA 着地予測</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: cpaColor(projCpa, target, bench) }}>{projCpa ? yen(projCpa) : "—"}</div>
          <div style={cell}>{target ? `目標 ${yen(target)}` : "目標未設定"}</div>
        </div>
      </div>
    </div>
  );
}

// クライアント詳細の「レポート状態」：予算消化＋直近7日/前7日/手法別
function AccountReport({ c, days, byType }) {
  const d7 = c.metrics.d7, lm = c.metrics.lm;
  const lmDays = c.lmDays || 30;
  // rate=率(直接比較) / 総量は1日あたりに正規化して比較（7日÷7 vs 先月÷lmDays）
  const chg = (a, b, rate) => {
    if (a == null || b == null || b === 0) return null;
    return rate ? (a / b - 1) * 100 : ((a / 7) / (b / lmDays) - 1) * 100;
  };
  const cap7 = c.dailyBudget ? c.dailyBudget * 7 : 0;
  const pace = cap7 ? (d7.spend / cap7) * 100 : null;
  const paceC = pace == null ? "#94a3b8" : pace > 110 ? "#dc2626" : pace >= 90 ? "#d97706" : "#047857";
  const rows = [
    { k: "費用", a: yen(d7.spend), b: yen(lm.spend), d: chg(d7.spend, lm.spend, false), dir: 0 },
    { k: "表示回数", a: num(d7.imp), b: num(lm.imp), d: chg(d7.imp, lm.imp, false), dir: 1 },
    { k: "クリック", a: num(d7.clk), b: num(lm.clk), d: chg(d7.clk, lm.clk, false), dir: 1 },
    { k: "CTR", a: d7.ctr + "%", b: lm.ctr + "%", d: chg(d7.ctr, lm.ctr, true), dir: 1 },
    { k: "CPC", a: yen(d7.cpc), b: yen(lm.cpc), d: chg(d7.cpc, lm.cpc, true), dir: -1 },
    { k: "CV", a: d7.cv + "件", b: lm.cv + "件", d: chg(d7.cv, lm.cv, false), dir: 1 },
    { k: "CPA", a: d7.cpa ? yen(d7.cpa) : "—", b: lm.cpa ? yen(lm.cpa) : "—", d: chg(d7.cpa, lm.cpa, true), dir: -1 },
  ];
  const cell = { padding: "6px 8px", fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const head = { ...cell, color: "#94a3b8", fontWeight: 600, fontSize: 11, borderBottom: "1px solid #eef1f4" };
  return (
    <div>
      {/* 予算消化（直近7日） */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 5 }}>
          <span style={{ color: "#64748b" }}>予算消化（直近7日）</span>
          {c.dailyBudget ? (
            <span style={{ color: paceC, fontWeight: 700 }}>
              {yen(d7.spend)} / 想定 {yen(cap7)}（{Math.round(pace)}%）
            </span>
          ) : <span style={{ color: "#94a3b8" }}>予算情報なし</span>}
        </div>
        {c.dailyBudget && (
          <div style={{ height: 7, background: "#eef1f4", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: Math.min(pace, 100) + "%", height: "100%", background: paceC }} />
          </div>
        )}
      </div>
      {/* 月末着地予測（当月の消化ペースから月末を予測） */}
      {days && days.length >= 3 && <MonthEndProjection days={days} dailyBudget={c.dailyBudget} target={c.target || (c.bench && c.bench.targetCpa)} bench={c.bench} />}
      {/* 基準チェック（運用サポート） */}
      {c.bench && <BenchmarkChecks c={c} />}
      {/* 指標テーブル（直近7日 / 先月 / 先月比）— 日次データが無いアカウント(Meta)のみ表示 */}
      {(!days || days.length < 7) && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 300 }}>
              <thead><tr>
                <th style={{ ...head, textAlign: "left" }}>指標</th>
                <th style={head}>直近7日</th>
                <th style={head}>先月</th>
                <th style={head}>先月比</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.k} style={{ borderBottom: "1px solid #f6f8f7" }}>
                    <td style={{ ...cell, textAlign: "left", color: "#0f2a1f", fontWeight: 600 }}>{r.k}</td>
                    <td style={{ ...cell, color: "#0f2a1f", fontWeight: 700 }}>{r.a}</td>
                    <td style={{ ...cell, color: "#64748b" }}>{r.b}</td>
                    <td style={cell}><DeltaTag v={r.d} dir={r.dir} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 6 }}>※日次データが無いため<b>先月</b>と比較（<b>1日あたり</b>換算：費用/表示/クリック/CVは 直近7日÷7 vs 先月÷{lmDays}日、CTR/CPC/CPAは率のため直接）。緑＝改善／赤＝悪化。</div>
        </>
      )}
      {/* ② 週次：直近7日 vs 前7日（同じ長さ）＋手法別＋14/28日＋日次推移グラフ（Googleのみ日次あり） */}
      {days && days.length >= 7 && <TrendReport days={days} byType={byType} bench={c.bench} />}
    </div>
  );
}

// 日次配列から直近n日（offset日前まで遡る）を集計
function sumDays(days, n, offset) {
  offset = offset || 0;
  const end = days.length - offset;
  const slice = days.slice(Math.max(0, end - n), end);
  const t = slice.reduce((a, d) => ({ imp: a.imp + (d.imp || 0), clk: a.clk + (d.clk || 0), cost: a.cost + (d.cost || 0), cv: a.cv + (d.cv || 0) }), { imp: 0, clk: 0, cost: 0, cv: 0 });
  t.cpa = t.cv ? Math.round(t.cost / t.cv) : null;
  t.cpc = t.clk ? Math.round(t.cost / t.clk) : null;
  t.ctr = t.imp ? +((t.clk / t.imp) * 100).toFixed(2) : null;
  return t;
}

// 日次配列の合計（CPA付き）
function aggList(list) {
  const t = (list || []).reduce((a, d) => ({ imp: a.imp + (d.imp || 0), clk: a.clk + (d.clk || 0), cost: a.cost + (d.cost || 0), cv: a.cv + (d.cv || 0) }), { imp: 0, clk: 0, cost: 0, cv: 0 });
  t.cpa = t.cv ? Math.round(t.cost / t.cv) : null;
  t.cpc = t.clk ? Math.round(t.cost / t.clk) : null;
  return t;
}

// 目標CPAに対する色（緑=目標内／橙=+20%超／赤=+50%超）
function cpaColor(cpa, target, bench) {
  if (!target || cpa == null) return "#475569";
  const over = cpa / target - 1;
  const sev = bench && bench.cpaSeverePct != null ? bench.cpaSeverePct : 0.5;
  const warn = bench && bench.cpaWarnPct != null ? bench.cpaWarnPct : 0.2;
  return over >= sev ? "#dc2626" : over >= warn ? "#d97706" : "#047857";
}

// 週次分解（当月の第1週〜）。社別詳細・月次の両方で使う。
function WeeklyBreakdown({ days, target, bench }) {
  const months = [...new Set(days.map((d) => d.date.slice(0, 7)))].sort();
  const curM = months[months.length - 1];
  const curDays = days.filter((d) => d.date.slice(0, 7) === curM);
  const weeks = {};
  curDays.forEach((d) => { const w = Math.ceil(parseInt(d.date.slice(8, 10), 10) / 7); (weeks[w] = weeks[w] || []).push(d); });
  const rows = Object.keys(weeks).map((w) => { const ds = weeks[w]; return { w: +w, from: ds[0].date.slice(5), to: ds[ds.length - 1].date.slice(5), ...aggList(ds) }; }).sort((a, b) => a.w - b.w);
  if (!rows.length) return null;
  const maxW = Math.max(1, ...rows.map((r) => r.cost));
  const cell = { padding: "6px 8px", fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const head = { ...cell, color: "#94a3b8", fontWeight: 600, fontSize: 11, borderBottom: "1px solid #eef1f4" };
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f2a1f", marginBottom: 6 }}>週次分解（当月 {+curM.slice(5, 7)}月）</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 300 }}>
          <thead><tr>
            <th style={{ ...head, textAlign: "left" }}>週</th><th style={{ ...head, textAlign: "left" }}>期間</th>
            <th style={head}>費用</th><th style={head}>CV</th><th style={head}>CPA</th><th style={{ ...head, textAlign: "left", width: "24%" }}>推移</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.w} style={{ borderBottom: "1px solid #f6f8f7" }}>
                <td style={{ ...cell, textAlign: "left", fontWeight: 700, color: "#0f2a1f" }}>第{r.w}週</td>
                <td style={{ ...cell, textAlign: "left", color: "#94a3b8" }}>{r.from}〜{r.to}</td>
                <td style={{ ...cell, color: "#0f2a1f", fontWeight: 600 }}>{yen(r.cost)}</td>
                <td style={{ ...cell, color: "#475569" }}>{Math.round(r.cv)}件</td>
                <td style={{ ...cell, color: cpaColor(r.cpa, target, bench), fontWeight: 600 }}>{r.cpa ? yen(r.cpa) : "—"}</td>
                <td style={{ padding: "6px 8px" }}><div style={{ height: 8, background: "#eef1f4", borderRadius: 999, overflow: "hidden" }}><div style={{ width: (r.cost / maxW) * 100 + "%", height: "100%", background: "#9ec7b4" }} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ③ 月次：当月を週別（第1週〜）に分解＋前月比＋目標CPA照合＋手法別。月初レポート・振り返り用。
function MonthlyReport({ c, days, byType }) {
  const months = [...new Set(days.map((d) => d.date.slice(0, 7)))].sort();
  const curM = months[months.length - 1];
  const prevM = months.length > 1 ? months[months.length - 2] : null;
  const curDays = days.filter((d) => d.date.slice(0, 7) === curM);
  const prevDays = prevM ? days.filter((d) => d.date.slice(0, 7) === prevM) : [];
  const cur = aggList(curDays), prev = aggList(prevDays);
  const target = c.target || (c.bench && c.bench.targetCpa) || null;
  const mLabel = (m) => (m ? +m.slice(5, 7) + "月" : "—");
  const weeks = {};
  curDays.forEach((d) => { const w = Math.ceil(parseInt(d.date.slice(8, 10), 10) / 7); (weeks[w] = weeks[w] || []).push(d); });
  const weekRows = Object.keys(weeks).map((w) => {
    const ds = weeks[w]; const a = aggList(ds);
    return { w: +w, from: ds[0].date.slice(5), to: ds[ds.length - 1].date.slice(5), ...a };
  }).sort((a, b) => a.w - b.w);
  const maxW = Math.max(1, ...weekRows.map((r) => r.cost));
  const cpaJudge = (cpa) => {
    if (!target || cpa == null) return "#475569";
    const over = cpa / target - 1;
    return over >= (c.bench && c.bench.cpaSeverePct != null ? c.bench.cpaSeverePct : 0.5) ? "#dc2626" : over >= (c.bench && c.bench.cpaWarnPct != null ? c.bench.cpaWarnPct : 0.2) ? "#d97706" : "#047857";
  };
  const pct = (a, b) => (a == null || b == null || b === 0 ? null : Math.round((a / b - 1) * 100));
  const cell = { padding: "6px 10px", fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const head = { ...cell, color: "#94a3b8", fontWeight: 600, fontSize: 11 };
  return (
    <div style={{ background: "#fff", border: "1px solid #e6ebe8", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{c.client}{c.tier === "large" && <LargePill />}</span>
        <MediaPill m={c.media} />
        <span style={{ fontSize: 11.5, color: "#94a3b8", fontFamily: "monospace" }}>{c.acct}</span>
      </div>
      {/* 当月サマリー vs 前月 vs 目標 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginBottom: 14 }}>
        {[
          { label: `当月(${mLabel(curM)})費用`, v: yen(cur.cost), sub: prevM ? `前月 ${yen(prev.cost)}` : "", d: pct(cur.cost, prev.cost), dir: 0 },
          { label: "当月CV", v: Math.round(cur.cv) + "件", sub: prevM ? `前月 ${Math.round(prev.cv)}件` : "", d: pct(cur.cv, prev.cv), dir: 1 },
          { label: "当月CPA", v: cur.cpa ? yen(cur.cpa) : "—", sub: prevM ? `前月 ${prev.cpa ? yen(prev.cpa) : "—"}` : "", d: pct(cur.cpa, prev.cpa), dir: -1, color: cpaJudge(cur.cpa) },
          { label: "目標CPA", v: target ? yen(target) : "未設定", sub: target && cur.cpa ? `対目標 ${cur.cpa > target ? "+" : ""}${Math.round((cur.cpa / target - 1) * 100)}%` : "" },
        ].map((k) => (
          <div key={k.label}>
            <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{k.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: k.color || "#0f2a1f" }}>{k.v}</div>
            <div style={{ fontSize: 10.5, color: "#94a3b8", display: "flex", gap: 5, alignItems: "center" }}>{k.sub}{k.d != null && <DeltaTag v={k.d} dir={k.dir} />}</div>
          </div>
        ))}
      </div>
      {/* 当月の手法別（検索/PMax等） */}
      {byType && Object.keys(byType).length > 0 && (() => {
        const mrows = Object.keys(byType).map((label) => {
          const a = aggList((byType[label] || []).filter((d) => d.date.slice(0, 7) === curM));
          return { label, ...a };
        }).filter((r) => r.cost > 0).sort((a, b) => b.cost - a.cost);
        if (!mrows.length) return null;
        return (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f2a1f", marginBottom: 6 }}>当月の手法別</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 340 }}>
                <thead><tr>
                  <th style={{ ...head, textAlign: "left" }}>手法</th><th style={head}>費用</th><th style={head}>構成比</th><th style={head}>CV</th><th style={head}>CPA</th>
                </tr></thead>
                <tbody>
                  {mrows.map((r) => (
                    <tr key={r.label} style={{ borderBottom: "1px solid #f6f8f7" }}>
                      <td style={{ ...cell, textAlign: "left", color: "#0f2a1f", fontWeight: 700 }}>{r.label}</td>
                      <td style={{ ...cell, color: "#0f2a1f", fontWeight: 600 }}>{yen(r.cost)}</td>
                      <td style={{ ...cell, color: "#94a3b8" }}>{cur.cost ? Math.round((r.cost / cur.cost) * 100) : 0}%</td>
                      <td style={{ ...cell, color: "#475569" }}>{Math.round(r.cv)}件</td>
                      <td style={{ ...cell, color: cpaJudge(r.cpa), fontWeight: 600 }}>{r.cpa ? yen(r.cpa) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* 週次分解 */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f2a1f", marginBottom: 6 }}>週次分解（合計）</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
          <thead><tr>
            <th style={{ ...head, textAlign: "left" }}>週</th><th style={{ ...head, textAlign: "left" }}>期間</th>
            <th style={head}>費用</th><th style={head}>CV</th><th style={head}>CPA</th>
            <th style={{ ...head, textAlign: "left", width: "26%" }}>費用の推移</th>
          </tr></thead>
          <tbody>
            {weekRows.map((r) => (
              <tr key={r.w} style={{ borderBottom: "1px solid #f6f8f7" }}>
                <td style={{ ...cell, textAlign: "left", fontWeight: 700, color: "#0f2a1f" }}>第{r.w}週</td>
                <td style={{ ...cell, textAlign: "left", color: "#94a3b8" }}>{r.from}〜{r.to}</td>
                <td style={{ ...cell, color: "#0f2a1f", fontWeight: 600 }}>{yen(r.cost)}</td>
                <td style={{ ...cell, color: "#475569" }}>{Math.round(r.cv)}件</td>
                <td style={{ ...cell, color: cpaJudge(r.cpa), fontWeight: 600 }}>{r.cpa ? yen(r.cpa) : "—"}</td>
                <td style={{ padding: "6px 10px" }}>
                  <div style={{ height: 8, background: "#eef1f4", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: (r.cost / maxW) * 100 + "%", height: "100%", background: "#9ec7b4" }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {target && <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 6 }}>※CPAの色：緑=目標内／橙=+20%超／赤=+50%超（目標 {yen(target)}）。</div>}
    </div>
  );
}

// 指定した日付集合に含まれる日次レコードを合計
function sumSet(arr, dateSet) {
  const t = (arr || []).reduce((a, d) => dateSet.has(d.date) ? { imp: a.imp + (d.imp || 0), clk: a.clk + (d.clk || 0), cost: a.cost + (d.cost || 0), cv: a.cv + (d.cv || 0) } : a, { imp: 0, clk: 0, cost: 0, cv: 0 });
  t.cpa = t.cv ? Math.round(t.cost / t.cv) : null;
  t.cpc = t.clk ? Math.round(t.cost / t.clk) : null;
  return t;
}

// 手法別（検索/PMax/デマンドジェン等）の直近7日サマリー＋前7日比。Googleの合計は手法ミックスで歪むため必須。
function MethodBreakdown({ days, byType }) {
  const labels = Object.keys(byType || {});
  if (!labels.length) return null;
  const dset7 = new Set(days.slice(-7).map((d) => d.date));
  const dsetp7 = new Set(days.slice(-14, -7).map((d) => d.date));
  const pct = (a, b) => (a == null || b == null || b === 0 ? null : Math.round((a / b - 1) * 100));
  let rows = labels.map((label) => {
    const c7 = sumSet(byType[label], dset7), cp = sumSet(byType[label], dsetp7);
    return { label, cost: c7.cost, cv: c7.cv, cpa: c7.cpa, cpc: c7.cpc, costD: pct(c7.cost, cp.cost), cpaD: pct(c7.cpa, cp.cpa) };
  }).sort((a, b) => b.cost - a.cost);
  const tot = sumSet(days, dset7), totp = sumSet(days, dsetp7);
  rows.push({ label: "合計", cost: tot.cost, cv: tot.cv, cpa: tot.cpa, cpc: tot.cpc, costD: pct(tot.cost, totp.cost), cpaD: pct(tot.cpa, totp.cpa), total: true });
  const cell = { padding: "6px 8px", fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const head = { ...cell, color: "#94a3b8", fontWeight: 600, fontSize: 11, borderBottom: "1px solid #eef1f4" };
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f2a1f", marginBottom: 6 }}>手法別（直近7日／前7日比）</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 380 }}>
          <thead><tr>
            <th style={{ ...head, textAlign: "left" }}>手法</th>
            <th style={head}>費用</th><th style={head}>費用比</th><th style={head}>CV</th><th style={head}>CPA</th><th style={head}>CPA比</th><th style={head}>CPC</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} style={{ borderBottom: "1px solid #f6f8f7", background: r.total ? "#f8faf9" : "transparent" }}>
                <td style={{ ...cell, textAlign: "left", color: "#0f2a1f", fontWeight: 700 }}>{r.label}</td>
                <td style={{ ...cell, color: "#0f2a1f", fontWeight: r.total ? 700 : 600 }}>{yen(r.cost)}</td>
                <td style={cell}><DeltaTag v={r.costD} dir={0} /></td>
                <td style={{ ...cell, color: "#475569" }}>{Math.round(r.cv)}件</td>
                <td style={{ ...cell, color: "#0f2a1f" }}>{r.cpa ? yen(r.cpa) : "—"}</td>
                <td style={cell}><DeltaTag v={r.cpaD} dir={-1} /></td>
                <td style={{ ...cell, color: "#475569" }}>{yen(r.cpc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ② 期間比較（7/14/28日）＋手法別＋日次推移グラフ。運用者が「本物の悪化か」を判断し急変を目視できる。
function TrendReport({ days, byType, bench }) {
  const d7 = sumDays(days, 7, 0), p7 = sumDays(days, 7, 7);
  const d14 = sumDays(days, 14, 0), p14 = sumDays(days, 14, 14);
  const d28 = sumDays(days, 28, 0), p28 = sumDays(days, 28, 28);
  const enough14 = days.length >= 28, enough28 = days.length >= 56;
  const pct = (a, b) => (a == null || b == null || b === 0 ? null : Math.round((a / b - 1) * 100));
  const cvfmt = (v) => Math.round(v) + "件";
  const ctrfmt = (v) => (v == null ? "—" : v + "%");
  const cpafmt = (v) => (v ? yen(v) : "—");
  // 指標定義：値の取り出し(get)・表示(fmt)・良し悪し方向(dir)
  const metrics = [
    { k: "費用", get: (o) => o.cost, fmt: yen, dir: 0 },
    { k: "表示回数", get: (o) => o.imp, fmt: num, dir: 1 },
    { k: "クリック", get: (o) => o.clk, fmt: num, dir: 1 },
    { k: "CTR", get: (o) => o.ctr, fmt: ctrfmt, dir: 1 },
    { k: "CPC", get: (o) => o.cpc, fmt: yen, dir: -1 },
    { k: "CV", get: (o) => o.cv, fmt: cvfmt, dir: 1 },
    { k: "CPA", get: (o) => o.cpa, fmt: cpafmt, dir: -1 },
  ];
  const cell = { padding: "6px 8px", fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const head = { ...cell, color: "#94a3b8", fontWeight: 600, fontSize: 11, borderBottom: "1px solid #eef1f4" };
  return (
    <div style={{ marginTop: 14, borderTop: "1px solid #eef1f4", paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#0f2a1f", marginBottom: 2 }}>
        <TrendingUp size={14} color="#047857" /> 期間比較・推移（日次データより）
      </div>
      <div style={{ fontSize: 10.5, color: "#94a3b8", marginBottom: 8 }}>各期間は<b>同じ長さの直前期間</b>と比較（7日比=前7日／14日比=前14日／28日比=前28日）。緑＝改善／赤＝悪化。データ不足の期間は「—」。</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f2a1f", marginBottom: 6 }}>全体（期間比較）</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 460 }}>
              <thead><tr>
                <th style={{ ...head, textAlign: "left" }}>指標</th>
                <th style={head}>直近7日</th><th style={head}>前7日</th><th style={head}>7日比</th>
                <th style={head}>直近14日</th><th style={head}>14日比</th>
                <th style={head}>直近28日</th><th style={head}>28日比</th>
              </tr></thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.k} style={{ borderBottom: "1px solid #f6f8f7" }}>
                    <td style={{ ...cell, textAlign: "left", color: "#0f2a1f", fontWeight: 600 }}>{m.k}</td>
                    <td style={{ ...cell, color: "#0f2a1f", fontWeight: 700 }}>{m.fmt(m.get(d7))}</td>
                    <td style={{ ...cell, color: "#64748b" }}>{m.fmt(m.get(p7))}</td>
                    <td style={cell}><DeltaTag v={pct(m.get(d7), m.get(p7))} dir={m.dir} /></td>
                    <td style={{ ...cell, color: "#64748b" }}>{m.fmt(m.get(d14))}</td>
                    <td style={cell}>{enough14 ? <DeltaTag v={pct(m.get(d14), m.get(p14))} dir={m.dir} /> : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                    <td style={{ ...cell, color: "#64748b" }}>{m.fmt(m.get(d28))}</td>
                    <td style={cell}>{enough28 ? <DeltaTag v={pct(m.get(d28), m.get(p28))} dir={m.dir} /> : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <MethodBreakdown days={days} byType={byType} />
        <WeeklyBreakdown days={days} target={bench && bench.targetCpa} bench={bench} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f2a1f", marginBottom: 6 }}>日次推移（直近30日）</div>
          <DailyChart days={days.slice(-30)} target={bench && bench.targetCpa} />
        </div>
      </div>
    </div>
  );
}

// 日次推移グラフ（直近30日）：費用=棒、CV=折れ線。縦軸に数値目盛り。急変を目視。
function DailyChart({ days, target }) {
  if (!days || !days.length) return null;
  const W = 560, H = 150, padL = 44, padR = 40, padT = 12, padB = 22;
  const iw = W - padL - padR, ih = H - padT - padB;
  const maxCost = Math.max(1, ...days.map((d) => d.cost || 0));
  const maxCv = Math.max(1, ...days.map((d) => d.cv || 0));
  const bw = iw / days.length;
  const x = (i) => padL + i * bw;
  const yCost = (v) => padT + ih - (v / maxCost) * ih;
  const yCv = (v) => padT + ih - (v / maxCv) * ih;
  const niceMax = (m) => { const p = Math.pow(10, Math.floor(Math.log10(m))); return Math.ceil(m / p) * p; };
  const cMax = niceMax(maxCost), vMax = niceMax(maxCv);
  const cvPts = days.map((d, i) => `${x(i) + bw / 2},${yCv(d.cv || 0)}`).join(" ");
  const fmtY = (n) => (n >= 10000 ? (n / 10000) + "万" : n >= 1000 ? (n / 1000) + "k" : "" + n);
  const lab = (d) => d.date.slice(5); // MM-DD
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#64748b", marginBottom: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, background: "#9ec7b4", borderRadius: 2, display: "inline-block" }} />費用</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 3, background: "#0f7a52", borderRadius: 2, display: "inline-block" }} />CV</span>
        <span style={{ color: "#94a3b8" }}>直近{days.length}日</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 420, height: "auto" }}>
        {/* y軸グリッド（費用・左） */}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} y1={padT + ih - f * ih} x2={W - padR} y2={padT + ih - f * ih} stroke="#eef1f4" />
            <text x={padL - 5} y={padT + ih - f * ih + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{fmtY(Math.round(cMax * f))}</text>
            <text x={W - padR + 4} y={padT + ih - f * ih + 3} textAnchor="start" fontSize="9" fill="#0f7a52">{Math.round(vMax * f)}</text>
          </g>
        ))}
        {/* 費用の棒 */}
        {days.map((d, i) => (
          <rect key={i} x={x(i) + 1} y={yCost(d.cost || 0)} width={Math.max(1, bw - 2)} height={padT + ih - yCost(d.cost || 0)} fill="#9ec7b4" rx="1" />
        ))}
        {/* CVの折れ線 */}
        <polyline points={cvPts} fill="none" stroke="#0f7a52" strokeWidth="1.6" />
        {days.map((d, i) => <circle key={i} cx={x(i) + bw / 2} cy={yCv(d.cv || 0)} r="1.6" fill="#0f7a52" />)}
        {/* x軸ラベル（両端＋中央） */}
        {[0, Math.floor(days.length / 2), days.length - 1].map((i) => (
          <text key={i} x={x(i) + bw / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{lab(days[i])}</text>
        ))}
      </svg>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>左軸=費用（{fmtY(cMax)}）／右軸=CV（{vMax}）。棒の急な立ち上がり/途切れ・CV折れ線の急降下は要確認。</div>
    </div>
  );
}
