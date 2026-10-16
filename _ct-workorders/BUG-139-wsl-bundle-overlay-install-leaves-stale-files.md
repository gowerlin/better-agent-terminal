---
schema_version: 1
schema_kind: bug
id: BUG-139
title: "WSL 精靈覆蓋安裝不清舊檔：`installBundle` 只 `tar -xzf` 疊上去，舊 bundle 已移除的套件殘留（實測約 256 MiB）"
status: CLOSED
severity: low
reproducibility: always
created_at: "2026-10-16T02:45:47+0800"
updated_at: "2026-10-16T14:20:40+0800"
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
| **狀態** | 🚫 CLOSED（T0552，commit `f599f915`，2026-10-16 03:29；pre.5 實機 e2e PASS，T0559，2026-10-16） |
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

## 修正（T0552，commit `f599f915`）

- WSL `installBundle` 與 SSH 上傳共用 `electron/server-bundle-install-script.ts`：先解到 `<root>.bat-new`、驗 `bin/bat-server`，舊 root 換名 `<root>.bat-old` → 新樹換入 → 刪舊樹；下載 / 解壓失敗時舊安裝不動。
- 刪除白名單：只有 `<root>.bat-new` / `<root>.bat-old` 與舊 root，且舊 root 必須是 bundle 安裝（`bin/bat-server` 或 T0511 前的 `staging/bin/bat-server`）或空目錄；其他內容照舊疊上去、不刪。root 須為絕對路徑、至少兩段、不得為 `$HOME`（TS 與 shell 兩處檢查）。WSL 改用 `wsl --exec sh -c`（`wsl --` 會丟掉位置參數，實測）。
- SSH 同病（T0511 只清 `staging/`，其餘舊檔殘留），一併修。
- 實機（Ubuntu-24.04）：`~/.local/bat-server` 708 MiB → 390 MiB，`claude-agent-sdk-linux-x64` / `@img` / `better-sqlite3` / `sharp` 皆已不在，未留下 `.bat-new` / `.bat-old`；`~/.local/share/bat-server` 的 `server-cert.json` / `server-token.json` sha256 不變。

## 驗收（pre.5 實機，T0559，2026-10-16）

- T0559（安裝版 pre.5，跨版 pre.4 → pre.5）：升級前植入舊樹的 canary（`.t0559-canary`、`node_modules/t0559-stale-canary/`）升級後皆不存在；`.bat-new` / `.bat-old` 無殘留；資料目錄 cert / token 不變。spec 的 `A3.clean-install` 以「`du` 變小」判定而記 FAIL（pre.4 已瘦身，390 → 390 MiB），屬判定條件不適用，由 T0560 改為 canary 判定。
- → **CLOSED**。
