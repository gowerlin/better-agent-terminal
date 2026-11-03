---
schema_version: 1
schema_kind: bug
id: BUG-209
title: "Linux AppImage：一般啟動、保留 Terminal Server 離開後 AppImage 的 mount 被卸載，server 仍在已卸載的 mount 上執行（讀取得到 ENOTCONN）"
status: CLOSED
severity: medium
reproducibility: always（T0812 實測 WSL Ubuntu 24.04、`v0.7.4-pre.4` AppImage；一般啟動 = stdio 是 pipe 或 /dev/null、沒有額外傳入的 fd）
created_at: "2026-11-03T22:19:09+0800"
updated_at: "2026-11-04T00:56:59+0800"
closed_at: "2026-11-04T00:56:59+0800"
closed_reason: "交付版 v0.7.4-pre.5 AppImage linux-acceptance run 41676550640：ubuntu-22.04 / 24.04 t0816 K1–K5（含 K3：一般啟動、主行程結束後 mount 仍在、server exe 可讀）PASS"
fixed_at: "2026-11-04T00:11:20+0800"
fixed_by: T0816
fix_commit: "24eb000c（合併 84ebb7af，main 5c721d88）"
impact:
  - linux
  - appimage
  - terminal-server
links:
  discovered_in: "T0812 回報區〈2. 成因〉5(b)、〈其他觀察〉1"
  related: [T0812, PLAN-062, T0804, T0805, T0144, T0578]
---
# BUG-209 — 保留 Terminal Server 時 AppImage mount 被卸載

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（保留下來的 server 之後需要載入尚未載入或已被回收的程式碼 / 資料頁時，推論會 SIGBUS 當掉；T0812 實測當下 server 與 shell 仍可用） |
| 可重現 | 每次（Linux AppImage、一般啟動、關閉時保留 Terminal Server） |
| **狀態** | 🚫 CLOSED（交付版 `v0.7.4-pre.5` linux-acceptance `41676550640`：22.04 / 24.04 t0816 K1–K5 PASS）；原 FIXED（T0816 `24eb000c`，T0817 合併 `84ebb7af`，main `5c721d88`：keepalive 以 fd 4 傳給 Terminal Server；分支 CI linux-acceptance `41667030155` K3 PASS（22.04 / 24.04：一般啟動、主行程結束後 mount 仍在、server exe 後段可讀）；待發版後交付版驗收） |
| 回報者 | 塔台（T0812 查證） |

## 現象

- AppImage runtime 的 FUSE 程序持有 keepalive pipe 的寫入端；讀取端的持有者全部結束後，FUSE 程序卸載 mount 並結束。
- 一般啟動時 keepalive 在主行程的 fd 3，`fork(terminal-server.js)` 時被 IPC 的 fd 3 蓋掉，所以 Terminal Server 沒有持有 keepalive。主行程一結束，mount 就卸載，但 server 仍在 `/tmp/.mount_*/BetterAgentTerminal.bin` 上執行。
- T0812 實測（rl-base）：`/proc/<server>/exe` 指向 `/BetterAgentTerminal.bin`，從 64 MiB 處讀回 `ENOTCONN`，`/proc/mounts` 已無該 mount；重開並回答「還原」後 server 與 shell 仍可用（`echo` 寫出 `T0812_42`）。
- Playwright 啟動時 keepalive 在 fd 5、server 有繼承到，mount 會留著（T0804 E1）——所以 e2e 不會暴露這個問題。

## 重現步驟

1. Linux 直接執行 AppImage（stdout / stderr 為 pipe 或 /dev/null），開一個 shell 分頁。
2. 關閉 BAT，關閉確認不勾「結束 Terminal Server」（預設）。
3. `grep .mount_ /proc/mounts` 已無該 mount；`readlink /proc/<server pid>/exe` 指向已卸載路徑，讀該檔後段 → `ENOTCONN`。

## 修正方向

- T0812 方案 A3：Terminal Server 的 fork 經 fd guard，keepalive 以 `stdio[4]` 放到固定的 fd 4 傳給 server → FUSE 與 mount 留到 server 結束。由 T0816 一併修（D260）。

## 狀態歷程

- 2026-11-03 22:19 開單並 → FIXING（T0812 查證，D260：併入 T0816）。
- 2026-11-04 00:11 → FIXED（T0816 `24eb000c`；T0817 模式 ② 合併 `84ebb7af`，整合分支再併 main 記帳 → `5c721d88`，使用者確認斷點 E 後 main `--ff-only`）；分支 CI linux-acceptance `41667030155` K3 PASS；待發版後以交付版 AppImage 驗收後 CLOSED。
- 2026-11-04 00:56 → CLOSED：交付版 `v0.7.4-pre.5` AppImage 的 linux-acceptance `41676550640`（`main` @ `5b6265cf`）ubuntu-22.04 / 24.04 皆 success：t0816 K1–K5 PASS（K3：一般啟動、主行程結束後 mount 仍在、server binary 可讀回），t0806 F1–F6、t0807 G1–G3 不回歸 PASS；24.04 L1 WARN = BUG-202 自動降級（預期）、22.04 W1 INFO = BUG-203（已知限制）。
