#!/bin/bash
# 一鍵發佈：重建目錄 → commit → push
# 用法：./publish.sh "這次的說明"

set -e
cd "$(dirname "$0")"

MSG="${1:-更新日文學習檔案}"

echo "==> 重建目錄 index.html"
python3 build-index.py

echo "==> 加入變更"
git add -A

if git diff --cached --quiet; then
  echo "沒有任何變更，結束。"
  exit 0
fi

echo "==> commit：$MSG"
git commit -m "$MSG"

echo "==> push 到 GitHub"
git push

echo "完成！幾分鐘後就會更新到 GitHub Pages。"
