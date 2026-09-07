#!/bin/sh
# PreToolUse(Bash) hook：跑 publish.sh 之前先驗證引擎課 JSON，有錯就擋下。
input=$(cat 2>/dev/null)
echo "$input" | grep -q "publish\.sh" || exit 0

root="${CLAUDE_PROJECT_DIR:-.}"
[ -f "$root/validate-lessons.py" ] || exit 0

out=$(cd "$root" && python3 validate-lessons.py 2>&1)
code=$?
if [ "$code" -ne 0 ]; then
  echo "發佈前檢查沒過，先修正再 publish：" >&2
  echo "$out" >&2
  exit 2
fi
exit 0
