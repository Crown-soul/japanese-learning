#!/usr/bin/env python3
"""
掃描 lessons/ 資料夾裡的所有 .html 檔，
自動產生首頁 index.html（目錄／索引）。

日期規則（本機與 CI 要算出同一份，CI 才能檢查 index.html 沒過期）：
  1. 檔名開頭 YYYY-MM-DD → 用它
  2. 否則用該檔最後一次 commit 的日期（git log）
  3. 有未提交變更／不在 git 裡 → 用檔案 mtime（通常＝今天）
「最後更新」= 所有課程日期的最大值，不是執行當天。

用法：
    python3 build-index.py
"""

import re
import html
import datetime
import subprocess
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).parent
LESSONS_DIR = ROOT / "lessons"
OUTPUT = ROOT / "index.html"

TITLE_RE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)
DATE_PREFIX_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")


def read_title(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="ignore")
    m = TITLE_RE.search(text)
    if m:
        return html.unescape(m.group(1).strip())
    return path.stem


def git_commit_date(path: Path):
    """檔案最後一次 commit 的日期（YYYY-MM-DD）。
    有未提交的變更、或不在 git 裡 → 回 None（呼叫端改用 mtime）。
    這樣本機與 CI 算出來的日期一致，index.html 才不會每天／每台機器都不同。"""
    try:
        rel = str(path.relative_to(ROOT))
        run = lambda *a: subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True, timeout=10).stdout.strip()
        if run("status", "--porcelain", "--", rel):
            return None
        out = run("log", "-1", "--format=%cs", "--", rel)
        return datetime.date.fromisoformat(out) if out else None
    except Exception:
        return None


def lesson_date(path: Path) -> datetime.date:
    m = DATE_PREFIX_RE.match(path.stem)
    if m:
        try:
            return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass
    d = git_commit_date(path)
    if d:
        return d
    return datetime.date.fromtimestamp(path.stat().st_mtime)


def collect():
    files = sorted(LESSONS_DIR.glob("*.html"))
    items = []
    for f in files:
        items.append({
            "href": "lessons/" + urllib.parse.quote(f.name),
            "title": read_title(f),
            "date": lesson_date(f),
        })
    # 新的排前面
    items.sort(key=lambda x: x["date"], reverse=True)
    return items


PAGE = """<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>日文學習檔案目錄</title>
<style>
:root{{--bg:#f7f7f8;--card:#fff;--text:#1f2328;--muted:#6b7280;--line:#e5e7eb;--accent:#111827}}
*{{box-sizing:border-box}}
body{{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC","Noto Sans JP",sans-serif;background:var(--bg);color:var(--text);line-height:1.7}}
.app{{max-width:720px;margin:0 auto;padding:28px 16px 80px}}
h1{{font-size:1.4rem;margin:0 0 4px}}
.sub{{color:var(--muted);font-size:14px;margin-bottom:22px}}
ul{{list-style:none;margin:0;padding:0}}
li{{margin-bottom:12px}}
a.card{{display:block;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;text-decoration:none;color:inherit}}
a.card:hover{{border-color:#9ca3af}}
.t{{font-weight:700;font-size:1.05rem}}
.d{{color:var(--muted);font-size:13px;margin-top:4px}}
footer{{margin-top:28px;color:var(--muted);font-size:12px}}
</style>
</head>
<body>
<div class="app">
  <h1>日文學習檔案目錄</h1>
  <div class="sub">共 {count} 份 · 最後更新 {updated}</div>
  <ul>
{rows}
  </ul>
  <footer>此頁由 build-index.py 自動產生，請勿手動編輯。</footer>
</div>
</body>
</html>
"""

ROW = '''    <li><a class="card" href="{href}">
      <div class="t">{title}</div>
      <div class="d">{date}</div>
    </a></li>'''


def main():
    items = collect()
    rows = "\n".join(
        ROW.format(
            href=html.escape(it["href"]),
            title=html.escape(it["title"]),
            date=it["date"].isoformat(),
        )
        for it in items
    )
    page = PAGE.format(
        count=len(items),
        updated=(max(it["date"] for it in items) if items else datetime.date.today()).isoformat(),
        rows=rows,
    )
    OUTPUT.write_text(page, encoding="utf-8")
    print(f"已產生 {OUTPUT}（{len(items)} 份檔案）")
    for it in items:
        print(f"  - {it['date']}  {it['title']}")


if __name__ == "__main__":
    main()
