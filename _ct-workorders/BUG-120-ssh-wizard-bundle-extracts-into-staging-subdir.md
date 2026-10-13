---
schema_version: 1
schema_kind: bug
id: BUG-120
title: "SSH wizard 上傳 server bundle 時沒有 --strip-components=1，解出 <installPath>/staging/…，systemd unit / launchd plist 的 <installPath>/bin/bat-server 不存在（203/EXEC）"
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-14T02:36:13+0800"
updated_at: "2026-10-14T02:36:13+0800"
impact:
  - remote-ssh
  - setup-wizard
links:
  discovered_in: T0510
  fix_workorder: T0511
  related: [BUG-121, T0505, T0506, BUG-098]
---

# BUG-120 — SSH wizard 解壓多一層 `staging/`

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（pre.5 的 SSH wizard 在 Linux 目標上無法完成，與 BUG-121 合併擋住整條 SSH 安裝流程） |
| 可重現 | 必現（T0510 A6-0，乾淨 Debian 12 + systemd 容器） |
| **狀態** | 🔧 FIXING（T0511） |
| 回報者 | 塔台（T0510 Worker 自動化實機驗收發現） |

## 證據（T0510 回報區「發現的產品缺陷」1）

- `electron/remote/ssh-bundle-uploader.ts:47`：遠端指令 `mkdir -p '<installPath>' && cd '<installPath>' && tar xz`，沒有 `--strip-components=1`
- tarball 由 `scripts/build-server-bundle.mjs:430` `tar -czf <bundle> staging` 產生，頂層為 `staging/`
- 結果：`~/.local/bat-server/staging/bin/bat-server`；unit `ExecStart=/home/bat/.local/bat-server/bin/bat-server` → `Active: activating (auto-restart) … status=203/EXEC`；wizard `start-server` 回 `verify-failed: … Server reported: verify-failed: activating`
- 對照：WSL 路徑 `electron/wsl-detect.ts:338` 有 `--strip-components=1`
- 影響 ssh-linux 與 ssh-darwin（plist 同樣指向 `<installPath>/bin/bat-server`）

## 預期 vs 實際

- 預期：bundle 解在 `<installPath>/bin/…`，unit 啟動成功
- 實際：多一層 `staging/`，unit 203/EXEC
