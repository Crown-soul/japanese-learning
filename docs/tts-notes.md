# 語音（TTS）注意事項

## 基本

- `generate-audio.py`：Google Cloud Text-to-Speech，`VOICE = ja-JP-Neural2-D`，`SPEAKING_RATE = 0.9`。
- 金鑰讀取：環境變數 `GOOGLE_TTS_API_KEY` ＞ 專案根目錄 `tts-key.txt`（`.gitignore`，**絕不 commit**）。
- 金鑰限制：**Application restriction = 無**（HTTP referrer 限制會讓 CLI 呼叫失敗），API 限制選 Text-to-Speech。
- **需啟用帳單**：即使在免費額度（Neural2 每月 100 萬字元）內，Google 也要求專案綁一個有效帳單帳戶，否則回 `BILLING_DISABLED`。整份網站字元數 <5000，實際費用長期 $0。建議設 $1 預算警示。
- 產完音檔、commit 進 repo 後，**網站執行完全不需要金鑰**（mp3 是靜態檔）。可到 Google Cloud Console 停用該金鑰，下次要重產再開。
- 更新金鑰：`printf '%s' 'NEWKEY' > tts-key.txt`
- **提醒機制**：`.claude/hooks/require-tts-key.sh`（PreToolUse/Bash）在偵測到要跑 `generate-audio.py` 但金鑰不在時，會擋下並印出放金鑰的指令。

## 降低發音錯誤率的機制（三層）

1. **引擎課單字卡 → 用假名合成**
   `generate-audio.py` 對「所屬課程全是引擎課且有 reading」的單字，`manifest[dict]` 指向「用 `reading`（完整假名）合成」的音檔。單字讀音 100% 正確（偶爾語調稍平，可接受）。
   → 所以 `data/vocab.json` 的 `reading` 一定要是 `dict` 的完整假名。
2. **例句／故事 → 漢字文字 + 修正表**
   `READING_FIXES`（子字串取代，2 字以上）與 `EXACT_FIXES`（整段剛好等於才換，單一漢字用）在 `generate-audio.py` 開頭。送 TTS 前套用，只影響語音、不影響畫面。
3. **audio-check.html → 人工快篩**
   `python3 build-audio-check.py` 產出一頁，列出所有音檔 + ▶ + ✓/✗。使用者聽一遍，✗ 的會集中成可貼回的清單，據以補修正表。**每次產完新音檔都要跑一輪。**

## 已知誤讀清單（`READING_FIXES` / `EXACT_FIXES` 目前收錄）

| 寫法 | 應讀 | 誤讀成 | 類型 |
|---|---|---|---|
| 大分 | だいぶ | 大／分、地名 おおいた | READING_FIXES |
| 止める | やめる | とめる | READING_FIXES |
| 開く | ひらく | あく | READING_FIXES |
| 頭 | あたま | 拆開讀 | READING_FIXES |
| 温い | ぬるい | あたたかい／おんい | READING_FIXES |
| 汚して / 汚す | よごして / よごす | きたな― | READING_FIXES |
| 指輪 | ゆびわ | （排在「指」前，避免被拆） | READING_FIXES |
| 指 | ゆび | さす／し | READING_FIXES |
| 日（單獨） | ひ | にち | EXACT_FIXES（子字串會傷「今日」「日曜日」） |
| 墓参り | はかまいり | ぼさん― | READING_FIXES |
| 駅の角 | えきのかど | 「角」→つの | READING_FIXES |
| 大家 | おおや | たいか／おおやけ | READING_FIXES |
| 一日おき / 二日おき | いちにちおき / ふつかおき | 一日→ついたち | READING_FIXES |
| 五分 | ごふん | ごぶん | READING_FIXES |
| 行った / 行きます / 行きました | いった / いきます / いきました | おこなった | READING_FIXES |
| 写した / 写しました | うつした / うつしました | しゃ― | READING_FIXES |
| 楽に | らくに | たのしく― | READING_FIXES |
| 粗い | あらい | そ― | READING_FIXES |
| 餌 | えさ | じ | READING_FIXES |

## 生成新課時的預防步驟（skill 第 8 步）

1. 掃該課故事段落與例句裡的**多音漢字**（開、生、下、上、間、大、日、方、行…）。
2. 比對本檔清單；不在清單、但該處讀音非最常見者，於 `generate-audio.py` 加一行：
   - 詞（2 字以上、不會誤傷其他詞）→ `READING_FIXES`
   - 單一漢字、整段剛好是它 → `EXACT_FIXES`
   - 長的詞放前面（例 `指輪` 在 `指` 前）
3. 跑 `generate-audio.py` → `build-audio-check.py` → 請使用者用檢查頁確認、把新確認的誤讀補進本檔與修正表。
