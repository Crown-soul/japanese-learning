# 架構

自製日文學習網站，純靜態 HTML/CSS/JS，GitHub Pages 托管，無後端、無建置工具（只有幾支 Python 腳本）。

線上：<https://crown-soul.github.io/japanese-learning/>　Repo：`github.com/Crown-soul/japanese-learning`

## 檔案地圖

```
japanese-learning/
├── index.html                 生成物：首頁目錄（開始學／每日複習／工具／舊版 四區）。勿手改
├── review.html                跨課複習中心：今天到期的單字與文法點，混合所有課
├── lessons/
│   ├── <id>.html              引擎課：~16 行薄殼（見下）
│   ├── grammar-index.html     N4 文法查詢頁（讀 data/grammar.json）
│   ├── 日文70單字學習器.html    舊課：1000+ 行、CSS/JS/資料全內嵌（不遷移；進度只單向搬一次）
│   ├── 日文單字總表.html        跨課單字總表（讀整份 vocab.json）
│   └── 日語動詞變化練習工具.html  React/Babel 單頁，獨立（可從 vocab.json 匯入動詞；<title>「動詞變化練習」）
├── data/
│   ├── vocab.json             共用單字庫（陣列，每筆標 lessons:[...]；選填 jlpt、exKana）
│   ├── grammar.json           生成物：docs/n4-grammar.md 轉成的 JSON（build-grammar.py）
│   └── lessons/<id>.json      引擎課的內容：stories（可含一篇 kind:"dialogue" 會話）/ grammar(+chunks) / grammarQuiz(+id) / reading(+id) / passageQuiz(+id)
├── assets/
│   ├── store.js               全站進度／設定存取層（window.JLStore）——唯一碰 localStorage 的地方
│   ├── lesson.css             引擎課共用樣式（review.html、grammar-index.html 也用）
│   ├── lesson-engine.js       引擎課共用行為（讀 JSON → 建 DOM → 綁事件；每篇 ①→⑤ 流程、複習字、打字／聽寫、會話、文章文法）
│   ├── mock-exam.js           單課小考（10 題，執行時從本課資料組題）；引擎按下「本課小考」才載入
│   └── vocab-table.js         共用「單字表」元件（window.vocabTableHTML）
├── audio/
│   ├── <sha1>.mp3             預錄語音，檔名 = 合成文字的雜湊
│   ├── manifest.json          乾淨文字 → 檔名（會話行的 key 是 "@<聲音>:<乾淨文字>"）
│   └── last-run.json          generate-audio.py 本次新產的段落清單（audio-check 只列這批）
├── audio-check.html           生成物：發音人工快篩頁（預設只列本次新增）
├── generate-audio.py          Google TTS 產語音 + prune 舊檔（需 tts-key.txt）
├── build-audio-check.py       產 audio-check.html
├── build-grammar.py           產 data/grammar.json
├── build-index.py             產 index.html
├── validate-lessons.py        驗 data/lessons/*.json 與 vocab.json 一致性
├── .github/workflows/validate.yml  push/PR 時跑驗證（含 check-console.mjs headless 檢查）
├── .claude/                   settings.json（hook 註冊）、hooks/、skills/new-lesson/、launch.json（本機預覽）
├── try-voices.py              試聽多個語音（開發用）
├── publish.sh                 build-index → git add -A → commit → push
├── CLAUDE.md / docs/          AI 協作設定與知識
└── tts-key.txt                Google API 金鑰（.gitignore，絕不 commit）
```

## 引擎課的三個檔

一個「引擎課」= 薄殼 HTML + 內容 JSON + 共用引擎：

1. `lessons/<id>.html`（薄殼，`<title>` 是目錄顯示名）
   ```html
   <link rel="stylesheet" href="../assets/lesson.css">
   <div class="app" id="app" data-lesson="<id>"></div>
   <script src="../assets/store.js"></script>
   <script src="../assets/vocab-table.js"></script>
   <script src="../assets/lesson-engine.js"></script>
   ```
2. `data/lessons/<id>.json`（見 `docs/lesson-authoring.md` 的 schema）
3. `data/vocab.json` 裡 `lessons` 含 `<id>` 的字

引擎 `boot()`：讀 `#app[data-lesson]` → `fetch ../data/lessons/<id>.json` + `../data/vocab.json`（故事標記裡 key 不屬於本課的字＝複習字，另外抓那幾課的 title）→ `JLStore.migrateLegacy([id])` → 建 header/hud/四個 section/底部分頁列 → 綁事件 → `fetch ../audio/manifest.json`、`../data/grammar.json`（文法卡的「怎麼接／容易搞混／常見錯誤」）。
小考 `assets/mock-exam.js` 不寫進薄殼，按下「本課小考」時才由引擎動態載入，所以薄殼範本不用改。

## 進度與設定（assets/store.js）

全站只有 `store.js` 會碰 localStorage，兩包資料：

| key | 內容 |
|---|---|
| `jl.settings.v1` | `{v, theme, fs, reading, lastTab, audioRate, tipOpen}`，跟課程無關 |
| `jl.progress.v1` | `vocab{辭書形: {box,due,seen,note?}}`、`grammar{文法點標題: {...}}`、`quiz{"<課程id>/<題目id>": {r,at}}`（文章文法是 `<課程id>/pq-NN#格`）、`events[[日期,類型,key,結果]]`（最近 10,000 筆）、`daily{日期:{n,ok}}`、`migrated[]`、`stories{"<課程id>/<篇號>": {read?,shadow?}}`（流程 ①② 打勾）、`exams{<課程id>: {best,last,total,times,at}}`（單課小考）、`paraNotes{"<課程id>/s<篇>p<段>": {text,at}}`（段落回報） |

SRS：箱 0–6，間隔 `[0,1,3,7,16,30,60]` 天，box 6 畢業（答錯退回 3）。單字 key 是辭書形、文法 key 是 `docs/n4-grammar.md` 的標題，所以跨課共用。
舊格式（`jp70-srs`、`<id>:srs/gquiz/rquiz`、三套設定 key）第一次啟動時由 `migrateLegacy()` 單向搬進來，只複製不刪。
匯出／匯入在課程頁的設定裡（`exportAll()`／`importAll()`）。將來上資料庫：只改 `store.js` 內部。

## 資料流

| 動作 | 讀 | 寫 |
|---|---|---|
| 開課程頁 | `data/lessons/<id>.json`、`data/vocab.json`、`audio/manifest.json` | localStorage（只透過 store.js：`jl.settings.v1`／`jl.progress.v1`） |
| 開 `review.html`／`index.html` | `data/vocab.json`、所有 `data/lessons/*.json`（標題、克漏字） | 同上 |
| 開 `lessons/grammar-index.html` | `data/grammar.json` | 同上（只讀設定與複習狀態） |
| `build-grammar.py` | `docs/n4-grammar.md`、`data/lessons/*.json`（教過的課） | `data/grammar.json` |
| `generate-audio.py` | `data/vocab.json`、`lessons/*.html`（舊課故事）、`data/lessons/*.json`（引擎課故事；會話依 `voices` 換聲音）、`tts-key.txt` | `audio/*.mp3`、`audio/manifest.json`、`audio/last-run.json` |
| `build-index.py` | `lessons/*.html` 的 `<title>` + commit 日、`data/lessons/*.json`（字數／文法點數／篇數）、`data/vocab.json` | `index.html` |
| `build-audio-check.py` | `data/vocab.json`、`lessons/*.html`、`data/lessons/*.json`、`audio/manifest.json`、`audio/last-run.json` | `audio-check.html` |
| `publish.sh` | 全部（先跑 build-index、build-grammar） | commit + push（Pages 1–2 分鐘後更新） |

## 生成物 vs 手寫

- **生成物（勿手改）**：`index.html`、`audio-check.html`、`audio/*`、`data/grammar.json`、引擎課薄殼（由 skill 產）
- **手寫／AI 寫**：`data/lessons/*.json`、`data/vocab.json`、`assets/*`、`docs/*`、`CLAUDE.md`
- **不遷移**：`lessons/日文70單字學習器.html`（舊課，自成一格）

## 音檔設計重點

- 檔名 = `sha1(voice|rate|實際合成文字)` 前 16 碼。**同一段文字沒改 → 檔名不變 → 不重產**，這也讓 git 歷史不膨脹。
- `manifest[key]` 的 `key` 是 `play()` 會查的字串；實際送 TTS 的可能不同（引擎課單字卡：key = 漢字 `dict`，合成用 `reading` 假名）。
- 會話（`stories[].kind == "dialogue"`）每個說話人用自己的聲音，key 是 `@<聲音>:<乾淨文字>`，同一句話由不同人說就是不同音檔。這條規則 `generate-audio.py`、`build-audio-check.py`、`validate-lessons.py`（`audio_key`）、`lesson-engine.js`（`renderStories`）要一致。
- 跑完會刪掉 manifest 沒引用到的 mp3（prune）。
- 詳見 `docs/tts-notes.md`。
