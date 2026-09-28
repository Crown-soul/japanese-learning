/* ============================================================
   基礎詞彙練習器（lessons/basics.html）
   題庫：data/basics.json（單元 → 小節 → 項目／例句／題目，id 穩定）
   每一小節一頁到底：①目標 ②學習 ③對照 ④練習 ⑤回想 ⑥應用 ⑦回顧
   外觀沿用 lesson.css（.panel、.gq-opts、.status-btn、.tabs…），basics.css 只補缺的
   進度只透過 JLStore：rateBasics（rec＝認得、rc＝想得起來）、markBasicsSection、seedBasics
   音檔 key：「basics:<項目或例句 id>」（generate-audio.py 產）
   ============================================================ */
(function () {
  "use strict";
  var S = window.JLStore;
  var D = null, AUDIO = {}, curAudio = null;
  var view = "home", cur = null;   // cur：目前的小節或複習 {sid?, qs:{uid:q}, answered:{id:{ok,rating,q}}}
  var ERR_LABEL = { reading: "讀音", counter: "量詞", context: "情境" };
  var RATE_BTNS = [["bad", "不記得"], ["mid", "有點模糊"], ["good", "記得"]];   // 跟引擎的評分鈕同順序、同文字

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function item(id) { return D.items[id]; }
  function ex(id) { return D.examples[id]; }

  /* ---------- 設定（主題、字級沿用全站設定） ---------- */
  function applySettings() {
    var c = S.getSettings();
    if (!c.theme || c.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", c.theme);
    document.documentElement.style.setProperty("--fs", (c.fs || 18) + "px");
  }

  /* ---------- 音檔 ---------- */
  function stopAudio() { if (curAudio) { curAudio.pause(); curAudio = null; } if ("speechSynthesis" in window) speechSynthesis.cancel(); }
  // 沒有預錄音檔就用瀏覽器語音念假名；兩者都不行時呼叫 onFail（聽力題據此略過，不算錯）
  function speak(text, onFail) {
    if (!("speechSynthesis" in window) || !text) { if (onFail) onFail(); return; }
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP"; u.rate = 0.85 * (S.getSettings().audioRate || 1);
    u.onerror = function () { if (onFail) onFail(); };
    speechSynthesis.speak(u);
  }
  function play(id, onFail) {
    stopAudio();
    var o = item(id) || ex(id); if (!o) return;
    var spoken = o.kana || o.say || o.ja, file = AUDIO["basics:" + id];
    if (file && /^[0-9a-f]{8,40}\.mp3$/.test(file)) {
      curAudio = new Audio("../audio/" + file);
      curAudio.playbackRate = S.getSettings().audioRate || 1;
      curAudio.play().catch(function () { speak(spoken, onFail); });
    } else speak(spoken, onFail);
  }
  function playBtn(id) { return '<button class="bx-play" data-play="' + esc(id) + '" aria-label="播放">▶</button>'; }

  /* ---------- 答案比對（片假名轉平假名、去空白與標點；っ、長音照樣要對） ---------- */
  function norm(s) {
    return String(s || "").replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); })
      .replace(/[\s　。、！？!?,.「」]/g, "");
  }
  function accepts(list, typed) { var t = norm(typed); return !!t && list.some(function (a) { return norm(a) === t; }); }

  /* ---------- 內容片段 ---------- */
  function itemCard(id) {
    var it = item(id);
    return '<button class="bx-item' + (it.mark ? " mk-" + it.mark : "") + '" data-play="' + esc(id) + '">' +
      '<span class="ja" lang="ja">' + esc(it.ja) + '</span><span class="kana" lang="ja">' + esc(it.kana) + "</span>" +
      (it.alt ? '<span class="alt" lang="ja">也可：' + esc(it.alt.join("、")) + "</span>" : "") +
      (it.zh !== it.ja ? '<span class="zh">' + esc(it.zh) + "</span>" : "") + "</button>";
  }
  function exRow(id) {
    var e = ex(id);
    return '<div class="bx-ex">' + playBtn(id) + '<div><div class="ja" lang="ja">' + esc(e.ja) + '</div><div class="zh">' + esc(e.zh) + "</div></div></div>";
  }
  function legend() {
    return '<div class="bx-legend"><span class="mk-p">變成 っ＋ぱ</span><span class="mk-b">變成 ば</span><span>不變</span></div>';
  }
  function cell(id) {
    var it = item(id);
    return '<button data-play="' + esc(id) + '"><span lang="ja">' + esc(it.ja) + '</span><span class="k" lang="ja">' + esc(it.kana) + "</span></button>";
  }
  function familyTable() {
    var rows = [["父親", "fam-chichi", "fam-otousan", "fam-otousan"], ["母親", "fam-haha", "fam-okaasan", "fam-okaasan"],
                ["哥哥", "fam-ani", "fam-oniisan", "fam-oniichan"], ["姊姊", "fam-ane", "fam-oneesan", "fam-oneechan"]];
    var h = '<div class="bx-scroll"><table class="bx-table"><tr><th></th><th>對外人<br>講自己家</th><th>講<br>別人家</th><th>直接叫</th></tr>';
    rows.forEach(function (r) {
      var alt = r[3] !== r[2] ? '<span class="k">或 ' + esc(item(r[2]).ja) + "</span>" : "";
      h += "<tr><th>" + r[0] + "</th><td>" + cell(r[1]) + "</td><td>" + cell(r[2]) + "</td><td>" + cell(r[3]) + alt + "</td></tr>";
    });
    return h + "</table></div>";
  }
  function pairTable(pairs) {
    return '<div class="bx-scroll"><table class="bx-table"><tr><th>對外人講自己家</th><th>講別人家</th></tr>' +
      pairs.map(function (p) { return "<tr><td>" + cell(p[0]) + "</td><td>" + cell(p[1]) + "</td></tr>"; }).join("") + "</table></div>";
  }
  function compareHTML(c) {
    if (c.table) return familyTable();
    if (c.family) return pairTable(c.family);
    return legend() + '<div class="bx-items">' + c.items.map(itemCard).join("") + "</div>";
  }
  function rulesHTML(rules) { return '<ul class="bx-rules">' + rules.map(function (r) { return "<li>" + r + "</li>"; }).join("") + "</ul>"; }

  /* ---------- 首頁：依序上課 ---------- */
  function renderHome() {
    var h = '<div class="tip">一個小節約 10 分鐘，一頁從上往下做：①目標 → ②學習 → ③對照 → ④練習 → ⑤回想 → ⑥應用 → ⑦回顧。忘記時到「查表」看。</div>';
    D.units.forEach(function (u, i) {
      if (!u.sections.length) { h += '<div class="panel bx-unit off">單元 ' + (i + 1) + "　" + esc(u.title) + "（即將推出）</div>"; return; }
      h += '<div class="panel bx-unit"><div class="small">單元 ' + (i + 1) + "</div><h2>" + esc(u.title) + '</h2><div class="small">學完能：' + esc(u.can) + '</div><div class="bx-secs">' +
        u.sections.map(function (sid) {
          var done = S.getBasicsSection(sid);
          return '<button data-sec="' + esc(sid) + '"><span>' + esc(D.sections[sid].title) + "</span>" +
            (done ? '<span class="small bx-done">✓ 上過</span>' : '<span class="small">開始</span>') + "</button>";
        }).join("") + "</div>" + (u.more ? '<p class="small">' + esc(u.more) + "</p>" : "") + "</div>";
    });
    $("main").innerHTML = h;
  }

  /* ---------- 查表 ---------- */
  function renderLookup() {
    var h = "";
    D.units.forEach(function (u) {
      if (!u.sections.length) return;
      h += '<div class="panel"><h2>' + esc(u.title) + "</h2>";
      if (u.id === "u09") h += familyTable();
      else {
        var ids = [];
        u.sections.forEach(function (sid) { D.sections[sid].items.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); });
        h += legend() + '<div class="bx-items">' + ids.map(itemCard).join("") + "</div>";
      }
      u.sections.forEach(function (sid) { h += "<h3>" + esc(D.sections[sid].title) + "</h3>" + rulesHTML(D.sections[sid].rules); });
      h += "</div>";
    });
    $("main").innerHTML = h;
  }

  /* ---------- 題目 ----------
     q.kind：choice | listen | recall | apply；q.track：rec | rc
     第一次作答才記分；選擇／聽力答錯，隔 3 題插一題「再試一次」（不計分）。 */
  function makeQuiz(q) { return Object.assign({ kind: q.type, track: "rec" }, q); }
  function makeRecall(r) {
    var it = item(r.item), also = (it.alt || []).concat((r.accept || []).filter(function (a) { return a !== it.ja && a !== it.kana && !/^[ぁ-ん]+$/.test(a); }));
    return { kind: "recall", track: "rc", id: r.id, item: r.item, prompt: r.prompt, play: r.item,
      answerHTML: '<strong lang="ja">' + esc(it.ja) + "（" + esc(it.kana) + "）</strong>" + (also.length ? '<span lang="ja">也可以：' + esc(also.join("、")) + "</span>" : ""),
      accept: [it.kana, it.ja].concat(it.alt || [], r.accept || []) };
  }
  function makeApply(a) {
    var e = ex(a.ex);
    return { kind: "apply", track: "rc", id: a.id, prompt: a.prompt, play: a.ex,
      answerHTML: '<strong lang="ja">' + esc(e.ja) + "</strong><span>" + esc(e.zh) + "</span>",
      accept: [e.ja].concat(e.kana ? [e.kana] : []) };
  }
  // 複習用：有現成題目就用，沒有就從項目產一題
  function reviewQuestion(id, track) {
    var secs = Object.keys(D.sections).map(function (k) { return D.sections[k]; });
    if (track === "rc") {
      var r = null;
      secs.forEach(function (s) { (s.recall || []).forEach(function (x) { if (x.item === id && !r) r = x; }); });
      return makeRecall(r || { id: "gen-" + id + "-rc", item: id, prompt: "「" + item(id).ja + "」怎麼念？先自己說說看" });
    }
    var pool = [];
    secs.forEach(function (s) { s.quiz.forEach(function (q) { if (q.item === id) pool.push(q); }); });
    if (pool.length) return makeQuiz(pool[Math.floor(Math.random() * pool.length)]);
    var sib = [];
    secs.forEach(function (s) { if (s.items.indexOf(id) >= 0) sib = s.items.filter(function (x) { return x !== id; }); });
    var opts = shuffle([id].concat(shuffle(sib).slice(0, 2)));
    return { kind: "listen", track: "rec", id: "gen-" + id + "-rec", item: id, err: "reading", options: opts.map(function (x) { return item(x).ja; }), answer: opts.indexOf(id) };
  }

  function qHTML(q, label) {
    var uid = q.id + (q.retry ? "~r" : "");
    cur.qs[uid] = q;
    var h = '<div class="bx-q' + (q.retry ? " retry" : "") + '" id="bq-' + esc(uid) + '"><div class="small">' + esc(q.retry ? "再試一次（不計分）" : label) + "</div>";
    if (q.scene) h += '<div class="bx-scene"><b>' + esc(q.scene[0]) + "</b> 對 <b>" + esc(q.scene[1]) + "</b> 說" +
      (q.scene[2] && q.scene[2] !== "—" ? "，講的是 <b>" + esc(q.scene[2]) + "</b>" : "") + "</div>";
    if (q.kind === "choice" || q.kind === "listen") {
      h += q.kind === "listen"
        ? '<div class="gq-sentence">聽聽看，是哪一個？ <button class="playall" data-listen="' + esc(uid) + '">▶ 播放</button></div>'
        : '<div class="gq-sentence" lang="ja">' + esc(q.prompt) + "</div>";
      var order = q.options.map(function (_, i) { return i; });
      if (q.retry) order = shuffle(order);
      h += '<div class="gq-opts">' + order.map(function (i) { return '<button data-uid="' + esc(uid) + '" data-opt="' + i + '" lang="ja">' + esc(q.options[i]) + "</button>"; }).join("") + "</div>";
      h += '<div class="gq-explain" id="fb-' + esc(uid) + '"></div>';
    } else {
      h += '<div class="gq-sentence">' + esc(q.prompt) + "</div>" +
        '<input class="bx-input" id="in-' + esc(uid) + '" data-uid="' + esc(uid) + '" lang="ja" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="先在心裡或出聲說一次；想打字也可以">' +
        '<button class="primary" data-reveal="' + esc(uid) + '">顯示答案</button>' +
        '<div class="quiz-answer" id="fb-' + esc(uid) + '"></div>';
    }
    return h + "</div>";
  }
  function answerChoice(uid, i) {
    var q = cur.qs[uid], box = $("bq-" + uid);
    if (!q || box.dataset.done) return;
    box.dataset.done = 1;
    var ok = i === q.answer, it = q.item ? item(q.item) : null;
    box.querySelectorAll("[data-opt]").forEach(function (b) {
      var v = +b.dataset.opt; b.disabled = true;
      if (v === q.answer) b.classList.add("correct"); else if (v === i) b.classList.add("wrong");
    });
    var fb = $("fb-" + uid);
    fb.innerHTML = (ok ? "<b>答對了</b>" : '<b>正確答案：<span lang="ja">' + esc(q.options[q.answer]) + "</span></b>") +
      (it ? '<div lang="ja">' + esc(it.ja) + "＝" + esc(it.kana) + (it.alt ? "（也可：" + esc(it.alt.join("、")) + "）" : "") + " " + playBtn(q.item) + "</div>" : "") +
      (q.why ? "<div>" + esc(q.why) + "</div>" : "") + (!ok && !q.retry ? '<div class="small">隔幾題會再出一次。</div>' : "");
    fb.classList.add("show");
    record(q, ok, ok ? "good" : "bad", box);
  }
  function reveal(uid) {
    var q = cur.qs[uid], box = $("bq-" + uid);
    if (!q || box.dataset.done) return;
    box.dataset.done = 1;
    var input = $("in-" + uid), typed = input.value.trim();
    input.disabled = true;
    box.querySelector("[data-reveal]").hidden = true;
    var fb = $("fb-" + uid), h = "<span>答案</span>" + q.answerHTML.replace("</strong>", playBtn(q.play) + "</strong>");
    if (typed) {
      var ok = accepts(q.accept, typed);
      h += "<div>" + (ok ? "你打的答案正確。" : "你打的是「" + esc(typed) + "」，跟答案不一樣，再對照一次。") + "</div>";
      fb.innerHTML = h; fb.classList.add("show");
      record(q, ok, ok ? "good" : "bad", box);
    } else {
      h += '<div class="actions">' + RATE_BTNS.map(function (r) { return '<button class="status-btn ' + r[0] + '" data-uid="' + esc(uid) + '" data-rate="' + r[0] + '">' + r[1] + "</button>"; }).join("") +
        '</div><div class="small">自己評分：系統聽不到你的發音。</div>';
      fb.innerHTML = h; fb.classList.add("show");
    }
    play(q.play);
  }
  function selfRate(uid, rating) {
    var q = cur.qs[uid], box = $("bq-" + uid);
    if (!q || box.dataset.rated) return;
    box.dataset.rated = 1;
    box.querySelectorAll("[data-rate]").forEach(function (b) { b.disabled = true; b.classList.toggle("active", b.dataset.rate === rating); });
    record(q, rating !== "bad", rating, box);
  }
  function record(q, ok, rating, box) {
    if (q.retry) return;
    cur.answered[q.id] = { ok: ok, rating: rating, q: q };
    // 同一頁裡同一個項目常有好幾題：只在第一次評分時升箱，之後只有答錯才再記（退回），不然一節課就跳好幾箱
    var rk = q.item + "#" + q.track;
    if (q.item && (!cur.rated[rk] || rating === "bad")) { S.rateBasics(q.item, q.track, rating, ok ? null : q.err); cur.rated[rk] = 1; }
    if (q.id.indexOf("gen-") !== 0) S.markQuiz("basics/" + q.id, ok);
    if (!ok && (q.kind === "choice" || q.kind === "listen")) {
      // 往後數 3 題插在後面；後面不夠就放在這一段最後
      var after = box, n = 0;
      while (after.nextElementSibling && after.nextElementSibling.classList.contains("bx-q") && n < 3) { after = after.nextElementSibling; n++; }
      after.insertAdjacentHTML("afterend", qHTML(Object.assign({}, q, { retry: true }), ""));
    }
    updateSummary(); updateDue();
  }

  /* ---------- 小節（一頁到底） ---------- */
  function renderSection(sid) {
    var s = D.sections[sid];
    cur = { sid: sid, qs: {}, answered: {}, rated: {}, total: s.quiz.length + s.recall.length + 1 };
    var h = '<button class="bx-back" data-view="home">← 單元列表</button>' +
      '<div class="panel"><h2>① 目標：' + esc(s.title) + "</h2><p>" + esc(s.goal) + '</p><h3>用在哪裡</h3><p>' + esc(s.use) + "</p></div>" +
      '<div class="panel"><h2>② 學習（' + s.items.length + ' 個新項目）</h2><p class="small">點卡片聽發音。</p><div class="bx-items">' + s.items.map(itemCard).join("") + "</div>" +
      "<h3>例句</h3>" + s.examples.map(exRow).join("") + "</div>" +
      '<div class="panel"><h2>③ 對照：' + esc(s.compare.title) + "</h2>" + compareHTML(s.compare) + "<h3>規則</h3>" + rulesHTML(s.rules) + "</div>" +
      '<div class="panel"><h2>④ 練習</h2><p class="small">先看字選答案，再聽音辨認。</p><div>' +
      s.quiz.map(function (q, i) { return qHTML(makeQuiz(q), "練習 " + (i + 1) + (q.err ? "・" + ERR_LABEL[q.err] : "")); }).join("") + "</div></div>" +
      '<div class="panel"><h2>⑤ 回想</h2><p class="small">先自己說出答案，再按「顯示答案」。會打字的話也可以打，系統會對答案。</p><div>' +
      s.recall.map(function (r, i) { return qHTML(makeRecall(r), "回想 " + (i + 1)); }).join("") + "</div></div>" +
      '<div class="panel"><h2>⑥ 應用</h2><p class="small">把學到的放進一句生活會話。</p><div>' + qHTML(makeApply(s.apply), "應用") + "</div></div>" +
      '<div class="panel"><h2>⑦ 回顧</h2><div id="sum"></div><button class="primary bx-finish" id="finish" disabled>完成這一節</button></div>';
    $("main").innerHTML = h;
    updateSummary();
  }
  function updateSummary() {
    if (!cur || !$("sum")) return;
    var a = Object.keys(cur.answered).map(function (k) { return cur.answered[k]; });
    var rec = a.filter(function (x) { return x.q.track === "rec"; }), rc = a.filter(function (x) { return x.q.track === "rc"; });
    var left = cur.total - a.length;
    var weak = {};
    a.forEach(function (x) {
      if (x.ok && x.rating !== "mid") return;
      var k = x.q.item || x.q.id;
      weak[k] = weak[k] || { name: x.q.item ? item(x.q.item).ja + "（" + item(x.q.item).kana + "）" : x.q.prompt, tags: {} };
      weak[k].tags[x.rating === "mid" ? "模糊" : (x.q.track === "rc" ? "想不起來" : ERR_LABEL[x.q.err] || "答錯")] = 1;
    });
    var h = cur.sid ? "<p>目標：" + esc(D.sections[cur.sid].goal) + "</p>" : "";
    h += "<p>認得（選擇、聽力）：第一次就答對 <b>" + rec.filter(function (x) { return x.ok; }).length + " / " + rec.length + "</b></p>" +
      "<p>想得起來（回想、應用）：記得 <b>" + rc.filter(function (x) { return x.rating === "good"; }).length + " / " + rc.length + "</b></p>";
    var wk = Object.keys(weak);
    if (wk.length) h += "<h3>還需要複習</h3><ul class=\"bx-weak\">" + wk.map(function (k) {
      return '<li><span lang="ja">' + esc(weak[k].name) + "</span>" + Object.keys(weak[k].tags).map(function (t) { return '<span class="bx-tag">' + esc(t) + "</span>"; }).join("") + "</li>";
    }).join("") + "</ul>";
    h += left > 0 ? '<p class="small">還有 ' + left + " 題沒做。</p>"
      : '<p class="small">' + (cur.sid ? "這節的項目會排進「今日複習」：明天先複習一次，記得的話間隔會慢慢拉長（1、3、7、16…天），不記得的隔天再出。" : "不記得的明天會再出現。") + "</p>";
    $("sum").innerHTML = h;
    if ($("finish")) $("finish").disabled = left > 0;
  }
  function finishSection() {
    var a = Object.keys(cur.answered).map(function (k) { return cur.answered[k]; }).filter(function (x) { return x.q.track === "rec"; });
    S.markBasicsSection(cur.sid, a.filter(function (x) { return x.ok; }).length, a.length);
    S.seedBasics(D.sections[cur.sid].items);
    go("home");
  }

  /* ---------- 今日複習（只出已上過的項目） ---------- */
  function learnedItems() {
    var ids = [];
    Object.keys(D.sections).forEach(function (sid) {
      D.sections[sid].items.forEach(function (id) { if (ids.indexOf(id) < 0 && (S.getBasicsSection(sid) || S.getBasics(id))) ids.push(id); });
    });
    return ids;
  }
  function dueList() { return S.dueBasics(learnedItems()); }
  function renderReview() {
    var due = dueList();
    if (!due.length) {
      cur = null;
      $("main").innerHTML = '<div class="panel"><h2>今天沒有要複習的</h2><p class="small">上完小節後，項目會排進這裡。記得的間隔會越拉越長，不記得的隔天再出。</p></div>';
      return;
    }
    var list = shuffle(due).slice(0, 20);
    cur = { qs: {}, answered: {}, rated: {}, total: list.length };
    $("main").innerHTML = '<div class="panel"><h2>今日複習</h2><p class="small">今天到期 ' + due.length + " 項" + (due.length > 20 ? "，這次先做 20 項" : "") + "。</p><div>" +
      list.map(function (d, i) { return qHTML(reviewQuestion(d.id, d.track), "複習 " + (i + 1)); }).join("") + "</div></div>" +
      '<div class="panel"><h2>這次的結果</h2><div id="sum"></div></div>';
    updateSummary();
  }

  /* ---------- 導覽 ---------- */
  function updateDue() { var n = D ? dueList().length : 0; $("dueN").textContent = n ? "（" + n + "）" : ""; }
  function go(v, sid) {
    stopAudio();
    view = v;
    document.querySelectorAll("#nav [data-view]").forEach(function (b) { b.classList.toggle("active", b.dataset.view === (v === "section" ? "home" : v)); });
    if (v === "section") renderSection(sid);
    else { cur = null; if (v === "home") renderHome(); else if (v === "lookup") renderLookup(); else renderReview(); }
    updateDue(); window.scrollTo(0, 0);
  }
  function leaving() {
    return !(view === "section" && cur && Object.keys(cur.answered).length && !confirm("離開這一節？做到一半的不會記成「上過」（已作答的題目仍會排進複習）。"));
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("button"); if (!t || t.disabled) return;
    if (t.dataset.view) { if (leaving()) go(t.dataset.view); return; }
    if (t.dataset.play) { play(t.dataset.play); return; }
    if (t.dataset.sec) { go("section", t.dataset.sec); return; }
    if (t.dataset.opt != null) { answerChoice(t.dataset.uid, +t.dataset.opt); return; }
    if (t.dataset.rate) { selfRate(t.dataset.uid, t.dataset.rate); return; }
    if (t.dataset.reveal) { reveal(t.dataset.reveal); return; }
    if (t.dataset.listen) {
      var uid = t.dataset.listen, q = cur.qs[uid];
      play(q.item, function () {
        var box = $("bq-" + uid); if (box.dataset.done) return;
        box.dataset.done = 1;
        box.querySelectorAll("[data-opt]").forEach(function (b) { b.disabled = true; });
        var fb = $("fb-" + uid); fb.textContent = "這題的聲音播不出來，先略過（不算錯）。"; fb.classList.add("show");
        if (!q.retry) { cur.total--; updateSummary(); }
      });
      return;
    }
    if (t.id === "finish") { finishSection(); return; }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.dataset && e.target.dataset.uid && e.target.tagName === "INPUT") { e.preventDefault(); reveal(e.target.dataset.uid); }
  });

  applySettings();
  Promise.all([
    fetch("../data/basics.json").then(function (r) { if (!r.ok) throw new Error("basics HTTP " + r.status); return r.json(); }),
    fetch("../audio/manifest.json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
  ]).then(function (res) {
    D = res[0]; AUDIO = res[1] || {};
    go("home");
  }).catch(function (err) {
    $("main").innerHTML = '<div class="loaderr">題庫載入失敗：' + esc(err.message) + "</div>";
  });
})();
