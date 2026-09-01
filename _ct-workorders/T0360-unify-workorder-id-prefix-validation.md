---
schema_version: 1
schema_kind: workorder
id: T0360
title: "BUG-082: 統一工單 ID 前綴驗證 + --workspace 缺漏提示 + 未知 workspaceId 行為調查"
type: fix
status: PENDING
priority: P1
sizing: M
created_at: "2026-09-01T22:42:56+08:00"
updated_at: "2026-09-01T22:42:56+08:00"
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

- **狀態**：PENDING
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

（Worker 填寫）
