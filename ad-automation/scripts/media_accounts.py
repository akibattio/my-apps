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
import os, re, json, shutil, subprocess
from pathlib import Path
from adops_log import detail, err  # noqa: E402  記録に取引先の情報を出さない（adops_log.py）

PROJ = Path(__file__).resolve().parent.parent
KV_NAMESPACE_ID = "3248fc5bc14f4f3a807bc4b17a2a7376"  # adops-state（コンソールの _worker.js が STATE で使う）
# launchd は PATH が最小なので Mac では絶対パスにフォールバック。GitHub Actions では PATH 上の npx を使う。
NPX = shutil.which("npx") or "/Users/som-013/.nvm/versions/node/v24.15.0/bin/npx"
WRANGLER_VERSION = "4.158.0"  # 定時実行のデプロイ（.github/workflows/ad-automation-daily.yml）と同じ版
FILES = {"yahoo": "yahoo_accounts.json", "microsoft": "microsoft_accounts.json"}
MEDIA_KINDS = {"yahoo": ("yahoo_search", "yahoo_display"), "microsoft": ("microsoft",)}
# 管理画面の保存の入口（console/_worker.js）と同じ決まり。識別名はファイル名の一部になるので、英小文字・数字・ハイフンだけ。
SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$")
ID_RE = re.compile(r"^[0-9]{1,20}$")
# 媒体ごとの番号の桁。console/_worker.js の ID_SHAPE・console/ad_ops_console.jsx の MEDIA_ID_SHAPE と同じ
# （ずれは scripts/check_id_shape_sync.py で確かめる）。合わない口座は取りに行かない（1件の入れ間違いで媒体まるごと外れるのを防ぐ）。
ID_SHAPE = {"yahoo_search": r"^[0-9]{7,8}$", "yahoo_display": r"^[0-9]{10}$", "microsoft": r"^[0-9]{8,10}$"}


def id_shape_ok(m: str, acct: str, cid: str = "") -> bool:
    """m = yahoo_search | yahoo_display | microsoft。Microsoft は顧客IDも同じ形で確かめる。"""
    pat = ID_SHAPE.get(m)
    if not pat or not re.match(pat, str(acct)):
        return False
    return m != "microsoft" or bool(re.match(ID_SHAPE["microsoft"], str(cid)))
YM_RE = re.compile(r"^20[0-9]{2}-(0[1-9]|1[0-2])$")


def valid_slug(s) -> bool:
    return isinstance(s, str) and bool(SLUG_RE.match(s))


def valid_ym(s) -> bool:
    return isinstance(s, str) and bool(YM_RE.match(s))
_kv_cache: list | None = None


def _kv_entries() -> list:
    """KV の mediaAccounts.list。wrangler が ad-automation/.env の CLOUDFLARE_API_TOKEN/ACCOUNT_ID で読む。"""
    global _kv_cache
    if _kv_cache is not None:
        return _kv_cache
    _kv_cache = []
    try:
        node_bin = str(Path(NPX).parent)
        # wrangler は版を固定し（配布物の差し替えに巻き込まれない）、渡す環境変数は Cloudflare の2つと動作に要る最小限だけ
        # （広告媒体のトークンを外部の道具に渡さない）。手元では wrangler が ad-automation/.env からも読む。
        env = {"PATH": node_bin + ":/usr/bin:/bin", "HOME": os.environ.get("HOME", str(PROJ))}
        for k in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "npm_config_cache", "XDG_CONFIG_HOME"):
            if os.environ.get(k):
                env[k] = os.environ[k]
        r = subprocess.run([NPX, "-y", f"wrangler@{WRANGLER_VERSION}", "kv", "key", "get", "mediaAccounts",
                            "--namespace-id", KV_NAMESPACE_ID, "--remote"],
                           cwd=PROJ, capture_output=True, text=True, timeout=120, env=env)
        out = r.stdout.strip()
        if r.returncode == 0 and out.startswith("{"):
            _kv_cache = json.loads(out).get("list", []) or []
        elif "not found" not in (r.stdout + r.stderr).lower():
            print(f"  （コンソール追加分のアカウントを読めず・ファイルのみで続行）終了コード {r.returncode}")
            detail("   ", (r.stderr or r.stdout).strip()[:120])
    except Exception as e:
        print("  （コンソール追加分のアカウントを読めず・ファイルのみで続行）", err(e))
    return _kv_cache


def load(media: str) -> list[dict]:
    """media = "yahoo" | "microsoft"。コメント行（_comment）は除いて返す。"""
    p = PROJ / "clients" / FILES[media]
    base = [e for e in (json.loads(p.read_text(encoding="utf-8")) if p.exists() else [])
            if isinstance(e, dict) and e.get("accountId")]
    bad = [e for e in base if e.get("slug") and not valid_slug(e["slug"])]
    if bad:  # ファイル側でも、ファイル名に使えない識別名は使わない
        print(f"  {media}: 識別名の形が正しくない {len(bad)}件をファイル側から除外")
        base = [e for e in base if e not in bad]
    kind_of = lambda e: "microsoft" if media == "microsoft" else ("yahoo_display" if e.get("kind") == "display" else "yahoo_search")
    bad = [e for e in base if not id_shape_ok(kind_of(e), e.get("accountId", ""), e.get("customerId", ""))]
    if bad:  # ファイル側でも、番号の桁が媒体と合わない口座は取りに行かない
        print(f"  {media}: 番号の桁が媒体と合わない {len(bad)}件をファイル側から除外")
        base = [e for e in base if e not in bad]
    seen = {str(e["accountId"]) for e in base}
    slug_owner = {e["slug"]: e.get("client", "") for e in base if e.get("slug")}
    skipped = shape_bad = 0
    for e in _kv_entries():
        if not isinstance(e, dict):
            skipped += 1; continue
        m, acct = str(e.get("media", "")), str(e.get("accountId", "")).strip()
        if m not in MEDIA_KINDS[media]:
            continue
        slug, client = str(e.get("slug", "") or ""), str(e.get("client", "") or "").strip()
        cid = str(e.get("customerId", "") or "").strip()
        ok = (ID_RE.match(acct) and client and len(client) <= 80 and (not slug or valid_slug(slug))
              and (media != "microsoft" or ID_RE.match(cid)))
        # ファイル側・先に採った分と同じ識別名を、別の取引先名で使っているものは採らない（別口座の数値の混入防止）
        if ok and slug and slug in slug_owner and slug_owner[slug] != client:
            ok = False
        if not ok:
            skipped += 1; continue
        if not id_shape_ok(m, acct, cid):  # 別の媒体の番号の入れ間違い（2026-11-12 の例）は取りに行かない
            shape_bad += 1; continue
        if acct in seen:
            continue
        row = {"client": client, "accountId": acct, "slug": slug, "_from": "console"}
        if media == "yahoo":
            row["kind"] = "display" if m == "yahoo_display" else "search"
        else:
            row["customerId"] = cid
        base.append(row); seen.add(acct)
        if slug:
            slug_owner.setdefault(slug, client)
    if skipped:
        print(f"  {media}: 管理画面の追加分のうち {skipped}件は検査に通らず使わない（形の誤り・識別名の重複）")
    if shape_bad:
        print(f"  {media}: 管理画面の追加分のうち {shape_bad}件は番号の桁が媒体と合わないので使わない（別の媒体の番号の入れ間違いの見込み）")
    return base


if __name__ == "__main__":
    for m in FILES:
        rows = load(m)
        print(m, len(rows), "件（うちコンソール追加", sum(1 for r in rows if r.get("_from") == "console"), "件）")
