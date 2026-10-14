---
schema_version: 1
schema_kind: workorder
id: T0527
title: "塔台派工 cwd 與落點工作區 folderPath 一致性檢查（不一致警告；yolo 且 cwd 明確屬於另一個工作區時拒派）＋ --agent 簡寫 / 未知 agent id 提示（BUG-132）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-132
priority: P1
sizing: S
created_at: "2026-10-14T17:04:00+0800"
started_at: ""
updated_at: "2026-10-14T17:04:00+0800"
completed_at: ""
target_version: "0.6.0-pre.9"
related:
  - BUG-132
  - BUG-129
  - "T0526（判定 #11，回報區「建議方向」[B] 與「建議下一步」第 1、4 點）"
  - "T0523（electron/dispatch-workspace.ts、helper 落點輸出、e2e/t0523-dispatch-workspace.spec.ts）"
  - "T0137 / BUG-031（不以 cwd 當落點主規則）"
  - "T0450（headless tower 權杖：agent 必須是 registry 已知 id）"
  - D141
affects_files:
  - electron/dispatch-workspace.ts
  - electron/terminal-command-handlers.ts
  - electron/main.ts
  - scripts/bat-terminal.mjs
  - src/App.tsx
  - src/stores/workspace-store.ts
  - electron/__tests__/
  - scripts/__tests__/
  - src/stores/__tests__/
  - e2e/
  - CLAUDE.md
  - _ct-workorders/T0527-dispatch-cwd-workspace-consistency-check.md
  - _ct-workorders/BUG-132-agent-cli-stale-bat-env-misroutes-dispatch.md
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
  - "🔴 不改 T0137 / D140 的既有語意：cwd **不是**落點規則，只做檢核；`--agent default` 查找順序不變；T0523 的「塔台終端優先」不變。"
  - "🔴 遠端 headless 權杖範圍不得放寬（PLAN-036 K / T0450）：agent 簡寫若要在遠端生效，必須先正規化成 registry 已知 id 再過權杖檢查，不得讓未知 id 通過。"
  - "🔴 helper 成功判定只看 exit code；`waitForMessage` 以 frame id 比對的規則不變（BUG-114）。"
---

# T0527 — 派工 cwd / 落點工作區一致性檢查 + `--agent` 簡寫（BUG-132）

## 背景

T0526 以 Gary 的日誌判定 BUG-129 屬於 T0523 §1 的 **#11**：Gary 的 Codex 在 SCB 分頁執行指令時，看到的 `BAT_TERMINAL_ID` / `BAT_WORKSPACE_ID` 是**土銀塔台分頁**的值（agent CLI 自己保存的環境），所以 `--notify-id` 與 `--workspace` 都錯，T0523 的「塔台終端優先」也救不回來。yolo 模式下，Worker 的完成訊息還會被**送進**土銀塔台並觸發它的流程。

根治（以 PID 祖先鏈辨識呼叫者 PTY）成本較高，先做便宜、能直接抓到這個情境的檢核（D141，T0526 建議 [B]）。請先讀 **BUG-132**、**T0526 回報區**（「判定結果」「建議方向」「建議下一步」）、**T0523 回報區第 1-4 節**。

## 任務

1. **cwd 一致性檢查**（本機 `terminal:create-agent-command` 與 `terminal:create-with-command` 由外部 helper 呼叫的路徑）：
   - main 解析出落點工作區之後（T0523 `electron/dispatch-workspace.ts` 的結果），比對派工的 `cwd`（helper `--cwd`，或 helper 送出的 `process.cwd()`）是否位於落點工作區的 `folderPath` 底下
   - 路徑比對：正規化分隔符號與結尾斜線；Windows / macOS 不分大小寫（mac 預設 APFS 不分大小寫，Linux 分）；`folderPath` 為空或解析不到時**跳過檢查**；是否需要 realpath（symlink、Google Drive / iCloud 這類路徑）由 Worker 判斷並說明取捨
   - 同時找出「cwd 位於哪些其他工作區的 `folderPath` 底下」，取最長前綴的那一個作為 `cwdWorkspace`（巢狀工作區時以最深者為準）
2. **處置**：
   | 情況 | 行為 |
   |---|---|
   | cwd 在落點工作區底下，或落點工作區沒有 `folderPath` | 照舊 |
   | cwd 不在落點工作區底下，也不屬於任何其他工作區 | 照舊建立；helper stderr 警告 + main `logger.warn`（可能是跨專案派工，不擋） |
   | cwd 不在落點工作區底下，**且明確屬於另一個工作區** `cwdWorkspace` | **非 yolo**：照舊建立 + 警告（列出落點與 `cwdWorkspace` 的名稱 / id）。**yolo**（`--mode yolo`）：**拒絕建立**，helper exit 1，訊息說明「塔台的 `BAT_*` 可能來自別的分頁（agent CLI 保存的舊環境）」，列出 `cwdWorkspace` 名稱 / id，並提示請使用者確認後改派 |
   - 日誌 tag 用 `[BUG-132]`；`bat-scripts.log` 記錄檢查結果（落點、`cwdWorkspace`、處置）
   - 拒絕的回應格式要讓 helper 能區分原因（不只是 `terminal-not-created`），沿用 T0456 / T0523 既有的錯誤回傳方式
3. **`--agent` 簡寫與未知 id 提示**（T0526 建議下一步第 4 點）：
   - `--agent codex` / `--agent claude` 這類常見簡寫正規化成 registry 已知 id（`codex-cli` / `claude-cli`；以實際 agent registry 為準，不要硬編碼不存在的 id）
   - 仍然不認得的 agent id：helper 印出「不認得的 agent id」與可用 id 清單，exit 1（目前只有 `terminal-not-created`）
   - 遠端 headless：正規化必須在權杖 `agent-not-allowed` 檢查之前做且只映射到已知 id；若成本或風險過高，只做本機並在回報區說明
4. **遠端 headless**：server 端沒有工作區 `folderPath`，落點由 client renderer `addExternalTerminal` 決定（T0523）。評估 renderer 端能否做同樣的檢查；可行且小則一併做，否則在回報區說明並留給後續
5. **文件**：CLAUDE.md「塔台派工落點（T0523 / BUG-129）」那一條補上 BUG-132 的檢查規則與 yolo 拒派行為（精簡，比照該節現有寫法）

## 驗證

- 單元測試：路徑比對（大小寫、分隔符號、結尾斜線、巢狀工作區取最深、`folderPath` 空）；三種處置各至少一條；yolo 拒派；非 yolo 只警告；`--agent codex` 正規化；未知 agent id 的錯誤與 exit code
- helper 測試：拒派時 exit 1 且 stderr 有可辨識訊息；成功路徑輸出與 T0523 一致（不回歸）
- 遠端 headless：既有 `electron/remote/__tests__/headless-remote-tower-e2e.test.ts`、權杖範圍測試全綠
- 擴充 `e2e/t0523-dispatch-workspace.spec.ts`（或新 spec，隔離實例）：兩個工作區各有 `folderPath`，在 A 的終端以 B 的 cwd 派工 → 非 yolo 落在 A + 警告；yolo → 拒派
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` exit 0、`npm run test:unit` 全套無回歸

## 驗收條件

- [ ] cwd 與落點工作區不一致時有警告（helper + main log + `bat-scripts.log`）
- [ ] yolo 且 cwd 明確屬於另一個工作區 → 拒派 exit 1，訊息可行動
- [ ] 跨專案派工（cwd 不屬於任何工作區）不被擋
- [ ] `--agent codex` 可用；未知 agent id 有清楚錯誤
- [ ] 遠端權杖範圍不變
- [ ] CLAUDE.md 同步；BUG-132：`status: FIXED`、`fixed_at`、body 狀態列同步

## Sub-session 執行指示

1. 讀本工單、BUG-132、T0526 回報區、T0523 回報區第 1-4 節
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單檔案（`--only`）；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

### 修改檔案

### 驗證

### 遠端 headless 評估

### 偏差 / 備註

### Commit
