---
schema_version: 1
schema_kind: workorder
id: T0569
title: "BUG-143：終端分頁的 BAT 右鍵選單開著時，按 Esc 關閉選單（終端有焦點也一樣），且該次 Esc 不送進 PTY"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-143
priority: P2
sizing: XS
created_at: "2026-10-16T17:47:20+0800"
updated_at: "2026-10-16T21:48:35+0800"
started_at: "2026-10-16T17:48:12+0800"
completed_at: "2026-10-16T17:54:04+0800"
commit: "fb66c0bc"
target_version: "0.6.1-pre.7（與 BUG-142 / T0568 同批，未排發版）"
depends_on: [T0568]
related:
  - "BUG-143；BUG-142 / T0568（同一個右鍵選單，`src/lib/terminal-context-menu.ts`）；BUG-011a（原 Esc 關選單設計）；T0567（Dialog Esc 統一，`src/components/common/modal-stack.ts`，右鍵選單不是 Dialog）"
affects_files:
  - src/components/TerminalPanel.tsx
  - "src/lib/terminal-context-menu.ts（若需要）"
  - "src/__tests__/terminal-context-menu.test.tsx 或新增測試"
  - "e2e/t0568-context-menu-mouse-tracking.spec.ts（可把點外部關選單改回 / 補上 Esc 案例）"
  - "CLAUDE.md（「終端分頁右鍵選單與滑鼠追蹤（T0568 / BUG-142）」節補一句）"
  - _ct-workorders/T0569-terminal-context-menu-esc-closes.md
  - _ct-workorders/BUG-143-terminal-context-menu-esc-not-closing.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 T0568 的行為（滑鼠追蹤時不開選單、Shift + 右鍵照開）不變；選單沒開時 Esc 照常送進 PTY（claude CLI 的 Esc 中斷不得受影響）。"
---

# T0569 — BUG-143：終端右鍵選單按 Esc 關閉

## 背景

T0568 Worker 觀察：xterm 分頁打開 BAT 右鍵選單後，終端仍有焦點，按 Esc 關不掉選單。推測 Esc 先進 xterm textarea，xterm 處理按鍵時 `stopPropagation`，`TerminalPanel.tsx` 在 `document` 上的 BUG-011a listener 收不到（見 BUG-143）。

## 任務

1. **確認根因**（實際的事件路徑），以及選單開著時按 Esc 是否也被送進 PTY。
2. **修正**：選單開著時按 Esc → 只關選單、**不**送進 PTY；選單沒開時 Esc 行為完全不變。做法由你決定並在回報區說明（例：選單開啟時以 xterm `attachCustomKeyEventHandler` 攔下 Esc、或在 capture 階段處理、或打開選單時把焦點移到選單）。IME 組字中的 Esc 不當成關選單（比照 T0567）。
3. **測試**：單元 / 元件：選單開著 + 終端有焦點時 Esc 關閉且不寫 PTY；選單沒開時 Esc 照常寫 PTY。e2e：擴充 `e2e/t0568-context-menu-mouse-tracking.spec.ts` 或新增，在隔離實例以 Esc 關選單，並確認腳本 stdin 沒收到 `\x1b`。
4. BUG-143 → FIXED、填修正 commit；CLAUDE.md T0568 那節補一句。

## 驗收條件

- [x] 根因有證據
- [x] 選單開著時 Esc 關閉選單且不送進 PTY；選單沒開時 Esc 不變；T0568 行為不變
- [x] `npm run test:unit` 全綠（基線 4606 passed / 265 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [x] BUG-143 → FIXED

---

## 回報區

> 以下由 sub-session 填寫

### 結果摘要

**FIXED**（commit `fb66c0bc`）。根因與推測一致，而且確認了 Esc 同時被送進 PTY。現在選單開著、終端有焦點時按 Esc 只會關選單，不會送進 PTY；選單沒開時 Esc 照常送出。

### Landing check

- C-0：`repo: better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 底下 → PASS
- C-3：`src/components/TerminalPanel.tsx` 存在 → PASS（只供參考）
- C-2：工單沒有 `branch` 欄位 → 不適用（實際在 `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 結論：PASS
- 工單原狀態為 `TODO`（不是 `PENDING`），已照開始流程改成 `IN_PROGRESS`。

### 根因證據

1. **xterm 5.5.0 原始碼**（`node_modules/@xterm/xterm/src/browser/Terminal.ts`）：`_keyDown` 先呼叫 `_customKeyEventHandler`，回 `false` 就直接結束；否則 Escape 經 `evaluateKeyboardEvent` 得到 `ESC`，接著 `coreService.triggerDataEvent(result.key, true)` 觸發 BAT 的 `onData` → `pty.write`，最後 `cancel(event, true)`（`preventDefault` + `stopPropagation`）。這個 listener 掛在 xterm 的 textarea 上，所以事件不會冒泡到 `document`。
2. **隔離實例探測**（修正前的 build，也就是 T0568 版的 `dist`；暫時的 spec，跑完已刪除，沒有 commit）：在 shell 分頁裡跑 node 腳本，以 raw mode 記錄 stdin。右鍵開選單後，`document.activeElement` 為 `xterm-helper-textarea`；按 Esc → **選單仍在**（`.context-menu` 數量 1）、**腳本 stdin 收到 `"\u001b"`**、window capture listener 收到 1 次、document bubble listener 0 次。
3. 同一個探測在修正後：選單數量 0、stdin 沒有收到任何東西（window capture 仍是 1、document bubble 仍是 0，代表 Esc 在 xterm 的 key handler 就被處理掉了）。

### 修正與取捨

- **做法：用 xterm 的 `attachCustomKeyEventHandler` 攔下 Esc。** 這是 xterm 處理按鍵之前唯一的掛鉤，回 `false` 時 xterm 不會寫進 PTY。其他方案的問題：
  - capture 階段攔截：必須自己 `stopPropagation`，xterm 才不會處理，但這樣會擋到其他同樣掛在 capture 的 listener，影響範圍比較大。
  - 開選單時把焦點移到選單：關選單後得把焦點還給 xterm；選單在 portal 裡，點選單項目和點外部時的焦點路徑也得重新處理。
- `TerminalPanel.tsx`：新增 `contextMenuOpenRef`，每次 render 時同步（key handler 只在建立終端時掛一次，所以讀 ref）。key handler 在 IME 判斷之後、其他快捷鍵之前呼叫 `shouldCloseTerminalContextMenuOnKey`，成立時就 `preventDefault` + `stopPropagation`、把 ref 設成 false、`setContextMenu(null)`、記一行 `dlog` `[terminal-context-menu] terminal=… closed by Escape (not sent to the terminal)`，然後回 `false`。`stopPropagation` 是為了避免這次 Esc 再觸發外層的 Esc 處理（例如 window 層的快捷鍵）。
- `src/lib/terminal-context-menu.ts`：新增 `shouldCloseTerminalContextMenuOnKey(event, menuOpen, imeComposing)`，條件是選單開著、`key === 'Escape'`、沒有在組字（`imeComposing`、`event.isComposing`、keyCode 229 三者都不成立）。組字中的 Esc 照舊交給 xterm 取消組字，比照 T0567。
- **不變的部分**：
  - 選單沒開時 Esc 照常送進 PTY，所以 claude CLI 的 Esc 中斷不受影響（有單元測試和 e2e 步驟 3b）。
  - 焦點不在終端時，原本 `document` 上的 BUG-011a listener 照樣負責關選單。
  - T0568 的行為（追蹤中不開選單、Shift + 右鍵照開）沒有動，e2e 全部步驟仍然通過。

### 變更檔案

- `src/lib/terminal-context-menu.ts`
- `src/components/TerminalPanel.tsx`
- `src/__tests__/terminal-context-menu.test.tsx`（+8 個測試）
- `e2e/t0568-context-menu-mouse-tracking.spec.ts`（步驟 1 改用 Esc 關選單；步驟 3 用 Esc 關選單，並檢查 stdin 沒有 `ESC`；新增步驟 3b：選單沒開時 Esc → stdin 收到 `ESC`）
- `CLAUDE.md`（「終端分頁右鍵選單與滑鼠追蹤」節新增「選單開著時的 Esc」一條，驗證那條也補上 T0569）
- `_ct-workorders/BUG-143-terminal-context-menu-esc-not-closing.md`、本工單

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run test:unit` | PASS：265 個檔案、4614 passed、3 skipped（基線 265 / 4606，新增 8 個測試） |
| `npm run typecheck` | PASS（exit 0） |
| `npm run typecheck:electron` | PASS（exit 0） |
| `npx vite build` | PASS（exit 0） |
| 單元 / 元件測試 | 判斷函式：選單開著的 Esc 成立；選單沒開、其他鍵、`Esc`（舊鍵名）、組字中（三種訊號）都不成立。元件測試照 xterm `_keyDown` 的流程模擬：選單沒開時 Esc 寫進 PTY；選單開著時 Esc 回 `false`、`defaultPrevented`、選單關閉、沒有寫 PTY、有 dlog，下一次 Esc 又會寫進 PTY；追蹤中用 Shift + 右鍵開的選單也能用 Esc 關；組字中選單不關；其他鍵選單不關；焦點在終端外時 `document` 的 Esc 仍會關選單 |
| e2e `e2e/t0568-context-menu-mouse-tracking.spec.ts` | PASS（隔離實例，修正後的 build）。log：`stdin after Shift+right-click and Esc: ""` |
| 根因探測（暫時 spec） | 修正前：選單仍在、stdin `["\u001b"]`；修正後：選單關閉、stdin `[]` |
| 實機 BAT（使用者的 9876） | 沒碰。要等下一版 pre 安裝後由使用者確認 |

### Commit

- `fb66c0bc` fix(terminal): Esc closes the right-click menu while the terminal has focus (T0569, BUG-143)
- 收尾 commit：BUG-143 與本工單（ct）
- 沒有 push、tag、workflow，也沒改版號。`src/styles/settings.css` 的 M 不是本工單的變更，沒有動。`_bug-tracker.md` 沒改（T0568 也沒改，交給塔台同步）。
