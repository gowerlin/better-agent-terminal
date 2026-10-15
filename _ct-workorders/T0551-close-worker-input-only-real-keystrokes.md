---
schema_version: 1
schema_kind: workorder
id: T0551
title: "BUG-140：`--close-worker` 延遲 / 等安靜期間只把使用者真正鍵入（含貼上）算成輸入；焦點通知與終端查詢自動回覆不取消回收（本機 + 遠端 headless）"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-140
priority: P1
sizing: S
created_at: "2026-10-16T02:50:44+0800"
updated_at: "2026-10-16T02:50:44+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.5（與 T0552 同批）"
depends_on: []
related:
  - "BUG-140（觀察與推測根因）；PLAN-041 / D145 / T0545（延遲期間與等安靜期間的「使用者輸入」取消語意）；T0536（遠端 headless 以 client 連線的 `pty:write` 判定）"
  - "CLAUDE.md「Worker 分頁回收（PLAN-041 / T0535，D144；等安靜 T0545，D145）」節"
affects_files:
  - electron/handlers/pty.ts
  - electron/pty-manager.ts
  - electron/close-worker.ts
  - electron/remote/headless-entry.ts
  - "src/**（若改在 renderer 區分 xterm 輸入來源，例如終端元件的 onData 路徑；需列出實際檔案）"
  - "electron/__tests__/close-worker.test.ts 與新增測試"
  - "electron/remote/__tests__/headless-close-worker-e2e.test.ts（若需補遠端案例）"
  - "CLAUDE.md（「Worker 分頁回收」節的取消語意描述）"
  - _ct-workorders/T0551-close-worker-input-only-real-keystrokes.md
  - _ct-workorders/BUG-140-close-worker-cancelled-by-focus-not-typing.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 PLAN-041 介面契約（helper 參數、exit code、stdout）與 D145 的等安靜行為不變；只改「什麼算使用者輸入」。"
  - "🔴 T0552 可能在你之後才派，但兩張單 affects_files 不重疊；不要動 `electron/wsl-*.ts`、`electron/remote/ssh-*`、`src/components/setup-wizard/**`。"
---

# T0551 — BUG-140：Worker 回收只看真正的鍵入

## 背景

D145 / T0545 規定：`--close-worker` 排程後，延遲期間或等安靜期間只要有**使用者輸入**就取消回收（本機：`handlers/pty.ts` 對 `ctx.connectionId` 為空的 `pty:write` 呼叫 `noteUserInput`；遠端 headless：client 連線的 `pty:write`，`isUserInput` dep）。

T0550 收單時實測：延遲期間使用者只在 BAT 切換工作區 / 終端焦點、沒有在 Worker 分頁打字，到期仍記 `→ cancelled (user input during the delay)`，分頁沒有回收（細節見 BUG-140）。推測 xterm 的**自動回應**（claude CLI 開啟 focus reporting 時的 `ESC [ I` / `ESC [ O`，以及 DA / DSR 等查詢回覆）也走 `pty:write`，被當成使用者輸入。

## 任務

1. **先確認根因**：找出切換工作區 / 焦點時實際送進 Worker PTY 的寫入內容（例如在隔離實例以 node 腳本開啟 focus reporting 後切換焦點，記錄 `pty:write` 的資料）。若根因不是 focus report，照實際根因修，並在回報區說明。
2. **修正**：只有使用者鍵入（含貼上、IME 確認）才 `noteUserInput`。由你決定做法，回報區說明取捨：
   - renderer 區分 xterm `onData` 的來源（鍵盤 / 貼上 vs. 終端自動回應），把「是否為使用者輸入」帶到 IPC；或
   - main / headless 端排除純自動回應序列（`ESC [ I`、`ESC [ O`、`ESC [ <n> ; <n> R`、`ESC [ ? … c`、`ESC [ > … c` 等；只在整筆寫入**完全**由這些序列組成時排除，夾帶一般字元仍算輸入）。
   - 本機與遠端 headless 兩條路徑行為一致。寫入本身照常送進 PTY，只改「是否算輸入」。
3. **測試**：
   - 單元：延遲期間與等安靜期間送 focus in / out、DSR、DA 回覆 → 不取消；一般字元、Enter、貼上、夾帶一般字元的混合寫入 → 取消；helper（RemoteServer connectionId 有值）寫入仍不算。
   - 遠端：headless 路徑同樣排除（擴充既有 `headless-close-worker-e2e.test.ts` 或新增單元測試）。
   - 若可行，e2e（隔離實例）：Worker 分頁開 focus reporting → 排程回收 → 切換焦點 → 分頁仍被關閉。做不到就在回報區說明原因。
4. 更新 `CLAUDE.md`「Worker 分頁回收」節中「使用者輸入」的定義；BUG-140 狀態改 FIXED、填修正 commit。

## 驗收條件

- [ ] 根因有證據（實際寫入內容或可重現的測試）
- [ ] 焦點切換 / 終端自動回覆不再取消回收；真正鍵入仍取消（本機 + 遠端）
- [ ] `npm run test:unit` 全綠（基線 4073 passed / 243 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [ ] 既有 `e2e/t0535-close-worker.spec.ts` 仍通過
- [ ] CLAUDE.md 已更新；BUG-140 → FIXED

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
