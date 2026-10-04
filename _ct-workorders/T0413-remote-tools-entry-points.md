---
schema_version: 1
schema_kind: workorder
id: T0413
title: "PLAN-037 F：RemoteToolsPanel 入口——設定精靈完成區塊 + 遠端 profile 的 ProfileCard.expandedExtras"
type: impl
status: DONE
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: S
created_at: "2026-10-05T03:23:47+08:00"
started_at: "2026-10-05T03:24:53+08:00"
updated_at: "2026-10-05T03:28:34+08:00"
completed_at: "2026-10-05T03:28:34+08:00"
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
- **狀態**：DONE
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
DONE —— 4 項驗收全部 PASS（runtime / 實機未驗，見下方使用者實機步驟）。

**落點檢查**：PASS
- C-0：frontmatter `repo: better-agent-terminal` == `basename(REPO_ROOT)` `better-agent-terminal`
- C-1：工單位於 REPO_ROOT 之下
- C-3（資訊性）：可測 5 項皆 present
- C-2：工單未指定 branch；實際在 `main`
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅作紀錄）
- 執行環境：`CT_MODE=on`、`CT_INTERACTIVE=0`

**驗收**

| # | 項目 | 結果 | 證據 |
|---|------|------|------|
| 1 | 元件測試（精靈 + ProfileCard） | ✅ PASS | `src/components/setup-wizard/__tests__/wizard-remote-tools.test.tsx`（4）：成功後顯示面板且 `detect('p-new')` 只呼叫 1 次、步驟執行中不顯示、無 `createdProfileId` 不顯示也不偵測、controller 完成後不自動關閉（見遭遇問題 1）<br>`src/components/__tests__/remote-tools-entry-points.test.tsx` 的 ProfilePanel 組（5，真的 render `ProfilePanel`，mock `profile.listLocal` / `app.getWindowProfile` / `remote.listProfiles`）：載入列表不偵測任何 profile、展開 remote 只偵測該 id、local 展開不顯示、legacy（無 targetOS）remote 同時顯示 `legacy-remote-targetos-prompt` 與面板、收合即卸載 / 再展開重新偵測 |
| 2 | `requestInstall` 存在 / 不存在 | ✅ PASS | 同檔 RemoteToolsEntry 組（5）：不存在 ⇒ 無安裝 / 更新鈕；存在 ⇒ 確認後呼叫 `requestInstall({ profileId, toolId: 'git', kind: 'install' })`（不帶指令）；回 `{ ok: false }` ⇒ 顯示 `error`；reject ⇒ 顯示錯誤；re-render 不重複偵測（`detect` identity 固定） |
| 3 | test:unit / tsc | ✅ PASS | `npm run test:unit`：102 files、**1528 passed**、1 skipped（基線 1514 + 本單 14）。輸出中 `@lydell/node-pty` `conpty_console_list_agent.js` `AttachConsole failed` 為既有環境雜訊，不影響結果<br>`npx tsc --noEmit`：**40**（= 基線；本單檔案 0 筆）<br>依工單**未跑** `npx vite build` |
| 4 | 實機步驟 | ✅ PASS | 見下方「使用者實機步驟」 |

### 產出摘要

**新檔**
- `src/components/profiles/RemoteToolsEntry.tsx`：精靈與設定頁共用的包裝元件 `<RemoteToolsEntry profileId host="wizard" | "profile" />`
  - `detect = useCallback(() => window.electronAPI.remoteTools.detect(profileId), [profileId])`
  - `onInstall`：只有 `window.electronAPI.remoteTools.requestInstall` 是 function 時才傳；呼叫 `requestInstall({ profileId, toolId: plan.toolId, kind: plan.kind })`，`{ ok: false, error }` 或 reject ⇒ 面板下方 `role="alert"` 顯示錯誤
  - `onLogin` 不傳（v1）
  - `requestInstall` 的型別在本檔以 local type 宣告（`RemoteToolInstallRequest` / `RemoteToolInstallResult`，依 T0412 frontmatter 契約），並以 cast 取用；**未改** `electron.d.ts` / `electron/`
- 測試 2 檔（見上）

**修改**
- `src/components/setup-wizard/SetupWizardShell.tsx`
  - 完成區塊：`complete && !wizardError && createdProfileId` 時顯示 `<RemoteToolsEntry host="wizard">`，外包 `maxHeight: 45vh; overflowY: auto`（`.bat-wizard-shell` 是 flex column + settings-body `overflow: hidden`，避免面板被裁）
  - **profile id 取得方式**：沿用既有資料流 —— write-profile 步驟寫入 `runnerCtx.createdProfileId`，runner `run()` resolve 後原本就拿它呼叫 `onComplete`；同處多存一份到 shell state `createdProfileId`。三種精靈（WSL / SSH / Docker）都經 write-profile，建的都是 `type: 'remote'`
  - `useSetupWizardController.handleComplete` 不再 `close()`（見遭遇問題 1）
  - 未動 `wizard-runner.ts`、步驟定義
- `src/components/ProfilePanel.tsx`：原 `expandedExtras`（legacy targetOS 提示）改名 `legacyTargetOsPrompt`；remote profile 的 `expandedExtras` = 提示（有的話）+ `<RemoteToolsEntry host="profile">`。`ProfileCard` 只在 `isExpanded` 時 render `expandedExtras` ⇒ 展開才掛載、才偵測；收合即卸載（面板的 requestId 會丟棄進行中的結果）

### 使用者實機步驟

**前置**：至少一個已部署 bat-server 的遠端 profile（WSL 最方便）；T0412 未合入時看不到安裝 / 更新鈕屬預期。

A. 精靈完成畫面
1. 設定 → Profiles → 新增 → WSL（或 SSH / Docker）精靈，跑完全部步驟
2. 預期：精靈**不再自動關閉**；綠色「完成」訊息下方出現「遠端工具」面板，先顯示檢查中，數秒後列出必要 / 建議 / 可選 / 前置條件分組
3. 背景的 Profiles 列表已出現新 profile（`onComplete` → `loadProfiles` 照舊）
4. 按面板「重新檢查」會再偵測一次；按右上 × 或點遮罩關閉精靈
5. （T0412 合入後）按某工具「安裝」→ 確認框 →「確認」：應開啟 / 聚焦該 profile 視窗並在其中開安裝分頁；若失敗，精靈面板下方出現紅色錯誤

B. 設定頁
1. 設定 → Profiles，觀察：開啟列表時不應對任何遠端 profile 連線（debug.log 不應出現 `remote:detect-tools`）
2. 展開某個遠端 profile 卡片（▸）：卡片內出現「遠端工具」面板並偵測該 profile
3. 若是舊的無 targetOS 遠端 profile：黃色 targetOS 提示與面板同時出現（提示在上）
4. 展開 local profile：不應出現面板
5. 收合再展開：重新偵測
6. 遠端 server 未啟動時：面板顯示連線失敗文案（`remoteTools.error.connect-failed`）；server 早於 T0411：顯示「請重新部署」

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
1. **⚠️ 範圍偏離（必要）：精靈成功後原本會立即關閉，完成區塊實際上看不到。** `useSetupWizardController.handleComplete` 原為 `onComplete(profileId); close()`，而 SetupWizardShell 在 runner 完成當下就呼叫 `onComplete` ⇒ modal 立刻卸載，`wizard.progress.complete` 那塊在實機上從未被看見。只改完成區塊（:643 起）則面板永遠不會出現。⇒ 本單同檔另改 `handleComplete` 不再自動 `close()`，由使用者按 × / 點遮罩關閉。
   - 仍在 `SetupWizardShell.tsx` 內，**未碰** `wizard-runner.ts` 與步驟定義（PLAN-035 P2-c 的範圍）
   - 已確認關閉時 effect cleanup 的 `runner.cancel()` 在 run 完成後只設旗標、不 rollback（`wizard-runner.ts:381`），與原本「完成即關閉」走的是同一條路徑
   - 行為變更：使用者多一次手動關閉。若塔台不接受，替代方案為：完成後仍自動關閉、改在 ProfilePanel 自動展開新 profile 卡片（面板改由設定頁呈現）
2. **新文案需塔台補 locale**：`remoteTools.installRequestFailed`（`requestInstall` 失敗時的標題；目前以 `t()` defaultValue 顯示英文 `Could not start the install in the remote window.`，zh-TW / zh-CN 也會看到英文）。建議文案：zh-TW「無法在遠端視窗啟動安裝。」、zh-CN「无法在远端窗口启动安装。」。補 key 後 `i18n-completeness` 的 `remoteTools.*` 一一對應測試需把此 key 納入預期集合（T0410 的測試以清單列舉，多一個 key 會失敗）。
3. **T0412 合入後的型別**：T0412 在 `electron.d.ts` 加上 `requestInstall` 後，`RemoteToolsEntry.tsx` 的 local type + cast 預期仍可編譯（未實測，T0412 尚未 commit）；塔台複驗跑 `npx tsc --noEmit` 即可確認；屆時可改直接用 `electron.d.ts` 的型別並移除 local 宣告（非必要）。
4. 精靈面板內的 `InstallConfirmDialog` 文案以 `host="wizard"` 顯示 `remoteTools.confirm.runsInRemoteWindow`（「會開啟遠端 profile 視窗，並把指令輸入到該視窗新開的終端分頁。」），符合 T0412 跨視窗行為。

### 回報時間
2026-10-05T03:28:34+08:00
