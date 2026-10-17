---
schema_version: 1
schema_kind: workorder
id: T0580
title: "BUG-146 補完：Recovery 提示待決時，helper 派工（create-with-command / create-agent-command）與 pty:restart 也要等 create hold 放行"
type: bugfix
status: PENDING
repo: better-agent-terminal
project: BUG-146
priority: P2
sizing: S
created_at: "2026-10-17T20:16:57+0800"
target_version: "0.7.0-pre.1（與 T0575–T0579 同版，D151）"
depends_on: [T0578]
related:
  - "T0578 回報區「殘留風險 / 後續建議」1（同步 `create()` 呼叫者未涵蓋）與 3（CLAUDE.md 過時段落）"
  - "BUG-146、T0576（pending 權杖：Recovery 期間存活分頁的塔台仍可認證並派工）"
affects_files:
  - electron/terminal-command-handlers.ts
  - "electron/handlers/pty.ts（`pty:restart`）"
  - "electron/__tests__/**（新增 / 修改）"
  - "e2e/t0578-recovery-no-direct-shell.spec.ts（擴充一個 test，或新檔 e2e/t0580-*.spec.ts）"
  - "CLAUDE.md（「遠端 Tower 通知」節 T0576 的「時序（T0575 實測）」段落，以及「Recovery 提示期間的 `pty:create`」節）"
  - _ct-workorders/T0580-helper-dispatch-waits-recovery-hold.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；實測一律用隔離實例（需先 `npx vite build`）；teardown 以 pid 檔 + 命令列比對停掉隔離 Terminal Server、刪 runtime userData（T0575 / T0576 / T0578 皆遇過 `app.close()` 不返回）。"
  - "🔴 headless 不 hold（`whenCreatesReleased` 須立即 resolve），headless 行為與測試不得改變；沒有 hold 時兩條路徑的行為與回傳值須與修正前完全相同。"
---

# T0580 — helper 派工與 restart 等 create hold 放行

## 背景

T0578 讓 Recovery 提示待決時 `pty:create` 排隊（`PtyManager.holdCreates` / `whenCreatesReleased`），但同步呼叫 `ptyManager.create` 的路徑沒有涵蓋：`terminal:create-with-command`（`electron/terminal-command-handlers.ts` `createWithCommand`，約 423 行；agent 模式 `create-agent-command` 也經這裡）與 `pty:restart`（`electron/handlers/pty.ts` 約 119 行）。T0576 後，Recovery 期間存活分頁的塔台以還原的 pending 權杖就能認證派工 → 新 Worker 在 hold 中走 direct shell，放行後寫入卻送 server（server 不認得該 id）。目前只有 `[BUG-146] … spawns directly while creates are held (synchronous caller)` warn。

## 任務

1. `createWithCommand` 建立 PTY 前 `await ptyManager.whenCreatesReleased()`（在 cwd 檢核之後、`create` 之前；位置自行判斷，日誌記一行等待）；`pty:restart` 同理（handler 可回 Promise）。
2. 放行後：派工的新 id 應建在 Terminal Server 上（「保留」）或新 server 上（「重新開始」）；`reusedExisting` 判斷要在放行後重新計算。
3. 確認 T0578 的 synchronous-caller warn 在這兩條路徑不再出現；其他仍同步呼叫 `create` 的地方（若有）列在回報區。
4. CLAUDE.md：把「遠端 Tower 通知」節 T0576「時序（T0575 實測）」段落改為現況（T0578 後 Recovery 期間不再 direct spawn；pending 機制保留，涵蓋同步路徑），並在「Recovery 提示期間的 `pty:create`」節補上 helper 派工與 restart 也等放行。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. 單元測試：hold 中 `createWithCommand` / `pty:restart` 不 spawn，放行後建立；「保留」/「重新開始」兩種放行；沒有 hold 時行為不變；headless 不受影響。
3. e2e（隔離實例）：退出不停 Terminal Server → 重開 → Recovery 待決期間，在存活的塔台分頁內執行 `bat-terminal.mjs` 派工（raw command 即可）→ helper 在使用者回答前不完成（或完成但 Electron 主程序下無 direct shell）→ 選「保留」→ Worker 分頁的程序在 Terminal Server 樹下、輸入輸出正常。回歸 `t0578`、`t0576`。
4. 回報區附修正前 / 後對照。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
