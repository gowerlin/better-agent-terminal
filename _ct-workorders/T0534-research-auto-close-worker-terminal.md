---
schema_version: 1
schema_kind: workorder
id: T0534
title: "研究：塔台收單完成後自動關閉 Worker 工單終端，BAT 需要改什麼、CT local_rule 能做到哪裡，並提出方案與推薦"
type: research
status: TODO
repo: better-agent-terminal
project: TOWER-UX
priority: P3
sizing: S
created_at: "2026-10-15T15:15:21+0800"
updated_at: "2026-10-15T15:15:21+0800"
target_version: "0.6.1-pre.3"
depends_on: []
related:
  - "T0523 / BUG-129（派工落點：--notify-id 塔台終端所屬工作區）"
  - "T0525 / BUG-131（PtyManager 記 customEnv / agentPreset，buildPtyEnv 唯一組裝點）"
  - "T0432 / T0450（headless 範圍權杖：tower 角色只允許 terminal:create-agent-command）"
  - "T0504（detached 視窗關窗 flush）"
affects_files:
  - _ct-workorders/T0534-research-auto-close-worker-terminal.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **純研究，不改任何 tracked 檔**（除本工單）。不寫程式、不開 PLAN、不改 `_local-rules.md` 與 `~/.claude/skills/**`。"
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData）。不要對真實 BAT 呼叫 `pty:kill` 或任何會關閉分頁的動作。需要實機觀察時一律隔離實例（`--runtime=<N>`），不消耗 token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
---

# T0534 — 研究：收單後自動關閉 Worker 終端

## 背景

使用者問：塔台在「收單完成」後，能不能自動關掉 Worker 的工單終端？在 BAT 環境下要改 BAT，還是擴充 CT local_rule 就夠？

塔台初步判讀（**待本單驗證，不得直接當結論引用**）：

- 關分頁只存在於 renderer：`src/components/WorkspaceView.tsx` `handleCloseTerminal` / `handleConfirmClose`（停程序 → 視需要清 worktree → `workspaceStore.removeTerminal` → `save()`）。主行程與 helper 沒有入口。
- `pty:kill` 存在、本機 helper 持全權 server token 可呼叫，但只殺程序，分頁留著顯示 `[Process exited with code …]`（`TerminalPanel.tsx` `onExit`），重開 BAT 可能還原。
- 遠端 headless tower 權杖只允許 `terminal:create-agent-command`。
- 初步結論：要乾淨關分頁需改 BAT（新 IPC + renderer 關閉路徑 + helper 參數 + 遠端權杖），local_rule 只負責「何時呼叫」。

## 任務

1. **現況盤點（附 `檔案:行號`）**
   - 使用者按 ✕ 關閉分頁的完整路徑：renderer 呼叫了哪些 IPC、Claude 整合分頁（`stopSession`）與 PTY 分頁的差異、worktree 清理、registry 持久化、detached 視窗的情形。
   - 只呼叫 `pty:kill` 時實際發生什麼：分頁狀態、`save()` 後 registry 是否仍有該終端、重開 BAT 是否還原、Terminal Server 端是否清乾淨。只能用程式碼推論或隔離實例驗證。
   - Worker 分頁身分：主行程 / PtyManager 能否可靠判定「某分頁是某塔台派出的 Worker」（`customEnv.BAT_TOWER_TERMINAL_ID`、headless registry 的子 PTY 追蹤），pty:restart / Terminal Server recovery 後是否仍保留。
   - 塔台如何得知 Worker terminal id：`bat-terminal.mjs` 輸出、`bat-notify` 的 source、工單欄位；有無現成記錄。
   - 遠端 headless：tower / worker 權杖目前允許的 channel，要加關閉能力需動哪裡、範圍怎麼限。
2. **CT 側盤點**：`~/.claude/skills/control-tower`、`ct-done`、`ct-exec`（唯讀）中「收單完成」的定義與觸發點；local_rule（Layer 3）能掛在哪個時點；Codex 版塔台是否同一套流程。
3. **方案比較（至少 3 個，含代價與風險）**，至少涵蓋：
   - A：只改 local_rule（不改 BAT），用現有能力能做到的最大程度（例如 `pty:kill`、Worker 自行結束），以及做不到的部分。
   - B：BAT 新增「關閉 Worker 分頁」能力（IPC + renderer + helper 參數 + 遠端權杖），local_rule 呼叫。
   - C：BAT 自己處理，不靠塔台呼叫（例如 Worker `bat-notify` 回報完成後自動關閉 / 設定選項），或其他你認為更好的做法。
   - 每個方案都要說明：本機 / 遠端 / detached 視窗是否適用；誤關（關到使用者自己的分頁、Worker 還在跑）的防護；Worker 畫面輸出遺失問題（延遲關閉、保留輸出、設定開關）；對既有功能的退化風險（No Regressions）。
4. **推薦一個方案**，列出實作工單拆分建議（BAT 端 / CT 端各需改哪些檔、驗收方式、預估 sizing）。

## 驗收條件

- [ ] 現況盤點每一點都有 `檔案:行號` 或隔離實例的實測證據
- [ ] 塔台初步判讀逐點標「成立 / 不成立 / 部分成立」
- [ ] 至少 3 個方案的比較表 + 推薦 + 工單拆分
- [ ] 未改動任何 tracked 檔（本工單除外）

## 回報區

（Worker 填寫）
