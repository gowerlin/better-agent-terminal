---
schema_version: 1
schema_kind: workorder
id: T0865
title: "BUG-213：Windows PTY holder 不繼承 BAT 主行程從啟動者拿到的 handle（帶 pipe 啟動 BAT 時，保留的 holder 不再讓呼叫端等不到 `close`）＋重跑 W6"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-065
priority: P2
sizing: M
created_at: "2026-11-05T09:35:13+0800"
depends_on: [T0862]
related:
  - "BUG-213；D290；T0862 回報區〈遭遇問題〉1、〈後續建議〉2（run `41942234283`）；T0859（holder 啟動 `holderSpawnSpec` / `forkTerminalServer`）；D286；`docs/agent-guide/pty-holder.md`"
affects_files:
  - _ct-workorders/T0865-pty-holder-handle-inheritance.md
  - _ct-workorders/BUG-213-pty-holder-inherits-launcher-handles.md
  - electron/pty-holder.ts
  - electron/main.ts
  - electron/__tests__/
  - e2e/
  - docs/agent-guide/pty-holder.md
  - docs/agent-guide/terminal-server-recovery.md
  - CLAUDE.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改 Windows 上 holder 的啟動（與修正需要的最小接線）；macOS / Linux、沒有 holder 的 fork 路徑（`terminalServerForkOptions`）、協定 v1、安裝程式 `build/installer.nsh`、升級 quit（`installer-quit-request.ts`）、接回判斷（`upgrade-interruption.ts`）的行為一律不變。"
  - "🔴 停止條件：修正需要新增原生模組、改協定或安裝程式，或沒有可靠作法 → 不硬做，停下回報 PARTIAL，列出可行選項與代價（含「列為已知限制」）由塔台決定。"
  - "🔴 W6 重跑規則同 D289：可 push `origin main`（每次 push 前掃金鑰樣式與家目錄路徑、`.private/` 去識別化樣式，結果寫回報區；不 force-push）、觸發 `desktop-build.yml` ×2 與 `windows-upgrade-acceptance.yml`，各上限 5 次；不建 tag / Release、不跑 `pre-release.yml` / `release.yml`、不部署 Pages。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 不得在本機安裝任何安裝檔、不碰本機 BAT 安裝版與它的 Terminal Server；L185 不開真的 claude / codex。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
  - "公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）；權杖與環境變數值不寫（只寫名稱）。"
---

# T0865 — BUG-213：PTY holder 不繼承啟動者的 handle

## 元資料
- **工單編號**：T0865｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-05 09:35 (UTC+8)
- **規模**：M｜**決策**：D290｜**依賴**：T0862

## 背景
T0862 run `41942234283`：Playwright 啟動 BAT 時，BAT 主行程繼承了 Playwright 的 stdio pipe handle（可繼承），它以 `spawn` 啟動 holder 時 holder 再繼承下去；升級後 holder 保留，pipe 一直沒關，`ElectronApplication.close()` 等到 30 分鐘逾時。從檔案總管 / 開始功能表啟動沒有 pipe，不受影響；但從終端、啟動器、IDE、腳本帶 pipe 啟動 BAT 時，保留的 holder 會讓呼叫端等不到結束。使用者決定先修再發 `0.7.5-pre.1`（D290）。

## 任務
1. 查證：在 Windows 上重現「帶 pipe 啟動 BAT → holder 繼承 → 呼叫端等不到 `close`」（單元或 e2e 層級擇可行者；不在本機跑安裝檔）。確認哪些 handle 被繼承（只記類型與數量，不記內容）。
2. 修正：讓 holder 只拿到它需要的 stdio 與 `ipc`，不帶走 BAT 主行程從啟動者繼承來的 handle。作法由你查證後選（例如 BAT 主行程啟動時處理繼承來的標準 handle、或 holder 的啟動方式）；🔴 不得改變 holder 的 pid 關係、`ipc` 通道、env、cwd、`detached` / `windowsHide`、日誌內容，以及 T0859 / T0861 的接回行為。沒有可靠作法 → 依停止條件回報。
3. 測試：單元測試守住新規則；e2e 或 W6 spec 加一項「帶 pipe 啟動 BAT、升級後呼叫端能拿到 `close`」（可沿用 T0862 spec 的 spawn＋CDP 架構，加一個以 pipe 啟動的情境或檢查）。
4. 重跑 W6：`desktop-build.yml` 打 A、B 兩版（建自含修正的 `main`），跑 `windows-upgrade-acceptance.yml`，情境 1–9 全 PASS。
5. 文件：`docs/agent-guide/pty-holder.md`（已知限制 / 規則）、`terminal-server-recovery.md`「從 PTY holder 啟動」視需要補一句；`CLAUDE.md`「Windows PTY holder」節若新增必守規則補一行（≤ 100k 字元）。BUG-213 檔補修正 commit、狀態改 `FIXED`。

## 驗收條件
- [ ] 重現與修正後對照（被繼承 handle 的類型 / 數量、呼叫端拿到 `close`）
- [ ] W6 情境 1–9 全 PASS（附 run id），另加帶 pipe 啟動的檢查 PASS
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [ ] CLAUDE.md ≤ 100k 字元（回報實際字元數）
- [ ] commit 只含本單範圍；BUG-213 → `FIXED`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
