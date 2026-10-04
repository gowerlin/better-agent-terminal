---
schema_version: 1
schema_kind: bug
id: BUG-087
title: WSL 設定精靈「寫入 systemd 使用者服務」步驟失敗：linger 未帶使用者名稱、unit 檔 `~` 不被 systemd 展開、失敗後 bundle 被回滾刪除
status: FIXING
severity: high
reproducibility: always
created_at: "2026-10-04T21:15:17+08:00"
updated_at: "2026-10-04T21:15:17+08:00"
impact:
  - setup-wizard-wsl
links:
  fix_workorder: T0378
  decision: D126
  related: [BUG-071, BUG-072, BUG-086]
---

# BUG-087 — WSL 精靈第 5 步「寫入 systemd 使用者服務」失敗（三個缺陷）

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（WSL 精靈無法完成，BAT WSL remote 對使用者實質不可用；BUG-071 修好後才浮現） |
| 可重現 | 100%：乾淨的 `Ubuntu-24.04`（systemd 已啟用）+ 本機 build `0.5.9-pre.4` |
| **狀態** | ⏳ FIXING（T0378） |
| 回報者 | 使用者（2026-10-04 BUG-071 實機驗收時截圖）+ 塔台環境檢查 |

## 現象

精靈進度 4/9：第 1-4 步 ✓（偵測、選發行版、systemd 檢查、安裝 BAT 伺服器套件），第 5 步「寫入 systemd 使用者服務」✗：

```
Could not enable linger: Could not enable linger: No such device or address
```

警告：`WSL is using NAT networking…`（資訊性，非本 BUG 範圍）；
`Unable to enable linger automatically: Could not enable linger: No such device or address`

## 塔台環境事實（2026-10-04 21:10-21:13，未做程式碼分析，只用 grep 定位）

### 缺陷 A：`loginctl enable-linger` 沒帶使用者名稱

| 指令（以 `gower` 在 `wsl -d Ubuntu-24.04 --` 內執行） | 結果 |
|------|------|
| `loginctl enable-linger` | `Could not enable linger: No such device or address`（ENXIO：`wsl --` 非登入 session，logind 找不到呼叫者 session） |
| `loginctl enable-linger gower` | 成功，**不需 sudo**（polkit 允許自己）；之後 `Linger=yes` |

- 位置：`electron/wsl-systemd.ts:193` `runWsl(distro, ['loginctl', 'enable-linger'], …)`
- ⚠️ 塔台驗證時已對 `gower` **啟用 linger**（`/var/lib/systemd/linger/gower`），重現缺陷 A 前需先 `loginctl disable-linger gower`

### 缺陷 B：unit 檔的 `~` 不會被 systemd 展開

精靈寫出的 `~/.config/systemd/user/bat-server.service`：

```
ExecStart="~/.local/bat-server/bin/bat-server"
Environment="BAT_DATA_DIR=~/.local/share/bat-server"
Environment="BAT_SERVER_DATA_DIR=~/.local/share/bat-server"
```

`systemctl --user status bat-server` → `Loaded: bad-setting`，journal：
`bat-server.service:6: Neither a valid executable name nor an absolute path: ~/.local/bat-server/bin/bat-server`

⇒ 就算 linger 成功，服務也**永遠起不來**（可能就是 BUG-072「bat-server.service timeout」的真正根因）。

- 位置：`src/components/setup-wizard/steps/wsl/install-server-bundle.ts:3`（`INSTALL_PATH = '~/.local/bat-server'`）、`src/components/setup-wizard/steps/wsl/write-systemd-unit.ts:4`（`DATA_DIR = '~/.local/share/bat-server'`）、`:38`（`execStart`）
- 註：`wsl -d X -- <cmd>` 會經過 shell，`~` 在 `mkdir` / `tar` 有展開（塔台以 node `execFile` 實測 `echo ~/.local/bat-server` → `/home/gower/.local/bat-server`），所以問題只在 systemd unit

### 缺陷 C：第 5 步失敗後 bundle 已被刪除，但第 4 步仍顯示 ✓

- 第 5 步失敗後檢查：`~/.local/bat-server` **不存在**，`~/.local/` 是空的（mtime 21:10，表示目錄建立後又被刪除）；全檔案系統找不到 `bat-server` 執行檔
- `install-server-bundle.ts` 有 `rollback()` → `wsl.uninstallBundle()`（`rm -rf`）
- ⇒ UI 顯示第 4 步 ✓，第 5 步提供「我已執行命令，重試」，但重試時 bundle 已經不在。**狀態不一致；重試第 5 步不可能成功**
- 什麼時機觸發了 rollback（第 5 步失敗時自動？）尚未查證 → 交 T0378 查明

## 修復

見 T0378（與 BUG-086 合併修復，D126）。
