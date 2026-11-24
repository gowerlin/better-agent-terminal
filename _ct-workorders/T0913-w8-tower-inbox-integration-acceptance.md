---
schema_version: 1
schema_kind: workorder
id: T0913
title: "PLAN-068 W8（在 `v0.8.x`）：整合驗收 —— 隔離實例 e2e 走完整流程（假 TUI 塔台＋ Worker `bat-notify --submit`、契約 v2 版本組合、待辦分頁回答、回合訊息卡、`hooks:` 行、headless 遠端路徑），並產出給使用者 / CT 的待實機清單"
type: verification
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T06:40:09+08:00"
started_at: "2026-11-25T06:41:22+08:00"
updated_at: "2026-11-25T07:00:38+08:00"
completed_at: "2026-11-25T07:00:38+08:00"
session_ids:
  - "aa376a3a-53d7-42ad-b596-35389a4f7799"
target_version: "0.8.x（與 CT 6.1.0 同日發佈）"
depends_on: [T0911]
related:
  - "PLAN-068；T0902（§6′ 版本組合表、待實機 T-1–T-12）；T0903–T0911 回報區（各自的待實機項目）；T0904 的 `e2e/t0904-tower-notify-protection.spec.ts` 與 `e2e/fixtures/fake-line-editor.mjs` / `notify-job-runner.mjs`（可沿用）"
affects_files:
  - _ct-workorders/T0913-w8-tower-inbox-integration-acceptance.md
  - e2e/
  - electron/remote/__tests__/
  - electron/__tests__/
  - src/__tests__/
  - src/components/__tests__/
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0913（塔台已預先從 `v0.8.x` `17c84662` 建立分支 `ct/T0913`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0913` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `17c84662b6e7721c3201cc2964aacc7a920db5eb`，不符就停下問塔台。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只新增 / 修改測試與 e2e（`affects_files`），🔴 不改產品程式。驗收中發現產品缺陷：不要修，記錄重現步驟與證據，狀態 `PARTIAL` 並在回報區建議開 BUG（塔台開單）。與平行的 T0912（W7 文件）不重疊。"
  - "🔴 驗收範圍（隔離實例 `launchIsolated`，假 TUI，不登入 claude / codex）：① 版本組合（T0902 §6′ 表）：未宣告 / `--bat-contract 1` / `2` / `3` 的塔台分頁 × 狀態檔 `bat_contract` 缺 / 1 / 2 / 3：徽章 `CT↑` / `BAT↑`、P-1 / P-2 / P-3、待辦分頁停用 / 可用、保護（`draft` / `reading` / B0）只在相符時生效、T0788 既有保留對所有分頁照舊。② 完整流程（契約 2）：假 TUI 塔台寫 `_tower-state.md`（`bat_contract: 2`、`awaiting_user` / `user_actions` / `reminders`）→ 待辦分頁三區顯示 → 從分頁回答 → 塔台輸入框收到一行 `U-n：<代號>` / `A-n：完成`（經保留佇列；塔台輸入框有草稿時不送、草稿送出後才送）；Worker `bat-notify --submit` 的通知不混進草稿、不搶捲動；`⏸N` 縮圖。③ 回合訊息卡：以真 `bat-hook.mjs stop`（stdin 餵 `last_assistant_message`）在契約 2 塔台分頁產生卡片 → 待辦分頁「💬」顯示、展開已讀、釘選、加亮行、縮圖 `💬N`；非塔台分頁不收。④ `--set-role --bat-contract 2` 的 `bat-contract:` 與 `hooks:` 行（`none (not-launched-by-bat)` 等可在隔離實例產生的狀態）、`🪝✕` 徽章。⑤ headless 遠端路徑（`electron/remote/__tests__` 的真 headless＋node-pty 風格）：`tower-inbox:answer`、`terminal:notify-hold-*`、`tower-cards:*`、`terminal:hooks-status` 經 proxied 正常、helper 權杖被拒。⑥ 舊呼叫回歸：不帶 `--bat-contract` 的 `--set-role` 輸出逐字不變、`bat-notify` exit code 與 stdout 不變。"
  - "🔴 待實機清單：彙整 T0902 T-1–T-12 與 T0903–T0911 回報的待實機項目，去重後按「使用者（Windows 安裝版）/ CT 塔台（新 CT 6.1.0 ＋ BAT 測試版、新 CT ＋舊 BAT 降級、T-8）/ 遠端（WSL）」分組，每項寫成可照做的步驟與預期結果，放在回報區〈待實機清單〉（塔台會轉給使用者與 CT）。"
  - "🔴 驗證：worktree `npm ci`；新 e2e 連續 2 次通過；`npm run test:unit` 第一次完整執行全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0。不得以預設實例啟動；不碰使用者正在用的 BAT（安裝版）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn。`TMP` 用系統預設。程序清理照 D308。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "🔴 公開 repo（D176）：測試 fixture 與回報區不寫真名、客戶名、家目錄路徑（範例路徑 `C:\\Users\\demo`）。日誌不記內容、權杖、env。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0913 — PLAN-068 W8：整合驗收

## 背景

PLAN-068 的 W0–W6、W9 已合併進 `v0.8.x`（`17c84662`），各單都有單元 / 元件測試與部分 e2e，但還沒有一次把整條流程（契約版本判定 → 待辦清單 → 回答 → 保留佇列 → 回合訊息卡 → hooks 狀態）在隔離實例上走完。本單做整合驗收，並整理給使用者與 CT 的待實機清單，作為與 CT 6.1.0 同日發佈前的關卡。

## 驗收

- [x] ① 版本組合表每一列
- [x] ② 待辦清單 → 回答 → 保留佇列完整流程
- [x] ③ 回合訊息卡
- [x] ④ `--set-role` 的兩行與 `🪝✕`
- [x] ⑤ headless 遠端路徑與權杖拒絕
- [x] ⑥ 舊呼叫不回歸
- [x] 新 e2e ×2、`test:unit` 第一次即綠、legacy、build、typecheck
- [x] 〈待實機清單〉（使用者 / CT / 遠端分組）
- [x] 隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（驗收 ①–⑥ 全部在隔離實例 / 真 headless 通過；驗證關卡全綠；沒有發現產品缺陷；需要真回合 / 登入 / 真 CT / 遠端的項目整理在〈待實機清單〉）
- **session_id**：aa376a3a-53d7-42ad-b596-35389a4f7799
- **落點檢查**：PASS。C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`；C-1：工單在 `$CT_HOME/_ct-workorders/`；C-3：`affects_files` 的目錄都存在；C-2：分支 `ct/T0913`。`CT_HOME` 已設、`CT_WORKTREE_BRANCH` = `ct/T0913`，`git merge-base HEAD v0.8.x` = `17c84662b6e7721c3201cc2964aacc7a920db5eb`（符合）。`BAT_WORKSPACE_ID` 有設（只記錄）。
- **改動檔案**（只有測試，沒有產品程式）：
  - `e2e/t0913-tower-inbox-integration.spec.ts`（新增，隔離實例整合驗收 ①②③④⑥）
  - `e2e/fixtures/helper-job-runner.mjs`（新增，在 BAT PTY 內以該分頁自己的權杖跑 helper；可選擇在前景跑假 TUI。`notify-job-runner.mjs` 的一般化版本，原檔不動）
  - `electron/remote/__tests__/headless-tower-inbox-e2e.test.ts`（新增，⑤ 真 headless＋node-pty）
- **commit**：`a00b1b4a` test(T0913): PLAN-068 W8 integration acceptance (isolated e2e + headless remote path)

### 驗收結果

**e2e：`e2e/t0913-tower-inbox-integration.spec.ts`**（隔離實例 `launchIsolated('t0913')`，假 TUI `fake-line-editor.mjs`，Worker 以 `bat-terminal.mjs --notify-id` 真派工，helper 在 PTY 內以自己的權杖執行；不登入、不開 claude / codex 回合；約 1.5 分鐘）

① 版本組合（T0902 §6′）——每格都以 `_tower-state.md` 實際寫檔＋↻ 後量到：

| 分頁宣告 | 縮圖徽章 | 狀態檔缺 | `bat_contract: 1` | `2` | `3` | Worker `--submit` 遇草稿 |
|---|---|---|---|---|---|---|
| 沒有已宣告塔台 | 無 | P-1（＋「狀態檔不存在」說明） | P-1 | 相符 | P-2 | 混入草稿（照舊） |
| `--set-role tower`（未宣告契約） | `CT↑` | P-1 | P-1 | P-1 | P-1 | 混入草稿（照舊，#23） |
| `--bat-contract 1` | `CT↑` | P-1 | P-1 | P-1 | P-1 | 混入草稿（照舊） |
| `--bat-contract 3` | `BAT↑` | P-2 | P-2 | P-2 | P-2 | 混入草稿（照舊） |
| `--bat-contract 2` | 無 | P-3 | P-3 | 相符 | P-2 | 保留（📨 `draft`），使用者 Enter 後草稿與通知分開送出 |

- 不相符時待辦分頁只有選擇器＋提示（沒有任何區塊）、分頁標題 `!`；相符時有區塊、沒有 `!`。
- T0788 對話框保留不綁版本：塔台分頁內以真 `bat-hook.mjs permission-request` 進入 blocked（`permission`）→ Worker `--submit` 保留 → 使用者回答（Enter）後 1 s 送出；契約 2 與 `--bat-contract 1` 各量一次，結果相同。
- 塔台改宣告回 `--bat-contract 1` 後，待辦分頁回到 P-1、縮圖 `💬N` 消失（T0909 已知行為）。

② 契約 v2 清單 → 回答 → 保留佇列：
- 假塔台寫 `awaiting_user`（U-1 選項、U-2 自由回答）、`user_actions`（A-1＋`command`）、`reminders`（已到期）→ 三區顯示、指令原文顯示、塔台縮圖 `⏸2`、待辦分頁標題數字。
- U-1 選 `A` 送出 → 塔台輸入框收到並送出一行 `U-1：A`（狀態「已送出」，log `[tower-inbox] answer … id=U-1 len=5 → sending`）。
- 塔台輸入框有草稿 `draft-c ` 時按 A-1「完成」→ 狀態「已排入待送佇列」；同時 Worker `--submit` → 也保留；縮圖 📨 2（原因 `draft`）；3 s 內什麼都沒送、草稿不變（通知沒混進草稿）；使用者 Enter 後依序送出 `draft-c ` → `A-1：完成` → `T0913 notify-c`。
- 往上捲（真 xterm 捲動，log `[tower-reading] … reading=true`）：U-2 自由回答 `ship it` 立即送出（`reading` 不擋回答），viewportY 不變；Worker 通知保留（原因 `reading`）→ 縮圖「立即送出」→ 送出，viewportY 仍不變（B0：不搶捲動）。實測 viewportY 91 / baseY 121 → 送出後 91 / 125。
- 假塔台把 U-1 從狀態檔移除 → `⏸1`、「最近已結」列出 U-1。

③ 回合訊息卡：塔台 PTY 內真 `bat-hook.mjs stop`（stdin 餵 claude 的 hook JSON：`last_assistant_message` 多行，含 `⏸ 待你決定：` 行與 `<b>not bold</b>`）→ exit 0、stdout 空；縮圖 `💬1`；「💬」區卡片未讀、預覽第一行、加亮行；展開 = 已讀（`💬N` 消失）、全文以純文字顯示（沒有 `<b>` 元素）；📌 釘選；第二回合後 `💬1`、釘選卡在最上。Worker PTY 送同樣的 stop 訊息 → log `dropped: not a contract-2 Tower`，`tower-cards:list` 沒有卡片。

④ `--set-role` 的兩行（逐字比對 stdout）：
- `--bat-contract 1`：`  bat-contract: 2` ＋ `  hooks: none (not-launched-by-bat)`（沒有 `🪝✕`：不相符不出）
- `--bat-contract 3`：`  bat-contract: 2 (requested 3: unsupported)` ＋ `  hooks: none (not-launched-by-bat)`
- `--bat-contract 2 --agent codex`：`  hooks: n/a (codex)`，沒有 `🪝✕`
- `--bat-contract 2`：`  hooks: none (not-launched-by-bat)`，縮圖 `🪝✕`（`data-hooks-status="not-launched-by-bat"`）、待辦分頁標頭 hooks 提示
- 第一個 hook 回報後：`🪝✕` 消失；再宣告 → `  hooks: ok (injected, set 2)`、提示消失

⑥ 舊呼叫不回歸：以 PLAN-068 W0 之前的 commit `fda8a4b4`（`4eb3d988^`）的 helper（`git show` 取出）與目前 helper 對同一個 BAT 比較：
- `--set-role tower --terminal-id …`（不帶 `--bat-contract`）：兩者 exit 0、stdout 都是 `✓ Tower role set: e2e-t0913-tower\n`、stderr 空，逐字相同。
- `bat-notify --submit`：送到未宣告塔台（直接送出）與送到契約 2 塔台（草稿保留）兩種情況，舊 / 新 helper exit code 都是 0、stdout 除訊息文字外逐字相同（`✓ Notified e2e-t091…: <訊息>`）。
- 日誌：`[tower-cards]` / `[tower-inbox]` / `[notify-hold]` / `[hooks]` 行沒有卡片、回答、草稿、通知文字；沒有 `batcap.` 權杖。

⑤ headless 遠端路徑：`electron/remote/__tests__/headless-tower-inbox-e2e.test.ts`（T0388 harness：in-process server＋wss＋真 node-pty；塔台與 Worker 的呼叫在各自 PTY 內以自己的權杖執行，harness client = 遠端視窗）——7 項全過：
- 塔台 `set-role batContract 2` → 視窗收到 `terminal:hooks-status`（`none / not-launched-by-bat`）與 `role-changed`（`towerContract: 2`）；stop 回報後 `terminal:hooks-status` 變 `ok / injected / set 2`。
- `tower-cards:list` / `mark-read` / `pin` / `clear`（不含釘選）從視窗正常；`tower-cards:changed` 不含文字。
- `tower-inbox:answer` → 寫進塔台 PTY、Enter 以 `terminal:keypress`（`source: 'answer'`、`userInput: true`）送到視窗；格式錯 → `invalid`；對 Worker → `not-contract-tower`。
- 視窗輸入草稿後：回答保留＋Worker `pty:write`/`keypress` 保留；`terminal:notify-hold-list` 回 `reason: 'draft'`、兩筆（第一筆 `kind: 'answer'`）；`-cancel` 取消通知、`-send-now` 送出回答；`notify-hold-changed` 事件不含任何文字。
- 塔台與 Worker 的 PTY 權杖呼叫 `tower-inbox:answer`、`terminal:notify-hold-list/-cancel/-send-now`、`tower-cards:list/mark-read/pin/clear/set-panel-tower` 全部被拒（`channel` 不允許），卡片不受影響。

**驗證關卡**

| 關卡 | 結果 |
|---|---|
| worktree `npm ci` | exit 0 |
| 新 e2e 連續 2 次 | `npx playwright test e2e/t0913-tower-inbox-integration.spec.ts`：1 passed（1.5m）× 2，連續兩次（另有修正前的開發中執行，見〈遭遇問題〉） |
| headless 新測試 | 7 passed（單獨 2 次＋全套 1 次） |
| `npm run test:unit`（head `a00b1b4a`，第一次完整執行） | 491 files passed / 3 skipped；8950 tests passed / 42 skipped；0 failed |
| `npm run test:legacy` | files 33 passed, 0 failed；tests 472 passed, 0 failed |
| `npx vite build` | exit 0 |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |

- 只用隔離實例；沒有碰安裝版 BAT、其 userData / Terminal Server / `bat-pty-holder`；沒跑 `t0859-pty-holder.spec.ts`；沒有開 claude / codex 回合。收尾後查無 `t0913` 相關殘留程序（D308）。`TMP` 用系統預設。

**產品缺陷**：沒有發現。

**建議後續**（給塔台）：
1. `docs/agent-guide/tower-inbox.md` 各節「實機：交 W8 整合驗收（隔離實例）」可改成指向 `e2e/t0913-tower-inbox-integration.spec.ts` 與 `headless-tower-inbox-e2e.test.ts`（docs 不在本單範圍，可併入 T0912 / W7）。
2. 〈待實機清單〉M-C6（新 CT＋舊 BAT 降級）在 T0902–T0911 沒有任何單列出，預期行為只來自 T0902:538；建議塔台確認 CT 6.1.0 端的處理後再交實機。

### 待實機清單

> 來源：T0902〈待實機清單〉T-1–T-7（:479-487）、〈第二版新增〉T-8–T-12（:697-703），以及 T0903–T0911 回報區的待實機項目（T0907 / T0911 沒有）。已去重：同一 T 編號的多個來源併成一項並列出來源。本單 e2e 已在隔離實例驗過的部分（見〈驗收結果〉）不重列，只留需要真 claude / codex 回合、登入、真 CT、遠端或人眼看畫面的部分。T-6（claude channels 可用性）屬長期研究、沒有任何 W 單列入，不列。
> 編號 `M-*` 只是本清單的代號（不是 CT 的 `U-n` / `A-n`）。「BAT 測試版」= 含 PLAN-068 的 `0.8.x` 預覽版；「舊 BAT」= 安裝版 `0.8.0-pre.2`（PLAN-068 之前）。

#### 一、使用者（Windows 安裝版 BAT 測試版）

| # | 來源 | 步驟 | 預期 |
|---|---|---|---|
| M-U1 | T0906:192（右側欄畫面） | 開一個有 `_ct-workorders/` 的工作區，右側欄點「待辦」；把側欄拉窄、拉寬；摺疊 / 展開各區塊後重開 BAT | 標頭（塔台、契約狀態、↻）不被擠掉；長文字換行不撐出水平捲軸；摺疊狀態在重開後保留；分頁標題數字 / `!` 與內容一致 |
| M-U2 | T0906:192（detached） | 把上一項的工作區分離成 detached 視窗，在 detached 視窗的分頁列點「待辦」；在塔台分頁用 CT 6.1.0 開工 | detached 視窗的待辦分頁與主視窗內容相同、可回答；主視窗的工作區列表在 ⚠️ 旁顯示 `⏸N`（只有 `⏸N` 的 detached 列點了不帶出視窗，屬已知限制 T0908:189） |
| M-U3 | T0908:176（面板塔台回答） | 工作區不開任何 `--set-role` 塔台分頁，`_tower-state.md` 寫 `bat_contract: 2` 與一筆 `awaiting_user`；開 Claude Agent 面板（需登入）；① 面板輸入框打幾個字後從待辦分頁回答 ② 清空輸入框後再回答 | ① 該筆顯示「面板有草稿」、輸入框內容不變、什麼都沒送 ② 面板送出一回合，內容是一行 `U-n：<代號>` |
| M-U4 | T0902 T-3 | claude 塔台（BAT 開的 claude-cli 分頁，CT 6.1.0 開工）`/tui fullscreen`，`/config` 把 Auto-scroll 分別開 / 關；往上捲後請 Worker 送一則 `--submit` 通知 | 關 Auto-scroll：畫面不被拉回；開 Auto-scroll：claude 自己拉回（BAT 不另外拉）；兩種情況通知都在停手 10 s 後送出（BAT 只看得到滾輪 / PageUp） |
| M-U5 | T0902 T-5 | codex 塔台（需登入）以 CT 6.1.0 開工；輸入框打半句 → Worker 送通知；再試 Ctrl+C 清空、Enter 送出、Shift+Enter 換行後各送一次通知 | 有半句時通知保留（📨「你在輸入」）；Ctrl+C 或 Enter 後 1 s 送出；Shift+Enter 後仍視為有草稿（保守誤判可接受，記下實際行為） |
| M-U6 | T0902 T-9 | 依 README 從 BAT repo 的 marketplace 安裝 `bat-hooks` plugin；分別在「預設 shell 是 Git Bash」與「預設 shell 是 PowerShell」的 BAT 分頁手打 `claude` 開塔台、CT 6.1.0 開工 | 兩種 shell 的 `--set-role` 輸出都有 `  hooks: ok (plugin, set 2)`；縮圖沒有 `🪝✕`；第一個回合結束後待辦分頁「💬」有卡片 |
| M-U7 | T0902 T-11 | 測試專案的 `.claude/settings.json` 寫 `"disableAllHooks": true`，用 BAT 開 claude-cli 塔台、CT 6.1.0 開工 | `hooks: none (no-report)`；縮圖 `🪝✕`，tooltip 說明專案設定關掉了 hooks；待辦分頁標頭有同一行提示 |
| M-U8 | T0909:158（codex 說明、G7） | ① codex 塔台以 CT 6.1.0 開工 → 開待辦分頁 ② （選做）Settings 切 system runtime、系統 claude 低於 2.1.47，開 claude 塔台跑一個回合 | ① 「💬」區只有一行「codex 塔台沒有回合訊息卡」說明 ② 「💬」區顯示「claude 版本太舊（需要 2.1.47 以上）」，升級後有卡片即消失 |

#### 二、CT 塔台

**新 CT 6.1.0 ＋ BAT 測試版**

| # | 來源 | 步驟 | 預期 |
|---|---|---|---|
| M-C1 | T0910（開工兩行） | BAT 開的 claude-cli 分頁跑 CT 6.1.0 開工 | `--set-role` 輸出 `  bat-contract: 2` 與 `  hooks: ok (injected, set 2)`（第一個 SessionStart 回報前開工時可能是 `none (no-report)`，回合後重新宣告即 ok）；縮圖沒有 `CT↑` / `BAT↑` / `🪝✕`；待辦分頁標頭「契約 2」 |
| M-C2 | T0902 T-1 / T-2、T0904:131 | 塔台輸入框打半句不送 → 派一張小工單，Worker 完成時 `--submit`；另一次先把塔台往上捲再等 Worker 通知 | 半句不被送出，通知顯示 📨「你在輸入」，自己按 Enter 後通知才接著送；往上捲時通知最多等 60 s、畫面不被拉回底部 |
| M-C3 | T0902 T-4、T0905:132、T0909:158 | 跑幾種回合：純文字、多段文字、含工具呼叫、很長的回覆（> 16 KiB） | 每回合一張卡片，內容是最後一則助理訊息；`⏸ 待你決定：` / `🙋 待你執行：` 行加亮；> 16 KiB 顯示「內容過長，已截斷」；縮圖 `💬N` 只算未讀；debug log 的 `[tower-cards]` 只有長度、沒有內容 |
| M-C4 | T0908:174 | 讓 CT 產生一筆 `awaiting_user`（選項）、一筆 `user_actions`；從待辦分頁各回答一次（選項、自由回答、完成、失敗＋說明） | 塔台收到一行 `U-n：<代號>` / `U-n：<文字>` / `A-n：完成` / `A-n：失敗 <說明>`，CT 解析後從 `_tower-state.md` 移除該筆、寫決策日誌；待辦分頁該筆消失、「最近已結」列出 |
| M-C5 | T0902 T-10、T0905:133、T0910:172（含 (d1)） | BAT 開的 claude-cli 塔台同時裝 `bat-hooks` plugin 與 CT 的 hooks（CT guard）；跑一個含 Bash 長指令與權限對話框的回合 | 每回合只有一張卡片（plugin 的回報 `duplicate`）；`hooks: ok (injected, set 2)`（不出 `plugin-outdated`）；權限對話框期間 Worker 通知保留；CT guard 照常運作 |

**新 CT 6.1.0 ＋舊 BAT（降級）**

| # | 來源 | 步驟 | 預期 |
|---|---|---|---|
| M-C6 | T0902:538（R11；子代理整理時指出 W 單沒有列這項，建議補） | 安裝版 `0.8.0-pre.2` 的分頁跑 CT 6.1.0 開工 | 舊 helper 對 `--bat-contract` 回 `Unknown option '--bat-contract'` exit 1；CT 不帶 `--bat-contract` 重送成功、開工面板一行「BAT 不支援契約 2」類警告；BAT 沒有任何 PLAN-068 畫面（沒有待辦分頁），Worker 通知照舊行為 |

**T-8：舊 CT（6.0.x）＋新 BAT**

| # | 來源 | 步驟 | 預期 |
|---|---|---|---|
| M-C7 | T0902 T-8、T0903:195、T0904:131 | BAT 測試版的分頁跑 CT 6.0.x 開工；塔台輸入框打半句後讓 Worker 通知；開待辦分頁；接著升級 CT 到 6.1.0 重新開工 | 6.0.x：縮圖 `CT↑`、P-1 toast（每分頁一次）、待辦分頁只有選擇器與 P-1、標題 `!`；Worker 通知照舊直接送（會混入半句，與今天相同）；總覽的 `todo` 照舊列出。升級後重新開工：徽章消失、保護生效、待辦分頁可用 |

#### 三、遠端（WSL profile）

| # | 來源 | 步驟 | 預期 |
|---|---|---|---|
| M-R1 | T0902 T-7、T0904:131、T0908:175、T0906:192 | WSL profile 視窗：BAT 開 claude-cli 塔台、CT 6.1.0 開工、派一個 Worker；① 打半句等 Worker 通知 ② 往上捲等通知 ③ 從待辦分頁回答 ④ 縮圖「📨 待送」的立即送出 / 取消 ⑤ 讓通知保留超過 5 分鐘 ⑥ CT 改 `_tower-state.md` | ①② 同 M-C2；③ 塔台收到一行回答；④ 遠端視窗看得到清單與原因、操作生效；⑤ 出現一次系統通知；⑥ 待辦分頁自動更新（不需按 ↻） |
| M-R2 | T0902 T-12 | WSL 裡裝 `bat-hooks` plugin，在 BAT 的 WSL 分頁手打 `claude` 開塔台；再在沒有系統 `node` 的 WSL 發行版重做一次 | 有系統 node：`hooks: ok (plugin, set 2)`；沒有系統 node：claude 顯示一則非阻擋的 hook 錯誤、`hooks: none (not-launched-by-bat)`，其他功能不受影響（已知限制） |

### 互動紀錄
- yolo，未向使用者或塔台提問；沒有塔台補充段落（三個節點檢查皆無新段落）。

### 子代理與 Workflow 使用
| 種類 | 數量 | 用途 | 唯讀（怎麼保證） | tokens | 備註 |
|---|---|---|---|---|---|
| 子代理（Agent 工具） | 1 | 讀 T0902–T0911 回報區，彙整待實機項目與已知限制 | 是（Explore＋prompt 明確禁止寫入） | ~129k（工具回報） | 主 agent 抽查：T0902 T-1–T-12 行號、T0909 codex 說明文字（`src/locales/zh-TW.json`）；分組與步驟由主 agent 改寫 |

### Renew 歷程
無

### 遭遇問題
- 第一次執行 e2e：Worker 的 job runner 沒執行 job。原因是派工的 agent 命令後面會附上 prompt（`/ct-exec T0913`），新 fixture 把多出的參數當成前景命令啟動而失敗。改成前景命令必須寫在 `--` 之後（`helper-job-runner.mjs`），之後的執行全部通過。屬測試 fixture 問題，不是產品缺陷。
- headless 測試初版：`terminal:notify-hold-list` 的回傳是「每分頁一筆 `{ terminalId, items, reason }`」而不是項目陣列（依 `NotifyHoldController.list` 修正斷言）；塔台 shell 的輸入列殘留草稿會讓之後在該 PTY 執行的 driver 卡住，加了 Ctrl+C 清行。都是測試寫法問題。

### 隔離分支證據
- branch：`ct/T0913`
- base_sha：`17c84662b6e7721c3201cc2964aacc7a920db5eb`（分支實際的起點：`git merge-base HEAD v0.8.x`，塔台預先從 `v0.8.x` 建立 `ct/T0913`）。⚠️ 環境變數 `CT_WORKTREE_BASE` = `06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`main` 上較舊的 commit，不是本分支的祖先），與實際起點不符；推測是 BAT 建 worktree 時記的是主 checkout 當下的 HEAD，而分支是塔台另外從 `v0.8.x` 建的。合併時請以 `17c84662` 為準。
- validated_sha：`a00b1b4a4a93d7700551a272c42119519347a8cb`
- head_sha：`a00b1b4a4a93d7700551a272c42119519347a8cb`
- validated_sha ≠ head_sha 的說明：相同。`test:unit` / `test:legacy` / build / 兩個 typecheck / headless 測試都在 `a00b1b4a` 上執行；e2e 連續 2 次是在 commit 前的工作樹上執行，內容與 `a00b1b4a` 逐位元相同（commit 只是把這三個檔案加入，之後沒有再改）。
- `git -C "$CT_WORKTREE" status --porcelain`：空。

### 回報時間
- 2026-11-25T07:00:38+08:00
