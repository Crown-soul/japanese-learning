# 優化規劃書（v1，2026-09-14）

> 這份是「接下來要改什麼、動哪些檔、怎麼驗收」的規劃，經過一輪自我審核。
> 現況與 schema 以 `CLAUDE.md`、`docs/architecture.md`、`docs/lesson-authoring.md` 為準；本文件不取代它們，各階段做完要把對應規範同步回去（見第 7 節）。
> **實作狀態（2026-09-14）**：第 1–5 階段已全部完成並各自一個 commit（分支 `claude/japanese-learning-features-review-e83m10`）。
> 第 8 節三個決定：並べ替え已回頭補舊課（`boarding-house` 14 點）、舊課 70 單字學習器只單向搬一次不同步、分頁列已換到底部。
> 未做：第 5 階段「句子級音檔」（另開規劃，需重產全部語音）；第 3 階段 `vocab.json` 拆檔（依決策 10 延後）。
> 每個階段獨立可停，做完一個階段網站就是可用狀態。

---

## 0. 判斷標準

每一項功能只問三個問題，三個都答「否」就不做：

1. **常用**：一週會用到三次以上嗎？
2. **學習**：會讓你多記住一個字、多搞懂一個文法點嗎？
3. **考試**：對 JLPT N4 的某個題型有直接幫助嗎？

前提條件（來自你的回覆）：課程數會持續增加、未來可能上資料庫（現階段不做）、手機六成／電腦四成。

---

## 1. 現況（實測，手機 390×844）

| 量測 | 數值 | 影響 |
|---|---|---|
| sticky header 高度 | 164px | 每一屏固定被吃掉 19% |
| 第一段日文的位置 | Y=738（可視區到 680） | 點進課程第一屏看不到日文 |
| 克漏字第一題的位置 | Y=646 | 選項全在螢幕外 |
| 音檔 | 307 段、8.9MB，一課約 +152 段 | 20 課後人工聽檢做不到 |
| localStorage 命名 | 三套（`jp70-*`、`<id>:*`、`vocabtable-*`） | 設定與進度都不跨頁 |
| 按「記得」之後 | 答案 `show=false`，直接換題 | 評分前不必看答案 |
| 「遮住單字」作用範圍 | 只有故事分頁（75 個），其他分頁 0 | header 常駐但四分之三時間無效 |
| 上一題（今日複習模式） | 評分後題目被 `splice` 移除 | 回上一題對不到剛才那題 |

---

## 2. 自我審核：先前建議的修正

| 原先建議 | 審核結果 | 改成 |
|---|---|---|
| 評分後答案留著、自己按下一題 | **錯**。Anki 的流程是「顯示答案 → 評分 → 自動下一題」，評分就是換題動作，多一顆鈕多 70 下點擊 | 評分鈕在按「顯示答案」之前**不出現**；評分後自動下一題 |
| 10 課就要拆 `vocab.json` | **太早**。GitHub Pages 有 gzip，1MB JSON 傳輸約 150–200KB | 延到 30 課以後或總表明顯變慢時再拆 |
| 「日→中」印讀音是白送答案 | **講太重**。它送的是另一題型的答案 | 改成「跟漢字読み題型一起做」，優先度下調 |
| 舊課 `日文70單字學習器.html` 也接上 store.js | **違反** CLAUDE.md「不遷移、要動就逐項比對」 | 只做單向搬：啟動時把 `jp70-srs` 讀進新結構，舊課本身不動；接受兩邊慢慢不一致 |
| 文法用名稱當 id 就穩定 | **有洞**。`docs/n4-grammar.md` 的標題會改（V2、V3 已改過） | 加「標題凍結」規則：被任一課引用過的標題不能改名，只能新增與標「停用」；驗證器擋 |
| 統計圖表 | **做不出來**。現在只存最終狀態，沒有事件紀錄 | schema 加事件流（決策 1） |
| 翻譯搬到上方共用 | **不採用**。理由不變：header 已滿、翻譯低頻、你一次只讀一篇 | 逐段對照，控制鈕放篇名列 |

---

## 3. 設計決策

### 決策 1：進度與設定各一包，全站共用，不綁課

```jsonc
// localStorage key: jl.settings.v1
{
  "v": 1,
  "theme": "auto",          // auto | light | dark
  "fs": 18,
  "reading": "all",         // 注音四態：all | hideTarget | hideAll | maskTarget（合併原本的注音三態＋遮字）
  "lastTab": "stories",
  "audioRate": 1,           // 0.75 | 1
  "tipCollapsed": true
}

// localStorage key: jl.progress.v1
{
  "v": 1,
  "updatedAt": "2026-09-14T08:00:00Z",

  // 單字：key = vocab.json 的 key（辭書形），跨課共用
  "vocab": {
    "近所": { "box": 2, "due": "2026-09-20", "seen": "2026-09-13", "note": "近＝近、所＝地方" }
  },

  // 文法：key = grammar[].point 的名稱（＝ docs/n4-grammar.md 的標題），跨課共用
  "grammar": {
    "～てしまう": { "box": 1, "due": "2026-09-16", "seen": "2026-09-13", "note": "" }
  },

  // 題目：key = "<課程id>/<題目id>"，只記最後一次結果
  "quiz": {
    "boarding-house/gq-03": { "r": "ng", "at": "2026-09-13" },
    "boarding-house/rq-07": { "r": "ok", "at": "2026-09-13" }
  },

  // 事件流：最近 20,000 筆原始紀錄，超過的折成每日彙總
  "events": [
    ["2026-09-14", "v", "近所", "good"],       // [日期, 類型 v|g|q, key, 結果]
    ["2026-09-14", "q", "boarding-house/gq-03", "ng"]
  ],
  "daily": {
    "2026-08-01": { "n": 120, "ok": 95 }      // 折舊後的每日題數／答對數
  }
}
```

SRS 間隔改為 `[0, 1, 3, 7, 16, 30, 60]`，box 6 = 畢業（不再進「今日複習」，可在篩選「全部」看到；答錯就退回 box 3）。

為什麼這樣定：

- **單字用辭書形**：`vocab.json` 全站唯一 key，同一個字在第 3 課背熟、第 8 課再出現就是熟的。
- **文法用名稱不用索引**：`grammarQuiz[].g` 是每課陣列的位置，跨課不通，插一條就全位移。名稱由 `validate-lessons.py` 保證在 93 條清單內。
- **題目用 id 不用位置**：修一題文字或插一題，位置型紀錄全部錯位。現在只有 1 課 46 題要補。
- **事件流現在就存**：沒有它，任何統計都做不出來、事後也補不回來。上限 20,000 筆約 600KB，落在 localStorage 5MB 內。
- **note 欄位現在預留**：第 4 階段的備註功能不用再改結構。
- **版本號 `v`**：將來要改結構才寫得出轉換程式。

### 決策 2：`assets/store.js` 是全站唯一碰 localStorage 的地方

```js
window.JLStore = {
  // 設定
  getSettings(), saveSettings(patch),
  // 單字 / 文法 SRS
  rateVocab(key, rating), rateGrammar(point, rating),
  getVocab(key), getGrammar(point),
  dueVocab(date), dueGrammar(date), stats(scope),
  // 題目
  markQuiz(qid, ok), getQuiz(qid), wrongQuiz(lessonId),
  // 備註
  setNote(type, key, text),
  // 備份 / 搬家
  exportAll(), importAll(json), migrateLegacy()
};
```

引擎課、單字總表、複習中心、動詞工具全部只呼叫它。將來上資料庫：只改這個檔案的內部，加登入，其他頁面不動。

`migrateLegacy()`：第一次啟動時偵測 `jp70-srs`、`<id>:srs`、`<id>:gquiz`、`<id>:rquiz`、三套設定 key，搬進新結構後在 `jl.progress.v1` 記 `migrated: [...]`。**只複製、不刪舊 key。**

### 決策 3：題目要有穩定 id，文法標題要凍結

- `data/lessons/<id>.json`：`grammarQuiz[]` 每題加 `"id": "gq-01"`，`reading[]` 每題加 `"id": "rq-01"`。id 在同一課內唯一，**刪題後編號不重用**。
- `docs/n4-grammar.md`：加一段「標題凍結規則」；要改名就新增一條、舊條標 `（停用）`。
- `validate-lessons.py`：加三條檢查——題目 id 存在且唯一、`vocab.json` 每字都有 `lessons` 欄位、`grammar[].point` 不可指向標「停用」的條目。

### 決策 4：測驗流程照 Anki

看題 → 按「顯示答案」（或空白鍵）→ 答案與評分鈕同時出現 → 評分（或 1/2/3）→ 自動下一題。評分鈕在顯示答案前不出現。「上一題」拿掉。「洗牌」收進設定。

### 決策 5：手機版面

- **分頁列移到底部固定**（拇指區），留 `env(safe-area-inset-bottom)`。
- **評分鈕固定在底部分頁列上方**（只在單字測驗分頁）。
- header 只留：回目錄、標題、設定、注音四態（一列）。「遮住單字」併入注音四態，只在故事分頁出現。
- 進度條與四格統計只在「單字表」「單字測驗」出現。
- 二級切換（閱讀／讀解、對照表／克漏字）改成分頁列下方一條細的 segmented control，不用卡片。
- 「建議順序」提示框可收合，狀態記在 settings。
- 「重設學習紀錄」移到設定 modal。

### 決策 6：逐段對照

- 資料不動（`translation` 已是逐段陣列）。
- 手機（<700px）：一段日文下接該段中文（灰、小一號）。
- 電腦（≥1000px）：`.app` 放寬到 1100px，左日文右中文兩欄，同一段對齊。
- 控制鈕三態「日文／對照／中文」放篇名列，與「▶ 全篇」同列，每篇獨立。
- 粒度是「段」不是「句」；句對句要等第 5 階段的句子級音檔一起做。

### 決策 7：考試題型的補齊順序

見第 5 節對照表。原則：**資料現成的先做**（漢字読み、表記），需要新內容的走 `new-lesson` skill 產（並べ替え的分段、例句聽解）。

### 決策 8：`audio-check.html` 只列本次新增

`generate-audio.py` 跑完把「這次新產的 manifest key」寫到 `audio/last-run.json`；`build-audio-check.py` 預設只列這份，加一顆「顯示全部」。SOP 改成「聽新增的那一批」。

### 決策 9：舊課只單向搬

`日文70單字學習器.html` 不改。`migrateLegacy()` 讀它的 `jp70-srs` 進新結構；之後它自己的寫入還是在 `jp70-srs`，複習中心讀的是搬過來的。要真正同步再另開任務。

### 決策 10：`vocab.json` 暫不拆檔

等 30 課以後或總表明顯變慢。引擎的 `if (!w.lessons || …)` 會把沒標 `lessons` 的字塞進每一課——用驗證器擋，不改引擎。

---

## 4. 分階段實施

每階段結束的共同驗收（來自 CLAUDE.md）：本機 `python3 -m http.server 4173` 開每一個引擎課＋`日文單字總表.html`，console 無 error；375px 版面 OK、觸控目標 ≥44px；`python3 validate-lessons.py` 通過；`build-index.py` 無 diff；CI 綠。

### 第 1 階段：引擎修正（不動資料結構）

**目標**：修掉會讓學習達不到目的的問題，讓手機第一屏看得到內容。

| 改什麼 | 動哪個檔 | 怎麼改 |
|---|---|---|
| 評分鈕在顯示答案前不出現，評分後自動下一題 | `assets/lesson-engine.js`（`renderQuiz`、`.status-btn` 事件） | 答案未 `show` 時評分鈕 `hidden`；`showAnswer` 才顯示；拿掉「上一題」 |
| 逐段對照（手機疊／電腦雙欄） | `lesson-engine.js`（`storiesSection`、`renderStories`）、`assets/lesson.css` | 每段輸出 `<div class="para"><p lang="ja">…</p><p class="zh">…</p></div>`；`.story-text[data-lang]` 控制顯示；`@media (min-width:1000px)` 用 grid 兩欄 |
| 語言鈕三態移到篇名列 | 同上 | `.lang-tabs` 併入 `<h2>` 那列 |
| 底部分頁列＋評分鈕固定 | `lesson.css`（`.tabs`、`.quiz-controls`） | `position:fixed; bottom:0`；`.app` 底部 padding 加大；`padding-bottom: env(safe-area-inset-bottom)` |
| header 瘦身：注音四態合併遮字、只在故事分頁顯示 | `lesson-engine.js`（`shell`、`applyFg`、`applyWordMode`）、`lesson.css` | 一組 `data-rd` 四鈕取代 `data-fg`＋`data-wm`；非故事分頁時該列 `hidden` |
| 統計只在單字表／單字測驗 | `lesson-engine.js`（tab 切換） | 切分頁時 `.hud` 依分頁 toggle |
| 二級切換不用卡片 | `lesson-engine.js`、`lesson.css` | `.panel.toolbar` 改 `.subtabs`，無 border、無 padding 卡片 |
| 提示框可收合 | 同上 | `.tip` 加收合鈕，狀態暫存 `<id>:tip`（第 2 階段搬進 settings） |
| 記住分頁與注音狀態 | `lesson-engine.js` | `LS.set("tab", …)`；`boot()` 讀回 |
| 「重設學習紀錄」移到設定 | `lesson-engine.js`（`grammarSection`、`openSettings`） | 從文法分頁移除，設定 modal 加一列 |
| 「N4 依據」欄移出表格 | `lesson-engine.js`（`renderGrammarTable`） | 表格只留 文法／例句／意思；`n4ref` 進 `openGrammarCard` |
| 單字卡加字典連結 | `lesson-engine.js`（`openCard`） | `<a target="_blank" rel="noopener" href="https://jisho.org/search/…">` |
| 鍵盤：空白＝顯示答案、1/2/3 評分、←→ 換題、Esc 關卡片 | `lesson-engine.js`（`wire`） | 只在單字測驗分頁 active 時攔截 |

**風險**：動 `assets/` 影響所有引擎課，全部重測。舊課不動、不受影響。

**驗收補充**：手機第一屏（844 高）要看得到第一段日文的至少三行；克漏字第一題四個選項全在第一屏。

### 第 2 階段：資料層搬家（使用者看不出差別）

**目標**：進度與設定全站共用；為資料庫鋪路；有備份手段。

| 改什麼 | 動哪個檔 | 怎麼改 |
|---|---|---|
| 新增存取層 | 新增 `assets/store.js` | 決策 1、2 的結構與 API |
| 引擎改用 store | `assets/lesson-engine.js` | 移除 `LS`、`srsData`、`saveSrs`、`gqData`、`rqData`；全部改呼叫 `JLStore` |
| 總表設定改用 store | `lessons/日文單字總表.html` | `vocabtable-*` 三個 key 改讀 `JLStore.getSettings()` |
| 薄殼加載 store | `lessons/<id>.html`、`.claude/skills/new-lesson/SKILL.md` 步驟 6 的薄殼範本 | `<script src="../assets/store.js">` 放在 `vocab-table.js` 前 |
| 舊資料搬家 | `store.js`（`migrateLegacy`） | 見決策 2；搬完不刪 |
| 題目 id | `data/lessons/boarding-house.json`、`SKILL.md` 步驟 5、`validate-lessons.py`、`docs/lesson-authoring.md` | 46 題補 id；skill 產題時給 id；驗證唯一 |
| 文法標題凍結 | `docs/n4-grammar.md`、`validate-lessons.py`（`n4_headings`） | 加規則段落；驗證器擋「停用」條目 |
| `lessons` 欄位必填 | `validate-lessons.py`（`check_vocab`） | 缺欄位報錯 |
| 匯出／匯入 | `store.js`、`lesson-engine.js`（`openSettings`） | 匯出：下載 `jl-progress-YYYYMMDD.json`；匯入：`<input type="file">` 讀進來、先顯示筆數再確認覆蓋 |
| SRS 間隔加兩級 | `store.js` | `[0,1,3,7,16,30,60]`，box 6 畢業 |

**風險**：會動到既有進度。順序：先在第 1 階段的引擎加匯出（純讀舊 key）→ 使用者備份 → 再上第 2 階段。搬家程式只複製不刪。

**驗收補充**：在課程頁調深色特大字 → 換到總表 → 設定一致；舊課的 `jp70-srs` 有幾筆、搬過來就幾筆；匯出再匯入後 `stats()` 相同。

### 第 3 階段：跨課複習中心與首頁

**目標**：課多了以後有一個天天用的入口。

| 改什麼 | 動哪個檔 | 怎麼改 |
|---|---|---|
| 複習中心 | 新增 `review.html`（根目錄，不進 `lessons/` 目錄掃描） | 讀 `data/vocab.json`＋`JLStore.dueVocab()`＋`dueGrammar()`，混合所有課出題；沿用引擎的測驗卡 |
| 首頁改版 | `build-index.py`、`index.html`（生成物） | 最上方一塊由前端 JS 填「今天要複習 N 字 / M 個文法點」→ 連到 `review.html`；課程卡加「70 字 · 14 文法 · 3 篇」（build 時讀 JSON）與前端填的學習狀態 |
| audio-check 只列新增 | `generate-audio.py`（`main` 末尾寫 `audio/last-run.json`）、`build-audio-check.py`、`CLAUDE.md` SOP、`SKILL.md` 步驟 9 | 決策 8 |
| 熟練字封存 | `store.js`、`lesson-engine.js`（篩選鈕） | 篩選加「已畢業」 |

**驗收補充**：兩課各評分幾個字後，`review.html` 的今日清單＝兩課到期字的聯集；首頁數字與之相同。

### 第 4 階段：考試題型與文法

**目標**：把 N4 文字語彙、文法的題型補齊；文法有間隔複習、有得查。

| 改什麼 | 動哪個檔 | 怎麼改 |
|---|---|---|
| 漢字読み | `lesson-engine.js`（單字測驗加模式） | 題：`dict`；選項：正解 `reading`＋同課其他字的 `reading` 三個（長度相近優先） |
| 表記 | 同上 | 題：`reading`；選項：正解 `dict`＋同課其他字的 `dict` 三個 |
| 文法接 SRS | `lesson-engine.js`（克漏字答題）、`store.js` | 答對＝`rateGrammar(point,"good")`，答錯＝`"bad"`；「只練答錯的」改成「今日到期」 |
| 文法查詢頁 | 新增 `build-grammar.py`（`docs/n4-grammar.md` → `data/grammar.json`）、新增 `lessons/grammar-index.html`、`validate.yml`（無 diff 檢查） | 可搜尋、可展開；每條列「哪些課教過」（掃 `data/lessons/*.json`） |
| 並べ替え（文の組み立て） | `docs/lesson-authoring.md` schema、`SKILL.md` 步驟 5、`validate-lessons.py`、`lesson-engine.js` | `grammar[]` 加選填 `chunks: ["窓を","開けた","まま","寝てしまった"]`；有才出題（打亂 4 段、拖或點順序）；舊課補不補由你決定 |
| 備註 | `lesson-engine.js`（`openCard`、`openGrammarCard`）、`store.js` | 卡片加一個 `<textarea>`，blur 存 `setNote` |

**驗收補充**：漢字読み的干擾項不可與正解相同讀音；並べ替え的 `chunks` 連起來必須等於 `example`（驗證器比對）。

### 第 5 階段：聲音與周邊

| 改什麼 | 動哪個檔 | 怎麼改 |
|---|---|---|
| 語速 | `lesson-engine.js`（`play`、`speak`、`openSettings`） | `curAudio.playbackRate = settings.audioRate`；TTS `u.rate` 同步 |
| 錄音回放 | `lesson-engine.js`（故事段落、單字卡） | `MediaRecorder` 錄 → 原音／自己交替播；不存檔、不評分 |
| 例句聽解 | `lesson-engine.js`（聽力模式） | 聽力模式改播 `ex`，答案顯示整句＋中文；資料現成 |
| 動詞工具接主線 | `lessons/日語動詞變化練習工具.html` | 「單字管理」加「從本站匯入動詞」：讀 `data/vocab.json` 取 `pos` 含「動詞」的字 |
| 句子級音檔 | **另開規劃**：`generate-audio.py`（`clean_story_json`）、`build-audio-check.py`（`clean`／`annotated`）、`validate-lessons.py`（`plain`）、`lesson-engine.js`（`parsePara`）四處同改；全部語音重產 | 做之前先估：307 段 → 約 1,200 句；Google TTS 免費額度；四處一致性測試 |

---

## 5. N4 題型覆蓋對照

| JLPT N4 題型 | 考什麼 | 現況 | 規劃後 | 階段 |
|---|---|---|---|---|
| 文字語彙：漢字読み | 看漢字選讀音 | 無（讀音直接印出） | 自動出題 | 4 |
| 文字語彙：表記 | 看假名選漢字 | 無 | 自動出題 | 4 |
| 文字語彙：文脈規定 | 句子挖空選詞 | 無 | 需新內容，暫不做 | — |
| 文字語彙：言い換え類義 | 選意思最近的句子 | 無 | 需新內容，暫不做 | — |
| 文字語彙：用法 | 選用法正確的句子 | 無 | 需新內容，暫不做 | — |
| 文法：文法形式判斷 | 挖空選文法 | 克漏字（有） | 接 SRS | 4 |
| 文法：文の組み立て | 四段排序（★） | 無 | `chunks` 選填，新課由 skill 產 | 4 |
| 文法：文章文法 | 短文挖空 | 無 | 暫不做 | — |
| 読解 | 短文理解 | 讀解題（有） | 答錯可跳回文章段落 | 3 |
| 聴解 | 聽句子選答案 | 只有單字聽力 | 例句聽解、語速 | 5 |

「暫不做」的三種詞彙題型與文章文法都需要人工出題，等模考產生器（`docs/lesson-authoring.md` 已列構想）再一起規劃。

---

## 6. 不做的功能與理由

| 功能 | 理由 |
|---|---|
| 連續天數、徽章、經驗值 | 把注意力從「這個字記住沒」轉到「今天打卡沒」；漏一天歸零反成壓力 |
| 推播提醒 | 靜態站做不到，需要伺服器 |
| 發音評分（語音辨識） | 對非母語者判定不穩，N4 程度容易被誤判；錄音回放不評分即可 |
| AI 對話／AI 生成例句 | 金鑰要放前端，任何人都拿得到；等資料庫階段 |
| 多語言介面、排行榜、分享 | 單人自用 |
| 漢字筆順 | 本站練閱讀與聽力，不練寫字；KanjiVG 幾千個 SVG 體積重 |
| 手勢滑動換題 | 跟捲動打架、看不出可以滑 |
| 每字配圖 | 內容成本比整課故事還高 |
| 限時模式 | 對背單字沒用；確定要考再加 |
| Anki 匯出 | 進度分兩邊 SRS 就失效；要的話只做 CSV |
| `vocab.json` 現在拆檔 | gzip 後 30 課以內都不成問題 |

---

## 7. 文件與規範同步清單

| 階段 | 要改的文件 | 改什麼 |
|---|---|---|
| 1 | `docs/lesson-authoring.md`「引擎已內建」段 | 四分頁描述、注音四態、底部分頁列、逐段對照 |
| 2 | `docs/architecture.md` | 檔案地圖加 `assets/store.js`；資料流表加 `jl.settings.v1`／`jl.progress.v1`；薄殼四行變五行 |
| 2 | `docs/lesson-authoring.md` schema | `grammarQuiz[].id`、`reading[].id` 必填 |
| 2 | `docs/n4-grammar.md` | 「標題凍結規則」段 |
| 2 | `.claude/skills/new-lesson/SKILL.md` 步驟 5、6、11 | 產 id；薄殼加 store.js；自檢加 id 唯一 |
| 2 | `CLAUDE.md` 硬性規定 | 加「localStorage 只能透過 `assets/store.js`」、「`n4-grammar.md` 標題不改名」 |
| 3 | `CLAUDE.md` SOP、`docs/architecture.md` 生成物清單 | audio-check 改「聽新增的那批」；加 `audio/last-run.json`、`review.html` |
| 4 | `docs/lesson-authoring.md` schema、`SKILL.md` 步驟 5 | `grammar[].chunks` 選填與規則 |
| 4 | `docs/architecture.md`、`.github/workflows/validate.yml` | `build-grammar.py`、`data/grammar.json` 無 diff 檢查 |
| 各階段 | `docs/changelog.md` | 做完記一筆 |

---

## 8. 開工前要你決定的三件事

1. **並べ替え要不要回頭補舊課**：`boarding-house` 14 個文法點手動補 `chunks`，或只從下一課開始。
2. **舊課 `日文70單字學習器` 的進度**：接受「搬一次、之後不同步」，還是另開任務讓它接 store（要逐項比對驗證，成本高）。
3. **底部分頁列**：確定要換到底部（手機順手、但跟現在的視覺習慣不同），還是維持頂部只做瘦身。

這三件事不影響第 1 階段開工，但影響第 2、4 階段的工作量。
