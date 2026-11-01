---
schema_version: 1
schema_kind: workorder
id: T0721
title: "研究：pre.5 後續候選三項（claude 單行 `Press enter to continue` 是否觸發 `claude-stale`、Task tools 清單 UI、`queryOptions` 改用 SDK `Options` 型別）的價值、做法與規模（只查不修）"
type: research
status: PENDING
repo: better-agent-terminal
project: ""
priority: P2
sizing: M
created_at: "2026-11-01T09:49:34+0800"
started_at: ""
updated_at: "2026-11-01T09:49:34+0800"
completed_at: ""
depends_on: []
related:
  - "T0717 回報區「後續候選」第 1 點：claude 2.1.316 新增單行 `Usage limit has reset · Press enter to continue`，不在 `src/lib/usage-limit.ts` 句型內（`claude-stale` 認的是兩行 `Your usage limit has reset` + `Press enter to continue`）；D148 / D192"
  - "T0718 回報區「後續候選」：Task tools 清單 UI（`TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`，取代 `TodoWrite` 快照；`tools` 點名或 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` 需決策）、`queryOptions` 改用 SDK `Options`（目前 `Record<string, unknown>` 再轉型）"
  - "CLAUDE.md「用量限制自動繼續（PLAN-044 / T0566，D148）」、「Sub-agent / Active Tasks Tracking」、「React Rendering」、「Claude Agent SDK / CLI」；`docs/agent-guide/usage-limit-continue.md`、`docs/agent-guide/claude-agent-sdk-cli.md`"
  - "T0722（同時進行：「Claude Agent V1」改名「Claude Agent」，D194）—— 本單不涵蓋改名"
affects_files:
  - _ct-workorders/T0721-research-pre5-followup-candidates.md
  - "_ct-workorders/_report-T0721-followup-candidates.md（回報太長時另寫，選用）"
renew_count: 0
workdir: main repo
worker_question_timeout: 30
research_max_questions: 3
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不修：不改任何產品程式、測試檔、`package.json` / lock、CI、CLAUDE.md、docs。型別試驗、暫存腳本放 Worker 的 scratchpad（例：scratchpad 內的 `tsc` 試驗檔，比照 T0718 的 `optcheck/check.ts`）。"
  - "🔴 不在本 repo 跑 `npx vite build` / `npm run build*` / e2e：T0722 Worker 同時在本 repo 改程式並跑 build。單元測試若要跑，只跑與本單相關的單一檔案（`npx vitest run <file>`），並註明當下工作樹可能含 T0722 未 commit 的變更。"
  - "🔴 不送真實模型請求、不耗 token：claude CLI 行為以官方 changelog、binary 字串、SDK 型別宣告與既有測試判斷；需要實機互動才看得到的，寫進「待實機確認」。"
  - "🔴 結論要有證據：每個「現況是 X」附檔案:行號、binary 字串或官方出處；推論與事實分開標示（【推論】）。"
  - "🔴 可以自己開唯讀子代理平行讀程式碼；回報區要有「子代理使用」紀錄：幾個、做什麼、約多少 tokens（讀不到就寫怎麼估的）。不使用 Workflow 工具（本單沒有授權）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報不寫真名、家目錄路徑或權杖。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit `affects_files`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0721 — 研究：pre.5 後續候選三項

## 元資料

- **工單編號**：T0721
- **類型**：research（只查不修）
- **優先級**：P2
- **建立時間**：2026-11-01T09:49:34+0800
- **預估規模**：M

## 研究目標

T0717 / T0718 留下的後續候選，逐項判斷「要不要做、怎麼做、多大」，讓塔台能直接開實作單或結案。每項的結論第一句寫成「建議 做 / 不做 / 等條件 ___；理由 ___」。

1. **R1：claude 2.1.316 單行 `Usage limit has reset · Press enter to continue`**
   - 這句在 CLI 中何時出現、出現時 CLI 是否真的在等 Enter；和 CLI 內建 `autoContinueAtUsageLimit`（D148：BAT 對 claude 絕不送文字）的關係。
   - 若讓它觸發 `claude-stale`（BAT 送 Enter），會不會和 CLI 自己的自動繼續重複、多產生一個 turn，或在使用者正在打字時送出 Enter。
   - 若要做：`src/lib/usage-limit.ts` 句型與決策表要怎麼改、測試要補什麼；若不做：是否需要只顯示提示。
2. **R2：Task tools 清單 UI**
   - SDK 0.3 / CLI 2.1.316 下，Claude 面板實際會收到 `TodoWrite` 還是 `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`（依模型、`tools` 設定、`CLAUDE_CODE_ENABLE_TODO_TOOLS`）；目前面板怎麼顯示這些工具（T0718 ④ 的紀錄）。
   - 清單 UI 的設計選項（依 task id 累積狀態、顯示位置、與既有 TodoWrite 清單 / active tasks bar 的關係），🔴 不得把 Task* 當成 sub-agent（CLAUDE.md「Sub-agent / Active Tasks Tracking」）；`flushSync` 規則是否適用。
   - 需要使用者決策的點（例如是否點名 `tools` 或設 env）列出選項與建議。
3. **R3：`queryOptions` 改用 SDK `Options` 型別**
   - `electron/claude-agent-manager.ts` `runQuery` 的選項物件改成 `Options`（或 `Partial<Options>`）型別宣告的可行性：在 scratchpad 試驗會出現哪些 `typecheck:electron` 錯誤、有沒有 BAT 傳了但 SDK 型別沒有的選項。
   - 預估改動行數與風險（純型別、不改執行期行為）。

## 已知資訊

- T0717：`claude-stale` 用的兩行句型在 2.1.316 沒變；新單行通知 2.1.306 為小寫 `press`，兩版都不是 BAT 句型。
- T0718：scratchpad `optcheck/check.ts` 以 0.3.316 的 `Options` 驗過 24 個選項名稱都存在；`runQuery` 目前 `Record<string, unknown>` 再轉型。
- 「Claude Agent V1」改名已由使用者決定（D194），另開 T0722 實作，**不在本單範圍**。

## 調查範圍

- `src/lib/usage-limit.ts`、`electron/usage-limit-continue.ts`、對應測試；內嵌 CLI binary 字串（`node_modules/@anthropic-ai/claude-code`）。
- `electron/claude-agent-manager.ts`（`runQuery`、tool_use 處理、`activeTasks`）、Claude 面板的工具卡片 / Todo 清單元件、SDK 0.3 型別宣告（`node_modules/@anthropic-ai/claude-agent-sdk`）。

## 研究指引

- 每項給：結論一句 → 證據 → 若做的實作單草案（範圍、`affects_files`、驗收、規模 S/M/L）→ 需要使用者決策的點。
- 三項之間若可併成同一張實作單，請說明。

## 互動規則

- yolo：不問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台，每輪最多 3 題。
- 互動紀錄寫入回報區。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 調查結論

### 建議方向

### 建議下一步

### 子代理使用

### 遭遇問題

### 回報時間
