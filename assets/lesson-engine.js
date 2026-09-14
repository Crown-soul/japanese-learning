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
   進度與設定全部透過 assets/store.js（window.JLStore）存取，跨課共用、不綁課程。
   ============================================================ */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var LESSON_ID = app && app.dataset.lesson;
  if (!app || !LESSON_ID) { console.error("缺少 #app[data-lesson]"); return; }
  var TITLE = document.title || LESSON_ID;
  var S = window.JLStore;
  if (!S) { console.error("缺少 assets/store.js（要放在 lesson-engine.js 之前）"); }

  /* ---------- 小工具 ---------- */
  function setting(k) { return S ? S.getSettings()[k] : undefined; }
  function setSetting(k, v) { if (S) { var o = {}; o[k] = v; S.saveSettings(o); } }
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
    u.lang = "ja-JP"; u.rate = 0.85 * (setting("audioRate") || 1);
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
        curAudio.playbackRate = setting("audioRate") || 1;
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

  /* ---------- 錄音回放（跟讀用；只留在記憶體，不評分、不上傳）---------- */
  var rec = null, recChunks = [], recUrl = null, recTarget = "";
  function recSupported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); }
  function recorderHTML(text) {
    if (!recSupported()) return "";
    return '<div class="recbar" data-rectext="' + esc(text) + '">' +
      '<button data-rec="start">● 錄音</button>' +
      '<button data-rec="stop" hidden>■ 停止</button>' +
      '<button data-rec="mine" disabled>▶ 我的</button>' +
      '<button data-rec="orig">▶ 原音</button>' +
      '<span class="small recstate">跟著念一次，再比對原音</span></div>';
  }
  function recAction(act, btn) {
    var bar = btn.closest(".recbar"); if (!bar) return;
    var state = bar.querySelector(".recstate");
    var text = bar.dataset.rectext || "";
    if (act === "orig") { play(text); return; }
    if (act === "mine") { if (recUrl && recTarget === text) { stopAudio(); curAudio = new Audio(recUrl); curAudio.play().catch(function () {}); } return; }
    if (act === "start") {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        recChunks = []; recTarget = text;
        rec = new MediaRecorder(stream);
        rec.ondataavailable = function (e) { if (e.data && e.data.size) recChunks.push(e.data); };
        rec.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          if (recUrl) URL.revokeObjectURL(recUrl);
          recUrl = URL.createObjectURL(new Blob(recChunks, { type: rec.mimeType || "audio/webm" }));
          bar.querySelector('[data-rec="start"]').hidden = false;
          bar.querySelector('[data-rec="stop"]').hidden = true;
          bar.querySelector('[data-rec="mine"]').disabled = false;
          state.textContent = "錄好了。先聽自己的，再聽原音比對。";
        };
        rec.start();
        bar.querySelector('[data-rec="start"]').hidden = true;
        bar.querySelector('[data-rec="stop"]').hidden = false;
        state.textContent = "錄音中…念完按停止";
      }).catch(function () { state.textContent = "沒辦法使用麥克風（瀏覽器沒有允許）"; });
      return;
    }
    if (act === "stop" && rec && rec.state !== "inactive") rec.stop();
  }

  /* ---------- 主題 / 字級 ---------- */
  function applyTheme() {
    var t = setting("theme") || "auto";
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }
  function applyFont() {
    document.documentElement.style.setProperty("--fs", (setting("fs") || 18) + "px");
  }

  /* ---------- SRS：規則在 store.js ---------- */
  function qid(kind, item, idx) { return LESSON_ID + "/" + (item.id || (kind + "-" + String(idx + 1).padStart(2, "0"))); }

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
            (recSupported() ? '<button class="playall recopen" data-recstory="' + i + '">跟讀錄音</button>' : "") +
            (hasTr ? '<span class="lang-tabs" role="group" aria-label="語言切換">' +
              '<button class="active" data-lang="ja">日文</button>' +
              '<button data-lang="both">對照</button>' +
              '<button data-lang="zh">中文</button></span>' : '') +
          '</span>' +
        '</div>' +
        '<div class="recwrap" id="rec' + i + '" hidden></div>' +
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
        '<button data-qdir="listen">聽力</button>' +
        '<button data-qdir="listenex">例句聽力</button>' +
        '<button data-qdir="yomi">漢字読み</button>' +
        '<button data-qdir="hyoki">表記</button></div>' +
      '<div class="filter-row" aria-label="測驗篩選">' +
        '<button class="active" data-qfilter="all">全部</button>' +
        '<button data-qfilter="due">今日複習</button>' +
        '<button data-qfilter="new">未學過</button>' +
        '<button data-qfilter="grad">已畢業</button>' +
        '<span class="small" id="filterInfo"></span></div>' +
      '<div class="quiz-card">' +
        '<div class="small" id="quizCount"></div>' +
        '<div class="quiz-q" id="quizQuestion"></div>' +
        '<div class="quiz-hint" id="quizHint"></div>' +
        '<div class="gq-opts" id="quizChoices" hidden></div>' +
        '<div class="quiz-answer" id="quizAnswer"></div>' +
        '<div class="quiz-controls" id="quizChoiceNext" hidden><button id="choiceNext" class="primary">下一題</button></div>' +
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
        '<button data-gview="quiz">克漏字</button>' +
        '<button data-gview="order">排序</button></div>' +
      '<div id="grammarTable"><div class="story-card">' +
        '<table><thead><tr><th>文法</th><th>例句</th><th>意思</th></tr></thead>' +
        '<tbody id="grammarBody"></tbody></table></div></div>' +
      '<div id="grammarQuizWrap" hidden>' +
        '<div class="filter-row" aria-label="克漏字篩選">' +
          '<button class="active" data-gqfilter="all">全部</button>' +
          '<button data-gqfilter="due">今日到期</button>' +
          '<button data-gqfilter="ng">只練答錯的</button>' +
          '<span class="small" id="gqInfo"></span></div>' +
        '<div class="quiz-card">' +
          '<div class="small" id="gqCount"></div>' +
          '<div class="gq-sentence" id="gqSentence" lang="ja"></div>' +
          '<div class="gq-opts" id="gqOpts"></div>' +
          '<div class="gq-explain" id="gqExplain"></div>' +
          '<div class="quiz-controls"><button id="gqNext">下一題</button></div>' +
        '</div></div>' +
      '<div id="grammarOrderWrap" hidden>' +
        '<div class="legend">把打散的句子照正確順序點回去（JLPT「文の組み立て」題型）。點錯可以按「重來」。</div>' +
        '<div class="quiz-card">' +
          '<div class="small" id="soCount"></div>' +
          '<div class="small" id="soPoint" lang="ja"></div>' +
          '<div class="so-answer" id="soAnswer" lang="ja"></div>' +
          '<div class="so-pool" id="soPool"></div>' +
          '<div class="gq-explain" id="soExplain"></div>' +
          '<div class="quiz-controls"><button id="soReset">重來</button><button id="soNext">下一題</button></div>' +
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
  var readingMode = setting("reading") || "all";
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
    var boxTxt = S.boxLabel(S.getVocab(key));
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
      recorderHTML(v.ex) +
      '<div class="kv"><strong>我的筆記</strong><textarea class="note" data-note="vocab" data-key="' + esc(key) + '" rows="2" placeholder="自己的記法、聯想、常搞混的字…">' + esc(S.getNote("vocab", key)) + "</textarea></div>" +
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
      '<div class="kv"><strong>複習</strong><div class="small">' + esc(S.boxLabel(S.getGrammar((g.point || "").trim()))) + "</div></div>" +
      '<div class="kv"><strong>我的筆記</strong><textarea class="note" data-note="grammar" data-key="' + esc((g.point || "").trim()) + '" rows="2" placeholder="自己的理解、跟哪個文法容易搞混…">' + esc(S.getNote("grammar", (g.point || "").trim())) + "</textarea></div>" +
      '<div class="actions"><button data-act="goto-grammar">查看文法對照表 →</button>' +
        '<a class="btn" href="grammar-index.html">查 N4 文法清單 ↗</a></div>';
    modal.classList.add("show");
  }
  function rateSrs(key, rating) {
    S.rateVocab(key, rating);
    updateProgress();
    if (modal.classList.contains("show")) openCard(key);
  }

  function keysAll() { return Object.keys(vocab); }
  function dueKeys() { return S.dueVocab(keysAll()); }
  function newKeys() { return keysAll().filter(function (k) { var r = S.getVocab(k); return !r || !r.seen; }); }
  function updateProgress() {
    var st = S.stats("vocab", keysAll());
    $("progressText").textContent =
      "熟練 " + st.master + " / " + st.total + (st.due ? " · 今日複習 " + st.due : "");
    $("progressFill").style.width = (st.total ? st.master / st.total * 100 : 0) + "%";
    $("statMaster").textContent = st.master;
    $("statLearning").textContent = st.learning;
    $("statDue").textContent = st.due;
    $("statNew").textContent = st.fresh;
  }

  /* ---------- 單字測驗（Anki 流程：看題 → 顯示答案 → 評分 → 自動下一題）---------- */
  var quizKeys = [], qi = 0, quizDir = "jpzh", quizFilter = "all", answerShown = false;
  function getFilteredKeys() {
    if (quizFilter === "due") return dueKeys();
    if (quizFilter === "new") return newKeys();
    if (quizFilter === "grad") return keysAll().filter(function (k) { return S.isGraduated(S.getVocab(k)); });
    return keysAll();
  }
  var HAS_KANJI_RE = new RegExp("[" + KANJI + "]");
  function isChoiceDir() { return quizDir === "yomi" || quizDir === "hyoki"; }
  function kanjiKeys(keys) { return keys.filter(function (k) { return HAS_KANJI_RE.test(vocab[k].dict) && vocab[k].reading !== vocab[k].dict; }); }
  function shuffle() {
    var keys = getFilteredKeys().slice();
    if (isChoiceDir()) keys = kanjiKeys(keys);
    quizKeys = keys.sort(function () { return Math.random() - 0.5; }); qi = 0; renderQuiz();
  }
  // 四選一的干擾項：同課其他字，讀音長度相近的優先
  function distractors(k, field) {
    var v = vocab[k], want = v[field];
    var pool = kanjiKeys(keysAll()).filter(function (o) { return o !== k && vocab[o][field] !== want; });
    pool.sort(function (a, b) {
      var da = Math.abs(vocab[a][field].length - want.length), db = Math.abs(vocab[b][field].length - want.length);
      return da - db || Math.random() - 0.5;
    });
    var near = pool.slice(0, 8).sort(function () { return Math.random() - 0.5; });
    var out = [], seen = {}; seen[want] = 1;
    near.concat(pool).forEach(function (o) { var t = vocab[o][field]; if (out.length < 3 && !seen[t]) { seen[t] = 1; out.push(t); } });
    return out;
  }
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
    $("quizChoices").hidden = true; $("quizChoiceNext").hidden = true;
    if (!quizKeys.length) {
      $("quizCount").textContent = "0 / 0";
      var q0 = $("quizQuestion"); q0.lang = ""; q0.textContent = "目前沒有符合條件的單字";
      $("quizHint").textContent = quizFilter === "due" ? "今天沒有到期的字。" : quizFilter === "grad" ? "還沒有畢業的字（連續記得到 box 6 就畢業）。" : "所有單字都練過了。";
      ans.innerHTML = "";
      $("quizPre").hidden = true;
      return;
    }
    if (qi >= quizKeys.length) qi = 0;
    var k = quizKeys[qi], v = vocab[k], q = $("quizQuestion");
    $("quizCount").textContent = (qi + 1) + " / " + quizKeys.length;
    if (isChoiceDir()) {
      var field = quizDir === "yomi" ? "reading" : "dict";
      var opts = distractors(k, field).concat([v[field]]).sort(function () { return Math.random() - 0.5; });
      q.lang = "ja"; q.textContent = quizDir === "yomi" ? v.dict : v.reading;
      $("quizHint").textContent = quizDir === "yomi" ? "這個字怎麼念？" : "這個讀音是哪個字？";
      $("quizChoices").innerHTML = opts.map(function (o) { return '<button data-choice="' + esc(o) + '" lang="ja">' + esc(o) + "</button>"; }).join("");
      $("quizChoices").hidden = false; $("quizPre").hidden = true;
      ans.innerHTML = '<strong lang="ja">' + esc(v.dict) + '</strong><span lang="ja">' + esc(v.reading) + '</span><div>' + esc(v.zh) + '</div><div class="example" lang="ja">' + esc(v.ex) + "</div>";
      return;
    }
    if (quizDir === "jpzh") {
      q.lang = "ja"; q.textContent = v.dict;
      $("quizHint").innerHTML = '<button class="hintbtn" id="hintBtn">看讀音提示</button>';
      ans.innerHTML = '<span lang="ja">' + esc(v.reading) + "</span><strong>" + esc(v.zh) + '</strong><div class="example" lang="ja">' + esc(v.ex) + "</div>";
    } else if (quizDir === "zhjp") {
      q.lang = ""; q.textContent = v.zh.split("、")[0];
      $("quizHint").textContent = "先想日文怎麼說，再顯示答案";
      ans.innerHTML = '<strong lang="ja">' + esc(v.dict) + '</strong><span lang="ja">' + esc(v.reading) + '</span><div class="example" lang="ja">' + esc(v.ex) + "</div>";
    } else if (quizDir === "listenex") {
      q.lang = ""; q.innerHTML = '<button class="bigplay" id="listenPlay">▶ 再聽一次</button>';
      $("quizHint").textContent = "聽整句，想這句在說什麼、關鍵字是哪個";
      ans.innerHTML = '<div class="example" lang="ja">' + esc(v.ex) + '</div><strong lang="ja">' + esc(v.dict) + '</strong><span lang="ja">' + esc(v.reading) + "</span><div>" + esc(v.zh) + "</div>";
      play(v.ex);
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
      var rec = S.getVocab(k);
      if (quizFilter === "due" && rec && rec.box === 0) quizKeys.push(k);
      if (qi >= quizKeys.length) qi = 0;
    }
    renderQuiz();
  }
  function setQuizDir(dir) {
    quizDir = dir;
    document.querySelectorAll("[data-qdir]").forEach(function (b) { b.classList.toggle("active", b.dataset.qdir === dir); });
    shuffle();
  }

  /* ---------- 文法克漏字 ---------- */
  var gqOrder = [], gqi = 0, gqFilter = "all", gqAnswered = false;
  function gqAll() { return DATA.grammarQuiz || []; }
  function gqWrong() { return gqAll().filter(function (q, i) { var r = S.getQuiz(qid("gq", q, i)); return r && r.r === "ng"; }).length; }
  function gqPoint(item) { var g = (DATA.grammar || [])[item.g]; return g ? (g.point || "").trim() : ""; }
  function gqPool() {
    var idx = gqAll().map(function (_, i) { return i; });
    if (gqFilter === "ng") return idx.filter(function (i) { var r = S.getQuiz(qid("gq", gqAll()[i], i)); return r && r.r === "ng"; });
    if (gqFilter === "due") return idx.filter(function (i) { return S.isDue(S.getGrammar(gqPoint(gqAll()[i]))); });
    return idx;
  }
  function gqShuffle() { gqOrder = gqPool().slice().sort(function () { return Math.random() - 0.5; }); gqi = 0; gqRender(); }
  function gqInfo() {
    var pts = (DATA.grammar || []).map(function (g) { return (g.point || "").trim(); });
    $("gqInfo").textContent = "共 " + gqAll().length + " 題 · 今日到期 " + S.dueGrammar(pts).length + " 點 · 答錯 " + gqWrong();
  }
  function gqRender() {
    gqInfo();
    var opts = $("gqOpts"), expl = $("gqExplain");
    if (!gqOrder.length) {
      $("gqCount").textContent = "0 / 0";
      $("gqSentence").textContent = gqFilter === "ng" ? "目前沒有答錯的題目" : gqFilter === "due" ? "今天沒有到期的文法點" : "沒有題目";
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

  /* ---------- 並べ替え（文の組み立て）：用 grammar[].chunks ---------- */
  var soOrder = [], soi = 0, soPicked = [], soDone = false;
  function soAll() { return (DATA.grammar || []).map(function (g, i) { return { g: g, i: i }; }).filter(function (x) { return Array.isArray(x.g.chunks) && x.g.chunks.length >= 3; }); }
  function soShuffle() { soOrder = soAll().sort(function () { return Math.random() - 0.5; }); soi = 0; soRender(); }
  function soRender() {
    var pool = $("soPool"), ansEl = $("soAnswer"), expl = $("soExplain");
    soPicked = []; soDone = false; expl.classList.remove("show"); expl.innerHTML = "";
    if (!soOrder.length) {
      $("soCount").textContent = "0 / 0"; $("soPoint").textContent = "這一課的文法點還沒有排序題（需要 grammar[].chunks）";
      ansEl.innerHTML = ""; pool.innerHTML = ""; return;
    }
    if (soi >= soOrder.length) soi = 0;
    var item = soOrder[soi], chunks = item.g.chunks.slice();
    var order = chunks.map(function (_, i) { return i; });
    do { order.sort(function () { return Math.random() - 0.5; }); } while (chunks.length > 1 && order.every(function (v, i) { return v === i; }));
    $("soCount").textContent = (soi + 1) + " / " + soOrder.length;
    $("soPoint").textContent = "文法：" + item.g.point + "　" + item.g.meaning;
    ansEl.innerHTML = '<span class="so-slot">點下面的片段…</span>';
    pool.innerHTML = order.map(function (ci) { return '<button data-ci="' + ci + '" lang="ja">' + esc(chunks[ci]) + "</button>"; }).join("");
  }
  function soPaint() {
    var item = soOrder[soi], chunks = item.g.chunks;
    $("soAnswer").innerHTML = soPicked.length ? soPicked.map(function (ci) { return '<span class="so-chip">' + esc(chunks[ci]) + "</span>"; }).join("") : '<span class="so-slot">點下面的片段…</span>';
  }
  function soCheck() {
    var item = soOrder[soi], ok = soPicked.every(function (ci, i) { return ci === i; });
    soDone = true;
    var expl = $("soExplain");
    expl.innerHTML = (ok ? "正確" : "順序不對。正確句子：") + '<div class="small" style="margin-top:6px" lang="ja">' + esc(item.g.example) + "</div>" +
      '<div class="small" style="margin-top:4px">' + esc(item.g.meaning) + "</div>";
    expl.classList.add("show");
    $("soAnswer").classList.toggle("so-ok", ok); $("soAnswer").classList.toggle("so-ng", !ok);
    S.rateGrammar((item.g.point || "").trim(), ok ? "good" : "bad"); gqInfo();
  }

  /* ---------- 讀解測驗 ---------- */
  var rqOrder = [], rqi = 0, rqFilter = "all", rqAnswered = false;
  function rqAll() { return DATA.reading || []; }
  function rqIsWrong(i) { var r = S.getQuiz(qid("rq", rqAll()[i], i)); return r && r.r === "ng"; }
  function rqPool() {
    var idx = rqAll().map(function (_, i) { return i; });
    var m = /^s(\d+)$/.exec(rqFilter);
    if (m) return idx.filter(function (i) { return rqAll()[i].st === +m[1]; });
    if (rqFilter === "ng") return idx.filter(rqIsWrong);
    return idx;
  }
  function rqShuffle() { rqOrder = rqPool().slice().sort(function () { return Math.random() - 0.5; }); rqi = 0; rqRender(); }
  function rqInfo() {
    var wrong = rqAll().filter(function (_, i) { return rqIsWrong(i); }).length;
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
    setSetting("lastTab", name);
    document.querySelectorAll(".tabs button").forEach(function (x) { x.classList.toggle("active", x.dataset.tab === name); });
    document.querySelectorAll(".section").forEach(function (x) { x.classList.toggle("active", x.id === name); });
    $("hud").hidden = !(name === "vocabtable" || name === "quiz");
    $("readingRow").hidden = !(name === "stories" && !$("storyRead").hidden);
    if (name === "quiz") { $("quizDock").hidden = !answerShown || !quizKeys.length || isChoiceDir(); }
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

    sheet.addEventListener("change", function (e) {
      if (e.target.id === "importFile" && e.target.files && e.target.files[0]) importProgress(e.target.files[0]);
    });
    var noteTimer = null;
    sheet.addEventListener("input", function (e) {
      var t = e.target; if (!t.classList || !t.classList.contains("note")) return;
      clearTimeout(noteTimer);
      noteTimer = setTimeout(function () { S.setNote(t.dataset.note, t.dataset.key, t.value); }, 400);
    });
    sheet.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act],[data-set],[data-rec]"); if (!b) return;
      if (b.dataset.act === "close") { modal.classList.remove("show"); return; }
      if (b.dataset.act === "play-dict") play(currentCardKey && vocab[currentCardKey].dict);
      else if (b.dataset.act === "play-ex") play(currentCardKey && vocab[currentCardKey].ex);
      else if (b.dataset.act === "rate") rateSrs(currentCardKey, b.dataset.val);
      else if (b.dataset.act === "goto-grammar") { modal.classList.remove("show"); setTab("grammar"); }
      else if (b.dataset.act === "shuffle") { modal.classList.remove("show"); shuffle(); gqShuffle(); rqShuffle(); soShuffle(); }
      else if (b.dataset.act === "reset") {
        if (confirm("確定要清除這一課的單字、文法、讀解練習紀錄嗎？（其他課不受影響）")) {
          S.resetProgress({ vocabKeys: keysAll(), grammarPoints: (DATA.grammar || []).map(function (g) { return g.point; }), quizPrefix: LESSON_ID + "/" });
          updateProgress(); shuffle(); gqShuffle(); rqShuffle(); modal.classList.remove("show");
        }
      }
      else if (b.dataset.act === "export") exportProgress();
      else if (b.dataset.act === "import") $("importFile").click();
      else if (b.dataset.set === "theme") { setSetting("theme", b.dataset.val); applyTheme(); openSettings(); }
      else if (b.dataset.set === "fs") { setSetting("fs", +b.dataset.val); applyFont(); openSettings(); }
      else if (b.dataset.set === "rate") { setSetting("audioRate", +b.dataset.val); openSettings(); }
      else if (b.dataset.rec) recAction(b.dataset.rec, b);
    });

    $("gearBtn").onclick = openSettings;

    document.querySelectorAll("[data-rd]").forEach(function (b) {
      b.onclick = function () { readingMode = b.dataset.rd; setSetting("reading", readingMode); applyReading(); };
    });

    // tabs
    document.querySelectorAll(".tabs button").forEach(function (b) {
      b.onclick = function () { stopAudio(); setTab(b.dataset.tab); };
    });
    $("tip").addEventListener("toggle", function () { setSetting("tipOpen", $("tip").open); });

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
        $("grammarOrderWrap").hidden = v !== "order";
      };
    });
    $("grammarBody").addEventListener("click", function (e) {
      var r = e.target.closest("tr[data-g]"); if (r) openGrammarCard(+r.dataset.g);
    });

    // delegated: play / word / playall / lang
    document.addEventListener("click", function (e) {
      var ro = e.target.closest(".recopen");
      if (ro) {
        var wrap = $("rec" + ro.dataset.recstory);
        if (wrap.hidden) {
          var texts = [].slice.call($("story" + ro.dataset.recstory).querySelectorAll(".play")).map(function (x) { return x.dataset.audio; });
          wrap.innerHTML = recorderHTML(texts[0] || "") + '<div class="small">錄第一段就好；原音也是第一段。想錄別段，按那一段的 ▶ 聽完再自己念。</div>';
        }
        wrap.hidden = !wrap.hidden;
        return;
      }
      var rb = e.target.closest("[data-rec]");
      if (rb && rb.closest("#storyRead")) { recAction(rb.dataset.rec, rb); return; }
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
      if (isChoiceDir()) {
        if (!answerShown && /^[1-4]$/.test(e.key)) { var cb = $("quizChoices").querySelectorAll("button")[+e.key - 1]; if (cb) { e.preventDefault(); cb.click(); } }
        else if (answerShown && (e.key === " " || e.key === "ArrowRight")) { e.preventDefault(); afterQuizRate(); }
        return;
      }
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
      if (e.target.closest("#listenPlay") && quizKeys.length) play(quizDir === "listenex" ? vocab[quizKeys[qi]].ex : vocab[quizKeys[qi]].dict);
    });
    // 漢字読み／表記：選了就評分（對＝記得、錯＝不記得），看完答案自己按下一題
    $("quizChoices").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-choice]"); if (!b || answerShown || !quizKeys.length) return;
      var k = quizKeys[qi], v = vocab[k], want = quizDir === "yomi" ? v.reading : v.dict, ok = b.dataset.choice === want;
      answerShown = true;
      $("quizChoices").querySelectorAll("button").forEach(function (x) {
        x.disabled = true;
        if (x.dataset.choice === want) x.classList.add("correct"); else if (x === b) x.classList.add("wrong");
      });
      $("quizAnswer").classList.add("show"); $("quizChoiceNext").hidden = false;
      S.rateVocab(k, ok ? "good" : "bad"); updateProgress();
      play(v.dict);
    });
    $("choiceNext").onclick = function () { afterQuizRate(); };
    $("speakQuiz").onclick = function () { if (quizKeys.length) play(quizDir === "listenex" ? vocab[quizKeys[qi]].ex : vocab[quizKeys[qi]].dict); };
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
      S.markQuiz(qid("gq", item, gqOrder[gqi]), ok);
      S.rateGrammar(gqPoint(item), ok ? "good" : "bad"); gqInfo();
    });
    $("gqNext").onclick = function () { if (gqOrder.length) { gqi = (gqi + 1) % gqOrder.length; gqRender(); } };
    // 並べ替え
    $("soPool").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-ci]"); if (!b || soDone) return;
      b.disabled = true; soPicked.push(+b.dataset.ci); soPaint();
      if (soPicked.length === soOrder[soi].g.chunks.length) soCheck();
    });
    $("soReset").onclick = function () {
      if (!soOrder.length) return;
      soPicked = []; soDone = false; $("soAnswer").classList.remove("so-ok", "so-ng"); $("soExplain").classList.remove("show");
      $("soPool").querySelectorAll("button").forEach(function (x) { x.disabled = false; }); soPaint();
    };
    $("soNext").onclick = function () { if (soOrder.length) { soi = (soi + 1) % soOrder.length; $("soAnswer").classList.remove("so-ok", "so-ng"); soRender(); } };
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
      S.markQuiz(qid("rq", item, rqOrder[rqi]), ok); rqInfo();
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

  function exportProgress() {
    var blob = new Blob([S.exportAll()], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "jl-progress-" + S.today().replace(/-/g, "") + ".json";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function importProgress(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(fr.result);
        var n = d && d.progress && d.progress.vocab ? Object.keys(d.progress.vocab).length : 0;
        if (!confirm("這個檔案有 " + n + " 個單字的紀錄。要合併進目前的進度嗎？（較新的會蓋過較舊的）")) return;
        S.importAll(d);
        applyTheme(); applyFont(); updateProgress(); shuffle(); gqShuffle(); rqShuffle();
        alert("匯入完成。");
        openSettings();
      } catch (e) { alert("匯入失敗：" + e.message); }
    };
    fr.readAsText(file);
  }
  function openSettings() {
    var cfg = S.getSettings(), t = cfg.theme, fs = String(cfg.fs);
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
      '<div class="setrow"><span class="lab">語速（預錄語音與瀏覽器語音都適用）</span>' +
        '<button data-set="rate" data-val="0.75" class="' + act("0.75", String(cfg.audioRate || 1)) + '">慢 0.75x</button>' +
        '<button data-set="rate" data-val="1" class="' + act("1", String(cfg.audioRate || 1)) + '">正常 1x</button></div>' +
      '<div class="setrow"><span class="lab">練習</span>' +
        '<button data-act="shuffle">重新洗牌所有題目</button>' +
        '<button data-act="reset" class="danger">清除這一課的紀錄</button></div>' +
      '<div class="setrow"><span class="lab">備份（進度存在這個瀏覽器裡，換手機前先匯出）</span>' +
        '<button data-act="export">匯出進度檔</button>' +
        '<button data-act="import">匯入進度檔</button>' +
        '<input type="file" id="importFile" accept="application/json,.json" hidden></div>' +
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
    $("tip").open = setting("tipOpen") !== false;
    applyReading();
    updateProgress();
    shuffle(); gqShuffle(); rqShuffle(); soShuffle();
    setTab(setting("lastTab") || "stories");
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
    try { if (S) S.migrateLegacy([LESSON_ID]); boot(); }
    catch (e) { console.error(e); fail("課程渲染失敗（" + e.message + "）。請把這段訊息回報。"); }
  }).catch(function (e) {
    console.error(e);
    fail("課程資料載入失敗（" + e.message + "）。請用本機伺服器或線上版開啟，不能雙擊檔案。");
  });
})();
