#!/usr/bin/env python3
"""Microsoft広告APIを「Googleでサインインするユーザー」で使うための refresh_token 取得（1回だけ）。

背景: Microsoft広告に「Googleでサインイン」で登録されたユーザー（例 promo@sc-scc.com）は、
Microsoftアカウントのトークンだと IdentityTypeMismatch(126) で弾かれる。公式の Google OAuth 経路
（accounts.google.com で同意 → oauth2.googleapis.com/token）で取ったトークンを使う。
  https://learn.microsoft.com/en-us/advertising/guides/authentication-oauth-get-tokens （Google 節）

- OAuthクライアントは REPORT EYE と同じ Google クライアント（redirect http://localhost:5858/oauth2callback 登録済み）を流用。
  ad-automation/.env に MS_ADS_GOOGLE_CLIENT_ID/SECRET が無ければ ~/dev/report-eye/.env の GOOGLE_CLIENT_ID/SECRET を使い、.env へ写す。
- 同意後のコードはこのMacの localhost で自動受信（人がコピーして渡す必要なし＝期限切れが起きない）。
- 取得した refresh_token は .env の MS_ADS_GOOGLE_REFRESH_TOKEN に保存。画面には出さない（確認用にメールだけ表示）。

使い方: python3 scripts/microsoft_google_refresh_token.py [login_hint]   （既定 promo@sc-scc.com）
"""
from __future__ import annotations
import base64, json, os, re, sys, threading, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
ENV = PROJ / ".env"
EYE_ENV = Path.home() / "dev" / "report-eye" / ".env"
PORT = 5858
REDIRECT = f"http://localhost:{PORT}/oauth2callback"
SCOPE = "openid email profile"
LOGIN_HINT = sys.argv[1] if len(sys.argv) > 1 else "promo@sc-scc.com"
WAIT_SEC = int(os.environ.get("WAIT_SEC", "3600"))  # 押してもらうまで待つ秒数


def read_env(p: Path) -> dict:
    d = {}
    if p.exists():
        for ln in p.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^([A-Za-z0-9_]+)=(.*)$", ln.strip())
            if m:
                d[m.group(1)] = m.group(2).strip()
    return d


def set_env(updates: dict) -> None:
    lines = ENV.read_text(encoding="utf-8").splitlines() if ENV.exists() else []
    lines = [l for l in lines if l.split("=", 1)[0] not in updates]
    lines += [f"{k}={v}" for k, v in updates.items()]
    ENV.write_text("\n".join(lines) + "\n", encoding="utf-8")


env, eye = read_env(ENV), read_env(EYE_ENV)
CID = env.get("MS_ADS_GOOGLE_CLIENT_ID") or eye.get("GOOGLE_CLIENT_ID")
CSEC = env.get("MS_ADS_GOOGLE_CLIENT_SECRET") or eye.get("GOOGLE_CLIENT_SECRET")
if not CID or not CSEC:
    sys.exit("Google OAuth クライアントが見つかりません（MS_ADS_GOOGLE_CLIENT_ID/SECRET か report-eye/.env）")

result: dict = {}
done = threading.Event()


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):  # 静かに
        pass

    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if not self.path.startswith("/oauth2callback"):
            self.send_response(404); self.end_headers(); return
        result["code"] = (q.get("code") or [""])[0]
        result["error"] = (q.get("error") or [""])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        msg = "受け取りました。このタブは閉じてOKです。" if result["code"] else f"エラー: {result['error']}"
        self.wfile.write(f"<p style='font:16px sans-serif;padding:40px'>{msg}</p>".encode())
        done.set()


srv = HTTPServer(("127.0.0.1", PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
auth = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
    "client_id": CID, "redirect_uri": REDIRECT, "response_type": "code", "scope": SCOPE,
    "access_type": "offline", "prompt": "consent", "login_hint": LOGIN_HINT,
})
print("AUTH_URL " + auth, flush=True)
print(f"待ち受け中: {REDIRECT}（最大{WAIT_SEC // 60}分）", flush=True)

if not done.wait(timeout=WAIT_SEC):
    srv.shutdown(); sys.exit(f"タイムアウト（{WAIT_SEC // 60}分）")
srv.shutdown()
if not result.get("code"):
    sys.exit(f"同意されませんでした: {result.get('error')}")

body = urllib.parse.urlencode({"code": result["code"], "client_id": CID, "client_secret": CSEC,
                               "redirect_uri": REDIRECT, "grant_type": "authorization_code"}).encode()
try:
    with urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=body), timeout=30) as r:
        j = json.loads(r.read().decode())
except urllib.error.HTTPError as e:
    sys.exit(f"トークン交換失敗 HTTP {e.code}: {e.read().decode(errors='replace')[:200]}")

rt = j.get("refresh_token")
if not rt:
    sys.exit(f"refresh_token が返りませんでした keys={list(j)}")
email = "?"
if j.get("id_token"):
    try:
        p = j["id_token"].split(".")[1]
        email = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4))).get("email", "?")
    except Exception:
        pass
set_env({"MS_ADS_GOOGLE_CLIENT_ID": CID, "MS_ADS_GOOGLE_CLIENT_SECRET": CSEC, "MS_ADS_GOOGLE_REFRESH_TOKEN": rt})
print(f"OK: Googleアカウント {email} の refresh_token を .env に保存しました（MS_ADS_GOOGLE_REFRESH_TOKEN）")
