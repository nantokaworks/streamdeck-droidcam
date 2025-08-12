# Stream Deck プラグイン開発ガイド

このドキュメントは、Stream Deck プラグイン開発における技術的なノウハウと実装パターンをまとめたものです。

## 目次

- [Logger実装](#logger実装)
- [Property Inspector (PI)](#property-inspector-pi)
- [Stream Deck+ ダイアル（Encoder）対応](#stream-deck-ダイアルencoder対応)
- [SingletonActionパターン](#singletonactionパターン)
- [アイコン管理](#アイコン管理)
- [Stream Deck SDK API](#stream-deck-sdk-api)
- [エラーハンドリング](#エラーハンドリング)

## Logger実装

### Scoped Logger の使用（推奨）

各コンポーネント/アクションでは必ず scoped logger インスタンスを作成して使用します。

```typescript
// ✅ 正しい実装
const logger = streamDeck.logger.createScope("ComponentName");
logger.info("ログメッセージ");      // 出力: "ComponentName: ログメッセージ"
logger.debug("デバッグ情報");
logger.error("エラー情報");
```

### グローバル Logger を避ける理由

```typescript
// ❌ 避けるべき実装
streamDeck.logger.info("メッセージ");  // 出力: "メッセージ" (プレフィックスなし)
```

グローバル logger を直接使用すると、ログの発生源が特定できなくなり、デバッグが困難になります。

### 例外ケース

以下の場合のみ、グローバル logger の直接使用が許可されます：
- プロセスレベルのエラーハンドラー（uncaughtException, unhandledRejection）
- Stream Deck接続前の真にグローバルな初期化ログ

## Property Inspector (PI)

### i18n対応の実装

Property Inspector では国際化対応を最初から実装します。

#### 必要なファイルの読み込み

```html
<!-- Property Inspector HTML -->
<script src="./pi-common.js"></script>
<script src="./i18n.js"></script>
<script src="./pi-components.js"></script>
```

#### PIComponents を使用した動的UI生成

```javascript
// Property Inspector JavaScript
window.onload = async () => {
    const form = document.getElementById('property-inspector');
    
    // PIComponents を使用してUIを動的生成
    const fields = [
        {
            type: 'text',
            id: 'ipAddress',
            label: await pi.localize('IP Address'),
            placeholder: '192.168.1.100',
            pattern: '^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$',
            required: true
        },
        {
            type: 'number',
            id: 'port',
            label: await pi.localize('Port'),
            value: 4747,
            min: 1,
            max: 65535
        }
    ];
    
    PIComponents.createForm(form, fields);
};
```

### 接続テストの実装

共通関数 `pi.testConnection()` を使用します：

```javascript
// ✅ 推奨実装
async function testConnection() {
    const result = await pi.testConnection();
    if (result.success) {
        console.log(`Connected to: ${result.deviceName}`);
    }
}

// ❌ 避けるべき実装（独自のfetch実装）
async function testConnection() {
    const response = await fetch(`http://${ipAddress}:${port}/v1/phone/name`);
    // ...
}
```

## Stream Deck+ ダイアル（Encoder）対応

### $B1レイアウトのインジケーター実装

インジケーター値は **0-100の範囲** で送信する必要があります（0-1ではない）。

```typescript
// ✅ 正しい実装
private async updateIndicator(currentValue: number, minValue: number, maxValue: number) {
    const normalizedValue = ((currentValue - minValue) / (maxValue - minValue)) * 100;
    
    await this.setFeedback({
        indicator: {
            value: Math.round(normalizedValue),
            enabled: true,
            opacity: 1
        }
    });
}

// ❌ 間違った実装（0-1の範囲）
await this.setFeedback({
    indicator: {
        value: (currentValue - minValue) / (maxValue - minValue)  // 0-1の値
    }
});
```

### タイトル表示の重要な注意点

#### setImage() の必須呼び出し

Encoder と Keypad の両方で `setImage()` を必ず呼び出す必要があります：

```typescript
async onWillAppear(ev: WillAppearEvent<ZoomControlSettings>): Promise<void> {
    // アイコンを設定（これがないとタイトルが表示されない場合がある）
    await ev.action.setImage('icons/zoom-control');
    
    // タイトルを設定
    await ev.action.setTitle(`${currentZoom.toFixed(1)}x`);
}
```

#### setFeedbackLayout() について

manifest.json で layout が設定済みの場合、`setFeedbackLayout()` は不要です：

```json
// manifest.json
"Encoder": {
    "layout": "$B1",  // ← ここで設定済み
    "Icon": "icons/zoom-control"
}
```

### 共通フィードバック関数の実装

重複を避けるため、共通関数として実装することを推奨：

```typescript
private async updateFeedback(ev: Action): Promise<void> {
    const zoom = await this.getCurrentZoom();
    const { minZoom, maxZoom } = await this.getZoomLimits();
    
    // 共通のフィードバック更新処理
    await ev.setTitle(`${zoom.toFixed(1)}x`);
    await ev.setImage('icons/zoom-control');
    await ev.setFeedback({
        indicator: {
            value: ((zoom - minZoom) / (maxZoom - minZoom)) * 100,
            enabled: true,
            opacity: 1
        }
    });
}
```

### ダイアルイベントの処理

```typescript
async onDialRotate(ev: DialRotateEvent<Settings>): Promise<void> {
    const delta = ev.payload.ticks * 0.1;  // 0.1刻みで調整
    const newZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom + delta));
    
    await this.setZoom(newZoom);
    await this.updateFeedback(ev.action);
}

async onDialPress(ev: DialPressEvent<Settings>): Promise<void> {
    if (ev.payload.pressed === false) {  // リリース時
        await this.resetZoom();  // 1.0x にリセット
        await this.updateFeedback(ev.action);
    }
}
```

## SingletonActionパターン

### 実装例

複数のインスタンス間で状態を共有する必要がある場合に使用：

```typescript
export class ZoomButtonAction extends SingletonAction<ZoomButtonSettings> {
    private currentZoom = 1.0;
    
    constructor() {
        super('works.nantoka.droidcam.zoom-button');
    }
    
    // すべてのインスタンスで共有される状態更新
    private async updateAllInstances(): Promise<void> {
        const instances = this.getInstances();
        for (const [context, instance] of instances) {
            await instance.action.setTitle(`${this.currentZoom.toFixed(1)}x`);
        }
    }
}
```

### インスタンス管理の注意点

- `getInstances()` でアクティブなすべてのインスタンスを取得
- 状態更新時は全インスタンスに反映
- ポーリング処理は1つのインスタンスのみで実行

## アイコン管理

### 状態別アイコンの切り替え

```typescript
private async updateIcon(isConnected: boolean, state: string): Promise<void> {
    let iconPath: string;
    
    if (!isConnected) {
        iconPath = 'icons/disconnected';
    } else {
        switch (state) {
            case 'on':
                iconPath = 'icons/led-on';
                break;
            case 'off':
                iconPath = 'icons/led-off';
                break;
            default:
                iconPath = 'icons/led-unknown';
        }
    }
    
    await this.action.setImage(iconPath);
}
```

### アイコンファイルの構成

```
works.nantoka.droidcam.sdPlugin/
└── icons/
    ├── connected.svg          # 接続状態
    ├── disconnected.svg       # 切断状態
    ├── led-on.svg            # LED ON
    ├── led-off.svg           # LED OFF
    ├── zoom-in.svg           # ズームイン
    ├── zoom-out.svg          # ズームアウト
    └── menu-*.svg            # メニュー用アイコン
```

## Stream Deck SDK API

### 新旧APIの対応表

| 旧API | 新API |
|-------|-------|
| `ev.action.sendToPropertyInspector()` | `streamDeck.ui.current?.sendToPropertyInspector()` |
| `ev.action.getSettings()` | `ev.action.getSettings()` （変更なし） |
| `ev.action.setSettings()` | `ev.action.setSettings()` （変更なし） |

### Property Inspector との通信

```typescript
// Plugin → Property Inspector
async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    // 現在のUIに設定を送信
    streamDeck.ui.current?.sendToPropertyInspector({
        event: 'settings',
        settings: ev.payload.settings
    });
}

// Property Inspector → Plugin
async onSendToPlugin(ev: SendToPluginEvent<Settings, any>): Promise<void> {
    const { event, data } = ev.payload;
    
    switch (event) {
        case 'getSettings':
            streamDeck.ui.current?.sendToPropertyInspector({
                event: 'settings',
                settings: await ev.action.getSettings()
            });
            break;
    }
}
```

## エラーハンドリング

### DroidCam Pro 機能のエラー処理

```typescript
try {
    const response = await fetch(`http://${ip}:${port}/v3/camera/ev/${value}`);
    
    if (response.status === 550) {
        // DroidCam Pro限定機能
        logger.warn('This feature requires DroidCam Pro');
        await ev.action.showAlert();
        return;
    }
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
} catch (error) {
    logger.error('Failed to set exposure:', error);
    await ev.action.showAlert();
}
```

### 接続エラーのハンドリング

```typescript
private async checkConnection(): Promise<boolean> {
    try {
        const response = await fetch(
            `http://${this.ipAddress}:${this.port}/v1/phone/name`,
            { 
                signal: AbortSignal.timeout(3000)  // 3秒タイムアウト
            }
        );
        return response.ok;
    } catch (error) {
        if (error.name === 'AbortError') {
            logger.warn('Connection timeout');
        } else {
            logger.error('Connection failed:', error);
        }
        return false;
    }
}
```

### undefined の安全な処理

```typescript
// Null合体演算子を使用
const port = settings.port ?? 4747;
const ipAddress = settings.ipAddress ?? '192.168.1.100';

// オプショナルチェイニング
const currentUI = streamDeck.ui.current?.sendToPropertyInspector;
if (currentUI) {
    currentUI({ event: 'update' });
}
```

## デバッグとテスト

### Stream Deck でのリロード

開発中は Stream Deck アプリでプラグインをリロードして動作確認：

1. Stream Deck アプリを開く
2. 設定 → プラグイン
3. 該当プラグインの「...」メニュー → リロード

### ログレベルの設定

```typescript
// plugin.ts
import streamDeck, { LogLevel } from "@elgato/streamdeck";

// 開発時はDEBUGレベル
streamDeck.logger.setLevel(LogLevel.DEBUG);

// 本番環境ではINFOレベル
// streamDeck.logger.setLevel(LogLevel.INFO);
```

### manifest.json のデバッグ設定

```json
{
    "Nodejs": {
        "Version": "20",
        "Debug": "enabled"  // デバッグ有効化
    }
}
```

## パフォーマンス最適化

### ポーリング間隔の調整

```typescript
private readonly POLLING_INTERVAL = 5000;  // 5秒間隔

private startPolling(): void {
    // 既存のポーリングを停止
    this.stopPolling();
    
    // SingletonActionの場合、1つのインスタンスのみでポーリング
    const instances = this.getInstances();
    if (instances.size > 0 && instances.entries().next().value[0] === this.context) {
        this.pollingTimer = setInterval(() => {
            this.updateStatus();
        }, this.POLLING_INTERVAL);
    }
}
```

### リソースのクリーンアップ

```typescript
async onWillDisappear(ev: WillDisappearEvent<Settings>): Promise<void> {
    // タイマーの停止
    if (this.pollingTimer) {
        clearInterval(this.pollingTimer);
        this.pollingTimer = undefined;
    }
    
    // WebSocket接続のクローズ
    if (this.ws) {
        this.ws.close();
        this.ws = undefined;
    }
}
```