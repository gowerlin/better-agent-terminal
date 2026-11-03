---
schema_version: 1
schema_kind: workorder
id: T0810
title: "t0807 Linux e2e：G2 對照組相容 AppImage，讓交付版 linux-acceptance 能判定 BUG-206 / 207"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-03T20:43:13+0800"
started_at: "2026-11-03T20:44:28+0800"
updated_at: "2026-11-03T20:53:55+0800"
completed_at: "2026-11-03T20:53:55+0800"
session_ids:
  - "dd1c76b0-e0fa-45ec-80eb-f3d990c65259"
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

### 完成狀態

- **狀態**：DONE（產品程式未改；G2 / G3 判準未改）
- **完成時間**：2026-11-03T20:53:55+0800
- **session_id**：dd1c76b0-e0fa-45ec-80eb-f3d990c65259

### 落點檢查

- PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3 PASS（spec / docs 皆存在）；C-2 無 `branch` 欄位。
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_HOME` 未設定（非 worktree，`workdir: main repo`）。

### G2 逾時原因（實測證據）

- run `41636533467`（交付版 `0.7.4-pre.4` AppImage）兩個 OS 都在 `t0807-child-process-fds.spec.ts:168` 拋 `timed out waiting for reference exec'd`；同一 run 的 t0797 L1 / L2 顯示主行程 argv[0] 是 `/tmp/.mount_Better*/BetterAgentTerminal.bin`（22.04：`/tmp/.mount_BetterihlLIB/BetterAgentTerminal.bin`，24.04：`/tmp/.mount_Better3F7K4d/BetterAgentTerminal.bin --no-sandbox`）。
- 舊對照組以 bash 關 fd ≥ 3 後 `exec "$BAT_E2E_EXECUTABLE"`（= `.AppImage`），再等 `cmdline(refPid)[0]` 等於 AppImage 路徑或其 realpath。AppImage runtime 掛載 squashfs 後經 AppRun → T0799 `/bin/sh` 啟動器 → `exec` 掛載點內的 `BetterAgentTerminal.bin`，argv[0] 最後是 `/tmp/.mount_*/BetterAgentTerminal.bin`，永遠不會等於 AppImage 路徑 → 逾時。塔台初判成立。
- 修正後的 run `41638443940` 證據一致：`reference binary: main process execPath /tmp/.mount_BetterjXW7XL/BetterAgentTerminal.bin (BAT_E2E_EXECUTABLE BetterAgentTerminal-0.7.4-pre.4.AppImage, /proc/6020/exe /tmp/.mount_BetterjXW7XL/BetterAgentTerminal.bin)`（24.04；22.04 同型）。

### spec 修正說明

- `e2e/linux/t0807-child-process-fds.spec.ts` G2：對照組的執行檔改為主行程的 `process.execPath`（`app.evaluate(() => process.execPath)`），等待條件改為 `cmdline(refPid)[0] === refExe`；逾時錯誤附上對照組當時的 argv 方便診斷；evidence 多一行記錄對照組執行檔、`BAT_E2E_EXECUTABLE` 檔名與 `/proc/<mainPid>/exe`。
- 語意仍是「同一執行檔、乾淨起點」：execPathNode 子程序就是 `cp.spawn(process.execPath, …)`，對照組現在 exec 的正是同一個檔案（不再經 AppImage runtime，所以也不會多 runtime / FUSE 的 fd、不多一層 `/bin/sh`）；乾淨起點仍由同一段 bash 關掉 fd ≥ 3 後 `exec`，env 仍只有 `PATH` / `HOME` / `ELECTRON_RUN_AS_NODE=1`。app 執行中掛載點存在。`--linux dir` 目錄版沒有啟動器（launcher 只在有 AppImage target 時由 `afterPack` 安裝），`process.execPath` 就是 `BAT_E2E_EXECUTABLE` 本身，行為與 T0807 時相同。
- G2 / G3 判準一字未改：允許清單仍只有 `CRASHDUMP_SIGNAL_FD` 與對照組自己開的 fd 種類，spawn / execFile / execPathNode 三者都檢查，FAIL 仍是 FAIL。
- `docs/agent-guide/linux-pty-fd-inheritance.md`：t0807 e2e 那一條補一句對照組改用 `process.execPath` 的原因（T0810）。
- 型別檢查：未改 fixture，專案沒有 e2e 專用 tsconfig；以 `npx tsc --noEmit --skipLibCheck --target ES2022 --module esnext --moduleResolution bundler --strict --types node e2e/linux/t0807-child-process-fds.spec.ts` 單檔檢查，0 錯誤。`npm run typecheck` / `typecheck:electron` 依工單不需跑（未改 src / electron）。

### CI 驗證（linux-acceptance）

- 指令：`gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal --ref ct/T0810 -f version=0.7.4-pre.4`
- 最後一次（也是唯一一次）run：**`41638443940`**（head `77fde527`），兩個 job 都 `success`，各 `3 passed`。

| 項目 | ubuntu-22.04 | ubuntu-24.04 |
|---|---|---|
| t0797 | ✓（W1 INFO、V1 / L1 / L2 PASS） | ✓（W1 / V1 / L2 PASS；L1 WARN = BUG-202 sandbox 自動降級，與 run `41636533467` 相同，預期） |
| t0806 F1–F6 | 全 PASS | 全 PASS |
| t0807 G1 | PASS（`[child-fd-guard] installed (/bin/bash)`） | PASS（同） |
| t0807 G2 | PASS | PASS |
| t0807 G3 | PASS | PASS |

- G2 證據摘要（兩個 OS 同型）：spawn / execFile 的 `sleep` 只有 3 個 fd、fd ≥ 3 無 `O_CLOEXEC` 的 0 個；execPathNode 的 fd ≥ 3 無 `O_CLOEXEC` 4 個 = 對照組的 3 個（`v8_context_snapshot.bin`、`[eventpoll]`、`[eventfd]`）＋ `CRASHDUMP_SIGNAL_FD`（24.04 fd 73 / 22.04 fd 71），沒有 `/dev/ptmx`，父程序都是主行程。
- G3 證據摘要：主行程 53 個無 `O_CLOEXEC` 的 fd（兩個 OS）；Terminal Server 37（24.04）/ 36（22.04），含 `ptmx` 1；shell A 只有 `0/1/2/255=/dev/pts/0`，`echo` 指令有回應。
- 以上可供塔台判定 BUG-206 / 207（本單不結案）。

### 本機試跑

- 沒有：未在 WSL 或本機目錄版試跑，直接以 CI 驗證（CI 一次通過）。未對任何 agent TUI 送按鍵、未登入 codex / claude。

### Git

- 分支 `ct/T0810`（本機保留，**head `77fde527be7b0ab5e8a9527333a5199c08f7e46d`**），內含 `77fde527 test: T0810 t0807 G2 reference uses main process execPath (AppImage-compatible)`（只改 spec 與 docs 兩檔），基底 `36265f29`（main 上的 T0810 IN_PROGRESS commit）。
- 遠端 `ct/T0810` 已以 `git push origin --delete ct/T0810` 刪除（`git ls-remote --heads origin ct/T0810` 為空）。未 push `main`。
- 工單檔的 commit 在 `main`（IN_PROGRESS `36265f29`、本收單 commit）。

### 遭遇問題

- 無。§ Tower Addenda Check 的節點 1、2（驗證前、產品 commit 前）沒有執行，只在填回報前（節點 3）檢查了一次：工單沒有任何 `## 塔台補充（…）` 段落，不影響結果。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### 後續建議

- 塔台合併 `ct/T0810` 回 `main`（`ct/T0810` 以 `main` 的 `36265f29` 為基底，main 之後只多本單收單 commit，可 fast-forward 以外的方式直接 merge，或 cherry-pick `77fde527`）。
