---
schema_version: 1
schema_kind: bug
id: BUG-098
title: "SSH 精靈 direct 模式整條路徑不通：遠端 bat-server 固定綁 localhost、profile 固定寫 `remoteHost: localhost`、ssh config alias 不解析 HostName"
status: OPEN
severity: medium
reproducibility: always
created_at: "2026-10-05T00:04:10+08:00"
updated_at: "2026-10-05T00:04:10+08:00"
impact:
  - setup-wizard-ssh
links:
  fix_workorder: null
  related: [BUG-093, T0387, BUG-097]
---

# BUG-098 — SSH 精靈 direct 模式整條路徑不通：遠端 bat-server 固定綁 localhost、profile 固定寫 `remoteHost: localhost`、ssh config alias 不解析 HostName

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（預設 tunnel 模式不受影響；選 direct 必失敗） |
| 可重現 | 推定 100%（程式碼證據；既有問題，非 T0387 引入） |
| **狀態** | 📂 OPEN |
| 回報者 | T0387 Worker（回報區「已知限制」）；塔台 2026-10-05 00:04 抽查 |

## 現象（程式碼證據）

- `electron/remote/ssh-start-server.ts:190`（systemd）/ `:225`（launchd）固定 `BAT_REMOTE_BIND=localhost` ⇒ 遠端只聽 loopback
- `src/components/setup-wizard/steps/wsl/write-profile.ts` SSH 分支固定 `remoteHost: 'localhost'`
- T0387 讓 direct 模式驗證打 `<sshHost>:<serverPort>` ⇒ bind 未改前必以 `fingerprint-unreachable` 失敗
- `sshHost` 若為 `~/.ssh/config` alias，direct 直連無法解析

## 修復方向

- direct 模式時遠端 bind 改為對外介面（需評估暴露面，與 BUG-097 同類安全考量）、profile `remoteHost` 寫實際主機、alias 經 `ssh -G` 解析 HostName；或評估直接移除 direct 選項
