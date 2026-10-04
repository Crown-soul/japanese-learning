---
name: 日文學習檔案
description: 用自己的單字生成的 N4 文法故事課程——安靜的文庫本，手機上一天讀一篇。
colors:
  ai: "#223a5e"
  ai-soft: "#e1e8f3"
  paper: "#f7f7f8"
  card: "#ffffff"
  ink: "#1f2328"
  ink-muted: "#5f6672"
  line: "#e5e7eb"
  soft: "#eef2f7"
  grammar-violet: "#7a4a8f"
  grammar-violet-soft: "#f5eef8"
  review-amber: "#9a5a10"
  status-good: "#eaf7ef"
  status-mid: "#fff7e6"
  status-bad: "#fff0f0"
  text-ok: "#24734a"
  text-ng: "#b03a3a"
  danger: "#b42318"
typography:
  display:
    fontFamily: "Hiragino Mincho ProN, Yu Mincho, Noto Serif JP, Noto Serif CJK JP, serif"
    fontSize: "calc(var(--fs) * 1.35)"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.05em"
  title:
    fontFamily: "Hiragino Mincho ProN, Yu Mincho, Noto Serif JP, Noto Serif CJK JP, serif"
    fontSize: "1.2rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.04em"
  reading:
    fontFamily: "-apple-system, Hiragino Sans, Hiragino Kaku Gothic ProN, Noto Sans JP, Yu Gothic, sans-serif"
    fontSize: "var(--fs)"
    fontWeight: 400
    lineHeight: 2
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans TC, Noto Sans JP, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans TC, Noto Sans JP, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.2
  ruby:
    fontSize: "max(.55em, 11px)"
    fontWeight: 500
rounded:
  sm: "6px"
  md: "10px"
  lg: "12px"
  card: "16px"
  tray: "18px"
  sheet: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  gutter: "14px"
components:
  button-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 13px"
    height: "44px"
  button-primary:
    backgroundColor: "{colors.ai}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "11px 13px"
    height: "44px"
  button-selected:
    backgroundColor: "{colors.ai-soft}"
    textColor: "{colors.ai}"
    rounded: "{rounded.md}"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
    height: "36px"
  chip-selected:
    backgroundColor: "{colors.ai-soft}"
    textColor: "{colors.ai}"
    rounded: "{rounded.pill}"
  nav-tab:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    height: "56px"
  nav-tab-active:
    backgroundColor: "{colors.ai-soft}"
    textColor: "{colors.ai}"
    rounded: "{rounded.pill}"
  story-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  answer-tray:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.tray}"
    padding: "8px"
  sheet:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.sheet}"
    padding: "20px 18px"
---

# Design System: 日文學習檔案

## Overview

**Creative North Star: "安靜的文庫本"**

這套介面像一本口袋版的日文讀本：紙色底、明朝體的標題、黑體的內文與注音，留白多、裝飾少。主角永遠是日文本身——故事的句子、注音、重點字的標記；介面元件退到旁邊，只在需要的時候出聲。

藍（Ai）是唯一的品牌色，像書裡的藏書票或書籤，只出現在「現在在哪」與「下一步按這裡」。其他顏色都有固定的語意：紫＝文法、琥珀＝複習字、綠／黃／紅＝記得程度。手機是主要閱讀場景，所以導覽與主要動作都在拇指區，深淺兩種模式都要成立。

**Key Characteristics:**
- 明朝標題＋黑體內文：書的質感只放在標題，閱讀與注音用最清楚的字。
- 一個主色：實心藍＝要按的主要動作；淡藍底＋藍字＋藍框＝目前選中。
- 語意色不混用：紫只給文法、琥珀只給複習字。
- 安靜的元件：細框、少陰影，只有浮在內容上的東西（作答托盤、抽屜）才有陰影。
- 拇指優先：底部導覽、作答托盤、抽屜都在畫面下半部。

## Colors

一個沉靜的靛藍加上中性紙色，語意色各司其職、彼此不借用。

### Primary
- **藍（Ai）** (#223a5e；深色模式 #b9cbe8)：主要動作按鈕（顯示答案、繼續：篇N、對答案）、進度條、導覽列的選中項目。
- **藍・淡（Ai Soft）** (#e1e8f3；深色模式 #2c3a50)：所有切換鈕的「選中」底色，配藍字與藍框。

### Semantic
- **文法紫** (#7a4a8f／淡 #f5eef8；深色 #cf9fe6／#3a2a42)：故事裡的文法範圍與「文」角標，只用在文法。
- **複習琥珀** (#9a5a10；深色 #e0a050)：之前課學過的複習字——虛線底與「復」字。
- **記得程度**：記得 #eaf7ef、有點模糊 #fff7e6、不記得 #fff0f0（深色模式各有對應）；文字版的對／錯用 #24734a／#b03a3a。
- **危險** (#b42318；深色 #ff8a80)：只有「清除這一課的紀錄」。

### Neutral
- **紙** (#f7f7f8；深色 #16181c)：頁面底色。
- **卡** (#ffffff；深色 #1f2329)：故事卡、抽屜、導覽列、作答托盤。
- **墨** (#1f2328；深色 #e6e7ea)：主要文字。
- **淡墨** (#5f6672；深色 #9aa1ab)：說明文字、注音、次要標籤（在紙、卡、soft 上都 ≥ 5:1）。
- **線** (#e5e7eb；深色 #333842)：細框與分隔線。
- **soft** (#eef2f7；深色 #2a2f37)：例句底、提示框、托盤裡的次要按鈕。

### Named Rules
**The One Ink Rule.** 藍是唯一的品牌色。實心藍只給「要按的主要動作」，同一個畫面最多一個；選中狀態一律用淡藍底，不用實心。

**The Semantic Lock Rule.** 紫、琥珀、綠黃紅各有唯一意思，不能拿來裝飾或表示別的狀態。

## Typography

**Display Font:** 明朝（Hiragino Mincho ProN → Yu Mincho → Noto Serif CJK JP → serif），全用系統內建，不下載網路字型。
**Body Font:** 系統黑體（日文段落用 Hiragino Sans／Noto Sans JP；中文介面用系統字＋Noto Sans TC）。

**Character:** 明朝只出現在「書名」與「篇名」，給一點文庫本的氣質；閱讀內文與注音用黑體，確保小字、濁點、促音都清楚。

### Hierarchy
- **Display**（600，`--fs` × 1.35，行高 1.4，字距 .05em）：每篇故事的篇名（`lang="ja"`）。
- **Title**（600，1.2rem，字距 .04em）：頂部的日文課名。中文頁面標題不套明朝。
- **Reading**（400，`--fs`＝18px 可調 16/18/20/23，行高 2）：故事內文，寬度跟著故事卡填滿（不另設行長上限，避免寬螢幕右側留白）。
- **Body**（400，15px，行高 1.7）：按鈕、說明、抽屜內容。
- **Label**（500，11.5–13px）：導覽標籤、步驟數字、篩選標籤、`.small` 說明。
- **Ruby**（500，max(.55em, 11px)）：注音，永遠不小於 11px。

### Named Rules
**The Mincho-Only-for-Titles Rule.** 明朝只用在日文標題；任何要「讀」的文字（內文、注音、例句、按鈕）都用黑體。中文標題不能套日文明朝（會缺字混排）。

## Layout

單欄、手機優先。內容最寬 880px（≥1000px 時 1100px），左右 14px 邊距。頂部是固定的一列：「← 回目錄 · 課名 · ⚙」，下面一列是注音四模式（只在文章分頁出現）。底部是固定導覽列（56px），≥700px 時變成貼在內容底部的圓角列。

故事內文一律填滿卡片寬度；寬螢幕的「對照」模式改成日中兩欄。

文章頁的節奏：本課進度（繼續：篇N）→ 每篇一張故事卡（篇名＋工具列 → ①–⑤ 一列步驟 → 內文）。測驗頁的節奏：看／聽／寫分段 → 該類的方式 → 一行「範圍 ▾」→ 題卡；作答按鈕全在底部托盤。

間距用 4／6／8／12／16px；同組元素 6–8px，組與組之間 12–16px。

## Elevation & Depth

以平面為主：故事卡、按鈕、導覽列都只用 1px 細框，不加陰影。只有「浮在內容上方、會蓋住東西」的元件才有陰影，讓人一眼分出它們不是頁面的一部分。

### Shadow Vocabulary
- **托盤** (`box-shadow: 0 8px 24px rgba(0,0,0,.14), 0 1px 3px rgba(0,0,0,.08)`)：單字測驗底部的作答托盤，跟導覽列之間留 8px。
- **抽屜關閉鈕** (`box-shadow: 0 2px 8px rgba(0,0,0,.08)`)：sticky 在抽屜頂部的「關閉」。
- **抽屜**：用半透明黑底（rgba(0,0,0,.4)）襯托，本身不加陰影。

### Named Rules
**The Flat-Unless-Floating Rule.** 會捲走的東西是平的；固定浮在內容上的東西才有陰影。

## Shapes

圓角依「離手指多近」遞增：小標籤 5–6px、按鈕 10px、步驟與托盤內按鈕 12px、卡片 16px、托盤 18px、抽屜 20px。膠囊形（999px）只用在可切換的選項：篩選 chip、範圍、日文／對照／中文、導覽圖示的選中底。

## Components

### Buttons
- **Default**：卡色底、細框、10px 圓角、最小 44px 高。
- **Primary**：實心藍、紙色字、600 字重。一個畫面最多一個。
- **Selected（切換鈕的選中）**：淡藍底＋藍字＋藍框，用在所有 `.active`（看／聽／寫、方式、篩選、注音模式、語言切換）。
- **Danger**：只在設定最底下單獨一列的「清除這一課的紀錄」。
- **觸控目標**：視覺可以小，但可點範圍至少 44×44（用 `::after` 擴大）。

### Navigation（底部導覽）
- 四個分頁：文章／單字表／單字測驗／文法；每個是 22px 線條圖示（1.8 線寬）＋文字。
- 選中：藍色文字，圖示後面墊 52×28 的淡藍膠囊。
- 「回篇N」：從某篇的 ③④⑤ 跳走時，「文章」分頁的文字變成「回篇N」，圖示右上加一個藍色小圓點；不是選中狀態，所以不墊底色。

### Answer Tray（作答托盤）
- 浮在導覽列上方 8px，左右留 10px，18px 圓角，有托盤陰影。
- 同一個位置依序換按鈕：「▶ 播放｜顯示答案｜略過」→「不記得｜有點模糊｜記得」或「下一題」。打字題的主鈕是「對答案」；題目本身有「▶ 再聽一次」時不再放播放鈕。
- 托盤裡的次要按鈕用 soft 底、無框。

### Story Card
- 卡色底、16px 圓角、細框。篇名用明朝；工具列（▶全篇、跟讀錄音、日文／對照／中文）一列；①–⑤ 是一列五等分的步驟格，做完變綠底打勾。
- 重點字：粗體＋點線底；複習字：琥珀虛線底＋上標「復」；文法：紫色淡底＋「文」角標。

### Sheet（底部抽屜）
- `role="dialog"`，打開時捲回頂端、焦點移入、背景 `inert`；關閉時焦點回到原本的按鈕。
- 「關閉」sticky 在頂部。小考作答中點背景或按 Esc 要先確認。

## Do's and Don'ts

- **Do** 讓日文內容當主角；新元件先問「它能不能退到旁邊」。
- **Do** 選中狀態一律用淡藍底＋藍字＋藍框；主要動作才用實心藍。
- **Do** 主要動作放拇指區（底部托盤、底部導覽）；可點範圍 ≥ 44px。
- **Do** 每個新顏色先確認它的語意，深淺兩種模式的對比都要 ≥ 4.5:1。
- **Don't** 用紫色或琥珀做裝飾——它們分別專屬文法與複習字。
- **Don't** 在同一個畫面放兩個實心藍按鈕，或兩組長得一樣的全寬橫條（會分不出哪個是導覽）。
- **Don't** 讓注音小於 11px，或把明朝體用在要閱讀的文字、中文標題上。
- **Don't** 用 emoji 或文字符號當導覽圖示；圖示是同一套線條 SVG。
- **Don't** 下載網路字型；明朝與黑體都用各平台內建的。
