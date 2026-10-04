# BudouX（第三方，勿手改）

日文按詞組斷行用。`assets/lesson-engine.js` 在所有瀏覽器都動態載入（Safari 不支援 CSS `word-break: auto-phrase`；Chrome 的 auto-phrase 遇到注音與「文」角標會把標點擠到行首）。引擎另外會把插在注音／重點字裡面的換行點移出或拿掉。

- 來源：npm `budoux@0.9.3`（https://github.com/google/budoux），取自 `module/` 目錄
- 只取日文需要的部分：`html_processor.js`、`parser.js`、`data/models/ja.js`，以及瀏覽器版的 `dom-browser.js`（存成 `dom.js`，讓原本的 import 路徑不用改）
- 授權：Apache License 2.0，全文見同目錄 `LICENSE`
- 升級：從同版本的 `module/` 重新下載上述檔案、同樣把 `dom-browser.js` 存成 `dom.js`，再跑引擎課回歸測試
