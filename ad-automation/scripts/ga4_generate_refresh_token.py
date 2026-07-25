#!/usr/bin/env python3
"""GA4（Google Analytics Data API）用の Refresh Token を生成するヘルパー。

既存の Google Ads と同じ OAuthクライアント（.env の GOOGLE_ADS_CLIENT_ID / _CLIENT_SECRET）を
**analytics.readonly スコープ**で認可し直して、GA4用の refresh token を取得する。
Google Ads の refresh token は adwords スコープのみで GA4 には使えないため、別途これが必要。

前提（ご本人の作業）:
  1. GCPコンソールで、このOAuthクライアントのプロジェクトに対し
     「Google Analytics Data API」と「Google Analytics Admin API」を**有効化**しておく。
  2. 認可する Google アカウントが、対象の GA4 プロパティに閲覧権限を持っていること。

使い方:
  python3 scripts/ga4_generate_refresh_token.py
    → ブラウザが開く → 対象アカウントで許可 → ターミナルに refresh token が表示される
    → その値を .env の GA4_REFRESH_TOKEN に設定（チャット/リポジトリに貼らない・§8）

※ ブラウザを自動で開けない場合は --no-browser（表示URLを手動で開く）。
"""
from __future__ import annotations
import os, re, sys
from pathlib import Path

SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]


def load_env(path=Path(".env")):
    if not path.exists():
        return
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def main() -> int:
    load_env()
    cid = os.environ.get("GOOGLE_ADS_CLIENT_ID", "").strip()
    csec = os.environ.get("GOOGLE_ADS_CLIENT_SECRET", "").strip()
    if not cid or not csec:
        print("GOOGLE_ADS_CLIENT_ID / _CLIENT_SECRET が .env にありません。", file=sys.stderr)
        return 2
    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        print("google-auth-oauthlib が未インストールです。\n  pip install google-auth-oauthlib", file=sys.stderr)
        return 2

    config = {"installed": {
        "client_id": cid, "client_secret": csec,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["http://localhost"],
    }}
    flow = InstalledAppFlow.from_client_config(config, scopes=SCOPES)
    if "--no-browser" in sys.argv:
        creds = flow.run_console()
    else:
        creds = flow.run_local_server(port=0, prompt="consent")

    print("\n==============================")
    print("GA4 refresh token を取得しました。次を .env に設定してください（チャットに貼らない）:")
    print("==============================")
    print(f"GA4_REFRESH_TOKEN={creds.refresh_token}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
