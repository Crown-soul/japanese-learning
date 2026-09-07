#!/bin/sh
# PreToolUse(Bash) hook：「執行」publish.sh 之前先驗證引擎課 JSON，有錯就擋下。
# 只攔真的在跑它的指令（./publish.sh、sh publish.sh、bash publish.sh）；cat / grep 它的內容不算。
input=$(cat 2>/dev/null)
echo "$input" | grep -Eq '(\./|(ba)?sh +)publish\.sh' || exit 0

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
