---
schema_version: 1
schema_kind: bug
id: BUG-115
title: "release.ps1 -Snapshot 必定失敗：build-version.js 把 package.json 改成 snapshot 版號後，npm run build 的 prebuild 再跑 fetch:baseline，以 snapshot 版號下載 server-bundle → 404"
status: OPEN
severity: low
reproducibility: always
created_at: "2026-10-05T12:29:00+08:00"
updated_at: "2026-10-05T12:29:00+08:00"
impact:
  - local-packaging
links:
  fix_workorder: null
  related: [PLAN-031, D120]
---

# BUG-115 — `release.ps1 -Snapshot` 打包時 prebuild fetch:baseline 404

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響本機 `-Snapshot` 打包；不帶 `-Snapshot` 可正常打包，CI 不受影響） |
| 可重現 | 必現 |
| **狀態** | 📂 OPEN |
| 回報者 | 塔台（第五十六 session，2026-10-05 12:28 本機重打包） |

## 現象

`pwsh .vscode/scripts/release.ps1 -Snapshot`（HEAD `0d03fc7`，工作區乾淨）約 7 s 即失敗 exit 1：

1. `build:release` = `npm run fetch:baseline && node scripts/build-version.js`：第一次 `fetch:baseline` 以 package.json `0.6.0-pre.1` 解析 → 快取命中 ✅
2. `build-version.js` 把 package.json 改成 `0.6.0-pre.1.local.261005122832`，再 `npm run build`
3. `npm run build` 的 **`prebuild` hook 再跑一次 `fetch:baseline`**，這次讀到 snapshot 版號 → 下載 `server-bundle-v0.6.0-pre.1.local.261005122832/bat-server-linux-x64-v0.6.0-pre.1.local.261005122832.tar.gz` → HTTP 404 ×3 → abort（package.json 已還原）

log：`%TEMP%\bat-release-20261005122832.log`

預期：snapshot 版號只影響安裝檔版號；server-bundle baseline 應取 package.json 原版號（或已存在的 `dist-baseline/` 快取）。

## 待查方向

- `fetch-baseline-tarball.mjs` 版號來源：遇 `-local.` / `.local.` snapshot 後綴時 fallback 到基底版號，或 `build-version.js` 以 env 傳遞 baseline 版號
- `prebuild` 與 `build:release` 重複執行 fetch:baseline 是否需要（`build:release` 已先跑一次）
- 兩次 fetch 的版號不一致時另一風險：一般 `-Version X` 指定與 package.json 不同版號時，同樣會以 X 去下載（若 X 尚無 server-bundle release 亦 404）

## 暫行對策

不帶 `-Snapshot` 打包（以 package.json 版號，baseline 快取命中）；安裝後以雜湊確認換新（L127）。
