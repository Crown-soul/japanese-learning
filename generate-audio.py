#!/usr/bin/env python3
"""
用 Google Cloud Text-to-Speech 產生日文語音 MP3。

會從 lessons/日文70單字學習器.html 抓出：
  - 70 個單字（辭書形）
  - 70 句例句
  - 兩篇故事的每一段
每段合成一個 MP3 放到 audio/，並寫一份 audio/manifest.json
（HTML 靠這份對照表知道每段文字要播哪個檔）。

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
LESSON = ROOT / "lessons" / "日文70單字學習器.html"
AUDIO_DIR = ROOT / "audio"
MANIFEST = AUDIO_DIR / "manifest.json"

# 語音設定：日文男聲 Neural2-D，語速稍慢方便學習
VOICE = "ja-JP-Neural2-D"
LANG = "ja-JP"
SPEAKING_RATE = 0.9

API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"


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


# ---------- 從 HTML 抽文字 ----------

VOCAB_RE = re.compile(
    r'"(?P<key>[^"]+)":\{[^}]*?reading:"(?P<reading>[^"]*)"[^}]*?'
    r'dict:"(?P<dict>[^"]*)"[^}]*?ex:"(?P<ex>[^"]*)"\}'
)
FURIGANA_RE = re.compile(r"（[ぁ-んァ-ヶ・ーゝゞ〜]+）")
# S() 可能是 3 個參數 S("key","label","reading") 或 2 個參數 S("key","label")
SFUNC_RE = re.compile(r'\$\{S\("[^"]*","([^"]*)"(?:,"[^"]*")?\)\}')


def clean_story_text(raw: str) -> str:
    # ${S("key","本文形","reading")} -> 本文形
    t = SFUNC_RE.sub(r"\1", raw)
    # 去掉 漢字（かな） 的注音
    t = FURIGANA_RE.sub("", t)
    return t.strip()


def extract_texts():
    html = LESSON.read_text(encoding="utf-8")

    words, sentences = [], []
    for m in VOCAB_RE.finditer(html):
        words.append(m.group("dict"))
        sentences.append(m.group("ex"))

    stories = []
    for name in ("story1", "story2"):
        block = re.search(
            rf"const {name}\s*=\s*\[(.*?)\n\];", html, re.DOTALL
        )
        if not block:
            continue
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
    h = hashlib.sha1(f"{voice}|{rate}|{text}".encode("utf-8")).hexdigest()
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
            audio = synthesize(text, api_key)
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
    print(
        f"\n完成：新產生 {made} 個、跳過 {skipped} 個。"
        f"\n本次計費字元約 {total_chars_billed}（Neural2 免費額度每月 100 萬）。"
        f"\nmanifest：{MANIFEST}"
    )


if __name__ == "__main__":
    main()
