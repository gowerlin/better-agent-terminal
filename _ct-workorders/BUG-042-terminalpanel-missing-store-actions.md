# BUG-042 — TerminalPanel 呼叫不存在的 WorkspaceStore action

## 元資料
- **編號**:BUG-042
- **狀態**:OPEN
- **嚴重度**:🟡 Medium
- **建立時間**:2026-04-18 22:43 (UTC+8)
- **發現來源**:T0187 PARTIAL(PLAN-019 Cluster 2 補型別時發現)
- **關聯**:PLAN-019 · T0187(已確認 runtime 不存在並 pause 回塔台)
- **可重現**:100%(TypeScript 層面;runtime 行為未測)
- **workaround**:無(讀寫皆失效,但可能被 optional chain 隱匿)

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
