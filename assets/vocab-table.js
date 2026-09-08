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
       lessonTitles  : {課程id: 顯示名}（分組標題用；沒對到的 id 就顯示 id 本身）
       wordClickable : true → <tbody> 加 data-key，整個條目可點（給課文開詳解卡）

   版面：每個單字一個 <tbody>，內含兩列
     第一列：單字 / 讀音 / 詞性 / 中文（都短，一行放得下）
     第二列：例句（跨欄、佔整寬，才讀得下去）
   讀音欄：body.fg-none / fg-target 時藏起來（保留欄寬，切換不抖動）
   播放鈕：<button class="play" data-audio="要播的文字">，沿用各頁既有的 .play 處理。
   整條目點擊：頁面自己在容器上代理 —— e.target.closest("button") 先排除，
               再 e.target.closest("[data-key]") 取 dataset.key。
   ============================================================ */
(function () {
  var CSS = `
  .vt{--_c:var(--card,#fff);--_l:var(--line,#e5e7eb);--_t:var(--text,#1f2328);
      --_m:var(--muted,#6b7280);--_s:var(--soft,#eef2f7);--_h:var(--hl,#f2f4f7);--_f:var(--fs,18px);
      width:100%;border-collapse:collapse;background:var(--_c);border:1px solid var(--_l);
      border-radius:16px;overflow:hidden;margin:0 0 18px;color:var(--_t)}
  .vt th,.vt td{text-align:left;vertical-align:top;line-height:1.7}
  .vt thead th{font-size:12px;font-weight:600;color:var(--_m);background:var(--_s);
      letter-spacing:.04em;padding:11px 16px;border-bottom:1px solid var(--_l)}
  .vt tbody[data-key]{cursor:pointer}
  @media (hover:hover){ .vt tbody:hover td{background:var(--_h)} }

  .vt .vt-main td{padding:13px 16px 4px}
  .vt .vt-sub td{padding:0 16px 14px 44px;border-bottom:1px solid var(--_l)}
  .vt tbody:last-child .vt-sub td{border-bottom:0}

  .vt .vt-w{white-space:nowrap;font-weight:700;font-size:calc(var(--_f) + 1px)}
  .vt .vt-read{white-space:nowrap;color:var(--_t);font-size:calc(var(--_f) - 2px)}
  .vt .vt-pos{white-space:nowrap;color:var(--_m);font-size:calc(var(--_f) - 4px)}
  .vt .vt-zh{white-space:nowrap;font-size:calc(var(--_f) - 2px)}

  .vt .vt-exwrap{display:flex;align-items:flex-start;gap:10px;
      font-size:calc(var(--_f) - 2px);line-height:1.9;color:var(--_t)}
  .vt .vt-exwrap span{flex:1;min-width:0}

  .vt .vt-word{border-radius:4px}
  .vt .vt-word:focus-visible{outline:3px solid var(--_m);outline-offset:2px}
  .vt .play{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;
      min-height:0;padding:0;border-radius:50%;font-size:11px;flex:none;
      vertical-align:middle;border:1px solid var(--_l);
      background:var(--_c);color:var(--_t);cursor:pointer}
  .vt .vt-w .play{margin-right:10px}
  @media (hover:hover){ .vt .play:hover{background:var(--_h)} }
  .vt .play:focus-visible{outline:3px solid var(--_m);outline-offset:2px}

  .vt-group{font-size:calc(var(--fs,18px) - 2px);font-weight:700;color:var(--muted,#6b7280);
      margin:24px 0 10px}
  .vt-group:first-child{margin-top:0}

  body.fg-none .vt .vt-read,
  body.fg-target .vt .vt-read{visibility:hidden}

  @media (max-width:640px){
    .vt{display:block;border:0;background:transparent;border-radius:0}
    .vt thead{display:none}
    .vt tbody,.vt tbody tr,.vt td{display:block}
    .vt tbody{background:var(--_c);border:1px solid var(--_l);border-radius:14px;
        padding:8px 4px 10px;margin-bottom:12px}
    .vt .vt-main td,.vt .vt-sub td{padding:5px 16px;border-bottom:0}
    .vt td.vt-w{padding-top:8px;padding-bottom:2px;font-size:calc(var(--_f) + 3px)}
    .vt .vt-read,.vt .vt-pos,.vt .vt-zh{white-space:normal;font-size:calc(var(--_f) - 2px)}
    .vt .vt-sub td{padding-top:8px;padding-bottom:8px}
    .vt .vt-exwrap{font-size:calc(var(--_f) - 2px)}
    .vt .vt-read::before{content:"讀音　";color:var(--_m)}
    .vt .vt-pos::before{content:"詞性　";color:var(--_m)}
    .vt .vt-zh::before{content:"中文　";color:var(--_m)}
    .vt .play{width:34px;height:34px;font-size:13px}
    .vt .vt-w .play{margin-right:12px}
    body.fg-none .vt .vt-read,
    body.fg-target .vt .vt-read{display:none}
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
  function entryHTML(w, opts) {
    var k = esc(w.key || w.dict);
    var reading = w.reading && w.reading !== w.dict ? esc(w.reading) : "";
    var wordCell = opts.wordClickable
      ? '<span class="vt-word" tabindex="0" role="button" aria-label="' +
        esc(w.dict) + ' 詳解" data-key="' + k + '">' + esc(w.dict) + "</span>"
      : esc(w.dict);
    return (
      (opts.wordClickable ? '<tbody data-key="' + k + '">' : "<tbody>") +
      '<tr class="vt-main">' +
        '<td class="vt-w"><button class="play" data-audio="' + esc(w.dict) +
          '" aria-label="播放單字：' + esc(w.dict) + '">▶</button>' + wordCell + "</td>" +
        '<td class="vt-read" lang="ja">' + reading + "</td>" +
        '<td class="vt-pos">' + esc(w.pos) + "</td>" +
        '<td class="vt-zh">' + esc(w.zh) + "</td>" +
      "</tr>" +
      '<tr class="vt-sub"><td colspan="4"><div class="vt-exwrap">' +
        '<button class="play" data-audio="' + esc(w.ex) + '" aria-label="播放例句">▶</button>' +
        '<span lang="ja">' + esc(w.ex) + "</span>" +
      "</div></td></tr>" +
      "</tbody>"
    );
  }
  function tableHTML(rows, opts) {
    return (
      '<table class="vt"><thead><tr>' +
      "<th>單字</th><th>讀音</th><th>詞性</th><th>中文</th>" +
      "</tr></thead>" +
      rows.map(function (w) { return entryHTML(w, opts); }).join("") +
      "</table>"
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
      var name = (opts.lessonTitles && opts.lessonTitles[L]) || L;
      out += '<div class="vt-group">' + esc(name) + " ・ " + ws.length + " 字</div>" +
             tableHTML(ws, opts);
    });
    return out;
  };
})();
