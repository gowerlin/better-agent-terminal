---
schema_version: 1
schema_kind: bug
id: BUG-120
title: "SSH wizard 上傳 server bundle 時沒有 --strip-components=1，解出 <installPath>/staging/…，systemd unit / launchd plist 的 <installPath>/bin/bat-server 不存在（203/EXEC）"
status: CLOSED
severity: high
reproducibility: always
created_at: "2026-10-14T02:36:13+0800"
updated_at: "2026-10-14T04:10:17+0800"
closed_at: "2026-10-14T04:10:17+0800"
fixed_at: "2026-10-14T02:52:53+0800"
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
| **狀態** | 🚫 CLOSED（2026-10-14T04:10:17+0800，使用者同意） |
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

## 修正摘要（T0511）

- `electron/remote/ssh-bundle-uploader.ts` `buildExtractCommand()`：遠端指令改為 `mkdir -p '<p>' && cd '<p>' && { if [ -f staging/bin/bat-server ]; then rm -rf -- staging; fi; } && tar xz --strip-components=1 && { test -x bin/bat-server || { echo '…' >&2; exit 1; }; }`
  - 與 WSL `installBundle`（`electron/wsl-detect.ts`）、`docker/Dockerfile`、`e2e/real-remote/Dockerfile` 一致：release tarball 頂層恆為 `staging/`（`scripts/build-server-bundle.mjs` 自 T0271 起 `tar -czf <bundle> staging`）
  - 既有壞安裝：只在 `<installPath>/staging/bin/bat-server` 存在時刪 `<installPath>/staging`（本工具建立的路徑），重跑 wizard 即得正確佈局
  - 頂層不是 `staging/` 的 tarball：解完 `test -x bin/bat-server` 失敗 → 上傳步驟明確報錯（不靜默寫出不能啟動的 unit）
- 起源：T0285（`0a89800`，2026-04-26）即無 strip；首個含此 commit 的發佈版 `v0.4.1`
- 驗證：單元 `electron/remote/__tests__/ssh-bundle-layout-and-port.test.ts`（HEAD 上 red）；e2e `e2e/pre5-ssh-alias.spec.ts` A6-0（`ls ~/.local/bat-server` = `README.md bin electron node_modules package.json scripts`）、A6-2（預置 `staging/` 後重跑 wizard 被清除）

## 結案

- 2026-10-14T04:10:17+0800 使用者同意結案。證據：T0515 自動化驗收（已安裝 pre.6 隔離實例 + 容器化 sshd 真精靈流程，`e2e/pre6-wizard-acceptance.spec.ts`，`9917445`） W1：bundle 落在 `<installPath>/bin/bat-server`，無 `staging/`
