---
schema_version: 1
schema_kind: plan
id: PLAN-060
title: "macOS 安裝檔改用 Apple Developer ID 簽章與公證（Electron 42 起未簽章 app 不顯示系統通知）"
status: IDEA
priority: low
created_at: "2026-11-02T16:55:52+0800"
links:
  source: "T0783 查證（pre-release.yml 不簽章、repo 無 Apple secret）；T0781 / T0784（Electron 42+ UNNotification）；D224"
  related: [PLAN-053, T0783, T0784, D224]
---

# PLAN-060 — macOS Developer ID 簽章與公證

## 動機

- 本 fork 的 macOS 安裝檔一律只有 ad-hoc 簽章、未公證：`pre-release.yml` 沒有簽章設定，`release.yml` 有簽章步驟但 repo 沒有任何 Apple secret（T0783 查證，`gh secret list` 為空；T0778 實測 `Signature=adhoc`、`spctl` rejected）。
- Electron 42 起 macOS 通知改用 `UNNotification`，**未簽章的 app 不顯示系統通知**、`Notification` 發 `failed` 事件（T0781）。T0784 把 BAT 升到 Electron 45 後，macOS 使用者收不到 BAT 的系統通知；BAT 自己的 toast、⚠️ 與分頁標示不受影響。T0784 已讓 `failed` 事件寫 `[notification] failed to show:` 日誌。
- 使用者決定先接受，寫進更版重點的已知事項，另開本 PLAN 記錄（D224）。

## 方向（未研究）

- 需要 Apple Developer Program 帳號與 Developer ID Application 憑證；憑證身分要與 `package.json` `build.mac.identity` 一致。
- repo secret：`APPLE_CERTIFICATE_P12`、`APPLE_CERTIFICATE_PASSWORD`（簽章），`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`（公證）。`release.yml` 與 `desktop-build.yml`（`mac_sign=auto`、`mac_notarize`）已會用；`pre-release.yml` 要補同樣的步驟。
- 驗收：`macos-acceptance.yml` 確認 `codesign` 為 Developer ID、`spctl` accepted、通知顯示。

## 觸發條件

- 使用者回報 macOS 收不到通知且需要它；或要上架 / 讓 Gatekeeper 不再擋。

## 狀態

- IDEA（D224）。
