---
schema_version: 1
schema_kind: workorder
id: T0664
title: "v0.7.1-pre.2 已安裝版自動化驗收：BUG-162 權限請求不經鍵盤結束後 ⚠️ 消失（PostToolBatch）"
type: implementation
status: TODO
repo: better-agent-terminal
project: BUG-verify-071pre2
priority: P1
sizing: S
created_at: "2026-10-18T21:30:28+0800"
started_at: ""
updated_at: "2026-10-18T21:30:28+0800"
completed_at: ""
target_version: "0.7.1-pre.2（驗收，不發版）"
related:
  - "BUG-162 / T0657（`ff14fa5d`；回報區第 3 點：bypass 下 safety check 仍回 `ask`、`autoDenyWindow`、`PostToolBatch` 時機）"
  - "`e2e/t0590-blocked-state.spec.ts`（blocked 狀態 e2e 範本）、`e2e/pre7-acceptance.spec.ts`（安裝版 + 隔離實例範本）"
  - "docs/agent-guide/blocked-state.md"
  - "T0663（同時進行：BUG-157 / 158 / 160 / 161 / 163，另一個 spec 檔）"
affects_files:
  - e2e/v071-pre2-blocked-acceptance.spec.ts
  - _ct-workorders/T0664-pre2-installed-blocked-clear-acceptance.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只寫驗收工具 / opt-in spec，不改產品程式碼**（`electron/**`、`src/**`、`scripts/**`、`package.json`、`e2e/fixtures/**` 不動，`e2e/fixtures/` 只讀 / 只 import）。發現產品缺陷 → 回報區記證據，該項 FAIL、整單 PARTIAL，**不自行修**。BUG 檔與 `_bug-tracker.md` 不動。"
  - "🔴 **受測 build = 已安裝的 pre.2**：`C:/Program Files/BetterAgentTerminal/BetterAgentTerminal.exe`（開工時確認 FileVersion `0.7.1-pre.2`，隔離實例 `app.getVersion()` 也要相符），以 `BAT_E2E_EXECUTABLE` + `e2e/fixtures/electron-isolation.ts` 的 `launchIsolated` 啟動。hook 腳本與 claude 一律用**安裝版內附**的（`resources/scripts/bat-hook.mjs`、內嵌 claude），不用 repo 的 `scripts/`。"
  - "🔴 **不碰使用者正在用的 BAT**（port 9876、真實 userData 只讀）；不得對使用者的分頁送任何輸入。"
  - "🔴 **Claude token 上限**：只有 V2 可以跑真實 claude，最多 3 個短回合（能指定就用最便宜的模型，例如 `--model haiku`），回報區記實際回合數。使用者 `~/.claude` 只讀。真實 claude 的 cwd 一律是本單建立的 temp 目錄；prompt 要它刪除的目標只能是該 temp 目錄底下本單建立的檔案。"
  - "🔴 **驗證期間不得有使用者輸入**：判定 ⚠️ 消失的那一段，不得經 `pty:write`（使用者輸入會清 `blocked`）；需要寫入 PTY 時只用 `pty:write` 第三參數 `{ auto: true }`，並在回報區寫明。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 `npm run test:e2e`（L141）。commit 用 `git commit --only <本單檔案>`（L168：T0663 同時在跑）。工作樹裡 `src/styles/settings.css` 顯示 M（內容無差異），不要動、不要提交。"
  - "🔴 **證據不要放在 Playwright `outputDir`（`e2e-results/`）底下**（L169）；放 temp / scratch 目錄，回報區寫絕對路徑。"
---

# T0664 — v0.7.1-pre.2 已安裝版自動化驗收（BUG-162）

## 背景

`v0.7.1-pre.2` 已安裝（FileVersion `0.7.1-pre.2`，塔台 2026-10-18 21:27 確認）。BUG-162：權限請求（hook `permission-request`）讓分頁進入 `blocked` / `permission`，但請求不經鍵盤結束（滑鼠允許 / 拒絕、自動拒絕）後 ⚠️ 一直留到該回合 `Stop`。T0657 加了 async `PostToolBatch` hook（批次結束後只清 `permission`，依 `agent_id` 區分 subagent），驗的是單元測試與 headless e2e，**沒有用真實 claude 跑過**。本單用已安裝的 pre.2 驗。

使用者指示「只做能自動化的」：能以 state 查詢 / 日誌判定的做到 PASS / FAIL；真實 claude 觸發不了權限提示時記 NEEDS-HUMAN 並寫明試過什麼，不要為了湊 PASS 擴大範圍。

## 驗收項目

| # | 驗收重點 |
|---|---|
| V0 | 安裝版內容：隔離實例的 claude-cli 分頁注入的 `--settings=<dataDir>/bat-mcp/claude-settings.json` 含 `PostToolBatch`（async、無 matcher）；安裝版 `resources/scripts/bat-hook.mjs` 認得 `post-tool-batch`；內嵌 claude 版本（記版號）的二進位含 `PostToolBatch` |
| V1 | 合成 hook（不耗 token）：在隔離實例的分頁內，以該分頁自己的 env 跑安裝版 `bat-hook.mjs`，依序送 `PermissionRequest` → 數秒後 `PostToolBatch` 的 payload（stdin JSON，欄位依 T0657 回報區）：`terminal:get-state` 由 `blocked` / `permission` / `source: hook` 變回非 blocked，期間沒有使用者輸入；subagent 情境（`agent_id` 不同）：主執行緒的批次結束**不**清 subagent 的權限，subagent 自己的批次結束才清。hook 腳本 exit 0、stdout 0 bytes |
| V2 | 真實 claude（≤ 3 回合）：隔離實例開 claude-cli 分頁（內嵌 claude，BAT 照常注入 hooks；需要時帶 `--dangerously-skip-permissions`），讓它執行會觸發權限提示的指令（T0657 回報區：bypass 下 safety check 仍 `ask`，例如危險的 `rm`，目標只能是本單 temp 目錄內的檔案；或一般模式下的 Bash）。過程不經使用者輸入：(a) 出現 `blocked` / `permission`；(b) 權限請求結束（自動拒絕 / 逾時，或以 `{ auto: true }` 寫入允許）後、該回合 `Stop` 之前，state 離開 `blocked`；(c) 隔離實例 debug log 有 `post-tool-batch` 事件造成的清除。觸發不了權限提示 → V2 NEEDS-HUMAN（寫明試過的 prompt / 模式） |

每項標 PASS / FAIL / NEEDS-HUMAN，附證據（state 回傳的時間序列、debug log 摘錄、`bat-scripts.log` 摘錄；不得記權杖值）。

## 驗證

- 新增 opt-in spec `e2e/v071-pre2-blocked-acceptance.spec.ts`：以 `BAT_E2E_V071PRE2=1` + `BAT_E2E_EXECUTABLE` gate，預設 skip；V2 另需 `BAT_E2E_REAL_CLAUDE=1`（預設 skip，避免日後誤耗 token）。
- 回報區附執行指令、結果（passed 數、耗時）、claude 實際回合數、證據目錄。
- 收尾：隔離 userData 已刪、Terminal Server 與 claude 程序不殘留、temp 目錄已刪。

## 驗收條件

- [ ] V0–V2 各有 PASS / FAIL / NEEDS-HUMAN 與證據
- [ ] 受測 exe FileVersion 與 `app.getVersion()` = `0.7.1-pre.2`
- [ ] 未改產品程式碼；未碰使用者 BAT；claude 回合數 ≤ 3
- [ ] 環境清理完成

## Sub-session 執行指示

1. 讀本工單、BUG-162、T0657 回報區、`docs/agent-guide/blocked-state.md`、`e2e/t0590-blocked-state.spec.ts`、`e2e/fixtures/electron-isolation.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（時間用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取，R-G001）
3. 實作 → 執行 → 填回報區（DONE：每項都有結論且無 FAIL；PARTIAL：有 FAIL 或沒做完）
4. `git commit --only` 本單產出；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

### 產出摘要

### 互動紀錄

### 遭遇問題

### 回報時間
