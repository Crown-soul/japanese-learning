#!/usr/bin/env python3
"""
把 docs/n4-grammar.md 轉成 data/grammar.json，給 lessons/grammar-index.html（文法查詢頁）用。
docs/n4-grammar.md 是人／AI 讀的來源，網頁讀不了 .md，所以建置時轉一份 JSON。

輸出格式：
{
  "sections": [ {"id": "A", "title": "條件・假定", "note": "（該章開頭的 blockquote，通常是對比說明）"} ],
  "points":   [ {"title": "～たら（假定・確定條件）", "section": "A", "retired": false,
                 "fields": {"接續": "...", "意思": "...", "例": "...", "來源": "...", "誤區": "...", "對比": "..."},
                 "extra": ["其他不是「欄名：」開頭的條列"],
                 "lessons": [{"id": "boarding-house", "title": "下宿生活の一年"}] } ],
  "conjunctions": [ {"word": "すると", "meaning": "...", "example": "...", "source": "..."} ]
}

用法：
    python3 build-grammar.py
CI 會檢查 data/grammar.json 與 docs/n4-grammar.md 一致（無 diff）。
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "docs" / "n4-grammar.md"
LESSON_DATA_DIR = ROOT / "data" / "lessons"
OUT = ROOT / "data" / "grammar.json"

SECTION_RE = re.compile(r"^## ([A-Z])\. (.+?)\s*$")
POINT_RE = re.compile(r"^### (.+?)\s*$")
FIELD_RE = re.compile(r"^- ([^：:]{1,6})[：:]\s*(.*)$")
TABLE_ROW_RE = re.compile(r"^\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$")


def strip_md(s: str) -> str:
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"`(.+?)`", r"\1", s)
    return s.strip()


def taught_in():
    """哪些課用過哪個文法點：{point: [{id, title}]}"""
    out = {}
    if not LESSON_DATA_DIR.exists():
        return out
    for jf in sorted(LESSON_DATA_DIR.glob("*.json")):
        try:
            d = json.loads(jf.read_text(encoding="utf-8"))
        except Exception:
            continue
        for g in d.get("grammar") or []:
            pt = (g.get("point") or "").strip()
            if pt:
                out.setdefault(pt, []).append({"id": jf.stem, "title": d.get("title") or jf.stem})
    return out


def main():
    text = SRC.read_text(encoding="utf-8")
    lines = text.split("\n")
    sections, points, conjunctions = [], [], []
    cur_sec = None
    cur_point = None
    sec_note = []          # 章開頭的 blockquote（在第一個 ### 之前）
    in_conj_table = False

    def flush_point():
        nonlocal cur_point
        if cur_point:
            points.append(cur_point)
            cur_point = None

    for raw in lines:
        line = raw.rstrip()
        m = SECTION_RE.match(line)
        if m:
            flush_point()
            cur_sec = {"id": m.group(1), "title": strip_md(m.group(2)), "note": ""}
            sections.append(cur_sec)
            sec_note = []
            in_conj_table = "接續詞" in cur_sec["title"]
            continue
        if line.startswith("## "):          # 0. 使用範圍… 之類的非 A–O 章
            flush_point()
            cur_sec = None
            in_conj_table = False
            continue
        m = POINT_RE.match(line)
        if m:
            flush_point()
            if cur_sec is None:
                continue                    # 第 0 章的 ### 不是文法點
            if sec_note and not cur_sec["note"]:
                cur_sec["note"] = "\n".join(sec_note).strip()
            title = strip_md(m.group(1))
            retired = "（停用" in title
            cur_point = {
                "title": re.sub(r"（停用.*?）", "", title).strip() if retired else title,
                "section": cur_sec["id"], "retired": retired,
                "retiredNote": re.search(r"（停用[:：]?(.*?)）", title).group(1).strip() if retired else "",
                "fields": {}, "extra": [], "lessons": [],
            }
            continue
        if cur_sec and cur_point is None and line.startswith(">"):
            sec_note.append(strip_md(line.lstrip("> ").rstrip()))
            continue
        if cur_point is not None:
            m = FIELD_RE.match(line)
            if m:
                k, v = m.group(1).strip(), strip_md(m.group(2))
                if k in cur_point["fields"]:
                    cur_point["fields"][k] += "\n" + v
                else:
                    cur_point["fields"][k] = v
            elif line.startswith("- "):
                cur_point["extra"].append(strip_md(line[2:]))
            elif line.startswith("  - ") and cur_point["fields"]:
                # 欄位下的子條列，接在最後一個欄位後面
                last = list(cur_point["fields"].keys())[-1]
                cur_point["fields"][last] += "\n・" + strip_md(line.strip()[2:])
            elif line.startswith(">"):
                cur_point["extra"].append(strip_md(line.lstrip("> ")))
            continue
        if in_conj_table and line.startswith("|"):
            m = TABLE_ROW_RE.match(line)
            if not m:
                continue
            w = strip_md(m.group(1))
            if w in ("接續詞", "") or set(w) <= set("-:"):
                continue
            conjunctions.append({"word": w, "meaning": strip_md(m.group(2)), "example": strip_md(m.group(3)), "source": strip_md(m.group(4))})
    flush_point()

    used = taught_in()
    # 課程的 point 可能省略括號後綴（validate-lessons.py 也接受），兩邊都去掉括號再比一次
    def bare(t):
        return re.sub(r"（.*?）|\(.*?\)", "", t).strip()
    used_bare = {}
    for k, v in used.items():
        used_bare.setdefault(bare(k), []).extend(v)
    for p in points:
        # 一條標題可能列多個等價形（～てくれる／～てくださる），課程可能只寫其中一個
        pieces = [p["title"]] + [x.strip() for x in re.split(r"[／/]", p["title"]) if x.strip()]
        found = []
        for piece in pieces:
            found = used.get(piece) or used_bare.get(bare(piece)) or []
            if found:
                break
        p["lessons"] = found

    OUT.write_text(json.dumps({"sections": sections, "points": points, "conjunctions": conjunctions},
                              ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"已產生 {OUT}：{len(sections)} 章、{len(points)} 個文法點、{len(conjunctions)} 個接續詞")


if __name__ == "__main__":
    main()
