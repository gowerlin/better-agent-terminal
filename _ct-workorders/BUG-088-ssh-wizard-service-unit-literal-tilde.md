---
schema_version: 1
schema_kind: bug
id: BUG-088
title: SSH 設定精靈寫出的 systemd unit / launchd plist 含字面 `~`，服務無法啟動（BUG-087 缺陷 B 的 SSH 版）
status: FIXED
fix_commits: [a1ee31f]
fixed_at: "2026-10-04T21:50:29+08:00"
severity: high
reproducibility: always
created_at: "2026-10-04T21:30:23+08:00"
updated_at: "2026-10-04T21:52:56+08:00"
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
| **狀態** | ✅ FIXED（T0379 `a1ee31f`；待實際 SSH 主機驗收，macOS 未實機） |
| 回報者 | T0378 Worker（回報區「殘餘風險 1」，讀碼發現）；塔台 2026-10-04 以 grep 複核 |

## 現象（程式碼證據）

- `src/components/setup-wizard/steps/ssh/configure-host.ts:4`：預設（recommended）install path 選項值為字面 `'~/.local/bat-server'`
- `electron/remote/ssh-start-server.ts` `renderSystemdUnit()`：`ExecStart=${safeInstallPath}/bin/bat-server` ⇒ 寫出 `ExecStart=~/.local/bat-server/bin/bat-server`
  - 同函式註解宣稱「`%h` is resolved by systemd」，但實際寫出的是 `~`，不是 `%h`
  - systemd 對 `ExecStart` 不做 `~` 展開 ⇒ `Neither a valid executable name nor an absolute path` → `bad-setting`（BUG-087 已在 WSL 實證同一訊息）
- `renderLaunchdPlist()`（`ssh-darwin`）：`<string>${installPathXml}/bin/bat-server</string>` 位於 `ProgramArguments` ⇒ 字面 `~/.local/...`。launchd 不經 shell，**疑似**同樣不展開 `~`（待 T0379 確認，Windows 端無法實機驗）
- `StartServerOptions.serverHome`（`verify-ssh-auth` 解析出的遠端 `$HOME`）已傳入，但註解標明「Currently informational」，未用於組路徑
- `/opt/bat-server`（進階選項）為絕對路徑，不受影響
- ~~經 ssh 遠端 shell 執行的 `mkdir` / `tar` / `cat > ~/.config/...` 會展開 `~`，問題只在服務定義檔內容（同 BUG-087 結論）~~ **更正（T0379）**：SSH 路徑把這些路徑放在**單引號**內，bash 不展開引號內的 `~` ⇒ bundle 與服務檔實際落在 `$HOME/~/...`（字面 `~` 目錄）。見下方「更正」

## 修復

見 T0379（比照 T0378 / D126：以已解析的 `serverHome` 組絕對路徑）。

## 更正：開單時的錯誤假設（T0379 查證，2026-10-04 21:52 塔台複核）

開單時塔台沿用 BUG-087 的結論，認為「經遠端 shell 的指令會展開 `~`」。這對 WSL 成立（`wsl -- mkdir -p ~/...`，未加引號），**對 SSH 不成立**：

| 呼叫 | 實際行為 |
|------|---------|
| 上傳（`ssh-bundle-uploader.ts`）`mkdir -p '~/.local/bat-server' && cd '~/.local/bat-server' && tar xz` | 在 `$HOME` 下建立字面 `~` 目錄，bundle 落在 `$HOME/~/.local/bat-server` |
| 寫 unit `cat > '~/.config/systemd/user/bat-server.service'` | unit 落在 `$HOME/~/.config/...`，systemd 根本找不到（比 `bad-setting` 更早失敗） |
| launchd `launchctl load -w '~/Library/LaunchAgents/...'` | 相對 cwd 的 `$HOME/~/Library/...` |

塔台實測（`Ubuntu-24.04`）：`bash -c "cd /tmp && mkdir -p '~/.local/x'"` → 產生 `./~/.local/x`。

launchd 結論（T0379 查 `launchd.plist(5)`）：`ProgramArguments` 對應 `execvp(3)` 參數，**不展開 `~`**。

## FIXED 證據（2026-10-04 21:52 UTC+8，塔台驗收 T0379）

- 修復 commit：`a1ee31f`（8 files）：上傳目標、systemd unit / launchd plist 內容與**檔案位置**全改為以 `serverHome` 展開的絕對路徑；`serverHome` 無效時在任何 ssh 指令前報錯
- 塔台重跑：`npm run test:unit` **57 files / 794 passed**（749 → 794）、`npx vite build` exit 0、`npx tsc --noEmit` **40**（= baseline）、舊 node:test `tests/ssh-start-server.test.ts` 19/19
- Worker 本機 runtime：`systemd-analyze --user verify` 新 unit 僅剩「執行檔不存在」（預期），舊 unit 重現 `Neither a valid executable name nor an absolute path`
- **待實機**：實際 SSH 主機跑 SSH 精靈；macOS（launchd）無法於本機驗證

## ⚠️ 給曾用舊版跑過 SSH 精靈的使用者

遠端 `$HOME` 下可能殘留字面 `~` 目錄（內含 bundle 與 unit）。手動清理：`rm -rf "$HOME/~"` —— **務必加引號**；裸 `rm -rf ~` 會刪除整個家目錄。
