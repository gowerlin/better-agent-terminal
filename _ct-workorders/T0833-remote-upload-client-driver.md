---
schema_version: 1
schema_kind: workorder
id: T0833
title: "PLAN-038 U2：client 端上傳驅動（拖放 File 分塊 / 對話框 / 剪貼簿三來源、依視窗 profile 轉送、stop-and-wait、重試、取消、進度、舊 server 偵測）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T09:17:09+0800"
started_at: ""
updated_at: "2026-11-04T09:17:09+0800"
completed_at: ""
session_ids: []
depends_on: [T0832]
related:
  - "PLAN-038；D272；T0828 回報區（〈調查結論〉2、4，〈建議下一步〉第 2 列）；T0832〈介面契約〉；T0436（client 端讀檔原則）"
affects_files:
  - _ct-workorders/T0833-remote-upload-client-driver.md
  - electron/upload-client.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/lib/remote-upload.ts
  - electron/__tests__/
  - src/lib/__tests__/
  - docs/agent-guide/remote-file-upload.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 依 T0832〈介面契約〉實作，不得單方更改；契約不足時問塔台。"
  - "🔴 不新增「main 讀任意 renderer 給的路徑」的入口（T0436 原則）：拖放由 renderer 以 `File.slice()` 分塊交給 main；對話框路徑由 main 自己選；剪貼簿圖片由 main 讀。client IPC 是本機 `ipcMain.handle`（不在 `PROXIED_CHANNELS`），依視窗綁定的 profile 轉送到對應 `RemoteClient`；無 live 連線即失敗，不 fallback 本機。"
  - "🔴 256 KiB 分塊、一次一塊在途（stop-and-wait）、單塊 invoke 逾時重試 1 次；上限 50 / 100 / 500 MiB（D272）；舊 bat-server 沒有 `upload:*` → 回明確結果讓 UI 退回 T0437 拒絕。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0833 — PLAN-038 U2：client 端上傳驅動

## 元資料
- **工單編號**：T0833｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0832（契約、同改 `main.ts`）｜**規模**：M

## 任務指令

### 前置條件
- `_ct-workorders/T0828-research-remote-file-upload-staging.md` 回報區；`_ct-workorders/T0832-remote-upload-host-staging.md`〈介面契約〉
- `CLAUDE.md`「多 remote profile 同時連線（PLAN-039）」節

### 任務
1. main：`electron/upload-client.ts` 上傳驅動（三來源、分塊、stop-and-wait、重試、取消、sha256、進度事件 main → renderer）；本機 IPC 與 preload / 型別。
2. renderer：`src/lib/remote-upload.ts` 包裝（給 T0834 / T0835 用的 API：上傳一組附件 → 每檔 `serverPath` 或失敗原因；進度回呼；取消）。
3. 單元測試：stop-and-wait、重試 1 次、取消、舊 server 無 handler、上限、profile 路由（無 live 連線失敗）。
4. docs：`remote-file-upload.md` 補 client 端一節。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
