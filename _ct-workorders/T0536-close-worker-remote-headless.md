---
schema_version: 1
schema_kind: workorder
id: T0536
title: "PLAN-041 B'-2：遠端 headless 支援 `--close-worker`（tower 權杖只能關自己派出的 Worker）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-041
priority: P2
sizing: S
created_at: "2026-10-15T15:44:39+0800"
updated_at: "2026-10-15T15:44:39+0800"
target_version: "0.6.1-pre.3"
depends_on: [T0535]
related:
  - PLAN-041
  - T0534（研究回報 §1.4、§1.7）
  - T0432 / T0447–T0450（headless 範圍權杖）
  - D144
affects_files:
  - electron/remote/helper-capability.ts
  - electron/remote/remote-server.ts
  - electron/remote/headless-entry.ts
  - electron/remote/protocol.ts
  - electron/terminal-command-handlers.ts
  - src/App.tsx
  - electron/remote/__tests__/
  - CLAUDE.md
  - _ct-workorders/T0536-close-worker-remote-headless.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT 與已部署的遠端 server；測試用 `headless-remote-tower-e2e.test.ts` 的真 headless + 真 node-pty 模式。不耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 改 `electron/**` 驗收 `npm run typecheck:electron` = 0；改 `src/**` 驗收 `npm run typecheck` = 0。"
  - "🔴 權杖範圍**預設拒絕**不變：只新增這一個 channel 給 tower，worker 角色不得取得；server token 仍不得進 PTY env。"
---

# T0536 — 遠端 headless `--close-worker`

## 背景

T0535 完成本機版本後，遠端視窗（WSL / SSH / Docker）的 Tower 呼叫 `--close-worker` 仍會得到 `Forbidden: channel-not-allowed`（tower 權杖只允許 `terminal:create-agent-command`，`helper-capability.ts` `HELPER_CHANNEL_ROLES`）。介面契約與 exit code 同 PLAN-041，遠端不得另訂。

## 任務

1. **權杖**（`electron/remote/helper-capability.ts`）
   - `HELPER_CHANNEL_ROLES` 加 `'terminal:close-worker': ['tower']`。
   - `HelperCapabilityRegistry` 新增 `isWorkerOf(childId, towerId)`（掃 `role === 'worker' && towerId === …`，資料已在 registry 內）。
   - `authorizeHelperInvoke`：`towerId` 參數必須等於 `capability.terminalId`（不能冒用別的塔台）；目標不得是自己。目標歸屬在 handler 查到候選後以 `isWorkerOf` 驗證（不屬於 → `NOT_OWNER`，與本機一致）。
   - `HelperInvokeContext` 與 `remote-server.ts` 呼叫點補上所需資訊。
2. **headless handler**：重用 T0535 的 handler 邏輯（查詢 / 唯一命中 / 閒置 / 延遲計時與取消），不要複製一份。headless PTY 的 `workorder` 記錄方式比照本機。延遲期間的「使用者輸入」= 來自 **client 連線**（非 helper 連線）的 `pty:write`。
3. **事件**：`terminal:close-requested` 加進 `PROXIED_EVENTS`（`electron/remote/protocol.ts`），由 `RemoteConnectionRegistry` 送到該 profile 的視窗；client renderer 沿用 T0535 的處理（分頁屬於本視窗才關）。沒有任何 client 連著時：計時照走，到期事件無人接收 → 分頁在下次連線時仍存在。這是已知限制，回報區記錄，不在本單處理。
4. **文件**：CLAUDE.md「遠端 Tower 通知（PLAN-036 K）」權杖表 tower 列加上這個 channel 與限制；「Worker 分頁回收（PLAN-041）」小節補遠端說明。

## 驗收條件

- [ ] 擴充 `electron/remote/__tests__/headless-remote-tower-e2e.test.ts`（或新檔）：tower 關自己派出的 Worker → 成功並收到 `terminal:close-requested`；關別的 tower 的 Worker → `NOT_OWNER`；`towerId` 冒用 → `Forbidden`；目標為自己 → 拒絕；worker 權杖呼叫 → `channel-not-allowed`；撤銷後的權杖 → 拒絕
- [ ] `helper-capability.test.ts` 補 `isWorkerOf` 與角色表
- [ ] `npm run typecheck:electron` = 0、`npm run typecheck` = 0（若改 `src/**`）、`npx vite build` 成功、相關單元測試全綠

## 回報區

（Worker 填寫）
