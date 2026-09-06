#!/usr/bin/env python3
"""
用同一句日文，把多個 Google TTS 日文語音各合成一次，
放到 audio/_samples/，方便一次比對後決定要用哪個。

用法：
    python3 try-voices.py
    python3 try-voices.py "自己想測的日文句子"

金鑰讀取方式與合成邏輯都沿用 generate-audio.py。
audio/_samples/ 只是試聽用，已被 .gitignore 排除，可自行刪除。
"""

import sys
import urllib.error
import importlib.util
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "genaudio", Path(__file__).parent / "generate-audio.py"
)
_g = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_g)

SAMPLE_DIR = Path(__file__).parent / "audio" / "_samples"

DEFAULT_TEXT = (
    "先週の日曜日、家で父が急に倒れてしまいました。"
    "父の様子がおかしかったので、私はすぐに救急車を呼びました。"
)

VOICES = [
    "ja-JP-Neural2-B",         # 女
    "ja-JP-Neural2-C",         # 男
    "ja-JP-Neural2-D",         # 男
    "ja-JP-Wavenet-A",         # 女
    "ja-JP-Wavenet-C",         # 男
    "ja-JP-Chirp3-HD-Aoede",   # 女（最新）
    "ja-JP-Chirp3-HD-Charon",  # 男（最新）
    "ja-JP-Standard-A",        # 女（機械感，對照組）
]

RATE = 0.9


def main():
    text = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TEXT
    api_key = _g.get_api_key()
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)

    print(f"測試句：{text}\n")
    for v in VOICES:
        out = SAMPLE_DIR / f"{v}.mp3"
        try:
            out.write_bytes(_g.synthesize(text, api_key, voice=v, rate=RATE))
            print(f"  ok  {out.name}")
        except (urllib.error.HTTPError, RuntimeError) as e:
            msg = e.read().decode("utf-8", "ignore")[:120] if hasattr(e, "read") else str(e)
            print(f"  跳過 {v}：{msg}")

    print(f"\n完成，檔案在 {SAMPLE_DIR}")


if __name__ == "__main__":
    main()
