---
schema_version: 1
schema_kind: workorder
id: T0834
title: "PLAN-038 U3：Claude / Codex 面板接線：遠端不可達的本機附件送出時上傳 → `@<serverPath>`；chip 進度、取消、失敗退回提示"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T09:17:09+0800"
started_at: "2026-11-04T11:46:01+08:00"
updated_at: "2026-11-04T11:58:13+08:00"
completed_at: "2026-11-04T11:58:13+08:00"
session_ids:
  - "821519f1-b9f3-470c-9101-d81ed0554cc1"
depends_on: [T0833, T0842]
related:
  - "PLAN-038；D272；T0828 回報區（〈調查結論〉1、5，〈建議方向〉送出時上傳，〈建議下一步〉第 3 列）；T0833 的 `src/lib/remote-upload.ts`；T0437"
affects_files:
  - _ct-workorders/T0834-remote-upload-panels.md
  - src/components/ClaudeAgentPanel.tsx
  - src/components/CodexAgentPanel.tsx
  - src/lib/client-paths.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/__tests__/
  - src/lib/__tests__/
  - src/components/__tests__/
  - docs/agent-guide/remote-file-upload.md
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
  - "🔴 只在 `resolveClientPaths` 判定不可達（有 `reason`）時上傳；本機視窗、WSL 同 distro、`/mnt/c`、Docker 掛載內的附件行為完全不變。上傳失敗 / 超過上限 / 舊 server → 退回現行 T0437 拒絕＋toast。送出時上傳（不是附加時）；上傳期間送出鍵停用、可取消。"
  - "🔴 面板既有的送出流程（T0815 排進同一個 query、`queuedNoteKey`、權限卡 / 提問卡）不得改變；上傳完成後才進入既有送出路徑。不加 Settings 開關（D272）。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0834 — PLAN-038 U3：面板接線

## 元資料
- **工單編號**：T0834｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0833｜**規模**：M

## 任務指令

### 前置條件
- T0828 回報區、T0832〈介面契約〉、T0833 回報區（renderer API）
- `CLAUDE.md`「Sub-agent / Active Tasks Tracking」節（T0815 送出流程）

### 任務
1. Claude / Codex `handleSend`：不可達附件 → 上傳 → prompt 以 `@<serverPath>` 帶入（顯示仍用原檔名）；chip 顯示進度、可取消；失敗退回拒絕。
2. i18n（en / zh-TW / zh-CN）。
3. RTL：兩面板 × {全可上傳、部分超上限、上傳失敗退回 toast、取消、本機視窗附件不變}。
4. `CHANGELOG.md` `[Unreleased]` Added：遠端視窗可附加本機檔案（PLAN-038）；docs 補面板一節。
5. **T0833 留下的後續**（塔台 2026-11-04 11:45 併入，見 T0833 回報區〈遭遇問題〉4、5）：
   - 面板拖放的非圖片檔目前只留路徑（`getPathForFile`）；需保留 `File` 物件，遠端不可達時走 T0833 的 `file` 來源（renderer 分塊）。對話框選的檔走 `path` 來源（main 已記白名單）。
   - `CLAUDE.md`「遠端附件上傳暫存（PLAN-038 / T0832）」節補 client 端唯一實作一行（`electron/upload-client.ts` / `src/lib/remote-upload.ts`、面板接線位置），維持 3–12 行。
6. **與 BUG-211（T0842）合流**：遠端送出前的圖片預算 `checkRemoteImageBudget` 照舊套用在圖片（本單不改圖片走法）；非圖片附件走上傳，不計入圖片預算。送出失敗的復原沿用 T0842 的 `restoredInputText` / `restoredAttachments`。

### 驗收條件
- [x] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [x] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

**DONE**

- **session_id**：821519f1-b9f3-470c-9101-d81ed0554cc1
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（`src/components/ClaudeAgentPanel.tsx` 等已存在）；C-2 不適用（無 `branch`，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_HOME` 未設（非 worktree）
- 依賴：T0833 `DONE`、T0842 `DONE`（開工時確認）
- **commit**：`61cd028c`（product，11 檔，`git add <明確路徑>`）；工單檔另 commit。工作樹裡 `_ct-workorders/T0839-wsl-facts-and-plan.md` 有別人的未提交修改，未碰、未納入
- 驗收條件：兩項皆達成（見下方驗證）

### 產出摘要

| 檔案 | 內容 |
|---|---|
| `src/lib/client-paths.ts` | 新增 `resolveAttachmentsForSend`（`resolve-client-paths` → `classifyResolvedPaths` 分成可達 / 上傳 / 拒絕 → 一次 `uploadToRemoteHost` → `serverPaths`（附件原順序）/ `displayNames` / `rejected` / `uploadFailed` / `uploaded` / `cancelled`；不丟例外）、`isUploadableReason`（有 `reason` 且不是 `invalid-path`）、`uploadFailureReason`（錯誤碼 → `claude.uploadError.*`，上限數字取 `REMOTE_UPLOAD_LIMITS`）、`attachmentRefusalText`（T0437 句子＋依原因分組的失敗說明）。既有 `resolveAttachmentPaths` / `splitResolvedPaths` 等不變（T0835 / 其他 caller 照用） |
| `src/components/ClaudeAgentPanel.tsx` / `CodexAgentPanel.tsx` | `handleSend` 附件段改用 `resolveAttachmentsForSend`（`sessionKey = sessionId`）；`AttachedFile.file?`（拖放 / Finder 貼上保留 `File` → `file` 來源；對話框無 → `path` 來源）；`uploadProgress` / `uploadAbortRef` / `cancelUpload`；chip「上傳中 N%」、上傳中 chip × = 取消、圖片 × 停用、「+」隱藏、送出鍵 `disabled`、輸入框 `readOnly`、`handleSend` / `addImage` / `addFileByPath` 在上傳中直接 return；Esc 在上傳中＝取消（不清草稿）；卸載時 abort；有上傳時改讀 `isStreamingRef` / `isInterruptedRef`（沒有上傳時仍用原 state，行為不變）；本機訊息附件註記用 `displayNames`（上傳的檔顯示原檔名，其餘同 T0834 前） |
| `src/locales/{en,zh-TW,zh-CN}.json` | `claude.attachmentUploadFailed` / `attachmentUploadCancelled` / `attachmentUploading` / `cancelAttachmentUpload` / `sendDisabledWhileUploading` / `uploadError.{tooLarge,sendTooLarge,tooManyFiles,quota,noSpace,serverTooOld,connection,source,other}`（只新增，既有 key 不動） |
| 測試 | `src/__tests__/remote-upload-panels.test.tsx`（新，18 項：兩面板 × {全部上傳、單檔超過上限、舊 server 退回、上傳失敗且無其他內容、進度＋送出停用＋取消保留草稿、Esc 取消、WSL 可達不上傳}、兩面板本機視窗不變、本機附件註記同 T0834 前、上傳檔顯示原檔名；以真的 `uploadToRemoteHost` 對假 `electronAPI.upload`）、`src/lib/__tests__/client-paths-upload.test.ts`（新，12 項） |
| 文件 | `docs/agent-guide/remote-file-upload.md`「面板接線（T0834）」一節（必守規則、唯一實作、原因對照、日誌、已知限制）＋驗證表兩列、工單表狀態；`CLAUDE.md`「遠端附件上傳暫存（PLAN-038 / T0832）」節補 client 端（T0833）與面板（T0834）唯一實作各一行（共 6 行）；`CHANGELOG.md` `[Unreleased]` Added 一條 |

**驗證（證據分道）**

| 分道 | 結果 |
|---|---|
| typecheck | `npm run typecheck` = 0、`npm run typecheck:electron` = 0 |
| 單元測試 | `npm run test:unit`：427 檔通過 / 3 skipped、7499 項通過 / 40 skipped，exit 0（T0437 `attachment-remote-paths.test.tsx`、T0842 `remote-image-budget-panel.test.tsx` 未改仍通過） |
| build | `npx vite build` exit 0 |
| runtime / 實機 | 無（未連真的 SSH / Docker host 實測；建議塔台安排遠端視窗實機驗收） |

- `validated_sha`：驗證時 HEAD = `d232ac23`（工作樹含本單變更，驗證後未再改產品檔即 commit 成 `61cd028c`）

### 互動紀錄

- [11:46] 開工：讀 T0833 回報區、T0828 建議、`remote-upload.ts`、兩面板送出 / 附件程式碼與既有 RTL；落點檢查 PASS
- 未向塔台提問（工單與 T0828 / T0833 足以實作；設計選擇記在〈遭遇問題〉）

### Renew 歷程

（無）

### 遭遇問題

1. **上傳範圍判定**：「有 `reason` 才上傳」實作為 `reason` 存在且不是 `invalid-path`（`no-translator` 也上傳：遠端視窗翻譯器壞掉不影響上傳；本機視窗不會有 reason，即使有，driver 回 `NOT_REMOTE` 也只退回拒絕）。沒有答覆 / 答覆對不上照舊拒絕（fail-closed）。
2. **失敗 toast**：沿用 T0437 的句子（「Not on the remote host, not attached: …」）再接「Upload to the remote host failed: <檔名> (<原因>)」，依原因分組；只有 T0437 拒絕時文字與 T0834 前完全相同。取消另顯示 info toast。
3. **上傳期間的狀態**：上傳可能跨越主回合開始 / 結束，`handleSend` 的 `isStreaming` 是送出當下的值；只在「有上傳」時改讀 ref，沒上傳的路徑仍用原值（行為不變）。上傳期間鎖住輸入（`readOnly`）與附件，避免上傳中新增的內容被送出後的清空吞掉；Esc 改為取消上傳（原本會清掉草稿與圖片，但 closure 仍會送出舊內容）。
4. **原有的 T0437 RTL**（`attachment-remote-paths.test.tsx`）沒改：其 permissive mock 的 `upload.prepare` 回 `undefined`，`uploadToRemoteHost` 因此丟 TypeError（它只 catch IPC 錯誤），`resolveAttachmentsForSend` 的 try/catch 轉成 `TRANSPORT` 拒絕，toast 開頭仍是 T0437 句子，故照舊通過。`uploadToRemoteHost` 對「main 回傳 undefined」會丟例外是 T0833 driver 的小缺口（不在本單 `affects_files`），面板端已防住；建議日後 T0835 或維護單讓 driver 也把非物件回傳轉成 `TRANSPORT`。
5. **未做**：CSS（不在 `affects_files`）——進度只用一個帶 inline style 的文字 span，未加進度條；需要更好看的樣式可另開小單。實機（SSH / Docker / WSL 其他 distro）未驗。
6. 圖片照舊 data URL ＋ `checkRemoteImageBudget`（在上傳之前檢查，超過預算時不上傳任何檔）；非圖片附件不計入圖片預算。送出失敗沿用 T0842 復原（被放回的 `AttachedFile` 帶 `file`，再送會重新上傳）。

### 回報時間

2026-11-04T11:57:33+0800
