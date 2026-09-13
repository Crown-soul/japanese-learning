#!/bin/sh
# PreToolUse(Bash) hook：「執行」產語音腳本之前確認 Google TTS 金鑰在，
# 沒有就擋下這次執行並提醒放金鑰。
#
# 只攔真的在跑它的指令。先從 hook 的 JSON 輸入取出 tool_input.command 再比對，
# 這樣「指令裡剛好提到這個檔名」（cat / grep / 寫進字串或註解）就不會被誤攔。
input=$(cat 2>/dev/null)

cmd=$(printf '%s' "$input" | python3 -c 'import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
ti = d.get("tool_input") or {}
print(ti.get("command") or "")
' 2>/dev/null)
# 取不到（輸入不是預期的 JSON）就退回整包比對，寧可多攔也不要漏攔
[ -n "$cmd" ] || cmd="$input"

# 指令開頭，或 && ; | ( 之後，才算真的在執行
echo "$cmd" | grep -Eq '(^|[;&|(]|&&|\|\|)[[:space:]]*(python[0-9.]*|uv run)[[:space:]]+([^ "]*/)?generate-audio\.py' || exit 0

root="${CLAUDE_PROJECT_DIR:-.}"
[ -n "${GOOGLE_TTS_API_KEY:-}" ] && exit 0
[ -s "$root/tts-key.txt" ] && exit 0

cat >&2 <<'MSG'
找不到 Google TTS 金鑰，產語音會失敗。

請先在專案根目錄放金鑰：
    printf '%s' '你的金鑰' > tts-key.txt

（金鑰怎麼拿、需要啟用帳單 → docs/tts-notes.md；
 產完音檔後可到 Google Cloud 停用，網站運作不需要它。）
MSG
exit 2
