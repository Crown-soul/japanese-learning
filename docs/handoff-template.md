# 任務交接範本

任務拖長、要中途換一個新的 session 接手時，複製下面這塊填一填，貼給下一棒。目的：新 session 不用重讀整段對話就能接。

```markdown
## 交接：<任務一句話>

### Goal
最終要達成什麼（可驗證的結果，不是過程）。

### Current State
現在做到哪：哪些已完成並驗證過、哪些寫了還沒測、哪些還沒開始。

### Confirmed Decisions
使用者已拍板、不要再問或推翻的決定（含當時的理由）。

### Constraints
硬限制：不能動的檔案、要保持相容的東西、效能／體積上限、風格規範。

### Modified Files
這次動過或將要動的檔案，各一句說明改了什麼。

### Important Findings
過程中查到、對後續有影響、但從程式碼看不出來的事實。

### Open Issues
已知但還沒解的問題、風險、待使用者回答的問題。

### Next Step
下一棒接手後**第一件**該做的事（具體到可以直接執行）。
```

## 填寫要點

- **Goal 只寫結果**：「單字表例句要能閱讀」不是「把例句改成兩列」——方法可能會變。
- **Confirmed Decisions 附理由**：之後有人想改才知道當初為何這樣選。
- **Important Findings 只寫非顯而易見的**：程式碼／git log 看得到的別抄。
- **Next Step 要能直接動手**：「驗證 fixture」不夠，要寫「開 localhost:4173/lessons/testfix.html，跑 read_console_messages 確認無 error」。
- 交接文件是一次性的，別存進 repo（除非要當範例）。
