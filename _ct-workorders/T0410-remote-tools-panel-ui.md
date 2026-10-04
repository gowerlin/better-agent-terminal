---
schema_version: 1
schema_kind: workorder
id: T0410
title: "PLAN-037 D：RemoteToolsPanel + InstallConfirmDialog + i18n（API 以注入方式取得，先不接 preload）"
type: impl
status: PENDING
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: M
created_at: "2026-10-05T03:10:44+08:00"
target_version: next
depends_on:
  - T0408
  - T0409
related:
  - "T0407 回報區 §5 UI 整合、§6 確認框內容；T0408 / T0409 回報區「給後續工單的備註」"
  - "D133 波次；T0411（同批平行，提供 preload API）"
affects_files:
  - src/components/remote-tools/
  - src/components/__tests__/
  - src/styles/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/locales/__tests__/i18n-completeness.test.ts
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 T0411 平行中：不得碰 `electron/`、`src/types/electron.d.ts`、`electron/preload.ts`。面板以 props 注入 `detect()` 與 `onInstall(plan)` 等回呼，**不直接呼叫 `window.electronAPI`**；接上 preload 是 T0412 / T0413 的事。"
  - "🔴 不得修改 `src/types/remote-tools.ts`、`src/lib/remote-tools/*`（T0408 / T0409 擁有）；需要調整時在回報區提出。"
  - "🔴 不得把 report 的 `version` / `path` 等字串插進任何指令；指令一律來自 `buildInstallPlan()`。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0410 — RemoteToolsPanel + 確認框（PLAN-037 D）

## 元資料
- **工單編號**：T0410
- **任務名稱**：remote-tools 面板 UI
- **狀態**：PENDING
- **建立時間**：2026-10-05 03:10 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

T0408（型別 / probe / parse）與 T0409（`buildInstallPlan` / `buildUpdatePlan` / sentinel）已完成。本單做純 UI，之後由 T0413 放進精靈完成區塊與 `ProfileCard.expandedExtras`、由 T0412 接上實際安裝執行。**規格以 T0407 §5 / §6 為準。**

## 範圍

1. `src/components/remote-tools/RemoteToolsPanel.tsx`
   - props（建議）：`{ host: 'wizard' | 'profile' | 'remote-window', detect: () => Promise<RemoteToolsDetectResult>, onInstall?: (plan: InstallPlan) => void, onLogin?: (toolId) => void }`
   - 依 `remoteToolTier()` 分組（必要 / 建議 / 可選；rg 在 musl 上升為必要）；每列：狀態、路徑、版本、登入狀態、server PATH 可見性
   - 操作：「重新檢查」、「安裝」（由 `buildInstallPlan(toolId, env)` 產生；unsupported 時顯示原因與 docs 連結）、claude「更新」（`buildUpdatePlan`，`too-old` 時強調）
   - 狀態特別處理：`interop-only`（說明是 Windows 版遮蔽，安裝 Linux 版）、`not-on-path`（提示開新終端分頁）、`curl` missing 時停用 install.sh 類（claude / codex / uv）並提示
   - 登入：只顯示狀態；`onLogin` 存在時給按鈕（實際引導用 T0402 的流程，由上層接）。macOS 上 `credentialFilePresent: false` 不代表未登入，以 `login` 為準
   - 錯誤狀態：`host-platform`、`spawn-failed`、`timeout`、`no-markers`、舊 server（T0411 會提供可辨識的 errorCode；先以 `unsupportedRemoteChannel()` 的既有判斷處理）
2. `src/components/remote-tools/InstallConfirmDialog.tsx`：顯示完整指令（可複製）、官方文件 URL、腳本 URL（「檢視腳本內容」連結）、是否需 sudo、安裝位置、完整性說明、`unofficial` 警示、prerequisites；按「確認」才呼叫 `onInstall(plan)`。URL 以外部瀏覽器開啟的方式沿用 repo 既有作法（若需要 electronAPI，改以 prop 注入）
3. i18n：`remoteTools.*`（三語），涵蓋 T0409 的 `INTEGRITY_KEYS` / `LOCATION_KEYS` / `NOTE_KEYS`、`remoteTools.unsupported.<reason>`（`UNSUPPORTED_REASONS`）、狀態 / 分級 / 工具名稱 / 確認框；擴充 `i18n-completeness.test.ts` 檢查 `remoteTools.*` 與上述 key 集合一一對應
4. 樣式：沿用既有 CSS 變數

## 驗收條件

- [ ] 元件測試（以 fixture report：T0408 的 WSL 實測、Alpine root、macOS、全未裝、舊 server 錯誤）：分組、各狀態文案、curl missing 停用、interop 說明、unsupported 原因
- [ ] 確認框測試：顯示的指令與 `buildInstallPlan` 完全相同；取消不呼叫 `onInstall`；unofficial 警示
- [ ] i18n completeness 涵蓋新 key
- [ ] `npm run test:unit` 全綠（基線 1442）；`npx tsc --noEmit` ≤ 40；**不跑 `npx vite build`**（T0411 平行跑 build + e2e，同時 build 會互相覆寫輸出；由塔台複驗時跑）
- [ ] 回報區附元件 props 介面（給 T0412 / T0413）

## Sub-session 執行指示
1. 讀本工單 + T0407 §5 / §6 + T0408 / T0409 回報區 + `src/types/remote-tools.ts`、`src/lib/remote-tools/*`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 元件 props 介面

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
