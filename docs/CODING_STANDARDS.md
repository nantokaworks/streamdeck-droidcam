# 命名規則とコード規約

photo-sta-nex プロジェクトの命名規則とコーディング規約です。

## Go

### ファイル・ディレクトリ命名

- **ファイル**: snake_case（例: `auth_service.go`）
- **ディレクトリ**: snake_case（例: `internal/tower/`）
- **テストファイル**: `*_test.go`

### コーディング規約

- 全DB操作にSQLCを使用
- Connect RPC（双方向通信は使用せず、Server StreamingとUnaryで実現）
- **定数**: SCREAMING_SNAKE_CASE（例: `MAX_RETRY_COUNT`）

## TypeScript

### ファイル・ディレクトリ命名

- **コンポーネント**: kebab-case（例: `user-nav.tsx`）
- **型定義/スキーマ**: PascalCase（例: `AuthCodeCheckSchema.ts`）
- **ユーティリティ**: camelCase（例: `getPathname.ts`）
- **フック**: camelCase（例: `useHost.ts`）
- **ディレクトリ**: kebab-case（例: `auth-layout/`）
- **インデックスファイル**: `index.ts` / `index.tsx`

### コーディング規約

- Reactインポート: `React.useState`パターン、細かくインポートしない
- **Tower SPA**: React Router v7 使用、`routes/`ディレクトリ構成
- **Remix アプリ**: ファイルベースルーティング使用
- **定数**: SCREAMING_SNAKE_CASE（例: `API_BASE_URL`）

### React コンポーネント

- **コンポーネント名**: PascalCase（例: `UserNav`）
- **Props型**: `${ComponentName}Props`（例: `UserNavProps`）

### Jotai 状態管理

- **Atom命名**: `${page}${Feature}Atom`（例: `dashboardSalesFilterAtom`）
- **ストレージキー**: `${page}.${feature}.${state}`（例: `dashboard.sales-summary.filter-month`）

## Stream Deck Plugin

### ファイル・ディレクトリ命名

- **アクションファイル**: kebab-case（例: `connection-status.ts`、`zoom-button.ts`）
- **アクションクラス**: PascalCase + `Action` suffix（例: `ConnectionStatusAction`、`ZoomButtonAction`）
- **アイコンファイル**: kebab-case（例: `led-on.svg`、`battery-charging.svg`）
- **Property Inspector HTML**: アクション名と同じkebab-case（例: `connection-status.html`）
- **Property Inspector JS**: 同じく kebab-case（例: `connection-status.js`）

### UUID命名規則

- **プラグインUUID**: `works.nantoka.droidcam`
- **アクションUUID**: `works.nantoka.droidcam.${action-name}`
- **例**: 
  - `works.nantoka.droidcam.connection-status`
  - `works.nantoka.droidcam.zoom-button`
  - `works.nantoka.droidcam.battery-status`

### アイコンファイルの構成

```
works.nantoka.droidcam.sdPlugin/
└── icons/
    ├── icon.svg              # プラグインアイコン
    ├── icon.png              # プラグインアイコン（PNG版）
    ├── icon@2x.png           # 高解像度プラグインアイコン
    ├── category-icon.svg     # カテゴリアイコン
    ├── menu-*.svg            # メニュー表示用（例: menu-zoom-button.svg）
    ├── connected.svg         # 接続状態アイコン
    ├── disconnected.svg      # 切断状態アイコン
    └── 状態別アイコン/
        ├── led-on.svg
        ├── led-off.svg
        ├── mic-on.svg
        ├── mic-off.svg
        ├── battery-*.svg
        └── zoom-*.svg
```

### Logger実装規則

- **必須**: 各アクションで Scoped Logger を使用
- **禁止**: グローバル `streamDeck.logger` の直接使用
- **命名**: アクション名をスコープ名に使用

```typescript
// ✅ 正しい実装
const logger = streamDeck.logger.createScope("ZoomButton");
logger.info("Zoom level changed");

// ❌ 間違った実装
streamDeck.logger.info("Zoom level changed");
```

### manifest.json 構造規則

```json
{
  "Actions": [
    {
      "UUID": "works.nantoka.droidcam.action-name",
      "Name": "Action Display Name",
      "Icon": "icons/menu-action-name",
      "Tooltip": "Action description",
      "Controllers": ["Keypad"],  // または ["Encoder"] for ダイアル
      "PropertyInspectorPath": "ui/action-name.html",
      "States": [/* アクションの状態定義 */]
    }
  ]
}
```

### Property Inspector 構造

#### HTMLファイル構造
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="./inspector.css">
    <script src="./pi-common.js"></script>
    <script src="./i18n.js"></script>
    <script src="./pi-components.js"></script>
</head>
<body>
    <div id="property-inspector"></div>
    <script src="./action-name.js"></script>
</body>
</html>
```

#### JavaScript実装規則
- **必須**: PIComponents を使用した動的UI生成
- **必須**: i18n対応（`pi.localize()` 使用）
- **推奨**: `pi.testConnection()` 共通関数の使用

### コーディング規約

- **SingletonAction**: 複数インスタンス間で状態共有が必要な場合に使用
- **Action**: 独立したインスタンスの場合に使用
- **エラーハンドリング**: 全アクションで try-catch を必須実装
- **リソース管理**: `onWillDisappear` でタイマーやWebSocket等をクリーンアップ

### ダイアル（Encoder）実装規則

- **インジケーター値**: 0-100の範囲（0-1ではない）
- **必須呼び出し**: `setImage()` をEncoder/Keypad両方で実行
- **レイアウト**: manifest.jsonで `$B1` を設定
- **共通関数**: フィードバック更新処理を共通化

```typescript
// インジケーター実装例
const normalizedValue = ((current - min) / (max - min)) * 100;
await ev.action.setFeedback({
    indicator: {
        value: Math.round(normalizedValue),
        enabled: true,
        opacity: 1
    }
});
```

## データベース

- **テーブル**: 単数形snake_case（例: `labo`, `team`）
- **カラム**: snake_case（例: `created_at`, `ref_id`）
- **外部キー**: `${table}_id`（例: `labo_id`）

## Protocol Buffers

- **メッセージ**: PascalCase（例: `GetLaboRequest`）
- **フィールド**: snake_case（例: `ref_id`, `display_name`）
- **Enum値**: SCREAMING_SNAKE_CASE（例: `AUTH_STATE_LOGGED_IN`）

## ID管理の重要なルール

### 🚨 絶対厳守: ID vs RefID の使い分け

- **ID（内部ID）**:
  - データベースの主キー（数値型、連番）
  - **フロントエンドには絶対に露出しない**
  - バックエンド内部の処理でのみ使用
  - APIレスポンスに含めてはいけない
  - セキュリティ上の理由：推測可能、総件数が露出

- **RefID（参照ID）**:
  - 公開用の一意識別子（文字列型、nanoid、例: `cRE9c8jzAi7PPszgqvo7A`）
  - **フロントエンドで使用する唯一のID**
  - URLパラメータ、APIリクエスト/レスポンスで使用
  - ユーザーに表示可能
  - セキュリティ上安全：推測不可能

### 各層での命名規則

- **Database**: snake_case（`ref_id`, `labo_ref_id`）
- **Go**: PascalCase（`RefID`, `LaboRefID`）
- **TypeScript/API**: camelCase（`refId`, `laboRefId`）
- **URL/パラメータ**: kebab-case（`ref-id`, `labo-ref-id`）

### 実装時の注意点

1. **APIレスポンス**: プロトコルバッファのメッセージに`id`フィールドがあっても、**絶対に内部IDを設定しない**
2. **フロントエンド**: 常に`refId`を使用し、`id`フィールドは無視する
3. **バックエンド**: 内部処理では`id`を使用し、外部通信では`refId`に変換する

## name と displayName の使い分け

多くのエンティティ（特にLabo、Team、Product等）では2種類の名前フィールドを持つ：

- **name**: 
  - **英語名**（半角英数字、ハイフン、アンダースコアのみ）
  - **URLやシステム内部で使用**
  - **一意性が必要な場合が多い**
  - 例: `photo-studio-tokyo`, `team-admin`, `l-size-print`

- **displayName** (display_name):
  - **表示名**（日本語・記号・スペース可）
  - **UIやメール、ユーザー向け表示で使用**
  - **見た目の良い名前**
  - 例: `フォトスタジオ東京`, `管理チーム`, `Lサイズプリント`

**使用例**:
```go
// Goでの使用例
labo.Name        // "photo-studio-tokyo" → URLパス等で使用
labo.DisplayName // "フォトスタジオ東京" → UI表示で使用
```

**注意**: コード実装時は用途に応じて適切なフィールドを選択すること。
- URL生成、システム内部参照 → `name`
- ユーザー向け表示、メール本文 → `displayName`

## コード生成のルール

### 1. 常識的なコード分割

- 機能ごとに適切にコードを分割してください。
  - 例：ユーティリティ関数、バリデーション、ビジネスロジック、データアクセス処理など
- 単一責任の原則（Single Responsibility Principle）を守り、1ファイル1機能が基本です。
- 過度な汎用化や抽象化よりも、可読性・保守性を優先してください。
- 使用するフレームワークや言語における一般的な構成（ベストプラクティス）に従ってください。
  - TypeScript/React: `components/`, `hooks/`, `utils/`, `features/` など
  - Go: `cmd/`, `internal/`, `pkg/`, `model/`, `handler/` など

### 2. テストコードの作成と実行

- 生成したすべての関数・モジュールに対して対応するユニットテストコードを作成してください。
- テストフレームワークは、使用言語やプロジェクトに応じて一般的なものを選択してください。
  - TypeScript → Jest, Vitest
  - Go → `testing` パッケージ
- 作成したテストは自動で実行し、結果を確認してください。
- テストが失敗した場合は原因を特定し、必要に応じて修正案を提示した上で再実行してください。
- 例外ケースやエラー時の挙動を含め、最低限のカバレッジは確保してください。

### 3. その他

- DRYよりも読みやすさを優先し、初見でも理解しやすいコード構成にしてください。
- 将来的な保守・拡張を考慮して、適度な分割とテスト設計を心がけてください。

## コード修正後のフォーマット・Lint実行

- **🚨 絶対厳守**: TypeScript/JavaScriptコードを修正した後は必ず以下の順序でフォーマットとLint修正を実行
  1. `bunx prettier --write .` または `bunx prettier --write [ファイルパス]` - コードフォーマット
  2. `bun lint:fix` または `bun eslint [ファイルパス] --fix` - ESLint自動修正
- **理由**: 一貫したコードスタイルを保つため、Linterエラーを防ぐため
- **タイミング**: 
  - コード修正直後（コミット前）
  - 型エラー修正後
  - インポート追加・削除後
- **ESLint修正内容**:
  - Import文の順序整理（perfectionist/sort-imports）
  - オブジェクトプロパティのアルファベット順ソート（perfectionist/sort-objects）
  - 未使用変数・import の削除
  - TypeScript型エラーの修正
- **実行例**:
  ```bash
  # 単一ファイル
  bunx prettier --write src/hooks/use-auth.ts
  bun eslint src/hooks/use-auth.ts --fix
  
  # ディレクトリ全体
  bunx prettier --write .
  bun lint:fix
  ```

## Gitコミットルール

- **🚨 絶対厳守**: コミットは私が指示します、自動で行わないでください。
- **コミットメッセージフォーマット**:
  - 必ず絵文字プレフィックスを付ける
  - 形式: `絵文字 type(scope): 説明`
  - 例: `✨ feat(labo): 新機能追加`

**Gitコミットプレフィックス絵文字:**
- `✨` feat: 新機能
- `🐛` fix: バグ修正
- `📝` docs: ドキュメント
- `🎨` style: コードスタイル、フォーマット
- `♻️` refactor: リファクタリング
- `⚡` perf: パフォーマンス改善
- `✅` test: テスト追加・修正
- `🚀` deploy: デプロイ関連
- `🔧` chore: ビルド、補助ツール
- `🔀` merge: マージ
- `⏪` revert: リバート
- `🚧` wip: 作業中