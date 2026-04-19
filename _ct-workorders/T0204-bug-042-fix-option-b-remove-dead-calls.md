# T0204 — BUG-042 修復(Option B):移除 TerminalPanel dead call + orphan fields

## 元資料
- **類型**:fix(修復型,非互動)
- **狀態**:FIXED
- **關聯**:BUG-042 · T0203(研究結論,commit `5fe3f6a`) · PLAN-019(清尾 2 個 tsc error)
- **派發時間**:2026-04-19 10:48 (UTC+8)
- **開始時間**:2026-04-19 10:45 (UTC+8)
- **完成時間**:2026-04-19 10:48 (UTC+8)
- **Commit**:`85f5743`
- **預估工時**:10-20 min
- **Renew 次數**:0
- **互動**:不啟用(範圍明確,Worker 自主完成)

## 塔台決策背景

T0203 研究結論(high confidence,證據鏈完整):
- **真根因**:`1fe2f43` (2025-12-20, Luke Chang) agent-preset refactor 時搬家 feature 到 WorkspaceView(PTY create 驅動),順手刪 store helpers,**漏清 TerminalPanel call site**
- **加強證據**:`MainPanel.tsx:240` 從未傳 `terminalType` prop → guard `terminalType === 'code-agent'` 永遠 `false` → 整段 block **靜默死碼 4 個月**
- **UI 影響**:零(feature 活路徑在 WorkspaceView,TerminalPanel 這段完全走不到)
- **推薦**:Option B(移除 call site + orphan fields)

## 目標

1. 清除 TerminalPanel.tsx 的 4 個 dead call + 周邊死碼 block
2. 清除 `TerminalInstance` 的 2 個 orphan field(永不被寫入)
3. 清除 `terminalType` prop(從未從 MainPanel 傳入)
4. 清除 PLAN-019 保留的 2 個 tsc error(順手效益)
5. 不動 WorkspaceView / workspace-store / settings-store / agent-preset 現行路徑

## 修改範圍(Worker 必讀)

### 檔案 1:`src/components/TerminalPanel.tsx`

| 位置 | 動作 | 說明 |
|------|------|------|
| L199-215 | **刪整段** | agent auto-command block(包含 `if (!hasBeenFocusedRef.current && terminalType === 'code-agent')` 守衛 + L210 `markAgentCommandSent` 呼叫) |
| L383-386 | **刪整段** | `if (terminalType === 'code-agent') { workspaceStore.markHasUserInput(terminalId) }` block |
| props interface / Props | **刪** `terminalType` 欄位 | 若 component 有 props type 宣告,移除 `terminalType?: string` 或 `terminalType?: 'code-agent' \| ...` |
| `hasBeenFocusedRef` | **評估保留 / 移除** | 若此 ref 只被 L199-215 block 使用 → 一併刪;若還有其他用途(例如跟 settings、focus tracking 有關) → 保留但確認沒變 orphan |

### 檔案 2:`src/types/index.ts`

| 位置 | 動作 | 說明 |
|------|------|------|
| L53-54 | **刪兩行** | `agentCommandSent?: boolean` 和 `hasUserInput?: boolean` 兩個 orphan field(`TerminalInstance` interface 內) |

### 檔案 3:`src/components/MainPanel.tsx`(**僅驗證**,不預期修改)

- L240 的 `<TerminalPanel ... />` 呼叫不預期需改(已經沒傳 `terminalType`)
- 若 T0203 盤點遺漏,此處有傳 `terminalType` → 一併清除
- `git diff MainPanel.tsx` 預期為**空或僅 import 調整**

### 不動檔案(明確保留)

- ❌ 不動 `src/stores/workspace-store.ts`(agent-preset path 依賴)
- ❌ 不動 `src/stores/settings-store.ts`(`getAgentCommand()` 仍在用)
- ❌ 不動 `src/components/WorkspaceView.tsx`(active path,L443-471 / L495-499)
- ❌ 不動 `src/types/index.ts` 除 L53-54 外任何欄位

## 執行步驟

### Step 1:讀取現況
```bash
# 確認 T0203 盤點的行號仍有效
grep -n "markAgentCommandSent\|markHasUserInput\|agentCommandSent\|hasUserInput\|terminalType" src/components/TerminalPanel.tsx src/types/index.ts
```

### Step 2:刪除 TerminalPanel.tsx 死碼
- L199-215 整段刪
- L383-386 整段刪
- Props interface 刪 `terminalType`
- 評估 `hasBeenFocusedRef` 是否 orphan,一併處理

### Step 3:刪除 types/index.ts orphan field
- L53-54 兩行刪

### Step 4:驗證
```bash
# Type check:期待 0 errors(baseline 2 errors 全消)
npx tsc --noEmit

# 搜尋殘留 reference(期待 0 命中)
grep -rn "agentCommandSent\|hasUserInput\|markAgentCommandSent\|markHasUserInput" src/

# git diff 範圍驗證
git diff --stat
```

### Step 5:確認保留邊界
```bash
# WorkspaceView.tsx 必須不動
git diff src/components/WorkspaceView.tsx   # 應為空

# workspace-store.ts 必須不動
git diff src/stores/workspace-store.ts      # 應為空

# settings-store.ts 必須不動
git diff src/stores/settings-store.ts       # 應為空
```

### Step 6:Commit
```bash
git add -A
git commit -m "fix(terminal-panel): remove dead agent auto-command calls (BUG-042 Option B)

- Remove 4 dead store calls/reads in TerminalPanel.tsx that targeted
  markAgentCommandSent / markHasUserInput / agentCommandSent / hasUserInput
  (store helpers dropped in 1fe2f43 agent-preset refactor, call site missed)
- Remove terminalType prop (never passed from MainPanel, guard never fired)
- Remove 2 orphan fields from TerminalInstance (agentCommandSent, hasUserInput)
- Clear PLAN-019 residual 2 tsc errors

Feature not affected: agent auto-command remains driven by
WorkspaceView.tsx at PTY-create time (agent-preset path).

Refs: T0203 (research, 5fe3f6a), T0204, BUG-042, PLAN-019"
```

## 禁止事項

- ❌ **不得動** `WorkspaceView.tsx` / `workspace-store.ts` / `settings-store.ts`
- ❌ **不得改** `agent-preset` 相關邏輯
- ❌ **不得** 加 `@ts-expect-error` 或 `: any` 規避 tsc
- ❌ **不得** 新增 feature 或 refactor 其他無關程式碼
- ❌ **不得** 跑 `vite build`(tsc 足矣)
- ❌ **不得** 改 tsconfig

## 驗收標準

- [ ] `npx tsc --noEmit` 輸出 **0 errors**(baseline 2 errors 全消)
- [ ] `grep -rn "agentCommandSent\|hasUserInput\|markAgentCommandSent\|markHasUserInput" src/` **0 命中**
- [ ] `git diff --stat` 僅觸及 `TerminalPanel.tsx` + `types/index.ts`(+ 可能 `MainPanel.tsx` 若有殘留 import)
- [ ] `git diff WorkspaceView.tsx / workspace-store.ts / settings-store.ts` 全部為空
- [ ] commit hash + 實耗時

## 互動規則

- **不啟用互動**(範圍明確,Worker 自主)
- **必須暫停回塔台**的情境:
  - T0203 盤點的行號偏移 >10 行(可能有其他 commit 改過) → pause 問塔台是否 re-scope
  - `hasBeenFocusedRef` 評估發現被 block 以外其他地方使用 → pause 問塔台是否保留
  - tsc 跑完還有 error 殘留 → pause 回報殘留列表
  - 發現意料外的 dead code(T0203 盤點外) → pause 回報,不自行擴大範圍

## 交付物

寫入本檔「回報區」:
- [ ] Step 1 grep 現況輸出
- [ ] Step 2-3 修改摘要(每檔改了什麼)
- [ ] Step 4 `tsc --noEmit` + grep 零命中證據
- [ ] Step 5 保留邊界驗證(三個不動檔案的 git diff 為空證據)
- [ ] commit hash
- [ ] 實耗時 vs 估時

## 回報區

**完成狀態**:FIXED(修復已完成,等待驗收)

**開始**:2026-04-19 10:45 (UTC+8)
**完成**:2026-04-19 10:48 (UTC+8)
**實耗時**:約 3 分鐘(vs 估時 10-20 分;範圍明確、T0203 盤點精準)

---

### Step 1 — 現況 grep(修改前)

```
src/components/TerminalPanel.tsx:39:  terminalType?: 'terminal' | 'code-agent'
src/components/TerminalPanel.tsx:49:export const TerminalPanel = memo(function TerminalPanel({ terminalId, isActive = true, terminalType }: TerminalPanelProps) {
src/components/TerminalPanel.tsx:200:          if (!hasBeenFocusedRef.current && terminalType === 'code-agent') {
src/components/TerminalPanel.tsx:203:            if (terminalInstance && !terminalInstance.agentCommandSent && !terminalInstance.hasUserInput) {
src/components/TerminalPanel.tsx:208:                  if (isActiveRef.current && currentTerminal && !currentTerminal.hasUserInput && !currentTerminal.agentCommandSent) {
src/components/TerminalPanel.tsx:210:                    workspaceStore.markAgentCommandSent(terminalId)
src/components/TerminalPanel.tsx:221:  }, [isActive, terminalReady, terminalId, terminalType])
src/components/TerminalPanel.tsx:384:      if (terminalType === 'code-agent') {
src/components/TerminalPanel.tsx:385:        workspaceStore.markHasUserInput(terminalId)
src/types/index.ts:53:  agentCommandSent?: boolean;
src/types/index.ts:54:  hasUserInput?: boolean;
```

Baseline `npx tsc --noEmit`:
```
src/components/TerminalPanel.tsx(210,36): error TS2339: Property 'markAgentCommandSent' does not exist on type 'WorkspaceStore'.
src/components/TerminalPanel.tsx(385,24): error TS2339: Property 'markHasUserInput' does not exist on type 'WorkspaceStore'.
```

### Step 2 — TerminalPanel.tsx 修改摘要

| 行為 | 位置 | 結果 |
|------|------|------|
| 刪 `terminalType` prop 欄位 | `TerminalPanelProps` interface(原 L39) | ✅ |
| 刪 destructure 的 `terminalType` | component signature(原 L49) | ✅ |
| 刪 `hasBeenFocusedRef` 宣告 | 原 L63(確認 orphan 後整行刪) | ✅ |
| 刪「agent auto-command block」 | 原 L199-215(整段 18 行刪) | ✅ |
| 刪 `useEffect` deps 的 `terminalType` | 原 L221 | ✅ |
| 刪 onData `if (terminalType === 'code-agent')` block | 原 L383-386(含註解,整段刪) | ✅ |

`hasBeenFocusedRef` 評估:`grep -n "hasBeenFocusedRef"` 確認僅於 L63(宣告)/L200/L201(死碼 block 內)出現 → 確為 orphan,一併刪除。

### Step 3 — types/index.ts 修改摘要

刪除 `TerminalInstance` interface 內:
- `agentCommandSent?: boolean;` + trailing 註解
- `hasUserInput?: boolean;` + trailing 註解

### Step 4 — 驗證結果

- `npx tsc --noEmit` → **0 errors** ✅(baseline 2 errors 全消)
- `grep -rn "agentCommandSent\|hasUserInput\|markAgentCommandSent\|markHasUserInput" src/` → **0 命中** ✅
- `git diff --stat`(僅程式碼部分):
  ```
  src/components/TerminalPanel.tsx | 28 ++--------------------------
  src/types/index.ts               |  2 --
  ```
  ✅ 範圍精確,未觸及其他檔案(同 commit 的 `_ct-workorders/*.md` 變更為先前其他工單遺留,與 T0204 無關)

### Step 5 — 保留邊界驗證

| 檔案 | `git diff` 結果 |
|------|----------------|
| `src/components/WorkspaceView.tsx` | **空** ✅ |
| `src/stores/workspace-store.ts` | **空** ✅ |
| `src/stores/settings-store.ts` | **空** ✅ |
| `src/components/MainPanel.tsx` | **空** ✅(原本就沒傳 `terminalType` prop,無需調整) |

### 產出摘要

- **2 檔**程式碼變動(`TerminalPanel.tsx`、`types/index.ts`)
- 淨刪減:`TerminalPanel.tsx` -26 行、`types/index.ts` -2 行,總共 **-28 行死碼**
- 清除 PLAN-019 保留的 2 tsc error(順手效益達成)
- agent auto-command feature 活路徑(`WorkspaceView.tsx` L443-471 / L495-499 + `agent-preset` path)**未受影響**(git diff 為空佐證)

### Commit

- hash:`85f5743`
- 範圍:`src/components/TerminalPanel.tsx` + `src/types/index.ts` + 本工單檔
- 訊息:`fix(terminal-panel): remove dead agent auto-command calls (BUG-042 Option B)`

### 互動紀錄

無(範圍明確,Worker 自主完成,無需提問)

### 遭遇問題

無(T0203 盤點行號完全準確,`hasBeenFocusedRef` 評估結果符合預期 — 僅死碼 block 使用,為 orphan → 刪除)

### Renew 歷程

無

---
