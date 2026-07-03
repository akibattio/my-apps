#!/usr/bin/env python3
"""Google Ads API 用の Refresh Token を生成するヘルパー。

前提:
  - GCPで「OAuth 2.0 クライアントID(デスクトップアプリ)」を作成し、
    client_secret_*.json をダウンロード済みであること。
  - スコープは Google Ads API 用の https://www.googleapis.com/auth/adwords

使い方:
  pip install google-auth-oauthlib
  python3 scripts/google_generate_refresh_token.py --client-secret ~/Downloads/client_secret_XXXX.json

  → ブラウザが開く → 対象のGoogleアカウント(MCCにアクセスできるアカウント)で承認
  → ターミナルに Refresh Token が表示される

⚠️ セキュリティ(CLAUDE.md §0/§8):
  - 表示された Refresh Token / Client Secret を **チャット・MD・リポジトリに貼らない**。
  - 実値は .env の GOOGLE_ADS_REFRESH_TOKEN などにだけ入れる(.env はGit管理外)。
  - client_secret_*.json もリポジトリに入れない(.gitignore で除外済み想定)。
"""
from __future__ import annotations

import argparse
import sys

SCOPES = ["https://www.googleapis.com/auth/adwords"]


def main() -> int:
    p = argparse.ArgumentParser(description="Google Ads の Refresh Token を生成")
    p.add_argument("--client-secret", required=True,
                   help="GCPでDLした OAuthクライアント(デスクトップ)の client_secret_*.json のパス")
    p.add_argument("--no-browser", action="store_true",
                   help="ブラウザを自動で開けない環境向け(コンソールにURLを表示)")
    a = p.parse_args()

    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        print("google-auth-oauthlib が未インストールです。\n"
              "  pip install google-auth-oauthlib", file=sys.stderr)
        return 2

    flow = InstalledAppFlow.from_client_secrets_file(a.client_secret, scopes=SCOPES)
    if a.no_browser:
        creds = flow.run_console()
    else:
        creds = flow.run_local_server(port=0, prompt="consent")

    print("\n==============================")
    print("Refresh Token を取得しました。")
    print("この値を .env の GOOGLE_ADS_REFRESH_TOKEN に設定してください(チャットに貼らない)。")
    print("==============================")
    print(creds.refresh_token)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
