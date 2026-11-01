---
schema_version: 1
schema_kind: bug
id: BUG-187
title: "遠端工具「安裝 / 更新 Node.js」以 nvm 裝 LTS（v26）時沒有先確保 `libatomic1`，最小安裝的 Linux 裝完 node 無法執行"
status: FIXED
severity: medium
reproducibility: always
created_at: "2026-11-02T01:12:29+0800"
updated_at: "2026-11-02T01:36:43+0800"
fixed_at: "2026-11-02T01:35:01+0800"
fix_commit: 915f90ab
impact:
  - remote-tools-install
  - setup-wizard
links:
  discovered_in: "T0754 待決點 4、T0755 後續建議；塔台查 `src/lib/remote-tools/recipes.ts`（2026-11-02，第一百零四 session）"
  related: [BUG-186, T0753, T0754, T0755, T0756, T0555, T0556]
---

# BUG-187 — Node.js 安裝 recipe 沒有先確保 `libatomic1`

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（BAT 自己的安裝按鈕裝出跑不起來的 node；node / npx / MCP 全部失敗） |
| 可重現 | 必現（沒有 `libatomic1` 的 Ubuntu / Debian 等，nvm LTS = v26 時） |
| **狀態** | ✅ FIXED（T0756 `915f90ab`，待 `0.7.3-pre.3` 實機驗收） |
| 回報者 | 塔台（BUG-186 / T0754 追查時發現） |

## 現象

- 遠端工具面板的 Node.js「安裝 / 更新」（`src/lib/remote-tools/recipes.ts`）執行 `nvm install --lts` 並 `nvm alias default 'lts/*'`。目前 LTS 是 v26，官方 Linux x64 binary 需要 `libatomic.so.1`。
- 使用者 WSL `Ubuntu-24.04` 沒有 `libatomic1`：nvm 的 node v26.13.0 `error while loading shared libraries: libatomic.so.1`，exit 127（BUG-186 的「無回應」即此）；終端分頁、Claude 面板（PLAN-057 套用後）都跑不起來。
- 預期：BAT 安裝 / 更新 Node.js 後 node 可以執行；缺系統程式庫時先補裝（或明確告知），不留下壞掉的預設版本。
- 2026-11-02 01:09 塔台已在使用者 WSL 以 root 裝 `libatomic1`，該環境已恢復；程式缺陷仍在。

## 修正（T0756 `915f90ab`）

- 查證：Node.js 25 起官方 Linux x64 / arm64 binary 需要 `libatomic.so.1`（v24 / v22 / v20 不需要）；套件名 apt `libatomic1`、dnf / yum `libatomic`。
- apt / dnf / yum 可提權時：安裝 / 更新前檢查 `ldconfig -p`，缺才補裝（列在確認畫面「先執行」）；已有時命令只多一次檢查。沒有 sudo 或沒有對應套件管理器：不中止 node 安裝，node 跑不起來時印出管理員要執行的指令並保留 exit code。所有 Linux 安裝 / 更新最後跑 `node --version`；失敗時面板顯示原因與修正指令。macOS / musl 不變；nvm 仍免 sudo。
- Docker `ubuntu:24.04` 最小映像實測：root / 免密碼 sudo → `node --version` = v26.13.0；無 sudo → 提示＋exit 127。

## 參考

- alpine 已有前例：`apk` 時先 `apk add ${recipe.alpinePackages}` 再跑 recipe（`recipes.ts`）。
- 偵測端說明原因：T0753（`parseVersionError`，`missingLibrary`）。
