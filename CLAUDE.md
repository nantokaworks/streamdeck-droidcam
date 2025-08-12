# CLAUDE.md

このファイルはプロジェクトのAIアシスタント用の重要な指示書です。

## 原則

- チャットは日本語で行う
  - 語尾は以下のような感じで ダス を使う
  - 〜です > 〜ダス
  − 〜ですか > 〜ダスか
  - 〜ですね > 〜ダスね
- あなたは指示がない限り自動でコミットをしない
- **パッケージマネージャーはBunを使用** (npmではなく`bun add`を使う)

## ビルド時の自動バージョン管理

- **`bun run build` 実行時に manifest.json のビルド番号が自動的にインクリメントされます**
  - バージョン形式: `Major.Minor.Patch.Build` (例: 0.1.0.3)
  - scripts/increment-build.js が prebuild フックで自動実行
  - 手動でのバージョン番号変更は不要
  - ビルドごとに最後の数字（ビルド番号）が +1 される

## Gitコミットルール

- **🚨 絶対厳守**: コミットは私が指示します、自動で行わないでください
- **コミットメッセージフォーマット**:
  - 必ず絵文字プレフィックスを付ける
  - 形式: `絵文字 scope: 説明`
  - 例: `✨ labo: 新機能追加`

**主要な絵文字プレフィックス:**

- `✨` 新機能
- `🐛` バグ修正
- `📝` ドキュメント
- `♻️` リファクタリング
- `🎨` コードスタイル、フォーマット

詳細な絵文字プレフィックスは [コーディング規約](docs/CODING_STANDARDS.md#gitコミットルール) を参照

- **Claude Code自動生成メッセージは不要**: `🤖 Generated with [Claude Code]` や `Co-Authored-By: Claude` 等の自動生成メッセージは追加しない

## Stream Deck SDK ログ出力ルール

### 基本原則
- 各コンポーネント/アクションでは必ず scoped logger インスタンスを作成して使用
- グローバルな初期化やエラーハンドリング以外では scoped logger を使用
- スコープ名は自由に設定可能（例: Plugin, ZoomButton, ConnectionStatus など）

### 正しい使用方法
```typescript
// コンポーネント/アクション内で scoped logger を作成
const logger = streamDeck.logger.createScope("ComponentName");
logger.info("ログメッセージ");      // 出力: "ComponentName: ログメッセージ"
logger.debug("デバッグ情報");
logger.error("エラー情報");
```

### 避けるべき使用方法
```typescript
// 直接 streamDeck.logger を使うとプレフィックスが付かない
streamDeck.logger.info("メッセージ");  // 出力: "メッセージ" (プレフィックスなし)
```

### 例外ケース（直接使用OK）
- プロセスレベルのエラーハンドラー（uncaughtException, unhandledRejection）
- Stream Deck接続前の真にグローバルな初期化ログ
