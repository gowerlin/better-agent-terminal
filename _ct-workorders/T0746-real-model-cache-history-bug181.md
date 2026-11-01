---
schema_version: 1
schema_kind: workorder
id: T0746
title: "BUG-181 真實模型複驗：Cache History 的 R 列與合計（小額，Haiku）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T20:21:32+0800"
started_at: "2026-11-01T20:23:28+0800"
updated_at: "2026-11-01T20:29:47+0800"
completed_at: "2026-11-01T20:29:47+0800"
session_ids:
  - "5edbe313-6a92-4772-913e-8115845bdfb4"
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

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-01T20:29:47+0800
- **session_id**：5edbe313-6a92-4772-913e-8115845bdfb4
- **結論**：BUG-181 修正在真實模型下成立。Cache History 每個 R 列 = CLI 累計值的差值（依 model），沒有任何一列是累計值本身；換模型那列的新 model 從 0 起算；resume 後第一列 `R*`；real $ 合計 = CLI 最後的 `total_cost_usd`（差 < US$0.00005，四捨五入）。

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 REPO_ROOT 下 → PASS；C-3：`e2e/v072-real-model-claude-panel.spec.ts`、`docs/agent-guide/claude-agent-sdk-cli.md` 存在 → PASS；C-2：工單無 `branch` 欄位（目前 `main`）
- 不在 worktree（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE` = `yolo`、`CT_INTERACTIVE` 未設

### 執行內容

1. `npx vite build`：exit 0（2026-11-01 20:24，package.json `0.7.2-pre.9`）。之後未改 `src/` / `electron/` / `scripts/`，T0747 / T0748 可直接用這次 build。
2. spec 修改（`e2e/v072-real-model-claude-panel.spec.ts`，預設 skip 不變）：
   - 讀取方式：**DOM**。兩次啟動結束前各從狀態列 `cache:` 開 Cache History，讀 `.claude-cache-history-row`（`data-row-kind` / `data-usage-basis`、各欄數字、每個 model 子列）與 `.claude-cache-history-total`，同時截圖（`e2e-results/…/t0746-cache-history-launch{1,2}.png`，gitignore，未 commit）。狀態列預設不顯示 `cacheEff`，seed 時把隔離實例 settings 的 `statuslineItems` 設為 `cacheEff` + `cost`。
   - 比對：以該次啟動 userData 日誌的 `[Claude result] … modelUsage=`（CLI 累計值）為準，依 model 相減算出每列預期值（第一次啟動基準 0；第二次啟動基準未知 → 第一列 `R*` = 累計原值；與基準相同的 result 不列），逐列比 label / basis / input / c.read / c.write / output / real $ / model 清單 / model 子列，並檢查「後面的列不是累計值本身」與 real $ 合計 vs `getSessionMeta().totalCost`。不符先收集、最後才 `expect(cacheMismatches).toEqual([])`，第一次啟動的不符不會跳過 resume。
   - `MAX_COST_USD` 1 → 0.5（本單上限）；新增 `BAT_E2E_RUN_TAG=t####`（預設 `t0739`）決定 `%ProgramData%\bat-e2e-<tag>-*` 與要清的 `~/.claude/projects` 資料夾；修正第二次啟動重複收錄第一次啟動 result 日誌的問題（`logLines` 以第一次啟動的行數切開）。
3. 執行一次：`BAT_E2E_REAL_MODEL=1 BAT_E2E_RUN_TAG=t0746 npx playwright test e2e/v072-real-model-claude-panel.spec.ts` → **1 passed（1.6 m，spec 本身 95 s）**，日誌 `T0746 Cache History mismatches: none`。未連跑。
4. 預設 skip 確認：不帶 `BAT_E2E_REAL_MODEL` 執行同一 spec → `1 skipped`。

### Cache History 比對表

第一次啟動（新 session，基準 0）。列 6 是 ⑤ 背景 Agent 結束後 CLI 自己接續的回合（spec 記為 `⑤ auto follow-up`）。

| # | 回合 | 標示 / basis | models | input | c.read | c.write | output | real $（面板） | CLI 累計 c.read / $ | 預期（差值 in / c.read / c.write / out / $） | 判定 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ① | R / turn | haiku-5-5 | 1,190 | 0 | 39,961 | 229 | $0.0082 | 0 / 0.008226 | 1190 / 0 / 39961 / 229 / 0.008226 | OK |
| 2 | ② | R / turn | haiku-5-5 | 4 | 67,106 | 17,885 | 90 | $0.0043 | 67,106 / 0.012519 | 4 / 67106 / 17885 / 90 / 0.004293 | OK |
| 3 | ③ | R / turn | haiku-5-5 | 510 | 134,228 | 4,230 | 229 | $0.0024 | 201,334 / 0.014873 | 510 / 134228 / 4230 / 229 / 0.002354 | OK |
| 4 | ④ | R / turn | haiku-5-5 | 518 | 372,820 | 8,617 | 810 | $0.0059 | 574,154 / 0.020781 | 518 / 372820 / 8617 / 810 / 0.005908 | OK |
| 5 | ⑤ | R / turn | haiku-5-5 | 510 | 172,729 | 4,580 | 202 | $0.0028 | 746,883 / 0.023577 | 510 / 172729 / 4580 / 202 / 0.002795 | OK |
| 6 | ⑤ 自動接續 | R / turn | haiku-5-5 | 6 | 61,800 | 31,813 | 49 | $0.0047 | 808,683 / 0.028235 | 6 / 61800 / 31813 / 49 / 0.004658 | OK |
| 7 | ⑥ | R / turn | haiku-5-5 + haiku-4-5 | 532 | 156,095 | 48,133 | 464 | $0.1083 | 964,778 / 0.136555 | 532 / 156095 / 48133 / 464 / 0.108320 | OK |

- 合計：real $ **$0.1366** vs CLI `total_cost_usd` **0.136555**（差 +0.000045，四捨五入）；est. $ $0.1389；另有 17 個單次呼叫列（不計入 real $）。
- 列 7 的 model 子列：haiku-4-5 = 累計原值（in 26 / out 406 / c.read 93,779 / c.write 48,087 / $0.107608，基準 0）；haiku-5-5 = 差值（in 506 / out 58 / c.read 62,316 / c.write 46 / $0.000712）。spec 也逐一比對子列，OK。
- 對照：若沿用舊算法（累計值直接加總），real $ 會是 0.0082 + 0.0125 + 0.0149 + 0.0208 + 0.0236 + 0.0282 + 0.1366 ≈ US$0.245；本次面板合計為 $0.1366。

第二次啟動（同一 runtime 重開，分頁 auto-resume，sdkSessionId 相同）：

| # | 回合 | 標示 / basis | models | input | c.read | c.write | output | real $（面板） | CLI 累計 c.read / $ | 預期 | 判定 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ⑦ | **R*** / includes-prior | haiku-5-5 + haiku-4-5 | 3,622 | 1,075,227 | 160,392 | 2,998 | $0.1480 | 1,075,227 / 0.148042 | 累計原值 3622 / 1075227 / 160392 / 2998 / 0.148042 | OK |

- 合計：real $ **$0.1480** vs CLI `total_cost_usd` **0.148042**（差 −0.000042）；est. $ $0.1504。

判定：① 合計 ≈ 累計 → PASS（兩次啟動）；② 每個 R 列 = 本回合累計 − 上一個 result 累計（依 model），沒有一列是累計值本身 → PASS；③ ⑥ 那列 haiku-4-5 子列從 0 起算 → PASS；④ resume 後第一列 `R*` → PASS。

### 每回合模型、tokens、費用（用量上限）

| 回合 | 模型 | 結果 | Δ 費用（US$） | session 累計（US$） | 工具 |
|---|---|---|---|---|---|
| ① | claude-haiku-5-5 | completed | 0.008226 | 0.008226 | — |
| ② | claude-haiku-5-5 | completed（權限卡「允許此 Bash 呼叫？」→ 是，資料夾建立） | 0.004293 | 0.012519 | Bash(mkdir) |
| ③ | claude-haiku-5-5 | completed | 0.002354 | 0.014873 | Grep |
| ④ | claude-haiku-5-5 | completed（清單 3 項全 completed） | 0.005908 | 0.020781 | ToolSearch、TaskCreate ×3、TaskUpdate ×3 |
| ⑤ | claude-haiku-5-5 | completed | 0.002795 | 0.023577 | Agent[bg] |
| ⑤ 自動接續 | claude-haiku-5-5 | auto | 0.004658 | 0.028235 | — |
| ⑥ | claude-haiku-4-5（含 5.5 額外請求） | completed | 0.108320 | 0.136555 | TaskCreate ×2、TaskUpdate ×2 |
| ⑦（resume） | claude-haiku-5-5（含 4.5 用量，見〈發現的問題〉3） | completed，接續上下文 | 0.011487 | 0.148042 | — |

- 合計 **8 個模型回合（上限 12）**、session 累計 **US$0.148（上限 0.5）**；只用 Haiku 5.5 / Haiku 4.5，結果日誌中沒有 Opus / Fable / Sonnet。各回合 tokens 見上方比對表（每列 = 該回合 tokens）。
- 其他場景（觀察，沿用 T0739 規格）：① PASS；② PASS；③ Grep；④ Task\* 有、TodoWrite 無；⑤ Agent 卡片有「背景」標籤、完成後 dot-success，執行中 active task bar 0（與 T0739 相同）；⑥ Task\* 有；⑦ PASS（歷史重建、回答 "T0739 hello"）。

### 驗證

| 證據道 | 結果 | 內容 |
|---|---|---|
| build | PASS | `npx vite build` exit 0 |
| 真實模型 e2e | PASS | 上述指令 1 passed；Cache History mismatches none |
| 預設 skip | PASS | 不帶 `BAT_E2E_REAL_MODEL` → 1 skipped |
| typecheck | PASS | `npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 另以 `tsc --noEmit --strict` 單檔檢查 0 錯誤） |
| 清理 | PASS | 工作區 `%ProgramData%\bat-e2e-t0746-*` 已刪（`ProgramData` 下無 `bat-e2e*`）；`~/.claude/projects` 刪除 1 個 `bat-e2e-t0746` 資料夾，剩 0 個含 `bat-e2e-t07` 的資料夾；隔離 runtime userData 已刪 |
| 去識別化 | PASS | spec / docs diff 無家目錄路徑、帳號、金鑰樣式 |

### 產品程式碼

- 未改 `src/` / `electron/` / `scripts/`；未碰認證檔、未傾印 env（spec 沿用既有的 `ANTHROPIC_*` / `CLAUDE*` 移除邏輯）。

### Commit

- `9e37c226` test(e2e): compare Cache History with CLI running totals in the real-model spec (T0746)（只含 `e2e/v072-real-model-claude-panel.spec.ts`、`docs/agent-guide/claude-agent-sdk-cli.md`）
- 工單：本次回報 commit（只含本工單檔）
- 未 push、未發版、未改 CHANGELOG、未改 BUG-181 狀態

### 發現的問題

1. BUG-181：**無**（真實模型下修正成立，見比對表）。
2. 觀察（非本單範圍、不影響判定）：⑥ 的 4.5 回合單回合 US$0.108，是本次費用大宗 —— 換到 haiku-4-5 後 prompt cache 對新 model 重新寫入（c.write 48,087，1h cache），屬模型 / 計價本身，與 BAT 無關。
3. 觀察：⑦ 在 haiku-5-5 下，CLI 累計的 haiku-4-5 仍增加（in +350 / out +917 / c.read +48,087 / c.write +45，約 US$0.0098）。推測是 CLI 在 resume 時以前一個 model 發的內部請求，屬 CLI 側行為；BAT 的 `R*` 列照累計值正確呈現。未深究。
4. 已知限制照舊：est. $ 與 real $ 有小差（launch 1：0.1389 vs 0.1366），est. $ 只是內建價目表估算。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### 偏離

- 無。`MAX_COST_USD` 調降與 `BAT_E2E_RUN_TAG` 是為了符合本單的用量上限與工作區命名（`bat-e2e-t0746-*`）；T0739 的預設行為（tag `t0739`）不變，只有費用上限變嚴。

### 後續建議

- 塔台可依本結果處理 BUG-181 狀態（驗證依據：本單 + `v0.7.2-pre.9` 原始碼 build）。
