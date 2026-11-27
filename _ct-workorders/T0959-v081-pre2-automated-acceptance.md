---
schema_version: 1
schema_kind: workorder
id: T0959
title: "`v0.8.1-pre.2` 交付版自動化驗收：沿用 T0955 驅動，加測 BUG-232（登入導引分頁 / 遠端工具安裝的命令前輸入）與 BUG-233（⏻ 後游標）"
type: verification
status: PENDING
repo: better-agent-terminal
priority: P3
sizing: M
created_at: "2026-11-27T22:56:24+08:00"
updated_at: "2026-11-27T22:56:24+08:00"
target_version: "v0.8.1-pre.2（交付版驗收）"
depends_on: []
related:
  - "D460（U-49：A，發版後自動化驗收）；BUG-232（T0956〈待實機〉）、BUG-233（T0957〈待實機〉）；T0955（驅動 `e2e/manual/t0955-v081-acceptance.ts`、假 claude `t0955-fake-claude.cs` / `.mjs`，D451）"
affects_files:
  - _ct-workorders/T0959-v081-pre2-automated-acceptance.md
  - e2e/manual/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0959` 寫檔（base = 派工當下的 `main`，已含 T0955 驅動）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式（`src/**`、`electron/**`、`scripts/**`）、不改 `e2e/fixtures/`；只可擴充 `e2e/manual/` 的 T0955 驅動或新增本單腳本，README 同步。"
  - "🔴 受測物：GitHub Release `v0.8.1-pre.2` 的 `BetterAgentTerminal-0.8.1-pre.2-win.zip`，下載到自己的空目錄，以 release asset `digest` 比對相符才解壓到 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.2-win/`；`resources/package.json` 版號必須是 `0.8.1-pre.2`；只用 zip。"
  - "🔴 隔離（同 T0955，不得違反）：不碰安裝版 BAT 與它的 Terminal Server / PTY holder / userData；只結束自己記下 pid 的程序（D308）；`launchIsolated`＋`BAT_E2E_EXECUTABLE`、獨立 `--runtime=e2e-*`；`dropEnv` 去掉 `BAT_*` / `CT_*` / `CLAUDECODE` / `CLAUDE_CODE_*`；使用者層 `~/.claude`、`~/.codex` 前後雜湊相同；不開真的 claude 回合（假 claude）。"
  - "🔴 情境（每項 PASS / FAIL / 未判定附證據）：R0 回歸：T0955 全套（A-19 / A-20 / A-23 / A-21 / A-22 / 兩個反例）在 pre.2 照跑一次。B233（BUG-233）：分頁 shell 設成 WSL（本機有 WSL 才做；`wsl.exe` 不存在 → 未判定並寫原因），假 claude 或在 WSL 內以 `printf` 送 `ESC[?1049h ESC[?25l` 後保持執行，按 ⏻ → 新 shell 後 xterm `isCursorHidden=false`，log 有 `[mouse-tracking] cursor shown: new-pty-spawned`；對照：Git Bash 分頁照舊看得到（不回歸）、一般 shell 沒隱藏時沒有 `cursor shown` log。B232-login（BUG-232）：讓受測實例的 Claude Agent 面板顯示「未登入」導引（例：`CLAUDE_CONFIG_DIR` 指向空目錄；方式由 Worker 查證，不改產品），按開啟終端，分頁出現後立刻鍵入 `abc` → 輸入列是 `<cli> auth login` 在前、`abc` 在後，沒有自動送出（沒有 Enter），log 有 `input before the launch command … sent after it`；做不到讓面板進「未登入」→ 未判定並寫原因。B232-install（遠端工具安裝）：需要遠端 profile 視窗；本機能在隔離實例內以既有方式建立 WSL profile 且不影響使用者的 WSL / bat-server 時才做，否則未判定並寫原因（🔴 不得動使用者現有的 WSL distro、systemd unit、bat-server）。"
  - "🔴 結果：每項附證據（log 行、argv / stdin 檔、截圖）；結果放 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/T0959-results/`（本機），回報區放總表與摘錄；🔴 權杖值不得出現。受測版 FAIL 不修產品，記證據、建議開 BUG，繼續跑。同一項最多重試 3 次，仍不穩判「未判定」並附原因，不得硬判 PASS。"
  - "🔴 驗證與 Git：改了 `e2e/manual/` 時 `node --check` / 以 tsc 檢查驅動（同 T0955 的做法），worktree `npm ci`、`npx vite build` exit 0、`npm run typecheck` = 0。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空，自己的程序全部結束（列 pid）。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0959 — `v0.8.1-pre.2` 交付版自動化驗收

## 背景

`v0.8.1-pre.2` 含 BUG-232（T0956：登入導引分頁與遠端工具安裝的命令前輸入保留）與 BUG-233（T0957：⏻ 後還原被隱藏的游標）。使用者指示發版後以 T0955 的自動化驅動驗收（D460）。BUG-233 只在非 Windows 的 shell 出現（Windows 新 shell 會自己顯示游標），所以要用 WSL shell 測。

## 範圍

- 下載並驗證 pre.2 zip、隔離實例。
- R0 回歸（T0955 全套）＋ B233（WSL）＋ B232-login ＋ B232-install（可行時）。

## 不做

- 不改產品、不碰安裝版 BAT 與使用者的 WSL / bat-server、不開真的 claude 回合。

## 驗收

- [ ] zip 雜湊與版號相符
- [ ] R0、B233、B232-login、B232-install 逐項判定＋證據
- [ ] 隔離：安裝版 BAT 未被碰、使用者層雜湊相同、自己的程序全部結束
- [ ] 改了腳本時 build、typecheck、`node --check`

---

## 回報區

（Worker 填寫）
