---
schema_version: 1
schema_kind: workorder
id: T0611
title: "PLAN-048 C：Worker 問塔台 — 完整流程 e2e、文件收尾（併入 T0608 草稿）、`--cancel-question` 對 `lost` 對齊主行程"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S-M
created_at: "2026-10-18T07:04:54+0800"
started_at: ""
updated_at: "2026-10-18T07:04:54+0800"
completed_at: ""
depends_on: [T0607, T0608, T0609, T0610]
related:
  - "T0606 契約 C-1–C-11、「實作切分」C 節；T0607（主行程）、T0608（helper / MCP，回報區「文件草稿」(1)(2)(3)）、T0609（縮圖 `?` / ⚠️、`terminal:attention-changed`）、T0610（合併；回報區「語意檢查」helper 往返實測表與「已知不一致的實際行為」）"
affects_files:
  - "e2e/t0611-tower-question.spec.ts（新）"
  - scripts/bat-notify.mjs
  - "scripts/__tests__/bat-notify-questions.test.mjs、scripts/__tests__/_question-mock-remote.mjs"
  - CLAUDE.md
  - "docs/agent-guide/tower-questions.md、docs/agent-guide/bat-mcp-shim.md"
  - _ct-workorders/T0611-tower-questions-e2e-and-docs.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改主行程契約與 `electron/**`；`scripts/bat-notify.mjs` 只改 `--cancel-question` 的 `lost` 處理與 `--help`。發現其他契約問題 → `T0611 提問`，不得自行改。"
  - "🔴 CLAUDE.md `##` 標題不改名（T0595 規則；「Worker 問塔台（PLAN-048 / T0607）」維持原標題），只改節內文字，每節 3–12 行原則；細節寫進 docs。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；含反斜線的內容用 Write / Edit 工具（L129）；寫檔保持 LF；commit 一律 `git commit --only <檔案…>`。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）；e2e 用隔離實例（先 `npx vite build`）。不得對 claude / codex 送出任何 prompt；分頁內以 node 腳本扮演 Worker / 塔台。"
---

# T0611 — PLAN-048 C：e2e 與文件收尾

## 背景

PLAN-048 的 A（T0607）、B（T0608，T0610 合併）、BUG-153（T0609）都已在 `main`（`4e5f5e7f`）。T0610 用真 headless 跑過 helper 往返，全部符合契約；只有一點不一致：`--cancel-question` 對 `lost` 的處理。

**塔台裁定（契約 C-3 為準）**：`question:cancel` 遇到已結束的問題（含 `lost`）回現狀、不是錯誤，主行程現行行為正確。helper `--cancel-question` 對 `lost` 一律 **exit 0**，stdout `✓ Question already ended: <id>` + `  status: lost`（現況即如此）；刪除 `NOT_FOUND` + `lost` → exit 3 / `cancel-question: LOST` 這條在真主行程下不會走到的分支，`--help` 與文件寫明「exit 0 不代表本次取消成功，看 `status:` 行，`cancelled worker` 才是本次取消」。假 RemoteServer 與測試同步改成真主行程的回傳形狀。

## 任務

1. `--cancel-question` 依上面的裁定修正（helper、`--help`、測試、假 server）。
2. e2e `e2e/t0611-tower-question.spec.ts`（隔離實例；比照 T0606「實作切分」C 節與 `e2e/t0609-worker-attention-badge.spec.ts` 的做法；分頁以 helper env 執行 node 腳本扮演塔台 / Worker，不啟動 claude / codex）：
   - Worker `bat-notify --ask`（stdin JSON）→ 塔台以 shim stdio 呼叫 `bat_list_questions` 看到題目 → `terminal:get-state`（或 MCP `bat_get_state`）對 Worker 回 `blocked` / `tower` / `pendingQuestions: 1` → Worker 縮圖為結構化的 `?`（`data-attention="question"`），不計入「關閉已回報的 Worker 分頁（N）」
   - 塔台 `bat-terminal --answer`（stdin）→ Worker `bat_wait_question`（或 `--wait-answer`）收到答覆 → 狀態離開 `blocked`、`pendingQuestions: 0`
   - 第二題後關閉 Worker 分頁 → 塔台 `bat_list_questions status=all` 看到 `cancelled` / `worker-exited`
   - 可選：BAT 重開（Terminal Server 存活）後舊 id → `lost`（做不到就寫原因）
   - 斷言 bat-scripts.log 與 debug 日誌不含問題 / 答案文字
3. 文件：
   - CLAUDE.md「Worker 問塔台（PLAN-048 / T0607）」節併入 T0608 草稿 (1)（helper / MCP 要點；維持 3–12 行，超出的細節進 docs）；「BAT MCP shim」節「6 個唯讀 tool」改為 8 個並補 T0608 草稿 (3) 一句。
   - `docs/agent-guide/tower-questions.md`：以 T0608 草稿 (2) 取代「見 T0608，收尾單補入」那段，套用第 1 項裁定；補 e2e 驗證清單。`docs/agent-guide/bat-mcp-shim.md` 如需同步就改。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠（回報 passed / files 數）；`npm run verify:helpers` OK。
2. e2e：新 spec + 回歸 `e2e/t0609-worker-attention-badge.spec.ts`、`e2e/t0584-bat-mcp-shim.spec.ts` 全部通過。
3. 回報區附：e2e 各步驟的實際回傳 / DOM 斷言摘錄、`--cancel-question` 修正前後對照、CLAUDE.md 兩節的最終文字、變更檔案清單。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 產出摘要

### 互動紀錄

### 遭遇問題

### 回報時間
