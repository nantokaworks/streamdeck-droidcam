#!/bin/bash
# Stream Deckプラグインのログを監視

echo "🔍 Stream Deck Plugin Log Monitor"
echo "================================="
echo "Watching for button presses and events..."
echo "Press Ctrl+C to stop"
echo ""

# 最新のログファイルを監視
tail -f works.nantoka.droidcam.sdPlugin/logs/works.nantoka.droidcam.0.log | while IFS= read -r line; do
  # タイムスタンプとレベルを抽出
  timestamp=$(echo "$line" | cut -d' ' -f1)
  level=$(echo "$line" | cut -d' ' -f2)
  message=$(echo "$line" | cut -d' ' -f3-)
  
  # レベルに応じて色付け
  case "$level" in
    "ERROR")
      echo -e "\033[31m❌ $message\033[0m"
      ;;
    "INFO")
      if [[ "$message" == *"PRESSED"* ]]; then
        echo -e "\033[32m$message\033[0m"
      elif [[ "$message" == *"appeared"* ]]; then
        echo -e "\033[33m$message\033[0m"
      elif [[ "$message" == *"Connected"* ]]; then
        echo -e "\033[32m✅ $message\033[0m"
      elif [[ "$message" == *"Failed"* ]] || [[ "$message" == *"failed"* ]]; then
        echo -e "\033[31m❌ $message\033[0m"
      else
        echo -e "\033[36mℹ️  $message\033[0m"
      fi
      ;;
    "DEBUG")
      # デバッグメッセージは表示しない（コメントアウトで表示可能）
      # echo -e "\033[90m⚙️  $message\033[0m"
      ;;
    "WARN")
      echo -e "\033[33m⚠️  $message\033[0m"
      ;;
    *)
      echo "$line"
      ;;
  esac
done