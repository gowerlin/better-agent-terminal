---
schema_version: 1
schema_kind: workorder
id: T0736
title: "pre.8 自動化驗收：真的 claude CLI / codex 觸發工作區等待提示 ⚠️（本機假模型，不耗 token）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-01T17:14:00+0800"
started_at: "2026-11-01T17:14:51+0800"
updated_at: "2026-11-01T17:37:32+0800"
completed_at: "2026-11-01T17:37:32+0800"
session_ids:
  - "1c1d7865-e652-4c1a-9b99-6adc99e5e35a"
depends_on: []
related:
  - "T0735（`b4daaf1f`，D200–D203）：`e2e/t0735-workspace-waiting-badge.spec.ts` 只以自訂 CLI 呼叫 `bat-hook.mjs` 模擬 hook，沒有真的 claude / codex 觸發"
  - "T0727（`e2e/fixtures/fake-anthropic-api.ts`、`e2e/v072-pre6-claude-panel.spec.ts`：假 Anthropic API、暫存 HOME、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、拒絕 proxy、工作區放 `%ProgramData%`）"
  - "T0621 / T0728（`e2e/t0621-codex-osc-state.spec.ts`：內嵌 codex + 本機假 OpenAI Responses API、temp `CODEX_HOME`、approval prompt → OSC `blocked` / `input`）"
  - "CLAUDE.md「Worker 分頁回收」節 T0735 段、「blocked 狀態偵測」節；`docs/agent-guide/worker-tab-recycle.md`、`docs/agent-guide/blocked-state.md`"
affects_files:
  - "e2e/v072-pre8-workspace-waiting-real-agents.spec.ts（新增，檔名可調；可拆成 claude / codex 兩檔）"
  - "e2e/fixtures/（只在需要共用假模型 helper 時新增或擴充；不改既有 spec 的行為）"
  - docs/agent-guide/worker-tab-recycle.md
  - _ct-workorders/T0736-e2e-pre8-workspace-waiting-real-agents.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 情境（隔離實例裡至少兩個工作區：A = 正在看的、B = 放 agent 分頁的；斷言都在 A 看 B 的列，與 T0735 e2e 相同的 DOM / selector）：① 手動開的 Claude CLI 分頁（內嵌 claude CLI、預設權限模式）＋假 Anthropic API 回一個需要權限的 tool_use（例 Bash）→ 真的 `PermissionRequest` hook → B 列出現實心 ⚠️、滑過 tooltip 是 permission 原因且不含指令內容；在 B 分頁核准 → ⚠️ 消失（或依 D203 在沒看時變淡化，視當下焦點，兩者擇一斷言並寫明）。② 「以塔台開啟 Claude」的分頁（`launchRole: 'tower'`）＋假 API 回 `AskUserQuestion` tool_use → `question` → B 列 ⚠️；回答後清除。③ 手動開的 Codex CLI 分頁（不經 helper 派工）＋本機假 Responses API 回需要核准的 `exec_command` → OSC `blocked` → `input` → B 列 ⚠️；核准後清除。④ helper 派工的 claude Worker（落點 B）blocked → B 列 ⚠️，同時 Worker 分頁標籤仍是 ⚠️、批次關閉計數不含它（T0609 規則不變）。⑤ 多個分頁同時等待 → `⚠️ N`；點 ⚠️ 跳到等最久的那個分頁並切回終端頁籤。⑥ 側欄停在「塔台」頁籤 / 收合時，總數 badge 反映 ①–④ 的狀態。"
  - "🔴 不耗 token：claude 只打 spec 內的假 Anthropic API（沿用 T0727 的隔離做法：暫存 HOME、`ANTHROPIC_BASE_URL` / 假 key、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、拒絕並記錄的 proxy），codex 只打本機假 Responses API（temp `CODEX_HOME`，沿用 t0621）；不得用使用者的 claude / codex 登入或真實 API；回報區列出對外請求數（預期 0）。claude CLI 首次啟動的信任 / API key 確認畫面以預先寫好暫存 HOME 的設定處理，不得改產品程式碼來繞過。"
  - "🔴 不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷 → 記在回報區〈發現的問題〉附重現步驟與證據，由塔台開 BUG，不在本單修。某情境做不到（例如 claude CLI TUI 在 e2e 中無法驅動）就寫明原因與已試過的做法，其餘情境照做，不硬湊；可依此回 PARTIAL。"
  - "🔴 隔離：一律用 `e2e/fixtures/electron-isolation.ts` 的隔離實例（`--runtime=e2e-…`、獨立 userData 與 remote port），不得以預設實例啟動 source build，不碰使用者正在用的 BAT 與其 userData，不執行任何安裝檔。先 `npx vite build`。工作區名稱一律 `e2e-t0736-*`。暫存目錄跑完要清掉；清不掉（安全檢查擋下等）就把路徑寫進回報區。"
  - "🔴 驗證：新 spec 綠（或部分綠並說明），連跑 2 次；重跑 `t0735-workspace-waiting-badge`、`t0609-worker-attention-badge`、`t0590-blocked-state`、`t0621-codex-osc-state` 綠（〈相關通過案例判定〉列出）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 若在 tsconfig 範圍外則註明）。`docs/agent-guide/worker-tab-recycle.md` 的 T0735 驗證清單補一行指向新 spec。回報區另列「仍需手動實機驗收」的項目（例如真實模型、遠端 / headless 工作區、安裝版、視覺感受），供塔台轉給使用者。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0736 — pre.8 自動化驗收：真的 claude CLI / codex 觸發工作區等待提示

## 元資料

- **工單編號**：T0736
- **類型**：implementation（驗收用 e2e）
- **優先級**：P2
- **建立時間**：2026-11-01T17:14:00+0800
- **預估規模**：M

## 背景

使用者要求安排 `v0.7.2-pre.8`（工作區等待提示，T0735 / D200–D203）的自動驗收。HEAD 的 `src` / `electron` / `scripts` / `e2e` 與 pre.8 發版 commit `cf71bf6f` 相同，以 source build 驗即等同驗 pre.8。T0735 的 e2e 以自訂 CLI 直接呼叫 `bat-hook.mjs` 模擬 hook；本單補「真的 claude CLI hook」與「真的 codex OSC 7501」觸發的路徑，以及手動分頁、塔台分頁、helper 派工 Worker 三種分頁來源，結果作為 pre.8 實機驗收的自動化部分。

## 範圍

1. 情境 ①–⑥（見 frontmatter `memory_overrides` 第 1 條）的 e2e，假模型不耗 token。
2. 重跑相關既有 spec。
3. docs 驗證清單一行。

## 不做

- 不改產品程式碼、不修發現的缺陷。
- 不涵蓋 detached 視窗（D201 延後）、Claude Agent 面板（SDK，無 PTY attention）、遠端 / headless 工作區（列為手動）。

## 驗收

- [x] 情境 ①–⑥ 逐項 PASS / 未涵蓋與原因
- [x] 對外請求數 0
- [x] 〈相關通過案例判定〉（t0735 / t0609 / t0590 / t0621 綠）
- [x] 兩個 typecheck = 0
- [x] 〈仍需手動實機驗收〉清單

---

## 回報區

### 完成狀態

- **狀態**：DONE（情境 ①–⑥ 全 PASS；新 spec 最終版連跑 2 次綠；相關 4 個 spec 綠；兩個 typecheck = 0）
- **session_id**：1c1d7865-e652-4c1a-9b99-6adc99e5e35a
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`、`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `e2e/`、`docs/agent-guide/worker-tab-recycle.md` 存在（present）；無 `branch` 欄位（C-2 不適用）；`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE` = yolo、`CT_INTERACTIVE` = 0。
- **產品 commit**：`0232034f` test: T0736 pre.8 e2e（只含下列 2 檔；`src/` / `electron/` / `scripts/` 未動）
- **變更檔案**：
  - `e2e/v072-pre8-workspace-waiting-real-agents.spec.ts`（新增，單一檔涵蓋 claude 與 codex；假 Responses API 與 t0621 / t0728 同型，內嵌在 spec，未新增 fixture）
  - `docs/agent-guide/worker-tab-recycle.md`（T0735 驗證清單補一條指向新 spec，含暫存 HOME 必要設定的說明）

#### 情境結果（最終版第 1、2 次相同）

| 情境 | 結果 | 證據（spec 日誌 / 斷言） |
|---|---|---|
| ① 「+」選單開的 Claude CLI 分頁（內嵌 claude 2.1.316、預設權限模式） | PASS | 假 API 回 Bash tool_use → `[blocked] … → blocked reason=permission (hook permission-request tool=Bash)`（claude 自己的 hook）；在 A 看 B 列：`⚠️`、`data-waiting-target` = 該分頁；tooltip `等待使用者：1 個分頁 / • Claude CLI: 等待使用者：權限確認（下午05:32 起） / 點擊切到 Claude CLI（等最久）`，不含指令內容（斷言不含 `t0736-secret-cmd` / `127.0.0.1:9`；指令確實出現在分頁畫面上）。核准：該分頁正被看（B active、分頁選中、`document.hasFocus()` = true）時 Enter → `cleared (user input)`，無淡化（D203：在看時結束）；沒有焦點時的分支寫成淡化斷言（兩次執行都有焦點，未走到） |
| ② 「以塔台開啟 Claude」分頁（`launchRole: 'tower'`） | PASS | 假 API 回 AskUserQuestion → `blocked reason=question (hook ask-user-question)` → B 列 `⚠️ 2`，tooltip 有「等待使用者回答問題」、不含問題文字；未看時 Enter 回答 → `cleared (user input)` → 該分頁縮圖淡化 ⚠️，假 API 收到 step 1（答案送回、回合繼續） |
| ③ 「+」選單開的 Codex CLI 分頁（內嵌 codex 0.166.0，`-a on-request -s read-only`，非 helper 派工） | PASS | 在 TUI 輸入 prompt → 假 Responses API 回 escalated `exec_command` → 核准提示 → `blocked reason=input (osc)` → B 列 `⚠️ 3`，tooltip「codex 等待輸入（核准或提問）」；畫面上沒有 `check_for_update_on_startup`（確認是手動分頁的指令）；未看時 `y` → `cleared (osc working)` → 淡化 ⚠️ |
| ④ helper 派工的 claude Worker（落點 B） | PASS | B 的 shell 分頁 `bat-terminal.mjs --notify-id … --workspace e2e-t0736-b --agent claude-cli --skill ct-exec --workorder T0736` exit 0（落點 = 塔台所屬工作區）；Worker 讀 B 資料夾的專案 skill `ct-exec`（本文帶假 API 的情境標記）→ Bash → `blocked reason=permission` → B 列 `⚠️ 4`；Worker 自己的標籤 `⚠️`（`data-blocked-reason="permission"`），縮圖沒有另一個非 Worker ⚠️；塔台右鍵「關閉已回報的 Worker 分頁」= `(0)` 且停用（T0609 規則不變）；未看時 Enter → `cleared (user input)` → 標籤的 blocked 消失、旁邊留淡化 ⚠️ |
| ⑤ 多分頁同時等待 / 點擊跳轉 | PASS | ①–④ 同時等待時 B 列 `⚠️ 4`（`data-waiting-count` = 4）；先把 B 的工作區頁籤列切到「檔案」，回 A 點 B 列 ⚠️ → B active、等最久的 ①「Claude CLI」選中、B 的頁籤列回到第一個（終端）；debug log `[workspace-waiting] go to workspace=e2e-t0736-b terminal=<①>` |
| ⑥ 側欄停在「塔台」頁籤 / 收合 | PASS | ①–④ 等待中：塔台頁籤顯示時「工作區」頁籤標題 `⚠️ 4`；收合窄列 `⚠️ 4`，點擊展開側欄。回答順序 ①→②→③→④ 後 B 列 `⚠️ 3` → `⚠️ 2` → `⚠️` → 淡化（`data-waiting="missed"`） |

- 日誌不含指令 / 問題文字、不含權杖：debug log 與 `bat-scripts.log` 斷言不含 `t0736-secret-cmd`、`T0736 which option`、`batcap.<16+ 字>`。

#### 驗證

- **新 spec**：`npx playwright test e2e/v072-pre8-workspace-waiting-real-agents.spec.ts`，最終版（即 commit `0232034f` 的內容，跑完後未再修改）連跑 2 次：`1 passed` / `1 passed`（每次約 1 分鐘，含啟動 / 關閉）。先 `npx vite build`（exit 0）。
- **相關通過案例**：見下節，4 passed。
- **typecheck**：`npm run typecheck` exit 0、`npm run typecheck:electron` exit 0（本單未改 `src/` / `electron/`）。`e2e/` 不在兩個 tsconfig 的 `include` 內；另以 `npx tsc --noEmit --skipLibCheck --strict --esModuleInterop --target ES2022 --module commonjs --moduleResolution node --types node e2e/v072-pre8-workspace-waiting-real-agents.spec.ts` 單檔檢查 exit 0。
- **對外請求 / token**：
  - 假 Anthropic API 5 個請求（`t0736-perm#0`、`t0736-ask#0`、`t0736-worker#0`、`t0736-perm#1`、`t0736-ask#1`），假 Responses API 1 個（`POST /v1/responses`）；**模型 API 對外 0、token 0**（未用使用者的 claude / codex 登入；暫存 HOME、暫存 `CODEX_HOME`，繼承的 `ANTHROPIC_*` / `CLAUDE*` / `OPENAI_*` / `CODEX_*` 不傳給隔離實例）。
  - 拒絕並記錄的 proxy：**實際送出 0**；嘗試 5 個，全部被 proxy 以 403 拒絕，且全部發生在「codex 分頁啟動」階段（spec 分階段快照：BAT 啟動 0、claude 分頁啟動 0、codex 分頁啟動 5、情境 ①–⑥ 期間 0）：`CONNECT raw.githubusercontent.com:443`、`chatgpt.com:443` ×2、`github.com:443`、`api.github.com:443`。codex 二進位內可對到 `raw.githubusercontent.com/openai/codex/main/announcement_tip.toml` 與 `api.github.com/repos/openai/codex/releases/latest`（設了 `check_for_update_on_startup = false` 仍有）；`chatgpt.com` / `github.com` 未逐一對到用途。spec 斷言其中沒有 `api.anthropic.com` / `api.openai.com`。
  - claude 原本另有 2 個 `downloads.claude.ai`（官方 plugin marketplace 自動安裝 / model catalog），以 `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1` 消除；codex 加 `[analytics] enabled = false` 後 `ab.chatgpt.com`（OTLP metrics）消失。
- **隔離與清理**：`launchIsolated('t0736')`（`--runtime=e2e-t0736-<ts>`、獨立 userData 與 remote port），工作區 `e2e-t0736-a` / `e2e-t0736-b`；每次執行 `runtime userData removed: true`、`Terminal Server … alive after teardown: false`、兩個暫存目錄（`%TEMP%\bat-t0736-*`、`%ProgramData%\bat-e2e-t0736-*`）`removed: true`；收尾時再查無殘留目錄。未啟動預設實例、未執行安裝檔。
- **偏離**：無。claude 首次畫面以暫存 HOME 預先寫好的設定處理，未改產品程式碼（見〈發現的問題〉2 與互動紀錄）。

### 相關通過案例判定

本單未改產品程式碼，不影響任何已通過案例。重跑結果（同一次 `npx playwright test`，`4 passed`）：

| 案例 | 結果 |
|---|---|
| `e2e/t0735-workspace-waiting-badge.spec.ts` | 綠（`document.hasFocus()` = true，「在看時結束不留淡化」有走到） |
| `e2e/t0609-worker-attention-badge.spec.ts` | 綠 |
| `e2e/t0590-blocked-state.spec.ts` | 綠 |
| `e2e/t0621-codex-osc-state.spec.ts` | 綠 |

### 發現的問題

1. **（疑似產品缺陷，建議塔台開 BUG）剛開的分頁在 100 ms 內被切走時，PTY 被設成 9x5**
   - 現象：從「+」選單連續開分頁，前一個分頁的 PTY 變成 `cols=9 rows=5`，直到使用者切到它才回到正常尺寸。claude TUI 在這期間以 9 欄繪製（spec 早期的畫面擷取是每行 10 字元的碎片）。與 CLAUDE.md「新 PTY 的初始尺寸」節所述「背景分頁不 fit、維持 spawn 尺寸」不符。
   - 重現：隔離實例，在工作區連點「+」→ Claude CLI、「+」→ 以塔台開啟 Claude；debug log 對第一個分頁依序出現 `[resize] pty.resize cols=137 rows=35` → `TerminalPanel render … active=false` → `ResizeObserver #2 … active=false 0x0` → `[resize] initial doResize terminal=<id>` → `[resize] pty.resize cols=9 rows=5`（本單第 3 次執行的日誌；最終版每次執行都記到「Claude CLI: 9x5 before selecting it, 137x35 after」）。
   - 推測原因（未改）：`src/components/TerminalPanel.tsx:1029-1035` 掛載時若 active 就排 100 ms 後的 initial `doResize()`，計時到時沒有再檢查 `isActiveRef.current`；這 100 ms 內分頁已被隱藏，於是對 0x0 容器 fit。
   - 影響：只在分頁剛開就被切走時；本 spec 先逐一選取分頁讓尺寸恢復，再跑情境（不影響本單的斷言）。
2. **（非 BAT 缺陷，供參考）claude CLI 2.1.316 的權限模式與 gateway**：暫存 HOME 只預答 onboarding / 信任 / API key 時，claude 以 **auto mode** 啟動；auto mode 的 classifier 在自訂 `ANTHROPIC_BASE_URL`（gateway）下不可用，Bash 時停在「To fix it and access the new version of auto mode, ask your gateway to implement … Enter to continue · Esc to cancel」對話框，**不觸發 `PermissionRequest` hook**，BAT 不會顯示 ⚠️。設 `~/.claude/settings.json` `permissions.defaultMode: "default"` 後，claude 先問「Make auto mode your default permission mode?」（`.claude.json` `hasSeenAutoDefaultNudge: true` 可略過）。另外 `mkdir <cwd 內>` 在 default 模式也被 claude 自動允許，不出權限提示（spec 改用 `curl` 到本機關閉的 port 9）。⇒ 使用者在 auto mode 下，只有 classifier 擋下 / 需要確認的動作才會出現 ⚠️，這是 claude 的行為，BAT 的判斷不變。
3. codex 0.166.0 啟動時，即使 `check_for_update_on_startup = false`，仍嘗試連 `api.github.com/repos/openai/codex/releases/latest` 等（見上，全被 proxy 擋下）；屬 codex 行為，記錄供日後 e2e 參考。

### 仍需手動實機驗收

- 真實模型（使用者自己的 claude / codex 登入）觸發 ⚠️：本單只用假模型；特別是 **auto mode**（claude 2.1.316 的預設）下哪些動作會出提示、⚠️ 是否出現。
- 遠端 / headless 工作區（WSL / SSH / Docker）的分頁等待 → 本機視窗的工作區列 ⚠️（工單「不做」範圍）。
- 安裝版（pre.8 安裝檔，`BAT_E2E_EXECUTABLE`）上同樣流程；本單以 source build 驗（HEAD 的 `src` / `electron` / `scripts` 與 `cf71bf6f` 相同）。
- 視覺感受：active 列（藍底）上的 ⚠️ 可讀性、淡化 ⚠️ 的辨識度、`⚠️ N` 在窄側欄的排版（spec 有截圖於 `e2e-results/`，未做人工判讀）。
- 視窗沒有 OS 焦點時「在看時結束」的行為（兩次執行都有焦點，淡化分支未走到）。
- 用滑鼠回答 claude 權限 / AskUserQuestion（本單以鍵盤 Enter 回答，清除來源是 `user input`；滑鼠回答走 `post-tool-batch` / `ask-user-question-done`）。
- 〈發現的問題〉1 的 9x5 在實機上是否造成可見問題（例如 claude 首屏排版錯亂）。

### 互動紀錄

- [17:14] 開工：落點檢查 PASS，status → IN_PROGRESS。
- [17:20] 第 1 次執行：claude 三分頁與 codex 都啟動，但 `mkdir` 被 claude 自動允許、沒有權限提示 → 改 `git push`。
- [17:22–17:27] 第 2–5 次：claude 停在 spinner、`PermissionRequest` 未觸發；加診斷（debug log / bat-scripts.log / proxy 嘗試 / 畫面），排除 PTY 尺寸（見〈發現的問題〉1），最後畫面顯示 auto mode 的 gateway 對話框。
- [17:28–17:32] 第 6–8 次：暫存 HOME 設 `permissions.defaultMode: "default"`、`hasSeenAutoDefaultNudge: true`（從內嵌 claude 二進位找到的鍵）→ 情境 ①–⑥ 走通；修正 ④ 清除後的 Worker 標籤斷言（工單號在標題中、未回報時標籤不顯示）。
- [17:33–17:36] 第 9–10 次綠；加 claude / codex 背景流量設定與分階段 proxy 快照。最終版連跑 2 次綠，再跑相關 4 個 spec 綠。
- 未向塔台或使用者提問（沒有需要判讀的範圍問題）。

### 回報時間

2026-11-01T17:37:32+0800
