/* ============================================================
   共用單字表元件
   兩處使用：lessons/日文70單字學習器.html 的「單字表」分頁、
             lessons/日文單字總表.html 的總表。
   需要頁面提供這些 CSS 變數：--card --line --text --muted --soft --hl --fs
   （缺了會退成淺色 fallback，不會整個壞；深色仍需頁面提供變數）
   自己注入樣式；只吐 HTML 字串，不綁事件。

   window.vocabTableHTML(rows, opts) -> HTML 字串
     rows : [{dict, reading, pos, zh, ex, key?, lessons?}]
     opts :
       group         : true → 依 lessons 分組（各組一個標題 + 一張表）
       wordClickable : true → <tr> 與單字加 data-key，整列可點（給課文開詳解卡）

   播放鈕：<button class="play" data-audio="要播的文字">，沿用各頁既有的 .play 處理。
   整列點擊：頁面自己在容器上代理 —— e.target.closest("button") 先排除，
             再 e.target.closest("[data-key]") 取 dataset.key。
   ============================================================ */
(function () {
  var CSS = `
  .vt{--_c:var(--card,#fff);--_l:var(--line,#e5e7eb);--_t:var(--text,#1f2328);
      --_m:var(--muted,#6b7280);--_s:var(--soft,#eef2f7);--_h:var(--hl,#f2f4f7);--_f:var(--fs,18px);
      width:100%;border-collapse:collapse;background:var(--_c);border:1px solid var(--_l);
      border-radius:16px;overflow:hidden;margin:0 0 16px;color:var(--_t)}
  .vt th,.vt td{border-bottom:1px solid var(--_l);padding:12px 14px;text-align:left;
      vertical-align:top;font-size:calc(var(--_f) - 3px);line-height:1.65}
  .vt thead th{font-size:12px;font-weight:600;color:var(--_m);background:var(--_s);letter-spacing:.03em}
  .vt tbody tr:last-child td{border-bottom:0}
  .vt tbody tr[data-key]{cursor:pointer}
  @media (hover:hover){ .vt tbody tr:hover td{background:var(--_h)} }
  .vt .vt-w{white-space:nowrap}
  .vt .vt-pos{color:var(--_m);font-size:calc(var(--_f) - 5px)}
  .vt .vt-ex{line-height:1.95}
  .vt .jp{font-weight:700}
  .vt .vt-word{border-radius:4px;padding:1px 2px}
  .vt tbody tr[data-key]:focus-within .vt-word,
  .vt .vt-word:focus-visible{outline:3px solid var(--_m);outline-offset:2px}
  .vt ruby rt{font-weight:500;color:var(--_m);font-size:.55em;letter-spacing:-.02em}
  .vt .play{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;
      min-height:0;padding:0;border-radius:50%;font-size:11px;margin-right:9px;flex:none;
      vertical-align:middle;border:1px solid var(--_l);background:var(--_c);color:var(--_t);cursor:pointer}
  @media (hover:hover){ .vt .play:hover{background:var(--_h)} }
  .vt .play:focus-visible{outline:3px solid var(--_m);outline-offset:2px}
  .vt-group{font-size:calc(var(--fs,18px) - 3px);font-weight:700;color:var(--muted,#6b7280);margin:22px 0 8px}
  .vt-group:first-child{margin-top:0}
  /* 表內每個字都是目標單字，「重點字」與「全隱」都收注音，只有「全部」顯示 */
  body.fg-none .vt ruby rt,
  body.fg-target .vt ruby rt{visibility:hidden;font-size:0}

  @media (max-width:600px){
    .vt{display:block;border:0;background:transparent;border-radius:0}
    .vt thead{display:none}
    .vt tbody,.vt tbody tr,.vt td{display:block}
    .vt tbody tr{background:var(--_c);border:1px solid var(--_l);border-radius:14px;
        padding:6px 2px 10px;margin-bottom:10px}
    .vt tbody tr:last-child td{border-bottom:0}
    .vt td{border-bottom:0;padding:5px 14px;font-size:var(--_f)}
    .vt td.vt-w{padding-top:8px;font-size:calc(var(--_f) + 1px)}
    .vt .vt-pos,.vt .vt-zh,.vt .vt-ex{font-size:calc(var(--_f) - 3px)}
    .vt .vt-pos::before{content:"詞性　";color:var(--_m)}
    .vt .vt-zh::before{content:"中文　";color:var(--_m)}
    .vt .vt-word{display:inline-block;padding:4px 6px;margin:-4px 0}
    .vt .play{width:34px;height:34px;font-size:13px;margin-right:10px}
  }
  `;
  var s = document.createElement("style");
  s.textContent = CSS;
  document.head.appendChild(s);

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function ruby(word, reading) {
    if (!reading || reading === word)
      return '<span class="jp" lang="ja">' + esc(word) + "</span>";
    return (
      '<span class="jp" lang="ja"><ruby>' +
      esc(word) + "<rt>" + esc(reading) + "</rt></ruby></span>"
    );
  }
  function rowHTML(w, opts) {
    var k = esc(w.key || w.dict);
    var wordInner = ruby(w.dict, w.reading);
    var wordCell = opts.wordClickable
      ? '<span class="vt-word" tabindex="0" role="button" aria-label="' +
        esc(w.dict) + ' 詳解" data-key="' + k + '">' + wordInner + "</span>"
      : wordInner;
    return (
      (opts.wordClickable ? '<tr data-key="' + k + '">' : "<tr>") +
      '<td class="vt-w"><button class="play" data-audio="' + esc(w.dict) +
        '" aria-label="播放單字：' + esc(w.dict) + '">▶</button>' + wordCell + "</td>" +
      '<td class="vt-pos">' + esc(w.pos) + "</td>" +
      '<td class="vt-zh">' + esc(w.zh) + "</td>" +
      '<td class="vt-ex"><button class="play" data-audio="' + esc(w.ex) +
        '" aria-label="播放例句">▶</button><span lang="ja">' + esc(w.ex) + "</span></td>" +
      "</tr>"
    );
  }
  function tableHTML(rows, opts) {
    return (
      '<table class="vt"><thead><tr><th>單字</th><th>詞性</th><th>中文</th><th>例句</th></tr></thead><tbody>' +
      rows.map(function (w) { return rowHTML(w, opts); }).join("") +
      "</tbody></table>"
    );
  }

  window.vocabTableHTML = function (rows, opts) {
    opts = opts || {};
    if (!opts.group) return tableHTML(rows, opts);
    var groups = new Map();
    rows.forEach(function (w) {
      var ls = w.lessons && w.lessons.length ? w.lessons : ["（未分類）"];
      ls.forEach(function (L) {
        if (!groups.has(L)) groups.set(L, []);
        groups.get(L).push(w);
      });
    });
    var out = "";
    groups.forEach(function (ws, L) {
      out += '<div class="vt-group">' + esc(L) + " ・ " + ws.length + " 字</div>" +
             tableHTML(ws, opts);
    });
    return out;
  };
})();
