/* ============================================================
   課程共用引擎
   薄殼 lessons/<id>.html 只需要：
     <link rel="stylesheet" href="../assets/lesson.css">
     <title>故事標題</title>
     <div class="app" id="app" data-lesson="<id>"></div>
     <script src="../assets/vocab-table.js"></script>
     <script src="../assets/lesson-engine.js"></script>

   資料：../data/lessons/<id>.json（見 docs/lesson-authoring.md）
         ../data/vocab.json（共用單字庫，取 lessons 含 <id> 的字）
         ../audio/manifest.json（乾淨文字 -> mp3 檔名）

   行為移植自 lessons/日文70單字學習器.html（v4）。
   localStorage 全部以 "<id>:" 前綴，各課進度獨立。
   ============================================================ */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var LESSON_ID = app && app.dataset.lesson;
  if (!app || !LESSON_ID) { console.error("缺少 #app[data-lesson]"); return; }
  var NS = LESSON_ID + ":";
  var TITLE = document.title || LESSON_ID;

  /* ---------- 小工具 ---------- */
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(NS + k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(NS + k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(NS + k); } catch (e) {} }
  };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function $(id) { return document.getElementById(id); }

  /* ---------- 注音 / 目標單字 標記解析 ---------- */
  var KANJI = "一-鿿々〆ヶ";
  var KANA = "ぁ-んァ-ヶ・ーゝゞ〜";   // 與 generate-audio.py 的 FURIGANA_RE 一致
  var FURI_RE = new RegExp("([" + KANJI + "]+)（([" + KANA + "]+)）", "g");
  var STRIP_FURI_RE = new RegExp("（[" + KANA + "]+）", "g");
  var TARGET_RE = /\{\{([^{}|]+)\|([^{}|]+)(?:\|([^{}]*))?\}\}/g;
  var MARK_RE = /@@T(\d+)@@/g;
  var GRAM_OPEN_RE = /\[\[g(\d+)\]\]/g;   // 文法點標記：[[g<grammar[]索引>]]…[[/g]]
  var GRAM_CLOSE_RE = /\[\[\/g\]\]/g;

  function furiganize(s) {
    return s.replace(FURI_RE, function (m, k, r) {
      return "<ruby>" + esc(k) + "<rt>" + esc(r) + "</rt></ruby>";
    });
  }
  function wordSpan(w) {
    var inner = w.reading
      ? "<ruby>" + esc(w.label) + '<rt class="rt-t">' + esc(w.reading) + "</rt></ruby>"
      : esc(w.label);
    return '<span class="word" tabindex="0" role="button" data-key="' + esc(w.key) + '">' + inner + "</span>";
  }
  // 一段 -> {plain（音檔 key）, html}
  function parsePara(raw) {
    var words = [];
    var t = String(raw).replace(TARGET_RE, function (m, k, label, reading) {
      words.push({ key: k.trim(), label: label.trim(), reading: (reading || "").trim() });
      return "@@T" + (words.length - 1) + "@@";
    });
    var plain = t.replace(MARK_RE, function (m, i) { return words[+i].label; })
                 .replace(STRIP_FURI_RE, "")
                 .replace(GRAM_OPEN_RE, "").replace(GRAM_CLOSE_RE, "").trim();
    var html = furiganize(t).replace(MARK_RE, function (m, i) { return wordSpan(words[+i]); })
                 .replace(GRAM_OPEN_RE, function (m, gi) { return '<span class="gram" data-g="' + gi + '" tabindex="0" role="button">'; })
                 .replace(GRAM_CLOSE_RE, '<span class="gram-badge" aria-hidden="true">文</span></span>');
    return { plain: plain, html: html };
  }

  /* ---------- 語音 ---------- */
  var AUDIO = {}, voicesCache = [], curAudio = null, seqStop = false;
  function loadVoices() { try { voicesCache = speechSynthesis.getVoices() || []; } catch (e) {} }
  if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  function stopAudio() {
    seqStop = true;
    try { if (curAudio) { curAudio.pause(); curAudio = null; } } catch (e) {}
    try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch (e) {}
    document.querySelectorAll(".playall.playing").forEach(function (b) {
      b.classList.remove("playing"); b.textContent = "▶ 全篇";
    });
  }
  function speak(text, onDone) {
    if (!("speechSynthesis" in window)) { if (onDone) onDone(); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP"; u.rate = 0.85;
    var ja = voicesCache.find(function (v) { return /^ja(-|_)/i.test(v.lang); });
    if (ja) u.voice = ja;
    if (onDone) u.onend = u.onerror = function () { onDone(); };
    speechSynthesis.speak(u);
  }
  function play(text, onDone) {
    if (!text) { if (onDone) onDone(); return; }
    var file = AUDIO[text];
    if (file && /^[0-9a-f]{8,40}\.mp3$/.test(file)) {
      try {
        if (curAudio) { curAudio.pause(); curAudio = null; }
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        curAudio = new Audio("../audio/" + file);
        if (onDone) curAudio.onended = function () { onDone(); };
        curAudio.play().catch(function () { speak(text, onDone); });
        return;
      } catch (e) {}
    }
    speak(text, onDone);
  }
  function playStory(storyEl, btn) {
    var texts = [].slice.call(storyEl.querySelectorAll(".play")).map(function (p) { return p.dataset.audio; });
    seqStop = false;
    btn.classList.add("playing"); btn.textContent = "■ 停止";
    var i = 0;
    (function step() {
      if (seqStop || i >= texts.length) { btn.classList.remove("playing"); btn.textContent = "▶ 全篇"; return; }
      play(texts[i++], step);
    })();
  }

  /* ---------- 主題 / 字級 ---------- */
  function applyTheme() {
    var t = LS.get("theme", "auto");
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }
  function applyFont() {
    document.documentElement.style.setProperty("--fs", LS.get("fs", "18") + "px");
  }

  /* ---------- SRS（Leitner 精簡版）---------- */
  var SRS_INTERVAL = [0, 1, 3, 7, 16];
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function today() { return ymd(new Date()); }
  function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return ymd(d); }
  function fmtDate(s) { return s ? s.slice(5).replace("-", "/") : "-"; }
  function srsData() { try { return JSON.parse(LS.get("srs", "{}")); } catch (e) { return {}; } }
  function saveSrs(d) { LS.set("srs", JSON.stringify(d)); updateProgress(); }

  /* ---------- 資料容器 ---------- */
  var DATA = null;                 // 課程 JSON
  var vocab = {};                  // key -> {dict,reading,pos,zh,form,ex,...}
  var currentCardKey = null;
  var curTab = "stories";

  /* ============================================================
     版面
     ============================================================ */
  function shell() {
    app.innerHTML =
      '<header>' +
        '<div class="hrow"><a class="backlink" href="../">← 回目錄</a>' +
        '<button class="gear" id="gearBtn" aria-label="設定">⚙︎</button></div>' +
        '<h1>' + esc(TITLE) + '</h1>' +
        '<div class="ctl-row" id="readingRow" role="group" aria-label="注音與遮字">' +
          '<span class="grp">' +
          '<button data-rd="all">全部注音</button>' +
          '<button data-rd="target">藏重點字注音</button>' +
          '<button data-rd="none">全部隱藏</button>' +
          '<button data-rd="mask">遮住重點字</button></span></div>' +
      '</header>' +
      '<div class="hud" id="hud">' +
        '<div class="progressbar" aria-label="學習進度"><div id="progressFill"></div></div>' +
        '<div class="progresstext" id="progressText"></div>' +
        '<div class="stats">' +
          '<div class="stat"><b id="statMaster">0</b><span>熟練</span></div>' +
          '<div class="stat"><b id="statLearning">0</b><span>學習中</span></div>' +
          '<div class="stat"><b id="statDue">0</b><span>今日到期</span></div>' +
          '<div class="stat"><b id="statNew">0</b><span>未學</span></div>' +
        '</div></div>' +
      storiesSection() +
      '<section id="vocabtable" class="section">' +
        '<div class="legend">本課單字一覽。點任一列看詳解與複習狀態，列首的 ▶ 可聽發音。</div>' +
        '<div id="vocabTableHost"></div>' +
      '</section>' +
      quizSection() +
      grammarSection() +
      '<nav class="tabs" id="tabs" aria-label="分頁">' +
        '<button data-tab="stories">故事</button>' +
        '<button data-tab="vocabtable">單字表</button>' +
        '<button data-tab="quiz">單字測驗</button>' +
        '<button data-tab="grammar">文法</button>' +
      '</nav>';
  }

  function storiesSection() {
    var cards = DATA.stories.map(function (s, i) {
      var hasTr = Array.isArray(s.translation) && s.translation.length > 0;
      return '<article class="story-card" data-story="' + i + '">' +
        '<div class="story-head">' +
          '<h2 lang="ja">' + esc(s.title || ("篇" + (i + 1))) + '</h2>' +
          '<span class="story-tools">' +
            '<button class="playall" data-story="' + i + '">▶ 全篇</button>' +
            (hasTr ? '<span class="lang-tabs" role="group" aria-label="語言切換">' +
              '<button class="active" data-lang="ja">日文</button>' +
              '<button data-lang="both">對照</button>' +
              '<button data-lang="zh">中文</button></span>' : '') +
          '</span>' +
        '</div>' +
        '<div class="story-text" id="story' + i + '" data-lang="ja"></div>' +
        '</article>';
    }).join("");
    var rqFilters = '<button class="active" data-rqfilter="all">全部</button>';
    if (DATA.stories.length > 1) {
      DATA.stories.forEach(function (s, i) {
        rqFilters += '<button data-rqfilter="s' + (i + 1) + '">篇' + cn(i + 1) + '</button>';
      });
    }
    rqFilters += '<button data-rqfilter="ng">只練答錯的</button>';
    return '<section id="stories" class="section active">' +
      '<div class="subtabs" role="group" aria-label="故事分頁">' +
        '<button class="active" data-sview="read">閱讀</button>' +
        '<button data-sview="quiz">讀解測驗</button></div>' +
      '<div id="storyRead">' +
        '<details class="tip" id="tip"><summary>怎麼用這一課</summary>' +
        '<div>點粗體重點字看詳解，段首 ▶ 聽整段，紫色「文」是文法點。' +
        '建議順序：先「全部注音」聽讀 → 「藏重點字注音」練讀音 → 「遮住重點字」練回想 → 單字測驗 → 文法克漏字 → 讀解測驗。</div></details>' +
        cards +
      '</div>' +
      '<div id="storyQuizWrap" hidden>' +
        '<div class="filter-row" aria-label="讀解篩選">' + rqFilters + '</div>' +
        '<div class="small" id="rqInfo"></div>' +
        '<div class="quiz-card">' +
          '<div class="small" id="rqCount"></div>' +
          '<div class="gq-sentence" id="rqQuestion" lang="ja"></div>' +
          '<div class="gq-opts" id="rqOpts"></div>' +
          '<div class="gq-explain" id="rqExplain"></div>' +
          '<div class="quiz-controls"><button id="rqNext">下一題</button></div>' +
        '</div>' +
      '</div></section>';
  }

  function quizSection() {
    return '<section id="quiz" class="section">' +
      '<div class="subtabs" role="group" aria-label="測驗方式">' +
        '<button class="active" data-qdir="jpzh">日→中</button>' +
        '<button data-qdir="zhjp">中→日</button>' +
        '<button data-qdir="listen">聽力</button></div>' +
      '<div class="filter-row" aria-label="測驗篩選">' +
        '<button class="active" data-qfilter="all">全部</button>' +
        '<button data-qfilter="due">今日複習</button>' +
        '<button data-qfilter="new">未學過</button>' +
        '<span class="small" id="filterInfo"></span></div>' +
      '<div class="quiz-card">' +
        '<div class="small" id="quizCount"></div>' +
        '<div class="quiz-q" id="quizQuestion"></div>' +
        '<div class="quiz-hint" id="quizHint"></div>' +
        '<div class="quiz-answer" id="quizAnswer"></div>' +
        '<div class="quiz-controls" id="quizPre">' +
          '<button id="showAnswer" class="primary">顯示答案</button>' +
          '<button id="speakQuiz">▶ 播放</button>' +
          '<button id="nextQuiz">略過</button></div>' +
      '</div>' +
      '<div class="quiz-dock" id="quizDock" hidden>' +
        '<button class="status-btn bad" data-status="bad">不記得<small>1</small></button>' +
        '<button class="status-btn mid" data-status="mid">有點模糊<small>2</small></button>' +
        '<button class="status-btn good" data-status="good">記得<small>3</small></button>' +
      '</div></section>';
  }

  function grammarSection() {
    return '<section id="grammar" class="section grammar">' +
      '<div class="subtabs" role="group" aria-label="文法分頁">' +
        '<button class="active" data-gview="table">對照表</button>' +
        '<button data-gview="quiz">克漏字練習</button></div>' +
      '<div id="grammarTable"><div class="story-card">' +
        '<table><thead><tr><th>文法</th><th>例句</th><th>意思</th></tr></thead>' +
        '<tbody id="grammarBody"></tbody></table></div></div>' +
      '<div id="grammarQuizWrap" hidden>' +
        '<div class="filter-row" aria-label="克漏字篩選">' +
          '<button class="active" data-gqfilter="all">全部</button>' +
          '<button data-gqfilter="ng">只練答錯的</button>' +
          '<span class="small" id="gqInfo"></span></div>' +
        '<div class="quiz-card">' +
          '<div class="small" id="gqCount"></div>' +
          '<div class="gq-sentence" id="gqSentence" lang="ja"></div>' +
          '<div class="gq-opts" id="gqOpts"></div>' +
          '<div class="gq-explain" id="gqExplain"></div>' +
          '<div class="quiz-controls"><button id="gqNext">下一題</button></div>' +
        '</div></div>' +
    '</section>';
  }
  function cn(n) { return "一二三四五六七八九十".charAt(n - 1) || String(n); }

  /* ============================================================
     渲染
     ============================================================ */
  function renderStories() {
    DATA.stories.forEach(function (s, i) {
      var tr = Array.isArray(s.translation) ? s.translation : [];
      $("story" + i).innerHTML = s.paragraphs.map(function (raw, pi) {
        var p = parsePara(raw);
        return '<div class="para">' +
          '<p class="ja" lang="ja"><button class="play" data-audio="' + esc(p.plain) + '" aria-label="播放這段">▶</button>' + p.html + "</p>" +
          (tr[pi] ? '<p class="zh" lang="zh-Hant">' + esc(tr[pi]) + "</p>" : "") +
          "</div>";
      }).join("");
    });
  }
  function renderGrammarTable() {
    $("grammarBody").innerHTML = (DATA.grammar || []).map(function (g, i) {
      return '<tr class="grow" data-g="' + i + '" tabindex="0"><td lang="ja">' + esc(g.point) + '</td><td lang="ja">' + esc(g.example) + "</td><td>" + esc(g.meaning) + "</td></tr>";
    }).join("");
  }
  function renderVocabTab() {
    var host = $("vocabTableHost");
    if (!host) return;
    if (window.vocabTableHTML) host.innerHTML = window.vocabTableHTML(Object.values(vocab), { wordClickable: true });
    else host.innerHTML = '<p class="legend">單字表元件載入失敗，請重新整理。</p>';
  }

  /* ---------- 注音四態：all / target / none / mask ---------- */
  var readingMode = LS.get("reading", "all");
  if (["all", "target", "none", "mask"].indexOf(readingMode) < 0) readingMode = "all";
  function applyReading() {
    var fg = readingMode === "mask" ? "all" : readingMode;
    document.body.classList.remove("fg-all", "fg-target", "fg-none");
    document.body.classList.add("fg-" + fg);
    document.querySelectorAll("#storyRead .word").forEach(function (w) {
      w.classList.remove("blank", "revealed");
      if (readingMode === "mask") w.classList.add("blank");
    });
    document.querySelectorAll("[data-rd]").forEach(function (b) { b.classList.toggle("active", b.dataset.rd === readingMode); });
  }
  function activateWord(w) {
    var hiddenReading = (readingMode === "target" || readingMode === "none") && w.querySelector("rt.rt-t") && !w.classList.contains("revealed");
    if (readingMode === "mask") {
      if (!w.classList.contains("revealed")) { w.classList.remove("blank"); w.classList.add("revealed"); return; }
    } else if (hiddenReading) { w.classList.add("revealed"); return; }
    openCard(w.dataset.key);
  }

  /* ---------- 單字詳解 modal ---------- */
  var modal, sheet;
  function openCard(key) {
    var v = vocab[key];
    if (!v) return;
    currentCardKey = key;
    var rec = srsData()[key];
    var boxTxt = !rec ? "尚未練習"
      : rec.box >= 4 ? "熟練 · 下次 " + fmtDate(rec.due)
      : rec.box >= 1 ? "學習中（box " + rec.box + "）· 下次 " + fmtDate(rec.due)
      : "要加強 · 今日到期";
    sheet.innerHTML =
      '<button class="sheet-close" data-act="close">關閉</button>' +
      '<h3 lang="ja">' + esc(v.dict) + "</h3>" +
      '<div class="meta"><span lang="ja">' + esc(v.reading) + "</span>｜" + esc(v.pos) + "</div>" +
      '<div class="kv"><strong>中文</strong><div>' + esc(v.zh) + "</div></div>" +
      (v.form ? '<div class="kv"><strong>本文形式</strong><div lang="ja">' + esc(v.form) + "</div></div>" : "") +
      '<div class="kv"><strong>例句</strong><div class="example" lang="ja">' + esc(v.ex) + "</div></div>" +
      '<div class="actions">' +
        '<button data-act="play-dict">▶ 單字</button>' +
        '<button data-act="play-ex">▶ 例句</button>' +
        '<a class="btn" target="_blank" rel="noopener" href="https://jisho.org/search/' + encodeURIComponent(v.dict) + '">查 Jisho ↗</a></div>' +
      '<div class="kv"><strong>複習</strong><div class="small" style="margin-top:4px">' + boxTxt + "</div>" +
        '<div class="actions">' +
          '<button class="status-btn bad" data-act="rate" data-val="bad">不記得</button>' +
          '<button class="status-btn mid" data-act="rate" data-val="mid">有點模糊</button>' +
          '<button class="status-btn good" data-act="rate" data-val="good">記得</button></div></div>';
    modal.classList.add("show");
  }
  function openGrammarCard(idx) {
    var g = (DATA.grammar || [])[idx];
    if (!g) return;
    sheet.innerHTML =
      '<button class="sheet-close" data-act="close">關閉</button>' +
      '<h3 lang="ja">' + esc(g.point) + "</h3>" +
      '<div class="kv"><strong>例句</strong><div class="example" lang="ja">' + esc(g.example) + "</div></div>" +
      '<div class="kv"><strong>意思</strong><div>' + esc(g.meaning) + "</div></div>" +
      (g.n4ref ? '<div class="kv"><strong>N4 依據</strong><div class="small">' + esc(g.n4ref) + "</div></div>" : "") +
      '<div class="actions"><button data-act="goto-grammar">查看文法對照表 →</button></div>';
    modal.classList.add("show");
  }
  function rateSrs(key, rating) {
    var d = srsData(), cur = d[key] || { box: 0 }, t = today();
    var box = cur.box | 0;
    if (rating === "good") box = Math.min(4, box + 1);
    else if (rating === "mid") box = Math.max(1, box);
    else box = 0;
    var days = rating === "bad" ? 0 : SRS_INTERVAL[box];
    d[key] = { box: box, due: addDays(days), seen: t };
    saveSrs(d);
    if (modal.classList.contains("show")) openCard(key);
  }

  function keysAll() { return Object.keys(vocab); }
  function dueKeys() { var d = srsData(), t = today(); return keysAll().filter(function (k) { return d[k] && d[k].due <= t; }); }
  function newKeys() { var d = srsData(); return keysAll().filter(function (k) { return !d[k]; }); }
  function updateProgress() {
    var d = srsData(), keys = keysAll(), t = today();
    var master = 0, learning = 0, fresh = 0, due = 0;
    keys.forEach(function (k) {
      var r = d[k];
      if (!r) { fresh++; return; }
      if (r.box >= 4) master++; else learning++;
      if (r.due <= t) due++;
    });
    $("progressText").textContent =
      "熟練 " + master + " / " + keys.length + (due ? " · 今日複習 " + due : "");
    $("progressFill").style.width = (keys.length ? master / keys.length * 100 : 0) + "%";
    $("statMaster").textContent = master;
    $("statLearning").textContent = learning;
    $("statDue").textContent = due;
    $("statNew").textContent = fresh;
  }

  /* ---------- 單字測驗（Anki 流程：看題 → 顯示答案 → 評分 → 自動下一題）---------- */
  var quizKeys = [], qi = 0, quizDir = "jpzh", quizFilter = "all", answerShown = false;
  function getFilteredKeys() {
    if (quizFilter === "due") return dueKeys();
    if (quizFilter === "new") return newKeys();
    return keysAll();
  }
  function shuffle() { quizKeys = getFilteredKeys().slice().sort(function () { return Math.random() - 0.5; }); qi = 0; renderQuiz(); }
  function showAnswer() {
    if (!quizKeys.length || answerShown) return;
    answerShown = true;
    $("quizAnswer").classList.add("show");
    $("quizPre").hidden = true;
    $("quizDock").hidden = false;
  }
  function renderQuiz() {
    var ans = $("quizAnswer");
    answerShown = false;
    $("filterInfo").textContent = "題庫 " + quizKeys.length + " 字";
    ans.classList.remove("show");
    $("quizPre").hidden = false;
    $("quizDock").hidden = true;
    if (!quizKeys.length) {
      $("quizCount").textContent = "0 / 0";
      var q0 = $("quizQuestion"); q0.lang = ""; q0.textContent = "目前沒有符合條件的單字";
      $("quizHint").textContent = quizFilter === "due" ? "今天沒有到期的字。" : "所有單字都練過了。";
      ans.innerHTML = "";
      $("quizPre").hidden = true;
      return;
    }
    if (qi >= quizKeys.length) qi = 0;
    var k = quizKeys[qi], v = vocab[k], q = $("quizQuestion");
    $("quizCount").textContent = (qi + 1) + " / " + quizKeys.length;
    if (quizDir === "jpzh") {
      q.lang = "ja"; q.textContent = v.dict;
      $("quizHint").innerHTML = '<button class="hintbtn" id="hintBtn">看讀音提示</button>';
      ans.innerHTML = '<span lang="ja">' + esc(v.reading) + "</span><strong>" + esc(v.zh) + '</strong><div class="example" lang="ja">' + esc(v.ex) + "</div>";
    } else if (quizDir === "zhjp") {
      q.lang = ""; q.textContent = v.zh.split("、")[0];
      $("quizHint").textContent = "先想日文怎麼說，再顯示答案";
      ans.innerHTML = '<strong lang="ja">' + esc(v.dict) + '</strong><span lang="ja">' + esc(v.reading) + '</span><div class="example" lang="ja">' + esc(v.ex) + "</div>";
    } else {
      q.lang = ""; q.innerHTML = '<button class="bigplay" id="listenPlay">▶ 再聽一次</button>';
      $("quizHint").textContent = "聽日文發音，想中文意思";
      ans.innerHTML = '<strong lang="ja">' + esc(v.dict) + '</strong><span lang="ja">' + esc(v.reading) + '</span><div>' + esc(v.zh) + '</div><div class="example" lang="ja">' + esc(v.ex) + "</div>";
      play(v.dict);   // manifest key 是 dict（引擎課的音檔用假名合成、但 key 仍是漢字）
    }
  }
  function afterQuizRate() {
    if (!quizKeys.length) return;
    if (quizFilter === "all") { qi = (qi + 1) % quizKeys.length; }
    else {
      var k = quizKeys[qi];
      quizKeys.splice(qi, 1);
      var rec = srsData()[k];
      if (quizFilter === "due" && rec && rec.box === 0) quizKeys.push(k);
      if (qi >= quizKeys.length) qi = 0;
    }
    renderQuiz();
  }
  function setQuizDir(dir) {
    quizDir = dir;
    document.querySelectorAll("[data-qdir]").forEach(function (b) { b.classList.toggle("active", b.dataset.qdir === dir); });
    renderQuiz();
  }

  /* ---------- 文法克漏字 ---------- */
  function gqData() { try { return JSON.parse(LS.get("gquiz", "{}")); } catch (e) { return {}; } }
  function gqSave(d) { LS.set("gquiz", JSON.stringify(d)); }
  var gqOrder = [], gqi = 0, gqFilter = "all", gqAnswered = false;
  function gqAll() { return DATA.grammarQuiz || []; }
  function gqPool() {
    var idx = gqAll().map(function (_, i) { return i; });
    if (gqFilter === "ng") { var d = gqData(); return idx.filter(function (i) { return d[i] === "ng"; }); }
    return idx;
  }
  function gqShuffle() { gqOrder = gqPool().slice().sort(function () { return Math.random() - 0.5; }); gqi = 0; gqRender(); }
  function gqInfo() {
    var wrong = Object.values(gqData()).filter(function (x) { return x === "ng"; }).length;
    $("gqInfo").textContent = "共 " + gqAll().length + " 題 · 答錯待複習 " + wrong;
  }
  function gqRender() {
    gqInfo();
    var opts = $("gqOpts"), expl = $("gqExplain");
    if (!gqOrder.length) {
      $("gqCount").textContent = "0 / 0";
      $("gqSentence").textContent = gqFilter === "ng" ? "目前沒有答錯的題目" : "沒有題目";
      opts.innerHTML = ""; expl.classList.remove("show"); return;
    }
    if (gqi >= gqOrder.length) gqi = 0;
    gqAnswered = false;
    var item = gqAll()[gqOrder[gqi]];
    $("gqCount").textContent = (gqi + 1) + " / " + gqOrder.length;
    $("gqSentence").innerHTML = esc(item.s).replace("（　）", '<span class="gq-blank"></span>');
    expl.classList.remove("show"); expl.innerHTML = "";
    opts.innerHTML = item.o.map(function (o, i) { return '<button data-oi="' + i + '" lang="ja">' + esc(o) + "</button>"; }).join("");
  }

  /* ---------- 讀解測驗 ---------- */
  function rqData() { try { return JSON.parse(LS.get("rquiz", "{}")); } catch (e) { return {}; } }
  function rqSave(d) { LS.set("rquiz", JSON.stringify(d)); }
  var rqOrder = [], rqi = 0, rqFilter = "all", rqAnswered = false;
  function rqAll() { return DATA.reading || []; }
  function rqPool() {
    var idx = rqAll().map(function (_, i) { return i; }), d = rqData();
    var m = /^s(\d+)$/.exec(rqFilter);
    if (m) return idx.filter(function (i) { return rqAll()[i].st === +m[1]; });
    if (rqFilter === "ng") return idx.filter(function (i) { return d[i] === "ng"; });
    return idx;
  }
  function rqShuffle() { rqOrder = rqPool().slice().sort(function () { return Math.random() - 0.5; }); rqi = 0; rqRender(); }
  function rqInfo() {
    var wrong = Object.values(rqData()).filter(function (x) { return x === "ng"; }).length;
    $("rqInfo").textContent = "共 " + rqAll().length + " 題 · 答錯待複習 " + wrong;
  }
  function rqRender() {
    rqInfo();
    var opts = $("rqOpts"), expl = $("rqExplain");
    if (!rqOrder.length) {
      $("rqCount").textContent = "0 / 0";
      $("rqQuestion").textContent = rqFilter === "ng" ? "目前沒有答錯的題目" : "沒有題目";
      opts.innerHTML = ""; expl.classList.remove("show"); return;
    }
    if (rqi >= rqOrder.length) rqi = 0;
    rqAnswered = false;
    var item = rqAll()[rqOrder[rqi]];
    $("rqCount").textContent = (rqi + 1) + " / " + rqOrder.length +
      (DATA.stories.length > 1 ? "　（篇" + cn(item.st) + "）" : "");
    $("rqQuestion").textContent = item.q;
    expl.classList.remove("show"); expl.innerHTML = "";
    opts.innerHTML = item.o.map(function (o, i) { return '<button data-oi="' + i + '" lang="ja">' + esc(o) + "</button>"; }).join("");
  }

  /* ---------- 分頁 ---------- */
  function setTab(name) {
    if (!$(name)) name = "stories";
    curTab = name;
    LS.set("tab", name);
    document.querySelectorAll(".tabs button").forEach(function (x) { x.classList.toggle("active", x.dataset.tab === name); });
    document.querySelectorAll(".section").forEach(function (x) { x.classList.toggle("active", x.id === name); });
    $("hud").hidden = !(name === "vocabtable" || name === "quiz");
    $("readingRow").hidden = !(name === "stories" && !$("storyRead").hidden);
    if (name === "quiz") { $("quizDock").hidden = !answerShown || !quizKeys.length; }
    else $("quizDock").hidden = true;
    window.scrollTo(0, 0);
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
  }

  /* ============================================================
     事件
     ============================================================ */
  function wire() {
    modal = document.createElement("div");
    modal.className = "modal"; modal.id = "modal";
    modal.innerHTML = '<div class="sheet" id="sheet"></div>';
    document.body.appendChild(modal);
    sheet = $("sheet");
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.classList.remove("show"); });

    sheet.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act],[data-set]"); if (!b) return;
      if (b.dataset.act === "close") { modal.classList.remove("show"); return; }
      if (b.dataset.act === "play-dict") play(currentCardKey && vocab[currentCardKey].dict);
      else if (b.dataset.act === "play-ex") play(currentCardKey && vocab[currentCardKey].ex);
      else if (b.dataset.act === "rate") rateSrs(currentCardKey, b.dataset.val);
      else if (b.dataset.act === "goto-grammar") { modal.classList.remove("show"); setTab("grammar"); }
      else if (b.dataset.act === "shuffle") { modal.classList.remove("show"); shuffle(); gqShuffle(); rqShuffle(); }
      else if (b.dataset.act === "reset") {
        if (confirm("確定要清除這一課的單字、文法、讀解練習紀錄嗎？")) {
          ["srs", "gquiz", "rquiz"].forEach(function (k) { LS.del(k); });
          updateProgress(); shuffle(); gqShuffle(); rqShuffle(); modal.classList.remove("show");
        }
      }
      else if (b.dataset.set === "theme") { LS.set("theme", b.dataset.val); applyTheme(); openSettings(); }
      else if (b.dataset.set === "fs") { LS.set("fs", b.dataset.val); applyFont(); openSettings(); }
    });

    $("gearBtn").onclick = openSettings;

    document.querySelectorAll("[data-rd]").forEach(function (b) {
      b.onclick = function () { readingMode = b.dataset.rd; LS.set("reading", readingMode); applyReading(); };
    });

    // tabs
    document.querySelectorAll(".tabs button").forEach(function (b) {
      b.onclick = function () { stopAudio(); setTab(b.dataset.tab); };
    });
    $("tip").addEventListener("toggle", function () { LS.set("tipOpen", $("tip").open ? "1" : "0"); });

    // story view toggle
    document.querySelectorAll("[data-sview]").forEach(function (b) {
      b.onclick = function () {
        stopAudio();
        var v = b.dataset.sview;
        document.querySelectorAll("[data-sview]").forEach(function (x) { x.classList.toggle("active", x === b); });
        $("storyRead").hidden = v !== "read";
        $("storyQuizWrap").hidden = v !== "quiz";
        $("readingRow").hidden = v !== "read";
      };
    });
    // grammar view toggle
    document.querySelectorAll("[data-gview]").forEach(function (b) {
      b.onclick = function () {
        var v = b.dataset.gview;
        document.querySelectorAll("[data-gview]").forEach(function (x) { x.classList.toggle("active", x === b); });
        $("grammarTable").hidden = v !== "table";
        $("grammarQuizWrap").hidden = v !== "quiz";
      };
    });
    $("grammarBody").addEventListener("click", function (e) {
      var r = e.target.closest("tr[data-g]"); if (r) openGrammarCard(+r.dataset.g);
    });

    // delegated: play / word / playall / lang
    document.addEventListener("click", function (e) {
      var pa = e.target.closest(".playall");
      if (pa) {
        if (pa.classList.contains("playing")) stopAudio();
        else { stopAudio(); playStory($("story" + pa.dataset.story), pa); }
        return;
      }
      var p = e.target.closest(".play"); if (p && p.dataset.audio != null) { stopAudio(); seqStop = false; play(p.dataset.audio); return; }
      var w = e.target.closest(".word"); if (w && w.closest("#storyRead")) { activateWord(w); return; }
      var g = e.target.closest(".gram"); if (g && g.closest("#storyRead")) { openGrammarCard(+g.dataset.g); return; }
      var lb = e.target.closest(".lang-tabs button");
      if (lb) {
        var card = lb.closest(".story-card");
        card.querySelectorAll(".lang-tabs button").forEach(function (x) { x.classList.toggle("active", x === lb); });
        card.querySelector(".story-text").dataset.lang = lb.dataset.lang;
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { modal.classList.remove("show"); return; }
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.closest("#storyRead")) {
        if (e.target.classList.contains("word")) { e.preventDefault(); activateWord(e.target); return; }
        if (e.target.classList.contains("gram")) { e.preventDefault(); openGrammarCard(+e.target.dataset.g); return; }
      }
      if (e.target.closest && e.target.closest("tr[data-g]") && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault(); openGrammarCard(+e.target.closest("tr[data-g]").dataset.g); return;
      }
      // 單字測驗快捷鍵：空白＝顯示答案、1/2/3＝評分、→＝略過、P＝播放
      if (curTab !== "quiz" || modal.classList.contains("show")) return;
      if (e.key === " ") {
        // 焦點在某顆按鈕上時，空白鍵交給那顆按鈕（不然篩選鈕會被搶走）
        if ((tag === "button" || tag === "a") && e.target.id !== "showAnswer") return;
        e.preventDefault(); showAnswer();
      }
      else if (answerShown && (e.key === "1" || e.key === "2" || e.key === "3")) {
        e.preventDefault();
        rateSrs(quizKeys[qi], { "1": "bad", "2": "mid", "3": "good" }[e.key]); afterQuizRate();
      }
      else if (e.key === "ArrowRight") { e.preventDefault(); $("nextQuiz").click(); }
      else if (e.key === "p" || e.key === "P") { $("speakQuiz").click(); }
    });

    // vocab table tab: 整列點開詳解
    var vtHost = $("vocabTableHost");
    vtHost.addEventListener("click", function (e) {
      if (e.target.closest("button")) return;
      var r = e.target.closest("[data-key]"); if (r) openCard(r.dataset.key);
    });
    vtHost.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var w = e.target.closest(".vt-word"); if (w) { e.preventDefault(); openCard(w.dataset.key); }
    });

    // 單字測驗
    $("showAnswer").onclick = showAnswer;
    $("quizHint").addEventListener("click", function (e) {
      var h = e.target.closest("#hintBtn"); if (!h || !quizKeys.length) return;
      h.outerHTML = '<span lang="ja">讀音：' + esc(vocab[quizKeys[qi]].reading) + "</span>";
    });
    $("nextQuiz").onclick = function () { if (quizKeys.length) { qi = (qi + 1) % quizKeys.length; renderQuiz(); } };
    document.querySelectorAll("[data-qdir]").forEach(function (b) { b.onclick = function () { setQuizDir(b.dataset.qdir); }; });
    $("quizQuestion").addEventListener("click", function (e) {
      if (e.target.closest("#listenPlay") && quizKeys.length) play(vocab[quizKeys[qi]].dict);
    });
    $("speakQuiz").onclick = function () { if (quizKeys.length) play(vocab[quizKeys[qi]].dict); };
    document.querySelectorAll("[data-qfilter]").forEach(function (b) {
      b.onclick = function () {
        quizFilter = b.dataset.qfilter;
        document.querySelectorAll("[data-qfilter]").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active"); shuffle();
      };
    });
    $("quizDock").addEventListener("click", function (e) {
      var b = e.target.closest(".status-btn"); if (!b || !quizKeys.length || !answerShown) return;
      rateSrs(quizKeys[qi], b.dataset.status); afterQuizRate();
    });

    // 文法克漏字
    $("gqOpts").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-oi]"); if (!b || gqAnswered) return;
      gqAnswered = true;
      var item = gqAll()[gqOrder[gqi]], pick = +b.dataset.oi, ok = pick === item.a;
      $("gqOpts").querySelectorAll("button").forEach(function (x, i) {
        x.disabled = true;
        if (i === item.a) x.classList.add("correct"); else if (i === pick) x.classList.add("wrong");
      });
      $("gqSentence").innerHTML = esc(item.s).replace("（　）",
        '<span class="gq-blank" style="border:0">' + esc(item.o[item.a]) + "</span>");
      var g = (DATA.grammar || [])[item.g];
      var expl = $("gqExplain");
      if (g) expl.innerHTML = '<b lang="ja">' + esc(g.point) + "</b>　" + esc(g.meaning) +
        '<div class="small" style="margin-top:6px" lang="ja">例：' + esc(g.example) + "</div>";
      expl.classList.add("show");
      var d = gqData(); d[gqOrder[gqi]] = ok ? "ok" : "ng"; gqSave(d); gqInfo();
    });
    $("gqNext").onclick = function () { if (gqOrder.length) { gqi = (gqi + 1) % gqOrder.length; gqRender(); } };
    document.querySelectorAll("[data-gqfilter]").forEach(function (b) {
      b.onclick = function () {
        gqFilter = b.dataset.gqfilter;
        document.querySelectorAll("[data-gqfilter]").forEach(function (x) { x.classList.toggle("active", x === b); });
        gqShuffle();
      };
    });

    // 讀解
    $("rqOpts").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-oi]"); if (!b || rqAnswered) return;
      rqAnswered = true;
      var item = rqAll()[rqOrder[rqi]], pick = +b.dataset.oi, ok = pick === item.a;
      $("rqOpts").querySelectorAll("button").forEach(function (x, i) {
        x.disabled = true;
        if (i === item.a) x.classList.add("correct"); else if (i === pick) x.classList.add("wrong");
      });
      var expl = $("rqExplain");
      expl.innerHTML = (ok ? "正確" : "正解：" + esc(item.o[item.a])) +
        '<div class="small" style="margin-top:6px" lang="ja">文章：「' + esc(item.ref) + "」</div>";
      expl.classList.add("show");
      var d = rqData(); d[rqOrder[rqi]] = ok ? "ok" : "ng"; rqSave(d); rqInfo();
    });
    $("rqNext").onclick = function () { if (rqOrder.length) { rqi = (rqi + 1) % rqOrder.length; rqRender(); } };
    document.querySelectorAll("[data-rqfilter]").forEach(function (b) {
      b.onclick = function () {
        rqFilter = b.dataset.rqfilter;
        document.querySelectorAll("[data-rqfilter]").forEach(function (x) { x.classList.toggle("active", x === b); });
        rqShuffle();
      };
    });
  }

  function openSettings() {
    var t = LS.get("theme", "auto"), fs = LS.get("fs", "18");
    currentCardKey = null;
    function act(v, cur) { return v === cur ? " active" : ""; }
    sheet.innerHTML =
      '<button class="sheet-close" data-act="close">關閉</button><h3>設定</h3>' +
      '<div class="setrow"><span class="lab">深色模式</span>' +
        '<button data-set="theme" data-val="auto" class="' + act("auto", t) + '">跟系統</button>' +
        '<button data-set="theme" data-val="light" class="' + act("light", t) + '">淺色</button>' +
        '<button data-set="theme" data-val="dark" class="' + act("dark", t) + '">深色</button></div>' +
      '<div class="setrow"><span class="lab">字級</span>' +
        '<button data-set="fs" data-val="16" class="' + act("16", fs) + '">小</button>' +
        '<button data-set="fs" data-val="18" class="' + act("18", fs) + '">中</button>' +
        '<button data-set="fs" data-val="20" class="' + act("20", fs) + '">大</button>' +
        '<button data-set="fs" data-val="23" class="' + act("23", fs) + '">特大</button></div>' +
      '<div class="setrow"><span class="lab">練習</span>' +
        '<button data-act="shuffle">重新洗牌所有題目</button>' +
        '<button data-act="reset" class="danger">清除這一課的紀錄</button></div>' +
      '<div class="small" id="audioState" style="margin-top:8px"></div>' +
      '<div class="small">鍵盤：空白＝顯示答案、1/2/3＝評分、→＝略過、P＝播放、Esc＝關閉</div>';
    $("audioState").textContent = Object.keys(AUDIO).length
      ? "語音：使用預錄 MP3（" + Object.keys(AUDIO).length + " 段）"
      : "語音：目前用瀏覽器內建語音";
    modal.classList.add("show");
  }

  /* ============================================================
     啟動
     ============================================================ */
  function boot() {
    shell();
    wire();
    applyTheme(); applyFont();
    renderStories();
    renderGrammarTable();
    renderVocabTab();
    $("tip").open = LS.get("tipOpen", "1") === "1";
    applyReading();
    updateProgress();
    shuffle(); gqShuffle(); rqShuffle();
    setTab(LS.get("tab", "stories"));
    fetch("../audio/manifest.json").then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (m) { AUDIO = m || {}; }).catch(function () {});
  }
  function fail(msg) {
    app.innerHTML = '<header><a class="backlink" href="../">← 回目錄</a>' +
      '<h1>' + esc(TITLE) + "</h1></header>" +
      '<p class="loaderr">' + esc(msg) + "</p>";
  }

  applyTheme(); applyFont();   // 先套用，避免閃爍
  Promise.all([
    fetch("../data/lessons/" + LESSON_ID + ".json").then(function (r) { if (!r.ok) throw new Error("lesson HTTP " + r.status); return r.json(); }),
    fetch("../data/vocab.json").then(function (r) { if (!r.ok) throw new Error("vocab HTTP " + r.status); return r.json(); })
  ]).then(function (res) {
    DATA = res[0];
    (res[1] || []).forEach(function (w) {
      if (!w.lessons || w.lessons.indexOf(LESSON_ID) >= 0) vocab[w.key] = w;
    });
    if (!DATA || !Array.isArray(DATA.stories) || !DATA.stories.length) throw new Error("lesson JSON 缺 stories");
    try { boot(); }
    catch (e) { console.error(e); fail("課程渲染失敗（" + e.message + "）。請把這段訊息回報。"); }
  }).catch(function (e) {
    console.error(e);
    fail("課程資料載入失敗（" + e.message + "）。請用本機伺服器或線上版開啟，不能雙擊檔案。");
  });
})();
