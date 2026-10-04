---
schema_version: 1
schema_kind: bug
id: BUG-103
title: "RemoteServer auth metadata 的 serverEnv 寫死 'native'：WSL 上的 headless server 也回 native，且缺 wslDistro / serverHome"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-10-05T01:24:41+08:00"
updated_at: "2026-10-05T02:51:46+08:00"
impact:
  - remote-protocol
links:
  fix_workorder: T0404
  related: [T0396, PLAN-036]
---

# BUG-103 — auth metadata serverEnv 寫死 native

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（目前無 client 依此分支；日後依 `serverEnv` 判斷 WSL 會誤判） |
| 可重現 | 100%（T0396 smoke S1：`serverPlatform=linux arch=x64 env=native`，對象為 WSL `Ubuntu-24.04`） |
| **狀態** | ✅ FIXED（T0404 `e4ad7cc`；**WSL 實機 PASS** 02:51：smoke S1 `env=wsl`） |
| 回報者 | T0396 Worker（回報區「遭遇問題」第 2 點） |

## 根因（塔台 01:24 複核）

- `electron/remote/remote-server.ts:154` `buildAuthMetadata()` 寫死 `serverEnv: 'native'`；`AuthServerEnv` 型別已定義 `'wsl'`，但從未產出

## 修復方向（待工單決定）

- headless 端偵測 WSL（`WSL_DISTRO_NAME` env / `/proc/version` 含 `microsoft`），回 `serverEnv: 'wsl'` + `wslDistro`；`serverHome` 取 `os.homedir()`
- 可併入 PLAN-036 P1

## 修復紀錄

- T0404（`e4ad7cc`）：`detectServerEnv()`（`WSL_DISTRO_NAME` → `/proc/version` 含 microsoft → native；例外退回 native）；`wsl` 時附 `wslDistro`（有才附）與 `serverHome`；native 欄位形狀不變（避免影響 SSH wizard `serverHome` 優先序）
- 02:51 部署至 WSL，smoke S1 `env=wsl`。systemd unit 無 `WSL_DISTRO_NAME` 時靠 `/proc/version` 判定，無 `wslDistro`
