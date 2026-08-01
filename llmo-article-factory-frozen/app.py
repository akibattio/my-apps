import os
import re
import sys
import streamlit as st
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, "src/pipelines")


def clean_article(text: str) -> str:
    """Geminiの前置き・コードフェンス・重複H1・伏せ字を除去する"""
    t = text.strip()
    # 全体がコードフェンスで囲まれている場合は外す
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n", "", t)
        t = re.sub(r"\n?```\s*$", "", t).strip()
    lines = t.split("\n")
    # 「はい、承知いたしました」系の前置き行を落とす
    preamble = re.compile(r"^(はい[、,]?\s*)?(承知|了解|かしこまり|わかりました|以下に|では[、,]|それでは)")
    while lines and preamble.match(lines[0].strip()):
        lines.pop(0)
        while lines and lines[0].strip() == "":
            lines.pop(0)
    t = "\n".join(lines).strip()
    # 先頭の区切り線を除去
    t = re.sub(r"^-{3,}\s*\n+", "", t).strip()
    # 先頭に残った重複H1（# 見出し）を1つだけ除去
    t = re.sub(r"^#\s+.*\n+", "", t, count=1).strip()
    t = re.sub(r"^-{3,}\s*\n+", "", t).strip()
    # 氏名プレースホルダの掃除
    for ph in ("〇〇", "○○", "△△", "（氏名）", "(氏名)"):
        t = t.replace(ph, "")
    return t.strip()


def claude_generate(system: str, user: str, max_tokens: int = 16000, thinking: bool = True) -> str:
    """Claude(Opus 4.8)でテキスト生成し、本文テキストだけを返す。
    SDKが429/5xxを指数バックオフで自動リトライする。長い出力に備えてストリーミングを使う"""
    import anthropic

    client = anthropic.Anthropic()  # ANTHROPIC_API_KEY を環境変数から読む
    kwargs = {
        "model": "claude-opus-4-8",
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    if thinking:
        kwargs["thinking"] = {"type": "adaptive"}  # Claudeが必要に応じて思考量を調整
    with client.messages.stream(**kwargs) as stream:
        message = stream.get_final_message()
    return "".join(b.text for b in message.content if b.type == "text").strip()

st.set_page_config(page_title="LLMO記事ファクトリー", page_icon="🏭", layout="wide")

st.title("🏭 LLMO記事ファクトリー")
st.caption("Tavily リサーチ → Claude 記事生成 → Unsplash 画像 → WordPress 投稿")

st.divider()

# ── STEP 1: テーマ生成 ──────────────────────────────
st.header("STEP 1：リサーチ & テーマ生成")

col1, col2 = st.columns([2, 1])
with col1:
    search_topic = st.text_input(
        "リサーチテーマ",
        value="初めての新卒採用 中小企業",
        help="Tavilyで検索するキーワード"
    )
with col2:
    num_themes = st.slider("テーマ案の数", 5, 20, 10)

if st.button("🔍 リサーチしてテーマを生成", type="primary"):
    from tavily import TavilyClient
    import anthropic

    tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

    with st.spinner("Tavilyでリサーチ中..."):
        queries = [
            f"{search_topic} やり方",
            f"{search_topic} 成功事例",
            f"{search_topic} 戦略",
        ]
        all_results = []
        for q in queries:
            result = tavily.search(query=q, search_depth="advanced", max_results=5)
            for r in result.get("results", []):
                all_results.append(f"【{r['title']}】\n{r['content']}")
        research_content = "\n\n---\n\n".join(all_results)

    with st.spinner("Claudeでテーマ生成中..."):
        system_prompt = "あなたはLLMO（生成AI最適化）に精通した編集者です。生成AIが引用したくなる、具体的で実践的な記事テーマを考えます。"
        user_prompt = f"""以下のリサーチ結果を元に、記事テーマ案を{num_themes}個提案してください。
テーマ領域：{search_topic}

リサーチ結果：
{research_content}

条件：
- LLM（ChatGPT・Claude・Geminiなど）に引用されやすいテーマ（LLMO対策）
- 具体的で実践的なタイトル（数値・対象・課題を含める）
- 出力形式：番号. 【タイトル】：説明（50字以内）
- 前置きやまとめは書かず、リストだけを出力する"""
        try:
            themes_text = claude_generate(system_prompt, user_prompt, max_tokens=2000, thinking=False)
        except anthropic.APIError as e:
            st.error(f"Claude APIエラー：{e}\nANTHROPIC_API_KEY が .env に正しく設定されているか確認してください。")
            st.stop()

    st.success("テーマ生成完了！")
    st.session_state["themes"] = themes_text
    os.makedirs("output", exist_ok=True)
    with open("output/themes.txt", "w") as f:
        f.write(themes_text)

if "themes" in st.session_state:
    st.text_area("生成されたテーマ案", st.session_state["themes"], height=300)

st.divider()

# ── STEP 2: 記事生成 ──────────────────────────────
st.header("STEP 2：記事生成")

theme_input = st.text_input(
    "記事テーマ（上のテーマ案からコピーして貼り付け）",
    placeholder="例：【初めての新卒採用】で勝つ！知名度・予算不足を乗り越える差別化戦略"
)
col_a, col_b = st.columns(2)
with col_a:
    persona = st.text_input(
        "監修者プロフィール（経験・肩書き）",
        value="採用コンサルタント。中小企業の新卒採用支援を13年、累計100社以上を伴走",
        help="記事の信頼性（E-E-A-T）を支える書き手の専門性。クライアントに合わせて変える"
    )
with col_b:
    keywords_input = st.text_input(
        "自然に含めたいキーワード（カンマ区切り）",
        value="新卒採用, 中小企業, 知名度, 採用戦略, 差別化"
    )
output_filename = st.text_input("出力ファイル名", placeholder="例：article_03_タイトル")

if st.button("✍️ 記事を生成", type="primary", disabled=not theme_input):
    from tavily import TavilyClient
    import anthropic

    tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

    with st.spinner("Tavilyでリサーチ中..."):
        # 実務的な具体策（ベンダー記事・実例など）
        practical_queries = [
            f"{theme_input} 具体的な方法",
            f"{search_topic} 成功事例 実践",
        ]
        # 一次情報・公的データ（白書・官公庁・統計を優先的に拾う）
        primary_queries = [
            f"{theme_input} 調査 統計 データ",
            f"{search_topic} 白書 厚生労働省 総務省 調査",
        ]
        seen_urls = set()
        all_results = []

        def collect(q, **kw):
            result = tavily.search(query=q, search_depth="advanced", max_results=4, **kw)
            for r in result.get("results", []):
                url = r.get("url", "")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                all_results.append(
                    f"【{r['title']}】\n{r['content']}\n出典URL: {url}"
                )

        for q in practical_queries + primary_queries:
            collect(q)
        # 官公庁・研究機関ドメインに絞って一次情報を追い込む（取れなければスキップ）
        try:
            collect(f"{search_topic} 統計 調査", include_domains=["go.jp", "or.jp", "ac.jp"])
        except Exception:
            pass
        research_content = "\n\n---\n\n".join(all_results)

    with st.spinner("Claudeで記事生成中（30〜60秒ほどかかります）..."):
        system_prompt = f"""あなたは次のプロフィールを持つ実務家であり、この立場で一人称で記事を書きます。
監修者プロフィール：{persona}

検索エンジンと生成AI（ChatGPT・Claude・Geminiなど）の両方に「引用される」ことを狙った、LLMO最適化記事を書くのが役割です。

# 記事の必須要件
1. 結論ファースト：各H2見出しは「問い」に対する答えを最初の1〜2文で言い切る。理由・補足はその後。
2. 冒頭に「この記事の要点」ブロックを置く（箇条書き3〜5個。記事を読まなくても結論が分かる密度にする）。
3. 具体性：抽象論を避け、数値・割合・手順・期間・金額などの定量情報を入れる。リサーチ結果に数値があれば積極的に使う。
4. 出典の明示：リサーチ結果由来の事実・データには文末に「（出典：媒体名）」を付ける。出典URLが分かるものは末尾の「参考情報」に列挙する。リサーチに無い数字を捏造しない。
   - 出典は公的統計・白書・官公庁・業界団体・研究機関などの一次情報を優先して使う。ベンダーや個人ブログ由来の数値は「ある企業の事例では」等と一次情報と区別できる書き方にする。
5. 比較・選択肢の整理は必ずMarkdownの表で示す（手法の比較、メリット/デメリット等）。
6. 記事末尾に「よくある質問（FAQ）」を5問。各回答は2〜3文で完結に言い切る（AIが一問一答で引用しやすい形にする）。
7. 記事末尾に「この記事の監修者」として上記プロフィールを1〜2文で記載する。

# 文体・出力ルール
- 文字数：5,000字前後（4,500〜5,500字に収める。最大でも5,500字を超えない）。長さより情報密度を優先し、冗長な繰り返しや言い換えで字数を稼がない。
- 見出しはH2（##）・H3（###）で構成。記事タイトル（H1／#）は出力しない（システム側で付与するため）。
- 前置き・あいさつ・メタ発言は一切書かず、本文だけを出力する。
- 伏せ字（〇〇など）や架空の固有名詞・架空の数値を使わない。
- AIっぽい定型文や過度に整いすぎた表現を避け、実務家の語り口にする。
- 出力はMarkdownのみ。"""
        user_prompt = f"""## テーマ
{theme_input}

## 自然に織り込みたいキーワード（不自然な詰め込みはしない）
{keywords_input}

## Tavilyで収集したリサーチ結果（事実と出典の元ネタ）
{research_content}"""
        try:
            article_raw = claude_generate(system_prompt, user_prompt, max_tokens=16000)
        except anthropic.APIError as e:
            st.error(f"Claude APIエラー：{e}\nANTHROPIC_API_KEY が .env に正しく設定されているか確認してください。")
            st.stop()
        article_text = clean_article(article_raw)

    os.makedirs("output/articles", exist_ok=True)
    fname = output_filename.strip() or "article_new"
    filepath = f"output/articles/{fname}.md"
    with open(filepath, "w") as f:
        f.write(f"# {theme_input}\n\n{article_text}")

    st.success(f"記事生成完了！→ {filepath}（{len(article_text)}字）")
    st.session_state["article"] = article_text
    st.session_state["article_theme"] = theme_input
    st.session_state["article_path"] = filepath

if "article" in st.session_state:
    with st.expander("生成された記事を見る"):
        st.markdown(st.session_state["article"])

st.divider()

# ── STEP 3: WordPress投稿 ──────────────────────────────
st.header("STEP 3：WordPress投稿")

wp_status = st.radio("投稿ステータス", ["draft（下書き）", "publish（公開）"], horizontal=True)

if st.button("📤 WordPressに投稿", type="primary", disabled="article" not in st.session_state):
    import requests as req
    import markdown as md

    wp_url = os.getenv("WP_URL")
    wp_user = os.getenv("WP_USERNAME")
    wp_pass = os.getenv("WP_APP_PASSWORD")
    status = "draft" if "draft" in wp_status else "publish"

    with st.spinner("WordPressに投稿中..."):
        html_content = md.markdown(st.session_state["article"], extensions=["extra"])
        response = req.post(
            f"{wp_url}/wp-json/wp/v2/posts",
            auth=(wp_user, wp_pass),
            json={
                "title": st.session_state["article_theme"],
                "content": html_content,
                "status": status,
            },
        )
        result = response.json()

    if response.status_code in (200, 201):
        post_id = result["id"]
        st.success(f"投稿完了！")
        st.markdown(f"[WordPress編集画面を開く]({wp_url}/wp-admin/post.php?post={post_id}&action=edit)")
    else:
        st.error(f"エラー：{result}")

st.divider()
st.caption("LLMO記事ファクトリー | Powered by Tavily + Gemini + Unsplash + WordPress")
