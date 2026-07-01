# Banner Creator — OpenAI × Gemini Nano Banana

Instagram / Web 広告バナーをハイブリッド (AI背景 + JSON テンプレート) で自動生成するデスクトップアプリ。

- 背景画像は **OpenAI (`gpt-image-1`)** と **Gemini Nano Banana (`gemini-2.5-flash-image`, Vertex AI)** から **同時生成して並べて比較**、好きな方を採用
- テンプレートは JSON で記述 (テキスト/矩形/画像レイヤー、変数置換)
- 1 セットの素材を **全テンプレートサイズに一括書き出し**
- 含まれるサイズ: Instagram Story (1080×1920), Display 300×250 / 728×90 / 160×600

## セットアップ

### 1. 依存をインストール
```bash
cd banner_create_automation
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e .
```

### 2. `.env` を作成
`.env.example` をコピーして埋める:
```bash
cp .env.example .env
```

- `OPENAI_API_KEY`: OpenAI API キー
- `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION`: Vertex AI 用 (例 `us-central1`)
- Vertex AI 認証は ADC を推奨:
  ```bash
  gcloud auth application-default login
  ```

### 3. (推奨) 日本語フォントを配置
`assets/fonts/` に Noto Sans JP の `Regular`/`Bold` を置くと日本語が綺麗に出ます。
ない場合は macOS のヒラギノにフォールバックします。

ダウンロード例:
```bash
cd assets/fonts
curl -L -o NotoSansJP-Regular.ttf https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansJP-Regular.otf
curl -L -o NotoSansJP-Bold.ttf    https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansJP-Bold.otf
```

### 4. 起動
```bash
banner-app
# または
python -m banner_app.main
```

## 使い方

1. 左ペインで **テンプレートを選択**
2. **変数フォーム**にコピー (見出し、CTA、AIプロンプト等) を入力
3. **「AI背景を両方同時生成」** をクリック → 右ペインに OpenAI / Gemini の候補が並ぶ
4. 気に入った方の **「これを使う」** を押すとバナーに合成
5. **「このサイズで保存」** で 1 枚出力、**「全テンプレートで一括書き出し」** で全サイズ展開

## テンプレートを追加する

`templates/` に JSON を置くだけで自動的に GUI に出現します。

```json
{
  "name": "My Banner",
  "size": {"width": 1200, "height": 628},
  "background": {
    "type": "ai",
    "prompt": "{ai_prompt}, advertising photography"
  },
  "variables": ["ai_prompt", "headline", "cta"],
  "layers": [
    {"type": "rect", "xy": [0, 400, 1200, 628], "fill": [0, 0, 0, 180]},
    {"type": "text", "content": "{headline}",
     "xy": [40, 430], "max_width": 1120,
     "font_size": 60, "weight": "bold", "color": [255, 255, 255]},
    {"type": "text", "content": "{cta}",
     "xy": [40, 560], "font_size": 36, "color": [255, 200, 0]}
  ]
}
```

### レイヤー仕様
| type    | 主なフィールド |
|---------|----------------|
| `text`  | `content`, `xy`, `font_size`, `weight`, `color`, `align`, `max_width`, `line_spacing`, `stroke_width`, `stroke_color` |
| `rect`  | `xy` (x0,y0,x1,y1), `fill` (RGBA), `radius` |
| `image` | `path`, `xy`, `size` |

`background.type` は `"ai"` | `"color"` | `"image"`。
`{var}` 構文で `variables` に宣言したキーを各テキスト/プロンプトに埋め込めます。

## ディレクトリ
```
banner_create_automation/
├── src/banner_app/        # アプリ本体
│   ├── core/              # template / renderer / ai_client / exporter
│   └── gui/               # PySide6 ウィンドウ
├── templates/             # JSONテンプレート
├── assets/fonts/          # 日本語フォントを置く
├── output/                # 生成PNG (gitignore)
└── pyproject.toml
```

## 注意
- AI画像生成は API 課金が発生します。
- `gpt-image-1` / `gemini-2.5-flash-image` の利用にはそれぞれのサービスでの有効化が必要です。
- Vertex AI 利用には対象リージョンでの API 有効化と請求設定が必要です。
