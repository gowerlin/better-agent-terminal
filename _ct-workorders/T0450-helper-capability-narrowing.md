---
schema_version: 1
schema_kind: workorder
id: T0450
title: "T0445 #6/#7：helper 能力收斂——pty:write 內容過濾（拒控制字元，送出只走 keypress）、tower 子 PTY 數量 / 頻率上限與 client 配額保留、agent 限 registry"
type: fix
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P1
sizing: M
created_at: "2026-10-05T06:32:48+08:00"
started_at: null
updated_at: "2026-10-05T06:32:48+08:00"
completed_at: null
target_version: next
depends_on:
  - T0449
related:
  - "T0445 findings #6 / #7、拆單 4（設計裁決）；T0432 殘餘風險 3-2"
  - "D134 追加（塔台 06:32 依授權裁決：收緊方向，不擴大暴露面）"
affects_files:
  - electron/remote/helper-capability.ts
  - electron/remote/remote-server.ts
  - electron/remote/headless-entry.ts
  - electron/pty-manager.ts
  - scripts/bat-notify.mjs
  - electron/remote/__tests__/
  - scripts/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **塔台裁決（收緊）**：(a) helper 的 `pty:write` 拒絕所有 C0 控制字元（`\\x00-\\x1f`，含 `\\r` / `\\n` / `\\x03` / ESC）與 DEL `\\x7f`，只允許可列印文字；多行內容的需求先查 `scripts/bat-notify.mjs` 實際送什麼——若 bat-notify 需要換行，改由 helper 端把換行轉成空白或拆多次 pre-fill，並在回報區說明；送出一律走 `terminal:keypress`。(b) 每個 tower 權杖存活中的子 PTY ≤ 8、建立間隔 ≥ 1 秒；helper 建立的 PTY 不得吃掉最後 8 格（`maxPtys` 為 0 = 無上限時不保留）。(c) `create-agent-command` 的 `agent` 只接受 agent registry 內已知 id（builtin + 使用者設定的自訂 agent），未知 id 拒絕。"
  - "🔴 先確認 bat-notify / bat-terminal 的實際 payload，確保收緊後既有正常流程（T0420 §3 端到端、T0432 正向測試）仍綠。"
  - "🔴 依賴 T0449（同改 `remote-server.ts` / `helper-capability.ts`）。T0433 / T0448 若同時碰 `headless-entry.ts` / `pty-manager.ts`，以 `git diff` + `git apply --cached` 精準 stage。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push；不部署 WSL。"
---

# T0450 — helper 能力收斂（T0445 #6/#7）

## 驗收條件

- [ ] 負向測試：worker `pty:write` 含 `\\r` / `\\x03` / ESC / `\\n` 被拒；tower 第 9 個存活子 PTY 被拒、1 秒內第二次建立被拒、配額保留生效；未知 agent id 被拒
- [ ] 正向：bat-notify pre-fill + keypress 送出流程仍通
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39

## Sub-session 執行指示
1. 讀本工單 + T0445 #6 / #7 + T0432 / T0449 回報區 + `scripts/bat-notify.mjs` / `bat-terminal.mjs`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
