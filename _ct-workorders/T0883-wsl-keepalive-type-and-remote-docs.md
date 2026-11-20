---
schema_version: 1
schema_kind: workorder
id: T0883
title: "`ProfileEntry` 補 `wslKeepAlive` 型別（T0830 後續）＋ WSL keep-alive／精靈中止與 `ws-limits`／`FRAME_TOO_LARGE` 文件（T0830、BUG-211 後續）"
type: implementation
status: DONE
started_at: "2026-11-20T16:53:25+08:00"
updated_at: "2026-11-20T16:58:08+08:00"
completed_at: "2026-11-20T16:58:08+08:00"
session_ids:
  - "714ef490-1883-4cf7-a99d-b066e167dda5"
repo: better-agent-terminal
project: ""
priority: P3
sizing: S
created_at: "2026-11-20T16:40:41+0800"
depends_on: []
related:
  - "D303；T0830 回報區〈遭遇問題〉末段後續候選；BUG-211〈修復紀錄〉（`electron/remote/ws-limits.ts`、`RemoteClient.invoke` 的 `FRAME_TOO_LARGE`）；CLAUDE.md 撰寫規則（T0595）、「多 remote profile 同時連線（PLAN-039）」節；`docs/agent-guide/multi-remote-profiles.md`（已有 keep-alive 開關一段）"
affects_files:
  - _ct-workorders/T0883-wsl-keepalive-type-and-remote-docs.md
  - src/components/profiles/types.ts
  - src/components/profiles/details/WslDetails.tsx
  - src/components/profiles/
  - CLAUDE.md
  - docs/agent-guide/multi-remote-profiles.md
  - docs/agent-guide/remote-security.md
  - docs/agent-guide/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 D 項只整理型別、行為不變：`src/components/profiles/types.ts` 的 `ProfileEntry` 加 `wslKeepAlive?: boolean`（與 `src/types/electron.d.ts` 既有欄位、`electron/profile-manager.ts` 的定義一致），`WslDetails.tsx` 拿掉本地的 `WslProfileEntry` 交集型別改用 `ProfileEntry`。執行期邏輯、UI、IPC 參數都不改；`WslDetails.test.tsx` 照舊通過。若發現 renderer 端還有其他地方手寫同一個交集型別，一併列出並改。"
  - "🔴 E、F 項只改文件：不改任何程式碼與測試（D 項除外）。"
  - "E 項：`docs/agent-guide/multi-remote-profiles.md` 已有 keep-alive 開關一段；先盤點 T0830 的精靈中止規則（runner 層 abort、install-bundle 子程序收到中止後終止、不可中斷的呼叫照舊等它結束、關閉精靈視窗觸發的背景 rollback 與已知限制）是否已在 docs，沒有就補進合適的 docs 檔（自選、寫明）。CLAUDE.md 只在「多 remote profile 同時連線（PLAN-039）」節加 1～2 行必守規則＋連結（例：要持有的 distro 唯一由 `keepAliveProfileDistros` 決定、精靈的 `pin()` 與開關無關；精靈中止的唯一實作位置）；🔴 遵守 CLAUDE.md 撰寫規則（T0595）：不新增 `##` 標題、不改既有標題、該節維持 3～12 行原則，細節放 docs。規則要從程式碼查證，不得只抄 T0830 回報。"
  - "F 項：在合適的 docs 檔（建議 `docs/agent-guide/remote-security.md` 或 `multi-remote-profiles.md`，自選、寫明）補一段：`electron/remote/ws-limits.ts` `WS_MAX_PAYLOAD_BYTES`（32 MiB，server 與 client 共用、server `maxPayload` 不變）、`RemoteClient.invoke`（與 auth frame）送出前算 UTF-8 bytes，超過就本機 reject `FRAME_TOO_LARGE`（不送出、連線不斷、其他 invoke 不受影響）、面板送出前的 `checkRemoteImageBudget`（`src/lib/remote-image-budget.ts`）、已知缺口（fork 後自動送出的待送圖片沒有面板檢查，由 T0884 處理，寫「T0884 處理中」即可）。數值與行為從程式碼查證。CLAUDE.md 不加（BUG-211 沒有必守規則需要放在每個 session 都載入的檔）。"
  - "驗證只用可自動化的方式：`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過（含讀 CLAUDE.md 的 source guard 測試）、`npx vite build` 成功。不需要人工驗收。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區與文件不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0883 — `ProfileEntry.wslKeepAlive` 型別＋遠端相關文件補齊

## 元資料
- **工單編號**：T0883｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-20 16:40 (UTC+8)
- **規模**：S｜**依賴**：無（與 T0882 / T0884 依序派工）｜**決策**：D303

## 背景
- **D（T0830 後續）**：`wslKeepAlive` 在 `src/types/electron.d.ts` 與主行程都有，但 renderer 的 `src/components/profiles/types.ts` `ProfileEntry` 沒有，`WslDetails.tsx` 只好自己定義 `ProfileEntry & { wslKeepAlive?: boolean }`。
- **E（T0830 後續）**：T0830 回報「CLAUDE.md 若要列 keep-alive 開關／精靈中止的必守規則需另開單」。
- **F（BUG-211 後續）**：BUG-211 加了 `ws-limits.ts` 與 `FRAME_TOO_LARGE`，docs 沒有說明。

## 任務
1. D：型別整理（見 frontmatter）。
2. E：盤點並補 docs、CLAUDE.md 1～2 行。
3. F：補 docs 一段。
4. 驗證（見 frontmatter）。

## 驗收條件
- [ ] `ProfileEntry` 有 `wslKeepAlive?: boolean`，`WslDetails.tsx` 不再有本地交集型別；行為不變
- [ ] E：docs 盤點結果（哪些規則原本就有、補了哪些、寫在哪個檔）；CLAUDE.md 改動行數與位置
- [ ] F：補在哪個檔、內容與程式碼查證的位置（`檔案:行`）
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過（附 passed / files 數）、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

- **狀態**：DONE（D、E、F 三項與驗證全部完成）
- **完成時間**：2026-11-20 16:57 (UTC+8)
- **產品 commit**：`ece924e5`（`docs+types: ProfileEntry.wslKeepAlive, wizard step abort and WS frame limit docs (T0883)`，6 檔）
- **session_id**：714ef490-1883-4cf7-a99d-b066e167dda5
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS；C-1 工單在 REPO_ROOT 下 → PASS；C-3 `affects_files` 前 5 項（排除 `_ct-workorders/`）皆存在 → PASS（資訊性）；C-2 無 `branch` 欄位。`CT_HOME` 未設（不是 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_HELPER_DIR` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`（已設定）/ `BAT_TERMINAL_ID` / `BAT_TOWER_TERMINAL_ID` / `BAT_WORKSPACE_ID` 存在。

### 產出摘要

**D. `ProfileEntry.wslKeepAlive` 型別（行為不變）**
- `src/components/profiles/types.ts`：`ProfileEntry` 加 `wslKeepAlive?: boolean`（附註解），與 `src/types/electron.d.ts:48`、`electron/profile-manager.ts:59` 一致。
- `src/components/profiles/details/WslDetails.tsx`：移除本地 `WslProfileEntry` 交集型別，props 改 `ProfileEntry`；執行期邏輯、UI、IPC 參數未動。
- renderer 盤點：另一處手寫同一交集型別的是 `src/components/profiles/__tests__/WslDetails.test.tsx`（`type WslProfile = ProfileEntry & { wslKeepAlive?: boolean }`），已改用 `ProfileEntry`（只改型別、測試斷言不動，5 個測試照舊通過）。其他 renderer 檔沒有（`grep wslKeepAlive src/` 只剩 `electron.d.ts` 與上述兩檔）。

**E. keep-alive／精靈中止**
- 盤點結果：
  - 原本就有：`docs/agent-guide/multi-remote-profiles.md` 的 keep-alive 開關一段（`keepAliveProfileDistros` 唯一決定、`pin()` 與開關無關、UI、驗證）完整，未改；使用者說明 `docs/wsl-deployment.md`「Stopping a running step」已有精靈中止的使用者面行為（未改）。
  - 缺少：agent-guide 沒有精靈中止的開發端規則（唯一實作位置、不變式、接 `operationId` 的 handler 清單、已知限制）。
- 補在 `docs/agent-guide/multi-remote-profiles.md:21`（新 bullet「設定精靈的步驟中止」）：runner 層 abort（每次執行一個 `AbortController`、`raceAbort` 的提示、`finishAbortedStep` 等步驟結束才 rollback、15 s `abortSlow` 只提示繼續等、中止後仍成功也 rollback）、主行程 `WizardOperationRegistry`＋`wizard:abort-operation`（沒有合法 `operationId` = 原呼叫、early abort 60 s / 64 筆）、install-bundle 只殺 `tar` 不殺 `wsl.exe`、`startService` 的 `wsl-service-start-aborted`、不可中斷呼叫照舊等（含 T0840 `setUninterruptible`）、關閉精靈視窗 `void runner.cancel()` 背景 rollback、已知限制（`pgrep`/`pkill` 依賴、新舊 runner 可能並行）、驗證測試檔。
- 程式碼查證位置：`src/components/setup-wizard/wizard-runner.ts:390`（`WIZARD_ABORT_SLOW_NOTICE_MS`）、`:581-612`（`cancel()`）、`:642-646`（每次執行的 controller / `ctx.signal`）、`:802-818`（`finishAbortedStep`）；`src/components/setup-wizard/wizard-operation-registry.ts`（全檔）；`src/components/setup-wizard/wizard-abort.ts`（`runAbortableOperation`）；`electron/main.ts:855`（`wizardOperations`）、`:3977` / `:4142` / `:4184` / `:4251` / `:4266` / `:4282` / `:4298` / `:4396`（接 `operationId` 的 8 個 handler）、`:4405-4409`（`wizard:abort-operation`）；`electron/wsl-detect.ts:376-397`（`INSTALL_STOP_SCRIPT`、標記）、`:432-467`（`installBundle` signal）；`electron/wsl-systemd.ts:64-94`、`:293-296`；`src/components/setup-wizard/SetupWizardShell.tsx:681-684`（unmount → `void runner.cancel()`）；`electron/wsl-keepalive.ts:79-88`（`keepAliveProfileDistros`）；`electron/main.ts:1835-1838`（`syncWslKeepAlive`）。
  - 與 T0830 回報的差異（從程式碼得知）：T0830 後 T0840 / T0850 等又加了 `wsl:detect-facts`、`wsl:apply-env-item`、`wsl:apply-network-mirrored`、`docker:pull-image`、`docker:install-bundle-into-volume` 五個接 `operationId` 的 handler 與 `setUninterruptible`，docs 依現況寫。
- CLAUDE.md：「多 remote profile 同時連線（PLAN-039）」節（`CLAUDE.md:450-452`），新增 2 行必守規則（keep-alive 唯一由 `keepAliveProfileDistros`、`pin()` 無關；精靈中止唯一實作與「步驟真正結束後才 rollback」）、改 1 行連結說明（加「keep-alive 與精靈中止」）。共 +3 / −1；未新增 / 改 `##` 標題，該節由 5 行變 7 行（在 3～12 行內）。

**F. `ws-limits` / `FRAME_TOO_LARGE`**
- 補在 `docs/agent-guide/remote-security.md:20`（新 bullet「WebSocket frame 上限與 `FRAME_TOO_LARGE`」）；CLAUDE.md 未改（依工單）。
- 內容與查證位置：
  - `WS_MAX_PAYLOAD_BYTES` = 32 MiB：`electron/remote/ws-limits.ts:13`；server `maxPayload`：`electron/remote/remote-server.ts:626`（超過以 1009 關整條連線、auth 前生效所以不調高、舊 server 同值：`ws-limits.ts:3-8` 註解）。
  - 本機 reject：`encodeFrameWithinLimit`（`ws-limits.ts:31-44`，`Buffer.byteLength(JSON.stringify(frame), 'utf8')`）、訊息格式 `frameTooLargeMessage`（`ws-limits.ts:23-25`）；invoke 路徑 `electron/remote/remote-client.ts:688-695`（不送出、記 warn、其他 invoke 不受影響）；auth frame `remote-client.ts:467-474`（關 socket、`errorCode: 'network'`）。
  - 面板檢查：`checkRemoteImageBudget`（`src/lib/remote-image-budget.ts:51`，`REMOTE_IMAGE_BUDGET_BYTES` = 20 MiB `:23`），呼叫點 `src/components/ClaudeAgentPanel.tsx:1544`、`src/components/CodexAgentPanel.tsx:1792`；送出失敗放回草稿 `ClaudeAgentPanel.tsx:1662-1677`（`restoredInputText` / `restoredAttachments` / `remoteSendFailureMessage`）。
  - 已知缺口：fork 後自動送出的待送圖片（`onHistory` 路徑）沒有面板檢查 → 寫「T0884 處理中」。

### 驗證

- `npm run typecheck`：exit 0（0 錯誤）
- `npm run typecheck:electron`：exit 0（0 錯誤）
- `npm run test:unit`：Test Files 460 passed / 3 skipped（463）；Tests 8406 passed / 41 skipped（8447）；exit 0（log 中的 `Error: AttachConsole failed` 是 Windows node-pty 子程序的 stderr 雜訊，不是測試失敗）
- `npx vite build`：成功（exit 0）
- 驗證時 HEAD `8f155281`＋本單未提交變更；驗證後未再改產品檔，直接 commit 成 `ece924e5`。
- 證據分道：source / 型別 / 單元 / build = PASS；本單不需人工驗收（工單規定）。

### Commit

- 產品：`ece924e5`（`CLAUDE.md`、`docs/agent-guide/multi-remote-profiles.md`、`docs/agent-guide/remote-security.md`、`src/components/profiles/types.ts`、`src/components/profiles/details/WslDetails.tsx`、`src/components/profiles/__tests__/WslDetails.test.tsx`），以明確路徑 `git add`。
- 工單：本檔另一個 commit。未 push、未發版、未觸發 workflow；未使用 `git stash` / `reset` / `checkout --` / `restore`。

### 相關通過案例判定

本單沒有〈相關通過案例〉段落，不適用。

### 互動紀錄

（無：沒有向塔台提問，執行中沒有塔台補充）

### Renew 歷程

（無）

### 遭遇問題

- 範圍判斷（未另問）：D 項要求「renderer 端其他手寫同一交集型別一併列出並改」，唯一一處在 `WslDetails.test.tsx`，位於 `affects_files` 的 `src/components/profiles/` 範圍內，只改型別別名、不改斷言，故直接改。
- 公開 repo 去識別化：回報區與文件未寫真名、客戶名、家目錄路徑。

### 後續候選（給塔台）

- 無新增。fork 待送圖片的預算檢查由 T0884 處理；SSH 精靈主行程長呼叫接 `operationId`（T0830 的後續候選）仍未做，docs 已寫明「SSH 主行程呼叫沒有接 operation id，照舊等它結束」。

### 回報時間

2026-11-20 16:57 (UTC+8)
