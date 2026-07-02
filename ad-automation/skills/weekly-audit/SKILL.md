---
name: weekly-audit
description: Meta/Google広告の週次監査。読み取り数値をCLAUDE.md §2のしきい値と照合し、提案(下書き)を生成する。書き込みは一切しない。
---

# 週次監査スキル

## 目的
直近7日の運用数値を全社ルール（`CLAUDE.md`）＋個社ルール（`clients/<社名>.md`）に照合し、
要対応と「提案の下書き」を出す。**媒体への書き込みは行わない**（承認後に別途適用）。

## 手順
1. `CLAUDE.md` を読む → 次に対象の `clients/<社名>.md` を読む（個社値を優先）。
2. 数値を取得（読み取りのみ）：
   - Meta: 公式Adsコネクタ(MCP/CLI)で直近7日の adset/campaign 実績。
   - Google: 公式MCP（読み取り）。※接続前は取得済みCSVを使う。
3. しきい値照合＋下書き生成：
   ```bash
   python3 scripts/generate_proposals.py \
     --input <取得CSV> --client <社名> \
     --config clients/<社名>_thresholds.json \
     --out out/proposals_<日付>.md
   ```
4. `CLAUDE.md §6` のレポート様式で出力。要対応は重要度順・承認レベル付き。
5. 承認キュー（管理画面/通知）へ。**適用しない。**

## 禁止事項
- 予算変更・入札変更・ON/OFF・新規作成の**実行**（下書きのみ）。
- 目標値が無いのに良否を断定すること（「要確認」と明記）。
- 医療・薬機表現の可否をAIが確定すること（§3.2 に従いエスカレーション）。
