---
schema_version: 1
schema_kind: workorder
id: T0984
title: "交付版 `v0.8.1-pre.6` 自動化驗收（A-28）：未信任資料夾「以塔台開啟 Claude」，信任對話框 Enter 後立刻按鍵，開工回合結束後待辦分頁回答立即送出；以 pre.5 對照"
type: verification
status: IN_PROGRESS
repo: better-agent-terminal
priority: P1
sizing: M
created_at: "2026-11-28T20:39:48+08:00"
updated_at: "2026-11-28T20:41:05+08:00"
started_at: "2026-11-28T20:41:05+08:00"
session_ids: []
target_version: "0.8.1-pre.6（已發佈）"
depends_on: []
related:
  - "A-28；T0978（啟動參數回合不套 2 s Enter 窗，回報區〈待實機〉的重跑步驟與預期日誌）；T0972 Q-2；T0970（交付版驗收 R2 / B3 實錄、`e2e/manual/ct610-driver.ts`、`ct-accept-act.mjs`）；T0983（F4，選用 S5）；D526"
affects_files:
  - _ct-workorders/T0984-v081-pre6-acceptance.md
  - e2e/manual/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0984` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式、不改 `e2e/fixtures/`；只可新增 / 擴充 `e2e/manual/` 的驅動，README 同步。"
  - "🔴 使用者已自己裝好 `v0.8.1-pre.6`（安裝版，`C:/Program Files/BetterAgentTerminal`）並在使用中（塔台就跑在裡面）：🔴 不得碰安裝版（不執行、不關閉、不改它的 userData、不連它的 Terminal Server / PTY holder），只用 zip 隔離實例。測試版放 `<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.6-win/` 與 `…/0.8.1-pre.5-win/`（目前都還沒有；照 T0969 / T0970 的方式從 GitHub Release 下載 zip 到 `_dl-<版號>/`、核對 SHA-256 後解壓：pre.6 `BetterAgentTerminal-0.8.1-pre.6-win.zip` `4c60af904b5dc933d9d61046e205e9628427b5a0fdf8fb60a316a72a1724ab5b`、pre.5 `BetterAgentTerminal-0.8.1-pre.5-win.zip` `d8e491851627ab3dc24801fab53878bccebace2e2ba5cb2fb08d066eb03c6377`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`）。解壓後核對 exe 存在與 `resources/package.json` 版號。"
  - "🔴 claude：沿用 T0969 / T0970 的 ACC 隔離設定（`CLAUDE_CONFIG_DIR=<使用者資料夾>/AppData/Local/ct620-accept/claude-config`，已登入；開工只檢查 `.credentials.json` 存在、不讀不複製；帳號檔不得讀取、複製或摘錄）。🔴 S1 要「未信任」的資料夾：每一輪用一個**新路徑**的測試專案副本（`ACC/runs-t0984/<情境>-<輪次>/`，claude 沒見過這個路徑 → 會跳「信任這個資料夾」對話框）；開跑前確認 ACC 的 claude 設定裡沒有這個路徑的信任紀錄。S2 用事先信任過的資料夾（先在同一個 `CLAUDE_CONFIG_DIR` 對它信任一次）。結果與證據放 `ACC/results-t0984/`（ACC 先前輪次的目錄只讀不動）。啟動與環境：同 T0970（`launchIsolated`＋`BAT_E2E_EXECUTABLE`、獨立 `--runtime=e2e-t0984-*`、`dropEnv` 移除 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`、工作區層級 `--dangerously-skip-permissions` 只限測試工作區）。"
  - "🔴 情境（pre.6 必跑；標「對照」的 pre.5 也跑，用來確認情境能分辨修正前後）：**S1（A-28，對照）** 未信任資料夾「以塔台開啟 Claude」→ 信任對話框出現 → 送 Enter（必要時先 ↓ 選信任，依 T0970 B3 實錄）→ Enter 後約 150 ms（< 2 s，且距 `user-prompt-submit` hook ≥ 300 ms）送一個會被判成草稿的鍵（F12 `\\x1b[24~`，以 `ct-accept-act.mjs input`）→ 等 `/control-tower` 回合結束、塔台宣告契約 2、`_tower-state.md` 有 `awaiting_user` U-1 → 從待辦分頁回答 `U-1：A`。pre.6 預期：日誌依序有 `[agent-command] id=<分頁> launch command ends with the launch prompt (launch-prompt turn pending)`、`[notify-hold] draft set … cause=…`、`draft cleared terminal=<分頁> (user-prompt-submit; not a contract-2 Tower yet; launch-prompt turn, Enter <ms> ms before not guarded)`，回答 `answer … (sending)` / `sent … reason=none`，沒有 `held … reason=draft`，塔台收到 `U-1：A`。pre.5 預期：`draft kept … Enter <ms> ms before` → 回答 `held … reason=draft`（記錄後按「立即送出」收尾）。時序若沒落在條件內（Enter 距 hook ≥ 2 s、或按鍵距 hook < 300 ms），該輪作廢、記錄實際毫秒數重跑。**S2（T0972 不回歸）** 已信任資料夾，啟動參數回合送出前（沒有信任對話框）按 F12 → 回合結束後回答 → pre.6 立即送出（`draft cleared …`），不需 pre.5 對照。**S3（真草稿仍保留，T0964 / T0978 不回歸）** S1 或 S2 的塔台回合結束後，在輸入框打 `abc` 不送出 → 回答 → `held`（保留原因「你在輸入」）；清掉輸入後回答送達且只送一次。**S4 日誌**：新增的日誌行不含按鍵內容、回答內容以外的使用者資料、權杖值。**S5（選用，不影響 A-28 判定，F4 / T0983 交付版煙霧測試）** 隔離實例開一個一般 PowerShell 分頁 → 在分頁裡 `exit` → 隔離實例的 Terminal Server 底下仍有該分頁的 conhost → 按 ✕ 關閉分頁 → 數秒內 conhost 結束；只數隔離實例 Terminal Server 的子程序，不碰其他程序。做不到就寫明原因。"
  - "🔴 模型配合與用量：同一項需要模型配合的狀態最多試 3 次，仍沒出現判「未觸發」，不得硬判 PASS。碰到用量上限：立即停止開新回合，已完成的照常寫結果，回 PARTIAL 並列出未跑項目。"
  - "🔴 結果：回報區總表（S1–S5 × pre.6 / pre.5：PASS / FAIL / 未觸發 / 對照未重現，附證據位置與實際毫秒數）、每項日誌摘要與截圖、A-28 是否可判完成的建議（A-28 的定義：未信任資料夾「以塔台開啟 Claude」，信任對話框按 Enter 後立刻按鍵，開工回合結束後從待辦分頁回答 → 立即送出、不進待送）。FAIL 不修產品程式，記證據、建議開 BUG。"
  - "🔴 驗證與 Git：改了 `e2e/manual/` 時 `node --check`（.mjs）；worktree `npm ci`、`npx vite build` exit 0、兩個 typecheck = 0。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。程序清理照 D308（隔離實例 `closeIsolated`、Terminal Server / PTY holder 不殘留）；使用者層 `~/.claude`、`~/.codex` 前後雜湊相同；安裝版 BAT 程序 pid 前後相同、未被碰。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。結果檔在 ACC（本機）可寫實際路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE` / `PARTIAL`（L177）。"
---

# T0984 — 交付版 `v0.8.1-pre.6` 自動化驗收（A-28）

## 背景

`v0.8.1-pre.6`（D526）含 T0978：以 `/control-tower` 啟動參數開的分頁，第一個 `user-prompt-submit` 不套 2 s Enter 保護窗，修掉「未信任資料夾的信任對話框 Enter 後 2 s 內按的鍵，讓開工回合結束後第一筆待辦分頁回答進待送」（T0972 Q-2 刻意保留的情況，T0970 B3 實錄）。T0978 沒有在打包版上重跑，留下 A-28。使用者已裝好 pre.6，要求派單自動驗收 A-28，比照 T0970 以交付版 zip 隔離實例驗收，pre.5 對照。

## 範圍

- S1–S4（見 frontmatter）：pre.6 全跑，S1 以 pre.5 對照；S5 選用。
- 可新增 / 擴充 `e2e/manual/` 驅動。

## 不做

- 不改產品程式；不碰安裝版 BAT；不發版。

## 驗收

- [ ] 前置（兩個測試版 SHA-256、exe 版號、ACC 已登入）
- [ ] S1–S4 結果總表與證據（S1 附實際毫秒數）；S1 pre.5 對照
- [ ] S5（或不做的原因）
- [ ] A-28 判定建議
- [ ] 使用者層無變更、安裝版 BAT 未被碰、程序清理
- [ ] 改了 `e2e/manual/` 時 build、兩個 typecheck、`node --check`

---

## 回報區

（Worker 填寫）
