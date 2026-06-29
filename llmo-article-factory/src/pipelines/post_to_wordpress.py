import os
import re
import requests
from dotenv import load_dotenv

load_dotenv()

WP_URL = os.getenv("WP_URL")
WP_USERNAME = os.getenv("WP_USERNAME")
WP_APP_PASSWORD = os.getenv("WP_APP_PASSWORD")

ARTICLE_PATH = "output/articles/article_01_知名度ゼロでも勝てる_with_images.md"


def md_to_html(text: str) -> str:
    import markdown
    return markdown.markdown(text, extensions=["extra"])


def extract_title(content: str) -> str:
    for line in content.split("\n"):
        if line.startswith("# "):
            return line[2:].strip()
    return "新卒採用記事"


def post_article(title: str, html_content: str) -> dict:
    endpoint = f"{WP_URL}/wp-json/wp/v2/posts"
    response = requests.post(
        endpoint,
        auth=(WP_USERNAME, WP_APP_PASSWORD),
        json={
            "title": title,
            "content": html_content,
            "status": "draft",
        },
    )
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    with open(ARTICLE_PATH, "r") as f:
        content = f.read()

    title = extract_title(content)
    html_content = md_to_html(content)

    print(f"投稿中：{title}\n")
    result = post_article(title, html_content)

    print(f"完了。下書き保存されました。")
    print(f"投稿ID : {result['id']}")
    print(f"編集URL: {WP_URL}/wp-admin/post.php?post={result['id']}&action=edit")
