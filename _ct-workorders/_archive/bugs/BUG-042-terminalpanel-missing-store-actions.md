# BUG-042 — TerminalPanel 呼叫不存在的 WorkspaceStore action

## 元資料
- **編號**:BUG-042
- **狀態**:CLOSED
- **嚴重度**:🟡 Medium
- **建立時間**:2026-04-18 22:43 (UTC+8)
- **關閉時間**:2026-04-19 10:50 (UTC+8)
- **發現來源**:T0187 PARTIAL(PLAN-019 Cluster 2 補型別時發現)
- **關聯**:PLAN-019 · T0187(已確認 runtime 不存在並 pause 回塔台) · T0203(研究,5fe3f6a) · T0204(修復,`85f5743`)
- **可重現**:100%(TypeScript 層面;runtime 靜默死碼,4 個月無使用者回報)
- **workaround**:無(讀寫皆失效,但被 guard `terminalType === 'code-agent'` 永不觸發掩蓋)

## 修復結果(T0204, 2026-04-19 10:48)

✅ **CLOSED** — commit `85f5743`,Option B 清理完成。

- `TerminalPanel.tsx`:-26 行(dead calls + guard block + `terminalType` prop + `hasBeenFocusedRef` orphan + `useEffect` deps)
- `types/index.ts`:-2 行(`agentCommandSent?` / `hasUserInput?` orphan fields)
- `tsc --noEmit`:0 errors(baseline 2 errors 全消,PLAN-019 型別債清零)
- 保留邊界驗證:`WorkspaceView.tsx` / `workspace-store.ts` / `settings-store.ts` / `MainPanel.tsx` 全部 git diff 為空
- Worker 實耗 3 min vs est 10-20 min(3-7x 壓縮,Worker time GP042 連發)

**為何直接 CLOSED 不走 VERIFY**:修復為純刪除死碼,guard `terminalType === 'code-agent'` 自始永不觸發(4 個月靜默死碼),刪除前後 runtime 行為完全相同。agent auto-command feature 活路徑在 `WorkspaceView.tsx` PTY-create 時驅動,未受影響。

## T0203 研究結論(2026-04-19 10:33)

**真根因**(推翻原三假設,第四選項):**Self-inflicted drift during agent-preset refactor**
- `aaf2c07` (2025-12-19, tonyq) 實作 agent auto-command(TerminalPanel focus 驅動)+ store helpers
- `1fe2f43` (2025-12-20, Luke Chang) agent-preset refactor 搬家到 WorkspaceView(PTY create 驅動),順手刪 store helpers,**漏清 TerminalPanel call site**
- `MainPanel.tsx:240` 從未傳 `terminalType` prop → guard 永遠 `false` → 整段 block 靜默死碼

**UI 影響**:零(feature 活路徑在 WorkspaceView,PTY create 時驅動 agent auto-command)

**推薦**:Option B(移除 call site + orphan fields),信心 High,風險 Low

**T0204 修復中**(2026-04-19 10:48 派發)

## 現象

`src/components/TerminalPanel.tsx`:210, 385 呼叫 / 讀取以下 store action / fields,但 `src/stores/workspace-store.ts` runtime **完全不存在**對應實作:

| 位置 | 呼叫 / 讀取 |
|------|-----------|
| TerminalPanel.tsx:210 | `markAgentCommandSent(...)` / `markHasUserInput(...)` |
| TerminalPanel.tsx:385 | 讀 `agentCommandSent`、`hasUserInput` field |

**Worker grep 整份 `workspace-store.ts` 結果**:無任何 `markAgentCommandSent` / `markHasUserInput` / `agentCommandSent` / `hasUserInput` 關鍵字。

## 預期 vs 實際

- **預期**:呼叫 store action 會更新 `TerminalInstance.agentCommandSent` / `hasUserInput` 狀態,讀取時拿到正確 flag
- **實際**:
  - 寫入呼叫 → 方法不存在,runtime 應丟 `TypeError` 或被 optional chain 掩蓋
  - 讀取 → field 永遠 `undefined`
- **副作用(推測)**:agent command 首次發送偵測、使用者首次輸入偵測相關 UI 邏輯失效

## 根因假設(三選一,需調查)

1. **Dead code**:TerminalPanel 搶跑,store 實作被遺忘或砍掉
2. **Upstream drift**:fork 時 store 被修改,component 沒同步移除 call site
3. **Planned but 未完成**:設計階段規劃,實作階段卡住

## 處理方向(未決,等調查)

- [A] **實作 runtime** — store 補上 action + field,完成這兩個 flag 的寫入/讀取流程
- [B] **移除 call site** — TerminalPanel 移除 dead call,對應 UI 邏輯改用其他訊號
- [C] **降級為 optional** — 補 TerminalInstance field 為 optional(T0187 已做),call site 改 `store.markAgentCommandSent?.()` — 但治標不治本

## 建議下一步

開調查型工單(研究型)確認:
1. 這兩個 flag 實際用途(Plan B 需要)
2. Git history 是否有此 action 被移除的紀錄(Plan 2 確認)
3. UI 是否實質依賴此狀態(影響 A vs B 取捨)

## 備註

- **非本輪 PLAN-019 範圍**:PLAN-019 為純型別債清理,不含 runtime / 功能邏輯修正
- **殘留 2 個 tsc error** 在 PLAN-019 完成時記為「已移出範圍」(註記於 PLAN-019 DONE 時)
- 若確認為 dead code(選項 1/2),修復屬 trivial;若為 Planned but 未完成(選項 3),需評估實作成本
