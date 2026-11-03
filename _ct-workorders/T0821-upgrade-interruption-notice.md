---
schema_version: 1
schema_kind: workorder
id: T0821
title: "PLAN-063 子項 1＋2：Windows 升級前提示「安裝新版會結束所有終端」、升級後重開時說明上次升級結束了哪些終端"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-04T01:34:49+0800"
started_at: "2026-11-04T01:37:05+0800"
updated_at: "2026-11-04T01:37:05+0800"
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

（由 Worker 填寫）
