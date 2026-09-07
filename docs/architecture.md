# 架構

自製日文學習網站，純靜態 HTML/CSS/JS，GitHub Pages 托管，無後端、無建置工具（只有幾支 Python 腳本）。

線上：<https://crown-soul.github.io/japanese-learning/>　Repo：`github.com/Crown-soul/japanese-learning`

## 檔案地圖

```
japanese-learning/
├── index.html                 生成物：首頁目錄。掃 lessons/*.html 讀 <title>。勿手改
├── lessons/
│   ├── <id>.html              引擎課：~15 行薄殼（見下）
│   ├── 日文70單字學習器.html    舊課：1000+ 行、CSS/JS/資料全內嵌（不遷移）
│   ├── 日文單字總表.html        跨課單字總表（讀整份 vocab.json）
│   └── 日語動詞變化練習工具.html  React/Babel 單頁，獨立
├── data/
│   ├── vocab.json             共用單字庫（陣列，每筆標 lessons:[...]）
│   └── lessons/<id>.json      引擎課的內容：stories / grammar / grammarQuiz / reading
├── assets/
│   ├── lesson.css             引擎課共用樣式（真實 .css）
│   ├── lesson-engine.js       引擎課共用行為（讀 JSON → 建 DOM → 綁事件）
│   └── vocab-table.js         共用「單字表」元件（window.vocabTableHTML）
├── audio/
│   ├── <sha1>.mp3             預錄語音，檔名 = 合成文字的雜湊
│   └── manifest.json          乾淨文字 → 檔名
├── audio-check.html           生成物：發音人工快篩頁
├── generate-audio.py          Google TTS 產語音 + prune 舊檔（需 tts-key.txt）
├── build-audio-check.py       產 audio-check.html
├── build-index.py             產 index.html
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
   <script src="../assets/vocab-table.js"></script>
   <script src="../assets/lesson-engine.js"></script>
   ```
2. `data/lessons/<id>.json`（見 `docs/lesson-authoring.md` 的 schema）
3. `data/vocab.json` 裡 `lessons` 含 `<id>` 的字

引擎 `boot()`：讀 `#app[data-lesson]` → `fetch ../data/lessons/<id>.json` + `../data/vocab.json` → 建 header/hud/tabs/四個 section → 綁事件 → `fetch ../audio/manifest.json`。

## 資料流

| 動作 | 讀 | 寫 |
|---|---|---|
| 開課程頁 | `data/lessons/<id>.json`、`data/vocab.json`、`audio/manifest.json` | localStorage（`<id>:` 前綴） |
| `generate-audio.py` | `data/vocab.json`、`lessons/*.html`（舊課故事）、`data/lessons/*.json`（引擎課故事）、`tts-key.txt` | `audio/*.mp3`、`audio/manifest.json` |
| `build-index.py` | `lessons/*.html` 的 `<title>` + mtime | `index.html` |
| `build-audio-check.py` | `data/vocab.json`、`lessons/*.html`、`data/lessons/*.json`、`audio/manifest.json` | `audio-check.html` |
| `publish.sh` | 全部 | commit + push（Pages 1–2 分鐘後更新） |

## 生成物 vs 手寫

- **生成物（勿手改）**：`index.html`、`audio-check.html`、`audio/*`、引擎課薄殼（由 skill 產）
- **手寫／AI 寫**：`data/lessons/*.json`、`data/vocab.json`、`assets/*`、`docs/*`、`CLAUDE.md`
- **不遷移**：`lessons/日文70單字學習器.html`（舊課，自成一格）

## 音檔設計重點

- 檔名 = `sha1(voice|rate|實際合成文字)` 前 16 碼。**同一段文字沒改 → 檔名不變 → 不重產**，這也讓 git 歷史不膨脹。
- `manifest[key]` 的 `key` 是 `play()` 會查的字串；實際送 TTS 的可能不同（引擎課單字卡：key = 漢字 `dict`，合成用 `reading` 假名）。
- 跑完會刪掉 manifest 沒引用到的 mp3（prune）。
- 詳見 `docs/tts-notes.md`。
