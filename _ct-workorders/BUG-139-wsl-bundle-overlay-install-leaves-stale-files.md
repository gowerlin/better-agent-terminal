---
schema_version: 1
schema_kind: bug
id: BUG-139
title: "WSL 精靈覆蓋安裝不清舊檔：`installBundle` 只 `tar -xzf` 疊上去，舊 bundle 已移除的套件殘留（實測約 256 MiB）"
status: OPEN
severity: low
reproducibility: always
created_at: "2026-10-16T02:45:47+0800"
updated_at: "2026-10-16T02:45:47+0800"
impact:
  - wsl-wizard
  - server-bundle
links:
  discovered_in: "T0550（WSL 實機驗收，0.6.1-pre.4）"
  related: [T0550, T0546, T0492, T0503, BUG-120]
---

# BUG-139 — WSL 精靈覆蓋安裝殘留舊 bundle 檔案

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（功能不受影響，smoke S1–S13 PASS；浪費磁碟，舊 native 套件留在 `node_modules` 有被誤載的潛在風險） |
| 可重現 | 必現（既有 `~/.local/bat-server` 上再跑精靈） |
| **狀態** | 📂 OPEN |
| 回報者 | T0550 Worker（塔台確認） |

## 現象

- **實際**：`wsl:install-bundle`（`electron/wsl-detect.ts` `installBundle`）只做 `mkdir -p` + `tar -xzf … --strip-components=1`，不清目錄。0.5.9-pre.4 → 0.6.1-pre.4 升級後，`~/.local/bat-server` 仍有新 bundle 已不含的 `node_modules/@anthropic-ai/claude-agent-sdk-linux-x64`（226M，T0546 移除）、`@img`（17M，T0503）、`better-sqlite3`（13M，T0492）、`sharp`（912K，T0503）。
- **預期**：安裝後目錄內容等於新 bundle（使用者資料在 `~/.local/share/bat-server`，不在安裝目錄）。

## 證據

- 塔台複驗（2026-10-16 02:44）：`du -sh ~/.local/bat-server` = 708M（同目錄 0.5.9-pre.4 備份 687M）
- T0550 回報區「發現的產品缺陷 2」

## 修正方向（待派工時定案）

- 解到暫存目錄後換名，或解壓前清掉 bundle 管理的子目錄（`bin/`、`electron/`、`node_modules/`、`scripts/`…）
- SSH 上傳路徑（`electron/remote/ssh-bundle-uploader.ts`，T0511 會先刪舊 `staging/`）是否同樣殘留需一併確認
