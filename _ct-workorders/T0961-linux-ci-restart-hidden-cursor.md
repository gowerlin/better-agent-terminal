---
schema_version: 1
schema_kind: workorder
id: T0961
title: "A-24 自動化：在 `linux-acceptance` 加 Linux spec 驗 BUG-233（⏻ 後游標），對 `0.8.1-pre.1`（預期 FAIL）與 `0.8.1-pre.2`（預期 PASS）各跑一次"
type: verification
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T23:48:46+08:00"
started_at: "2026-11-27T23:49:42+08:00"
updated_at: "2026-11-28T00:07:42+08:00"
completed_at: "2026-11-28T00:07:42+08:00"
session_ids:
  - "a962085b-a392-4b9a-aa47-f1c044af8c3b"
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

- [x] pre.1：B1 FAIL（或照實回報重現不了）
- [x] pre.2：B1–B4 PASS（22.04 / 24.04）
- [x] 兩個 run id、artifact、report 摘錄；遠端分支已刪
- [x] tsc 檢查 spec、`npm run typecheck` = 0、`npx vite build` exit 0

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **結論**：Linux CI 重現了 BUG-233，也驗到修正。`0.8.1-pre.1` 在 22.04 / 24.04 都是 B1 **FAIL**（⏻ 後游標仍隱藏），`0.8.1-pre.2` 在兩個 OS 都是 B1–B4 **PASS**。Linux 的 bash 不會自己送 `ESC[?25h`（N1），所以 Windows 上（ConPTY）重現不了的原 bug 在這裡重現得到。A-24 可以用這份結果結案。
- **session_id**：a962085b-a392-4b9a-aa47-f1c044af8c3b
- **完成時間**：2026-11-28T00:07:42+08:00

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 下 → PASS
- C-3：`e2e/linux/` 存在 → PASS
- C-2：工單沒有 `branch` 欄位，不比對
- `CT_HOME` 已設定，`CT_WORKTREE_BRANCH` = `ct/T0961`；`BAT_WORKSPACE_ID` 有設定（只記證據）；`BAT_REMOTE_TOKEN` 已設定

### 變更檔案

- 新增 `e2e/linux/t0961-restart-hidden-cursor.spec.ts`（LF）。`linux-os.ts`、既有 spec、產品程式、workflow、`e2e/fixtures/` 都沒動（只 import `systemInfo` 與 fixtures 既有的匯出）。
- spec 設計：沿用 t0806 的啟動方式（Playwright `_electron`、`chromiumSandbox: true`、`--runtime=e2e-t0961-<ts>`、`isolatedEnv`），以 `workspace.save` 放一個 shell 分頁；xterm 讀法同 T0959（React fiber 找 `TerminalPanel` 的 xterm ref，`_core.coreService.isCursorHidden`、`buffer.active.type`）；⏻ 是畫面上的按鈕＋確認對話框（`.main-panel button.action-btn.danger` ⏻ → `.dialog-btn.confirm.danger`，走 renderer 的 `restartOrCreatePty`），沒有直接改 xterm 狀態。
- 項目：B4 對照（閒置 shell ⏻）→ B1–B3（`printf '\033[?1049h\033[?25l'; sleep 3961` 後 ⏻）→ N1（只記錄：新 shell 原始輸出有沒有 `ESC[?25h`）。另記錄舊 `sleep` 已結束、新 shell 能回應 `echo`。報告照 t0806 格式寫 `t0961-report.md` / `.json`，另存截圖兩張與 `t0961-debug.log`，在 `LINUX_REPORT_DIR`（隨既有 artifact 上傳）。最後只斷言 B4 / B1 / B2 / B3 = PASS（N1 是 INFO）。

### 驗證

| 項目 | 結果 |
|---|---|
| worktree `npm ci` | 完成（只有既有的 `electron-winstaller` install script 被擋的警告，屬預期） |
| `tsc --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node`：t0961 與 t0806 | exit 0 |
| `npm run typecheck` | 0 錯 |
| `npx vite build` | exit 0 |
| `npx playwright test e2e/linux/t0961-restart-hidden-cursor.spec.ts --list` | 收到 1 個 test（本機不跑 Linux spec） |

### CI 結果（`linux-acceptance.yml`，`--ref ct/T0961`，head `e05999d3`）

| 版本 | run id | 22.04 | 24.04 | artifact |
|---|---|---|---|---|
| `0.8.1-pre.1` | 46028794605（failure，預期） | B4 PASS / **B1 FAIL** / B2 PASS / B3 FAIL | 同左 | `linux-acceptance-0.8.1-pre.1-ubuntu-22.04-attempt1`、`…-ubuntu-24.04-attempt1` |
| `0.8.1-pre.2` | 46028798961（success） | B4 / B1 / B2 / B3 全 PASS | 同左 | `linux-acceptance-0.8.1-pre.2-ubuntu-22.04-attempt1`、`…-ubuntu-24.04-attempt1` |

每個版本各觸發一次，沒有重跑（上限 3 次未動用）。

report 摘錄（`t0961-report.md`，兩個 OS 內容相同，只有 pid 與暫存目錄名不同）：

- pre.1 B1：setup 後 xterm `{"type":"alternate","cursorHidden":true}`、sleep 在跑；⏻ 後「new shell prompt true; xterm `{"type":"normal","cursorHidden":true}`; old sleep … alive false」；新 shell 回應 `echo T0961OK$((6*7))` → `T0961OK42`。
- pre.1 B2：⏻ 後 normal buffer；`alt screen left: new-pty-spawned` 1 行（T0950 已在 pre.1）。
- pre.1 B3：cursor log 行「none」——pre.1 沒有 T0957，屬預期，只記錄。
- pre.2 B1：⏻ 後 xterm `{"type":"normal","cursorHidden":false}`。
- pre.2 B3：`["[mouse-tracking] cursor shown: new-pty-spawned terminal=e2e-t0961-a"]`。
- 兩版 B4：⏻ 前後都是 `{"type":"normal","cursorHidden":false}`，cursor log 行「none」。
- 兩版 N1：新 shell 的輸出沒有 `ESC[?25h`、沒有 `ESC[?25l`、沒有 `ESC[?1049l`（51 字元）；開頭是 `"\u001b[?2004hrunner@<runner 主機>:/tmp/t0961-ws-…$ "`——只有 bracketed paste 與提示列，證實 Linux bash 不像 ConPTY 會自己顯示游標。

既有 spec：兩個 run、兩個 OS 的 t0797 / t0806 / t0807 / t0816 全部 ✓。pre.1 的 job 失敗只來自本 spec（各 OS「1 failed / 4 passed」）；pre.2 各 OS「5 passed」。t0797 L2 日誌照舊有 GPU `launch-failed` 的 `[CRASH]` 行（xvfb 沒有 GPU，既有現象，與本單無關，沒動）。

### Git

- **branch**：`ct/T0961`
- **base_sha**：`acb4f4cf8f5ac6e41ad84f5daf7e0a26a9484bad`
- **validated_sha**：`e05999d317511d92451b79fafaa8b48c5e57d604`（本機 tsc / typecheck / vite build 檢查的檔案內容就是這個 commit 提交的內容；CI 兩個 run 也跑這個 SHA）
- **head_sha**：`e05999d317511d92451b79fafaa8b48c5e57d604`
- 產品 commit：`e05999d3 test(e2e): T0961 Linux spec for BUG-233 (⏻ shows a cursor the old program hid)`
- 推送：只推過 `ct/T0961`；收單前已 `git push origin --delete ct/T0961`（`git ls-remote --heads origin ct/T0961` 0 筆）。本機分支保留給塔台合併。
- worktree `git status --porcelain` 為空。

### 遭遇問題

- Write 工具在 Windows 寫出 CRLF，提交前以 `sed -i 's/\r$//'` 改成 LF，再跑 tsc。

### 後續建議

- 塔台：A-24 依本結果結案（BUG-233 在 Linux 重現於 pre.1、pre.2 已修正）；合併 `ct/T0961` 後 `linux-acceptance` 對之後的版本會一併跑這支 spec 做回歸。

### 互動紀錄

- 無（yolo，沒有向塔台提問；執行中沒有塔台補充段落）。
