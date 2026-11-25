---
schema_version: 1
schema_kind: workorder
id: T0915
title: "PLAN-068 實機驗收自動化：用 Playwright 驅動 zip 測試版 BAT（`0.0.0-exp.20`）與舊版 `0.8.0-pre.1` zip，在獨立 `CLAUDE_CONFIG_DIR` 跑真的 claude＋CT 塔台，完成 CT checklist M-C1–M-C7 的 BAT 端執行與判定"
type: verification
status: PENDING
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: L
created_at: "2026-11-25T10:07:09+08:00"
updated_at: "2026-11-25T10:07:09+08:00"
target_version: "0.8.0-pre.3（與 CT 6.1.0 同日發佈）"
depends_on: [T0913]
related:
  - "PLAN-068；D336；T0913〈待實機清單〉M-C1–M-C7；CT 塔台工單 T0561（安裝步驟、ct-swap.py、checklist 定稿）；HANDOVER `_handover-2026-11-25-tower-user-inbox-issue24.md`〈核定紀錄〉"
affects_files:
  - _ct-workorders/T0915-ct610-automated-acceptance.md
  - e2e/manual/
  - e2e/fixtures/
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0915（塔台已預先從 `v0.8.x` `d637350b` 建立分支 `ct/T0915`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0915` 寫檔；開工確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `d637350bd3576e04e272852874d2890200075ef3`，不符就停下問塔台。不 merge / rebase / push、不動 `main` 與 `v0.8.x`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式；只新增 `e2e/manual/` 的驅動腳本，必要時以 opt-in 參數擴充 `e2e/fixtures/`（既有 e2e 行為不得改變）。"
  - "🔴 外部路徑（只在本機、不進 repo；腳本一律從 env 讀路徑，不把家目錄路徑寫進 repo，D176）：驗收根目錄 `C:/Users/Gower/AppData/Local/ct610-accept`（以下稱 ACCEPT），其中 `checklist.md`（CT 定稿，每項的步驟、CT 端預期）、`ct-test-project/`（測試專案原版）、`claude-config/`（測試用 `CLAUDE_CONFIG_DIR`，CT T0561 已裝 CT 6.0.2、全域 CLAUDE.md、CT guard）、`ct-swap.py`（換 CT 版本，指令照 checklist 抄）。測試版 BAT：`C:/Users/Gower/AppData/Local/BAT-TestBuilds/0.0.0-exp.20-win/BetterAgentTerminal.exe`（v0.8.x `d637350b`）。舊 BAT（M-C6）：從 GitHub Release `v0.8.0-pre.1` 下載 `BetterAgentTerminal-0.8.0-pre.1-win.zip`（`gh release download v0.8.0-pre.1 -R gowerlin/better-agent-terminal`；有 SHA256 檔就比對），解壓到 `C:/Users/Gower/AppData/Local/BAT-TestBuilds/0.8.0-pre.1-win/`（下載檔放自己的空目錄）。"
  - "🔴 前置條件（開工先查，任一不成立 → 不開任何 claude 回合，狀態 BLOCKED，回報缺什麼，通知塔台）：① ACCEPT 的 `checklist.md` 已是 CT 定稿版（每項有「CT 端預期」欄）；② `claude-config/.credentials.json` 存在（🔴 只檢查存在，不讀、不複製、不記內容；不存在 = 使用者還沒登入）；③ `claude-config/skills/` 是 CT 6.0.2（依 checklist 指定的檢查方式）；④ 兩個 exe 都在。"
  - "🔴 啟動方式：一律用 `e2e/fixtures/electron-isolation.ts` 的 `launchIsolated`＋`BAT_E2E_EXECUTABLE`（獨立 `--runtime=e2e-*`，絕不用預設 userData；不碰使用者的安裝版 BAT、其 userData / Terminal Server / `bat-pty-holder`）。env 加 `CLAUDE_CONFIG_DIR=<ACCEPT>/claude-config`；🔴 並且移除繼承的 `CLAUDECODE`、`CLAUDE_CODE_*`（本 Worker 自己的 claude session 變數，否則測試塔台的 claude 會被當成巢狀 session）——以 `launchIsolated` 的 opt-in 參數（例 `dropEnv`）實作，不改其他 e2e 的行為。BAT 的 PTY 繼承主行程 env，所以測試塔台與它派出的 Worker 都用這個 config 目錄。"
  - "🔴 情境與測試專案：每個情境一份新副本 `ACCEPT/runs/<情境>/`（從 `ct-test-project` 複製；情境 = `M-C7`、`M-C1-C5`、`M-C6`），跑完保留不刪。順序：① M-C7 前半（測試版＋CT 6.0.2）→ 依 checklist 呼叫 ct-swap.py 換 6.1.0-pre.1 → M-C7 後半 ② M-C1–M-C5（測試版＋6.1.0-pre.1；M-C5 用同一個 CLAUDE_CONFIG_DIR 從本 worktree 的 marketplace 安裝 `bat-hooks` plugin：`claude plugin marketplace add` / `install`，env 必帶該 CLAUDE_CONFIG_DIR，🔴 使用者層 `~/.claude` 不得有任何變更）③ M-C6（舊 BAT `0.8.0-pre.1` zip＋6.1.0-pre.1）④ 最後依 checklist 把 `claude-config` 還原成 CT 6.0.2（若 checklist 有寫）。"
  - "🔴 操作方式：塔台是 BAT 開的 claude-cli 分頁（以 UI 或 renderer IPC 開，不用 helper 假造）；輸入用 Playwright 鍵盤打進 xterm（真的使用者輸入路徑），半句＝打字不按 Enter；往上捲＝在 xterm 上 `mouse.wheel`。讀取：DOM（縮圖徽章 `CT↑` / `BAT↑` / `🪝✕` / `💬N` / `⏸N` / `📨 待送`、待辦分頁、卡片）、`bat_*` 對應的 helper 查詢輸出、`--set-role` 輸出、debug log（`[tower-cards]` / `[notify-hold]` 等）、bat-scripts.log。每步截圖。需要模型配合才會出現的狀態（權限對話框、> 16 KiB 回覆、awaiting_user 選項）以明確提示詞觸發，同一項最多試 3 次，仍沒出現就判「未觸發」，🔴 不得硬判 PASS。"
  - "🔴 結果檔（ACCEPT/results/，CT 讀）：每項一個 `M-Cn.md`＋截圖目錄 `M-Cn/`，內容：執行時間（系統取時）、測試專案路徑、BAT / CT 版本、步驟、BAT 端觀察與判定（PASS / FAIL / 未觸發，附證據）、helper 與塔台的原始輸出（🔴 權杖值不出現；`BAT_REMOTE_TOKEN` 只寫「已設定」）、本項 claude 回合數。🔴 「CT 端判定」欄留空給 CT 寫。工單回報區附總表（每項 BAT 端判定、回合數、各情境的測試專案路徑）。"
  - "🔴 FAIL 的處理：BAT 端 FAIL 不修產品程式，記重現步驟與證據，在回報區建議開 BUG（塔台開單）；繼續跑其他項。checklist 寫法看不懂或與實際 UI 不符 → 依 ct-exec § Questions For Tower 問塔台（塔台會轉 CT），不自己改 checklist。"
  - "🔴 驗證與 Git：腳本進 `e2e/manual/`（不被一般 `npm run test:e2e` 收進去，寫明手動執行方式與必要 env）；`npx vite build` exit 0、兩個 typecheck = 0；若改了 `e2e/fixtures/`，跑 2 支既有使用 `launchIsolated` 的 e2e 確認不回歸。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。程序清理照 D308（結束前比對自己啟動的 electron / claude 程序，只結束本單建立的）。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（範例路徑 `C:\\Users\\demo`）。結果檔在 ACCEPT（本機），可寫實際路徑。yolo：不得問使用者。"
---

# T0915 — PLAN-068 實機驗收自動化（CT checklist M-C1–M-C7）

## 背景

PLAN-068（契約 v2、待辦分頁、通知保護、回合訊息卡、bat-hooks）已在 `v0.8.x` `d637350b`，測試版 `0.0.0-exp.20` 已打包。T0913 整理出需要真 claude / 真 CT 的待實機項目。使用者要求 CT 塔台那一組（M-C1–M-C7）改成在隔離的免安裝測試版上自動測試；BAT 與 CT 協調後（D336）：BAT 主導執行，CT 負責 checklist、測試環境（CT T0561）與 CT 端判定。測試塔台用獨立 `CLAUDE_CONFIG_DIR`，使用者層的 CT 一直維持 6.0.2。

## 驗收

- [ ] 前置條件檢查（checklist 定稿、測試目錄已登入、CT 6.0.2、兩個 exe）
- [ ] 驅動腳本（`e2e/manual/`，路徑全由 env 提供）
- [ ] M-C7（6.0.2 → 換 6.1.0-pre.1）
- [ ] M-C1–M-C5（6.1.0-pre.1；M-C5 含 bat-hooks plugin 裝在測試 config 目錄）
- [ ] M-C6（舊 BAT `0.8.0-pre.1` zip）
- [ ] 每項結果檔與截圖寫入 `ACCEPT/results/`，回報區總表
- [ ] 使用者層 `~/.claude` 無變更、安裝版 BAT 未被碰、程序清理
- [ ] build、兩個 typecheck；改 fixture 時既有 e2e 不回歸

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）
