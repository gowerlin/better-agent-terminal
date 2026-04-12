---
id: T0030
title: Revert T0026 (UX-001) — 驗證 padding regression 假設
type: hypothesis-verification-revert
status: DONE
priority: high
created: 2026-04-11 22:15 (Asia/Taipei)
started: 2026-04-11 22:26 (Asia/Taipei)
completed: 2026-04-11 22:44 (Asia/Taipei, worker) / 23:05 (tower closure)
tower_override: true
verified_by: user-manual-dogfood
verified_at: 2026-04-11 22:58 (Asia/Taipei)
estimated: 15-20 min
depends_on: [T0029]
blocks: [T0031]
parent_bug: UX-001-regression
related_commits:
  - fd3e7af "feat(ui): widen scrollbar and stabilize gutter (UX-001)"
  - 80d13ef "Revert: 37bccdf T0028 Pattern C" (base, 不動)
hypothesis: fd3e7af 的 "gutter 永遠佔位（所有使用處）" 實作把 scrollbar 空間保留套到了不該有 scrollbar 的 container，造成視覺上的 extra padding
---

# T0030 — Revert T0026 驗證 padding 假設

## 背景

### 事件鏈

1. **T0028** (Pattern C — scroll dismiss overlay) 於 21:15 派發，意圖修 BUG-008 ghost render
2. **T0029** (本工單前置) revert T0028 後，使用者 dogfood 驗證：
   - `驗證 A (padding)`：**FAIL** —— padding 沒復原，即 T0028 **不是** padding 來源
   - `驗證 B (ghost)`：**SAME** —— ghost 依舊，確認 T0028 從未觸及根因
3. T0029 命中決策樹 `FAIL + SAME` → 停工回報塔台 → 塔台重新對齊

### 新假設（prime suspect）

Padding 的真正來源是 **T0026 commit `fd3e7af`**，原因：

1. T0026 spec 明確寫「scrollbar 加粗 60% + **gutter 永遠佔位（所有使用處）**」
2. 「gutter 永遠佔位」= 永遠保留 scrollbar 所需空間，即使 scrollbar 沒出現
3. 「所有使用處」= CSS 選擇器套用範圍可能過大，**滲透到不該有 scrollbar 的 container**
4. padding 出現位置（右上角 / 右側中段 / 工單列表周邊）與「本應無 scrollbar 但被保留空間」的情境吻合

### BUG-008 ghost 不在本工單範圍

BUG-008 確認為獨立 bug（T0028 從未觸及），將於 padding 問題解決後另開工單深度調查（候選編號 T0032）。本工單**僅**處理 padding regression 假設驗證。

## 目標

Revert commit `fd3e7af`，驗證 padding 是否消失。**純假設驗證工單**，不做修復。驗證結果不論 PASS/FAIL 都必須停工回報塔台。

## 前置狀態（執行前 Worker 確認）

```bash
git log --oneline -3
# 預期看到:
# 80d13ef Revert "fix(ui): restore overlay position on terminal scroll (BUG-008)"
# d434ce9 fix(workorder): 更新工單狀態為 DONE，新增塔台追認紀錄
# 3dd2500 chore(tower): T0028 closure + L019/L020/L021 carry

git status
# 預期: working tree clean
```

若 working tree 不乾淨 → 立即停工回報，不要嘗試繼續。

## 執行步驟

```bash
# 1. Revert（非 HEAD commit revert，可能 conflict）
git revert fd3e7af --no-edit
```

**衝突處理**：若 `git revert` 回報 conflict：
1. **不要** 嘗試 resolve —— 立即 `git revert --abort`
2. 停工回報塔台，描述 conflict 的檔案清單
3. 塔台會改派「選擇性 CSS rollback」策略

**順利進行**：若 revert 乾淨通過：

```bash
# 2. 驗證編譯
npx vite build

# 3. Working tree 確認
git status
git log --oneline -3
git diff HEAD~1 HEAD --stat

# 4. 啟動 dev
npm run dev
```

Worker 啟動 dev 後**停工**，等使用者手動驗證（Worker 無 GUI 能力）。

## 手動驗證清單（停工後填寫）

### 驗證 A：Padding 是否消失？

- 動作：開啟主視窗，觀察右上角 / 右側中段 / 工單列表周邊
- 對照：和 T0030 執行前（padding 還在）比較
- 實測：`[ PASS / FAIL / UNKNOWN ]`
  - `PASS` = padding 明顯消失或減少
  - `FAIL` = padding 毫無變化，還在原位
  - `UNKNOWN` = 無法判斷（例如 app 啟動失敗）
- 觀察備註：___

### 驗證 B：Scrollbar 功能是否回到 T0026 前狀態？

- 動作：捲動終端、捲動工單列表
- 預期：scrollbar 變回原始細版（T0026 前的樣子），功能正常
- 實測：`[ PASS / FAIL / UNKNOWN ]`
- 觀察備註：___

### 驗證 C：BUG-008 ghost 是否有意外變化？

**注意**：本工單不處理 ghost，但若 revert T0026 意外影響到 ghost（變好或變壞），是重要線索。

- 動作：捲動終端 / 開關 context menu
- 預期：ghost 應該 **SAME**（T0026 與 BUG-008 理論上無關）
- 實測：`[ SAME / WORSE / BETTER / UNKNOWN ]`
- 觀察備註：___

## 決策樹（Worker 必須按此回報）

| 驗證 A | 驗證 C | 結論 | 後續動作 |
|--------|--------|------|---------|
| PASS | SAME | **假設確認** —— T0026 是 padding 唯一來源，BUG-008 與其無關 | ⚠️ 停工回報塔台，保留 revert commit，塔台將派發 T0031 修 T0026 scope |
| PASS | BETTER | **驚喜** —— T0026 可能同時影響 padding 和 ghost（奇怪但可能） | ⚠️ 停工回報塔台，這是重要發現，塔台需要重新對齊整個策略 |
| PASS | WORSE | **疑似副作用** —— revert T0026 讓 ghost 更糟 | ⚠️ 停工回報塔台，塔台判斷是否 `git reset --hard 80d13ef` 回退 |
| FAIL | * | **假設推翻** —— T0026 不是 padding 來源，另有凶手 | ⚠️ 停工回報塔台，指示 Worker `git reset --hard 80d13ef` 放棄 revert，塔台重新追查 |
| UNKNOWN | * | 無法判斷 | ⚠️ 停工回報塔台，描述現場狀況 |

**絕對不可**：
- 自行判斷「應該是 PASS」就 push
- revert 沒 conflict 就以為萬事 OK 繼續下一步
- 動任何超出本工單 scope 的檔案（禁止修 CSS、TSX、TS）
- 動 `_tower-state.md` 或 `_learnings.md`（L021）

## Commit 規範

**本工單不自動產生 push**。revert commit 由 `git revert` 自動建立，但：

- **驗證 A=PASS + C=SAME**：保留 revert commit，**不 push**（等塔台派 T0031 修好後一起 push）
- **驗證 A=FAIL**：立即 `git reset --hard 80d13ef` 放棄 revert commit，working tree 回到 T0029 收尾狀態
- **其他決策樹分類**：原地停工，不動 commit，等塔台指示

**Commit message**（若 PASS 保留時，使用 git revert 預設即可）：
```
Revert "feat(ui): widen scrollbar and stabilize gutter (UX-001)"

This reverts commit fd3e7afxxx.
```

**禁止修改**：
- `_ct-workorders/_tower-state.md`（L021）
- `_ct-workorders/_learnings.md`（L021，本工單無學習預寫）
- 本工單以外的任何工單檔案

## 回報區（Worker 執行後填寫）

### 執行摘要

已執行 `git revert fd3e7af --no-edit`，建立 revert commit `92ba15f`，回滾 `src/styles/base.css` 與 `src/styles/panels.css` 的 T0026 變更。`npx vite build` 成功。`npm run dev` 曾成功啟動到 Vite ready / Electron startup log，但隨後因處理程序錯誤而結束，且本 session 無法做 GUI 手動驗證，A/B/C 皆為 UNKNOWN，依決策樹停工回報塔台。

### Git 操作記錄

```
# git log --oneline -3 (執行前)
80d13ef (HEAD -> main) Revert "fix(ui): restore overlay position on terminal scroll (BUG-008)"
d434ce9 (origin/main, origin/HEAD) fix(workorder): 更新工單狀態為 DONE，新增塔台追認紀錄
3dd2500 chore(tower): T0028 closure + L019/L020/L021 carry

# git status --short (執行前)
?? _ct-workorders/T0029-revert-t0028-pattern-c.md
?? _ct-workorders/T0030-revert-t0026-padding-hypothesis.md

# git status --short --untracked-files=no (執行前，僅追蹤檔)
# (無輸出)

# git revert fd3e7af --no-edit
[main 92ba15f] Revert "feat(ui): widen scrollbar and stabilize gutter (UX-001)"
 Date: Sat Apr 11 22:36:54 2026 +0800
 2 files changed, 3 insertions(+), 9 deletions(-)

# git log --oneline -3 (執行後)
92ba15f (HEAD -> main) Revert "feat(ui): widen scrollbar and stabilize gutter (UX-001)"
80d13ef Revert "fix(ui): restore overlay position on terminal scroll (BUG-008)"
d434ce9 (origin/main, origin/HEAD) fix(workorder): 更新工單狀態為 DONE，新增塔台追認紀錄

# git diff HEAD~1 HEAD --stat
 src/styles/base.css   | 10 ++--------
 src/styles/panels.css |  2 +-
 2 files changed, 3 insertions(+), 9 deletions(-)
```

### 編譯驗證

- `npx vite build`: `SUCCESS`
- 錯誤訊息（若有）：無（僅出現既有 chunk split 警告）

### Dev 啟動

- `npm run dev`: `FAIL`
- 錯誤訊息（若有）：啟動後出現 `錯誤: 找不到處理程序 "25584"`，process 結束

### 驗證 A：Padding

- 結果：`UNKNOWN`
- 觀察：本 session 無 GUI 視覺比對能力，無法判斷右上角/右側中段/工單列表 padding 是否消失。

### 驗證 B：Scrollbar 功能

- 結果：`UNKNOWN`
- 觀察：本 session 無法實際操作捲動終端與工單列表，無法確認 scrollbar 是否回到 T0026 前狀態。

### 驗證 C：BUG-008 ghost

- 結果：`UNKNOWN`
- 觀察：本 session 無法進行捲動終端 / 開關 context menu 的體感驗證，無法判斷 ghost 是否 SAME/WORSE/BETTER。

### 決策樹分類結果

`UNKNOWN | *`：無法判斷，依規則停工回報塔台。

### Commit 狀態

- Revert commit hash（若保留）：`92ba15f`
- 或：已 `git reset --hard 80d13ef` 放棄（未執行）

### 阻塞或偏離

阻塞：
1. 本執行環境無法做 GUI 手動驗證（A/B/C 均 UNKNOWN）。
2. `npm run dev` 可啟動至 ready，但隨後因處理程序錯誤結束，無法維持可操作的驗證視窗。

### 互動紀錄

無

### sprint-status.yaml

不適用（根目錄、`_bmad-output/`、`docs/` 皆未找到 `sprint-status.yaml`）

---

## 🏁 塔台 Closure（2026-04-11 23:05, tower override）

### 結論

**假設確認**：`fd3e7af` (T0026 UX-001 "widen scrollbar + stabilize gutter") **是 padding regression 的唯一來源**。Revert commit `92ba15f` 正確移除 regression，保留為新 baseline。

### 驗證過程（真實序列，含混淆因子）

1. **22:26**：Worker 啟動 T0030，成功 `git revert fd3e7af --no-edit`（commit `92ba15f`），`npx vite build` 通過
2. **22:44**：Worker 嘗試 `npm run dev`，啟動但隨後處理程序錯誤結束。Worker 無 GUI 驗證能力，依決策樹填 UNKNOWN、status=BLOCKED，回報塔台
3. **22:45–22:55**：使用者接手手動驗證。初次觀察時**仍看到 padding**，幾乎讓塔台以為假設推翻
4. **22:55**：使用者發現**先前的 dev server 未終止**，兩個 dev server 並存造成 HMR/bundle 錯亂
5. **22:58**：使用者終止舊 dev server、重啟乾淨 dev server，**padding 確實消失**，假設確認

### 混淆因子記錄（教訓來源）

本工單**差一點**因為**未受控的 baseline**（舊 dev server 未清）給出錯誤結論。塔台在收到初步「padding 回復正常」回報後，曾警戒建議做 disambiguation test（revert 撤回 vs 保留），但使用者已自行實測，確認是 T0026 的程式碼層差異而非 HMR 幻影。

此事件衍生 **L024 — Hypothesis verification requires controlled baseline**（詳見 `_learnings.md`）。

### Git 狀態

- Revert commit `92ba15f` 保留為新 baseline
- Working tree 清（待 Phase A closure commit 加入 tower-state + learnings 後一次 push）
- **不 push 單張 T0030 revert**，等 checkpoint batch 一起出

### BUG-008 ghost 狀態（驗證 C）

不在本工單處理範圍（revert 後沒特別觀察 ghost 是否變化）。保留給 T0032 investigation 處理。

### 使用者回饋（scrollbar 調整偏好，供 T0033 參考）

使用者實測 T0026 的「scrollbar 加粗 60%」時感覺**太粗（像 2 倍寬）**，之後重新實作時幅度要**縮小**。目標實作方向：

- Scrollbar 粗細微調（比 60% 小）
- Gutter 穩定性改用 CSS 標準屬性 `scrollbar-gutter: stable`（scope 限定於真正的 scroll container）

此不在 T0030 範圍，延後到 BUG-008 + BUG-010 調查完成後再開 T0033。

### 連帶效應

1. **T0029 revert（80d13ef）** 也連帶確認為 net 清理（T0028 對 padding 無貢獻，revert 掉無損）
2. **T0030 revert（92ba15f）** 成為新 baseline
3. Phase B 準備派 **T0032 BUG-008 + BUG-010 深度 investigation**

---

## 提醒區（Worker 執行時請遵守）

- **L019**：若 revert 後 padding 還在，不要假設「revert 沒生效」就繼續 hack。這代表假設錯誤，誠實回報
- **L020**：回報語氣過去式客觀描述
- **L021**：Worker 只動 revert commit + 本工單檔案回報區，不碰 `_tower-state.md` / `_learnings.md` / 其他工單
- **Scope 防漏**：本工單**只**做 revert 驗證。發現任何可以「順手修」的 bug/issue，一律忽略，等本工單收尾
