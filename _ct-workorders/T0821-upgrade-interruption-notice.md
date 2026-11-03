---
schema_version: 1
schema_kind: workorder
id: T0821
title: "PLAN-063 子項 1＋2：Windows 升級前提示「安裝新版會結束所有終端」、升級後重開時說明上次升級結束了哪些終端"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-04T01:34:49+0800"
started_at: "2026-11-04T01:37:05+0800"
updated_at: "2026-11-04T01:53:22+0800"
completed_at: "2026-11-04T01:53:22+0800"
session_ids:
  - "49cd5230-ea56-4640-9ce5-b8b63860e9d1"
depends_on: []
related:
  - "PLAN-063；D266；T0820（實測：NSIS 升級以 TerminateProcess 結束 BAT 與 Terminal Server，shell 跟著結束，重開走孤兒清理、無 Recovery 提示）；T0766 / T0767（被中斷的 agent 分頁）；T0642（`claude-sessions.json`）；T0578 / T0704 / T0113（Recovery、server recovery、孤兒清理）；T0563 / T0567 / T0776（Dialog 規則）"
affects_files:
  - _ct-workorders/T0821-upgrade-interruption-notice.md
  - src/components/UpdateNotification.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/main.ts
  - electron/upgrade-interruption.ts
  - electron/interrupted-agents.ts
  - electron/preload.ts
  - src/App.tsx
  - src/components/InterruptedAgentsDialog.tsx
  - src/components/ServerStatusToast.tsx
  - src/stores/interrupted-agents-store.ts
  - electron/__tests__/upgrade-interruption.test.ts
  - src/components/__tests__/
  - e2e/t0821-upgrade-interruption.spec.ts
  - CLAUDE.md
  - docs/agent-guide/upgrade-interruption.md
  - docs/agent-guide/README.md
  - README.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 不回歸：孤兒清理本身的行為與順序不改（`electron/main.ts` 孤兒 PID → `killOrphanPtyProcesses` → 清檔 → 啟動新 server；T0540 先殺程序樹再殺 shell）；Recovery 提示（T0578）、Terminal Server recovery 與既有「被中斷的 agent 分頁」（T0704 / T0766 / T0767）的觸發條件、對話框、一鍵 resume 行為不變；更新通知既有的檢查、按鈕、連結不變。新增的只是「偵測＋說明」。"
  - "🔴 不自動 resume、不自動重跑任何指令、不通知塔台（沿用 T0766 規則）；resume 一律經既有路徑（`startClaudeCliPty` / `resumeCodexCliTab` / main `terminal:resume-interrupted-agent`），參數判斷沿用 `claudeResumeArgs` / `codexResumeArgs`，不另寫。"
  - "🔴 CLAUDE.md 既有規則照守：任何模組不得在 import 期呼叫 `app.getPath('userData')`（lazy 取值）；`app-paths-bootstrap` 維持 main.ts 第一個 import；新增 Dialog 一律 `ModalOverlay`＋[X]／取消＋`onEscape`（優先沿用既有的 `InterruptedAgentsDialog`，不新開 Dialog）；renderer 日誌用 `window.electronAPI.debug.log`、main 用 `logger`；日誌不記 session id 全文（只記前 8 碼）、不記指令內容或權杖。"
  - "🔴 不改 NSIS 安裝程式（`build.nsis`、`customCheckAppRunning`、安裝腳本）——那是 PLAN-063 子項 3，本單不做。不改 macOS / Linux 的打包。"
  - "🔴 yolo：不得問使用者；設計上的取捨（例：agent 分頁清單需要改持久化格式、偵測條件有無法兼顧的情況）依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本單範圍的檔案（明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。不碰本機 BAT 安裝版與它的 Terminal Server；e2e 一律隔離 runtime＋`closeIsolated`。"
---

# T0821 — 升級前提示＋升級後說明（PLAN-063 子項 1、2）

## 元資料

- **工單編號**：T0821
- **類型**：implementation
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-04T01:34:49+0800
- **預估規模**：M

## 背景

T0820（PLAN-059 Q4）實測：Windows 的 NSIS 安裝程式在安裝新版時，以 `Stop-Process`（TerminateProcess）結束安裝目錄下的所有程序，包括 BAT 主行程與 Terminal Server；分頁的 shell 與執行中的指令因 ConPTY 由 server 持有也跟著結束。即使先關主視窗、保留 Terminal Server，升級一樣全部結束；升級後重開 BAT 走孤兒清理（`electron/main.ts` 約 376–395 行：`orphan PID … detected` → `Cleaned N orphan PTY process(es) from registry`），**沒有 Recovery 提示、也沒有任何說明**，分頁依存檔還原成新的 shell。BAT 沒有自動更新：更新通知（`electron/update-checker.ts`、`src/components/UpdateNotification.tsx`）只開 releases 頁面，使用者自己下載、雙擊安裝。細節見 T0820 回報區。

## 範圍

### 子項 1 — 升級前提示（只在 Windows）

1. 更新通知（`UpdateNotification.tsx`）在 `win32` 上加一句提示：安裝新版會結束所有終端分頁（含執行中的指令與 agent），請先完成或保存工作。文字經 i18n（en / zh-TW / zh-CN 三份），不影響既有按鈕與連結；macOS / Linux 不顯示（未研究其升級行為）。
2. README 的 Windows 安裝 / 更新說明加同樣內容（一兩句）。

### 子項 2 — 升級後說明（所有平台的偵測邏輯，觸發條件含版本變更）

1. 主行程記錄「上次執行的版本」（userData 下的小檔或既有設定，lazy 取路徑；寫入時機自訂，但必須在升級前就已寫好——例如每次啟動時寫入目前版本）。
2. 啟動時若「上次版本 ≠ 目前版本」**且**本次走了孤兒清理（清掉的 PTY 數 N ≥ 1）→ 判定「上次升級結束了 N 個終端」。版本相同的孤兒清理（例：當機）、或沒有孤兒的升級，都不觸發（行為與現在相同）。
3. renderer 顯示說明：一則 toast 或既有 `ServerStatusToast` 類的提示（選一種沿用既有元件的作法，寫明理由），內容含 N 與「升級會結束執行中的終端」的說明；只顯示一次。
4. **agent 分頁**：若能從既有存檔（工作區分頁的 `agentPreset`、`claude-sessions.json` 的 session id 等）判斷哪些還原的分頁原本是 claude / codex，就把它們列進既有的「被中斷的 agent 分頁」（`InterruptedAgentsStore` / `InterruptedAgentsDialog`，一鍵 resume 沿用 T0766 / T0767）。session 未知時照 T0766 規則（claude 用 `--resume` picker、codex 用 `codex resume` 選單）。若這需要改持久化格式或超出既有元件能力，**先問塔台**，不要自行擴大範圍；必要時本項可只做 toast、agent 清單另開單（回報 PARTIAL 並寫明）。
5. 日誌：一行 `[upgrade-interruption] …`（版本、N、agent 分頁數；不記 session id 全文）。

### 文件

- CLAUDE.md 新增一節（3–12 行，依 T0595 撰寫規則：用途、必守規則、唯一實作位置、不變式、連到 docs）；`docs/agent-guide/upgrade-interruption.md`（T0820 實測摘要、偵測條件、已知限制：子項 3 / 4 未做、macOS / Linux 未研究）；`docs/agent-guide/README.md` 索引加一列。

## 不做

- 不改 NSIS / 安裝腳本（子項 3）、不做 holder 模型（子項 4）；不改孤兒清理、Recovery、server recovery 的既有行為；不自動 resume；不發版、不 push。

## 驗證

- 單元：版本比對與觸發條件（版本變＋N≥1 才觸發；版本同、N=0、首次執行沒有上次版本 → 不觸發）、上次版本檔讀寫失敗不丟例外、更新通知只在 win32 顯示提示、agent 分頁判斷（若有做）。突變檢查：拿掉版本條件 / 拿掉 N 條件 → 對應測試失敗。
- e2e（隔離 runtime，開發版 build）：開 shell 分頁 → 關閉保留 Terminal Server → 以 pid 結束該 server（模擬安裝程式；只結束自己啟動的）→ 改寫「上次版本」為舊值 → 重開 → 看到說明且 N 正確、分頁還原；對照組：不改版本 → 不顯示。若有 agent 清單，用不呼叫模型的方式驗（例：存檔中的 `agentPreset`）。
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`；既有 `interrupted-agents-*` 測試與 `dialog-escape.test.tsx` 照過。
- 真實升級的驗收（pre.N → pre.N+1 都含本功能）要等下一次發版後，塔台以本機分支 `ct/T0820` 的探測 spec 改寫重跑——本單不做，回報寫建議的檢查點即可。

## 驗收

- [ ] 子項 1：win32 更新通知提示（三語）、非 win32 不顯示、README
- [ ] 子項 2：偵測條件、說明顯示一次、日誌；agent 分頁清單（或 PARTIAL 理由）
- [ ] 單元＋突變、e2e（含對照組）結果
- [ ] typecheck 0 / 0、unit、legacy、vite build
- [ ] CLAUDE.md 一節、docs、索引
- [ ] 不回歸：孤兒清理 / Recovery / server recovery / 既有被中斷 agent 對話框 / 更新通知既有行為
- [ ] 給塔台：真實升級驗收的檢查點

---

## 回報區

### 完成狀態

- **狀態**：DONE（子項 1、2 含 agent 分頁清單都完成；真實升級驗收依工單留給下次發版）
- **完成時間**：2026-11-04T01:52:28+0800
- **session_id**：49cd5230-ea56-4640-9ce5-b8b63860e9d1
- **產品 commit**：`710e4179`（`feat: T0821 upgrade interruption notice (PLAN-063 items 1+2)`）

### 落點檢查

- 結果：**PASS**。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS（工單在 REPO_ROOT 下）；C-3：前 5 個可測項目都存在（或祖先存在）→ PASS；C-2：工單無 `branch` 欄位（目前 `main`）。
- 未設 `CT_HOME`（main repo 執行）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 結果摘要

**子項 1（Windows 升級前提示）**
- `UpdateNotification.tsx`：`win32` 時在更新內容下方多一行 `update.windowsInstallEndsTerminals`（三語），判斷唯一實作 `showsWindowsUpgradeWarning(platform)`；macOS / Linux 不顯示。既有標題、版本、changelog、「在 GitHub 上查看」按鈕與連結、`checkForUpdates`、Esc / [X] 不變（樣式用 inline，未改 CSS 檔）。
- README「方式一：直接下載」下方加 Windows 更新說明（兩句）。

**子項 2（升級後說明）**
- 新模組 `electron/upgrade-interruption.ts`（不 import electron、路徑由 main 傳入）：
  - `last-run-version.json`（userData）：`UpgradeInterruptionCheck.begin()` 在 whenReady、`startTerminalServer()` 之前讀上次版本、寫入目前版本（temp＋rename，失敗只記一行）。
  - 觸發 `detectUpgradeInterruption`：上次版本 ≠ 目前版本 **且** 孤兒清理的 registry PTY 數 N ≥ 1；版本同 / N=0 / 無上次版本 → 不觸發。
  - 孤兒清理區塊只多一行 `noteOrphanCleanup(registry?.ptys ?? [], claudeSessionPersistence.entries())`（try/catch 包住），清理本身的順序（readRegistry → killOrphanPtyProcesses → Cleaned → clearRegistry → 刪 pid / port）不變，有 source guard。
  - `finishUpgradeInterruptionCheck()`（main，`startTerminalServer()` 之後、建立視窗之前）判定一次並記一行日誌。
- 顯示：本機 IPC `terminal-server:query-upgrade-interruption`（第一個問的視窗拿到、之後 null → 只顯示一次）；`App.tsx` 掛載時 pull，**沿用 `ServerStatusToast`**（新 key `app.upgradeInterrupted`，帶 count / from / to）。理由：同位置、同為「Terminal Server 的分頁被重建」語意，T0766 已有「N 個 agent 分頁已中斷，按此查看」一行與點擊開清單，可直接沿用，不新開 Dialog。heartbeat toast 優先；升級說明不自動消失，點一下關閉（有 agent 分頁時同時開清單）。
- **agent 分頁**（沒有改持久化格式）：`buildUpgradeInterruptedSources` 以 registry 的 terminal id 對 `windows.json` 存檔分頁的 `agentPreset` / `workspaceId` / `launchRole`，加上一個行程 `claude-sessions.json` 的 pending 紀錄（有 UUID session id 或 `--name` → `claude-cli`）→ 既有 `buildInterruptedAgentSnapshot`（新選項 `cause: 'upgrade'`）→ `InterruptedAgentsStore.record(snapshot, 'upgrade')`。session 未知照 T0766（claude `--resume` picker、codex `codex resume` 選單）；恢復全走既有路徑（`startClaudeCliPty` / `resumeCodexCliTab` / main `terminal:resume-interrupted-agent`）。
  - 記憶體多一個欄位 `InterruptedAgent.cause?: 'upgrade'`（renderer 鏡像同名）；`record(…, 'upgrade')` 送 `reason: 'update'`（對話框不自己開，由 toast 點開）。
  - 🔸 設計取捨（Worker 自行決定，未問塔台，理由見〈偏差與決策〉D-1）：`cause: 'upgrade'` 的項目**不因 `session-start` 移除**。
  - 對話框：每一列都是升級造成時改用 `interruptedAgents.upgradeTitle` / `upgradeDesc`；有 recovery 列時維持原文字。
- 日誌：`[upgrade-interruption] detected: previous=… current=… ended-ptys=N agent-tabs=M`（版本變但未觸發記 `none: …`、版本相同不記）；renderer `[upgrade-interruption] notice shown: …`；不記 session id 全文、指令、權杖。

**文件**：CLAUDE.md 新節「升級結束終端的提示與說明（PLAN-063 / T0821）」（5 點；全檔 73,368 字元）；`docs/agent-guide/upgrade-interruption.md`（T0820 摘要、偵測條件表、顯示、agent 分頁、日誌、已知限制、驗證）；`docs/agent-guide/README.md` 索引一列。

### 修改檔案

- 新增：`electron/upgrade-interruption.ts`、`electron/__tests__/upgrade-interruption.test.ts`、`src/components/__tests__/upgrade-interruption.test.tsx`、`e2e/t0821-upgrade-interruption.spec.ts`、`docs/agent-guide/upgrade-interruption.md`
- 修改：`electron/main.ts`、`electron/interrupted-agents.ts`、`electron/preload.ts`、`src/App.tsx`、`src/components/UpdateNotification.tsx`、`src/components/ServerStatusToast.tsx`、`src/components/InterruptedAgentsDialog.tsx`、`src/stores/interrupted-agents-store.ts`、`src/locales/{en,zh-TW,zh-CN}.json`、`CLAUDE.md`、`README.md`、`docs/agent-guide/README.md`
- **範圍外 1 檔**：`src/types/electron.d.ts`（見 D-2）

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | **0**（exit 0） |
| `npm run typecheck:electron` | **0**（exit 0） |
| `npm run test:unit` | **PASS**：403 files passed / 2 skipped；7087 tests passed / 38 skipped |
| `npm run test:legacy` | **PASS**：33 files、472 tests，0 failed |
| `npx vite build` | **PASS** |
| 新單元 `electron/__tests__/upgrade-interruption.test.ts` | 24 passed（觸發條件 4 種、版本檔讀寫 / 損壞 / 寫入失敗不丟例外、來源判斷、`UpgradeInterruptionCheck` 生命週期與只給一次、upgrade 項目的 session-start 規則、recovery 項目不變、main.ts 孤兒清理順序與接線 source guard） |
| 新單元 `src/components/__tests__/upgrade-interruption.test.tsx` | 18 passed（三語字串、更新通知 win32 顯示且既有內容 / 按鈕 / 連結不變、darwin / linux 不顯示、notice 解析、toast、對話框標題、App.tsx source guard） |
| 既有 `interrupted-agents-*`、`pty-manager-interrupted-agents`、`server-status-toast`、`dialog-escape`、`interrupted-agents-dialog` | PASS（含在 unit 全跑內，另單獨跑 9 檔 120 tests 通過） |
| 突變檢查 | 拿掉版本條件 → 2 測試失敗；拿掉 N 條件 → 2 失敗；win32 判斷改 `true` → 3 失敗；拿掉 session-start 規則 → 1 失敗。四項皆已還原（備份複製回去，`git diff --no-index` 比對相同） |
| e2e `e2e/t0821-upgrade-interruption.spec.ts`（隔離 runtime、開發版 build） | **2 passed**（59.5 s）。升級組：兩個 shell 分頁 → 關閉保留 Terminal Server → `taskkill /F /PID <server>`（不帶 `/T`）→ 改寫上次版本為 `0.0.1-e2e.1`、寫一筆 claude session 紀錄（不起 claude）→ 重開：log `Cleaned 2 orphan PTY…`、`detected: previous=0.0.1-e2e.1 current=0.7.4-pre.5 ended-ptys=2 agent-tabs=1`，toast「BAT 已升級（v0.0.1-e2e.1 → v0.7.4-pre.5）。安裝新版時結束了 2 個終端…」＋「1 個 agent 分頁已中斷，按此查看」，兩分頁還原，點 toast → 清單 1 列 claude-cli（session `11111111`、`data-cause=upgrade`），reload 後不再顯示、清單仍在；舊 shell pid 都已結束。對照組（不改版本）：無 toast、無 `detected`、清單 0，孤兒清理照舊 |
| 不回歸 e2e | `t0766-interrupted-agents-recovery`（1）＋`t0578-recovery-no-direct-shell`（recover / fresh 2）：**3 passed** |

### 相關通過案例判定

- 工單無〈相關通過案例〉段落；不回歸以 memory_overrides 列的既有行為核對：孤兒清理順序（source guard）、Recovery（t0578 e2e）、server recovery 被中斷的 agent（t0766 e2e、既有單元）、更新通知既有內容（新單元）皆成立。

### 偏差與決策

- **D-1（設計取捨，Worker 自行決定）**：還原的 claude-cli 分頁會自動開一個新的 claude（`WorkspaceView` 還原流程），它的 `SessionStart` 會觸發既有 `interruptedAgents.remove(id, 'session-start')`，升級列出的 claude 分頁幾秒內就會從清單消失。處置：只對 `cause: 'upgrade'` 的項目忽略 `session-start`（recovery 項目不變，有測試）。恢復路徑本來就會先 kill（`pty-ended`）或 `resumed` / `dismissed`，所以不會殘留；代價是使用者在 shell 分頁手打 `claude --resume` 時項目要手動「略過」。未改持久化格式、未新增元件，屬既有元件的小擴充，故未依 memory_overrides 問塔台；塔台若不同意可改回只做 toast。
- **D-2（範圍外 1 檔）**：`src/types/electron.d.ts` 不在 `affects_files`，但 preload 新增 `queryUpgradeInterruption` 後 renderer 型別必須同步（否則 typecheck 失敗）；只加 1 個 optional 方法型別與 1 個 type import。
- **D-3**：toast 不自動消失（升級說明需要時間閱讀），點擊關閉；recovery toast 的 3 秒行為不變。

### 遭遇問題

- 無阻斷。`app.close()` 在 e2e 的「保留 Terminal Server 關閉」路徑兩次超過 20 s 被強制結束（既有 T0575 / T0576 記載的量測現象，與本單無關，結果不受影響）。
- 觀察（既有行為）：e2e 升級組 reload 後 log 有 `reload detected 2 live PTYs — offering recovery`（T0110 的 View→Reload 路徑），本單未改。

### 已知限制

- 子項 3（NSIS）/ 4（holder）未做；macOS / Linux 升級未研究（偵測在所有平台都跑，提示只在 Windows）。
- 「版本變＋有孤兒」也可能是版本變更前一次剛好當機 / 手動結束 server；先「結束並停止 Terminal Server」再升級的使用者沒有孤兒 → 不顯示。
- 只給第一個視窗；縮圖 ⏸ tooltip 仍寫「因 Terminal Server 重啟而中斷」（`TerminalThumbnail.tsx` 不在範圍）；helper 派工 Worker 升級後沒有 workorder / 塔台 id。細節見 docs。

### 給塔台：真實升級驗收的檢查點（下次發版後，pre.N → pre.N+1 兩版都含本功能）

1. 以本機分支 `ct/T0820` 的探測 spec 改寫（安裝檔 `/S /currentuser`），情境 ①（主視窗開著升級）與 ②（關窗保留 server 後升級）重開後：debug log 依序有 `orphan PID … detected` → `Cleaned N orphan PTY…` → `[upgrade-interruption] detected: previous=<pre.N> current=<pre.N+1> ended-ptys=N agent-tabs=M`，renderer 有 `notice shown`。
2. 畫面：toast（`.server-status-toast[data-message-key="app.upgradeInterrupted"]`）含 N 與兩個版本；reload 後不再出現；`last-run-version.json` = 新版。
3. 加一個 claude-cli 分頁（可用 T0776 的 stub claude，避免呼叫模型）：清單列出該分頁、`data-cause=upgrade`，新的 claude 開起來後項目仍在。
4. 對照：「結束並勾選同時停止 Terminal Server」後升級 → 無 toast（`none: … ended-ptys=0`）；同版本重開（工作管理員結束 server）→ 無 toast、不記 `[upgrade-interruption]`。
5. 更新通知（Windows）出現警告行；macOS / Linux 不出現。

### 互動紀錄

- 無（yolo，未向塔台提問；D-1 自行決定並記錄於上）。

### 後續建議

- 縮圖 ⏸ tooltip 依 `cause` 顯示升級文字（`TerminalThumbnail.tsx`，小單）。
- PLAN-063 子項 3 / 4 照計畫另開。
