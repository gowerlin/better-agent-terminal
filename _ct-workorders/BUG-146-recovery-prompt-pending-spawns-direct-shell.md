---
schema_version: 1
schema_kind: bug
id: BUG-146
title: "BAT 重開且 Terminal Server 存活時，Recovery 提示回答前還原分頁的 pty:create 走 direct node-pty，同 id 另起一個本機 shell"
status: OPEN
severity: medium
reproducibility: always
created_at: "2026-10-17T19:55:06+0800"
impact:
  - terminal-lifecycle
  - terminal-server
links:
  discovered_in: "T0576 回報區「塔台補充 1」與「後續建議 1」（隔離實例日誌）"
  related: [T0576, T0575, T0108, T0110, PLAN-047]
---

# BUG-146 — Recovery 提示期間另起 direct shell

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（多出一個看不見的 shell 程序；其輸出併入同 id） |
| 可重現 | 必現（T0576 隔離實例日誌） |
| **狀態** | 📂 OPEN |

## 現象

Windows Terminal Server 模式，退出 BAT 時選「不停止 Terminal Server」，然後重開 BAT：

- **預期**：還原的分頁接回 Terminal Server 上存活的 PTY，不另起程序。
- **實際**：使用者回答 Recovery 提示**之前**，renderer 已送出還原分頁的 `pty:create`。此時 PtyManager 還沒連上 Terminal Server，`create` 走 direct node-pty，同 id 另起一個本機 shell（日誌 `Created terminal using node-pty`）。選「保留」後，分頁輸入改送 server PTY，但 direct shell 程序仍在，它的輸出也進到同一個 id。

T0576 隔離實例日誌（節錄）：

```
11:49:36.386Z [helper-cap] issued: terminal=e2e-t0576-tower role=tower
11:49:36.416Z Created terminal using node-pty
11:49:36.527Z [terminal-server] user chose recovery — connected to port 57769
11:49:36.528Z [PtyManager] replay: 2 active PTY(s) found on reconnect
```

## 背景

- 這是 T0108 / T0110 的既有行為，不是 T0575 / T0576 引入的。T0576 為了權杖時序，已讓還原的權杖不被這次 `create` 撤銷（pending + settle）。
- 修正方向（T0576 建議）：Recovery 待決時延後 `pty:create`，或選「保留」後收掉 direct 實例。修正時要顧及 `create` 同步回傳的 `created`（`requestPtySizeSync`、是否重送 agent 啟動命令，T0572），以及 T0576 的 settle 邏輯。

## 相關

T0576、T0575、T0108、T0110、T0572、PLAN-047
