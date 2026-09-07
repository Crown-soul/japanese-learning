# CLAUDE.md

自製日文學習網站（純靜態 HTML/CSS/JS，GitHub Pages）。使用者是 **git 新手**——給指令要解釋、別假設熟悉。

架構總覽看 `docs/architecture.md`。這份只放「掃程式碼看不出來、又不能搞錯」的東西。

## 硬性規定（絕對不能違反）

- **`tts-key.txt` 絕不 commit**（已 `.gitignore`）。金鑰只在產語音時用，產完網站不需要它。
- **`index.html`、`audio-check.html`、`audio/*`、引擎課薄殼 `lessons/<id>.html`** 是生成物——用腳本／skill 產，不要手改。
- **檔名一律英數與連字號**，全小寫（`hospital.html`），不要中文——網址複製出去才不會又長又亂碼。目錄顯示名靠 `<title>`（可中／日文）。
- **`lessons/` 每個頁面都要有 `← 回目錄`**：`<a href="../">`（token 頁放 `<a class="backlink">` 當 `<header>` 第一個子元素；React 動詞頁用 inline style 的 `<a>` 放在 `#root` 前）。
- **發佈只走 `./publish.sh "說明"`**（會 build-index → add -A → commit → push）。在 `main` 直接操作是這個專案的既定流程。
- **`lessons/日文70單字學習器.html` 不遷移到引擎**——它自成一格（CSS/JS/資料全內嵌）。要動它要逐項比對驗證。
- **`data/vocab.json` 的 `reading` 必須是 `dict` 的完整假名**（`散歩する`→`さんぽする`）。引擎課單字卡音檔靠它合成。

## 固定流程（SOP）

| 要做的事 | 怎麼做 |
|---|---|
| 新增一課（有單字照片／文字） | 用 `/new-lesson` skill（`.claude/skills/new-lesson/`）。不要手刻。 |
| 改了單字／故事／例句 | `python3 generate-audio.py`（需 `tts-key.txt`；沒放金鑰時 hook 會擋下並提醒）→ `python3 build-audio-check.py` → 請使用者用 audio-check 頁確認發音 |
| 改了引擎樣式／行為（`assets/`） | 回歸測試**每一個引擎課** + `日文單字總表.html`（vocab-table.js 兩處都用） |
| 發佈 | `./publish.sh "說明"`，然後等 Pages 1–2 分鐘 |
| TTS 回 `BILLING_DISABLED` | 請使用者到 Google Cloud 啟用該專案帳單（免費額度內 $0），見 `docs/tts-notes.md` |

## 改一處要連動更新

- **新增引擎課** ⇒ `data/lessons/<id>.json` + `data/vocab.json`（加字、`lessons:["<id>"]`）+ `lessons/<id>.html` 薄殼 + `generate-audio.py`（多音字修正表）+ `build-index.py`（跑一次）+ audio-check
- **改 `assets/lesson-engine.js` 或 `lesson.css`** ⇒ 影響所有引擎課，全部要重測
- **改 `assets/vocab-table.js`** ⇒ 影響所有引擎課的「單字表」分頁 **和** `日文單字總表.html`
- **改 `data/lessons/<id>.json` 的故事／新增單字** ⇒ 一定要重跑 `generate-audio.py` + audio-check（不然音檔對不上）
- **確認新的 TTS 誤讀** ⇒ 補進 `generate-audio.py` 的修正表 **和** `docs/tts-notes.md` 的清單

## 完成的驗收標準

改動要「做完」= 下列全過：
- 本機 `python3 -m http.server 4173` 開該頁，`read_console_messages` **無 error**
- 手機寬度（375px）版面 OK、觸控目標夠大
- 動到音檔 → audio-check 頁人工聽過一輪、無誤讀
- 動到目錄相關 → `build-index.py` 跑過、`index.html` 正確
- 新課另看 `docs/lesson-authoring.md` 的「驗收標準」清單（字數／文法數／題數…）

## 不確定時查哪（只給索引，內容在檔案裡）

| 主題 | 檔案 |
|---|---|
| 檔案地圖、資料流、生成物 vs 手寫 | `docs/architecture.md` |
| 引擎課 JSON schema、故事標記、樣式/RWD 規則、驗收標準 | `docs/lesson-authoring.md` |
| N4 文法點（skill 只能從這裡挑） | `docs/n4-grammar.md` |
| TTS 金鑰、發音修正機制、已知誤讀 | `docs/tts-notes.md` |
| 任務中途交接 | `docs/handoff-template.md` |
| 過去做了什麼（人看的，AI 不用載入） | `docs/changelog.md` |
| 生成新課的完整步驟 | `.claude/skills/new-lesson/SKILL.md` |

## 驗證與 Hook

- **`python3 validate-lessons.py [<id>]`**：驗引擎課 JSON —— 合法性、欄位、`grammar.point` 在 `docs/n4-grammar.md`、`grammarQuiz.g` 索引、`reading.ref` 是內文子字串、目標單字都有出現在故事、薄殼 `<title>` 一致、vocab `reading` 全假名。**新課 publish 前一定要過。**
- `.claude/hooks/require-tts-key.sh`（PreToolUse/Bash）：偵測到 `generate-audio.py` 但沒金鑰 → 擋下 + 提醒。
- `.claude/hooks/validate-on-publish.sh`（PreToolUse/Bash）：偵測到 `publish.sh` → 先跑 `validate-lessons.py`，有錯就擋下並列出。
- `.github/workflows/validate.yml`：push/PR 時跑 JSON 檢查 + `validate-lessons.py` + build-index 無 diff。

## 環境

- 本機預覽：`.claude/launch.json` 跑 `python3 -m http.server 4173`。課程頁要伺服器（fetch JSON），不能雙擊 `file://`。
- `git push` 認證已存 macOS Keychain，非互動也能推。git identity：`user.name=murmursoul` `user.email=skyer9968@gmail.com`。
