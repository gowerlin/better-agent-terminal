---
schema_version: 1
schema_kind: workorder
id: T0613
title: "BUG-154：結構化提問（`--ask`）答覆後，Worker 縮圖回到「執行中」，不顯示 `✓`、不計入批次關閉"
type: bugfix
status: TODO
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S
created_at: "2026-10-18T09:49:10+0800"
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

（Worker 填寫）
