#!/usr/bin/env python3
"""
用 Google Cloud Text-to-Speech 產生日文語音 MP3。

會抓出：
  - 單字（辭書形）＋ 例句 —— 來自共用資料庫 data/vocab.json
  - 兩篇故事的每一段 —— 來自 lessons/日文70單字學習器.html
每段合成一個 MP3 放到 audio/，並寫一份 audio/manifest.json
（HTML 靠這份對照表知道每段文字要播哪個檔）。
跑完會刪掉 manifest 沒用到的舊 mp3。

已經產生過的檔案會跳過，重跑不會浪費額度。

金鑰讀取順序：
  1. 環境變數 GOOGLE_TTS_API_KEY
  2. 專案根目錄的 tts-key.txt（已被 .gitignore 排除）

用法：
    python3 generate-audio.py
"""

import base64
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).parent
LESSONS_DIR = ROOT / "lessons"
AUDIO_DIR = ROOT / "audio"
MANIFEST = AUDIO_DIR / "manifest.json"

# 語音設定：日文男聲 Neural2-D，語速稍慢方便學習
VOICE = "ja-JP-Neural2-D"
LANG = "ja-JP"
SPEAKING_RATE = 0.9

API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"

# ---------- 發音修正表 ----------
# Google TTS 偶爾會把漢字拆開讀，或選錯讀音（例：大分 讀成「大／分」或地名「おおいた」，
# 其實課文要的是副詞「だいぶ」）。在送去合成之前，把左邊的寫法換成右邊的假名。
# 只影響「語音」，畫面上的漢字與注音不受影響。
# 之後聽到還有讀錯的，就在這裡加一行 "寫法": "假名",。長的詞要放前面。
#   - READING_FIXES：整段文字裡只要出現左邊的寫法就換掉（適合 2 字以上、不會誤傷其他詞的）
#   - EXACT_FIXES  ：只有「整段文字剛好等於左邊」時才換（適合單字卡上的單一漢字，
#                    例如「日」，直接全域取代會把「今日」「日曜日」也弄壞）
READING_FIXES = {
    "大分": "だいぶ",    # 副詞，會被讀成「大／分」或地名 おおいた
    "止める": "やめる",   # 課文是「戒掉」，會被讀成 とめる
    "開く": "ひらく",    # 課文是「翻開抽屜」，會被讀成 あく
    "頭": "あたま",      # 會被拆開讀
    "温い": "ぬるい",    # 會被讀成 あたたかい／おんい
    "汚して": "よごして",  # 會被讀成 きたなくして 之類
    "汚す": "よごす",
    "指輪": "ゆびわ",    # 必須排在「指」前面，否則「指」會先被換掉
    "指": "ゆび",       # 單獨時會被讀成 さす／し
}
EXACT_FIXES = {
    "日": "ひ",
}


def apply_reading_fixes(text: str) -> str:
    if text in EXACT_FIXES:
        return EXACT_FIXES[text]
    for surface, kana in READING_FIXES.items():
        text = text.replace(surface, kana)
    return text


def get_api_key() -> str:
    key = os.environ.get("GOOGLE_TTS_API_KEY", "").strip()
    if key:
        return key
    f = ROOT / "tts-key.txt"
    if f.exists():
        return f.read_text(encoding="utf-8").strip()
    sys.exit(
        "找不到金鑰。請設定環境變數 GOOGLE_TTS_API_KEY，\n"
        "或在專案根目錄放一個 tts-key.txt（內容就是那串金鑰）。"
    )


# ---------- 抽文字 ----------
# 單字／例句：共用資料庫 data/vocab.json
# 故事段落：掃 lessons/*.html 裡的 const storyN = [ `...`, ... ]（各課專屬）
VOCAB_JSON = ROOT / "data" / "vocab.json"

FURIGANA_RE = re.compile(r"（[ぁ-んァ-ヶ・ーゝゞ〜]+）")
# S() 可能是 3 個參數 S("key","label","reading") 或 2 個參數 S("key","label")
SFUNC_RE = re.compile(r'\$\{S\("[^"]*","([^"]*)"(?:,"[^"]*")?\)\}')
# 任一課的 const story1 / story2 / story3 ...
STORY_BLOCK_RE = re.compile(r"const story\d+\s*=\s*\[(.*?)\n\];", re.DOTALL)


def clean_story_text(raw: str) -> str:
    # ${S("key","本文形","reading")} -> 本文形
    t = SFUNC_RE.sub(r"\1", raw)
    # 去掉 漢字（かな） 的注音
    t = FURIGANA_RE.sub("", t)
    return t.strip()


def extract_texts():
    if not VOCAB_JSON.exists():
        sys.exit(f"找不到單字資料庫 {VOCAB_JSON}")
    vocab = json.loads(VOCAB_JSON.read_text(encoding="utf-8"))
    words = [w["dict"] for w in vocab]
    sentences = [w["ex"] for w in vocab]

    stories = []
    for html_file in sorted(LESSONS_DIR.glob("*.html")):
        html = html_file.read_text(encoding="utf-8")
        for block in STORY_BLOCK_RE.finditer(html):
            for lit in re.findall(r"`([^`]*)`", block.group(1)):
                cleaned = clean_story_text(lit)
                if cleaned:
                    stories.append(cleaned)

    # 去重，保留順序
    seen, ordered = set(), []
    for t in words + sentences + stories:
        if t and t not in seen:
            seen.add(t)
            ordered.append(t)
    return ordered


# ---------- 合成 ----------

def filename_for(text: str, voice: str = VOICE, rate: float = SPEAKING_RATE) -> str:
    # 用「實際要合成的文字」算檔名：沒被修正的段落雜湊不變、不會重新產生；
    # 有被修正的段落才會換新檔名、重新合成。
    spoken = apply_reading_fixes(text)
    h = hashlib.sha1(f"{voice}|{rate}|{spoken}".encode("utf-8")).hexdigest()
    return f"{h[:16]}.mp3"


def synthesize(text: str, api_key: str, voice: str = VOICE, rate: float = SPEAKING_RATE) -> bytes:
    """呼叫 Google TTS，回傳 MP3 bytes。金鑰走 header，不放 URL。"""
    body = json.dumps({
        "input": {"text": text},
        "voice": {"languageCode": LANG, "name": voice},
        "audioConfig": {"audioEncoding": "MP3", "speakingRate": rate},
    }).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
        },
        method="POST",
    )
    # 金鑰限制剛改完時，Google 節點會有幾分鐘不同步，偶爾回 403。重試即可。
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                payload = json.load(resp)
            audio = payload.get("audioContent")
            if not audio:
                raise RuntimeError(f"回應沒有 audioContent：{str(payload)[:200]}")
            return base64.b64decode(audio)
        except urllib.error.HTTPError as e:
            if e.code in (403, 429, 500, 503) and attempt < 4:
                time.sleep(3 * (attempt + 1))
                continue
            raise


def main():
    api_key = get_api_key()
    AUDIO_DIR.mkdir(exist_ok=True)

    texts = extract_texts()
    print(f"共 {len(texts)} 段文字，約 {sum(len(t) for t in texts)} 字元")

    manifest = {}
    made = skipped = 0
    total_chars_billed = 0

    for i, text in enumerate(texts, 1):
        fname = filename_for(text)
        manifest[text] = fname
        out = AUDIO_DIR / fname
        if out.exists():
            skipped += 1
            continue
        try:
            audio = synthesize(apply_reading_fixes(text), api_key)
        except urllib.error.HTTPError as e:
            print(f"\n第 {i} 段失敗：HTTP {e.code}\n{e.read().decode('utf-8', 'ignore')}")
            sys.exit(1)
        out.write_bytes(audio)
        made += 1
        total_chars_billed += len(text)
        print(f"[{i}/{len(texts)}] {fname}  {text[:24]}")
        time.sleep(0.15)  # 客氣一點

    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    # 清掉不再被 manifest 引用的舊檔（例如發音修正後換了檔名的那幾個）
    keep = set(manifest.values())
    removed = 0
    for mp3 in AUDIO_DIR.glob("*.mp3"):
        if mp3.name not in keep:
            mp3.unlink()
            removed += 1
            print(f"刪除舊檔 {mp3.name}")
    if removed:
        print(f"清掉 {removed} 個沒用到的舊音檔。")

    print(
        f"\n完成：新產生 {made} 個、跳過 {skipped} 個。"
        f"\n本次計費字元約 {total_chars_billed}（Neural2 免費額度每月 100 萬）。"
        f"\nmanifest：{MANIFEST}"
    )


if __name__ == "__main__":
    main()
