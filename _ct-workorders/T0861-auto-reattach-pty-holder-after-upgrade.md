---
schema_version: 1
schema_kind: workorder
id: T0861
title: "PLAN-065 W5：升級後自動接回 holder（有安裝程式紀錄就不跳 Recovery 提示、toast「已接回 N 個終端」、不相容時結束並說明、0 個 PTY 且版本不同時換新）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: M
created_at: "2026-11-04T18:28:20+0800"
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
- **工單編號**：T0861｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 18:28 (UTC+8)
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
