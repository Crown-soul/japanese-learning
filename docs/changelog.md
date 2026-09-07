# 變更歷程

> 這份是「當時做了什麼」的紀錄，供人回顧。AI 協作時**不需要載入**——現況看 `CLAUDE.md` + `docs/architecture.md` + `docs/lesson-authoring.md`。

## 2026-09-06

- **初始化**（334aac8）：目錄系統、`build-index.py`、`publish.sh`、GitHub Pages。
- **Phase 1**（b8b0ffc）：`日文70單字學習器.html` 大改 —— `<ruby>` 注音（`furiganize()`）、`S()` 佔位符（`@@W<n>@@` ASCII）、預錄語音（157 MP3 + manifest）、深色模式、RWD 精簡（sticky header 355→139px）、3 態注音切換。`generate-audio.py` / `try-voices.py`。

## 2026-09-08

- **專案巡視修正**：
  - `build-index.py`：日期改用各檔最後 commit 日（`git log -1 --format=%cs`），未提交的才用 mtime；「最後更新」= 各課日期最大值。之前用 mtime + 執行當天，CI 一 checkout 全部日期都變 → 「build-index 無 diff」步驟必失敗；換機器 clone 後也會全部變成 clone 當天。CI `checkout` 加 `fetch-depth: 0`。
  - `validate-lessons.py` `check_backlinks()` + `check-backlinks.sh`：引擎課薄殼的「← 回目錄」由 `lesson-engine.js` 注入、HTML 本身沒有，原本會把每個引擎課都判成缺連結 → **validate-on-publish hook 會擋掉第一課的發佈**。改成 `data-lesson=`+`lesson-engine.js` 視為已有。
  - `require-tts-key.sh` / `validate-on-publish.sh`：原本 grep 整段指令含檔名就觸發，`grep READING generate-audio.py`、`cat publish.sh` 都會被攔／多跑驗證；改成只攔「執行」（`python3 …generate-audio.py`、`./publish.sh`）。
  - `data/vocab.json`：`支度する`→`したくする`、`散歩する`→`さんぽする`（reading 要是 dict 完整假名）。
  - `.gitignore`：加 `tts-key.txt.*`、`tts-key*.txt`、`.env.*`、`*.bak`。
  - 刪 `docs/handoff-current.md`（一次性交接，已過期；範本本身就說不進 repo）與 `docs/ai-setup-audit.md`（一次性盤點，內容與 CLAUDE.md「驗證與 Hook」重複）。`CLAUDE.md` 移除引用。
- **n4-grammar.md 修訂（V2）**：依外部 review 調整。加第 0 章「使用範圍與 N5 白名單」（解決「N5 可自由用」vs「清單找不到就不用」的規格矛盾）；新增 M 敬語（お〜になる／特殊尊敬／お〜する／特殊謙讓／お・ご〜ください，みん日 L49–50）與 N 複合動詞（〜始める／続ける／終わる／出す）；補 〜間（に）、〜てほしい、〜たがる、〜させてください、〜なさい；拆 〜てくる／〜ていく 為「移動」與「變化方向」兩條；清理 〜たら（過去的發現）不再和 〜たところ 混列；修正 〜ば 接續 typo、使役受身「す 結尾不縮約」、〜なくなる／らしい／たら 的說明。約 15 條加上「對比：」欄，克漏字干擾項優先取對比欄——連帶更新 `SKILL.md` 步驟 5、`lesson-authoring.md`。章節 M（接續詞）順移為 O。
- **n4-grammar.md 修訂（V3）**：第三輪 review 差集。**新增可能形**（〜れる／〜られる／できる，D 章改名「可能・被動・使役・使役被動」，含「食べられる＝能吃／被吃」同形誤區）；**新增 〜ばよかった**（過去後悔）。補內容：第 0 章加「は／が」小節；A 章開頭改成四條件總比較 blockquote；そうだ 樣態 vs 傳聞 對照 blockquote；でしょう 擴成 推測／確認／でしょうか 三功能；授受三動詞加視角圖與「くれた＝もらった」同事不同視角；てさしあげる 加施惠視角警告；受身形補「與可能形同形」；A 章 〜たら 加「另見 G 章」。skill 規則再加一條「干擾項不得用清單外文法」（`SKILL.md`＋`lesson-authoring.md`＋本文件使用備註）。`validate-lessons.py` 解析 93 條標題、全數通過。

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
  - 引擎修正：`play(v.dict)`（不是 reading，manifest key 是漢字）、注音 regex 對齊 `generate-audio.py`、`boot()` try/catch。
  - `.claude/hooks/require-tts-key.sh`：沒金鑰時擋 `generate-audio.py`。
- **JSON 自動驗證**：
  - `validate-lessons.py`：驗合法性、`grammar.point` 在 `docs/n4-grammar.md`、`grammarQuiz.g` 索引、`reading.ref` 是內文子字串、目標單字都在故事出現、薄殼 `<title>` 一致、vocab `reading` 全假名。
  - `.claude/hooks/validate-on-publish.sh`：`publish.sh` 前跑一次，有錯擋下。
  - `.github/workflows/validate.yml`：push/PR 跑 JSON 檢查 + validate-lessons + build-index 無 diff。

## 已擱置

- 進度匯出／匯入
- JLPT 等級標籤
- Phase 2（hook/CI 強制檢查、CLAUDE.md 深度稽核、handoff 實際套用）
