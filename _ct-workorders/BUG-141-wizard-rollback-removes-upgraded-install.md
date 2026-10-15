---
schema_version: 1
schema_kind: bug
id: BUG-141
title: "WSL 精靈升級既有 server 時，install 成功後後段步驟失敗並取消，rollback 會刪掉整個安裝目錄（舊版也沒了），使用者變成沒有 server"
status: FIXING
severity: medium
reproducibility: likely
created_at: "2026-10-16T03:32:02+0800"
updated_at: "2026-10-16T03:32:02+0800"
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
| 可重現 | 推測可重現（T0552 Worker 依程式碼指出，未實測） |
| **狀態** | 🔧 FIXING（T0554，2026-10-16 03:32 開單） |
| 回報者 | T0552 Worker（塔台判定納入 0.6.1-pre.5 批次） |

## 現象

- **情境**：同 distro 已有可用的 bat-server → 重跑 WSL 精靈（升級，T0552 起沿用 port / profile）→ `install-server-bundle` 成功（新 bundle 已換入）→ 之後的步驟（`write-systemd-unit` / `enable-service` / `write-profile` …）失敗 → 使用者按取消。
- **實際（依程式碼）**：`src/components/setup-wizard/steps/wsl/install-server-bundle.ts` 的 `rollback`（T0489）呼叫 `wsl.uninstallBundle(distro, serverInstallPath)`，刪除整個安裝目錄；舊版在 install 時已被換名並刪除（T0552 的 `.bat-old`），因此使用者升級前能用的 server 也一起消失。
- **預期**：升級情境取消時恢復成升級前的安裝（舊 bundle + 原 unit / service 狀態）；首次安裝取消時照舊移除。

## 修正方向（待 T0554 定案）

- 升級時保留 `<root>.bat-old` 直到精靈完成（或成功結束時清除），rollback 換回舊樹；首次安裝（無舊樹）rollback 照舊刪除。
- 同時檢查 write-systemd-unit 的 rollback：T0552 會先停舊 service，取消時應恢復原 unit 內容並重新啟動舊 service。
- SSH 精靈的 rollback 是否同病一併確認。
