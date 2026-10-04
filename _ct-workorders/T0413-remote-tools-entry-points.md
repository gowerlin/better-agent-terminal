---
schema_version: 1
schema_kind: workorder
id: T0413
title: "PLAN-037 F：RemoteToolsPanel 入口——設定精靈完成區塊 + 遠端 profile 的 ProfileCard.expandedExtras"
type: impl
status: PENDING
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: S
created_at: "2026-10-05T03:23:47+08:00"
target_version: next
depends_on:
  - T0410
  - T0411
related:
  - "T0407 回報區 §5 UI 整合；T0410 回報區「元件 props 介面 / 接線建議」；T0411 回報區「preload API」"
  - "D133；T0412（同批平行，提供 requestInstall）"
affects_files:
  - src/components/setup-wizard/SetupWizardShell.tsx
  - src/components/ProfilePanel.tsx
  - src/components/profiles/
  - src/components/__tests__/
  - src/components/setup-wizard/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **安裝 API 契約（T0412 實作中）**：`window.electronAPI.remoteTools.requestInstall({ profileId, toolId: plan.toolId, kind: plan.kind })`。本單以 optional chaining 呼叫；API 不存在時（T0412 未合入）**不傳 `onInstall`**，面板只顯示偵測結果。不得自行實作 requestInstall、不得改 `electron/`、`src/types/electron.d.ts`。"
  - "🔴 `SetupWizardShell.tsx` 只動**完成區塊**（約 :643 起），不改 `wizard-runner.ts` 與步驟定義（避開 PLAN-035 P2-c）。"
  - "🔴 T0412 平行中：不得碰 `src/App.tsx`、`src/components/WorkspaceView.tsx`、`src/components/remote-tools/`、`src/locales/`（若需新文案，在回報區列出，由塔台另行處理）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0413 — remote-tools 入口（PLAN-037 F）

## 元資料
- **工單編號**：T0413
- **任務名稱**：精靈完成區塊 + ProfileCard 入口
- **狀態**：PENDING
- **建立時間**：2026-10-05 03:23 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

T0410 的 `RemoteToolsPanel`（`src/components/remote-tools/RemoteToolsPanel.tsx`）已完成但沒放進任何畫面；T0411 提供 `window.electronAPI.remoteTools.detect(profileId)`（本機短連線，永不 reject）。使用者裁決入口為「精靈最後一步＋設定頁」（D131）；T0407 §5 建議放在精靈**完成區塊**（不新增 WizardStep）與 `ProfileCard` 的 `expandedExtras`。

## 範圍

1. **精靈完成區塊**（`SetupWizardShell.tsx`，WSL / SSH / Docker 共用）：精靈成功建立遠端 profile 後，在完成畫面顯示 `<RemoteToolsPanel host="wizard" detect={...} onInstall={...?} />`
   - `detect` 用 `useCallback` 固定 identity：`() => window.electronAPI.remoteTools.detect(profileId)`
   - 取得新建 profile 的 id 的方式由 Worker 依精靈現有資料流決定（回報區說明）；拿不到 id 時不顯示面板
2. **設定頁**：遠端 profile（`profile.type === 'remote'`）展開時，在 `expandedExtras` 顯示 `<RemoteToolsPanel host="profile" ... />`；需與既有 legacy targetOS 提示（`ProfilePanel.tsx:559`）並存
   - 展開才偵測（不要在列表載入時對所有 profile 連線）
3. `onInstall`：`requestInstall` 存在時 → `requestInstall({ profileId, toolId: plan.toolId, kind: plan.kind })`，回 `{ ok: false }` 時顯示錯誤；不存在時不傳
4. `onLogin`：v1 不傳（只顯示登入狀態；登入引導在遠端視窗的 Claude 面板，T0402）

## 驗收條件

- [ ] 元件測試：精靈完成區塊在成功時顯示面板、`detect` 以正確 profileId 呼叫；ProfileCard 只對 remote profile 顯示、展開才偵測；與 legacy targetOS 提示並存
- [ ] `requestInstall` 存在 / 不存在兩種情況的測試
- [ ] `npm run test:unit` 全綠（基線 1514）；`npx tsc --noEmit` ≤ 40；**不跑 `npx vite build`**（T0412 平行跑 build + e2e；由塔台複驗時跑）
- [ ] 回報區附使用者實機步驟（精靈完成畫面、設定頁展開遠端 profile）

## Sub-session 執行指示
1. 讀本工單 + T0410 / T0411 回報區 + `SetupWizardShell.tsx` 完成區塊 + `ProfilePanel.tsx` / `profiles/ProfileCard.tsx`
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

### 使用者實機步驟

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題

### 回報時間
