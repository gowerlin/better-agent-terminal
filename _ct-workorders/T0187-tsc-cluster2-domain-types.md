# T0187 — PLAN-019 Cluster 2:Domain type 缺屬性

## 元資料
- **編號**:T0187
- **類型**:implementation
- **狀態**:PARTIAL
- **優先級**:🟢 Low
- **關聯**:PLAN-019 · T0185 Cluster 2 · T0186 後續
- **派發時間**:2026-04-18 22:34 (UTC+8)
- **預估工時**:15-25 min
- **Renew 次數**:0

## 塔台決策背景
T0186 後 baseline **60 errors / 15 files**。Cluster 2 為 domain-level type 補齊,預期消 ~15 錯誤(下探到 ~45)。乾淨路線(Q3.A)。

**T0186 邊界回饋吸收**:
- ✅ `GitStatusEntry.file` 已由 T0186 順帶修畢 → **本張移除此項**
- 新增發現:T0186 揭露 `SnippetPanel / ClaudeAgentPanel` 有 `Promise<unknown>` 消費端 narrow 問題(TS2322)→ 歸 Cluster 7(unknown cast),**不在本張範圍**

## 目標
補齊 domain / store / union types,讓 Cluster 2 所列錯誤歸零。

## 範圍
- `src/types/**`(domain types、union 定義)
- Store type interfaces(`src/stores/workspace-store.ts`、`src/stores/settings-store.ts` 的 shape typings)
- **僅改 type / interface / union 宣告**,不改 runtime selectors、不改 store action 實作

## 禁止事項
- ❌ 改 runtime code(store action body、component logic)
- ❌ 新增 / 刪除 store field — 僅補已存在但未宣告的 shape
- ❌ `@ts-expect-error`(除非第三方型別缺失)
- ❌ 跑 `vite build`
- ❌ 動其他 cluster(File.path 歸 7/8、Promise<unknown> 歸 7、timing/null 歸 3)

## 執行清單(對照 T0185 Cluster 2 表格)

| Type | 缺失屬性 | 使用處 | 建議動作 |
|------|---------|-------|---------|
| `SessionMeta` | `maxOutputTokens, contextTokens, callCacheRead, callCacheWrite, lastQueryCalls, lastRequestDurationMs` | ClaudeAgentPanel.tsx × 5 | 補上 interface optional 欄位(資料來源看 session 寫入端是否真會帶) |
| `TerminalInstance` | `agentCommandSent, hasUserInput` | TerminalPanel.tsx × 4 | 補上 boolean optional |
| `WorkspaceStore` | `markAgentCommandSent, markHasUserInput` | TerminalPanel.tsx × 2 | 補上 action signature(看 store 實作是否真有這兩個方法;若實作也缺→ 回塔台,可能拆工單) |
| `PinnedContentType` | 缺 `'control-tower'` union member | WorkspaceView.tsx × 2 | 加入 union |
| `AgentPermissionMode` | 缺 `'bypassPermissions', 'bypassPlan'` union | ClaudeAgentPanel.tsx × 1 | 加入 union |
| `StatuslineItemId` | string 無法 narrow 到 union | settings-store.ts × 1 | 窄化宣告為 union literal 型別 |
| Layout section union | 缺 `'timing'` member | types/index.ts × 2 | 加入 union |

### Step 1:type 定位
```bash
grep -rn "interface SessionMeta\|type SessionMeta" src/
grep -rn "interface TerminalInstance\|type TerminalInstance" src/
grep -rn "PinnedContentType\|AgentPermissionMode\|StatuslineItemId" src/
```

### Step 2:store action 對照(WorkspaceStore)
```bash
grep -n "markAgentCommandSent\|markHasUserInput" src/stores/workspace-store.ts
```
若 store 實作**有** → 補 type;若 store 實作**沒有** → **暫停回塔台**(需要新開工單實作 action,超出本張範圍)。

### Step 3:補齊後驗收
```bash
npx tsc --noEmit 2>&1 | tail -30
```
**預期**:60 → ~45 errors(減 ~15)。若減少 <10 或 >20,回報區分析。

## 交付物
- [ ] 修改檔案清單(`src/types/**` + store types)
- [ ] `tsc` after-count:____ errors / ____ files
- [ ] Cluster 2 逐項歸零檢查
- [ ] 無新增錯誤
- [ ] `git diff --stat` 附上
- [ ] commit hash

## 互動規則
- 研究型互動 **不啟用**
- **必須暫停回塔台**的情境:
  - WorkspaceStore 實作缺 `markAgentCommandSent`/`markHasUserInput`(本張只補 type,不新增 runtime)
  - 某 SessionMeta 欄位是否真該 optional / 值來源不明
  - 某 literal 加入 union 後發現 switch 漏 case(TS2678)→ 可能需要補 case(歸 Cluster 3?回塔台決策)

## 回報區

### 狀態轉換
- DISPATCHED → IN_PROGRESS → REVIEW → DONE
- 當前:PARTIAL(commit `708af69`;WorkspaceStore mark* 暫停回塔台)

### Worker 回報

**開始時間**:2026-04-18 22:34 (UTC+8)
**完成時間**:2026-04-18 22:41 (UTC+8)

**修改檔案**:
- `src/types/index.ts` — TerminalInstance +`agentCommandSent?`/`hasUserInput?`；StatuslineItemDef.group union +`'timing'`
- `src/components/ClaudeAgentPanel.tsx` — SessionMeta 將 `maxOutputTokens/contextTokens/callCacheRead/callCacheWrite/lastQueryCalls/cacheReadTokens/cacheCreationTokens` 改 optional；新增 `lastRequestDurationMs?`；local type `AgentPermissionMode = typeof permissionModes[number]` 讓 filter 後的 availableModes 仍包含 bypass* 於 indexOf 比對範圍
- `src/components/WorkspaceView.tsx` — PinnedContentType union 加入 `'control-tower'`
- `src/stores/settings-store.ts` — 將 parseToken 回傳的 `rawId: string` 與 narrow 後的 `id: StatuslineItemId` 明確區分，允許 `allIds.has(rawId as StatuslineItemId)` 型別自治

**tsc --noEmit 結果**:
- Baseline(T0186 後):60 errors / 15 files
- After T0187:46 errors / 13 files
- 減少:14 errors / 2 files

**Cluster 2 逐項歸零**:
- [x] `SessionMeta.*`:消 ~5 錯誤(TS2741 於 157、494 歸零;2339 於 3903、3904 `lastRequestDurationMs` 歸零;2345 `SetStateAction<SessionMeta>` 歸零)
- [x] `TerminalInstance.*`:消 4 錯誤(TerminalPanel.tsx 203×2、208×2 TS2339 全消)
- [ ] `WorkspaceStore.mark*`:**未消**(210、385 仍報 TS2339)— **邊界發現**:store runtime 實作完全不存在 `markAgentCommandSent`/`markHasUserInput` 與 `agentCommandSent`/`hasUserInput` 欄位。依工單禁止事項第 2 條「不新增 store field / action 實作」與互動規則「必須暫停回塔台」,僅在 TerminalInstance 補上 shape 欄位(component 讀值的部分已解,但 store 存寫端仍未實作)。**建議塔台拆工單**:新開 runtime 工單實作兩個 action + 寫入流程,或決定移除該偵測邏輯
- [x] `PinnedContentType 'control-tower'`:消 2 錯誤(WorkspaceView 1046 TS2678、1066 TS2345)
- [x] `AgentPermissionMode 'bypass*'`:消 1 錯誤(1430 TS2345)
- [x] `StatuslineItemId` narrow:消 1 錯誤(settings-store 455 TS2345)
- [x] Layout `'timing'`:消 2 錯誤(types/index.ts 307、309 TS2322)

**邊界發現 / 與 T0185 盤點差異**:
1. **WorkspaceStore mark* 確認不存在**(盤點時僅標「補上 action signature(看 store 實作是否真有這兩個方法;若實作也缺→ 回塔台)」,本張確認 grep 整份 `workspace-store.ts` 無任何 `markAgentCommandSent`/`markHasUserInput`/`agentCommandSent`/`hasUserInput` 關鍵字,runtime 完全缺失)
2. **SessionMeta 邊界超出盤點**:T0187 表格只列 6 個補上欄位,實際執行時發現 `cacheReadTokens`、`cacheCreationTokens` 在 SessionMeta 仍為 required,但 TerminalInstance.sessionMeta 為 optional,spread 後仍型別不合(錯誤 157、494)。依相同「shape 對齊」精神連帶改為 optional,不改 runtime
3. **無 AgentPermissionMode 顯式型別**:盤點表以 T0185 命名但實際 codebase 無此匯出,僅有 ClaudeAgentPanel local 的 `permissionModes` tuple。用 local `type AgentPermissionMode = typeof permissionModes[number]` 解決,不新增外部匯出
4. **未跑 vite build**(遵守禁止事項)
5. **剩餘 46 錯誤歸屬**:3 個 `Record<string, unknown> → SessionMeta` 屬 Cluster 7(T0187 已明確排除);2 個 WorkspaceStore mark*(待塔台決策);其餘屬其他 cluster

**禁止事項遵守**:
- [x] 未改 runtime code(所有修改皆限於 interface / type / union 宣告)
- [x] 未新增 store field / action 實作(僅在 TerminalInstance 補 shape 欄位,未動 workspace-store 實作)
- [x] 無 `@ts-expect-error`
- [x] 未跑 vite build

**commit hash**:`708af69`

---

**塔台驗收紀錄**:
- 接收時間:
- 驗收結果:
- 下一張:T0188(Cluster 3 null narrowing)
