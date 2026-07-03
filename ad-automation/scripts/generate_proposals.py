#!/usr/bin/env python3
"""提案(下書き)生成スクリプト — CLAUDE.md §2 のしきい値照合を実装。

方針（最重要）:
  - このスクリプトは広告媒体に**一切書き込まない**。読み取り済みの数値を
    しきい値と突き合わせ、「提案の下書き（Markdown）」を生成するだけ。
  - 新規/停止/予算変更はすべて人間承認が前提（CLAUDE.md §0, §4）。
  - しきい値は全社既定値。個社の目標が入ったら --config で上書きする。

使い方:
  python3 scripts/generate_proposals.py \
      --input data/samples/metrics_sample.csv \
      --client ハルナ美容外科 \
      [--config clients/haruna_thresholds.json] \
      [--out out/proposals_YYYY-MM-DD.md]

入力CSVの想定カラム:
  level, campaign, entity, status, spend_7d, conversions_7d, revenue_7d,
  impressions_7d, clicks_7d, daily_budget, days_active

Python 3.12+ / 追加依存なし（標準ライブラリのみ）。
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass
from pathlib import Path

# ── 全社既定値（CLAUDE.md §2 と一致させること）─────────────────────
DEFAULT_THRESHOLDS: dict = {
    "target_cpa": None,          # 目標CPA(円)。未設定なら CPA 判定は「要確認」扱い
    "target_roas": None,         # 目標ROAS(倍)。未設定なら ROAS 判定はスキップ
    "cpa_warn_pct": 0.20,        # 目標CPA +20% で悪化
    "cpa_severe_pct": 0.50,      # 目標CPA +50% で重度悪化(停止候補)
    "roas_warn_pct": 0.20,       # 目標ROAS -20% で悪化
    "wasted_spend_budget_mult": 3.0,   # CV=0 かつ 消化 > 日予算×3 で無駄消化
    "frequency_cap": 3.5,        # (参考)Metaフリークエンシー上限
    "budget_change_cap_pct": 0.30,     # 1回の増額提案は +30%/回 まで
    "learning_min_days": 7,      # 学習期間: 配信7日未満は判定対象外
    "learning_min_conv": 10,     # 学習期間: CV10件未満は判定対象外(CPA判定のみ緩和)
    "budget_approval_pct": 0.20, # ±20%超は上長承認
}

APPROVAL_STAFF = "担当者承認"
APPROVAL_MANAGER = "上長承認"


@dataclass
class Row:
    level: str
    campaign: str
    entity: str
    status: str
    spend_7d: float
    conversions_7d: float
    revenue_7d: float
    impressions_7d: float
    clicks_7d: float
    daily_budget: float
    days_active: int

    @property
    def cpa(self) -> float | None:
        return self.spend_7d / self.conversions_7d if self.conversions_7d else None

    @property
    def roas(self) -> float | None:
        return self.revenue_7d / self.spend_7d if self.spend_7d else None

    @property
    def ctr(self) -> float | None:
        return self.clicks_7d / self.impressions_7d if self.impressions_7d else None


@dataclass
class Finding:
    entity: str
    campaign: str
    severity: str           # "重度悪化" | "悪化" | "注意"
    fact: str               # 事実(期間・母数つき)
    cause: str              # 推定原因
    action: str             # 提案アクション(下書き・未適用)
    approval: str           # 承認レベル
    note: str = ""


def _num(v: str) -> float:
    v = (v or "").strip()
    return float(v) if v else 0.0


def load_rows(path: Path) -> list[Row]:
    rows: list[Row] = []
    with path.open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            rows.append(Row(
                level=r.get("level", "").strip(),
                campaign=r.get("campaign", "").strip(),
                entity=r.get("entity", "").strip(),
                status=r.get("status", "").strip(),
                spend_7d=_num(r.get("spend_7d", "")),
                conversions_7d=_num(r.get("conversions_7d", "")),
                revenue_7d=_num(r.get("revenue_7d", "")),
                impressions_7d=_num(r.get("impressions_7d", "")),
                clicks_7d=_num(r.get("clicks_7d", "")),
                daily_budget=_num(r.get("daily_budget", "")),
                days_active=int(_num(r.get("days_active", ""))),
            ))
    return rows


def load_thresholds(config_path: Path | None) -> dict:
    t = dict(DEFAULT_THRESHOLDS)
    if config_path:
        t.update(json.loads(config_path.read_text(encoding="utf-8")))
    return t


def yen(v: float | None) -> str:
    return f"¥{v:,.0f}" if v is not None else "—"


def evaluate(rows: list[Row], t: dict) -> tuple[list[Finding], list[str]]:
    findings: list[Finding] = []
    skipped: list[str] = []
    target_cpa = t["target_cpa"]
    target_roas = t["target_roas"]
    cpa_note = "" if target_cpa else "（目標CPA未設定＝全社既定値・要確認）"

    for r in rows:
        # 配信中でないエンティティは判定対象外(停止済みに「停止提案」等の無意味な指摘を避ける)
        if r.status.upper() not in ("ACTIVE", "ENABLED"):
            skipped.append(f"{r.entity}（状態 {r.status}・配信中でないため除外）")
            continue

        # 学習期間中は判定対象外(早すぎる判断を避ける — CLAUDE.md §2.1)
        if r.days_active < t["learning_min_days"]:
            skipped.append(f"{r.entity}（配信{r.days_active}日・学習期間中のため除外）")
            continue

        # 無駄消化: CV=0 かつ 消化 > 日予算×N（日予算が取得できている場合のみ・0除算的な誤発火を防ぐ）
        if r.daily_budget > 0 and r.conversions_7d == 0 and r.spend_7d > r.daily_budget * t["wasted_spend_budget_mult"]:
            findings.append(Finding(
                entity=r.entity, campaign=r.campaign, severity="重度悪化",
                fact=f"直近7日 CV=0 で消化 {yen(r.spend_7d)}（日予算 {yen(r.daily_budget)}×{t['wasted_spend_budget_mult']:.0f} 超）",
                cause="配信面・オーディエンス・LP整合の不一致、またはCV計測不備の可能性",
                action=f"【停止候補・要承認】{r.entity} を PAUSED 提案。併せてCV計測の確認。",
                approval=APPROVAL_MANAGER,
                note="全停止方向のため上長承認。",
            ))
            continue

        # CPA 判定(目標がある場合のみ定量。CV数が学習下限未満なら注意止まり)
        if r.cpa is not None:
            if target_cpa:
                over = r.cpa / target_cpa - 1.0
                if over >= t["cpa_severe_pct"]:
                    findings.append(Finding(
                        entity=r.entity, campaign=r.campaign, severity="重度悪化",
                        fact=f"直近7日CPA {yen(r.cpa)}（目標 {yen(target_cpa)}、+{over*100:.0f}%）",
                        cause="入札・オーディエンス過当競争・クリエイティブ疲弊の可能性",
                        action=f"【停止候補 or 大幅減額・要承認】{r.entity}。減額提案は上限 -{t['budget_change_cap_pct']*100:.0f}%/回目安。",
                        approval=APPROVAL_MANAGER,
                    ))
                elif over >= t["cpa_warn_pct"]:
                    findings.append(Finding(
                        entity=r.entity, campaign=r.campaign, severity="悪化",
                        fact=f"直近7日CPA {yen(r.cpa)}（目標 {yen(target_cpa)}、+{over*100:.0f}%）",
                        cause="入札過多 or 配信効率低下の可能性",
                        action=f"【予算減 or 入札調整・要承認】日予算 -{min(over, t['budget_change_cap_pct'])*100:.0f}% を提案。",
                        approval=APPROVAL_STAFF if over <= t["budget_approval_pct"] else APPROVAL_MANAGER,
                    ))
            elif r.conversions_7d >= t["learning_min_conv"]:
                findings.append(Finding(
                    entity=r.entity, campaign=r.campaign, severity="注意",
                    fact=f"直近7日CPA {yen(r.cpa)}（CV {r.conversions_7d:.0f}件）{cpa_note}",
                    cause="目標CPA未設定のため良否判定不可",
                    action="個社MDに目標CPAを設定のうえ再評価を提案。",
                    approval=APPROVAL_STAFF,
                    note="要確認: 目標未設定。",
                ))

        # ROAS 判定(目標がある場合のみ)
        if target_roas and r.roas is not None:
            under = 1.0 - (r.roas / target_roas)
            if under >= t["roas_warn_pct"]:
                findings.append(Finding(
                    entity=r.entity, campaign=r.campaign, severity="悪化",
                    fact=f"直近7日ROAS {r.roas:.2f}（目標 {target_roas:.2f}、-{under*100:.0f}%）",
                    cause="配信面/クリエイティブ/購入導線の効率低下の可能性",
                    action="配信面・クリエイティブ見直しを提案（数値は下書き・未適用）。",
                    approval=APPROVAL_STAFF,
                ))

    # 重要度順(重度悪化 → 悪化 → 注意)
    order = {"重度悪化": 0, "悪化": 1, "注意": 2}
    findings.sort(key=lambda f: order.get(f.severity, 9))
    return findings, skipped


def render(client: str, rows: list[Row], findings: list[Finding],
           skipped: list[str], t: dict, input_name: str) -> str:
    total_spend = sum(r.spend_7d for r in rows)
    total_conv = sum(r.conversions_7d for r in rows)
    total_rev = sum(r.revenue_7d for r in rows)
    overall_cpa = total_spend / total_conv if total_conv else None
    overall_roas = total_rev / total_spend if total_spend else None
    severe = sum(1 for f in findings if f.severity == "重度悪化")

    L: list[str] = []
    L.append(f"# 提案（下書き）レポート：{client}")
    L.append("")
    L.append("> ⚠️ すべて**未適用の下書き**です。適用は人間の承認後のみ（CLAUDE.md §0/§4）。")
    L.append("")
    # 1. サマリー
    L.append("## 1. サマリー")
    L.append(f"- 対象 {len(rows)} 件 / 要対応 **{len(findings)}** 件（うち重度 {severe} 件）/ 判定除外 {len(skipped)} 件。")
    L.append(f"- 直近7日：費用 {yen(total_spend)}・CV {total_conv:.0f}・全体CPA {yen(overall_cpa)}・全体ROAS {overall_roas:.2f}" if overall_roas else
             f"- 直近7日：費用 {yen(total_spend)}・CV {total_conv:.0f}・全体CPA {yen(overall_cpa)}。")
    if not t["target_cpa"]:
        L.append("- ⚠️ 目標CPA未設定のため CPA良否は全社既定値ベース＝**要確認**。個社MDへ数値設定を推奨。")
    L.append("")
    # 2. KPIハイライト
    L.append("## 2. KPIハイライト")
    L.append("| エンティティ | 状態 | 費用(7d) | CV | CPA | ROAS |")
    L.append("|---|---|--:|--:|--:|--:|")
    for r in rows:
        roas = f"{r.roas:.2f}" if r.roas is not None else "—"
        L.append(f"| {r.entity} | {r.status} | {yen(r.spend_7d)} | {r.conversions_7d:.0f} | {yen(r.cpa)} | {roas} |")
    L.append("")
    # 3+4. 要対応 & 提案下書き
    L.append("## 3. 要対応 → 提案（下書き・未適用）")
    if not findings:
        L.append("- しきい値抵触なし。")
    for i, f in enumerate(findings, 1):
        L.append(f"### {i}. [{f.severity}] {f.entity} — {f.campaign}")
        L.append(f"- **事実**：{f.fact}")
        L.append(f"- **推定原因**：{f.cause}")
        L.append(f"- **提案アクション（下書き）**：{f.action}")
        L.append(f"- **承認レベル**：{f.approval}")
        if f.note:
            L.append(f"- 注記：{f.note}")
        L.append("")
    # 5. 注記
    L.append("## 5. 注記")
    L.append(f"- データ：`{input_name}`（直近7日想定）。")
    L.append(f"- 使用しきい値：CPA悪化 +{t['cpa_warn_pct']*100:.0f}% / 重度 +{t['cpa_severe_pct']*100:.0f}%、"
             f"無駄消化 日予算×{t['wasted_spend_budget_mult']:.0f}、学習除外 <{t['learning_min_days']}日。")
    if skipped:
        L.append(f"- 判定から除外：{', '.join(skipped)}")
    if not t["target_cpa"]:
        L.append("- 目標CPA/ROAS が未設定の箇所は全社既定値を使用（要確認）。")
    L.append("")
    return "\n".join(L)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="提案(下書き)生成 — 媒体への書き込みは一切しない")
    p.add_argument("--input", required=True, help="取得済み数値のCSV")
    p.add_argument("--client", required=True, help="クライアント名(表示用)")
    p.add_argument("--config", help="個社しきい値のJSON(任意・全社既定を上書き)")
    p.add_argument("--out", help="出力先MD(省略時は標準出力)")
    a = p.parse_args(argv)

    input_path = Path(a.input)
    if not input_path.exists():
        print(f"入力が見つかりません: {input_path}", file=sys.stderr)
        return 1

    rows = load_rows(input_path)
    t = load_thresholds(Path(a.config) if a.config else None)
    findings, skipped = evaluate(rows, t)
    report = render(a.client, rows, findings, skipped, t, input_path.name)

    if a.out:
        out = Path(a.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(report, encoding="utf-8")
        print(f"下書きを書き出しました: {out}（未適用・要承認）")
    else:
        print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
