# 工單 T0033-B-bug010-perf-phase1-2

## 元資料
- **工單編號**：T0033-B P1-2
- **任務名稱**：BUG-010 零風險效能修法 — Activity 去重 + Thumbnail throttle
- **狀態**：DONE
- **建立時間**：2026-04-12 10:05 (UTC+8)
- **開始時間**：2026-04-12 10:33 (UTC+8)
- **完成時間**：2026-04-12 10:36 (UTC+8)
- **目標子專案**：（單一專案，留空）
- **工單類型**：🔧 **Performance Fix**（含 code 修改 + git commit）
- **關聯工單**：T0033-Obs（依據報告）、T0032.5（VS Code 參考）
- **關聯 Bug**：BUG-010（Streaming intermittent freeze）

## 工作量預估
- **預估規模**：**小**（20-40 min）
  - Phase 1（去重）：~10 min（改 1 行 + 驗證 build）
  - Phase 2（throttle）：~20 min（改 RAF → setTimeout + 回歸驗證）
  - 回歸測試：~10 min
- **Context Window 風險**：低（讀 3-4 檔，改 2 檔）
- **降級策略**：Phase 1 和 Phase 2 互相獨立，任一卡關可單獨 commit

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：獨立效能修法，不應與 T0033-C 的 context 混在一起

---

## 任務指令

### 前置條件

**必讀**（精確行號，不要擴散）：
1. `src/components/TerminalPanel.tsx:486-496`（onOutput listener + 重複的 updateTerminalActivity 呼叫）
2. `src/App.tsx:416-418`（全域 onOutput listener + updateTerminalActivity 呼叫）
3. `src/stores/workspace-store.ts:488-502`（updateTerminalActivity 方法定義——O(n) map + 2 秒 notify throttle）
4. `src/components/TerminalThumbnail.tsx:63-86`（scheduleBatchedPreviewUpdate RAF 批次邏輯）

**選讀**（有疑問再讀）：
- `_ct-workorders/reports/T0033-Obs-output-listener-fanout-analysis.md`（完整分析報告）

**不要讀**：
- `_tower-state.md`、其他 T0033-* 工單、learnings

### 背景總結（from T0033-Obs 報告）

**BUG-010 Smoking Gun #1 — Activity double-call**：

每個 output chunk 觸發 **2 次** `updateTerminalActivity()`：

```
App.tsx:417          → workspaceStore.updateTerminalActivity(id)     ← 全域 listener
TerminalPanel.tsx:493 → workspaceStore.updateTerminalActivity(terminalId) ← per-terminal listener
```

`updateTerminalActivity()` 每次呼叫都會：
```ts
this.state = {
  ...this.state,                    // spread 整個 state
  terminals: this.state.terminals.map(t =>   // O(n) 遍歷 + 條件 spread
    t.id === id ? { ...t, lastActivityTime: now } : t
  )
}
```

- `this.notify()` 有 2 秒 throttle → React re-render 不頻繁
- 但 **state 物件複製** 每次都做 → GC 壓力 = 2 × 每秒 chunk 數 × O(n)
- n=20 terminals 時：每秒可能數百次 O(n) map + 物件 spread

**修法**：刪 TerminalPanel 的那個，保留 App.tsx 全域的（因為它能覆蓋未 mount 的 terminal）。

**BUG-010 次要因素 — Thumbnail RAF 過頻**：

`TerminalThumbnail.tsx:63-85` 的 `scheduleBatchedPreviewUpdate` 使用 `requestAnimationFrame`：
- 每 ~16ms flush 一次（60fps）
- 每次 flush：`stripAnsi(raw)` + `split('\n')` + `slice(-8)` + `join`
- Thumbnail preview 不需要 60fps 更新，100-200ms 足夠
- 降頻 6-12 倍 → 大幅減少 scripting 壓力

---

### Phase 1：刪除 TerminalPanel 重複 updateTerminalActivity（~10 min）

**檔案**：`src/components/TerminalPanel.tsx`

**修法**：刪除 line 493 的 `workspaceStore.updateTerminalActivity(terminalId)`

```diff
     // Handle terminal output
     const unsubscribeOutput = window.electronAPI.pty.onOutput((id, data) => {
       if (id === terminalId) {
         const filteredData = filterTerminalOutputNoise(data)
         if (filteredData) {
           terminal.write(filteredData)
         }
-        // Update activity time when there's output
-        workspaceStore.updateTerminalActivity(terminalId)
       }
     })
```

**原理**：
- `App.tsx:416-418` 的全域 listener 已經為**所有** terminal 呼叫 `updateTerminalActivity(id)`
- App.tsx 的全域 listener 不依賴 TerminalPanel mount 狀態（workorder 原文："This is needed because WorkspaceView only renders terminals for the active workspace"）
- 刪掉 TerminalPanel 內的重複呼叫 = 零行為變更 + 50% GC 壓力減少

**驗證**：
- [ ] `npx vite build` 通過
- [ ] `git diff` 只刪 2-3 行（上述 diff）
- [ ] 不要動 App.tsx 的呼叫

### Phase 2：TerminalThumbnail RAF → 150ms setTimeout（~20 min）

**檔案**：`src/components/TerminalThumbnail.tsx`

**修法**：把 `requestAnimationFrame` 改成 `setTimeout(..., 150)`

```diff
 // Batched preview update — accumulate and flush via RAF to avoid per-chunk processing
 const pendingPreviews = new Map<string, string>()
-let previewRafId = 0
+let previewTimerId = 0

 function scheduleBatchedPreviewUpdate(id: string, data: string) {
   const prev = pendingPreviews.get(id) || previewCache.get(id) || ''
   pendingPreviews.set(id, prev + data)
-  if (!previewRafId) {
-    previewRafId = requestAnimationFrame(() => {
-      previewRafId = 0
+  if (!previewTimerId) {
+    previewTimerId = window.setTimeout(() => {
+      previewTimerId = 0
       for (const [tid, raw] of pendingPreviews) {
         const cleaned = stripAnsi(raw)
         const lines = cleaned.split('\n').slice(-8)
         updatePreviewCache(tid, lines.join('\n'))
       }
       pendingPreviews.clear()
       // Evict oldest entries if cache is too large
       if (previewCache.size > MAX_PREVIEW_CACHE) {
         const firstKey = previewCache.keys().next().value
         if (firstKey) previewCache.delete(firstKey)
       }
-    })
+    }, 150)
   }
 }
```

**原理**：
- Thumbnail preview 是低優先視覺回饋，150ms 延遲人眼幾乎感知不到
- RAF（16ms）→ setTimeout（150ms）= flush 頻率降 ~9 倍
- 每次 flush 的 `stripAnsi()` 是 CPU 密集操作，降頻直接減少 scripting 壓力
- 累積效果：更多 data 在同一次 flush 處理 → 更少的 `split` + `slice` + `join` 呼叫

**注意**：
- `window.setTimeout` 返回 `number`（不是 NodeJS `Timeout`），與原本 RAF 返回 `number` 型別相容
- 確認沒有其他地方 `cancelAnimationFrame(previewRafId)` — 若有，也要改成 `clearTimeout(previewTimerId)`
- 150ms 是建議值，合理範圍 100-200ms。不要用 >300ms（會感覺 thumbnail 太延遲）

### 回歸測試

**Phase 1 + 2 完成後**，一起驗證：

| # | 場景 | 操作 | 預期 |
|---|------|------|------|
| 1 | 基本輸出 | 開 terminal → `ls -la` | 輸出正常，thumbnail preview 更新 |
| 2 | 高頻輸出 | `yes "hello world" \| head -1000` 或 `seq 1 1000` | 不 freeze，thumbnail 跟上（可延遲但不卡死） |
| 3 | 多 terminal | 開 3+ terminals → 同時跑輸出 | 所有 terminal activity 正常更新（切 tab 看 lastActivityTime 排序） |
| 4 | Claude Agent | 開 agent terminal → 送長指令 → streaming | streaming 不 freeze，ESC 可中斷（T0033-C 修法依然生效） |
| 5 | Thumbnail preview | sidebar 可見時 → 有輸出 | preview 文字更新（可能稍有延遲但不超過 0.5 秒） |

**跑法**：
- 場景 1-3 可在 dev build 快速驗證
- 場景 4 需要 Claude Agent session（若不方便可標 SKIP + 理由）
- 場景 5 確認 sidebar/thumbnail bar 可見狀態下 preview 是否正常

### Git Commit 策略

**Phase 1 和 Phase 2 分開 commit**（atomic）：

Phase 1 commit：
```
perf(terminal): remove duplicate updateTerminalActivity call (BUG-010)

App.tsx already registers a global onOutput listener that calls
updateTerminalActivity for all terminals. The per-terminal listener
in TerminalPanel was duplicating this work, causing 2x O(n) state
copies per output chunk with no behavioral difference.

Refs: T0033-Obs fan-out analysis
```

Phase 2 commit：
```
perf(terminal): throttle thumbnail preview updates from RAF to 150ms

TerminalThumbnail's batched preview update was flushing every ~16ms
via requestAnimationFrame. Thumbnail previews don't need 60fps;
switching to 150ms setTimeout reduces stripAnsi+split calls by ~9x
while remaining visually imperceptible.

Refs: T0033-Obs fan-out analysis
```

**最後**：工單檔案 commit
```
chore(workorder): T0033-B P1-2 closure
```

### 執行注意事項

- **不要擴散**：只動 TerminalPanel.tsx 和 TerminalThumbnail.tsx，不要動 App.tsx / workspace-store.ts / 其他檔案
- **不要加碼優化**：看到 store 的 O(n) map 可以改善也不要動，那是 Phase 3-5 的事
- **不要動 notify throttle**：store 的 2 秒 notify throttle 是正確的，不要改
- **Grep 確認**：改完後 `grep -n "updateTerminalActivity" src/` 確認只剩 App.tsx 和 store 定義
- **Grep 確認**：改完後 `grep -n "requestAnimationFrame\|cancelAnimationFrame" src/components/TerminalThumbnail.tsx` 確認沒殘留 RAF 引用
- **Build 驗證**：每個 Phase 完成後都跑 `npx vite build`

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### Phase 執行結果

| Phase | 狀態 | 說明 |
|-------|------|------|
| Phase 1（Activity 去重）| ✅ DONE | TerminalPanel.tsx 刪 2 行，build 通過 |
| Phase 2（Thumbnail throttle）| ✅ DONE | RAF → 150ms setTimeout，build 通過 |
| 回歸測試 | ⏭ SKIP | 需 dev runtime 手動驗證，場景描述已在工單 |

### 修法 diff

**Phase 1（TerminalPanel.tsx）**：
```diff
-        // Update activity time when there's output
-        workspaceStore.updateTerminalActivity(terminalId)
```

**Phase 2（TerminalThumbnail.tsx）**：
```diff
-// Batched preview update — accumulate and flush via RAF to avoid per-chunk processing
+// Batched preview update — accumulate and flush via setTimeout to avoid per-chunk processing
-let previewRafId = 0
+let previewTimerId = 0

-  if (!previewRafId) {
-    previewRafId = requestAnimationFrame(() => {
-      previewRafId = 0
+  if (!previewTimerId) {
+    previewTimerId = window.setTimeout(() => {
+      previewTimerId = 0
       ...
-    })
+    }, 150)
   }
```

### 回歸測試結果
需要使用者在 dev build 手動驗證（場景 1-5 見工單），Claude Agent 場景(4)尤其重要。

### Grep 驗證
```
# updateTerminalActivity 殘留確認
# TerminalPanel.tsx → 無（只剩 App.tsx L417、ClaudeAgentPanel.tsx、store 定義）
D:/ForgejoGit/.../src/App.tsx:417:      workspaceStore.updateTerminalActivity(id)
D:/ForgejoGit/.../src/components/ClaudeAgentPanel.tsx:430: ...
D:/ForgejoGit/.../src/stores/workspace-store.ts:488:  updateTerminalActivity(id: string): void {

# RAF 殘留確認（TerminalThumbnail.tsx）
# → 無任何結果 ✅
```

### Git 摘要
- Phase 1 commit SHA：5412e69
- Phase 2 commit SHA：2ac9d56
- 工單 commit SHA：（見下方）
- `git status --short`：M _ct-workorders/_tower-state.md、?? T0033-B-bug010-perf-phase1-2.md

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用（無 sprint-status.yaml）

### 回報時間
2026-04-12 10:36 UTC+8
