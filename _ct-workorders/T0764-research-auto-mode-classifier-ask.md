---
schema_version: 1
schema_kind: workorder
id: T0764
title: "研究：auto mode 的 classifier 決定「詢問」或「擋下」時，hook 與 ⚠️ 的行為（真實模型 Haiku 5.5，≤ US$0.5）"
type: research
status: DONE
started_at: "2026-11-02T03:48:58+0800"
updated_at: "2026-11-02T03:58:31+0800"
completed_at: "2026-11-02T03:58:31+0800"
session_ids:
  - "22145225-b965-467a-b9a7-6795ce4c3ea9"
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-02T02:23:44+0800"
depends_on: [T0763]
related:
  - "T0747 回報區（auto mode 三個動作皆放行、未觸及詢問路徑）；`docs/agent-guide/blocked-state.md`（`PermissionDenied` 只在 classifier 拒絕時執行）；D210（費用上限）"
  - "`e2e/v072-pre8-workspace-waiting-real-agents.spec.ts`（T0747 真實模型 spec，預設 skip）"
affects_files:
  - e2e/
  - docs/agent-guide/blocked-state.md
  - _ct-workorders/T0764-research-auto-mode-classifier-ask.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 真實模型上限（D210）：只用 Haiku 5.5；合計 ≤ 10 回合、≤ US$0.5；超過即停並回報。每回合記錄 transcript 費用；classifier 的請求讀不到時照實寫。"
  - "🔴 動作清單（塔台定義，只用這些，全部無害、都在暫存目錄）：A. 讀一個公開網址（`curl -sI https://example.com`）；B. 在工作區外的暫存目錄 `%TEMP%/bat-t0764-outside/` 寫一個檔；C. 刪除 B 寫的那個檔；D. 對暫存目錄裡的本機 bare repo 做 `git push`（暫存目錄內建立、跑完刪除）；E. 安裝套件類動作只用 `npm view <pkg> version`（唯讀）。🔴 不得執行清單外的動作；不碰使用者 repo、`~/.claude`、全域設定。"
  - "🔴 記錄每個動作：classifier 結果（放行 / 詢問 / 擋下）、claude 送出的 hook 事件（`PermissionRequest` / `PermissionDenied` / 其他）、BAT `blocked` 狀態與縮圖 / 工作區 ⚠️；詢問時以滑鼠與鍵盤各回答一次（觀察 T0757 修正後是否清除）。結論：是否需要改 hook 表或 ⚠️ 規則，附建議（不實作）。"
  - "🔴 不改產品程式碼；spec 可加情境（預設 skip、須明確環境變數才跑）。build 在主 checkout（Lane A 最後一張）。殘留（`~/.claude.json` projects key 等）照實寫，能刪就刪、刪前確認是本單產物。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0764 — 研究：auto mode 的 classifier 決定「詢問」或「擋下」時，hook 與 ⚠️ 的行為（真實模型 Haiku 5.5，≤ US$0.5）

## 元資料

- **工單編號**：T0764
- **類型**：research
- **優先級**：P3
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：S

## 背景

T0747 在 auto mode 下三個動作都被 classifier 放行，沒有觸及「詢問 / 擋下」路徑，不知道那時 hook 與 ⚠️ 的行為。D210 排入本批，費用上限 US$0.5。

## 範圍

以塔台定義的無害動作觸發 classifier 的詢問 / 擋下，記錄 hook 與 ⚠️。只研究、不改產品程式碼。

## 不做

- 不實作；不超過費用上限；不執行清單外動作。

## 驗收

- [ ] 動作 × classifier 結果 × hook × ⚠️ 表
- [ ] 費用與回合數在上限內
- [ ] 建議（需不需要改、改哪裡）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE（研究結論可決策；詢問 / 擋下路徑在工單列的動作下沒有出現，見〈結論與建議〉）
- **完成時間**：2026-11-02T03:58:31+0800
- **session_id**：22145225-b965-467a-b9a7-6795ce4c3ea9
- **產品 commit**：`c50522d3`（新增 `e2e/v072-real-model-auto-mode-classifier.spec.ts`、`docs/agent-guide/blocked-state.md` 補一個子項目）

### 落點檢查

- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1 PASS；C-3（`e2e/`、`docs/agent-guide/blocked-state.md` 存在）PASS；C-2 沒有 `branch` 欄位
- `CT_HOME` 未設（不是 worktree）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID`=`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 產出摘要

#### 做法

- 新 spec `e2e/v072-real-model-auto-mode-classifier.spec.ts`（預設 skip，要設 `BAT_E2E_REAL_MODEL=1` 才跑）：隔離的 source build，一個工作區、一個「+」選單開的 Claude CLI 分頁，參數 `--model claude-haiku-5-5 --permission-mode auto --strict-mcp-config`。啟動後 footer 顯示 `⏵⏵ auto mode on`，不用按 Shift+Tab。
- 用 `CLAUDE_CODE_NO_FLICKER=1` 開 fullscreen renderer：alt screen，滑鼠追蹤 `any`（實測 `mouse any, buffer alternate`），這樣出現對話框時才能用滑鼠點「1. Yes」回答（T0757 的做法）。
- BAT 沒有掛 `PermissionDenied`，所以在暫存工作區自己的 `.claude/settings.local.json` 另外掛探測 hook（`PermissionDenied` / `PermissionRequest` / `Notification`）。探測 hook 只記事件、工具、類型、模式與拒絕原因，不輸出任何東西，exit 0。設定檔放在 `%ProgramData%\bat-e2e-t0764-*` 底下，跑完刪除。
- 每個 prompt 都要求「被擋就用完全相同的輸入重試，最多 4 次，不換指令」：claude 連續 3 次擋下後才改為詢問（見〈二進位查證〉），這樣同一個 prompt 裡就可能走到詢問路徑。
- 記錄來源：transcript 的 `tool_use` / `tool_result` / `permissionDecision`、BAT `bat-scripts.log` 的 `report-hook`、`[blocked]` 日誌、縮圖 `.attention-badge` 與工作區列 `.workspace-waiting-badge`。

#### 動作 × classifier 結果 × hook × ⚠️

| 動作（塔台清單） | classifier 結果 | claude 送出的 hook | BAT `blocked` | 縮圖 / 工作區 ⚠️ | 效果 |
|---|---|---|---|---|---|
| A `curl -sI https://example.com` | **放行**（`permissionDecision: { decision: accept, source: config, reasonType: classifier }`） | 只有 `UserPromptSubmit` / `PostToolBatch` / `Stop`；探測 hook `PermissionDenied` 0、`PermissionRequest` 0 | 沒有 | 沒有 | HTTP 200 |
| B 寫 `%TEMP%/bat-t0764-outside/t0764.txt`（Bash `echo >`） | **放行**（同上） | 同上 | 沒有 | 沒有 | 檔案建立 |
| C 刪 B 的檔（`rm`） | **放行**（同上） | 同上 | 沒有 | 沒有 | 檔案刪除 |
| D `git -C <暫存 clone> push origin HEAD:refs/heads/main`（本機 bare repo） | **放行**（同上） | 同上 | 沒有 | 沒有 | bare repo 的 `main` 建立 |
| E `npm view left-pad version` | **放行**（同上） | 同上 | 沒有 | 沒有 | `1.3.0` |

- 每個動作模型都只呼叫 1 次工具，沒有重試，也沒有被擋。
- 詢問次數 0，所以「滑鼠與鍵盤各回答一次」**沒有機會做**（spec 已寫好：第一個對話框用滑鼠點、之後按 Enter，會記錄 `[blocked]` 的清除原因與 ⚠️ 前後狀態）。
- 依 spec 的規則，只有在 A–E 至少有一個被擋時才會加跑重複回合；這次一個都沒被擋，所以沒有加跑。

#### 二進位查證（內嵌 claude 2.1.316，靜態閱讀）

- **擋下**：classifier 拒絕（`decisionReason.type === 'classifier'` 且 `classifier === 'auto-mode'`）時沒有對話框，claude 直接把拒絕交給模型，並執行 `PermissionDenied` hook（payload `tool_name` / `tool_input` / `tool_use_id` / `reason`；hook 回 `retry` 時模型可重試）。這時沒有在等使用者。
- **改為詢問**：`rq = { maxConsecutive: 3, maxTotal: 20 }`。同一 session 連續 3 次（或累計 20 次）擋下後，記 `Classifier denial limit exceeded, falling back to prompting`，訊息是「N consecutive actions were blocked. Please review the transcript before continuing.」，再走一般權限提示（`fallbackShape` 有 `timed` / `blocking` / `legacy` 三種）。headless 會改成丟出 `Agent aborted: too many classifier denials in headless mode`。允許一次就重設連續計數。
- 詢問路徑之後是不是一定執行 `PermissionRequest` hook：依一般權限對話框的流程推論是會（BAT 記 `permission` → ⚠️），**沒有實機觸發**。

### 結論與建議（不實作）

- **不需要改 hook 表（`BAT_CLAUDE_HOOKS`），也不需要改 ⚠️ 規則。**
  - classifier「擋下」時沒有對話框、沒有在等使用者，回合會繼續。不記 `blocked`、不顯示 ⚠️ 符合「只在真的等使用者時提示」，也符合 T0594 不掛 `PermissionDenied` 的理由：平行呼叫中另一個工具的對話框還開著時，收到它會誤清。
  - 「改為詢問」走一般權限對話框，現有的 `PermissionRequest` → `permission` → ⚠️，以及 `post-tool-batch` / 使用者輸入 / 滑鼠按下（T0757）的清除規則都會涵蓋，不需要新事件。
- 可以考慮（低優先，由塔台決定要不要開單）：classifier 連續擋下、模型一直換方法重試時，使用者看不出「被擋了很多次」。這是資訊提示，不是等待，不應該用 ⚠️ 表示。要做的話會是新功能，需要另外決策；本單不建議主動做。
- 真實模型下，工單列的 5 個無害動作 classifier 全部放行（T0747 的 3 個也是），所以**詢問 / 擋下路徑仍然沒有實機觸發**。要觸發，需要 classifier 會擋、但仍然安全的動作。例如「下載後執行」這類型態：從暫存目錄的本機 HTTP 伺服器取得一段只做 `echo` 的腳本再 pipe 給 shell。這超出本單的清單，需要塔台另外定義動作與費用上限；spec 只要加動作就能重用（`actions` 陣列，已有重複回合與滑鼠 / 鍵盤回答的邏輯）。
- 已把查證結果補進 `docs/agent-guide/blocked-state.md`「權限請求結束」底下的一個子項目（不改契約與規則）。

### 用量

模型：全部 `claude-haiku-5-5`（transcript 10 筆 assistant API 呼叫；沒有 Opus / Fable / Sonnet）。費用用 `src/lib/model-pricing.ts` 的 Haiku 5.5 價格，從 transcript 的 `usage` 估算。

| 回合 | API 呼叫 | input | cache read | cache write | output | 估計 US$ |
|---|---|---|---|---|---|---|
| 1 A curl | 2 | 4 | 57,012 | 57,322 | 93 | 0.01208 |
| 2 B 寫檔 | 3 | 6 | 172,495 | 499 | 255 | 0.00195 |
| 3 C 刪檔 | 2 | 4 | 115,497 | 320 | 127 | 0.00128 |
| 4 D git push | 3 | 6 | 174,613 | 569 | 269 | 0.00200 |
| 5 E npm view | 2 | 4 | 117,006 | 245 | 90 | 0.00126 |
| **合計（以 message id 去重）** | **10** | | | | | **0.01725** |

- 5 回合（上限 10）、估計 US$0.017（上限 US$0.5）。真實模型只跑 1 次。
- 每回合的時間窗在相鄰回合間可能重疊，逐列加總 12 次呼叫；以 message id 去重的 10 次才是準確值，逐列數字當上限看。
- auto mode classifier 的請求（每個動作都有一次 classifier 判定）不在 transcript 裡，讀不到、沒有計入。

### 驗證

- 真實模型：`BAT_E2E_REAL_MODEL=1 npx playwright test e2e/v072-real-model-auto-mode-classifier.spec.ts` → **1 passed (52.4 s)**
- 預設 skip：不設 `BAT_E2E_REAL_MODEL` → `1 skipped`
- spec 單檔 `tsc --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler --types node --skipLibCheck` = 0（spec 不在 `typecheck` / `typecheck:electron` 的範圍內）
- build：主 checkout `npx vite build` exit 0（開始時 HEAD `e75b76e8`；Lane A 最後一張）
- 沒有改產品程式碼（`src/` / `electron/` / `scripts/`）

### 清理與殘留

- `%ProgramData%\bat-e2e-t0764-*`、`%TEMP%\bat-t0764-outside\`（bare repo、clone、檔案）：已刪除（現存 0）
- `~/.claude/projects` 目錄名含 `bat-e2e-t0764` 的：刪 1 個，現存 0
- `~/.claude/session-env/226766f6…`（本次 session id 命名、確認是本單產物）：已刪
- `~/.claude.json` 的 `projects` 中 claude 信任資料夾時寫入的 key `<ProgramData>/bat-e2e-t0764-oOHCeT/w`：確認是本單產物後刪除（只刪這一個 key，其餘 30 筆不動；過程只印 key 名稱）
- **沒有刪**：T0747 留下的 key `<ProgramData>/bat-e2e-t0747-A4hjgC/b`（不是本單產物，照工單「刪前確認是本單產物」保留，使用者可以自己刪，無害）
- 隔離 runtime 的 userData 已刪，Terminal Server 已結束；沒有讀取、複製或印出認證檔或權杖，也沒有傾印 env（spec 斷言 debug log 裡沒有 `batcap.` 權杖）

### 遭遇問題

- 探測 hook（`PermissionDenied` / `PermissionRequest` / `Notification`）這次沒有任何事件可記，所以**沒有證據證明它在這個設定下真的會被執行**。之後擴充動作重跑時，要先確認 probe.log 有一筆事件，才能把「0 筆」解讀為「沒有觸發」。
- 第一個 Monitor 的過濾式因為 Playwright reporter 在行首加的控制碼而對不上，已重設；只影響我追進度的通知，不影響測試結果。
- 同一個 checkout 有其他 Worker 的未提交變更（`electron/interrupted-agents.ts` 等）：沒有動，commit 只用 `--only`。

### 互動紀錄

- 無（yolo，沒有向塔台提問）。工單列的動作全部放行之後，我自己判斷：不執行清單以外的動作，把需要的新動作寫進建議，交給塔台決定。

### 回報時間

- 2026-11-02T03:58:31+0800
