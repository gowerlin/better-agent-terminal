---
schema_version: 1
schema_kind: workorder
id: T0578
title: "BUG-146：Recovery 提示回答前不得以 direct node-pty 另起同 id 的 shell"
type: bugfix
status: PENDING
repo: better-agent-terminal
project: BUG-146
priority: P2
sizing: M
created_at: "2026-10-17T19:57:39+0800"
target_version: "0.7.0-pre.1（與 T0575 / T0576 / T0579 同版，D151）"
depends_on: []
related:
  - "BUG-146（現象與 T0576 隔離實例日誌）"
  - "T0576 回報區「塔台補充 1」（pending 權杖 + settle）、「後續建議 1」"
  - "T0108 / T0110（Terminal Server replay / Recovery）、T0572（`requestPtySizeSync`、`created` 回傳語意）"
affects_files:
  - electron/main.ts
  - electron/pty-manager.ts
  - "electron/handlers/pty.ts（若需要）"
  - "src/lib/pty-replay.ts（若需要）"
  - "electron/__tests__/**（新增 / 修改）"
  - "e2e/t0578-recovery-no-direct-shell.spec.ts（新增）"
  - "CLAUDE.md（「關閉分頁時的程序樹」或 Terminal Server 相關節，補 BUG-146 規則）"
  - _ct-workorders/T0578-recovery-pending-no-direct-shell.md
  - _ct-workorders/BUG-146-recovery-prompt-pending-spawns-direct-shell.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；實測一律用隔離實例（需先 `npx vite build`）。隔離實例「不停 Terminal Server」時 `app.close()` 可能不返回（T0575 / T0576 實測），teardown 必須以 pid 檔 + 命令列比對停掉隔離 Terminal Server、刪 runtime userData。"
  - "🔴 本單與 T0579 並行：T0579 改 `electron/remote/headless-entry.ts`、`electron/remote/helper-capability.ts` 與 CLAUDE.md「遠端 Tower 通知」節；本單不得改這兩個檔，CLAUDE.md 只改自己的節（Edit 前重新 Read）。"
  - "🔴 不得破壞 T0576 的 pending 權杖 + `settleRestored` 行為與其測試（`helper-capability-persist.test.ts`、`e2e/t0576-*`）；修好後若 pending 機制有部分變得不必要，**不要移除**，在回報區說明交塔台決定。"
---

# T0578 — BUG-146：Recovery 提示期間不另起 direct shell

## 背景

見 BUG-146。Windows Terminal Server 模式，退出時不停止 Terminal Server，重開 BAT：使用者回答 Recovery 提示（`electron/main.ts` 約 3744–3751 `[terminal-server] user chose recovery`）之前，renderer 還原分頁送出 `pty:create`；PtyManager 尚未連上 Terminal Server，走 direct node-pty 在同 id 另起本機 shell。選「保留」後輸入改送 server PTY，但 direct shell 程序仍在，輸出也進同 id。

## 任務

1. 先以隔離實例重現並記錄（程序清單 / 日誌）：Recovery 待決時有幾個 shell 程序、選「保留」後是否殘留、輸出是否重複。
2. 修正，兩條候選（自行評估後擇一或組合，回報區說明理由）：
   - (a) Recovery 待決時 `pty:create` 不立即 spawn：排隊到使用者回答後，「保留」→ 對 replay 清單中已存在的 id 直接接回（不 spawn），其餘再建；「重新開始」/ 失敗 → 照常建立。
   - (b) 照舊 spawn，但選「保留」後對 replay 清單中已存在的 id 收掉 direct 實例（含程序樹，比照 T0540 kill 規則），且其輸出不得已進入分頁。
   - 必須保持：`pty:create` 回傳 `created` 的語意（T0572 `requestPtySizeSync`、是否重送 agent 啟動命令）在「保留」時對已存在的 PTY 為 `created: false`、新建者為 `true`；direct 模式、非 Windows、沒有存活 Terminal Server 的啟動路徑行為不變。
3. 與 T0576 的 settle 對照：修正後「保留」路徑還會不會替存活 id 新簽權杖；把結果寫進回報區（不移除 pending 機制，見 memory_overrides）。
4. CLAUDE.md 補一條規則（Terminal Server / Recovery 相關節）與驗證檔案清單。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. 單元測試：Recovery 待決時的 `pty:create` 不 spawn direct（或保留後已收掉）；保留 / 重新開始兩條路徑的 `created` 值；direct 模式不變。
3. e2e `e2e/t0578-recovery-no-direct-shell.spec.ts`（隔離實例）：退出不停 Terminal Server → 重開 → Recovery 待決期間該 id 無 direct shell 程序（或選保留後 ≤ N 秒內已結束，依所選方案）→ 選保留 → 分頁輸入 / 輸出只來自 server PTY（不重複）；另一 test 選「重新開始」→ 分頁得到新 shell。
4. 回歸：`e2e/t0576-capability-persist-restart.spec.ts`、`e2e/t0572-new-pty-initial-size.spec.ts`、`e2e/t0537-worker-ownership-persistence.spec.ts` 通過。
5. BUG-146 狀態改 FIXED（frontmatter `status` / `fixed_at` / `fixed_by` / `fix_commit` 與表格），回報區附修正前 / 後對照。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
