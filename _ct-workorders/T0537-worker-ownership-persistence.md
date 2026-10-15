---
schema_version: 1
schema_kind: workorder
id: T0537
title: "PLAN-041 B'-4：持久化 Worker 歸屬（塔台 id + 工單編號），BAT 重開後 `--close-worker` 仍有效"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-041
priority: P3
sizing: S-M
created_at: "2026-10-15T15:44:39+0800"
started_at: "2026-10-15T16:44:05+0800"
updated_at: "2026-10-15T16:54:42+0800"
completed_at: "2026-10-15T16:54:42+0800"
target_version: "0.6.1-pre.3"
depends_on: [T0535]
related:
  - PLAN-041
  - T0534（研究回報 §1.4：BAT 重開後主行程失去歸屬）
  - D144
affects_files:
  - src/types/index.ts
  - src/stores/workspace-store.ts
  - electron/terminal-command-handlers.ts
  - electron/pty-manager.ts
  - src/components/WorkspaceView.tsx
  - src/**/__tests__/
  - electron/__tests__/
  - e2e/
  - CLAUDE.md
  - _ct-workorders/T0537-worker-ownership-persistence.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）。e2e 一律隔離實例，不耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0；`npx vite build` 成功。"
  - "🔴 detached 視窗持久化語意不得改變（`saveDetachedWorkspaceTerminals` 只合併終端清單；CLAUDE.md「Detached workspace 視窗的持久化」）。新欄位隨終端物件一起序列化即可。"
---

# T0537 — 持久化 Worker 歸屬

## 背景

T0535 的歸屬只存在主行程記憶體（`PtyInstance.customEnv.BAT_TOWER_TERMINAL_ID` / `workorder`）。BAT 重開後 Terminal Server replay 重新註冊的 PTY 不帶 `customEnv`（`pty-manager.ts` `handleReplayList`），`--close-worker` 只能回 `NOT_FOUND`。分頁 id 在重開後不變，塔台分頁 id 也不變，所以只要把歸屬存下來就能接續。

## 任務

1. `TerminalInstance` 新增 `towerTerminalId?: string`、`workorder?: string`（`src/types/index.ts`）。
2. `terminal:created-externally` 事件帶上 `workorder`（`terminal-command-handlers.ts`）；`addExternalTerminal` 寫入兩個欄位；`save()` / `applySerializedData` 序列化往返。
3. 重開後還原時把歸屬交回主行程，讓 T0535 的 `findWorkerTerminals` 照常運作。做法由 Worker 決定並在回報區說明理由，例如：
   - renderer 還原分頁時呼叫 `pty:create` / 新 IPC 帶上 `towerTerminalId` / `workorder`，PtyManager 補登記；或
   - 主行程查詢時 fallback 到 window registry 的終端清單。
   不論哪種做法：歸屬只能來自 BAT 自己存的資料，不得由 helper 參數宣告。
4. 塔台分頁本身被關掉或改名不影響已存的歸屬；Worker 分頁被使用者手動 ✕ 後，歸屬隨分頁移除。
5. 文件：CLAUDE.md「Worker 分頁回收（PLAN-041）」移除「BAT 重開後 `NOT_FOUND`」限制，改寫為實際行為（含 Terminal Server 未存活時，Worker 分頁還原成空 shell，仍可被回收）。

## 驗收條件

- [ ] 單元測試：序列化往返；`addExternalTerminal` 寫入；舊資料（無新欄位）載入不變
- [ ] e2e（隔離實例）：派工 → 關閉並重開實例 → 塔台以同一 id 呼叫 `--close-worker` → 成功關閉；detached 視窗中的 Worker 同樣適用
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、相關單元測試全綠

## 範圍外

- 分頁列標示 Worker / 已回報、右鍵批次關閉（方案 D，另案）

## 回報區

### 落點檢查（Landing Zone）

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：前 5 個非萬用字元 `affects_files` 皆存在 → PASS（資訊性）
- C-2：工單無 `branch` 欄位；目前 `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 結果摘要

完成。分頁存歸屬，主行程在 `--close-worker` 查詢時以 window registry 已存分頁補足本行程沒記錄的 Worker；BAT 重開後（Terminal Server 存活或未存活）塔台以同一 id 呼叫 `--close-worker` 可成功關閉，detached 視窗亦同。

1. `TerminalInstance` 新增 `towerTerminalId?` / `workorder?`（`src/types/index.ts`）。
2. `terminal:created-externally` payload 帶 `workorder`（`normalizeWorkorderId` 正規化，只在 PTY 有記錄時；prompt 模式不帶）（`electron/terminal-command-handlers.ts`）；`onCreatedExternally` 型別同步（`src/types/electron.d.ts`、`electron/preload.ts`）。`addExternalTerminal` 寫入兩欄位；`save()` 序列化、`toTerminalInstance`（`applySerializedData` 與 detached adopt 共用）還原，只收非空字串（`workerOwnership()`，`src/stores/workspace-store.ts`）。
3. **還原做法：主行程查詢時 fallback 到 window registry**（工單選項 2）。新模組 `electron/worker-ownership.ts`：
   - `savedWorkerOwnership(entries)`：從 registry entries 取出有 Tower id + 合法工單（正規化）的分頁；同 id 第一筆為準。
   - `withSavedWorkerOwnership(ptys, getSaved, logger)`：包住 PtyManager 給 `WorkerCloseScheduler`。本行程**沒記錄工單**且 **PTY 執行中**的 id 才用已存歸屬；本行程有記錄者（本次派工、`pty:restart`、recovery）優先。每次請求讀一次 registry 快取。命中記 `[close-worker] id=… workorder=…: ownership from the saved tab (tower=…)`。
   - `PtyManager.getWorkorder(id)`（`electron/pty-manager.ts`，並更新 `workorder` 欄位註解）。
   - main.ts：`getPtyManager: () => ptyManager ? withSavedWorkerOwnership(ptyManager, () => savedWorkerOwnership(windowRegistry.getCachedEntries()), logger) : null`。
   - **選這個做法的理由**：(a) registry 有所有已存分頁，所以 Terminal Server 存活時，BAT 重開後尚未開啟的工作區（PTY 已由 T0108 replay 註冊，但 renderer 還沒送 `pty:create`）也找得到——「restored tab 帶參數呼叫 `pty:create`」的做法涵蓋不到這種情況；(b) 歸屬只來自 BAT 視窗存的資料：`workspace:save` 要求 `ctx.windowId`，經 RemoteServer 的 helper 呼叫會回 `false`，不會多出可由 helper 參數宣告歸屬的 IPC 面（若改用 `pty:create` 帶歸屬，全權 token 的 helper 就能對既有 id 宣告）；(c) 不動 renderer 還原流程（`WorkspaceView.tsx` 未改），detached 持久化語意不變（`saveDetachedWorkspaceTerminals` 原樣合併終端物件，新欄位跟著物件走）。
   - 遠端 headless：不讀 client registry，行為不變（server 未重啟時記錄本就還在 server 記憶體）。
4. 塔台分頁關閉 / 改名：歸屬存在 Worker 分頁上，與塔台分頁無關（單元測試涵蓋）。Worker 分頁 ✕：`closeTerminalNow` → `removeTerminal` + `save()`，歸屬隨分頁移除；PTY 被 kill 後也不再算執行中。
5. CLAUDE.md「Worker 分頁回收（PLAN-041）」：新增「BAT 重開後（T0537）」條目寫實際行為（含 Terminal Server 未存活 → 分頁還原成空 shell 仍可回收；尚未開啟的工作區 → `NOT_FOUND`，切過去或 detach 後即可）；「已知限制」移除「BAT 重開後 `NOT_FOUND`」；遠端 headless 條目補一句 client 存的歸屬不用於遠端；驗證清單補上新測試。

### 變更檔案

- `src/types/index.ts`、`src/types/electron.d.ts`、`electron/preload.ts`
- `src/stores/workspace-store.ts`
- `electron/terminal-command-handlers.ts`
- `electron/pty-manager.ts`
- `electron/worker-ownership.ts`（新）
- `electron/main.ts`（scheduler 接線 + import；`affects_files` 未列，屬接線必要變更）
- `electron/__tests__/terminal-handlers.test.ts`（5 個 payload 斷言補 `workorder` + 新增 1 案）
- `electron/__tests__/worker-ownership.test.ts`（新，12 案）
- `src/stores/__tests__/workspace-store.workerOwnership.test.ts`（新，6 案）
- `e2e/t0537-worker-ownership-persistence.spec.ts`（新）
- `CLAUDE.md`

未動：`src/components/WorkspaceView.tsx`（做法不需要）、`src/styles/settings.css`（非本工單，未 commit）。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm run typecheck` | PASS | 0 error |
| `npm run typecheck:electron` | PASS | 0 error |
| `npx vite build` | PASS | `✓ built` |
| 單元測試（全套 `npm run test:unit`） | PASS | 232 files，3881 passed / 1 skipped |
| 單元：序列化往返、`addExternalTerminal` 寫入、舊資料載入不變、detached adopt、✕ 移除 | PASS | `workspace-store.workerOwnership.test.ts` 6/6 |
| 單元：已存歸屬解析、replay 註冊 / 空 shell 還原 → ok、NOT_OWNER、NOT_FOUND（未執行 / 舊資料 / ✕ 後）、本行程記錄優先、AMBIGUOUS、塔台分頁不必存在 | PASS | `worker-ownership.test.ts` 12/12 |
| e2e（隔離實例）：派工 → 關閉並重開實例（Terminal Server 一併停）→ Tower B 問 T0537 = NOT_OWNER → Tower A `--close-worker` 成功、分頁與 registry 移除；工作區 B 未開啟 → NOT_FOUND；detach 後 Tower B 成功關閉 detached 視窗的 Worker | PASS | `npx playwright test e2e/t0537-worker-ownership-persistence.spec.ts` 1 passed（16.2s），debug log 含 `ownership from the saved tab` 與 `closing tab … (detached window)` |
| 回歸 e2e T0535 | PASS | `e2e/t0535-close-worker.spec.ts` 1 passed（27.8s） |

e2e 以隔離實例執行，跑前清掉 `BAT_*` / `CT_*`，未碰使用者的 BAT（port 9876、真實 userData）；未跑全套 e2e。「Terminal Server 存活 + replay」路徑只有單元測試（需在重開時回應 recovery 提示，e2e fixture 預設停掉 server）。

### Commit

- `e965f993` feat: T0537 persist Worker ownership so --close-worker works after BAT reopens (PLAN-041)（`git commit --only`，未含 `src/styles/settings.css`；未 push）

### 偏離 / 後續

- 偏離：`electron/main.ts` 不在 `affects_files`，屬接線必要；`WorkspaceView.tsx` 在 `affects_files` 但未改。
- 殘餘限制（已寫進 CLAUDE.md）：Terminal Server 未存活時，BAT 重開後尚未開啟的工作區，其 Worker 的 PTY 尚未還原 → `NOT_FOUND`，需先切到該工作區或 detach。若要涵蓋，需另案（例如對無 PTY 的分頁直接送 `terminal:close-requested`）。
- 無需塔台決策的事項。
