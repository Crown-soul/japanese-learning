#!/usr/bin/env python3
"""
驗證 data/lessons/*.json（引擎課內容）與 data/vocab.json 的一致性。

檢查項目：
  1. JSON 合法、必要欄位齊全、型別正確
  2. id 與檔名一致
  3. 薄殼 lessons/<id>.html 存在、<title> 與 JSON 的 title 一致
  4. 故事標記 {{key|label|reading}} 的 key 在 data/vocab.json 且該字 lessons 含此課
  5. 每個目標單字（vocab 裡 lessons 含此課的）至少在故事出現 1 次
  6. grammar[].point 都能在 docs/n4-grammar.md 找到
  7. grammarQuiz[].g 是 grammar[] 的合法索引；s 含「（　）」；a 在 o 範圍內
  8. reading[].st 對到存在的故事；ref 的每個片段都是該故事純文字的子字串；a 在 o 範圍內
  9. vocab 新字：reading 全假名、必要欄位齊、lessons 非空
 10. 段落裡的 [[g#]]/[[/g]]（文法點點擊標記）數量成對、# 是 grammar[] 的合法索引
 11. stories[].translation（若有，供故事整篇翻譯用）長度要跟 paragraphs 一樣

用法：
    python3 validate-lessons.py            # 驗全部
    python3 validate-lessons.py hospital   # 只驗某課
退出碼：0 = 全過；1 = 有錯。
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent
LDIR = ROOT / "data" / "lessons"
VOCAB = ROOT / "data" / "vocab.json"
N4 = ROOT / "docs" / "n4-grammar.md"
LESSONS_HTML = ROOT / "lessons"

FURI_RE = re.compile(r"（[ぁ-んァ-ヶ・ーゝゞ〜]+）")
TARGET_RE = re.compile(r"\{\{([^{}|]+)\|([^{}|]+)(?:\|([^{}]*))?\}\}")
GRAM_OPEN_RE = re.compile(r"\[\[g(\d+)\]\]")
GRAM_CLOSE_RE = re.compile(r"\[\[/g\]\]")
KANA_ONLY = re.compile(r"^[ぁ-んァ-ヶ・ーゝゞ〜]+$")
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.I | re.S)

errs = []
warns = []


def err(lid, msg):
    errs.append(f"[{lid}] {msg}")


def warn(lid, msg):
    warns.append(f"[{lid}] {msg}")


def plain(raw):
    t = TARGET_RE.sub(lambda m: m.group(2), raw)
    t = GRAM_OPEN_RE.sub("", t)
    t = GRAM_CLOSE_RE.sub("", t)
    return FURI_RE.sub("", t).strip()


def story_paras(s):
    """s 若不是物件（畸形 JSON）就當沒有段落，不要讓 .get 炸掉整支腳本。"""
    return (s.get("paragraphs") or []) if isinstance(s, dict) else []


def n4_points():
    if not N4.exists():
        return None
    txt = N4.read_text(encoding="utf-8")
    # 標題 (### ～てしまう／～ちゃう) 或表格首欄 (| すると |)
    raw = set(re.findall(r"^###\s+(.+?)\s*$", txt, re.M))
    raw |= set(re.findall(r"^\|\s*([^|｜\s][^|]*?)\s*\|", txt, re.M))
    norm = set()
    for p in raw:
        # 一條標題可能列多個等價形：～てしまう／～ちゃう、～ば～ほど…用 ／・、 拆開
        for piece in re.split(r"[／/・]", p):
            piece = piece.strip()
            if not piece or piece in ("文法", "接續詞", "意思", "例", "來源"):
                continue
            norm.add(piece)
            norm.add(re.sub(r"（.*?）|\(.*?\)", "", piece).strip())  # 去括號後綴
    return norm


def check_lesson(path, vocab, n4):
    lid = path.stem
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        err(lid, f"JSON 解析失敗：{e}")
        return

    if data.get("id") != lid:
        err(lid, f"id 欄位（{data.get('id')!r}）與檔名不符")
    if not isinstance(data.get("title"), str) or not data["title"].strip():
        err(lid, "缺 title")

    # 薄殼
    shell = LESSONS_HTML / f"{lid}.html"
    if not shell.exists():
        err(lid, f"薄殼 lessons/{lid}.html 不存在")
    else:
        m = TITLE_RE.search(shell.read_text(encoding="utf-8"))
        if not m:
            err(lid, "薄殼缺 <title>")
        elif data.get("title") and m.group(1).strip() != data["title"].strip():
            err(lid, f"薄殼 <title>（{m.group(1).strip()!r}）≠ JSON title（{data['title']!r}）")
        if 'data-lesson="' + lid + '"' not in shell.read_text(encoding="utf-8"):
            err(lid, f'薄殼缺 data-lesson="{lid}"')

    stories = data.get("stories")
    if not isinstance(stories, list) or not stories:
        err(lid, "stories 必須是非空陣列")
        stories = []
    story_plain = []
    for si, s in enumerate(stories, 1):
        paras = s.get("paragraphs") if isinstance(s, dict) else None
        if not isinstance(paras, list) or not paras:
            err(lid, f"stories[{si}] 缺 paragraphs")
            story_plain.append("")
            continue
        story_plain.append("".join(plain(p) for p in paras))
        tr = s.get("translation")
        if tr is not None and (not isinstance(tr, list) or len(tr) != len(paras)):
            err(lid, f"stories[{si}].translation 長度必須跟 paragraphs 一樣（{len(paras)} 段）")

    # 這課的目標單字
    lesson_words = {w["key"] for w in vocab if lid in (w.get("lessons") or [])}
    if not lesson_words:
        warn(lid, "data/vocab.json 沒有 lessons 含此課的字")

    # {{}} 標記
    used = set()
    for si, s in enumerate(stories, 1):
        for p in story_paras(s):
            for k, label, rd in TARGET_RE.findall(p):
                k = k.strip()
                used.add(k)
                if k not in {w["key"] for w in vocab}:
                    err(lid, f"故事用了 {{{{...}}}} 標記 key「{k}」但 data/vocab.json 沒有")
                elif k not in lesson_words:
                    err(lid, f"標記 key「{k}」的 vocab lessons 不含「{lid}」")
    missing = lesson_words - used
    if missing:
        err(lid, f"這些目標單字沒在故事出現：{'、'.join(sorted(missing))}")

    # grammar
    grammar = data.get("grammar") or []
    if len(grammar) < 8:
        warn(lid, f"文法點只有 {len(grammar)} 個（建議 ≥8）")
    for gi, g in enumerate(grammar):
        for f in ("point", "example", "meaning", "n4ref"):
            if not g.get(f):
                err(lid, f"grammar[{gi}] 缺 {f}")
        pt = (g.get("point") or "").strip()
        if n4 is not None and pt and pt not in n4 and re.sub(r"（.*?）", "", pt).strip() not in n4:
            err(lid, f"grammar[{gi}] 的 point「{pt}」在 docs/n4-grammar.md 找不到")

    # 故事裡的文法標記 [[g#]]…[[/g]]
    for si, s in enumerate(stories, 1):
        for p in story_paras(s):
            opens = GRAM_OPEN_RE.findall(p)
            closes = len(GRAM_CLOSE_RE.findall(p))
            if len(opens) != closes:
                err(lid, f"stories[{si}] 段落的 [[g]]/[[/g]] 數量不一致")
            for gi_s in opens:
                gi_n = int(gi_s)
                if not (0 <= gi_n < len(grammar)):
                    err(lid, f"stories[{si}] 用了 [[g{gi_n}]] 但 grammar[] 沒有這個索引")

    # grammarQuiz
    for qi, q in enumerate(data.get("grammarQuiz") or []):
        g = q.get("g")
        if not isinstance(g, int) or not (0 <= g < len(grammar)):
            err(lid, f"grammarQuiz[{qi}].g（{g}）不是 grammar[] 的合法索引")
        if "（　）" not in (q.get("s") or ""):
            err(lid, f"grammarQuiz[{qi}].s 缺全形空格「（　）」")
        o = q.get("o") or []
        if len(o) != 4:
            err(lid, f"grammarQuiz[{qi}] 選項不是 4 個")
        if not isinstance(q.get("a"), int) or not (0 <= q.get("a", -1) < len(o)):
            err(lid, f"grammarQuiz[{qi}].a 超出選項範圍")

    # reading
    for ri, r in enumerate(data.get("reading") or []):
        st = r.get("st")
        if not isinstance(st, int) or not (1 <= st <= len(stories)):
            err(lid, f"reading[{ri}].st（{st}）沒有對應的故事")
            continue
        base = story_plain[st - 1]
        ref = (r.get("ref") or "").strip()
        if not ref:
            err(lid, f"reading[{ri}] 缺 ref")
        else:
            for chunk in re.split(r"…+|\.{3,}|　+", ref):
                c = chunk.strip("　「」、。 ")
                if len(c) >= 6 and c not in base:
                    err(lid, f"reading[{ri}].ref 片段「{c}」不在篇{st}的內文裡")
        o = r.get("o") or []
        if len(o) != 4:
            err(lid, f"reading[{ri}] 選項不是 4 個")
        if not isinstance(r.get("a"), int) or not (0 <= r.get("a", -1) < len(o)):
            err(lid, f"reading[{ri}].a 超出選項範圍")


def check_vocab(vocab, only):
    for w in vocab:
        lessons = w.get("lessons") or []
        if only and only not in lessons:
            continue
        # 只嚴格檢查引擎課的字（有對應 data/lessons/<id>.json）
        engine = any((LDIR / f"{l}.json").exists() for l in lessons)
        tag = "vocab:" + w.get("key", "?")
        for f in ("key", "dict", "reading", "pos", "zh", "ex"):
            if not w.get(f):
                err(tag, f"缺 {f}")
        if not lessons:
            err(tag, "lessons 為空")
        if engine and w.get("reading") and not KANA_ONLY.match(w["reading"]):
            err(tag, f"reading「{w['reading']}」不是純假名（引擎課單字卡用它合成）")


def check_backlinks():
    for html in sorted(LESSONS_HTML.glob("*.html")):
        t = html.read_text(encoding="utf-8", errors="ignore")
        if 'href="../"' in t or "href='../'" in t:
            continue
        # 引擎課薄殼：回目錄連結由 assets/lesson-engine.js 的 shell() 注入，HTML 本身沒有
        if "data-lesson=" in t and "lesson-engine.js" in t:
            continue
        err(html.name, "缺「← 回目錄」連結（href=\"../\"）")


def check_audio_coverage(files, vocab):
    man_path = ROOT / "audio" / "manifest.json"
    if not man_path.exists():
        return
    man = json.loads(man_path.read_text(encoding="utf-8"))
    for path in files:
        lid = path.stem
        data = json.loads(path.read_text(encoding="utf-8"))
        keys = set()
        for w in vocab:
            if lid in (w.get("lessons") or []):
                keys.add(w.get("dict")); keys.add(w.get("ex"))
        for s in data.get("stories", []):
            for p in s.get("paragraphs", []):
                keys.add(plain(p))
        missing = [k for k in keys if k and k not in man]
        if missing:
            warn(lid, f"{len(missing)} 段還沒產語音（跑 generate-audio.py）：{missing[0][:20]}…")


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    if not VOCAB.exists():
        print("找不到 data/vocab.json"); sys.exit(1)
    vocab = json.loads(VOCAB.read_text(encoding="utf-8"))
    n4 = n4_points()
    if n4 is None:
        warn("-", "docs/n4-grammar.md 不存在，略過文法點檢查")

    files = sorted(LDIR.glob("*.json")) if LDIR.exists() else []
    if only:
        files = [f for f in files if f.stem == only]
        if not files:
            print(f"找不到 data/lessons/{only}.json"); sys.exit(1)
    for f in files:
        check_lesson(f, vocab, n4)
    check_vocab(vocab, only)
    check_backlinks()
    check_audio_coverage(files, vocab)

    for w in warns:
        print(f"⚠ {w}")
    for e in errs:
        print(f"✗ {e}")
    n = len(files)
    if errs:
        print(f"\n{n} 課，{len(errs)} 個錯誤。")
        sys.exit(1)
    print(f"\n{n} 課，全部通過{f'（{len(warns)} 個提醒）' if warns else ''}。")


if __name__ == "__main__":
    main()
