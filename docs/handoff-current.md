# 交接：課程生成架構 —— 明天生成一課驗收

> 這是「這一棒」的實際交接（用 `docs/handoff-template.md` 的 8 欄位）。驗收完可刪或覆蓋。

## Goal

使用者能「拍單字照片或貼單字文字 → 自動生成一整份 N4 引擎課程（故事＋單字表＋文法＋測驗＋語音＋目錄連結）」，品質穩定、可驗證。

## Current State

**已完成並驗證（本機 fixture）**：
- 引擎：`assets/lesson.css` + `assets/lesson-engine.js`，四分頁／三測驗／SRS／設定／modal／RWD／localStorage 命名空間都通過。
- 每課資料：`data/lessons/<id>.json` schema + 故事標記（`漢字（かな）` + `{{key|課文形|讀音}}`）。
- 薄殼：`lessons/<id>.html`（~15 行）。
- 音檔：`generate-audio.py` 引擎課單字卡改用假名合成；`build-audio-check.py` 同步；舊課 157 段不變。
- 文件：`CLAUDE.md` + `docs/`（architecture / lesson-authoring / n4-grammar / tts-notes / handoff-template / changelog / ai-setup-audit）。
- skill：`.claude/skills/new-lesson/SKILL.md`（12 步）。
- 驗證：`validate-lessons.py` + 3 個 hook（require-tts-key / validate-on-publish / check-backlinks）+ CI（`.github/workflows/validate.yml`，含 headless console 檢查）。

**還沒做**：用**真的一課**跑完整 skill 流程（引擎尚未上線）。

## Confirmed Decisions

- N4 文法來源＝Claude 編的 `docs/n4-grammar.md`（之後使用者拿自己教材校訂）。
- 舊課 `日文70單字學習器.html` **不遷移**到引擎。
- 音檔：單字卡用假名合成、句子/故事用漢字＋修正表。
- 故事主題每次由單字內容決定，skill 在確認字表時提出讓使用者改。
- 檔名一律英數連字號。
- 發佈直推 `main`（走 `publish.sh`），使用者是 git 新手。

## Constraints

- 引擎課薄殼與 JSON **不放任何自訂 CSS/JS**，全走 `assets/`。
- 改 `assets/` 要回歸測試每一個引擎課 + `日文單字總表.html`。
- 課程頁需要伺服器（fetch JSON），不能 `file://`。
- `generate-audio.py` 需 Google TTS 金鑰 + 專案要啟用帳單。
- CI 的 headless 檢查現在忽略 `.mp3`/`manifest.json` 404。

## Modified Files（本次 chapter，commits fe6214f / 2b0a25f / 8fa5d96 / 下一個）

見 `docs/changelog.md` 的 2026-09-07 最後幾條。

## Important Findings

- 引擎課音檔的 **manifest key 是漢字 `dict`**（clip 本身用假名合成）→ 引擎一律 `play(v.dict)`，不是 `play(reading)`。
- 引擎的注音 regex 已對齊 `generate-audio.py` 的 `FURIGANA_RE`，兩邊純文字抽取才一致。
- `validate-lessons.py` 的文法點比對靠標題字串，`n4-grammar.md` 標題寫法要跟 `docs/lesson-authoring.md` 一致。
- GitHub Pages 對 `assets/*.js` 有 ~10 分鐘快取，改共用檔後回訪要 Cmd+Shift+R。

## Open Issues

- 引擎未經真實課程驗證（第一課要盯緊）。
- 舊課 vocab 的 `散歩→さんぽ`（dict `散歩する`）reading 不完整——舊課不遷移，統一才補。
- `n4-grammar.md` 待使用者用自己教材校訂。
- 仍開放：進度匯出/匯入、JLPT 等級標籤。

## Next Step

使用者提供第一批真的單字（照片或文字）後：
1. 跑 `/new-lesson` skill。
2. 步驟 2 停下來確認字表 + 主題。
3. 產語音前先確認 `tts-key.txt` 有金鑰（沒有 hook 會擋）。
4. 步驟 11 先跑 `python3 validate-lessons.py <id>`，再本機 `http.server` 開 `/lessons/<id>.html` 逐項檢查（四分頁、三測驗、`read_console_messages` 無 error、375px 手機版）。
5. audio-check 聽一輪。
6. `./publish.sh`（會觸發 validate-on-publish hook）。
7. 依驗收結果調整引擎／skill／n4-grammar。
