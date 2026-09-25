/* ============================================================
   單課小考（試用版）
   學完一課後的 10 題綜合題，打開時才從本課現有資料組題，不另存題目：
     漢字読み 2、表記 2、文脈規定 2（例句挖掉該字）、文法克漏字 2、排序 1、讀解 1
   只記最高分（JLStore.setExam），不動單字／文法的複習排程。
   照 docs/mock-exam-plan.md 的分離原則，邏輯不放進課程引擎；之後做跨課模考可以重用。

   用法：window.LessonExam.open({ sheet, modal, esc, play, vocab, DATA, S, lessonId, qid, parsePara, onDone })
   ============================================================ */
(function () {
  "use strict";
  var KANJI_RE = /[一-鿿々]/;

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function uniqPush(out, seen, t) { if (t && !seen[t]) { seen[t] = 1; out.push(t); } }

  function build(ctx) {
    var V = ctx.vocab, D = ctx.DATA, esc = ctx.esc, used = {}, qs = [];
    var keys = Object.keys(V);
    var kanji = keys.filter(function (k) { return KANJI_RE.test(V[k].dict) && V[k].reading !== V[k].dict; });

    function choices(k, field, pool) {
      var want = V[k][field], seen = {}, out = [];
      seen[want] = 1;
      shuffle(pool.filter(function (o) { return o !== k; })).forEach(function (o) { if (out.length < 3) uniqPush(out, seen, V[o][field]); });
      return shuffle(out.concat([want]));
    }
    function take(list, n) {
      var got = [];
      shuffle(list).forEach(function (k) { if (got.length < n && !used[k]) { used[k] = 1; got.push(k); } });
      return got;
    }

    take(kanji, 2).forEach(function (k) {
      qs.push({ type: "漢字読み", prompt: '「<b lang="ja">' + esc(V[k].dict) + "</b>」怎麼念？",
        options: choices(k, "reading", kanji), answer: V[k].reading,
        explain: esc(V[k].dict) + "（" + esc(V[k].reading) + "）" + esc(V[k].zh), sound: V[k].dict });
    });
    take(kanji, 2).forEach(function (k) {
      qs.push({ type: "表記", prompt: '「<b lang="ja">' + esc(V[k].reading) + "</b>」的漢字是？",
        options: choices(k, "dict", kanji), answer: V[k].dict,
        explain: esc(V[k].dict) + "（" + esc(V[k].reading) + "）" + esc(V[k].zh), sound: V[k].dict });
    });
    // 文脈規定：例句裡原樣出現辭書形的字（多半是名詞），挖掉後選回去；干擾項優先同詞性
    var ctxKeys = keys.filter(function (k) { var d = V[k].dict; return d.length >= 2 && (V[k].ex || "").indexOf(d) >= 0; });
    take(ctxKeys, 2).forEach(function (k) {
      var v = V[k], same = ctxKeys.filter(function (o) { return V[o].pos === v.pos && v.ex.indexOf(V[o].dict) < 0; });
      var pool = same.length >= 3 ? same : ctxKeys.filter(function (o) { return v.ex.indexOf(V[o].dict) < 0; });
      qs.push({ type: "文脈規定", prompt: '<span lang="ja">' + esc(v.ex.replace(v.dict, "（　）")) + "</span>",
        options: choices(k, "dict", pool.concat([k])), answer: v.dict,
        explain: '<span lang="ja">' + esc(v.ex) + "</span>　" + esc(v.dict) + "＝" + esc(v.zh), sound: v.ex });
    });
    shuffle(D.grammarQuiz || []).slice(0, 2).forEach(function (q) {
      var g = (D.grammar || [])[q.g] || {};
      qs.push({ type: "文法", prompt: '<span lang="ja">' + esc(q.s).replace("（　）", "（　）") + "</span>",
        options: shuffle(q.o), answer: q.o[q.a],
        explain: '<b lang="ja">' + esc(g.point || "") + "</b>　" + esc(g.meaning || "") });
    });
    var so = shuffle((D.grammar || []).filter(function (g) { return Array.isArray(g.chunks) && g.chunks.length >= 3; }))[0];
    if (so) qs.push({ type: "排序", order: so.chunks.slice(), prompt: "把片段排成正確的句子（文法：" + esc(so.point) + "）",
      answer: so.chunks.join(""), explain: '<span lang="ja">' + esc(so.example) + "</span>　" + esc(so.meaning) });
    var rq = shuffle(D.reading || [])[0];
    if (rq) {
      var st = (D.stories || [])[rq.st - 1] || {};
      qs.push({ type: "讀解", prompt: '<span class="small">' + esc(st.kind === "dialogue" ? "會話" : (st.title || "")) + '</span><br><span lang="ja">' + esc(rq.q) + "</span>",
        options: shuffle(rq.o), answer: rq.o[rq.a], explain: '文章：「<span lang="ja">' + esc(rq.ref) + "</span>」" });
    }
    return qs;
  }

  var cur = null;

  function render() {
    var c = cur, esc = c.ctx.esc, sheet = c.ctx.sheet;
    if (c.i >= c.qs.length) return renderEnd();
    var q = c.qs[c.i];
    var body;
    if (q.order) {
      var idx = shuffle(q.order.map(function (_, i) { return i; }));
      if (idx.every(function (v, i) { return v === i; })) idx.reverse();
      c.picked = [];
      body = '<div class="so-answer" id="exSo" lang="ja"><span class="so-slot">點下面的片段…</span></div>' +
        '<div class="so-pool" id="exPool">' + idx.map(function (ci) { return '<button data-exci="' + ci + '" lang="ja">' + esc(q.order[ci]) + "</button>"; }).join("") + "</div>" +
        '<div class="quiz-controls"><button data-exreset="1">重來</button></div>';
    } else {
      body = '<div class="gq-opts">' + q.options.map(function (o, k) { return '<button data-exo="' + k + '" lang="ja">' + esc(o) + "</button>"; }).join("") + "</div>";
    }
    sheet.innerHTML = '<button class="sheet-close" data-act="close">關閉</button>' +
      '<div class="exam"><div class="ex-head"><span>本課小考</span><span>' + (c.i + 1) + " / " + c.qs.length + "　" + esc(q.type) + "</span></div>" +
      '<div class="ex-q">' + q.prompt + "</div>" + body +
      '<div class="gq-explain" id="exExplain"></div>' +
      '<div class="quiz-controls" id="exNextWrap" hidden><button class="primary" data-exnext="1">' + (c.i + 1 < c.qs.length ? "下一題" : "看成績") + "</button></div></div>";
    c.answered = false;
  }
  function finish(ok) {
    var c = cur, q = c.qs[c.i];
    c.answered = true;
    if (ok) c.score++; else c.wrong.push(q);
    var ex = c.ctx.sheet.querySelector("#exExplain");
    ex.innerHTML = (ok ? "正確。" : "正解：" + c.ctx.esc(q.answer) + "。") + '<div class="small" style="margin-top:6px">' + q.explain + "</div>";
    ex.classList.add("show");
    c.ctx.sheet.querySelector("#exNextWrap").hidden = false;
    if (q.sound) c.ctx.play(q.sound);
  }
  function renderEnd() {
    var c = cur, esc = c.ctx.esc, total = c.qs.length;
    var rec = c.ctx.S.setExam(c.ctx.lessonId, c.score, total);
    c.ctx.sheet.innerHTML = '<button class="sheet-close" data-act="close">關閉</button>' +
      '<div class="exam"><h3>本課小考：' + c.score + " / " + total + "</h3>" +
      '<div class="small">最高分 ' + rec.best + " / " + total + "　·　第 " + rec.times + " 次</div>" +
      (c.wrong.length ? '<div class="kv"><strong>答錯的題目</strong><ul class="ex-wrong">' + c.wrong.map(function (q) {
        return "<li><span class=\"small\">" + esc(q.type) + "</span>　" + q.prompt.replace(/<br>/g, " ") + '<br>→ 正解：<b lang="ja">' + esc(q.answer) + "</b></li>";
      }).join("") + "</ul></div>" : '<div class="kv"><div>全部答對！</div></div>') +
      '<div class="actions"><button class="primary" data-exagain="1">再考一次</button><button data-act="close">關閉</button></div></div>';
    if (c.ctx.onDone) c.ctx.onDone();
  }

  function onClick(e) {
    if (!cur || !cur.ctx.sheet.querySelector(".exam")) return;
    var c = cur, q = c.qs[c.i], t = e.target;
    var o = t.closest("[data-exo]");
    if (o && !c.answered) {
      var ok = q.options[+o.dataset.exo] === q.answer;
      c.ctx.sheet.querySelectorAll("[data-exo]").forEach(function (b) {
        b.disabled = true;
        if (q.options[+b.dataset.exo] === q.answer) b.classList.add("correct"); else if (b === o) b.classList.add("wrong");
      });
      finish(ok); return;
    }
    var ci = t.closest("[data-exci]");
    if (ci && !c.answered) {
      ci.disabled = true; c.picked.push(+ci.dataset.exci);
      c.ctx.sheet.querySelector("#exSo").innerHTML = c.picked.map(function (k) { return '<span class="so-chip">' + c.ctx.esc(q.order[k]) + "</span>"; }).join("");
      if (c.picked.length === q.order.length) {
        var good = c.picked.every(function (v, i) { return v === i; });
        c.ctx.sheet.querySelector("#exSo").classList.add(good ? "so-ok" : "so-ng");
        finish(good);
      }
      return;
    }
    if (t.closest("[data-exreset]") && !c.answered) { render(); return; }
    if (t.closest("[data-exnext]")) { c.i++; render(); return; }
    if (t.closest("[data-exagain]")) { open(c.ctx); return; }
  }

  function open(ctx) {
    cur = { ctx: ctx, qs: build(ctx), i: 0, score: 0, wrong: [], answered: false };
    if (!ctx.sheet.dataset.examWired) { ctx.sheet.addEventListener("click", onClick); ctx.sheet.dataset.examWired = "1"; }
    render();
    ctx.modal.classList.add("show");
  }

  window.LessonExam = { open: open, _build: build };
})();
