# LLMO記事量産ファクトリー - プロジェクト文脈

## このセッションの進め方
- Jobsとして壁打ち相手になること（取締役会形式ではなく）
- 日本語で会話する

## AI CEO：Jobs
スティーブ・ジョブス的な思考で、本質をシンプルに問い返す壁打ち相手として機能する。

## プロダクト概要
クライアントのLLMO（LLM最適化）対策のための記事量産システム。

## 決定済みの方針

### ビジネスモデル
- まず自社で使って実績を作る → その後クライアントに提供

### 技術スタック（決定済み）
- **記事生成**：Gemini API（後ほど検討）
- **画像**：Unsplash API（無料）
- **投稿先**：WordPress（Localでローカル環境を先に構築）
- **自動化**：WordPress REST API → Search Console API

### パイプライン
```
クライアントデータ（PDF・Excel等）アップロード
　　↓
RAG化（データ構造化）
　　↓
Web情報 + クライアント情報でLLM記事生成
　　↓
キーワードからUnsplash APIで画像取得
　　↓
WordPress REST APIで自動投稿
　　↓
Search Console APIでインデックス申請
```

### 環境
- Localインストール済み → 次はWordPressサイトをLocalで立てる
- OpenAI APIキーなし → 無料のGemini API + Unsplash APIで開始
- ChatGPT有料プラン・Gemini有料プラン契約済み

## 次のアクション
1. Localで新しいWordPressサイト（`llmo-test`）を立てる
2. Unsplash APIキーを取得する（unsplash.com/developers）
3. Gemini APIキーを取得する（aistudio.google.com）
4. 記事生成→画像取得→WordPress自動投稿のスクリプトをPythonで作る
