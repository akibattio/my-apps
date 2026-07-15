#!/usr/bin/env python3
"""実データ（監査所見・検索診断・アラート）から提案の下書きを生成し console/data.json の proposals に反映。

CLAUDE.md §0/§4：AIは「下書き」までを作る。書き込み(適用)は人間の承認後のみ・本ツールは提案生成だけ。
承認/却下の記録はコンソール側（この端末に保存＋ログ）。読み取りのみ。

使い方: python3 scripts/build_proposals.py
"""
from __future__ import annotations
import json
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
CONSOLE = PROJ / "console"

# 監査所見のタイトル → 提案（kind, next=推奨アクション）。fail/warn のみ対象。
AUDIT_MAP = [
    ("コンバージョンが計測されていない", "計測確認", "計測タグ/コンバージョン連携を確認（配信最適化の前提）"),
    ("無駄消化キーワード", "除外KW追加", "CV0・高消化のキーワードを除外に追加（下書き）"),
    ("無駄消化ぎみ", "除外KW追加", "CV0・高消化のキーワードを除外に追加（下書き）"),
    ("予算による機会損失", "予算調整", "日予算の増額を検討（表示機会の回収）"),
    ("配信方法間でCPA効率差", "予算再配分", "非効率な配信方法から効率的な方法へ予算移動を検討"),
    ("品質スコアが低い", "広告文/LP改善", "低QSキーワードの広告文とLPの関連性を見直し"),
    ("停止キャンペーンの残置", "アカウント整理", "停止キャンペーンのアーカイブで管理を明確化"),
    ("広告表示オプションが不足", "アセット追加", "サイトリンク/コールアウト等の広告表示オプションを追加"),
    ("主要コンバージョンが未設定", "計測整理", "主要コンバージョン(primary)を指定し入札最適化の対象を明確化"),
    ("コンバージョンアクションが", "計測整理", "重複・不要なコンバージョンアクションを整理"),
]
SEV = {"fail": "critical", "warn": "warning"}


def main():
    dpath = CONSOLE / "data.json"
    if not dpath.exists():
        print("console/data.json が無い"); raise SystemExit(1)
    data = json.loads(dpath.read_text(encoding="utf-8"))
    accts = data.get("accounts", [])
    tier = {f"{a.get('client')}|{a.get('media')}": a.get("tier") for a in accts}

    audit = {}
    ap = CONSOLE / "audit.json"
    if ap.exists():
        audit = json.loads(ap.read_text(encoding="utf-8")).get("byAccount", {})
    sdiag = {}
    sp = PROJ / "data" / "search_diag.json"
    if sp.exists():
        for a in json.loads(sp.read_text(encoding="utf-8")).get("accounts", []):
            sdiag[f"{a.get('client')}|google"] = a

    props = []
    n = 0
    # 1) 監査所見（fail/warn）→ 提案下書き
    for key, res in audit.items():
        client, media = key.split("|", 1)
        for f in (res.get("findings") or []):
            if f.get("sev") not in ("fail", "warn"):
                continue
            hit = next((m for m in AUDIT_MAP if m[0] in f.get("title", "")), None)
            if not hit:
                continue
            n += 1
            props.append({
                "id": f"a{n}", "client": client, "media": media, "kind": hit[1],
                "cur": f.get("title", ""), "next": hit[2], "reason": f.get("detail", ""),
                "severity": SEV.get(f["sev"], "warning"),
                "twoStep": tier.get(key) == "large", "source": "監査",
            })
    # 2) 検索診断の不要クエリ → 除外KW追加（具体的な語つき）
    for key, a in sdiag.items():
        client = key.split("|", 1)[0]
        waste = a.get("waste") or a.get("wasteful") or []
        if not waste:
            continue
        top = max(waste, key=lambda x: x.get("cost", 0))
        total = sum(x.get("cost", 0) for x in waste)
        n += 1
        props.append({
            "id": f"s{n}", "client": client, "media": "google", "kind": "除外KW追加",
            "cur": f"CV0で費用消化のクエリ {len(waste)}件・計¥{total:,.0f}",
            "next": f"「{top.get('query', top.get('text',''))}」など{len(waste)}語を除外に追加（下書き）",
            "reason": "情報収集目的等でCVに繋がらない検索語。除外でCPA改善が見込める。",
            "severity": "warning", "twoStep": tier.get(key) == "large", "source": "検索診断",
        })

    # 重要度順（critical→warning）に並べ、data.json へ
    rank = {"critical": 0, "warning": 1, "info": 2}
    props.sort(key=lambda p: rank.get(p["severity"], 3))
    data["proposals"] = props
    dpath.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"提案下書き {len(props)}件を console/data.json に反映")


if __name__ == "__main__":
    main()
