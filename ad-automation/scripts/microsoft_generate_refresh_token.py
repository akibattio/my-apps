#!/usr/bin/env python3
"""Microsoft広告(Microsoft Advertising / 旧Bing Ads) の refresh_token 取得ヘルパ（OAuth2 認可コードフロー）。

これは無人運用のための **refresh_token を1回だけ取得** するための対話スクリプト。
- 秘密情報（Client Secret / refresh token）は表示するが **保存は .env に手動**。コードには書かない。
- ブラウザでの「同意（許可）」操作は人間が行う（このスクリプトはURL生成とコード交換のみ）。
- 標準ライブラリ(urllib)のみで実装。依存を増やさない。

前提（Azureアプリ登録の要点）:
  - Microsoft Entra（旧Azure AD）の「アプリの登録」でアプリを作り、アプリケーション(クライアント)ID を用意。
  - リダイレクトURIを登録。既定は `https://login.microsoftonline.com/common/oauth2/nativeclient`
    （「モバイルおよびデスクトップ アプリケーション」のネイティブクライアント用URI）。
    MS_ADS_REDIRECT_URI は **登録値と完全一致** が必須。ズレると AADSTS50011 で弾かれる。
  - スコープは `https://ads.microsoft.com/msads.manage offline_access`
    （offline_access が無いと refresh_token が返らない）。
  - 「サポートされているアカウントの種類」は個人／職場どちらも使えるよう `common` テナントで認可する
    （authorize/token の URL に common を使う）。
  - public client（クライアントシークレット無し）なら MS_ADS_CLIENT_SECRET は空でよい。
    confidential client ならシークレットを設定するとコード交換時に付与する。

環境変数 or 対話入力:
  MS_ADS_CLIENT_ID
  MS_ADS_CLIENT_SECRET       public client なら空可（confidential なら設定）
  MS_ADS_REDIRECT_URI        アプリ登録時のリダイレクトURIと完全一致
                             （既定 https://login.microsoftonline.com/common/oauth2/nativeclient）
  # 任意（既定を上書きする場合）:
  MS_OAUTH_AUTHORIZE_URL     既定 https://login.microsoftonline.com/common/oauth2/v2.0/authorize
  MS_OAUTH_TOKEN_URL         既定 https://login.microsoftonline.com/common/oauth2/v2.0/token
  MS_OAUTH_SCOPE             既定 https://ads.microsoft.com/msads.manage offline_access

使い方:
  python3 scripts/microsoft_generate_refresh_token.py
    1) 表示された認可URLをブラウザで開き、Microsoftアカウント（個人/職場）でログイン→「承諾」
    2) リダイレクト先URLの ?code=... の値を貼り付け
    3) 表示された refresh_token を .env の MS_ADS_REFRESH_TOKEN に設定（実値はコミットしない）

  python3 scripts/microsoft_generate_refresh_token.py --code "<認可コード or リダイレクトURL全体>"
    非対話でコード交換だけ行う（terminal 1行で完結）。
"""
from __future__ import annotations
import os, sys, json, urllib.parse, urllib.request
from pathlib import Path

AUTHORIZE_URL = os.environ.get("MS_OAUTH_AUTHORIZE_URL", "https://login.microsoftonline.com/common/oauth2/v2.0/authorize")
TOKEN_URL = os.environ.get("MS_OAUTH_TOKEN_URL", "https://login.microsoftonline.com/common/oauth2/v2.0/token")
DEFAULT_REDIRECT = "https://login.microsoftonline.com/common/oauth2/nativeclient"
DEFAULT_SCOPE = "https://ads.microsoft.com/msads.manage offline_access"


def _load_env(path=Path(".env")):
    import re
    if not path.exists():
        return
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def _ask(name: str, secret: bool = False, default: str = "") -> str:
    v = os.environ.get(name, "").strip()
    if v:
        return v
    if default:
        return default
    try:
        v = input(f"{name} を入力: ").strip()
    except EOFError:
        v = ""
    if not v:
        print(f"{name} が空です。中止します。", file=sys.stderr)
        raise SystemExit(2)
    return v


def _extract_code(s: str) -> str:
    """code の値、または 'https://.../nativeclient?code=XXX' のようなURL全体を貼っても code を取り出す。"""
    s = (s or "").strip()
    if "code=" in s:
        s = s.split("code=", 1)[1].split("&", 1)[0]
    return urllib.parse.unquote(s).strip()


def main() -> int:
    _load_env()
    # --code <値> を渡せば、認可URL表示を飛ばして即トークン交換（非対話・terminal1行で完結）
    code_arg = ""
    argv = sys.argv[1:]
    for i, a in enumerate(argv):
        if a == "--code" and i + 1 < len(argv):
            code_arg = argv[i + 1]
        elif a.startswith("--code="):
            code_arg = a.split("=", 1)[1]

    client_id = _ask("MS_ADS_CLIENT_ID")
    # public client（PKCE無し）でも通るよう、client_secret は任意扱い。無ければ交換時に付けない。
    client_secret = os.environ.get("MS_ADS_CLIENT_SECRET", "").strip()
    redirect_uri = _ask("MS_ADS_REDIRECT_URI", default=DEFAULT_REDIRECT)
    scope = os.environ.get("MS_OAUTH_SCOPE", DEFAULT_SCOPE).strip()

    if code_arg:
        code = _extract_code(code_arg)
    else:
        # 1) 認可URLを生成（人間がブラウザで開いて承諾する）
        auth = AUTHORIZE_URL + "?" + urllib.parse.urlencode({
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": scope,
            "response_mode": "query",
        })
        print("\n[1] 次のURLをブラウザで開き、Microsoftアカウント（個人/職場）でログイン→「承諾」してください:\n")
        print("   " + auth + "\n")
        print("[2] リダイレクト先URLの code= の値をコピーして貼り付けてください。")
        try:
            code = _extract_code(input("認可コード code: "))
        except EOFError:
            code = ""
    if not code:
        print("code が空です。中止します。", file=sys.stderr)
        return 2

    # 3) コード → トークン交換。client_secret があれば付け、無ければ付けない（public client/PKCE無しでも素直に通す）。
    params = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "scope": scope,
    }
    if client_secret:
        params["client_secret"] = client_secret
    data = urllib.parse.urlencode(params).encode()
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
        print("→ scope に offline_access が含まれているか確認してください。", file=sys.stderr)
        return 1
    print("\n✅ 取得成功。以下を .env に設定してください（実値はGitにコミットしない）:\n")
    print(f"MS_ADS_REFRESH_TOKEN={rt}")
    print("\n（access_token は fetch_microsoft_insights.py が refresh_token から都度取得します）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
