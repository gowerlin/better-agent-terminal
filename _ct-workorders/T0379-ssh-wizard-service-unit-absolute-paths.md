---
schema_version: 1
schema_kind: workorder
id: T0379
title: "BUG-088 修復：SSH 精靈 systemd unit / launchd plist 改用絕對路徑（不留 `~`）"
type: implementation
status: TODO
priority: P1
sizing: S
created_at: "2026-10-04T21:30:23+08:00"
updated_at: "2026-10-04T21:30:23+08:00"
target_version: next
depends_on: [T0378]
related:
  - "BUG-088（修復對象）"
  - "T0378（WSL 版同類修復；先讀其回報區與 commit `4d814e9` 的 `wsl-systemd.ts` / `write-systemd-unit.ts` 作為範本）"
  - "D126（WSL 版決策：絕對 `$HOME` 路徑、不留 `~`、預設不用 `%h`）"
affects_files:
  - electron/remote/ssh-start-server.ts
  - electron/remote/ssh-setup-handlers.ts
  - src/components/setup-wizard/steps/ssh/start-server.ts
  - src/components/setup-wizard/steps/ssh/configure-host.ts
  - src/components/setup-wizard/steps/ssh/install-server-bundle.ts
  - electron/__tests__/
  - src/components/setup-wizard/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設；外部輸入（host / user / path）沿用既有 `ssh-args.ts` 驗證與 escape（CLAUDE.md Child Process Spawning）。禁用 shell-spawning exec API。"
  - "🔴 WSL 精靈（T0378 已修）不在範圍，不要改 `electron/wsl-*.ts` / `steps/wsl/*`；共用的 `SetupWizardShell.tsx` / `wizard-runner.ts` / `error-mapper.ts` 不需改動，若真要改須在回報區說明且 WSL / Docker 測試全綠。"
  - "🔴 不得刪除或重建本機 WSL 發行版 `Ubuntu-24.04`。"
  - "⚠️ 不 push。"
---

# T0379 — SSH 精靈服務檔改用絕對路徑

## 背景

T0378 修好 WSL 精靈的 systemd unit `~` 問題（BUG-087 缺陷 B）。T0378 Worker 讀碼發現 SSH 精靈有同樣的缺陷：預設 install path `~/.local/bat-server` 被原樣寫進 systemd `ExecStart` 與 launchd `ProgramArguments`，systemd 不展開 `~` ⇒ 服務起不來。

**實作前讀 BUG-088 與 T0378 回報區。**

## 決策（沿用 D126）

1. 服務定義檔（systemd unit 的 `ExecStart` / `Environment`，launchd plist 的 `ProgramArguments` 與其他路徑值）**不得出現 `~`**，一律寫出絕對路徑
2. 絕對路徑以已解析的遠端 `serverHome`（`verify-ssh-auth` 取得，已在 `StartServerOptions.serverHome`）展開 `installPath` 開頭的 `~` 或 `~/` 取得；`serverHome` 須為 `/` 開頭且通過既有驗證，否則明確報錯（不寫出壞檔）
3. 展開位置由 Worker 決定（`ssh-start-server.ts` 內 render 前展開，或精靈步驟先展開再傳入），但**最終寫出的檔案內容**必須是絕對路徑；`installPath` 已是絕對路徑（如 `/opt/bat-server`）時不變
4. 預設不用 `%h`（與 D126 一致）；修正 `renderSystemdUnit()` 內與實際行為不符的 `%h` 註解，以及 `serverHome` 「Currently informational」註解
5. 若 install / uninstall / rollback 等其他步驟也把 `installPath` 寫進**不經 shell 展開**的地方，一併修正；經 ssh 遠端 shell 執行的指令（`mkdir` / `tar` / `rm`）可維持現狀
6. launchd：Worker 確認 launchd 是否展開 `ProgramArguments` 裡的 `~`（查 Apple 文件 / `launchd.plist(5)`）；結論寫回報區。不論結論，plist 一律寫絕對路徑（零成本且確定正確）

## 驗收

- unit（新增，`ssh-start-server` 目前沒有測試）：
  - systemd unit：`installPath='~/.local/bat-server'` + `serverHome='/home/alice'` → `ExecStart=/home/alice/.local/bat-server/bin/bat-server`，內容不含 `~`
  - launchd plist：同上，`ProgramArguments` 為絕對路徑
  - `installPath='/opt/bat-server'` 不變
  - `serverHome` 缺失 / 非絕對 / 含非法字元 → 報錯、不產生檔案
  - 既有 T0297 F-005 結構字元 / XML escape 防護仍成立（若有既有測試須全綠）
  - 測試檔位置須被 `vite.config.ts` `test.include` 涵蓋（若需要匯出 render 函式供測試，可以）
- `npm run test:unit` 全綠（基線 **749**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **本機 runtime（建議）**：把產生的 systemd unit 寫到 `Ubuntu-24.04` 的暫存目錄，跑 `systemd-analyze --user verify <file>`（或放進 `~/.config/systemd/user/` 後 `daemon-reload` 看 `Loaded:`），確認不再出現 `Neither a valid executable name nor an absolute path`；驗完刪除暫存檔並 `daemon-reload`。執行檔不存在的錯誤屬預期
- **runtime 驗收（交使用者）**：實際 SSH 主機跑 SSH 精靈（若使用者有可用主機）

## 範圍外

- WSL 精靈（T0378 已修）、Docker 精靈
- `/opt/bat-server` sudo 安裝路徑的實作（T0286）
- macOS 實機驗證（Windows 端無法執行）

## Sub-session 執行指示

1. 讀取本工單 + `BUG-088` + T0378 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG-088 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
