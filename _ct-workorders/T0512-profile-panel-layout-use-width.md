---
schema_version: 1
schema_kind: workorder
id: T0512
title: "Profile（配置）對話框版面：remote 卡片展開內容不留空白左欄、善用寬度，對話框加寬（BUG-122）"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-14T02:41:26+0800"
target_version: "0.6.0-pre.6"
related:
  - BUG-122
  - "T0413（PLAN-037 F，RemoteToolsEntry 掛入 ProfilePanel）"
  - "使用者截圖 D:\\Downloads\\2026-10-14_023824.jpg"
affects_files:
  - src/components/ProfilePanel.tsx
  - src/components/profiles/
  - src/components/remote-tools/
  - src/styles/
  - src/components/__tests__/
  - e2e/
  - _ct-workorders/T0512-profile-panel-layout-use-width.md
  - _ct-workorders/BUG-122-profile-panel-remote-card-empty-left-column.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **與 T0511 並行**：T0511 正在改 `src/components/setup-wizard/**`、`src/locales/**`、`electron/remote/ssh-*`。本單**不得修改**這些路徑；`git commit` 只 stage 本單檔案（`git commit --only` 或精準 `git add`），不得把 T0511 的 WIP 帶進來。若需要新增 i18n 字串，改用既有 key；真的必要時回報區列出，由塔台排在 T0511 之後補。"
  - "🔴 `RemoteToolsPanel` 也用於 setup wizard 完成頁（`host='wizard'`）：本單改動不得改變 wizard 內的呈現；若改的是共用元件，以 `host` 區分或只改 profile 端的容器樣式，並以截圖證明 wizard 不變。"
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）；截圖 / e2e 一律隔離實例。不消耗 Claude token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。"
---

# T0512 — Profile 對話框善用寬度（BUG-122）

## 背景

使用者回報（截圖 `D:\Downloads\2026-10-14_023824.jpg`，請先看圖）：「配置」對話框的 remote 卡片展開後，「遠端 AI 工具」面板只佔右半，左側一整欄空白。使用者原話：「左邊空白無用？請善用空間或整個 Dialog Width x2」。

## 任務

1. 找出左欄空白的根因（卡片 grid / flex 欄位配置、`expandedExtras` 被放進第二欄等），回報區寫明
2. 修版面，讓展開內容橫跨卡片全寬，不留空白欄
3. 對話框寬度：在合理範圍內加寬（使用者提議 ×2，視窗寬度不足時要能縮回，不得出現水平捲軸）。加寬後若「遠端 AI 工具」的工具清單適合排成多欄（例如必要 / 建議兩欄，或工具卡片 grid），可一併做；判斷依據與取捨寫在回報區
4. 本機卡片、遠端多張卡片、窄視窗（例如 800 px 寬）三種情況都不能變差

## 驗證

- 單元測試：若既有 `src/components/__tests__/remote-tools-entry-points.test.tsx` 等有涉及結構，維持通過；版面的關鍵 class / 結構可加斷言
- **截圖證據**：隔離實例（source build，`npx vite build`）以 Playwright 開「配置」對話框，造一個 remote profile 並展開（`RemoteToolsEntry` 的偵測結果可 mock / 以 IPC stub 提供，不需真遠端），修改前 / 後各截一張（寬視窗 + 800 px 窄視窗）；另截 setup wizard 完成頁證明不變。截圖路徑列在回報區
- `npx vite build` exit 0、`npm run typecheck` = 0、相關 unit test 通過

## 驗收條件

- [ ] 左欄空白消失，展開內容用滿寬度
- [ ] 對話框加寬且窄視窗不出現水平捲軸
- [ ] wizard 完成頁呈現不變（截圖）
- [ ] 未改 T0511 範圍檔案；commit 只含本單檔案
- [ ] BUG-122：`status: FIXED`、`fixed_at`、body 狀態列同步

## Sub-session 執行指示

1. 讀本工單、BUG-122、截圖
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫
