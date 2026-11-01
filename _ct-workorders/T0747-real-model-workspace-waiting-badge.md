---
schema_version: 1
schema_kind: workorder
id: T0747
title: "pre.8 工作區等待提示 ⚠️ 真實模型驗收（小額，Haiku）：Claude CLI 分頁權限詢問、auto mode、塔台分頁 AskUserQuestion、淡化"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T20:21:32+0800"
started_at: "2026-11-01T20:32:16+0800"
updated_at: "2026-11-01T20:42:25+0800"
completed_at: "2026-11-01T20:42:25+0800"
session_ids:
  - "95bedd2f-0602-40da-96c6-370666a4c48f"
depends_on: [T0746]
related:
  - "T0735（`b4daaf1f`，D200–D203 工作區 ⚠️）；T0736（`0232034f`，`e2e/v072-pre8-workspace-waiting-real-agents.spec.ts`：真的 claude CLI / codex ＋假模型 ①–⑥ PASS；〈仍需手動實機驗收〉：真實模型、auto mode）；T0739 / T0746（真實模型 spec 的做法與用量記錄）"
  - "T0736 附註：claude 2.1.316 auto mode 在 gateway（假 API）下不觸發 `PermissionRequest` hook —— 本單要看真實模型下的行為"
  - "CLAUDE.md「Worker 分頁回收」節 T0735 段、「blocked 狀態偵測」節；`docs/agent-guide/worker-tab-recycle.md`、`docs/agent-guide/blocked-state.md`"
affects_files:
  - "e2e/v072-real-model-workspace-waiting.spec.ts（新增，檔名可調；🔴 必須預設 skip，只有 `BAT_E2E_REAL_MODEL=1` 才跑）"
  - docs/agent-guide/worker-tab-recycle.md
  - _ct-workorders/T0747-real-model-workspace-waiting-badge.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 使用者已同意（2026-11-01 第一百零三 session）以真實模型小額驗收工作區 ⚠️。Claude CLI 分頁一律以 `claude-haiku-5-5` 啟動（隔離實例的 Settings / 工作區 `agentCustomArgs` 加 `--model claude-haiku-5-5`，不改產品程式碼）；🔴 不得使用 Opus / Fable / Sonnet。用量上限：整張單合計 ≤ 10 個模型回合、估計費用 ≤ US$0.5，超過立即停止並回報 PARTIAL。費用來源：本單 session 的 JSONL（`~/.claude/projects/` 下目錄名含 `bat-e2e-t0747` 者）只讀 `usage` 欄位估算，讀不到就寫讀不到。不得在 Claude CLI 參數放 `--settings`（會讓 BAT 不注入 hooks）。"
  - "🔴 情境（隔離實例、至少兩個工作區：A = 正在看的、B = 放 agent 分頁的；斷言沿用 T0735 / T0736 的 DOM / selector，都在 A 看 B 的列）：① B 的 Claude CLI 分頁、預設權限模式（default）→ 請模型執行一個需要核准的 Bash（例 `echo t0747`）→ 權限詢問出現 → B 列實心 ⚠️、tooltip 是 permission 原因且不含指令內容 → 在 B 核准 → ⚠️ 依 D203 消失或淡化（寫明當下焦點）。② 同分頁切到 auto mode（claude 2.1.316 的 auto，依 CLI 實際方式切換）→ 送 2–3 個不同風險的動作（例 echo、在工作區外寫檔、刪檔），逐一記錄：claude 有沒有詢問、`PermissionRequest` hook 有沒有觸發、B 列有沒有 ⚠️（觀察記錄，與 ① 對照；不視為失敗）。③ B 的「以塔台開啟 Claude」分頁 → 請模型用 AskUserQuestion 問一題 → `question` → B 列 ⚠️ → 回答後清除。④ 等待在使用者沒看 B 時結束（例如 A 有焦點時由 spec 經 B 分頁 PTY 回答）→ B 列淡化 ⚠️；切到 B 分頁且視窗有焦點後清除（D203）。模型沒有照指示用某工具時照實記錄，同一情境重試不超過 1 次。"
  - "🔴 登入與隔離：用使用者現有的 claude 登入（隔離實例沿用真實 HOME）；🔴 不得複製、讀出、記錄或印出任何認證檔或權杖內容（`.credentials.json`、API key、`batcap.`），不得傾印整個 `process.env`。隔離實例 `e2e/fixtures/electron-isolation.ts`（獨立 userData 與 remote port），不碰使用者正在用的 BAT。工作區名稱 `e2e-t0747-*`，目錄放 `%ProgramData%\\bat-e2e-t0747-*`（避免載入上層 `.claude/CLAUDE.md`），跑完刪除；本單在 `~/.claude/projects/` 產生、目錄名含 `bat-e2e-t0747` 的 session 目錄跑完可刪除（只刪這些），其他一律不動。claude CLI 首次在該目錄啟動的信任畫面由 spec 經 PTY 回答，不改使用者的 claude 設定檔。"
  - "🔴 Build：使用 T0746 建好的 `dist` / `dist-electron`，🔴 不得再跑 `npx vite build`（與 T0748 並行）。不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷 → 記在回報區〈發現的問題〉附重現步驟與證據，由塔台開 BUG。某情境做不到就寫明原因與已試過的做法，其餘照做，可回 PARTIAL。"
  - "🔴 驗證：spec 預設 skip；跑 1 次（不連跑）。重跑 `t0735-workspace-waiting-badge`（假模型、不耗 token）綠。`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 在 tsconfig 範圍外則註明）。`docs/agent-guide/worker-tab-recycle.md` 的 T0735 驗證清單補一行：真實模型 spec 位置、啟用方式、本次結果與 auto mode 觀察。回報區附每回合模型、tokens、估計費用與〈仍需手動〉。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑或帳號。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0747 — pre.8 工作區等待提示 ⚠️ 真實模型驗收

## 元資料

- **工單編號**：T0747
- **類型**：implementation（驗收用 e2e，真實模型）
- **優先級**：P2
- **建立時間**：2026-11-01T20:21:32+0800
- **預估規模**：S

## 背景

T0736 已用真的 claude CLI / codex 加假模型驗過工作區 ⚠️ ①–⑥。剩下真實模型的行為，特別是 claude 2.1.316 預設的 auto mode：哪些動作會詢問、hook 會不會觸發、⚠️ 會不會出現（假 API 下 auto mode 不觸發 `PermissionRequest`）。使用者同意以 Haiku 5.5 小額驗收。

## 範圍

1. 情境 ①–④（見 frontmatter）。
2. 預設 skip 的 spec（`BAT_E2E_REAL_MODEL=1` 才跑）。
3. docs 一行。

## 不做

- 不用 Opus / Fable / Sonnet；不超過用量上限；不跑 codex 真實模型。
- 不改產品程式碼、不碰認證檔、不重新 build。

## 驗收

- [ ] 情境 ①–④ 逐項結果（PASS / 行為記錄 / 未涵蓋與原因），auto mode 對照表
- [ ] 每回合模型、tokens、估計費用；合計在上限內
- [ ] spec 預設 skip、`t0735` 綠、兩個 typecheck = 0
- [ ] 〈發現的問題〉與〈仍需手動〉

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-01T20:42:25+0800
- **session_id**：95bedd2f-0602-40da-96c6-370666a4c48f
- **產品 commit**：`37a745e4`（`e2e/v072-real-model-workspace-waiting.spec.ts` 新增、`docs/agent-guide/worker-tab-recycle.md` 補一行）

### 落點檢查

- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1 PASS；C-3（`e2e/`、`docs/agent-guide/` 存在）PASS；C-2 無 `branch` 欄位
- `CT_HOME` 未設（非 worktree）；`CT_MODE=yolo`、`CT_INTERACTIVE` 未設；`BAT_WORKSPACE_ID`=`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）

### 結果摘要（情境 ①–④）

| 情境 | 結果 | 證據 |
|---|---|---|
| ① Claude CLI 分頁（「+」選單、`--permission-mode default`）Bash `mkdir` | **PASS** | `[blocked] → blocked reason=permission (hook permission-request tool=Bash)`；A 看 B 列：實心 ⚠️、`data-waiting-target` = 該分頁；tooltip「等待使用者：1 個分頁 / • Claude CLI: 等待使用者：權限確認（下午08:40 起）/ 點擊切到 Claude CLI（等最久）」，不含指令；切到 B、選該分頁、`document.hasFocus()` = true 時按 Enter 核准 → `cleared (user input)`，B 列清除、不留淡化（D203）；資料夾確實建立 |
| ② 同分頁 Shift+Tab 切 auto mode | **行為記錄** | footer 依序 `accept edits on` → `plan mode on` → `auto mode on`（3 次）；三個動作見下表 |
| ③ 「以塔台開啟 Claude」分頁 AskUserQuestion | **PASS** | `→ blocked reason=question (hook ask-user-question)`；B 列 ⚠️、target = 塔台分頁；tooltip「• Claude CLI · Tower: 等待使用者回答問題（下午08:41 起）」，不含問題文字；回答後 `cleared (user input)` |
| ④ A 有焦點時經 B 分頁 PTY 回答 → 淡化 → 看 B 分頁後清除 | **PASS** | 回答時 A 為 active、`hasFocus` = true → B 列 `data-waiting="missed"`，tooltip「曾有分頁等待你回應，已結束 / • Claude CLI · Tower: 下午08:41 曾等待你回應，已結束」；切到 B、選塔台分頁（有焦點）→ 縮圖淡化清除、B 列無 ⚠️ |

日誌檢查：debug log 與 bat-scripts.log 都不含指令標記（`t0747-secret-cmd`）、問題文字與 `batcap.` 權杖（spec 斷言）。

#### ② auto mode 對照表（觀察記錄，與 ① 對照）

| 動作 | claude 有沒有詢問 | `PermissionRequest` hook | B 列 ⚠️ | 效果 | 備註 |
|---|---|---|---|---|---|
| ①（對照，default 模式）`mkdir` | 詢問 | 觸發（`permission-request→blocked`） | 實心 ⚠️ | 資料夾建立 | — |
| `echo t0747-auto-low` | 沒詢問 | 沒觸發 | 無 | 執行 | 畫面只有「Ran 1 shell command」 |
| Write 到工作區外（`<root>\outside\t0747-auto.txt`） | 沒詢問 | 沒觸發 | 無 | 檔案建立 | 畫面顯示「Allowed by auto mode」 |
| `rm t0747-delete-me.txt` | 沒詢問 | 沒觸發 | 無 | 檔案刪除 | 畫面只有「Ran 1 shell command」 |

判讀：真實模型下 auto mode 的 classifier 放行這三個動作，claude 沒有停下來等使用者，所以沒有 `PermissionRequest`、也沒有 ⚠️ —— 與「只在真的等使用者時提示」的設計一致，不是缺陷。本次沒有遇到 auto mode 擋下或改為詢問的動作，所以「auto mode 中 classifier 決定要詢問時 hook 會不會觸發」仍未實測（見〈仍需手動〉）。三個動作的 hook 都只有 `user-prompt-submit` / `post-tool-batch` / `stop`。

### 用量（每回合）

模型：全部 `claude-haiku-5-5`（transcript 10 筆 assistant API 呼叫的 `message.model` 都是它；無 Opus / Fable / Sonnet）。費用以 `src/lib/model-pricing.ts` 的 Haiku 5.5 價格（≤ 100K prompt）從 transcript `usage` 估算。

| 回合 | 分頁 | API 呼叫 | input | cache read | cache write | output | 估計 US$ |
|---|---|---|---|---|---|---|---|
| 1 ① | Claude CLI | 2 | 4 | 56,966 | 57,193 | 191 | 0.01210 |
| 2 ② echo | Claude CLI | 3 | 6 | 171,912 | 334 | 193 | 0.00188 |
| 3 ② 寫檔 | Claude CLI | 4 | 8 | 229,977 | 504 | 255 | 0.00253 |
| 4 ② 刪檔 | Claude CLI | 3 | 6 | 173,064 | 452 | 146 | 0.00189 |
| 5 ③④ | Claude CLI · Tower | 2 | 4 | 93,665 | 20,602 | 238 | 0.00518 |
| **合計（去重）** | | **10** | | | | | **0.02106** |

- 合計 5 個模型回合（上限 10）、估計 US$0.021（上限 US$0.5）。
- 每回合列的時間窗（開始 −1 s ～ 結束 +5 s）在連續回合間重疊，逐列加總是 14 次呼叫；以 message id 去重的合計 10 次 / US$0.02106 才是準確值。逐列數字視為上限。
- auto mode classifier 的請求、CLI 的其他附帶請求不在 transcript，讀不到、未計入。

### 驗證

- 真實模型 spec：`BAT_E2E_REAL_MODEL=1 npx playwright test e2e/v072-real-model-workspace-waiting.spec.ts` → **1 passed (58.4 s)**（第 2 次執行，見〈偏差〉）
- spec 預設 skip：不設 `BAT_E2E_REAL_MODEL` → `1 skipped`
- `npx playwright test e2e/t0735-workspace-waiting-badge.spec.ts` → **1 passed**（`document.hasFocus()` = true）
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0；spec 不在兩者範圍內，另以 `tsc --noEmit --strict`（ES2022 / bundler / node types）單檔檢查 = 0
- 使用 T0746 建好的 `dist` / `dist-electron`（20:23），未跑 `npx vite build`；未改 `src/` / `electron/` / `scripts/`

### 清理

- `%ProgramData%\bat-e2e-t0747-*`：兩次執行都已刪除（現存 0）
- `~/.claude/projects` 目錄名含 `bat-e2e-t0747`：第 2 次刪 1 個（第 1 次沒產生），現存 0；其他未動
- 隔離 runtime userData 已刪，Terminal Server 已結束
- 未讀取、複製或印出任何認證檔 / 權杖；未傾印 env

### 偏差

- **跑了 2 次（工單要求 1 次）**：第 1 次在任何模型回合之前失敗（transcript 0 筆、0 token）—— claude 2.1.316 的資料夾信任畫面預設選項是「❯ No, exit」，spec 送 Enter 讓 claude 直接結束，120 s 等不到 SessionStart。修正為 ↓ 選「Yes, I trust this folder」再 Enter，並把畫面比對改為去除空白後比對（TUI 以游標移動繪製，去 ANSI 後沒有空白）。第 2 次即上述結果。
- spec 在 claude 參數加了 `--strict-mcp-config`（工單未要求）：只載入 BAT 自己的 MCP，避免啟動使用者的 MCP server、減少 tool 定義 token；沒有 `--settings`。

### 發現的問題

- 無 BAT 產品缺陷。
- 殘留（非本單可清）：claude 在信任資料夾時自己寫入使用者 `~/.claude.json` 的 `projects` 一筆（key 為 `<ProgramData>\bat-e2e-t0747-A4hjgC\b`，資料夾已刪）。依工單「不改使用者的 claude 設定檔」未動，使用者可自行刪除該 key；無害。

### 仍需手動

- auto mode 下 classifier 判定「要詢問」或「擋下」的動作（例如網路、刪工作區外的檔、`git push` 類）時，`PermissionRequest` hook 與 ⚠️ 的行為：本次三個動作都被放行，未觸及。
- auto mode classifier 使用的模型與費用：不在 transcript，讀不到。
- Codex 真實模型、helper 派工的真實模型 Worker、detached 視窗：不在本單範圍。
- 真人在畫面上看 ⚠️ / 淡化 的視覺感受（本單以 DOM 屬性與截圖判斷）。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### 待續 / 建議

- 若要驗 auto mode「會詢問」的路徑，需設計 classifier 會攔下但仍安全的動作，建議另開單並先由塔台定義動作清單與費用上限。
