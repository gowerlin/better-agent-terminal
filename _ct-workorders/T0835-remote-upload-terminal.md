---
schema_version: 1
schema_kind: workorder
id: T0835
title: "PLAN-038 U4：終端分頁接線：SSH / Docker 掛載外 / 其他 distro 的拖放改上傳後貼路徑；SSH / Docker 視窗 Ctrl+V 貼圖改上傳 PNG 後貼路徑；分頁關閉刪暫存"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-04T09:17:09+0800"
started_at: "2026-11-04T11:59:38+0800"
updated_at: "2026-11-04T12:14:35+0800"
completed_at: "2026-11-04T12:14:35+0800"
session_ids:
  - "c67a9145-fb2e-4b1b-928d-3de247039513"
depends_on: [T0834]
related:
  - "PLAN-038；D272；T0828 回報區（〈調查結論〉1、5、6，〈建議下一步〉第 4 列）；T0439（終端拖放貼路徑）；T0524（貼圖鍵）；T0832〈介面契約〉（PTY id session key）"
affects_files:
  - _ct-workorders/T0835-remote-upload-terminal.md
  - src/components/TerminalPanel.tsx
  - src/lib/terminal-drop.ts
  - src/lib/terminal-paste.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/__tests__/
  - src/lib/__tests__/
  - src/lib/remote-upload.ts
  - electron/main.ts
  - electron/remote/headless-entry.ts
  - electron/pty-manager.ts
  - electron/__tests__/
  - electron/remote/__tests__/
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
  - "🔴 只改「遠端不可達」的情況：本機分頁、WSL 視窗（含 Alt+V 貼圖鍵，維持現狀、只列實機確認）、Docker 掛載內的拖放與貼上行為完全不變。Ctrl+V 圖片改上傳只限 SSH / Docker 視窗；文字貼上不受影響。"
  - "🔴 不改 xterm 寫進 PTY 的其他行為；路徑以既有 `buildTerminalDropInsertion` 的引號規則貼上。分頁關閉時依 T0832 契約清理該 PTY id 的暫存。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0835 — PLAN-038 U4：終端接線

## 元資料
- **工單編號**：T0835｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0834（同改 locales、共用上傳 UI 慣例）｜**規模**：S–M

## 任務指令

### 前置條件
- T0828 回報區、T0832〈介面契約〉、T0833 / T0834 回報區
- `CLAUDE.md`「終端分頁右鍵選單與滑鼠追蹤」「終端連結」節（TerminalPanel 既有規則，避免回歸）

### 任務
1. 拖放：不可達 → 上傳 → 以引號路徑貼上（上傳中提示、可取消、失敗退回 toast）。
2. Ctrl+V 圖片（SSH / Docker 視窗）：main 讀 client 剪貼簿 PNG → 上傳 → 貼路徑；不再送 Alt+V（該情況下必定失敗）。
3. 分頁關閉清暫存（PTY id）。
4. 測試：drop / paste 在 SSH 型視窗走上傳；本機與 WSL 不變。
5. docs 補終端一節；`CHANGELOG.md` `[Unreleased]` 一條；`CLAUDE.md`「遠端附件上傳暫存（PLAN-038 / T0832）」節補終端唯一實作一行（維持 3–12 行）。
6. **塔台補充（2026-11-04 開工前併入）**：
   - 第 3 點的清理照 T0832 契約 C-8 在 **host 端**做：本機（`electron/main.ts` 模組層 `uploadStaging`）與 headless（`createHeadlessHandlerModules` 的 `uploadStaging`）在 PTY 真正結束（`pty:kill`、程序結束；⏻ 重啟不算）時呼叫 `UploadStaging.disposeSession(ptyId)`。掛勾點選最少侵入的位置（例如既有的 PTY exit 事件），🔴 不改 PTY 生命週期本身的行為；`affects_files` 已預先列入 `electron/main.ts`、`electron/remote/headless-entry.ts`、`electron/pty-manager.ts`，實際用不到的不要改。
   - T0834 回報〈遭遇問題〉4：`uploadToRemoteHost`（`src/lib/remote-upload.ts`）在 main 回傳非物件（例如 `undefined`）時會丟 TypeError；改成轉為 `TRANSPORT` 失敗、不丟例外，補測試。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

**DONE**

- **session_id**：c67a9145-fb2e-4b1b-928d-3de247039513
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE` 已設定（未讀值，yolo 下不問使用者）
- **落點檢查**：PASS —— C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT=`D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 PASS（`src/components/TerminalPanel.tsx`、`src/lib/terminal-drop.ts` 等已存在）；C-2 不適用（無 `branch`，HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_HOME` 未設（非 worktree）
- 依賴：T0834 `DONE`（開工時確認）
- **commit**：`64dbb3f4`（product，16 檔，`git add -- <明確路徑>` + `git commit -- <paths>`）；工單檔另 commit
- 驗收條件：兩項皆達成（見下方驗證）

### 產出摘要

| 檔案 | 內容 |
|---|---|
| `src/lib/terminal-drop.ts` | `droppedFiles`（路徑＋`File`，`droppedFilePaths` 改由它產生、結果不變）、`buildTerminalUploadInsertion`（`resolveAttachmentsForSend`（T0834）→ 依拖放順序的引號文字＋`resolution`；取消時文字為空）。既有 `buildTerminalDropInsertion` 不變（Finder 貼上仍用） |
| `src/lib/terminal-paste.ts` | `imagePasteModeFor`（profile `remote` 且 `targetOS` ∈ `ssh-linux` / `ssh-darwin` / `docker-linux` → `upload`，其餘 `key`）、`terminalImagePasteMode`（`app:get-window-profile` ＋ `profile:list-local`，成功時快取、失敗回 `key` 不快取）、`uploadClipboardImage`（`clipboard-image` 來源；`ok` 但沒有 `serverPath` / 例外 → `TRANSPORT`） |
| `src/components/TerminalPanel.tsx` | 拖放改走 `insertDroppedFiles`（上傳中狀態列、取消、失敗 toast 用 `attachmentRefusalText`）；Ctrl+V 圖片在 `upload` 模式走 `pasteClipboardImageAsPath`（不送貼圖鍵），`key` 模式照舊 `imagePasteKey`；`typeIntoTerminal` 抽出（`terminal.paste` / `pty.write`，與原本相同）；狀態列 `.terminal-upload-status`（inline style，`contain: layout` 的 `.terminal-panel` 內絕對定位）；同一分頁一次一個上傳、卸載時取消 |
| `src/lib/remote-upload.ts` | 塔台補充第 6 點第 2 項：`asResult` / `abortQuietly` —— main 的 `prepare` / `begin` / `chunk` / `finish` / `run` 回答不是結果物件（`undefined`、字串、沒有 `ok`、`ok: false` 沒有 `code`、`items` 不是陣列）→ `TRANSPORT`；`abort` 回非 promise / 同步丟例外、`onProgress` 沒回函式都不丟例外 |
| `electron/remote/headless-entry.ts` | `createPtyUploadDisposer` / `PTY_UPLOAD_DISPOSE_GRACE_MS` = 10 s（契約 C-8 ②）：`onPtyExit` 後等寬限期，該 id 仍不在 `isAlive` 才 `disposeSession(ptyId)`；同 id 重複 exit 只排一次；例外全吞。`createHeadlessHandlerModules` 的 `onPtyExit` 接上，多一個只回 disposer 的 module 在 server 停止時清計時器 |
| `electron/main.ts` | 模組層 `ptyUploadDisposer`（`uploadStaging` + `ptyManager.isAlive`）、`createElectronPtyDeps` 的 `onPtyExit` 多一行呼叫；`createPtyUploadDisposer` 從既有 import 的 `./remote/headless-entry` 取（main.ts 已 import 該模組的 `isHeadlessScrubbedEnvKey`）。`electron/pty-manager.ts` 未改 |
| `src/locales/{en,zh-TW,zh-CN}.json` | `terminal.uploading` / `cancelUpload` / `cancelUploadShort` / `uploadCancelled` / `uploadBusy` / `imageUploadFailed`（只新增；失敗原因沿用 `claude.uploadError.*`） |
| 測試 | `src/__tests__/terminal-remote-upload.test.tsx`（新，19 項：拖放 SSH 上傳後貼引號路徑（session key = PTY id、無 `\r`）、WSL 可達＋其他 distro 混合（順序）、WSL 全可達 / 本機不呼叫 upload、上傳失敗與 main 回 `undefined` → 提示不貼、進度＋取消、上傳中再拖放被擋；Ctrl+V 圖片 SSH / Docker 上傳不送鍵、本機 / WSL / 舊遠端 × Windows / Linux client 照舊送鍵、失敗提示不送鍵、SSH 文字貼上不變；`imagePasteModeFor` 表、快取、`uploadClipboardImage` 防護）、`src/lib/__tests__/remote-upload-non-object.test.ts`（新，13 項）、`electron/__tests__/pty-upload-dispose.test.ts`（新，9 項：寬限期、重複 exit、⏻ 重啟保留後真結束再清、無 staging / 丟例外、stop、真 `UploadStaging` 刪目錄、main / headless 接線與 `pty-manager.ts` 未改的 source guard）、`electron/remote/__tests__/headless-upload-e2e.test.ts`（+1：真 headless server 上 `pty:kill` 的 session 在寬限後消失、`pty:restart` 的保留） |
| 文件 | `docs/agent-guide/remote-file-upload.md`「終端接線（T0835）」一節（必守規則、唯一實作、日誌、已知限制）＋清理表、工單表、驗證表；`CLAUDE.md`「遠端附件上傳暫存（PLAN-038 / T0832）」節補終端一行（共 8 行）；`CHANGELOG.md` `[Unreleased]` Added 一條 |

**驗證（證據分道）**

| 分道 | 結果 |
|---|---|
| typecheck | `npm run typecheck` = 0、`npm run typecheck:electron` = 0 |
| 單元測試 | `npm run test:unit`：430 檔通過 / 3 skipped、7541 項通過 / 40 skipped，exit 0（T0439 `terminal-drop-file-path.test.tsx`、T0522 / T0524 `terminal-paste-shortcuts.test.tsx`、T0834 `remote-upload-panels.test.tsx`、T0437 `attachment-remote-paths.test.tsx` 未改仍通過） |
| build | `npx vite build` exit 0 |
| 真 headless server（in-process、WSS、real node-pty） | `headless-upload-e2e.test.ts` 新案例 PASS（Windows 本機以 cmd.exe 跑） |
| runtime / 實機 | 無：未連真的 SSH / Docker / WSL 視窗實測（PLAN-038 U5） |

- `validated_sha`：驗證時 HEAD = `751182aa`（工作樹含本單變更；第一輪驗證後補了 `uploadClipboardImage` 的 `serverPath` 防護與 1 項測試，再完整重跑四個閘門後才 commit），`head_sha` = `64dbb3f4`

### 互動紀錄

- [11:59] 開工：讀 T0828 回報區、T0832〈介面契約〉、T0833 / T0834 回報區、`_local-rules.md`、CLAUDE.md 對應節；落點檢查 PASS
- 未向塔台提問（工單、塔台補充第 6 點與契約足以實作；設計選擇記在〈遭遇問題〉）
- 塔台補充段落檢查三個節點（驗證前、product commit 前、填回報前）皆無新段落

### Renew 歷程

（無）

### 遭遇問題

1. **⏻ 重啟的判定**：`PtyManager.restart` 先 `kill`（會觸發 `onPtyExit`）再 `create`，claude 分頁的重新啟動（`startClaudeCliPty`）則是 renderer 經 IPC 先 kill 再 create。所以清理不在 `onPtyExit` 當下做，而是等 10 s（`PTY_UPLOAD_DISPOSE_GRACE_MS`）再看該 id 是否在 `PtyManager.isAlive`；不在才刪。PTY 生命週期與 `pty-manager.ts` 都沒改。代價：BAT / server 在寬限內結束時不刪（由 24 h TTL 清）；PTY 自己結束（shell `exit`）後再 ⏻ 的分頁，結束時已刪暫存。
2. **共用位置**：disposer 放在 `electron/remote/headless-entry.ts`（`affects_files` 內、main.ts 本來就 import 該模組），沒有另開新檔。
3. **WSL 視窗**：Ctrl+V 圖片照舊送 Alt+V（工單規定，只列實機確認）；但 WSL「其他 distro」的**拖放**依工單任務 1 會上傳（`outside-wsl-distro` 有 reason）。沒有 `targetOS` 的舊遠端 profile 貼圖照舊送鍵（無法判斷主機種類，維持現狀）。
4. **macOS Finder 複製的檔案**（Ctrl/Command+V 的 `paths`）不上傳：main 只回路徑，而上傳的 `path` 來源只認對話框回傳的檔（T0436 原則），照舊 T0437 拒絕；docs 已列。
5. **既有測試的語意變化**：`terminal-drop-file-path.test.tsx` 的「SSH 全部不可達」案例現在會嘗試上傳（permissive mock 的 `upload.prepare` 回 `undefined` → 本單修正後轉 `TRANSPORT`），toast 仍以 T0437 句子開頭，後面多了原因，斷言照舊通過、檔案未改。
6. **未做**：CSS（不在 `affects_files`）—— 狀態列用 inline style；Esc 不攔截（終端的 Esc 要送進 PTY），取消只靠狀態列按鈕。實機（SSH / Docker / WSL 其他 distro、claude CLI 是否把貼上的 `.png` 路徑轉成圖片附件）未驗，建議 U5 實機驗收時一併列入。

### 回報時間

2026-11-04T12:13:46+0800
