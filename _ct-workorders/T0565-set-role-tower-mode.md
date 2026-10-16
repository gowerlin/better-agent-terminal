---
schema_version: 1
schema_kind: workorder
id: T0565
title: "擴充 `--set-role tower` 契約：加 `--mode yolo|ask|off|on`，主行程記錄塔台分頁的模式（restart / recovery 沿用），供 PLAN-044 辨識 yolo 塔台（D148）"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-044
priority: P2
sizing: S
created_at: "2026-10-16T15:05:50+0800"
updated_at: "2026-10-16T15:15:56+0800"
started_at: "2026-10-16T15:07:39+0800"
completed_at: "2026-10-16T15:15:56+0800"
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

**DONE**。驗收條件 5 項全過。

落點檢查：**PASS**。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 內；C-3 `scripts/bat-terminal.mjs`、`electron/` 都存在；C-2 工單沒有 `branch` 欄位，目前在 `main`。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 產出摘要

**契約**（擴充 T0562，供 CT-T013 使用）：`bat-terminal.mjs --set-role tower [--mode yolo|ask|off|on] [--terminal-id <id>] [--agent <id>]`

- `scripts/bat-terminal.mjs`
  - `--set-role` 模式接受 `--mode`。值會去前後空白、不分大小寫，只收 `yolo` / `ask` / `off` / `on`。其他值（含空白字串、缺值）→ exit 1，stderr `set-role: USAGE`。`--mode` 寫在 `--set-role` 前面或後面都可以。
  - `--mode` 不再算進 set-role 的互斥清單，其餘互斥參數不變。
  - 請求多帶 `mode`；不帶 `--mode` 時請求內容與 T0562 相同。
  - 主行程回應含 `mode` 時，在 `✓ Tower role set: <id>` 下一行印 `  mode: <m>`（印的是 BAT 實際記錄的值）。
  - `bat-scripts.log` 的 `set-role` 事件多記 `mode`（請求值），成功時另記 `recordedMode`；`parsed` 事件多記 `roleMode`。
  - 建立分頁模式的 `--mode` 維持原本的嚴格文法（大小寫須完全相符、錯誤訊息不變、不印 `set-role:`）。`--close-worker` 照舊拒絕 `--mode`。`--set-role` 只是別的參數的值時（例 `--prompt --set-role`）不會放寬文法。
  - `--help` 的用法行、`--mode` 說明與範例已更新。
- `electron/ct-mode.ts`（新增）：`CT_MODES`、`CtMode`、`normalizeCtMode`。不 import electron，與 headless 共用。
- `electron/terminal-role.ts`：`setTerminalRole` 驗證 `mode`（`undefined` / `null` = 不改；不合法 → `INVALID_ARGS`，不記錄也不送事件），呼叫 `PtyManager.setTerminalRole` 記錄。結果為 `{ ok: true, terminalId, role, mode? }`，`mode` 是記錄後的值。`terminal:role-changed` payload 多帶 `mode?`，只改了 electron 端型別，renderer 沒有改。日誌與 `mirrorToBatScripts` 都記 `mode`。
- `electron/pty-manager.ts`：
  - `PtyInstance` 新增 `role?: 'tower'` 與 `towerMode?: CtMode`。
  - `setTerminalRole(id, role, mode?)`：`mode` 未給時保留已記錄的值；PTY 不存在回 `false`。
  - `getTerminalRole(id)`、`getTowerMode(id)`（只對 tower 分頁回值）。
  - **`isYoloTerminal(id)`**（唯一實作，供 T0566）= `(role === 'tower' && towerMode === 'yolo') || customEnv.CT_MODE === 'yolo'`。
  - 生命週期：`restart` 在 create 成功後重新套用記錄；Terminal Server 冪等重建沿用同一個 instance；recovery 以 `{ ...inst }` 複製，欄位一併保留；kill / exit 時隨 instance 刪除。
- headless 權杖規則不變：`helper-capability.ts` 只檢查 `terminalId`，多出的 `mode` 欄位不影響授權。

**測試**

- `electron/__tests__/bat-terminal-set-role.test.ts`：
  - 合法值 4 個加大小寫 / 空白變體共 6 例：exit 0、送出的 `mode` 正確、印出 `mode:` 行、log 有記錄。
  - `--mode` 寫在 `--set-role` 前面。
  - 不帶 `--mode`：請求與 T0562 相同；BAT 回傳已保留的 mode 時照樣印出。
  - BAT 回應沒有 mode → 只印 ✓ 行；`NOT_FOUND` 帶 `--mode` → exit 3。
  - 用法錯誤：未知值（含寫在 `--set-role` 之前）、空白值、缺值 → `set-role: USAGE`。
  - 建立分頁模式的 `--mode` 文法不變（3 例），`--set-role` 當作別的參數的值時不放寬，`--close-worker` 仍拒絕 `--mode`。
  - T0562 原本的 `with --cwd / --workspace / --mode` 用例改為預期 `--cwd, --workspace`：`--mode` 依本單契約已不算衝突。
  - `--help` 斷言改為新的用法行。
- `electron/__tests__/terminal-role-mode.test.ts`（新增，真 `PtyManager` 搭配假 node-pty）：
  - `normalizeCtMode`。
  - 記錄、ask → yolo 更新、不帶 / `null` 不清除；結果、事件與 mirror 都帶 mode。
  - 沒帶 mode 時結果與事件和 T0562 相同（payload 沒有 `mode` 欄位）。
  - 不合法 mode 5 種 → `INVALID_ARGS`，不記錄、不送事件；`NOT_FOUND`。
  - `isYoloTerminal`：tower yolo → true；tower ask / tower 無 mode → false；Worker `CT_MODE=yolo` → true；Worker `CT_MODE=ask` / 一般分頁 / 不存在 → false。
  - node-pty：restart 保留、kill 移除、同 id 新 PTY 無角色、自行 exit 移除。
  - Terminal Server：restart、冪等重建、recovery 都保留，`pty:exit` 後移除。
- `electron/remote/__tests__/headless-set-role-e2e.test.ts`（真 headless + 真 node-pty，helper 在 PTY 內執行）：
  - tower `--mode YOLO` → exit 0，印出 `  mode: yolo`，事件帶 `mode: 'yolo'`。
  - 不帶 `--mode` 時仍是 `mode: yolo`，證明 headless `PtyManager` 有記錄且沒有清除；`--mode ask` 會更新。
  - 未知值 → exit 1 `USAGE`、沒有事件。
  - worker 加 `--mode yolo` 仍是 `role-not-allowed`。

**驗收結果**

| 項目 | 結果 |
|---|---|
| 新 / 改測試（3 檔） | PASS：44 + 23 + 8 |
| T0562 既有測試（`terminal-role.test.ts` 等） | PASS |
| `npm run test:unit` | PASS：**260 files / 4502 passed / 3 skipped**（基線 258 / 4452；工作樹含 T0563 未 commit 的測試檔 `dialog-no-outside-close.test.tsx`；輸出中的 `AttachConsole failed` 是 node-pty 已知 stderr 雜訊，見 CLAUDE.md T0540） |
| `npm run typecheck` | 0（工作樹含 T0563 未 commit 的 `src/**`） |
| `npm run typecheck:electron` | 0 |
| `npx vite build` | 成功 |

**改動檔案**：`scripts/bat-terminal.mjs`、`electron/ct-mode.ts`（新）、`electron/terminal-role.ts`、`electron/pty-manager.ts`、`electron/__tests__/bat-terminal-set-role.test.ts`、`electron/__tests__/terminal-role-mode.test.ts`（新）、`electron/remote/__tests__/headless-set-role-e2e.test.ts`、本工單。

**commit**：以 `git commit --only` 提交上述檔案；hash 由塔台回填 `commit` 欄位（比照 T0562）。沒有 push、沒有觸發 workflow、沒有建 tag。

### CLAUDE.md 待補

> 建議併入 CLAUDE.md「塔台分頁標題（T0562，D147）」一節。

- **契約**改為 `"${BAT_HELPER_NODE:-node}" "$BAT_HELPER_DIR/bat-terminal.mjs" --set-role tower [--mode yolo|ask|off|on] [--terminal-id <id>] [--agent <id>]`，並在 `--agent` 說明之後補一段：**`--mode`（T0565 / D148）**：選填，去前後空白、不分大小寫，只收 `yolo` / `ask` / `off` / `on`；其他值（含空白、缺值）→ exit 1 `set-role: USAGE`。`--set-role` 模式下不算互斥參數，可寫在 `--set-role` 前後。不帶時不改已記錄的模式（**不清除**，CT 每次都帶）。成功時 stdout 在 `✓ Tower role set: <id>` 之後多印 `  mode: <m>`，值為 BAT 實際記錄的模式（未曾設定則不印）。`bat-scripts.log` 的 `set-role` 事件多記 `mode` / `recordedMode`。建立分頁模式的 `--mode` 文法不變（嚴格小寫）。
- **主行程**一句改為：`{ terminalId, role, agent?, mode? }`；`mode` 不合法 → `INVALID_ARGS`；合法時呼叫 `PtyManager.setTerminalRole(id, 'tower', mode?)`，把 `role` / `towerMode` 記在 `PtyInstance`（`electron/ct-mode.ts` `normalizeCtMode`）；回 `{ ok: true, terminalId, role, mode? }`（`mode` = 記錄後的值）。`terminal:role-changed` 多帶 `mode?`，renderer 忽略（標題規則不變）。
- **yolo 判定（T0565，PLAN-044 用）**：`PtyManager.isYoloTerminal(id)`（唯一實作，本機與 headless 同一 class）= tower 且 `towerMode === 'yolo'`，或 `customEnv.CT_MODE === 'yolo'`（Worker 派工 `--mode yolo`）。另有 `getTerminalRole(id)` / `getTowerMode(id)`（只對 tower 回值）。記錄由 `restart` 沿用（create 成功後重新套用）；Terminal Server 冪等重建是同一個 instance、recovery 以 `{ ...inst }` 複製，兩者都保留；PTY kill / exit 即移除。T0108 replay 註冊的 PTY（BAT 重開、Terminal Server 存活）沒有記錄，要等 CT 下次 `--set-role` 才會補上。**不持久化**（不寫 window registry）。
- **遠端 headless**：權杖規則不變（只檢查 `terminalId`）。
- **驗證**清單補上：`electron/__tests__/terminal-role-mode.test.ts`（記錄 / 更新 / 不清除 / 不合法、`isYoloTerminal`、restart / 冪等 / recovery / kill / exit），並註明 `bat-terminal-set-role.test.ts` 與 `headless-set-role-e2e.test.ts` 含 T0565 用例。

### 互動紀錄

無（`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 歷程

無。

### 遭遇問題

1. **`isYoloTerminal` 照工單字面採 OR**：塔台分頁若同時帶 `customEnv.CT_MODE=yolo`（例如它本身是 yolo Worker 分頁，之後又有人在裡面以 `--mode ask` 啟動 Tower），仍判定為 yolo。這種情況很少見，若 T0566 需要「Tower 宣告的模式優先」，只要調整 `PtyManager.isYoloTerminal` 這一處。
2. **T0108 replay 的 PTY 沒有角色記錄**：BAT 重開但 Terminal Server 仍存活時，主行程對該 PTY 的 role / mode 一無所知，要等 CT 再次執行 `--set-role` 才會補上。工單沒有要求持久化，因此未處理；若 PLAN-044 需要跨 BAT 重開，建議另開工單。
3. **與 T0562 契約的有意差異**：原本 `--set-role` 與 `--mode` 併用會被判為互斥（exit 1 USAGE），現在改為合法，依本單契約。T0562 的對應用例已同步修改。
4. **工作樹有非本單的變更**：T0563 的 `src/**`、`CLAUDE.md`、`_ct-workorders/T0563-*.md`，未納入 commit。依 memory_overrides 沒有修改 `src/**` 與 `CLAUDE.md`。

### 回報時間

2026-10-16T15:15:04+0800
