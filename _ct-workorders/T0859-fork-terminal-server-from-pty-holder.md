---
schema_version: 1
schema_kind: workorder
id: T0859
title: "PLAN-065 W3：Windows 打包版從安裝目錄外的 PTY holder 啟動 Terminal Server（`electron/pty-holder.ts`、`forkTerminalServer`）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: M
created_at: "2026-11-04T18:28:20+0800"
depends_on: [T0857, T0858]
related:
  - "PLAN-065；D286；T0856 回報區〈調查結論〉Q2 / Q3「其他細節」與〈建議下一步〉W3；T0857（hello 回報 runtime / holderDir）；T0858（holder 目錄配置、manifest）；T0816（`forkTerminalServer` 是唯一 fork 點，Linux 的 crashpad / keepalive 規則）"
affects_files:
  - _ct-workorders/T0859-fork-terminal-server-from-pty-holder.md
  - electron/pty-holder.ts
  - electron/main.ts
  - electron/pty-manager.ts
  - electron/__tests__/pty-holder.test.ts
  - electron/__tests__/
  - e2e/
  - docs/agent-guide/terminal-server-recovery.md
  - scripts/pty-holder.cjs
  - scripts/__tests__/pty-holder.test.mjs
  - scripts/__tests__/verify-packaged-native.test.mjs
  - scripts/verify-packaged-native.js
  - docs/agent-guide/packaging-release-checks.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只有 win32 打包版且 holder 有效（目錄存在、manifest 雜湊相符、路徑不以安裝目錄開頭）才改從 holder 啟動；其他情況（macOS / Linux、開發模式、zip 版、holder 缺少或不符）`forkTerminalServer` 的參數與行為逐字不變。🔴 `forkTerminalServer` 仍是唯一 fork 點（首次與 T0704 re-fork 共用）；Linux 的 `runWithoutCrashpadClient` / `planTerminalServerFork`（T0816）不動。"
  - "🔴 從 holder fork：`execPath` = holder exe、`cwd` = holder 目錄（不得繼承主行程 cwd，否則安裝目錄刪不掉）、不設 `ELECTRON_RUN_AS_NODE`、node-pty 從 holder 目錄載入（不得從安裝目錄載入 `conpty.node`）。PTY env 照舊經 `buildServerPtyEnv` / `buildPtyEnv`。"
  - "🔴 不改 quit / 安裝程式（W4 T0860）與升級後的接回、UI（W5 T0861）。日誌 `[pty-holder]` 只記 holder key 與結果，不記完整路徑以外的環境內容、不記權杖。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。不碰本機 BAT 安裝版與它的 Terminal Server；e2e 用隔離 runtime。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0859 — PLAN-065 W3：從 PTY holder 啟動 Terminal Server

## 元資料
- **工單編號**：T0859｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 18:28 (UTC+8)
- **規模**：S～M｜**決策**：D286｜**依賴**：T0857（`main.ts` 會衝突；hello 回報 runtime）、T0858（holder 目錄配置）

## 背景
T0858 把 holder 放到安裝目錄外；本單讓 Windows 打包版的 Terminal Server 從那裡啟動，NSIS 的程序比對（路徑前綴、映像名稱）就不會比到它。細節見 T0856 回報區 Q3「其他細節」與〈建議下一步〉W3。

## 任務
1. 新模組 `electron/pty-holder.ts`（純函式、不 import electron）：holder 根目錄（依安裝範圍，與 T0858 的規則一致）、key、安裝目錄前綴檢查、manifest 驗證、fork 參數組裝。
2. `forkTerminalServer`：win32 打包版且 holder 有效 → 以 holder fork；否則照舊。驗證失敗記一行 `[pty-holder]` 並照舊啟動。
3. hello-ok 的 `runtime` / `holderDir` 帶出 holder 資訊（T0857 的欄位），主行程記一行。
4. 測試：路徑與 key 計算、前綴檢查（含「安裝目錄名稱加字尾」的陷阱）、manifest 不符 → 退回、fork 參數（execPath / cwd / env 沒有 `ELECTRON_RUN_AS_NODE`）、非 win32 與開發模式的參數與 T0859 前完全相同（快照或逐欄斷言）。
5. e2e（隔離 runtime、Windows）：以 T0858 打包出來的 holder（或測試用 holder 目錄）啟動 BAT，確認 Terminal Server 的 `ExecutablePath` 在 holder 根目錄、可建分頁並執行命令；做不到就寫明原因並列〈待 W6 驗收〉。
6. 文件：`docs/agent-guide/terminal-server-recovery.md` 補「從 holder 啟動」的條件與退回規則。

## 塔台補充（開工前，T0858 收單後 2026-11-04 18:53）

T0858 已 DONE（`aa59902e`）。先讀 T0858 回報區與 `docs/agent-guide/packaging-release-checks.md`「Windows PTY holder 打包」，再開始。要點與塔台裁決：

1. **holder 規則以 T0858 為準**：根目錄 `BAT-PtyHolder`（per-user `%LOCALAPPDATA%`、per-machine `%ProgramFiles%`）、key = `<Node 版本>-<12 hex>`、manifest 格式、前綴衝突規則 `holderRootConflictsWithInstallDir`（任一方是另一方的字串前綴、不分大小寫 → 不用 holder）。`electron/pty-holder.ts` 與 `scripts/pty-holder.cjs` 的規則必須一致：移植常數或抽共用模組擇一，並加一個測試確保兩邊不會走樣。
2. **驗證要重算雜湊**：安裝程式只比對 manifest、不重算檔案雜湊，所以 BAT 決定用 holder 前要以 `ptyHolderProblems` 等效的檢查逐檔驗大小與 SHA-256，並確認 holder 目錄的 key 與安裝目錄內 `resources\pty-holder\holder-manifest.json` 的 key 相同（安裝目錄那份是預期值的來源）。驗證耗時記一行 debug log。
3. **磁碟（塔台裁決）**：安裝目錄內的 `resources\pty-holder\` **保留**（它是預期 key 與 manifest 的來源，per-user 模式下 holder 目錄是使用者可寫的）；docs 寫明約多 90 MiB 的原因。
4. **Node 授權（塔台裁決）**：holder 目錄要附 Node 的 `LICENSE`。在 `scripts/pty-holder.cjs` 以固定版本 tag 下載 Node repo 的 `LICENSE`（與 `node.exe` 同一個版本 tag），SHA-256 與大小固定寫在 repo、不符就建置失敗；列進 manifest；`verify-packaged-native.js` 的 `pty-holder` 檢查要求它存在。
5. 任務 5 的 `AttachConsole failed` stderr 是既有行為（today 的 runtime 也一樣，T0858 對照），不在本單處理。

### 驗收條件
- [ ] 上述測試通過；T0704 / T0816 / T0540 相關測試不回歸
- [ ] 補充 1–4 完成（`pty-holder.test.mjs` / `verify-packaged-native.test.mjs` 涵蓋 LICENSE 與兩邊規則一致）
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
