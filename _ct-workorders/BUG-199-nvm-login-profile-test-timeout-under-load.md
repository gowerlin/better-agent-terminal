---
schema_version: 1
schema_kind: bug
id: BUG-199
title: "`nvm-login-profile.test.ts` 的真 bash 測試在整套 `test:unit` 負載下逾時 5 s（BUG-195 同類，第五支）"
status: OPEN
severity: low
reproducibility: rare
created_at: "2026-11-02T22:12:53+0800"
updated_at: "2026-11-02T22:12:53+0800"
impact:
  - test-infra
links:
  discovered_in: "第一百零七 session `0.7.3-pre.9` 聯合驗證 @ `5ebcc71f`"
  related: [BUG-195, T0786, T0556]
---
# BUG-199 — `nvm-login-profile.test.ts` 在整套負載下逾時

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響測試；產品行為無關。CI Test gate 若撞到會擋發版） |
| 可重現 | 偶發：整套 1 次中 1 次；單檔 3 / 3 通過（7.2–8.7 s），整套重跑通過 |
| **狀態** | 📂 OPEN |
| 回報者 | 塔台（聯合驗證） |

## 現象

- 預期：`npm run test:unit` 一次全綠。
- 實際：`src/lib/remote-tools/__tests__/nvm-login-profile.test.ts` › `nvm login profile block under real shells (T0556)` › `login shells find nvm's node` › `~/.profile layout: bash -lc finds it; bash -lic loads nvm once (from ~/.bashrc, the block skips)`（第 193 行）`Test timed out in 5000ms`。
- 同一次整套：384 / 385 files、6781 passed；verify-native-modules、typecheck 0 / 0、vite build、legacy 472 / 33 皆綠。
- 單檔重跑 3 次：24 passed，每次 7.2–8.7 s（整檔），單一測試接近 5 s 預設上限。整套重跑：385 / 385、6782 passed。

## 判斷

- 與 BUG-195（T0786）同一類：真子程序（這裡是 `bash -lc` / `bash -lic`）在整套平行負載下均勻變慢 2–3 倍。T0786 修了 4 檔並寫明「第五支以上再出現先回報」，這是第五支。
- 與 T0791（`electron/terminal-blocked-state.ts`）無關，檔案自 T0556 後未變更。

## 修正方向

- 比照 T0786：量測後對該 `describe` 設 per-describe timeout（附量測），或減少每個測試的 shell 呼叫；不改全域 `testTimeout`、不改產品。
- 另可評估：把真子程序測試集中到一個共用 helper / 標記，避免逐檔追加。

## 處理紀錄

- 2026-11-02 22:12 開單（OPEN，low）。`0.7.3-pre.9` 聯合驗證發現；整套重跑綠，不擋 pre.9（比照 BUG-195 首次出現時的處置）。
