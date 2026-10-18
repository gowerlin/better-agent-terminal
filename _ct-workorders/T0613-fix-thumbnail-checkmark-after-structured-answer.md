---
schema_version: 1
schema_kind: workorder
id: T0613
title: "BUG-154：結構化提問（`--ask`）答覆後，Worker 縮圖回到「執行中」，不顯示 `✓`、不計入批次關閉"
type: bugfix
status: DONE
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S
created_at: "2026-10-18T09:49:10+0800"
started_at: "2026-10-18T09:50:07+0800"
updated_at: "2026-10-18T09:57:03+0800"
completed_at: "2026-10-18T09:57:03+0800"
depends_on: [T0609, T0612]
related:
  - "BUG-154（T0612 Step 2 安裝版 pre.7 目視：答覆後 Worker 仍在跑，縮圖 `✓`）；BUG-153 / T0609（`workerAttention`、`terminal:attention-changed`、`findReportingWorkers`）；T0607 / T0608 / T0611（PLAN-048 `--ask`）"
affects_files:
  - src/stores/workspace-store.ts
  - src/lib/terminal-attention.ts
  - src/App.tsx
  - "src/components/WorkspaceView.tsx（只在需要時）"
  - "src/types/index.ts（只在需要新欄位型別時）"
  - "scripts/bat-notify.mjs（只在需要讓 `--ask` 的通知帶可辨識的選用欄位時）"
  - "electron/terminal-command-handlers.ts、electron/main.ts、electron/preload.ts、electron/remote/**（只在 `terminal:notify` 需要轉送新選用欄位時）"
  - "src/**/__tests__/**、electron/__tests__/**、scripts/__tests__/**"
  - "e2e/t0611-tower-question.spec.ts、e2e/t0609-worker-attention-badge.spec.ts"
  - "docs/agent-guide/tower-questions.md、docs/agent-guide/worker-tab-recycle.md（CLAUDE.md 只在必守規則改變時動一句）"
  - _ct-workorders/T0613-fix-thumbnail-checkmark-after-structured-answer.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改既有契約的語意：`question:*` channel、helper 的 exit code / stdout、`terminal:get-state` 等回傳不變（T0606 C-1–C-11）。若 `terminal:notify` 需要辨識「這則通知來自 `--ask`」，只能**新增選用欄位**（舊 helper 不帶 = 現行行為），且不得含問題 / 答案內容（D155）。"
  - "🔴 舊 CT 的工單檔提問（訊息結尾 `提問`、不帶 `--ask`）行為不變：`?` 維持到 Worker 下一次通知（T0609 規格）。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；含反斜線的內容用 Write / Edit（L129）；寫檔保持 LF；commit 一律 `git commit --only <檔案…>`。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；e2e 用隔離實例（先 `npx vite build`）。不得對 claude / codex 送出任何 prompt。"
---

# T0613 — BUG-154：結構化提問答覆後不殘留 `✓`

## 背景

見 BUG-154。T0612（`v0.7.0-pre.7` 安裝版）：Worker `bat-notify --ask --source T0612 … "T0612 結構化提問（探針 Step 2）"` → 縮圖 `?`（正確）→ 塔台 `--answer` → Worker 仍在執行，縮圖卻是 `✓`，並被 `findReportingWorkers` 算進「關閉已回報的 Worker 分頁（N）」。

塔台推測（未讀程式碼，請查證）：`--ask` 的通知帶 `--source`，renderer `markWorkerReported` 記下 `workerReport`；問題 pending 時主行程 attention `?` 蓋過它，答覆後 attention 清除，殘留的 `workerReport` 顯示成 `✓`。

⚠️ `e2e/t0611-tower-question.spec.ts` 與 `docs/agent-guide/tower-questions.md` 驗收清單第 2 點目前把「答覆後縮圖回 ✓、N = 1」寫成預期，本單要一併改成新規格。

## 規格

| 情境 | 縮圖 | 計入批次關閉 |
|---|---|---|
| `--ask` 送出、問題 pending | `?`（主行程 attention，現行） | 否 |
| 問題結束（answered / cancelled / expired / lost），之後 Worker 沒再通知 | 無（執行中） | 否 |
| 之後 Worker 送一般通知（完成 / BLOCKED / 需要協助） | `✓` | 是 |
| `--ask` 之前已有 `✓`（例 先回報過再提問） | 問題結束後同樣回到無標示（提問代表 Worker 仍在工作） | 否 |

- 本機與遠端視窗（RemoteClient proxied）行為一致；事件驅動、renderer 不輪詢。
- 判斷集中在既有唯一實作（`workerAttention` / `findReportingWorkers` / `markWorkerReported`），不在 consumer 內聯。

## 任務

1. 查證根因（回報區寫出實際的資料流）。
2. 選一種做法讓 `--ask` 的通知不留下 `workerReport`（例：通知帶選用欄位標示提問；或 renderer 依主行程 attention 變化清除；擇一並寫理由，含舊 helper / 舊 BAT 的相容性）。
3. 測試：store / attention 單元測試（上表四列 + 舊 CT `提問` 後備不變）；若改 helper / 主行程，補對應測試；更新 `e2e/t0611-tower-question.spec.ts` 答覆後的預期（無標示、N = 0），再送一般通知 → `✓`、N = 1；`e2e/t0609-worker-attention-badge.spec.ts` 照跑。
4. 文件：`docs/agent-guide/tower-questions.md`（驗收清單第 2 點）、`docs/agent-guide/worker-tab-recycle.md` 同步。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠（回報 passed / files 數）；`e2e/t0611-tower-question.spec.ts`、`e2e/t0609-worker-attention-badge.spec.ts` 通過。
2. 回報區附：根因、做法與理由、相容性（舊 helper / 舊 BAT / 遠端）、變更檔案清單。

---

## 回報區

### 結果摘要

✅ FIXED。`bat-notify --ask` 的 `terminal:notify` 多帶選用欄位 `questionId`（只有 id），主行程驗證格式後轉送，renderer `markWorkerReported` 遇到它就移除該分頁的 `workerReport` / `workerQuestion`、不記新值。問題 pending 時 `?`（主行程 attention，不變）；問題結束後無標示、N 不計；Worker 下一次一般通知才是 `✓`。

### Landing Zone Check：PASS

- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：前 5 個可測項目（`src/stores/workspace-store.ts`、`src/lib/terminal-attention.ts`、`src/App.tsx`、其餘帶括號說明者以祖先目錄判定）皆存在 → PASS（資訊性）
- C-2：無 `branch` 欄位，略過；目前分支 `main`
- `CT_HOME` 未設定（非 worktree 派工）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 根因（實際資料流，已查證；塔台推測正確，另有第二個症狀）

1. `scripts/bat-notify.mjs --ask`：`question:ask` 成功 → 主行程 `TowerQuestionStore` `onChange` → `TerminalAttentionNotifier` 送 `terminal:attention-changed { pendingQuestions: 1, blockedReason: 'tower' }` → renderer `terminal-attention-store`。
2. 接著同一 helper 送一般的 `terminal:notify { targetId, message, source: 'T####' }` → `electron/handlers/terminal.ts` → `terminal:notified` → `App.tsx` `onTerminalNotified` → `workspaceStore.markWorkerReported(info)`。
3. `markWorkerReported` 只看訊息文字：
   - 不以 `提問` 結尾（T0612 的 `T0612 結構化提問（探針 Step 2）`）→ 寫 `workerReport`。
   - 以 `提問` 結尾（CT 慣例 `T#### 提問`）→ 寫 `workerQuestion`（舊 CT 後備）。
4. `workerAttention`：attention 有問題時 `?` 優先，蓋住上面兩者。答覆後主行程送空 attention → renderer 忘掉該分頁 → 退回殘留的 `workerReport` → `✓`，`reportedWorkersOfTower` 算進 N（BUG-154）；若訊息以 `提問` 結尾則殘留 `workerQuestion` → 答覆後仍是 `?`（同一根因的第二個症狀，CT 真實訊息就是這種）。

### 做法與理由

選「通知帶選用欄位」（不選「renderer 依 attention 變化清除」）：

- 精確：只有 `--ask` 的那一則通知不算回報。若改成「通知到達時該分頁有 pending 問題就不記回報」，Worker 帶著 non-blocking 問題送 `完成` 時，答覆後會失去 `✓`（新的回歸）；若改成「attention 出現問題就清回報」，則依事件先後與 non-blocking 問題也有同類誤判。
- 欄位只放 question id（`q-<boot>-<rand>`），不含問題 / 答案內容（D155）；主行程只轉送符合 `QUESTION_ID_PATTERN` 的值（不符即丟棄，其他欄位照舊）。
- 判斷集中：新增 `workerNotifyKind`（`src/lib/terminal-attention.ts`，`ask` / `question` / `report`），`markWorkerReported` 與 `App.tsx` 日誌共用；`workerAttention` / `findReportingWorkers` 不變。
- 事件先後無關：通知只清除不設定，`?` 永遠來自 attention；單元測試涵蓋「通知先於 attention」。

### 相容性

- 舊 helper（不帶 `questionId`）+ 新 BAT：照訊息判斷，等同修正前行為（helper 隨 BAT 安裝，正常情況同版）。
- 新 helper + 舊 BAT：舊 `terminal:notify` handler 只取 `targetId` / `message` / `source`，多出的欄位被忽略；`helper-capability` 授權只看 `targetId`，不受影響。helper 的 exit code / stdout 不變。
- 遠端（WSL / SSH / Docker）：`terminal:notify` handler 本機與 headless 共用（`electron/handlers/terminal.ts`）；`terminal:notified` 在 `PROXIED_EVENTS`，RemoteClient 原樣轉送，判斷同在 renderer → 行為一致。舊 server bundle 不帶欄位 → 舊行為，升級 bundle 後生效。
- 不帶 `--ask` 的舊 CT `T#### 提問`：不變（`workerQuestion`，`?` 維持到 Worker 下一次通知）。
- `question:*` channel、`terminal:get-state` 等回傳、helper exit code / stdout 皆未改（T0606 C-1–C-11）。

### 變更檔案

- `scripts/bat-notify.mjs`：`--ask` 的 `terminal:notify` 帶 `questionId`
- `electron/handlers/terminal.ts`：驗證並轉送 `questionId`；日誌 / bat-scripts.log 多記 id
- `electron/preload.ts`、`src/types/electron.d.ts`：`onTerminalNotified` 型別加 `questionId?`
- `electron/remote/path-aware-channels.ts`：channel 說明字串
- `src/lib/terminal-attention.ts`：`workerNotifyKind` + 檔頭說明
- `src/stores/workspace-store.ts`：`markWorkerReported` 依 `workerNotifyKind` 處理
- `src/App.tsx`：日誌 `[T0613] Worker asked its Tower (structured) … question=<id>`
- `src/types/index.ts`：`workerQuestion` 註解
- 測試：`src/stores/__tests__/workspace-store.workerAttention.test.ts`（+6：`workerNotifyKind`、規格表四列、事件先後、舊 CT 後備不變）、`electron/__tests__/terminal-handlers.test.ts`（+1：轉送 / 丟棄格式不符）、`scripts/__tests__/bat-notify-questions.test.mjs`（`--ask` 帶 id、一般通知不帶）
- e2e：`e2e/t0611-tower-question.spec.ts` 答覆後預期改為無標示（無 `data-attention`）、N = 0；再送 `T0611 完成` → `✓`、N = 1；之後第二題從 `✓` 狀態提問 → `?`、N = 0（規格第 4 列）
- 文件：`docs/agent-guide/tower-questions.md`（流程、徽章規則與相容性、驗收清單第 1 / 2 點）、`docs/agent-guide/worker-tab-recycle.md`（狀態表、後備說明、驗證清單）。CLAUDE.md 未動（必守規則未改變）。

### 驗證

| Gate | 結果 | 證據 |
|---|---|---|
| `npx vite build` | PASS | exit 0 |
| `npm run typecheck` | PASS | `tsc --noEmit -p .` exit 0 |
| `npm run typecheck:electron` | PASS | exit 0 |
| `npm run test:unit` | PASS | Test Files 301 passed (301)；Tests 5233 passed / 3 skipped (5236) |
| e2e `e2e/t0611-tower-question.spec.ts` | PASS | 32.7 s，隔離實例（`launchIsolated`），未碰 port 9876 |
| e2e `e2e/t0609-worker-attention-badge.spec.ts` | PASS | 4.6 s |

e2e 的新斷言（答覆後 `.worker-badge[data-attention]` 為 0、N = 0）在修正前必失敗：該題訊息 `T0611 等塔台答覆` 不以 `提問` 結尾，舊邏輯會寫 `workerReport` → `✓`。未對 claude / codex 送任何 prompt（e2e 的 Worker 是自訂 CLI 跑 node 腳本）。

### Commit

- `7bfe225c` `fix(T0613): BUG-154 --ask notify no longer leaves a Worker report (✓) behind`（`git commit --only` 15 個檔案；`src/styles/settings.css` 未納入）
- 工單檔另一個 commit。未 push、未建 tag、未改版號。

### 偏差 / 後續

- 無偏差。
- 已知限制：舊 helper / 舊遠端 server bundle 仍是修正前行為，直到隨 BAT 升級。
- 建議：安裝版（下一個預覽版）照 T0612 Step 2 再目視一次：`--ask` → `?` → `--answer` → 無標示、N = 0 → Worker 一般通知 → `✓`。
