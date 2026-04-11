# 工單 T0022-prep-closure-and-push

## 元資料
- **編號**：T0022-prep-closure
- **類型**：Chore (git commit + push + session closure)
- **狀態**：DONE
- **優先級**：🟡 中（session 衛生，T0022 派發前置）
- **建立時間**：2026-04-11 17:28 (UTC+8)
- **開始時間**：2026-04-11 17:28 (UTC+8)
- **完成時間**：2026-04-11 17:29 (UTC+8)
- **派發者**：Control Tower
- **前置工單**：T0022-prep（已 DONE）
- **後續工單**：T0022（等本工單完成 + 開新塔台 session 後派發）
- **目標子專案**：（單一專案）

## 工作量預估
- **Session 建議**：🆕 新 session（乾淨 context，純 git 操作）
- **預估時間**：5-10 分鐘
- **複雜度**：低（標準 git workflow + push）

## Session 建議
新 session 執行。本工單非常輕量，建議在 BAT 終端執行（若你想繼續 dogfood BAT 也可以，有任何 BAT 異常記得回報塔台登記）。

## 背景

### 來源
T0022-prep 已 DONE（17:11 由 sub-session 完成）。Sub-session **刻意把 chore(tower) Commit 2 留給塔台處理**，因為塔台 session 還會繼續動 `_tower-state.md`：
1. 登記本輪 dogfood 發現的 bug（BUG-007/008/009 + UX-001）
2. 寫入 17:23 session closure checkpoint

這是一個**聰明的 atomic commit 設計** — 避免 race condition 導致 sub-session 剛 commit 塔台就又改，產生第二次 commit。

### 當前 git 狀態（本工單啟動時預期）
```
On branch main
Your branch is ahead of 'origin/main' by 4 commits.

Changes not staged for commit:
        modified:   _ct-workorders/_tower-state.md
```

未 commit 的變更是塔台 session 累積的記錄：
- BUG-007 表格列 + 摘要
- BUG-008 表格列 + 摘要
- UX-001 表格列 + 摘要
- BUG-009 表格列 + 摘要
- 右鍵功能表 / overlay 累積訊號觀察
- BUG-004/005/006 表格列（之前漏記，補齊）
- 17:23 Session closure checkpoint（T0022-prep 完成 + 下一步建議）

### 目標
1. **產生 chore(tower) Commit**，收尾 T0022-prep 和本輪 session
2. **Push main 到 origin**（使用者已明確同意 Q2=A）
3. 驗證 push 成功、working tree clean

## 任務指令

### BMad 工作流程
不適用（純 git chore + push）

### 前置條件
1. ✅ T0022-prep 已 DONE
2. ✅ `2ff0606 chore(infra): refine tower directory gitignore + pre-commit hook` 已存在
3. ✅ `aedba6c chore(tower): record L016 + close T0021 handover + dispatch T0022-prep` 已存在
4. ✅ pre-commit hook 已安裝（`.git/hooks/pre-commit`）
5. ✅ `.gitignore` 已是細化規則（不再需要 `git add -f`）

### 輸入上下文
- **根目錄**：`D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal`
- **當前分支**：`main`
- **使用者已同意 push**：Q2=A（本 session 的顯式授權）
- **策略依據**：L014（塔台 state 檔案構成原子 commit 群組）

### 執行計畫

#### Step 1：環境檢查
```bash
cd "D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal"
git status
git branch --show-current
git log --oneline -5
```

**預期**：
- branch = `main`
- 看到 4 個已 commit 的新 commits（aedba6c、2ff0606、f75b1c8、7bc856e）
- 看到 1 個未 commit 變更：`_ct-workorders/_tower-state.md`
- 看到「Your branch is ahead of 'origin/main' by 4 commits」

**若看到意外變更**（例如 src/ 下的檔案、其他工單被改等）→ STOP 並回報塔台。

#### Step 2：Diff 預覽（安全檢查）
```bash
git diff _ct-workorders/_tower-state.md | head -80
```

快速瀏覽 diff 是否包含：
- ✅ BUG 登記內容（BUG-007 / BUG-008 / BUG-009 / UX-001）
- ✅ 17:23 checkpoint
- ❌ **不應該看到**：敏感資訊、意外內容、亂碼、大量無關變更

**若有異常**（例如發現敏感內容、diff 範圍超出預期）→ STOP 並回報塔台。

#### Step 3：產生 chore(tower) Commit
```bash
git add _ct-workorders/_tower-state.md
git status
git commit -m "$(cat <<'EOF'
chore(tower): close T0022-prep + register dogfood bugs + session checkpoint

- Tower state: 17:23 checkpoint for T0022-prep completion
  - L013 GOLDEN 5th consecutive real-world validation
  - check-ignore verification shows tower state no longer ignored
  - T0022-prep took 10 min, 0 rollback, 29 audit findings all false positive
- Register 4 new backlog items from dogfood session:
  - BUG-007 (Low):  OSC 52 debug message pollutes terminal output
  - BUG-008 (Med):  terminal scroll causes overlay UI misalignment
  - UX-001  (Med):  thicken scrollbar 60% + always reserve gutter
  - BUG-009 (Med):  right-click paste leaves focus on closed menu
- Backfill BUG-004/005/006 into bug tracker table for auditability
- Dispatch workorder: T0022-prep-closure-and-push (this one)

Context-menu/overlay cluster signal: 4 related issues accumulated
(BUG-002 fixed + BUG-008 + UX-001 + BUG-009 backlog).
If 1-2 more appear, an architecture audit workorder is warranted.

Refs: T0022-prep, BUG-007, BUG-008, BUG-009, UX-001, L013
EOF
)"
git log -1 --stat
```

#### Step 4：Push 到 origin
```bash
git push origin main
```

**預期輸出**：看到 push 進度、無錯誤、最終顯示類似 `6a9b5b5..<new-hash>  main -> main`

**可能的失敗情境**：
- 🛑 **Push 被 remote 拒絕**：可能 origin 有新的 commits 需要 pull/rebase
  - STOP 並回報塔台
  - **不要**用 `--force` push
- 🛑 **網路錯誤**：重試一次，仍失敗則 STOP 回報
- 🛑 **Auth 錯誤**：STOP 回報，使用者需要介入

#### Step 5：最終驗證
```bash
git status
git log --oneline -6
```

**預期**：
- `git status` 顯示 `Your branch is up to date with 'origin/main'`
- `git log --oneline -6` 顯示 5 個 commits（本次 + 前 4 個）皆已 push

### 不動範圍

- ❌ **不改任何程式碼**：`src/` 內的任何檔案都不要動
- ❌ **不改任何工單內容**：除本工單（回報區）和 `_tower-state.md` 之外的塔台檔案都不要動
- ❌ **不產生額外 commit**：只做一個 chore(tower) commit，不要拆成多個
- ❌ **不動歷史**：`git rebase` / `git filter-branch` / `git reset --hard` 一律禁止
- ❌ **不 force push**：若 push 被拒絕，STOP 並回報
- ❌ **不跑 `*evolve`**：L017/L018 升級留給新塔台 session 處理（使用者 Q3=B）
- ❌ **不派發其他工單**：T0022 派發由**新的塔台 session** 處理
- ❌ **不更新 T0022 工單**：T0022 內容已經定稿

### 驗收條件
1. ✅ `chore(tower)` commit 產生，訊息格式正確
2. ✅ commit 只包含 `_ct-workorders/_tower-state.md`（單一檔案 atomic）
3. ✅ `git status` 乾淨（working tree clean）
4. ✅ `git push origin main` 成功
5. ✅ `git status` 顯示 `up to date with 'origin/main'`
6. ✅ 本工單回報區填寫完成
7. ✅ 未動任何程式碼或其他工單

### 失敗處理

STOP 並回報塔台的情境：
1. 🛑 發現意外的 git 狀態（未預期的修改、檔案缺失等）
2. 🛑 diff 包含異常內容（敏感資訊、亂碼、超出預期範圍）
3. 🛑 commit 被 pre-commit hook WARN（正常）— 閱讀 WARN 內容確認是否 false positive，若有疑慮則回報
4. 🛑 `git push` 失敗（任何原因：網路、auth、被 remote 拒絕）
5. 🛑 任何其他未預期錯誤

**禁止**：
- ❌ `--no-verify` 繞過 hook
- ❌ `--force` push
- ❌ 為了讓 commit/push 過而修改任何其他檔案
- ❌ 自行 pull/rebase（push 被拒絕時 STOP，不要嘗試解決衝突）

## Sub-session 執行指示

### 執行步驟
1. 執行 Step 1 環境檢查
2. 執行 Step 2 diff 預覽
3. 執行 Step 3 commit
4. 執行 Step 4 push
5. 執行 Step 5 最終驗證
6. 更新本工單回報區
7. **注意**：本工單的回報區更新後，**不要再 commit**（避免觸發 chicken-and-egg 問題）。使用者會在下一個塔台 session 中的 `*evolve` 時把回報區一起 commit。

### 學習鉤子
若遇到以下情況，記錄到「學習鉤子候選」：
- pre-commit hook 對 chore(tower) diff 的 false positive（因為塔台 state 常含「password」這類關鍵字的說明文字）
- push 的網路 / auth / 被拒絕問題
- Commit message heredoc 在 Windows Git Bash 的換行符或編碼問題
- `git log` 顯示順序與預期不符

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
- **新 Commit hash + message**：`ccce0f7 chore(tower): close T0022-prep + register dogfood bugs + session checkpoint`
- **Push 結果**：成功，`6a9b5b5..ccce0f7  main -> main`
- **分支狀態**：`main` 已與 `origin/main` 同步（up to date）

### git log 輸出（最後 6 筆）
```
ccce0f7 (HEAD -> main, origin/main, origin/HEAD) chore(tower): close T0022-prep + register dogfood bugs + session checkpoint
aedba6c chore(tower): record L016 + close T0021 handover + dispatch T0022-prep
2ff0606 chore(infra): refine tower directory gitignore + pre-commit hook
f75b1c8 chore(tower): close BUG-006 / mark T0020 DONE / elevate L015 to global
7bc856e fix(voice): use static worklet asset for packaged build (BUG-006)
6a9b5b5 fix: remove manual tag push, let release action create tag via API
```

### Pre-commit hook 觸發結果
- 有觸發 WARN：
  - `[tower-hook][WARN] potential sensitive content in _ct-workorders/_tower-state.md:`
  - `1030:- \`password=test123\` 測試檔 commit 驗證 WARN 可觸發，且不阻擋 commit（驗證後已 reset 並刪除測試檔）`
  - `[tower-hook][WARN] found 1 file(s) with potential sensitive content`
- 判定：false positive（文件內容是描述測試情境，不是新增憑證）。

### 互動紀錄
無

### 遭遇問題
無

### 學習鉤子候選
- chore(tower) 對 `_tower-state.md` 提交時，hook 容易因描述字串（如 `password=test123`）觸發 WARN；需人工判定 false positive，但不會阻擋 commit。

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-11 17:29 (UTC+8)
