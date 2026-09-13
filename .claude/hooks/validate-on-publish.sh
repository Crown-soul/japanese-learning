#!/bin/sh
# PreToolUse(Bash) hook：把課程內容推上去之前，先驗證引擎課 JSON，有錯就擋下。
#
# 攔兩種：
#   1. 執行 publish.sh（./publish.sh、sh publish.sh、bash publish.sh）
#   2. 直接 git push（繞過 publish.sh 的情況，例如合併分支後手動推）
# 先從 hook 的 JSON 輸入取出 tool_input.command 再比對，
# 「指令裡剛好提到這些字」（cat / grep / 寫進字串）不會被誤攔。
input=$(cat 2>/dev/null)

cmd=$(printf '%s' "$input" | python3 -c 'import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
ti = d.get("tool_input") or {}
print(ti.get("command") or "")
' 2>/dev/null)
[ -n "$cmd" ] || cmd="$input"

# 指令開頭，或 && ; | ( 之後，才算真的在執行
pat='(^|[;&|(]|&&|\|\|)[[:space:]]*((\./|(ba)?sh[[:space:]]+)publish\.sh|git[[:space:]]+push)'
echo "$cmd" | grep -Eq "$pat" || exit 0

root="${CLAUDE_PROJECT_DIR:-.}"
[ -f "$root/validate-lessons.py" ] || exit 0

out=$(cd "$root" && python3 validate-lessons.py 2>&1)
code=$?
if [ "$code" -ne 0 ]; then
  echo "課程驗證沒過，先修正再推上去：" >&2
  echo "$out" >&2
  exit 2
fi
exit 0
