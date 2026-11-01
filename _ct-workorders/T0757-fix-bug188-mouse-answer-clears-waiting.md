---
schema_version: 1
schema_kind: workorder
id: T0757
title: "修正 BUG-188：用滑鼠回答後 ⚠️ 也要清除（先以真 claude / codex 查證各路徑，再精準修）"
type: implementation
status: DONE
started_at: "2026-11-02T02:24:55+0800"
updated_at: "2026-11-02T02:53:14+0800"
completed_at: "2026-11-02T02:53:14+0800"
session_ids:
  - "73a969f3-bc73-4e57-8128-2b7743e6e242"
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-02T02:23:44+0800"
depends_on: []
related:
  - "BUG-188；D209；`docs/agent-guide/blocked-state.md`〈清除漏洞〉與事件表；T0594 / T0597 / T0620 / T0657（既有清除 hook）；T0735 / D203（工作區 ⚠️、淡化）"
  - "`electron/terminal-blocked-state.ts`（`TerminalBlockedTracker`、`hookEventReason`）、`scripts/bat-hook.mjs`、`electron/bat-mcp-launch.ts` `BAT_CLAUDE_HOOKS`、`electron/close-worker.ts` `isTerminalAutoReply`、`src/lib/terminal-attention.ts`、`src/stores/terminal-attention-store.ts`"
  - "假模型 e2e 基礎：`e2e/fixtures/fake-anthropic-api.ts`、`e2e/v072-pre8-workspace-waiting-real-agents.spec.ts`（T0736）、`e2e/t0735-workspace-waiting-badge.spec.ts`"
affects_files:
  - electron/terminal-blocked-state.ts
  - electron/bat-mcp-launch.ts
  - scripts/bat-hook.mjs
  - electron/handlers/pty.ts
  - electron/__tests__/
  - src/lib/terminal-attention.ts
  - src/stores/terminal-attention-store.ts
  - src/components/TerminalPanel.tsx
  - src/lib/__tests__/
  - src/stores/__tests__/
  - e2e/
  - docs/agent-guide/blocked-state.md
  - docs/agent-guide/worker-tab-recycle.md
  - CLAUDE.md
  - _ct-workorders/T0757-fix-bug188-mouse-answer-clears-waiting.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先查證（D209：先查證再精準修）：以真的內嵌 claude CLI ＋假 Anthropic API（T0736 作法，不耗 token）在隔離實例重現，並以滑鼠點擊（xterm 滑鼠回報，與使用者實際操作相同）回答：① 權限對話框以滑鼠允許；② 以滑鼠拒絕；③ AskUserQuestion 以滑鼠選答案；④ 以滑鼠取消 / 拒絕 AskUserQuestion；⑤ elicitation 能觸發就驗、不能觸發照實寫。每條記錄 claude 送出的 hook 事件（`bat-scripts.log` / debug log）與 ⚠️ 何時清除。codex（內嵌 0.166）：⑥ 讓 codex 進入 `input` 等待後以滑鼠回答，記錄 OSC 7501 序列。先寫查證表（路徑 × hook / OSC × 清除時間），再動程式。"
  - "🔴 修正方向（D209）：有 agent 信號（hook / OSC）可用的路徑，用該信號精準清除（例：查證發現 `Stop` 或其他 hook 會到）；沒有信號可用的路徑，才退回「blocked 中的分頁收到滑鼠**按下**（SGR / X10 / urxvt 的 press，不含放開、滾輪、移動、拖曳）視同回答，清除 hook reason（`permission` / `question` / `elicitation`）」。🔴 不改 `isTerminalAutoReply` 的語意與 `--close-worker` 的取消規則（滑鼠仍不取消回收）；不改 `blocked` / `blockedReason` / `blockedDetection` 契約欄位與值（T0590 / T0600 / T0621 契約）；`tower` 問題不受滑鼠影響。🔴 codex `input`：CLAUDE.md 規定使用者輸入不清除；若查證 codex 滑鼠回答後自己會送狀態 → 不改；若不會 → 先問塔台（改契約需決策），不得自行放寬。"
  - "🔴 驗收情境（e2e，隔離實例＋假 API）：上列 ①–④（與 ⑥ 若有改）以滑鼠回答後，該分頁縮圖 ⚠️ 與工作區列 ⚠️ 清除；看著分頁時回答不留淡化；滾輪捲動 blocked 分頁不清除；鍵盤回答照舊清除。突變檢查：拿掉修正，滑鼠情境要失敗。重跑 `t0735-workspace-waiting-badge`、`v072-pre8-workspace-waiting-real-agents`、`t0609`、`t0590`（若存在）綠。"
  - "🔴 驗證：新增 / 修改的單元測試＋突變檢查（拿掉修正，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`（依上方 build 規則的位置）。"
  - "🔴 build（Lane A：T0757 → T0761 → T0762 → T0763 → T0764，依序執行）：本單在主 checkout 跑 `npx vite build` 與 e2e；Lane B（T0758 → T0759 → T0760）只在匯出目錄 build，不影響本單。e2e 一律用 `e2e/fixtures/electron-isolation.ts` 隔離實例，不碰使用者正在用的 BAT、userData 與 WSL bat-server。"
  - "🔴 文件：更新 `docs/agent-guide/blocked-state.md`〈清除漏洞〉為查證後的結果；CLAUDE.md「blocked 狀態偵測」或「Worker 分頁回收」節只加必要的一兩句（遵守 CLAUDE.md 撰寫規則 T0595）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0757 — 修正 BUG-188：用滑鼠回答後 ⚠️ 也要清除（先以真 claude / codex 查證各路徑，再精準修）

## 元資料

- **工單編號**：T0757
- **類型**：implementation
- **優先級**：P1
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：M

## 背景

使用者指示（D209）：不論鍵盤或滑鼠，回答後的結果一樣是有回答，⚠️ 都要清除。目前鍵盤輸入會清除；滑鼠回報不算輸入，部分路徑靠 hook 清除（部分未實機觸發），仍有路徑要等回合 `Stop` 才消失。使用者選「先查證再精準修」。

## 範圍

1. 以真 claude / codex ＋假模型重現各滑鼠路徑，產出查證表。
2. 依查證結果修正：先用 agent 信號，沒有才退回「滑鼠按下視同回答」。
3. e2e、單元測試、文件。

## 不做

- 不改 `--close-worker` 的使用者輸入判定；不改 blocked 契約欄位；不改 Claude Agent 面板（T0762）；不改 detached 視窗（T0761）；不發版。

## 驗收

- [x] 查證表（路徑 × 信號 × 清除時間），修正前後對照
- [x] 滑鼠情境 e2e 綠＋突變檢查；既有 ⚠️ e2e 綠
- [x] typecheck 0 / 0、`test:unit`、`vite build`
- [x] docs / CLAUDE.md 更新

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：FIXED（實作與自動驗收完成，待使用者實機驗收 BUG-188）
- **產品 commit**：`de8a4fd4`（fix: a mouse answer clears the waiting ⚠️ like a key does）
- **session_id**：73a969f3-bc73-4e57-8128-2b7743e6e242
- **落點檢查**：PASS — C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `affects_files` 皆存在；C-2 無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE` = yolo、`CT_INTERACTIVE` = 0；`CT_HOME` 未設（非 worktree）。

### 產出摘要

**1. 查證表（D209：先查證再修；修正前的 build）**

方法：隔離實例（`e2e/fixtures/electron-isolation.ts`）＋內嵌 claude 2.1.316 / codex 0.166.0 ＋假 Anthropic / Responses API ＋擋外連 proxy（不耗 token），以 Playwright 在終端畫面上點擊選項文字（xterm 自己產生 SGR 滑鼠回報送進 PTY，與使用者操作相同；e2e 記錄 xterm 實際送出的位元組，例 `ESC[<0;8;22M` / `ESC[<0;8;22m`）。claude 只有 fullscreen renderer（`tui: fullscreen`，使用者本機設定即如此）開滑鼠追蹤（`mouseTrackingMode` = `any`、alt screen）；預設 renderer 不追蹤滑鼠。elicitation 以本單 spec 內建的零依賴 stdio MCP server 觸發。查證跑了 3 輪（probe1、probe2 完整重現、probe4 以最終 spec 的 `T0757_PROBE=1` 再跑），結果一致。

| 路徑（滑鼠點擊） | claude / codex 反應 | hook / OSC（`bat-scripts.log` / debug log） | ⚠️ 清除時間（修正前） | 修正後 |
|---|---|---|---|---|
| ① 權限「1. Yes」 | 允許、工具執行、回合繼續 | `post-tool-batch` → cleared（點擊後約 0.56 s），`stop` | 約 0.6 s | 按下即清（`mouse press`），之後 `post-tool-batch` → unchanged |
| ② 權限「4. No」 | 中斷回合（`Interrupted · What should Claude do instead?`） | **無**（無 `PostToolBatch`、無 `Stop`；12 s 觀察窗） | **不清**，留到下次鍵盤輸入 / 送出 prompt（BUG-188） | 按下即清（`mouse press`） |
| ③ AskUserQuestion「1. Alpha」 | 回答、回合繼續 | `ask-user-question-done` → cleared（約 0.16 s）、`post-tool-batch` / `stop` unchanged | 約 0.2 s | 按下即清（`mouse press`） |
| ④ AskUserQuestion「Chat about this」（滑鼠取消 / 拒絕） | **不接受點擊**，對話框留著；取消只能 Esc（鍵盤，本來就清） | 無 | 不清（也沒有回答） | 按下即清，對話框仍開著（見遭遇問題 2） |
| ⑤ elicitation「Decline」/「Accept」 | **不接受點擊**，表單留著；只能鍵盤 | 無 | 不清（也沒有回答） | 按下即清，表單仍開著（同上） |
| ⑥ codex 0.166 核准「1. Yes, proceed」 | **不接受點擊**（滑鼠只用於捲動），提示留著；`y` 回答 → OSC 7501 `working` | 點擊後無 OSC 7501 | `input` 不清（也沒有回答） | 不變：`input` 不受滑鼠影響；`y` → `cleared (osc working)` |

結論：有 agent 信號的 ① / ③ 本來就由 hook 精準清除；唯一真正「回答了但沒有信號」的是 ②（滑鼠拒絕權限）。④ / ⑤ / ⑥ 在目前版本無法以滑鼠回答。codex 不需改、不涉及契約變更，所以沒有問塔台。

**2. 修正（D209 退回方案）**

- `hasMouseButtonPress`（`electron/terminal-blocked-state.ts`）：判斷 `pty:write` 是否含滑鼠**左鍵按下**（SGR `ESC[<b;x;yM`、urxvt、X10；可帶 Shift / Meta / Ctrl）；放開、移動 / 拖曳（+32）、滾輪（+64）、8–11 鍵（+128）、中鍵 / 右鍵都不算。
- `TerminalBlockedTracker.clearForMousePress`：清 hook reason（`permission` / `question` / `elicitation`），日誌 `[blocked] terminal=<id> → cleared (mouse press)`；不清 codex `input`（同 `clearForUserInput` 規則）。`tower` 不在 tracker 內，不受影響。
- `PtyManager.noteMousePress`（`electron/pty-manager.ts`）：只呼叫上面那個，不更新 `lastUserInputAt`。
- `pty:write`（`electron/handlers/pty.ts`）：原本「使用者寫入且不是純自動回應 → `noteUserInput`」不變；新增 else 分支「使用者寫入、純自動回應、含左鍵按下 → `noteMousePress`」。`isTerminalAutoReply` 語意、`--close-worker` 取消規則、`onUserInput`（用量限制等待）都沒改；helper 連線與 `{ auto: true }` 照舊不算。本機與 headless 共用同一 handler。
- 不改 blocked 契約欄位 / 值（T0590 / T0600 / T0621），renderer 端（`terminal-attention.ts` / store / TerminalPanel）不需改：清除經既有 `onChange` → `terminal:attention-changed` 推送，淡化規則（D203）照舊。

**3. 測試與驗收**

- 單元測試 `electron/__tests__/blocked-mouse-press.test.ts`（49 項）：`hasMouseButtonPress` 10 種按下 / 22 種非按下；接受的按下皆為 `isTerminalAutoReply`；`clearForMousePress`（三種 hook reason、`input` 不清、日誌、onChange）；`pty:write`（三種 reason 各：滾輪 / 移動 / 單獨放開 / 右鍵 / helper / `{ auto }` 不清，左鍵點擊清；`lastUserInputAt` 仍為 null、`onUserInput` 未呼叫、寫入照送 PTY；未 blocked / 未知 id 不動；codex `input` 不被按下清、codex OSC 照清；鍵盤照舊）。
  - 突變檢查：把 handler 的 `manager.noteMousePress(id)` 換成 no-op → 3 項失敗；已還原。
- e2e `e2e/t0757-mouse-answer-clears-waiting.spec.ts`（隔離實例＋真 claude fullscreen / 真 codex＋假模型，不耗 token）：①–⑤ 點擊後縮圖 ⚠️ 與工作區列 ⚠️ 清除、`document.hasFocus()` = true 下不留淡化；W 滾輪 6 次不清（縮圖與列 ⚠️ 仍在）；K Enter 照舊 `cleared (user input)`；⑥ codex 點擊後無 OSC、`input` 與 ⚠️ 保留，`y` → `cleared (osc working)`；日誌無權杖、無模型 API 外連。另含 `T0757_PROBE=1` 查證模式（claude / codex 升版時重跑查證表）。
  - 修正後：**1 passed**（1.0 m，結果見下）。
  - 突變檢查：在修正前的 build 跑同一 spec → ① 通過、**② 失敗**（`② cleared: not seen`，畫面為 `Interrupted · What should Claude do instead?`）。
- 既有 e2e：`t0735-workspace-waiting-badge`、`v072-pre8-workspace-waiting-real-agents`、`t0609-worker-attention-badge`、`t0590-blocked-state` → **4 passed**（42.8 s）。
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` = 366 files / 6542 passed（10 skipped）、`npx vite build` exit 0（主 checkout，HEAD `b8a49ce9` 時；同一 checkout 當時有其他 Worker 的未提交修改，也一起進了該次 build）。

驗收 e2e 結果摘錄（修正後）：
- ① `cleared (mouse press)`；hooks 之後 `post-tool-batch→unchanged`、`stop→unchanged`；工具執行
- ② `cleared (mouse press)`，點擊後無其他 hook
- ③ `cleared (mouse press)`
- ④ `cleared (mouse press)`；claude 對話框仍開著（不支援點擊，Esc 關）
- ⑤ `cleared (mouse press)`；claude 表單仍開著（同上）
- W 滾輪：仍 blocked、縮圖與列 ⚠️
- K Enter：`cleared (user input)`
- ⑥ codex：點擊無 OSC、`input` 保留；`y` → `cleared (osc working)`

**4. 文件**

- `docs/agent-guide/blocked-state.md`：新增「滑鼠回答」查證表與修正說明；「清除規則」加滑鼠左鍵按下；日誌原因加 `mouse press`；舊「清除漏洞」標明由 T0757 取代（保留推論紀錄）；驗證清單加本單測試。
- `docs/agent-guide/worker-tab-recycle.md`：使用者輸入定義處加一句（滑鼠按下清 blocked 但不算輸入、不取消回收）。
- `CLAUDE.md`「blocked 狀態偵測」節加一條（必守：仍不算使用者輸入、不清 codex `input`）。

### 相關檔案

- `electron/terminal-blocked-state.ts`、`electron/pty-manager.ts`、`electron/handlers/pty.ts`
- `electron/__tests__/blocked-mouse-press.test.ts`（新）、`e2e/t0757-mouse-answer-clears-waiting.spec.ts`（新）
- `docs/agent-guide/blocked-state.md`、`docs/agent-guide/worker-tab-recycle.md`、`CLAUDE.md`

### 遭遇問題

1. **範圍外檔案**：`electron/pty-manager.ts` 不在 `affects_files`，但 handler 拿到的是 `PtyManager`，tracker 是它的私有成員，必須加一個 11 行的 `noteMousePress`（與 `noteUserInput` 同型）。屬實作必要的最小改動，未另問塔台，在此記錄。
2. **退回方案的代價（判斷，供塔台／使用者參考）**：滑鼠無法分辨點到哪個選項，所以 blocked 中任何左鍵按下都清 ⚠️。在 ④ / ⑤（claude 不接受點擊）的對話框內點一下，⚠️ 會消失但對話框仍開著；claude 在終端剛取回焦點（先 focus-out）後、以及滾輪捲動後也會忽略對話框上的點擊（e2e 實測），這時 ⚠️ 同樣已被清除。這與鍵盤現況一致（方向鍵等不回答的按鍵本來就會清），符合 D209「鍵盤或滑鼠結果一致」。若要更保守，替代方案是只讓按下清 `permission`（查證表中唯一需要的 ②），④ / ⑤ 的點擊就不會誤清；目前未採用（工單明定退回方案清三種 hook reason）。
3. **只算左鍵**：工單寫「按下（不含放開、滾輪、移動、拖曳）」，我再排除中鍵 / 右鍵與 8–11 鍵（回答 TUI 選項用的都是左鍵；右鍵 / 中鍵在 TUI 內常是貼上或選單），範圍比工單窄。
4. e2e 撰寫時遇到 claude 自身行為：點擊落在「1.」與標籤間的空白不算點到選項；終端失焦後（點了縮圖）第一下點擊被忽略；捲動後點擊被忽略。spec 已改為點標籤字詞中央、不點縮圖、滾輪放在最後（W→K），並記在 spec 開頭與 docs。
5. 本機工具：在 Git Bash 用 `python - <<'EOF'` 改含非 ASCII 字串的檔案會以 cp950 讀腳本而比對不到（一次編輯未套用，導致一次 probe 重跑完整流程，正好成為重現驗證）；之後改用 Edit 工具。
6. 塔台在 `0217c1df` 一併 commit 了本單的 IN_PROGRESS 標記，無衝突。

### 後續建議

- BUG-188 實機驗收：使用者本機（`tui: fullscreen`）以滑鼠拒絕權限 → ⚠️ 應立即消失；以滑鼠允許 / 選 AskUserQuestion 選項同樣立即消失。
- claude / codex 升版時跑 `T0757_PROBE=1 npx playwright test e2e/t0757-mouse-answer-clears-waiting.spec.ts`，若 claude 開始支援點擊取消 AskUserQuestion / elicitation、或 codex 支援點擊核准，查證表需更新。

### 互動紀錄

- 無（yolo；未向塔台提問：codex 查證結果為滑鼠無法回答，不涉及放寬「使用者輸入不清除 `input`」）。

### 回報時間

- 2026-11-02T02:52:19+0800
