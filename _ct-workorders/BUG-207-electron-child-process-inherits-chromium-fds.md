---
schema_version: 1
schema_kind: bug
id: BUG-207
title: "Linux：Electron 主行程以 child_process 起的子程序（git、gh、claude CLI、codex 等）繼承 Chromium 約 49 個沒有 CLOEXEC 的描述元"
status: FIXING
severity: low
reproducibility: always（Linux；T0806 在 WSL 隔離實例實測）
created_at: "2026-11-03T17:57:10+0800"
updated_at: "2026-11-03T17:59:11+0800"
impact:
  - linux
  - child-process
links:
  discovered_in: "T0806 回報區〈child_process 子程序 fd 外流盤點〉"
  related: [BUG-205, BUG-206, PLAN-062, T0805, T0806]
---
# BUG-207 — Electron 主行程的 child_process 子程序繼承 Chromium 描述元

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（不含 pty master；同 uid 本來就能直接開這些檔案，新增的只有 Mojo socket / crashpad 等匿名通道；T0806 建議 P3） |
| 可重現 | 每次（Linux） |
| **狀態** | 🔧 FIXING（T0807，D253） |
| 回報者 | 塔台（T0806 盤點） |

## 現象

Electron 主行程（Linux）有約 49 個沒有 CLOEXEC 的 fd（GPU / NetworkService / renderer 的 socket、pipe、eventpoll、app 資源、userData 的 leveldb / GPUCache 寫入 fd 等）。主行程以 `child_process.spawn` / `execFile` 起的子程序全部繼承；`ELECTRON_RUN_AS_NODE` 子程序另帶 crashpad env、成為 crashpad client。長時間執行的子程序（claude CLI、codex）會把這批 fd 傳給它們再起的程式（推論）。Terminal Server 本身也在其中（PLAN-062 原題的成因之一）。

## 修正方向（未實作）

- 對長時間執行的子程序在 Linux 套 exec 包裝關 fd ≥ 3（沿用 T0806 的做法）；短命的 git / `execFile` 影響小，可不處理。

## 狀態歷程

- 2026-11-03 17:57 開單（OPEN，T0806 盤點）。
- 2026-11-03 17:59 → FIXING（T0807，D253）。
