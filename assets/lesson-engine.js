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

  /* ---------- 注音 / 目標單字 標記解析 ---------- */
  var KANJI = "一-鿿々〆ヶ";
  var KANA = "぀-ゟー";
  var FURI_RE = new RegExp("([" + KANJI + "]+)（([" + KANA + "]+)）", "g");
  var STRIP_FURI_RE = new RegExp("（[" + KANA + "]+）", "g");
  var TARGET_RE = /\{\{([^{}|]+)\|([^{}|]+)(?:\|([^{}]*))?\}\}/g;
  var MARK_RE = /@@T(\d+)@@/g;

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
                 .replace(STRIP_FURI_RE, "").trim();
    var html = furiganize(t).replace(MARK_RE, function (m, i) { return wordSpan(words[+i]); });
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

  /* ============================================================
     版面
     ============================================================ */
  function shell() {
    app.innerHTML =
      '<header>' +
        '<a class="backlink" href="../">← 回目錄</a>' +
        '<h1>' + esc(TITLE) + ' <button class="gear" id="gearBtn" aria-label="設定">⚙︎</button></h1>' +
        '<div class="ctl-row" role="group" aria-label="注音顯示">' +
          '<span class="ctl-label">注音</span><span class="grp">' +
          '<button class="active" data-fg="all">全部</button>' +
          '<button data-fg="target">重點字</button>' +
          '<button data-fg="none">全隱</button></span></div>' +
        '<div class="ctl-row" role="group" aria-label="目標單字顯示">' +
          '<span class="ctl-label">單字</span><span class="grp">' +
          '<button class="active" data-wm="normal">顯示假名</button>' +
          '<button data-wm="blank">遮住單字</button></span></div>' +
      '</header>' +
      '<div class="hud">' +
        '<div class="progressbar" aria-label="學習進度"><div id="progressFill"></div></div>' +
        '<div class="progresstext" id="progressText"></div>' +
        '<div class="stats">' +
          '<div class="stat"><b id="statMaster">0</b><span>熟練</span></div>' +
          '<div class="stat"><b id="statLearning">0</b><span>學習中</span></div>' +
          '<div class="stat"><b id="statDue">0</b><span>今日到期</span></div>' +
          '<div class="stat"><b id="statNew">0</b><span>未學</span></div>' +
        '</div></div>' +
      '<div class="tabs">' +
        '<button class="active" data-tab="stories">故事</button>' +
        '<button data-tab="vocabtable">單字表</button>' +
        '<button data-tab="quiz">單字測驗</button>' +
        '<button data-tab="grammar">文法</button>' +
      '</div>' +
      storiesSection() +
      '<section id="vocabtable" class="section">' +
        '<div class="panel"><div class="legend">本課單字一覽。點任一列看詳解與複習狀態，列首的 ▶ 可聽發音。注音顯示跟著上方「注音」控制。</div></div>' +
        '<div id="vocabTableHost"></div>' +
      '</section>' +
      quizSection() +
      grammarSection();
  }

  function storiesSection() {
    var cards = DATA.stories.map(function (s, i) {
      return '<article class="story-card">' +
        '<h2 lang="ja">' + esc(s.title || ("篇" + (i + 1))) +
        ' <button class="playall" data-story="' + i + '">▶ 全篇</button></h2>' +
        '<div class="story-text" id="story' + i + '" lang="ja"></div></article>';
    }).join("");
    var rqFilters = '<button class="active" data-rqfilter="all">全部</button>';
    if (DATA.stories.length > 1) {
      DATA.stories.forEach(function (s, i) {
        rqFilters += '<button data-rqfilter="s' + (i + 1) + '">篇' + cn(i + 1) + '</button>';
      });
    }
    rqFilters += '<button data-rqfilter="ng">只練答錯的</button>';
    return '<section id="stories" class="section active">' +
      '<div class="panel"><div class="toolbar">' +
        '<button class="active" data-sview="read">閱讀</button>' +
        '<button data-sview="quiz">讀解測驗</button></div></div>' +
      '<div id="storyRead">' +
        '<div class="legend">點粗體目標單字看詳解；每段開頭的 ▶ 可聽整段。注音「重點字」＝只藏目標字的假名。</div>' +
        '<div class="tip">建議順序：先「注音·全部」聽讀 → 切「注音·重點字」練讀音 → 「單字·遮住單字」練回想 → 不熟的進單字測驗 → 文法克漏字 → 讀解測驗。</div>' +
        cards +
      '</div>' +
      '<div id="storyQuizWrap" hidden>' +
        '<div class="panel"><div class="filter-row" aria-label="讀解篩選">' + rqFilters + '</div>' +
          '<div class="small" id="rqInfo" style="margin-top:8px"></div></div>' +
        '<div class="quiz-card">' +
          '<div class="small" id="rqCount"></div>' +
          '<div class="gq-sentence" id="rqQuestion" lang="ja"></div>' +
          '<div class="gq-opts" id="rqOpts"></div>' +
          '<div class="gq-explain" id="rqExplain"></div>' +
          '<div class="quiz-controls"><button id="rqNext">下一題</button><button id="rqShuffle">重新洗牌</button></div>' +
        '</div>' +
      '</div></section>';
  }

  function quizSection() {
    return '<section id="quiz" class="section">' +
      '<div class="panel"><div class="toolbar">' +
        '<button class="active" id="quizJpZh">日→中</button>' +
        '<button id="quizZhJp">中→日</button>' +
        '<button id="quizListen">🔊聽力</button>' +
        '<button id="quizShuffle">洗牌</button></div>' +
        '<div class="filter-row" aria-label="測驗篩選">' +
          '<button class="active" data-qfilter="all">全部</button>' +
          '<button data-qfilter="due">今日複習</button>' +
          '<button data-qfilter="new">未學過</button></div>' +
        '<div class="small" id="filterInfo" style="margin-top:8px"></div></div>' +
      '<div class="quiz-card">' +
        '<div class="small" id="quizCount"></div>' +
        '<div class="quiz-q" id="quizQuestion"></div>' +
        '<div class="quiz-hint" id="quizHint"></div>' +
        '<button id="showAnswer">顯示答案</button>' +
        '<div class="quiz-answer" id="quizAnswer"></div>' +
        '<div class="quiz-controls">' +
          '<button class="status-btn good" data-status="good">記得</button>' +
          '<button class="status-btn mid" data-status="mid">有點模糊</button>' +
          '<button class="status-btn bad" data-status="bad">不記得</button></div>' +
        '<div class="quiz-controls">' +
          '<button id="prevQuiz">上一題</button>' +
          '<button id="speakQuiz">播放</button>' +
          '<button id="nextQuiz">下一題</button></div>' +
      '</div></section>';
  }

  function grammarSection() {
    return '<section id="grammar" class="section grammar">' +
      '<div class="panel"><div class="toolbar">' +
        '<button class="active" data-gview="table">對照表</button>' +
        '<button data-gview="quiz">克漏字練習</button></div></div>' +
      '<div id="grammarTable"><div class="story-card">' +
        '<table><thead><tr><th>文法</th><th>例句</th><th>意思</th><th>N4 依據</th></tr></thead>' +
        '<tbody id="grammarBody"></tbody></table></div></div>' +
      '<div id="grammarQuizWrap" hidden>' +
        '<div class="panel"><div class="filter-row" aria-label="克漏字篩選">' +
          '<button class="active" data-gqfilter="all">全部</button>' +
          '<button data-gqfilter="ng">只練答錯的</button></div>' +
          '<div class="small" id="gqInfo" style="margin-top:8px"></div></div>' +
        '<div class="quiz-card">' +
          '<div class="small" id="gqCount"></div>' +
          '<div class="gq-sentence" id="gqSentence" lang="ja"></div>' +
          '<div class="gq-opts" id="gqOpts"></div>' +
          '<div class="gq-explain" id="gqExplain"></div>' +
          '<div class="quiz-controls"><button id="gqNext">下一題</button><button id="gqShuffle">重新洗牌</button></div>' +
        '</div></div>' +
      '<button class="reset" id="resetProgress">重設學習紀錄</button>' +
    '</section>';
  }
  function cn(n) { return "一二三四五六七八九十".charAt(n - 1) || String(n); }

  /* ============================================================
     渲染
     ============================================================ */
  function renderStories() {
    DATA.stories.forEach(function (s, i) {
      document.getElementById("story" + i).innerHTML = s.paragraphs.map(function (raw) {
        var p = parsePara(raw);
        return '<p><button class="play" data-audio="' + esc(p.plain) + '" aria-label="播放這段">▶</button>' + p.html + "</p>";
      }).join("");
    });
  }
  function renderGrammarTable() {
    document.getElementById("grammarBody").innerHTML = (DATA.grammar || []).map(function (g) {
      return "<tr><td>" + esc(g.point) + '</td><td lang="ja">' + esc(g.example) + "</td><td>" + esc(g.meaning) +
        '</td><td class="small">' + esc(g.n4ref || "") + "</td></tr>";
    }).join("");
  }
  function renderVocabTab() {
    var host = document.getElementById("vocabTableHost");
    if (!host) return;
    if (window.vocabTableHTML) host.innerHTML = window.vocabTableHTML(Object.values(vocab), { wordClickable: true });
    else host.innerHTML = '<p class="legend">單字表元件載入失敗，請重新整理。</p>';
  }

  /* ---------- 注音 / 遮字 ---------- */
  var fgMode = LS.get("fg", "all"), wordMode = "normal";
  function applyFg() {
    document.body.classList.remove("fg-all", "fg-target", "fg-none");
    document.body.classList.add("fg-" + fgMode);
    document.querySelectorAll(".word.revealed").forEach(function (w) {
      if (!w.classList.contains("blank")) w.classList.remove("revealed");
    });
    document.querySelectorAll("[data-fg]").forEach(function (b) { b.classList.toggle("active", b.dataset.fg === fgMode); });
  }
  function applyWordMode() {
    document.querySelectorAll("#storyRead .word").forEach(function (w) {
      w.classList.remove("blank", "revealed");
      if (wordMode === "blank") w.classList.add("blank");
    });
    document.querySelectorAll("[data-wm]").forEach(function (b) { b.classList.toggle("active", b.dataset.wm === wordMode); });
  }
  function activateWord(w) {
    var hiddenReading = (fgMode !== "all") && w.querySelector("rt.rt-t") && !w.classList.contains("revealed");
    if (wordMode === "blank") {
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
        '<button data-act="play-dict">▶ 播放單字</button>' +
        '<button data-act="play-ex">▶ 播放例句</button></div>' +
      '<div class="kv"><strong>複習</strong><div class="small" style="margin-top:4px">' + boxTxt + "</div>" +
        '<div class="actions">' +
          '<button class="status-btn good" data-act="rate" data-val="good">記得</button>' +
          '<button class="status-btn mid" data-act="rate" data-val="mid">有點模糊</button>' +
          '<button class="status-btn bad" data-act="rate" data-val="bad">不記得</button></div></div>';
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
    if (document.getElementById("quiz").classList.contains("active")) afterQuizRate();
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
    document.getElementById("progressText").textContent =
      "熟練 " + master + " / " + keys.length + (due ? " · 今日複習 " + due : "");
    document.getElementById("progressFill").style.width = (keys.length ? master / keys.length * 100 : 0) + "%";
    document.getElementById("statMaster").textContent = master;
    document.getElementById("statLearning").textContent = learning;
    document.getElementById("statDue").textContent = due;
    document.getElementById("statNew").textContent = fresh;
  }

  /* ---------- 單字測驗 ---------- */
  var quizKeys = [], qi = 0, quizDir = "jpzh", quizFilter = "all";
  function getFilteredKeys() {
    if (quizFilter === "due") return dueKeys();
    if (quizFilter === "new") return newKeys();
    return keysAll();
  }
  function shuffle() { quizKeys = getFilteredKeys().slice().sort(function () { return Math.random() - 0.5; }); qi = 0; renderQuiz(); }
  function renderQuiz() {
    var ans = document.getElementById("quizAnswer");
    document.getElementById("filterInfo").textContent = "目前題庫：" + quizKeys.length + " 字";
    if (!quizKeys.length) {
      document.getElementById("quizCount").textContent = "0 / 0";
      var q0 = document.getElementById("quizQuestion"); q0.lang = ""; q0.textContent = "目前沒有符合條件的單字";
      document.getElementById("quizHint").textContent = quizFilter === "due" ? "今天沒有到期的字。" : "所有單字都練過了。";
      ans.classList.remove("show"); ans.innerHTML = "";
      document.querySelectorAll(".quiz-controls .status-btn").forEach(function (b) { b.classList.remove("active"); });
      return;
    }
    if (qi >= quizKeys.length) qi = 0;
    var k = quizKeys[qi], v = vocab[k], q = document.getElementById("quizQuestion");
    document.getElementById("quizCount").textContent = (qi + 1) + " / " + quizKeys.length;
    if (quizDir === "jpzh") {
      q.lang = "ja"; q.textContent = v.dict;
      document.getElementById("quizHint").textContent = "讀音：" + v.reading;
      ans.innerHTML = "<strong>" + esc(v.zh) + '</strong><div class="example" lang="ja">' + esc(v.ex) + "</div>";
    } else if (quizDir === "zhjp") {
      q.lang = ""; q.textContent = v.zh.split("、")[0];
      document.getElementById("quizHint").textContent = "請先回想日文，再顯示答案";
      ans.innerHTML = '<strong lang="ja">' + esc(v.dict) + '</strong><span lang="ja">（' + esc(v.reading) + '）</span><div class="example" lang="ja">' + esc(v.ex) + "</div>";
    } else {
      q.lang = ""; q.innerHTML = '<button class="bigplay" id="listenPlay">▶ 播放</button>';
      document.getElementById("quizHint").textContent = "聽日文發音，回想中文意思";
      ans.innerHTML = '<strong lang="ja">' + esc(v.dict) + '</strong><span lang="ja">（' + esc(v.reading) + '）</span><div>' + esc(v.zh) + '</div><div class="example" lang="ja">' + esc(v.ex) + "</div>";
      play(v.reading || v.dict);
    }
    ans.classList.remove("show");
    document.querySelectorAll(".quiz-controls .status-btn").forEach(function (b) { b.classList.remove("active"); });
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
    document.querySelectorAll("#quizJpZh,#quizZhJp,#quizListen").forEach(function (b) { b.classList.remove("active"); });
    document.getElementById(dir === "jpzh" ? "quizJpZh" : dir === "zhjp" ? "quizZhJp" : "quizListen").classList.add("active");
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
    document.getElementById("gqInfo").textContent = "共 " + gqAll().length + " 題 · 答錯待複習 " + wrong + " 題";
  }
  function gqRender() {
    gqInfo();
    var opts = document.getElementById("gqOpts"), expl = document.getElementById("gqExplain");
    if (!gqOrder.length) {
      document.getElementById("gqCount").textContent = "0 / 0";
      document.getElementById("gqSentence").textContent = gqFilter === "ng" ? "目前沒有答錯的題目 🎉" : "沒有題目";
      opts.innerHTML = ""; expl.classList.remove("show"); return;
    }
    if (gqi >= gqOrder.length) gqi = 0;
    gqAnswered = false;
    var item = gqAll()[gqOrder[gqi]];
    document.getElementById("gqCount").textContent = (gqi + 1) + " / " + gqOrder.length;
    document.getElementById("gqSentence").innerHTML = esc(item.s).replace("（　）", '<span class="gq-blank"></span>');
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
    document.getElementById("rqInfo").textContent = "共 " + rqAll().length + " 題 · 答錯待複習 " + wrong + " 題";
  }
  function rqRender() {
    rqInfo();
    var opts = document.getElementById("rqOpts"), expl = document.getElementById("rqExplain");
    if (!rqOrder.length) {
      document.getElementById("rqCount").textContent = "0 / 0";
      document.getElementById("rqQuestion").textContent = rqFilter === "ng" ? "目前沒有答錯的題目 🎉" : "沒有題目";
      opts.innerHTML = ""; expl.classList.remove("show"); return;
    }
    if (rqi >= rqOrder.length) rqi = 0;
    rqAnswered = false;
    var item = rqAll()[rqOrder[rqi]];
    document.getElementById("rqCount").textContent = (rqi + 1) + " / " + rqOrder.length +
      (DATA.stories.length > 1 ? "　（篇" + cn(item.st) + "）" : "");
    document.getElementById("rqQuestion").textContent = item.q;
    expl.classList.remove("show"); expl.innerHTML = "";
    opts.innerHTML = item.o.map(function (o, i) { return '<button data-oi="' + i + '" lang="ja">' + esc(o) + "</button>"; }).join("");
  }

  /* ============================================================
     事件
     ============================================================ */
  function wire() {
    modal = document.createElement("div");
    modal.className = "modal"; modal.id = "modal";
    modal.innerHTML = '<div class="sheet" id="sheet"></div>';
    document.body.appendChild(modal);
    sheet = document.getElementById("sheet");
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.classList.remove("show"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") modal.classList.remove("show"); });

    sheet.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act],[data-set]"); if (!b) return;
      if (b.dataset.act === "close") { modal.classList.remove("show"); return; }
      if (b.dataset.act === "play-dict") play(currentCardKey && (vocab[currentCardKey].reading || vocab[currentCardKey].dict));
      else if (b.dataset.act === "play-ex") play(currentCardKey && vocab[currentCardKey].ex);
      else if (b.dataset.act === "rate") rateSrs(currentCardKey, b.dataset.val);
      else if (b.dataset.set === "theme") { LS.set("theme", b.dataset.val); applyTheme(); openSettings(); }
      else if (b.dataset.set === "fs") { LS.set("fs", b.dataset.val); applyFont(); openSettings(); }
    });

    document.getElementById("gearBtn").onclick = openSettings;

    document.querySelectorAll("[data-fg]").forEach(function (b) {
      b.onclick = function () { fgMode = b.dataset.fg; LS.set("fg", fgMode); applyFg(); };
    });
    document.querySelectorAll("[data-wm]").forEach(function (b) {
      b.onclick = function () { wordMode = b.dataset.wm; applyWordMode(); };
    });

    // tabs
    document.querySelectorAll(".tabs button").forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll(".tabs button").forEach(function (x) { x.classList.remove("active"); });
        document.querySelectorAll(".section").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active"); document.getElementById(b.dataset.tab).classList.add("active");
      };
    });
    document.querySelectorAll(".tabs button, [data-sview]").forEach(function (b) { b.addEventListener("click", stopAudio); });

    // story view toggle
    document.querySelectorAll("[data-sview]").forEach(function (b) {
      b.onclick = function () {
        var v = b.dataset.sview;
        document.querySelectorAll("[data-sview]").forEach(function (x) { x.classList.toggle("active", x === b); });
        document.getElementById("storyRead").hidden = v !== "read";
        document.getElementById("storyQuizWrap").hidden = v !== "quiz";
      };
    });
    // grammar view toggle
    document.querySelectorAll("[data-gview]").forEach(function (b) {
      b.onclick = function () {
        var v = b.dataset.gview;
        document.querySelectorAll("[data-gview]").forEach(function (x) { x.classList.toggle("active", x === b); });
        document.getElementById("grammarTable").hidden = v !== "table";
        document.getElementById("grammarQuizWrap").hidden = v !== "quiz";
      };
    });

    // delegated: play / word / playall
    document.addEventListener("click", function (e) {
      var pa = e.target.closest(".playall");
      if (pa) {
        if (pa.classList.contains("playing")) stopAudio();
        else { stopAudio(); playStory(document.getElementById("story" + pa.dataset.story), pa); }
        return;
      }
      var p = e.target.closest(".play"); if (p && p.dataset.audio != null) { stopAudio(); seqStop = false; play(p.dataset.audio); return; }
      var w = e.target.closest(".word"); if (w && w.closest("#storyRead")) { activateWord(w); }
    });
    document.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("word") && e.target.closest("#storyRead")) {
        e.preventDefault(); activateWord(e.target);
      }
    });

    // vocab table tab: 整列點開詳解
    var vtHost = document.getElementById("vocabTableHost");
    vtHost.addEventListener("click", function (e) {
      if (e.target.closest("button")) return;
      var r = e.target.closest("[data-key]"); if (r) openCard(r.dataset.key);
    });
    vtHost.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var w = e.target.closest(".vt-word"); if (w) { e.preventDefault(); openCard(w.dataset.key); }
    });

    // 單字測驗
    document.getElementById("showAnswer").onclick = function () { document.getElementById("quizAnswer").classList.add("show"); };
    document.getElementById("nextQuiz").onclick = function () { if (quizKeys.length) { qi = (qi + 1) % quizKeys.length; renderQuiz(); } };
    document.getElementById("prevQuiz").onclick = function () { if (quizKeys.length) { qi = (qi - 1 + quizKeys.length) % quizKeys.length; renderQuiz(); } };
    document.getElementById("quizShuffle").onclick = shuffle;
    document.getElementById("quizJpZh").onclick = function () { setQuizDir("jpzh"); };
    document.getElementById("quizZhJp").onclick = function () { setQuizDir("zhjp"); };
    document.getElementById("quizListen").onclick = function () { setQuizDir("listen"); };
    document.getElementById("quizQuestion").addEventListener("click", function (e) {
      if (e.target.closest("#listenPlay") && quizKeys.length) play(vocab[quizKeys[qi]].reading || vocab[quizKeys[qi]].dict);
    });
    document.getElementById("speakQuiz").onclick = function () { if (quizKeys.length) play(vocab[quizKeys[qi]].reading || vocab[quizKeys[qi]].dict); };
    document.querySelectorAll("[data-qfilter]").forEach(function (b) {
      b.onclick = function () {
        quizFilter = b.dataset.qfilter;
        document.querySelectorAll("[data-qfilter]").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active"); shuffle();
      };
    });
    document.querySelectorAll(".quiz-controls .status-btn").forEach(function (b) {
      b.onclick = function () {
        if (!quizKeys.length) return;
        document.getElementById("quizAnswer").classList.add("show");
        rateSrs(quizKeys[qi], b.dataset.status);
      };
    });

    // 文法克漏字
    document.getElementById("gqOpts").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-oi]"); if (!b || gqAnswered) return;
      gqAnswered = true;
      var item = gqAll()[gqOrder[gqi]], pick = +b.dataset.oi, ok = pick === item.a;
      document.getElementById("gqOpts").querySelectorAll("button").forEach(function (x, i) {
        x.disabled = true;
        if (i === item.a) x.classList.add("correct"); else if (i === pick) x.classList.add("wrong");
      });
      document.getElementById("gqSentence").innerHTML = esc(item.s).replace("（　）",
        '<span class="gq-blank" style="border:0">' + esc(item.o[item.a]) + "</span>");
      var g = (DATA.grammar || [])[item.g];
      var expl = document.getElementById("gqExplain");
      if (g) expl.innerHTML = '<b lang="ja">' + esc(g.point) + "</b>　" + esc(g.meaning) +
        '<div class="small" style="margin-top:6px" lang="ja">例：' + esc(g.example) + "</div>";
      expl.classList.add("show");
      var d = gqData(); d[gqOrder[gqi]] = ok ? "ok" : "ng"; gqSave(d); gqInfo();
    });
    document.getElementById("gqNext").onclick = function () { if (gqOrder.length) { gqi = (gqi + 1) % gqOrder.length; gqRender(); } };
    document.getElementById("gqShuffle").onclick = gqShuffle;
    document.querySelectorAll("[data-gqfilter]").forEach(function (b) {
      b.onclick = function () {
        gqFilter = b.dataset.gqfilter;
        document.querySelectorAll("[data-gqfilter]").forEach(function (x) { x.classList.toggle("active", x === b); });
        gqShuffle();
      };
    });

    // 讀解
    document.getElementById("rqOpts").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-oi]"); if (!b || rqAnswered) return;
      rqAnswered = true;
      var item = rqAll()[rqOrder[rqi]], pick = +b.dataset.oi, ok = pick === item.a;
      document.getElementById("rqOpts").querySelectorAll("button").forEach(function (x, i) {
        x.disabled = true;
        if (i === item.a) x.classList.add("correct"); else if (i === pick) x.classList.add("wrong");
      });
      var expl = document.getElementById("rqExplain");
      expl.innerHTML = (ok ? "✅ 正確" : "❌ 正解：" + esc(item.o[item.a])) +
        '<div class="small" style="margin-top:6px" lang="ja">文章：「' + esc(item.ref) + "」</div>";
      expl.classList.add("show");
      var d = rqData(); d[rqOrder[rqi]] = ok ? "ok" : "ng"; rqSave(d); rqInfo();
    });
    document.getElementById("rqNext").onclick = function () { if (rqOrder.length) { rqi = (rqi + 1) % rqOrder.length; rqRender(); } };
    document.getElementById("rqShuffle").onclick = rqShuffle;
    document.querySelectorAll("[data-rqfilter]").forEach(function (b) {
      b.onclick = function () {
        rqFilter = b.dataset.rqfilter;
        document.querySelectorAll("[data-rqfilter]").forEach(function (x) { x.classList.toggle("active", x === b); });
        rqShuffle();
      };
    });

    document.getElementById("resetProgress").onclick = function () {
      if (confirm("確定要清除全部單字、文法、讀解的練習紀錄嗎？")) {
        ["srs", "gquiz", "rquiz"].forEach(function (k) { LS.del(k); });
        updateProgress(); shuffle(); gqShuffle(); rqShuffle();
      }
    };
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
      '<div class="small" id="audioState" style="margin-top:8px"></div>';
    document.getElementById("audioState").textContent = Object.keys(AUDIO).length
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
    applyFg(); applyWordMode();
    updateProgress();
    shuffle(); gqShuffle(); rqShuffle();
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
    if (!DATA || !DATA.stories) throw new Error("lesson JSON 缺 stories");
    boot();
  }).catch(function (e) {
    console.error(e);
    fail("課程資料載入失敗（" + e.message + "）。請用本機伺服器或線上版開啟，不能雙擊檔案。");
  });
})();
