---
schema_version: 1
schema_kind: workorder
id: T0843
title: "遠端附件上傳失敗的提示文字：先講真正原因、每個檔名只出現一次（T0836 發現）"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-04T12:38:10+0800"
started_at: "2026-11-04T13:09:33+0800"
updated_at: "2026-11-04T13:09:33+0800"
completed_at: ""
session_ids: []
depends_on: [T0841]
related:
  - "PLAN-038；D274；T0836 回報區〈發現的問題〉；T0834（`attachmentRefusalText` / `uploadFailureReason`，`src/lib/client-paths.ts`）；T0835（終端同用）；T0437（原拒絕句）"
affects_files:
  - _ct-workorders/T0843-upload-failure-toast-wording.md
  - src/lib/client-paths.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/lib/__tests__/
  - src/__tests__/
  - e2e/t0836-remote-upload-acceptance.spec.ts
  - docs/agent-guide/remote-file-upload.md
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
tower_question: open
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改提示文字的組成：哪些檔上傳、哪些拒絕、何時顯示、toast 種類與時間、送出與復原行為都不變。🔴 「完全沒有嘗試上傳、只是 T0437 拒絕」的情況（本機視窗、`invalid-path` 等）文字與 T0437 完全相同，`attachment-remote-paths.test.tsx` 等既有 T0437 斷言不改。"
  - "🔴 改在 `attachmentRefusalText`（唯一實作），面板與終端（T0835）都經它，不在 consumer 各自拼字串。i18n 只新增 / 調整 `claude.uploadError.*` 與上傳失敗相關 key，三語都要改。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0843 — 上傳失敗提示文字

## 元資料
- **工單編號**：T0843｜**類型**：implementation｜**狀態**：IN_PROGRESS｜**建立**：2026-11-04 12:38 (UTC+8)
- **依賴**：T0841（T0840 / T0841 都改 locales，排在它們後面）｜**規模**：S

## 任務指令

### 現象（T0836 實測）
單檔超過 50 MiB 時，面板 toast 是：「此檔案不在遠端主機上，未附加：<file> 上傳到遠端主機失敗：<file> (超過單檔 50 MiB 上限)。」檔名出現兩次，而且第一句讓人以為是路徑問題，真正原因（大小上限）在最後。終端拖放與 Ctrl+V 貼圖用同一個函式，情況相同。

### 要的結果
1. **有嘗試上傳但失敗的檔**：句子開頭就說原因，每個檔名只出現一次，依原因分組。例：「未附加（超過單檔 50 MiB 上限）：a.zip、b.iso」；舊版伺服器：「未附加（遠端伺服器版本太舊，不支援上傳）：…」。句型由 Worker 決定，三語一致，中文用全形標點。
2. **純 T0437 拒絕**（沒嘗試上傳）：文字完全不變。
3. **混合**（部分純拒絕、部分上傳失敗）：兩段各自成句，同一個檔名不重複出現。
4. 取消上傳的 info toast 不變。

### 測試
- `src/lib/__tests__/` 補 `attachmentRefusalText` 的表格測試：只上傳失敗（各原因）、只純拒絕（與 T0437 逐字相同）、混合、多檔同原因、檔名只出現一次。
- 既有 `remote-upload-panels.test.tsx`、`terminal-remote-upload.test.tsx` 若斷言舊句子，依新文字更新並在回報說明。
- `e2e/t0836-remote-upload-acceptance.spec.ts` ①a 的 toast 斷言同步更新（不需要重跑整個 e2e；能跑就跑並附輸出）。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] `docs/agent-guide/remote-file-upload.md` 對應的提示說明同步；`CHANGELOG.md` 若 `[Unreleased]` 已有 PLAN-038 條目則不另加，只在回報說明
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：`attachment-remote-paths.test.tsx`／`terminal-drop-file-path.test.tsx` 的 4 個「T0437 斷言」其實走了上傳（stub 回 undefined → TRANSPORT），要怎麼處理？
- 提問時間：2026-11-04T13:12:27+0800
- 背景：工單 memory_overrides 說這兩類測試是「沒嘗試上傳、純 T0437 拒絕」、斷言不改。實際上它們的 mock 回 `reason: 'outside-wsl-distro'`／`'ssh-local-file'`（T0834 起屬可上傳），`permissiveApi` 的 upload stub 回 undefined → `TRANSPORT`，所以是「上傳失敗（連線）」的情況。舊文字以 T0437 句開頭、`toContain` 剛好過；新文字是「Not attached (the connection to the remote host failed): doc.pdf」，4 個斷言（`attachment-remote-paths` Claude／Codex 各 1、`terminal-drop-file-path` 2）失敗。真正純 T0437（本機視窗、`invalid-path`、無 reason）文字不變，已有單元測試逐字驗證。
- 選項：[A] 這 4 個測試的 mock 改用不可上傳的 reason（拿掉 `reason` 或 `invalid-path`），讓它們真的測純 T0437，斷言字串一字不改 / [B] 不動 mock，斷言改成新文字（「上傳失敗：連線」），測試加註說明 stub 走了上傳 / [C] 其他：________
- Worker 建議：[A]，因為這兩個檔原本就是 T0437／T0439 的測試，意圖是「不可達 → 拒絕 toast」，改 mock 後斷言維持逐字不變、符合 override；`outside-wsl-distro`／`ssh-local-file` 走上傳的路徑已由 `remote-upload-panels.test.tsx`、`terminal-remote-upload.test.tsx` 涵蓋。
- 影響範圍：`src/__tests__/attachment-remote-paths.test.tsx`、`src/__tests__/terminal-drop-file-path.test.tsx`（只改測試，產品碼不受影響）；驗收條件「test:unit 全過」
- 阻塞：否（先做 docs、e2e、typecheck、build；只有 test:unit 全過與 commit 要等答覆）

### 完成狀態

### 產出摘要

### 互動紀錄

### 遭遇問題

### 回報時間
