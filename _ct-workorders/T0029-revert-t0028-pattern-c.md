---
id: T0029
title: Revert T0028 (Pattern C) — 零收益 + padding regression
type: hotfix-revert
status: BLOCKED
priority: high
created: 2026-04-11 21:50 (Asia/Taipei)
started: 2026-04-11 22:02 (Asia/Taipei)
completed: 2026-04-11 22:07 (Asia/Taipei)
estimated: 10-15 min
depends_on: []
blocks: [T0030]
parent_bug: BUG-008
related_commits:
  - 37bccdf "fix(ui): restore overlay position on terminal scroll (BUG-008)"
---

# T0029 — Revert T0028 (Pattern C)

## 背景

T0028 於 2026-04-11 21:15 派發並 commit 為 `37bccdf`，策略為 **Pattern C — scroll dismiss overlay**（意圖：捲動時直接 dismiss overlay 以繞開定位追蹤問題）。

塔台 21:26 checkpoint 記錄為「✅ DONE zero rollback · L021 新架構首次實戰成功」。

### 21:44 使用者 dogfood 回報（BUG-008 復活 + 新 regression）

使用者提供四張截圖確認兩個問題：

1. **BUG-008 ghost render 沒修到** —— 底部浮出的 floating "New Terminal" panel 還在，和 T0028 前視覺完全一樣
2. **T0028 引入 extra padding regression** —— 右上角 / 右側中段 / 左側工單列表附近多出不該有的 padding 空白

**關鍵釐清**（使用者原話）：
> 「此處是原來殘影，其他紅框是多出來的 padding」

換句話說，T0028 是「**零收益 + 負作用**」：原本的 bug 沒修到，還多產生一個 regression。

### 截圖路徑（參考用，不進 repo）

- `D:\Downloads\2026-04-11_214600.png`（有紅框標示版）
- 未標示版已在塔台 session 中 inline

## 目標

Revert commit `37bccdf`，回到 T0028 前的 baseline，清掉 padding regression，並確認 BUG-008 的實測狀態（回到 pre-T0028 baseline = 預期行為）。

本工單**不修 BUG-008 本身**，僅清除 T0028 的副作用。真正的治本由後續 T0030（Investigation）+ T0031（Fix）處理。

## 執行步驟

```bash
# 1. 確認 commit 位置
git log --oneline -5

# 2. 確認 working tree 乾淨
git status

# 3. Revert（不自動 edit commit message，等 step 4 寫 message）
git revert 37bccdf --no-edit

# 4. 驗證 revert 結果
git log --oneline -3
git diff HEAD~1 HEAD --stat

# 5. 編譯驗證（不可跳過）
npx vite build

# 6. 啟動 dev 驗證（手動測試）
npm run dev
```

## 手動驗證清單（Worker 執行後填寫結果）

啟動 app 後，對照 T0028 前的預期 baseline，檢查以下兩點：

### 驗證 A：Extra padding 是否消失？

- 動作：開啟主視窗，觀察右側 / 工單列表周圍
- 預期：padding 消失（回到 T0028 前狀態）
- 實測：`[ PASS / FAIL / UNKNOWN ]`
- 備註：___

### 驗證 B：BUG-008 ghost render 是否回到 pre-T0028 狀態？

- 動作：捲動終端 / 切換 tab / 開關 context menu
- 預期：ghost 還會出現（因為 T0028 本來就沒修到），但**頻率和範圍應該與 T0028 前相同**（不更嚴重）
- 實測：`[ SAME / WORSE / BETTER / UNKNOWN ]`
- 備註：___

## 決策樹（依驗證結果分流，Worker 必須按此回報）

| 驗證 A | 驗證 B | 結論 | 後續動作 |
|--------|--------|------|---------|
| PASS | SAME | T0028 是 padding regression 的唯一來源，BUG-008 回到原始 baseline | ✅ **正常完成**，可 commit + push，工單 DONE |
| PASS | WORSE | T0028 **部分** 有效（反而壓住了某些 ghost），revert 後更糟 | ⚠️ **停工回報塔台**，不 push，讓塔台重新對齊策略 |
| FAIL | SAME | Padding **不是** T0028 引入的，另有來源（可能是 T0026 scrollbar styling） | ⚠️ **停工回報塔台**，保留 revert commit，塔台決定是否再往前 revert |
| FAIL | WORSE | 最糟情況，revert 沒解 padding 且 ghost 更嚴重 | 🚨 **停工回報塔台**，可能需要 `git revert --abort` |
| UNKNOWN | * | 無法判斷 | ⚠️ **停工回報塔台**，描述看到的實際狀況 |

**絕對不可**：發現 revert 沒解 padding 就自己繼續 hack、或自己再往前 revert。L019 教訓：假設集必須包含「根因不在這裡」的可能。

## Commit 規範

**若驗證 A=PASS 且 驗證 B=SAME**（正常 revert 通過）：

```
revert: 37bccdf T0028 Pattern C (BUG-008 ghost unchanged + padding regression)

T0028 attempted "Pattern C — scroll dismiss overlay" but dogfood
verification showed:
- BUG-008 ghost render remained (no effect on original bug)
- Introduced extra padding regression on right side + workorder list

Net result: zero benefit + negative side effect. Reverting.

Real BUG-008 root cause investigation deferred to T0030.

Refs: T0029, BUG-008
```

**檔案範圍限制**：
- 允許：revert 產生的檔案（T0028 影響範圍）+ `_ct-workorders/T0029-revert-t0028-pattern-c.md`
- 禁止：修改 `_ct-workorders/_tower-state.md`（**L021**）
- 禁止：新增 `_ct-workorders/_learnings.md` 條目（本工單無學習，塔台未預寫）

## 回報區（Worker 執行後填寫）

### 執行摘要

已執行 `git revert 37bccdf --no-edit`，建立 revert commit `80d13ef`，回滾了 `src/components/TerminalPanel.tsx` 的 T0028 Pattern C 變更（15 行刪除）。`npx vite build` 已通過，`npm run dev` 也成功啟動 Vite + Electron。由於目前執行環境無法完成 GUI 視覺驗證，手動驗證 A/B 維持 UNKNOWN，依決策樹停工回報塔台。

### Git 操作記錄

```
# git log --oneline -5
d434ce9 fix(workorder): 更新工單狀態為 DONE，新增塔台追認紀錄
3dd2500 chore(tower): T0028 closure + L019/L020/L021 carry
37bccdf fix(ui): restore overlay position on terminal scroll (BUG-008)
b2679f7 chore(tower): T0027 investigation closure
1e02e25 docs(reports): BAT right-click behavior Part A investigation (T0027)

# git revert 37bccdf --no-edit
[main 80d13ef] Revert "fix(ui): restore overlay position on terminal scroll (BUG-008)"
1 file changed, 15 deletions(-)

# git log --oneline -3
80d13ef Revert "fix(ui): restore overlay position on terminal scroll (BUG-008)"
d434ce9 fix(workorder): 更新工單狀態為 DONE，新增塔台追認紀錄
3dd2500 chore(tower): T0028 closure + L019/L020/L021 carry

# git diff HEAD~1 HEAD --stat
src/components/TerminalPanel.tsx | 15 ---------------
1 file changed, 15 deletions(-)

# npx vite build
renderer/main/preload build 全部成功（無錯誤）

# npm run dev
Vite dev server 啟動成功（http://localhost:5173/），Electron 主程序載入成功
```

### 驗證 A：Extra padding

- 結果：`UNKNOWN`
- 觀察：目前 session 無法進行 GUI 視覺比對，未能確認右側/工單列表周邊的 padding 是否已回到 pre-T0028 baseline。

### 驗證 B：BUG-008 ghost

- 結果：`UNKNOWN`
- 觀察：雖然 dev 啟動成功，但此環境無法實際操作捲動終端/切 tab/開關 context menu 進行體感比對。

### 決策樹分類結果

`UNKNOWN | *`：無法判斷，依規則停工回報塔台。

### 阻塞或偏離

阻塞：目前執行環境無法完成工單要求的 GUI 手動驗證（A/B），因此無法判定是否命中「PASS + SAME」正常完成條件。

### 互動紀錄

無

### Commit hash

`80d13ef`

### sprint-status.yaml

不適用（根目錄、`_bmad-output/`、`docs/` 皆未找到 `sprint-status.yaml`）

---

## 提醒區（Worker 執行時請遵守）

- **L019**：若 revert 後 padding 還在，不要假設「T0028 沒生效」就繼續 hack，回報塔台重新對齊
- **L020**：回報語氣過去式客觀描述（「revert 後觀察到 padding 消失」而非「我覺得應該 OK 了」）
- **L021**：Worker 只 stage 檔案，不主動修改 `_tower-state.md` 或 `_learnings.md`（除非塔台預寫內容需要 carry —— 本工單無）
- **Push 政策**：驗證通過且決策樹命中「正常完成」才 push，其他情況一律停工回報
