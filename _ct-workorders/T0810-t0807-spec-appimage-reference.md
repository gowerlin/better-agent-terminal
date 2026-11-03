---
schema_version: 1
schema_kind: workorder
id: T0810
title: "t0807 Linux e2e：G2 對照組相容 AppImage，讓交付版 linux-acceptance 能判定 BUG-206 / 207"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-03T20:43:13+0800"
started_at: ""
updated_at: "2026-11-03T20:43:13+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "BUG-206 / BUG-207（FIXED，待交付版驗收）；D257；T0807（spec 作者，當時以 `--linux dir` 驗證）；T0798（`--ref` 分支 CI 驗證先例）；linux-acceptance run `41636533467`"
affects_files:
  - e2e/linux/t0807-child-process-fds.spec.ts
  - "e2e/fixtures/electron-isolation.ts（只在確有必要時；先問塔台）"
  - "docs/agent-guide/linux-pty-fd-inheritance.md（只改 t0807 驗證說明的段落，若需要）"
  - _ct-workorders/T0810-t0807-spec-appimage-reference.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只改測試（spec，必要時 fixture / docs 段落），不改產品程式（`electron/**`、`src/**`、`scripts/**`）與 workflow。修完後的 spec 必須同時能跑交付版 AppImage 與 `electron-builder --linux dir` 的目錄版。"
  - "🔴 G2 / G3 的判準不得放寬：不得把真的外流的 fd 列入允許清單、不得跳過 execPathNode / spawn / execFile 任一個、不得把 FAIL 改成 WARN。若修好對照組後 G2 / G3 真的 FAIL（產品問題）→ 停下，狀態 PARTIAL，回報證據，不修產品。"
  - "🔴 驗證：push 分支 `ct/T0810`（已授權，只限這個分支；不得 push `main`、不得 force push 他人分支），`gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal --ref ct/T0810 -f version=0.7.4-pre.4`，必要時迭代；最後一次 run 兩個 OS 的 t0797 / t0806 / t0807 結果寫進回報區（含 run id）。驗完以 `git push origin --delete ct/T0810` 刪遠端分支，本機分支保留給塔台合併。所有 `gh` 指令帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 本機若方便可先在 WSL Ubuntu-24.04 對交付版 AppImage 試跑；🔴 不得對任何 agent TUI 送按鍵、不得登入 codex / claude（L185），不得改 WSL 使用者的 `~/.config/BetterAgentTerminal` / `~/.codex`。"
  - "🔴 yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版。Git：只 commit 本單範圍（`git commit --only` 或明列路徑）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：commit / 回報不寫帳號名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0810 — t0807 spec 的 G2 對照組相容 AppImage

## 元資料

- **工單編號**：T0810
- **類型**：implementation（測試修正）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-03T20:43:13+0800
- **預估規模**：S

## 背景

`v0.7.4-pre.4` 已發佈。linux-acceptance run `41636533467`（`-f version=0.7.4-pre.4`，`main` @ `00b24984`）對交付版 AppImage：

- ubuntu-22.04 / 24.04 的 t0797、t0806 F1–F6 全 PASS（BUG-205 已 CLOSED）。
- t0807：G1 PASS（debug log `[child-fd-guard] installed (/bin/bash)`）；**G2 兩個 OS 都在 `e2e/linux/t0807-child-process-fds.spec.ts:168` 拋 `timed out waiting for reference exec'd`**，G2 / G3 沒有判定，BUG-206 / 207 無法依交付版結案。

塔台初判（未驗證，請以實測為準）：G2 的對照組（第 166 行）以 bash 關掉 fd ≥ 3 後 `exec "$E2E_EXECUTABLE" -e …`，第 168 行等 `cmdline(refPid)[0]` 等於 `E2E_EXECUTABLE` 或其 realpath。交付版的 `E2E_EXECUTABLE` 是 `.AppImage`：AppImage runtime 掛載 squashfs 後執行掛載目錄內的啟動器（T0799 / BUG-202 的 `/bin/sh` 啟動器），再 exec `BetterAgentTerminal.bin`，cmdline[0] 會是 `/tmp/.mount_*/BetterAgentTerminal.bin`（同一 run 的 L1 證據：主行程 `/tmp/.mount_Better3F7K4d/BetterAgentTerminal.bin --no-sandbox …`），永遠不會等於 AppImage 路徑。T0807 當時用 `electron-builder --linux dir` 的目錄版驗證，所以沒遇到。

另需注意：經 AppImage runtime 起的對照組可能多出 runtime / FUSE 相關的 fd，或經啟動器多一層 `/bin/sh`；對照組的「同一個執行檔、乾淨起點」語意要成立。一個可能的做法是改以 BAT 主行程的 `/proc/<mainPid>/exe`（app 執行中掛載點存在）當對照組的執行檔；由你查證後決定。

## 範圍

1. 實測確認 G2 逾時的原因（交付版 AppImage）。
2. 修正 t0807 spec 的 G2 對照組，使它在 AppImage 與 `--linux dir` 目錄版都成立；G2 / G3 判準不變。
3. CI 驗證：push `ct/T0810`，以 `--ref ct/T0810 -f version=0.7.4-pre.4` 跑 linux-acceptance，兩個 OS 的 t0807 G1–G3 都有判定結果。
4. 若 `docs/agent-guide/linux-pty-fd-inheritance.md` 的 t0807 驗證說明需要補一句（AppImage 對照組做法），一併改。

## 不做

- 不改產品程式、不改 workflow、不放寬 G2 / G3 判準、不發版、不 push `main`。
- 不結案 BUG-206 / 207（塔台依你的 CI 結果判定）。

## 驗收

- [ ] G2 逾時原因的實測證據
- [ ] spec 修正說明（為何對照組語意仍是「同一執行檔、乾淨起點」）
- [ ] linux-acceptance `--ref ct/T0810 -f version=0.7.4-pre.4` 最後一次 run id，22.04 / 24.04 各自的 t0797 / t0806 F1–F6 / t0807 G1–G3 結果與 G2 / G3 的證據摘要
- [ ] 若有本機目錄版或 WSL 試跑，附結果；沒有則註明
- [ ] 遠端 `ct/T0810` 已刪除、本機分支保留（回報 head SHA）
- [ ] `npm run typecheck` / `typecheck:electron` 不需跑（不改 src / electron）；若動到 fixture，跑 `npx tsc --noEmit -p e2e` 或等效檢查（若專案有），或說明

---

## 回報區

<!-- Worker 由此往下寫 -->
