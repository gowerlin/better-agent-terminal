---
schema_version: 1
schema_kind: workorder
id: T0801
title: "NSIS 重裝驗收腳本 `-Version` 改必填（預設值停在 `0.7.2-pre.8`，漏帶就驗到舊版）"
type: implementation
status: TODO
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-03T13:30:03+0800"
started_at: ""
updated_at: "2026-11-03T13:30:03+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "D247；T0740（腳本建立）/ T0745（log 誤判 FAIL）；`_local-rules.md` Release 節「回報發佈完成時必附 NSIS 重裝驗收提醒與指令」"
affects_files:
  - e2e/manual/nsis-reinstall-acceptance.ps1
  - e2e/manual/README.md
  - e2e/manual/__tests__/**
  - docs/agent-guide/packaging-release-checks.md
  - _ct-workorders/T0801-nsis-acceptance-version-required.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 `-Version` 改必填：不帶時腳本在做任何事之前（下載、備份、安裝之前）就失敗並印出可直接照抄的用法（含 `-Version <版號>` 範例與 `-DryRun`）。`-DryRun` 也必須帶。版號格式先檢查（例 `^\\d+\\.\\d+\\.\\d+(-pre\\.\\d+)?$`，以腳本與 release 實際的版號形式為準），不合法同樣在開始前失敗。不加「自動取最新 release」之類的推測行為。"
  - "🔴 注意 PowerShell 的 `[Parameter(Mandatory)]` 在非互動（`-NonInteractive`、CI、被其他程序呼叫）時會報錯，互動時則會停下來問；選擇哪種寫法、失敗時的訊息與 exit code，寫進回報區。以 `pwsh -NoProfile -NonInteractive -File …`（不帶 `-Version`）實測，確認不會卡住等輸入。"
  - "🔴 其他參數與行為完全不變（`-InstallerPath`、`-ExpectedSha256`、`-Scope`、`-StopRunning`、`-LaunchCheck`、`-DryRun` 等），報告格式不變。既有測試（若有）要綠；腳本有可測的部分就補測試（放 vitest 收得到的位置或沿用既有方式，CLAUDE.md「Frontend unit tests」🔴 不放進 `tests/`）。"
  - "🔴 文件：`e2e/manual/README.md` 與 `docs/agent-guide/packaging-release-checks.md` 中的指令範例都帶 `-Version`、說明它是必填。不改 CHANGELOG / release-note（塔台發版時處理）。不動 `_ct-workorders/_local-rules.md`（塔台收單後自己改）。"
  - "🔴 不得實際執行安裝 / 解除安裝（只做不帶 `-Version` 與格式錯誤的失敗路徑實測；`-DryRun` 若會下載安裝檔就不跑）。不發版、不 push。公開 repo 去識別化（D176）：回報不寫家目錄真實路徑，用 `<使用者資料夾>`。yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。暫存檔放系統暫存目錄，收尾刪除。"
---

# T0801 — NSIS 重裝驗收腳本 `-Version` 改必填

## 元資料

- **工單編號**：T0801
- **類型**：implementation（驗收腳本）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-03T13:30:03+0800
- **預估規模**：S

## 背景

`e2e/manual/nsis-reinstall-acceptance.ps1`（T0740）的 `param` 區 `[string]$Version = '0.7.2-pre.8'` 是舊版號。每次發版後使用者都要手動跑這支腳本；漏帶 `-Version` 就會下載並安裝舊版，驗收結果看起來 PASS 卻不是本版。塔台目前靠發版回報提醒「`-Version` 必帶」（`_local-rules.md`）。改成必填後，漏帶會直接失敗（D247）。

## 範圍

1. `-Version` 改必填，不帶或格式錯誤時在做任何事之前就失敗，並印出用法。
2. 非互動執行時不卡住等輸入（實測）。
3. 更新 `e2e/manual/README.md`、`docs/agent-guide/packaging-release-checks.md` 的指令範例與說明。

## 不做

- 不改其他參數、步驟與報告格式；不實際安裝；不改 CHANGELOG / release-note / `_local-rules.md`；不發版、不 push。

## 驗收

- [ ] 不帶 `-Version`：開始前失敗、印出用法、非互動不卡住（附實測輸出與 exit code）
- [ ] 格式錯誤的 `-Version`：開始前失敗（附實測）
- [ ] 帶合法 `-Version` 的路徑不受影響（說明如何確認；不實際安裝）
- [ ] README / docs 指令範例都帶 `-Version`
- [ ] 既有測試綠（若有）；可測部分補測試

---

## 回報區

（Worker 填寫）
