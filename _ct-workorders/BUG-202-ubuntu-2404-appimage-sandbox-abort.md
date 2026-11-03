---
schema_version: 1
schema_kind: bug
id: BUG-202
title: "Ubuntu 24.04 預設設定下直接執行 AppImage 會崩潰：AppArmor 擋住 unprivileged user namespace，Chromium 退回 setuid `chrome-sandbox`，而它不是 root 擁有的 4755 → FATAL（SIGTRAP）"
status: CLOSED
severity: high
reproducibility: always
created_at: "2026-11-03T02:17:46+0800"
updated_at: "2026-11-03T12:35:20+0800"
fixed_at: "2026-11-03T03:06:07+0800"
closed_at: "2026-11-03T12:35:20+0800"
closed_reason: "交付版 v0.7.4-pre.2 linux-acceptance 41578537967 實測通過"
fix_commit: d773cb6780ac176e6fa16000fa67a49eb8f7eb69
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
| **狀態** | 🚫 CLOSED（T0799；交付版 `v0.7.4-pre.2` linux-acceptance `41578537967` 驗收通過） |
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
- 2026-11-03 02:21 → FIXING：使用者選「偵測後自動加 `--no-sandbox`」（D244），派 T0799。
- 2026-11-03 03:06 → FIXED：T0799 `d773cb67`（＋`52b1a91c` LF、`a682ea7b` / `792db8e9` 驗收 spec、`bdcd5747` / `c7cfabda` docs，分支 `ct/T0799`，交塔台合併）。desktop-build `41502529486` 的 AppImage 在 linux-acceptance `41504962084` / `41505876807`：22.04 PASS（sandbox 開）、24.04 WARN `sandbox auto-disabled (BUG-202 fallback)`（不再崩潰）。待合併後交付版驗收再 CLOSED。

## T0799 結果

- 修法：`afterPack` 把 AppImage 的 `BetterAgentTerminal` 換成 `/bin/sh` 啟動器、Electron 二進位改名 `BetterAgentTerminal.bin`（`scripts/appimage-sandbox-launcher.cjs`）。只在「userns 用不了（`apparmor_restrict_unprivileged_userns = 1` 且二進位沒被套 AppArmor profile；否則 `unshare -Ur true` 失敗）＋`chrome-sandbox` 不是 root setuid＋參數沒有 `--no-sandbox`＋非 `ELECTRON_RUN_AS_NODE`」時加 `--no-sandbox`，stderr 一行固定字串、debug log `[WARN] [sandbox] Chromium sandbox auto-disabled …`（`electron/linux-sandbox-fallback.ts`）。
- 注入點：main.ts `appendSwitch` 太晚（Chromium 在 JS 前決定 sandbox；BUG-202 崩潰時連 debug log 都沒寫），所以用啟動前的包裝層。
- 驗證：22.04 L1 / L2 PASS、renderer sandbox 開、命令列無 `--no-sandbox`；24.04 L1 WARN（視窗 / 終端 / echo 過、0 個 `[CRASH]`）、L2 PASS。文件 `docs/agent-guide/linux-appimage-sandbox.md`（含 AppArmor profile 範例，未實測）。

## 結案紀錄

- 2026-11-03 12:35 CLOSED：交付版 `v0.7.4-pre.2`（pre-release run `41577071236`）的 linux-acceptance run `41578537967`（`-f version=0.7.4-pre.2`）：ubuntu-22.04 verdict **PASS**（L1 / L2 PASS，sandbox 開、未自動降級）；ubuntu-24.04 verdict **WARN**，`verdictReason` 只有 `L1: sandbox auto-disabled (BUG-202 fallback)`，L2 PASS。符合結案條件（22.04 PASS / 24.04 WARN auto-disabled）。
