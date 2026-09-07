# 日文學習檔案

我自己做的日文學習小工具，每份都是一個獨立的網頁。

線上：<https://crown-soul.github.io/japanese-learning/>

## 資料夾結構

```
japanese-learning/
├── index.html          首頁目錄（自動產生，勿手改）
├── lessons/            每一份學習檔案
│   ├── <id>.html        引擎課（薄殼，內容在 data/lessons/<id>.json）
│   └── …
├── data/
│   ├── vocab.json       共用單字庫
│   └── lessons/<id>.json 每一課的故事／文法／測驗內容
├── assets/             共用樣式與程式（lesson.css / lesson-engine.js / vocab-table.js）
├── audio/              預錄語音 MP3 + manifest.json
├── docs/               架構與規範說明
├── CLAUDE.md           AI 協作設定
├── build-index.py      重建 index.html
├── generate-audio.py   用 Google TTS 產語音（需 tts-key.txt）
├── build-audio-check.py 產發音快篩頁
└── publish.sh          一鍵：重建目錄 + commit + push
```

## 新增一份課程

拍好單字照片或整理好單字文字後，在 Claude Code 說「幫我做一課」或 `/new-lesson`，
skill（`.claude/skills/new-lesson/`）會帶著跑完整流程：確認字表 → 寫 N4 文法故事 →
出測驗 → 產語音 → 加進總單字表與目錄 → 發佈。

手動流程（一般不需要）見 `docs/architecture.md` 與 `docs/lesson-authoring.md`。

## 檔名

- **一律英數與連字號、全小寫**（`hospital.html`），不要中文——複製網址才不會又長又亂碼。
- 目錄顯示的名稱抓每個檔案的 `<title>`（可用中／日文）。

## 注意

- `tts-key.txt` 是 Google API 金鑰，已被 `.gitignore` 排除，**絕不要 commit**。
- 語音產生完後可以到 Google Cloud Console 停用那把金鑰，網站運作不需要它。
- 課程頁需要本機伺服器（`python3 -m http.server 4173`）或線上版才能開，不能雙擊 `file://`。
