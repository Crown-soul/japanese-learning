/* ============================================================
   全站進度／設定存取層（唯一會碰 localStorage 的地方）
   所有頁面（引擎課、單字總表、複習中心、動詞工具）都只呼叫 window.JLStore，
   不自己讀寫 localStorage。將來要上資料庫：只改這個檔案的內部。

   兩包資料：
     jl.settings.v1  全站設定（主題、字級、注音模式、語速…），跟課程無關
     jl.progress.v1  學習進度，key 一律不綁課程：
       vocab   { "<vocab key>":  {box, due, seen, note?} }   單字用辭書形
       grammar { "<文法點名稱>": {box, due, seen, note?} }   名稱＝ docs/n4-grammar.md 的標題
       quiz    { "<課程id>/<題目id>": {r:"ok"|"ng", at} }    題目要有穩定 id
       events  [[日期, 類型 v|g|q, key, 結果], ...]            最近 EVENT_CAP 筆
       daily   { "YYYY-MM-DD": {n, ok} }                       折舊後的每日彙總
       migrated [ "<舊 key>", ... ]                            已搬過的舊資料

   SRS：Leitner 箱 0–6，間隔 [0,1,3,7,16,30,60] 天；box 6 = 畢業。
   評分：good → +1；mid → 維持（最少 1）；bad → 退回 0（box ≥4 退到 3）。
   ============================================================ */
(function () {
  "use strict";
  var SETTINGS_KEY = "jl.settings.v1";
  var PROGRESS_KEY = "jl.progress.v1";
  var INTERVALS = [0, 1, 3, 7, 16, 30, 60];
  var MAX_BOX = INTERVALS.length - 1;
  var GRADUATE_BOX = MAX_BOX;
  var MASTER_BOX = 4;            // 統計裡算「熟練」的門檻
  var EVENT_CAP = 20000;
  var EVENT_FOLD = 5000;         // 超過上限時，把最舊的這麼多筆折成每日彙總

  var DEFAULT_SETTINGS = { v: 1, theme: "auto", fs: 18, reading: "all", lastTab: "stories", audioRate: 1, tipOpen: true };

  function raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function parse(s, d) { if (s == null) return d; try { var v = JSON.parse(s); return v && typeof v === "object" ? v : d; } catch (e) { return d; } }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function today() { return ymd(new Date()); }
  function addDays(n, from) { var d = from ? new Date(from + "T00:00:00") : new Date(); d.setDate(d.getDate() + n); return ymd(d); }
  function nowIso() { return new Date().toISOString(); }

  /* ---------- settings ---------- */
  var settingsCache = null;
  function getSettings() {
    if (!settingsCache) {
      var s = parse(raw(SETTINGS_KEY), {});
      settingsCache = Object.assign({}, DEFAULT_SETTINGS, s, { v: 1 });
    }
    return Object.assign({}, settingsCache);
  }
  function saveSettings(patch) {
    settingsCache = Object.assign(getSettings(), patch || {}, { v: 1 });
    put(SETTINGS_KEY, JSON.stringify(settingsCache));
    return Object.assign({}, settingsCache);
  }

  /* ---------- progress ---------- */
  var progressCache = null;
  function emptyProgress() {
    return { v: 1, updatedAt: nowIso(), vocab: {}, grammar: {}, quiz: {}, events: [], daily: {}, migrated: [] };
  }
  function normalize(p) {
    var e = emptyProgress();
    if (!p || typeof p !== "object") return e;
    ["vocab", "grammar", "quiz", "daily"].forEach(function (k) { if (!p[k] || typeof p[k] !== "object" || Array.isArray(p[k])) p[k] = {}; });
    if (!Array.isArray(p.events)) p.events = [];
    if (!Array.isArray(p.migrated)) p.migrated = [];
    p.v = 1;
    return p;
  }
  function progress() {
    if (!progressCache) progressCache = normalize(parse(raw(PROGRESS_KEY), null));
    return progressCache;
  }
  function save() {
    var p = progress();
    p.updatedAt = nowIso();
    if (p.events.length > EVENT_CAP) {
      var old = p.events.splice(0, EVENT_FOLD);
      old.forEach(function (ev) {
        var d = p.daily[ev[0]] || { n: 0, ok: 0 };
        d.n++; if (ev[3] === "good" || ev[3] === "ok") d.ok++;
        p.daily[ev[0]] = d;
      });
    }
    return put(PROGRESS_KEY, JSON.stringify(p));
  }
  function logEvent(type, key, result) {
    progress().events.push([today(), type, key, result]);
  }

  /* ---------- SRS ---------- */
  function applyRating(rec, rating) {
    var box = (rec ? rec.box : 0) | 0;
    if (rating === "good") box = Math.min(MAX_BOX, box + 1);
    else if (rating === "mid") box = Math.max(1, box);
    else box = box >= MASTER_BOX ? 3 : 0;
    var due = box >= GRADUATE_BOX ? null : addDays(rating === "bad" ? 0 : INTERVALS[box]);
    return { box: box, due: due, seen: today(), note: (rec && rec.note) || undefined };
  }
  function clean(rec) { if (rec && rec.note === undefined) delete rec.note; return rec; }
  function rate(bucket, type, key, rating) {
    if (!key) return null;
    var p = progress();
    var rec = clean(applyRating(p[bucket][key], rating));
    p[bucket][key] = rec;
    logEvent(type, key, rating);
    save();
    return Object.assign({}, rec);
  }
  function rateVocab(key, rating) { return rate("vocab", "v", key, rating); }
  function rateGrammar(point, rating) { return rate("grammar", "g", point, rating); }
  function getVocab(key) { var r = progress().vocab[key]; return r ? Object.assign({}, r) : null; }
  function getGrammar(point) { var r = progress().grammar[point]; return r ? Object.assign({}, r) : null; }
  function isDue(rec, date) { return !!(rec && rec.due && rec.due <= (date || today())); }
  function isGraduated(rec) { return !!(rec && rec.box >= GRADUATE_BOX); }
  function dueOf(bucket, keys, date) {
    var b = progress()[bucket];
    keys = keys || Object.keys(b);
    return keys.filter(function (k) { return isDue(b[k], date); });
  }
  function dueVocab(keys, date) { return dueOf("vocab", keys, date); }
  function dueGrammar(points, date) { return dueOf("grammar", points, date); }
  function stats(bucket, keys) {
    var b = progress()[bucket || "vocab"], t = today();
    keys = keys || Object.keys(b);
    var s = { total: keys.length, master: 0, learning: 0, fresh: 0, due: 0, graduated: 0 };
    keys.forEach(function (k) {
      var r = b[k];
      if (!r || !r.seen) { s.fresh++; return; }   // 只寫了筆記、還沒練過的也算未學
      if (r.box >= GRADUATE_BOX) { s.graduated++; s.master++; return; }
      if (r.box >= MASTER_BOX) s.master++; else s.learning++;
      if (r.due && r.due <= t) s.due++;
    });
    return s;
  }
  function boxLabel(rec) {
    if (!rec) return "尚未練習";
    if (rec.box >= GRADUATE_BOX) return "已畢業（答錯會退回）";
    var next = rec.due ? " · 下次 " + rec.due.slice(5).replace("-", "/") : "";
    if (rec.box >= MASTER_BOX) return "熟練" + next;
    if (rec.box >= 1) return "學習中（box " + rec.box + "）" + next;
    return "要加強 · 今日到期";
  }

  /* ---------- 題目 ---------- */
  function markQuiz(qid, ok) {
    if (!qid) return;
    var p = progress();
    p.quiz[qid] = { r: ok ? "ok" : "ng", at: today() };
    logEvent("q", qid, ok ? "ok" : "ng");
    save();
  }
  function getQuiz(qid) { var r = progress().quiz[qid]; return r ? Object.assign({}, r) : null; }
  function wrongQuiz(prefix) {
    var q = progress().quiz;
    return Object.keys(q).filter(function (k) { return q[k].r === "ng" && (!prefix || k.indexOf(prefix) === 0); });
  }

  /* ---------- 備註 ---------- */
  function setNote(type, key, text) {
    var bucket = type === "grammar" ? "grammar" : "vocab";
    var p = progress(), rec = p[bucket][key] || { box: 0, due: null, seen: null };
    text = String(text || "").trim();
    if (text) rec.note = text; else delete rec.note;
    if (!rec.seen && !rec.note) delete p[bucket][key]; else p[bucket][key] = rec;
    save();
  }
  function getNote(type, key) {
    var bucket = type === "grammar" ? "grammar" : "vocab";
    var r = progress()[bucket][key];
    return (r && r.note) || "";
  }

  /* ---------- 清除 ---------- */
  function resetProgress(opts) {
    // opts.vocabKeys / opts.grammarPoints / opts.quizPrefix：只清某一課；都不給 = 全清
    var p = progress();
    if (!opts) { progressCache = emptyProgress(); progressCache.migrated = p.migrated; return save(); }
    (opts.vocabKeys || []).forEach(function (k) { delete p.vocab[k]; });
    (opts.grammarPoints || []).forEach(function (k) { delete p.grammar[k]; });
    if (opts.quizPrefix) Object.keys(p.quiz).forEach(function (k) { if (k.indexOf(opts.quizPrefix) === 0) delete p.quiz[k]; });
    return save();
  }

  /* ---------- 匯出／匯入 ---------- */
  function exportAll() {
    return JSON.stringify({ exportedAt: nowIso(), settings: getSettings(), progress: progress() }, null, 1);
  }
  function importAll(json, opts) {
    var d = typeof json === "string" ? parse(json, null) : json;
    if (!d || !d.progress || typeof d.progress !== "object") throw new Error("不是本站匯出的進度檔");
    var incoming = normalize(d.progress);
    var replace = opts && opts.replace;
    if (replace) { progressCache = incoming; }
    else {
      var p = progress();
      mergeBucket(p.vocab, incoming.vocab); mergeBucket(p.grammar, incoming.grammar);
      Object.keys(incoming.quiz).forEach(function (k) {
        if (!p.quiz[k] || (incoming.quiz[k].at || "") >= (p.quiz[k].at || "")) p.quiz[k] = incoming.quiz[k];
      });
      p.events = p.events.concat(incoming.events).sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
      Object.keys(incoming.daily).forEach(function (day) {
        var a = p.daily[day] || { n: 0, ok: 0 }, b = incoming.daily[day];
        p.daily[day] = { n: a.n + b.n, ok: a.ok + b.ok };
      });
    }
    if (d.settings && typeof d.settings === "object") saveSettings(d.settings);
    save();
    return summary();
  }
  function mergeBucket(mine, theirs) {
    Object.keys(theirs).forEach(function (k) {
      var a = mine[k], b = theirs[k];
      if (!a) { mine[k] = b; return; }
      // 誰比較新就用誰；同天取箱數高的
      if ((b.seen || "") > (a.seen || "") || ((b.seen || "") === (a.seen || "") && (b.box | 0) > (a.box | 0))) {
        var note = a.note || b.note; mine[k] = b; if (note) mine[k].note = note;
      } else if (b.note && !a.note) a.note = b.note;
    });
  }
  function summary() {
    var p = progress();
    return { vocab: Object.keys(p.vocab).length, grammar: Object.keys(p.grammar).length,
             quiz: Object.keys(p.quiz).length, events: p.events.length, updatedAt: p.updatedAt };
  }

  /* ---------- 舊資料單向搬家（只複製、不刪） ----------
     舊格式：
       jp70-srs                 舊課 70 單字學習器的單字 SRS（box 0–4）
       <id>:srs / :gquiz / :rquiz  引擎課；gquiz/rquiz 以陣列索引為 key，
                                 搬成 "<id>/gq-NN" / "<id>/rq-NN"（NN 從 01 起）
       <id>:theme / :fs / :reading / :fg / :tab、vocabtable-theme / -fs、jp70-fg  設定
     引擎課的 id 由呼叫端傳入（引擎傳自己的 id；複習中心傳所有課的 id）。 */
  function migrateLegacy(lessonIds) {
    var p = progress(), done = p.migrated, changed = false;
    function take(k) { var v = raw(k); if (v == null || done.indexOf(k) >= 0) return null; done.push(k); changed = true; return v; }
    function mergeSrs(json) {
      var d = parse(json, {});
      Object.keys(d).forEach(function (k) {
        var r = d[k]; if (!r || typeof r !== "object") return;
        var rec = { box: Math.min(MAX_BOX, r.box | 0), due: r.due || today(), seen: r.seen || r.due || today() };
        var cur = p.vocab[k];
        if (!cur || (rec.seen || "") > (cur.seen || "") || rec.box > (cur.box | 0)) { if (cur && cur.note) rec.note = cur.note; p.vocab[k] = rec; }
      });
    }
    var s = take("jp70-srs"); if (s) mergeSrs(s);
    (lessonIds || []).forEach(function (id) {
      var v = take(id + ":srs"); if (v) mergeSrs(v);
      ["gq", "rq"].forEach(function (kind) {
        var q = take(id + ":" + (kind === "gq" ? "gquiz" : "rquiz")); if (!q) return;
        var d = parse(q, {});
        Object.keys(d).forEach(function (idx) {
          if (!/^\d+$/.test(idx)) return;
          var qid = id + "/" + kind + "-" + String(+idx + 1).padStart(2, "0");
          if (!p.quiz[qid]) p.quiz[qid] = { r: d[idx] === "ng" ? "ng" : "ok", at: today() };
        });
      });
    });
    // 設定：拿第一個找得到的
    var sPatch = {};
    var srcs = (lessonIds || []).map(function (id) { return id + ":"; }).concat(["vocabtable-", "jp70-"]);
    srcs.forEach(function (pre) {
      var t = take(pre + "theme"); if (t && !sPatch.theme && /^(auto|light|dark)$/.test(t)) sPatch.theme = t;
      var f = take(pre + "fs"); if (f && !sPatch.fs && /^\d+$/.test(f)) sPatch.fs = +f;
      var r = take(pre + "reading"); if (r && !sPatch.reading && /^(all|target|none|mask)$/.test(r)) sPatch.reading = r;
      var g = take(pre + "fg"); if (g && !sPatch.reading && /^(all|target|none)$/.test(g)) sPatch.reading = g;
      take(pre + "tab"); take(pre + "tipOpen");
    });
    if (Object.keys(sPatch).length) saveSettings(sPatch);
    if (changed) save();
    return changed;
  }

  window.JLStore = {
    today: today, addDays: addDays,
    INTERVALS: INTERVALS.slice(), MAX_BOX: MAX_BOX, MASTER_BOX: MASTER_BOX, GRADUATE_BOX: GRADUATE_BOX,
    getSettings: getSettings, saveSettings: saveSettings,
    rateVocab: rateVocab, rateGrammar: rateGrammar, getVocab: getVocab, getGrammar: getGrammar,
    dueVocab: dueVocab, dueGrammar: dueGrammar, isDue: isDue, isGraduated: isGraduated, stats: stats, boxLabel: boxLabel,
    markQuiz: markQuiz, getQuiz: getQuiz, wrongQuiz: wrongQuiz,
    setNote: setNote, getNote: getNote,
    resetProgress: resetProgress, exportAll: exportAll, importAll: importAll, summary: summary,
    migrateLegacy: migrateLegacy,
    _events: function () { return progress().events.slice(); },
    _daily: function () { return Object.assign({}, progress().daily); }
  };
})();
