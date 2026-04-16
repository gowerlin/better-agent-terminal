# 工單 T0125-upstream-cache-history-abort

## 元資料
- **工單編號**：T0125
- **任務名稱**：移植上游 Cache History UI + /abort command
- **狀態**：DONE
- **建立時間**：2026-04-16 16:16 (UTC+8)
- **開始時間**：2026-04-16 16:20 (UTC+8)
- **完成時間**：2026-04-16 16:55 (UTC+8)
- **關聯 PLAN**：PLAN-010
- **前置研究**：T0122（分析報告）、T0124（差異盤點）

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：中（需參考上游 ~20 個 commits 的 diff + 我們的既有邏輯）
- **降級策略**：若 CW 不足，優先完成 Cache History UI，/abort 獨立收尾

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需要大量 diff 分析和新檔案建立

## 任務指令

### 前置條件
需載入的文件清單：
- `_ct-workorders/reports/_report-upstream-sync-v2.1.3-to-v2.1.42.md`（Batch 2 #15, #19）
- `_ct-workorders/T0124-research-upstream-phase2-gap-check.md`（差異盤點結論）

### 輸入上下文

**專案**：better-agent-terminal（Electron + React + TypeScript）
**背景**：Fork 自 tony1223/better-agent-terminal。T0124 盤點確認我們**唯一缺少的功能**是 Cache History UI，另外 `/abort` 指令功能等價但缺打字便利性。

**upstream remote**：已設定且已 fetch（`upstream` → tony1223）

### Part A：Cache History UI（主要工作）

**上游狀態**：上游有 ~20 個 cache history 相關 commits，包含：
- Per-call cache breakdown 和 API call count
- Per-model cost breakdown（5m/1h split + timestamp）
- Cache TTL countdown timer（floating badge）
- Cache history modal（clickable rows 查看 turn details）
- Cache expiry cost warning
- Clear cache history button

**我們的狀態**：
- 已追蹤 cache tokens（`cacheReadTokens` / `cacheCreationTokens`）
- 已有 `cacheEff` statusline item
- **缺少**：per-call 歷史 UI modal、per-model 分項、TTL countdown

**移植策略**：
1. 先用 `git diff v2.1.3..upstream/main` 查看上游 cache history 相關的所有改動
2. 識別新增的元件/檔案（可能是 CacheHistoryModal 或類似）
3. 參考上游實作，在我們的架構中新增 Cache History 功能
4. **不要 cherry-pick**（衝突太多），改為**參考上游邏輯手動實作**

**上游 cache history 相關 commits 清單**（按時間序）：
```
98c2d87  feat: add context column to cache history, cacheEff to default statusline
98d915f  feat: add per-call cache breakdown and API call count to cache history
f2b73a4  feat: per-model cost breakdown in cache history with 5m/1h split and timestamp
22376ac  feat: clickable R rows in cache history to view turn conversation details
5fd8f36  fix: cache history missing call entries when streaming tokens don't exceed previous result
c7ea807  fix: cache history separates API call entries from result entries with pricing fallback
27d0a21  fix: cache history separates API call entries from result entries with pricing fallback
37bea0a  feat: fix context token display, cache history modal, auto-compact setting, and getContextUsage caching
904f5e3  fix: cache history R row uses turnStartMsgId for precise message filtering and adds real cost column
411e749  fix: worktree tab reopen fails when directory still exists on disk（不相關）
ae8a44b  fix: cache history R row uses turnStartMsgId for precise message filtering and adds real cost column
8fb1613  feat: add cache TTL countdown timer as floating badge
dde4d0f  feat: add cache expiry cost warning and hide V1/V2 switch buttons
ae35174  feat: enhance README with comprehensive feature docs and add cache history clear button
8d23e6e  fix: clear cache history and alarm timer on /new and /clear
```

**關鍵搜尋起點**：
```bash
# 查看上游 cache history 新增了哪些元件
git diff v2.1.3..upstream/main --name-only | grep -i cache
# 查看具體 diff
git show 98d915f  # per-call cache breakdown（起始 commit）
git show 37bea0a  # cache history modal
```

### Part B：/abort command（次要，極小改動）

**上游 commit**：`3948cda` feat: add /abort command and fix second ESC not stopping operations

**我們的狀態**：
- ESC 中斷已實作（pause + double-Esc stop）
- 缺少 `/abort` 作為打字指令

**移植策略**：
1. 查看上游 `3948cda` 的 diff
2. 在我們的 slash command 攔截邏輯中新增 `/abort`（預估 <10 行）
3. 連接到既有的 stop/abort 邏輯

### 預期產出
- Cache History UI 元件（modal 或 panel）
- 相關 IPC handler（若需要）
- `/abort` slash command 攔截
- Build 驗證通過

### 驗收條件
- [ ] `npx vite build` 通過
- [ ] Cache History modal 可從 UI 觸發開啟
- [ ] 每次 API call 的 cache token 數據有記錄
- [ ] `/abort` 指令可中斷進行中的 agent 操作
- [ ] 既有功能未被破壞（語音、CT 面板、Status Line、Dashboard）

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 讀取分析報告和 T0124 結論
4. **Part A**：分析上游 cache history 實作 → 手動 port 到我們的架構
5. **Part B**：cherry-pick 或手動加入 `/abort` command
6. `npx vite build` 驗證
7. 填寫回報區
8. 更新「狀態」和「完成時間」

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**Part A：Cache History UI（主要功能）**
- `electron/claude-agent-manager.ts` — 新增 `callCacheRead`、`callCacheWrite`、`lastQueryCalls`、`modelUsage`、`cacheWrite5mTokens`、`cacheWrite1hTokens` session metadata 欄位；在 streaming 事件追蹤 per-call cache breakdown；result 處理時匯出 per-model usage 和 ephemeral cache write breakdown；新增 `abortSession()` 方法
- `electron/main.ts` — 註冊 `claude:abort-session` IPC handler
- `electron/preload.ts` — 新增 `abortSession` preload API
- `src/types/index.ts` — AppSettings 新增 `cacheAlarmTimer` 和 `cacheExpiryWarning` 設定
- `src/stores/settings-store.ts` — 新增 `setCacheAlarmTimer()` 和 `setCacheExpiryWarning()` 方法
- `src/components/ClaudeAgentPanel.tsx` — 
  - SessionMeta 新增 cache 相關欄位
  - 新增 `cacheHistoryRef`、`lastResultRef`、`showCacheHistory`、`cacheEntryModal`、`cacheCountdown`、`cacheAlarmEnabled` state
  - 新增 `messageCountRef`、`currentTurnMsgIdRef` 用於追蹤 turn 邊界
  - onStatus handler 新增 cache history 追蹤邏輯（自動去重、trimming、result 識別）
  - `/new` 和 `/clear` 清除 cache history
  - cacheEff statusline item 改為 clickable，使用 history-based 最低值著色
  - 新增 Cache History Modal（完整的 per-call、per-model cost breakdown 表格）
  - 新增 Cache Entry Turn Detail Modal（點 R 行可查看該 turn 的對話內容）
  - 新增 Cache TTL Countdown Badge（5m/1h 倒數，僅在設定啟用且閒置 >1min 後顯示）
  - Settings subscription 新增 cacheAlarmEnabled 同步
  - Cache alarm timer useEffect（每 30s 更新）
- `src/styles/claude-agent.css` — 新增 `.claude-cache-alarm` 浮動 badge 樣式

**Part B：/abort command**
- `electron/claude-agent-manager.ts` — 新增 `abortSession()` 硬中斷方法
- `electron/main.ts` + `electron/preload.ts` — 新增 IPC 通道
- `src/components/ClaudeAgentPanel.tsx` — 
  - `/abort` slash command 攔截，呼叫 `abortSession()` 並清理 UI 狀態
  - `handleStop` 改用 `abortSession`（硬中斷取代漸進式 interrupt）
  - Slash commands 清單新增 `/abort`

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-16 16:55 (UTC+8)
