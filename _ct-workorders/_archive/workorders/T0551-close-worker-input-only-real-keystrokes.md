---
schema_version: 1
schema_kind: workorder
id: T0551
title: "BUG-140：`--close-worker` 延遲 / 等安靜期間只把使用者真正鍵入（含貼上）算成輸入；焦點通知與終端查詢自動回覆不取消回收（本機 + 遠端 headless）"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-140
priority: P1
sizing: S
created_at: "2026-10-16T02:50:44+0800"
updated_at: "2026-10-16T17:29:35+0800"
started_at: "2026-10-16T02:52:09+0800"
completed_at: "2026-10-16T03:10:07+0800"
commit: "92655e00"
target_version: "0.6.1-pre.5（與 T0552 同批）"
depends_on: []
related:
  - "BUG-140（觀察與推測根因）；PLAN-041 / D145 / T0545（延遲期間與等安靜期間的「使用者輸入」取消語意）；T0536（遠端 headless 以 client 連線的 `pty:write` 判定）"
  - "CLAUDE.md「Worker 分頁回收（PLAN-041 / T0535，D144；等安靜 T0545，D145）」節"
affects_files:
  - electron/handlers/pty.ts
  - electron/pty-manager.ts
  - electron/close-worker.ts
  - electron/remote/headless-entry.ts
  - "src/**（若改在 renderer 區分 xterm 輸入來源，例如終端元件的 onData 路徑；需列出實際檔案）"
  - "electron/__tests__/close-worker.test.ts 與新增測試"
  - "electron/remote/__tests__/headless-close-worker-e2e.test.ts（若需補遠端案例）"
  - "CLAUDE.md（「Worker 分頁回收」節的取消語意描述）"
  - _ct-workorders/T0551-close-worker-input-only-real-keystrokes.md
  - _ct-workorders/BUG-140-close-worker-cancelled-by-focus-not-typing.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；e2e 只用隔離實例（需先 `npx vite build`）。"
  - "🔴 PLAN-041 介面契約（helper 參數、exit code、stdout）與 D145 的等安靜行為不變；只改「什麼算使用者輸入」。"
  - "🔴 T0552 可能在你之後才派，但兩張單 affects_files 不重疊；不要動 `electron/wsl-*.ts`、`electron/remote/ssh-*`、`src/components/setup-wizard/**`。"
---

# T0551 — BUG-140：Worker 回收只看真正的鍵入

## 背景

D145 / T0545 規定：`--close-worker` 排程後，延遲期間或等安靜期間只要有**使用者輸入**就取消回收（本機：`handlers/pty.ts` 對 `ctx.connectionId` 為空的 `pty:write` 呼叫 `noteUserInput`；遠端 headless：client 連線的 `pty:write`，`isUserInput` dep）。

T0550 收單時實測：延遲期間使用者只在 BAT 切換工作區 / 終端焦點、沒有在 Worker 分頁打字，到期仍記 `→ cancelled (user input during the delay)`，分頁沒有回收（細節見 BUG-140）。推測 xterm 的**自動回應**（claude CLI 開啟 focus reporting 時的 `ESC [ I` / `ESC [ O`，以及 DA / DSR 等查詢回覆）也走 `pty:write`，被當成使用者輸入。

## 任務

1. **先確認根因**：找出切換工作區 / 焦點時實際送進 Worker PTY 的寫入內容（例如在隔離實例以 node 腳本開啟 focus reporting 後切換焦點，記錄 `pty:write` 的資料）。若根因不是 focus report，照實際根因修，並在回報區說明。
2. **修正**：只有使用者鍵入（含貼上、IME 確認）才 `noteUserInput`。由你決定做法，回報區說明取捨：
   - renderer 區分 xterm `onData` 的來源（鍵盤 / 貼上 vs. 終端自動回應），把「是否為使用者輸入」帶到 IPC；或
   - main / headless 端排除純自動回應序列（`ESC [ I`、`ESC [ O`、`ESC [ <n> ; <n> R`、`ESC [ ? … c`、`ESC [ > … c` 等；只在整筆寫入**完全**由這些序列組成時排除，夾帶一般字元仍算輸入）。
   - 本機與遠端 headless 兩條路徑行為一致。寫入本身照常送進 PTY，只改「是否算輸入」。
3. **測試**：
   - 單元：延遲期間與等安靜期間送 focus in / out、DSR、DA 回覆 → 不取消；一般字元、Enter、貼上、夾帶一般字元的混合寫入 → 取消；helper（RemoteServer connectionId 有值）寫入仍不算。
   - 遠端：headless 路徑同樣排除（擴充既有 `headless-close-worker-e2e.test.ts` 或新增單元測試）。
   - 若可行，e2e（隔離實例）：Worker 分頁開 focus reporting → 排程回收 → 切換焦點 → 分頁仍被關閉。做不到就在回報區說明原因。
4. 更新 `CLAUDE.md`「Worker 分頁回收」節中「使用者輸入」的定義；BUG-140 狀態改 FIXED、填修正 commit。

## 驗收條件

- [x] 根因有證據（實際寫入內容或可重現的測試）
- [x] 焦點切換 / 終端自動回覆不再取消回收；真正鍵入仍取消（本機 + 遠端）
- [x] `npm run test:unit` 全綠（基線 4073 passed / 243 files，加上新測試）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [x] 既有 `e2e/t0535-close-worker.spec.ts` 仍通過
- [x] CLAUDE.md 已更新；BUG-140 → FIXED

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

**FIXED**（修正 commit `92655e00`，等人工驗收）。

落點檢查：**PASS**。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS；C-1 工單在 `REPO_ROOT` 下 → PASS；C-3 `affects_files` 前 5 項（排除萬用字元與 `_ct-workorders/`）皆存在 → PASS；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 產出摘要

**根因（已證實，與推測相同）**：xterm 的 focus report。隔離實例 e2e（`e2e/t0551-close-worker-focus.spec.ts`）：Worker 腳本送出 `ESC [ ? 1004 h`（claude CLI 的 TUI 也會開，binary 內有 `FOCUS_EVENTS` / `focusEvents` 模式）與 DSR 6，並以 raw mode 把 stdin 寫進檔案。
- 修正**前**的 build：排程 `--close-worker --delay-ms 8000` 後，延遲期間在 Worker / Tower 分頁縮圖之間切換、切到另一個工作區再切回 → Worker stdin 只收到 `["\u001b[I","\u001b[O","\u001b[I","\u001b[O"]`，沒有別的寫入；到期分頁**沒有關閉**（重現 BUG-140）。啟動時另收到游標位置回覆 `"\u001b[3;1R"`（DSR 自動回覆同樣會走 `pty:write`）。
- 修正**後**：同一流程 stdin 內容相同，分頁照常關閉，日誌 `→ close requested`、沒有 `cancelled`。

**修正（做法：main / headless 端排除純自動回應序列）**：
- `electron/close-worker.ts`：新增 `isTerminalAutoReply(data)`。整筆寫入**完全**由下列序列組成（可多個相連）才回 true：focus in / out、CPR / DECXCPR、DSR（`ESC [ … n`）、DA1 / DA2 / DA3、DECRQM（`… $ y`）、XTWINOPS（`ESC [ … t`）、kitty 鍵盤旗標（`ESC [ ? … u`）、滑鼠回報（SGR / urxvt / X10）、OSC / DCS 回覆（需有結束符）。非字串、空字串、夾帶任何其他字元一律算輸入。
- `electron/handlers/pty.ts`：`pty:write` 改為 `fromUser && !isTerminalAutoReply(data)` 才 `noteUserInput`；寫入本身照常送進 PTY。`registerPtyHandlers` 由 Electron main 與 headless bat-server 共用，所以本機與遠端是同一處判斷。
- `electron/pty-manager.ts`：`noteUserInput` 註解更新（不再寫「或 xterm 回應程式」）。
- **取捨**：沒有選 renderer 端區分 `onData` 來源，原因：① xterm.js 5.5 的公開 API `onData` 不分來源，要分只能碰 `_core.coreService` 私有欄位（`triggerDataEvent(data, wasUserInput)`），升版即可能壞；② 要改 `pty:write` IPC / 遠端協定簽章，headless server 收到舊版 client 的寫入仍無法分辨。main 端排除對舊 client 也有效，改動只有一處。代價：判斷靠序列形狀。已知重疊：帶修飾鍵的 F3（`ESC [ 1 ; <m> R`）與游標位置回報同形，延遲期間按它不算輸入（已寫進註解與 CLAUDE.md）。滑鼠回報也排除，所以程式開滑鼠模式時的點擊 / 滾輪不取消回收，與工單「只有鍵入（含貼上、IME 確認）才算」的定義一致。

**測試**：
- `electron/__tests__/close-worker.test.ts`：+60 個測試。`isTerminalAutoReply` 18 種自動回應 → true、17 種使用者輸入（字元、Enter、`\n`、單獨 Esc、方向鍵、SS3、F5、Shift+Tab、不完整 CSI / DCS / OSC、bracketed paste、一般貼上、IME 中文、focus + 字元、字元 + focus、回覆 + Enter）→ false；本機 `pty:write` 自動回應照常寫進 PTY 但不記輸入、每種使用者輸入都記；helper 寫入一律不算；headless（`isUserInput` = client）同規則；經 `pty:write` + 真 `PtyManager` + scheduler（fake timers）：延遲中送 focus / DSR / DA → 照常關閉、等安靜中送 focus → 安靜後照常關閉、focus 後打字 → 取消、等安靜中貼上 → 取消。
- `electron/remote/__tests__/headless-close-worker-e2e.test.ts`：最後一段（延遲 1500 ms）期間 client 送 `ESC [ O`、`ESC [ I`、`ESC [ 5 ; 1 R` → 照常收到 `terminal:close-requested`，且該段沒有 `cancelled` 日誌。
- 反向對照：暫時把 `pty.ts` 改回不排除自動回應，兩個測試檔共 6 個測試失敗；改回修正後全過。
- 新 e2e `e2e/t0551-close-worker-focus.spec.ts`（隔離實例、自訂 CLI 跑 node 腳本，不耗 token）：① 根因證據 + 切換焦點後分頁照常關閉；② 第二個 Worker 延遲中以鍵盤打 `x` → `cancelled (user input during the delay)`、分頁保留。

**驗證結果**（全部 PASS）：
| 閘門 | 結果 |
|---|---|
| `npm run test:unit` | 243 files passed，4133 passed / 1 skipped（基線 4073 + 新增 60） |
| `npm run typecheck` | exit 0 |
| `npm run typecheck:electron` | exit 0 |
| `npx vite build` | exit 0 |
| `e2e/t0551-close-worker-focus.spec.ts` | 1 passed（33.3 s）；修正前的 build 上同一個 spec 失敗於「分頁仍在」（重現） |
| `e2e/t0535-close-worker.spec.ts` | 1 passed（30.0 s） |
| `headless-close-worker-e2e.test.ts` | 8 passed |

**文件**：CLAUDE.md「Worker 分頁回收」節：「延遲、等安靜與取消」改寫「使用者輸入」定義（排除清單、已知重疊、T0551 前的行為）；「遠端 headless（T0536）」補同一判斷；「驗證」補新測試與 e2e。BUG-140 → FIXED。

**改動檔案**（commit `92655e00`）：`electron/close-worker.ts`、`electron/handlers/pty.ts`、`electron/pty-manager.ts`、`electron/__tests__/close-worker.test.ts`、`electron/remote/__tests__/headless-close-worker-e2e.test.ts`、`e2e/t0551-close-worker-focus.spec.ts`（新增）、`CLAUDE.md`。工單與 BUG-140 另一個 `(ct)` commit。`src/styles/settings.css` 的 M 不是本單變更，未動。未 push、未建 tag、未改版號。

### 互動紀錄

無（`CT_MODE=yolo`、`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 歷程

無。

### 遭遇問題

- renderer 的 `window.electronAPI.pty.write` 是 contextBridge 唯讀物件，無法在 e2e 內包裝記錄寫入；改由 Worker 腳本以 raw mode 記錄 stdin（ConPTY 有把 `ESC [ I` / `ESC [ O` 原樣交給子程序），取得實際寫入內容。
- 撰寫測試時一次 Python 字串替換把 spec 檔弄壞（自己的未追蹤新檔），已刪除重寫；另一次把 ESC 原始位元組寫進 headless 測試原始碼，已改回 `\x1b` 跳脫並以 `grep -c $'\x1b'` 確認四個檔案皆為 0。最終 commit 內容不受影響。
- 未涵蓋：遠端 headless 的 UI 層 e2e（真 client 視窗切換焦點）未做；headless 走同一個 `registerPtyHandlers` 判斷，已由 headless e2e 以 client 連線寫入自動回應驗證。

### 回報時間

2026-10-16T03:09:13+0800

---

## 塔台收單（第六十六 session，2026-10-16T03:11:39+0800）

- ✅ **T0551 已確認 FIXED**：`92655e00`（7 檔，與回報一致）+ `0e78d1ba`。塔台複驗 @ `0e78d1ba`：`npm run test:unit` 4133 passed / 243 files、`npm run typecheck` = 0、`npm run typecheck:electron` = 0。
- 根因有 e2e 證據（Worker stdin 只收到 `ESC [ I` / `ESC [ O`），修正前 build 上同一 spec 重現 BUG-140、修正後通過；取捨（main 端排除純自動回應序列、不碰 xterm 私有 API）採納。已知重疊（帶修飾鍵 F3 與 CPR 同形）接受。
- Worker 分頁回收（安裝版仍是 pre.4）：03:10:25 排程 `output 32 ms ago; will wait for quiet` → 到期 `close requested`，分頁已關。
- BUG-140 FIXED，待 pre.5 安裝後實機驗收（收單即回收時切換焦點，分頁仍應關閉）。下一張 T0552 已派（03:11:39）。

### 塔台結案（2026-10-16 17:29，第六十八 session）

- FIXED → **DONE**：BUG-140 已於 2026-10-16 第六十七 session pre.5 實機驗收 CLOSED（T0557–T0559 / T0561）。
