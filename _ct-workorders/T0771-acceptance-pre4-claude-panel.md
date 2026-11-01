---
schema_version: 1
schema_kind: workorder
id: T0771
title: "pre.4 自動化驗收（安裝版）：Claude 面板 —— 面板 ⚠️（T0762）、BUG-190 背景子代理留在 task bar、BUG-192 背景子代理執行中送訊息（假 API ＋真實模型小額）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T05:08:42+0800"
depends_on: []
related:
  - "BUG-190（T0759 `b8a3b7f7`）、BUG-192（T0768 研究、T0769 `9ab26222`，D214）、T0762（`c479a595`）；D215（本批自動化驗收，真實模型上限）"
  - "既有 e2e：`e2e/t0762-claude-panel-waiting.spec.ts`、`e2e/v072-pre6-claude-panel.spec.ts`（⑦b 背景子代理、⑦c 執行中送訊息、①–⑫ 不回歸）、`e2e/v072-real-model-claude-panel.spec.ts`（T0739 真實模型的做法與費用計算）；隔離實例 `e2e/fixtures/electron-isolation.ts`（`BAT_E2E_EXECUTABLE`）"
  - "CLAUDE.md「Sub-agent / Active Tasks Tracking」節（背景子代理、執行中送出訊息）；`docs/agent-guide/claude-agent-sdk-cli.md`「Claude 面板的背景子代理」「Claude 面板：背景子代理執行中送出訊息」；T0739〈發現的問題〉F1（`total_cost_usd` 是 session 累計值）"
affects_files:
  - "e2e/v072-real-model-claude-panel.spec.ts（擴充，或新增 `e2e/t0771-*.spec.ts`；🔴 真實模型部分必須預設 skip，只有 `BAT_E2E_REAL_MODEL=1` 才跑）"
  - "e2e/t0762-claude-panel-waiting.spec.ts、e2e/v072-pre6-claude-panel.spec.ts（只在需要讓它們支援安裝版時小改，不得改斷言語意）"
  - docs/agent-guide/claude-agent-sdk-cli.md
  - _ct-workorders/T0771-acceptance-pre4-claude-panel.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 驗收對象：優先用安裝版 `C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe`（FileVersion `0.7.3-pre.4`）以 `BAT_E2E_EXECUTABLE` 啟動隔離實例；某 spec 無法在安裝版跑 → 改用現有 source build `dist` / `dist-electron`（04:29 由 `31fa4974` 建出，HEAD 的 `src` / `electron` / `scripts` 與 tag `v0.7.3-pre.4` 無差異），回報逐情境寫明。🔴 不得跑 `npx vite build`（T0770–T0773 並行）。🔴 不改 `e2e/fixtures/electron-isolation.ts`。"
  - "🔴 假 API 部分（不耗 token）：① t0762：面板權限卡 / AskUserQuestion → 縮圖與工作區列 ⚠️；是 / 否 / 取消後清除；沒看到就結束留淡化（D203）。② v072-pre6-claude-panel 整支：⑦b（背景子代理執行中 bar 1 項、結束 0 項、卡片 `[completed]`、從 bar 停止可停）、⑦c（主回合 result 後、背景子代理執行中送訊息 → 立即回覆、子代理不受影響、沒有「已中斷」前綴）、①–⑫ 不回歸。"
  - "🔴 真實模型部分（使用者 2026-11-02 同意，D215）：一律 `claude-haiku-5-5`（隔離實例設定，不改產品程式碼）；🔴 不得使用 Opus / Fable / Sonnet。本單上限：合計 ≤ 12 個模型回合、估計費用 ≤ US$0.60（全批上限 US$1.00，T0773 用其餘），超過立即停止、回 PARTIAL。費用依 T0739 F1：`total_cost_usd` / `modelUsage` 是 session 累計值，取最大值、不相加；讀不到就寫讀不到。情境：③ 請模型以背景子代理（`Agent`，`run_in_background: true`）讀一個小檔並摘要、主回合先回覆 → 記錄模型有沒有真的用背景；有 → bar 在子代理執行中有 1 項、結束後移除、卡片標 `[completed]`（BUG-190）。④ 背景子代理執行中、主回合已 result 時送新訊息（例：「先回答 1+1」）→ 立即回覆、子代理繼續、bar 不變、無「已中斷」前綴；或出現「等背景子代理結束後送出」＋取消（排隊退路，也算通過，記錄走哪條）（BUG-192）。⑤（預算內才做）從 bar 停止背景子代理 → 真的停下、卡片 `[stopped …]`。模型沒照指示用背景時同一情境最多重試 1 次，仍不用就照實記錄（不算 BAT 缺陷）。"
  - "🔴 登入與隔離：用使用者現有的 claude 登入；🔴 不得複製、讀出、記錄或印出任何認證檔或權杖內容（`.credentials.json`、API key、`batcap.`），不得傾印整個 `process.env`。隔離實例，不碰使用者正在用的 BAT。工作區 / 目錄名含 `t0771`，放 `%ProgramData%\\bat-e2e-t0771-*`（避免載入上層 `.claude/CLAUDE.md`），跑完刪除；本單在 `~/.claude/projects/` 產生、目錄名含 `bat-e2e-t0771` 的 session 目錄跑完可刪除（只刪這些），其他一律不動。不改產品程式碼；發現產品缺陷 → 〈發現的問題〉附重現步驟與證據，由塔台開 BUG。"
  - "🔴 驗證：真實模型 spec 預設 skip，跑 1 次（不連跑）；假 API spec 失敗時同一情境最多重跑 1 次並記錄（並行負載可能造成逾時，分清楚 flake 與缺陷）。`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 在 tsconfig 範圍外就註明）。docs：`claude-agent-sdk-cli.md` 兩個背景子代理小節的驗證清單各補一行（真實模型結果）。回報附每回合模型、tokens、估計費用。不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）：回報與 spec 不得出現使用者家目錄路徑或帳號。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0771 — pre.4 自動化驗收（安裝版）：Claude 面板

## 元資料

- **工單編號**：T0771
- **類型**：implementation（驗收用 e2e，假 API ＋真實模型小額）
- **優先級**：P2
- **建立時間**：2026-11-02T05:08:42+0800
- **預估規模**：S

## 背景

`v0.7.3-pre.4` 已發佈。使用者選擇以自動化取代手動實機驗收（D215），真實模型全批上限 US$1.00。T0759 / T0769 只用假 API 驗過 BAT 端；模型實際會不會用背景子代理、真實時序下注入或排隊的行為，要靠真實模型確認。

## 範圍

1. 假 API：① t0762、② v072-pre6-claude-panel 整支。
2. 真實模型（Haiku 5.5，≤ US$0.60）：③ BUG-190、④ BUG-192、⑤ 停止（預算內）。
3. docs 各一行。

## 不做

- 不用 Opus / Fable / Sonnet；不超過上限；不改產品程式碼、不 build、不改共用 fixture；不碰認證檔。

## 驗收

- [ ] 情境 ①–⑤ 逐項結果，每項寫明驗收對象（安裝版 / source build）
- [ ] 每回合模型、tokens、估計費用；合計在上限內
- [ ] 真實模型 spec 預設 skip、兩個 typecheck = 0
- [ ] 〈發現的問題〉與〈仍需手動〉

---

## 回報區
