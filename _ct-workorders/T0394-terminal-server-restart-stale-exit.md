---
schema_version: 1
schema_kind: workorder
id: T0394
title: "BUG-101 修復：Terminal Server 模式 restart 後舊 PTY 的遲到 exit 不得刪除 / 廣播同 id 的新 PTY"
type: implementation
status: TODO
priority: P1
sizing: S
created_at: "2026-10-05T00:50:08+08:00"
updated_at: "2026-10-05T00:50:08+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "BUG-101（修復對象）"
  - "T0390（direct 模式同類修正 `handleDirectExit`，`f2b68ce`；回報區「偏差 / 風險 / 後續」第 1 點含重現方式）"
affects_files:
  - electron/terminal-server/server.ts
  - electron/pty-manager.ts
  - electron/terminal-server/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。比對 baseline 用 `git show HEAD:<path>` 或 `git worktree add`（junction 共用 `node_modules` 時，移除前先只拆 junction）。"
  - "🔴 T0393 平行執行中（改 `electron/main.ts` / `SettingsPanel.tsx` / `App.tsx` 等）；本單不改 `electron/main.ts`。若修復必須改 `main.ts`，停下回報 PARTIAL。"
  - "🔴 smoke 用獨立 `--runtime=<scratch>`、剝除 `BAT_*` env；結束後只 kill 本次 smoke 產生的 Terminal Server（比對 `dist-electron\\terminal-server.js` 路徑與 PID），**不得**動使用者安裝版 BAT 或其 Terminal Server。"
  - "⚠️ No Regressions：本機一般終端的 create / write / resize / kill / 跨 BAT 重啟的 Terminal Server 接回（T0111 / T0113 registry）行為不得改變。不 push。"
---

# T0394 — Terminal Server restart 遲到 exit

## 背景（BUG-101）

本機終端預設走 Terminal Server。`restart()` = kill + 同 id create，但：

- `electron/terminal-server/server.ts` 舊 PTY 的 `ptyProcess.onExit` 無條件 `this.ptys.delete(req.id)`、`removePtyEntry(req.id, …)`、廣播 `pty:exit` ⇒ 把 server 上**新** PTY 的 entry 刪掉，registry 也被清
- main 端 `PtyManager.handlePtyExit`（`electron/pty-manager.ts:336`）收到該 exit 也刪掉新 instance ⇒ 之後 write 回 `pty-not-found`，renderer 印 `[Process exited]`

T0390 已在 direct 模式以 `handleDirectExit(id, proc, code)`（entry 已屬於較新行程 → 不刪、不廣播）修正同類問題，本單比照處理 Terminal Server 模式。

## 範圍

1. `terminal-server/server.ts`：onExit 時只有 `this.ptys.get(req.id)` 仍是**同一個** ptyProcess 才 delete / `removePtyEntry` / 廣播 `pty:exit`；否則 log「stale exit ignored」
2. `pty-manager.ts` `handlePtyExit`：Terminal Server 模式下若 exit 對應的已是被取代的舊行程（例如以 server 回報的 pid / generation 判斷，或 restart 期間的標記），不刪新 instance、不轉發 `pty:exit` 給 renderer。判斷依據由 Worker 選定並寫理由（server 端修正後 main 端理論上不會再收到舊 exit，main 端防護屬縱深防禦；若 Worker 判定不需要，回報區說明）
3. 測試：server 端 restart 情境（舊 exit 晚到）不刪新 entry、不廣播；main 端同等情境

## 驗收

- unit：上述情境 + 正常 kill 仍會 delete / 廣播 `pty:exit`；負向驗證（拿掉防護後測試紅）
- `npm run test:unit` 全綠（基線 **1051**；T0393 若先 commit 以 HEAD 為準）；`npx vite build` exit 0；`npx tsc --noEmit` ≤ **40**
- **本機 smoke**（沿用 T0390 的 Playwright `_electron` 做法）：Terminal Server 模式本機終端 `restart` 後 `getCwd` 有值、輸入有輸出、無 `pty:exit`；`kill` 仍收到 `pty:exit`
- **runtime 驗收（交使用者，下一版 build）**：本機終端按「重新啟動」後出現新 prompt、可輸入。⚠️ Terminal Server 跨 BAT 重啟存活，驗收前需讓舊 server 行程結束（回報區寫出做法）

## Sub-session 執行指示

1. 讀取本工單 + BUG-101 + T0390 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**；BUG 狀態由塔台更新
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
