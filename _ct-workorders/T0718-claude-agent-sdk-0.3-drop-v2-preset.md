---
schema_version: 1
schema_kind: workorder
id: T0718
title: "Claude Agent SDK 升 0.3（latest，0.3.316）＋ D123 Phase 2：下架 claude-code-v2 preset、已存設定自動遷到 claude-code"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T08:12:30+0800"
updated_at: "2026-11-01T08:12:30+0800"
target_version: "0.7.2-pre.5"
depends_on:
  - T0717
related:
  - "D191（使用者 2026-11-01：Agent SDK 升 0.3 latest，含 D123 Phase 2）"
  - "D123（2026-10-04 使用者裁決：`claude-code-v2` preset 下架，不改寫成 thin wrapper；實作要點：移除 preset 定義與 V2 send/stream 路徑、既有設定遷移、CHANGELOG 註明）"
  - "D122 / T0368（研究：SDK 0.2 → 0.3 breaking changes 對 BAT 的影響表、建議工單 T-D；`_ct-workorders/_archive/workorders/T0368-research-claude-sdk-0.3-upgrade.md` 回報區第 2 節）"
  - "T0717（本單依賴：先完成 claude CLI / codex 追版，避免兩張同時改 `package-lock.json`）"
  - "CLAUDE.md「Claude Agent SDK / CLI」「Sub-agent / Active Tasks Tracking」「React Rendering」「工作區層級 Agent / 啟動參數」「Packaging / Release 前置檢查」（安裝檔瘦身白名單、`asar-runtime-deps.test.mjs`）「Server bundle baseline」（bundle 不含 `claude-agent-sdk-<platform>`）各節"
affects_files:
  - package.json
  - package-lock.json
  - CLAUDE.md
  - CHANGELOG.md
  - docs/agent-guide/
  - electron/claude-agent-manager.ts
  - electron/agent-runtime/
  - electron/main.ts
  - electron/__tests__/
  - src/components/ClaudeAgentPanel.tsx
  - src/components/CodexAgentPanel.tsx
  - src/components/WorkspaceView.tsx
  - src/stores/workspace-store.ts
  - src/stores/settings-store.ts
  - src/stores/__tests__/
  - src/types/agent-presets.ts
  - src/types/agent-runtime.ts
  - src/types/index.ts
  - src/utils/control-tower-launch.ts
  - src/lib/
  - src/locales/
  - src/components/__tests__/
  - scripts/verify-native-modules.js
  - scripts/verify-packaged-native.js
  - scripts/verify-server-bundle.js
  - scripts/build-server-bundle.mjs
  - scripts/__tests__/
  - _ct-workorders/T0718-claude-agent-sdk-0.3-drop-v2-preset.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權修改 `package.json` 的 `@anthropic-ai/claude-agent-sdk`（`^0.2.111` → `^<0.3 latest>`）與對應 `package-lock.json`（含 `@anthropic-ai/claude-agent-sdk-*` 平台子套件）；0.3 把 `@anthropic-ai/sdk`（`>=0.93.0`）、`@modelcontextprotocol/sdk`、`zod` 改為 peerDependencies（T0368）—— 為滿足 peer 而升 / 加的套件也授權，但每一個都要在回報區列出原因；其他相依**不得**連帶升版，npm 產生的無關旗標雜訊比照 T0690 以移植方式去掉，附 `git diff --stat package-lock.json` 與逐套件比對。"
  - "🔴 開工時先確認 T0717 已 DONE 且 commit 在 `main`；再查 `npm view @anthropic-ai/claude-agent-sdk dist-tags` / `time`，取當下 latest（高於 0.3.316 在回報區說明），並讀官方 CHANGELOG（`https://raw.githubusercontent.com/anthropics/claude-agent-sdk-typescript/main/CHANGELOG.md`）0.2.114 起到目標版的 Breaking 與行為變更，逐項判斷對 BAT 的影響（T0368 第 2 節是 0.3.289 時的結論，0.3.290 之後要補查）。"
  - "🔴 D123 下架 `claude-code-v2`：移除 preset 定義、V2 API 使用（`SDKSession` import、`getV2Api`、V2 send / stream 分支）與所有引用（開工時 `grep -rn \"claude-code-v2\\|unstable_v2\\|SDKSession\" src electron scripts e2e` 列出完整清單，回報區逐檔列處置）。不改寫成 `query()` thin wrapper（D123 已否決）。"
  - "🔴 既有設定遷移（D123，不得讓使用者開啟後出錯或分頁消失）：已持久化的 workspace `defaultAgent`、terminal 的 `agentPreset`、Settings `defaultAgent`、以 preset 為 key 的 `agentCustomArgs`（全域與工作區層級）、detached 視窗 / Terminal Server recovery 還原的分頁、headless bat-server 的 `<dataDir>/settings.json` 若指向 `claude-code-v2`，載入時改指 `claude-code`。`claude-code` 已有自己的自訂參數時以 `claude-code` 的為準、`claude-code-v2` 的捨棄，回報區說明。遷移邏輯集中一處（純函式 + 單元測試），不要在 consumer 內聯；查找順序仍經 `src/lib/agent-launch-settings.ts`。helper 派工 `--agent claude-code-v2`（`normalizeAgentAlias`）的行為若要改變，屬 helper 介面，先用 BAT 通道問塔台。"
  - "🔴 SDK 0.3 行為核對（附證據）：① Claude 面板 `query()` 路徑的選項（`systemPrompt` / `settingSources` / `thinking` / `effort` / `resume` / `pathToClaudeCodeExecutable` / `executable` 等）仍有效，`pathToClaudeCodeExecutable` 仍指向 T0717 的內嵌 CLI（runtime router 不變）；② `CanUseTool` 可回 `null` 的型別變化不影響權限流程；③ Agent / Task 追蹤（CLAUDE.md「Sub-agent / Active Tasks Tracking」：`tool_use` 名稱 `Task` / `Agent`、`activeTasks` 清理、`stopTask()` fallback）不受新的 `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList` 工具名稱干擾（不得把它們當成 sub-agent）；④ TodoWrite → Task tools：記錄 Claude 面板目前怎麼顯示 Task* 工具（一般工具卡片即可）；**新增 Task tools 清單 UI 不在本單範圍**，列為後續候選；⑤ MCP 背景連線（`init` 的 `status:\"pending\"`）對面板有無可見影響；⑥ `getSupportedModels()`、模型清單、effort、計價不變或依 CLAUDE.md 規則補。任何一項會改變使用者可見行為而本單沒寫到的，先用 BAT 通道問塔台。"
  - "🔴 打包：SDK 0.3 若新增 main 端 runtime `require` 的外部套件，依 CLAUDE.md「安裝檔瘦身」加進 `build.files` 白名單並跑 `scripts/__tests__/asar-runtime-deps.test.mjs`（先 `npx vite build`）；`claude-agent-sdk-<platform>` 子套件名稱 / 目錄若改變，同步核對 `verify-native-modules.js`、`verify-packaged-native.js`、`verify-server-bundle.js`（bundle 不得含 `claude-agent-sdk-<platform>`）與 `build-server-bundle.mjs`。不得使用 `build.<platform>.files`。"
  - "🔴 文件：CLAUDE.md「Claude Agent SDK / CLI」節改寫 SDK 版本行（移除「刻意留在 0.2 線」，註明 T0718 / D191 已執行 D123 Phase 2）；`docs/agent-guide/claude-agent-sdk-cli.md` 同步；`CHANGELOG.md` `[Unreleased]` 註明 Claude Agent V2 preset 下架與自動遷移（D123 要求，使用者看得懂的寫法）。CLAUDE.md 不得超過 100k 字元目標（T0595）。"
  - "🔴 不回歸（CLAUDE.md No Regressions Policy）：Claude 面板（`claude-code`）建立 / 送訊息 / 串流 / 權限詢問 / resume / sub-agent 追蹤 / 狀態列，Codex 面板、claude-cli / codex-cli 終端分頁、塔台派工（`--agent default` / `claude` / `codex`）與 Worker 分頁不得受影響；改到共用 store / types / IPC 時追所有 consumer。`src/stores/__tests__/workspace-store.closeTerminalNow.test.ts` 等 source guard 測試若引用 `claude-code-v2`，改成不依賴已下架 preset 的寫法並說明。"
  - "🔴 驗證：`npm run test:unit` 全綠（新增遷移測試）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`node scripts/verify-native-modules.js` exit 0；`npm run verify:helpers` exit 0；`asar-runtime-deps.test.mjs` 在 vite build 後實際執行（非 skip）。可用隔離實例（`--runtime=<高號碼>` 或 e2e isolated runtime）驗證：以含 `claude-code-v2` 的假 userData 啟動後分頁與預設 agent 被遷移、Claude 面板可開啟（不送會耗 token 的訊息；若需要一次真實對話驗證，問塔台）。不得以預設實例啟動 source build；不碰使用者正在用的 BAT 與其 userData。`TMP` 指到長路徑 scratchpad 時 git worktree 測試會失敗（T0716），用系統預設 TMP。"
  - "🔴 Git：`git commit --only <檔案>`；可分多個 commit（例：下架 + 遷移、SDK 升版、文件），回報區列全部 SHA。不 push、不觸發 workflow、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題問塔台。"
---

# T0718 — Claude Agent SDK 升 0.3＋下架 claude-code-v2

## 背景

- 使用者 2026-11-01 指示內嵌 claude / codex CLI / SDK 全部追最新，SDK 選升 0.3（D191）。
- `@anthropic-ai/claude-agent-sdk` 實裝 `0.2.113`，latest `0.3.316`（塔台 2026-11-01 08:1x `npm view`）。SDK 0.3.142 移除 V2 session API（`unstable_v2_*` / `SDKSession`），BAT 的 `claude-code-v2`「Claude Agent V2」preset 是唯一使用者，升 0.3 即編譯失敗（T0368）。
- D123（2026-10-04）已決定下架該 preset，但 Phase 2 一直沒排；目前 `src` / `electron` 仍有 10 檔引用（`ClaudeAgentPanel.tsx`、`CodexAgentPanel.tsx`、`WorkspaceView.tsx`、`workspace-store.ts`、`workspace-store.closeTerminalNow.test.ts`、`agent-presets.ts`、`agent-runtime.ts`、`control-tower-launch.ts`、`agent-registry.ts`、`claude-agent-manager.ts`）。
- 依賴 T0717（claude CLI / codex 追版），兩張都動 `package-lock.json`，依序執行。

## 實作

1. 確認 T0717 已完成；查 SDK latest 與 CHANGELOG（`memory_overrides` 第 2 條）。
2. 下架 `claude-code-v2`：移除 preset、V2 API 路徑與所有引用（第 3 條）。
3. 既有設定遷移：集中一處的純函式＋單元測試，涵蓋本機、detached、recovery、headless（第 4 條）。
4. `package.json` / lock 升 SDK 0.3，處理 peer 依賴（第 1 條）。
5. 修編譯錯誤；核對 SDK 0.3 行為（第 5 條）與打包白名單 / server bundle（第 6 條）。
6. CLAUDE.md、docs、CHANGELOG（第 7 條）。
7. 全套驗證（第 9 條）。

## 驗收

- [ ] `grep` 不再有 `claude-code-v2` / `unstable_v2` / `SDKSession` 的產品引用（遷移函式與其測試、CHANGELOG / 歷史文件除外，回報區列出剩餘位置與理由）
- [ ] 遷移：含 `claude-code-v2` 的 workspace / terminal / Settings / `agentCustomArgs` / headless settings 載入後改指 `claude-code`，分頁不消失（單元測試；隔離實例實測加分）
- [ ] `@anthropic-ai/claude-agent-sdk` = 0.3 latest；lock diff 只含 SDK 系列與列明原因的 peer 套件
- [ ] `npm run test:unit`、`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0；`verify-native-modules` / `verify:helpers` ✅；`asar-runtime-deps.test.mjs` 實際執行通過
- [ ] SDK 0.3 行為核對 ①–⑥ 有結果與證據；Task tools 清單 UI 列為後續候選
- [ ] CLAUDE.md / docs / CHANGELOG 已更新
- [ ] 回報區列出需實機驗證的項目（Claude 面板真實對話、權限詢問、resume、sub-agent；mac / Linux 由 CI `verify-packaged-native` 確認）

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 版本與 lock

### 下架與遷移

### SDK 0.3 行為核對

### 打包與 server bundle

### 驗證證據

### 需實機驗證

### 後續候選

### 遭遇問題

### 互動紀錄

### Commit

### 回報時間
