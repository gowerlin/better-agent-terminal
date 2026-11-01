---
schema_version: 1
schema_kind: workorder
id: T0774
title: "BUG-193：視窗失焦時留下的淡化 ⚠️，點另一個分頁取回焦點時不得當成看過 —— 先確認事件順序再修"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T05:24:41+0800"
started_at: "2026-11-02T05:28:01+0800"
updated_at: "2026-11-02T05:37:15+0800"
completed_at: "2026-11-02T05:37:15+0800"
session_ids:
  - "3b279430-f2e6-49ce-a44c-6023524486d1"
depends_on: [T0772, T0773]
related:
  - "BUG-193；T0770 回報〈發現的問題〉觀察 2 與 `e2e/t0770-unfocused-wait-missed.spec.ts`（C / D 情境、CDP 關 focus emulation 的作法）；T0735（D200–D203）；D216"
  - "CLAUDE.md「Worker 分頁回收」節（等待使用者提示 T0735 段）；`docs/agent-guide/worker-tab-recycle.md`；判斷唯一實作 `waitingForUser` / `waitingSummary` / `nextWaitMemory`（`src/lib/terminal-attention.ts`），淡化狀態 `src/stores/terminal-attention-store.ts`，看著哪個分頁的來源 `src/App.tsx`（T0735 D203 ③ 的 `setViewingState` effect）"
affects_files:
  - src/App.tsx
  - src/stores/terminal-attention-store.ts
  - src/lib/terminal-attention.ts
  - "src/**/__tests__/*（相關單元測試）"
  - e2e/t0770-unfocused-wait-missed.spec.ts
  - docs/agent-guide/worker-tab-recycle.md
  - CLAUDE.md
  - _ct-workorders/T0774-fix-bug193-focus-regain-click-missed-badge.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 派工時機：塔台等 T0772 / T0773 收單後才派（本單要 `npx vite build`，那兩張可能用現有 `dist` 當驗收對象）。"
  - "🔴 先查證：在隔離實例（source build）確認視窗取回焦點時 `focus` / `pointerdown` / `mousedown` / `click` 與分頁切換的先後，以及現行 `setViewingState` 在哪一刻把 active 分頁當成看過；Playwright 點擊用 CDP，與實體滑鼠不一定相同，要在回報說明你依據什麼判斷（例：Chromium / Electron 對失焦視窗第一次點擊的事件順序的文件或原始碼、實測紀錄）。查證結果和 BUG-193 的推論不同就照實寫，修正依查證結果。"
  - "🔴 修正規格（D216）：取回焦點的那次點擊若切到別的分頁，原 active 分頁的淡化 ⚠️ 保留；焦點回來後仍停在原分頁（例：短暫延後到該次點擊處理完再判斷）才算看過。只恢復焦點、不點擊（Alt+Tab 回來、`focus()`）且 active 是那個分頁 → 照 D203 清除。🔴 其他 D200–D203 規則不變：有焦點且看著分頁時等待結束不留淡化、切到該分頁且有焦點時清除、分頁關閉時忘掉、detached 視窗（T0761）與 Claude 面板（T0762）同樣適用。判斷規則改在唯一實作（`nextWaitMemory` / store / `App.tsx` effect），不得在元件內另寫。延後判斷若用計時器，時間常數集中、寫明理由，並確認不會讓「看著分頁時等待結束」多出一閃而過的淡化。"
  - "🔴 驗證：單元測試涵蓋新規則（取回焦點＋同時切到別的分頁 → 保留；取回焦點不切 → 清除），並做突變檢查（拿掉修正會失敗）。e2e：`e2e/t0770-unfocused-wait-missed.spec.ts` 加情境 E（失焦 → X 結束淡化 → 用 Playwright 滑鼠點 Y 的縮圖 → X 淡化保留；再切回 X → 清除），修正前 E 失敗、修正後通過；A–D 照舊通過；`t0735-workspace-waiting-badge`、`t0761-detached-workspace-waiting`、`t0762-claude-panel-waiting` 不回歸。`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠、`npx vite build` 成功。"
  - "🔴 文件：`worker-tab-recycle.md` 的 D203 規則補一句（取回焦點的點擊）與驗證清單；CLAUDE.md「Worker 分頁回收」節的 T0735 段只在規則原文有變時補一句（≤ 1 行）。"
  - "🔴 不改主行程、hook、helper / MCP 契約、⚠️ 的視覺樣式。隔離實例、不碰使用者正在用的 BAT。不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0774 — BUG-193：取回焦點的點擊不得把淡化 ⚠️ 當成看過

## 元資料

- **工單編號**：T0774
- **類型**：implementation（修正）
- **優先級**：P2
- **建立時間**：2026-11-02T05:24:41+0800
- **預估規模**：S

## 背景

T0770 在 `v0.7.3-pre.4` 安裝版發現：視窗沒有焦點時，active 分頁 X 的等待結束留下淡化 ⚠️；這時用滑鼠點另一個分頁 Y，X 的淡化會消失，使用者其實沒看到 X。推論是點擊先觸發視窗 `focus`，`App.tsx` 依 D203 把當下 active 的 X 當成看過，之後才切到 Y。使用者裁示開 BUG 修正（D216）。

## 範圍

1. 查證事件順序。
2. 依查證結果修正（規格見 frontmatter）。
3. 單元測試＋突變、t0770 情境 E、不回歸 e2e。
4. docs / CLAUDE.md。

## 不做

- 不改主行程、hook、helper / MCP 契約、視覺樣式；不改其他 D200–D203 規則。

## 驗收

- [x] 查證結果（事件順序與依據）
- [x] 修正與單元測試、突變檢查
- [x] t0770 E 修正前失敗、修正後通過；A–D、t0735、t0761、t0762 綠
- [x] typecheck 0 / 0、`test:unit` 全綠、`vite build`

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-02T05:37:15+0800
- **session_id**：3b279430-f2e6-49ce-a44c-6023524486d1
- **產品 commit**：`bd59ab0f`（fix(attention): keep the faded ⚠️ when the click that regains focus switches tabs）

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：前 5 個可測項目（`src/App.tsx`、`src/stores/terminal-attention-store.ts`、`src/lib/terminal-attention.ts`、`e2e/t0770-unfocused-wait-missed.spec.ts`、`docs/agent-guide/worker-tab-recycle.md`）皆存在 → PASS
- C-2：工單無 `branch` 欄位；目前 `main`
- 非 worktree（`CT_HOME` 未設）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`

### 查證結果（事件順序與依據）

**依據：實測**（隔離實例、source build，Electron 41.2.1 / Chromium 146.0.7680.188、Windows 10.0.28000）。暫時 probe spec（不 commit）在 renderer 以 capture 監聽 `window` focus / blur、`pointerdown` / `mousedown` / `pointerup` / `mouseup` / `click`（`performance.now()`），並以 MutationObserver 記 active 縮圖改變的時刻；CDP 關掉 focus emulation，由隔離實例的另一個 BrowserWindow 取走焦點。兩種點擊：

1. **Playwright 滑鼠點擊（CDP `Input.dispatchMouseEvent`）**，點另一個分頁的縮圖：
   `window.focus`（hasFocus=true）8114.1 → `pointerdown` 8115.6 → `mousedown` 8115.6 → `pointerup` 8115.9 → `mouseup` / `click` 8116.0 → active 縮圖改變 8117.8（ms）
2. **作業系統真實點擊**（PowerShell 呼叫 user32 `SetCursorPos` + `mouse_event`，DPI aware；點擊前以 `WindowFromPoint` → `GetAncestor(GA_ROOT)` 確認點下去的是隔離實例主視窗的 HWND，不符就不點；主視窗暫時 `setAlwaysOnTop`，點完游標還原）：
   `window.focus` 9082.3 → `pointerdown` / `mousedown` 9083.9 → （按住 90 ms）→ `pointerup` / `mouseup` / `click` 9184.9 → active 縮圖改變 9186.7

兩種點擊順序相同：**焦點先回來（約 1.6 ms 後才 `pointerdown`），分頁切換在 `click` 之後**。現行 `App.tsx` 的 viewing effect 在 `focus` 事件當下以 `document.hasFocus()` = true、active = 原分頁 X 呼叫 `setViewingState`，X 的淡化在切到 Y 之前就被清掉 —— 與 BUG-193 的推論相同。另觀察：CDP 點擊後主視窗 `document.hasFocus()` 為 true，但 Electron `getFocusedWindow()` 仍是 focus-sink（與 T0770 的觀察一致）；真實點擊的 HWND 檢核通過、`clicked: true`。

修正後重跑同一 probe，隔離實例 debug log：
- `[workspace-waiting] focus regain: held=e2e-t0774p-a active=e2e-t0774p-b focused=true → kept`（CDP 點擊）
- `[workspace-waiting] focus regain: held=e2e-t0774p-b active=e2e-t0774p-c focused=true → kept`（真實 OS 點擊）

### 修正內容

- `src/lib/terminal-attention.ts`：集中三個時間常數並寫明理由與實測順序 —— `FOCUS_REGAIN_POINTER_GRACE_MS` = 100（實測間隔的約 60 倍；也是 Alt+Tab 回來後清除前的延遲）、`FOCUS_REGAIN_CLICK_SETTLE_MS` = 50（`pointerup` 後讓 click 處理與延後一拍的切換跑完）、`FOCUS_REGAIN_MAX_HOLD_MS` = 10 000（按住不放 / pointer 遺失的上限）。
- `src/stores/terminal-attention-store.ts`：`regainHeld`（被暫緩的分頁）＋`createFocusRegainGate({ hasFocus, setTimeout, clearTimeout, log })`。視窗由失焦變有焦點時暫緩當下 active 的分頁；100 ms 內沒有 `pointerdown` → 判斷；有 → 等 `pointerup` / `pointercancel` 後 50 ms 判斷；判斷 = 以目前 viewing 重跑 `setViewingState`（仍有焦點且仍是該分頁 → 清除，否則保留）。`setViewingState` 只跳過被暫緩的那一個分頁，其他規則不變（被點擊切過去的分頁照常立即清除）。blur / dispose 取消暫緩、不清除；重複的 focus 事件（已有焦點）不另起暫緩；`resetTerminalAttention` 一併重設。日誌 `[workspace-waiting] focus regain: held=… active=… focused=… → looked at|kept`（只有 id）。
- `src/App.tsx`（T0735 D203 ③ 的 viewing effect）：`focus` → `gate.focus()` 再 `update()`；`blur` → `gate.blur()` 再 `update()`；capture 階段 `pointerdown` / `pointerup` / `pointercancel` 接閘門；cleanup 移除並 `dispose()`。detached 視窗與 Claude 面板走同一個 effect / store，同樣適用。
- **無閃爍**：暫緩期間 viewing 的 `windowFocused` 已是 true，看著的分頁在這段時間結束等待時 `nextWaitMemory` 的 `viewed` = true，不產生淡化；暫緩只延後「清除既有淡化」。`nextWaitMemory` 本身未改。
- 未改：主行程、hook、helper / MCP 契約、⚠️ 樣式、D200–D203 其他規則。

### 單元測試與突變檢查

- 新增 `src/stores/__tests__/terminal-attention-store.focus-regain.test.ts`（12 案）：取回焦點的點擊切到別的分頁 → 保留、之後切回 → 清除；長按後切換 → 保留；只恢復焦點不點擊 → grace 到期清除；點擊留在原分頁 → 清除；延後一拍的切換 → 保留；被切過去的分頁立即清除；暫緩中與無暫緩時「看著時結束」都不留淡化；blur 中斷暫緩、重複 focus；按住不放 → max hold 到期判斷；focus 前已按下；有焦點時的點擊不觸發、被暫緩的分頁關閉後遺忘；dispose。
- **突變**：拿掉 `setViewingState` 的 `activeTerminalId !== regainHeld` 條件 → 12 案中 9 案失敗（含核心的「切到別的分頁 → 保留」），還原後 12/12 通過。
- e2e 突變：修正前的 build 跑 t0770 → E 失敗（`expect(thumbWait.locator('.attention-badge.missed')).toHaveCount(1)` Received 0），即 App 接線拿掉時 E 會失敗。

### 驗證

| 項目 | 結果 |
|---|---|
| `e2e/t0770-unfocused-wait-missed.spec.ts` 修正前（舊 build） | A–D 通過，**E 失敗**（點 Y 後 X 的淡化 0 個；`afterClick` = `{"hasFocus":true,"focusedWindow":"focus-sink"}`） |
| 同 spec 修正後（`npx vite build` 後） | **A / B / C / D / E 全 PASS**（1 passed，16.1 s） |
| `t0735-workspace-waiting-badge` / `t0761-detached-workspace-waiting` / `t0762-claude-panel-waiting` | 3 passed（20.6 s），無 skip annotation |
| `npm run typecheck` | exit 0（0 errors） |
| `npm run typecheck:electron` | exit 0（0 errors） |
| `npm run test:unit` | 381 files passed；6693 passed / 10 skipped（既有 skip） |
| `npx vite build` | exit 0 |

全部為 source build 隔離實例（`%ProgramData%\bat-e2e-*`、`BetterAgentTerminal-runtime-e2e-*`，跑完已移除）；未碰使用者正在用的 BAT。真實 OS 點擊只用於查證 probe，點擊前以 HWND 確認目標是隔離實例主視窗。

### 變更檔案

- `src/lib/terminal-attention.ts`、`src/stores/terminal-attention-store.ts`、`src/App.tsx`
- `src/stores/__tests__/terminal-attention-store.focus-regain.test.ts`（新）
- `e2e/t0770-unfocused-wait-missed.spec.ts`（情境 E；C 的註解改寫 BUG-193 已修）
- `docs/agent-guide/worker-tab-recycle.md`（D203 淡化規則補「取回焦點的點擊」一段、T0770 驗證條補 E 與實測確認、驗證清單加新測試檔）
- `CLAUDE.md`「Worker 分頁回收」節 T0735 段補一句（規則原文有變：D203 的例外）

### 遭遇問題

- 無阻擋。probe spec `e2e/t0774-probe-focus-click-order.spec.ts` 為查證用暫時檔，未 commit、已刪除（副本留在 Worker scratchpad）。

### 發現的問題 / 後續建議

- 殘留時間窗（接受，記錄）：Alt+Tab 回來後原分頁的淡化最多延後 100 ms 才清除；取回焦點後 100 ms 內使用者若剛好點另一個分頁，也會當成取回焦點的點擊（結果仍正確：沒看過原分頁）。
- 暫緩期間（最長：一次點擊的按住時間 + 50 ms）原分頁若「開始等待又結束」，因視窗已算有焦點而判為看過；此情況需在一次點擊內完成整個等待，實務上不會發生。
- 未在 macOS / Linux 實測事件順序（本單只有 Windows）；macOS 的點擊啟用視窗行為（first mouse）可能不同，若日後在 mac 觀察到淡化被誤清，看 `[workspace-waiting] focus regain` 日誌。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### Commit

- 產品：`bd59ab0f`（`git commit --only`，7 個檔）
- 工單：本回報區的 commit（`git commit --only` 本工單檔）
- 未 push
