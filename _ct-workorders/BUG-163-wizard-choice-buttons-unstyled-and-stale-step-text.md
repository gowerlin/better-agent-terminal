---
schema_version: 1
schema_kind: bug
id: BUG-163
title: "設定精靈的選項按鈕用 Tailwind class，但 App 沒載入 Tailwind，顯示成白底原生按鈕；步驟說明過時、含內部用語"
status: CLOSED
closed_at: "2026-10-18T22:24:09+0800"
closed_by: "使用者（T0663 安裝版 0.7.1-pre.2 自動化驗收）"
fixed_at: "2026-10-18T19:59:45+0800"
fixed_by: T0658
fix_commit: "9d8e1985"
severity: medium
reproducibility: always
created_at: "2026-10-18T19:47:34+0800"
impact:
  - remote-setup-wizard
  - ui
links:
  discovered_in: "T0656（W3 截圖 `site/public/media/wizard-*.png`，回報區「給塔台的後續建議」第 1 點；塔台檢視 wizard-ssh.png 確認）"
  related: [T0656, T0652, BUG-158, BUG-161, T0658]
---

# BUG-163 — 精靈選項按鈕沒有樣式、步驟說明過時

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（每個遠端精靈第一步都看得到；網站截圖也拍到） |
| 可重現 | 必現 |
| **狀態** | 🚫 CLOSED（T0658 `9d8e1985` 修正；2026-10-18 T0663 安裝版 `0.7.1-pre.2` 自動化驗收 PASS，使用者同意結案） |

## 現象

- `src/components/setup-wizard/SetupWizardShell.tsx` 的選項按鈕、輸入框等用 Tailwind class（例 `rounded-md border border-sky-600 px-3 py-2 text-sm text-sky-100 …`，第 370 / 379 / 397 / 458 / 476 行附近），但 App 沒有載入 Tailwind → 實際顯示成白底黑字的原生按鈕，按鈕之間沒有間距（塔台檢視 `site/public/media/wizard-ssh.png`）。
- 步驟說明過時：SSH 第一步「選擇主機、帳號、port、金鑰與安裝路徑」，實際只問主機（T0646 / T0653 查證：安裝路徑固定、帳號與金鑰來自 `~/.ssh/config`）；第二步「執行 BAT_AUTH_OK probe 並偵測遠端 OS 與家目錄」是內部用語。WSL / Docker 的步驟說明可能有同類問題。
- 預期：按鈕與輸入框與 App 其他對話框一致（深色主題、間距、hover / focus）；步驟說明對得上實際行為、使用者看得懂。

## 實機驗收（T0663，2026-10-18）

- 已安裝 `0.7.1-pre.2`（FileVersion 與隔離實例 `app.getVersion()` 相符），Playwright 隔離實例。
- V5：SSH / WSL / Docker 第一步選項按鈕 class `profile-action-btn bat-wizard-choice`、深色背景、間距 8px、hover / focus 有變化；舊步驟說明字樣 0 個（安裝版 asset 也確認）
- 使用者 2026-10-18 22:24 同意 CLOSED。
