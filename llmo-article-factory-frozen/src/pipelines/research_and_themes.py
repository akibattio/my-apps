import os
from dotenv import load_dotenv
from tavily import TavilyClient
from google import genai
from google.genai import types

load_dotenv()

tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SEARCH_QUERIES = [
    "初めての新卒採用 中小企業 やり方",
    "新卒採用 一人目 採用基準 選び方",
    "新卒採用 知名度なし 中小企業 成功",
]


def research(queries: list) -> str:
    all_results = []
    for query in queries:
        print(f"検索中: {query}")
        result = tavily.search(
            query=query,
            search_depth="advanced",
            max_results=5,
            include_raw_content=False,
        )
        for r in result.get("results", []):
            all_results.append(f"【{r['title']}】\n{r['content']}\nURL: {r['url']}")

    return "\n\n---\n\n".join(all_results)


def generate_themes(research_content: str) -> str:
    prompt = f"""
以下はTavilyで収集した「初めての新卒採用」に関するWebリサーチ結果です。

{research_content}

---

このリサーチを元に、採用担当者・経営者が「初めての新卒採用」で悩むポイントを網羅した
**記事テーマ案を10個**提案してください。

条件：
- ChatGPT・Claudeなどに質問されやすいテーマ（LLMO対策）
- 具体的で実践的なタイトル形式
- 「初めての新卒採用」「一人目の採用」に特化した内容
- 実際に検索されているキーワードを意識する

出力形式：
1. 【タイトル】：説明（50字以内）
"""
    response = gemini.models.generate_content(
        model="models/gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.7),
    )
    return response.text


if __name__ == "__main__":
    print("Tavilyでリサーチ中...\n")
    research_content = research(SEARCH_QUERIES)

    print("\nGeminiでテーマ生成中...\n")
    themes = generate_themes(research_content)

    print("=" * 50)
    print("■ 記事テーマ案")
    print("=" * 50)
    print(themes)

    os.makedirs("output", exist_ok=True)
    with open("output/themes.txt", "w") as f:
        f.write(themes)
    print("\n→ output/themes.txt に保存しました")
