#!/usr/bin/env python3
"""LINEヤフー広告 API の refresh_token 取得ヘルパ（OAuth2 認可コードフロー）。

これは無人運用のための **refresh_token を1回だけ取得** するための対話スクリプト。
- 秘密情報（Client Secret / refresh token）は表示するが **保存は .env に手動**。コードには書かない。
- ブラウザでの「同意（許可）」操作は人間が行う（このスクリプトはURL生成とコード交換のみ）。

前提: API管理ツールでアプリケーションを登録し、Client ID / Client Secret /
      リダイレクトURI（例 https://localhost/ など登録済みのもの）を用意しておく。

環境変数 or 対話入力:
  YAHOO_ADS_CLIENT_ID
  YAHOO_ADS_CLIENT_SECRET
  YAHOO_ADS_REDIRECT_URI     アプリ登録時のリダイレクトURIと完全一致
  # 任意（既定を上書きする場合）:
  YAHOO_OAUTH_AUTHORIZE_URL  既定 https://biz-oauth.yahoo.co.jp/oauth/v1/authorize
  YAHOO_OAUTH_TOKEN_URL      既定 https://biz-oauth.yahoo.co.jp/oauth/v1/token

使い方:
  python3 scripts/yahoo_generate_refresh_token.py
    1) 表示された認可URLをブラウザで開き、ビジネスIDでログイン→許可
    2) リダイレクト先URLの ?code=... の値を貼り付け
    3) 表示された refresh_token を .env の YAHOO_ADS_REFRESH_TOKEN に設定（実値はコミットしない）

※ 認可URLのホスト/スコープ表記は稼働前に「認可認証について」で要確認。
  https://ads-developers.yahoo.co.jp/ja/ads-api/developers-guide/oauth.html
"""
from __future__ import annotations
import os, sys, json, urllib.parse, urllib.request
from pathlib import Path

AUTHORIZE_URL = os.environ.get("YAHOO_OAUTH_AUTHORIZE_URL", "https://biz-oauth.yahoo.co.jp/oauth/v1/authorize")
TOKEN_URL = os.environ.get("YAHOO_OAUTH_TOKEN_URL", "https://biz-oauth.yahoo.co.jp/oauth/v1/token")


def _load_env(path=Path(".env")):
    import re
    if not path.exists():
        return
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def _ask(name: str, secret: bool = False) -> str:
    v = os.environ.get(name, "").strip()
    if v:
        return v
    try:
        v = input(f"{name} を入力: ").strip()
    except EOFError:
        v = ""
    if not v:
        print(f"{name} が空です。中止します。", file=sys.stderr)
        raise SystemExit(2)
    return v


def main() -> int:
    _load_env()
    client_id = _ask("YAHOO_ADS_CLIENT_ID")
    client_secret = _ask("YAHOO_ADS_CLIENT_SECRET", secret=True)
    redirect_uri = _ask("YAHOO_ADS_REDIRECT_URI")

    # 1) 認可URLを生成（人間がブラウザで開いて許可する）
    auth = AUTHORIZE_URL + "?" + urllib.parse.urlencode({
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": "openid profile",  # ※必要スコープは要確認
    })
    print("\n[1] 次のURLをブラウザで開き、ビジネスIDでログイン→「許可」してください:\n")
    print("   " + auth + "\n")
    print("[2] リダイレクト先URLの code= の値をコピーして貼り付けてください。")
    try:
        code = input("認可コード code: ").strip()
    except EOFError:
        code = ""
    if not code:
        print("code が空です。中止します。", file=sys.stderr)
        return 2

    # 3) コード → トークン交換
    data = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret,
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=data, method="POST",
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            j = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        print(f"トークン交換に失敗: {type(e).__name__}: {str(e)[:200]}", file=sys.stderr)
        return 1

    rt = j.get("refresh_token")
    if not rt:
        print("refresh_token が返りませんでした:", json.dumps(j, ensure_ascii=False)[:300], file=sys.stderr)
        return 1
    print("\n✅ 取得成功。以下を .env に設定してください（実値はGitにコミットしない）:\n")
    print(f"YAHOO_ADS_REFRESH_TOKEN={rt}")
    print("\n（access_token は fetch_yahoo_insights.py が refresh_token から都度取得します）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
