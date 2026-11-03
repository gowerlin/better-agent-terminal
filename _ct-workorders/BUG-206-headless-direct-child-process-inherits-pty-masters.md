---
schema_version: 1
schema_kind: bug
id: BUG-206
title: "Linux：headless / direct 模式的宿主以 child_process 起的子程序（Claude 面板的 claude CLI、git 等）繼承所有分頁的 pty master"
status: OPEN
severity: high
reproducibility: always（Linux；T0806 以 node＋`@lydell/node-pty` 1.1.0 模擬宿主實測）
created_at: "2026-11-03T17:57:10+0800"
updated_at: "2026-11-03T17:57:10+0800"
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
| **狀態** | 📂 OPEN |
| 回報者 | 塔台（T0806 盤點） |

## 現象

node-pty 為每個分頁開的 master 在宿主程序內沒有 `FD_CLOEXEC`。headless bat-server / direct 模式的宿主就是持有 master 的程序，它以 `child_process` 起的任何子程序（claude CLI、codex、git、`execFile` 類）都拿到**所有分頁**的 master（T0806 實測：宿主開兩個 PTY 後 `spawn('sleep')` 的 fd ≥ 3 只有 2 個，都是 `/dev/ptmx`）。長時間執行的子程序（claude CLI）再起的子程序也會一路繼承（推論）。

## 修正方向（未實作）

- 宿主端在 master 開出後設 CLOEXEC（上游 microsoft/node-pty PR #986 的做法；Node 沒有 fcntl，需 native 或升級後的 node-pty）。
- 或 `child_process` 子程序在 Linux 也經 exec 包裝關 fd（沿用 T0806 的 `guardPtySpawnFds` 思路，只套長時間執行的子程序）。

## 狀態歷程

- 2026-11-03 17:57 開單（OPEN，T0806 盤點；D252 揭露時程同 BUG-205）。
