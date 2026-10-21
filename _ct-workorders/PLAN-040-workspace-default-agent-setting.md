---
schema_version: 1
schema_kind: plan
id: PLAN-040
title: 工作區層級預設 Agent ＋ Agent 啟動參數設定（補上 `Workspace.defaultAgent` 的設定入口，新增工作區 `agentCustomArgs` 覆寫）
status: DONE
priority: medium
created_at: "2026-10-14T14:23:48+0800"
updated_at: "2026-10-14T18:06:22+0800"
target_batch: "0.6.0-pre.10"
workorders: [T0529]
links:
  related: [BUG-129, T0523, D140]
---

# PLAN-040 — 工作區層級預設 Agent 設定

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-040 |
| 優先級 | 🟡 Medium |
| 狀態 | ✅ DONE（2026-10-14 18:06 T0529 實作完成；實機驗收隨 0.6.0-pre.10。17:50 派 T0529，使用者決定範圍擴大納入啟動參數，D142） |
| 來源 | BUG-129 / D140 更正：使用者指出「目前預設 Agent 只有全域設定，沒有可針對個別工作區」 |

## 背景與動機

- 外部測試者A 在兩個專案都用 Codex 當塔台，`--agent default` 卻開出 Claude（BUG-129）。D140 決定不改 `default` 的查找順序（工作區預設 → 全域 Settings → `claude-code`）
- 但查找順序的第一層**沒有設定入口**：`Workspace.defaultAgent` 欄位存在（`src/types/index.ts:18`），而且有 4 處在讀（`src/App.tsx:855/875` 派工按鈕、`src/components/WorkspaceView.tsx:519/641/662` 新建 Agent 終端與派工、`electron/main.ts:543` 外部派工 `resolveWorkspaceDefaultAgent`），可是 store 與 UI 都沒有寫入點 ⇒ 永遠是空的
- 補上後，使用者可以「這個專案用 Codex、那個專案用 Claude」，不必改全域設定

## 範圍（初稿，開工單時細化）

1. **設定入口**：建議放在既有的工作區設定對話框（`src/components/WorkspaceEnvDialog.tsx`，工作區環境變數已在這裡），或工作區右鍵選單；選項 = 「跟隨全域（Settings）」+ 所有 agent preset（含 codex-cli、claude-cli、worktree 變體等，清單與 Settings 的預設 Agent 下拉一致）
2. **store**：`workspace-store.ts` 新增 `setWorkspaceDefaultAgent(id, agent | undefined)`，比照 `setWorkspaceEnvVars` 的寫法與持久化
3. **顯示**：工作區設定裡顯示「目前生效的 agent 與來源」（工作區 / 全域 / 內建）；Sidebar 是否標示由 UX 決定
4. **持久化邊界**：
   - 🔴 detached 視窗：`workspace:save` 只合併該工作區的**終端清單**（CLAUDE.md「Detached workspace 視窗的持久化」），從 detached 視窗改設定不會寫進父 entry ⇒ 要嘛 detached 視窗不提供此設定，要嘛另走 main 端 `updateEntry` 寫入，開工單時決定
   - profile snapshot / 匯出入、多視窗（同 profile 另一視窗的 store 何時看到新值）
5. **生效範圍**：本機派工按鈕、新建 Agent 終端、外部 helper 派工（`--agent default`，T0523 起以塔台所屬工作區解析）。遠端 headless 沒有工作區預設（`terminal-command-handlers.ts` 註解：headless 用 `<dataDir>/settings.json`），是否由 client 帶入另議
6. **文件**：Settings 預設 Agent 的提示文字（`settings.defaultAgentHint`）補一句「可在工作區設定覆寫」；CLAUDE.md 補查找順序

## 範圍擴大（D142，2026-10-14 17:50）

- 新增工作區層級 **Agent 啟動參數**覆寫：`Workspace.agentCustomArgs?: Record<presetId, string>`，以 preset 為單位取代全域 `settings.agentCustomArgs`（無 key = 跟隨全域；有 key 含空字串 = 取代）
- 外部 helper `--agent` 派工套用落點工作區的生效參數（與 UI 按鈕一致）；raw command 模式不加
- detached 視窗設定入口只讀（第 4 點持久化邊界的決定）
- 實作工單：**T0529**

## 實作（T0529，2026-10-14）

- 解析集中於 `src/lib/agent-launch-settings.ts`（`resolveEffectiveDefaultAgent` / `resolveEffectiveAgentArgs`），renderer 與 main（`electron/terminal-command-handlers.ts`）共用同一份
- 設定入口：工作區右鍵 →「工作區設定…」（`WorkspaceEnvDialog.tsx` 改為工作區設定，環境變數成為其中一區）：預設 Agent 下拉（跟隨全域（目前：X）+ preset）、各 preset「覆寫」勾選 + 參數欄（未勾選顯示全域值唯讀）、目前生效值與來源（此工作區 / 全域設定 / 內建預設）；Settings 兩處提示補「可在工作區設定覆寫」；三語
- store：`setWorkspaceDefaultAgent` / `setWorkspaceAgentCustomArg`（每次變更立即 save）+ `getEffectiveDefaultAgent` / `getEffectiveAgentArgs`
- consumer：`App.tsx` CT 按鈕、`WorkspaceView.tsx` 全部 Agent 啟動點；`agent:build-launch-command` 帶生效參數；helper `--agent` 派工（含 `default` 與指定 id）以落點工作區解析，raw command 模式不變
- 查證：helper agent 模式自 `3abfb98`（2026-04-25）起即套用全域 `agentCustomArgs`，`_local-rules.md` 舊記載「暫不支援」有誤，已更正
- 持久化邊界（第 4 點）：detached 視窗只讀（分頁列齒輪按鈕開唯讀對話框）；主視窗 sidebar 不列 detached 工作區，detach 期間無法修改；profile / 匯出入沿用整個工作區物件，不另處理
- 遠端 headless 不做（server 只讀 `<dataDir>/settings.json`）；遠端視窗的 UI 按鈕在 client 端算生效值，照樣生效
- 文件：CLAUDE.md「工作區層級 Agent / 啟動參數」、`_local-rules.md`「Agent 自訂參數自動套用」

## 不在範圍

- 改 `--agent default` 的查找順序或「沿用塔台自身 agent」（D140 選項 B，不做）

## 驗收方向

- 單元：store 設定 / 清除 / 持久化；三處 consumer 取到工作區值；「跟隨全域」= 未設定
- e2e（隔離實例）：兩個工作區分別設 codex / 跟隨全域，派工與新建 Agent 終端開出對應 agent（用 echo 自訂 agent，不消耗 token，比照 `e2e/t0523-dispatch-workspace.spec.ts`）
- 三語 i18n、`npm run typecheck` / `typecheck:electron` = 0
