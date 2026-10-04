---
schema_version: 1
schema_kind: bug
id: BUG-100
title: "`ssh.stopServer` / `ssh.uninstallBundle` 只有型別宣告、preload / main 未實作 → SSH `start-server` 的 rollback 呼叫即拋錯"
status: OPEN
severity: medium
reproducibility: always
created_at: "2026-10-05T00:04:10+08:00"
updated_at: "2026-10-05T00:04:10+08:00"
impact:
  - setup-wizard-ssh
links:
  fix_workorder: null
  related: [T0387, BUG-099]
---

# BUG-100 — `ssh.stopServer` / `ssh.uninstallBundle` 只有型別宣告、preload / main 未實作 → SSH `start-server` 的 rollback 呼叫即拋錯

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（SSH 精靈失敗後遠端殘留已啟動的服務 / bundle） |
| 可重現 | 推定 100%（程式碼證據；既有問題，非 T0387 引入） |
| **狀態** | 📂 OPEN |
| 回報者 | T0387 Worker（回報區「已知限制」）；塔台 2026-10-05 00:04 抽查 |

## 現象（T0387 回報）

- `src/types/electron.d.ts` 宣告 `ssh.stopServer` / `ssh.uninstallBundle`，註解寫「real IPC handlers land in a follow-up workorder」；`electron/preload.ts` / `electron/main.ts` 無實作
- SSH `start-server` 步驟 `rollback()` 呼叫時拋錯，runner 只記 warn

## 修復方向

- 實作兩個 IPC（`execFile` / `spawn` + array args、白名單、timeout），或移除型別並讓 rollback 不呼叫
