---
schema_version: 1
schema_kind: workorder
id: T0961
title: "A-24 自動化：在 `linux-acceptance` 加 Linux spec 驗 BUG-233（⏻ 後游標），對 `0.8.1-pre.1`（預期 FAIL）與 `0.8.1-pre.2`（預期 PASS）各跑一次"
type: verification
status: IN_PROGRESS
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T23:48:46+08:00"
started_at: "2026-11-27T23:49:42+08:00"
updated_at: "2026-11-27T23:49:42+08:00"
target_version: "v0.8.1-pre.2（交付版驗收）；spec 之後隨 `main` 保留做回歸"
depends_on: []
related:
  - "D465（U-52：A）；BUG-233（T0957，`showLeftoverHiddenCursor`）；A-24；T0959（Windows 上 ConPTY 自己送 `?25h`，重現不了）；`linux-acceptance.yml`（T0797 / D242）、既有 spec `e2e/linux/t0806-*` / `t0807-*` / `t0816-*` 與 `e2e/linux/linux-os.ts`；CLAUDE.md「Release」節 Linux AppImage 啟動驗收"
affects_files:
  - _ct-workorders/T0961-linux-ci-restart-hidden-cursor.md
  - e2e/linux/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0961` 寫檔（base = 派工當下的 `main`）。不 merge / rebase、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式、不改 `.github/workflows/`、不改 `e2e/fixtures/`；只新增 `e2e/linux/` 的 spec（必要時小改 `e2e/linux/linux-os.ts` 的共用 helper，不得改變既有 spec 的行為）。"
  - "🔴 授權（U-52：A，D465）：可 `git push origin ct/T0961`（只推這個分支，不推 `main`、不推 tag）；可觸發 `gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal --ref ct/T0961 -f version=0.8.1-pre.1` 與 `-f version=0.8.1-pre.2` 各一次（spec 修正後可再各觸發，每個版本合計最多 3 次）；🔴 `gh` 一律帶 `-R gowerlin/better-agent-terminal`；不得觸發其他 workflow、不建 release / tag、不傳 secret。收單前刪掉遠端分支：`git push origin --delete ct/T0961`（本機分支保留，由塔台合併）。"
  - "🔴 spec 設計：沿用既有 Linux spec 的啟動方式（`linux-os.ts`、Playwright `_electron` 啟動 AppImage、隔離 userData），新增 `e2e/linux/t0961-restart-hidden-cursor.spec.ts`：在一般 shell 分頁送出會進 alt screen 並隱藏游標、之後持續執行的命令（例：`printf '\\033[?1049h\\033[?25l'; sleep 600`），確認 xterm `alternate` 且游標隱藏（讀法同 T0957：`_core.coreService.isCursorHidden`，經 renderer 可取得的方式），按分頁的 ⏻（UI 或等同 `restartOrCreatePty` 的正式路徑，🔴 不得直接改 xterm 狀態冒充），新 shell 提示列出現後判定：B1 游標看得到（`isCursorHidden=false`）；B2 xterm 在 normal buffer；B3 debug log 有 `[mouse-tracking] cursor shown: new-pty-spawned`（pre.1 沒有這行屬預期，只記錄）；B4 對照：沒隱藏游標的 shell 分頁 ⏻ 不出現 `cursor shown`。另外記錄新 shell 原始輸出裡有沒有 `ESC[?25h`（證明 Linux 的 bash / PTY 不像 ConPTY 會自己送）。判定與證據寫進既有的 linux report（照既有 spec 的報告格式）。"
  - "🔴 預期與判讀：`0.8.1-pre.1` B1 **FAIL**（原 bug 在 Linux 重現）；`0.8.1-pre.2` B1–B4 **PASS**。pre.1 若 B1 竟然 PASS → 代表 Linux 也重現不了，照實回報並附原始輸出，不得改判準硬湊。整個 workflow 在 pre.1 因本 spec FAIL 而失敗屬預期；既有 spec（t0797 / t0806 / t0807 / t0816）的結果照實記錄，與本單無關的失敗不修、記下來。spec 不穩 → 修 spec 重跑（不放寬判準），同一版本合計最多 3 次。"
  - "🔴 驗證：worktree `npm ci`；以 tsc 檢查新 spec（同 T0955 對 `e2e/` 的做法）；`npm run typecheck` = 0；`npx vite build` exit 0。本機不跑 Linux spec。回報附兩個 run 的 run id、各 OS 的 B1–B4 判定、artifact 名稱與 report 摘錄。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空、遠端 `ct/T0961` 已刪。"
  - "🔴 公開 repo（D176）：spec 與回報區不寫真名、家目錄路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0961 — A-24 自動化：Linux CI 驗 ⏻ 後游標（BUG-233）

## 背景

BUG-233：⏻ 後舊程式隱藏的游標，在非 Windows 的 shell 不會恢復。T0959 在 Windows 上驗不到原 bug（ConPTY 自己送 `?25h`），所以發了 A-24 請使用者在遠端視窗實機確認。使用者問能否自動化，選 U-52：A（D465）：在 `linux-acceptance` 加一支 spec，Linux 的 PTY 不經 ConPTY，能重現原 bug。

## 範圍

- 新增 `e2e/linux/t0961-restart-hidden-cursor.spec.ts`。
- push `ct/T0961`，對 `0.8.1-pre.1`、`0.8.1-pre.2` 各觸發一次 `linux-acceptance`，判讀 B1–B4，刪遠端分支。

## 不做

- 不改產品、workflow、既有 spec 行為；不推 `main`、不建 tag / release。

## 驗收

- [ ] pre.1：B1 FAIL（或照實回報重現不了）
- [ ] pre.2：B1–B4 PASS（22.04 / 24.04）
- [ ] 兩個 run id、artifact、report 摘錄；遠端分支已刪
- [ ] tsc 檢查 spec、`npm run typecheck` = 0、`npx vite build` exit 0

---

## 回報區

（Worker 填寫）
