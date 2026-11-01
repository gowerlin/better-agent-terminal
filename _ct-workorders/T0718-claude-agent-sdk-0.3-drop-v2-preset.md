---
schema_version: 1
schema_kind: workorder
id: T0718
title: "Claude Agent SDK 升 0.3（latest，0.3.316）＋ D123 Phase 2：下架 claude-code-v2 preset、已存設定自動遷到 claude-code"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T08:12:30+0800"
updated_at: "2026-11-01T09:00:53+0800"
started_at: "2026-11-01T08:35:40+0800"
completed_at: "2026-11-01T09:00:53+0800"
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

無（沒有送出問題）。

### 完成狀態

**DONE**。完成項目：
- `claude-code-v2` 下架，已存設定遷到 `claude-code`。
- SDK 升 `0.3.316`。
- SDK 0.3 行為核對 ①–⑥。
- 打包與 server bundle 核對。
- CLAUDE.md、docs、CHANGELOG。
- 全套驗證。
- 隔離實例實測（加分項）也通過。

落點檢查：**PASS**。
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，PASS。
- C-1：工單在 `REPO_ROOT/_ct-workorders/`，PASS。
- C-3：PASS。
- C-2：工單沒有 `branch` 欄位，不適用。
- `CT_HOME` 未設，不是 worktree。
- 環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`、`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

開工前已確認 T0717 `status: DONE`，commit `101adaaf` 在 `main`。

### 版本與 lock

- `npm view @anthropic-ai/claude-agent-sdk dist-tags`：`latest` 與 `next` 都是 **0.3.316**（2026-10-31T00:39:30Z 發布），與工單相同，沒有更高版本。
- `package.json` 只改一行：`"@anthropic-ai/claude-agent-sdk": "^0.2.111"` → `"^0.3.316"`。
- 0.3 的 peerDependencies 逐套件處理與原因：

| 套件 | HEAD | 現在 | 原因 |
|---|---|---|---|
| `@anthropic-ai/claude-agent-sdk` ＋ 8 個 `-<platform>` | 0.2.113 | 0.3.316 | 本單目標 |
| `@anthropic-ai/sdk` | 0.81.0 | **1.3.0** | 0.3 的 peer 要求 `>=0.93.0`。1.3.0 是 npm 自己解出的版本，也是 latest |
| `@opentelemetry/api` | — | 1.10.0（新增） | `@anthropic-ai/sdk` 1.3.0 的 dependency |
| `standardwebhooks` | — | 1.1.1（新增） | 同上 |
| `@stablelib/base64` | — | 1.0.1（新增） | `standardwebhooks` 的 dependency |
| `fast-sha256` | — | 1.3.0（新增） | 同上 |
| `@modelcontextprotocol/sdk` | 1.29.0 | **1.29.0（不變）** | 已滿足 peer `^1.29.0`，不升 |
| `zod` | 4.3.6 | **4.3.6（不變）** | 已滿足 peer `^4.0.0`，不升 |

lock 的產生方式（比照 T0690 / T0717 用移植）：
1. npm 12.2.1 直接在既有 lock 上 `npm install @anthropic-ai/claude-agent-sdk@^0.3.316`，回 `ERESOLVE`（`Conflicting peer dependency: @anthropic-ai/sdk@1.3.0`）。這個衝突自相矛盾：明確加上 `@anthropic-ai/sdk@^1.3.0` 或 `@0.93.0` 也一樣失敗。
2. 在 scratchpad 的 lock 副本先 uninstall 再 install（`--package-lock-only`）可以解開，但 npm 會連帶把約 25 個套件升級：`@modelcontextprotocol/sdk` 1.32.2、`zod` 4.6.7、`express`、`hono`、`ajv` 8.20 等，另外還有約 90 個 `peer` 旗標雜訊。其中 `ajv` / `fast-uri` 在安裝檔白名單內，不能動。
3. 因此以 HEAD 的 lock 為底，只移植下列條目，既有條目保留 HEAD 的 meta 旗標：
   - `node_modules/@anthropic-ai/claude-agent-sdk*`（9 個）
   - `node_modules/@anthropic-ai/sdk`
   - 新增的 4 個套件
   - root `packages[""].dependencies` 的 SDK 那一行
4. 重解比對：把 `package.json` 與移植後的 lock 複製到 scratchpad，跑 `npm install --package-lock-only --ignore-scripts`，exit 0，沒有 ERESOLVE。實質差異 **0**，只多出 104 個 `peer` 旗標雜訊。
5. 實際安裝：`npm install --ignore-scripts` 後，把移植的 lock 蓋回去。實裝版號核對：`claude-agent-sdk` 0.3.316、`-win32-x64` 0.3.316、`@anthropic-ai/sdk` 1.3.0、`@modelcontextprotocol/sdk` 1.29.0、`zod` 4.3.6、`standardwebhooks` 1.1.1、`@opentelemetry/api` 1.10.0、`claude-code` 2.1.316（T0717 的，未動）。

`git diff c6b9d958 --stat -- package.json package-lock.json`：`package-lock.json | 139`（93+ / 46-）、`package.json | 2`。

逐套件比對（HEAD 對移植後，scratchpad `lockdiff.mjs`）：
- `ROOT changed`：只有 SDK 那一行。
- `~ claude-agent-sdk 0.2.113 -> 0.3.316`：dependencies 改為 peerDependencies，engines `>=18.14.0`。
- 8 個 `~ claude-agent-sdk-<platform> 0.2.113 -> 0.3.316`：linux 的 4 個多了 `libc` 欄位。
- `~ @anthropic-ai/sdk 0.81.0 -> 1.3.0`：license 改為 Apache-2.0，多了 dependencies。
- 新增 4 個套件，npm 原樣標 `peer: true`。
- 其他套件：**0**。

### 下架與遷移

**開工時的 grep 清單**（`claude-code-v2|unstable_v2|SDKSession`，範圍 `src electron scripts e2e`，共 13 檔）與逐檔處置：

| 檔案 | 處置 |
|---|---|
| `electron/claude-agent-manager.ts` | 刪除下列內容（共 -290 行）：`SDKSession` / `SDKSessionOptions` import；`getV2Api` / `createSessionFn` / `resumeSessionV2Fn`；`runQueryV2` 整段；session 的 `apiVersion` / `v2Session` / `v2SessionModel`；`runQuery` / `stopSession` / `abortSession` / `setModel` 的 V2 分支；`startSession` / `resumeSession` / `resetSession` 的 `apiVersion` |
| `electron/agent-runtime/agent-registry.ts` | 刪除 `claude-code-v2` 定義；`isClaudeSdk` 不再認它 |
| `src/types/agent-presets.ts` | 刪除 preset 定義與 `AgentPresetId` 成員 |
| `src/types/agent-runtime.ts` | `isClaudeSdk` 不再認它，因此 `isIntegrated` 也不認 |
| `src/utils/control-tower-launch.ts` | 從 `CLAUDE_PRESETS` 移除 |
| `src/components/ClaudeAgentPanel.tsx` | 刪除 `isV2Session` / `apiVersion`、V2 換模型確認、V2 模型清單提示；effort 選單改為一律顯示（原本 V2 隱藏）；`resumeSession` 的第 5 個參數傳 `undefined` |
| `src/components/CodexAgentPanel.tsx` | 同上。Codex 分頁的 `isV2Session` 原本就恆為 false，行為不變 |
| `src/components/WorkspaceView.tsx` | 刪除 `handleAddClaudeAgentV2`、`handleSwitchApiVersion` 與 `onSwitchApiVersion` 傳遞 |
| `src/stores/workspace-store.ts` | 刪除 `switchTerminalApiVersion`；載入時遷移（見下方） |
| `src/stores/__tests__/workspace-store.closeTerminalNow.test.ts` | `PRESETS` 移除 `claude-code-v2` 並加註解，改成不依賴已下架 preset 的寫法。原因：這支測試逐 preset 比對 T0535 前的關閉步驟；下架後 `addTerminal(…, 'claude-code-v2')` 已經不是 integrated preset，留著只是在測一個不存在的 preset |
| `electron/terminal-command-handlers.ts` | `toTerminalDrivenAgentId` 刪除 V2 分支；`normalizeAgentAlias` 先把已下架 id 換成替代 id（見下方「helper 介面」） |
| `electron/remote/__tests__/headless-claude.test.ts` | SDK mock 刪除 `unstable_v2_*` |
| `electron/__tests__/agent-prompt-command.test.ts:32` | **保留**。這是「pre-T0431 electron/main.ts, verbatim」的逐字對照副本（`legacyToTerminalDrivenAgentId`），改了就失去對照意義。新增的 T0718 測試放在同檔最後 |

grep 沒抓到、但屬於 V2 功能，一併處理的部分：
- `src/components/MainPanel.tsx`：「升級至 V2 / 降級至 V1」按鈕與 `?` 說明（原本用 `window.alert`）。
- `src/components/ThumbnailBar.tsx`：「+」選單的 Claude Agent V2 項目。
- `src/locales/{en,zh-TW,zh-CN}.json`：
  - 刪除 5 個 key：`v2ModelChangeWarning`、`v2ModelListHint`、`switchToV2`、`switchToV1`、`v1v2Help`。
  - `v1Model1mWarning` / `v1Model1mHint` 原本建議「CLI 或 Claude Agent V2」，改為只建議 Claude CLI。
- IPC 型別（`electron/handlers/claude.ts`、`electron/preload.ts`、`src/types/electron.d.ts`，以及 `electron/remote/path-aware-channels.ts` 的註解）：
  - `claude:start-session` 的選項刪除 `apiVersion`。
  - `claude:resume-session` 的第 5 個參數（原 `apiVersion`）**保留位置、忽略內容**。原因：path-aware 的 `arg-indices [2, 6]` 與舊版遠端 bat-server 都依位置取參數。
  - 相容性：舊 client 送 `'v2'` 給新 server 會被忽略，改走 `query()`；新 client 送 `undefined` 給舊 server，舊 server 預設 `'v1'`。
- `electron/codex-agent-manager.ts`：`CodexStartOptions` 刪除沒在用的 `apiVersion?: string`。
- source guard 與測試：
  - `claude-cache-history-last-call.test.ts`：原本以 `runQueryV2` 切片，改為斷言 `runQueryV2` 不存在。
  - `claude-model-limits-and-call-usage.test.ts`：假 session 刪除 `apiVersion`。
  - `pty-restart-or-create.test.ts`：原本以 `handleSwitchApiVersion` 切片，改用下一個 `handleFocus`。
  - `tower-terminal-title.test.ts`：`Claude Agent V2` 不再是預設標題；`src/lib/tower-terminal-title.ts` 的註解同步。

**遷移**：唯一實作是 `src/lib/retired-agent-presets.ts`（純函式，不 import electron / DOM）。
- `RETIRED_AGENT_PRESETS = { 'claude-code-v2': 'claude-code' }`。
- 函式：`migrateAgentPresetId`、`migrateAgentCustomArgs(record, layer)`、`migrateWorkspaceAgentFields`、`migrateSettingsAgentFields`、`migrateTerminalAgentPreset`。沒有要遷移的內容時回傳同一個參照。
- `agentCustomArgs` 規則：
  - `claude-code` 已有自己的參數時，以 `claude-code` 為準，`claude-code-v2` 的捨棄。
  - 沒有時，把 `claude-code-v2` 的值搬到 `claude-code`。
  - 「有自己的參數」依各層查找規則判斷：工作區層是 key 存在且為字串，空字串也算（D142：空字串 = 不加參數）；Settings 層是非空字串（Settings 不存空字串，查找時也略過）。
  - 為什麼要搬：helper 派工原本以 `['claude-cli', 'claude-code-v2']` 查找；搬到 `claude-code` 後，以 `['claude-cli', 'claude-code']` 找到同一個值，**派工結果不變**。
- 分頁：`agentPreset` 改成 `claude-code`；預設標題 `Claude Agent V2`（`title` / `autoTitle`）改成 `Claude Agent V1`；使用者自訂的標題、`sdkSessionId`、`model` 都不動。
- 套用位置（consumer 不內聯）：

| 路徑 | 位置 |
|---|---|
| 查找（main、headless、renderer 共用） | `agent-launch-settings.ts` 的 `resolveEffectiveDefaultAgent` / `resolveEffectiveAgentArgs` / `hasWorkspaceArgsOverride`，讀取時遷移；查找順序不變 |
| 本機視窗載入 | `workspace-store.applySerializedData`：workspaces 直接遷移，tabs 經 `toTerminalInstance` |
| detached 視窗 | 同上：`workspace:load` 回傳的就是父 entry；關閉後 adopt 回來的分頁也經 `toTerminalInstance`（`replaceWorkspaceTerminals`） |
| Settings | `settings-store.load`：只在記憶體遷移，下次儲存 Settings 才寫回檔案。不在 load 時 `save()`，因為各 renderer 會以整份記憶體副本互相覆寫 |
| Electron main 讀 `settings.json` / registry | `createAgentPromptCommandBuilder` 經上面的查找函式 |
| headless bat-server `<dataDir>/settings.json` | `readHeadlessTerminalSettings` 回傳 `migrateSettingsAgentFields(...)`，不改寫檔案 |
| Terminal Server recovery | 不需處理：`claude-code-v2` 是 integrated（SDK 面板）preset，沒有 PTY，recovery 只重建 PTY 分頁；V2 分頁走 renderer 的還原路徑 |

- **helper 介面**（`--agent claude-code-v2`）：**行為不變，因此沒有問塔台**。
  - `normalizeAgentAlias` 把它換成 `claude-code`，經 `toTerminalDrivenAgentId` 得到 `claude-cli`，和以前一樣啟動 Claude CLI Worker。
  - 唯一差別是多一行日誌：`agent shorthand claude-code-v2 → claude-code`。
  - headless tower capability 的 `isKnownAgent` 照樣通過。
- **剩下的 grep 位置**（`claude-code-v2|unstable_v2|SDKSession`）：
  - 遷移模組本身與說明註解：`retired-agent-presets.ts`，以及 `agent-launch-settings.ts`、`workspace-store.ts:155`、`headless-entry.ts:464`、`terminal-command-handlers.ts:389-390` 的註解。
  - 遷移測試：`retired-agent-presets.test.ts`、`workspace-store.retiredPreset.test.ts`、`agent-prompt-command.test.ts` 的 T0718 describe、`dispatch-cwd-check.test.ts:134`、`closeTerminalNow.test.ts:62` 的註解。
  - 逐字對照副本：`agent-prompt-command.test.ts:32`。
  - CHANGELOG 與 docs 的歷史敘述。
  - **產品程式的實際引用：0**。

### SDK 0.3 行為核對

讀官方 raw CHANGELOG 0.2.114 → 0.3.316；T0368 第 2 節之後的 0.3.290 → 0.3.316 另外補查。

**① `query()` 選項：PASS**
- `runQuery` 的 `queryOptions` 是 `Record<string, unknown>` 再轉型，`npm run typecheck:electron` 驗不到選項名稱。
- 因此另寫 scratchpad `optcheck/check.ts`，以 0.3.316 的 `Options` 宣告 `Required<Pick<Options, …>>`，`tsc --strict` 下以下選項全部存在：`abortController`、`cwd`、`systemPrompt`、`tools`、`permissionMode`、`allowDangerouslySkipPermissions`、`includePartialMessages`、`promptSuggestions`、`settingSources`、`thinking`、`effort`、`toolConfig`、`agentProgressSummaries`、`model`、`plugins`、`canUseTool`、`pathToClaudeCodeExecutable`、`env`、`executable`、`stderr`、`resume`、`continue`、`forkSession`、`maxTurns`。
- 唯一的錯誤是我把 `interrupt()` 的回傳寫成 `Promise<void>`：0.3 回傳 response，BAT 只 await、不用回傳值。
- runtime router 沒改，`pathToClaudeCodeExecutable` 仍指向 T0717 的內嵌 CLI。
- 實際啟動 smoke（scratchpad `smoke/init-smoke.mjs`）：用同一組選項，prompt 是不 yield 的 AsyncIterable，**不送訊息、不耗 token**。`initializationResult()` 589 ms 回來，`claude_code_version: 2.1.316`，`close()` 正常結束。

**② `CanUseTool` 可回 `null`：不影響**
- 0.3.199 起允許回 `null`（抑制自動 control response），只是型別放寬；BAT 的 `canUseTool` 永遠回 `PermissionResult`。typecheck = 0。smoke 中 `canUseTool` 被呼叫 0 次。
- 附註：0.3.198 起，`canUseTool` 與 `bypassPermissions` 同時設定時會發 runtime warning。只是警告；BAT 在 bypass 模式本來就同時設定，行為不變。

**③ Agent / Task 追蹤：PASS**
- `activeTasks` 只在 `toolBlock.name === 'Agent' \|\| 'Task'` 時登記（`claude-agent-manager.ts`）；面板也都是精確比對（`ClaudeAgentPanel.tsx` 的 `toolName === 'Task' \|\| 'Agent'`）。repo 裡沒有 `startsWith('Task')` 之類的寫法。
- 新增 `electron/__tests__/claude-sdk03-task-tools.test.ts`：`TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList` 只產生工具卡片，`activeTasks.size === 0`；`Agent` / `Task` 照常登記。
- `stopTask()` 的 fallback 沒動；`Query.stopTask` 在 0.3 仍存在（typecheck 通過）。

**④ TodoWrite → Task tools：記錄現況**
- Claude 面板把 Task* 工具畫成**一般工具卡片**（`ClaudeAgentPanel` 的通用工具卡片分支）。權限詢問時，`TaskCreate` / `TaskUpdate` 原本就列為 `warning` 等級（`ClaudeAgentPanel.tsx:3048` 附近的既有程式）。`TodoWrite` 勾選清單只會出現在舊 session 的歷史。
- 另外，0.3.233 / 0.3.268 起，Claude 5 等新模型的 SDK session 預設不帶 todo / task 工具，要在 `tools` / `allowedTools` 點名，或設 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`。所以 Claude 5 模型通常根本不會出現這些卡片。
- **Task tools 清單 UI 不在本單範圍**，列為後續候選。

**⑤ MCP 背景連線：面板上看不到差異**
- smoke 在 init 剛完成時，`mcpServerStatus()` 回 `plugin:presenton:presenton:pending, pencil:failed, chrome-live:pending, sonarqube:pending`，證實 0.3.142 改成背景連線。
- BAT 不自帶 `mcpServers` 選項，manager 與面板也**不顯示 MCP 狀態**（grep `mcp_servers` / `mcpServerStatus` 結果為 0）。
- 唯一影響：使用者設定檔裡較慢的 MCP server，第一輪可能還沒有工具。可以用 `MCP_CONNECTION_NONBLOCKING=0` 還原舊行為，本單沒設。

**⑥ 模型清單、effort、計價：不變**
- `supportedModels()` 的清單由 CLI 提供，SDK 只轉送。smoke 取得 `default=claude-fable-5-1`、`opus=claude-opus-5-5`、`sonnet=claude-sonnet-5-5`、`haiku=claude-haiku-5-5` 與 legacy 各模型，effort 都是 `low/medium/high/xhigh/max`，與 T0717 的 CLI 2.1.316 一致。
- `BAT_BUILTIN_MODELS`、`MODEL_LIMITS`、`model-pricing.ts` 已涵蓋這些模型（T0717 / T0483），不需要補。
- `getSupportedModels()` 仍帶 `pathToClaudeCodeExecutable`。

**CHANGELOG 補查的其他 0.3 變更：**
- 0.3.143 / 0.3.281：`sdk.mjs` 不再 bundle 沒用到的依賴。BAT 只 import `.`，而 `sdk.mjs` 只 import Node 內建模組；只有 `./core` 入口才 import MCP SDK / zod。
- 0.3.295：選項改成 `--flag=value` 形式，BAT 不受影響。
- 0.3.302：沒給 `permissionMode` 時，第三方 provider 改為從 `default` 開始。BAT 一定會帶 `permissionMode`。
- 0.3.302：fork subagent 預設開啟。它仍是 `Agent` 工具，照常追蹤。
- 0.3.300：`thinking: disabled` 改為 adaptive。BAT 本來就用 `adaptive`。
- 0.3.311：Node 最低版本 18.14。Electron 41 是 Node 24，bat-server 自帶 Node 24。
- 0.3.217：subagent 預設不再巢狀 spawn（深度上限 1）。這是 CLI 行為，面板不受影響。
- 0.3.269：plan mode 即使有 `allowDangerouslySkipPermissions`，寫入也走 `canUseTool`。BAT 只在 `bypassPermissions` 時設這個旗標。若 query 執行中從 bypass 切到 plan，寫入會改成詢問；這符合 plan 的語意，列為殘留觀察。
- 0.3.162：native build 的 SDK session 預設用 Bash 內建的 `find` / `grep`，不註冊 Grep / Glob，面板可能少見 Grep / Glob 卡片。看起來是 CLI 依 entrypoint 決定，T0717 之後 0.2.113 驅動 2.1.316 時應該已經如此，但**沒有用真實對話確認**，列入需實機驗證。

### 打包與 server bundle

- **main 端沒有新增執行期外部 require**。`vite build` 後，`dist-electron/sdk-CzVYtfWT.js` 的非內建 require 只有 `ajv/dist/runtime/*` 與 `ajv-formats/dist/formats`，和 0.2.113 的 chunk（`sdk-DiA-sIQk.js`）相同。
  - 這些在 `sdk.mjs` 裡其實是 ajv codegen 產生的程式碼**字串**（例：`Vj.code='require("ajv/dist/runtime/equal").default'`），而且本來就在 `build.files` 白名單。
  - `build.files` 沒改，也沒用 `build.<platform>.files`。
- **`scripts/__tests__/asar-runtime-deps.test.mjs` 實際執行**：在 vite build 之後以 `--reporter=verbose` 跑三平台。
  - 「covers every package the built dist-electron requires… (needs `npx vite build`)」三個平台都是 ✓，`it.skipIf(!distBuilt)` 沒有 skip。
  - 「drops what the main process never loads」確認 `@anthropic-ai/sdk`、`@modelcontextprotocol/sdk`、`zod`、`claude-agent-sdk*` 都不進 asar。新增的 4 個套件不在白名單內，也不會打包。
- **`claude-agent-sdk-<platform>` 子套件**：名稱與目錄不變（8 個平台同名）。`verify-native-modules.js`、`verify-packaged-native.js`（C2a）、`verify-server-bundle.js`（`claude-agent-sdk-` 禁止樣式）、`build-server-bundle.mjs` 都**不需要改**。
- **server bundle**：只複製 `@anthropic-ai/claude-agent-sdk` 套件本身（`nativePackages`，不含依賴閉包）。`sdk.mjs` 只 import Node 內建模組，所以 0.3 在 bat-server 上不缺 peer。
  - 套件大小（unpacked）3,932,021 → 4,976,758 bytes，約 +1 MB，多出的是 `core-*.mjs`、`bridge.mjs`、`browser-sdk.js`。
  - 本機沒有建 linux bundle（需要下載 Node），由 CI 的 `verify-server-bundle` 確認。

### 驗證證據

工作樹內容就是最終 commit。文件是在 test:unit 開跑後才改的，所以另外補跑了會讀文件的測試。

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | **0**（無輸出） |
| `npm run typecheck:electron` | **0**（無輸出） |
| `npx vite build` | exit 0 |
| `npm run test:unit` | exit 0：`Test Files 347 passed (347)`、`Tests 6203 passed \| 3 skipped (6206)`。T0717 基線為 344 檔 / 6182 passed / 3 skipped；本單新增 3 檔、21 個 test，skipped 數相同 |
| `npm run test:legacy` | exit 0：`files 33 passed, 0 failed / 33 total; tests 472 passed, 0 failed` |
| `node scripts/verify-native-modules.js` | exit 0：`✅ All 2 required native modules present, … embedded claude: native` |
| `npm run verify:helpers` | exit 0：`OK — the installer ships 6 runtime helper(s)…` |
| `asar-runtime-deps.test.mjs` | 實際執行並通過（見「打包與 server bundle」） |
| 改文件後補跑 | 會讀 CLAUDE.md / agent-guide 的測試：2 檔、22 個 test 全過 |
| 新增遷移測試 | 見下方 |
| SDK 啟動 smoke | 見 ①、⑤、⑥，不耗 token |

新增的遷移測試：
- `src/lib/__tests__/retired-agent-presets.test.ts`：純函式、查找、preset 已不再出現在清單。
- `src/stores/__tests__/workspace-store.retiredPreset.test.ts`：
  - 視窗載入：4 個分頁全部保留且已遷移，存檔後不含 `claude-code-v2`。
  - detached adopt。
  - Settings 兩例。
- `agent-prompt-command.test.ts`：headless settings；預設 agent 為 V2 時仍派 Claude CLI；V2 的參數仍會套用。
- `dispatch-cwd-check.test.ts`：`normalizeAgentAlias('claude-code-v2')` → `claude-code`。

**隔離實例實測（加分項）：通過**（`1 passed (31.8s)`）
- 做法：
  - spec 放在 scratchpad（`e2e-t0718/t0718-retired-v2.spec.ts`），以臨時 Playwright 設定執行，**沒有放進 repo**（`e2e/` 不在 affects_files）。
  - 用 `e2e/fixtures/electron-isolation.ts` 啟動 source build，`--runtime=e2e-t0718-1793494505936`，使用獨立的 userData。
  - 結束後 userData 已刪除、Terminal Server 已結束。沒有碰使用者正在用的 BAT。
- 種子資料：
  - Settings：`defaultAgent: claude-code-v2`、`agentCustomArgs: { claude-code-v2 }`。
  - 工作區：`defaultAgent: claude-code-v2`、`agentCustomArgs: { claude-code-v2: '--t0718-ws' }`。
  - 3 個分頁：V2 預設標題、V2 自訂標題 `My V2 tab`、一般 shell。
- 結果：
  - 縮圖列為 `["✦ Claude Agent V1","✦ My V2 tab","Shell"]`，沒有 `Claude Agent V2`。
  - Claude Agent 面板有開起來（`FRESH startSession`，沒送訊息）。
  - 沒有 V1↔V2 切換鈕。
  - 「+」選單為 `終端 / Claude Agent V1 / Claude CLI / 以塔台開啟 Claude / Codex Agent / Codex CLI / Gemini CLI / GitHub Copilot CLI`，沒有 V2。
  - 30 s 自動存檔後，registry 的工作區為 `defaultAgent: claude-code`、`agentCustomArgs: { claude-code: '--t0718-ws' }`。
  - 分頁依序為 `claude-code` / `Claude Agent V1`、`claude-code` / `My V2 tab`、shell，3 個 id 都在。
  - debug 日誌不含 `claude-code-v2`。

### 需實機驗證

- **Claude 面板（`claude-code`）真實對話**（會耗 token，本單沒做）：送訊息、串流、權限詢問（`canUseTool` 的 allow / deny / AskUserQuestion）、resume、sub-agent（`Agent` 卡片、active tasks bar、`stopTask`）、狀態列 / Cache History、fork、換模型 / effort。
- **遷移後舊 V2 分頁能否接續**：有 `sdkSessionId` 的 V2 分頁能不能用 `query()` resume 接上原對話。V2 建 session 時有 cwd workaround，存放的 project 目錄可能不同。接不上時，V1 路徑會顯示 `Previous session could not be resumed. Starting fresh...` 並開新對話，不會出錯，但需要實機確認實際走哪一種。
- **Grep / Glob 卡片**：0.3.162 起 SDK session 改用 Bash 的 `find` / `grep`，確認面板的搜尋是否變成 Bash 卡片（見「SDK 0.3 行為核對」）。
- **慢的 MCP server**：第一輪就要用到時，工具是否已可用（⑤）。
- **mac / Linux**：打包產物由 CI 的 `verify-packaged-native`（C2a / runtime-require）確認；server bundle 由 CI 的 `verify-server-bundle` 確認，包含 bat-server 上 headless 的 `import('@anthropic-ai/claude-agent-sdk')`。

### 後續候選

- **Task tools 清單 UI**（`TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`）：依 task id 累積，取代 `TodoWrite` 的快照清單。是否對 Claude 5 模型點名 `tools`，或設 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`，需要另外決策。
- **「Claude Agent V1」改名**：V2 下架後，`V1` 已經沒有對照意義，可考慮改成「Claude Agent」。這是使用者看得到的變更，也牽涉預設標題判斷（`isDefaultTerminalTitle`），本單沒做。
- **`queryOptions` 改用 SDK 的 `Options` 型別宣告**：`runQuery` 目前是 `Record<string, unknown>` 再轉型，改了之後升 SDK 時 typecheck 就能抓到選項改名。
- **npm 12 的 peer `ERESOLVE`**：之後在既有 lock 上再遇到時，可沿用本單的移植加重解比對做法。

### 遭遇問題

- **npm 12.2.1 回自相矛盾的 `ERESOLVE`**：在既有 lock 上升級時發生，細節見「版本與 lock」。改用 scratchpad 解析，再以移植方式產生 lock；重解比對的實質差異為 0。
- **部分檔案在工作目錄是 CRLF**：例如 `agent-presets.ts`、`agent-runtime.ts`（`core.autocrlf=true`，`.gitattributes` 為 `eol=lf`）。編輯時先轉成 LF；committed blob 仍是 LF，diff 只含實際變更。
- **開工後塔台有新 commit**：`c6b9d958`，只改了 `_tower-state.md`，與本單沒有衝突。

### 互動紀錄

無。沒有提問。

唯一的自行判斷：helper `--agent claude-code-v2` 維持原本的行為，不屬於「要改變 helper 介面」，所以沒有送問題給塔台。

### Commit

- `61dff300` feat: retire the Claude Agent V2 preset and migrate saved data to claude-code (T0718)
- `45113164` build: bump embedded Claude Agent SDK to 0.3.316 (T0718)
- `54f52048` docs: Agent SDK 0.3 and the retired Claude Agent V2 preset (T0718)
- 工單：本回報所在的 commit（`chore: T0718 report and close (ct)`）

沒有 push、沒有觸發 workflow、沒有建 tag。CLAUDE.md 為 73,044 bytes，低於 100k 目標。

### 回報時間

2026-11-01T09:00:53+0800
