# DroidCam API ドキュメント（非公式）

DroidCam の Web UI を解析して得られた、HTTP API の一覧です。  
**接続先**: `http://<IPアドレス>:4747`

> ⚠️ 本APIは非公開・非公式です。Pro機能が必要なものや、将来的に変更される可能性があります。

---

## 📡 状態取得API（GET）

| エンドポイント | 説明 |
|----------------|------|
| `/v1/phone/name` | 接続中のスマートフォンの名前（機種名など）を取得 |
| `/v1/camera/info` | 現在のカメラ状態（ズーム、露出、WBなど）をJSON形式で取得 |
| `/v1/camera/camera_list` | 利用可能なカメラ（前面・背面など）のリストを取得（改行区切り） |
| `/v1/phone/battery_info` | バッテリー情報を取得（バッテリーレベル・電流方向など） |

---

## 🔧 カメラ制御API（PUT）

### 🎥 ズーム・露出・WB・フォーカス数値設定

| エンドポイント | 説明 | 値の例 |
|----------------|------|--------|
| `/v3/camera/zoom/{value}` | ズーム倍率を設定 | 例: `0.0 ~ 8.0` min max を取得 |
| `/v3/camera/ev/{value}` | 露出補正（EV）を設定 | `-2.0 ~ 2.0`  min max を取得 |
| `/v2/camera/wb_level/{value}` | ホワイトバランス（WB Level）を手動で設定 | 例: `4000` |
| `/v3/camera/mf/{value}` | マニュアルフォーカスの値を設定 | `0.0 ~ 1.0` |

### 🔘 トグル・モード切替系

| エンドポイント | 説明 |
|----------------|------|
| `/v1/camera/autofocus` | オートフォーカス実行（AF） |
| `/v1/camera/autofocus_mode/{mode}` | オートフォーカスモードを設定（下記参照） |
| `/v1/camera/wb_mode/{mode}` | ホワイトバランスモードを設定（下記参照） |
| `/v1/camera/torch_toggle` | LED（ライト）のON/OFFを切り替え |
| `/v1/camera/mic_toggle` | マイクのON/OFFを切り替え |
| `/v1/camera/el_toggle` | 露出ロックON/OFF切替 |
| `/v1/camera/wbl_toggle` | WBロックON/OFF切替 |
| `/v1/camera/active/{camIndex}` | 使用するカメラの切り替え（0:背面、1:前面など） |
| `/v1/stop` | DroidCam を停止 |
| `/v1/restart` | DroidCam を再起動（映像再取得） |

---

## 🧪 `/v1/camera/info` のレスポンス例

```json
{
  "active": 1,
  "led_on": 0,        // LED状態: 0=ON（点灯）, 1=OFF（消灯） ※注意：直感と逆
  "wbMode": 0,
  "wbLock": 0,
  "wbValue": 4000,
  "focusMode": 2,
  "mfValue": 0.4,
  "mfMin": 0.0,
  "mfMax": 1.0,
  "zmValue": 1.5,
  "zmMin": 1.0,
  "zmMax": 8.0,
  "evValue": 0.0,
  "evMin": -2.0,
  "evMax": 2.0,
  "exposure_lock": 1,
  "mute_sound": 0
}
```

---

## 🎛 各種モード値の意味

### LED状態（`led_on`フィールド）

| 値 | 意味 |
|----|------|
| 0  | LED ON（点灯） |
| 1  | LED OFF（消灯） |

> ⚠️ 注意: 値の意味が直感と逆になっています（0がON、1がOFF）

### オートフォーカスモード（`/v1/camera/autofocus_mode/{mode}`）

| 値 | 意味 |
|----|------|
| 0  | 通常（Normal） |
| 1  | マクロ（Macro） |
| 2  | 動画向け連続AF（Continuous Video） |
| 3  | 無限遠（Infinity） |

### ホワイトバランスモード（`/v1/camera/wb_mode/{mode}`）

| 値 | 意味 |
|----|------|
| 0  | 自動（Auto） |
| 1〜6 | 固定（電球、蛍光灯、夕方など） |
| 7  | 日陰 |
| 8  | 手動（`/v2/camera/wb_level/` で設定） |

---

## 🛠 使用例（curl）

```bash
# ズームを2.5xに設定
curl -X PUT http://localhost:4747/v3/camera/zoom/2.5

# マイクをミュート/解除
curl -X PUT http://localhost:4747/v1/camera/mic_toggle

# カメラ情報を取得
curl http://localhost:4747/v1/camera/info
```

---

## 🔐 エラーハンドリング：HTTP 550 エラーとは？

- 一部のAPI（ズーム・フォーカスなど）は **DroidCam Pro**（有料版）限定です。
- 無料版でアクセスしようとすると `HTTP 550` エラーが返されます。
- Web UI でも該当機能を操作しようとすると「Proを購入してください」という表示が出ます。

---

## 🔒 補足

- 上記APIはローカルネットワーク内（Wi-Fi/USB経由）でのみ使用可能。
- mDNSが有効な場合は `http://<デバイス名>.local:4747` でもアクセス可。
- 本仕様はDroidCam公式のサポート外・非公開APIに基づくため、将来的に変更される可能性があります。

---

## 🔄 APIエンドポイント修正履歴

Stream Deck プラグインの実装中に発見・修正したDroidCam APIエンドポイントの相違点：

### エンドポイントの修正

| 機能 | 誤ったエンドポイント | 正しいエンドポイント | 備考 |
|------|---------------------|---------------------|------|
| **フォーカスモード設定** | `/v1/camera/focus_mode/{mode}` | `/v1/camera/autofocus_mode/{mode}` | - |
| **手動WB値設定** | `/v1/camera/wb/{value}` | `/v2/camera/wb_level/{value}` | - |
| **露出ロック切り替え** | `/v1/camera/exposure_lock_toggle` | `/v1/camera/el_toggle` | - |
| **WBロック切り替え** | `/v1/camera/wb_lock_toggle` | `/v1/camera/wbl_toggle` | - |
| **露出補正設定** | `/v1/camera/exposure/{value}` | `/v3/camera/ev/{value}` | DroidCam Pro限定 |

### フィールド値の仕様

#### LED状態フィールド

```json
{
  "led_on": 0  // 0 = ON, 1 = OFF (直感と逆)
}
```

- `led_on` フィールドは **0 = ON, 1 = OFF** という直感と逆の値
- LED制御時は値の変換が必要

#### バッテリー充電判定

```json
{
  "amps": 1.23  // 正の値 = 充電中, 負の値 = 放電中
}
```

- `amps` フィールドの値で充電状態を判定
- 正の値: 充電中
- 負の値: 放電中（バッテリー使用中）

### DroidCam Pro 限定機能

以下の機能は DroidCam Pro 限定で、無料版では `HTTP 550` エラーが返される：

- 露出補正 (`/v3/camera/ev/{value}`)
- ズーム制御 (`/v3/camera/zoom/{value}`)
- マニュアルフォーカス (`/v3/camera/mf/{value}`)

### 実装時の注意点

1. **エンドポイント確認**: 新機能実装前に最新のエンドポイントを再確認
2. **エラーハンドリング**: HTTP 550 エラーを適切に処理
3. **値の変換**: led_on フィールドなど、直感と異なる値の変換
4. **Pro機能の識別**: 有料限定機能を明確に区別
