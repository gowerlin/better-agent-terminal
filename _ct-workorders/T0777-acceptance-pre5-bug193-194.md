---
schema_version: 1
schema_kind: workorder
id: T0777
title: "pre.5 自動化驗收（安裝版）：BUG-193 取回焦點的點擊不清淡化 ⚠️、BUG-194 自動開啟的對話框第一次 Esc 就關閉"
type: implementation
status: DONE
session_ids:
  - "d5634d75-fcab-4225-a59b-c2fd641c8aaa"
started_at: "2026-11-02T10:44:24+08:00"
updated_at: "2026-11-02T10:49:44+08:00"
completed_at: "2026-11-02T10:49:44+08:00"
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T10:43:30+08:00"
depends_on: []
related:
  - "BUG-193（T0774 `bd59ab0f`，D216）、BUG-194（T0776 `e717c786`，D217）；T0775 `1068c5f8`（`e2e/helpers/real-focus.ts`、關 focus emulation）"
  - "既有 e2e：`e2e/t0770-unfocused-wait-missed.spec.ts`（A–E，E = BUG-193）、`e2e/t0776-auto-dialog-focus.spec.ts`（BUG-194）、`e2e/t0735-workspace-waiting-badge.spec.ts`、`e2e/t0761-detached-workspace-waiting.spec.ts`、`e2e/t0762-*`、`e2e/t0563-*`、`e2e/t0567-*`、`e2e/t0757-mouse-answer-clears-waiting.spec.ts`；隔離實例 `e2e/fixtures/electron-isolation.ts`（`BAT_E2E_EXECUTABLE`）"
  - "CLAUDE.md「Worker 分頁回收」節（T0774 / BUG-193 段）、「Dialog 不因點擊外部關閉（T0563）、Esc 統一（T0567）」節（T0776 / BUG-194 段）"
affects_files:
  - "e2e/t0777-*.spec.ts（新增，只在情境 ③ 需要新寫時）"
  - docs/agent-guide/worker-tab-recycle.md
  - docs/agent-guide/dialog-close-and-escape.md
  - _ct-workorders/T0777-acceptance-pre5-bug193-194.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 驗收對象：安裝版 `C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe`（FileVersion `0.7.3-pre.5`，塔台已確認；tag `v0.7.3-pre.5` = `478fd178`，`1068c5f8` 之後 `src` / `electron` / `scripts` / `e2e` 沒有變動），以 `BAT_E2E_EXECUTABLE` 啟動隔離實例。某 spec 無法在安裝版跑 → 寫明原因，該情境改用 source build 前先問塔台。🔴 不跑 `npx vite build`（避免覆寫現有 `dist`；真的需要時先問塔台）。🔴 不改 `e2e/fixtures/electron-isolation.ts`、`e2e/helpers/real-focus.ts`。"
  - "🔴 情境 ①（BUG-193）：跑 t0770 全部（A–E），E 是主要驗收項：視窗失焦時等待結束留淡化 → 以點擊另一個分頁的縮圖取回焦點 → 原分頁淡化保留；只恢復焦點、不點擊 → 照 D203 清除。"
  - "🔴 情境 ②（BUG-194）：跑 t0776：自動開啟的 Dialog（T0776 盤點的 4 個）開啟時焦點在 Dialog 內（或遮罩），第一次 Esc 就關閉、Esc 不進背景分頁的 PTY；關閉後焦點回到開啟前的元素。"
  - "🔴 情境 ③（作業系統真實點擊，選做但盡量做）：比照 T0774 的查證方式（user32 `mouse_event` / `SendInput`，點擊前以 HWND 確認是隔離實例的主視窗、不是使用者的 BAT），在安裝版重現 BUG-193 的步驟一次，確認淡化保留。做不到就記原因、該項 PARTIAL，不影響其他情境。需要時新增 `e2e/t0777-*.spec.ts`（或沿用 T0774 留下的腳本，先看它的回報區）。🔴 真實點擊只能落在隔離實例的視窗；HWND 對不上就不點。"
  - "🔴 不回歸：同一個對象再跑 t0735、t0761、t0762、t0563、t0567、t0757 各 1 次。t0757 曾有一次偶發失敗（③ 清除原因 `user-prompt-submit`，疑 `permission-request` hook 晚到；T0775 已加診斷）：若再失敗，同一情境最多重跑 1 次，把 T0775 加的診斷輸出原文（不含權杖與家目錄路徑）貼進回報〈發現的問題〉，標明是否為同一現象；🔴 不修、不改 spec 斷言。"
  - "🔴 隔離與安全：一律用隔離實例（獨立 userData 與 remote port），不碰使用者正在用的 BAT（不讀它的 userData、不送 IPC、不結束它的程序）。工作區 / 目錄名含 `t0777`，跑完刪除。不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷 → 記在〈發現的問題〉附重現步驟與證據，由塔台開 BUG。不得讀出或印出認證檔、權杖內容，不傾印整個 `process.env`。"
  - "🔴 驗證：`npm run typecheck` = 0、`npm run typecheck:electron` = 0（新 spec 在 tsconfig 範圍外就註明並單檔檢查）。docs：`worker-tab-recycle.md` 的 BUG-193 段、`dialog-close-and-escape.md` 的 BUG-194 段各補一行安裝版 `0.7.3-pre.5` 結果。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑或帳號。Playwright `--output` 指到 session 暫存目錄。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0777 — pre.5 自動化驗收（安裝版）：BUG-193 / BUG-194

## 元資料

- **工單編號**：T0777
- **類型**：implementation（驗收用 e2e，不改產品程式碼）
- **優先級**：P2
- **建立時間**：2026-11-02T10:43:30+08:00
- **預估規模**：S

## 背景

`v0.7.3-pre.5` 已發佈，內含 BUG-193（T0774）與 BUG-194（T0776）的修正，兩者都是 FIXED、待驗收。使用者指示安排自動驗收（2026-11-02 第一百零四 session 重啟（四））。通過即由塔台依 R-G003 結案（修正已進入發佈版，且在安裝版實測過）。

## 範圍

1. 情境 ①–②（必做）、③（選做）。
2. 不回歸 6 支 spec。
3. docs 各一行。

## 不做

- 不改產品程式碼、不 build、不改共用 fixture / helper。
- 不碰使用者正在用的 BAT。
- t0757 偶發失敗只記錄、不修。

## 驗收

- [x] 情境 ①–③ 逐項結果（PASS / FAIL / PARTIAL＋原因），每項寫明驗收對象
- [x] 不回歸 6 支結果（含 t0757 是否重現偶發失敗）
- [x] 兩個 typecheck = 0
- [x] 〈發現的問題〉與〈仍需手動〉

---

## 回報區

### 完成狀態

- **結果**：DONE（情境 ①、②、③ 全部 PASS；不回歸 6 支全綠；兩個 typecheck = 0）
- **完成時間**：2026-11-02T10:49:03+08:00
- **session_id**：d5634d75-fcab-4225-a59b-c2fd641c8aaa
- **產品 commit**：`e1e7f2d1`（新增 `e2e/t0777-real-click-focus-regain.spec.ts`、兩份 docs 各一行；`src/` / `electron/` / `scripts/` 未改）

### 落點檢查

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：可測項目 `docs/agent-guide/worker-tab-recycle.md`、`docs/agent-guide/dialog-close-and-escape.md` 皆存在（`e2e/t0777-*.spec.ts` 含萬用字元、略過）→ PASS
- C-2：無 `branch` 欄位；目前 `main`
- 非 worktree（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`
- 工單原 `status: TODO`（非 `PENDING`），開工改 `IN_PROGRESS`

### 驗收對象

- 安裝版 `C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`，FileVersion `0.7.3-pre.5`（PowerShell `VersionInfo` 實查）；隔離實例 log `executable=…BetterAgentTerminal.exe`、t0777 spec 另記 `app.getVersion()` = `0.7.3-pre.5`。
- 全部以 `BAT_E2E_EXECUTABLE` 啟動隔離實例（各自 `--runtime=e2e-*`、獨立 userData、隨機 remote port）。未跑 `npx vite build`，未改 `e2e/fixtures/electron-isolation.ts`、`e2e/helpers/real-focus.ts`。
- `1068c5f8..HEAD` 的 `src` / `electron` / `scripts` / `e2e` 無差異（`git diff --stat` 為空；本機沒有 `v0.7.3-pre.5` tag，以塔台記載的 `478fd178` 為準）。
- Playwright `--output` 指到 session scratchpad。

### 情境結果

| 情境 | 結果 | 驗收對象 | 證據 |
|---|---|---|---|
| ① BUG-193（t0770 A–E） | **PASS** | 安裝版 0.7.3-pre.5 | A：有焦點看著時結束 → 無淡化；B：失焦（focus-sink 取走焦點，`hasFocus=false`）時結束 → 縮圖與工作區列淡化（`data-waiting=missed`）；C：失焦中 DOM click 切分頁、恢復焦點 → 仍淡化，切回 → 清除；D：只恢復焦點、不點擊 → 清除（D203）；**E：失焦時結束 → 淡化，Playwright 滑鼠點另一個分頁縮圖取回焦點（`afterClick` `hasFocus:true`）→ 原分頁淡化保留，切回 → 清除**。1 passed（15.7 s） |
| ② BUG-194（t0776） | **PASS** | 安裝版 0.7.3-pre.5 | ① 只結束隔離實例自己的 Terminal Server（pid 取自隔離 userData、命令列 = 安裝版 `terminal-server.js`、父程序 = 隔離主程序）→ `InterruptedAgentsDialog` 自動開啟：焦點在 `.dialog-overlay`（`inModal:true`），第一次 Esc 關閉，記錄器讀到 `[]`（無 `1b`），關閉後焦點回 shell 分頁 `xterm-helper-textarea`，之後打的 `q` 進 PTY；② `app:open-settings` 的 Settings：焦點在 `.settings-overlay`、第一次 Esc 關閉、PTY 沒收到、焦點回 xterm。修正前方法檢查：未開 Dialog 時 `k` + Esc 確實進 PTY（`["READY","6b","1b"]`），證明記錄器有效。1 passed |
| ③ BUG-193 作業系統真實點擊（新 `e2e/t0777-real-click-focus-regain.spec.ts`） | **PASS** | 安裝版 0.7.3-pre.5 | 等待分頁 X 失焦時結束 → 淡化；PowerShell user32 `SetCursorPos` + `mouse_event`（DPI aware）點分頁 Y 的縮圖，點擊前 `WindowFromPoint` → `GetAncestor(GA_ROOT)` 與隔離實例主視窗 `getNativeWindowHandle()` 比對：`{"clicked":true,"rootMatches":true}`；點擊後 `{"hasFocus":true,"focusedWindow":"window#1"}`、Y 變 active、1.5 s 後 X 淡化仍在、工作區列 `data-waiting=missed`；選回 X → 清除。隔離實例 debug log：`[workspace-waiting] focus regain: held=e2e-t0777-wait active=e2e-t0777-other focused=true → kept`。1 passed（12.2 s） |

說明：
- ③ 的作法沿用 T0774 probe（Worker scratchpad 副本）的 PowerShell 腳本與 HWND 檢核，改成完整重現 BUG-193 步驟並加斷言；HWND 不符時 `test.skip`（記 PARTIAL）、不點擊。主視窗只在點擊前後暫設 always-on-top，游標點完還原。
- 工作區 / 目錄名皆含 `t0777`（`e2e-t0777`、`%ProgramData%\bat-e2e-t0777-*`），跑完已刪除（log `t0777 folder removed: true`、`runtime userData removed: true`）。

### 不回歸（安裝版 0.7.3-pre.5，各 1 次）

| spec | 結果 | 備註 |
|---|---|---|
| `t0735-workspace-waiting-badge` | PASS（5.6 s） | 步驟 4 實際有焦點（`hasFocus:true`、focused window main）→ 不留淡化 |
| `t0761-detached-workspace-waiting` | PASS（14.0 s） | detached 視窗步驟 5 實際有焦點 |
| `t0762-claude-panel-waiting` | PASS（5.3 s） | allow / deny / missed 三項 PASS |
| `t0563-dialog-no-outside-close` | PASS（2.8 s） | Settings / Profiles 點遮罩、拖出不關，[X] 關 |
| `t0567-dialog-esc` | PASS（2.6 s） | Settings Esc 關；精靈開著時 Esc 不關精靈與 Profiles |
| `t0757-mouse-answer-clears-waiting` | PASS（1.1 m） | ①–⑤、W、K、⑥ 全 PASS；**偶發失敗未重現**（③ 的 hooks 序列為 `ask-user-question→blocked` 後清除原因 `mouse press`）。同檔 `PROBE` 測試依設計 skip（需 `T0757_PROBE=1`），不計入 |

合計 6 passed、1 skipped（PROBE），1.6 m。

### 驗證

- `npm run typecheck`：0 錯誤
- `npm run typecheck:electron`：0 錯誤
- 新 spec 在兩個 tsconfig 的 `include` 範圍外 → 單檔 `npx tsc --noEmit --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --strict --skipLibCheck --types node e2e/t0777-real-click-focus-regain.spec.ts` exit 0（同參數檢 `t0770` 對照也 exit 0）
- 跑完檢查：`%ProgramData%\bat-e2e-*` 無殘留、`%APPDATA%\BetterAgentTerminal-runtime-e2e-*` 無殘留、命令列含 `runtime=e2e` 的 `BetterAgentTerminal.exe` 程序 0 個

### 變更檔案

- `e2e/t0777-real-click-focus-regain.spec.ts`（新增，情境 ③）
- `docs/agent-guide/worker-tab-recycle.md`：BUG-193 段（e2e 焦點注意事項之後）補一行安裝版 `0.7.3-pre.5` 結果
- `docs/agent-guide/dialog-close-and-escape.md`：驗證項下補一行 BUG-194 安裝版 `0.7.3-pre.5` 結果
- 本工單

### 發現的問題

- 無產品缺陷。
- t0757 偶發失敗本次未重現，無診斷輸出可貼。
- 觀察（非本單產生）：`%TEMP%` 下有其他工單留下的資料夾 `bat-t0718-*`、`bat-t0750`、`bat-t0755-settings-*`，不屬本單，未動。

### 仍需手動

- BUG-194 盤點中的 `AppNotificationDialog`、`RecoveryPrompt` 在安裝版沒有 e2e（T0776 只有單元測試）；t0776 只涵蓋 4 個自動開啟 Dialog 中的 2 個（`InterruptedAgentsDialog`、Settings）。若塔台要求這兩個也在安裝版實測，需另開單或手動：終端分頁有焦點時觸發 app 通知（如遠端連線失敗）／BAT 重開出現 Recovery 提示，按 Esc 確認不進背景 PTY。
- 使用者真實日常操作（多螢幕、Alt+Tab 後點擊、觸控板點擊）未自動化；③ 只驗了單螢幕主視窗上一次左鍵點擊。

### 互動紀錄

- 無（yolo，未向塔台提問）

### 遭遇問題

- 無
