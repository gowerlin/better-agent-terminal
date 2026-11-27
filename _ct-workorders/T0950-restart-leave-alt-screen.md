---
schema_version: 1
schema_kind: workorder
id: T0950
title: "⏻ 重啟時一併離開舊程式留下的替代畫面（alt screen），新 shell 畫在一般畫面、保有 scrollback"
type: feature
status: DONE
repo: better-agent-terminal
priority: P3
sizing: S
created_at: "2026-11-27T21:13:26+08:00"
started_at: "2026-11-27T21:14:56+08:00"
updated_at: "2026-11-27T21:21:41+08:00"
completed_at: "2026-11-27T21:21:41+08:00"
session_ids:
  - "e3aaa7ac-158a-420c-8b7a-7ba66a8f1fee"
target_version: "下一個預覽版（`0.8.1-pre.N`，發版前與使用者確認），與 BUG-228 / 229 / 230 同一批"
depends_on: []
related:
  - "D438（使用者：T0947 的兩項建議開單）；T0947 回報區〈後續建議〉1；BUG-229；T0672 / BUG-166（「離開替代畫面」選單、不自動離開 alt screen 的規則）"
affects_files:
  - _ct-workorders/T0950-restart-leave-alt-screen.md
  - src/lib/mouse-tracking-reset.ts
  - src/lib/__tests__/
  - src/lib/pty-replay.ts
  - src/components/TerminalPanel.tsx
  - src/components/WorkspaceView.tsx
  - src/__tests__/
  - docs/agent-guide/terminal-context-menu.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0950` 寫檔（base = 派工當下的 `main`，已含 T0946 / T0947）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。同時在跑：T0949（BUG-230，electron 端）、T0951（BUG-231，⏻ 啟動命令的輸入保護，可能也動 `pty-replay.ts` / `WorkspaceView.tsx`）；之後依序合併。"
  - "🔴 背景：T0947 查證時發現，⏻ 時 claude 留下的 alt screen（DECSET 1049）不會離開，新 shell 畫在 alt buffer 上、沒有 scrollback。T0672 的規則是「不自動離開 alt screen」，理由是程式可能還在跑；⏻ 時舊程式必然已結束，理由不成立。"
  - "🔴 範圍：沿用 T0947 的時機與呼叫點（`resetLeftoverMouseTracking` 的 `before-new-pty` / `new-pty-spawned`，或同一處的共用函式），新 PTY 在同一個 xterm 開始前，xterm 仍在 alt buffer 就在本機 xterm 離開（同既有「離開替代畫面」選單的做法）。🔴 只寫本機 xterm、不寫 PTY；只在 ⏻ / 被中斷分頁恢復這類「舊程式已結束、同一個 xterm 開新 PTY」的路徑；`created: false`（PTY 還在跑）、程式執行中、T0672 的回顯偵測、右鍵選單一律不變。查證「離開 alt screen」是否也要一併重設其他舊程式留下的模式（例：bracketed paste、游標隱藏），只做與本單直接相關且查證有問題的，其他寫進回報區建議。"
  - "🔴 CLAUDE.md：「終端分頁右鍵選單與滑鼠追蹤」節 T0672 那句「不自動離開 alt screen」補上例外（⏻ / 恢復時舊程式已結束），小節標題不改名（T0595）；docs `terminal-context-menu.md` 的 T0947 節同步。"
  - "🔴 唯一實作：寫在 `src/lib/mouse-tracking-reset.ts`（或同檔附近的共用函式），consumer 只接線。"
  - "🔴 測試：真 xterm 實例：進 alt screen → ⏻ → 新 PTY → `buffer.active.type === 'normal'`；沒有進 alt screen 的分頁 ⏻ 不寫 xterm；程式執行中不動；`created: false` 不動；T0947 / T0672 既有測試不改且通過。既有測試若必然衝突 → 問塔台，不自行改。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0；改到 `electron/**` 時 `npm run typecheck:electron` = 0。實機寫〈待實機〉，不碰安裝版 BAT、不開 claude 回合。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、家目錄路徑（例路徑用 `C:\\Users\\demo`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0950 — ⏻ 重啟時離開殘留的 alt screen

## 背景

T0947（BUG-229）查證時發現：⏻ 重啟 claude 分頁時，claude 留下的替代畫面（alt screen）不會離開，新 shell 畫在 alt buffer 上、沒有 scrollback。T0672 不自動離開 alt screen 的理由（程式可能還在跑）在 ⏻ 時不成立。使用者裁示開單（D438）。

## 範圍

- ⏻ / 被中斷分頁恢復時，新 PTY 開始前在本機 xterm 離開殘留的 alt screen。
- 共用實作、只寫本機 xterm；其他路徑與程式執行中的行為不變。

## 不做

- 不寫 PTY、不改右鍵選單與 T0672 回顯偵測、不改程式執行中的 alt screen 行為。

## 驗收

- [x] 真 xterm 測試：alt screen → ⏻ → 新 PTY 在一般畫面；其他情況不動
- [x] T0947 / T0672 既有測試不改且通過
- [x] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；`npm run typecheck` = 0
- [x] 〈待實機〉步驟；CLAUDE.md 例外與 docs 更新

---

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-27T21:21:41+08:00
- **session_id**：e3aaa7ac-158a-420c-8b7a-7ba66a8f1fee
- **branch**：`ct/T0950`
- **base_sha**：`18d0a229ab342007a3aae709ac171e3543ea9c81`
- **validated_sha**：`cbc3175c4e3e9500ecaf83e4ac0eb44819f6d847`
- **head_sha**：`cbc3175c4e3e9500ecaf83e4ac0eb44819f6d847`（= validated_sha）

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 下 → PASS
- C-3：`affects_files` 前 5 筆（排除 `_ct-workorders/`）皆存在 → PASS（C-0 已通過，僅記錄）
- C-2：工單無 `branch` 欄位，不適用；目前分支 `ct/T0950`
- `CT_HOME` 已設定（主 checkout）、`CT_WORKTREE_BRANCH` = `ct/T0950`；`BAT_WORKSPACE_ID` 已設定（只作證據）；`BAT_REMOTE_TOKEN` 已設定

### 結果摘要

⏻ / 被中斷分頁恢復時，新 PTY spawn 後若分頁的 xterm 還在 alternate buffer（舊程式被強制結束、沒送 `?1049l`），就在本機 xterm 寫 `ALT_SCREEN_EXIT`（`\x1b[?1049l`）離開。新 shell 畫在一般畫面，程式開始前的畫面與 scrollback 回來。只寫 xterm、不寫 PTY。

- 唯一實作 `leaveLeftoverAltScreen(id)`（`src/lib/mouse-tracking-reset.ts`）：沒有掛載的 view、view 沒登記 `altScreenActive`、或不在 alt buffer → 不做事回 `false`；否則呼叫 view 的 `leaveAltScreen`，等 xterm 解析完（最多 `LEFTOVER_MOUSE_RESET_WAIT_MS` = 200 ms）回 `true`。
- `LeftoverMouseTrackingView` 多兩個**選用**成員 `altScreenActive?()` / `leaveAltScreen?(done)`：T0947 的 view（只有追蹤）照舊可用，既有測試不必改。
- 呼叫點（consumer 只接線）：`src/lib/pty-replay.ts` 的兩個 `new-pty-spawned` 位置，緊接在 `resetLeftoverMouseTracking(…, 'new-pty-spawned')` 之後：`restartOrCreatePty` 的 restart 成功、`createPtyWithReplay` 回 `created: true`（claude-cli 分頁的 ⏻ / 恢復走 `pty:kill` → `startClaudeCliPty` → `createPtyThenLaunch` → 這裡）。
- `src/components/TerminalPanel.tsx`：`registerLeftoverMouseTrackingView` 多登記 `altScreenActive: () => altBufferRef.current`（`onBufferChange` 維護）與 `leaveAltScreen`（`terminal.write(ALT_SCREEN_EXIT, done)`，日誌 `[mouse-tracking] alt screen left: new-pty-spawned terminal=<id>`）。
- `src/components/WorkspaceView.tsx` 不需要改：claude-cli 的路徑經 `createPtyWithReplay` 就會處理。

**時機的選擇**（工單說「`before-new-pty` / `new-pty-spawned`，或同一處的共用函式」）：只在 `new-pty-spawned`。

- 不選 `before-new-pty`：那時舊程式還在跑（claude-cli 的 `pty:kill` 之前、`pty:restart` 之前）。先離開的話，它之後以絕對座標畫的畫面會蓋在一般畫面與 scrollback 上。
- 選 spawn 之後不會吃掉新 shell 的第一段輸出：主行程 `PtyManager.create` 是同步的，回應立即送出，PTY 輸出以 `BATCH_INTERVAL_MS` = 16 ms 批次送出（`electron/pty-manager.ts:417`）。renderer 在處理回應的同一個工作內就寫入 `?1049l`，之後的輸出都畫在一般畫面。

**其他殘留模式的查證**（工單要求：只做直接相關且查證有問題的）：

- 真 xterm 5.5.0 實測：`?1049l` 不還原 DECTCEM。舊程式隱藏的游標（`?25l`），離開 alt screen 後在新 shell 仍是 `isCursorHidden === true`（測試裡有記錄，未改行為）。
- bracketed paste（2004）、focus 回報（1004）、DECCKM 也不受 1049 影響。
- 這些與 alt screen 無關：不在 alt screen 的程式被結束也會留下。沒有實機確認有問題，所以本單不處理，列在〈後續建議〉。

### 變更檔案

| 檔案 | 變更 |
|---|---|
| `src/lib/mouse-tracking-reset.ts` | `leaveLeftoverAltScreen`、view 介面兩個選用成員、檔頭說明 |
| `src/lib/pty-replay.ts` | 兩個 `new-pty-spawned` 位置各加一行呼叫 |
| `src/components/TerminalPanel.tsx` | 登記 `altScreenActive` / `leaveAltScreen` |
| `src/lib/__tests__/alt-screen-restart.test.ts`（新） | 真 xterm 16 個測試 |
| `src/__tests__/terminal-context-menu.test.tsx` | 檔尾新增 describe「alternate screen left when a new PTY starts (T0950)」2 個測試（既有測試未改） |
| `docs/agent-guide/terminal-context-menu.md` | T0947 節新增「殘留的 alt screen（T0950，D438）」，F2 / 已知限制 / 不變 / 驗證行補例外 |
| `CLAUDE.md` | 「終端分頁右鍵選單與滑鼠追蹤」節：T0672 的「不自動離開 alt screen」補例外，加 T0950 唯一實作與不變式（小節標題未改） |

### 驗證

- **source / docs**：CLAUDE.md 小節標題未改；docs 與 CLAUDE.md 同步。
- **新測試**（`src/lib/__tests__/alt-screen-restart.test.ts`，真 xterm 5.5.0）：
  - 問題重現：TUI 在 alt screen 被結束後，新 shell 畫在 alt buffer、沒有 scrollback。
  - restart 成功 → `buffer.active.type === 'normal'`，歷史行回來，新 shell 輸出畫在一般畫面且 buffer 長度 > rows。
  - restart → false → create：只離開一次。
  - `createPtyWithReplay` `created: true` → normal。
  - `created: false` / create 失敗 / restart 失敗 → 仍是 alternate。
  - 一般畫面的分頁 ⏻：`terminal.write` 沒被呼叫。
  - `before-new-pty` 的追蹤重設不離開 alt screen；程式執行中不動。
  - 沒有 view、view 已解除、T0947 形式的 view → `false`；只影響自己的 id；等待上限 200 ms。
  - `?1049l` 不還原隱藏的游標（記錄現況）。
- **反向檢查**：暫時拿掉 `pty-replay.ts` 的兩行呼叫 → 3 個測試失敗（restart ok、PTY gone、created），還原後全過。
- **TerminalPanel**：`src/__tests__/terminal-context-menu.test.tsx` 55 / 55 通過（含 T0672 / T0947 既有測試與新增 2 個）。
- **T0947**：`src/lib/__tests__/mouse-tracking-restart.test.ts` 未改、全過。
- **`npm ci`**：worktree 原本沒有 `node_modules`，已依 CLAUDE.md 安裝（`electron-winstaller` install script 被擋屬預期）。
- **`npm run test:unit`**（head `cbc3175c`，第一次完整執行）：Test Files 516 passed | 3 skipped（519）；Tests 9346 passed | 47 skipped（9393）；exit 0。
- **`npx vite build`**：exit 0。
- **`npm run typecheck`**：0。
- **`npm run typecheck:electron`**：未改 `electron/**`，不需要。
- **實機**：見〈待實機〉，本單未執行。

### 待實機

不碰安裝版 BAT；以下由使用者在含本單的版本執行：

1. 開「以塔台開啟 Claude」或 Claude CLI 分頁，先在 shell 打幾行指令（留下 scrollback），等 claude 全螢幕畫面出來。
2. 按 ⏻。預期：claude 的畫面消失，回到 claude 啟動前的一般畫面，新 shell 的提示列 / claude 啟動命令接著畫；滑鼠滾輪可往上看到步驟 1 的指令（有 scrollback）。新 claude 起來後照常進 alt screen。
3. Codex CLI 分頁：codex 開著時按 ⏻，同樣回到一般畫面、有 scrollback。
4. 一般 shell 分頁（沒有 TUI）按 ⏻：畫面行為與修正前相同。
5. 對照：程式執行中（claude / vim 開著、沒按 ⏻）右鍵選單的「離開替代畫面」照舊出現、照舊只在點選時才離開。
6. debug log 應有 `[mouse-tracking] alt screen left: new-pty-spawned terminal=<id>`（步驟 2、3），步驟 4 沒有。
7. 觀察：步驟 2 / 3 之後游標是否看得到；WSL / SSH 分頁特別注意（見〈後續建議〉1）。

### 相關通過案例判定

工單沒有〈相關通過案例〉段，不適用。

### 遭遇問題

無阻礙。

### 偏離與說明

- 工單「範圍」允許在 `before-new-pty` 或 `new-pty-spawned` 擇一（或共用）。本單只在 `new-pty-spawned` 離開，理由見〈結果摘要〉。
- `WorkspaceView.tsx` 在 `affects_files` 但不必改。
- 已知限制（寫進 docs）：
  - `pty:restart`（一般 / codex 分頁）在主行程內同步 kill + create，舊程式被結束前最後 16 ms、還在批次裡的輸出會在回應之後才送到；若是一個畫面，就會畫在一般畫面上。claude-cli 分頁先 `pty:kill` 再 create，不受影響。
  - Terminal Server recovery 不處理（同 T0947）。

### 後續建議（交塔台）

1. **游標可能殘留隱藏**：`?1049l` 不還原 DECTCEM。被強制結束的 TUI 若隱藏了游標，⏻ 後新 shell 的游標仍看不到；真 xterm 已實測 `isCursorHidden` 維持 true。Windows ConPTY 新 shell 的初始畫面通常會送 `?25h`，WSL / SSH / macOS / Linux 的 bash 不送。建議先依〈待實機〉步驟 7 確認；有問題再另開單，在同一個 `new-pty-spawned` 時機補 `?25h`（只寫 xterm）。
2. bracketed paste（2004）、focus 回報（1004）、DECCKM 也可能被舊程式留著。bash 會自己開 2004，影響小；沒有實機問題前不建議處理。

### 互動紀錄

- [21:14] 開工；CT_MODE=yolo，worktree `ct/T0950`。無塔台補充段落（baseline 空）。全程未向塔台提問。

### Renew 歷程

無。
