---
schema_version: 1
schema_kind: workorder
id: T0635
title: "PLAN-049 W2b-2：`/features`、`/faq`、`/contribute`、頁尾致謝與 nav；修手機 checklist 示意對齊；設計語言補「你 = 藍」色票"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T14:27:20+0800"
started_at: "2026-10-18T14:28:14+0800"
updated_at: "2026-10-18T14:40:45+0800"
completed_at: "2026-10-18T14:40:45+0800"
depends_on: [T0634]
related:
  - "主規格：`_ct-workorders/_spec-site-v2-bat-ct-story.md` § 6（`/features`、`/faq`、`/contribute`、頁尾）、§ 7、§ 8"
  - "T0622 研究回報區 § 3-1 / § 3-2（`/faq`、`/contribute` 的內容來源建議）"
  - "`_ct-workorders/_local-rules.md`「更版重點」節的「歡迎協助測試」（D153）——`/contribute` 的 Codex 使用者協助測試步驟來源"
  - "W2a / W2b-1 成果：T0630（`7d22cb8b`）、T0634（`47b24606`），皆已上線；元件、tokens、字體沿用"
  - "後續：W2d（`/cases`）"
affects_files:
  - "site/features.md（新）"
  - "site/faq.md（新）"
  - "site/contribute.md（新）"
  - "site/index.md、site/control-tower.md（只換 `TODO(W2b)` 為真連結）"
  - "site/.vitepress/config.mts（nav / sidebar / footer）"
  - "site/.vitepress/theme/**（`FeatureGrid` 連結、`StoryIllo` checklist 手機對齊、必要樣式）"
  - "docs/design/site-design-language.md（只補 T0634 新增的「你 = 藍」色票 `--bat-you`）"
  - _ct-workorders/T0635-site-w2b2-features-faq-contribute.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 **`frontend-design`** skill（名稱以 skill 清單為準，前兩張是 `frontend-design:frontend-design`）；清單裡沒有 → `BLOCKED` 回報。另用 `vitepress-book`（只當參考）與 `bmad-editorial-review-prose`（文案校稿）。"
  - "🔴 **Worker 不 push、不改 GitHub 設定、不觸發 workflow**。預覽通過後由塔台取得使用者授權再 push。`gh` 只能唯讀且一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 只改 `affects_files` 列的路徑；不改 `install.md` / `compatibility.md` / `releases.md` / `latest-release.mts` / `site/package*.json`、`README.md`、其他 `docs/`、`src/`、`electron/`、`.github/`；不新增 npm 依賴；字型沿用已載入的 Google Fonts。"
  - "🔴 內容規則（D159 / D165 / 主規格 § 8）：不出現 CT 取得管道、內部 repo 位置、skill 檔內容、CT 文件名、CT 版本號、塔台指令、CT skill 名稱、CT 資料路徑；`site/` 內 grep `T0\\d{3}`、`D1\\d{2}`、`BUG-\\d+`、`PLAN-\\d+`、`_ct-workorders`、`CLAUDE.md` = 0（include 的 README / `release-note.md` 原文除外）；不放權杖、使用者路徑、帳號、私人 repo / 工作區名稱；不用既有 `assets/screenshot-*.png`。"
  - "🔴 每個主張都要對得上 BAT 的真實行為（README、`docs/agent-guide/`）；回報區附「主張 → 出處」。`/features` 是 BAT 單獨使用的功能介紹，不得把 CT 的能力寫成 BAT 功能。"
  - "🔴 不要開本機預覽伺服器後留著不關：預覽 / 截圖用完就結束（含 esbuild 子程序），並在回報區寫明已結束；啟動前先確認埠沒有被占用。"
  - "🔴 非隔離工單。`src/styles/settings.css` 的 M 不是你的變更，不碰；其他 Worker 的工單檔不碰。commit 用 `git commit --only <檔案>` 或精確 stage。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。"
---

# T0635 — PLAN-049 W2b-2：功能、FAQ、協助測試頁與頁尾

## 目標

補齊網站 W2b 剩下的頁面，讓首頁與 `/control-tower` 留下的 `TODO(W2b)` 都換成真連結：

- `/features`：BAT **單獨使用**也好用的功能（R2 讀者）
- `/faq`：使用者常問的問題
- `/contribute`：回報問題與「歡迎協助測試」（Codex 使用者）
- 頁尾致謝上游

另外修一個 T0630 留下的 bug、補一個 T0634 新增的色票。

## 要做的事

### 1. `/features`（`site/features.md`，新頁）

- 來源：README「功能特色」各節（工作區管理、AI Agent 整合、指令自動完成、Control Tower 整合、Supervisor 模式、遠端存取、Remote dev support、狀態列、其他功能、語音輸入）改寫成使用者語氣；每節一句摘要 + 重點清單；每節保留插圖位置（`<!-- TODO(W3): 截圖 -->`，W3 才補真實截圖）
- 「Control Tower 整合」一節只寫 BAT 提供的部分（側欄看板、Sprint 進度、一鍵執行、塔台 / Worker 分頁、BAT MCP、worktree 隔離派工），並連到 `/control-tower`
- 首頁 `FeatureGrid`（standalone）的六格各自連到本頁對應段落（固定英文錨點）
- 遠端開發細節頁屬 W2c：本頁只放概述，`/remote/` 以 `<!-- TODO(W2c) -->` 留位，不連結

### 2. `/faq`（`site/faq.md`，新頁）

依 T0622 § 3-2 建議並對照 README / `docs/agent-guide/` 撰寫（每題 2–5 句，寫使用者看得到的現象與處理方式）：

- 除錯日誌在哪裡（各平台路徑用 `<appData>` 這類通用寫法，不放實際使用者路徑）
- Claude 面板出現「CLI 版本太舊」錯誤怎麼辦
- 終端機裡的程式開了滑鼠追蹤時，怎麼叫出 BAT 的右鍵選單（Shift + 右鍵）
- 為什麼 macOS 只有 Apple Silicon 版
- 遠端設定時下載不到 server bundle 怎麼辦（可匯入本機檔案）
- BAT 重開時出現「保留 / 重新開始」提示是什麼
- Control Tower 去哪取得？（「目前未公開提供」，與 `/control-tower` FAQ 一致；BAT 的派工、回報、問答介面是公開的）

### 3. `/contribute`（`site/contribute.md`，新頁）

- 回報管道：GitHub Issues（`https://github.com/gowerlin/better-agent-terminal/issues`）；回報時附上 BAT 版本、作業系統、Agent 與版本、除錯日誌（提醒先檢查日誌裡沒有私人資訊）
- **歡迎協助測試（Codex 使用者）**：依 `_local-rules.md`「更版重點」節「歡迎協助測試」的步驟改寫成使用者看得懂的流程（開 Codex CLI 分頁 → 呼叫 `bat_whoami` 看 `role` / `agent` → 由塔台派一張小工單給 Codex Worker → 確認完成通知回到塔台、分頁被回收 → 回報）。這段牽涉塔台流程：寫成「如果你在用 Control Tower」的條件段，不寫 CT 指令名稱

### 4. 頁尾與 nav

- `config.mts` 頁尾：維持「以 MIT 授權釋出」，加上致謝上游（README「致謝」節：tony1223 原專案、scandnavik 與原始貢獻者），連到 README 致謝段或上游 repo
- nav / sidebar 加入 `/features`、`/faq`、`/contribute`；`/remote/`（W2c）、`/cases`（W2d）維持 TODO 註解
- 把 `site/index.md`、`site/control-tower.md`、`FeatureGrid.vue` 裡指向 `/features` 的 `TODO(W2b)` 換成真連結

### 5. Bug：手機 checklist 示意對齊（T0630 的 `StoryIllo`）

T0634 回報：`StoryIllo` 的 `checklist` 示意在手機寬度時等寬字折行、對齊跑掉。修好它（桌面外觀不變），在回報附修正前 / 後的手機截圖。

### 6. 設計語言補色票

`docs/design/site-design-language.md` 只補一段：T0634 新增的語意色「你 = 藍」（`--bat-you`：淺色 `#0369a1`、深色 `#38bdf8`；語意：紫 = 塔台、藍 = 你、中性 = Worker；對應 Stepper 的 `awaiting-input`），寫明出處（`site/.vitepress/theme/custom.css`、T0634）。其他內容不改。

### 7. 校稿與驗證

- `bmad-editorial-review-prose` 審三個新頁；採納 / 不採納列在回報區
- `site/` 內 `npm ci` + `npm run build`：0 錯誤、0 死連結；console 0；手機無整頁水平捲動
- 截圖存 `e2e-results/site-v2b2/`（不入版控）：三個新頁 × 桌面 1440 / 手機 390 × 淺 / 深色；checklist 修正前 / 後
- 內容規則 grep = 0；預覽伺服器用完已結束（回報寫明）

## 驗收

- 三個新頁完成並出現在 nav / sidebar；`site/` 內沒有剩下的 `TODO(W2b)`
- checklist 手機對齊修好；設計語言檔補上「你 = 藍」
- build 0 錯誤、0 死連結；console 0；手機無水平捲動；內容規則 grep = 0
- 回報區附：截圖清單、「主張 → 出處」、文案校稿採納清單、與規格的差異、給使用者的預覽指令
- 未 push、未改 GitHub 設定；本機沒有殘留的預覽伺服器

---

## 回報區

### 結果摘要

DONE。三個新頁（`/features`、`/faq`、`/contribute`）完成並加進 nav / sidebar；首頁與 `/control-tower` 的 `TODO(W2b)` 換成真連結，`FeatureGrid` 六格連到 `/features` 的固定英文錨點；頁尾加上致謝上游；手機 checklist 示意對齊修好（桌面外觀不變）；設計語言檔補上「你 = 藍」（`--bat-you`）。

- 產品 commit：`5ddef4dc`（`feat(site): /features, /faq, /contribute pages, footer credits and nav; fix mobile checklist alignment (T0635)`）
- 未 push、未改 GitHub 設定、未觸發 workflow；`gh` 未使用。

### 落點檢查

- PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` ✅；C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 ✅；C-3：前 5 個可測項目最近祖先都存在（informational）；C-2：無 `branch` 欄位。
- 非隔離工單（`CT_HOME` 未設）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- `frontend-design:frontend-design` 開工即載入；`bmad-editorial-review-prose` 用於校稿；`vitepress-book` 未另外載入（nav 下拉與 footer 都是 VitePress 預設主題的既有設定，沿用既有 `config.mts` 寫法）。

### 變更檔案

| 檔案 | 變更 |
|---|---|
| `site/features.md`（新） | 11 節：工作區管理 `#workspaces`、AI Agent 整合 `#agents`（含 `#usage-limit`）、指令自動完成 `#autocomplete`、狀態列 `#status-line`、檔案瀏覽器與 Git 檢視 `#files-git`、Snippet 與語音輸入 `#snippets-voice`（含 `#voice`）、遠端開發 `#remote-dev`、遠端存取 `#remote-access`、Supervisor 模式 `#supervisor`、其他功能 `#more`（含鍵盤快速鍵表）、和 Control Tower 一起用時 `#control-tower`；每節一句摘要（`.ct-lead`）+ 重點清單 + `<!-- TODO(W3): 截圖 -->`；`/remote/` 以 `<!-- TODO(W2c) -->` 留位、不連結 |
| `site/faq.md`（新） | 7 題，分 5 組（安裝與平台、使用中、Claude Code、遠端開發、Control Tower），每題有固定錨點 |
| `site/contribute.md`（新） | 回報問題（Issues、附什麼、上傳前檢查）與「歡迎協助測試：Codex 使用者」三步（MCP 確認 → 如果你在用 Control Tower → 回報） |
| `site/index.md` | 「不用 Control Tower」段的 TODO 換成「看全部功能」連結（沿用 `.home-more`） |
| `site/control-tower.md` | FAQ「沒有 Control Tower，能用 BAT 嗎？」的 TODO 換成連到 `/features` |
| `site/.vitepress/config.mts` | nav 加「功能」，「版本對照 / 更版紀錄 / 常見問題 / 回報與協助測試」收進「參考」下拉；sidebar 開始使用加「功能」、參考加「常見問題」「回報與協助測試」；footer 加 `copyright` 致謝上游；`/remote/` 的 TODO 改標 `TODO(W2c)`，`/cases` 維持 `TODO(W2d)` |
| `site/.vitepress/theme/components/FeatureGrid.vue` | `Feature.link`（可選）；standalone 六格標題連到 `/features#…`（`withBase`）；其他兩組不變 |
| `site/.vitepress/theme/components/StoryIllo.vue` | `checklist` 由 `<pre>` + 空白補齊改成「符號 / 項目 / 結果」三欄的列 |
| `site/.vitepress/theme/custom.css` | `.si-check-row` 三欄 grid（桌面 `2ch 23ch auto`，等同原本的等寬對齊；≤ 639 px 結果換到下一行、續行對齊項目）；`.feature-title a` 連結樣式（細底線，滑過 / 聚焦換成 `--bat-signal-text`） |
| `docs/design/site-design-language.md` | 只新增 § 4.1「角色色：你 = 藍（`--bat-you`）」：值、對比、角色三色、用在哪、不得用在哪、出處（`custom.css`、T0634） |

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `site/` 內 `npm ci` | PASS | 完成（只有 `npm audit` 提示）；當時本機沒有其他 vitepress 程序鎖住 esbuild |
| `npm run build` | PASS | `build complete`，0 錯誤；VitePress 預設檢查死連結，build 成功 = 0 死連結 |
| console | PASS = 0 | 三個新頁 × 桌面 / 手機 × 淺 / 深色、首頁、`/control-tower`、`/install` 共 31 次載入，error / warning / pageerror 皆 0 |
| 手機無整頁水平捲動 | PASS | 390 寬所有頁面 `scrollWidth = clientWidth = 390`；超出視窗的元素只有收起的側欄與 nav（VitePress off-canvas，正常）。FAQ 日誌路徑原本用表格，手機上在表格內被截斷，改成清單 |
| 內容規則 grep（`site/`，排除 `node_modules` / `dist` / `cache` / `.sonar`） | PASS = 0 | `T0\d{3}`、`D1\d{2}`、`BUG-\d+`、`PLAN-\d+`、`_ct-workorders`、`CLAUDE.md` = 0；三個新頁 + `config.mts` + `theme/**` 的 CT skill 名稱、`FIELDGUIDE`、`DESIGN.md`、`skill`、CT 版本號、星號指令、CT 資料路徑、`batcap`、`BAT_REMOTE_TOKEN`、使用者路徑 = 0；唯一命中是 `custom.css` 既有註解裡的頁面網址 `/control-tower`（不是 skill 名稱，T0634 已記錄）。`screenshot-` = 0；`TODO(W2b)` = 0 |
| checklist 手機對齊 | PASS | 修正前：`214 passed`、`0 errors`、`src/cart.ts` 折到行首（符號底下）；修正後：結果與續行都對齊項目欄；桌面 1440 修正前後外觀相同 |
| 預覽伺服器 | 已結束 | 沒有啟動 `vitepress dev` / `preview`。截圖腳本（scratchpad 的 `shoot.mjs`）在同一個 node 程序內起臨時 HTTP 伺服器（隨機埠、只綁 127.0.0.1）服務 `dist`，用系統 Chrome（playwright-core `channel: 'chrome'`）截圖，結束時關閉伺服器與瀏覽器；事後檢查沒有 vitepress / esbuild / 截圖腳本的殘留程序 |

### 截圖（`e2e-results/site-v2b2/`，不入版控）

- 三個新頁 × 桌面 1440 / 手機 390 × 淺 / 深色（整頁）：`features-*-full.png`、`faq-*-full.png`、`contribute-*-full.png`（12 張）
- checklist 修正前 / 後：`checklist-before-home-mobile-390-{dark,light}.png`、`checklist-before-ct-mobile-390-light.png`、`checklist-before-home-desktop-1440-dark.png`，以及同名的 `checklist-after-*`（各 4 張）
- 首頁功能格（連結樣式）：`home-features-grid-{desktop-1440,mobile-390}-{light,dark}.png`；頁尾：`home-footer-desktop-1440-dark.png`
- 細節：`faq-logs-mobile-390-light.png`（日誌路徑清單）、`features-shortcuts-mobile-390-dark.png`（快速鍵表）
- 回歸：`regress-{home,control-tower,install}-{desktop-1440,mobile-390}-dark.png`

### 主張 → 出處

| 主張（網站文案） | 出處 |
|---|---|
| 工作區標籤頁、拖放排序、分組、封存；每工作區獨立終端機 / 對話 / 環境變數；跨重啟保存；獨立視窗 | README「工作區管理」 |
| 工作區右鍵「工作區設定」覆寫預設 Agent 與啟動參數，沒設定沿用全域 | `src/locales/zh-TW.json` `settings.defaultAgentHint`；`docs/agent-guide/workspace-agent-launch.md` |
| 關掉獨立視窗後分頁回到原本視窗 | `docs/agent-guide/detached-workspace.md`（reattach / adopt） |
| Claude Code 面板（SDK、結構化事件、權限、續接）、CLI、Codex 沙箱 / YOLO、Gemini 沙箱、Copilot、自訂 CLI | README「AI Agent 整合」 |
| 內附 Claude Code；設定 > 進階 > Claude Runtime 切換，只影響新開的對話與終端機 | `docs/agent-guide/claude-agent-sdk-cli.md`（Runtime Selection）；`SettingsPanel.tsx`（進階分頁） |
| 終端貼上依剪貼簿內容處理 | README「其他功能」 |
| 用量限制自動繼續：預設關、設定 > 進階、只對 yolo 塔台 / Worker、Codex 延遲預設 2 分鐘 + 文字預設「繼續」、Claude 不送文字、使用者輸入取消、連續最多 2 次 | `docs/agent-guide/usage-limit-continue.md`；`zh-TW.json` `settings.usageLimit*` |
| 指令前綴 Claude `/`、Codex `$`；Agent 面板與 PromptBox；鍵盤選取 | README「指令自動完成」 |
| PromptBox 可換行、貼圖片、↑↓ 叫出歷史 | `zh-TW.json` `promptBox.hint` |
| 狀態列 13 項、顏色、L/C/R 對齊、分隔符號、範本字串、API 用量；位置 設定 > 外觀 | README「狀態列」；`zh-TW.json` `settings.statuslineHint`；`SettingsPanel.tsx`（外觀分頁） |
| 檔案瀏覽器、Git 檢視器、可點擊路徑與網址 | README「其他功能」 |
| Snippet：「程式碼片段」、純文字 / Markdown、搜尋、雙擊動作三選一、貼上後自動 Enter | `zh-TW.json` `snippets.*` |
| 語音：本機 Whisper、Tiny / Base / Small（推薦）/ Medium、zh / en / auto、轉繁體、GPU 自動 / 強制 CPU；設定 > 語音 | `src/components/voice/VoiceSettingsSection.tsx`；`src/types/voice.ts` |
| 麥克風權限三平台說明 | README「語音輸入 — 跨平台麥克風權限」 |
| 遠端開發：精靈（安裝套件 → 啟動 → 指紋 → 驗證）、套件不內建 + 下載快取 + 可匯入、路徑轉換、最多 8 個連線、遠端 AI 工具面板 | README「Remote dev support」；`docs/agent-guide/multi-remote-profiles.md` |
| 遠端存取：QR Code、Remote Profile、wss + 自簽憑證 + 指紋（TOFU）、預設只接受本機、Tailscale 偵測與綁定、啟動伺服器的安全提醒 | README「遠端存取」；`docs/agent-guide/remote-security.md`；`zh-TW.json` `settings.qrWarning` |
| Supervisor：縮圖右鍵 **Set as Supervisor**、👁、Worker 面板、送指令、適用場景 | README「Supervisor 模式」；`src/components/TerminalThumbnail.tsx` |
| 指揮塔面板（工單、看板、Sprint 總覽、狀態通知）、「執行」/「補救收尾」、前綴依預設 Agent | README「Control Tower 整合」；`zh-TW.json` `controlTower.*` |
| Worker / Tower 分頁標題、縮圖 ⚠️ / ? / ✓、回收、右鍵批次關閉 | README「Control Tower 整合」；`docs/agent-guide/worker-tab-recycle.md`、`tower-tab-title.md` |
| BAT MCP 唯讀工具、範圍依權杖、設定 > 進階 > BAT MCP 可關、變更後新開分頁才套用 | `docs/agent-guide/bat-mcp-shim.md`；`zh-TW.json` `settings.batMcpEnabledHint` |
| worktree 隔離派工與合併前狀態 | `docs/agent-guide/worktree-isolated-dispatch.md`、`worktree-status.md` |
| 其他功能（縮圖列、自動更新檢查、三語、深色主題）與鍵盤快速鍵表 | README「其他功能」「鍵盤快速鍵」 |
| FAQ macOS：只有 arm64 建置環境、x64 包裡是 arm64 元件、v0.6.0-pre.3 起、macOS 12 以上 | `docs/agent-guide/build-toolchain.md`；`site/install.md`；README「語音輸入 › macOS」 |
| FAQ 日誌：預設開、每次啟動一檔、保留 10 個、三平台資料目錄、設定 > 進階 > 除錯日誌 >「開啟日誌資料夾」 | README「設定」「除錯日誌」；`docs/agent-guide/logging.md`；`zh-TW.json` `settings.openLogsFolder` |
| FAQ 右鍵：滑鼠追蹤時不出選單、Shift + 右鍵一律開、Shift 拖曳選取（macOS Option） | `docs/agent-guide/terminal-context-menu.md` |
| FAQ Recovery：離開時「結束 Terminal Server」預設不勾、提示標題「偵測到上次的終端 session」、按鈕「恢復 session」/「重新開始」、回答前不另開 shell | `electron/main.ts`（quit dialog `checkboxChecked: false`）；`zh-TW.json` `quit.dialog.checkbox`；`src/components/RecoveryPrompt.tsx`；`docs/agent-guide/recovery-create-hold.md` |
| FAQ CLI 太舊：`claude_code_version_too_old`、面板附建議、升級 BAT 或切 System 並升級 | `docs/agent-guide/claude-agent-sdk-cli.md`；`zh-TW.json` `claude.claudeErrorHintCliTooOld*` |
| FAQ server bundle：`server-bundle-v<版號>` 下載與快取、`bat-server-<target>-v<版號>.tar.gz` + `.sha256`、「匯入本機 tarball…」、`BAT_SERVER_BUNDLE_BASE_URL` | `zh-TW.json`（精靈錯誤說明、`importServerBundle`）；CLAUDE.md「Server bundle baseline」節 |
| FAQ Control Tower 去哪取得 | 與 `/control-tower#faq` 同文（D159） |
| contribute：`bat_whoami` 的 `role`（`tower` / `worker` / `shell`）與 `agent` | `docs/agent-guide/helper-query-channels.md`（`terminal:whoami` 回傳欄位）；本 Worker 實際呼叫 `bat_whoami` 確認 |
| contribute：塔台要在一般分頁啟動 | README「BAT 提供的整合點」（每分頁權限） |
| contribute：Codex 0.163.0 以上才能判斷啟動與等人；舊版照常派工回報 | `docs/agent-guide/worker-launch-confirmation.md`、`blocked-state.md`；`/control-tower` FAQ |
| contribute 測試步驟 | `_local-rules.md`「更版重點」節「歡迎協助測試」 |

### 文案校稿（`bmad-editorial-review-prose`）

8 項全部採納：

1. features 開頭「見最後一節」→ 具名連結「和 Control Tower 一起用時」（連結文字太模糊）。
2. 用量限制開頭補上「和 Control Tower 一起用、以 yolo 模式執行的分頁」（單獨使用的讀者不認識 yolo）。
3. 用量限制刪掉重複的 yolo 說明，改為「其他分頁只顯示提示，不會自動動作」。
4. 指令自動完成「用方向鍵選取，Enter 確定」→「可以用鍵盤上下選取」（「Enter 確定」查無出處）。
5. PromptBox 在第一次出現時就定義。
6. 遠端存取「開啟後外部就能連進」補主詞：「產生 QR Code 會啟動伺服器……」。
7. contribute Worker 標題改寫成完整格式「Codex CLI · Worker · 工單編號」。
8. contribute「記下停在哪一步、畫面上的訊息」→「……，以及畫面上的訊息」。

不採納：無。

### 與規格 / 工單的差異

- **`/features` 分節**：工單列的 10 節都保留，另把 README「其他功能」裡的「檔案瀏覽器與 Git 檢視」「Snippet」拆成獨立節（Snippet 與「語音輸入」併成一節），讓首頁六格各有一個對應段落；「Control Tower 整合」節改名「和 Control Tower 一起用時」並放在最後（錨點 `#control-tower`），讓本頁先講 BAT 單獨使用。另加了鍵盤快速鍵表（README 原文）。
- **刻意不寫的 README 項目**：「`*` 前綴觸發星號指令（掃描 `ct-*` 等 Skill）」會出現 CT skill 名稱與星號指令（§ 8）；「Git Worktree 隔離（Agent 面板）」查證是除錯 UI（`WorkspaceView.tsx` 只在 `isDebugMode` 時提供），一般使用者看不到；「CtToast」「`ct-exec` / `ct-done` / `ct-sync`」改寫成 UI 實際字樣（「執行」「補救收尾」、狀態通知）。
- **Recovery 提示按鈕**：工單寫「保留 / 重新開始」，App 實際按鈕是「恢復 session」/「重新開始」，網站照 App 字樣。
- **nav**：nav 原本已有 6 項，再加 3 項太擠；改為「安裝 / 功能 / BAT × Control Tower / 參考▾」，「參考」下拉收「版本對照、更版紀錄、常見問題、回報與協助測試」，與 sidebar 分組一致。「版本對照」「更版紀錄」因此從頂層移進下拉（多一次點擊）。
- **頁尾**：VitePress 預設主題只在沒有側欄的頁面（首頁）顯示 footer，文件頁不會出現致謝；這是主題既有行為，本單未改。致謝連到兩個上游 repo 與本 repo README 的「致謝」段。
- **BAT 版本怎麼看**：App 的「關於」沒有版號（只有更新通知會顯示目前版本），contribute 寫「安裝檔檔名上的版號」。
- **frontend-design**：本單沒有新的視覺方向，沿用 W2a 定案的 tokens、字體與元件（文件頁沿用 `.ct-intro` / `.ct-lead` / `.ct-note`）。只新增兩處樣式：checklist 三欄格線、首頁功能格的標題連結（細底線、不加箭頭）。

### 已知限制

- 三個新頁都是文字頁，截圖位置以 `<!-- TODO(W3): 截圖 -->` 留著（W3）。
- `/features` 的「遠端開發」只有概述，`/remote/` 細節頁留 `<!-- TODO(W2c) -->`。
- 快速鍵表照 README 寫 `Ctrl`；macOS 上的對應鍵本單未查證，所以沒寫。

### 給使用者的預覽指令

```bash
cd site
npm run build && npx vitepress preview --port 4188
```

開 `http://localhost:4188/better-agent-terminal/features`（另有 `/faq`、`/contribute`，以及首頁的「不用 Control Tower，BAT 也好用」）。看完按 Ctrl+C 結束。

### 互動紀錄

無（yolo，未向塔台提問）。
