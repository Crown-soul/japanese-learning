# AI 協作設定盤點（六層）

依「Rules / Knowledge / Workflow / Enforcement / Session-Handoff」框架，對照現況。

## 1. Rules — `CLAUDE.md`

五類內容覆蓋情形：

| 類別 | 狀態 | 位置 |
|---|---|---|
| 絕對不能搞錯的硬性規定 | ✅ | `CLAUDE.md` §硬性規定（金鑰不 commit、生成物勿手改、檔名英數、回目錄、publish.sh、舊課不遷移、reading 全假名） |
| 固定處理流程 / SOP | ✅ | `CLAUDE.md` §固定流程（新課走 skill、改音檔→generate-audio+audio-check、改引擎→回歸每課、發佈、BILLING_DISABLED） |
| 修改一處要連動更新 | ✅ | `CLAUDE.md` §改一處要連動更新 |
| 完成的驗收標準 | ✅ | `CLAUDE.md` §完成的驗收標準 + `docs/lesson-authoring.md` §驗收標準（字數/文法數/題數） |
| 不確定時查哪（只索引） | ✅ | `CLAUDE.md` §不確定時查哪 表格 |

已把「掃程式碼就知道」的內容排除（沒有列檔案結構、函式清單——那些在 `docs/architecture.md` 與程式碼本身）。

## 2. Knowledge — `docs/`

大段背景知識已搬離 `CLAUDE.md`：`architecture` / `lesson-authoring` / `n4-grammar` / `tts-notes` / `handoff-template` / `changelog`。`CLAUDE.md` 只留連結索引。版本歷程（`changelog.md`）標明「AI 不需載入」。

## 3. Workflow — Skill

`.claude/skills/new-lesson/`：重複但非每次任務都要的完整流程（從單字生成整課）。12 步、兩個 checkpoint。

## 4. Enforcement — Hook / CI

| 規則 | 強制方式 | event / matcher / handler |
|---|---|---|
| 沒金鑰別跑 generate-audio | Hook | `PreToolUse` / `Bash` / `require-tts-key.sh`（grep `generate-audio.py`，缺金鑰 exit 2） |
| 發佈前 JSON 要驗過 | Hook | `PreToolUse` / `Bash` / `validate-on-publish.sh`（grep `publish.sh` → 跑 `validate-lessons.py`，失敗 exit 2） |
| 每個 lessons/*.html 有回目錄 | Hook | `Stop` / （無 matcher）/ `check-backlinks.sh`（漏了 exit 2 提醒，不阻擋使用者） |
| JSON 合法 + 內容一致 + 目錄不過期 + 無 console error | CI | `.github/workflows/validate.yml`：push/PR 觸發，`json.tool` + `node --check` + `validate-lessons.py` + `build-index` diff + `check-console.mjs`（headless Chromium） |

觸發範圍都夠精準（hook 先 grep 指令、只在特定情況 exit 2；其餘一律 exit 0 放行），有明確結束（印訊息即結束、不迴圈）。

## 5. Session / Handoff

`docs/handoff-template.md`：8 欄位範本。`docs/handoff-current.md`：目前這一棒的實際交接（Phase 1 完成、明天生成一課驗收）。

## 尚待補（低優先）

- CLAUDE.md 的「連動更新表」隨新課類型增加要維護。
- `check-console.mjs` 目前忽略 `.mp3`/`manifest.json` 404；若之後想嚴格，等音檔都產齊再收緊。
- `validate-lessons.py` 的 N4 文法點比對是「標題字串包含」，非語意比對；標題寫法要跟 `n4-grammar.md` 一致（`～` 半形、`／` 分隔多形）。
