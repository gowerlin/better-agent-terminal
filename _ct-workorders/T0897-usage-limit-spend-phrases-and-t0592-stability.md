---
schema_version: 1
schema_kind: workorder
id: T0897
title: "（在 `v0.8.x`）① claude 花費上限句型（`channel's monthly spend limit`、`usage credit limit` 等）讓 `usage-limit.ts` 辨識；② e2e t0592 `lacking \"shell\"` 情境穩定化"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-25T01:06:57+08:00"
updated_at: "2026-11-25T01:37:12+08:00"
started_at: "2026-11-25T01:15:25+08:00"
completed_at: "2026-11-25T01:37:12+08:00"
session_ids:
  - "995a02af-be8d-4060-b97d-8d30ed11eac3"
target_version: "0.8.0-pre.2"
depends_on: [T0896]
related:
  - "T0891 回報區〈遭遇問題〉1（t0592 間歇失敗）與〈觀察〉1（claude 花費上限句型）；D321（使用者 2026-11-25：候選 1、2「也安排」）；D148 / T0566（用量限制自動繼續）；T0592"
  - "CLAUDE.md「用量限制自動繼續（PLAN-044 / T0566，D148）」「BAT MCP shim」各節；`docs/agent-guide/usage-limit-continue.md`、`docs/agent-guide/bat-mcp-shim.md`"
affects_files:
  - _ct-workorders/T0897-usage-limit-spend-phrases-and-t0592-stability.md
  - src/lib/usage-limit.ts
  - src/lib/__tests__/usage-limit.test.ts
  - docs/agent-guide/usage-limit-continue.md
  - e2e/t0592-codex-tower-worker.spec.ts
  - docs/agent-guide/bat-mcp-shim.md
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0897（塔台 2026-11-25 01:14 從 `v0.8.x` `7094b993` 建立分支）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0897` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = 本工單〈派工補記〉寫的 `v0.8.x` SHA，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只改 `affects_files` 列的檔案。CLAUDE.md 不改（需要時把建議文字寫在回報區）。需要動其他檔 → 先問塔台。"
  - "🔴 ① 句型：從內嵌 claude 2.1.331 binary 字串（比照 T0717 / T0891 的做法：`strcount` 計數＋抽前後文）找出所有花費 / 額度類限額訊息（至少 `channel's monthly spend limit`、`usage credit limit`，以及同一組名稱表裡其他 `You've hit your …` 變體），逐句判斷該歸哪一類（`claude-limit` 有重置時間 / `claude-blocked` 沒有重置時間的 `non-timed` 等，依 `usage-limit.ts` 既有分類與 D148 規則）。只做純追加：不刪、不改既有句型與決策表；🔴 claude 一律不送文字（D148）；引用在句中不算（比照既有測試）。測試每句至少一例（含彎引號 / 重置時間變體），回報區附句型來源（計數與前後文）。若某句的分類不明確或會改變既有行為 → 問塔台。"
  - "🔴 ② t0592：`codex Worker dispatch with settings.json lacking \"shell\"` 情境間歇失敗（T0891：Worker `bat-notify --submit` exit 0，但 tower 分頁的 pwsh buffer 20 s 內沒有 `T0592 完成`，buffer 混有使用者 PowerShell profile 的輸出）。先找根因（例如 tower shell 載入使用者 profile 的時序、prompt 重繪蓋掉輸出、等待條件太窄），再穩定化（例：tower shell 以 `-NoProfile` 啟動、改等更可靠的信號、合理延長等待）。🔴 不得放寬斷言到失去意義（仍要證明通知送達 tower）、不得改產品程式；只改 spec 與 `docs/agent-guide/bat-mcp-shim.md` 的紀錄。驗證：整份 spec 連續 5 次全綠（附每次結果）。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 全綠（完整跑第一次若有 RemoteServer / headless e2e 檔 `beforeAll` 逾時，單獨重跑後再完整跑一次，兩次都回報）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；e2e t0592（需先 `npx vite build`）。e2e 只用隔離實例；不得以預設實例啟動 source build；不碰使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn。`TMP` 用系統預設（T0716）。程序清理照 D308。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "🔴 公開 repo（D176）：回報區路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0897 — claude 花費上限句型＋ t0592 穩定化

## 背景

T0891（內嵌 claude 2.1.331 / codex 0.172.0 追版）回報的兩個候選，使用者 2026-11-25 指示安排（D321）：

1. **claude 花費上限句型**：`You've hit your channel's monthly spend limit`、`usage credit limit` 等句型從 2.1.316 就存在，`src/lib/usage-limit.ts` 一直不認，撞到時 BAT 不會顯示限額提示。
2. **e2e t0592 不穩**：`lacking "shell"` 情境 6 次失敗 2 次；codex 升版必跑這份 spec（CLAUDE.md「BAT MCP shim」），不穩會讓之後每次追版都要重跑判讀。

本單等 T0896（合併 T0891 / T0893 / T0895 進 `v0.8.x`）完成後，從新的 `v0.8.x` 開分支（`usage-limit.ts` 在 T0891 有改動），與 T0898（BUG-218）並行；兩張完成後由一張合併工單一起併進 `v0.8.x` 並做發版前最後一次完整驗收（D322，取代 D321 的「塔台直接合併」），隨 `0.8.0-pre.2` 發佈。

## 驗收

- [x] ① 新句型都有分類、測試、來源證據；既有句型與決策表不變
- [x] ② t0592 根因說明＋穩定化；整份連續 5 次全綠
- [x] `test:unit` 全綠、`vite build` exit 0、兩個 typecheck = 0
- [x] 隔離分支證據


## 派工補記

- 2026-11-25T01:14:52+08:00：T0896 已合併進 `v0.8.x`；`ct/T0897` 從 `v0.8.x` = `7094b993b67313db8f3c6b058a33f483896ec5b4` 建立。`memory_overrides` 第 1 條的 merge-base 檢查值 = `7094b993b67313db8f3c6b058a33f483896ec5b4`。
---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

> 依據：內嵌 claude 2.1.331 的限額訊息組字函式 `ui()`（`q(e,n)` = `` `You've hit your ${e}${n}` ``）與 CLI 自己的限額訊息前綴表 `Pxi`。下列三句分類不明確，依 `memory_overrides` 第 3 條提問；其餘新句型分類明確，先照建議實作（見〈產出摘要〉）。

#### Q-1：`You've hit your usage limit · contact your admin to increase it`（`bL()` 用量配額模式、非帳單管理者時的句子；目前 BAT 不認）要不要認、歸哪一類？
- 提問時間：2026-11-25T01:18:35+0800
- 選項：[A] 不加（維持現狀，回報區記錄）/ [B] 歸 `claude-blocked` → `non-timed` 提示 / [C] 歸 `claude-limit`（`usage`、沒有重置時間 → `cli-unavailable` 提示） / [D] 其他：________
- Worker 建議：[B]。句子沒有重置時間、要求找管理者調高，是配額上限，`non-timed`（「重置不會解除」）最貼切；只有帶這段後綴的句子會新增辨識，既有的 `You've hit your usage limit`（無後綴，目前歸 `claude-limit` / `usage`）不變。
- 影響範圍：`src/lib/usage-limit.ts` `CLAUDE_BLOCKED_RE`、`src/lib/__tests__/usage-limit.test.ts`、`docs/agent-guide/usage-limit-continue.md`
- 阻塞：否（其他句型與 ② 先做；收單前等答覆）

#### Q-2：`Usage is paused for your organization. For help, please contact support.`（`dailyCapPaused`，組織每日上限暫停；目前 BAT 不認）要不要認？
- 提問時間：2026-11-25T01:18:35+0800
- 選項：[A] 不加（回報區記錄）/ [B] 歸 `claude-blocked` → `non-timed` 提示 / [C] 其他：________
- Worker 建議：[A]。這是「每日」上限暫停，`non-timed` 的提示文字「花費上限或額度不足：重置不會解除」可能不正確（隔天可能自行恢復），句子也沒有重置時間可排程；不認＝現狀。
- 影響範圍：同 Q-1
- 阻塞：否

#### Q-3：`usage credit limit` 在 2.1.331 只出現在警告（`Approaching usage credit limit`、`You've used N% of your usage credit limit`、`You're close to your usage credit limit`）、fast mode 提示（`Fast mode disabled · usage credit limit reached`）與管理者申請文字，沒有任何 `You've hit your usage credit limit` 停止句（`ui()` 的 `overage` 類型落到 `You've hit your usage limit`）。工單列為「至少」要認，要不要仍防禦性加入？
- 提問時間：2026-11-25T01:18:35+0800
- 選項：[A] 不加（只認 CLI 實際會印的停止句，回報區附證據）/ [B] 防禦性加 `You've hit your usage credit limit` 歸 `claude-blocked` → `non-timed` / [C] 其他：________
- Worker 建議：[A]。CLI 不會印這句，加了也測不到真實來源；警告句既有測試明定「不是停止」，不能認。
- 影響範圍：同 Q-1
- 阻塞：否

### 完成狀態
- **DONE**：① 花費 / 額度類句型補齊（純追加，既有句型與決策表不變）；② t0592 根因找到並重現，穩定化後整份連續 5 次全綠。驗收 4 項全部 PASS。
- **session_id**：995a02af-be8d-4060-b97d-8d30ed11eac3

### 產出摘要

**① claude 花費 / 額度類句型**（`src/lib/usage-limit.ts`、`src/lib/__tests__/usage-limit.test.ts`、`docs/agent-guide/usage-limit-continue.md`）

- 來源：內嵌 `node_modules/@anthropic-ai/claude-code/bin/claude.exe` 2.1.331（405,798,560 bytes），scratchpad `strcount.mjs`（計數）＋ 從 JS 原始碼區（`// Version: 2.1.331` 之後）抽前後文。限額停止訊息由 `ui(e,n)` 組出，`q(e,n,o,d)` = `` `You've hit your ${e}${n}${" · progress saved"?}` ``；CLI 自己的限額訊息前綴表是 `Pxi`（＋ `hal` = `["This service is disabled for your org"]`）；名稱常數 `oi="channel's monthly spend limit"`、`si="channel's monthly usage limit"`、`Can="team's pooled group budget"`、`cfo="individual spend limit"`、`Dms="individual usage limit"`、`Wt=" · an org owner or channel manager can raise it in the channel's Claude settings"`，`BLe={five_hour:"5-hour limit",…,overage:"usage credit limit"}`。
- `ui()` 的分支與新增分類（全部 `claude-blocked` → `non-timed`，除最後一項）：

| 句型（`ui()` 分支） | 計數 | 處理 |
|---|---|---|
| `You've hit your channel's monthly spend limit` ＋ `Wt` ＋ 可能的 `· your <名稱> resets …`（`Tan` 原因、`overageScope==="channel"`）；另有模型切換提示 `Cws()`：`You've hit your channel's monthly spend limit.` | 4 | 新增 |
| `You've hit your channel's monthly usage limit` ＋ `Wt` ＋ `· resets <overageResetsAt>`（`overageStatus==="rejected"` 的 channel 分支） | 2 | 新增（依 T0891 `team's pooled group budget · resets …` 的先例，花費上限即使帶重置時間也歸 non-timed） |
| `You've hit your individual spend limit …`（`org_spend_cap_reached`）/ `org's monthly spend limit …`（其他 `Tan` 原因，team / enterprise 或非管理者） | 2 / 3 | 新增 |
| `You've hit your individual usage limit[ · resets …]` / `org's monthly usage limit[ · resets …]` | 2 / 2 | 新增 |
| `You've hit your usage limit · contact your admin to increase it`（`bL()` 用量配額模式、非帳單管理者） | — | 新增（塔台 Q-1 = B；無後綴的 `You've hit your usage limit` 照舊 `claude-limit` / `usage`，測試鎖定） |
| `Your seat type doesn't include usage`（`bL()` 模式；原本只認 `… usage credits`）、`Your seat type doesn't include extra usage`（`Pxi` 舊名） | 8 / 2 | 新增 |
| `Your usage allocation has been disabled by your admin[ · …]`、`Your group's usage limit is set to $0[ · …]`、`This service is disabled for your org`、`You're out of extra usage`（`Pxi` / `hal`） | 3 / 3 / 3 / 2 | 新增 |
| 計時限制 `di()` 結果後接 `· out of usage credits`（`overageDisabledReason==="out_of_credits"` 且為管理者）：`You've hit your 5-hour limit · resets 3pm (…) · progress saved · out of usage credits` | — | `CLAUDE_LIMIT_RE` 句尾多一段可選 `· out of usage credits`，照原名稱分類（session → `cli-unavailable`、Fable → `weekly`） |

- 刻意不認（塔台答覆）：
  - **`usage credit limit`**（計數 10，塔台 Q-3 = A）：只出現在 `BLe.overage`、警告 `li()`（`Approaching usage credit limit`、`You've used N% of your usage credit limit`、`Over N% of your usage credit limit used`）、`Gt()`（`You're close to your usage credit limit`）、fast mode 提示（`Fast mode disabled · usage credit limit reached`）、管理者申請文字（`increase your usage credit limit`）。`di()` 只處理 `five_hour` / `seven_day*`，`overage` 類型的停止句在 `ui()` 落到 `q("usage limit", …)` = `You've hit your usage limit`。警告句是「接近 / 已用 N%」，CLI 仍可繼續，與既有測試「warnings are not a stop」同理；fast mode 那句是 fast mode 被關、一般模式照常。測試鎖定上述警告句都回 `none`。
  - **`Usage is paused for your organization. For help, please contact support.`**（`W8e`，`dailyCapPaused`，計數 2，塔台 Q-2 = A）：見〈遭遇問題〉觀察 1。
  - `<模型> requires usage credits.`（計數 28）：模型同意流程（`Cws()` / `US()` / `qp()`，提示改用其他模型或同意用 credits），不是限額停止。
  - `You've hit your monthly limit — raise it below, or it resets next month.`：`/usage-credits` 對話框內的警告列，不是停止句。
- 既有句型計數（佐證不變）：`You've hit your` 24、`monthly spend limit` 38、`out of usage credits` 20、`team's pooled group budget` 2（另在 `Can` 常數與組字中）、`team's shared budget` 0（舊句保留，system runtime 可能是舊 CLI）。
- 測試：新增 16 句 non-timed（含彎引號、`⎿ ` 前綴、重置時間與 `· your 5-hour limit resets …` 變體）、`· out of usage credits` 計時句 3 例、不變 / 不認 9 例（無後綴 usage limit、每日暫停、4 句 usage credit limit 警告 / fast mode、3 句引用在句中或反引號 / 引號內）。`usage-limit.test.ts` 81 passed。

**② e2e t0592 `lacking "shell"` 情境穩定化**（`e2e/t0592-codex-tower-worker.spec.ts`、`docs/agent-guide/bat-mcp-shim.md`）

- 根因：Worker 以「假 codex 的結果檔 `tower-result.json` 出現＋ 2 s」當作「塔台 pwsh 已回到提示字元」。但假 codex 寫完結果檔後還要 `rmSync(CODEX_HOME, { maxRetries: 20, retryDelay: 100 })`；剛被結束的 codex 檔案被鎖時重試是線性退避，最多約 21 s。這段時間假 codex 仍是塔台 pwsh 的前景程序，`bat-notify` 的預填文字留在主控台輸入緩衝區，要等它結束才被 pwsh 讀到並畫到畫面上，於是 2 + 20 s 的預算可能被吃光。T0891 失敗時「buffer 停在 pwsh 輸入列」就是塔台打進去的 `codex …` 指令行。
- 證據（實驗後都已還原）：
  - 自然狀態重複 22 次（`lacking` 單獨 4 次＋整份 8 次 × 2 情境）全過，無法自然重現。
  - 假 codex 在結果檔後多停 8 s → 通過（預填只是延後到它結束才出現，仍在預算內）。
  - 多停 25 s → **失敗，症狀與 T0891 相同**：`bat-notify` exit 0、無 `Forbidden`，tower buffer 結尾是 `codex …` 指令行。
  - 排除的假設：PSReadLine 分段重繪（`T0593 ` / `完成` 分兩次寫入，去掉 ANSI 後仍連續）、歷程預測灰字（先寫 `T` 等預測出現再寫其餘，仍含 `T0592 完成`）；profile 目前沒有輸出。
  - 旁證：完整 `test:unit` 第一次唯一的失敗也是同一類（`bat-mcp-codex-env.test.ts` afterEach 刪 codex 暫存目錄 `EPERM`，見〈遭遇問題〉2）。
- 修正（只改 spec，產品程式不動）：
  1. 假 codex 先清理 `CODEX_HOME` 再寫結果檔（結果檔＝結束前最後一步）。
  2. 塔台指令行在 `codex …` 後接 `; Set-Content -LiteralPath '<tmp>/tower-prompt.txt' -Value done`：由塔台 pwsh 自己寫，代表 pwsh 已回到前景。Worker 的 `waitFile` 改等這個標記（120 s），之後照舊 sleep 2 s 再送 `bat-notify --submit`。
  3. 斷言不變：仍要求塔台分頁畫面在 20 s 內出現 `T0592 完成`。
  4. 斷言失敗時多記 tower buffer（去 ANSI 與原文尾端 3000 字）、塔台與 Worker 的 progress 時間線與 notify 結果（權杖照舊遮罩）。
- 修正後以同樣「多停 25 s」驗證 → 通過（55 s）。

### 驗證
| 關卡 | 結果 | 證據 |
|---|---|---|
| `npm ci`（worktree） | ✅ | exit 0 |
| `npm run test:unit` 第 1 次（完整） | ❌ 1 failed | `Test Files 1 failed / 462 passed / 3 skipped (466)`、`Tests 1 failed / 8506 passed / 42 skipped (8549)`；失敗 = `bat-mcp-codex-env.test.ts` afterEach `rmSync` `EPERM`（〈遭遇問題〉2） |
| 該檔單獨重跑 | ✅ | `1 passed (1)`、`5 passed (5)` |
| `npm run test:unit` 第 2 次（完整） | ✅ | `Test Files 463 passed / 3 skipped (466)`、`Tests 8507 passed / 42 skipped (8549)`，57.06 s |
| `npx vite build` | ✅ | exit 0（`c9f98ba9`） |
| `npm run typecheck` | ✅ | 0 errors（exit 0） |
| `npm run typecheck:electron` | ✅ | 0 errors（exit 0） |
| e2e t0592 整份連續 5 次 | ✅ | run 1 `2 passed (41.8s)`、run 2 `2 passed (24.7s)`、run 3 `2 passed (17.9s)`、run 4 `2 passed (24.7s)`、run 5 `2 passed (25.2s)`；每次 teardown `Terminal Server … alive after teardown: false`、`runtime userData removed: true` |
| 程序清理（D308） | ✅ | e2e 後沒有命令列含本 worktree `dist-electron`、`bat-t0592-`、`e2e-t0592` 的程序 |

- e2e 只用隔離實例（`launchIsolated`，`--runtime=e2e-…`）；沒有以預設實例啟動、沒碰安裝版 BAT 與其 userData / Terminal Server / `bat-pty-holder`；沒跑 `t0859-pty-holder.spec.ts`；沒有開 claude / codex turn（t0592 的 codex 只跑 `app-server`、model provider 指向 `127.0.0.1:9`）。`TMP` 用系統預設。
- e2e 5 次跑在 commit 前的工作樹上，內容與 `c9f98ba9` 相同（spec 與 `usage-limit.ts` 已是最終版、build 已含 ① 的改動）；跑的期間只改了 `docs/agent-guide/bat-mcp-shim.md`。

### 相關檔案
- `src/lib/usage-limit.ts`：`CLAUDE_BLOCKED_RE` 加句型、`CLAUDE_LIMIT_RE` 加可選 `· out of usage credits`、檔頭來源註解
- `src/lib/__tests__/usage-limit.test.ts`：+45 行
- `docs/agent-guide/usage-limit-continue.md`：〈句型來源〉補 T0897
- `e2e/t0592-codex-tower-worker.spec.ts`：等待信號、清理順序、失敗診斷、檔頭說明
- `docs/agent-guide/bat-mcp-shim.md`：t0592 說明後補 T0897 根因與修正
- CLAUDE.md 不需改：「用量限制自動繼續」節只寫「辨識唯一實作 `src/lib/usage-limit.ts`…CLI 改字串時需同步改此檔與測試」，「BAT MCP shim」節只寫 codex 升版必跑 t0592，本單沒有改變這兩點。

### Commit
- 工單開工＋提問 commit（`$CT_HOME`）：`9182dbad`（只含本工單）。
- 產品 commit（`ct/T0897`）：`c9f98ba9`（`fix(T0897): recognise claude spend/credit limit stops; stabilise e2e t0592 notify wait`），5 個檔，皆在 `affects_files`。
- 工單收尾 commit：另一筆，只含本工單。
- 沒有 push、沒有觸發 workflow、沒有建 tag；沒有用 `git stash` / `reset` / `checkout --` / `restore`；`git add` 用明確路徑；diff 中 `\r` 0 筆（LF）。收單前 `git -C "$CT_WORKTREE" status --porcelain` 為空。

### 互動紀錄
- [01:15] 開工：landing PASS（`repo` = `better-agent-terminal` = `basename "$CT_HOME"`）、merge-base `v0.8.x` = `7094b993` ✅（與〈派工補記〉相同）。
- [01:18] Q-1～Q-3 寫入工單並 commit，經 BAT 通道 `--ask` 送出（Q-1、Q-2 `--no-pty-write`，Q-3 `--submit`）。
- [01:19] Q-1: `usage limit · contact your admin to increase it` 歸類？ → A（塔台，BAT 通道）: B，歸 `claude-blocked` → `non-timed`，只新增帶後綴的句子 → Action: 加進 `CLAUDE_BLOCKED_RE`，測試含後綴、引用在句中不算、無後綴句不變。
- [01:19] Q-2: `Usage is paused for your organization` 要不要認？ → A（塔台，BAT 通道）: A，不加，回報區列為觀察（含計數與前後文） → Action: 不加，測試鎖定「不認」，觀察寫進〈遭遇問題〉。
- [01:19] Q-3: `usage credit limit` 要不要防禦性加？ → A（塔台，BAT 通道）: A，不加，附證據並說明警告句為何不是停止句 → Action: 不加，測試鎖定警告句不認，證據寫進〈產出摘要〉。
- [01:21] ② t0592：自然狀態 22 次全過，依序以實驗排除「前景 node 吞輸入（延遲 8 s）」「分段重繪」「歷程預測」，延遲 25 s 重現 T0891 症狀，確認根因後修正並以同樣延遲驗證通過。
- [01:33] 產品 commit `c9f98ba9` 後跑驗收關卡。
- 塔台補充檢查：驗證前與產品 commit 前沒有逐一記錄檢查時點；填回報前（01:37）檢查，沒有 `## 塔台補充（…）` 段落（工單檔自 `9182dbad` 起只有本 session 的改動）。

### Renew 歷程
無

### 遭遇問題
1. **工單「至少 `usage credit limit`」與 binary 不符**：2.1.331 沒有任何 `You've hit your usage credit limit` 停止句（證據見〈產出摘要〉①），依塔台 Q-3 = A 不加。
2. **完整 `test:unit` 第一次 1 個失敗（非本單範圍）**：`electron/__tests__/bat-mcp-codex-env.test.ts` 的 afterEach `fs.rmSync(dir, { maxRetries: 20, … })` 刪 codex 暫存目錄時 `EPERM`（測試斷言本身沒失敗）。單獨重跑通過、第二次完整跑全綠。和 ② 的根因同一類：剛結束的內嵌 codex 留下的檔案短時間內刪不掉。可考慮另開單讓這個 afterEach 刪不掉時不讓測試失敗（例如只記錄、不丟例外）；本單沒動（不在 `affects_files`）。

**觀察（非本單範圍）**：
1. **`Usage is paused for your organization. For help, please contact support.`**（塔台 Q-2 = A，不認）：計數 2；2.1.331 `var … W8e="Usage is paused for your organization. For help, please contact support."`，`ui(e,n)` 開頭 `if(e.dailyCapPaused===!0)return W8e`（組織每日上限暫停，不帶重置時間）。BAT 撞到時不顯示提示（＝現狀）。若要提示需新的「每日暫停」類別，由塔台另行決策。
2. **e2e 會寫進使用者自己的 PSReadLine 歷程**：t0592 的塔台分頁是使用者的互動 pwsh，spec 打進去的 `(Get-Command codex).Source | Out-File …` 與 `T0592 完成` 會存進 PSReadLine 歷程檔（本機歷程已有 71 / 44 行；含 `BAT_REMOTE_TOKEN` 名稱的 codex 指令行被 PSReadLine 預設規則略過，不會寫入）。之後打 `T` 時歷程預測會顯示 `0592 完成` 灰字，實測不影響斷言。若要避免，可在 spec 開頭關掉該分頁的 PSReadLine 歷程存檔（`Set-PSReadLineOption -HistorySaveStyle SaveNothing`），本單沒做（不屬於穩定化，而且會改變「使用者 profile 下的真實分頁」前提）。
3. CLAUDE.md 不需改（理由見〈相關檔案〉）。

### 子代理與 Workflow 使用
未使用（沒有啟動子代理，也沒有呼叫 Workflow）。

### 隔離分支證據
- branch：`ct/T0897`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`；與 `v0.8.x` 的 merge-base = `7094b993b67313db8f3c6b058a33f483896ec5b4`，與〈派工補記〉相同）
- validated_sha：`c9f98ba9f01c65dededda1b65e079af34998d797`
- head_sha：`c9f98ba9f01c65dededda1b65e079af34998d797`
- validated_sha ≠ head_sha 的說明：相同，不適用。
- `CT_HOME` 主 checkout 目錄名 = `better-agent-terminal`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

### 回報時間
2026-11-25T01:37:12+0800
