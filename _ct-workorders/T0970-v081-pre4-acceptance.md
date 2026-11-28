---
schema_version: 1
schema_kind: workorder
id: T0970
title: "交付版 `v0.8.1-pre.4` 自動化驗收（A-26）：BUG-235 回答不再卡在待送、草稿在送出時清除、相同回答去重、「Worker 等你」不算回答；以 pre.3 對照"
type: verification
status: PENDING
repo: better-agent-terminal
priority: P1
sizing: M
created_at: "2026-11-28T15:14:41+0800"
updated_at: "2026-11-28T15:14:41+0800"
target_version: "0.8.1-pre.4（已發佈）"
depends_on: []
related:
  - "A-26；BUG-235 / T0964（`user-prompt-submit` 清草稿、`draft set … cause=` 診斷日誌、去重）；T0966（Worker 等你不算回答、保留原因）；BUG-236 已由 T0969 交付版驗收 CLOSED（本單不重驗）；前例 T0955 / T0959（交付版隔離實例）、T0969（ACC 隔離 claude、`e2e/manual/ct-accept-*.mjs`）"
affects_files:
  - _ct-workorders/T0970-v081-pre4-acceptance.md
  - e2e/manual/
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0970` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。🔴 不改產品程式、不改 `e2e/fixtures/`；只可新增 / 擴充 `e2e/manual/` 的驅動（例：`t0970-v081-pre4-acceptance.ts`），README 同步。"
  - "🔴 使用者已自己裝好 `v0.8.1-pre.4`（安裝版，`C:/Program Files/BetterAgentTerminal`）並在使用中：🔴 不得碰安裝版（不執行、不關閉、不改它的 userData），只用 zip 隔離實例。BAT 測試版：`<使用者資料夾>/AppData/Local/BAT-TestBuilds/0.8.1-pre.4-win/` 與 `…/0.8.1-pre.3-win/`（T0969 已解壓；開工核對 exe 存在與 `resources/package.json` 版號，不符或不存在就照 T0969 方式從 Release 下載：pre.4 zip SHA-256 `a475808e852bd1f08ad1203ada57fbefe2c1cab23efa5a5945d75a759b149f68`、pre.3 `992e9c78515c71cc841ee736e59498a5070264c5e6ce9b91fd1eacb1282b0aad`）。"
  - "🔴 claude：沿用 T0969 的 ACC 隔離設定（`CLAUDE_CONFIG_DIR=<使用者資料夾>/AppData/Local/ct620-accept/claude-config`，已登入；skills 是 CT 6.4.0-pre.1；開工只檢查 `.credentials.json` 存在、不讀不複製；帳號檔不得讀取、複製或摘錄）。BUG-235 的修正靠真 claude 的 `user-prompt-submit` hook，所以要真 claude；測試專案副本放 `ACC/runs-t0970/<情境>/`、結果與證據放 `ACC/results-t0970/`（ACC 先前輪次的目錄只讀不動）。啟動與環境：同 T0969（`launchIsolated`＋`BAT_E2E_EXECUTABLE`、獨立 `--runtime=e2e-t0970-*`、`dropEnv` 移除 `CLAUDECODE` / `CLAUDE_CODE_*` / `CT_*`、工作區層級 `--dangerously-skip-permissions` 只限測試工作區）。"
  - "🔴 情境（每項 pre.4 必跑；標「對照」的 pre.3 也跑，用來確認情境能分辨修正前後）：R1（BUG-235 基本）契約 2 塔台（「以塔台開啟 Claude」、`_tower-state.md` 有 `bat_contract: 2` 與 `awaiting_user` U-1）回合結束、閒置、沒有對話框 → 從待辦分頁回答 `U-1：A` → 預期立即送出（日誌 `answer … (sending)` / `sent … reason=none`，沒有 `held … reason=draft`），塔台收到 `U-1：A`。R2（BUG-235 修正路徑，對照）在 claude 啟動、`/control-tower` 啟動參數的回合送出**之前**按一個會被判成草稿的鍵（例 ↑ 或 Tab，以不改變 claude 輸入結果為準），等回合結束 → 待辦分頁回答 → pre.4 預期立即送出（日誌有 `draft set … cause=<類別>` 再被 `user-prompt-submit` 清掉），pre.3 預期 `held … reason=draft` 卡在待送（記錄、60 s 後按「立即送出」收尾）。若找不到能在 pre.3 重現的按鍵，寫明試過的鍵與日誌、判「對照未重現」，pre.4 的結果照實判定。R3（真草稿仍保留）在塔台輸入框打 `abc` 不送出 → 回答 → `held`（「已排入待送」＋保留原因「你在輸入」），再按一次同一個回答 → 待送仍 1 筆（日誌 `answer duplicate`）；清掉輸入（Ctrl+U 或刪除）後 Enter 不送出任何內容的做法依 claude 行為選，確認回答之後送達且只送一次。R4（T0966）R3 保留期間：「👷 Worker 等你」不列塔台分頁、待辦分頁標題數字不因這筆回答增加；縮圖「📨 待送 1」與「立即送出 / 取消」照舊。R5 日誌：`[notify-hold] draft set … cause=… bytes=…` 不含按鍵內容；整段日誌不含回答內容以外的使用者資料、不含權杖值。"
  - "🔴 模型配合與用量：同一項需要模型配合的狀態最多試 3 次，仍沒出現判「未觸發」，不得硬判 PASS。碰到用量上限：立即停止開新回合，已完成的照常寫結果，回 PARTIAL 並列出未跑項目。"
  - "🔴 結果：回報區總表（R1–R5 × pre.4 / pre.3：PASS / FAIL / 未觸發 / 對照未重現，附證據位置）、每項的日誌摘要與截圖、A-26 是否可判完成的建議（`A-26` 的定義：塔台閒置時從待辦分頁回答立即送出、不卡待送）。FAIL 不修產品程式，記證據、建議開 BUG。"
  - "🔴 驗證與 Git：改了 `e2e/manual/` 時 `node --check`（.mjs）；worktree `npm ci`、`npx vite build` exit 0、兩個 typecheck = 0。worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。程序清理照 D308（隔離實例 `closeIsolated`、Terminal Server 不殘留）；使用者層 `~/.claude`、`~/.codex` 前後雜湊相同；安裝版 BAT 程序 pid 前後相同、未被碰。"
  - "🔴 公開 repo（D176）：repo 內的腳本與回報區不寫真名、家目錄路徑（寫 `<使用者資料夾>`）。結果檔在 ACC（本機）可寫實際路徑。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE` / `PARTIAL`（L177）。"
---

# T0970 — 交付版 `v0.8.1-pre.4` 自動化驗收（A-26）

## 背景

`v0.8.1-pre.4`（D494）含 BUG-235（T0964：待辦分頁的回答在塔台閒置時被判成草稿、卡在待送）、BUG-236（T0965 / T0968，已由 T0969 交付版雙方驗收 CLOSED）、T0966（「Worker 等你」不算回答）。使用者已裝好 pre.4，要求派單自動驗收 A-26，比照 T0955 / T0959 以交付版隔離實例驗收。BUG-235 的實際觸發來源未確定，修正是「契約 2 claude 塔台收到 `user-prompt-submit` 時清掉送出前的草稿」，所以 R2 以「送出前按鍵」重現並以 pre.3 對照。

## 範圍

- R1–R5（見 frontmatter）：pre.4 全跑，R2 以 pre.3 對照。
- 可新增 `e2e/manual/` 驅動。

## 不做

- 不改產品程式；不碰安裝版 BAT；不重驗 BUG-236；不發版。

## 驗收

- [ ] 前置（兩個測試版 exe 版號、ACC 已登入）
- [ ] R1–R5 結果總表與證據；R2 pre.3 對照
- [ ] A-26 判定建議
- [ ] 使用者層無變更、安裝版 BAT 未被碰、程序清理
- [ ] 改了 `e2e/manual/` 時 build、兩個 typecheck、`node --check`

---

## 回報區

（Worker 填寫）
