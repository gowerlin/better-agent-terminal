---
schema_version: 1
schema_kind: bug
id: BUG-141
title: "WSL 精靈升級既有 server 時，install 成功後後段步驟失敗並取消，rollback 會刪掉整個安裝目錄（舊版也沒了），使用者變成沒有 server"
status: FIXED
severity: medium
reproducibility: likely
created_at: "2026-10-16T03:32:02+0800"
updated_at: "2026-10-16T04:15:34+0800"
impact:
  - wsl-wizard
  - server-bundle
links:
  discovered_in: "T0552 回報區「殘餘風險 1」"
  related: [T0552, T0489, BUG-138, BUG-139]
---

# BUG-141 — 精靈升級後段失敗取消，rollback 移除整個安裝

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（只在「升級成功 → 之後步驟失敗 → 使用者取消」時發生；結果是原本能用的 server 消失，需重跑精靈） |
| 可重現 | 推測可重現（T0552 Worker 依程式碼指出，未實測）；T0554 以單元測試確認舊 rollback 路徑（`uninstallBundle` / `removeUnit`），SSH 同病 |
| **狀態** | ✅ FIXED（T0554，2026-10-16 04:15；WSL 實機取消驗證 PASS，待塔台驗收） |
| 回報者 | T0552 Worker（塔台判定納入 0.6.1-pre.5 批次） |

## 現象

- **情境**：同 distro 已有可用的 bat-server → 重跑 WSL 精靈（升級，T0552 起沿用 port / profile）→ `install-server-bundle` 成功（新 bundle 已換入）→ 之後的步驟（`write-systemd-unit` / `enable-service` / `write-profile` …）失敗 → 使用者按取消。
- **實際（依程式碼）**：`src/components/setup-wizard/steps/wsl/install-server-bundle.ts` 的 `rollback`（T0489）呼叫 `wsl.uninstallBundle(distro, serverInstallPath)`，刪除整個安裝目錄；舊版在 install 時已被換名並刪除（T0552 的 `.bat-old`），因此使用者升級前能用的 server 也一起消失。
- **預期**：升級情境取消時恢復成升級前的安裝（舊 bundle + 原 unit / service 狀態）；首次安裝取消時照舊移除。

## 修正方向（待 T0554 定案）

- 升級時保留 `<root>.bat-old` 直到精靈完成（或成功結束時清除），rollback 換回舊樹；首次安裝（無舊樹）rollback 照舊刪除。
- 同時檢查 write-systemd-unit 的 rollback：T0552 會先停舊 service，取消時應恢復原 unit 內容並重新啟動舊 service。
- SSH 精靈的 rollback 是否同病一併確認。

## 修正（T0554）

- 精靈安裝保留舊樹於 `<root>.bat-old`；rollback 依安裝結果處理：升級 → 換回舊樹、舊 server 原本在跑就再啟動；首次安裝 → 照舊刪除；疊在非 BAT 目錄 / 安裝失敗 → 不刪。精靈完成時 `WizardStep.finalize` 刪 `.bat-old`。
- WSL write-systemd-unit 在挑 port 前取 unit / service 快照，取消時寫回舊 unit 與 enabled 狀態；SSH start-server 備份 unit / plist 為 `.bat-prev`，取消時換回。
- 中途關掉 BAT：下次安裝會先把只剩 `.bat-old` 的安裝換回；`.bat-old` 不是 bundle 安裝時中止、不刪。
- WSL 實機（Ubuntu-24.04）：注入 fetch-fingerprint 失敗 → 取消 → 原安裝樹（同 inode）、unit、9877、指紋、service active 全部恢復；正常升級後無 `.bat-old`，smoke 13/13。細節見 T0554 回報區。
