# 日文學習檔案

我自己做的日文學習小工具，每份都是一個獨立的 HTML 檔。

## 線上閱讀

GitHub Pages：<https://crown-soul.github.io/japanese-learning/>

## 資料夾結構

```
japanese-learning/
├── index.html          ← 首頁目錄（自動產生，不要手動改）
├── lessons/            ← 每一份學習檔案放這裡
│   └── *.html
├── audio/              ← 預先產生的語音 MP3 + manifest.json
├── build-index.py      ← 掃描 lessons/ 重新產生 index.html
├── generate-audio.py   ← 用 Google TTS 產生 lessons 裡的語音（需 tts-key.txt）
├── try-voices.py       ← 一次試聽多個語音
└── publish.sh          ← 一鍵：重建目錄 + commit + push
```

## 新增一份檔案的流程

1. 把新的 `.html` 丟進 `lessons/`
2. （若需要語音）把金鑰放進 `tts-key.txt`，跑 `python3 generate-audio.py`
3. 執行 `./publish.sh "說明這次加了什麼"`

`publish.sh` 會自動重建目錄並推上 GitHub。

## 檔名建議

- 用主題命名，例如 `70單字-篇一父が倒れた日.html`
- 想讓目錄照日期排，可在前面加日期：`2026-09-06-70單字.html`

目錄標題會自動抓每個檔案 `<title>` 標籤的文字。

## 注意

- `tts-key.txt` 是 Google API 金鑰，已被 `.gitignore` 排除，**絕不要 commit**。
- 語音產生完後，可以直接到 Google Cloud Console 把那把金鑰刪掉，網站運作不需要它。
