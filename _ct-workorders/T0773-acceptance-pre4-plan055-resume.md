---
schema_version: 1
schema_kind: workorder
id: T0773
title: "pre.4 自動化驗收（安裝版）：PLAN-055 Terminal Server recovery 後恢復 agent 分頁 —— 真的 claude `--resume` 接回對話（真實模型小額）、真的 codex `resume` 選單"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T05:08:42+0800"
depends_on: []
related:
  - "PLAN-055（T0765 研究、T0766 B1 `cb263cc1`、T0767 B2 `5d104926`，D211）；D215（本批自動化驗收，真實模型上限）"
  - "既有 e2e：`e2e/t0766-interrupted-agents-recovery.spec.ts`、`e2e/t0767-interrupted-codex-resume.spec.ts`（兩支都用 csc 編的假 claude / codex，只驗 argv）、`e2e/t0704-heartbeat-recovery.spec.ts`（只結束 Terminal Server 造 recovery 的做法）；`e2e/v072-real-model-*.spec.ts`（真實模型的做法與費用計算）；隔離實例 `e2e/fixtures/electron-isolation.ts`（`BAT_E2E_EXECUTABLE`，`TERMINAL_SERVER_SCRIPT` 已支援安裝版）"
  - "CLAUDE.md「Terminal Server 存活判定與 recovery」節（被中斷的 agent 分頁）；`docs/agent-guide/terminal-server-recovery.md`「被中斷的 agent 分頁」"
affects_files:
  - "e2e/t0773-*.spec.ts（新增，檔名可調；🔴 真實模型部分必須預設 skip，只有 `BAT_E2E_REAL_MODEL=1` 才跑）"
  - "e2e/t0766-interrupted-agents-recovery.spec.ts、e2e/t0767-interrupted-codex-resume.spec.ts、e2e/t0704-heartbeat-recovery.spec.ts（只在需要支援安裝版時小改，不得改斷言語意）"
  - docs/agent-guide/terminal-server-recovery.md
  - _ct-workorders/T0773-acceptance-pre4-plan055-resume.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 驗收對象：優先用安裝版 `C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe`（FileVersion `0.7.3-pre.4`）以 `BAT_E2E_EXECUTABLE` 啟動隔離實例；不行再用現有 source build `dist` / `dist-electron`（04:29 由 `31fa4974` 建出，與 tag `v0.7.3-pre.4` 的 `src` / `electron` / `scripts` 無差異），回報逐情境寫明。🔴 不得跑 `npx vite build`（T0770–T0773 並行）。🔴 不改 `e2e/fixtures/electron-isolation.ts`。"
  - "🔴🔴 只結束**隔離實例自己的** Terminal Server：pid 只能取自隔離實例 userData 下的 `bat-pty-server.pid`（或 spec 自己記錄的 pid），`taskkill /F /PID <pid>` 不加 `/T`（T0704 作法）。🔴 絕不讀、不用使用者 `%APPDATA%\\BetterAgentTerminal\\bat-pty-server.pid`，不結束任何不是 spec 自己啟動的程序 —— 使用者的塔台與 Worker 都跑在那個 Terminal Server 上。結束前先比對 pid 對應的程序命令列含隔離實例的路徑，比對不到就不結束、該項 BLOCKED。"
  - "🔴 情境（隔離實例，至少：Claude CLI 分頁（內嵌 claude）、Codex CLI 分頁（內嵌 codex）、一個純 shell 分頁）：① Claude CLI 分頁對模型說「記住數字 42，只回答 OK」（1 回合）→ 等 `claudeSessionId` 經 SessionStart hook 回報。② 只結束隔離實例的 Terminal Server → recovery。預期：recovery toast 含中斷數量；「被中斷的分頁」對話框列出 claude 與 codex 分頁、不列 shell；縮圖 ⏸；BAT 不自動 resume；Esc 關閉對話框不 resume。③ claude 分頁一鍵恢復 → 分頁命令以 `--resume=<同一個 session id>` 啟動（`=` 形式、無 `--fork-session`，BAT 的 `--mcp-config=` / `--settings=` / `--name=` 仍在）→ 問「剛才要你記住的數字？只回答數字」→ 回答 42（1 回合）。④ codex 分頁「開啟 resume 選單」→ 命令為原 BAT 參數後接 `resume`（無 session id、無 `--last`）→ 真的 codex 0.166 顯示它自己的 resume 選單（`CODEX_HOME` 用暫存目錄、不登入、不呼叫模型；選單為空或要求登入都照實記錄，重點是 codex 接受這組參數、沒有參數錯誤）。另跑 t0766、t0767、t0704 不回歸（同一驗收對象）。"
  - "🔴 真實模型（使用者 2026-11-02 同意，D215）：只用於 claude 分頁，`claude-haiku-5-5`（隔離實例 Settings / 工作區 `agentCustomArgs` 加 `--model claude-haiku-5-5`，不改產品程式碼；🔴 不得放 `--settings`）；🔴 不得使用 Opus / Fable / Sonnet。本單上限：合計 ≤ 4 個模型回合、估計費用 ≤ US$0.40（全批 US$1.00 的其餘），超過立即停止、回 PARTIAL。費用依 T0739 F1（累計值取最大）。codex 不跑真實模型。"
  - "🔴 登入與隔離：claude 用使用者現有登入；🔴 不得複製、讀出、記錄或印出任何認證檔或權杖內容（`.credentials.json`、API key、`batcap.`），不傾印整個 `process.env`；codex 用暫存 `CODEX_HOME`，不碰使用者 `~/.codex`。工作區 / 目錄名含 `t0773`，放 `%ProgramData%\\bat-e2e-t0773-*`，跑完刪除；本單在 `~/.claude/projects/` 產生、目錄名含 `bat-e2e-t0773` 的 session 目錄跑完可刪除（只刪這些）。不改產品程式碼；發現產品缺陷 → 〈發現的問題〉附重現步驟與證據，由塔台開 BUG。"
  - "🔴 驗證：真實模型 spec 預設 skip，跑 1 次（不連跑）；不回歸 spec 失敗時同一情境最多重跑 1 次並記錄（並行負載可能造成逾時）。`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 在 tsconfig 範圍外就註明）。docs：`terminal-server-recovery.md`「被中斷的 agent 分頁」驗證清單補一行（真的 claude / codex、本次結果）。回報附每回合模型、tokens、估計費用。不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）：回報與 spec 不得出現使用者家目錄路徑或帳號。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0773 — pre.4 自動化驗收（安裝版）：PLAN-055 中斷分頁恢復

## 元資料

- **工單編號**：T0773
- **類型**：implementation（驗收用 e2e，真實模型小額）
- **優先級**：P2
- **建立時間**：2026-11-02T05:08:42+0800
- **預估規模**：S

## 背景

`v0.7.3-pre.4` 已發佈。PLAN-055 B1 / B2 的 e2e（t0766 / t0767）用假的 claude / codex，只驗 BAT 送出的參數。真的 claude 能不能以 `--resume=<id>` 接回對話、真的 codex 0.166 接不接受 BAT 組出的 `resume` 參數，還沒驗過。手動驗收要結束使用者自己的 Terminal Server，會中斷塔台；改在隔離實例內做（D215），不影響使用者正在用的 BAT。

## 範圍

1. 情境 ①–④（見 frontmatter），新寫 spec。
2. 不回歸 t0766 / t0767 / t0704。
3. docs 一行。

## 不做

- 不結束使用者的 Terminal Server 或任何不是 spec 自己啟動的程序。
- 不用 Opus / Fable / Sonnet；不超過上限；codex 不跑真實模型。
- 不改產品程式碼、不 build、不改共用 fixture；不碰認證檔。

## 驗收

- [ ] 情境 ①–④ 逐項結果，每項寫明驗收對象（安裝版 / source build）
- [ ] 每回合模型、tokens、估計費用；合計在上限內
- [ ] t0766 / t0767 / t0704 綠、真實模型 spec 預設 skip、兩個 typecheck = 0
- [ ] 〈發現的問題〉與〈仍需手動〉

---

## 回報區
