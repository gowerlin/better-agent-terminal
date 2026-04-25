# T0258-resume-t0255-cherrypick-chain

## 元資料
- **工單編號**：T0258
- **任務名稱**：續做 T0255 cherry-pick 鏈 — #5 收尾 + #6-#8 + version.json + T0255 收尾
- **狀態**：DONE
- **開始時間**：2026-04-25 20:30 (UTC+8)
- **完成時間**：2026-04-25 20:50 (UTC+8)
- **類型**：implementation
- **互動模式**：**enabled**（ClaudeAgentPanel 客製手併保留詢問空間）
- **Renew 次數**：0
- **建立時間**：2026-04-25 20:30 (UTC+8)
- **預估 wall time**：~40-60 min（#5 收尾 5 min + #6-#8 各 ~10-15 min + 收尾 commit 5 min）
- **預估 context cost**：中-高（ClaudeAgentPanel 大檔逐段手併）
- **關聯**：
  - 母工單：T0255（IN_PROGRESS，本工單代為續做完成後可標 DONE）
  - 前置研究：T0257（盤點報告 + 推薦選項 A）
  - 後續：Phase 1 全部完成 → 另開 commit 更新 `version.json` `lastSyncCommit = f364e38`
- **affects_files**：
  - `src/components/ClaudeAgentPanel.tsx`（**BAT 重度客製，逐段手併**）
  - `src/components/CodexAgentPanel.tsx`
  - `electron/claude-agent-manager.ts`
  - `electron/main.ts`
  - `version.json`（最後 commit）
  - `_ct-workorders/T0255-*.md`（母工單收尾紀錄）
  - `_ct-workorders/T0257-*.md`（隨同 commit，目前 untracked）
  - `_ct-workorders/T0258-*.md`（自身回報）

---

## 任務目標

從 T0257 盤點的中斷點接續，完成 T0255 剩餘 cherry-pick 鏈：

1. **#5 收尾**（已手解 conflict，採 ours，只欠 add + continue）
2. **#6-#8 cherry-pick**（依 T0255 工單表順序）
3. **version.json 更新**（`lastSyncCommit = f364e38`）
4. **T0255 母工單收尾**（標 DONE + 填回報 + 連同 T0257 一起 commit 工單檔）

---

## 執行步驟

### Step 0：起手檢查（必須先讀）

1. 讀完 `_ct-workorders/T0255-*.md` 最後一段 CHECKPOINT（line 158-192 附近，T0257 證實該 CHECKPOINT 已備齊「關鍵 context」清單）
2. 讀完 `_ct-workorders/T0257-*.md` 「調查結論」與「建議方向」
3. 確認 git 狀態與 T0257 回報一致：
   ```bash
   git status
   test -f .git/CHERRY_PICK_HEAD && cat .git/CHERRY_PICK_HEAD
   ```
   應為 `220b093...`，UU 檔仍 unmerged 但工作樹已無 conflict markers，main.ts staged。

### Step 1：完成 #5（`220b093` open external links in system browser）

```bash
git add src/components/ClaudeAgentPanel.tsx src/components/CodexAgentPanel.tsx electron/main.ts
git diff --cached --stat
git cherry-pick --continue
git log -1 --format="%h %s"
```

驗收：
- HEAD message 應為 `fix: open external links in system browser`（或 cherry-pick 加上 `(cherry picked from commit 220b093)` trailer）
- `.git/CHERRY_PICK_HEAD` 不再存在
- working tree 乾淨（除工單檔 untracked）

### Step 2：cherry-pick #6（`18e1abf` preserve whitespace inside code blocks）

```bash
git cherry-pick 18e1abf
```

預期目標檔：rendering 相關，可能命中 ClaudeAgentPanel.tsx 的 markdown / code block render 區段。

**若 conflict**：
- 仔細閱讀 ClaudeAgentPanel 該區段的 BAT 客製（含 BAT_BUILTIN_MODELS / MODEL_PRICING / worker / supervisor 整合等）
- 逐段手併，不可機械接受 upstream 整段
- conflict 範圍不確定 → 透過互動模式詢問使用者要 ours / theirs / 手併的策略

驗收：build 應仍可過（編譯級別）。本工單不跑 `npm run build`，留給 T0255 母工單收尾或下一張驗收工單；但邏輯上需確保不引入語法錯誤。

### Step 3：cherry-pick #7（`b918f20` update contextWindow label immediately on model switch）

```bash
git cherry-pick b918f20
```

預期目標檔：ClaudeAgentPanel.tsx 的 model switch handler 區段。BAT 對 model 列表 / pricing 有客製（見 CLAUDE.md），逐段手併時保留 BAT 客製欄位。

### Step 4：cherry-pick #8（`b872049` fork-session: wait for result before aborting）

```bash
git cherry-pick b872049
```

預期目標檔：claude-agent-manager.ts 的 fork-session abort flow。

### Step 5：更新 version.json

```bash
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('version.json','utf8'));j.lastSyncCommit='f364e38';fs.writeFileSync('version.json',JSON.stringify(j,null,2)+'\n')"
git diff version.json
git add version.json
git commit -m "chore(sync): update lastSyncCommit to f364e38 (Phase 1 C3 done)"
```

### Step 6：T0255 母工單收尾

1. 編輯 `_ct-workorders/T0255-*.md`：
   - 元資料：狀態 IN_PROGRESS → DONE、補 完成時間
   - 補「回報」區段（執行紀錄、commits 列表、conflict 處理摘要、跨檔影響）
2. 編輯本工單（T0258）回報區
3. 確認 T0257 工單檔已 untracked

### Step 7：commit 工單檔

```bash
git add _ct-workorders/T0255-*.md _ct-workorders/T0257-*.md _ct-workorders/T0258-*.md
git status
git commit -m "chore(workorder): T0255 done + T0257/T0258 trace"
```

不 push（依 CLAUDE.md 規則，push 由使用者決定）。

---

## AC（acceptance criteria）

- AC1：T0255 #5-#8 全部 cherry-pick 完成（HEAD 上看得到 4 個新 commit + cherry-picked from trailer）
- AC2：`.git/CHERRY_PICK_HEAD` 不再存在
- AC3：`git status` 乾淨（無 unmerged、無 untracked，除已 commit 的工單檔）
- AC4：`version.json.lastSyncCommit === "f364e38"`
- AC5：T0255 母工單元資料狀態為 DONE
- AC6：所有 commit 都 follow CLAUDE.md 風格（無 Claude trailer，attribution 已 disabled）
- AC7：ClaudeAgentPanel.tsx 的 BAT 客製（BAT_BUILTIN_MODELS / MODEL_PRICING / worker / supervisor）保留完整

---

## 嚴格禁止

- ❌ 跑 `npm run build` / `npm install` / dev server（本工單不負責 runtime 驗收，留給後續驗收工單或母工單收尾時決策）
- ❌ `git push`（依 CLAUDE.md，push 由使用者決定）
- ❌ 跨工單決策 — 若中途遇到 ClaudeAgentPanel 客製手併方向不確定，**透過互動模式詢問使用者**，不要自行猜測 upstream 意圖
- ❌ 修改塔台 meta 檔（`_tower-state.md` / `_decision-log.md`）

---

## 互動模式說明

本工單 `互動模式: enabled`。Worker 遇到以下情境**應**詢問使用者：
1. ClaudeAgentPanel.tsx conflict 中無法判定 BAT 客製是否要保留 vs upstream 改寫
2. cherry-pick 失敗（merge conflict 在客製欄位）需 ours / theirs 策略
3. 任何超出 T0255 工單表 8 個 commit 範圍的意外修改

每次提問上限：3 個問題（research_max_questions 預設）。

---

## 回報

### 完成狀態

DONE — 8 個 cherry-pick 全數完成 + version.json 更新 + T0255 母工單收尾。AC1-AC7 全通過（runtime build 依工單禁止規則未跑,屬靜態驗收完成）。

### 產出摘要

**新增 4 個 cherry-pick commit（接續 T0255 #4 之後）**：

| # | Hash | Subject | conflict 處理 |
|---|------|---------|--------------|
| 5 | `302a065` | fix: open external links in system browser | T0255 已手解 conflict markers,T0258 僅 `git add` + `cherry-pick --continue`。Claude/CodexAgentPanel 採 ours（與 HEAD 相同,僅 main.ts 13 行新增） |
| 6 | `4c1de15` | fix(agent): preserve whitespace inside code blocks (#90) | conflict 在 imports 區（HEAD: `useVoicePopover`/`MicButton`/`openChatMarkdownLink`; theirs: 舊 inline `renderChatMarkdown`）。BAT 已抽 fn 到 `src/utils/chat-markdown.ts` 並早就套同等 mask `<pre>/<code>` 修復 → 採 ours。為保 traceability `git commit --allow-empty -C 18e1abf` 後 `--amend` 補 `(cherry picked from ...)` trailer。**empty commit** |
| 7 | `8b07399` | fix(claude): update contextWindow label immediately on model switch | upstream 引用 BAT 已不接受的 `autoCompactWindow` 參數,且 V2/no-query/success/catch 路徑的 `send('claude:status')` 在 BAT 1678/1684/1691/1696 已存在（git auto-merge 那 3 hunks）。手解保留 contextWindow/maxOutputTokens sync,丟棄 autoCompactWindow 兩行 |
| 8 | `f96eb35` | fix(fork-session): wait for result before aborting so transcript persists | git auto-merge,無 conflict |

**第 5 個新 commit**：
- `acc4a81 chore(sync): update lastSyncCommit to f364e38 (Phase 1 C3 done)`
  - `version.json.upstream.lastSyncCommit`: `5d9f486` → `f364e38`
  - `version.json.upstream.lastSyncDate`: `2026-04-18` → `2026-04-25`
  - `syncNote` 改為 T0255/T0258 Phase 1 C3 摘要

**檔案變動**：
- `electron/main.ts` (#5,+13)
- `src/components/ClaudeAgentPanel.tsx` (#6 conflict 解析,實際 diff 為 0)
- `electron/claude-agent-manager.ts` (#7 +9 / #8 +16/-1)
- `version.json` (acc4a81 +3/-3)

### Renew 歷程

無

### 互動紀錄

無 — Worker 全程依 CHECKPOINT 與 T0257 盤點報告自主決策,未觸發互動模式（主要決策點如「empty commit 是否保留」「autoCompactWindow 是否丟棄」「contextWindow sync 邏輯保留」皆有明確線索可推斷,符合 fire-and-forget context-dependent 邊界）

### 遭遇問題

1. **#6 cherry-pick empty 後 git 提示 `--allow-empty`**：BAT 已在 `utils/chat-markdown.ts` 套同等修復,`git cherry-pick --continue` 直接 abort。改用 `git commit --allow-empty -C 18e1abf` 後再 `--amend --allow-empty -F` 補 cherry-pick trailer。empty commit 對程式碼是 no-op,但保留 sync 歷史可追溯性。
2. **#7 conflict 中 `autoCompactWindow` 變數不在 scope**：BAT `setModel(sessionId, model)` 簽名已不含此參數。決策：保留 contextWindow/maxOutputTokens sync(本 commit 的核心修復),丟棄 autoCompactWindow 兩行(BAT 在 setModel 不需要)。

### AC 驗收

- ✅ AC1：4 個新 commit (302a065/4c1de15/8b07399/f96eb35) 全部含「fix(...)」message + cherry-picked-from trailer
- ✅ AC2：`.git/CHERRY_PICK_HEAD` 不存在
- ✅ AC3：`git status` 乾淨（除工單檔 untracked,將於 Step 7 一併 commit）
- ✅ AC4：`version.json.lastSyncCommit === "f364e38"`
- ✅ AC5：T0255 元資料狀態 = DONE,完成時間已填
- ✅ AC6：所有 commit message 無 Claude trailer（attribution 已 disabled）,沿用 upstream 原作者署名 + 原 Co-Authored-By
- ✅ AC7：ClaudeAgentPanel.tsx BAT 客製（utils/chat-markdown 抽離、useVoicePopover、MicButton、scroll refs 等）完整保留;claude-agent-manager.ts 的 BAT_BUILTIN_MODELS / setModel 簽名 / send('claude:status') 全分支發送邏輯保留
