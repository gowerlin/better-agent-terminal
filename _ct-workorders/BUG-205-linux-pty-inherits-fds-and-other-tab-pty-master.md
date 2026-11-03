---
schema_version: 1
schema_kind: bug
id: BUG-205
title: "Linux：分頁的 shell 繼承比它早開的分頁的 pty master 與 Electron 主行程的描述元（不需權杖即可對前面的分頁送輸入；背景程序讓 crashpad 留著）"
status: FIXING
severity: high
reproducibility: always（Linux；T0805 實測 WSL Ubuntu 24.04，`v0.7.4-pre.3` AppImage）
created_at: "2026-11-03T17:06:51+0800"
updated_at: "2026-11-03T17:08:46+0800"
impact:
  - linux
  - pty
  - helper-capability
links:
  discovered_in: "T0805（T0804 觀察 2）"
  related: [T0803, T0804, T0805, PLAN-062, T0575, D149, T0788, T0540]
---
# BUG-205 — Linux PTY 子程序繼承其他分頁的 pty master 與主行程描述元

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（跨分頁 pty master：分頁內任何程式不需 `batcap.` 權杖就能對比它早開的分頁送輸入、搶讀輸出，繞過範圍權杖（T0575 / D149）與 T0788 的保留機制；其餘描述元外流屬 medium；T0805 建議 P2） |
| 可重現 | 每次（Linux 的 Terminal Server / direct 模式；headless 只有 pty master） |
| **狀態** | 🔧 FIXING（T0806，方案 A，D252；修正發版前不公開） |
| 回報者 | 塔台（T0805 查證） |

## 現象

- Linux 上每個分頁的 shell 都持有約 30 個沒有 `FD_CLOEXEC` 的描述元，來自 Electron 主行程（經 Terminal Server 轉傳）與 Terminal Server：Chromium 的 `.pak` / `app.asar`、GPU / NetworkService / renderer 的 Mojo socket、**crashpad client socket**、Local Storage leveldb 與 GPUCache 的**寫入** fd、inotify、netlink 等；direct 模式約 50 個。
- **第 2 個以後的分頁持有所有比它早開、仍開著的分頁的 pty master（`/dev/ptmx`，O_RDWR）**：寫入 = 在那個分頁打字（含塔台分頁的權限對話框），讀取 = 搶走那個分頁的輸出。
- 分頁留下背景程序（`setsid` / `nohup` / `&`）時，即使選「離開＋結束 Terminal Server」，`chrome_crashpad_handler` 仍留到背景程序結束（它持有主行程 stdout / stderr）。
- Windows（ConPTY、handle 預設不可繼承）、macOS（`posix_spawn` + `POSIX_SPAWN_CLOEXEC_DEFAULT`）推論不受影響。

## 重現步驟

1. Linux（AppImage 或 deb）開兩個 shell 分頁。
2. 第 2 個分頁 `ls -l /proc/$$/fd`：可看到 `/dev/ptmx`（`grep tty-index /proc/$$/fdinfo/<fd>` = 第 1 個分頁的 pts 編號）、GPUCache / Local Storage 檔案、多條 socket。
3. 分頁執行 `setsid sleep 600 </dev/null >/dev/null 2>&1 &`，以「離開＋結束 Terminal Server」關閉 → `chrome_crashpad_handler` 留到 sleep 結束。

## 根因（T0805）

1. Chromium 主行程開的 fd 不設 CLOEXEC（它自己起子程序時在子程序端關）。
2. libuv（Node `child_process`）在 Linux 以 fork＋exec 起子程序、不關多餘 fd → `fork(terminal-server.js)` 全部帶進 Terminal Server。
3. `@lydell/node-pty` 1.1.0 在 Linux 以 `forkpty`＋`execvp`、子程序端不關 fd，且 master 不設 CLOEXEC → 後開的分頁帶走前面分頁的 master。上游 PR #867（進 1.2.0-beta）的 fallback 遇到 fd 缺號就停，lydell 的建置又沒編進 `close_range`，BAT 實測升級後仍漏（T0805 `gaptest`）。

## 修正方向

- 方案 A（T0805 建議先做）：Linux 上 PTY 子程序經 exec 包裝，在 exec shell 前關掉 fd ≥ 3；唯一實作一個純函式，Terminal Server、direct 與 fallback 共用，headless 自然涵蓋。
- 方案 B：上游修正後升級 `@lydell/node-pty`（可選：到 microsoft/node-pty 回報 fallback 缺陷）。
- PLAN-062 原題（保留 Terminal Server 時 crashpad 卡住主行程 stdio）需另案（T0805 方案 C），本 BUG 不涵蓋。

## 狀態歷程

- 2026-11-03 17:06 開單（OPEN，T0805 結論）。
- 2026-11-03 17:08 → FIXING（T0806，方案 A；D252：修正發版前不 push、不對外回報）。
