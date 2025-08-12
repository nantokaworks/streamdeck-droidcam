# DroidCam API Documentation

## 概要

DroidCam Stream Deck PluginはDroidCamのHTTP APIを使用してカメラを制御します。このドキュメントでは、プラグインが使用するAPIエンドポイントと実装の詳細を説明します。

## API基本情報

- **プロトコル**: HTTP
- **デフォルトポート**: 4747
- **タイムアウト**: 5秒（推奨）
- **認証**: 不要

## エンドポイント一覧

### 📡 接続・情報取得

#### GET /v1/phone/name
デバイス名を取得（接続テスト用）

**レスポンス**: 
```
Samsung Galaxy S21
```

**使用箇所**: 接続状態の確認

---

#### GET /v1/phone/battery_info
バッテリー情報を取得

**レスポンス例**:
```json
{
  "level": 85,
  "is_charging": true,
  "temperature": 32.5
}
```

**フィールド**:
- `level`: バッテリー残量（0-100）
- `is_charging`: 充電中かどうか
- `temperature`: バッテリー温度（℃）

---

#### GET /v1/camera/info
現在のカメラ情報を取得

**レスポンス例**:
```json
{
  "active_camera": 0,
  "cameras": [
    {"id": 0, "facing": "back", "resolution": "1920x1080"},
    {"id": 1, "facing": "front", "resolution": "1280x720"}
  ],
  "zoom": 1.0,
  "exposure": 0,
  "focus_mode": 0,
  "wb_mode": 0
}
```

### 📸 カメラ制御

#### POST /v1/camera/active/{index}
カメラを切り替え

**パラメータ**:
- `index`: カメラインデックス（0: 背面, 1: 前面）

**レスポンス**: 
```
200 OK
```

---

#### POST /v1/camera/torch_toggle
LEDフラッシュのON/OFF切り替え

**レスポンス**:
```json
{
  "torch_on": true
}
```

---

#### POST /v1/camera/mic_toggle
マイクのON/OFF切り替え

**レスポンス**:
```json
{
  "mic_on": false
}
```

### 🎯 フォーカス制御

#### POST /v1/camera/af_trigger
オートフォーカスを実行

**レスポンス**:
```
200 OK
```

---

#### POST /v1/camera/af_mode/{mode}
フォーカスモードを設定

**パラメータ**:
- `mode`: 
  - `0`: Normal（通常）
  - `1`: Macro（マクロ）
  - `2`: Continuous（連続）
  - `3`: Infinity（無限遠）

**レスポンス**:
```
200 OK
```

---

#### POST /v1/camera/mf/{value}
マニュアルフォーカス設定

**パラメータ**:
- `value`: フォーカス値（0.0-1.0）

**レスポンス**:
```
200 OK
```

### 🎨 ホワイトバランス制御

#### POST /v1/camera/wb_mode/{mode}
ホワイトバランスモードを設定

**パラメータ**:
- `mode`:
  - `0`: Auto（自動）
  - `1`: Incandescent（白熱灯）
  - `2`: Fluorescent（蛍光灯）
  - `3`: Warm Fluorescent（温白色蛍光灯）
  - `4`: Daylight（昼光）
  - `5`: Cloudy（曇り）
  - `6`: Twilight（夕暮れ）
  - `7`: Shade（日陰）
  - `8`: Manual（手動）

**レスポンス**:
```
200 OK
```

---

#### POST /v1/camera/wb/{value}
ホワイトバランス手動設定

**パラメータ**:
- `value`: WB値（0-100）

**レスポンス**:
```
200 OK
```

**注意**: WBモードが8（Manual）の時のみ有効

---

#### POST /v1/camera/wbl_toggle
ホワイトバランスロックの切り替え

**レスポンス**:
```json
{
  "wb_locked": true
}
```

### 📊 露出・ズーム制御（Pro版限定）

#### POST /v3/camera/zoom/{level}
ズームレベルを設定

**パラメータ**:
- `level`: ズーム倍率（1.0-8.0）

**レスポンス**:
```
200 OK
```

**エラー**:
- `550`: Pro版が必要

---

#### POST /v3/camera/ev/{level}
露出補正値を設定

**パラメータ**:
- `level`: EV値（-2.0 to +2.0）

**レスポンス**:
```
200 OK
```

**エラー**:
- `550`: Pro版が必要

---

#### POST /v1/camera/el_toggle
露出ロックの切り替え

**レスポンス**:
```json
{
  "exposure_locked": true
}
```

### ⚙️ システム制御

#### POST /v1/stop
DroidCamを停止

**レスポンス**:
```
200 OK
```

---

#### POST /v1/restart
DroidCamを再起動

**レスポンス**:
```
200 OK
```

**注意**: 再起動には数秒かかります

## 実装例

### TypeScriptでの実装

```typescript
export class DroidCamAPI {
    private baseUrl: string;
    private timeout: number = 5000;

    constructor(ipAddress: string, port: number = 4747) {
        this.baseUrl = `http://${ipAddress}:${port}`;
    }

    async getDeviceName(): Promise<string> {
        const response = await fetch(
            `${this.baseUrl}/v1/phone/name`,
            { 
                signal: AbortSignal.timeout(this.timeout) 
            }
        );
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return response.text();
    }

    async setZoom(level: number): Promise<void> {
        const response = await fetch(
            `${this.baseUrl}/v3/camera/zoom/${level}`,
            { 
                method: 'POST',
                signal: AbortSignal.timeout(this.timeout) 
            }
        );
        
        if (response.status === 550) {
            throw new Error('Pro version required');
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    }
}
```

### エラーハンドリング

```typescript
try {
    await api.setZoom(2.0);
} catch (error) {
    if (error.message === 'Pro version required') {
        // Pro版が必要なことをユーザーに通知
        showAlert('この機能はDroidCam Pro版が必要です');
    } else if (error.name === 'AbortError') {
        // タイムアウト
        showAlert('接続がタイムアウトしました');
    } else {
        // その他のエラー
        showAlert(`エラー: ${error.message}`);
    }
}
```

## レート制限とベストプラクティス

### 推奨事項

1. **ポーリング間隔**
   - 接続状態チェック: 5秒以上
   - バッテリー状態: 30秒以上
   - カメラ情報: 必要時のみ

2. **タイムアウト設定**
   - 通常のAPI呼び出し: 5秒
   - 再起動処理: 10秒

3. **エラー処理**
   - 接続エラー時は再試行前に1秒以上待機
   - 550エラー（Pro版限定）は再試行しない

4. **並行処理**
   - 同時に複数のAPIを呼ばない
   - 前の処理が完了してから次を実行

### パフォーマンス最適化

```typescript
// キャッシュの実装例
class CachedAPI {
    private cache = new Map();
    private cacheTimeout = 5000; // 5秒

    async getCachedData(key: string, fetcher: () => Promise<any>) {
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        
        const data = await fetcher();
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        return data;
    }
}
```

## バージョン互換性

| API Version | DroidCam Version | 機能 |
|---|---|---|
| v1 | 6.0+ | 基本機能 |
| v3 | 6.5+ (Pro) | ズーム・露出制御 |

## 既知の制限事項

1. **Pro版限定機能**
   - ズーム制御（/v3/camera/zoom）
   - 露出制御（/v3/camera/ev）
   - 高解像度（720p/1080p）

2. **プラットフォーム依存**
   - 一部のAndroidデバイスでマニュアルフォーカス非対応
   - iOSではLEDトーチが利用できない場合がある

3. **ネットワーク制限**
   - ローカルネットワーク内のみアクセス可能
   - VPN経由では動作しない場合がある

## デバッグ

### cURLでのテスト

```bash
# 接続テスト
curl http://192.168.1.100:4747/v1/phone/name

# カメラ切り替え
curl -X POST http://192.168.1.100:4747/v1/camera/active/1

# ズーム設定（Pro版）
curl -X POST http://192.168.1.100:4747/v3/camera/zoom/2.0
```

### よくあるエラーコード

| コード | 意味 | 対処法 |
|---|---|---|
| 200 | 成功 | - |
| 400 | 無効なパラメータ | パラメータ値を確認 |
| 404 | エンドポイント不明 | APIバージョン確認 |
| 550 | Pro版限定 | Pro版を購入 |
| 500 | 内部エラー | DroidCamを再起動 |

---

最終更新: 2025年1月
API Version: v3