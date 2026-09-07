#!/bin/sh
# PreToolUse(Bash) hook：「執行」generate-audio.py 之前確認 Google TTS 金鑰在，
# 沒有就擋下這次執行並提醒放金鑰。
# 只攔真的在跑它的指令（python3 generate-audio.py）；cat / grep / sed 它的內容一律放行。
input=$(cat 2>/dev/null)
echo "$input" | grep -Eq 'python[0-9.]* +([^ "]*/)?generate-audio\.py' || exit 0

root="${CLAUDE_PROJECT_DIR:-.}"
[ -n "${GOOGLE_TTS_API_KEY:-}" ] && exit 0
[ -s "$root/tts-key.txt" ] && exit 0

cat >&2 <<'MSG'
找不到 Google TTS 金鑰，generate-audio.py 會失敗。

請先在專案根目錄放金鑰：
    printf '%s' '你的金鑰' > tts-key.txt

（金鑰怎麼拿、需要啟用帳單 → docs/tts-notes.md；
 產完音檔後可到 Google Cloud 停用，網站運作不需要它。）
MSG
exit 2
