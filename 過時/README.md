# 過時

已經用不到的舊檔，留著只是為了查歷史。網站不會連到這裡，其他程式也不會讀這裡。

| 檔案 | 是什麼 | 為什麼過時 |
|---|---|---|
| `learner-plan.md` | 新手友善改版計劃書（v1.3） | 第 1–4 階段早已完成，現況以 `docs/guide/architecture.md`、`docs/guide/lesson-authoring.md` 為準 |
| `try-voices.py` | 試聽多個 Google TTS 語音的開發工具 | 聲音已定案（寫在 `scripts/generate-audio.py`）。搬進來後路徑沒更新，**直接執行會找不到 `generate-audio.py`**；真要用，把裡面的路徑改成 `scripts/generate-audio.py` 與上一層的 `audio/_samples` |

## 放進來的規則

- 只放「確定不會再用」的檔案；不確定就留在原處。
- 搬進來前先搜一下有沒有別的檔案引用它（`grep -r 檔名 .`），有就一起改。
- 想復原：`git mv 過時/<檔名> <原位置>`。
