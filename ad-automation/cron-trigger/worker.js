// 広告データの定時取得を、正確な時刻で GitHub Actions に起動させる Cloudflare Worker（Cron Trigger）。
// GitHub の schedule は3〜7時間遅れる（2026-10〜11 実測）ため、時計だけ Cloudflare に持たせる。
// 取得・監視・デプロイの中身は .github/workflows/ad-automation-daily.yml のまま。この Worker は「起動」しかしない。
// 鍵：Worker の secret GITHUB_TOKEN（my-apps の Actions 書き込み権限だけの fine-grained token）。値はコードに書かない。

const REPO = "akibattio/my-apps";
const WORKFLOW = "ad-automation-daily.yml";
const MORNING = "30 23 * * *"; // 08:30 JST。この回だけ Google Chat へ通知する

async function dispatch(env, notify) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "sofcom-adops-cron",
    },
    body: JSON.stringify({ ref: "main", inputs: { notify: notify ? "true" : "false" } }),
  });
  if (res.status !== 204) {
    // 401/403 は鍵の失効・権限不足。Cloudflare のログ（wrangler tail）に残す
    throw new Error(`GitHub dispatch failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatch(env, event.cron === MORNING));
  },
};
