---
schema_version: 1
schema_kind: workorder
id: T0739
title: "pre.5 / pre.6 真實模型驗收（小額）：Claude Agent 面板（SDK 0.3）實際對話、工作清單 Task*、背景 Agent 卡片、Grep / Glob 卡片"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T17:35:39+0800"
started_at: ""
updated_at: "2026-11-01T17:35:39+0800"
completed_at: ""
depends_on: [T0738]
related:
  - "T0727（假 API 已驗 BAT 端 ①–⑨；實機仍需：背景 `Agent` 卡片、真實模型是否主動用 Task*）、T0725 / D195（Claude 面板工作清單，Claude 5 開 todo tools）、T0718（SDK 0.3.316、V2 下架）、T0717（內嵌 CLI 2.1.316）"
  - "`e2e/v072-pre6-claude-panel.spec.ts`、`e2e/fixtures/electron-isolation.ts`；CLAUDE.md「Claude Agent SDK / CLI」「Sub-agent / Active Tasks Tracking」；`docs/agent-guide/claude-agent-sdk-cli.md`「Claude 面板工作清單」「Claude 面板額外的模型請求」"
affects_files:
  - "e2e/v072-real-model-claude-panel.spec.ts（新增，檔名可調；🔴 必須預設 skip，只有設 `BAT_E2E_REAL_MODEL=1` 才跑，避免一般 e2e 耗 token）"
  - docs/agent-guide/claude-agent-sdk-cli.md
  - _ct-workorders/T0739-real-model-claude-panel-acceptance.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 使用者已同意（2026-11-01 第一百零三 session）以真實模型小額驗收。預設模型 `claude-haiku-5-5`；4.x 對照只用 `claude-haiku-4-5`、只送 1 個回合。🔴 不得使用 Opus / Fable / Sonnet。用量上限：整張單合計 ≤ 12 個模型回合（不含 CLI 自己的 prompt suggestion / progress summary 等額外請求，但要記錄其數量），每個 prompt 要求簡短回答；面板顯示的估計費用合計超過 US$1 立即停止並回報 PARTIAL。回報區列出每個回合的模型、input / output tokens、估計費用（取自 BAT 面板 / Cache History，取不到就寫取不到）。"
  - "🔴 情境（隔離實例、Claude Agent 面板分頁）：① 送訊息、串流顯示、完成；② 權限詢問：要求執行一個需要核准的 Bash（例 `echo t0739`）→ 面板出現權限卡 → 核准 → 結果回來；③ Grep / Glob：要求在工作區找一個檔案或字串 → 記錄卡片是 Grep / Glob 還是 Bash（CLI 2.1.316 的實際行為，只記錄，兩者都不算失敗）；④ 工作清單：要求『先列出 3 步驟的待辦再逐步完成』→ 記錄模型是否用了 TaskCreate / TaskUpdate（Claude 5）、面板工作清單是否顯示與更新；4.x 對照 1 回合記錄用的是哪種工具；⑤ sub-agent / 背景 Agent：要求用 Agent 工具派一個子任務 → 記錄 active tasks 列、背景 Agent 卡片的顯示、完成後是否清除、`stopTask` 是否可用（選做）；⑥ 換模型後再送 1 回合；⑦ 關閉分頁重開 BAT（同一隔離 runtime）→ resume 該 session → 歷史重建、再送 1 回合可接續。做不到的情境寫原因；模型沒有照指示用某工具時照實記錄，不重試超過 1 次。"
  - "🔴 登入與隔離：用使用者現有的 claude 登入（隔離實例預設沿用真實 HOME 即可）；🔴 不得複製、讀出、記錄或印出任何認證檔或權杖內容（`.credentials.json`、API key、`batcap.`）；測試輸出不得傾印整個 `process.env`。隔離實例：`e2e/fixtures/electron-isolation.ts`（獨立 userData 與 remote port），不碰使用者正在用的 BAT。工作區放 `%ProgramData%\\bat-e2e-t0739-*`（避免載入上層目錄的 `.claude/CLAUDE.md`），跑完刪除；本單在使用者 `~/.claude/projects/` 產生的、目錄名含 `bat-e2e-t0739` 的 session 目錄跑完可刪除（只刪這些），其他一律不動。先 `npx vite build`（T0738 完成後才派本單）。"
  - "🔴 不改產品程式碼；發現產品缺陷 → 記在回報區〈發現的問題〉附重現步驟與證據，由塔台開 BUG。spec 預設 skip（`BAT_E2E_REAL_MODEL=1` 才跑），一般 `npm run test:e2e` 不得因此耗 token。`npm run typecheck` = 0、`npm run typecheck:electron` = 0。`docs/agent-guide/claude-agent-sdk-cli.md` 補一行：真實模型驗收 spec 的位置、啟用方式與本次結果日期。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑或帳號。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0739 — pre.5 / pre.6 真實模型驗收（小額）

## 元資料

- **工單編號**：T0739
- **類型**：implementation（驗收用 e2e，真實模型）
- **優先級**：P2
- **建立時間**：2026-11-01T17:35:39+0800
- **預估規模**：S

## 背景

pre.5（Agent SDK 0.3.316、V2 下架）與 pre.6（Claude 面板工作清單、Claude 5 開 todo tools）的 BAT 端已由 T0727 以假 API 驗過；仍缺真實模型的行為：模型是否主動用 Task*、背景 Agent 卡片、Grep / Glob 卡片、真實串流與 resume。使用者同意以真實模型小額驗收（Haiku 5.5 為主、4.x 對照 1 回合、合計 ≤ 12 回合、≤ US$1）。

## 範圍

1. 情境 ①–⑦（見 frontmatter）。
2. 預設 skip 的 spec（`BAT_E2E_REAL_MODEL=1` 才跑）。
3. docs 一行。

## 不做

- 不用 Opus / Fable / Sonnet；不超過用量上限。
- 不改產品程式碼、不碰認證檔。

## 驗收

- [ ] 情境 ①–⑦ 逐項結果（PASS / 行為記錄 / 未涵蓋與原因）
- [ ] 每回合模型、tokens、估計費用；合計在上限內
- [ ] spec 預設 skip、兩個 typecheck = 0
- [ ] 〈發現的問題〉與〈仍需手動〉

---

## 回報區

### 完成狀態

### 情境結果

### 用量

### 發現的問題

### 仍需手動

### 互動紀錄

### 回報時間
