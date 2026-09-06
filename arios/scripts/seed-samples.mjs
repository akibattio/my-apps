// サンプルデータ投入（デモ用）。
// 使い方: .env に SUPABASE_DB_URL を設定して `node --env-file=.env scripts/seed-samples.mjs`
// 同じ(メーカー×車種×氏名)の既存サンプルを消してから入れ直すので、何度でも実行できる。
import pg from "pg";

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error("SUPABASE_DB_URL が未設定です。.env を確認してください。");
  process.exit(1);
}

// 買い3・売り3。マッチが分かる構成にしてある。
const SAMPLES = [
  // --- 買いたい ---
  { kind: "BUY", manufacturer: "トヨタ", model: "ランドクルーザー300", price: 12000000,
    name: "山田太郎", contact: "line_yamada", contact_method: "LINE", channel: "LINE",
    message: "ボディカラー白希望 / 事故車NG / 未使用車が理想", status: "NEW" },
  { kind: "BUY", manufacturer: "メルセデス・ベンツ", model: "Gクラス", price: 25000000,
    name: "佐藤商事", contact: "090-1234-5678", contact_method: "PHONE", channel: "PHONE",
    message: "G63希望 / 外装黒・内装黒 / オプション問わず", status: "CONTACTED" },
  { kind: "BUY", manufacturer: "ポルシェ", model: "911カレラ", price: 15000000,
    name: "鈴木一郎", contact: "line_suzuki", contact_method: "LINE", channel: "REFERRAL",
    message: "992型 / PDK / 走行少なめ希望", status: "NEW" },

  // --- 売りたい ---
  { kind: "SELL", manufacturer: "トヨタ", model: "ランドクルーザー300", price: 13500000,
    party_type: "BROKER", vin: "JTMHV05J60D123456", name: "グローバルモータース",
    contact: "03-1111-2222", contact_method: "PHONE", status: "NEW" },
  { kind: "SELL", manufacturer: "メルセデス・ベンツ", model: "Gクラス", price: 24000000,
    party_type: "OWNER", vin: "WDB4632761X234567", name: "田中花子",
    contact: "line_tanaka", contact_method: "LINE", status: "NEW" },
  { kind: "SELL", manufacturer: "メルセデス・ベンツ", model: "Gクラス", price: 26000000,
    party_type: "DEALER", vin: "WDB4632761X765432", name: "AMG大阪",
    contact: "06-3333-4444", contact_method: "PHONE", status: "CONTACTED" },
];

const client = new pg.Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log("接続OK。サンプルを投入します。\n");

  for (const s of SAMPLES) {
    // 同一(メーカー×車種×氏名)の既存サンプルを消してから入れる（再実行しても重複しない）
    await client.query(
      "delete from inquiries where manufacturer=$1 and model=$2 and name=$3",
      [s.manufacturer, s.model, s.name]
    );
    await client.query(
      `insert into inquiries
        (kind, manufacturer, model, price, party_type, vin, name, contact,
         contact_method, channel, message, source, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'MANUAL',$12)`,
      [
        s.kind, s.manufacturer, s.model, s.price ?? null, s.party_type ?? null,
        s.vin ?? null, s.name ?? null, s.contact ?? null, s.contact_method ?? null,
        s.channel ?? null, s.message ?? null, s.status,
      ]
    );
    console.log(`→ ${s.kind === "BUY" ? "買" : "売"} ${s.manufacturer} ${s.model}（${s.name}）OK`);
  }

  const { rows } = await client.query(
    "select kind, count(*)::int as n from inquiries group by kind order by kind"
  );
  console.log("\n現在の件数:", rows.map((r) => `${r.kind}=${r.n}`).join(" / "));
  await client.end();
  console.log("完了。");
}

main().catch(async (e) => {
  console.error("失敗:", e.message);
  await client.end().catch(() => {});
  process.exit(1);
});
