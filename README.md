# 部屋レイアウト [Beta]

ブラウザ上で部屋のレイアウトを直感的にシミュレートできる 2D Web アプリです。  
サーバー不要・バックエンドなし。LocalStorage に保存するため、インストール不要でそのまま使えます。

🔗 **[デモを開く](https://torifo.github.io/room-design/)**

---

## できること

- **部屋のベース設定** — 部屋名・縦横サイズ（cm単位）を入力すると、実寸比率で床が Canvas に描画される
- **家具の配置** — 本棚・つくえ・折りたたみ机・テレビ台・クッション・Yogibo を追加可能
- **ドラッグ＆ドロップ移動** — 家具をそのまま引っ張って位置を調整
- **リサイズ・回転** — Transformer（バウンディングボックス）で直感的に操作
- **削除** — 選択した家具を削除ボタン or Delete キーで削除
- **自動保存** — 配置状態を LocalStorage に保存（リロードしても復元）

### 追加予定（Coming Soon）

- 3D ビュー
- 複数部屋の結合
- 家具の素材・デザイン変更

---

## 技術スタック

| カテゴリ | ライブラリ / ツール |
|---|---|
| UI フレームワーク | React 18 |
| 言語 | TypeScript 5 |
| Canvas レンダリング | Konva / react-konva |
| スタイリング | Tailwind CSS 3 |
| アイコン | Lucide React |
| ビルドツール | Vite 6 |
| データ永続化 | LocalStorage（サーバーレス） |
| デプロイ | GitHub Pages（GitHub Actions 自動デプロイ） |

---

## ローカル開発

### 必要環境

- Node.js 18 以上
- npm

### セットアップ

```bash
git clone https://github.com/torifo/room-design.git
cd room-design
npm install
npm run dev
```

`http://localhost:5173` で起動します。

### スクリプト一覧

```bash
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド（dist/ に出力）
npm run preview  # ビルド結果のローカルプレビュー
```

---

## デプロイ

`main` ブランチへのプッシュで **GitHub Actions が自動的に GitHub Pages へデプロイ**します。  
手動デプロイは不要です。

```
vite.config.ts の base 設定:
  GITHUB_ACTIONS 環境では "/room-design/" を使用
  ローカルでは "/" を使用
```

---

## ディレクトリ構成

```
room-design/
├── .github/
│   └── workflows/       # GitHub Actions（自動デプロイ）
├── docs/                # ドキュメント・仕様書
├── src/                 # ソースコード（React + TypeScript）
├── index.html           # エントリポイント
├── vite.config.ts       # Vite 設定（GitHub Pages base パス対応）
├── tailwind.config.js   # Tailwind CSS 設定
├── tsconfig.json        # TypeScript 設定
└── package.json
```

---

## 設計方針

- **操作性最優先** — PC / スマホ両対応、触っていて気持ちいい UX を重視
- **サーバーレス完結** — バックエンド・DB なし。LocalStorage のみで完結
- **MVP ファースト** — まず動くものを公開し、手応えを確認しながら段階的に拡張
