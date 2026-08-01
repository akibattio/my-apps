import os
import re
import requests
from dotenv import load_dotenv

load_dotenv()

UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")
UNSPLASH_API = "https://api.unsplash.com/search/photos"

ARTICLE_PATH = "output/articles/article_01_知名度ゼロでも勝てる.md"
OUTPUT_PATH = "output/articles/article_01_知名度ゼロでも勝てる_with_images.md"

SECTION_KEYWORDS = {
    "知名度": "job recruitment office",
    "土俵": "chess strategy planning",
    "魅力": "small business people culture",
    "施策": "interview hiring handshake",
    "事例": "startup success growth chart",
    "まとめ": "future career graduation university",
}


def fetch_image_url(keyword: str):
    res = requests.get(
        UNSPLASH_API,
        params={"query": keyword, "per_page": 1, "orientation": "landscape"},
        headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
    )
    data = res.json()
    results = data.get("results", [])
    if results:
        photo = results[0]
        url = photo["urls"]["regular"]
        credit = photo["user"]["name"]
        link = photo["links"]["html"]
        return f"![{keyword}]({url})\n*Photo by [{credit}]({link}) on Unsplash*"
    return None


def insert_images(content: str) -> str:
    lines = content.split("\n")
    output = []

    for line in lines:
        output.append(line)
        if line.startswith("## "):
            heading = line[3:]
            keyword = next(
                (v for k, v in SECTION_KEYWORDS.items() if k in heading),
                "recruitment hiring"
            )
            image_md = fetch_image_url(keyword)
            if image_md:
                output.append("")
                output.append(image_md)
                output.append("")

    return "\n".join(output)


if __name__ == "__main__":
    with open(ARTICLE_PATH, "r") as f:
        content = f.read()

    print("画像を取得して挿入中...\n")
    updated = insert_images(content)

    with open(OUTPUT_PATH, "w") as f:
        f.write(updated)

    print(f"完了 → {OUTPUT_PATH}")
