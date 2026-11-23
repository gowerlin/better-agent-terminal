---
schema_version: 1
schema_kind: workorder
id: T0887
title: "實作：Windows Terminal Server 改用整個程序共用一個 node-pty conout Worker（PLAN-066，T0886 做法 (a')），在 `v0.8.x` 分支"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-23T17:39:35+08:00"
started_at: ""
updated_at: "2026-11-23T17:39:35+08:00"
completed_at: ""
session_ids: []
depends_on: [T0886]
related:
  - "PLAN-066；D307 / D308；T0886（研究與原型，分支 `ct/T0886` 的 `experiments/node-pty-worker/`，尤其 `override/shared-conout.cjs`、`check.cjs`、`measure/`）；T0885（`bat-baseline/bat-baseline.spec.ts`，分支 `ct/T0885`）；PLAN-065（Windows PTY holder，`scripts/pty-holder.cjs`，W6）；T0540 / T0572 / T0578 / T0704 / T0857 / T0861 / T0866"
affects_files:
  - _ct-workorders/T0887-impl-shared-conout-worker.md
  - electron/terminal-server/shared-conout.ts
  - electron/terminal-server/shared-conout-worker.cjs
  - electron/terminal-server/server.ts
  - electron/__tests__/shared-conout*.test.ts
  - vite.config.ts
  - package.json
  - package-lock.json
  - scripts/pty-holder.cjs
  - scripts/verify-packaged-native.js
  - scripts/__tests__/**
  - CLAUDE.md
  - docs/agent-guide/pty-holder.md
  - docs/agent-guide/terminal-server-recovery.md
  - experiments/node-pty-worker/**
renew_count: 0
isolation: worktree
workdir: worktree ct/T0887（塔台已預先從 `v0.8.x` 建立分支 `ct/T0887`，base `06c3b884`）
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree（D307 / D308）：產品改動只進 worktree 分支 `ct/T0887`。塔台已從 `v0.8.x` 預先建立這個分支，BAT 在既有分支上建 worktree，所以 `CT_WORKTREE_BASE` 應為 `06c3b884…`（= `v0.8.x`）；開工時先確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`，不符就停下問塔台。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`（合進 `v0.8.x` 由塔台做）。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 依賴：BAT 不替 worktree 裝依賴，請在 worktree 內 `npm ci`（不得改 lock 以外的方式裝套件；`@lydell/node-pty` 改精確版號後 lock 要同步，lock 的變動只能是這一項）。不新增任何 npm 依賴、不改 `allowScripts`。"
  - "🔴 不碰本機 BAT 安裝版、使用者正在用的 BAT 與其 Terminal Server / PTY holder（`C:\\Program Files\\BetterAgentTerminal`、`%LOCALAPPDATA%\\BAT-PtyHolder`、`%ProgramFiles%\\BAT-PtyHolder` 只能列檔）。量測與 e2e 一律用 repo 建置＋隔離 userData（`launchIsolated` 等 fixture）。🔴 不觸發任何 GitHub workflow（含 W6 `windows-upgrade-acceptance.yml`、`desktop-build.yml`；由塔台在合併後取得授權再跑）；🔴 不在開發機跑 W6 spec。"
  - "🔴 程序清理（T0886〈遭遇問題〉1：舊量測腳本以 `ParentProcessId` 找子程序，PID 重用時誤殺了 8 個無關程序）：量測與清理一律用 `ct/T0886` 修正後的腳本規則（子程序建立時間必須晚於父程序；只結束探針啟動之後建立的程序、一次一個、不 `taskkill /T` 整棵樹）。不得以程序名稱或父 PID 大範圍結束程序；回報區寫明每次清理結束了哪些 PID（只記 PID 與映像名稱）。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。Git：主 checkout 只 commit 本工單檔；worktree 用 `git add <明確路徑>`（不用 `-A` / `.`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。日誌不記 PTY 內容、權杖、env。"
---

# T0887 — 實作：Windows Terminal Server 共用一個 conout Worker（PLAN-066）

## 元資料

- **工單編號**：T0887
- **任務名稱**：Windows Terminal Server 改用整個程序共用一個 node-pty conout Worker
- **狀態**：PENDING
- **類型**：implementation
- **互動模式**：enabled（yolo：問塔台）
- **intervention_type**：context-dependent
- **Renew 次數**：0
- **建立時間**：2026-11-23 17:39 (UTC+8)

## 背景

T0886 實測：`@lydell/node-pty` 1.1.0 在 Windows 每個 PTY 開一個 conout `worker_threads.Worker`（約 14 MB／個），Terminal Server 持有 10 個 PTY 約 170 MB。改成「整個程序共用一個 Worker」後降到 39 MB（node.exe）／37 MB（electron 當 node），輸出、kill、自然結束、resize、殘留程序與吞吐都和現況相同；防死結設計（ConPTY 關閉時由 Worker 排空輸出管線）不變。使用者 D307 決定「能省就做 Node 端修正」，塔台 D308 採用 T0886 推薦的做法 (a')：**Terminal Server 載入 node-pty 後、第一次 spawn 前，替換模組匯出的 `ConoutConnection`**，不 patch `node_modules`、不 fork。

原型：分支 `ct/T0886` 的 `experiments/node-pty-worker/override/shared-conout.cjs`（可 `git show ct/T0886:<路徑>` 讀或複製）。T0886 回報區〈建議下一步〉第 1 項是本單的設計依據，先讀。

## 範圍

1. **新增**
   - `electron/terminal-server/shared-conout.ts`：`installSharedConout(nodePty 模組或目錄)` → `'installed' | 'skipped:<原因>'`。只在 win32 執行；版本必須是 `1.1.0`、`ConoutConnection` 匯出與類別形狀符合原型的檢查，否則**不替換、照舊運作**（記原因）。不 import electron、不在 import 期做事。
   - Worker 腳本（例：`electron/terminal-server/shared-conout-worker.cjs`）：一個 Worker 處理所有 PTY 的 conout 轉送；第一個 PTY 建立時啟動、最後一個 PTY 關閉後結束；每個轉送的錯誤只影響自己那個 PTY；`getWorkerPipeName` 直接寫成 `name + '-worker'`，不依賴套件內部路徑。Worker `error` / 非預期 `exit` 記一行日誌（不含 PTY 內容）。是否自動重建 Worker：本單先**不做自動重建**，只記錄並讓受影響 PTY 照現況的錯誤路徑結束（理由與替代做法寫進回報）。
2. **接線**
   - `electron/terminal-server/server.ts`：載入 node-pty 後、第一次 spawn 前呼叫一次安裝函式；結果記一行既有格式的日誌（例 `[shared-conout] installed` / `skipped:<原因>`）。🔴 只在 Terminal Server 安裝；direct 模式（`electron/pty-manager.ts`，Electron 主行程）**本單不套用**（D308 Q-B）。
   - 建置：Worker 腳本要進 `dist-electron/` 並被 `build.asarUnpack` 涵蓋（Terminal Server 從 asar 外執行）；依 `vite.config.ts` 現有 terminal-server 的建置方式決定最小改法。
   - `package.json`：`"@lydell/node-pty": "^1.1.0"` → 精確 `"1.1.0"`；lock 同步。
   - `scripts/pty-holder.cjs`：`holderSourceFiles` 與 holder manifest 加入 Worker 腳本（holder 從安裝目錄外執行，少了這個檔 holder 版就不會套用或出錯）；`scripts/verify-packaged-native.js` 若有 holder / asarUnpack 的檢查，同步加入。
3. **文件**：CLAUDE.md 依「CLAUDE.md 撰寫規則」在「Windows PTY holder」或「Terminal Server 存活判定與 recovery」節加 2–4 行（用途、唯一實作、版本守門、升 node-pty 時必跑的測試），細節寫進 `docs/agent-guide/pty-holder.md` 或 `terminal-server-recovery.md`（含 T0886 的量測數字與死結背景連結）。

## 不變式（不得改變）

- T0540：`endPty` 先 `killProcessTree` 再 `pty.kill()`；`shutdown()` 順序。
- ConPTY 關閉時仍由 Worker 排空輸出（不得改成主執行緒讀 conout；T0886 的做法 (c) 不在本單範圍）。
- T0572 初始尺寸、T0578 Recovery hold、T0704 heartbeat / recovery、T0857 協定 v1、T0861 接回、T0866 stdio guard、T0806 / T0807（只 Linux）都不變。
- macOS / Linux：完全不載入、不執行新程式碼（`installSharedConout` 在非 win32 直接回 `skipped:not-win32`，且不 require Worker 腳本）。
- 版本或形狀不符 → 行為與現況逐字相同。

## 驗收

1. `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功、`npm run test:unit` 全過（與 base 相比不得新增失敗）。
2. 新單元測試（vitest，Windows 才跑真 PTY 的部分以 `it.skipIf` 控制）：安裝結果 `installed`；3 個 PTY 輸出完整且依序；整個程序只有 1 個 conout Worker；大量輸出中 kill 不 hang、exit code 正確；最後一個 PTY 關閉後 Worker 結束、事件迴圈能自己結束；版本不是 `1.1.0` 或形狀不符 → `skipped`、不替換；非 win32 → `skipped:not-win32`。source guard：只有 `server.ts` 呼叫安裝函式。
3. 既有 e2e（Windows，需先 `npx vite build`）：T0540、T0572、T0578、T0704、T0861 相關 spec 全過；列出實際跑的 spec 與結果。
4. **記憶體**：沿用 `ct/T0885` 的 `experiments/rust-eval/bat-baseline/bat-baseline.spec.ts`（複製到 `experiments/node-pty-worker/` 或同層，不改原分支），以本分支建置量 BAT 1 / 5 / 10 分頁的 Terminal Server Private Bytes，每個 3 次取中位數，並與 base（`v0.8.x`，可用同一 worktree 先量再改，或另一份建置）對照。目標：10 分頁 Terminal Server **< 45 MB**。量測與清理遵守 memory_overrides 的程序清理規則。
5. holder：`scripts/pty-holder.cjs` 相關既有單元測試全過；回報寫明 holder 內容改變、合併後需跑 W6（`windows-upgrade-acceptance.yml`，由塔台觸發）。
6. 回報區列〈相關通過案例〉：本單改動對既有驗收案例（T0540 / T0572 / T0578 / T0704 / T0861 / W6 情境）的影響判定。

## 不做

- direct 模式套用、主執行緒讀 conout（(c)）、`resourceLimits`、Rust Terminal Server、升 node-pty、自動重建 Worker。
- 合併到 `v0.8.x`、push、觸發 workflow、發版。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 實作摘要

### 驗收結果

### 相關通過案例

### 遭遇問題

### Renew 歷程

### 方法論狀態回寫

### 回報時間
