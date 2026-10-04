---
schema_version: 1
schema_kind: bug
id: BUG-098
title: "SSH 精靈 direct 模式整條路徑不通：遠端 bat-server 固定綁 localhost、profile 固定寫 `remoteHost: localhost`、ssh config alias 不解析 HostName"
status: FIXED
severity: medium
reproducibility: always
created_at: "2026-10-05T00:04:10+08:00"
updated_at: "2026-10-05T06:00:36+08:00"
impact:
  - setup-wizard-ssh
links:
  fix_workorder: T0425
  related: [BUG-093, T0387, BUG-097]
---

# BUG-098 — SSH 精靈 direct 模式整條路徑不通：遠端 bat-server 固定綁 localhost、profile 固定寫 `remoteHost: localhost`、ssh config alias 不解析 HostName

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（預設 tunnel 模式不受影響；選 direct 必失敗） |
| 可重現 | 推定 100%（程式碼證據；既有問題，非 T0387 引入） |
| **狀態** | ✅ FIXED（處理方式：移除 direct 模式，T0425 / D134） |
| 回報者 | T0387 Worker（回報區「已知限制」）；塔台 2026-10-05 00:04 抽查 |

## 現象（程式碼證據）

- `electron/remote/ssh-start-server.ts:190`（systemd）/ `:225`（launchd）固定 `BAT_REMOTE_BIND=localhost` ⇒ 遠端只聽 loopback
- `src/components/setup-wizard/steps/wsl/write-profile.ts` SSH 分支固定 `remoteHost: 'localhost'`
- T0387 讓 direct 模式驗證打 `<sshHost>:<serverPort>` ⇒ bind 未改前必以 `fingerprint-unreachable` 失敗
- `sshHost` 若為 `~/.ssh/config` alias，direct 直連無法解析

## 修復方向

- direct 模式時遠端 bind 改為對外介面（需評估暴露面，與 BUG-097 同類安全考量）、profile `remoteHost` 寫實際主機、alias 經 `ssh -G` 解析 HostName；或評估直接移除 direct 選項

## 修復紀錄

- **處理方式：移除**（D134，使用者 2026-10-05 05:33 裁決：移除 direct，不修通）。T0425 移除 SSH 精靈的 direct 選項與 direct 驗證分支，精靈只產出 tunnel；遠端 bat-server 維持 `BAT_REMOTE_BIND=localhost`
- 相容：精靈殘留 `sshTunnelMode: 'direct'` → 視為 tunnel 並 warn；既有 profile `useSshTunnel: false` → `RemoteClient` 照樣走 SSH tunnel 並 warn，profile 詳情標示 `(legacy direct setting ignored)`；磁碟上的 profile 不改寫
- 驗收：`npm run test:unit` 124 files／1961 passed；`npx tsc --noEmit` 39（≤ 40）。詳見 T0425 回報區
- 修復時間：`2026-10-05T06:00:36+08:00`
