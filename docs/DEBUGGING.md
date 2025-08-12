# DroidCam Stream Deck Plugin - デバッグガイド

## 現在の状況

### ✅ 動作している機能
- Test Buttonのクリックイベント（ボタン押下でログ出力）
- DroidCam API接続（デバイス名取得成功）
- Connection Statusボタンの自動接続チェック（5秒間隔）
- Property Inspectorの設定保存
- 全てのアクション（Camera Switch、LED Toggle、Mic Toggle）
- Stream Deck+のダイアル機能（Zoom Control、Exposure Control）
- ログファイルの作成と出力

### 🔧 最近解決した問題
1. **ES module問題**
   - プラグインディレクトリに`package.json`を追加して`"type": "module"`を設定
   - Stream Deckがプラグインを正常に読み込めるように修正

2. **ログディレクトリの作成**
   - `works.nantoka.droidcam.sdPlugin/logs/`ディレクトリを手動作成
   - ログファイルが正常に出力されるように

## DroidCam APIについて

### 動作確認済みのエンドポイント

1. **デバイス情報取得**
   - `GET /v1/phone/name` - スマートフォンの名前を取得（成功確認済み）
   - レスポンス例: `fjalar`

2. **カメラ制御**
   - `PUT /v1/camera/active/{index}` - カメラ切り替え（0:背面、1:前面）
   - `PUT /v1/camera/torch_toggle` - LED/フラッシュのトグル
   - `PUT /v1/camera/mic_toggle` - マイクのトグル

3. **Pro版機能**
   - `PUT /v3/camera/zoom/{level}` - ズーム設定（0.0〜8.0）
   - `PUT /v3/camera/ev/{level}` - 露出設定（-2.0〜2.0）
   - Pro版でない場合はステータス550が返される

### APIテスト方法
```bash
# 接続テスト
curl http://[IPアドレス]:4747/v1/phone/name

# カメラ切り替え
curl -X PUT http://[IPアドレス]:4747/v1/camera/active/1
```

## トラブルシューティング

### 設定が保存されない場合
1. ブラウザの開発者ツールでコンソールを確認
2. Property InspectorのWebSocket接続状態を確認
3. Stream Deckアプリを再起動

### 接続できない場合
1. DroidCamアプリが起動しているか確認
2. IPアドレスとポート番号が正しいか確認
3. ファイアウォールの設定を確認
4. 同じネットワークに接続しているか確認

## ログの確認方法

### 1. watch-log.sh を使用（推奨）
```bash
# リアルタイムログ監視（色付き表示）
./watch-log.sh
```

**表示される内容:**
- 🎯 緑色: ボタンクリックイベント
- ✅ 緑色: 接続成功メッセージ
- ❌ 赤色: エラーメッセージ
- ℹ️ 水色: 一般的な情報メッセージ
- ⚠️ 黄色: 警告メッセージ

### 2. 直接ログファイルを確認
```bash
# 最新のログを確認
tail -f works.nantoka.droidcam.sdPlugin/logs/works.nantoka.droidcam.0.log

# 特定のイベントをフィルタ
tail -f works.nantoka.droidcam.sdPlugin/logs/works.nantoka.droidcam.0.log | grep "BUTTON PRESSED"
```

### 3. ログファイルの場所
- メインログ: `works.nantoka.droidcam.sdPlugin/logs/works.nantoka.droidcam.0.log`
- ローテーションされたログ: `*.1.log`, `*.2.log` など

## デバッグ時の注意点

1. **ログファイルのサイズ**
   - 自動接続チェックが5秒ごとに実行されるため、ログが急速に増加
   - 定期的にログファイルをクリアすることを推奨

2. **プラグインの再起動**
   ```bash
   # Stream Deckを再起動
   pkill -f "Elgato Stream Deck" && sleep 3 && open -a "Elgato Stream Deck"
   ```

3. **ES moduleエラーが発生した場合**
   - `works.nantoka.droidcam.sdPlugin/package.json`に`{"type": "module"}`が存在することを確認

## 今後の改善案

1. **ログレベルの設定**
   - 開発時とプロダクション時でログレベルを切り替え
   - 自動接続チェックのログを削減するオプション

2. **エラーハンドリングの改善**
   - 接続失敗時の詳細なエラーメッセージ
   - 自動リトライのバックオフ機能

3. **パフォーマンスの最適化**
   - 接続チェックの間隔を動的に調整
   - 不要なAPI呼び出しの削減