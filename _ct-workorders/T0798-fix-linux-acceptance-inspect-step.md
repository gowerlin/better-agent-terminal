---
schema_version: 1
schema_kind: workorder
id: T0798
title: "修正 `linux-acceptance.yml` 的「Inspect the AppImage」步驟在 runner 上中途 exit 1，並在 GitHub 上把兩個 OS 跑到有 `linux-report.md` 的結論"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-03T01:33:04+0800"
updated_at: "2026-11-03T01:33:04+0800"
session_ids: []
depends_on: []
related:
  - "T0797（建立本 workflow，DONE `cd938ab6`）；D242 / D243"
  - "失敗 run `41491827025`（2026-11-02T17:30:34Z，`-f version=0.7.4-pre.1`）：ubuntu-22.04 / 24.04 兩個 job 都在 step 10「Inspect the AppImage」`Process completed with exit code 1`，後續 Playwright 步驟沒跑、沒有 `linux-report.md`；artifact 只有 `appimage-inspect.md`（截斷）與 `runner-context.md`"
affects_files:
  - .github/workflows/linux-acceptance.yml
  - e2e/linux/**
  - docs/agent-guide/linux-ci-acceptance.md
  - _ct-workorders/T0798-fix-linux-acceptance-inspect-step.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 現象（run `41491827025`，`gh run view 41491827025 -R gowerlin/better-agent-terminal --log-failed`）：「Inspect the AppImage」印出到「highest GLIBC requirement per ELF file (top 10):」之後的清單只有部分（22.04 列 5 筆、24.04 列 2 筆，數量不同、也沒有 whisper 的 `libggml-*.so`），結尾的 ``` 沒印出就 `exit code 1`（shell `bash -e {0}`）。推測與 `bash -e` 下 pipeline / while 迴圈內的命令替換、`head` 提早關閉管線等有關，但**先以 log 查證根因，不要猜**。本機 WSL 實跑時沒有遇到，差異（`set -e`、檔案權限、runner 環境）一併說明。"
  - "🔴 修法原則：靜態檢查是資訊性的，任何一項取不到都只記錄（例 `n/a` / 錯誤原文）不得讓 job 失敗或中斷後續步驟；整個 ELF 清單要完整掃完（應含 whisper addon 的 `.so`，T0797 本機看到 `GLIBC_2.38`）。不得用 `continue-on-error: true` 掩蓋整個步驟（那樣清單仍會截斷）；若某個 step 確實需要容錯，限縮在單一命令。其他步驟的判讀規則（PASS / WARN / FAIL、sandbox、FUSE）不變。"
  - "🔴 在 GitHub 上驗證（D243 授權）：可 push 分支 `ct/T0798`（只此分支，不 push `main`），以 `gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal --ref ct/T0798 -f version=0.7.4-pre.1` 迭代，最多 5 次 dispatch；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。目標：兩個 job 都跑到 Playwright 步驟並產生 `linux-report.md`。job 因**產品**相容性問題而 FAIL / WARN（例：24.04 sandbox、22.04 語音輸入）不算本單失敗——那正是要的結論，照實記錄、不修產品；只有 workflow / spec 本身的錯誤要修。完成後刪除遠端分支 `ct/T0798`（`git push origin --delete ct/T0798`），本機分支保留由塔台處理。"
  - "🔴 回報區必列：根因（附 log 行）、修法、每次 dispatch 的 run id 與兩個 OS 的結論、最後一次的 `linux-report.md` 摘要（verdict、L1 / L2 / L1b、sandbox、`apparmor_restrict_unprivileged_userns`、glibc、啟動耗時、debug log 的 `[ERROR]` / `[CRASH]`）與完整 ELF GLIBC 清單（22.04 上 whisper `.so` 的需求與是否有相關錯誤）。runner 上 24.04 的 `apparmor_restrict_unprivileged_userns = 1`（run `41491827025` 的 `runner-context.md`），即桌面預設設定。"
  - "🔴 commit 在 `main` 上（只 commit 本單範圍，`git commit --only` 或明列路徑），`ct/T0798` 分支只用來在 GitHub 上跑；最後 `main` 的 commit 內容須與通過的那次 dispatch 的 workflow / spec 相同（寫明 SHA 對應）。不改產品程式碼、不發版、不改 CHANGELOG。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。暫存檔放系統暫存目錄，收尾刪除。完成狀態寫 `DONE`。"
---

# T0798 — 修正 linux-acceptance 的 Inspect 步驟

## 元資料

- **工單編號**：T0798
- **類型**：implementation（CI workflow 修正）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-03T01:33:04+0800
- **預估規模**：S

## 背景

T0797 新增的 `linux-acceptance.yml` 首次在 GitHub 上跑（run `41491827025`）時，兩個 OS 都在靜態檢查「Inspect the AppImage」中途 exit 1，Playwright 驗收沒跑到，還沒有 Ubuntu 22.04 / 24.04 的結論。

## 範圍

1. 以 log 查證根因並修正，讓靜態檢查完整且不會讓 job 中斷。
2. 用 `ct/T0798` 分支在 GitHub 上跑到兩個 OS 都有 `linux-report.md`。
3. 必要時更新 docs。

## 不做

- 不修產品相容性問題（只記錄）、不 push `main`、不發版。

## 驗收

- [ ] 根因（附 log）與修法
- [ ] 兩個 OS 都跑到 Playwright、有 `linux-report.md`；run id 與結論
- [ ] 完整 ELF GLIBC 清單（含 whisper `.so`）
- [ ] `main` commit 與通過的 dispatch 內容一致；遠端 `ct/T0798` 已刪

---

## 回報區
