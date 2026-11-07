// 車体番号（VIN / 国内のフレーム番号）の正規化と簡易チェック。サーバー/クライアント共用。
// 17桁VIN（ZFF79ALA4J0231234）も国内の車台番号（BNR32-012345）も受け付ける。
export function normalizeVin(raw: string): string {
  return raw
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s‐－―ー−]/g, (c) => (/\s/.test(c) ? "" : "-"))
    .trim();
}

export function isValidVin(vin: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{4,29}$/.test(vin);
}
