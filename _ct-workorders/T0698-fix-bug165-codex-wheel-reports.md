---
schema_version: 1
schema_kind: workorder
id: T0698
title: "BUG-165 修正：Codex 分頁在 alt screen + 滑鼠追蹤時，依滾輪像素累積行數送多個滑鼠回報（上限約 8），讓捲動接近 iTerm2"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-165
priority: P3
sizing: S
created_at: "2026-10-22T01:48:04+0800"
started_at: "2026-10-22T01:49:26+0800"
updated_at: "2026-10-22T02:00:28+0800"
completed_at: "2026-10-22T02:00:28+0800"
target_version: "0.7.1-pre.6"
depends_on: []
related:
  - "BUG-165（OPEN）與 T0670 研究（`8c581f5b`，回報區）：xterm.js 5.5 在滑鼠追蹤模式下每個 wheel 事件最多送 1 個回報，多的行數丟掉；codex 0.163 在 alt screen 自己接管滑鼠，每個回報捲 `tui.mouse_scroll_speed` 行（預設 1）。iTerm2 依累積行數送多個回報（每事件 ≤ 32）"
  - "D181（`v0.7.1-pre.6` 發版批次），使用者 2026-10-22 決定本批就做修正，讓外部測試者A 直接用 pre.6 驗"
  - "CLAUDE.md「終端分頁右鍵選單與滑鼠追蹤（T0568 / BUG-142）」：🔴 不改 xterm 寫進 PTY 的滑鼠回報語意；T0672 `MouseReportEchoDetector`（`src/lib/mouse-tracking-reset.ts`）接在 TerminalPanel 的 `onData` / `writeOutput`"
affects_files:
  - src/components/TerminalPanel.tsx
  - "src/lib/terminal-wheel-reports.ts（新檔，純函式：判斷條件與累積換算）"
  - "src/lib/__tests__/terminal-wheel-reports.test.ts（新檔）"
  - "src/__tests__/（TerminalPanel 相關測試，必要時）"
  - "docs/agent-guide/terminal-wheel-reports.md（新檔）"
  - "e2e/t0698-codex-wheel-reports.spec.ts（選用，新檔）"
  - _ct-workorders/T0698-fix-bug165-codex-wheel-reports.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍：只在「分頁是 codex（判斷方式見下）＋ 目前在 alt buffer ＋ 程式開了滑鼠追蹤 ＋ SGR 編碼（`?1006`）」全部成立時接管 wheel 事件；其他情況（一般 shell、claude、normal buffer、未追蹤、非 SGR）行為與現在**完全相同**，交回 xterm 預設處理。"
  - "🔴 做法：`terminal.attachCustomWheelEventHandler`。依 `deltaMode`（pixel / line / page）與 cell 高度把 delta 換成行數並累積小數餘量，每個事件送 `floor(累積)` 個 SGR 滾輪回報（上限 8，超過的丟掉並清掉餘量，避免慣性堆積），送完回傳 `false` 阻止 xterm 再送一次。回報格式、座標（1 起算的 col/row，取滑鼠所在 cell）、修飾鍵位元與 xterm 自己產生的 SGR wheel 回報逐位元相同（對照 xterm 原始碼並附出處）；送出路徑與 xterm `onData` 相同，讓 T0672 的 `MouseReportEchoDetector` 照樣看得到。方向（上 / 下）與 `deltaY` 正負對應照 xterm。"
  - "🔴 「是 codex 分頁」的判斷：先找 TerminalPanel 已有的 agent 資訊（分頁的 agent preset / 啟動命令來源），不要自己解析輸出；判斷寫在 `src/lib/terminal-wheel-reports.ts` 的唯一函式。若找不到可靠的 agent 資訊、或你認為不限 codex 更合理（例如 claude 也開了追蹤），用 BAT 通道問塔台，不要自行擴大。"
  - "🔴 不改：xterm 版本、`smoothScrollDuration` / `scrollSensitivity`（T0670 不建議）、PTY 寫入其他路徑、BAT 不注入 `-c tui.*`。不要修改 CLAUDE.md（同批 T0697 也在改，避免同檔並行）：把建議加進 CLAUDE.md 的一節（3–8 行，照 CLAUDE.md 撰寫規則）寫在回報區，由塔台在兩張完成後套用；細節寫在新的 `docs/agent-guide/terminal-wheel-reports.md`。"
  - "🔴 驗證：單元測試涵蓋條件判斷（每個條件不成立時都交回 xterm）、pixel / line / page 換算、餘量累積、上限 8、方向、修飾鍵、座標、回傳值；與 xterm 產生的回報逐位元比對（可用 jsdom + 真 xterm 實例或擷取 xterm 原始碼的編碼函式對照）。`npm run test:unit` 全綠；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npx vite build` exit 0。e2e 選做（隔離實例，在分頁內用 node 腳本開 alt screen + `?1000h?1006h`，派送 wheel 事件，記錄收到的回報數）；不得以預設實例（無 `--runtime`）啟動 source build，不碰使用者正在用的 BAT；不開會耗 token 的 codex turn。macOS 觸控板的實際手感需外部測試者A 實機確認，列進回報區「需實機驗證」。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。同批 T0697 同時在 repo 內工作：只 commit 本單 `affects_files`，不碰 `package.json` / `package-lock.json` / CLAUDE.md。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報與 docs 只用代稱（外部測試者A），路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題問塔台。"
---

# T0698 — BUG-165：Codex 分頁滾輪送多個回報

## 背景

- 外部測試者A（macOS）：Claude CLI 分頁捲動順，Codex 分頁比較頓（BUG-165）。
- T0670 研究結論：codex 在 alt screen 接管滑鼠，每個滾輪回報捲固定行數；xterm.js 在滑鼠追蹤模式下每個 wheel 事件最多送 1 個回報，觸控板高頻 pixel-delta 與慣性事件的多餘行數全被丟掉（實測 60 個 × 50 px 快速滑動應捲 173 行，只送 60 個回報）。iTerm2 依累積行數送多個回報。
- 使用者決定本批就修（D181 批次，`v0.7.1-pre.6`），讓外部測試者A 用 pre.6 直接驗。使用者端暫解 `mouse_scroll_speed = 3` 仍保留在更版重點。

## 實作

1. `src/lib/terminal-wheel-reports.ts`：條件判斷（codex 分頁 + alt buffer + 滑鼠追蹤 + SGR）、delta → 行數換算與餘量累積、SGR 回報編碼，全部是純函式。
2. `TerminalPanel.tsx`：`attachCustomWheelEventHandler` 接上；條件不成立回傳 `true`（交回 xterm）。
3. 測試與 docs（見 `memory_overrides`）。

## 驗收

- [x] 條件全部成立時，每事件依累積行數送 1–8 個回報，與 xterm 產生的 SGR wheel 回報逐位元相同
- [x] 任何條件不成立時行為與現在相同（測試證明）
- [x] `npm run test:unit` 全綠；兩個 typecheck = 0；`npx vite build` exit 0
- [x] `docs/agent-guide/terminal-wheel-reports.md` 與回報區的 CLAUDE.md 建議段落
- [x] 需實機驗證清單（macOS 觸控板手感、Windows / Linux 滑鼠滾輪）

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

#### Q-1：「是 codex 分頁」只用 `TerminalInstance.agentPreset === 'codex-cli'` 判斷，helper 派工的 codex Worker 分頁本單不涵蓋，可以嗎？
- 提問時間：2026-10-22T01:50:32+0800
- 選項：[A] 只認 `agentPreset === 'codex-cli'`（使用者自己從「+」開的 Codex CLI 分頁、還原後也保留）；helper 派工的 codex Worker 分頁（`addExternalTerminal` 不存 `agentPreset`，`terminal:created-externally` 帶的 `agent` 沒存進 store，BAT 重開後也沒有）維持 xterm 預設，記為後續候選 / [B] 本單一併涵蓋 Worker：在 `TerminalInstance` 新增一個只供顯示 / 判斷用的欄位（例如 `externalAgent`），`addExternalTerminal` 從 `info.agent` 存入並持久化；會改 `src/types/index.ts`、`src/stores/workspace-store.ts`（超出 `affects_files`）。不能直接寫進 `agentPreset`，因為還原 / ⏻ 重啟會依 `agentPreset` 重打啟動命令 / [C] 其他
- Worker 建議：[A]，因為 BUG-165 回報的是使用者自己開的 Codex 分頁；[B] 動到共用 store 與持久化格式，且同批 T0697 並行，風險大於收益，可另開小單
- 影響範圍：`src/lib/terminal-wheel-reports.ts` 的判斷函式、TerminalPanel 讀取 agent 資訊的方式；[B] 另加 `src/types/index.ts`、`src/stores/workspace-store.ts` 與其測試
- 阻塞：否（先做換算 / 編碼 / 接線；判斷函式最後依答覆定案）

### 互動紀錄

- [01:51] Q-1: 「是 codex 分頁」只認 `agentPreset === 'codex-cli'`、helper 派工的 codex Worker 不涵蓋？ → A（塔台，BAT 通道，choice 1）: [A] 只認 `agentPreset === 'codex-cli'`，Worker 分頁維持 xterm 預設，回報區記為後續候選（塔台代決，決策日誌 `951259fa`） → Action: `isCodexTerminal` 只認 `codex-cli`；後續候選見下方。

### 完成狀態

**DONE**。工單驗收的五項 Worker 步驟都完成（e2e 為選做，未做）。

### 實作摘要

- `src/lib/terminal-wheel-reports.ts`（新檔，純函式，不 import DOM / xterm / electron）：
  - 條件：`isCodexTerminal`（`agentPreset === 'codex-cli'`，Q-1）、`shouldSendWheelReports`（codex + `buffer.active.type === 'alternate'` + `mouseTrackingMode` 為 `vt200` / `drag` / `any` + 編碼 `SGR`）。`x10` 不回報滾輪，不算；`SGR_PIXELS` / `DEFAULT` 不算。
  - `mouseReportEncoding`：xterm 公開 API 沒有編碼欄位（`terminal.modes` 只有 protocol），讀 xterm 5.5.0 的 `_core.coreMouseService.activeEncoding`；結構不同時回 `undefined` → 條件不成立 → 交回 xterm（功能關閉，不會亂送）。
  - 換算 `wheelLines`：與 xterm `Viewport._applyScrollModifier` / `getLinesScrolled` 相同（`scrollSensitivity`、Alt 的 `fastScrollSensitivity`；pixel ÷ 列高、line 照用、page × rows；Shift 或 `deltaY === 0` → 0）。
  - `WheelLineAccumulator`：累積小數餘量，每事件送 `trunc(累積)` 個；超過 8 → 送 8 並清餘量；方向改變時丟掉餘量。
  - `wheelReportCell`：與 xterm `MouseService.getMouseReportCoords` + `triggerMouseEvent` 相同（`.xterm-screen` 內偏移扣 padding、夾邊、÷ cell、+1）。
  - `sgrWheelReport`：`ESC [ < Pb ; col ; row M`，Pb = 64 | 下 1 | Ctrl 16 | Alt 8（xterm `eventCode` + `DEFAULT_ENCODINGS.SGR`）。
  - `planWheelReports`：串起上面；`null` = 交回 xterm（Shift / 無垂直 delta / 還沒有尺寸）。
- `src/components/TerminalPanel.tsx`（+42 行）：`terminal.attachCustomWheelEventHandler`。條件不成立回 `true`；成立時每個回報各呼叫一次 `terminal.input(report, true)`（就是 xterm 自己送回報用的 `CoreService.triggerDataEvent(report, true)` → `onData` → `pty.write`，T0672 的 `MouseReportEchoDetector` / `MouseReportSelectionKeeper` 照樣看得到），然後回 `false`。xterm 在追蹤模式下 `sendEvent` 收到 `false` 就不送，但 wheel listener 仍會 `cancel`（preventDefault），與原本相同。接管狀態改變時記一次 `[wheel-reports] on|off terminal=… buffer=… mode=… encoding=…`，並清掉餘量。`agentPreset` 每個事件從 `workspaceStore.getState()` 讀。
- `docs/agent-guide/terminal-wheel-reports.md`（新檔）：原因、規則、唯一實作、與 xterm 原始碼的對照表、累積與上限、日誌、使用者看得到的行為變化、已知限制、驗證。
- 沒有改：xterm 版本、`smoothScrollDuration` / `scrollSensitivity`、PTY 寫入的其他路徑、codex `-c tui.*`、CLAUDE.md、`package.json` / `package-lock.json`。

### CLAUDE.md 建議段落

建議加在「終端分頁右鍵選單與滑鼠追蹤（T0568 / BUG-142）」節之後（由塔台套用）：

```markdown
## Codex 分頁的滾輪回報（T0698 / BUG-165）

- 用途：codex 在 alt screen 接管滑鼠，每個滾輪回報捲固定行數；xterm.js 5.5 在追蹤模式下每個 wheel 事件最多送 1 個回報，觸控板多出的行數被丟掉。BAT 依累積行數送多個回報（每事件上限 8）。
- 🔴 只在「`agentPreset === 'codex-cli'` + alt buffer + `vt200` / `drag` / `any` 追蹤 + SGR 編碼」全部成立時接管；其他情況（一般 shell、claude、normal buffer、未追蹤、x10、非 SGR、Shift）handler 回 `true`，行為與 T0698 前完全相同。helper 派工的 codex Worker 分頁沒有 `agentPreset`，不涵蓋（T0698 Q-1）。
- 🔴 回報與 xterm 產生的 SGR 滾輪回報逐位元相同，一律經 `terminal.input(report, true)` 送出（= xterm 自己的 `onData` 路徑，T0672 的偵測照樣看得到）；不改 xterm 版本、`scrollSensitivity` / `smoothScrollDuration`，不注入 codex `-c tui.*`。
- 唯一實作：純函式 `src/lib/terminal-wheel-reports.ts`（`shouldSendWheelReports` / `planWheelReports`），接線在 `TerminalPanel.tsx` 的 `attachCustomWheelEventHandler`。編碼讀 xterm 內部 `_core.coreMouseService.activeEncoding`（`mouseReportEncoding`），讀不到即關閉；升級 xterm 時必跑 `src/lib/__tests__/terminal-wheel-reports.test.ts`（以真 xterm 實例比對）。
- 完整換算對照、累積規則、日誌、行為變化、已知限制、驗證清單：[docs/agent-guide/terminal-wheel-reports.md](docs/agent-guide/terminal-wheel-reports.md)
```

另外 `docs/agent-guide/README.md` 的索引建議加一列（本單 `affects_files` 不含該檔，未改）：

```markdown
| [terminal-wheel-reports.md](terminal-wheel-reports.md) | Codex 分頁在 alt screen + 滑鼠追蹤時依累積行數送多個滾輪回報 | Codex 分頁的滾輪回報（T0698 / BUG-165） |
```

### 驗證證據

| 關卡 | 結果 | 證據 |
|---|---|---|
| 單元測試（本單新增） | PASS | `src/lib/__tests__/terminal-wheel-reports.test.ts` 25 項：條件（四個條件各自不成立、x10、`SGR_PIXELS` / `DEFAULT` / 讀不到）、`mouseReportEncoding` 對真 xterm（`DEFAULT` / `SGR` / `SGR_PIXELS` / 1006l 後回 `DEFAULT`）、pixel / line / page、靈敏度與 fast-scroll、餘量累積（上 / 下）、反向丟餘量、上限 8、NaN / Infinity、T0670 例 60 × 50 px → 173 個、座標（左上 / 中 / 右下 / 夾邊 / padding / 無尺寸）、修飾鍵與方向；**真的 xterm 5.5.0 實例**寫入 codex 的 `?1049h ?1000h ?1002h ?1003h ?1006h` 後以 `coreMouseService.triggerMouseEvent` 產生回報，2 方向 × Ctrl × Alt × 4 個位置共 32 組逐位元相同。`src/__tests__/terminal-wheel-reports.test.tsx` 9 項：TerminalPanel handler 回 `false` 且回報經 `terminal.input(…, true)` → `onData` → `pty.write`；未滿一行不送；Ctrl 位元；上限 8；`drag` / `vt200`；claude / 一般 shell / normal buffer / 未追蹤 / x10 / `DEFAULT` / `SGR_PIXELS` / 讀不到編碼 / Shift / 水平捲動 / 沒有 `.xterm-screen` 都回 `true` 且不送；離開 alt screen 清餘量、on / off 日誌 |
| `npm run test:unit` | PASS | `Test Files 331 passed (331)`、`Tests 5891 passed \| 3 skipped (5894)`，exit 0 |
| `npm run typecheck` | PASS | exit 0（0 錯誤） |
| `npm run typecheck:electron` | PASS | exit 0（0 錯誤） |
| `npx vite build` | PASS | exit 0（`✓ built in 4.50s` 等） |
| e2e | 未做 | 工單選做；未啟動任何 BAT 實例、未開 codex turn |
| 實機 | 未做 | 見「需實機驗證」 |

驗證在 docs 撰寫前執行；之後只新增 docs，程式碼與 commit `ec4b3c13` 相同。

### 需實機驗證

- macOS 觸控板（外部測試者A）：Codex CLI 分頁在 codex 畫面捲動的手感是否接近 Claude CLI 分頁 / iTerm2；慣性尾段是否過捲；快速甩動時每事件上限 8 是否會覺得少捲。
- Windows / Linux 滑鼠滾輪：一格捲幾行（推估 Windows Chromium 一格約 100 px ≈ 5 行，T0698 前是 1 行），是否過快。
- 使用者端暫解 `mouse_scroll_speed = 3`：T0698 後變成每行 3 行，可能過快；更版重點建議提醒改回預設。
- 一般 shell、Claude CLI 分頁、normal buffer 的捲動不變（日誌不應出現 `[wheel-reports] on`）。
- codex 離開 alt screen（`/quit`）後回到 shell，捲動回到 xterm 預設（日誌 `[wheel-reports] off`）。

### 遭遇問題

- xterm 公開 API 不提供滑鼠編碼（SGR / DEFAULT），改讀內部欄位 `_core.coreMouseService.activeEncoding`；讀不到即關閉功能，並以真 xterm 實例的測試守住（升級 xterm 時會失敗提醒）。
- 列高：xterm 換算 pixel 用 `device.cell.height / dpr`，BAT 用 `.xterm-screen` 高 ÷ rows（= `css.cell.height`），差在小數以下，只影響何時累積滿一行；座標的 cell 寬高與 xterm 相同。
- 行為差異（刻意）：方向改變時丟掉餘量（xterm 自己的 `_wheelPartialScroll` 直接相加），讓反向立即反應。

### 後續候選

- helper 派工的 codex Worker 分頁也接管滾輪（Q-1 [B]）：`TerminalInstance` 加只供判斷用的欄位（例如 `externalAgent`），`addExternalTerminal` 從 `terminal:created-externally` 的 `agent` 存入並持久化；不能寫進 `agentPreset`（還原 / ⏻ 重啟會重打啟動命令）。
- e2e（隔離實例：分頁內 node 腳本開 alt screen + `?1000h?1006h`，派送 wheel 事件，記錄收到的回報數），本單未做。
- 是否也套用到 claude fullscreen（同樣開追蹤）：本單不涵蓋，需使用者回饋再決定。

### Commit

- `ec4b3c13` fix: codex tabs send one SGR wheel report per line scrolled (T0698, BUG-165)（產品 5 檔：`src/components/TerminalPanel.tsx`、`src/lib/terminal-wheel-reports.ts`、`src/lib/__tests__/terminal-wheel-reports.test.ts`、`src/__tests__/terminal-wheel-reports.test.tsx`、`docs/agent-guide/terminal-wheel-reports.md`）
- `4619f944` chore: T0698 IN_PROGRESS, Q-1（工單）
- 本回報的工單 commit（收尾）
- 未 push、未觸發 workflow、未建 tag；未碰 `package.json` / `package-lock.json` / CLAUDE.md。

### Landing check

- PASS。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1：工單在 REPO_ROOT 下；C-3：`affects_files` 的既有路徑存在（informational）；C-2：無 `branch` 欄位。`CT_HOME` 未設定（非隔離）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 回報時間

2026-10-22T02:00:28+0800
