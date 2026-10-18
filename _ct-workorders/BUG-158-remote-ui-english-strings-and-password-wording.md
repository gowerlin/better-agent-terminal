---
schema_version: 1
schema_kind: bug
id: BUG-158
title: "遠端設定相關畫面殘留英文字樣、缺 zh-TW key；SSH 認證失敗訊息提到「帳號密碼」，但 BAT 無法用密碼登入"
status: FIXED
fixed_at: "2026-10-18T19:12:18+0800"
fixed_by: T0652
fix_commit: "15a792d4"
severity: low
reproducibility: always
created_at: "2026-10-18T18:33:43+0800"
impact:
  - i18n
  - remote-setup-wizard
links:
  discovered_in: "T0646（回報區「給塔台的後續建議」第 6、7 點）"
  related: [T0646, BUG-156, BUG-157]
---

# BUG-158 — 遠端畫面的英文字樣與錯誤文案

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（不影響功能；誤導使用者以為可用密碼） |
| 可重現 | 必現（zh-TW 介面） |
| **狀態** | ✅ FIXED（T0652 `15a792d4` 產品 / `8347b3d4` 網站：三語各補 48 個 key、SSH 認證失敗文案改指向金鑰 / ssh-agent、Docker 埠錯誤 entry；殘留的精靈原始錯誤訊息等 → BUG-161） |

## 現象（T0646 程式碼追蹤，清單待修正工單逐項確認）

- 英文字樣：Docker 精靈模式按鈕「Create new / Use existing」、WSL 發行版選單、WSL1 / systemd 警告、精靈 modal 標題「Add WSL / SSH Profile」、設定卡 tooltip（Open / Edit / Delete）、「Pin expected fingerprint」。
- zh-TW 缺 `profiles.legacyTargetOsPrompt`（舊設定檔遷移 banner 只有英文）。
- SSH 認證失敗的 zh-TW 文案提到「帳號密碼」，但 SSH 一律 `BatchMode=yes`（`electron/remote/ssh-args.ts` `buildBaseSshArgs`），只能用金鑰 / ssh-agent。
- 預期：zh-TW 介面不出現上述英文；SSH 認證失敗文案指向金鑰 / ssh-agent / `~/.ssh/config`。

## 修正方向

- 字串改走 i18n，補齊各語系 key；修正 SSH 認證失敗文案。修正後同步網站 `/remote/` 裡引用到的 UI 字樣。
