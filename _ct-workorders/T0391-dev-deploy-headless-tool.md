---
schema_version: 1
schema_kind: workorder
id: T0391
title: "PLAN-036 P0-D：本機 headless dev 部署工具（JS-only esbuild → install root；WSL 目標預設 dry-run，`--yes` 才覆寫並備份）"
type: implementation
status: TODO
priority: P1
sizing: S
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-04T23:58:00+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "PLAN-036 / D129"
  - "T0385 回報區 C（交付路徑缺口）、T0386 回報區 §6、建議工單清單 D"
  - "塔台 23:33-23:45 手動部署 T0385 JS 的實際流程（見下）"
affects_files:
  - scripts/dev-deploy-headless.mjs
  - package.json
  - docs/remote-dev-overview.md
  - scripts/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。"
  - "🔴 **不得對使用者 WSL 的 `~/.local/bat-server` 執行 `--yes` 寫入、不得重啟 `bat-server.service`**（目前跑著塔台部署的 T0385 JS，使用者驗收中）。WSL 目標只跑 dry-run；實際寫入測試只對 scratchpad 目錄。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args（`wsl.exe` 亦同），timeout 必設；distro 名稱過既有白名單 `/^[A-Za-z0-9._-]+$/`。禁用 shell-spawning exec API。"
  - "⚠️ `package.json` 只加一行 script，不動依賴。不 push。"
---

# T0391 — dev-deploy-headless 工具

## 背景

T0385 修的是 headless JS，但 WSL 內的 server 來自 GitHub Release 的 baseline tarball，本機打包不會帶本地改動。塔台 23:33-23:45 手動流程（本工具要把它變成一行指令）：

1. 用 `scripts/build-server-bundle.mjs` **相同的 esbuild 設定**（4 個 entryPoints：`server-entry` / `headless-entry` / `lockfile` / `dataDir`；externals **從該腳本解析，不手抄**——手抄曾漏 6 項）輸出到暫存目錄
2. 進 WSL：對 `~/.local/bat-server/electron/remote/` 的目標檔先備份 `<file>.bak-<tag>`（已存在則不覆蓋備份），再覆寫
3. `systemctl --user restart bat-server`，檢查 `is-active`、埠 LISTEN、journal 尾段
4. 踩到的坑：PowerShell → `wsl.exe -- bash -c '...'` 的 `$` 跳脫不可靠，改為「寫 bash 腳本檔 → `wsl.exe -d <distro> -- bash <script>`」才穩定
5. ⚠️ 重跑 WSL 精靈會重裝 baseline，把 dev 部署蓋回去 —— 工具輸出要提醒這點

## 範圍

- `scripts/dev-deploy-headless.mjs`：參數至少 `--target wsl:<distro>` / `--target dir:<path>`、`--yes`（否則 dry-run，只列將覆寫的檔案與雜湊）、`--no-restart`、`--tag`；`--rollback`（從 `.bak-<tag>` 還原）
- 輸出：部署前後 sha256、grep 指定 marker（可選 `--expect-string`）、restart 結果
- `package.json` script：`deploy:headless:dev`
- `docs/remote-dev-overview.md` 補一節用法與「精靈會蓋回」警告

## 驗收

- unit（可測部分）：參數解析、externals 由 build 腳本解析、distro 白名單、dry-run 不寫入
- `dir:` 目標對 scratchpad 實跑 `--yes` + `--rollback` 一輪；`wsl:Ubuntu-24.04` 只跑 dry-run（回報區附輸出）
- `npm run test:unit` 全綠；`npx vite build` exit 0；`npx tsc --noEmit` ≤ **40**

## Sub-session 執行指示

1. 讀取本工單 + T0385 回報區 C + T0386 回報區 §6
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
