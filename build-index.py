#!/usr/bin/env python3
"""
掃描 lessons/ 資料夾裡的所有 .html 檔，
自動產生首頁 index.html（目錄／索引）。

日期規則（本機與 CI 要算出同一份，CI 才能檢查 index.html 沒過期）：
  1. 檔名開頭 YYYY-MM-DD → 用它
  2. 否則用該檔最後一次 commit 的日期（git log）
  3. 有未提交變更／不在 git 裡 → 用檔案 mtime（通常＝今天）
「最後更新」= 所有課程日期的最大值，不是執行當天。

排序 = 課程順序、新到舊（最新的課在最上面），不是更新順序：
  依「該檔第一次被 commit 的時間」由新到舊；還沒 commit 的新檔排最上面。
  之後修改舊課不會讓它跳到前面。（要改成舊到新，把 collect() 結尾的 sort 拿掉 reverse=True）

引擎課（有 data/lessons/<id>.json）的卡片會多顯示「幾個字 · 幾個文法點 · 幾篇（＋會話）」；
「今天要複習」那塊與各課的學習狀態（熟練字數、流程完成幾篇、小考最高分）是前端 JS 讀 assets/store.js 填的，這裡只放骨架。
版面分四區：開始學（引擎課）→ 每日複習 → 工具（沒有單字資料的頁面）→ 舊版（有單字、但不是引擎課）。

用法：
    python3 build-index.py
"""

import re
import json
import html
import datetime
import subprocess
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).parent
LESSONS_DIR = ROOT / "lessons"
LESSON_DATA_DIR = ROOT / "data" / "lessons"
VOCAB_JSON = ROOT / "data" / "vocab.json"
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


def first_added_ts(path: Path) -> float:
    """檔案第一次被 commit 的時間（unix 秒）＝課程順序。修改不會改變它。
    還沒 commit（新課）／不在 git 裡 → 用 mtime（比所有已 commit 的都晚，所以排最後）。
    這裡刻意不加 --follow：薄殼內容幾乎一樣，會被誤判成複製而算成別課的日期。"""
    try:
        rel = str(path.relative_to(ROOT))
        out = subprocess.run(["git", "log", "--diff-filter=A", "--format=%ct", "--", rel],
                             cwd=ROOT, capture_output=True, text=True, timeout=10).stdout.split()
        if out:
            return float(out[-1])
    except Exception:
        pass
    return path.stat().st_mtime


def lesson_meta(stem: str, vocab_counts: dict):
    """引擎課才有：字數／文法點數／篇數。舊課回 None。"""
    jf = LESSON_DATA_DIR / f"{stem}.json"
    if not jf.exists():
        return None
    try:
        d = json.loads(jf.read_text(encoding="utf-8"))
    except Exception:
        return None
    stories = d.get("stories") or []
    return {
        "words": vocab_counts.get(stem, 0),
        "grammar": len(d.get("grammar") or []),
        "stories": sum(1 for s in stories if not (isinstance(s, dict) and s.get("kind") == "dialogue")),
        "dialogues": sum(1 for s in stories if isinstance(s, dict) and s.get("kind") == "dialogue"),
        "total": len(stories),
    }


def collect():
    vocab_counts = {}
    if VOCAB_JSON.exists():
        try:
            for w in json.loads(VOCAB_JSON.read_text(encoding="utf-8")):
                for l in w.get("lessons") or []:
                    vocab_counts[l] = vocab_counts.get(l, 0) + 1
        except Exception:
            pass
    files = sorted(LESSONS_DIR.glob("*.html"))
    items = []
    for f in files:
        items.append({
            "id": f.stem,
            "href": "lessons/" + urllib.parse.quote(f.name),
            "title": read_title(f),
            "date": lesson_date(f),
            "order": first_added_ts(f),
            "meta": lesson_meta(f.stem, vocab_counts),
            "words": vocab_counts.get(f.stem, 0),   # 舊課也可能在 vocab.json 有字（lessons 用中文 id）
        })
    # 課程順序、新到舊（見檔頭說明）；同時間再依檔名，讓結果固定
    items.sort(key=lambda x: (x["order"], x["id"]), reverse=True)
    return items


PAGE = """<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="color-scheme" content="light dark" />
<title>日文學習檔案目錄</title>
<style>
:root{{--bg:#f7f7f8;--card:#fff;--text:#1f2328;--muted:#6b7280;--line:#e5e7eb;--accent:#111827;--soft:#eef2f7;--gram:#7a4a8f}}
@media (prefers-color-scheme:dark){{
  :root:not([data-theme="light"]){{--bg:#16181c;--card:#1f2329;--text:#e6e7ea;--muted:#9aa1ab;--line:#333842;--accent:#e6e7ea;--soft:#2a2f37;--gram:#cf9fe6}}
}}
:root[data-theme="dark"]{{--bg:#16181c;--card:#1f2329;--text:#e6e7ea;--muted:#9aa1ab;--line:#333842;--accent:#e6e7ea;--soft:#2a2f37;--gram:#cf9fe6}}
*{{box-sizing:border-box}}
body{{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC","Noto Sans JP",sans-serif;background:var(--bg);color:var(--text);line-height:1.7}}
.app{{max-width:720px;margin:0 auto;padding:28px 16px 80px}}
h1{{font-size:1.4rem;margin:0 0 4px}}
.sub{{color:var(--muted);font-size:14px;margin-bottom:18px}}
.review{{display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:22px;text-decoration:none;color:inherit}}
.review b{{font-size:1.6rem;line-height:1;font-variant-numeric:tabular-nums}}
.review .l{{flex:1;min-width:0}}
.review .l span{{display:block;color:var(--muted);font-size:13px}}
.review .go{{border:1px solid var(--line);border-radius:999px;padding:8px 14px;font-size:14px;white-space:nowrap;background:var(--accent);color:var(--bg)}}
.review.quiet .go{{background:transparent;color:var(--text)}}
h2{{font-size:.85rem;letter-spacing:.06em;color:var(--muted);font-weight:600;margin:22px 0 10px}}
.hint{{color:var(--muted);font-size:13px;margin:-4px 0 10px}}
ul{{list-style:none;margin:0;padding:0}}
li{{margin-bottom:12px}}
a.card{{display:block;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;text-decoration:none;color:inherit}}
a.card:hover{{border-color:#9ca3af}}
.t{{font-weight:700;font-size:1.05rem}}
.d{{color:var(--muted);font-size:13px;margin-top:4px;display:flex;flex-wrap:wrap;gap:4px 12px}}
.st{{margin-top:8px;height:6px;background:var(--line);border-radius:999px;overflow:hidden;display:none}}
.st>i{{display:block;height:100%;background:var(--accent);width:0}}
.stt{{font-size:12px;color:var(--muted);margin-top:4px;display:none}}
.tools{{display:flex;gap:8px;flex-wrap:wrap}}
.tools a{{border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:13px;text-decoration:none;color:var(--text);background:var(--card)}}
footer{{margin-top:28px;color:var(--muted);font-size:12px}}
</style>
</head>
<body>
<div class="app">
  <h1>日文學習檔案目錄</h1>
  <div class="sub">共 {count} 份 · 最後更新 {updated}</div>
  <h2>開始學</h2>
  <div class="hint">一課分成幾篇，一天一篇：進課程照每篇標題下的 ①→⑤ 走。</div>
  <ul>
{rows}
  </ul>
  <h2>每日複習</h2>
  <a class="review quiet" id="reviewBox" href="review.html">
    <b id="dueN">–</b>
    <div class="l">今天要複習<span id="dueSub">讀取中…</span></div>
    <span class="go">開始複習</span>
  </a>
  <h2>工具</h2>
  <div class="tools">
    <a href="review.html">跨課複習中心</a>
{tools}
  </div>
{legacy}
  <footer>此頁由 build-index.py 自動產生，請勿手動編輯。</footer>
</div>
<script src="assets/store.js"></script>
<script>
(function(){{
  var S = window.JLStore; if (!S) return;
  try {{
    var t = S.getSettings().theme;
    if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
  }} catch (e) {{}}
  fetch("data/vocab.json").then(function (r) {{ return r.ok ? r.json() : []; }}).then(function (list) {{
    var ids = [];
    document.querySelectorAll("a.card[data-id]").forEach(function (a) {{ ids.push(a.dataset.id); }});
    S.migrateLegacy(ids.filter(function (id) {{ return /^[a-z0-9-]+$/.test(id); }}));
    var byLesson = {{}}, all = [];
    (list || []).forEach(function (w) {{
      all.push(w.key);
      (w.lessons || []).forEach(function (l) {{ (byLesson[l] = byLesson[l] || []).push(w.key); }});
    }});
    var dueV = S.dueVocab(all).length, dueG = S.dueGrammar().length;
    var box = document.getElementById("reviewBox");
    document.getElementById("dueN").textContent = dueV + dueG;
    document.getElementById("dueSub").textContent = (dueV || dueG)
      ? "單字 " + dueV + " · 文法 " + dueG + " · 混合所有課程"
      : "今天沒有到期的。想多練可以直接進課程。";
    box.classList.toggle("quiet", !(dueV || dueG));
    document.querySelectorAll("a.card[data-id]").forEach(function (a) {{
      var keys = byLesson[a.dataset.id]; if (!keys || !keys.length) return;
      var st = S.stats("vocab", keys);
      var bar = a.querySelector(".st"), txt = a.querySelector(".stt");
      if (!st.master && !st.learning) {{ txt.style.display = "block"; txt.textContent = "還沒開始"; return; }}
      bar.style.display = "block"; bar.firstElementChild.style.width = (st.master / st.total * 100) + "%";
      txt.style.display = "block";
      var n = +a.dataset.stories || 0, read = 0;
      for (var i = 1; i <= +(a.dataset.total || n); i++) if (S.getStory(a.dataset.id, i).read) read++;
      var ex = S.getExam(a.dataset.id);
      txt.textContent = "熟練 " + st.master + " / " + st.total + (st.due ? " · 今日到期 " + st.due : "") + (st.graduated ? " · 畢業 " + st.graduated : "") +
        (read ? " · 讀過 " + read + " / " + (+a.dataset.total || n) + " 篇" : "") + (ex ? " · 小考最高 " + ex.best + " / " + ex.total : "");
    }});
  }}).catch(function () {{
    document.getElementById("dueSub").textContent = "需要用伺服器或線上版開啟才能算";
  }});
}})();
</script>
</body>
</html>
"""

ROW = '''    <li><a class="card" href="{href}" data-id="{id}"{extra}>
      <div class="t">{title}</div>
      <div class="d"><span>{date}</span>{meta}</div>
      <div class="st"><i></i></div><div class="stt"></div>
    </a></li>'''


def main():
    items = collect()
    rows, tools, legacy = [], [], []
    for it in items:
        # 沒有單字資料的頁面是工具（單字總表、動詞工具、文法查詢），不是課程
        if not it["meta"] and not it["words"]:
            tools.append(f'    <a href="{html.escape(it["href"])}">{html.escape(it["title"])}</a>')
            continue
        meta = ""
        if it["meta"]:
            m = it["meta"]
            meta = (f'<span>{m["words"]} 字</span><span>{m["grammar"]} 個文法點</span><span>{m["stories"]} 篇</span>'
                    + ('<span>＋會話</span>' if m["dialogues"] else ''))
        elif it["words"]:
            meta = f'<span>{it["words"]} 字</span>'
        target = rows if it["meta"] else legacy
        target.append(ROW.format(
            extra=(f' data-stories="{it["meta"]["stories"]}" data-total="{it["meta"]["total"]}"' if it["meta"] else ""),
            href=html.escape(it["href"]),
            id=html.escape(it["id"]),
            title=html.escape(it["title"]),
            date=it["date"].isoformat(),
            meta=meta,
        ))
    page = PAGE.format(
        count=len(items),
        updated=(max(it["date"] for it in items) if items else datetime.date.today()).isoformat(),
        rows="\n".join(rows),
        tools="\n".join(tools),
        legacy=("  <h2>舊版</h2>\n  <ul>\n" + "\n".join(legacy) + "\n  </ul>") if legacy else "",
    )
    OUTPUT.write_text(page, encoding="utf-8")
    print(f"已產生 {OUTPUT}（{len(items)} 份檔案）")
    for it in items:
        print(f"  - {it['date']}  {it['title']}")


if __name__ == "__main__":
    main()
