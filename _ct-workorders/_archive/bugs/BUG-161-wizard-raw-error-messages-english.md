---
schema_version: 1
schema_kind: bug
id: BUG-161
title: "設定精靈 step 的原始錯誤訊息、復原警告與縮圖列「suggested」仍是英文（BUG-158 範圍外的殘留）"
status: CLOSED
closed_at: "2026-10-18T22:24:09+0800"
closed_by: "使用者（T0663 安裝版 0.7.1-pre.2 自動化驗收）"
fixed_at: "2026-10-18T20:46:12+0800"
fixed_by: T0660
fix_commit: "a5caf04a"
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
| **狀態** | 🚫 CLOSED（T0660 `a5caf04a` 修正；2026-10-18 T0663 安裝版 `0.7.1-pre.2` 自動化驗收 PASS，使用者同意結案） |

## 現象（T0652 回報區）

1. 精靈 step 丟出的原始錯誤訊息，沒有 error-mapper entry 時以 fallback 顯示英文原文：例 `pick-container.ts`「No Docker containers found…」、docker `install-server-bundle.ts`「Choose a Docker container before…」「Unable to inspect Docker container…」、`wsl-systemd-check.ts`「Select a WSL distro before checking systemd.」、`pick-wsl-distro.ts`「BAT requires WSL2…」、`write-systemd-unit.ts`「Failed to write BAT systemd unit」、`ssh/start-server.ts`、`detect-env.ts` preflight reason 等。這些字串同時用於日誌與部分測試比對，需逐一建 error-mapper entry 或 key。
2. `wizard-runner.ts` 的復原警告「Could not finish cleaning up after "<step.title>"…」「Could not undo "<step.title>"…」（含英文 step title）。
3. 縮圖列「+」選單的 `suggested`（`ThumbnailBar.tsx` 3 處）：配置面板的同款標籤已改走 i18n，兩處現在不一致。
4. 各 modal 的 `&times;` 關閉鈕沒有 `aria-label`（無障礙）。
5. `SetupWizardShell` 不顯示選項的 `description`（Docker 選項說明已翻譯但畫面看不到）。
6. （T0656 補）縮圖右鍵選單的「Set as Supervisor」在 zh-TW 介面仍是英文（`e2e-media/worker-badges.png` 可見）。
7. `SshDetails.tsx` / `WslDetails.tsx` 的技術值（`systemd (user)`、`launchd`、`tunnel → localhost:<port>`、`default`）未譯，屬可接受。

## 修正方向

- 另開 i18n 批次：error-mapper entry / key、復原警告、`ThumbnailBar` 的 `suggested`、`aria-label`；第 5 點評估是否要顯示 description。

## 殘留（T0660 回報「範圍外英文字樣」，未開單）

- `MainPanel.tsx` 監督者徽章 `title="Supervisor"`、`TerminalThumbnail.tsx` `title="New notification"`；Agent 面板 Cache History「Clear」/`Clear history`；`SettingsPanel.tsx` 自訂 CLI 刪除鈕 `title="Remove"`；`PathLinker.tsx` `Search (Ctrl+F)`；`CtToast` / `UpdateNotification` 的 × 無 aria-label。
- `ssh/configure-host.ts` `INSTALL_PATH_OPTIONS` 英文 label 含內部工單號字樣（目前未顯示，日後若使用需先改）。
- 少數 code（例 ssh `start-server` 回 `unknown`）仍走 fallback（標題已翻譯、內文英文）。
- （T0663 補）配置卡片展開鈕 `title` / `aria-label` 在 zh-TW 仍是 `Expand` / `Collapse`（`src/components/profiles/ProfileCard.tsx` 第 125–126 行）。
- （T0663 補）`.profile-action-btn` 沒有自訂鍵盤 focus 樣式，只有瀏覽器預設 focus ring（精靈選項按鈕沿用）。

## 實機驗收（T0663，2026-10-18）

- 已安裝 `0.7.1-pre.2`（FileVersion 與隔離實例 `app.getVersion()` 相符），Playwright 隔離實例。
- V4：觸發得了的 5 個錯誤（`docker-daemon-down` / `docker-no-containers` / `wsl-requires-wsl2` / `wsl-home-unresolved` / `permission-denied`）顯示中文；「建議」標籤、「設為監督者」、× 的 `aria-label`、Docker 選項說明皆正確。其餘 24 個 code 需真實安裝 / 主機失敗才會出現，僅 T0660 單元測試涵蓋（NEEDS-HUMAN，不擋結案）
- 使用者 2026-10-18 22:24 同意 CLOSED。
