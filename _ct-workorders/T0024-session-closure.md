# 工單 T0024-session-closure

## 元資料
- **編號**：T0024
- **類型**：Chore (session closure — tower state + learnings + workorder archival)
- **狀態**：IN_PROGRESS
- **優先級**：🟡 中（本 session 正式收尾，非阻塞但應在本輪完成）
- **建立時間**：2026-04-11 18:22 (UTC+8)
- **開始時間**：2026-04-11 18:25 (UTC+8)
- **派發者**：Control Tower（D029 決策，B1 選項）
- **前置工單**：T0023-archive-orphan-workorder-t0022-prep-closure（已 DONE，commit `dc76077`）
- **後續工單**：無（本工單收尾後 tower session 正式 closed）
- **目標子專案**：（單一專案）

## 工作量預估
- **Session 建議**：🆕 新 session（純 git 操作，不需載入模組 context）
- **預估時間**：3-5 分鐘
- **複雜度**：極低（4 檔原子 commit + push，無互動決策）

## Session 建議
新終端分頁執行。本工單是 T0023 的直接延伸（原子打包模式已驗證），預期零 rollback。

## 背景

### 來源
本輪塔台 session（2026-04-11 17:41 啟動）的最終收尾工單。經歷：
1. **17:42** `*sync` 偵測孤兒 T0022-prep-closure-and-push（前輪 session 遺漏 `git add`）
2. **17:43** 派發 T0023 v1 歸檔孤兒
3. **17:53** T0023 v1 BLOCKED（self-containing workorder 反模式，sub-session 正確 STOP）
4. **17:56** 塔台 v2 修訂（原子打包兩張工單）
5. **18:08** T0023 v2 完成（commit `dc76077`，push 成功）
6. **18:08-18:22** 塔台寫入學習鉤子候選（A3 分流）：
   - Global GA006 → `~/.claude/control-tower-data/learnings/patterns.md`
   - Project L017 → `_ct-workorders/_learnings.md`
   - Session checkpoint → `_ct-workorders/_tower-state.md`
7. **18:22** 派發本工單 T0024 做最終 closure commit

### 當前 git 狀態（本工單啟動時預期）

```bash
$ git status --porcelain
 M _ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md
 M _ct-workorders/_learnings.md
 M _ct-workorders/_tower-state.md
?? _ct-workorders/T0024-session-closure.md

$ git rev-parse HEAD origin/main
dc7607749da31cccfe9aafdb5c58ee041199d44e
dc7607749da31cccfe9aafdb5c58ee041199d44e
# HEAD 與 origin/main 同步，dc76077 是本輪 T0023 的 commit
```

### 目標

將本 session 累積的 4 張檔案變更納入**單一 atomic commit** 並 push 到 origin/main，使本 session 正式收尾、working tree 完全乾淨。

**4 張檔案的來源**：
| 檔案 | 狀態 | 由誰產生 | 內容 |
|------|------|---------|------|
| `T0023-archive-...-closure.md` | `M` | T0023 的 ct-exec 收尾 | 回報區填入 commit hash + push 結果 |
| `_tower-state.md` | `M` | 本塔台 session 18:22 追加 | 17:43 Checkpoint（*sync + T0023 v1→v2 saga） |
| `_learnings.md` | `M` | 本塔台 session 18:19 追加 | L017（pre-commit false positive 策略） |
| `T0024-session-closure.md` | `??` | 本塔台 session 18:22 建立 | 本工單本身 |

注：`~/.claude/control-tower-data/learnings/patterns.md`（GA006）位於 Layer 2，**不在** 本 repo git 管理範圍，**不要**嘗試 add。

## 任務指令

### BMad 工作流程
不適用（純 git chore）。

### 前置條件
1. ✅ Git 分支必須為 `main`
2. ✅ HEAD 必須為 `dc76077`（若不是，代表有新 commit 介入，STOP 回報）
3. ✅ 工作樹變更必須**恰好**為：
   - 3 個 `M`：T0023 workorder、_tower-state.md、_learnings.md
   - 1 個 `??`：T0024-session-closure.md（本工單）
   - 任何其他 `M` / `A` / `D` / `??` → STOP 回報（有未預期變更）
   - 缺少任何一個 → STOP 回報（狀態漂移）
4. ✅ `.git/hooks/pre-commit` 必須存在
5. ✅ `origin/main` 必須可推送（網路 + 權限 OK）

### 輸入上下文
- **根目錄**：`D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal`
- **當前分支**：`main`
- **最新 commit**：`dc76077 chore(tower): archive orphan sync workorders (T0022-prep-closure + T0023)`
- **使用者已同意 push**：本 session 選項 [A3 + B1] 明確授權
- **策略依據**：
  - L014（塔台檔案構成原子 commit 群組）
  - GA006（self-containing workorder 需納入工單本身）— T0023 v2 已驗證過此模式
  - D029（本 session closure 決策）

### 執行計畫：單一 closure atomic commit（4 檔）

**目標 commit**：
- Subject: `chore(tower): session closure checkpoint (T0023 + L017 + GA006 + state)`
- Files（共 4 張，順序不重要）：
  - `_ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md`
  - `_ct-workorders/_tower-state.md`
  - `_ct-workorders/_learnings.md`
  - `_ct-workorders/T0024-session-closure.md`

### 執行步驟

#### Step 1：前置驗證（必做）

```bash
# 1.1 確認分支
git branch --show-current
# 預期：main

# 1.2 確認 HEAD
git rev-parse HEAD
# 預期：dc7607749da31cccfe9aafdb5c58ee041199d44e

# 1.3 確認工作樹恰好 3 M + 1 ??
git status --porcelain
# 預期輸出（順序不重要，但必須恰好這 4 行）：
#    M _ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md
#    M _ct-workorders/_tower-state.md
#    M _ct-workorders/_learnings.md
#   ?? _ct-workorders/T0024-session-closure.md
#
# 比對規則：
# - 多於 4 行 → STOP，有未預期變更
# - 少於 4 行 → STOP，狀態漂移
# - 恰好 4 行且內容吻合 → 通過
```

**若任一驗證失敗**：STOP，在回報區記錄 `git status --porcelain` 完整輸出，不繼續後續步驟，**不**執行 `git reset` / `git clean` / `git stash`。

#### Step 2：Stage 4 張檔案

```bash
git add _ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md
git add _ct-workorders/_tower-state.md
git add _ct-workorders/_learnings.md
git add _ct-workorders/T0024-session-closure.md
```

**只 add 這 4 個檔案**，逐一精準。**不要** `git add .` / `-A` / `-u`。

Verify:
```bash
git diff --cached --name-only
# 預期恰好 4 行（順序不重要）：
#   _ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md
#   _ct-workorders/_tower-state.md
#   _ct-workorders/_learnings.md
#   _ct-workorders/T0024-session-closure.md
```

**若輸出行數不是恰好 4**：STOP，執行 `git reset HEAD` 取消 stage，回報塔台。

#### Step 3：建立 closure commit

使用 HEREDOC 確保格式：

```bash
git commit -m "$(cat <<'EOF'
chore(tower): session closure checkpoint (T0023 + L017 + GA006 + state)

Tower session 2026-04-11 17:41 → 18:22 closure commit.
Packs 4 tower files together as a single atomic checkpoint:

1. T0023-archive-orphan-workorder-t0022-prep-closure.md (M)
   ct-exec filled in the report section after dc76077 succeeded:
   - Commit hash: dc76077
   - Push result: ccce0f7..dc76077 main -> main
   - Pre-commit hook: WARN false positive on password=test123 (T0022:235)
   - New learning hook candidates captured

2. _tower-state.md (M)
   Appended 2026-04-11 17:43 Checkpoint documenting:
   - *sync discovery of orphan workorder T0022-prep-closure-and-push
   - T0023 v1 BLOCK saga (sub-session correctly stopped at Step 1.3)
   - T0023 v2 revision strategy (atomic bundling via L014)
   - T0023 v2 execution result (3min, zero rollback)
   - L013 GOLDEN rule Nth consecutive validation

3. _learnings.md (M)
   Added L017: pre-commit hook false positive policy.
   Triggered by: dc76077 hook WARN on password=test123 description
   string. Documents warn-but-not-block strategy and report-fill
   convention. Tagged candidate: global for future promotion.

4. T0024-session-closure.md (??)
   This workorder file itself. Following the GA006 fix pattern
   (self-containing workorders must include themselves in the
   commit), learned from T0023 v1 BLOCK earlier in this session.

Also captured in Layer 2 (outside this repo):
- ~/.claude/control-tower-data/learnings/patterns.md:
  GA006 anti-pattern — self-containing workorder without
  accounting for the workorder file itself. Sourced from this
  session's T0023 v1 BLOCK.

Session summary:
- Dispatched: T0023 (v1 BLOCKED → v2 DONE) + T0024 (this one)
- New commits: dc76077 + this
- New learnings: Global GA006 + Project L017 (candidate: global)
- Deferred to next session: 4 PARTIAL workorder reconciliations
  (T0005, T0013, T0014, T0017-beta) and T0022 dispatch

Refs: T0023, T0024, L013, L014, L017, GA006, D027, D028, D029

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

**若 pre-commit hook 失敗**：
- 讀取 hook 完整輸出
- 在回報區貼完整錯誤訊息
- STOP 回報塔台，**不** `--no-verify`、**不** `--amend`、**不** reset

**若 hook 觸發 WARN（非 block）**：
- Commit 會正常產生
- 在回報區「Pre-commit hook 觸發結果」欄位記錄：WARN 完整輸出、是否 false positive、判讀依據（依 L017 規範）

#### Step 4：驗證 commit 內容

```bash
git log --oneline -2
# 預期最新兩筆：
#   <new-sha>  chore(tower): session closure checkpoint (T0023 + L017 + GA006 + state)
#   dc76077    chore(tower): archive orphan sync workorders (T0022-prep-closure + T0023)

git show --stat HEAD
# 預期：恰好 4 個檔案
#   _ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md
#   _ct-workorders/_tower-state.md
#   _ct-workorders/_learnings.md
#   _ct-workorders/T0024-session-closure.md
```

**若 commit 包含多於或少於 4 個檔案**：STOP 回報。

#### Step 5：Push 到 origin/main

```bash
git push origin main
```

**預期輸出**：`dc76077..<new-sha>  main -> main`

**若 push 被拒絕**：
- 🛑 **不 `--force`、不 `--force-with-lease`**
- 讀取完整錯誤訊息
- STOP 回報塔台

#### Step 6：最終驗證

```bash
# 6.1 工作樹完全乾淨
git status --porcelain
# 預期：空（無任何 M / ?? / A / D）

# 6.2 HEAD 已推送且同步
git rev-parse HEAD origin/main
# 預期兩行 SHA 完全相同

# 6.3 最近 4 筆 commit 軌跡齊全
git log --oneline -4
# 預期：
#   <new-sha>  chore(tower): session closure checkpoint (T0023 + L017 + GA006 + state)
#   dc76077    chore(tower): archive orphan sync workorders (T0022-prep-closure + T0023)
#   ccce0f7    chore(tower): close T0022-prep + register dogfood bugs + session checkpoint
#   aedba6c    chore(tower): record L016 + close T0021 handover + dispatch T0022-prep
```

### 不動範圍（避免 scope creep）

- ❌ **不 amend 任何既有 commit**（包括 `dc76077`、`ccce0f7` 等已 push 的歷史）
- ❌ **不修改本 4 張檔案的內容**（只做 stage / commit / push）
- ❌ **不動 `~/.claude/control-tower-data/`**（Layer 2 獨立管理，不在 repo 內）
- ❌ **不動任何 `.ts` / `.js` / `.tsx` / `.jsx`** 等原始碼
- ❌ **不動 `release/` / `dist/` / `node_modules/`**
- ❌ **不 `git add .` / `-A` / `-u`**
- ❌ **不 `--no-verify` 繞過 pre-commit hook**
- ❌ **不跑 build / test / lint**
- ❌ **不產生任何其他新檔案**

### 驗收條件

- [ ] Step 1-6 全部通過
- [ ] 產生一筆 `chore(tower): session closure checkpoint ...` commit
- [ ] Commit 恰好包含 4 個檔案：
  - `_ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md`
  - `_ct-workorders/_tower-state.md`
  - `_ct-workorders/_learnings.md`
  - `_ct-workorders/T0024-session-closure.md`
- [ ] Push 成功，`origin/main` 前進至新 SHA
- [ ] `git status --porcelain` 輸出為空
- [ ] Pre-commit hook 通過（WARN 可接受但需記錄判讀；BLOCK 不允許）
- [ ] 整個流程沒有 rollback、沒有 reset、沒有 amend

### 失敗處理

| 情境 | 行動 |
|------|------|
| Step 1 驗證失敗（數量不對） | STOP，不 add、不 commit；回報 `git status --porcelain` 完整輸出 |
| HEAD 不是 `dc76077` | STOP，回報 `git log --oneline -5` 輸出 |
| Pre-commit hook 以 block 形式擋下 | STOP，不 `--no-verify`，貼完整錯誤 |
| Pre-commit hook 以 WARN 形式觸發 | 繼續，但在回報區依 L017 固定欄位記錄 |
| Commit 檔案數量不對 | STOP，`git reset HEAD`（不動檔案）回報 |
| Push 被拒絕 | STOP，不 `--force`，貼完整錯誤 |
| 網路或權限錯誤 | STOP，貼完整錯誤 |

## Sub-session 執行指示

### 執行步驟

1. 載入本工單（`/ct-exec T0024-session-closure`）
2. 按順序執行 Step 1 → Step 6
3. 任何一步驟出現非預期結果，立即 STOP 並在回報區記錄
4. 全部通過後，填寫回報區並呼叫 `/ct-done`

### 學習鉤子

本工單延續 T0023 v2 驗證 GA006 的原子打包策略。期望觀察：
- 原子打包模式在「4 檔規模」是否仍順利（T0023 驗證的是 2 檔）
- Pre-commit hook 是否對新追加的 L017 內容再次觸發 false positive（L017 本身引用 `password=test123` 做數據點）
- 若 L017 內容觸發 hook WARN → 驗證 L017 自身，形成自我指涉的學習閉環（meta-learning moment）

請在回報區的「學習鉤子候選」記錄任何新觀察。

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
<DONE / PARTIAL / FAILED / BLOCKED>

### 產出摘要

**新 Commit hash + message**：
**Push 結果**：
**分支狀態**：

### git log 輸出（最後 4 筆）

```
<貼 git log --oneline -4 的輸出>
```

### Pre-commit hook 觸發結果

<依 L017 規範記錄：完整輸出 + 人工判讀結論（真/假陽性）+ 判讀依據>

### 互動紀錄

<若有任何決策點、使用者對話或 STOP 回報，在此記錄>

### 遭遇問題

<若無則寫「無」>

### 學習鉤子候選

<列出觀察到的模式、反模式或建議，或寫「無」>

### 回報時間
