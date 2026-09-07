# 變更歷程

> 這份是「當時做了什麼」的紀錄，供人回顧。AI 協作時**不需要載入**——現況看 `CLAUDE.md` + `docs/architecture.md` + `docs/lesson-authoring.md`。

## 2026-09-06

- **初始化**（334aac8）：目錄系統、`build-index.py`、`publish.sh`、GitHub Pages。
- **Phase 1**（b8b0ffc）：`日文70單字學習器.html` 大改 —— `<ruby>` 注音（`furiganize()`）、`S()` 佔位符（`@@W<n>@@` ASCII）、預錄語音（157 MP3 + manifest）、深色模式、RWD 精簡（sticky header 355→139px）、3 態注音切換。`generate-audio.py` / `try-voices.py`。

## 2026-09-07

- **Phase 2**（fde0107）：移除中文提示單字模式。文法對照表／克漏字切換；`grammarQuiz` 40 題。SRS（Leitner，`jp70-srs`，intervals `[0,1,3,7,16]`，`rateSrs` good→box+1／mid→keep≥1／bad→0）；測驗篩選 全部／今日複習／未學過。`migrateProgress()` 從舊 `jp70-progress` 搬一次。
- **Phase 3**（f4072db）：聽解模式（`quizDir="listen"`）、讀解理解題（`reading` 14 題）、播放全篇（`playStory()` 串接 `.play`）。
- **v4 檢核**（1aaffe0）：SRS 統計修正（box 0–3 都算學習中，master+learning+fresh=70）、iOS 聽力自動播改同步呼叫、文法例句校對、quiz 工具列標籤縮短。
- **單字資料庫化 + 單字總表 + 發音修正**（ea0db29）：
  - `const vocab={...}` 70 筆抽出成 `data/vocab.json`（逐欄位驗證一致）。舊課改 `fetch` 載入、`boot()` 包起啟動流程、`openCard()` 加 `if(!v) return` 護欄。
  - `generate-audio.py` / `build-audio-check.py` 改讀 `data/vocab.json`；故事仍從 HTML regex。輸出仍 157 段（無重產）。
  - `assets/vocab-table.js`：共用單字表元件，自注入 CSS、`window.vocabTableHTML(rows,{group,wordClickable})`。
  - `lessons/日文單字總表.html`：跨課單字總表。
  - 舊課新增「單字表」分頁。
  - 發音修正：`READING_FIXES`（子字串）+ `EXACT_FIXES`（整段）。`filename_for()` 雜湊「實際合成文字」→ 只重產有改的、prune 舊檔。收錄：大分→だいぶ、止める→やめる、開く→ひらく、頭、温い、汚す、指輪／指、日(exact)。
- **單字表：讀音獨立成欄、回目錄鈕、RWD**（fe7d22e）：各課程頁加 `← 回目錄`；`generate-audio.py`/`build-audio-check.py` 改 glob `lessons/*.html` 的 `const story\d+`。
- **單字表改成上下兩列**（5eaa666）：一個單字 = 一個 `<tbody>`（第一列 單字/讀音/詞性/中文，第二列例句跨欄整寬）。整個 tbody 可點、hover 一起亮。例句在單列時會被擠成一字一行，故改此版。
- **課程生成架構 + new-lesson skill（Phase 1）**：
  - `assets/lesson.css` + `assets/lesson-engine.js`：引擎課共用樣式與行為（從 `日文70單字學習器.html` 移植）。
  - `data/lessons/<id>.json`：引擎課內容（stories 用 `{{key|label|reading}}` + `漢字（かな）` 標記、grammar、grammarQuiz、reading）。
  - `lessons/<id>.html`：~15 行薄殼。
  - `generate-audio.py`：引擎課單字卡改用 `reading` 假名合成（`manifest[dict]` → 假名音檔）；故事同時吃舊課 HTML 與 `data/lessons/*.json`。
  - `docs/n4-grammar.md`：N4 文法參考清單。`docs/` 其他：architecture / lesson-authoring / tts-notes / handoff-template / changelog。`CLAUDE.md`。
  - `.claude/skills/new-lesson/SKILL.md`：拍單字照片／貼單字 → 生成整課。
  - 舊課 `日文70單字學習器.html` 不遷移。

## 已擱置

- 進度匯出／匯入
- JLPT 等級標籤
- Phase 2（hook/CI 強制檢查、CLAUDE.md 深度稽核、handoff 實際套用）
