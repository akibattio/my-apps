#!/usr/bin/env python3
"""P-MAX クリエイティブの可視化用データ取得。読み取りのみ。
アセットグループ単位の実績＋その中の稼働クリエイティブ（見出し/説明文/画像/動画）＋素材充足チェックを出力。
※ Google Ads API は「1クリエイティブごとのCV/CPA」を公開していない。取れるのは
   アセットグループ単位の実績・広告の有効性(ad strength)・素材の種類/本数まで。ここは正直に扱う。

使い方: python3 scripts/google_pmax_creatives.py <customer_id> <out.json> [start YYYY-MM-DD] [end YYYY-MM-DD]
"""
from __future__ import annotations
import os, re, sys, json, base64, datetime, urllib.request
from pathlib import Path


def fetch_data_uri(url, max_px=360):
    """画像URLを取得し、可能なら縮小して data URI で返す（レポート自己完結化）。失敗時 None。"""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        raw = urllib.request.urlopen(req, timeout=20).read()
    except Exception:
        return None
    try:  # Pillow があれば縮小してファイルサイズ削減
        import io
        from PIL import Image
        im = Image.open(io.BytesIO(raw)); im.thumbnail((max_px, max_px))
        if im.mode in ("RGBA", "P"):
            im = im.convert("RGB")
        buf = io.BytesIO(); im.save(buf, "JPEG", quality=78); raw = buf.getvalue()
    except Exception:
        pass  # Pillow無し等は原本をそのまま埋め込む
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()


def load_env(path=Path(".env")):
    for ln in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", ln.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def client():
    from google.ads.googleads.client import GoogleAdsClient
    mcc = re.sub(r"\D", "", os.environ["GOOGLE_LOGIN_CUSTOMER_ID"])
    return GoogleAdsClient.load_from_dict({
        "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"].strip(),
        "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"].strip(),
        "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"].strip(),
        "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"].strip(),
        "login_customer_id": mcc, "use_proto_plus": True})


# 素材の推奨（Google PMax ベストプラクティス）: (最低OK本数, 推奨本数, 表示名)
REC = {
    "HEADLINE": (5, 11, "見出し"),
    "LONG_HEADLINE": (1, 5, "長い見出し"),
    "DESCRIPTION": (2, 5, "説明文"),
    "MARKETING_IMAGE": (1, 4, "横長画像 1.91:1"),
    "SQUARE_MARKETING_IMAGE": (1, 4, "正方形画像 1:1"),
    "PORTRAIT_MARKETING_IMAGE": (1, 2, "縦型画像 4:5"),
    "LOGO": (1, 1, "ロゴ 1:1"),
    "LANDSCAPE_LOGO": (0, 1, "横ロゴ 4:1"),
    "YOUTUBE_VIDEO": (1, 1, "動画"),
}
IMG_TYPES = {"MARKETING_IMAGE", "SQUARE_MARKETING_IMAGE", "PORTRAIT_MARKETING_IMAGE",
             "LOGO", "LANDSCAPE_LOGO", "AD_IMAGE"}


def main():
    cid = re.sub(r"\D", "", sys.argv[1]); outp = sys.argv[2]
    if len(sys.argv) > 4:
        start, end = sys.argv[3], sys.argv[4]
    else:
        e = datetime.date.today(); s = e - datetime.timedelta(days=30)
        start, end = s.isoformat(), e.isoformat()
    load_env()
    ga = client().get_service("GoogleAdsService")

    # 1) アセットグループ実績（期間内・PMax）
    groups = {}
    for r in ga.search(customer_id=cid, query=f"""
        SELECT asset_group.id, asset_group.name, asset_group.status, asset_group.ad_strength,
               campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks,
               metrics.conversions, metrics.conversions_value
        FROM asset_group WHERE segments.date BETWEEN '{start}' AND '{end}'"""):
        ag = r.asset_group; m = r.metrics; cost = (m.cost_micros or 0) / 1e6; cv = m.conversions or 0
        groups[str(ag.id)] = {
            "id": str(ag.id), "name": ag.name, "status": ag.status.name,
            "ad_strength": ag.ad_strength.name, "campaign": r.campaign.name,
            "cost": round(cost), "imp": int(m.impressions or 0), "clk": int(m.clicks or 0),
            "cv": round(cv, 1), "cpa": (round(cost / cv) if cv else None),
            "rev": round(m.conversions_value or 0), "assets": {}}

    # 2) 稼働クリエイティブ（構造・日付なし）
    for r in ga.search(customer_id=cid, query="""
        SELECT asset_group.id, asset_group_asset.field_type, asset.type,
               asset.text_asset.text, asset.image_asset.full_size.url,
               asset.image_asset.full_size.width_pixels, asset.image_asset.full_size.height_pixels,
               asset.youtube_video_asset.youtube_video_id, asset.youtube_video_asset.youtube_video_title
        FROM asset_group_asset WHERE asset_group_asset.status != 'REMOVED'"""):
        gid = str(r.asset_group.id)
        if gid not in groups:
            continue
        a = r.asset; ft = r.asset_group_asset.field_type.name; at = a.type_.name
        if at == "TEXT":
            item = {"kind": "text", "text": a.text_asset.text}
        elif at == "IMAGE":
            im = a.image_asset.full_size
            item = {"kind": "image", "url": im.url, "w": im.width_pixels, "h": im.height_pixels}
        elif at == "YOUTUBE_VIDEO":
            v = a.youtube_video_asset
            item = {"kind": "video", "id": v.youtube_video_id, "title": v.youtube_video_title,
                    "thumb": f"https://i.ytimg.com/vi/{v.youtube_video_id}/hqdefault.jpg",
                    "url": f"https://www.youtube.com/watch?v={v.youtube_video_id}"}
        else:
            item = {"kind": "other", "type": at}
        groups[gid]["assets"].setdefault(ft, []).append(item)

    # 3) 表示対象グループの画像・動画サムネをデータURIで埋め込み（環境非依存・自己完結）
    embed = "--no-embed" not in sys.argv
    if embed:
        n = 0
        for g in groups.values():
            if not (g["status"] == "ENABLED" or g["cost"] > 0):
                continue
            for ft, items in g["assets"].items():
                for a in items:
                    src = a.get("thumb") or a.get("url")
                    if a.get("kind") in ("image", "video") and src:
                        du = fetch_data_uri(src)
                        if du:
                            a["data"] = du; n += 1
        print(f"画像埋め込み: {n}件")

    # 4) 素材充足チェック（アセットグループごと）
    for g in groups.values():
        cov = []
        for ft, (mn, rec, jp) in REC.items():
            have = len(g["assets"].get(ft, []))
            cov.append({"field": ft, "jp": jp, "have": have, "min": mn, "rec": rec,
                        "state": ("none" if have == 0 else ("low" if have < rec else "ok"))})
        g["coverage"] = cov

    out = {"customer": cid, "period": f"{start}〜{end}",
           "generated": datetime.date.today().isoformat(),
           "asset_groups": sorted(groups.values(), key=lambda x: -x["cost"])}
    Path(outp).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"P-MAX クリエイティブ取得: customer {cid}  期間 {start}〜{end}")
    for g in out["asset_groups"]:
        na = sum(len(v) for v in g["assets"].values())
        print(f"  [{g['status']}] {g['name']} 強度{g['ad_strength']} ¥{g['cost']:,} CV{g['cv']} "
              f"CPA{('¥'+format(g['cpa'],',')) if g['cpa'] else '—'} / 素材{na}件")
        if g["cost"] > 0 or g["status"] == "ENABLED":
            miss = [c["jp"] for c in g["coverage"] if c["state"] == "none"]
            low = [c["jp"] for c in g["coverage"] if c["state"] == "low"]
            if miss: print(f"     未設定: {', '.join(miss)}")
            if low: print(f"     本数不足: {', '.join(low)}")
    print(f"出力: {outp}")


if __name__ == "__main__":
    main()
