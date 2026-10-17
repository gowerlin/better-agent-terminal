---
schema_version: 1
schema_kind: workorder
id: T0579
title: "PLAN-047：遠端 headless 的 tower 角色開放 raw command 派工（與本機 T0575 規則一致）"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-047
priority: P3
sizing: S
created_at: "2026-10-17T19:57:39+0800"
target_version: "0.7.0-pre.1（與 T0575 / T0576 / T0578 同版，D151）"
depends_on: [T0575]
related:
  - "T0575 回報區「任務 2：headless 是否同步開放 raw command」（評估與建議）"
  - "PLAN-036 K / T0450（headless 權杖限制：無 `shell`、`customEnv` 白名單、registry agent、8 子 PTY / 1 s、client 名額保留）"
  - "D149"
affects_files:
  - electron/remote/headless-entry.ts
  - electron/remote/helper-capability.ts
  - "electron/remote/__tests__/**（`helper-capability.test.ts`、`headless-*` 測試）"
  - "CLAUDE.md（「遠端 Tower 通知（PLAN-036 K）」節：角色表與「遠端 Tower 派單只能用 agent 模式」限制）"
  - _ct-workorders/T0579-headless-tower-raw-command.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與 WSL 上的 bat-server（port 9877）；驗證用單元測試與既有「真 headless + 真 node-pty」測試模式（`electron/remote/__tests__/headless-*-e2e.test.ts`）。"
  - "🔴 本單與 T0578 並行：T0578 改 `electron/main.ts`、`electron/pty-manager.ts` 與 CLAUDE.md 的 Terminal Server 相關節；本單不得改這兩個檔，CLAUDE.md 只改「遠端 Tower 通知」節（Edit 前重新 Read）。"
  - "🔴 不放寬 worker 角色；不放寬 headless 其他限制（`shell` 參數、`customEnv` 白名單、配額、client 名額保留）。"
---

# T0579 — headless tower 開放 raw command

## 背景

T0575 讓本機 tower 角色可用 `terminal:create-with-command`（`LOCAL_HELPER_CHANNEL_ROLES`，`electron/remote/helper-capability.ts:395`），限制同 `terminal:create-agent-command`；headless 角色表維持拒絕，CLAUDE.md 規定遠端 Tower 派單只能用 agent 模式。T0575 評估：tower 本來就能在自己的遠端 shell 執行任意命令，開放 raw command 額外能力有限，限制可直接沿用；好處是本機與遠端同一套 CT 指令。塔台決定同版開放。

## 任務

1. headless 改用與本機相同的角色表（或把兩表合併為一張、刪掉差異；命名自行判斷，保持本機行為不變）。
2. 確認 headless `terminal:create-with-command` 路徑的防護與 create-agent-command 一致：`shell` 參數拒絕（`rejectShell` / `validateShell`）、`customEnv` 白名單（`pickWhitelistedEnv`）、`BAT_TOWER_TERMINAL_ID` 只能是自己、新 id、8 子 PTY / 1 s、server 有 PTY 上限時保留 client 名額、`command` 必須是字串；有缺口就補，並在回報區列表對照。
3. CLAUDE.md「遠端 Tower 通知」節：角色表、限制條目改寫（刪除「遠端 Tower 派單只能用 agent 模式」或改述），`headless-parity` / `proxied-channels-binding` 若需更新一併處理。

## 驗收條件

1. `npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠（含 `headless-*`、`helper-capability`、`local-helper-capability`、`headless-parity`、`proxied-channels-binding`）。
2. 測試：headless tower 以權杖呼叫 raw command → 建立成功；帶 `shell` → 拒絕；非白名單 `customEnv` → 拒絕；與 create-agent-command 共用配額；worker 權杖 raw command → `Forbidden: role-not-allowed`。至少一個「真 headless + 真 node-pty、helper 在 PTY 內執行」的案例（擴充既有 `headless-remote-tower-e2e.test.ts` 或新檔）。
3. 回報區附任務 2 的防護對照表。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
