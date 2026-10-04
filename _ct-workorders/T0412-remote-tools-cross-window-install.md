---
schema_version: 1
schema_kind: workorder
id: T0412
title: "PLAN-037 E：跨視窗安裝執行——requestInstall 佇列（main）+ 遠端 profile 視窗取件、建終端分頁、打入指令 + 完成標記、完成後重新偵測與 toast"
type: impl
status: PENDING
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: L
created_at: "2026-10-05T03:23:47+08:00"
target_version: next
depends_on:
  - T0409
  - T0410
  - T0411
related:
  - "T0407 回報區 §4 執行模型（安裝段）；T0409 / T0410 / T0411 回報區「給後續工單的備註」"
  - "D133；T0413（同批平行，入口；以本單定義的 API 呼叫）"
affects_files:
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/types/remote-tools.ts
  - src/hooks/useRemoteToolInstall.ts
  - src/lib/remote-tools/
  - src/App.tsx
  - src/components/WorkspaceView.tsx
  - src/components/remote-tools/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - src/hooks/__tests__/
  - src/lib/remote-tools/__tests__/
  - src/components/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **API 契約（T0413 平行依此實作，不得改名）**：`window.electronAPI.remoteTools.requestInstall({ profileId, toolId, kind })` → `Promise<{ ok: true } | { ok: false, error: string }>`，`kind: 'install' | 'update'`。請求只帶 **toolId + kind**，不帶指令字串；遠端視窗以自己的 `detectHere()` + `buildInstallPlan` / `buildUpdatePlan` 重建指令。"
  - "🔴 T0413 平行中：不得碰 `src/components/setup-wizard/`、`src/components/ProfilePanel.tsx`、`src/components/profiles/`。"
  - "🔴 **不得在任何機器上實際執行安裝**（實機安裝是 T0414）；測試以 mock PTY / fake output 驗證。不得部署到 WSL。"
  - "🔴 `profileId` / `toolId` / `kind` 在 main 端驗證（profileId 比照 `remote:detect-arch`；toolId ∈ `REMOTE_TOOL_IDS`；kind 為二值）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0412 — 跨視窗安裝執行（PLAN-037 E）

## 元資料
- **工單編號**：T0412
- **任務名稱**：remote-tools 安裝執行
- **狀態**：PENDING
- **建立時間**：2026-10-05 03:23 (UTC+8)
- **intervention_type**：fire-and-forget
- **預估規模**：L；**降級策略**：先完成「遠端視窗內直接安裝」（範圍 2）並 commit，跨視窗佇列（範圍 1）未完成時回報 PARTIAL

## 背景

已完成：T0409 食譜與完成標記（`wrapWithSentinel` / `createSentinelMatcher` / `generateNonce`）、T0410 面板（`onInstall(plan)` 回呼）、T0411 偵測（`remoteTools.detect(profileId)` 本機短連線、`remoteTools.detectHere()` 遠端視窗內；WSL 實機 smoke S10 PASS）。使用者裁決（T0407 Q2）：確認框之後**自動執行**，安裝分頁開在**遠端 profile 視窗**裡（看得到、可輸入 sudo 密碼、可 Ctrl+C）。

## 範圍

1. **跨視窗佇列（本機視窗 → 遠端視窗）**
   - main：local-only `remote-tools:request-install`（即 preload `requestInstall`）驗證參數 → 暫存 `pendingInstalls: Map<profileId, Request>`（同 profile 新請求覆蓋舊的）→ 沿用 `app:open-new-instance`（`main.ts:3330`）邏輯開啟或聚焦該 profile 的視窗
   - local-only `remote-tools:take-pending-install`：只有**屬於該 profile 的遠端視窗**能取走（以 sender 視窗綁定的 profile 判斷），取走即刪除
2. **遠端視窗執行**（`src/hooks/useRemoteToolInstall.ts` + 掛載點）
   - 遠端連線完成後取件；或遠端視窗內的面板（host `remote-window`）直接觸發
   - `detectHere()` → 依 kind 重建 plan；unsupported ⇒ toast 原因並結束
   - 確保有 workspace（沒有就在遠端 `$HOME` 建「BAT Tools」——名稱與行為在回報區說明）→ 加終端分頁（**不帶 agentPreset**：`claude-cli*` 會注入 `DISABLE_UPDATES`，會擋 `claude install`）→ `createPtyThenLaunch`，`created === true` 才寫入 `wrapWithSentinel(plan.command, nonce) + '\r'`
   - `createSentinelMatcher(nonce)` 掛在該 PTY 的 output；exit 0 ⇒ 重新偵測並 toast 結果（以偵測結果為準：例如工具仍 missing 就顯示「未偵測到」，處理 T0409 指出的 `curl | sh` 失敗仍回 0 的情況）；非 0 ⇒ 保留分頁、toast「安裝失敗，請看終端輸出」
   - 不論成功失敗都提示「已開啟的其他終端分頁需重開才看得到 `~/.local/bin`」
   - 安裝分頁的 shell 必須是 POSIX 系（T0409 備註）；遠端 shell 為 fish 等時改用 `/bin/sh` 或提示
3. 遠端視窗內面板的 `onInstall` 也走範圍 2（不經 main）
4. i18n：toast / 提示文案（三語）

## 驗收條件

- [ ] main 單元測試：參數驗證、佇列覆蓋、只有對應 profile 的視窗能取件、取件後刪除
- [ ] hook 單元測試（mock PTY）：plan 重建、unsupported、`created:false` 不寫入、寫入內容 = sentinel 包裝 + `\r`、matcher 0 / 非 0 分支、成功後重新偵測但工具仍 missing ⇒ 顯示未偵測到
- [ ] 不帶 agentPreset 的斷言
- [ ] `npm run test:unit` 全綠（基線 1514）；`npx tsc --noEmit` ≤ 40；`npx vite build` exit 0；`npm run test:e2e` 0 failed
- [ ] 回報區附 T0414 實機步驟

## Sub-session 執行指示
1. 讀本工單 + T0407 §4 + T0409 / T0410 / T0411 回報區 + `src/lib/pty-replay.ts`（`createPtyThenLaunch`）+ `src/lib/claude-login-guide.ts`（T0402「開終端分頁並打入指令」範本）+ `main.ts:3330`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先範圍 2 → commit → 範圍 1 → 驗收
4. 填回報區；完成寫 **`DONE`**（只完成範圍 2 寫 `PARTIAL`）
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### T0414 實機步驟

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
