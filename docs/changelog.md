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

## 2026-09-09

- **第一門引擎課上線：`boarding-house`「下宿生活の一年」**（用 `/new-lesson` skill 生成）
  - 來源：桌面 `japanese_chinese_vocabulary_corrected.md` 的 70 個 N4 單字（已附假名與中文）。
  - 3 篇故事（399／400／400 字）：搬進下宿 → 台所與近所づきあい → 揺れた夜と別れの春；70 字全部在故事出現。
  - 14 個 N4 文法點、28 題克漏字、18 題讀解；`避ける` 依使用者決定收 `さける`。
  - `data/vocab.json` 70 → 140 字；新增 152 個音檔。
  - `generate-audio.py` 修正表 +13 條（大家／五分／一日おき／行った／写した／楽に／粗い／餌／墓参り…），`docs/tts-notes.md` 同步。
- **產出後全面校對**（使用者要求）：
  - 故事 7 處：`通って五分`→`五分のところに`、`お宅` 改用在「大家さんのお宅」（原本對房客說「お宅のご飯」語感怪）、`切っていたら…切って`重複、連用中止跨主語（`聞き、隣の人が`→`聞いていたので`）、`ご馳走する` 助詞 へ→に、`二年間`→`この一年`（與「一年」時間軸矛盾）、第二次以後出現的漢字補注音。
  - 克漏字 6 題：干擾項與正解同樣講得通（`てあげる`／`聞かされた`／`たあとで`），改成語意唯一。
  - 單字 9 筆：`いくら`／`迷惑する` 的長字義拆到 `form`（中→日測驗只取第一個字義）、`満足` 補サ變、例句助詞與時間軸對齊。
- **單字總表顯示課程標題**：`assets/vocab-table.js` 加 `opts.lessonTitles`；`日文單字總表.html` 讀 `data/lessons/<id>.json` 的 `title`，篩選鈕與分組標題不再顯示英文 id（只對英數 id 發 fetch，避免舊課 404 被 CI 當 console error）。

## 2026-09-13

- **翻譯與文法標記改成逐篇強制**（29597fe）：`boarding-house` 昨天只有第一篇標了文法，三層檢查都沒擋下來——`validate-lessons.py` 的 `translation` 寫成「有填才驗長度」、整篇沒填不報錯；`[[g#]]` 只驗成對與索引合法，不管有幾篇沒標。`docs/lesson-authoring.md` 又把 `translation` 標成「選填」、驗收標準完全沒列這兩項，跟 `SKILL.md` 互相矛盾。改成三條硬性檢查：每篇必須有 `translation`（長度等於 `paragraphs`、每段非空）、每篇至少一個 `[[g#]]`、每個 `grammar[]` 文法點至少被標記一次。`SKILL.md` 步驟 4 加「每一篇都要做的兩件事」與當場自檢指令。同時補齊 `boarding-house` 篇二篇三的標記，14 個文法點全部涵蓋（`[[g#]]` 會被 `plain()` 剝除，音檔 key 未變，不需重產語音）。
- **標記位置的字面比對**（60db9bd）：原本擋得住「沒標」，擋不住「標錯位置」。把 `grammar[].point` 拆成課文裡應該看得到的字樣，跟 `[[g#]]…[[/g]]` 包起來的純文字比對。字樣推導會砍動詞／な形／い形語尾以容許活用（`ておく`→`てお`、`そうだ`→`そう`、`ようになる`→`ようにな`），多變體任一命中即可，多格式（`～ば～ほど`）則每格都要出現。活用形與佔位符號類（受身形、使役形、可能形、疑問詞＋か、敬語）沒有固定字樣，不報錯改列 ⚠。93 個文法點中 83 個可自動比對、10 個列提醒。
- **撞名處理與 example 比對**（818dcf1）：字面比對擋不住「同字樣、不同條目」（`～のに` 逆接 vs 目的）。盤點後字樣會互撞的只有 7 組，其中只有 `～そうだ` 的接續真的不重疊（樣態接ます形、傳聞接普通形），其餘不是接續互相包含（`のに`、`たら`）就是文件沒有接續欄（`ように`、`ても`、`てくる`）；93 個點也只有 43 個有接續欄，通用接續推論不可行。改成「能判的就判，判不了的指名要人工看」：同一課出現同字樣的兩個點直接報錯（`そうだ` 除外）；`そうだ` 樣態／傳聞比對 `そう` 前一字是不是普通形語尾，標錯報錯；判不出來的 ⚠ 指名「篇幾「哪段文字」」。另加 `grammar[].example` 也要看得到該文法字樣、`docs/n4-grammar.md` 註明「不列為 point」的條目不再能被選用。
- **全專案巡視與修復**（171d44f）：
  - **語音檢查表漏掉所有引擎課故事**：`build-audio-check.py` 的 `clean()`／`annotated()` 沒剝 `[[g#]]`，但 `generate-audio.py`、`validate-lessons.py`、`lesson-engine.js` 三邊都有剝。段落對不到 manifest key，重跑一次項目會從 307 掉到 297，正好少掉這課的 10 段故事——SOP 要求的「跑 audio-check 人工聽一輪」對引擎課故事等於失效。根因是 `docs/lesson-authoring.md` 寫「三邊都一致處理」卻漏列這支，已改成明確的四點清單。（先前 commit 的 `audio-check.html` 內容其實是對的，因為它產生於標記加入之前；這是「下次重產才會炸」的地雷。）
  - **壞 JSON 噴 traceback**：`check_audio_coverage()` 的 `json.loads` 沒 try 包住，`check_lesson()` 明明已把解析錯誤記成友善訊息，接著又被這裡炸一次，整份錯誤清單印不出來。改成略過壞檔。
  - **刪舊音檔沒有安全閥**：跑完會刪掉所有不在 manifest 的 mp3，資料被改壞時會清空整個 `audio/`。加 `prune_blocked()`：要刪超過 5 個且比例超過 30% 就停手，確定要刪設 `AUDIO_PRUNE_FORCE=1`。
  - **`require-tts-key.sh` 誤攔**：原本對整包 hook 輸入比對，指令裡只要出現那串字（寫進字串、註解、heredoc）就被當成在執行。改成先從 `tool_input.command` 取出真正的指令，再要求出現在指令開頭或 `&& ; | (` 之後。
  - CI 補 Python 語法檢查（`py_compile *.py`，原本只有 JS 有 `node --check`）與 `audio-check.html` 過期檢查（原本只檢查 `index.html`）。補上之後，上面第一項的 bug 在修復前就會讓 CI 變紅。
- **CDN 鎖版本、CI 容錯、快取、弱字樣**（ac1c58a，訊息誤植為「測試」，內容見 36aeaae）：
  - `日語動詞變化練習工具.html` 三個 CDN 網址原本都沒鎖版本，而 `@babel/standalone` 的 latest 已是 8.0.5，等於線上實際載到 Babel 8。用 Playwright 路由攔截把三個相依換成本機檔案實測 7.29.8 與 8.0.5，兩者都正常渲染、零錯誤，因此鎖定「目前實際在跑的組合」（react 18.3.1／react-dom 18.3.1／babel 8.0.5），行為不變、不再自己漂移。
  - `check-console.mjs`：外部資源連不上時該頁降級成 ⚠ 而非讓 CI 變紅（那是網路狀況不是程式壞掉）；本機頁面的真錯誤仍照樣擋下，已雙向驗證。取捨是 CDN 連不上時該頁自己的錯誤也會一起跳過，但 CI 上網路是通的，降級只在本來就驗證不了時發生。
  - `validate-lessons.py`：`n4-grammar.md` 的解析與家族表加 `lru_cache`（原本每驗一課就重讀重算，每課約 2.8 毫秒）；字樣短到每句都會命中的文法點（`～と`／`～ば`／`～の`／`～間`／`お…` 共 5 個）改列入「無法自動比對」提醒人工看，不再靜悄悄放行。
  - `publish.sh`：沒有新變更但本機有未推的 commit 時（例如剛合併完分支）也會 push，不再直接結束導致網站沒更新。
- **發佈前驗證也攔 `git push`**（36aeaae）：`validate-on-publish` 原本只攔 `publish.sh`，直接 `git push` 會完全繞過驗證。兩種都攔，並同樣改成先取出真正的指令再比對。
- 已知未解：`～のに`／`～たら`／`～ても`／`～てくる` 四組仍只能人工判讀；純技術性修改（只改 CDN 網址）會讓該課在 `index.html` 的日期跳成當天並置頂，因為日期規則是「最後 commit 日」。

## 已擱置

- 進度匯出／匯入
- JLPT 等級標籤
- Phase 2（hook/CI 強制檢查、CLAUDE.md 深度稽核、handoff 實際套用）
