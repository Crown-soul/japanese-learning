#!/usr/bin/env python3
"""
用 Google Cloud Text-to-Speech 產生日文語音 MP3。

會抓出：
  - 單字（辭書形）＋ 例句 —— data/vocab.json
    （引擎課的單字卡改用「完整假名 reading」合成，讀音更準；舊 HTML 課仍用漢字＋修正表）
  - 故事每一段 —— 舊課 lessons/*.html 的 const storyN；引擎課 data/lessons/*.json
每段合成一個 MP3 放到 audio/，寫一份 audio/manifest.json（clean-text -> filename）。
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
    # --- boarding-house 課（下宿生活の一年）預填 ---
    "墓参り": "はかまいり",  # 會被讀成 ぼさん―
    "駅の角": "えきのかど",  # 「角」單獨會被讀成 つの
    "大家": "おおや",     # 會被讀成 たいか／おおやけ
    "一日おき": "いちにちおき",  # 「一日」常被讀成 ついたち
    "二日おき": "ふつかおき",
    "五分": "ごふん",     # 會被讀成 ごぶん
    "行った": "いった",    # 會被讀成 おこなった
    "行きます": "いきます",
    "行きました": "いきました",
    "写しました": "うつしました",  # 「写」會被讀成 しゃ
    "写した": "うつした",
    "楽に": "らくに",     # 會被讀成 たのしく系
    "粗い": "あらい",     # 罕用漢字，會被讀成 そ―
    "餌": "えさ",        # 會被讀成 じ
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
# 回傳 [(manifest_key, synth_text)]：
#   - manifest_key 是 HTML/引擎裡 play() 會查的字串
#   - synth_text 是實際送去 TTS 的文字（可能不同，例如單字卡用假名合成）
# 單字／例句：data/vocab.json
# 故事段落：舊課 lessons/*.html 的 const storyN；引擎課 data/lessons/*.json
VOCAB_JSON = ROOT / "data" / "vocab.json"
LESSON_DATA_DIR = ROOT / "data" / "lessons"

FURIGANA_RE = re.compile(r"（[ぁ-んァ-ヶ・ーゝゞ〜]+）")
# 舊課：${S("key","label"[,"reading"])}
SFUNC_RE = re.compile(r'\$\{S\("[^"]*","([^"]*)"(?:,"[^"]*")?\)\}')
STORY_BLOCK_RE = re.compile(r"const story\d+\s*=\s*\[(.*?)\n\];", re.DOTALL)
# 引擎課：{{key|label[|reading]}}
TARGET_RE = re.compile(r"\{\{[^{}|]+\|([^{}|]+)(?:\|[^{}]*)?\}\}")


def clean_story_html(raw: str) -> str:
    return FURIGANA_RE.sub("", SFUNC_RE.sub(r"\1", raw)).strip()


def clean_story_json(raw: str) -> str:
    return FURIGANA_RE.sub("", TARGET_RE.sub(r"\1", raw)).strip()


def extract_pairs():
    if not VOCAB_JSON.exists():
        sys.exit(f"找不到單字資料庫 {VOCAB_JSON}")
    vocab = json.loads(VOCAB_JSON.read_text(encoding="utf-8"))
    engine_ids = {p.stem for p in LESSON_DATA_DIR.glob("*.json")} if LESSON_DATA_DIR.exists() else set()

    pairs = []  # (key, synth)
    for w in vocab:
        lessons = w.get("lessons") or []
        # 全部所屬課程都是引擎課、且有 reading -> 單字卡用「完整假名」合成，讀音 100% 正確
        use_kana = bool(lessons) and all(l in engine_ids for l in lessons) and w.get("reading")
        pairs.append((w["dict"], w["reading"] if use_kana else w["dict"]))
        pairs.append((w["ex"], w["ex"]))

    for html_file in sorted(LESSONS_DIR.glob("*.html")):
        html = html_file.read_text(encoding="utf-8")
        for block in STORY_BLOCK_RE.finditer(html):
            for lit in re.findall(r"`([^`]*)`", block.group(1)):
                c = clean_story_html(lit)
                if c:
                    pairs.append((c, c))
    for jf in sorted(LESSON_DATA_DIR.glob("*.json")) if LESSON_DATA_DIR.exists() else []:
        data = json.loads(jf.read_text(encoding="utf-8"))
        for story in data.get("stories", []):
            for para in story.get("paragraphs", []):
                c = clean_story_json(para)
                if c:
                    pairs.append((c, c))

    # 去重（依 key），保留順序
    seen, ordered = set(), []
    for key, synth in pairs:
        if key and key not in seen:
            seen.add(key)
            ordered.append((key, synth))
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

    pairs = extract_pairs()
    print(f"共 {len(pairs)} 段文字，約 {sum(len(s) for _, s in pairs)} 字元")

    manifest = {}
    made = skipped = 0
    total_chars_billed = 0

    for i, (key, synth) in enumerate(pairs, 1):
        fname = filename_for(synth)
        manifest[key] = fname
        out = AUDIO_DIR / fname
        if out.exists():
            skipped += 1
            continue
        try:
            audio = synthesize(apply_reading_fixes(synth), api_key)
        except urllib.error.HTTPError as e:
            print(f"\n第 {i} 段失敗：HTTP {e.code}\n{e.read().decode('utf-8', 'ignore')}")
            sys.exit(1)
        out.write_bytes(audio)
        made += 1
        total_chars_billed += len(synth)
        print(f"[{i}/{len(pairs)}] {fname}  {key[:24]}")
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
