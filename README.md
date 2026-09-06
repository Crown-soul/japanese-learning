# 日文學習檔案

我自己做的日文學習小工具，每份都是一個獨立的 HTML 檔。

## 線上閱讀

GitHub Pages：<https://YOUR_NAME.github.io/japanese-learning/>
（把 `YOUR_NAME` 換成你的 GitHub 帳號）

## 資料夾結構

```
japanese-learning/
├── index.html          ← 首頁目錄（自動產生，不要手動改）
├── lessons/            ← 每一份學習檔案放這裡
│   └── *.html
├── build-index.py      ← 掃描 lessons/ 重新產生 index.html
└── publish.sh          ← 一鍵：重建目錄 + commit + push
```

## 新增一份檔案的流程

1. 把新的 `.html` 丟進 `lessons/`
2. 執行 `./publish.sh "說明這次加了什麼"`

就這樣。`publish.sh` 會自動重建目錄並推上 GitHub。

## 檔名建議

- 用主題命名，例如 `70單字-篇一父が倒れた日.html`
- 想讓目錄照日期排，可在前面加日期：`2026-09-06-70單字.html`

目錄標題會自動抓每個檔案 `<title>` 標籤的文字。
