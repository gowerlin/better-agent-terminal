---
schema_version: 1
schema_kind: workorder
id: T0565
title: "擴充 `--set-role tower` 契約：加 `--mode yolo|ask|off|on`，主行程記錄塔台分頁的模式（restart / recovery 沿用），供 PLAN-044 辨識 yolo 塔台（D148）"
type: implementation
status: TODO
repo: better-agent-terminal
project: PLAN-044
priority: P2
sizing: S
created_at: "2026-10-16T15:05:50+0800"
updated_at: "2026-10-16T15:05:50+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "0.6.1-pre.6（與 T0562 同版）"
depends_on: []
related:
  - "D148（決策）、T0564 §3c（建議）"
  - "T0562（`--set-role tower` 原契約、`electron/terminal-role.ts`）"
  - "CT-T013（CT 端會帶 `--mode`）"
  - "T0525（`buildPtyEnv` / instance 欄位在 restart / recovery 沿用）、T0535（`workorder` 沿用範本）"
affects_files:
  - scripts/bat-terminal.mjs
  - electron/**
  - _ct-workorders/T0565-set-role-tower-mode.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **不得修改 `src/**` 與 `CLAUDE.md`**：T0563 正在同一工作目錄改 `src/**` 並會改 `CLAUDE.md`，`git commit --only` 會把對方未完成的修改帶進來。renderer 不需要 mode（標題邏輯不變）；若 `terminal:role-changed` payload 多帶 `mode`，只改 electron 端型別，renderer 忽略即可。`CLAUDE.md` 要補的文字寫進回報區「CLAUDE.md 待補」小節，由後續工單併入。"
  - "🔴 No Regressions：T0562 的既有行為、exit code、輸出、標題規則不變；不帶 `--mode` 時行為與 T0562 完全相同（mode 未設定 = 非 yolo）。`--close-worker` 與建立分頁不變。"
  - "🔴 驗收前必跑：`npm run test:unit` 全綠（基線 258 files / 4452 passed，加上新測試；若 T0563 已先 commit，以當下 HEAD 為準）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功。"
  - "🔴 commit：`git add` 本單實際改動的檔後 `git commit --only <那些檔>`。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
  - "🔴 不要呼叫 `bat-terminal.mjs --close-worker`；通知塔台之後不要再執行任何指令。"
---

# T0565 — `--set-role tower --mode <m>`

## 背景

PLAN-044（D148）的自動繼續只套用在 yolo 分頁。Worker 分頁有 `customEnv.CT_MODE`，塔台分頁沒有（塔台跑在使用者自己的分頁）。T0564 建議由 CT 啟動時宣告：擴充 T0562 的 `--set-role tower`，加 `--mode`。T0562 尚未發版，本單與 T0562 同版（`0.6.1-pre.6`）發佈，CT-T013 從一開始就帶 `--mode`。

## 介面契約（擴充 T0562，CT-T013 依此撰寫）

```
"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --set-role tower [--mode yolo|ask|off|on] [--terminal-id <id>] [--agent <id>]
```

- `--mode`：選填，去前後空白、不分大小寫；只接受 `yolo` / `ask` / `off` / `on`，其他值 → 用法錯誤（exit 1，`set-role: USAGE`）。只在 `--set-role` 模式下與 `--set-role` 相容（建立分頁模式的 `--mode` 語意不變）。
- 不帶 `--mode`：與 T0562 相同，不改變已記錄的模式（**不清除**；CT 每次都帶，所以不需要「清除」語意）。
- exit code、stderr `set-role: <CODE>`、stdout `✓ Tower role set: <id>` 不變；成功時可多印一行 `  mode: <m>`。
- `bat-scripts.log` 的 `set-role` 事件多記 `mode`。

## 行為

1. 主行程（本機與 headless 共用的 `setTerminalRole`）把 `role: 'tower'` 與 `mode` 記在 `PtyInstance`（比照 `workorder` / `customEnv`）；`pty:restart`、Terminal Server 冪等重建、recovery 沿用（T0525 / T0535 範本）。分頁結束（PTY exit / kill）即隨 instance 移除。
2. 提供查詢介面給 T0566：例如 `PtyManager.getTowerMode(id)` / `isYoloTerminal(id)`（tower 且 mode = yolo，或 `customEnv.CT_MODE === 'yolo'`）。唯一實作，T0566 直接使用；headless 同樣可查。
3. `terminal:role-changed` payload 可多帶 `mode`（electron 端型別）；renderer 不需要改。
4. headless 權杖規則不變（tower 只能設定自己、worker `role-not-allowed`）。

## 驗收條件

- [ ] helper 單元測試：`--set-role tower --mode yolo` exit 0；各合法值；非法值 exit 1 `USAGE`；不帶 `--mode` 行為同 T0562；`--mode` 不影響建立分頁模式的既有測試
- [ ] 主行程測試：mode 記錄、更新（ask → yolo）、不帶 `--mode` 不清除、restart / recovery 沿用、分頁結束移除；`isYoloTerminal` 對 tower yolo / tower ask / Worker `CT_MODE=yolo` / 一般分頁的結果
- [ ] headless：tower 權杖 `--mode yolo` 設定自己 PASS 並可查到 mode（擴充 `headless-set-role-e2e.test.ts`）
- [ ] T0562 既有測試全綠；`npm run test:unit` / `npm run typecheck` / `npm run typecheck:electron` / `npx vite build` 全過
- [ ] 回報區附「CLAUDE.md 待補」文字（契約與 `isYoloTerminal`）

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### CLAUDE.md 待補

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
