---
schema_version: 1
schema_kind: workorder
id: T0746
title: "BUG-181 真實模型複驗：Cache History 的 R 列與合計（小額，Haiku）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T20:21:32+0800"
depends_on: []
related:
  - "BUG-181（Cache History 把 session 累計值重複計算）；T0744（`0d42ebdc`，`turnModelUsage` 依 model 差值、resume 第一回合 `R*`）；T0739（`e2e/v072-real-model-claude-panel.spec.ts`，〈用量〉表：8 回合實際 US$0.143、舊算法約 0.34）"
  - "CLAUDE.md「Claude Agent SDK / CLI」節（Cache History 的 R 列）；`docs/agent-guide/claude-agent-sdk-cli.md`「Cache History 的 R 列：CLI 累計值換算」"
affects_files:
  - "e2e/v072-real-model-claude-panel.spec.ts（只在需要加 Cache History 讀取 / 斷言時修改；🔴 維持預設 skip，只有 `BAT_E2E_REAL_MODEL=1` 才跑）"
  - docs/agent-guide/claude-agent-sdk-cli.md
  - _ct-workorders/T0746-real-model-cache-history-bug181.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 使用者已同意（2026-11-01 第一百零三 session）以真實模型小額複驗 BUG-181。只用 T0739 spec 既有的模型（`claude-haiku-5-5`，4.x 對照 `claude-haiku-4-5` 1 回合）；🔴 不得使用 Opus / Fable / Sonnet。用量上限：整張單合計 ≤ 12 個模型回合、面板顯示累計費用 ≤ US$0.5，超過立即停止並回報 PARTIAL。只跑 1 次（不連跑 2 次）。"
  - "🔴 驗收重點（BUG-181）：跑完後在隔離實例打開該分頁的 Cache History，讀出每一列（R 列的 input / output / cache read / cache write / 費用、resume 後第一列是否標 `R*`）與合計；比對：① 合計 ≈ CLI 最後一個 result 的 `total_cost_usd`（session 累計，容許四捨五入差）；② 每個 R 列 = 本回合累計 − 上一個 result 的累計（依 model），沒有任何一列是累計值本身；③ 換模型（⑥）那一列以新 model 的基準 0 起算；④ resume（⑦）第一列標 `R*`。讀取方式可在 spec 內加（DOM 或 store），或跑完以 UI 截圖判讀，兩者擇一並寫明；新增的斷言只在 `BAT_E2E_REAL_MODEL=1` 時跑。回報區附表：每列數字、合計、CLI 累計、差異。"
  - "🔴 登入與隔離（沿用 T0739）：用使用者現有的 claude 登入；🔴 不得複製、讀出、記錄或印出任何認證檔或權杖內容（`.credentials.json`、API key、`batcap.`），不得傾印整個 `process.env`。隔離實例 `e2e/fixtures/electron-isolation.ts`，不碰使用者正在用的 BAT。工作區放 `%ProgramData%\\bat-e2e-t0746-*`，跑完刪除；本單在使用者 `~/.claude/projects/` 產生、目錄名含 `bat-e2e-t07` 的 session 目錄跑完可刪除（只刪這些），其他一律不動。"
  - "🔴 Build：本單開工先 `npx vite build`（package.json 版號在上次 build 後改過）；T0747 / T0748 依賴本單的 build、不再自己 build，所以 build 成功後不得再改 `src/` / `electron/` / `scripts/`。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；BUG-181 仍成立 → 記在回報區〈發現的問題〉附數字與重現，塔台處理。`npm run typecheck` = 0、`npm run typecheck:electron` = 0。`docs/agent-guide/claude-agent-sdk-cli.md` 的 Cache History 節補一行：真實模型複驗日期與結果。不發版、不改 CHANGELOG、不 push、不改 BUG-181 狀態（塔台改）。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑或帳號。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0746 — BUG-181 真實模型複驗：Cache History 的 R 列與合計

## 元資料

- **工單編號**：T0746
- **類型**：implementation（驗收用 e2e，真實模型）
- **優先級**：P2
- **建立時間**：2026-11-01T20:21:32+0800
- **預估規模**：S

## 背景

BUG-181 由 T0744 修正（`0d42ebdc`），當時只以假 API 驗證、刻意不耗 token。現在 `v0.7.2-pre.9` 已發佈，使用者同意用真實模型跑一次 T0739 的 spec，確認 Cache History 的 R 列與合計跟 CLI 的累計值一致。

## 範圍

1. `npx vite build`（給 T0747 / T0748 共用）。
2. `BAT_E2E_REAL_MODEL=1` 跑 `e2e/v072-real-model-claude-panel.spec.ts` 一次，讀出 Cache History 並比對（frontmatter ①–④）。
3. 必要時在 spec 加 Cache History 讀取（預設 skip 不變）；docs 一行。

## 不做

- 不用 Opus / Fable / Sonnet；不超過用量上限；不連跑。
- 不改產品程式碼、不碰認證檔、不改 BUG-181 狀態。

## 驗收

- [ ] `npx vite build` 成功
- [ ] Cache History 每列數字、合計、CLI 累計、差異表；①–④ 判定
- [ ] 每回合模型、tokens、估計費用；合計在上限內
- [ ] spec 預設 skip、兩個 typecheck = 0
- [ ] 〈發現的問題〉（沒有寫「無」）

---

## 回報區

（Worker 填寫）
