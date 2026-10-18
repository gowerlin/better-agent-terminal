---
schema_version: 1
schema_kind: bug
id: BUG-161
title: "設定精靈 step 的原始錯誤訊息、復原警告與縮圖列「suggested」仍是英文（BUG-158 範圍外的殘留）"
status: OPEN
severity: low
reproducibility: always（zh-TW 介面，遇到對應錯誤時）
created_at: "2026-10-18T19:12:43+0800"
impact:
  - i18n
  - remote-setup-wizard
links:
  discovered_in: "T0652（回報區「範圍外英文字樣」第 1–6 點）"
  related: [BUG-158, T0652]
---

# BUG-161 — 精靈原始錯誤訊息等英文殘留

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響錯誤畫面的語言） |
| 可重現 | 必現（zh-TW 介面遇到對應錯誤時） |
| **狀態** | 📂 OPEN（未排程） |

## 現象（T0652 回報區）

1. 精靈 step 丟出的原始錯誤訊息，沒有 error-mapper entry 時以 fallback 顯示英文原文：例 `pick-container.ts`「No Docker containers found…」、docker `install-server-bundle.ts`「Choose a Docker container before…」「Unable to inspect Docker container…」、`wsl-systemd-check.ts`「Select a WSL distro before checking systemd.」、`pick-wsl-distro.ts`「BAT requires WSL2…」、`write-systemd-unit.ts`「Failed to write BAT systemd unit」、`ssh/start-server.ts`、`detect-env.ts` preflight reason 等。這些字串同時用於日誌與部分測試比對，需逐一建 error-mapper entry 或 key。
2. `wizard-runner.ts` 的復原警告「Could not finish cleaning up after "<step.title>"…」「Could not undo "<step.title>"…」（含英文 step title）。
3. 縮圖列「+」選單的 `suggested`（`ThumbnailBar.tsx` 3 處）：配置面板的同款標籤已改走 i18n，兩處現在不一致。
4. 各 modal 的 `&times;` 關閉鈕沒有 `aria-label`（無障礙）。
5. `SetupWizardShell` 不顯示選項的 `description`（Docker 選項說明已翻譯但畫面看不到）。
6. `SshDetails.tsx` / `WslDetails.tsx` 的技術值（`systemd (user)`、`launchd`、`tunnel → localhost:<port>`、`default`）未譯，屬可接受。

## 修正方向

- 另開 i18n 批次：error-mapper entry / key、復原警告、`ThumbnailBar` 的 `suggested`、`aria-label`；第 5 點評估是否要顯示 description。
