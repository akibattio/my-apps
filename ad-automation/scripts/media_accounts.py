#!/usr/bin/env python3
"""Yahoo!・Microsoft広告のアカウント対応表を返す。読み取りのみ。

正は2か所を合わせたもの:
  1. clients/yahoo_accounts.json / clients/microsoft_accounts.json（git管理の従来の表）
  2. 運用コンソールの「接続ステータス」で担当者が追加した分（Cloudflare KV adops-state の mediaAccounts）
     修正依頼 2026-09-09（田上）「Google以外のクライアント・媒体を担当側で追加できる導線」への対応。
同じ accountId が両方にあればファイル側を優先。KVが読めない（ネット不通・権限）ときはファイルだけで続行する。

返す形はファイルと同じ:
  yahoo     … [{client, kind: search|display, accountId, slug}]
  microsoft … [{client, accountId, customerId, slug}]
"""
from __future__ import annotations
import os, json, subprocess
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
KV_NAMESPACE_ID = "3248fc5bc14f4f3a807bc4b17a2a7376"  # adops-state（コンソールの _worker.js が STATE で使う）
NPX = "/Users/som-013/.nvm/versions/node/v24.15.0/bin/npx"
FILES = {"yahoo": "yahoo_accounts.json", "microsoft": "microsoft_accounts.json"}
_kv_cache: list | None = None


def _kv_entries() -> list:
    """KV の mediaAccounts.list。wrangler が ad-automation/.env の CLOUDFLARE_API_TOKEN/ACCOUNT_ID で読む。"""
    global _kv_cache
    if _kv_cache is not None:
        return _kv_cache
    _kv_cache = []
    try:
        node_bin = str(Path(NPX).parent)
        r = subprocess.run([NPX, "-y", "wrangler@4", "kv", "key", "get", "mediaAccounts",
                            "--namespace-id", KV_NAMESPACE_ID, "--remote"],
                           cwd=PROJ, capture_output=True, text=True, timeout=120,
                           env={**os.environ, "PATH": node_bin + ":/usr/bin:/bin"})
        out = r.stdout.strip()
        if r.returncode == 0 and out.startswith("{"):
            _kv_cache = json.loads(out).get("list", []) or []
        elif "not found" not in (r.stdout + r.stderr).lower():
            print("  （コンソール追加分のアカウントを読めず・ファイルのみで続行）", (r.stderr or r.stdout).strip()[:120])
    except Exception as e:
        print("  （コンソール追加分のアカウントを読めず・ファイルのみで続行）", str(e)[:120])
    return _kv_cache


def load(media: str) -> list[dict]:
    """media = "yahoo" | "microsoft"。コメント行（_comment）は除いて返す。"""
    p = PROJ / "clients" / FILES[media]
    base = [e for e in (json.loads(p.read_text(encoding="utf-8")) if p.exists() else [])
            if isinstance(e, dict) and e.get("accountId")]
    seen = {str(e["accountId"]) for e in base}
    for e in _kv_entries():
        m, acct = e.get("media", ""), str(e.get("accountId", "")).strip()
        if not acct or acct in seen or not m.startswith(media):
            continue
        row = {"client": e.get("client", ""), "accountId": acct, "slug": e.get("slug", ""), "_from": "console"}
        if media == "yahoo":
            row["kind"] = "display" if m == "yahoo_display" else "search"
        else:
            row["customerId"] = str(e.get("customerId", "")).strip()
        base.append(row); seen.add(acct)
    return base


if __name__ == "__main__":
    for m in FILES:
        rows = load(m)
        print(m, len(rows), "件（うちコンソール追加", sum(1 for r in rows if r.get("_from") == "console"), "件）")
