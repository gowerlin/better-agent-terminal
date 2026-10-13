---
schema_version: 1
schema_kind: workorder
id: T0469
title: "voice-opencc.ts 頂層 require('opencc-js') 改為 ensureConverter() 內延遲載入（BUG-116 同型風險，T0468 掃描發現）"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: BUG-116
priority: P2
sizing: S
created_at: "2026-10-13T16:17:57+08:00"
started_at: "2026-10-13T16:19:12+08:00"
updated_at: "2026-10-13T16:19:12+08:00"
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

**DONE** — 三項驗收全綠。

### Landing Zone Check

**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`electron/voice-opencc.ts` 存在 / `electron/__tests__/` 存在 → present（informational）
- C-2：工單無 `branch` 欄位，HEAD = `main` → N/A
- 觀察到 `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

- `electron/voice-opencc.ts`：移除頂層 `const openccJs = require('opencc-js')`，改在 `ensureConverter()` 的 `try` 內 require；型別改為本地 `type OpenccJs`。載入失敗與初始化失敗走同一個 `catch` → `logger.error('[voice] OpenCC initialization failed:', err)` 一次（`initAttempted` 快取），之後每次呼叫回原文、永不 throw。檔頭註解補上「為何 require 必須留在函式內」（BUG-116 / T0469）。對外 API（`convertSimplifiedToTraditional`）、log 訊息、轉換結果不變；呼叫端僅 `electron/voice-handler.ts`，無需修改。
- `electron/__tests__/voice-opencc-lazy-require.test.ts`（新增，`@vitest-environment node`，2 案）：
  1. `opencc-js` 載入即 throw：`voice-opencc` 與 `voice-handler` 可 import、`registerVoiceHandlers` 不 throw、import 階段未 require `opencc-js`；轉換回原文（呼叫 2 次）且 `logger.error` 只 1 次
  2. 正常：import 階段未 require，首次轉換才載入；「语音」→「語音」、「简体中文」→「簡體中文」，無 error
- 測試手法：`opencc-js` 以 CommonJS `require()` 載入，`vi.mock` 攔不到，故在 `Module._load` 攔截（`afterEach` 還原）；`vi.resetModules()` 隔離 singleton。
- **鑑別力驗證**：以 `git show HEAD:electron/voice-opencc.ts` 暫時覆寫回舊版跑新測試 → 2 案皆 FAIL（`expected [ 'opencc-js' ] to deeply equal []`）；還原新版後 2 案 PASS。（未用 stash / checkout / restore。）

### 驗證結果

| lane | 檢查 | 結果 | 證據 |
|---|---|---|---|
| tests | `npx vitest run electron/__tests__/voice-opencc-lazy-require.test.ts` | ✅ PASS | 2 passed |
| tests | `npm run test:unit` 全套 | ✅ PASS | 171 files passed；**2890 passed** \| 1 skipped（基線 2888 + 本單 2），0 failed。stderr 中 `AttachConsole failed` / `No such remote 'origin'` 為既有 node-pty / 暫存 git repo 雜訊，與本單無關 |
| build | `npx vite build` | ✅ PASS | exit 0 |
| build | main chunk grep | ✅ PASS | `dist-electron/main.js` → `main-DTO8HoZW.js`；`require("opencc-js")` 僅 1 處，位於函式內 try：`function hM(){if(Ca)return Ca;if(nw)return null;nw=!0;try{return Ca=require("opencc-js").Converter({from:"cn",to:"tw"}),p.log("[voice] OpenCC s2t converter initialized")…` |
| source | scratchpad tsconfig（extends root，strict + noUnused，`types: [node]`；含 `voice-opencc.ts` / `voice-handler.ts` / 新測試） | ✅ PASS | `tsc -p` exit 0，**0 error** |
| runtime | 實機啟動（Electron） | ⏸️ NOT RUN | 工單未要求；行為已由單元測試 + build 產物 grep 覆蓋 |

### Commit

- 只 `git add` 本單 3 檔：`electron/voice-opencc.ts`、`electron/__tests__/voice-opencc-lazy-require.test.ts`、本工單。未 push。
- 工作區另有並行 T0470 的 `CLAUDE.md` / T0470 工單等變更，未納入。

### 偏離 / 備註

- 無偏離。`logger.warn('[voice] OpenCC not available…')` 每次呼叫仍會記一次 warn（既有行為，工單要求「只記一次錯誤」指 `logger.error`，已滿足），未改動以維持對外行為不變。

### 回報時間

2026-10-13T16:21:10+08:00
