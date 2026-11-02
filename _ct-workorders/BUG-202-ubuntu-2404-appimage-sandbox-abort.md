---
schema_version: 1
schema_kind: bug
id: BUG-202
title: "Ubuntu 24.04 預設設定下直接執行 AppImage 會崩潰：AppArmor 擋住 unprivileged user namespace，Chromium 退回 setuid `chrome-sandbox`，而它不是 root 擁有的 4755 → FATAL（SIGTRAP）"
status: OPEN
severity: high
reproducibility: always
created_at: "2026-11-03T02:17:46+0800"
updated_at: "2026-11-03T02:17:46+0800"
impact:
  - linux
  - packaging
links:
  discovered_in: "T0797 / T0798 `linux-acceptance.yml`（正式結論 run `41496512040`）"
  related: [T0797, T0798, T0784, T0781, PLAN-053, D242, D243]
---
# BUG-202 — Ubuntu 24.04 上 AppImage 因 sandbox 設定崩潰

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（Ubuntu 目前的 LTS、預設設定下，直接執行 AppImage 就開不起來） |
| 可重現 | 每次：GitHub `ubuntu-24.04` runner（`apparmor_restrict_unprivileged_userns = 1`，與桌面版預設相同）run `41495143950`、`41496512040` 都重現；L1（Playwright）與 L2（直接 spawn）皆同 |
| **狀態** | 📂 OPEN |
| 回報者 | 塔台（T0797 / T0798 CI 驗收） |

## 現象

- 預期：在 Ubuntu 24.04 桌面上 `chmod +x` 後直接執行（或在檔案管理員點兩下）`BetterAgentTerminal-<版本>.AppImage`，主視窗出現。
- 實際：約 15 s 後程序以 SIGTRAP 結束，沒有視窗、沒有 debug log。stderr：

  ```
  FATAL:sandbox/linux/suid/client/setuid_sandbox_host.cc:172] The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now. You need to make sure that /tmp/.mount_Better…/chrome-sandbox is owned by root and has mode 4755.
  ```
- 加 `--no-sandbox` 後一切正常（L1b PASS：視窗、終端分頁、echo、正常關閉），但 renderer 沒有 sandbox。
- Ubuntu 22.04（`apparmor_restrict_unprivileged_userns = 0`）：預設方式 PASS，renderer sandbox 有開（`NSpid` 三層）。

## 判斷（事實與推論分開）

- 事實：AppImage 的 `AppRun` 不加 `--no-sandbox`；內附 `.desktop` 的 `Exec=AppRun --no-sandbox %U`；`chrome-sandbox` 權限 `-rwxrwxrwx`、非 setuid（AppImage 掛載在 `/tmp/.mount_*`，不可能是 root 4755）。
- 推論：經 `.desktop` 整合啟動（AppImageLauncher / appimaged 等）會帶 `--no-sandbox` 而不受影響；直接執行 AppImage（終端機或檔案管理員點兩下）一定撞到。Electron 一般 AppImage 在 24.04 的共通問題，非 BAT 特有。

## 修正方向（需使用者決定，安全性取捨不同）

1. 附 AppArmor profile（允許 userns），由使用者或安裝說明以 sudo 安裝 → 保留 sandbox，但 AppImage 無安裝步驟，需文件引導。
2. 執行期偵測（userns 被限制且 `chrome-sandbox` 非 root 4755）時自動加 `--no-sandbox` 並提示 → 開得起來，但該情況下失去 renderer sandbox。
3. 只在文件 / 更版重點寫明（以 `--no-sandbox` 啟動或安裝 profile）。

## 處理紀錄

- 2026-11-03 02:17 開單（OPEN，high），依 T0798 回報與正式 run `41496512040`；修法待使用者決定。
