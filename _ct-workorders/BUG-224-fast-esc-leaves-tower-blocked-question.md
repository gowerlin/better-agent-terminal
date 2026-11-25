---
schema_version: 1
schema_kind: bug
id: BUG-224
title: "AskUserQuestion 選單出現後極快按 Esc，晚到的 `PermissionRequest` hook 把已清除的 `blocked: question` 又設回；Esc 中斷回合後沒有後續 hook，塔台分頁卡在 `question`（⚠️、通知保護誤觸發）直到下次在分頁打字"
status: FIXED
severity: medium
reproducibility: "rare for humans（選單出現約 0.1 s 內按 Esc；T0923 驅動自動化觸發 1 次，兩個 hook 都到達後再 Esc 的 5 次皆正常）"
created_at: "2026-11-25T23:02:32+08:00"
updated_at: "2026-11-25T23:15:40+08:00"
impact:
  - tower
  - notify-hold
links:
  discovered_in: "T0923 M-9 前提步驟（`ct620-accept/results/M-9.md`〈BAT 端發現〉）"
  related: [T0923, T0790, T0788, BUG-196, BUG-197, T0918, PLAN-069]
---
# BUG-224 — 極快 Esc 後塔台卡在 `blocked: question`

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（卡住期間 Worker `--submit` 通知與待辦分頁回答都被保留，使用者不在塔台分頁打字就不送；CT 6.2.0 R6 讓暫停一律開原生選單，且要從待辦分頁回答時要先按 Esc，曝露增加） |
| 可重現 | 人手少見：選單出現後約 0.1 s 內按 Esc |
| **狀態** | ✅ FIXED（T0926 `2781c81e`；合併工單 T0927；待 `0.8.0-exp.2` 補跑實機驗證，D358） |
| 回報者 | T0923 Worker（自動化驗收） |
| 影響版本 | `0.8.0-exp.1`（`main` `402c9648`）；判斷邏輯自 T0590 / T0790 起未變，推定既有問題、非 T0922 回歸 |

## 現象（預期 vs 實際）

- **預期**：使用者按 Esc 關掉 AskUserQuestion 選單後，分頁離開 `blocked`，縮圖不顯示 ⚠️，被保留的通知照規則送出。
- **實際**（debug log，UTC）：
  - `14:31:05.872` `blocked reason=question (hook ask-user-question)`
  - `14:31:05.972` `cleared (user input)`（Esc）
  - `14:31:05.983` `blocked reason=question (hook permission-request tool=AskUserQuestion)`（較晚到的 hook 又設回）
  - Esc 中斷回合，claude 不再送 `stop` 等 hook；分頁停在 `{"busy":true,"blockedReason":"question"}`、縮圖 ⚠️，畫面已無選單，直到 `14:34:07` 下一次在分頁打字才清除（約 3 分鐘）。
- 與 T0790（晚到的「清除」以 hook 啟動時間 `at` 判斷）方向相反：這裡是晚到的「設定」蓋掉使用者輸入造成的清除。

## 重現

契約 2 塔台開 AskUserQuestion 選單，在選單出現約 0.1 s 內按 Esc（兩個 hook 都到達後才 Esc 不會發生）。

## 可能方向（未查證）

- 設定類 hook（`ask-user-question` / `permission-request`）也比對 `at`：`at` 早於最後一次使用者輸入（或最後一次清除）的就不設回。注意 🔴 不得以牆鐘比較（T0790 規則：`process.hrtime` ns），使用者輸入時間要換成同一時基或改以事件順序判斷。
- 或：Esc（`\x1b` 單鍵）清除後短時間內同一 reason 的晚到設定忽略。

## 證據

- `<使用者資料夾>/AppData/Local/ct620-accept/results/M-9.md`〈BAT 端發現〉、`M-9/00-stuck-question-after-esc.png`、`stuck-attention.json`、`stuck-screen.txt`、`S1-logs/debug-20261125-215214.log`（本機，不進 repo）。

## 處置

- 2026-11-25 23:15 T0926 FIXED（`2781c81e`）：一個 AskUserQuestion 有兩個 hook（`PreToolUse` 同步、`PermissionRequest` 與選單並行），使用者輸入 / 滑鼠清除 `question` 時若只回報了一個，記下「已回答的提示」；之後 5 s 內（單調時鐘）同一提示晚到的另一個 hook 不設回（反序時以兩個 hook 的 `at` 判斷）；真正的新提示先到 `ask-user-question` 照常 `blocked`。單元測試 14 個（突變後 9 個失敗）、既有 T0590 / T0790 / T0791 / T0918 / T0757 測試未改全過、test:unit 9046、legacy 472、build、typecheck 0 / 0。實機（T0926〈待實機〉5 步）併入 `0.8.0-exp.2` 補跑。
- 2026-11-25 23:04 使用者裁示 U-10：A —— `0.8.0-pre.4` 發版前修，修正單 T0926（D355）。
