# data/lessons/

每個引擎課一個 `<id>.json`，內容：`{ id, title, stories[], grammar[], grammarQuiz[], reading[] }`。

schema 與故事標記規則見 `../../docs/lesson-authoring.md`。
由 `.claude/skills/new-lesson/` skill 產生，不要手刻。

搭配：
- `../../lessons/<id>.html`（薄殼）
- `../vocab.json` 裡 `lessons` 含 `<id>` 的字
- `../../assets/lesson-engine.js` + `lesson.css` 負責渲染
