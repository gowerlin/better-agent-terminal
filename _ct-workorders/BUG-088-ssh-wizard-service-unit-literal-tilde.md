---
schema_version: 1
schema_kind: bug
id: BUG-088
title: SSH 設定精靈寫出的 systemd unit / launchd plist 含字面 `~`，服務無法啟動（BUG-087 缺陷 B 的 SSH 版）
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-04T21:30:23+08:00"
updated_at: "2026-10-04T21:30:23+08:00"
impact:
  - setup-wizard-ssh
links:
  fix_workorder: T0379
  related: [BUG-087, BUG-072]
---

# BUG-088 — SSH 精靈的服務檔含字面 `~`

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（推定：預設 install path 下，SSH 精靈部署的 bat-server 服務永遠起不來；與 BUG-087 缺陷 B 同機制） |
| 可重現 | 推定 100%：選預設 install path `~/.local/bat-server`。**由程式碼閱讀推定，未實機重現** |
| **狀態** | ⏳ FIXING（T0379） |
| 回報者 | T0378 Worker（回報區「殘餘風險 1」，讀碼發現）；塔台 2026-10-04 以 grep 複核 |

## 現象（程式碼證據）

- `src/components/setup-wizard/steps/ssh/configure-host.ts:4`：預設（recommended）install path 選項值為字面 `'~/.local/bat-server'`
- `electron/remote/ssh-start-server.ts` `renderSystemdUnit()`：`ExecStart=${safeInstallPath}/bin/bat-server` ⇒ 寫出 `ExecStart=~/.local/bat-server/bin/bat-server`
  - 同函式註解宣稱「`%h` is resolved by systemd」，但實際寫出的是 `~`，不是 `%h`
  - systemd 對 `ExecStart` 不做 `~` 展開 ⇒ `Neither a valid executable name nor an absolute path` → `bad-setting`（BUG-087 已在 WSL 實證同一訊息）
- `renderLaunchdPlist()`（`ssh-darwin`）：`<string>${installPathXml}/bin/bat-server</string>` 位於 `ProgramArguments` ⇒ 字面 `~/.local/...`。launchd 不經 shell，**疑似**同樣不展開 `~`（待 T0379 確認，Windows 端無法實機驗）
- `StartServerOptions.serverHome`（`verify-ssh-auth` 解析出的遠端 `$HOME`）已傳入，但註解標明「Currently informational」，未用於組路徑
- `/opt/bat-server`（進階選項）為絕對路徑，不受影響
- 經 ssh 遠端 shell 執行的 `mkdir` / `tar` / `cat > ~/.config/...` 會展開 `~`，問題只在服務定義檔內容（同 BUG-087 結論）

## 修復

見 T0379（比照 T0378 / D126：以已解析的 `serverHome` 組絕對路徑）。
