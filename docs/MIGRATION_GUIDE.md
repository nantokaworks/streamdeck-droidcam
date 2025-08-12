# Stream Deck プラグイン移植ガイド

このドキュメントでは、既存のStream Deckプラグインをhello-worldテンプレートベースで段階的に移植する手順を説明します。

## 目次

- [概要](#概要)
- [フェーズ1: バックアップと準備](#フェーズ1-バックアップと準備)
- [フェーズ2: 基本構造の作成](#フェーズ2-基本構造の作成)
- [フェーズ3: 最小限の動作確認](#フェーズ3-最小限の動作確認)
- [フェーズ4: 段階的な機能移植](#フェーズ4-段階的な機能移植)
- [ビルドシステム](#ビルドシステム)
- [トラブルシューティング](#トラブルシューティング)

## 概要

### なぜ段階的移植が必要か

- 既存のビルドが起動しない問題を解決
- 動作確認しながら安全に移植
- 問題の切り分けが容易
- ロールバック可能な実装

### 移植戦略

1. **バックアップ優先**: 既存実装を完全に保持
2. **最小構成から開始**: hello-worldテンプレートベース
3. **段階的追加**: 1アクションずつ移植・動作確認
4. **継続的検証**: 各段階でビルドと動作を確認

## フェーズ1: バックアップと準備

### 1.1 現在の実装をバックアップ

```bash
# ソースコードのバックアップ
mv src/ src_backup/

# プラグインファイルのバックアップ
mv works.nantoka.droidcam.sdPlugin/ works.nantoka.droidcam.sdPlugin_backup/

# 設定ファイルのバックアップ
cp package.json package.json.backup
cp rollup.config.mjs rollup.config.mjs.backup
cp tsconfig.json tsconfig.json.backup
```

### 1.2 バックアップの確認

```bash
# バックアップが正しく作成されたか確認
ls -la | grep backup
```

## フェーズ2: 基本構造の作成

### 2.1 hello-worldテンプレートの取得

Stream Deck SDKのhello-worldサンプルから必要なファイルをコピー：

```bash
# hello-worldプロジェクトから基本ファイルをコピー
cp hello-world/package.json ./
cp hello-world/rollup.config.mjs ./
cp hello-world/tsconfig.json ./
```

### 2.2 package.json のカスタマイズ

```json
{
  "name": "works.nantoka.droidcam",
  "version": "0.1.0",
  "description": "DroidCam control plugin for Stream Deck",
  "scripts": {
    "prebuild": "node scripts/increment-build.js",
    "build": "rollup -c",
    "watch": "rollup -c -w"
  }
}
```

### 2.3 rollup.config.mjs の調整

```javascript
export default {
  input: "src/plugin.ts",
  output: {
    file: "works.nantoka.droidcam.sdPlugin/bin/plugin.js",
    format: "cjs",
    sourcemap: isWatching
  }
}
```

### 2.4 最小限のソース構造

```
src/
├── plugin.ts              # エントリーポイント
└── actions/
    └── connection-status.ts  # 最初のテストアクション
```

## フェーズ3: 最小限の動作確認

### 3.1 最小限のplugin.ts作成

```typescript
import streamDeck, { LogLevel } from "@elgato/streamdeck";
import { ConnectionStatusAction } from "./actions/connection-status";

streamDeck.logger.setLevel(LogLevel.DEBUG);
streamDeck.actions.registerAction(new ConnectionStatusAction());
streamDeck.connect();
```

### 3.2 テストアクションの実装

```typescript
// actions/connection-status.ts
import { Action, SingletonAction } from "@elgato/streamdeck";

export class ConnectionStatusAction extends SingletonAction<Settings> {
    constructor() {
        super("works.nantoka.droidcam.connection-status");
    }
    
    async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
        const logger = streamDeck.logger.createScope("ConnectionStatus");
        logger.info("Action appeared");
        await ev.action.setTitle("Test");
    }
}
```

### 3.3 manifest.json の作成

```json
{
    "Name": "DroidCam",
    "Version": "0.1.0.1",
    "Author": "nantokaworks",
    "Actions": [
        {
            "Name": "Connection Status",
            "UUID": "works.nantoka.droidcam.connection-status",
            "Icon": "icons/disconnected",
            "Controllers": ["Keypad"],
            "States": [
                {
                    "Image": "icons/disconnected",
                    "TitleAlignment": "middle"
                }
            ]
        }
    ],
    "Category": "DroidCam",
    "CodePath": "bin/plugin.js",
    "Icon": "icons/icon",
    "SDKVersion": 2,
    "Software": {
        "MinimumVersion": "6.5"
    },
    "Nodejs": {
        "Version": "20",
        "Debug": "enabled"
    },
    "UUID": "works.nantoka.droidcam"
}
```

### 3.4 ビルドと動作確認

```bash
# 依存関係のインストール
bun install

# ビルド実行
bun run build

# プラグインファイルの確認
ls -la works.nantoka.droidcam.sdPlugin/bin/plugin.js

# Stream Deckでプラグインをインストール・テスト
```

## フェーズ4: 段階的な機能移植

### 4.1 移植の優先順位

1. **基本アクション**: ConnectionStatus（接続確認）
2. **ボタン系アクション**: 単純なトグル動作
3. **ステータス系**: 情報表示
4. **ダイアル系**: Stream Deck+対応

### 4.2 アクション移植のステップ

#### ステップ1: バックアップから実装をコピー

```typescript
// src_backup/actions/zoom-button.ts から
// src/actions/zoom-button.ts へコピー
```

#### ステップ2: 依存関係の確認

- 必要なサービスクラス（DroidCamAPI等）を移植
- 型定義ファイルを確認
- 定数定義を移動

#### ステップ3: 現在のアーキテクチャに適合

```typescript
// 旧実装
ev.action.sendToPropertyInspector(data);

// 新実装
streamDeck.ui.current?.sendToPropertyInspector(data);
```

#### ステップ4: plugin.ts に登録

```typescript
import { ZoomButtonAction } from "./actions/zoom-button";
streamDeck.actions.registerAction(new ZoomButtonAction());
```

#### ステップ5: manifest.json に追加

```json
{
    "UUID": "works.nantoka.droidcam.zoom-button",
    "Name": "Zoom Button",
    "Icon": "icons/menu-zoom-button",
    "Controllers": ["Keypad"],
    "PropertyInspectorPath": "ui/zoom-button.html"
}
```

### 4.3 Property Inspector の移植

#### HTMLファイルの構造

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
    <script src="./zoom-button.js"></script>
</body>
</html>
```

#### i18n対応の実装

```javascript
// ui/zoom-button.js
window.onload = async () => {
    const form = document.getElementById('property-inspector');
    
    const fields = [
        {
            type: 'number',
            id: 'zoomStep',
            label: await pi.localize('Zoom Step'),
            value: 0.5,
            min: 0.1,
            max: 2.0,
            step: 0.1
        }
    ];
    
    PIComponents.createForm(form, fields);
};
```

## ビルドシステム

### 自動ビルド番号インクリメント

#### scripts/increment-build.js の作成

```javascript
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '../works.nantoka.droidcam.sdPlugin/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// バージョン形式: Major.Minor.Patch.Build
const versionParts = manifest.Version.split('.');
if (versionParts.length === 4) {
    versionParts[3] = (parseInt(versionParts[3]) + 1).toString();
} else {
    versionParts.push('1');
}

manifest.Version = versionParts.join('.');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t'));

console.log(`✅ Version updated to: ${manifest.Version}`);
```

#### package.json への統合

```json
{
  "scripts": {
    "prebuild": "node scripts/increment-build.js",
    "build": "rollup -c"
  }
}
```

### Bunパッケージマネージャーの使用

```bash
# npmの代わりにbunを使用
bun add @elgato/streamdeck

# ビルド実行
bun run build

# 開発モード（ウォッチ）
bun run watch
```

## トラブルシューティング

### TypeScriptエラーの対処

#### undefined可能性の処理

```typescript
// Null合体演算子を使用
const port = settings?.port ?? 4747;

// オプショナルチェイニング
streamDeck.ui.current?.sendToPropertyInspector(data);
```

#### 型定義の追加

```typescript
interface DroidCamSettings {
    ipAddress?: string;
    port?: number;
    checkInterval?: number;
}
```

### ビルドエラーの対処

#### import.meta.url の問題

```typescript
// ❌ 問題のあるコード
import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(import.meta.url);

// ✅ 解決策: 不要な場合は削除
// Stream Deck SDKは相対パスを自動解決
```

#### モジュール解決の問題

```javascript
// rollup.config.mjs
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    plugins: [
        resolve({
            preferBuiltins: true,
            browser: false
        }),
        commonjs()
    ]
};
```

### 実行時エラーの対処

#### プラグインが起動しない

1. manifest.json の UUID を確認
2. CodePath が正しいか確認
3. Nodejs.Version が正しいか確認
4. デバッグログを有効化

```json
{
    "Nodejs": {
        "Version": "20",
        "Debug": "enabled"
    }
}
```

#### アクションが表示されない

1. アクションのUUIDがユニークか確認
2. Controllersが正しく設定されているか確認
3. アイコンファイルが存在するか確認

### デバッグ方法

#### ログの確認

```typescript
// ログレベルを設定
streamDeck.logger.setLevel(LogLevel.DEBUG);

// Scoped Loggerで詳細ログ
const logger = streamDeck.logger.createScope("Debug");
logger.debug("Settings:", settings);
logger.info("Action initialized");
logger.error("Connection failed:", error);
```

#### Stream Deckでのリロード

1. Stream Deckアプリを開く
2. 設定 → プラグイン
3. 該当プラグインの「...」メニュー → リロード

#### Developer Mode

Stream Deck アプリで Developer Mode を有効化：
- macOS: `~/Library/Application Support/com.elgato.StreamDeck/`
- Windows: `%appdata%\Elgato\StreamDeck\`

## ベストプラクティス

### 移植時のチェックリスト

- [ ] バックアップを作成
- [ ] 最小構成で動作確認
- [ ] 1アクションずつ移植
- [ ] 各段階でビルド確認
- [ ] Property Inspector の動作確認
- [ ] i18n対応の確認
- [ ] エラーハンドリングの実装
- [ ] リソースのクリーンアップ

### コード品質

- Scoped Logger を使用
- try-catch でエラーハンドリング
- リソースの適切な解放
- TypeScript の型を活用

### パフォーマンス

- ポーリング間隔の最適化
- 不要な再描画を避ける
- SingletonAction でインスタンス管理