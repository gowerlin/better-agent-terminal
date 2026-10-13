---
schema_version: 1
schema_kind: workorder
id: T0469
title: "voice-opencc.ts 頂層 require('opencc-js') 改為 ensureConverter() 內延遲載入（BUG-116 同型風險，T0468 掃描發現）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-116
priority: P2
sizing: S
created_at: "2026-10-13T16:17:57+08:00"
started_at: null
updated_at: "2026-10-13T16:17:57+08:00"
completed_at: null
target_version: next
depends_on:
  - T0468
related:
  - "T0468 回報區「同類風險掃描」：opencc-js 頂層 require 未包 try/catch，經 voice-handler → main.ts 頂層鏈載入，套件缺失會讓 main 啟動崩潰"
affects_files:
  - electron/voice-opencc.ts
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 只改 `electron/voice-opencc.ts` + 新增 / 修改其測試；不動 node_modules、package.json；與 T0470 並行（T0470 改 workflow / scripts），`git add` 只加本單檔案"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；寫檔維持 LF；不 push"
---

# T0469 — opencc-js 延遲載入

## 任務

- 把頂層 `require('opencc-js')` 移進 `ensureConverter()` 的 try 區塊內（首次轉換時才載入）；載入或初始化失敗 → 既有 `logger.error` 一次 + 回傳原文，**永不 throw**（檔頭註解宣稱的行為要真的成立）
- 對外 API 與轉換結果不變
- 單元測試：mock `opencc-js` import 即 throw → 模組可 import、`registerVoiceHandlers` 鏈不崩、轉換回原文且只記一次錯誤；正常情況轉換結果不變（例：「语音」→「語音」）

## 驗收條件

- [ ] 相關測試綠；`npm run test:unit` 全套 0 failed（基線 2888）
- [ ] `npx vite build` exit 0；main chunk 不再於頂層 require `opencc-js`（grep 證據）
- [ ] electron 型別以 scratchpad tsconfig 檢查 0 新錯

## Sub-session 執行指示

1. 讀本工單 + `electron/voice-opencc.ts` + 呼叫端
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

### 產出摘要

### 驗證結果

### 回報時間
