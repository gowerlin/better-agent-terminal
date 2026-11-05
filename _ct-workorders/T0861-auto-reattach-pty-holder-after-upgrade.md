---
schema_version: 1
schema_kind: workorder
id: T0861
title: "PLAN-065 W5：升級後自動接回 holder（有安裝程式紀錄就不跳 Recovery 提示、toast「已接回 N 個終端」、不相容時結束並說明、0 個 PTY 且版本不同時換新）"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: M
created_at: "2026-11-04T18:28:20+0800"
started_at: "2026-11-05T07:43:54+0800"
updated_at: "2026-11-05T08:08:53+0800"
completed_at: "2026-11-05T08:08:53+0800"
session_ids:
  - "00e2a99b-6a40-4ef6-9b4e-0bd26bef55de"
depends_on: [T0857, T0860]
related:
  - "PLAN-065；D286（D4 自動接回、D5 不相容時結束並說明、D6 單一 holder＋0 個 PTY 時換新）；T0856 回報區〈調查結論〉Q3 / Q4 與〈建議下一步〉W5；T0578（Recovery 提示）；T0821 / T0846 / T0847（升級說明 toast 與對話框）；T0766 / T0767（被中斷的 agent 分頁）"
affects_files:
  - _ct-workorders/T0861-auto-reattach-pty-holder-after-upgrade.md
  - electron/main.ts
  - electron/upgrade-interruption.ts
  - electron/pty-manager.ts
  - src/components/ServerStatusToast.tsx
  - src/components/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - src/components/__tests__/
  - e2e/
  - docs/agent-guide/upgrade-interruption.md
  - docs/agent-guide/recovery-create-hold.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只有「有 schema 2 安裝程式紀錄、`holderKept`、紀錄的 holder pid 與 pid 檔一致、hello 協商成功」全部成立才自動接回、不跳 Recovery 提示（D4）；其他情況（使用者自己關窗保留、per-machine UAC 強制結束、沒有紀錄）Recovery 提示照舊（T0578）。🔴 `holdCreates` / `releaseCreatesOnReplayList`（BUG-146）與 helper 的 `RECOVERY_PENDING`（T0580）規則不變：接回完成前不得 spawn direct shell。"
  - "🔴 不相容（D5）：結束舊 holder（含 PTY 樹，T0540 順序）並以 PLAN-063 的說明顯示「升級結束了 N 個終端」（新的觸發來源，N = 舊 holder 的 PTY 數），agent 分頁沿用一鍵接回；不自動 resume、不通知塔台。"
  - "🔴 換新（D6）：holder 存活但 0 個 PTY 且版本 ≠ 目前版本 → 正常 shutdown 後 fork 新版；有 PTY 時新分頁仍由舊 holder 建立。macOS / Linux 的既有接回行為不變（它們沒有安裝程式紀錄，照舊走 Recovery 提示）。"
  - "🔴 UI：toast 沿用 `ServerStatusToast`；Dialog 規則照 CLAUDE.md（`ModalOverlay`、[X]、`onEscape`）；新字串三語（en / zh-TW / zh-CN）都要有。日誌只記數量與結果。yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。不碰本機 BAT 安裝版與它的 Terminal Server；e2e 用隔離 runtime。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0861 — PLAN-065 W5：升級後自動接回 holder

## 元資料
- **工單編號**：T0861｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 18:28 (UTC+8)
- **規模**：M｜**決策**：D286｜**依賴**：T0857（hello）、T0860（schema 2 紀錄）

## 背景
T0860 讓升級時 holder 留下並寫紀錄；本單讓新版 BAT 啟動時依紀錄直接接回（不跳 Recovery 提示），並處理協定不相容與 0 個 PTY 的情況。細節見 T0856 回報區 Q3 / Q4。

## 任務
1. `startTerminalServer`：判斷自動接回的條件 → 走與 `terminal-server:recover`「保留」相同的程式碼路徑；toast「已接回 N 個終端（BAT v…）」。
2. 不相容 → 走「重新開始」的路徑並顯示 PLAN-063 說明（`detectUpgradeInterruption` 加來源）。
3. 0 個 PTY 且版本不同 → 換新（取代今天的靜默重新連線）。
4. 被 T0860 結束的內嵌 claude 列進「被中斷的 agent 分頁」，同版重裝的中性文字（T0846 / T0847）照舊。
5. 測試：條件表逐列、自動接回不呼叫 Recovery 提示、不相容 → 說明、換新、create hold 在接回完成前不放行；renderer toast 與字串。
6. e2e（隔離 runtime）：保留 holder → 寫 schema 2 紀錄 → 重開：沒有 Recovery 提示、同一個 pid 的 shell、輸出持續；做不到的列〈待 W6 驗收〉。
7. 文件：`docs/agent-guide/upgrade-interruption.md`、`docs/agent-guide/recovery-create-hold.md` 補自動接回與換新規則。

### 驗收條件
- [ ] 上述測試通過；T0578 / T0580 / T0704 / T0821 / T0846 / T0847 相關測試不回歸
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [ ] commit 只含本單範圍

## 塔台補充（開工前，2026-11-05 07:36，取自 T0860 回報區〈後續建議〉）

1. T0860（`44982662`）已就緒的介面：schema 2 紀錄（`InstallerQuitHolderRecord`，`holderKept` / `holderPid`）、`readInstallerQuitRecord` / `takeInstallerQuitRecord` 讀 schema 1 與 2、`detectUpgradeInterruption` 的 notice 有 `holderKept: true` / `ptyCount` / `installerQuitAgentTabCount`、log 結尾 ` holder-kept ended-agent-tabs=N`；`terminalServerFromHolder`（`electron/main.ts`）。直接沿用，不另做一套。
2. 自動接回的判斷：紀錄 `holderKept` 且 `holderPid` 與 pid 檔一致、hello 協商成功（memory_overrides 第 1 點）。T0860 的 notice 已有數量，「已接回 N 個終端」的 toast 文字由本單加。
3. 🔴 被 T0860 結束的內嵌 agent 分頁：接回後那些分頁的 shell 是同一個（被保留的）PTY。確認 T0766 / T0767 的恢復路徑（`startClaudeCliPty` 先 kill、`resumeCodexCliTab`）與保留的 PTY 不衝突：恢復時不得把被接回的 shell 當成已結束而重建出第二個 shell，也不得殺掉使用者還在用的 shell 以外的東西；寫明實際行為並加測試。
4. e2e：`e2e/t0860-installer-quit-holder.spec.ts` 可當基礎（打包版＋暫存 `LOCALAPPDATA` 的 holder）。本單改到偵測規則，`e2e/t0821-upgrade-interruption.spec.ts` 與 `e2e/t0823-installer-graceful-quit.spec.ts` 列為必跑（T0860 發現 t0823 的 control 情境自 T0846 起過時，已由 T0860 修正）。
5. `electron/main.ts` 與 T0864 無重疊（T0864 不改 `main.ts`）；但 T0864 會改 `e2e/t0821-*` / `t0823-*`（只加設定標記）。本單排在 T0864 之後，開工前先 `git log -3 -- e2e/` 確認在它之後。
6. T0864（`7a07cfca`，D288）之後，e2e 要關掉更新檢查必須同時寫 `checkForUpdates: false` 與 `checkForUpdatesMigrated: true`（只寫 `false` 會被當成開，重開 app 時會連 GitHub）。本單新增或修改的 e2e 若會重開同一個 runtime，照這個寫法。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策

#### Q-1：「已接回 N 個終端」toast 需要改 `src/App.tsx` 與 `src/stores/interrupted-agents-store.ts`（不在 affects_files），可以改嗎？
- 提問時間：2026-11-05T07:52:52+0800
- 選項：[A] 可以，把這兩個檔加進本單範圍 / [B] 不行，改成別的做法 / [C] 其他：________
- Worker 建議：[A]。renderer 的通知解析 `parseUpgradeInterruptionNotice`（store）今天只收 `ptyCount ≥ 1`，接回的通知 `ptyCount` 是 0（沒有結束任何終端）會被丟掉；`App.tsx` 傳給 toast 的 `count` 寫死 `ptyCount`。兩處都只是接線（store 多收 `reattachedPtyCount`、App 改用 `ServerStatusToast.tsx` 新的 `upgradeNoticeToastValues`），沒有別的做法能不碰它們。
- 影響範圍：`src/App.tsx`（2 行）、`src/stores/interrupted-agents-store.ts`（通知型別與解析）；任務 1 / 5 的 renderer toast。
- 阻塞：否（主行程、測試、文件先做；commit 前需要答覆）

#### Q-2：CLAUDE.md「Recovery 提示期間的 `pty:create`」與「升級結束終端的提示與說明」兩節要不要在本單一併補自動接回 / 換新的必守規則？
- 提問時間：2026-11-05T07:52:52+0800
- 選項：[A] 要，本單一併改 CLAUDE.md 這兩節（各加 1–2 行，細節在 docs） / [B] 不要，留給 W6（T0856 規劃 W6 改 CLAUDE.md） / [C] 其他：________
- Worker 建議：[A]。CLAUDE.md 撰寫規則要求「改功能時兩邊一起更新」，而且這兩節現在寫「W5 改成直接接回」之類的未來式，不改會與程式不符。
- 影響範圍：`CLAUDE.md`（不在 affects_files）
- 阻塞：否
- **通道**：BAT（兩題 `--ask` 成功，`bat_wait_question` 皆 `answered`；答覆內容記在〈互動紀錄〉）

### 完成狀態

- **狀態**：DONE
- **session_id**：00e2a99b-6a40-4ef6-9b4e-0bd26bef55de
- **產品 commit**：`9e8b26f0`（`feat(terminal-server): reattach the PTY holder the installer kept, …`；16 檔，+1116 / −79）
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal` / `basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3 PASS（`electron/main.ts` 等存在）；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。不是 worktree（`CT_HOME` 未設定），`main` 分支。

### 範圍追加（塔台核准 Q-1 / Q-2）

- `src/App.tsx`、`src/stores/interrupted-agents-store.ts`：只做接線（Q-1）。
- `CLAUDE.md`：「Recovery 提示期間的 `pty:create`」與「升級結束終端的提示與說明」各加 1 行（Q-2）；`##` 標題未改；實際字元數 **82,204**（`wc -m`，改前 81,230）。「從 PTY holder 啟動」那一行未動（留給 T0862）。

### 實作摘要

1. **自動接回（D4）** — `decideHolderReattach`（`electron/upgrade-interruption.ts`，純函式）：schema 2 紀錄（`holderKept`）、紀錄 holder pid = pid 檔 = hello 的 pid、hello 協商成功、≥ 1 個 PTY 全部成立才自動接回。`startTerminalServer`（`electron/main.ts`）在設 `pendingRecovery` 之前判斷；成立 → `holdCreates('PTY holder reattach')` → `reconnectKeptTerminalServer`（從 `terminal-server:recover` 抽出的「保留」共用函式：connect → `pty:list` → `releaseCreatesOnReplayList()`）→ `noteHolderReattached`。連不上 → 同「保留」失敗：清檔 → `startTerminalServer()` → `finally releaseCreates(...)`。不成立 → 原 Recovery 提示（有紀錄時記一行 reason）。`holdCreates` / `releaseCreatesOnReplayList` / `RECOVERY_PENDING` 未改。
   - 🔸 找到並修正的連帶問題：`did-finish-load` 在 `pendingRecovery` 為 null 時會 re-probe（View→Reload 用），自動接回後第一次載入會因此又跳 Recovery 提示。新增 `terminalServerReattachedAtStartup`，只跳過接回後第一個視窗的**第一次**載入；之後的 reload 照舊。
2. **不相容（D5）** — probe / 接回的 hello 失敗 → `endUnusableTerminalServer`：先讀 registry（shutdown 會刪）→ `endTerminalServer`（`server:shutdown` 等 5 s；Windows 仍在跑 → T0860 的 `forceStopTerminalServer`：PTY 樹先、再 server）→ 結束了才 `noteIncompatibleServer(registry.ptys, claude sessions)`。`detectUpgradeInterruption` 多 `incompatibleServerPtyCount`：版本不同**或**有 holder 紀錄時觸發，日誌 `source=…incompatible`，agent 分頁照 T0821 列進清單。macOS / Linux shutdown 逾時時照 T0857 原行為（不強制）。
3. **換新（D6）** — `shouldReplaceIdleServer`：probe **收到** `pty:list` 且 0 個 PTY、hello `batVersion` 合法且 ≠ 目前版本 → `endTerminalServer(…, 'replaced')` → 既有清檔＋ fork。probe 新增 `listed`，避免「3 s 沒回清單 = 0 個」時誤關有 PTY 的 server。版本未知 / 相同 → 照舊靜默重連。**決定：不限平台**（0 個 PTY 時換掉不影響任何使用者可見的狀態；有 PTY 時 macOS / Linux 照舊走 Recovery 提示）。
4. **說明與 agent 分頁** — notice 多 `reattachedPtyCount`（`previousVersion` 讀不到時用紀錄的 `version`）；renderer `parseUpgradeInterruptionNotice` 收 `ptyCount ≥ 1` **或** `reattachedPtyCount ≥ 1`，既有通知不變。toast key `app.upgradeReattached` / `app.upgradeReattachedSameVersion`（同版用 T0846 的中性說法），值 `upgradeNoticeToastValues`；三語。T0860 結束的內嵌 agent 照 T0860 列進清單，toast 照舊多「N 個 agent 分頁已中斷」一行。
5. **塔台補充第 3 點（恢復與保留的 PTY 不衝突）**，實際行為：還原分頁 `pty:create` 回 `created: false`、不重送啟動指令（T0403）；按「恢復」— claude-cli `pty.kill` → `startClaudeCliPty(--resume)`、codex-cli `restartOrCreatePty`（⏻）→ `codex resume`：Terminal Server 模式下 `kill` 送 `pty:kill` 並立即移除本機 id，server `killPty` 同步刪除項目並以 T0540 順序結束**該分頁**的 shell 樹，接著的 `pty:create` 在 holder 上建**一個**新 shell。⇒ 不會另起第二個 shell；結束的只有被恢復分頁自己的 shell 樹（與 ⏻ 相同）。helper 派工的 Worker 走 main `terminal:resume-interrupted-agent`：寫進同一個 shell，不 kill。測試 `holder-reattach.test.ts`「resuming an agent tab on a kept shell」：一個 `pty:kill` 再一個 `pty:create`，其他分頁不受影響。

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npm run test:unit` | 全過：452 files passed / 3 skipped；8285 tests passed / 40 skipped（08:02 那一輪；前一輪有 2 個失敗，是我在測試進行中改了 main.ts 與測試字串造成的，單獨重跑與整輪重跑皆過） |
| `npm run test:legacy` | 33 files / 472 tests passed, 0 failed |
| `npx vite build` | 成功（另 `npm run build:dir` 成功） |
| 新單元：`electron/__tests__/holder-reattach.test.ts` | 條件表逐列（8 列＋malformed pid）、`shouldReplaceIdleServer` 逐列、notice（接回 / 接回＋被結束 agent / 同版 / 版本檔缺少 / finish 後忽略）、D5（版本不同、同版＋紀錄、同版無紀錄）、hold 在清單前不放行、恢復 = 一 kill 一 create、main.ts source guard（決策在提示前、hold→共用保留→記下→return、失敗 finally 放行、D5 先讀 registry、D6 分支、第一次載入不 re-probe） |
| 新單元：`src/components/__tests__/upgrade-reattached-toast.test.tsx` | 三語、parse、key / 值、toast 逐字（三語）、agent 列 |
| 回歸：T0578 / T0580 / T0704 / T0821 / T0846 / T0847 / T0860 相關單元 | 全過（含在 test:unit）。改了兩個 source guard（意圖不變）：`recovery-create-hold.test.ts` 的 recover 檢查改查共用函式的順序；`upgrade-interruption.test.tsx` 的 App 值改查 `upgradeNoticeToastValues`。`helper-capability-persist.test.ts` 的 T0576 guard 以字串比對第一個 `  await startTerminalServer()\n`，新遞迴呼叫加行尾註解避開（未改該測試） |
| e2e（打包版 `build:dir`）`e2e/t0861-holder-reattach.spec.ts` | **1 passed**（10.5 s）：升級請求 → 重開：無 Recovery 提示（DOM 無、`queryPendingRecovery` null）、`upgradeReattachedSameVersion` toast、同 holder pid / 同 shell pid、輸入到達同一 shell 且輸出回來、只有一個 shell；對照：紀錄 pid 改錯 → 跳提示（`pid-file-mismatch`）、保留後同一 shell |
| e2e（打包版）`t0860-installer-quit-holder` + `t0823-installer-graceful-quit` | 4 passed |
| e2e（原始碼版）`t0821-upgrade-interruption` + `t0823-installer-graceful-quit` + `t0578-recovery-no-direct-shell` | 7 passed |

e2e 會重開同一 runtime：設定照塔台補充第 6 點寫 `checkForUpdates: false` + `checkForUpdatesMigrated: true`。`git log -3 -- e2e/` 開工前確認在 T0864（`7a07cfca`）之後。

### 待 W6 驗收

- 真實 N → N+1 升級（版本不同）的自動接回與 `app.upgradeReattached` 文字（本單 e2e 用同一個 build，只驗到同版文字）。
- D5 不相容的實機（降級到協定不同的版本、權杖不符）：只有單元與 source guard。
- D6 0 個 PTY 舊版 holder 換新：只有單元與 source guard。
- per-machine 範圍（UAC 強制結束 → 無紀錄 → Recovery 提示）。

### 遭遇問題

- Q-2 題目寫「這兩節（CLAUDE.md）現在寫『W5 改成直接接回』之類的未來式」，實際未來式在 `docs/agent-guide/upgrade-interruption.md`（已一併改為現況），CLAUDE.md 兩節只是缺規則。題目已送出，未改題目。
- Git Bash 的 heredoc 送 Python 腳本失敗（引號解析），改用 Edit 工具。
- `docs/agent-guide/terminal-server-recovery.md`（不在範圍）引用 `unusable server still running after 5000 ms — starting the new one anyway`：保留這行字面不變（`shutdownTerminalServerAndWait` 的 `what` 預設 `unusable`），未改該 docs。

### 互動紀錄

- [07:52] Q-1: App.tsx / interrupted-agents-store.ts 不在 affects_files → A（塔台，BAT 通道）: 可以，只做接線，`ptyCount ≥ 1` 既有通知不得改變，回報列為範圍追加 → Action: 加入範圍、只改通知型別 / 解析與 toast 值
- [07:52] Q-2: CLAUDE.md 兩節要不要一併改 → A（塔台，BAT 通道）: 要，各 1–2 行＋連 docs，標題不改、回報字元數、holder 啟動那行留給 T0862 → Action: 兩節各加 1 行，82,204 字元

### 後續建議

- W6：在真實升級驗收裡加入本單〈待 W6 驗收〉四項；版本不同的接回文字可用兩個 exp build 驗。
- `docs/agent-guide/terminal-server-recovery.md` 可補一句 Windows 上 D5 會強制結束仍在跑的不可用 server（`unusable server ended with its PTY trees (taskkill): …`）；本單未改（不在範圍）。
