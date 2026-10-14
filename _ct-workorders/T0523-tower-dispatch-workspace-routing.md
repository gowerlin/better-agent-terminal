---
schema_version: 1
schema_kind: workorder
id: T0523
title: "塔台派工落到錯的工作區 / --agent default 解析錯：讓派工落點與 agent 以塔台終端「目前所屬工作區」為準（BUG-129）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-129
priority: P1
sizing: M
created_at: "2026-10-14T13:31:24+0800"
started_at: null
updated_at: "2026-10-14T13:31:24+0800"
completed_at: null
target_version: "0.6.0-pre.8"
related:
  - BUG-129
  - "T0176（BAT_WORKSPACE_ID 注入）"
  - "T0137 / BUG-031（未帶 --workspace → active workspace，設計行為）"
  - "T0361（external terminal 落點日誌）"
  - "T0130（created-externally → addExternalTerminal）"
affects_files:
  - electron/terminal-command-handlers.ts
  - electron/pty-manager.ts
  - electron/main.ts
  - electron/preload.ts
  - electron/remote/
  - scripts/bat-terminal.mjs
  - src/App.tsx
  - src/stores/workspace-store.ts
  - src/components/WorkspaceView.tsx
  - src/types/
  - electron/__tests__/
  - src/__tests__/
  - src/stores/__tests__/
  - scripts/__tests__/
  - _ct-workorders/T0523-tower-dispatch-workspace-routing.md
  - _ct-workorders/BUG-129-tower-dispatch-lands-in-wrong-workspace.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData、真實 `bat-scripts.log`）；helper 測試設 `BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 到 temp（CLAUDE.md BUG-114 節）。e2e 一律隔離實例。不消耗 Claude token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `src/**` 驗收 `npm run typecheck` = 0；改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 遠端（headless，PLAN-036 K）權杖範圍不得放寬：tower 權杖仍只能 `terminal:create-agent-command`；`BAT_TOWER_TERMINAL_ID` 只能是自己。本機 / 遠端行為都要守住。"
  - "🔴 不改「完全沒帶 `--workspace` → active workspace」的既有設計（T0137 / BUG-031），除非有 notify-id 可推得更正確的落點且在回報區說明。"
---

# T0523 — 塔台派工落點 / agent 以塔台終端所屬工作區為準（BUG-129）

## 背景

Gary（mac，BAT ≥ pre.5）的 Codex 塔台在 **SCB** 工作區派工（`bat-terminal.mjs --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" --agent default …`），Worker 分頁卻出現在 **土銀** 工作區，而且用 Claude Code 開（他預期 Codex）。cwd 是對的（SCB）。現象、三張截圖、初步分析見 **BUG-129**（請先讀並看截圖）。

塔台推定兩個症狀是同一根因：塔台 PTY 帶的 `BAT_WORKSPACE_ID` 不是 SCB（PTY 建立時注入、之後不變），導致落點與 `resolveWorkspaceDefaultAgent(workspaceId)` 都用了別的工作區。**Gary 的日誌尚未取得**（Gower 索取中）。

## 任務

1. **找出 `BAT_WORKSPACE_ID` 會跟分頁目前所屬工作區不一致的所有路徑**（逐條確認、寫進回報區）：分頁在工作區之間移動 / 拖曳、啟動還原、Terminal Server 重新接回既有 PTY（PTY 存活但 renderer 重建）、`pty:restart`、工作區複製 / 匯入、detach / reattach、外部建立（`created-externally` → `addExternalTerminal`）後分頁再被移動、`--workspace` 帶未知 id 時退回 active。哪條最可能是 Gary 的情境，依程式碼判斷
2. **修正方向（建議，Worker 可調整並說明取捨）**：派工的落點與 `default` agent 解析，以「**`--notify-id` 那個塔台終端目前在 renderer 所屬的工作區**」為準，`--workspace` 為次要 / 相容輸入：
   - 兩者一致 → 照舊
   - 不一致 → 用塔台終端實際所屬的工作區，`logger.warn` 記錄兩個 id
   - notify-id 找不到（外部 shell、舊 helper）→ 維持現行（`--workspace` → active）
   - 主行程是否知道「terminal → workspace」的即時對應、需不需要向 renderer 查詢，由 Worker 依架構決定；遠端 headless 的對應方式一併考慮（headless 沒有 renderer workspace）
3. **讓 `BAT_WORKSPACE_ID` 不再過期**（若成本可接受）：例如分頁換工作區時更新 main 端的 terminal→workspace 對應，讓 helper 有可靠來源；PTY 的 env 本身改不了，在回報區說明
4. **`--agent default` 的語意**：確認修正後 `default` = 落點工作區的 `defaultAgent` → `settings.defaultAgent` → `claude-code`。Gary 預期 Codex：判斷這是「工作區解析錯」造成，還是他的 SCB 工作區 / 全域本來就沒設 Codex。若有「塔台本身跑在 Codex，`default` 卻開 Claude」這種 UX 落差，在回報區提出建議即可，不要自行改預設語意
5. **可觀測性**：`bat-terminal.mjs` 成功時的 stdout 與 `bat-scripts.log` 加印實際落點工作區（名稱或 id）與解析出的 agent，讓塔台能自行核對（不得破壞「成功判定只看 exit code」與 `waitForMessage` 以 frame id 比對的既有規則）
6. **Gary 情境的判定方式**：在回報區寫明拿到 Gary 日誌後要看哪幾行（例如 `[T0130] External terminal added … workspaceId(landed)=… workspaceId(requested)=…`、`[agent-command] resolved agent=…`）以及如何對應到第 1 點的哪條路徑

## 驗證

- 單元測試：塔台終端屬 B、`--workspace` 帶 A → 落在 B、agent 用 B 的 default；兩者一致 → 不變；notify-id 未知 → 維持既有行為；未帶 `--workspace` → active（不變）；第 1 點找到的具體過期路徑至少一條有回歸測試
- 遠端 headless：既有 `electron/remote/__tests__/headless-remote-tower-e2e.test.ts`、權杖範圍測試全綠
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` exit 0、`npm run test:unit` 全套無回歸
- 可行的話，用隔離實例做 e2e：兩個工作區，在 B 的終端以 helper 帶 A 的 workspace id 派工，確認落在 B

## 驗收條件

- [ ] 根因路徑清單 + 最可能的 Gary 情境（日誌未到前標明「推論」）
- [ ] 塔台終端所屬工作區與 `--workspace` 不一致時，落點 / agent 以塔台所屬工作區為準
- [ ] helper 輸出 / 日誌可看到實際落點與 agent
- [ ] 遠端權杖範圍不變
- [ ] BUG-129：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」段同步

## Sub-session 執行指示

1. 讀本工單、BUG-129、三張截圖
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單檔案（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
