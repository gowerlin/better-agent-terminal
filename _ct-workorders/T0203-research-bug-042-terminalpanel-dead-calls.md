# T0203 — BUG-042 研究:TerminalPanel dead call 根因判定 + 處理方向建議

## 元資料
- **類型**:research(研究型 + 互動)
- **狀態**:IN_PROGRESS
- **關聯**:BUG-042 · PLAN-019 · T0187(首次發現) · T0191(保留不動)
- **派發時間**:2026-04-19 10:30 (UTC+8)
- **開始時間**:2026-04-19 10:26 (UTC+8)
- **預估工時**:30-60 min(含 git history 挖掘 + UI 依賴驗證)
- **Renew 次數**:0
- **互動**:允許(每次 ≤3 題,config `research_max_questions: 3`)

## 塔台決策背景

BUG-042 自 T0187(PLAN-019 Cluster 2)發現 TerminalPanel 呼叫 4 個 runtime 不存在的 store 成員後,連續兩個 session(第八/九)優先救 BUG-046/047,本 BUG 🟡 Medium 未派工單。T0191 清型別債時**刻意保留不動**(`git diff TerminalPanel.tsx` 為空),留給本研究工單處理。

**三假設未決**(BUG-042 第 32-36 行原文):
1. Dead code:TerminalPanel 搶跑,store 實作被遺忘或砍掉
2. Upstream drift:fork 時 store 被修改,component 沒同步移除 call site
3. Planned but 未完成:設計階段規劃,實作階段卡住

**處理方向三選一**(BUG-042 第 40-42 行):
- [A] 實作 runtime — store 補 action + field
- [B] 移除 call site — TerminalPanel 刪 dead call + 對應 UI 邏輯改用其他訊號
- [C] 降級為 optional — `store.markAgentCommandSent?.()` (治標不治本,不推薦)

本張目標:**根因確立 + 推薦 A/B/C + 附理由**,交回塔台決策後派修復工單。

## 目標

1. 確認 BUG-042 三假設(Dead code / Upstream drift / Planned 未完成)哪個成立
2. 掃描 `TerminalPanel.tsx` 全檔,盤點**其他類似 dead call**(讀 undefined field / 呼叫不存在 action)
3. 驗證「UI 是否實質依賴 `agentCommandSent` / `hasUserInput` 狀態」(影響 A vs B 取捨)
4. 給出推薦處理方向(A/B/C)+ 理由

## 已知事實(不要重查)

- `src/stores/workspace-store.ts` runtime **整份 grep 無命中** `markAgentCommandSent` / `markHasUserInput` / `agentCommandSent` / `hasUserInput`(T0187 已證)
- `TerminalPanel.tsx:210` 呼叫 `markAgentCommandSent(...)` + `markHasUserInput(...)`
- `TerminalPanel.tsx:385` 讀 `agentCommandSent` / `hasUserInput` field
- 本專案 store 是**自製輕量 observable**,不是 Zustand(T0191 第 151 行實證)
- PLAN-019 保留的 2 個 tsc error 全部位於 `TerminalPanel.tsx` 這 2 行

## 調查步驟

### Step 1:TerminalPanel 全檔掃描(Q1.B 擴大範圍)

```bash
# 盤點所有 store 消費端
grep -n "useWorkspaceStore\|workspaceStore\." src/components/TerminalPanel.tsx

# 比對每個 call site / field 讀取在 store 是否存在
# 產出表格:位置 / 成員 / 存在與否 / (若存在)型別
```

**交付**:TerminalPanel 內**所有** store 消費端清單 + 存在性標記。若除了 BUG-042 已知 4 個外還有 dead call,一併列出。

### Step 2:Git history 挖掘

```bash
# 找這 4 個成員是否在歷史存在過
git log --all -p -S "markAgentCommandSent" -- src/stores/workspace-store.ts
git log --all -p -S "markHasUserInput" -- src/stores/workspace-store.ts
git log --all -p -S "agentCommandSent" -- src/stores/workspace-store.ts src/types/
git log --all -p -S "hasUserInput" -- src/stores/workspace-store.ts src/types/

# 找 TerminalPanel.tsx:210, 385 這些 call site 首次引入的 commit
git log --all -p -L 210,210:src/components/TerminalPanel.tsx
git log --all -p -L 385,385:src/components/TerminalPanel.tsx
```

**交付**:
- 若 history **曾存在**過 → 找到移除 commit → **假設 1 (Dead code)** 或 **假設 2 (Upstream drift,若是 fork 來源)**
- 若 history **從未存在** → **假設 3 (Planned 未完成)**,找 call site 引入 commit 時的 PR/commit message 佐證

### Step 3:UI 依賴驗證(Q2.B 要求)

查 `TerminalPanel.tsx:210` 和 `:385` 周邊邏輯:

```bash
# 看 call site 上下文,確認兩個 flag 的用途
# 這 4 個成員影響哪些 UI 行為?
```

**關鍵問題**:
- `markAgentCommandSent` 呼叫後原本要觸發什麼 UI 變化?(banner / toast / 狀態指示?)
- `agentCommandSent` 讀取後原本要 gate 什麼邏輯?(條件 render / disable 按鈕?)
- 目前 runtime 因為 `undefined` + optional chain,UI 實際**退化**成什麼行為?(可能已經「能用」但少了某些 feedback)

**交付**:UI 依賴清單 + 「如果完全移除這段,使用者是否會感受到功能缺失」判斷。

### Step 4:產出根因 + 推薦

根據 Step 1-3 證據,填寫:

```markdown
## 根因
- 假設選定:1 / 2 / 3
- 證據:<git blame / commit history / 上下文分析>

## 其他 dead call 發現(Q1.B 範圍)
- <位置>:<成員>:<存在性> | 若 dead,嚴重度?

## UI 依賴驗證
- markAgentCommandSent 用途:<...>
- markHasUserInput 用途:<...>
- agentCommandSent 讀取邏輯:<...>
- hasUserInput 讀取邏輯:<...>
- 若全部移除的 UX 影響:<...>

## 推薦處理方向
- **選項**:A / B / C
- **理由**:<...>
- **風險**:<...>
```

## 禁止事項

- ❌ **不得修改任何程式碼**(純研究,不寫 code)
- ❌ 不得跑 `vite build` / `tsc`(已知 2 errors,不需要再跑)
- ❌ 不得動 workspace-store 全 consumer 盤點(Q1.B 不是 Q1.C,聚焦 TerminalPanel)
- ❌ 不得給實作成本估算(Q2.B 不是 Q2.C)

## 互動規則

- **啟用研究互動**(Q3.A),每次提問 ≤3 題
- **必須暫停回塔台**的情境:
  - git history 翻不到線索,三假設無法區分 → 問使用者是否記得 fork 來源或原始設計
  - 發現 Step 1 盤點超出預期(例如 >3 個額外 dead call)→ pause 回報讓塔台決策是否擴大範圍
  - UI 依賴難以判斷(需使用者實際測 UI 才能確認) → 問使用者能否協助 smoke test
- **自主判斷邊界**:git blame / grep / 讀程式碼理解邏輯 → 自行完成

## 交付物

寫入本檔「回報區」:
- [ ] Step 1 TerminalPanel 全檔 store 消費端盤點表
- [ ] Step 2 git history 挖掘結果(含 commit hash)
- [ ] Step 3 UI 依賴驗證
- [ ] Step 4 根因判定 + 推薦 A/B/C + 理由
- [ ] Worker 實際耗時 vs 估時

## 回報區

### 完成狀態

**DONE** — 研究結論可決策,推薦 **Option B(移除 call site + 相關 dead code)**,置信度高。

### Step 1:TerminalPanel 全檔 store 消費端盤點

| 行號 | 存取形式 | 成員 / 欄位 | 存在性 | 備註 |
|------|---------|------------|-------|------|
| 202 | `workspaceStore.getState()` | `.terminals` | ✅ | `AppState.terminals` 實裝 |
| 203 | `terminalInstance.agentCommandSent` | 讀 field | ❌ **dead read** | `TerminalInstance` 型別有宣告(types/index.ts:53),store **從不寫入** |
| 203 | `terminalInstance.hasUserInput` | 讀 field | ❌ **dead read** | 同上(types/index.ts:54) |
| 204 | `settingsStore.getAgentCommand()` | method | ✅ | settings-store.ts:351 |
| 207 | `workspaceStore.getState()` | `.terminals` | ✅ | 同 L202 |
| 208 | `currentTerminal.hasUserInput` / `.agentCommandSent` | 讀 field | ❌ **dead read × 2** | 同 L203 |
| 210 | `workspaceStore.markAgentCommandSent(id)` | method | ❌ **dead call**(若執行會 `TypeError`,但 guard 讓此路徑永不執行——見 Step 3) |
| 228 | `settingsStore.getSettings()` | method | ✅ | |
| 229 | `settingsStore.getTerminalColors()` | method | ✅ | |
| 257 | `settingsStore.getFontFamilyString()` | method | ✅ | |
| 376 | `workspaceStore.setTerminalAltBuffer(id, isAlt)` | method | ✅ | workspace-store.ts:628 |
| 385 | `workspaceStore.markHasUserInput(id)` | method | ❌ **dead call**(同 L210 守衛不觸發) |
| 482/488/494/517/519 | `settingsStore.zoom*()` | method × 5 | ✅ | |
| 609-613 | `settingsStore.subscribe/getSettings/getTerminalColors/getFontFamilyString` | method × 4 | ✅ | |

**Q1.B 盤點結論**:除 BUG-042 原先登記的 4 個(`markAgentCommandSent` / `markHasUserInput` / `agentCommandSent` / `hasUserInput`)外,**沒有其他 dead call**。其餘 11+ 個 store / settings 消費端全部 runtime 存在。

### Step 2:Git history 挖掘

**關鍵發現**:這 4 個成員**曾經存在過**——不是「從未實作」,是**「實作後被後續 refactor 誤刪」**。

| Commit | 日期 | 作者 | 事件 |
|--------|------|------|------|
| `aaf2c07` | 2025-12-19 | tonyq | **引入** — refactor claude-code → code-agent + agent auto-command timing fix。同時新增 store 的 `markAgentCommandSent` / `markHasUserInput` 方法,並加 TerminalPanel 內 agent 自動命令邏輯(現在 L199-215 / L384-386 的前身) |
| `1fe2f43` | 2025-12-20 | Luke Chang | **誤刪** — "agent preset refactor"。`addTerminal` API 從 `type: 'terminal' \| 'claude-code'` 改為 `agentPreset: AgentPresetId`。此次 rewrite **靜默捨棄** `markAgentCommandSent` / `markHasUserInput` 兩個方法(collateral loss),但未同步修改 TerminalPanel call site |

Bisect 驗證:
```
aaf2c07: markXxx hits = 2  ← 引入
f43d00c: markXxx hits = 2
1fe2f43: markXxx hits = 0  ← 誤刪點
f8959b3: markXxx hits = 0
99bcb26: markXxx hits = 0
f5f2247: markXxx hits = 0
```

**推翻原三假設的分類**:
- ❌ 假設 1 純 Dead code:部分成立(確實死,但不是「搶跑」,是「被 sibling refactor 壓死」)
- ❌ 假設 2 Upstream drift:不成立。aaf2c07 和 1fe2f43 **同一 fork 內先後**發生,不是 fork 時 upstream 修改
- ❌ 假設 3 Planned 未完成:不成立。功能**完整實作過**,不是設計階段卡住

**真正根因(第四選項)**:**Self-inflicted drift during agent-preset refactor** ——
Dec 19 tonyq 實作完整的 agent auto-command feature(TerminalPanel focus 時驅動),Dec 20 Luke Chang 把同一 feature 改用 agentPreset API + 搬到 `WorkspaceView.tsx`(PTY create 時驅動,見 WorkspaceView.tsx:443-471、L495-499),順手在 store rewrite 時把舊 helpers 刪掉,但 **TerminalPanel 的 call site 遺漏清理**。現在 feature 是活的(由 WorkspaceView 路徑驅動),只是 TerminalPanel 裡那段是被繞過的殘骸。

### Step 3:UI 依賴驗證

**更強的發現**:TerminalPanel 裡這 4 個 dead call 所屬的整段 code **runtime 永不執行**。

#### TerminalPanel 內的守衛條件

```tsx
// TerminalPanel.tsx:200
if (!hasBeenFocusedRef.current && terminalType === 'code-agent') {
  // ... 包 L210 markAgentCommandSent
}
// TerminalPanel.tsx:384
if (terminalType === 'code-agent') {
  workspaceStore.markHasUserInput(terminalId)
}
```

#### 但 `terminalType` prop 根本沒被傳入

```tsx
// MainPanel.tsx:240(唯一的 TerminalPanel 呼叫點)
<TerminalPanel terminalId={terminal.id} isActive={isActive} />
// ↑ 沒有 terminalType={...}
```

Grep 驗證:全專案只有 1 處 `<TerminalPanel` 實例,props 就這 2 個,`terminalType` 從未傳入。→ `terminalType === 'code-agent'` 永遠為 `undefined === 'code-agent'` → `false` → **整段 block 永不執行**。

#### 各成員「理論上的用途」(若 feature 活著)
- `markAgentCommandSent(id)` / `agentCommandSent`:terminal 首次 focus 自動送 agent command 後打旗標,避免重送。但 aaf2c07 設計的「focus 時送」路徑已被 WorkspaceView 的「PTY create 時送」取代
- `markHasUserInput(id)` / `hasUserInput`:使用者打過字就標記,avoid auto-command 覆蓋手動輸入。同理,此保護在 WorkspaceView 路徑下不需要——因為 PTY create 時使用者還來不及輸入

#### 若完全移除這段的 UX 影響

**零影響**。現有 UX 路徑:
- Agent 自動命令 → WorkspaceView.tsx PTY create 時 dispatch(L443-471、L495-499),看 `settings.agentAutoCommand` + `terminal.agentPreset`
- TerminalPanel 那段 code 目前是**完全死碼**,移除不會改變任何使用者可觀察行為

這也解釋了為什麼 BUG-042 始終沒有使用者回報——**使用者感受不到任何缺失**,因為 feature 是活的,只是走另一條路。

### Step 4:根因 + 推薦

#### 根因

**Self-inflicted drift(四假設外,為既有三假設的變體)**:
- 功能 aaf2c07 實作 → 1fe2f43 refactor 時搬家到 WorkspaceView,舊 store helpers 被順手刪
- TerminalPanel 舊 call site **遺漏同步清理**,留下 4 個 dead call
- 由於 `terminalType` prop 從未從 MainPanel 傳入,dead code **永不執行**,runtime 不會 crash,靜默等了 4 個月才被 TS6133 / tsc 報出來

#### 推薦處理方向

**選項 B — 移除 call site + 連動 dead code**

**理由**:
1. **功能已在別處活著** — WorkspaceView.tsx 是現行 agent auto-command 正當路徑,TerminalPanel 這段是遺留殘骸
2. **UI 零依賴** — guard 條件 `terminalType === 'code-agent'` 從未滿足,移除不影響任何使用者可觀察行為
3. **清理面乾淨** — 只動 TerminalPanel.tsx + types/index.ts,不動 WorkspaceView / store 現行路徑
4. **型別債直接清零** — PLAN-019 保留的 2 個 tsc error 一併消除,而且連帶清掉 `TerminalInstance.agentCommandSent` / `hasUserInput` 兩個永不被寫入的 field(types/index.ts:53-54)

**建議清理範圍**(實作工單參考,本張不動 code):
- `src/components/TerminalPanel.tsx` L199-215:刪整段 agent auto-command block
- `src/components/TerminalPanel.tsx` L383-386:刪 `if (terminalType === 'code-agent') markHasUserInput` 整塊
- `src/components/TerminalPanel.tsx`:刪 `terminalType` prop 與 interface 欄位(若有宣告)
- `src/types/index.ts` L53-54:刪 `agentCommandSent?: boolean` 和 `hasUserInput?: boolean` 兩個 orphan field
- **保留** WorkspaceView.tsx / settingsStore.getAgentCommand() / settings.agentAutoCommand 完全不動

**風險**:
- **Low**。刪除的是 runtime 死碼,Feature A(agent auto-command)已由 WorkspaceView 負責
- 唯一需注意:若 MainPanel 後續想把 `terminalType` prop 補回(例如根據 `terminal.agentPreset` 動態傳),需重新評估——但這會是新 feature,不屬於本 dead call 清理

#### 為什麼不推薦 A / C

**A(實作 runtime)**:重建 store helpers + 從 MainPanel 接 `terminalType` prop = 復活一條**和 WorkspaceView 重複**的 agent auto-command 路徑。不僅浪費,還會讓兩條路徑互打(PTY create 時 + focus 時各送一次 agent command 的風險)。

**C(optional chain `markAgentCommandSent?.()` )**:治標不治本,且 guard 永不觸發仍是死碼,optional chain 只是讓 tsc 閉嘴,不解決「這段是殘骸」的本質。BUG-042 工單本身也已標註「不推薦」。

### 產出摘要

- **推薦**:Option B(移除 call site + orphan fields),信心度 high
- **根因**:1fe2f43 commit(Luke Chang 的 agent-preset refactor)誤刪 store helpers + 未清 TerminalPanel call site;MainPanel 從未傳 `terminalType` prop 讓整段 code 靜默死亡
- **UI 影響**:零,feature 已由 WorkspaceView 接手
- **未改動任何程式碼**(純研究工單)

### 遭遇問題

無。證據鏈完整,不需要向使用者提問(提問規則:git history 翻不到線索 / 需 smoke test 驗 UI / >3 額外 dead call ——本次皆未觸發)。

### 互動紀錄

無(研究過程未觸發互動規則,證據從 grep / git log / code 讀取即完整判定)。

### 耗時

- 估時:30-60 min
- 實耗:約 7 min(10:26 → 10:33)
- 原因:BUG-042 已把三假設鋪好、工單指令具體,grep + `git log -S` + bisect 快速定位根因

### 回報時間

2026-04-19 10:33 (UTC+8)

---
