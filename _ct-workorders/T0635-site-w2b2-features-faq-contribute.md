---
schema_version: 1
schema_kind: workorder
id: T0635
title: "PLAN-049 W2b-2：`/features`、`/faq`、`/contribute`、頁尾致謝與 nav；修手機 checklist 示意對齊；設計語言補「你 = 藍」色票"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T14:27:20+0800"
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

（Worker 填寫）
