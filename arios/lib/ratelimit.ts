// レート制限。
// - rateLimit():   プロセス内メモリ（インスタンスごとに独立＝ベストエフォート）。
// - rateLimitDb(): Supabase 共有テーブルで全インスタンス共通に制限（本番向け）。
//                  DB 不調時はメモリにフォールバックして登録/送信を止めすぎない。
import { createAdminClient } from "@/lib/supabase/admin";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

// 共有ストア（Supabase）版。原子的な rl_hit 関数で全インスタンス共通に制限する。
export async function rateLimitDb(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: boolean }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("rl_hit", {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs,
    });
    if (error) {
      // DB 側が未適用/不調のときはメモリにフォールバック（可用性優先）。
      return { ok: rateLimit(key, limit, windowMs).ok };
    }
    return { ok: data === true };
  } catch {
    return { ok: rateLimit(key, limit, windowMs).ok };
  }
}

// クライアント IP を取り出す。Vercel は x-forwarded-for の先頭に実クライアント IP を入れる。
// x-real-ip があればそれを優先（プラットフォームが付与する信頼できる値）。
export function clientIp(h: Headers): string {
  const real = (h.get("x-real-ip") ?? "").trim();
  if (real) return real;
  const xff = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return xff || "unknown";
}
