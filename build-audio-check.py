#!/usr/bin/env python3
"""
產生 audio-check.html —— 一頁把 157 個語音檔全部列出來，
每個都有「▶ 播放」「✓ 沒問題 / ✗ 讀錯」按鈕，畫面會顯示課文想要的讀音當對照。
標記為 ✗ 的會自動集中到最下面，格式可直接貼回給 Claude 加進修正表。
進度存在瀏覽器裡，可以分幾次聽完。

用法：
    python3 build-audio-check.py
    # 然後開本機伺服器看 audio-check.html（要伺服器，file:// 讀不到 mp3）
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
LESSONS_DIR = ROOT / "lessons"
VOCAB_JSON = ROOT / "data" / "vocab.json"
MANIFEST = ROOT / "audio" / "manifest.json"
OUT = ROOT / "audio-check.html"

SFUNC_RE = re.compile(r'\$\{S\("[^"]*","([^"]*)"(?:,"([^"]*)")?\)\}')
FURIGANA_RE = re.compile(r"（[ぁ-んァ-ヶ・ーゝゞ〜]+）")
STORY_BLOCK_RE = re.compile(r"const story\d+\s*=\s*\[(.*?)\n\];", re.DOTALL)


def clean(raw: str) -> str:
    t = SFUNC_RE.sub(lambda m: m.group(1), raw)
    return FURIGANA_RE.sub("", t).strip()


def annotated(raw: str) -> str:
    # S("key","label","reading") -> label（reading）；其餘 漢字（かな） 保留
    return SFUNC_RE.sub(
        lambda m: m.group(1) + (f"（{m.group(2)}）" if m.group(2) else ""), raw
    ).strip()


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    vocab = json.loads(VOCAB_JSON.read_text(encoding="utf-8"))

    rows = []  # (section, text, hint, file)

    for w in vocab:
        if w["dict"] in manifest:
            rows.append(("單字", w["dict"], w["reading"], manifest[w["dict"]]))
    for w in vocab:
        if w["ex"] in manifest:
            rows.append(("例句", w["ex"], f'{w["dict"]}＝{w["reading"]}', manifest[w["ex"]]))

    for html_file in sorted(LESSONS_DIR.glob("*.html")):
        src = html_file.read_text(encoding="utf-8")
        for block in STORY_BLOCK_RE.finditer(src):
            for lit in re.findall(r"`([^`]*)`", block.group(1)):
                c = clean(lit)
                if c in manifest:
                    rows.append(("故事", c, annotated(lit), manifest[c]))

    # 去重（保順序）
    seen, uniq = set(), []
    for row in rows:
        if row[3] in seen:
            continue
        seen.add(row[3])
        uniq.append(row)

    items_json = json.dumps(
        [{"sec": s, "text": t, "hint": h, "file": f} for s, t, h, f in uniq],
        ensure_ascii=False,
    )

    page = """<!doctype html>
<html lang="zh-Hant">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>語音檢查表</title>
<style>
  :root{color-scheme:light dark}
  body{font:16px/1.6 system-ui,"Hiragino Sans","Noto Sans CJK JP",sans-serif;margin:0;padding:16px;max-width:820px;margin:auto}
  h1{font-size:1.2rem}
  .bar{position:sticky;top:0;background:Canvas;padding:8px 0;border-bottom:1px solid #8884;z-index:2}
  .row{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #8883}
  .row.done-ok{opacity:.4}
  .row.done-ng{background:#e5393522}
  .jp{font-size:1.15rem}
  .hint{color:#888;font-size:.9rem}
  .sec{font-size:.75rem;color:#888;min-width:2.6em}
  button{font:inherit;padding:4px 10px;border:1px solid #8886;border-radius:8px;background:ButtonFace;cursor:pointer}
  button.on-ok{background:#43a047;color:#fff;border-color:#43a047}
  button.on-ng{background:#e53935;color:#fff;border-color:#e53935}
  .acts{display:flex;gap:6px;flex-shrink:0}
  textarea{width:100%;height:160px;font:13px/1.5 ui-monospace,monospace;margin-top:8px}
  .grow{flex:1;min-width:0}
</style>
<h1>語音檢查表<span id="prog" class="hint"></span></h1>
<div class="bar">
  <button data-f="all">全部</button>
  <button data-f="todo">未檢查</button>
  <button data-f="ng">已標記讀錯</button>
  <button id="reset" style="float:right">清除進度</button>
</div>
<div id="list"></div>
<h2 style="font-size:1rem">讀錯清單（貼回給 Claude）</h2>
<textarea id="out" readonly></textarea>
<script>
const ITEMS = __ITEMS__;
const KEY = "audiocheck-v1";
let state = {};
try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){}
let filter = "all";
let audio = new Audio();

function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }
function play(f){ audio.pause(); audio = new Audio("audio/"+f); audio.play(); }

function render(){
  const list = document.getElementById("list");
  list.innerHTML = "";
  let ok=0,ng=0;
  ITEMS.forEach((it,i)=>{
    const st = state[it.file];
    if(st==="ok") ok++; if(st==="ng") ng++;
    if(filter==="todo" && st) return;
    if(filter==="ng" && st!=="ng") return;
    const row = document.createElement("div");
    row.className = "row" + (st==="ok"?" done-ok":st==="ng"?" done-ng":"");
    row.innerHTML =
      '<span class="sec">'+it.sec+'</span>'+
      '<div class="grow"><div class="jp" lang="ja">'+esc(it.text)+'</div>'+
      '<div class="hint">應讀：'+esc(it.hint)+'</div></div>'+
      '<div class="acts">'+
      '<button data-p="'+i+'">▶</button>'+
      '<button data-ok="'+i+'" class="'+(st==="ok"?"on-ok":"")+'">✓</button>'+
      '<button data-ng="'+i+'" class="'+(st==="ng"?"on-ng":"")+'">✗</button>'+
      '</div>';
    list.appendChild(row);
  });
  document.getElementById("prog").textContent =
    "　已檢查 "+(ok+ng)+" / "+ITEMS.length+"（讀錯 "+ng+"）";
  const bad = ITEMS.filter(it=>state[it.file]==="ng");
  document.getElementById("out").value = bad.length
    ? bad.map(it=> it.sec==="單字"
        ? '"'+it.text+'": "'+it.hint+'",'
        : '// '+it.sec+'：'+it.text+'（應讀 '+it.hint+'）\\n"": "",'
      ).join("\\n")
    : "（目前沒有標記讀錯的）";
}
function esc(s){ return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

document.getElementById("list").addEventListener("click",e=>{
  const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.p!=null) play(ITEMS[b.dataset.p].file);
  if(b.dataset.ok!=null){ const f=ITEMS[b.dataset.ok].file; state[f]=state[f]==="ok"?undefined:"ok"; save(); render(); }
  if(b.dataset.ng!=null){ const f=ITEMS[b.dataset.ng].file; state[f]=state[f]==="ng"?undefined:"ng"; save(); render(); }
});
document.querySelector(".bar").addEventListener("click",e=>{
  if(e.target.dataset.f){ filter=e.target.dataset.f; render(); }
  if(e.target.id==="reset" && confirm("清除所有檢查進度？")){ state={}; save(); render(); }
});
render();
</script>
</html>
"""
    page = page.replace("__ITEMS__", items_json)
    OUT.write_text(page, encoding="utf-8")
    print(f"寫出 {OUT}（{len(uniq)} 個語音檔）")


if __name__ == "__main__":
    main()
