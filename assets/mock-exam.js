/* ============================================================
   單課小考
   學完一課後的 10 題綜合題，打開時才從本課現有資料組題，不另存題目：
     漢字読み 2、表記 2、文脈規定 2（例句挖掉該字）、文法克漏字 2、排序 1、讀解 1
   只記最高分（JLStore.setExam），不動單字／文法的複習排程。
   照 docs/mock-exam-plan.md 的分離原則，邏輯不放進課程引擎；之後做跨課模考可以重用。

   用法：window.LessonExam.open({ sheet, modal, esc, play, vocab, DATA, S, lessonId, qid, parsePara, onDone })
         window.LessonExam.inProgress() → 作答中（引擎在點背景／Esc 關抽屜前用來確認）
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
        explain: esc(V[k].dict) + "（" + esc(V[k].reading) + "）" + esc(V[k].zh), sound: V[k].audio || V[k].dict });
    });
    take(kanji, 2).forEach(function (k) {
      qs.push({ type: "表記", prompt: '「<b lang="ja">' + esc(V[k].reading) + "</b>」的漢字是？",
        options: choices(k, "dict", kanji), answer: V[k].dict,
        explain: esc(V[k].dict) + "（" + esc(V[k].reading) + "）" + esc(V[k].zh), sound: V[k].audio || V[k].dict });
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
      '<div class="exam"><div class="ex-head"><span>' + (c.retry ? "重練答錯的" : "本課小考") + "</span><span>" + (c.i + 1) + " / " + c.qs.length + "　" + esc(q.type) + "</span></div>" +
      '<div class="ex-q">' + q.prompt + "</div>" + body +
      '<div class="gq-explain" id="exExplain"></div>' +
      '<div class="quiz-controls" id="exNextWrap" hidden><button class="primary" data-exnext="1">' + (c.i + 1 < c.qs.length ? "下一題" : "看成績") + "</button></div></div>";
    c.answered = false;
  }
  function finish(ok) {
    var c = cur, q = c.qs[c.i];
    c.answered = true;
    if (ok) c.score++; else c.wrong.push(q);
    c.results.push({ type: q.type, ok: ok });
    var ex = c.ctx.sheet.querySelector("#exExplain");
    ex.innerHTML = (ok ? "正確。" : "正解：" + c.ctx.esc(q.answer) + "。") + '<div class="small" style="margin-top:6px">' + q.explain + "</div>";
    ex.classList.add("show");
    c.ctx.sheet.querySelector("#exNextWrap").hidden = false;
    if (q.sound) c.ctx.play(q.sound);
  }
  // 成績的一句話：看比例給方向，不只給分數
  function verdict(score, total) {
    var r = total ? score / total : 0;
    if (r === 1) return "全部答對！這課可以放心往下一課走了。";
    if (r >= 0.8) return "很穩。把下面答錯的看一眼，這課就扎實了。";
    if (r >= 0.6) return "有基礎了。先重練答錯的，再回文章聽讀一次。";
    return "先別急，回文章把 ①→⑤ 再走一遍，再來挑戰會輕鬆很多。";
  }
  function breakdown(results, esc) {
    var by = {}, order = [];
    results.forEach(function (r) { if (!by[r.type]) { by[r.type] = { ok: 0, n: 0 }; order.push(r.type); } by[r.type].n++; if (r.ok) by[r.type].ok++; });
    return '<ul class="ex-break">' + order.map(function (t) {
      var b = by[t], full = b.ok === b.n;
      return '<li class="' + (full ? "full" : "") + '"><span>' + esc(t) + "</span><b>" + (full ? "✓ " : "") + b.ok + " / " + b.n + "</b></li>";
    }).join("") + "</ul>";
  }
  function renderEnd() {
    var c = cur, esc = c.ctx.esc, total = c.qs.length;
    // 重練答錯的只是練習，不記分、不動最高分
    var rec = c.retry ? null : c.ctx.S.setExam(c.ctx.lessonId, c.score, total);
    c.ctx.sheet.innerHTML = '<button class="sheet-close" data-act="close">關閉</button>' +
      '<div class="exam"><h3>' + (c.retry ? "重練：" : "本課小考：") + c.score + " / " + total + "</h3>" +
      '<p class="ex-verdict">' + esc(c.retry ? (c.wrong.length ? "還有 " + c.wrong.length + " 題要再看看，可以再練一次。" : "這次都答對了！") : verdict(c.score, total)) + "</p>" +
      (rec ? '<div class="small">最高分 ' + rec.best + " / " + total + "　·　第 " + rec.times + " 次</div>" : "") +
      (c.retry ? "" : breakdown(c.results, esc)) +
      (c.wrong.length ? '<div class="kv"><strong>答錯的題目</strong><ul class="ex-wrong">' + c.wrong.map(function (q) {
        return "<li><span class=\"small\">" + esc(q.type) + "</span>　" + q.prompt.replace(/<br>/g, " ") + '<br>→ 正解：<b lang="ja">' + esc(q.answer) + "</b></li>";
      }).join("") + "</ul></div>" : "") +
      '<div class="actions">' +
        (c.wrong.length ? '<button class="primary" data-exretry="1">練習答錯的（' + c.wrong.length + "）</button>" : "") +
        '<button class="' + (c.wrong.length ? "" : "primary") + '" data-exagain="1">' + (c.retry ? "重新考一次（10 題）" : "再考一次") + "</button>" +
        '<button data-act="close">關閉</button></div></div>';
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
    if (t.closest("[data-exretry]")) { start(c.ctx, shuffle(c.wrong), true); return; }
  }

  function start(ctx, qs, retry) {
    // 重練時選項重新洗牌，避免靠位置記答案
    qs = qs.map(function (q) { return q.options ? Object.assign({}, q, { options: shuffle(q.options) }) : q; });
    cur = { ctx: ctx, qs: qs, i: 0, score: 0, wrong: [], results: [], answered: false, retry: !!retry };
    if (!ctx.sheet.dataset.examWired) { ctx.sheet.addEventListener("click", onClick); ctx.sheet.dataset.examWired = "1"; }
    render();
    ctx.modal.classList.add("show");
  }
  function open(ctx) { start(ctx, build(ctx), false); }
  // 正在作答中（已開始、還沒看到成績）且抽屜開著
  function inProgress() {
    return !!(cur && cur.ctx.modal.classList.contains("show") && cur.ctx.sheet.querySelector(".exam .ex-head") &&
      cur.i < cur.qs.length && (cur.i > 0 || cur.answered));
  }

  window.LessonExam = { open: open, inProgress: inProgress, _build: build };
})();
