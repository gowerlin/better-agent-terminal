---
schema_version: 1
schema_kind: bug
id: BUG-167
title: "tests/profile-manager-migration.test.ts 有 2 項斷言失敗（docker-linux、ssh-linux 的 metadata 比期望多了後來新增的 profile 欄位）；此測試不在 test:unit，一直沒被發現"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-10-21T19:17:17+0800"
updated_at: "2026-10-21T19:50:09+0800"
impact:
  - tests
  - remote-profiles
links:
  discovered_in: "T0677 Worker（2026-10-21，去識別化驗證時順跑 `tests/` 底下不在 `test:unit` 的已改檔）"
  related: [T0677, T0678]
---

# BUG-167 — profile-manager 遷移測試有 2 項斷言失敗

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（目前只確認測試失敗；遷移後的 profile 內容是否正確待 T0678 確認） |
| 可重現 | 一定（每次執行都失敗） |
| **狀態** | ✅ FIXED（T0678，commit `d90b3b50`） |
| 回報者 | T0677 Worker |

## 現象

- 執行 `npx tsx tests/profile-manager-migration.test.ts`：10 passed / 2 failed。失敗的是 docker-linux、ssh-linux 兩個情境的 metadata 斷言，實際值比期望多了後來新增的 profile 欄位。
- T0677 改動前的 HEAD 版本同樣 10 / 2，所以是既有問題，不是去識別化造成的。
- 這個檔案用 `tsx` 直接執行，不在 `npm run test:unit`（vitest）範圍，CI 也沒有跑，所以欄位新增時沒有人發現。

## 塔台初判（推論，待 T0678 證實）

- 多半是測試沒有跟上：profile 加了新欄位，遷移後的 metadata 本來就會帶這些欄位，斷言還停在舊版。
- 也可能是遷移邏輯把不該有的欄位帶進去。要先查清楚多出來的欄位是哪張工單加的、遷移後應不應該有，才能決定改斷言還是改程式。

## 修正方向

- T0678：查清欄位來源與預期行為；是預期行為就更新斷言，是遷移錯誤就先問塔台再修。
- 另議：`tests/` 底下用 `tsx` 執行的其他測試是否也有沒被發現的失敗、要不要納入 `test:unit` 或 CI（T0678 只盤點、不修）。

## 修正結果（T0678）

- 失敗的不是遷移（`migrateProfile` 4 項一直通過），而是 `extractTargetOSMeta` 的投影斷言：docker-linux 多 `dockerMounts`（T0277，`43d6eea4`），ssh-* 多 `serverHome`（T0282，`462d4f88`）。兩張工單都明訂要把欄位加進 `TargetOSMetadata` 與 `extractTargetOSMeta`（translator 需要），判定為預期行為，測試沒跟上。
- 只改 `tests/profile-manager-migration.test.ts`（commit `d90b3b50`）：斷言列出完整欄位，另加 dockerMounts 直通一項與 ssh-darwin 的 `serverHome` 檢查。`npx tsx tests/profile-manager-migration.test.ts`：13 passed / 0 failed。
- `tests/` 底下其他不在 `test:unit` 的測試另有失敗與逾時，盤點表見 T0678 回報區（本單不修）。
