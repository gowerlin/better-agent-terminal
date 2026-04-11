# 工單 T0021-commit-bug006-hotfix-and-tower-state

## 元資料
- **編號**：T0021
- **類型**：Chore (git operation)
- **狀態**：IN_PROGRESS
- **優先級**：🔴 高（手邊有未提交變更，阻塞下一張工單）
- **建立時間**：2026-04-11 15:57 (UTC+8)
- **開始時間**：2026-04-11 16:31 (UTC+8)
- **派發者**：Control Tower
- **前置工單**：T0020（已 DONE）
- **目標子專案**：（單一專案）

## 工作量預估
- **Session 建議**：🆕 新 session（乾淨 context，純 git 操作）
- **預估時間**：5-10 分鐘
- **複雜度**：低（標準 git workflow，無決策點）

## Session 建議
本工單為純 git 操作，不涉及程式邏輯。建議開新的乾淨 session 執行，避免污染當前塔台 context。

## 背景

### 來源
T0020（BUG-006: AudioWorklet 在 packaged Electron build 無法載入）已在 2026-04-11 15:47 完成 runtime 驗證（使用者直接拿 sub-session 產出的 packaged build 實機測試，一次通過）。Sub-session hotfix 零 rollback 一次到位，L013 GOLDEN 第三次連續實戰驗證成立。

### 手邊未提交的變更
```
M  src/lib/voice/recording-service.ts                       (+10/-4)
??  public/voice-worklet/recording-worklet-processor.js     (新增 static asset)
```

塔台同時有狀態/學習檔案的更新（屬於另一個語意群組）：
```
M  _ct-workorders/_tower-state.md                (15:47 checkpoint + L013 第三次驗證紀錄)
M  _ct-workorders/_learnings.md                  (L013 追加 + L015→TG008 stub)
M  _ct-workorders/T0020-bug006-...md             (狀態 PARTIAL → DONE)
M  ~/.claude/control-tower-data/learnings/tech-gotchas.md   (新增 TG008)
A  _ct-workorders/T0021-commit-bug006-...md      (本工單)
```

## 任務指令

### BMad 工作流程
不適用（純 git chore）

### 前置條件
1. ✅ T0020 狀態為 DONE
2. ✅ `recording-service.ts` + `public/voice-worklet/recording-worklet-processor.js` 已通過 packaged runtime 驗證
3. ✅ 塔台 state / learnings 已同步（由塔台 session 完成）

### 輸入上下文
- **根目錄**：`D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal`
- **當前分支**：`main`
- **最新 commit**：`6a9b5b5 fix: remove manual tag push, let release action create tag via API`
- **策略依據**：L014（塔台 state 檔案構成原子 commit 群組）

### 執行計畫：兩個獨立的 atomic commits

#### Commit 1：功能修復 `fix(voice)`
**範圍**：只包含 BUG-006 hotfix 的程式碼變更
**檔案**：
- `src/lib/voice/recording-service.ts`
- `public/voice-worklet/recording-worklet-processor.js`

**commit message**（使用 heredoc）：
```
fix(voice): use static worklet asset for packaged build (BUG-006)

Vite transforms recording-worklet-processor.ts into a
data:video/mp2t;base64,... URL during build, causing
audioWorklet.addModule() to fail in the packaged Electron
app while working fine in dev mode.

Move the worklet to public/voice-worklet/ as a static JS
asset and load it via window.location.href based path
resolution. This ensures the worklet is served as a real
.js file from both dev server and packaged app.

Verified: packaged build (release/win-unpacked) runtime
tested end-to-end voice recording by user in one shot with
no further code changes needed.

Refs: T0020, BUG-006
```

#### Commit 2：塔台記憶 `chore(tower)`
**範圍**：塔台狀態與學習檔案（符合 L014 atomic group）
**檔案**：
- `_ct-workorders/_tower-state.md`
- `_ct-workorders/_learnings.md`
- `_ct-workorders/T0020-bug006-worklet-load-in-packaged-build.md`
- `_ct-workorders/T0021-commit-bug006-hotfix-and-tower-state.md`（本工單自己）
- `~/.claude/control-tower-data/learnings/tech-gotchas.md`（⚠️ 此檔案屬於全局 claude 設定，**不在本 repo 內**，不要包進 commit）

**⚠️ 注意**：global tech-gotchas.md 位於 `~/.claude/control-tower-data/learnings/` 目錄，這是 claude 的全局設定路徑，**不屬於本專案 git repo**，**不要 `git add` 它**。該檔案的版本管理由 claude-brain 或其他機制處理。只 add 專案 repo 內的檔案。

**commit message**（使用 heredoc）：
```
chore(tower): close BUG-006 / mark T0020 DONE / elevate L015 to global

- Tower state: add 15:47 checkpoint for T0020 DONE + BUG-006 resolved
- Learnings: add third real-world validation of L013 GOLDEN rule
  (T0017-β + T0018 + T0020, three consecutive hits across three
   different technical layers: React/Audio, Rollup/build, Vite/asset)
- Learnings: L015 (Electron dev vs packaged runtime divergence)
  elevated to Global layer as TG008 (project stub retained as
  pointer for traceability)
- T0020: status PARTIAL -> DONE (user verified packaged build
  runtime in one shot, zero rollback)
- T0021: this commit workorder

Refs: T0020, T0021, BUG-006, L013, L015, TG008
```

### 執行步驟

#### 步驟 1：確認當前狀態（安全檢查）
```bash
cd "D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal"
git status
git branch --show-current
```
**預期**：
- branch = `main`
- 看到兩組變更：
  1. 功能檔案：`recording-service.ts`, `public/voice-worklet/`
  2. 塔台檔案：`_tower-state.md`, `_learnings.md`, `T0020-...md`, `T0021-...md`

#### 步驟 2：產生 Commit 1（功能修復）
```bash
git add src/lib/voice/recording-service.ts public/voice-worklet/recording-worklet-processor.js
git status  # 確認只有這兩個檔案在 staging
git commit -m "$(cat <<'EOF'
fix(voice): use static worklet asset for packaged build (BUG-006)

Vite transforms recording-worklet-processor.ts into a
data:video/mp2t;base64,... URL during build, causing
audioWorklet.addModule() to fail in the packaged Electron
app while working fine in dev mode.

Move the worklet to public/voice-worklet/ as a static JS
asset and load it via window.location.href based path
resolution. This ensures the worklet is served as a real
.js file from both dev server and packaged app.

Verified: packaged build (release/win-unpacked) runtime
tested end-to-end voice recording by user in one shot with
no further code changes needed.

Refs: T0020, BUG-006
EOF
)"
git log -1 --stat
```

#### 步驟 3：產生 Commit 2（塔台記憶）
```bash
git add _ct-workorders/_tower-state.md \
        _ct-workorders/_learnings.md \
        _ct-workorders/T0020-bug006-worklet-load-in-packaged-build.md \
        _ct-workorders/T0021-commit-bug006-hotfix-and-tower-state.md
git status  # 確認只有這四個塔台檔案在 staging
git commit -m "$(cat <<'EOF'
chore(tower): close BUG-006 / mark T0020 DONE / elevate L015 to global

- Tower state: add 15:47 checkpoint for T0020 DONE + BUG-006 resolved
- Learnings: add third real-world validation of L013 GOLDEN rule
  (T0017-β + T0018 + T0020, three consecutive hits across three
   different technical layers: React/Audio, Rollup/build, Vite/asset)
- Learnings: L015 (Electron dev vs packaged runtime divergence)
  elevated to Global layer as TG008 (project stub retained as
  pointer for traceability)
- T0020: status PARTIAL -> DONE (user verified packaged build
  runtime in one shot, zero rollback)
- T0021: this commit workorder

Refs: T0020, T0021, BUG-006, L013, L015, TG008
EOF
)"
git log -1 --stat
```

#### 步驟 4：最終驗證
```bash
git status  # 應該是 clean working tree
git log --oneline -3  # 應該看到 Commit 2, Commit 1, 然後是先前的 6a9b5b5
```

### 不動範圍（避免 scope creep）
- **不要 push**：使用者未明確要求 push，本工單範圍到 commit 為止
- **不要合併 commit**：兩個 commits 必須獨立，符合 L014 atomic group 原則
- **不要動 `~/.claude/control-tower-data/`**：該目錄不在本 repo，不要加進 git
- **不要動 `release/` `dist/` `node_modules/`**：這些本來就在 `.gitignore`
- **不要修改任何程式碼**：純 git 操作，不碰 `.ts` `.js` 等原始碼
- **不要改 commit message**：若 hook 擋下 commit，診斷原因並回報，不要拿掉訊息內容

### 驗收條件
1. ✅ `git log --oneline -3` 顯示兩個新 commits（`fix(voice)` + `chore(tower)`），在 `6a9b5b5` 之前
2. ✅ `git status` 乾淨（working tree clean）
3. ✅ `git show HEAD~1 --stat` 顯示 Commit 1 只動了 2 個檔案（功能檔）
4. ✅ `git show HEAD --stat` 顯示 Commit 2 只動了 4 個檔案（塔台檔，含本工單）
5. ✅ 兩個 commits 的順序正確：先 `fix(voice)`（HEAD~1），再 `chore(tower)`（HEAD）

### 失敗處理
- 若 `git add` 意外 staging 了不該加的檔案 → `git restore --staged <file>` 後重來
- 若 commit hook 失敗（例如 pre-commit）→ 讀取錯誤訊息，回報塔台，不要用 `--no-verify` 繞過
- 若順序錯了（chore 先於 fix）→ 不用 `rebase -i`，直接回報塔台讓塔台決定如何修正
- 若發現有其他未追蹤的檔案（例如 `release/` 或 `dist/`）→ 確認它們在 `.gitignore`，不要動

## Sub-session 執行指示

### 執行步驟
1. 切到專案根目錄 `D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal`
2. 執行步驟 1 的安全檢查
3. 執行步驟 2 的 Commit 1
4. 執行步驟 3 的 Commit 2
5. 執行步驟 4 的最終驗證
6. 將 git log 輸出填入「回報區 / 產出摘要」
7. 更新本工單「狀態」為 DONE
8. 回到塔台回報「T0021 完成」

### 學習鉤子
若遇到下列情況，記錄到「學習鉤子候選」：
- commit message hook 因為 fix/chore prefix 或檔案類型被擋
- 意外發現 `.gitignore` 漏抓某些產物目錄
- hidden changes（例如 CRLF 轉換、BOM 差異）導致 diff 不符預期

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
<DONE / PARTIAL / FAILED / BLOCKED>

### 產出摘要
<兩個 commit 的 hash + message 標題 + file list>

### git log 輸出
```
<git log --oneline -3 的輸出>
```

### 互動紀錄
<若有任何對塔台的問題或 escalation>

### 遭遇問題
<若有 hook 阻擋、順序錯亂、檔案遺漏等狀況>

### 學習鉤子候選
<若本次 chore 工單揭露值得記錄的 git / hook / workflow 陷阱>

### sprint-status.yaml 已更新
不適用（專案無 sprint-status.yaml）

### 回報時間
<YYYY-MM-DD HH:MM (UTC+8)>
