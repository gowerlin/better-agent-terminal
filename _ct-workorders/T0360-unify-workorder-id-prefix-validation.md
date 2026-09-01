---
schema_version: 1
schema_kind: workorder
id: T0360
title: "BUG-082: 統一工單 ID 前綴驗證 + --workspace 缺漏提示 + 未知 workspaceId 行為調查"
type: fix
status: IN_PROGRESS
priority: P1
sizing: M
created_at: "2026-09-01T22:42:56+08:00"
updated_at: "2026-09-01T22:45:17+08:00"
started_at: "2026-09-01T22:45:17+08:00"
source_advisory: "BMad-Guide 塔台跨塔台 ADVISORY 2026-09-01（項目 [1] 接受 / [3] B-2 接受 / [4] 調查 / [2] B-1 暫緩）"
target_version: v0.4.3
depends_on: []
related:
  - BUG-082
  - T0359
  - T0137
  - BUG-031
affects_files:
  - scripts/bat-terminal.mjs
  - electron/main.ts
  - src/types/control-tower.ts
  - src/types/__tests__/control-tower.test.ts
  - src/utils/control-tower-launch.ts
  - tests/ (helper-level .mjs test，新增)
  - CHANGELOG.md
interaction:
  mode_hint: ask
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "禁止實作 B-1（漏帶 --workspace 時改讀 BAT_WORKSPACE_ID）。塔台已裁決暫緩，綁定 Part C 調查結論。只做 Part C 的調查與回報，不改 workspace 解析預設行為。"
  - "本工單同時涉及 helper(.mjs) / main process / renderer 三層，任一層漏改都會讓修復在下一層失敗。改完務必逐層對照 BUG-082 的四處表格。"
---

# T0360 — 統一工單 ID 前綴驗證（BUG-082）

- **狀態**：IN_PROGRESS
- **任務類型**：fix + 調查
- **工作量預估**：M
- **目標版本**：v0.4.3
- **Context Window 風險**：中（跨三層 + 一項調查）

## 背景

BMad-Guide 塔台 2026-09-01 回報：CT 規範跨專案工單**強制**帶前綴（`CP-T0113`），但 BAT 的 `--workorder` 只收 `T\d+`，導致整個 CT 生態的跨專案工單無法用結構化模式派工。

塔台讀碼驗證後確認問題比回報更大：**BAT 內部四個元件對工單 ID 格式有四種答案**（完整表格見 BUG-082）。詳細現象、根因、三個可觀察症狀請先讀 `BUG-082-workorder-id-prefix-rejected-by-structured-dispatch.md`。

## 範圍

### Part A — 統一 ID 前綴驗證（核心）

目標規則：**`^(?:[A-Z]{2,4}-)?T\d+$`**（對齊 CT「2–4 字元大寫英文前綴」規範）。

必改四處，**缺一不可**：

| # | 檔案 | 現況 | 要求 |
|---|------|------|------|
| A1 | `scripts/bat-terminal.mjs:224` | `/^T\d+$/` | 放寬；錯誤訊息同步更新（現為 `expected T followed by digits`） |
| A2 | `electron/main.ts:540` `buildControlTowerSkillPrompt` | `/^T\d+$/` | 放寬。**只改 A1 會讓失敗往後推一層**，變成 `[agent-command] invalid prompt payload` warn + 建立失敗 |
| A3 | `src/types/control-tower.ts` `filenameToId`(188) / `filenameToTitle`(195) / `isWorkOrderFile`(204) | 硬編碼 `(?:CP-)?` | 泛化為 `(?:[A-Z]{2,4}-)?`。修好後熱區既有 `CT-T001-delegate-bat-routing-skill-update.md` 應被面板認出 |
| A4 | `src/utils/control-tower-launch.ts:49` | 無驗證（因此本來就通） | 不得因本次改動產生 regression；是否補一致性 guard 由 Worker 判斷並在報告說明 |

建議把規則抽成單一共享常數/helper，避免第五處再度分歧——但 `.mjs` helper 與 renderer 之間無共用模組路徑時，允許各自宣告 + 註解互相指認（請在報告說明選擇理由）。

### Part B — `--workspace` 缺漏提示（ADVISORY B-2）

`scripts/bat-terminal.mjs`：未帶 `--workspace` 時輸出 stderr 提示，**不改變任何行為**。採用回報方建議文案（同時指出解法）：

```
[bat-terminal] --workspace not specified; PTY will land in the currently ACTIVE workspace.
               Callers dispatching for a specific project should pass
               --workspace "$BAT_WORKSPACE_ID".
```

理由：本次事件中出錯的塔台是「不知道有這個參數」，只描述現象對不知情的呼叫端無從行動。

### Part C — 未知 workspaceId 的 renderer 行為（調查，不改行為）

**只調查、只回報，不修改預設解析行為。**

問題：renderer 收到「指定了一個不存在／已關閉的 `workspaceId`」時行為是否安全？

- 這同時影響**現行的顯式 `--workspace` 路徑**，不只是假想情境
- 入口線索：`bat-terminal.mjs:631-632`（`if (workspaceId) invokePayload.workspaceId = workspaceId`）→ RemoteServer → renderer 分頁配置
- 需回答：(1) PTY 會落到哪？(2) 會不會變成孤兒 / 不可見分頁？(3) 有無錯誤或 fallback？

報告請給明確結論，塔台據此決定 ADVISORY 的 B-1 是否另開工單。

## 明確排除

- ❌ **不實作 B-1**（漏帶 `--workspace` 時改讀 `BAT_WORKSPACE_ID`）— 塔台裁決暫緩，等 Part C 結論
- ❌ 不改 workspace 的既有 fallback 語意（T0137/BUG-031 的設計行為）
- ❌ 不改 `--skill` 的 `ct-exec|ct-done` 白名單
- ❌ 不動 BUG/PLAN 單據的 ID 規則（本次只處理工單 T####）
- ❌ 不做 BAT 換版 / release（塔台另行決定）

## 驗收條件

| # | Gate | 判準 |
|---|------|------|
| G1 | 前綴接受 | `CP-T0113` / `CP-T1148` / `CT-T001` 皆通過 A1+A2 驗證 |
| G2 | 仍拒非法值 | `T` / `X-T1` / `TOOLONG-T1` / `cp-t1` / `CP-T` / 空值 仍被拒 |
| G3 | 面板辨識 | `CT-T001-delegate-bat-routing-skill-update.md` 被 `isWorkOrderFile` 認出，`filenameToId` 回 `CT-T001` |
| G4 | 單元測試 | `npm run test:unit` 全綠（基線 483/483，新增 case 後應 > 483） |
| G5 | Helper 測試 | 新增 helper 層測試（參考既有 `tests/bat-notify-submit.test.mjs` 形式）涵蓋 G1/G2 |
| G6 | 編譯 | `npm run compile` PASS（無 TS error） |
| G7 | B-2 提示 | 未帶 `--workspace` 時 stderr 出現提示；**帶了則不出現**；exit code 不變 |
| G8 | Part C 結論 | 報告中明確回答上述三問，附程式碼位置佐證 |

> **runtime 派工 smoke 不在本工單 gate 內** —— 實際 spawn 終端派發 `CP-T####` 的驗收由塔台／使用者執行。Worker 請勿為了驗證而真的派出工單終端。

## 回報區

### Landing Zone Check

| Check | 結果 | 說明 |
|-------|------|------|
| C-0 repo identity | ⚠️ WARN | frontmatter 無 `repo` 欄位（`absent`）；實測 `basename(REPO_ROOT)` = `better-agent-terminal`。依規則 fallback 到 C-3 + C-1 判定 |
| C-1 工單路徑 | ✅ PASS | 工單位於 `REPO_ROOT/_ct-workorders/` |
| C-3 affects_files | ✅ PASS | 5 個 testable entry 全部 present（`tests/` 與 `CHANGELOG.md` 分別為目錄型/新增型，已排除） |
| C-2 branch | ℹ️ n/a | frontmatter / body 皆無 `branch` 欄位；實際在 `main` |

- `REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`
- `BAT_WORKSPACE_ID` = `2eda2f34-9f69-4704-895e-494d9ec0054b`（evidence only）
- `CT_MODE=on` / `CT_INTERACTIVE=0`

### 結果摘要

Part A / B 已落地，Part C 已完成調查（未改任何行為）。四處 ID 規則統一為 `^(?:[A-Z]{2,4}-)?T\d+$`。

### 變更檔案

| 檔案 | 變更 |
|------|------|
| `scripts/bat-terminal.mjs` | A1：新增 `WORKORDER_ID_PATTERN` 常數（附三處 sibling 互相指認註解）；`--workorder` 改用該常數；錯誤訊息更新為 `(expected T followed by digits, with an optional 2-4 char uppercase prefix, e.g. T0001 or CP-T0113)`；help text 補前綴說明。B：`--workspace` 缺漏時輸出三行 stderr 提示 |
| `electron/main.ts` | A2：新增同名 `WORKORDER_ID_PATTERN` 常數 + sibling 註解；`buildControlTowerSkillPrompt` 改用該常數 |
| `src/types/control-tower.ts` | A3：新增 `WORKORDER_ID_PREFIX = '(?:[A-Z]{2,4}-)?'`（module-private）與 **export** 的 `WORKORDER_ID_PATTERN`；`filenameToId` / `filenameToTitle` / `isWorkOrderFile` 三者改由該前綴組出 regex |
| `src/utils/control-tower-launch.ts` | A4：**不加 guard**，改補 doc comment 說明理由與未來擴充路徑（見下） |
| `src/types/__tests__/control-tower.test.ts` | 新增 `T0360/BUG-082` describe（6 個 case，涵蓋 G1/G2/G3 + 不誤收 BUG/PLAN/EXP/系統檔） |
| `tests/bat-terminal-workorder-id.test.mjs` | **新增**，helper 層測試（17 case，涵蓋 G1/G2/G7 + 結構化 payload 端到端） |
| `vite.config.ts` | 把新 helper 測試登記進 `test.include`（該清單為逐檔白名單，不登記不會被跑到） |
| `CHANGELOG.md` | `[Unreleased]` 補 Fixed + Changed 各一條 |

### 設計決策

**1. 為什麼是「各自宣告 + 互相指認註解」而非共享模組**

`scripts/bat-terminal.mjs` 是零外部相依、由 electron-builder 以 `extraResources` 單獨打包的 helper，
與 renderer bundle（`src/`）、main bundle（`electron/`）之間**沒有共用模組路徑**——引入一個會讓
`verify-helper-bundle.js` 的 relative `.mjs` import 掃描面擴大，且 helper 端 import TS 檔不可行。
故採工單允許的第二方案：三處各自宣告，每處註解**列出其餘三處的檔案 + 符號名**，讓「第五處分歧」
在 code review 時可見。`src/types/control-tower.ts` 的 `WORKORDER_ID_PATTERN` 已 export，
renderer 內部若需第四份可直接 import 而非再抄。

**2. A4 為什麼不補 guard**

`buildControlTowerWorkOrderCommand()` 目前回傳 `string`，四個呼叫點（`src/App.tsx:795,815`、
`src/components/WorkspaceView.tsx:603,624`）都直接把回傳值當字串用。加 guard 必須改成
`string | null` 或 throw，波及四個呼叫點的 UI 錯誤路徑——**純 regression 風險、零新防護**：
該函式的 `workOrderId` 全部來自 `filenameToId()`，而 `filenameToId()` 只在通過 `isWorkOrderFile()`
的檔名上呼叫，已受同一份文法約束。已在原始碼補 doc comment 記錄此判斷，並註明「若日後改為接受
使用者自由輸入的 ID，請 import 已 export 的 `WORKORDER_ID_PATTERN`，不要再抄一份 regex」。

**3. 範圍外但已確認的第五處**

`scripts/migrate-ct-frontmatter.mjs:36,256` 也有 ID regex（`(CT-T\d+)` 與
`(T\d+|BUG-\d+|PLAN-\d+|EXP-[A-Z0-9]+-\d+|CT-T\d+)`）。不在 `affects_files` 內，且該檔是一次性
migration script（非派工路徑），已涵蓋 `CT-`，但不收 `CP-` 以外其他前綴。**未修改**，僅記錄供塔台判斷是否另開單。

### 驗收證據

| Gate | 結果 | 證據 |
|------|------|------|
| G1 前綴接受 | ✅ PASS | helper 層：`CP-T0113` / `CP-T1148` / `CT-T001` / `KEEN-T0002` / `T0001` / `T1` 皆通過 A1（`it.each` 6 case，stderr 無 `Invalid --workorder value`）。A2 使用同一份 regex，unit test 另以 export 的 `WORKORDER_ID_PATTERN` 直接驗證 |
| G2 仍拒非法值 | ✅ PASS | `T` / `X-T1` / `TOOLONG-T1` / `cp-t1` / `CP-T` / `T0001-extra` / `BUG-001` 全部 exit 1 + `Invalid --workorder value: '<id>'`；空值走 `--workorder requires a work order ID argument` |
| G3 面板辨識 | ✅ PASS | `isWorkOrderFile('CT-T001-delegate-bat-routing-skill-update.md') === true`；`parseWorkOrder(...).id === 'CT-T001'`、`.title === 'delegate bat routing skill update'`。另加反向 guard：`BUG-082-*` / `PLAN-031-*` / `EXP-BUG012-001-*` / `_tower-state.md` / `.yaml` 仍為 `false` |
| G4 單元測試 | ✅ PASS | `npm run test:unit` → **40 files / 507 tests passed**（基線 483，+24） |
| G5 Helper 測試 | ✅ PASS | 新增 `tests/bat-terminal-workorder-id.test.mjs`（17 case）；沿用 `bat-notify-submit.test.mjs` / `bat-terminal-msys.test.mjs` 的 mock TLS + WebSocket RemoteServer 形式，含 `CP-T0113` 端到端斷言：`payload.skill === 'ct-exec'` / `payload.workorder === 'CP-T0113'` / `payload.workspaceId === 'ws-uuid-1'` / exit 0 |
| G6 編譯 | ✅ PASS | `npm run compile` 全數 built（vite 7.3.2，main / preload / renderer / terminal-server 皆 ✓）。另跑 `npx tsc --noEmit`：本工單四個檔案 **0 error**；repo 既有 42 個 TS error 全部落在未觸及的檔案（`CodexAgentPanel.tsx`、`agent-profiles.ts` 等），為既有 baseline |
| G7 B-2 提示 | ✅ PASS | 未帶 `--workspace`：stderr 含 `--workspace not specified` 與 `BAT_WORKSPACE_ID`，exit **0**，`payload.workspaceId` 為 `undefined`（行為未變）。帶 `--workspace ws-uuid-2`：stderr **不含**該提示，exit 0，`payload.workspaceId === 'ws-uuid-2'` |
| G8 Part C 結論 | ✅ PASS | 見下節 |

補跑（非 gate）：`npm run verify:renderer-imports` → OK（151 files，無 banned Node imports）。
`runtime 派工 smoke` 依工單指示**未執行**（Worker 未實際 spawn 終端派工單）。

### Part C — 未知 workspaceId 的 renderer 行為（調查，未改行為）

**追蹤路徑**（全鏈路，含程式碼位置）：

```
scripts/bat-terminal.mjs:640                  if (workspaceId) invokePayload.workspaceId = workspaceId
  → RemoteServer invoke 'terminal:create-agent-command'
electron/terminal-command-handlers.ts:205-249  透傳 opts.workspaceId 給 create-with-command
electron/terminal-command-handlers.ts:163-168  ptyManager.create({ ..., workspaceId })
electron/pty-manager.ts:425/478/558            BAT_WORKSPACE_ID: workspaceId ?? ''   ← 無驗證，原值注入
electron/terminal-command-handlers.ts:174-186  created && !_ctx.windowId → 廣播給「所有」window
src/App.tsx:455-461                            onCreatedExternally → workspaceStore.addExternalTerminal(info)
src/stores/workspace-store.ts:329-340          解析與 fallback（見下）
```

**(1) PTY 會落到哪？**

落在**接收端 window 當下的 active workspace**。`workspace-store.ts:333-340` 的邏輯是：

```ts
if (info.workspaceId) workspace = this.state.workspaces.find(w => w.id === info.workspaceId)
if (!workspace)       workspace = this.state.workspaces.find(w => w.id === this.state.activeWorkspaceId)
if (!workspace)       return null
```

找不到指定 id → **靜默 fallback 到 active workspace**，與「完全沒帶 `--workspace`」的結果相同。
換言之顯式指定一個不存在／已關閉的 id，**在使用者眼中與 B-2 描述的情境無法區分**。

**(2) 會不會變成孤兒／不可見分頁？**

分三種情形：

- **一般情況（該 window 至少有一個 workspace）**：❌ 不會孤兒。fallback 到 active workspace，
  分頁可見、xterm 正常綁定、縮圖正常。
- **`workspaces` 為空**：⚠️ 會孤兒。`addExternalTerminal` 回 `null`，renderer 完全不加入 state，
  但 PTY 已在 main process 建立、`bat-terminal.mjs` 也已回報成功並 exit 0 →
  **PTY 存活但無任何 UI 表示，也無法從 UI 關掉**。此為既有邏輯（非本次改動引入），
  且與 workspaceId 是否合法無關（沒帶 `--workspace` 也一樣中招），實務上難觸發（BAT 啟動即建 default workspace）。
- **多 window**（`terminal-command-handlers.ts:174` 的 `for (const win of deps.getAllWindows())` 廣播給所有 window）：
  ⚠️ **每個 window 都會各自跑一次 fallback**。若目標 workspace 屬於 window B，
  window A 找不到該 id → 在 A 的 active workspace 也長出一個同 `id` 的分頁。
  這是既有行為、與 workspaceId 合法與否無關（合法但屬於別的 window 一樣會發生），
  但確實會讓「指定了未知 id」在多開視窗下產生重複分頁。

**(3) 有無錯誤或 fallback？**

- **沒有任何錯誤**。整條鏈路上**零處驗證 workspaceId 是否存在**：helper 只判斷 truthy，
  main 直接透傳，renderer 靜默 fallback。
- 唯一痕跡是一行 debug log（`src/App.tsx:458`）：
  `[T0130] External terminal added: id=... workspaceId=${info.workspaceId ?? '(active)'}`
  ——但它印的是**請求值**，不是實際落點，所以這行 log 反而會**誤導**：
  帶了未知 id 時 log 顯示該 id，實際卻落在 active workspace。
- 另有兩處連帶的靜默降級：
  - `electron/main.ts:565-582` `resolveWorkspaceDefaultAgent()`：未知 id → 回 `null` →
    改用 `settings.defaultAgent` → `'claude-code'`。**該 workspace 的 defaultAgent 設定被無聲忽略**。
  - `electron/pty-manager.ts:425/478/558`：未知 id **原封不動**注入子行程 `BAT_WORKSPACE_ID`。
    配合 B-2 建議的 `--workspace "$BAT_WORKSPACE_ID"`，這個假 id 會被 Worker **繼續往下游傳播**。

**給塔台的結論（供 B-1 決策）**

- 安全性上**不危險**：不會 crash、不會誤殺既有終端、不會落到別的專案目錄
  （`cwd` 由 `--cwd` 決定，與 workspaceId 完全獨立）。
- 但**可觀測性上是壞的**：「顯式指定了一個不存在的 workspace」與「完全沒指定」對呼叫端
  **完全不可區分**，且 debug log 顯示的是請求值而非落點。
- 因此 **B-1（漏帶 `--workspace` 時改讀 `BAT_WORKSPACE_ID`）本身不會被 Part C 否決**——
  未知 id 的行為是安全的 fallback，不是危險路徑。
- 但若塔台採納 B-1，建議**同批**補一個 renderer 端的 miss 訊號（例如
  `addExternalTerminal` 在 `info.workspaceId` 存在卻查無時發一則 warn log 或 toast），
  否則 B-1 讓 `BAT_WORKSPACE_ID` 成為預設來源後，一個過期的環境變數會安靜地退回 active workspace，
  把今天「呼叫端不知道有這個參數」的問題換成「呼叫端以為指定成功了」——診斷成本更高。
  Worker 建議此為**另開工單**（非 T0360 範圍）。

### 偏離與未做事項

- ❌ **B-1 未實作**（工單明確排除 + `memory_overrides` 禁止）。Part C 只調查、未改任何解析行為。
- ❌ 未改 workspace 既有 fallback 語意、未動 `--skill` 白名單、未動 BUG/PLAN ID 規則、未做換版/release。
- ⚠️ `scripts/migrate-ct-frontmatter.mjs` 的第五份 regex 未統一（範圍外，見「設計決策 3」）。
- ⚠️ **B-2 提示的已知取捨**：提示走 stderr。若有呼叫端把「stderr 非空」當失敗判準，會誤判成功為失敗。
  Worker 已確認 exit code 不變（測試斷言 exit 0），但這是工單指定的文案與通道，故照做並在此記錄。

### 後續建議

1. 塔台實際 spawn 一個 `CP-T####` 終端做 runtime 派工 smoke（工單已聲明不在 Worker gate 內）。
2. 依 Part C 結論裁決 B-1；若採納，建議同批補 renderer 端 workspace miss 訊號（另開單）。
3. 視需要另開單統一 `scripts/migrate-ct-frontmatter.mjs` 的 ID regex。

### 互動紀錄

無（`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 紀錄

無。

