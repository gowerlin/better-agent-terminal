---
schema_version: 1
schema_kind: bug
id: BUG-206
title: "Linux：headless / direct 模式的宿主以 child_process 起的子程序（Claude 面板的 claude CLI、git 等）繼承所有分頁的 pty master"
status: CLOSED
severity: high
reproducibility: always（Linux；T0806 以 node＋`@lydell/node-pty` 1.1.0 模擬宿主實測）
created_at: "2026-11-03T17:57:10+0800"
updated_at: "2026-11-03T20:55:23+0800"
closed_at: "2026-11-03T20:55:23+0800"
closed_reason: "交付版 v0.7.4-pre.4 AppImage linux-acceptance run 41638443940（T0810 修正 spec）：ubuntu-22.04 / 24.04 t0807 G1–G3 PASS"
fixed_at: "2026-11-03T18:34:39+0800"
fixed_by: T0807
fix_commit: "5e056b72（T0809 合併 57c826f3，main 2b860ba1）"
impact:
  - linux
  - pty
  - headless
links:
  discovered_in: "T0806 回報區〈child_process 子程序 fd 外流盤點〉"
  related: [BUG-205, BUG-207, T0805, T0806, D252]
---
# BUG-206 — headless / direct 宿主的 child_process 子程序繼承 pty master

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（與 BUG-205 同類：不需權杖即可對分頁送輸入；路徑是宿主的 child_process 子程序，例如 headless bat-server 起的 claude CLI 及其 Bash 工具） |
| 可重現 | 每次（Linux 的 headless bat-server 與 direct 模式；Electron 的 Terminal Server 模式下 master 在 server，主行程沒有，不受影響） |
| **狀態** | 🚫 CLOSED（交付版 `v0.7.4-pre.4` linux-acceptance `41638443940`：22.04 / 24.04 t0807 G1–G3 PASS）；原 FIXED（T0807 `5e056b72`：Linux 主行程與 headless bat-server 在 libuv 入口安裝 child_process fd guard，子程序經固定 bash 包裝只保留 stdio（＋`CRASHDUMP_SIGNAL_FD`）；WSL 實測 8 種 API 與 git hook 0 個 master、主行程 `sleep` 可繼承 fd 49 → 0；已合併（T0809 `57c826f3`，main `2b860ba1`），待發版後實機驗收；D252 發版前不公開） |
| 回報者 | 塔台（T0806 盤點） |

## 現象

node-pty 為每個分頁開的 master 在宿主程序內沒有 `FD_CLOEXEC`。headless bat-server / direct 模式的宿主就是持有 master 的程序，它以 `child_process` 起的任何子程序（claude CLI、codex、git、`execFile` 類）都拿到**所有分頁**的 master（T0806 實測：宿主開兩個 PTY 後 `spawn('sleep')` 的 fd ≥ 3 只有 2 個，都是 `/dev/ptmx`）。長時間執行的子程序（claude CLI）再起的子程序也會一路繼承（推論）。

## 修正方向（未實作）

- 宿主端在 master 開出後設 CLOEXEC（上游 microsoft/node-pty PR #986 的做法；Node 沒有 fcntl，需 native 或升級後的 node-pty）。
- 或 `child_process` 子程序在 Linux 也經 exec 包裝關 fd（沿用 T0806 的 `guardPtySpawnFds` 思路，只套長時間執行的子程序）。

## 狀態歷程

- 2026-11-03 17:57 開單（OPEN，T0806 盤點；D252 揭露時程同 BUG-205）。
- 2026-11-03 17:59 → FIXING（T0807，D253）。
- 2026-11-03 18:35 → FIXED（T0807 `5e056b72`，分支 `ct/T0807`；main 已前進非 `_ct-workorders` 檔（T0808），改派合併工單 T0809）。
- 2026-11-03 20:12 合併：T0809 `57c826f3`，使用者確認斷點 E 後 main `--ff-only` → `2b860ba1`（未 push）。
- 2026-11-03 20:27 隨 `v0.7.4-pre.4` 發佈（run `41633956229`，target `6bfa01e0`）；待交付版 Linux 實機 / 自動化驗收後 CLOSED。
- 2026-11-03 20:55 → CLOSED：交付版 `v0.7.4-pre.4` AppImage 的 linux-acceptance `41638443940`（T0810 修正 t0807 spec 的 AppImage 對照組後，`--ref ct/T0810`）ubuntu-22.04 / 24.04 的 t0807 G1–G3 全 PASS：主行程安裝 guard（`[child-fd-guard] installed (/bin/bash)`）；spawn / execFile 的 `sleep` fd ≥ 3 可繼承 0 個，Electron-as-node 子程序只有自己開的 3 個＋`CRASHDUMP_SIGNAL_FD`，沒有 `/dev/ptmx`；主行程本身 53 個可繼承 fd（反向對照）。依據範圍：CI 跑的是 Terminal Server 模式的 Electron 主行程；direct 模式共用同一個主行程 guard；headless bat-server 的安裝點只有 T0807 的 WSL 冒煙（同一 commit），交付版 server bundle 未另跑。
