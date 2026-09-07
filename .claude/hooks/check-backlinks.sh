#!/bin/sh
# Stop hook：Claude 回完話後，快掃 lessons/*.html 有沒有漏「← 回目錄」。
# 只提醒、不阻擋（Stop hook 用 exit 2 會把訊息回饋給 Claude 但不影響使用者）。
root="${CLAUDE_PROJECT_DIR:-.}"
miss=""
for f in "$root"/lessons/*.html; do
  [ -e "$f" ] || continue
  grep -q 'href="\.\./"' "$f" || grep -q "href='\.\./'" "$f" || miss="$miss ${f##*/}"
done
[ -z "$miss" ] && exit 0
echo "這些 lessons/*.html 少了「← 回目錄」連結（href=\"../\"）：$miss" >&2
exit 2
