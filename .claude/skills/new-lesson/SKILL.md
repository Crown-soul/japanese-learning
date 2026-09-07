---
name: new-lesson
description: >-
  從單字（拍的照片或貼的文字）生成一整份引擎課程：N4 文法故事（最多 3 篇）、
  本課單字表、文法對照表與克漏字、讀解理解題、語音，並加進總單字表與首頁目錄。
  觸發：「做一課」「新增課程」「生成課程」「我拍好單字了」「這些單字做成課」
  「匯入單字」「/new-lesson」，或使用者貼一批日文單字並要做成學習檔。
---

# new-lesson：從單字生成一整份課程

先讀 `docs/lesson-authoring.md`（schema、標記、驗收標準）與 `docs/n4-grammar.md`（可用文法點）。
本專案慣例見 `CLAUDE.md`。**嚴格照下列順序，不要跳步、不要一次全做完就 commit。**

---

## 步驟 1 — 讀單字輸入

- 使用者給的是**圖片**：仔細辨識每個單字。日文手寫／印刷都可能有相近字，不確定的先列出來問。
- 使用者給的是**文字**：直接解析。
- 每個字整理成：`辭書形 / 完整假名讀音 / 詞性 / 中文意思`。
  - `讀音` 一定要是**辭書形的完整假名**（`予約する`→`よやくする`）。
  - `詞性` 用：自動詞／他動詞／名詞／い形容詞／な形容詞／副詞／サ變動詞／接續詞…
  - 多音字（開、下、方、日、大…）先在心裡記下，步驟 8 要用。

## 步驟 2 — 跟使用者確認字表（**必須停下來等回覆**）

用表格列出「辭書形 / 讀音 / 詞性 / 中文」，並：
- 標出你不確定的辨識或讀音，請使用者確認
- **提出這課的故事主題**（依這批單字內容判斷最合適的情境，例：醫院、搬家、購物、旅行），讓使用者改
- 提出建議的 `<id>`（英數連字號，取自主題）

使用者確認前不要往下做。

## 步驟 3 — 挑 N4 文法點

- 從 `docs/n4-grammar.md` 挑 **至少 8 個** 能自然融入這批單字情境的文法點。
- 不在那份清單的文法**不要用**（要用就先問使用者要不要補進清單）。
- 每個記下 `point` / `meaning` / 對應的 `n4ref`（至少一個來源，如 `みん日II L29`）。

## 步驟 4 — 寫故事（1–3 篇）

- N4 程度、主題就是步驟 2 敲定的。
- **每個目標單字至少出現 1 次**；選定的文法點每個至少用 1 次。
- 每篇 150–400 日文字元。
- 標記規則（見 `docs/lesson-authoring.md`）：
  - 一般漢字詞：`漢字（かな）`（全形括號）
  - 目標單字：`{{key|課文形|讀音}}`（`key` = vocab 的 key；`課文形` 純文字不加注音；`讀音` 是整個課文形的假名）
- 寫完自己念一遍：句子自然、文法用對、注音正確。

## 步驟 5 — 出測驗

- **文法克漏字**：每個文法點 2 題。`s` 含 `（　）`，`o` 四選項，`a` 正解索引，`g` 指到 `grammar[]`。
  干擾項用「同類但語意不合」的（てしまう 的干擾放 ておく／てみる／ていく）。
- **讀解理解題**：每篇故事 5–7 題。`st` = 篇序號，`ref` 必須是該篇故事裡真的有的句子。

## 步驟 6 — 建檔

- `data/lessons/<id>.json`：`{id, title, stories[], grammar[], grammarQuiz[], reading[]}`
- `lessons/<id>.html` 薄殼（照 `docs/architecture.md`，`<title>` = `title`）：
  ```html
  <!DOCTYPE html><html lang="zh-Hant"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ctext y='13' font-size='13'%3E%E3%81%82%3C/text%3E%3C/svg%3E">
  <title>【故事標題】</title>
  <link rel="stylesheet" href="../assets/lesson.css">
  </head><body>
  <div class="app" id="app" data-lesson="【id】"></div>
  <script src="../assets/vocab-table.js"></script>
  <script src="../assets/lesson-engine.js"></script>
  </body></html>
  ```

## 步驟 7 — 加字進 `data/vocab.json`

- 每個字一筆：`{key,dict,reading,pos,zh,form,ex,lessons:["<id>"]}`
- `reading` = `dict` 的完整假名；`ex` 一句例句（可從故事挑一句改短）
- append 到陣列尾，保持 JSON 合法（結尾換行）

## 步驟 8 — 預填發音修正表

- 掃故事段落與例句裡的**多音漢字**，比對 `docs/tts-notes.md` 的清單。
- 該處讀音非最常見者 → 在 `generate-audio.py` 開頭加一行：
  - 詞（≥2 字、不誤傷其他詞）→ `READING_FIXES`（長詞放前面）
  - 單一漢字、整段剛好是它 → `EXACT_FIXES`
- 單字卡本身不用管（引擎課已用假名合成）。

## 步驟 9 — 產語音

**先確認金鑰**：`tts-key.txt` 存在且非空（或有 `GOOGLE_TTS_API_KEY`）。沒有就**停下來**請使用者放：
```bash
printf '%s' '你的金鑰' > tts-key.txt
```
（`.claude/hooks/require-tts-key.sh` 也會在沒金鑰時擋下 `generate-audio.py` 並提醒。）

```bash
python3 generate-audio.py      # 只會產這課的新段落
python3 build-audio-check.py
```
- 若回 `BILLING_DISABLED` → 停下來，請使用者到 Google Cloud 啟用帳單（見 `docs/tts-notes.md`）。
- 產完**請使用者開 audio-check.html 聽一輪**，把 ✗ 的字回報 → 補修正表 → 重跑。

## 步驟 10 — 重建目錄

```bash
python3 build-index.py
```
確認新課以 `title` 出現在 `index.html`。

## 步驟 11 — 自我檢核

**先跑自動驗證**（會擋掉大部分結構錯誤）：
```bash
python3 validate-lessons.py <id>
```
沒過就照訊息修，過了再往下人工檢查。

逐項打勾，不過就修：

內容（對照 `docs/lesson-authoring.md`）：
- [ ] 目標單字 40–80 個；每個在故事至少出現 1 次
- [ ] 1–3 篇故事，每篇 150–400 字
- [ ] ≥8 個文法點，**每個都能在 `docs/n4-grammar.md` 找到**（逐一 grep 確認）
- [ ] 克漏字每點 2 題、讀解每篇 5–7 題；每個 `reading[].ref` 真的在對應故事裡
- [ ] 每個 `grammarQuiz[].g` 指到正確的 `grammar[]` 項目（答完顯示的說明對得上題目）
- [ ] `data/vocab.json` 每個新字 `reading` = `dict` 完整假名

檔案／技術：
- [ ] `<id>` 英數連字號；薄殼有 `<title>` 與（引擎會自動加的）`← 回目錄`
- [ ] `python3 -c "import json; json.load(open('data/lessons/<id>.json'))"` 通過
- [ ] 本機 `http.server`，開 `/lessons/<id>.html`：四分頁都在、故事注音正確、目標字可點開詳解、單字表 two-row、三種測驗可作答、設定可換主題/字級
- [ ] `read_console_messages` 無 error
- [ ] `resize_window` 375px：手機版 OK
- [ ] localStorage key 都是 `<id>:` 前綴
- [ ] audio-check 聽過、無誤讀

## 步驟 12 — 發佈

```bash
./publish.sh "新課程：【title】"
```
（`validate-on-publish` hook 會在這裡再驗一次 JSON，沒過會擋下。）
告訴使用者：Pages 1–2 分鐘後更新，總單字表會自動出現這課、首頁目錄多一個連結（顯示名＝故事標題）。

---

## 注意

- **不要動 `lessons/日文70單字學習器.html`**（舊課不遷移）。
- 樣式／RWD／分頁內容**全部走引擎**，薄殼與 JSON 不放任何自訂 CSS/JS。要調外觀改 `assets/`（且要回歸測試每一課）。
- 每次停在步驟 2 等使用者確認字表與主題；產完語音停在步驟 9 等使用者聽 audio-check。
