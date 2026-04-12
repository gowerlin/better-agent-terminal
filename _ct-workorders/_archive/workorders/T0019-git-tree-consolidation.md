# 工單 T0019-git-tree-consolidation

## 元資料
- **工單編號**：T0019
- **任務名稱**：工作樹整理 — 累積變更分組、原子 commit（不 push）
- **狀態**：DONE
- **類型**：Chore（git hygiene）
- **前置條件**：T0017-β DONE、T0018 DONE、所有 voice 相關修復已完成
- **嚴重度**：🟡 MEDIUM（阻擋下一 session 乾淨開工，但非功能阻斷）
- **預估工時**：20 - 30 分鐘（硬性上限 40 分鐘）
- **建立時間**：2026-04-11 14:05 (UTC+8)
- **建立者**：Control Tower
- **開始時間**：2026-04-11 14:12 (UTC+8)
- **完成時間**：2026-04-11 14:14 (UTC+8)
- **目標子專案**：better-agent-terminal

## 工作量預估
- **預估規模**：小 - 中
- **Context Window 風險**：低（git diff 讀取 + 分組判斷，不需深入程式碼語意）
- **降級策略**：若變更比想像中複雜，至少完成：(a) 塔台 state 檔案 commit、(b) T0018 工單本身 commit，剩下報 PARTIAL 由使用者手動處理

## Session 建議
- **建議類型**：🔄 原 Session（本塔台 session 已準備交接，可以直接在本 session 跑）
- **原因**：git 操作不需要大量 context，原 session 執行後馬上能進入下一步

## 任務指令

### BMad 工作流程
無

### 前置條件
需載入的文件清單：
- 本工單全文
- 無需讀任何原始碼（純 git 操作）

### 輸入上下文

#### 專案背景
better-agent-terminal 剛完成 Phase 1 voice input 實作，連續通過 T0017-β（BUG-004）和 T0018（BUG-005）兩次治本修復。本 tower session 從 T0017-β PARTIAL 狀態接手，做了以下塔台側更新：

- `_ct-workorders/_learnings.md`：L013 追加兩次實戰驗證紀錄 + GOLDEN rule 升級
- `_ct-workorders/_tower-state.md`：13:49 checkpoint + 14:0? checkpoint
- `_ct-workorders/T0017-beta-audioworklet-migration.md`：狀態 PARTIAL → DONE
- `_ct-workorders/T0018-fix-whisper-addon-load.md`：新建

並且 sub-session 已做兩次 commit：
- `08b4856`：fix(voice): replace ScriptProcessorNode with AudioWorklet（T0017-β）
- `9003f29`：whisper addon external（T0018，commit 訊息由 sub-session 決定）

#### 既有未提交變更（session 起點，可能已部分被 T0017-β / T0018 sub-session 處理）

**Modified（可能已被其中一個 commit 消化）**：
- `electron/logger.ts`（可能來自 T0014 crash-safe logging）
- `electron/main.ts`（T0013 IPC handler 註冊時機修復）
- `electron/preload.ts`
- `electron/remote/protocol.ts`
- `electron/voice-handler.ts`
- `src/components/SettingsPanel.tsx`
- `src/locales/{en,zh-CN,zh-TW}.json`
- `src/stores/settings-store.ts`
- `src/types/electron.d.ts`
- `src/types/index.ts`

**Untracked（多為歷史工單檔案）**：
- `_ct-workorders/T0013-*.md` 到 `T0018-*.md` 和 `T0017-alpha-*.md` / `T0017-beta-*.md`
- `_ct-workorders/_tower-config.yaml`
- `_ct-workorders/reports/*.md` 和 `.txt`
- `src/types/voice-ipc.ts`（T0013 hotfix 時新增的 IPC channel 常數）

> ⚠️ 這只是 session 起點的 snapshot，實際當前狀態**必須以 `git status` 為準**。T0017-β 和 T0018 的 sub-session 在 commit 時可能各自 stage 了不同檔案。

### 技術藍圖

#### Phase A：盤點現況（預算 5 分鐘）

1. **讀取當前 git 狀態**：
   ```bash
   git status
   git log --oneline -10
   git diff --stat HEAD
   ```

2. **確認兩個 commit 已存在**：
   ```bash
   git log --oneline | grep -E "(08b4856|9003f29)"
   ```
   若其中一個不存在，**立即停手回報 BLOCKED**（commit 可能沒推送成功，需要使用者介入）。

3. **輸出盤點清單**到回報區 §2：
   - 已 staged 但未 commit 的檔案
   - unstaged modified 檔案
   - untracked 檔案
   - 每個檔案的變更摘要（git diff --stat）

#### Phase B：分組為原子 commit（預算 10 - 15 分鐘）

基於檔案的**語意主題**分組。建議分組（sub-session 可調整）：

**Group 1：塔台 state 檔案**（高優先級，下一 session 會用到）
- `_ct-workorders/_tower-state.md`
- `_ct-workorders/_learnings.md`
- `_ct-workorders/_tower-config.yaml`
- Commit 訊息範例：
  ```
  chore(tower): update state after BUG-004/005 resolution

  - Add 13:49 + 14:0? checkpoints for T0017-β and T0018 completion
  - Upgrade L013 to GOLDEN rule with 2× runtime validation
  - Add project tower config
  ```

**Group 2：歷史工單檔案集合**（未追蹤的工單檔）
- `_ct-workorders/T0013-fix-voice-download-ipc-drift.md`
- `_ct-workorders/T0014-crash-safe-logging.md`
- `_ct-workorders/T0015-bug004-voice-crash-audit.md`
- `_ct-workorders/T0016-bug004-voice-crash-hotfix.md`
- `_ct-workorders/T0016-pre-windbg-dmp-analysis.md`
- `_ct-workorders/T0017-alpha-audioprocess-tick-checkpoint.md`
- `_ct-workorders/T0017-beta-audioworklet-migration.md`
- `_ct-workorders/T0018-fix-whisper-addon-load.md`
- `_ct-workorders/reports/*.md` 和 `.txt`
- Commit 訊息範例：
  ```
  docs(ct): archive Phase 1 voice input work orders (T0013 - T0018)
  ```

**Group 3：BUG-004 相關的 voice / electron 變更**（若 T0017-β commit 沒包含這些）
- `electron/voice-handler.ts`
- `electron/remote/protocol.ts`
- `src/types/voice-ipc.ts`
- 判斷依據：`git log -p 08b4856` 查 T0017-β commit 是否已包含這些

**Group 4：T0013 IPC handler 修復殘留**（若未 commit）
- `electron/main.ts`
- `electron/preload.ts`
- `src/types/electron.d.ts`
- Commit 訊息範例：`fix(voice): register IPC handlers after app.whenReady (T0013)`

**Group 5：T0014 crash-safe logging 殘留**（若未 commit）
- `electron/logger.ts`
- Commit 訊息範例：`feat(log): crash-safe logging with async flush (T0014)`

**Group 6：Voice Settings UI 殘留**（若未 commit）
- `src/components/SettingsPanel.tsx`
- `src/stores/settings-store.ts`
- `src/types/index.ts`
- `src/locales/{en,zh-CN,zh-TW}.json`
- Commit 訊息範例：`feat(ui): voice input settings panel and i18n (T0009)`

#### Phase C：執行 commit（預算 5 - 10 分鐘）

1. **對每個 group 執行**：
   ```bash
   git add <group files>
   git diff --staged --stat  # 確認無誤
   git commit -m "<message>"
   ```
2. **每個 commit 後跑 `git status`** 確認剩餘檔案
3. **順序建議**：Group 1（tower state）→ Group 2（工單檔）→ 其他按 T 編號時序

#### Phase D：驗證與回報（預算 5 分鐘）

1. 最終 `git status`：工作樹應該是 clean 或只剩明確無關的雜項
2. `git log --oneline -15`：列出本 session 新增的所有 commits
3. 回報區填寫 §1 - §10

### 預期產出
- N 個 atomic commit（N 由 Phase A 盤點決定，預估 3 - 6 個）
- 工作樹盡可能 clean
- 完整的 commit 清單回報

### 驗收條件
- [ ] Phase A 盤點結果完整寫入 §2
- [ ] 所有 group 的檔案都有明確的 commit 歸屬或「暫緩」標記
- [ ] 每個 commit 為 atomic（單一邏輯）
- [ ] 每個 commit 訊息符合 conventional commits 格式
- [ ] **沒有 git push**（除非使用者在互動紀錄中明確要求）
- [ ] **沒有 `--amend`**（所有變更走新 commit）
- [ ] **沒有 `--no-verify`**（pre-commit hook 若存在要走完）
- [ ] 最終 `git status` 輸出寫入回報區
- [ ] 最終 `git log --oneline -15` 輸出寫入回報區
- [ ] 若某個檔案不確定該歸哪組，列入「暫緩清單」由使用者決定

### 執行注意事項

**絕對禁止**：
- ❌ `git push`（即使 pre-commit hook 失敗也不要）
- ❌ `git reset --hard` / `git checkout .`（可能毀掉使用者的 work in progress）
- ❌ `git clean -f`（清理 untracked 需要使用者同意）
- ❌ `git commit --amend`（破壞既有 commit）
- ❌ `--no-verify` / `--no-gpg-sign`（走完所有 hook）
- ❌ 強制修改 `_ct-workorders/_tower-state.md` 或 `_learnings.md` 的**內容**（只能 commit，不能修改）
- ❌ 改動原始碼（本工單只做 git 操作）

**建議的 git 安全模式**：
```bash
# 每個 group 開始前:
git status
git diff --stat HEAD  # 看未 stage 的狀況

# Stage 明確的檔案 (不用 git add -A 或 git add .):
git add <file1> <file2>

# Verify 再 commit:
git diff --staged --stat
git commit -m "..."
```

**若遇到 pre-commit hook 失敗**：
- 分析錯誤原因
- 修復後**新建 commit**（不要 amend）
- 若 hook 抱怨的是工單檔案（markdown lint 等），考慮加到 .gitignore 或跟使用者確認

**若某個 group 判斷困難**：
- 在回報區 §8「遭遇問題」列出該檔案 + 困難原因
- 該檔案進「暫緩清單」交給使用者決定
- 繼續處理其他 group，不要卡住

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. Phase A：`git status` + `git log -10` + 盤點
4. Phase B：分組決策（記錄在回報區 §2）
5. Phase C：逐個 group 執行 `git add` + `git commit`
6. Phase D：最終 `git status` + `git log --oneline -15` 驗證
7. 填寫回報區 §1 - §10
8. 更新「狀態」和「完成時間」

### 回報區分節要求
- **§1 完成狀態**：DONE / FAILED / BLOCKED / PARTIAL + 一句話總結
- **§2 Phase A 盤點**：初始 git status、log、分組決策
- **§3 分組表**：| Group | 檔案清單 | Commit 訊息 | SHA |
- **§4 暫緩清單**：判斷困難的檔案（若有）
- **§5 最終 git status**：工作樹結尾狀態
- **§6 最終 git log --oneline -15**：新增的 commits
- **§7 Pre-commit hook 回報**：若有失敗，寫原因和處理
- **§8 遭遇問題**：其他非預期狀況
- **§9 使用者後續建議**：push 時機、接下來建議的 commit 順序等
- **§10 L013 執行紀錄**：這次是否符合 L013？（此工單不一定適用，若不適用寫 N/A）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### §1 完成狀態
DONE — 已完成變更盤點、分組並建立 4 個 atomic commits（未 push）。

### §2 Phase A 盤點
**初始 git status（摘要）**
- staged：無
- unstaged modified：
  `_ct-workorders/_learnings.md`, `_ct-workorders/_tower-state.md`,
  `electron/logger.ts`, `electron/main.ts`, `electron/preload.ts`,
  `electron/remote/protocol.ts`, `electron/voice-handler.ts`,
  `src/components/SettingsPanel.tsx`, `src/locales/{en,zh-CN,zh-TW}.json`,
  `src/stores/settings-store.ts`, `src/types/electron.d.ts`, `src/types/index.ts`
- untracked：
  `_ct-workorders/T0013-*.md` ~ `T0018-*.md`, `_ct-workorders/_tower-config.yaml`,
  `_ct-workorders/reports/*`, `_ct-workorders/T0019-git-tree-consolidation.md`,
  `src/types/voice-ipc.ts`

**初始 git log --oneline -10（重點）**
- `9003f29`（T0018）
- `08b4856`（T0017-β）
- 兩筆必要 commit 均存在（檢查通過）

**分組決策**
1. Group 1：塔台 state 檔案（_tower-state/_learnings/_tower-config）
2. Group 2：歷史工單與報告檔（T0013 ~ T0018 + reports）
3. Group 3：T0014 logging 與 settings 相關程式碼
4. Group 4：T0013 voice IPC 常數與 preload/handler 收斂

### §3 分組表
| Group | 檔案清單 | Commit 訊息 | SHA |
|---|---|---|---|
| Group 1 | `_ct-workorders/_learnings.md`, `_ct-workorders/_tower-state.md`, `_ct-workorders/_tower-config.yaml` | `chore(tower): update state after BUG-004/005 resolution` | `d9345cf` |
| Group 2 | `_ct-workorders/T0013-*.md` ~ `T0018-*.md`, `_ct-workorders/reports/T0014-runtime-checklist.md`, `_ct-workorders/reports/T0016-pre-dmp-analysis.txt`, `_ct-workorders/reports/bat-agent-orchestration-research.md` | `docs(ct): archive Phase 1 voice input work orders (T0013-T0018)` | `d78da15` |
| Group 3 | `electron/logger.ts`, `electron/main.ts`, `electron/remote/protocol.ts`, `src/components/SettingsPanel.tsx`, `src/stores/settings-store.ts`, `src/types/index.ts`, `src/locales/{en,zh-CN,zh-TW}.json` | `feat(log): add crash-safe logging controls and diagnostics (T0014)` | `af3a45f` |
| Group 4 | `electron/preload.ts`, `electron/voice-handler.ts`, `src/types/electron.d.ts`, `src/types/voice-ipc.ts` | `fix(voice): centralize IPC channels and harden preload bridge (T0013)` | `53caa59` |

### §4 暫緩清單
無。

### §5 最終 git status
```bash
On branch main
Your branch is ahead of 'origin/main' by 7 commits.
Untracked files:
  _ct-workorders/T0019-git-tree-consolidation.md
nothing added to commit but untracked files present
```

### §6 最終 git log --oneline -15
```bash
53caa59 (HEAD -> main) fix(voice): centralize IPC channels and harden preload bridge (T0013)
af3a45f feat(log): add crash-safe logging controls and diagnostics (T0014)
d78da15 docs(ct): archive Phase 1 voice input work orders (T0013-T0018)
d9345cf chore(tower): update state after BUG-004/005 resolution
9003f29 fix(voice): resolve whisper native addon dynamic require (BUG-005)
08b4856 fix(voice): replace ScriptProcessorNode with AudioWorklet
b8ef9f5 diag(voice): [BUG-004] add onaudioprocess tick counter for T0017-α
c734b49 (origin/main, origin/HEAD) Add Gemini Settings
87d3e4a fix(voice): bypass destination sink for BUG-004 and add checkpoints
501b75c chore: add bmad-method v6.3
6253dc9 feat: voice preview popover, voice settings, context menu portal fix, macOS mic permission
882be11 fix(paste): use xterm.js bracketed paste + remove dead auth-login IPC
7fe0a91 feat: add mic button + Alt+M shortcut + voice recording state machine to PromptBox (T0005 §1+§2)
2d5b18e (tag: v0.0.2-pre.1, tag: v0.0.1-pre.1) feat: add macOS to pre-release workflow (unsigned DMG)
79b5c82 fix: pre-release workflow — shallow clone + fetch tags separately to avoid timeout
```

### §7 Pre-commit hook 回報
無 hook 失敗，所有 commit 一次通過。

### §8 遭遇問題
無功能性阻塞。僅出現多個 `LF will be replaced by CRLF` 提示，未影響本次提交。

### §9 使用者後續建議
- 建議先在塔台確認本次 4 筆 commit 分組與訊息後，再統一 push。
- 若要進一步精煉歷史，可在後續工單另做 commit message 文案微調（不 amend 既有紀錄）。

### §10 L013 執行紀錄
N/A（本工單為 git hygiene / consolidation，非 runtime 偵錯執行）。

### 產出摘要
- `d9345cf` — Group 1（3 files）
- `d78da15` — Group 2（11 files）
- `af3a45f` — Group 3（9 files）
- `53caa59` — Group 4（4 files）

### 互動紀錄
無。

### sprint-status.yaml 已更新
不適用（根目錄、`_bmad-output/`、`docs/` 皆未找到 `sprint-status.yaml`）。

### 回報時間
2026-04-11 14:14 (UTC+8)
