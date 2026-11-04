---
schema_version: 1
schema_kind: workorder
id: T0832
title: "PLAN-038 U1：host 端上傳暫存與 `upload:*` channel（暫存目錄、檔名、權限、配額、TTL、dispose 清理）＋介面契約"
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
depends_on: [T0830]
related:
  - "PLAN-038；D272；T0828 回報區（設計 SoT：〈調查結論〉2–5、7，〈建議下一步〉第 1 列）；T0437；T0406；PLAN-036 / D134（helper 權杖）"
affects_files:
  - _ct-workorders/T0832-remote-upload-host-staging.md
  - electron/upload-staging.ts
  - electron/handlers/uploads.ts
  - electron/handlers/claude.ts
  - electron/remote/protocol.ts
  - electron/remote/path-aware-channels.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-handlers.ts
  - electron/main.ts
  - electron/__tests__/
  - electron/remote/__tests__/
  - scripts/smoke-remote-headless.mjs
  - docs/agent-guide/remote-file-upload.md
  - docs/agent-guide/README.md
  - CLAUDE.md
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 設計以 T0828 回報區為準，使用者裁決（D272）：單檔 50 MiB、單次送出合計 100 MiB、每 session 配額 500 MiB、單次最多 10 檔；清理 = session / 分頁關閉即刪＋ 24 h TTL＋未完成 `.part` 10 分鐘；不加 Settings 開關；上傳失敗一律退回 T0437 的拒絕。偏離設計要問塔台。"
  - "🔴 新 channel 不得加進 `HELPER_CHANNEL_ROLES`（helper / PTY 權杖呼叫不到）；回傳的 `serverPath` 不得被 `toClient` 正規化；日誌只記 uploadId、session 前 8 碼、大小、副檔名、結果，不記檔名與內容。外部輸入（sessionId 等）走 `/^[a-zA-Z0-9._-]+$/` 白名單；所有路徑 resolve 後確認在 `<dataDir>/uploads/` 之下。"
  - "🔴 任何模組不得在 import 期呼叫 `app.getPath('userData')`（CLAUDE.md Logging 節規則 ②）；headless 與本機共用 handler（不 import electron 的模組）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。其他 Worker 同時在 main 執行。"
---

# T0832 — PLAN-038 U1：host 端上傳暫存

## 元資料
- **工單編號**：T0832｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0830（同改 `electron/main.ts`；等它 commit 後派）
- **規模**：M｜**降級**：先完成暫存模組＋handler＋單元測試，smoke S14 / docs 可最後補，做不完回 PARTIAL

## 任務指令

### 前置條件
- `_ct-workorders/T0828-research-remote-file-upload-staging.md` 回報區（全文）
- `CLAUDE.md`「Remote 資安」「遠端 Tower 通知（PLAN-036 K）」「Child Process Spawning」「CLAUDE.md 撰寫規則（T0595）」節

### 任務
1. **暫存模組**（`electron/upload-staging.ts`，不 import electron）：位置 `<dataDir>/uploads/<sessionId>/<uploadId>/<檔名>`；檔名清理（basename、控制字元、`.`/`..`、Windows 保留名、120 字元保留副檔名）；POSIX 0700 / 0600；`.part` → finish 時比對 sha256 後 rename；`statfs` 可用空間檢查（檔案大小＋64 MiB）；配額；TTL 掃描（啟動時＋每小時）；dispose 刪 session 目錄。
2. **4 個 channel**（`upload:begin` / `upload:chunk` / `upload:finish` / `upload:abort`）：offset 必須等於已收位元組；本機 host（main.ts）與 headless 都註冊；分類進 `PATH_FREE_CHANNELS`，通過既有 parity / path coverage / binding 守門。
3. **dispose 掛勾**：`claude:dispose-session`（`electron/handlers/claude.ts`）刪該 session 目錄；終端分頁的 session key（PTY id）清理介面留給 T0835 呼叫（在契約中定義）。
4. **介面契約**：在本工單回報區寫〈介面契約〉（channel 參數 / 回傳 / 錯誤碼如 `NO_SPACE`、`QUOTA`、`TOO_LARGE`、`BAD_OFFSET`、`HASH_MISMATCH`、session key 規則），T0833–T0835 依此實作，不得單方更改。
5. 測試：T0828〈調查結論〉7 的單元項目；`scripts/smoke-remote-headless.mjs` 加 S14（真 headless server：上傳、權限、dispose、未認證與 helper 權杖被拒）。
6. 文件：`docs/agent-guide/remote-file-upload.md`（新）＋ README 索引＋ `CLAUDE.md` 一節（3–12 行）；`CHANGELOG.md` 先不寫使用者可見項目（功能在 T0834 / T0835 才可見），可寫在 T0834。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] smoke S14 通過（或寫明無法執行的原因）
- [ ] 回報區有〈介面契約〉；commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 介面契約

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
