# 工單 T0023-archive-orphan-workorder-t0022-prep-closure

## 元資料
- **編號**：T0023
- **類型**：Chore (git archival — 補交孤兒工單檔案)
- **狀態**：DONE
- **優先級**：🟡 中（本 session 同步衛生收尾，非阻塞但應盡快歸檔）
- **建立時間**：2026-04-11 17:43 (UTC+8)
- **開始時間**：2026-04-11 18:05 (UTC+8)
- **完成時間**：2026-04-11 18:08 (UTC+8)
- **修訂時間**：2026-04-11 18:08 (UTC+8)（v3 — sub-session 收尾更新）
- **派發者**：Control Tower（本次 *sync 檢查後補派）
- **前置工單**：T0022-prep-closure-and-push（內容已執行完畢、回報區已填，但檔案未入 git）
- **後續工單**：無（本工單收尾後 session 可正式進入下一階段）
- **目標子專案**：（單一專案）

## 工作量預估
- **Session 建議**：🆕 新 session（純 git 操作、不需載入任何模組 context）
- **預估時間**：3-5 分鐘
- **複雜度**：極低（單一檔案、單一 commit、單一 push）

## Session 建議
在新終端分頁執行。無任何 build、無程式碼修改、無互動決策點。

## 背景

### 修訂記錄（v2）

**v1 BLOCK 回報**（17:53）：sub-session 執行 Step 1.3 時偵測到工作樹有兩個未追蹤檔案（T0022 + T0023 本身），違反原工單「僅 T0022 為唯一變更」的前置條件，依指示 STOP。**這是 sub-session 的正確防呆行為，不是 sub-session 的錯**。

**根因**：v1 工單設計時忽略了「T0023 工單檔案本身也是本輪 *sync 產出的未追蹤檔案」這個事實，形成雞生蛋蛋生雞的悖論。

**v2 修正策略**：把 T0023 改為「**單一 atomic commit 內納入兩張孤兒工單**」。兩張檔案在邏輯上都屬於同一個歸檔動作（*sync 發現 → 補歸檔），符合 L014 「塔台檔案構成原子 commit 群組」精神，且徹底避開悖論。

### 來源
本輪塔台 session（2026-04-11 17:41 啟動）執行 `*sync` 命令時，偵測到 git 工作樹有兩個未追蹤（untracked）檔案：

```
?? _ct-workorders/T0022-prep-closure-and-push.md  ← 前輪 session 的孤兒
?? _ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md  ← 本次補救工單本身
```

### 孤兒根因（時序重建）

| 時刻 | 事件 |
|------|------|
| 17:27 | 前一輪塔台 session 產生 T0022-prep-closure-and-push.md（作為「派發用」工單） |
| 17:28 | 塔台在工單內填入派發意圖（commit + push 塔台 state 檔案） |
| 17:29 | 塔台**自行執行**了 commit + push（**沒有轉交 sub-session**） |
|       | → 產生 commit `ccce0f7 chore(tower): close T0022-prep + register dogfood bugs + session checkpoint` |
|       | → commit 只 stage `_ct-workorders/_tower-state.md`（212 insertions） |
|       | → **忘記 `git add` 工單檔案本身** |
| 17:29 | Push 成功：`6a9b5b5..ccce0f7  main -> main` |
| 17:29 | 塔台在工單回報區填入 commit hash + push 結果（§218-220） |
| 17:29 | Session 結束，工單檔案遺留在工作樹中 |

**結論**：工單所描述的工作（commit + push）**已實際完成**。唯一缺失的步驟是「把這張工單檔案本身納入 git」。

### 現在的 git 狀態（本工單啟動時預期）

```bash
$ git status --porcelain
?? _ct-workorders/T0022-prep-closure-and-push.md
?? _ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md

$ git rev-parse HEAD origin/main
ccce0f7cd2cde3825e057601572189424964bee6
ccce0f7cd2cde3825e057601572189424964bee6
# HEAD 與 origin/main 同步，工作樹除孤兒工單外乾淨

$ git branch
* main
```

### 目標

將**兩張**孤兒工單（`T0022-prep-closure-and-push.md` 和 `T0023-archive-orphan-workorder-t0022-prep-closure.md`）同時納入 git 歷史，建立單一 atomic commit 並 push 到 origin/main，使工作樹完全乾淨。

## 任務指令

### BMad 工作流程
不適用（純 git chore）。

### 前置條件
1. ✅ Git 分支必須為 `main`
2. ✅ HEAD 必須為 `ccce0f7`（若不是，代表有新 commit 介入，STOP 回報）
3. ✅ 工作樹的未追蹤檔案**恰好為** `T0022-prep-closure-and-push.md` 和 `T0023-archive-orphan-workorder-t0022-prep-closure.md` **兩個**
   - 多於這兩個 → STOP 回報（有其他未預期變更）
   - 少於這兩個 → STOP 回報（狀態漂移）
   - `.git/` 內部檔案（如 index.lock）忽略不計
4. ✅ 除上述兩張未追蹤工單外，工作樹應無任何已修改 / 已暫存檔案
5. ✅ Pre-commit hook 必須存在（`.git/hooks/pre-commit`）
6. ✅ `origin/main` 必須可推送（網路連通 + 權限 OK）

### 輸入上下文
- **根目錄**：`D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal`
- **當前分支**：`main`
- **最新 commit**：`ccce0f7 chore(tower): close T0022-prep + register dogfood bugs + session checkpoint`
- **使用者已同意 push**：本 session 選項 [A]（塔台選項式提問的顯式授權）
- **策略依據**：
  - L014（塔台 state 檔案構成原子 commit 群組；本次孤兒工單與 ccce0f7 邏輯上屬於同一群組，但因時序錯位無法 amend，改為補一筆獨立 archival commit）
  - 本工單明確**不 amend** ccce0f7（避免改寫已 push 的歷史）

### 執行計畫：單一 archival commit（納入兩張孤兒工單）

**目標 commit**：
- Subject: `chore(tower): archive orphan sync workorders (T0022-prep-closure + T0023)`
- Files（共 2 張，順序不重要）：
  - `_ct-workorders/T0022-prep-closure-and-push.md`
  - `_ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md`

### 執行步驟

#### Step 1：前置驗證（必做）

```bash
# 1.1 確認分支
git branch --show-current
# 預期輸出：main

# 1.2 確認 HEAD
git rev-parse HEAD
# 預期輸出：ccce0f7cd2cde3825e057601572189424964bee6

# 1.3 確認恰好兩個孤兒工單為唯一未追蹤 / 未 commit 變更
git status --porcelain
# 預期輸出（順序不重要，但必須恰好這兩行）：
#   ?? _ct-workorders/T0022-prep-closure-and-push.md
#   ?? _ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md
#
# 比對規則：
# - 多於這兩行（有其他 ?? 或 M / A / D 等）→ STOP，有未預期變更
# - 少於這兩行（少任何一張）→ STOP，狀態漂移
# - 行數完全吻合且內容正確 → 通過
```

**若任一驗證失敗**：STOP 並在回報區記錄實際 `git status --porcelain` 完整輸出，不要繼續後續步驟，不要嘗試 `git reset` / `git clean` 任何檔案。

#### Step 2：Stage 兩張孤兒工單

```bash
git add _ct-workorders/T0022-prep-closure-and-push.md
git add _ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md
```

**只 add 這兩個檔案**。不要用 `git add .` 或 `git add -A`，防止誤加其他變更。

Verify:
```bash
git diff --cached --name-only
# 預期輸出（恰好這兩行，順序不重要）：
#   _ct-workorders/T0022-prep-closure-and-push.md
#   _ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md
```

**若輸出行數不是恰好 2**：STOP，執行 `git reset HEAD` 取消 stage（不動檔案內容），回報塔台。

#### Step 3：建立 archival commit

使用以下 commit message（用 HEREDOC 確保格式）：

```bash
git commit -m "$(cat <<'EOF'
chore(tower): archive orphan sync workorders (T0022-prep-closure + T0023)

Archive two orphan workorder files discovered by Control Tower *sync
on 2026-04-11 17:43:

1. T0022-prep-closure-and-push.md
   Created 17:27 by the previous tower session as a dispatch template
   for "commit tower state + push". The tower session then executed
   the dispatched work itself (ccce0f7 at 17:29), filling in the
   workorder's 回報區 with the resulting commit hash and push outcome
   — but the commit only staged _tower-state.md and forgot to
   git add the workorder file itself.

2. T0023-archive-orphan-workorder-t0022-prep-closure.md
   Created 17:43 by the current tower session to archive #1.
   v1 of this workorder naively asserted "working tree should contain
   only T0022 as untracked", which blocked the sub-session at Step 1.3
   (chicken-and-egg: T0023 itself is also untracked). Revised to v2
   at 17:56 to bring both orphan files into a single atomic commit.

Both files logically belong to the same archival action (tower *sync
discovery → remediation), consistent with L014's "tower files form
atomic commit groups" principle.

Detected by: Control Tower *sync (2026-04-11 17:43)
Related commit: ccce0f7 (chore(tower): close T0022-prep + ...)
Refs: T0022-prep-closure-and-push, T0023

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

**若 pre-commit hook 失敗**：
- 讀取 hook 的錯誤訊息
- 在回報區記錄完整錯誤輸出
- STOP 並回報塔台，不要 `--no-verify` 繞過
- 不要 amend、不要 reset、不要對既有 commit 做任何操作

#### Step 4：驗證 commit 內容

```bash
git log --oneline -2
# 預期最新兩筆：
#   <new-sha> chore(tower): archive orphan sync workorders (T0022-prep-closure + T0023)
#   ccce0f7   chore(tower): close T0022-prep + register dogfood bugs + session checkpoint

git show --stat HEAD
# 預期：恰好兩個檔案
#   _ct-workorders/T0022-prep-closure-and-push.md
#   _ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md
```

**若 commit 包含多於兩個檔案，或少於兩個檔案**：STOP 回報。此情境代表 Step 1 的驗證有漏網之魚或 stage 步驟出錯，不應繼續 push。

#### Step 5：Push 到 origin/main

```bash
git push origin main
```

**預期輸出**：`ccce0f7..<new-sha>  main -> main`

**若 push 被拒絕**：
- 🛑 **不要 `--force` 或 `--force-with-lease`**
- 讀取錯誤訊息（通常是 remote 有新 commits）
- STOP 並在回報區記錄完整錯誤
- 回報塔台，讓塔台決定是否要先 `git fetch` + `git pull --rebase`

#### Step 6：最終驗證

```bash
# 6.1 工作樹完全乾淨
git status --porcelain
# 預期輸出：（空，什麼都沒有）

# 6.2 HEAD 已推送
git rev-parse HEAD origin/main
# 預期兩行 SHA 完全相同

# 6.3 最近 3 筆 commit 齊全
git log --oneline -3
# 預期：
#   <new-sha>  chore(tower): archive orphan sync workorders (T0022-prep-closure + T0023)
#   ccce0f7    chore(tower): close T0022-prep + register dogfood bugs + session checkpoint
#   aedba6c    chore(tower): record L016 + close T0021 handover + dispatch T0022-prep
```

### 不動範圍（避免 scope creep）

- ❌ **不 amend ccce0f7**：已 push 的歷史不改寫
- ❌ **不合併兩個 commit**：本工單明確要求獨立 archival commit
- ❌ **不修改 T0022-prep-closure-and-push.md 的內容**：保持原封不動，只歸檔
- ❌ **不修改 _tower-state.md、_learnings.md 或任何其他檔案**：本次只動這一張孤兒工單
- ❌ **不修改 `.gitignore`**：pre-commit hook 正常運作即可
- ❌ **不 `git add .` 或 `-A`**：只精準 add 單一檔案
- ❌ **不跑 build、test、lint**：與本工單無關
- ❌ **不產生任何新文件**：只動這一張工單的 git 狀態

### 驗收條件

- [ ] Step 1-6 全部通過
- [ ] 產生一筆 `chore(tower)` commit，訊息符合範本
- [ ] Commit 恰好包含兩個檔案：
  - `_ct-workorders/T0022-prep-closure-and-push.md`
  - `_ct-workorders/T0023-archive-orphan-workorder-t0022-prep-closure.md`
- [ ] Push 成功，`origin/main` 前進至新 SHA
- [ ] `git status --porcelain` 輸出為空
- [ ] Pre-commit hook 通過（未被 `--no-verify` 繞過）
- [ ] 整個流程沒有 rollback、沒有 reset、沒有 amend

### 失敗處理

| 情境 | 行動 |
|------|------|
| Step 1 驗證失敗（工作樹未追蹤檔案不是恰好這兩張） | STOP，不 add、不 commit；在回報區記錄 `git status --porcelain` 完整輸出；回報塔台 |
| HEAD 不是 `ccce0f7` | STOP；代表有新 commit 介入；回報 `git log --oneline -5` 輸出 |
| Pre-commit hook 擋下 commit | STOP；不 `--no-verify`；在回報區貼完整錯誤；回報塔台 |
| Commit 包含多於或少於兩個檔案 | STOP；執行 `git reset HEAD`（僅取消 stage，不動檔案內容）；回報塔台 |
| Push 被 remote 拒絕 | STOP；不 `--force`；在回報區記錄錯誤；回報塔台 |
| 網路或權限錯誤 | STOP；在回報區記錄錯誤；回報塔台 |

## Sub-session 執行指示

### 執行步驟

1. 載入本工單（`/ct-exec T0023-archive-orphan-workorder-t0022-prep-closure`）
2. 按順序執行 Step 1 → Step 6
3. 任何一步驟出現非預期結果，立即 STOP 並在回報區記錄
4. 全部通過後，填寫回報區並呼叫 `/ct-done`

### 學習鉤子

本工單的學習候選（請在回報區的「學習鉤子候選」列出）：
- 塔台在 session 結束前產生工單後，是否應該將工單檔案視為「必 commit 產物」納入下一次 commit？
- 「塔台直接執行原本要派發給 sub-session 的工作」這個反模式是否值得形成一條 anti-pattern 規則？
- `*sync` 對孤兒工單的偵測邏輯是否應該內建於塔台啟動流程？

這些只是候選，不強制採納。如有其他觀察歡迎補充。

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**新 Commit hash + message**：`dc76077 chore(tower): archive orphan sync workorders (T0022-prep-closure + T0023)`
**Push 結果**：`ccce0f7..dc76077  main -> main`
**分支狀態**：`main`，`HEAD == origin/main`，`git status --porcelain` 為空

### git log 輸出（最後 3 筆）

```
dc76077 (HEAD -> main, origin/main, origin/HEAD) chore(tower): archive orphan sync workorders (T0022-prep-closure + T0023)
ccce0f7 chore(tower): close T0022-prep + register dogfood bugs + session checkpoint
aedba6c chore(tower): record L016 + close T0021 handover + dispatch T0022-prep
```

### Pre-commit hook 觸發結果

```
[tower-hook][WARN] potential sensitive content in _ct-workorders/T0022-prep-closure-and-push.md:
235:  - `1030:- \`password=test123\` 測試檔 commit 驗證 WARN 可觸發，且不阻擋 commit（驗證後已 reset 並刪除測試檔）`
246:- chore(tower) 對 `_tower-state.md` 提交時，hook 容易因描述字串（如 `password=test123`）觸發 WARN；需人工判定 false positive，但不會阻擋 commit。

[tower-hook][WARN] found 1 file(s) with potential sensitive content
[tower-hook][WARN] this hook does NOT block commit; please review manually
```

### 互動紀錄

無

### 遭遇問題

無

### 學習鉤子候選

- `ct-exec` 的「開工即寫狀態」若遇到「未追蹤檔案必須精準比對」型工單，容易形成流程層衝突；應在工單前置條件明確排除當前工單檔案或採 v2 這種原子打包策略。
- pre-commit 關鍵字檢查對歷史描述字串（如 `password=test123`）會產生 false positive WARN；目前「警告不阻擋」策略可接受，但回報區應固定記錄人工判讀結果。

### v1 BLOCK 歷史（由塔台保留，供學習用途，不要刪除）

**v1 執行時間**：2026-04-11 17:53 (UTC+8)
**v1 結果**：BLOCKED at Step 1.3
**v1 根因**：工單設計忽略「T0023 檔案本身為未追蹤檔案」的事實，導致前置驗證必然失敗
**v1 sub-session 的防呆決策**：**正確** — 嚴格遵守「驗證失敗即 STOP」規則，未嘗試繞過
**v1 學習鉤子候選**（由 sub-session 提出，塔台同意並保留）：
> 工單流程層級衝突：`ct-exec` 要求「開工即更新工單狀態/開始時間」，但本工單 Step 1 又要求「僅允許 T0022 為唯一變更」。建議在前置條件明確排除「當前執行工單檔案」，或將狀態寫入延後到 Step 1 後。

**v2 修正**：2026-04-11 17:56 由塔台修訂，改為納入兩張孤兒工單於單一 atomic commit，徹底避開雞生蛋蛋生雞悖論。

### 回報時間
2026-04-11 18:08 (UTC+8)
