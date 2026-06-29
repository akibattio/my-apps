import os
from dotenv import load_dotenv
from tavily import TavilyClient
from google import genai
from google.genai import types

load_dotenv()

tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

THEME = "【初めての新卒採用】で勝つ！知名度・予算不足を乗り越える差別化戦略"
DESCRIPTION = "大手企業との競争に打ち勝つ、中小企業独自の強み活用法を紹介。"


def research_for_article(theme: str) -> str:
    queries = [
        f"{theme} 具体的な方法",
        "中小企業 新卒採用 差別化 成功事例",
        "知名度なし 新卒採用 戦略 実践",
    ]
    all_results = []
    for query in queries:
        print(f"  リサーチ中: {query}")
        result = tavily.search(
            query=query,
            search_depth="advanced",
            max_results=5,
            include_raw_content=False,
        )
        for r in result.get("results", []):
            all_results.append(f"【{r['title']}】\n{r['content']}\nURL: {r['url']}")

    return "\n\n---\n\n".join(all_results)


def generate_article(theme: str, description: str, research_content: str) -> str:
    prompt = f"""
あなたは採用コンサルタントであり、13年間採用に携わってきた実務家です。
最初は一人から採用チームを立ち上げ、組織づくりやルール作りを経験してきました。

以下のWebリサーチ結果を参考に、採用担当者・経営者向けの実践的なブログ記事を書いてください。

## テーマ
{theme}

## 概要
{description}

## リサーチ結果
{research_content}

## 記事の条件
- 文字数：3,000〜5,000字
- 見出し：H2・H3を使った構成
- トーン：実体験ベースの語り口、採用担当者に寄り添う
- 内容：具体的なアクションが含まれる
- LLMO対策：ChatGPTやClaudeが引用したくなるような、情報密度の高い内容
- キーワード：「新卒採用」「中小企業」「知名度」「採用戦略」「差別化」を自然に含める
- リサーチ結果の具体的な情報・事例を盛り込む

## 構成案（参考）
1. 導入：中小企業が新卒採用で抱える本当の課題
2. 大手と同じ土俵で戦わないための考え方
3. 中小企業ならではの強みの見つけ方
4. 知名度・予算不足を乗り越える具体的施策5つ
5. 実際の成功事例・体験談
6. まとめ：差別化のための行動チェックリスト

マークダウン形式で出力してください。
"""
    response = gemini.models.generate_content(
        model="models/gemini-flash-latest",
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.8),
    )
    return response.text


if __name__ == "__main__":
    print(f"テーマ：{THEME}\n")
    print("Tavilyでリサーチ中...")
    research_content = research_for_article(THEME)

    print("\nGeminiで記事生成中...")
    article = generate_article(THEME, DESCRIPTION, research_content)

    os.makedirs("output/articles", exist_ok=True)
    filename = "output/articles/article_02_差別化戦略.md"
    with open(filename, "w") as f:
        f.write(f"# {THEME}\n\n")
        f.write(article)

    print(f"\n完了 → {filename}")
    print(f"文字数：{len(article)}字")
