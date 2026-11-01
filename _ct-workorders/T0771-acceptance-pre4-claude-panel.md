---
schema_version: 1
schema_kind: workorder
id: T0771
title: "pre.4 自動化驗收（安裝版）：Claude 面板 —— 面板 ⚠️（T0762）、BUG-190 背景子代理留在 task bar、BUG-192 背景子代理執行中送訊息（假 API ＋真實模型小額）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T05:08:42+0800"
started_at: "2026-11-02T05:14:13+0800"
updated_at: "2026-11-02T05:21:34+08:00"
completed_at: "2026-11-02T05:21:34+08:00"
session_ids:
  - "91542646-55b4-4ea7-b228-0eba008422cb"
commits:
  - "a173f74a"
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

- [x] 情境 ①–⑤ 逐項結果，每項寫明驗收對象（安裝版 / source build）
- [x] 每回合模型、tokens、估計費用；合計在上限內
- [x] 真實模型 spec 預設 skip、兩個 typecheck = 0
- [x] 〈發現的問題〉與〈仍需手動〉

---

## 回報區

### 完成狀態

- **狀態**：DONE（情境 ①–⑤ 全部 PASS，驗收對象全部是安裝版）
- **完成時間**：2026-11-02T05:21:34+08:00
- **session_id**：91542646-55b4-4ea7-b228-0eba008422cb

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`e2e/v072-real-model-claude-panel.spec.ts`、`e2e/t0762-…`、`e2e/v072-pre6-…`、`docs/agent-guide/claude-agent-sdk-cli.md` 都存在 → PASS
- C-2：工單沒有 `branch` 欄位，目前 `main`
- `BAT_WORKSPACE_ID`（只記錄）：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE=yolo`；沒有 `CT_HOME`（不在 worktree）

### 驗收對象

- 安裝版 `C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`，FileVersion `0.7.3-pre.4`（`resources/package.json` 同版號），以 `BAT_E2E_EXECUTABLE` 啟動隔離實例。三支 spec 都能直接在安裝版跑，**沒有用到 source build**，也沒有改 `e2e/t0762-…` / `e2e/v072-pre6-…` / `e2e/fixtures/electron-isolation.ts`。
- Playwright 的 `--output` 指到 Worker scratchpad（避免與 T0770 / T0772 / T0773 並行時互相清掉預設的 `e2e-results/`）。

### 情境結果

| 情境 | 對象 | 結果 | 證據 |
|---|---|---|---|
| ① t0762 面板 ⚠️（假 API） | 安裝版 | PASS（1 次通過，5.6 s） | 權限卡 → 縮圖 ⚠️（`data-blocked-reason=permission`）＋工作區列 ⚠️（target = 該分頁）；「是」/「否」後縮圖 ⚠️ 消失、列 ⚠️ 消失（視窗有焦點）；切到 B 時由面板外回答 → A 列淡化 ⚠️（`missed`），點擊 → A active、面板分頁選中、淡化 ⚠️ 清除（D203） |
| ② v072-pre6-claude-panel 整支（假 API） | 安裝版 | PASS（2 tests，1 次通過，30.6 s） | ⑦b：背景子代理主回合結束後 bar 1 項「T0759 bg probe」含「背景」標籤，結束後 0 項、`[completed] bg sub-agent finished`；第 2 個從 bar 停止 → `[stopped by user] T0759 bg stop probe`。⑦c：主回合 result 後送訊息 157 ms 回覆，bar 仍 1 項、卡片 running、沒有 `Agent terminated unexpectedly`、子代理沒重跑；注入回合中按 Esc → bar 仍 1、放行後 `[completed] bg3 sub-agent finished`。①–⑫ 不回歸全 PASS（①② deferred Task 工具、③ 工作清單、④ 重開 resume 重建、⑤ 串流、⑥ 權限 是/否、⑦ 前景 Agent、⑧ V2 遷移、⑨ claude-cli env、⑩ 模型清單 0 請求、⑪⑫ `CLAUDE_CONFIG_DIR`）；封鎖 proxy 0 次嘗試 |
| ③ BUG-190 真實模型 | 安裝版 | PASS | 模型第 1 次就照指示呼叫 `Agent`（`run_in_background: true`、`model: haiku`），主回合先回「launched」結束；2 s 後 bar 1 項「T0771 bg summary」、標籤「背景」、卡片 `dot-running`；子代理跑完 ping、讀 notes.txt 後 bar 0 項、卡片 `dot-success`、`[completed] The ping ran to completion, and the notes file says: … lighthouse that is painted green and blinks every 7 seconds.`（內容正確）；之後 CLI 自己多跑 1 回合 |
| ④ BUG-192 真實模型 | 安裝版 | PASS（**注入路徑**） | ③ 的子代理執行中（主回合已 result）送「1+1」→ 3,114 ms 收到 result，畫面回覆「2」（截圖確認）；當時 bar 仍 1 項（`0:07 背景 Stop`）、卡片 running；沒有 `Agent terminated unexpectedly`、沒有「使用者先前的訊息（已中斷）」前綴；沒有出現排隊提示；子代理之後照常 `[completed]` |
| ⑤ 從 bar 停止（預算內） | 安裝版 | PASS | 第 2 個背景子代理（ping 90 s）bar 1 項 → 按 bar 的停止 → bar 0 項、卡片 `[stopped by user] Running Run the exact ping command and wait for it to finish`；之後 CLI 多跑 1 回合 |

- 假 API 兩支都是 1 次通過，沒有重跑；真實模型 spec 只跑 1 次。
- 權限卡：真實模型那次面板是 Bypass permissions（預設），permission requests 0；spec 內的自動允許只是防卡住，沒有觸發。

### 真實模型用量（每回合）

模型：全部 `claude-haiku-5-5`（`modelUsage` 只有這一個 model；隔離實例另設 `CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-5-5`，Agent 呼叫也帶 `model: haiku`）。`total_cost_usd` / `modelUsage` 是 session 累計值（T0739 F1），費用取最大值、不相加；「本回合 Δ」= 與前一個 result 的累計差。回合與情境的對應依時序推定（spec 沒有逐 result 標情境）。

| # | 回合 | 該回合主請求 usage（in / c.write / c.read / out） | 累計 modelUsage（in / out / c.read / c.write） | 累計 $ | 本回合 Δ $ |
|---|---|---|---|---|---|
| 1 | ③ 派背景子代理（主回合） | 4 / 44,486 / 40,124 / 316 | 1,357 / 340 / 40,124 / 44,486 | 0.009604 | 0.009604 |
| 2 | ④ 注入「1+1」 | 2 / 568 / 44,490 / 3 | 1,867 / 766 / 129,100 / 76,428 | 0.014794 | 0.005189 |
| 3 | ③ 子代理完成後 CLI 自動接續 | 4 / 603 / 45,061 / 313 | 22,093 / 1,651 / 262,455 / 79,992 | 0.019083 | 0.004290 |
| 4 | ⑤ 派第 2 個背景子代理 | 4 / 4,787 / 93,179 / 208 | 22,603 / 1,954 / 401,298 / 85,094 | 0.021694 | 0.002611 |
| 5 | ⑤ 停止後 CLI 自動接續 | 4 / 445 / 50,770 / 97 | 23,115 / 2,374 / 514,700 / 105,005 | 0.025612 | 0.003918 |

- **合計**：5 個模型回合（上限 12）、**US$0.025612**（上限 US$0.60；全批上限 US$1.00 剩 US$0.974 給 T0773）。累計值含子代理與 prompt suggestion 等附帶請求。
- 沒有用到 Opus / Fable / Sonnet（spec 每次動作前檢查 `modelUsage`，`forbidden models: []`）。

### 變更檔案

- `e2e/t0771-real-model-background-agent.spec.ts`（新增）：真實模型 ③④⑤；`BAT_E2E_REAL_MODEL=1` 才跑（不帶時 `1 skipped`，已驗）；支援 `BAT_E2E_EXECUTABLE`（安裝版時檢查 `resources/app.asar.unpacked/…/claude.exe`）；預算閘門（回合數、累計費用、禁用模型）；工作區 `%ProgramData%\bat-e2e-t0771-*`、`~/.claude/projects` 名稱含 `bat-e2e-t0771` 的目錄跑完刪除。
- `docs/agent-guide/claude-agent-sdk-cli.md`：「Claude 面板的背景子代理」與「背景子代理執行中送出訊息」兩節各補一行真實模型結果。
- 不改產品程式碼、不 build、不改共用 fixture、不碰 `e2e/t0762-…` / `e2e/v072-pre6-…`。

### 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0。e2e spec 不在兩個 tsconfig 的範圍內（`tsconfig.json` 只含 `src`、`tsconfig.node.json` 只含 `electron/**` + `vite.config.ts`），另以 `tsc --noEmit --strict` 單獨檢查新 spec = 0 錯誤。
- 真實模型 spec 預設 skip：不帶 `BAT_E2E_REAL_MODEL` 跑 → `1 skipped`（改完判斷後再確認一次）。
- 清理：`%ProgramData%` 下 `bat-e2e-t0771/t0762/t0727/t0730-*`、`%APPDATA%` 下這些 runtime 的 userData、`%TEMP%` 下假 API 的暫存 home、`~/.claude/projects` 下 `bat-e2e-t0771` 目錄都為 0；Terminal Server 全部在 teardown 後結束。
- 認證：沒有讀、複製或印出任何認證檔或權杖；沒有傾印 env（真實模型只沿用使用者既有登入，繼承的 `ANTHROPIC_*` / `CLAUDE*` 在啟動前移除）。

### Commit

- 產品：`a173f74a` — test(e2e): T0771 real-model background sub-agent acceptance (Haiku 5.5, skipped by default)
- 工單：本回報 commit（只含本工單檔）。沒有 push。

### 偏離與說明

- 為了讓 ④ 有「主回合已結束、子代理仍在跑」的時間窗，③ 的子代理先跑 `ping -n 45 127.0.0.1`（約 45 s）再讀檔摘要；⑤ 用 `ping -n 90`。屬測試手段，不影響驗收的 BAT 行為。
- ③④ 在同一個流程內完成（④ 送進 ③ 的子代理執行中），省 1 個背景子代理的費用。
- 真實模型跑完後修了 spec 的一個**紀錄用**判斷：④ 的「回覆含 2」原本用 `\b2\b` 比對面板 `textContent`，但訊息時間戳「05:18」與回覆「2」被接成「05:182上午05:18」，判斷回 false（log 寫 `answer has "2": false`）。截圖確認畫面是「2」。改成先去掉時間戳再比對（以那段實際字串驗過會回 true）。這個判斷不影響 PASS / FAIL 斷言，沒有為此重跑真實模型。

### 發現的問題

- 無產品缺陷。
- 觀察（不是 BAT 缺陷，供參考）：背景子代理完成或被停止後，CLI 2.1.316 都會自己多跑 1 個回合（與 T0739、docs 的實錄一致），各花約 US$0.004；兩個背景子代理的流程因此是 5 個 result，不是 3 個。

### 仍需手動

- ④ 的「排隊」退路（「等背景子代理結束後送出」＋取消）在真實時序下沒有出現，仍只有單元測試涵蓋（docs 已知限制，非本單可造）。
- 視覺：bar 的「背景」標籤、計時、Stop 按鈕在截圖中正常；若要人眼確認，截圖在 Worker scratchpad（不 commit）。

### 互動紀錄

- 無（yolo，沒有向塔台提問）。
