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
  # 沒有新檔案要 commit，但本機可能還有沒推上去的 commit
  # （例如剛把分支合併進 main），這種情況也要推，不然網站不會更新。
  ahead=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
  if [ "${ahead:-0}" -gt 0 ]; then
    echo "==> 沒有新變更，但本機有 $ahead 個 commit 還沒推上去，直接 push"
    git push
    echo "完成！幾分鐘後就會更新到 GitHub Pages。"
  else
    echo "沒有任何變更，結束。"
  fi
  exit 0
fi

echo "==> commit：$MSG"
git commit -m "$MSG"

echo "==> push 到 GitHub"
git push

echo "完成！幾分鐘後就會更新到 GitHub Pages。"
