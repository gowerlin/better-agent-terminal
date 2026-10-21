# BAT 網站設計語言

> **狀態**：v1（T0632，2026-10-18）
> **權威來源**：本文件是網站（`site/`）、網站用 Design System、日後 OG 卡片 / 簡報的視覺唯一來源。Artifact 與本文件不一致時以本文件為準。
> **擷取方式**：`ct-fieldguide design`（static，from code），只抽網站要沿用的部分；每個值都附出處。
> **不在範圍**：App 本身的 UI 規範（App 端仍以各 CSS 檔與 [`bat-stepper-design-language.md`](./bat-stepper-design-language.md) 為準）。

---

## 0. 固定錨點（任何視覺方向都不得改）

| # | 錨點 | 規則 |
|---|---|---|
| A1 | **品牌紫 = 塔台訊號色** | 紫色只用在「塔台發出的東西」：塔台分頁、派工、塔台代答、主要按鈕、連結。Worker、背景、裝飾不用紫色當主色。 |
| A2 | **Worker 狀態符號與語意** | `⚠️` 在等你 / `?` 在等塔台答覆 / `✓` 已回報；優先序 ⚠️ > ? > ✓；沒有符號 = 執行中。符號一律搭配文字，不只靠顏色（§ 3）。 |
| A3 | **分頁標題格式** | `<Agent 顯示名> · Tower`、`<Agent 顯示名> · Worker · <工單編號>`，分隔符是「空白 + U+00B7 + 空白」（§ 2）。 |

方向之間可以換的：背景、字體、版面、質感、動態、插圖風格、中性色。

---

## 1. 品牌色

### 1.1 出處

`assets/icon.svg`：

| 用途（圖示內） | 值 | 出處 |
|---|---|---|
| 魔法光暈中心 | `#a855f7` | `radialGradient#magicAura` stop 0%；書脊符文 `fill` |
| 光暈中段 | `#7c3aed` | `radialGradient#magicAura` stop 50%；書頁符號 `fill` |
| 光暈外緣 | `#4c1d95` | `radialGradient#magicAura` stop 100% |
| 淺紫（工單規格指定） | `#c084fc` / `#e9d5ff` | 規格 § 7 指定的品牌紫階（Tailwind violet 同階）；`#e8daef` / `#d2b4de` / `#bb8fce` 是圖示書頁漸層的近似色 |
| 書封深底 | `#1a1a2e` → `#16213e` → `#0f3460` | `linearGradient#magicBookGrad` |
| 書脊 | `#0a0a1a` | `rect`（書脊） |
| 羽毛筆彩虹（暖色點綴） | `#ff6b6b` / `#feca57` / `#48dbfb` / `#ff9ff3` / `#54a0ff` | `linearGradient#rainbowQuill` |

### 1.2 網站 tokens

| Token | 深色模式 | 淺色模式 | 用途 |
|---|---|---|---|
| `--bat-signal` | `#a855f7` | `#7c3aed` | 塔台訊號：塔台分頁框線、派工箭頭、主要按鈕底色 |
| `--bat-signal-text` | `#c084fc` | `#7c3aed` | 紫色文字、連結 |
| `--bat-signal-soft` | `#4c1d95` | `#e9d5ff` | 塔台元素的底色 / 選取背景 |
| `--bat-ink-deep` | `#1a1a2e` | — | 深色底（可改，見方向） |
| `--bat-spark-yellow` | `#feca57` | 同左（只做填色，不做文字） | 點綴 |
| `--bat-spark-red` | `#ff6b6b` | 同左（只做填色） | 點綴；同時是 App 的新通知 `●` 顏色（§ 3.2） |
| `--bat-spark-pink` | `#ff9ff3` | 同左（只做填色） | 點綴 |

對比（WCAG 2.x，T0632 實算）：

| 前景 | `#1a1a2e` 上 | `#ffffff` 上 | 結論 |
|---|---|---|---|
| `#a855f7` | 4.31 | 3.96 | 只用在 ≥ 18.66 px 粗體 / 圖形 / 按鈕底色；小字不用 |
| `#c084fc` | 6.46 | 2.64 | 深色模式的紫色文字 |
| `#7c3aed` | 2.99 | 5.70 | 淺色模式的紫色文字與訊號 |
| `#feca57` / `#ff6b6b` / `#ff9ff3` | 11.21 / 6.15 / 9.35 | 1.52 / 2.78 / 1.83 | 淺色模式不得當文字色 |

規則：

- 暖色（黃 / 紅 / 粉）只做點綴：插圖小元素、時間標籤底線、一處強調。**不做大面積背景、不做漸層主角**（避免「白底紫色漸層」模板感）。
- 暖紅 `#ff6b6b` 與狀態 ⚠️ 的紅（`#e06c75`）不同色，不得混用：前者是「新通知」，後者是「在等你」。

---

## 2. 分頁標題格式（A3）

| 角色 | 格式 | 例（網站示意用） | 出處 |
|---|---|---|---|
| 塔台 | `<Agent 顯示名> · Tower` | `Claude CLI · Tower` | `src/lib/tower-terminal-title.ts`（`towerTerminalTitle`、`TOWER_ROLE_LABEL = 'Tower'`、`SEPARATOR = ' · '`） |
| Worker | `<Agent 顯示名> · Worker · <工單>` | `Claude CLI · Worker · T1024`、`Codex CLI · Worker · T1025` | `src/lib/external-terminal-title.ts`（`externalTerminalTitle`、`WORKER_ROLE_LABEL = 'Worker'`） |

- Agent 顯示名取 `src/types/agent-presets.ts` 的 `name`：`Claude CLI`、`Codex CLI`、`Gemini CLI`、`GitHub Copilot`、`Terminal`（找不到 agent 時的備援，`EXTERNAL_TERMINAL_FALLBACK_TITLE`）。網站示意只用 `Claude CLI` / `Codex CLI`。
- 英文 `Tower` / `Worker` 是 App 的實際字樣，網站示意照抄，不翻成「塔台」；正文敘述才用中文「塔台」「Worker」（規格 § 8 名詞）。
- 使用者自己改名的分頁會保留使用者的名字；網站不示意這個情況。
- 分隔符是中點 `·`（U+00B7）前後各一個半形空白。網站其他地方不要再用「A · B · C」當裝飾性的 meta 字串，讓中點只代表分頁標題。

Agent 識別色（縮圖標題前的圖示，`src/types/agent-presets.ts` `icon` / `color`）：

| Agent | 圖示 | 色 |
|---|---|---|
| Claude CLI | `▶` | `#d97706` |
| Codex CLI | `▶` | `#10a37f` |
| Gemini CLI | `◇` | `#4285f4` |
| GitHub Copilot | `⬢` | `#6e40c9` |

網站示意若畫 Agent 圖示，只用這組值；不畫官方 logo（商標）。

---

## 3. Worker 縮圖狀態（A2）

### 3.1 符號、語意、顏色

| 狀態 | 符號 | 語意（網站文案） | App 色（深色底） | 網站淺色模式 | 出處 |
|---|---|---|---|---|---|
| `blocked` | `⚠️` | 在等你（權限確認、Agent 問你問題、Codex 等輸入） | `#e06c75`，框 `rgba(224,108,117,.6)` | `#b42d3a`（白底 6.22） | 符號 `src/components/TerminalThumbnail.tsx` `WORKER_ATTENTION_MARK`；色 `src/styles/panels.css` `.worker-badge.blocked` |
| `question` | `?` | 在等塔台答覆 | `#61afef`，框 `rgba(97,175,239,.6)` | `#1d64a8`（白底 6.10） | 同上，`.worker-badge.question` |
| `reported` | `✓` | 已回報（完成、部分完成、需要協助……都算） | `#98c379`，框 `rgba(152,195,121,.6)` | `#3b7a1e`（白底 5.27） | 同上，`.worker-badge.reported` |
| （無） | 只顯示工單編號 | 執行中 | `--text-secondary` `#888888`，框 `--border-color` `#404040` | 中性灰 | `.worker-badge`；`src/styles/base.css` |

- 優先序與判斷唯一實作：`src/lib/terminal-attention.ts` `workerAttention`（⚠️ > ? > ✓）。
- App 的徽章樣式：`font-size: 9px; padding: 0 4px; border-radius: 3px; border: 1px solid`（`.worker-badge`）。網站放大示意時保留「細框 + 圓角 3px 的小標籤」這個形狀，比例放大即可。
- 淺色模式的三個值是 T0632 為網站另訂的 AA 版本（同色相、降明度）；App 本身沒有淺色主題。
- 🔴 狀態不只靠顏色：網站任何地方出現狀態，一律「符號 + 文字」（例：`⚠️ 在等你`），插圖則以 `aria-label` 提供文字等價。

### 3.2 其他 App 訊號（網站可引用）

| 訊號 | 樣式 | 出處 |
|---|---|---|
| 新通知 `●` | `#ff6b6b`、`drop-shadow(0 0 3px rgba(255,107,107,.7))`、1.2 s 明暗脈動（`bat-notify-pulse`） | `src/styles/panels.css` `.notification-badge` |
| 目前分頁 | 縮圖框線 2 px、`--accent-color` | `src/styles/panels.css` `.thumbnail.active` |

網站示意的「目前分頁」改用 `--bat-signal`（A1：塔台分頁是使用者正在看的那個），不沿用 App 的 VS Code 藍 `#0078d4`。

### 3.3 縮圖外形

`src/styles/panels.css` `.thumbnail`：寬 200 px、`border-radius: var(--radius-md)`（12 px）、`background: var(--glass-bg)`（`rgba(31,29,26,.85)`）、`border: 1px solid var(--glass-border)`（`rgba(255,255,255,.1)`）。網站可以重新詮釋質感，但要讓人認得出是「一排並列的分頁縮圖」。

---

## 4. 流程狀態語言（取自 Stepper）

網站的「一張工單的一生」、故事時間軸、驗收清單沿用 [`bat-stepper-design-language.md`](./bat-stepper-design-language.md) § 3 的部分值：

| 網站用到的狀態 | 符號 | 色 | 用途 |
|---|---|---|---|
| `pending` | `○` | `#71717a` | 還沒到的步驟 |
| `running` | （網站不用 🔄 emoji，改用脈動圓點） | `#f59e0b` | 執行中 |
| `awaiting-input` | `●` | `#38bdf8` | 等你輸入（中性，不是錯誤） |
| `completed` | `✓` | `#10b981` | 完成 / 驗收 PASS |
| `failed` | `✗` | `#ef4444` | 失敗 |

- 🔴 `awaiting-input` 是中性等待，不得用紅色或錯誤樣式（Stepper 文件 § 3 註）。
- 工單狀態只有 **DONE / PARTIAL / BLOCKED / FAILED** 四種（規格 § 4.2），網站顯示時對應：DONE → `completed`、PARTIAL → `running` 色、BLOCKED → `awaiting-input` 色、FAILED → `failed`。
- Stepper 的 `completed` 綠（`#10b981`）與縮圖 `✓` 綠（`#98c379`）是 App 裡兩個不同元件的值；網站在「縮圖」示意用後者，在「流程 / 驗收」示意用前者。

### 4.1 角色色：「你 = 藍」（`--bat-you`）

T0634 為 `/control-tower` 與首頁「越用越懂你的專案」新增的語意色，標示「你要做的事」。

| Token | 深色模式 | 淺色模式 | 對比（T0635 實算） | 出處 |
|---|---|---|---|---|
| `--bat-you` | `#38bdf8` | `#0369a1` | `#38bdf8` 在 `#1b1b1f` 上 8.01；`#0369a1` 在 `#ffffff` 上 5.93、在 `#f6f6f7` 上 5.49 | `site/.vitepress/theme/custom.css`（`:root` / `.dark`），T0634 |

- 角色三色：**紫 = 塔台**（`--bat-signal`，A1）、**藍 = 你**（`--bat-you`）、**中性 = Worker**（文字色 / 分隔線，不另給顏色）。
- 藍取自 Stepper `awaiting-input`（`#38bdf8`，上表）：「輪到你」和「等你輸入」是同一個語意，都是中性等待，不是錯誤。淺色模式同色相降明度到 AA。
- 用在：TicketLife 每步的「你要做的事」框（`.tl-you`）、QuestionFlow 轉給你的那一路（`.qf-branch.is-you`）、GrowthLadder 由你拍板的幾級（`.gl-rung.is-you`）；T0674 起另有首頁故事每章的「你不用再記住」（`.story-relief`）、首頁「把腦力留給判斷」的「留給你」那格（`.feature.is-you`）、`/why` 對照表刻意保留的最後一列（CardTable `highlight-tone="you"`）。`/why` 的外殼示意（ShellLoop）不用紫也不用藍：外圈五步不是單一塔台動作。
- 🔴 不得用在 Worker 或 `?` 在等塔台答覆：縮圖 `?` 的藍（`#61afef` / `#1d64a8`，§ 3.1）是另一個值、另一個語意。
- `#38bdf8` 在白底只有 2.14，淺色模式一律用 `#0369a1`。

---

## 5. 字體

| 層 | App 現況 | 出處 | 網站 |
|---|---|---|---|
| UI | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | `src/styles/base.css` `body` | 由方向決定（§ 7） |
| 程式碼 / 終端 | `'Cascadia Code', 'SF Mono', Consolas, monospace` | `src/styles/claude-agent.css` | 終端示意區塊一律等寬；字體由方向決定 |

規則：

- 繁體中文是主要文字：先選中文字體，再配英文 / 等寬。
- 網站字體只用 Google Fonts（D162 / T0630），中文字體靠 Google Fonts 的 unicode-range 分段載入；不自帶字型檔、不加 npm 依賴。
- 等寬字只用在「終端內容」與工單編號 / 指令；不拿來做一般小標籤。
- 中文內文行高 ≥ 1.7，行長 ≤ 40 個全形字（約 80 個半形字元）。

---

## 6. 形狀、間距、動態

| 項目 | 值 | 出處 |
|---|---|---|
| 圓角 | `--radius-sm` 6 px / `--radius-md` 12 px / `--radius-lg` 16 px；狀態徽章 3 px | `src/styles/base.css`；`.worker-badge` |
| 玻璃質感 | `--glass-bg` `rgba(31,29,26,.85)`、`--glass-border` `rgba(255,255,255,.1)`、`--blur-amount` 12 px | `src/styles/base.css` |
| 間距 | 4 px 基數（網站新訂；App 沒有統一的間距 token） | — |
| 手機邊距 | 16 px，無整頁水平捲動 | 規格 § 7 |

動態：

- 一頁只有一個主要動態時刻（Hero 的 `TowerDemo`）；其他區塊不做進場動畫。
- `prefers-reduced-motion: reduce` → 顯示靜態最終畫面；捲出畫面時暫停（規格 § 4.1）。
- App 已有的動態語彙可以沿用：通知 1.2 s 明暗脈動、`running` 脈動光暈。

---

## 7. 視覺方向（待選）

T0632 在 Design 畫布提出三個方向，全部遵守 § 0 錨點。使用者選定後，塔台把結果寫進 T0630，並在此節記下選定的方向與 tokens。

| 方向 | 一句話 |
|---|---|
| A 進場雷達 | 深色雷達幕，Worker 是光點，紫色是塔台的掃描線 |
| B 飛行進度條 | 航管的紙條架：每張工單是一條進度條，手寫標記 ✓ / ? |
| C 一個早上 | 以時間為主角：09:00 到 12:30，頁面顏色隨早晨推移 |

細節（字體、色票、動態、實作風險）見 T0632 回報區與 Design 畫布。
