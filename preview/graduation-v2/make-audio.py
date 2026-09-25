#!/usr/bin/env python3
"""試用版專用：幫 preview/graduation-v2/lesson.json 產「正式音檔裡沒有的」段落語音。

- 一般段落：key＝去掉標記的純文字（跟正式引擎一樣），聲音用 generate-audio.py 的預設聲音。
- 會話（kind: "dialogue"）：key＝"@<聲音>:<純文字>"，用該說話人的聲音（stories[].voices）。
- 正式 audio/manifest.json 已經有的 key 直接沿用，不重產。
- 輸出到本資料夾的 audio/ 與 audio/manifest.json；沒用到的舊 mp3 會刪掉（只刪本資料夾的）。
金鑰同 generate-audio.py（tts-key.txt 或 GOOGLE_TTS_API_KEY）。
"""
import importlib.util, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
spec = importlib.util.spec_from_file_location("ga", ROOT / "generate-audio.py")
ga = importlib.util.module_from_spec(spec); spec.loader.exec_module(ga)

lesson = json.loads((HERE / "lesson.json").read_text(encoding="utf-8"))
main = json.loads((ROOT / "audio" / "manifest.json").read_text(encoding="utf-8"))
out_dir = HERE / "audio"; out_dir.mkdir(exist_ok=True)

items = []  # (key, text, voice)
for s in lesson["stories"]:
    dlg = s.get("kind") == "dialogue"
    for i, para in enumerate(s["paragraphs"]):
        plain = ga.clean_story_json(para)
        if dlg:
            voice = s["voices"][s["speakers"][i]]
            items.append((f"@{voice}:{plain}", plain, voice))
        elif plain not in main:
            items.append((plain, plain, ga.VOICE))

manifest, made = {}, 0
key = None
for k, text, voice in items:
    fname = ga.filename_for(text, voice)
    path = out_dir / fname
    if not path.exists():
        key = key or ga.get_api_key()
        path.write_bytes(ga.synthesize(ga.apply_reading_fixes(text), key, voice=voice))
        made += 1
        print(f"產生 {fname}  [{voice}] {text[:24]}")
    manifest[k] = fname
(out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
used = set(manifest.values())
for mp3 in out_dir.glob("*.mp3"):
    if mp3.name not in used:
        mp3.unlink(); print("刪除舊檔", mp3.name)
print(f"完成：試用版共 {len(manifest)} 段，新產生 {made} 段。")
