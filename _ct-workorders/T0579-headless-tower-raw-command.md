---
schema_version: 1
schema_kind: workorder
id: T0579
title: "PLAN-047：遠端 headless 的 tower 角色開放 raw command 派工（與本機 T0575 規則一致）"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-047
priority: P3
sizing: S
created_at: "2026-10-17T19:57:39+0800"
started_at: "2026-10-17T19:58:56+0800"
updated_at: "2026-10-17T20:11:38+0800"
completed_at: "2026-10-17T20:11:38+0800"
commit: 514710a9
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

### 結果摘要

DONE。本機與 headless 改用同一張角色表：`HELPER_CHANNEL_ROLES` 加入 `'terminal:create-with-command': ['tower']`，`LOCAL_HELPER_CHANNEL_ROLES` 改為同一個物件（`main.ts` 仍 import 這個名稱，本單不得改 `main.ts`，所以保留名稱、刪掉差異）。headless 的 `RemoteServer` 本來就用預設表，因此不需改接線；授權（`authorizeHelperInvoke`）、配額（`HELPER_CREATE_CHANNELS` → `HelperTowerSpawnQuota`）與 handler 的 `rejectShell` 早已對兩個建立 channel 共用，任務 2 檢查**沒有找到缺口**，未改防護邏輯。本機行為不變（`LOCAL_HELPER_CHANNEL_ROLES` 內容與 T0575 相同）。

- Commit：`514710a9` feat(T0579): allow raw command dispatch for headless towers（未 push）
- 落地檢查：PASS — C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 PASS；C-3 PASS（`affects_files` 皆存在）；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- 模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 任務 2：headless `terminal:create-with-command` 防護對照

| 防護 | create-agent-command | create-with-command（headless，T0579） | 實作位置 | 測試 |
|---|---|---|---|---|
| 角色：只有 tower | ✅ | ✅（worker → `role-not-allowed`） | `HELPER_CHANNEL_ROLES` | `helper-capability.test.ts`、`headless-helper-narrowing.test.ts`、e2e（Worker 以 raw command 派單） |
| 只能建**新** id（不是自己、不是執行中的 PTY） | ✅ | ✅ `target-not-bound` / `terminal-exists` | `authorizeHelperInvoke` 同一個 case | 同上（含既有 id 不會收到命令） |
| `shell` 參數拒絕 | ✅ `shell-not-allowed`；handler 另有 `rejectShell`（`validateShell: true`） | ✅ 同一處；handler `createWithCommand` 本身呼叫 `rejectShell` | `authorizeHelperInvoke`、`terminal-command-handlers.ts` `createWithCommand` | narrowing |
| `customEnv` 白名單（`BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE` / `MSYS_NO_PATHCONV`），值須為字串 | ✅ | ✅ `custom-env-not-allowed` / `invalid-custom-env` | `authorizeHelperInvoke`（`HELPER_CREATE_ENV_KEYS`）；`pickWhitelistedEnv` 只用於日誌，PTY 收到的 `customEnv` 已經過授權白名單 | unit + narrowing |
| `BAT_TOWER_TERMINAL_ID` 只能是自己 | ✅ | ✅ `tower-not-bound` | `authorizeHelperInvoke` | unit + narrowing |
| agent 須為 registry id | ✅ | ✅ `agent-not-allowed`（raw 模式的 helper 不帶 `agent`，帶了一樣檢查） | `authorizeHelperInvoke` + headless `isKnownAgent` | unit |
| `command` 必須是字串 | 不適用 | ✅ `invalid-payload`（缺省 / null 允許 = 只開 shell） | `authorizeHelperInvoke`（T0575） | unit + narrowing |
| 8 個存活子 PTY / 間隔 ≥ 1 s | ✅ | ✅ 與 agent 模式**共用**同一份配額 | `RemoteServer` 對 `HELPER_CREATE_CHANNELS` 呼叫 `HelperTowerSpawnQuota.reserve` | narrowing（agent → raw 1 s 內 `create-rate-limited`；混合 8 個後兩種都 `too-many-children`） |
| server 有 PTY 上限時保留 8 個 client 名額 | ✅ | ✅ `pty-quota-reserved` | 同上（headless `getPtyCapacity`） | narrowing（`maxPtys: 10`） |
| 新分頁拿到 worker 權杖、能回報 | ✅ | ✅ | `buildHeadlessHelperEnv`（依 `customEnv.BAT_TOWER_TERMINAL_ID`） | narrowing（`isWorkerOf`）、e2e（`bat-notify` → `terminal:notified`） |

不在權杖檢查內、與 agent 模式的差異（非防護缺口，已寫進 CLAUDE.md）：raw command 原樣打進遠端 login shell，`claude` 取遠端使用者 `PATH`（bundle 內嵌 claude 不在 `PATH`）；不經 `checkAgentAvailable`（`AGENT_UNAVAILABLE`）；helper 不帶 `workorder`，所以 `--close-worker` 找不到（同本機）。另：`agentName` 由呼叫端提供、只影響 client 分頁標題，本機 T0575 已同樣接受，未改。

### 修改檔案

- `electron/remote/helper-capability.ts`：角色表合併、註解更新
- `electron/remote/headless-entry.ts`、`electron/remote/remote-server.ts`：只改註解（`remote-server.ts` 不在 `affects_files`，但原註解寫「headless 預設表不含 raw command」會變成錯的，故一併修正）
- 測試：`electron/remote/__tests__/helper-capability.test.ts`（角色表 7 個 channel；raw command 授權：允許 / 10 種拒絕 / worker / fail closed）、`electron/__tests__/local-helper-capability.test.ts`（`LOCAL_HELPER_CHANNEL_ROLES` 即 `HELPER_CHANNEL_ROLES`；預設表允許 raw）、`electron/remote/__tests__/headless-helper-capability.test.ts`（從 FORBIDDEN 清單移除 create-with-command）、`electron/remote/__tests__/headless-helper-narrowing.test.ts`（新 describe，真 headless + 真 node-pty：建立並執行命令、`shell` / 白名單外 env / 別的塔台 / 非字串 command / 自己與既有 id 拒絕、worker 拒絕、共用配額、client 名額）、`electron/remote/__tests__/headless-remote-tower-e2e.test.ts`（helper 在 Tower PTY 內執行 raw command 派單 → `created-externally`、Worker 執行命令、Worker 權杖、`bat-notify` 回報；Worker 以 raw command 派單 → `role-not-allowed`；原「Tower 不能 raw command」斷言移除）
- `CLAUDE.md`「遠端 Tower 通知」節：角色表加 `terminal:create-with-command`、「其餘 channel」清單移除它並說明兩表共用、本機 PTY 的 raw command 條目、「遠端 Tower 派單只能用 agent 模式」改寫為兩種模式皆可（附差異）、驗證條目

`headless-parity.test.ts` / `proxied-channels-binding.test.ts`：不需更新（`create-with-command` 本來就是 client 可用的 proxied channel 且 headless 有註冊；兩者都通過）。

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | PASS（0 錯誤） |
| `npm run typecheck:electron` | PASS（0 錯誤） |
| `npm run test:unit` | PASS — 269 files / 4757 passed / 3 skipped |
| `npx vitest run headless- helper-capability local-helper-capability proxied-channels-binding` | PASS — 25 files / 428 tests（含 `headless-parity`、`headless-remote-tower-e2e`、`headless-helper-narrowing`） |

注意：全套測試執行時工作樹含 T0578 未 commit 的 `electron/main.ts` / `electron/pty-manager.ts` / `electron/handlers/pty.ts` 修改（並行工單），結果仍全綠；本單未動這些檔，commit 以 `--only` 排除。未碰使用者的 BAT（9876）與 WSL bat-server（9877）。

### 偏差 / 過程紀錄

- e2e 第一版讓 raw Worker 以 `bat-notify`（預設預填）回報，預填文字留在 Tower 提示列，導致後面 T0447 測試打進 Tower 的命令接在預填文字後而失敗；改用 `--no-pty-write`（只 toast）後 8/8 通過。最後一個測試開頭加 `sleep(1100)`，避開與 raw 派單之間的 1 s 建立間隔。
- 無 Renew、無互動。

### 後續建議

- 遠端 raw command 依賴遠端 `PATH` 上的 `claude`；若希望 `bat-terminal.mjs claude …` 在遠端也用 bundle 的 claude，可另開單評估在 headless PTY 的 `PATH` 加入內嵌 claude 的 bin（會影響使用者自己的 claude 優先序，需決策）。

## 塔台結案（2026-10-17T20:13:07+0800）

**DONE**（source / test 層）。塔台核對：`514710a9` 範圍與 affects_files 一致（`remote-server.ts` 只改註解，接受）；`CLAUDE.md` 的 diff 未夾帶並行 T0578 的未 commit 內容；塔台重跑 `headless- / helper-capability / local-helper-capability / proxied-channels-binding` 25 檔 / 428 passed（工作樹含 T0578 進行中變更；完整複驗待 T0578 收單後一併跑）。

後續建議「headless PTY 的 `PATH` 加入內嵌 claude」記入 PLAN-047 候選，不在 0.7.0-pre.1 範圍。

