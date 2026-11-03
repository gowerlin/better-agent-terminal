---
schema_version: 1
schema_kind: workorder
id: T0804
title: "查證：AppImage 版 BAT 以 Playwright `app.close()` 關閉時不返回、Terminal Server 留著（T0803 觀察）——產品缺陷或測試方式問題"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
created_at: "2026-11-03T16:04:11+0800"
started_at: ""
updated_at: "2026-11-03T16:04:11+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "T0803 回報區〈遭遇問題〉第 4 點；D250；T0797（`e2e/linux/`，已有清理殘留 Terminal Server 的程式）；T0144（`before-quit` 關閉確認）；T0540 / PLAN-042（quit Step A、`stopTerminalServerGracefully`）；T0704（Terminal Server recovery）"
affects_files:
  - _ct-workorders/T0804-appimage-app-close-hang-investigation.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 研究型：只查證、不修。不改產品程式、測試、e2e spec、文件、workflow；repo 內唯一可改的是本工單（回報區）。實驗腳本、下載的 AppImage、記錄放 WSL 或系統暫存目錄，收尾刪除。結論若是產品缺陷，在回報寫修正方向與工單草案，由塔台開 BUG / 修正單。"
  - "🔴 不碰使用者既有資料：WSL 的 `~/.config/BetterAgentTerminal`、`~/bat-build`、`~/.codex` 不改不刪；BAT 一律用隔離 userData（`--runtime=<名稱>` 或 e2e 既有方式）。本機 Windows 正在使用的 BAT（安裝版）不得關閉、不得結束它的 Terminal Server；Windows 端若要對照，只能用隔離實例，且只結束自己啟動的程序（以 pid / 命令列確認）。"
  - "🔴 T0803 教訓：不開 codex / claude 分頁，只用 shell 分頁；不在任何 agent TUI 送按鍵；不登入任何服務。關閉確認對話框若出現，只能用 BAT 自己的按鈕或 IPC 回答，不得 `window.confirm` / 系統對話框以外的手段繞過。"
  - "🔴 判讀要有證據：每個結論附命令、程序樹（`ps -o pid,ppid,pgid,cmd`）、debug log 的 `[quit]` 等相關行（不貼權杖、不貼家目錄真實路徑，D176 用 `<使用者資料夾>` / `<使用者>`）。實測不到的部分標「推論」。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push。Git：只 commit 本工單（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0804 — 查證：AppImage 版 `app.close()` 不返回

## 元資料

- **工單編號**：T0804
- **類型**：research（查證，不修）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T16:04:11+0800
- **預估規模**：M

## 背景

T0803（BUG-159 驗收）在 WSL Ubuntu 24.04 以 Playwright `_electron.launch` 跑 `v0.7.4-pre.3` AppImage，兩輪都遇到：`app.close()` 不返回；主行程結束後 Terminal Server（`terminal-server.js`）仍在，AppImage runtime 不卸載；要另外 SIGTERM 主行程 → terminal-server → crashpad。T0803 沒有查原因。

可能的方向（未查證，僅供起點）：
- BAT 的 `before-quit` 會顯示關閉確認（T0144），`app.close()` 觸發的 quit 可能停在確認對話框（`e2e/linux/linux-os.ts` 註解提到 BAT 對 SIGTERM 以關閉確認回應）。
- Terminal Server 在 quit 時保留（供下次啟動 Recovery）可能是設計行為；Windows 的 quit Step A（`stopTerminalServerGracefully`，`electron/main.ts`）在 Linux 的行為要對照。
- AppImage 啟動器（BUG-202 / T0799，`scripts/appimage-sandbox-launcher.cjs`：`/bin/sh` 包 `BetterAgentTerminal.bin`）或 AppImage runtime 等子程序持有 stdio / 程序群組，讓 Playwright 等不到結束。
- `e2e/linux/t0797-linux-appimage-launch.spec.ts` 已有「清掉殘留 Terminal Server」的程式，可能早已遇過同樣情況。

## 範圍

1. 在 WSL（隔離 userData）重現：AppImage＋Playwright `_electron.launch`，只開 shell 分頁，呼叫 `app.close()`，記錄是否返回、多久、程序樹前後、debug log `[quit]` 相關行、畫面上是否有關閉確認。
2. 拆開可能原因，至少比對：
   - 關閉確認：有 / 沒有確認對話框時（以 BAT 自己的設定或對話框按鈕）`app.close()` 的結果。
   - 不經 AppImage：解開 AppImage（`--appimage-extract`）直接執行 `BetterAgentTerminal.bin`（或打包前的 linux-unpacked）的結果，區分啟動器 / runtime 的影響。
   - 使用者正常關閉（視窗 ✕ / 選單離開並確認）時 Terminal Server 是否留著、下次啟動是否出現 Recovery 提示——判斷「留著」是設計還是缺陷。
3. 對照：讀 `e2e/linux/` 與 Windows 端 e2e 如何關閉 BAT（不必實跑 Windows；若要實跑只能用隔離實例，見 memory_overrides）。
4. 結論分類：A 測試方式問題（附建議的關閉方式，可給 e2e helper 草案）／B 設計行為（附依據）／C 產品缺陷（附重現步驟、影響範圍、修正方向與工單草案）。可以多項並存。

## 不做

- 不修程式、不改 e2e；不開 BUG（塔台依結論開）；不驗 macOS；不動使用者的 WSL / Windows 既有 BAT 與資料。

## 驗收

- [ ] 重現紀錄（命令、`app.close()` 結果與耗時、程序樹前後、`[quit]` log 行）
- [ ] 各假設的比對結果（關閉確認、不經 AppImage、使用者正常關閉）
- [ ] `e2e/linux/` 與 Windows e2e 關閉方式的對照
- [ ] 結論（A / B / C）與依據；C 附修正方向與工單草案
- [ ] 環境還原：隔離 userData、下載檔、暫存腳本已刪；沒有殘留的 BAT / terminal-server 程序（只限本單啟動的）；`~/.config/BetterAgentTerminal`、`~/bat-build`、`~/.codex/config.toml` 前後雜湊相同

---

## 回報區
