---
schema_version: 1
schema_kind: bug
id: BUG-102
title: "PtyManager 強制注入 LANG / LC_ALL=en_US.UTF-8，WSL Ubuntu 未產生該 locale → 每個遠端終端開頭印 setlocale 警告且退回 C locale"
status: FIXED
severity: medium
reproducibility: always
created_at: "2026-10-05T01:24:41+08:00"
updated_at: "2026-10-05T01:46:48+08:00"
impact:
  - remote-terminal
links:
  fix_workorder: T0398
  related: [T0396, PLAN-036]
---

# BUG-102 — headless PTY 強制 en_US.UTF-8 locale

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（WSL / 精簡 Linux 遠端每開一個終端都會看到警告；locale 退回 `C`/`POSIX` 可能影響非 ASCII 輸出） |
| 可重現 | 100%（T0396 smoke 對 `wsl:Ubuntu-24.04` 兩次、塔台 01:24 重跑一次皆出現） |
| **狀態** | ✅ FIXED（T0398 `f0d20c0`，01:46 塔台複驗 1177 tests / vite build；**WSL 實機 PASS**（01:52 部署 `09f1e46`，smoke 8/8，首段輸出為 prompt、無 setlocale 警告）） |
| 回報者 | T0396 Worker（回報區「遭遇問題」第 1 點） |

## 現象

- 遠端（WSL headless）`pty:create` 後首段輸出：`bash: warning: setlocale: LC_ALL: cannot change locale (en_US.UTF-8)`

## 根因（程式碼證據，塔台 01:24 複核）

- `electron/pty-manager.ts:509-510`、`:570-571`、`:651` 對 spawn 的 env 寫死 `LANG` / `LC_ALL: 'en_US.UTF-8'`
- Ubuntu 24.04 WSL 預設未產生 `en_US.UTF-8`（只有 `C.UTF-8`）

## 修復方向（待工單決定）

- 非 Windows 平台不覆寫既有 `LANG`；或偵測可用 locale（`locale -a`），優先 `C.UTF-8` fallback
- 注意本機 macOS / Linux 桌面的既有行為不可回歸（BUG-012 系列曾與 UTF-8 相關）

## 修復紀錄

- T0398（`f0d20c0`）：新增 `electron/pty-locale-env.ts` `resolvePtyLocaleEnv`，三個 spawn 路徑共用；win32 / darwin 輸出不變；linux 沿用可用的繼承 UTF-8 `LANG`，否則 `C.UTF-8` → `en_US.UTF-8`（`locale -a` 探測、快取），不設 `LC_ALL`；customEnv 的 locale key 一律不覆寫
- 殘留風險（Worker 回報，未修）：linux 繼承的 `LC_ALL` / `LC_CTYPE` 本身指向未安裝 locale（如 SSH `SendEnv LC_*`）時仍可能出現警告- 2026-10-05 01:52 塔台（使用者同意重啟）`deploy:headless:dev --tag t0398 --yes` 部署 HEAD `09f1e46` 到 WSL（備份 `*.bak-t0398`），smoke 8/8 PASS，S3 首段輸出 `gower@GXDEVPC02:~$`（修前為 `bash: warning: setlocale: LC_ALL ...`）
