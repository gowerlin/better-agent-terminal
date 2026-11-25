---
schema_version: 1
schema_kind: workorder
id: T0917
title: "修 BUG-221：claude 全螢幕（alt screen）塔台往上捲之後維持閱讀保護，不在停手 10 秒後就放行 Worker 通知"
type: bugfix
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T12:19:45+08:00"
updated_at: "2026-11-25T12:38:34+08:00"
started_at: "2026-11-25T12:22:31+08:00"
completed_at: "2026-11-25T12:38:34+08:00"
session_ids:
  - "0d01439c-f65b-4d11-b2e9-06520b726083"
target_version: "0.8.0-pre.3（與 CT 6.1.0 同日發佈）"
depends_on: [T0915]
related:
  - "BUG-221；D337；PLAN-068 W2（T0904 通知保護）；T0902 待實機 T-3；T0915 回報區〈建議開 BUG〉第 2 點；CT checklist M-C2-b（預期：通知最多等 60 秒、畫面不被拉回底部）"
affects_files:
  - _ct-workorders/T0917-fix-bug221-fullscreen-tower-reading-hold.md
  - src/lib/tower-reading-state.ts
  - src/lib/__tests__/tower-reading-state.test.ts
  - src/components/TerminalPanel.tsx
  - src/__tests__/
  - e2e/t0904-tower-notify-protection.spec.ts
  - e2e/fixtures/
  - docs/agent-guide/tower-inbox.md
  - site/tower-inbox.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0917（塔台已預先從 `v0.8.x` `4f7484bc` 建立分支 `ct/T0917`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 分支：只在 `ct/T0917` 寫檔；開工確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `4f7484bceb4fac693f0d35fd0285b93bb4d8c146`，不符就停下問塔台。不 merge / rebase / push、不動 `main` 與 `v0.8.x`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 塔台決定的方向（D337）：只改契約 2 塔台分頁、**alt buffer** 時的閱讀信號：往上捲（滾輪向上 / PageUp / Shift+PageUp）之後維持「閱讀中」，直到下列任一發生才開始既有的 10 s linger 或直接結束：使用者在該分頁有鍵盤輸入（送進 PTY 的使用者輸入）、在終端內點擊、滾輪向下累計抵銷向上累計（能判斷「捲回底部」就用；不能精確判斷就以累計量近似，並在回報說明）、分頁不再是 active / 失去焦點（擇一，說明理由）、alt buffer 切回 normal。上限仍由主行程既有的 `reading` 60 s 決定（從擋住佇列起算），🔴 不改 60 s、不改主行程 notify-hold 規則與常數。🔴 normal buffer 的判斷（`viewportY < baseY`、選取、滾輪＋10 s linger）完全不變。"
  - "🔴 唯一實作仍是 `src/lib/tower-reading-state.ts` `TowerReadingTracker`（純邏輯）；`TerminalPanel.tsx` 只接線。不改 xterm 寫進 PTY 的滑鼠回報、不攔截滾輪（T0698 codex 滾輪回報、T0672 不受影響）。"
  - "🔴 不回歸（R-G003 第 3 點）：回報區列〈相關通過案例〉：T0915 M-C2-a、M-C3、M-C4、M-C5 的 PASS 項、`e2e/t0904-tower-notify-protection.spec.ts` ①–⑤（⑤「停手 10 s 放行」若用 normal buffer 的假 TUI 應不變；若它跑在 alt screen 而預期改變，說明並更新斷言，不得刪測試）。"
  - "🔴 驗證：單元測試涵蓋 alt buffer 往上捲後超過 10 s 仍閱讀中、各結束條件、normal buffer 不變；`npx vite build` exit 0；兩個 typecheck = 0；`npm run test:unit` 第一次完整執行即綠（附數字）；e2e `e2e/t0904-tower-notify-protection.spec.ts` 跑 1 次，並新增一段 alt screen 情境（假 TUI 進 alt screen＋滾輪向上＋停 15 s → 通知仍保留；按鍵後才送出）。隔離實例、需先 `npx vite build`、不開會耗 token 的 claude 回合；程序清理照 D308。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`「閱讀信號」節與 `site/tower-inbox.md`（若有提到 10 秒）同步更新；CLAUDE.md 相關節若寫了 10 s 規則也一起改。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；commit 訊息 `fix(T0917): …`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；收單前 worktree `status --porcelain` 為空。公開 repo（D176）。yolo：不得問使用者，判讀問題問塔台。"
---

# T0917 — 修 BUG-221：全螢幕塔台的閱讀保護

見 [BUG-221](BUG-221-fullscreen-tower-reading-linger-10s.md)。

## 驗收

- [x] alt buffer 往上捲並停住超過 10 s，Worker 通知仍保留（上限 60 s）；使用者按鍵 / 點擊 / 捲回後照規則放行
- [x] normal buffer 行為不變
- [x] 單元、e2e（含新 alt screen 情境）、vite build、兩個 typecheck、`test:unit` 第一次即綠
- [x] 〈相關通過案例〉逐案判定
- [x] 文件同步

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

- **狀態**：DONE（工單範圍內的驗收全部通過；BUG-221 建議塔台改 `FIXED`，真 claude 塔台的 M-C2-b 重驗後再 `CLOSED`）
- **開始／完成**：2026-11-25 12:22 → 12:37（+08:00）
- **session_id**：0d01439c-f65b-4d11-b2e9-06520b726083
- **branch**：`ct/T0917`
- **base_sha**：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`）；`merge-base HEAD v0.8.x` = `4f7484bceb4fac693f0d35fd0285b93bb4d8c146`（與 memory_overrides 相符）
- **validated_sha**：`91c493605db40cc18d23c3bc6586fdce066b50d9`
- **head_sha**：`91c493605db40cc18d23c3bc6586fdce066b50d9`
  - 驗證在 commit 前的工作目錄上執行，commit 內容就是驗證時的內容。vite build／兩個 typecheck 跑完之後只改過 `e2e/t0904-tower-notify-protection.spec.ts`（不在這三者範圍內）；e2e 第 2 次、`test:unit` 都是在最終內容上跑的。
- **worktree**：`git status --porcelain` 為空

### 落點檢查

- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 下 → PASS
- C-3：`src/lib/tower-reading-state.ts` 等檔都已存在 → PASS
- C-2：工單沒有 `branch` 欄位；目前分支是 `ct/T0917`
- `CT_HOME` = 主 checkout、`CT_WORKTREE_BRANCH` = `ct/T0917`；`BAT_WORKSPACE_ID` 已設定（只記錄、不比對）；`BAT_REMOTE_TOKEN` 已設定
- 依賴：worktree 原本沒有 `node_modules`，已跑 `npm ci`（exit 0；結尾的 `electron-winstaller` install-scripts 警告屬預期，見 CLAUDE.md「npm 12 install scripts」）

### 實作摘要

方向依 D337。唯一實作仍是 `src/lib/tower-reading-state.ts` `TowerReadingTracker`（純邏輯），`TerminalPanel.tsx` 只接線。

| 項目 | 內容 |
|---|---|
| 新狀態 | `altUp`：在 alt buffer 往上捲的列數，還沒捲回；> 0 就是閱讀中，不受 10 s linger 限制 |
| 開始 | alt buffer 中滾輪向上（`wheelRows` < 0）、PageUp／Shift+PageUp（−`rows`）→ `noteAltScroll(負值)` |
| 結束：按鍵 | container `keydown`，PageUp／PageDown 與單獨的修飾鍵除外（`isModifierOnlyKey`）→ `endAltScroll('key')`，直接結束 |
| 結束：點擊 | container `mousedown`（任何按鍵）→ `endAltScroll('click')`，直接結束 |
| 結束：分頁切走 | `isActive` 變 false → `endAltScroll('inactive')`，直接結束 |
| 結束：捲回 | 滾輪向下、PageDown 累計 ≥ 向上累計（容許 0.01 列浮點誤差）→ 開始 10 s linger |
| 結束：buffer 切換 | `onBufferChange` → `setAltBuffer`，直接結束 |
| 上限 | 主行程既有 `reading` 60 s（`NOTIFY_HOLD_READING_MAX_MS`）；🔴 主行程 notify-hold 規則與常數都沒改 |
| normal buffer | `noteAltScroll` 在 normal buffer 不做事；`viewportY < baseY`、選取、滾輪＋10 s linger 完全不變 |

設計選擇：
- **「直接結束」的意思**：按鍵、點擊、切走、buffer 切換只結束 alt 狀態，不另外加 linger；最後一次滾輪／PageUp 後的 10 s 仍照既有規則算。e2e ⑥ 實測，按鍵後 1.3 s 送出（1 s 安靜）。
- **「分頁不再 active」而不是「失去焦點」**：閱讀時焦點常移到別的視窗或右側欄（複製、查資料），畫面仍在眼前；分頁被切走才代表沒在看。
- **鍵盤用 `keydown` 而不是 `onData`**：`onData` 也帶 xterm 的滑鼠／滾輪回報（alt buffer 沒有追蹤時，滾輪會變成方向鍵）、終端自動回應與 focus 回報。代價是被 BAT 快捷鍵吃掉、沒送進 PTY 的按鍵也會結束（只是提早回到既有規則）。
- **「捲回」是近似值**：滾輪量依 xterm 5.5 `Viewport.getLinesScrolled` 換算（`wheelRows`：像素 ÷ 列高（`.xterm-screen` 高度 ÷ rows）、行數照用、頁數 × rows；Shift／Ctrl 滾輪不算），PageUp／PageDown 各算 `rows` 列。程式實際捲多少（claude 每個滾輪回報捲幾行）BAT 不知道。滑鼠滾輪每格固定量、上下對稱，估計與程式一致。觸控板上下事件大小不同時可能有誤差：
  - 捲回了卻沒判斷出來 → 由按鍵、點擊、切走或 60 s 結束（多保留）
  - 還沒到底就判斷成捲回 → 回到停手 10 s 放行（等於 T0917 前的行為）
  - 兩種誤差都寫進文件了
- **只觀察、不攔截**：listener 都是 capture＋觀察，不 `preventDefault`／`stopPropagation`（wiring source guard 守住）。滾輪回報與按鍵照舊由 xterm 送進 PTY，T0698（codex 滾輪回報）、T0672 不受影響。
- **日誌**（renderer，不記內容）：`[tower-reading] terminal=<id> alt scrolled-up=true` ／ `alt scrolled-up=false cause=key|click|inactive|scrolled-back|buffer-switch|disabled`

### 修改檔案

| 檔案 | 內容 |
|---|---|
| `src/lib/tower-reading-state.ts` | `setAltBuffer`／`noteAltScroll`／`endAltScroll`／`altScrolledUp`、`onAltScroll` dep、`wheelRows`、`isModifierOnlyKey` |
| `src/components/TerminalPanel.tsx` | 接線：初始 buffer 型別、`onBufferChange`、滾輪／PageUp／PageDown、keydown、mousedown、`isActive` effect、卸載移除 listener |
| `src/lib/__tests__/tower-reading-state.test.ts` | 新增 15 個測試（alt 各情境、`wheelRows`、`isModifierOnlyKey`、normal buffer 不變），原有 7 個不改 |
| `src/__tests__/tower-reading-wiring.test.ts`（新增） | TerminalPanel 接線的 source guard（3 個測試） |
| `e2e/fixtures/fake-line-editor.mjs` | Ctrl+]（0x1d）切換全螢幕：alt screen＋SGR 滑鼠追蹤（模擬 claude），滾輪回報計數寫入 `alt.json`；原本的行為不變（0x1d 原本就被忽略） |
| `e2e/t0904-tower-notify-protection.spec.ts` | 新增 ⑥（真滾輪事件往上、停 15 s → 仍保留；→ 鍵後送出）、⑥b（捲回 → 10 s linger＋1 s）；①–⑤ 不改 |
| `docs/agent-guide/tower-inbox.md` | 〈閱讀信號〉加 alt buffer 小節（條件表、近似說明、選擇理由、日誌、驗證）；W2 表格 `reading` 列、已知限制、e2e 清單同步 |
| `site/tower-inbox.md` | 「你在閱讀時延後」與全螢幕說明的「停手 10 秒」改成新規則 |
| `CLAUDE.md` | 「塔台等使用者回答時保留 Worker 通知」節的契約 2 那行補一句 alt buffer 規則（原本沒寫 10 s） |

### 驗證

| 關卡 | 結果 |
|---|---|
| 單元（本單） | `tower-reading-state.test.ts`＋`tower-reading-wiring.test.ts`：27 passed |
| `npx vite build` | exit 0 |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npm run test:unit`（第一次完整執行） | exit 0；Test Files 492 passed／3 skipped（495）；Tests 8970 passed／42 skipped（9012）；64.78 s |
| e2e `t0904-tower-notify-protection.spec.ts` | 第 2 次 **1 passed（2.8 m）**，數據見下 |

e2e 第 1 次：①–⑥ 都通過，⑥b 的 `linger + quiet < 16 s` 失敗（16305 ms）。原因是量測起點：`backAt` 取在三次 `win.mouse.wheel(0, 200)` 之前，而 Playwright 每次 wheel 會等事件處理完，三次共 5.1 s（第 2 次實測 `wheelDownMs` = 5114）。linger 從最後一次滾輪起算，所以把 `backAt` 改到滾輪之後，產品程式不變。依工單「跑 1 次」：⑥b 改的是測試本身的量測，所以重跑一次確認。

e2e 第 2 次數據：
- ④ `heldMs` 61003、viewport 不動（70 → 70）
- ⑤（normal buffer）`afterScrollDownMs` 11272
- ⑥ `afterKeyMs` 1298（停 15 s＋通知 5 s 期間都保留，日誌 `held … reason=reading`、沒有 `reading=false`）
- ⑥b `afterScrollBackMs` 11182
- 假 TUI 收到滾輪回報 `wheelUp` 6、`wheelDown` 3

程序清理（D308）：teardown `Terminal Server … alive after teardown: false`、`runtime userData removed: true`；兩次跑完都查過命令列含 `e2e-t0904` 的程序 = 0。沒開任何 claude 回合。

### 相關通過案例判定

改動只在 renderer 的閱讀信號：alt buffer 新增一個「閱讀中」條件，normal buffer、主行程 notify-hold、draft、prompt、回答、卡片都沒改。

| 案例 | 判定 | 依據 |
|---|---|---|
| T0915 M-C2-a 半句不送出、📨「你在輸入」、清空／送出後才送 | 不變 | `draft` 由主行程 `trackDraft` 判斷，本單沒改；alt 中打字會結束 alt 閱讀，但草稿照舊由 `draft` 擋（e2e ② 通過） |
| T0915 M-C3-1、M-C3-3（M-C3-2 由 M-C4 補驗） | 不變 | 回合訊息卡（`tower-cards`）沒碰 |
| T0915 M-C4-1～M-C4-6 | 不變 | 待辦清單／回答：回答本來就不受 `reading` 擋（`enqueueAnswer`），本單沒改 |
| T0915 M-C5-1、2、3、4 | 不變 | hooks 狀態／plugin／權限對話框保留（prompt reason）沒碰；`reading` 只多擋 helper 通知，60 s 上限不變 |
| e2e ①–④ | 不變，第 2 次 PASS | ④ 是 normal buffer `scrollLines`，數據同 T0904 |
| e2e ⑤「停手 10 s 放行」 | 不變，PASS | 跑在 normal buffer（假 TUI 沒進 alt），11272 ms；斷言沒改 |

會改變的只有 T0915 M-C2-b（BUG-221 本身，原為 FAIL）：預期改為「往上捲停住時通知最多等 60 秒，畫面不被拉回底部」。需要真 claude 塔台重驗，見後續建議。

### 遭遇問題

- e2e 第 1 次 ⑥b 計時斷言失敗：測試量測起點的問題，已修，見〈驗證〉。
- 工單 frontmatter 開工時是 `status: TODO`（ct-exec 預期 `PENDING`），照開工處理成 `IN_PROGRESS`。

### 後續建議（給塔台）

1. BUG-221 → `FIXED`，修正 commit 是 `91c49360`（`ct/T0917`）；併入 `v0.8.x`、出測試版後，以 T0915 的 S2 驅動重跑 M-C2-b（真 claude 2.1.331 全螢幕塔台：滾輪往上、停 15 s 以上再收 Worker 通知）→ 通過就 `CLOSED`。
2. docs 的待實機 T-3（fullscreen＋Auto-scroll）可以同一次一併驗。
3. 觸控板上下不對稱造成的「提早判斷成捲回」是已知近似，已寫進文件；實機如果常見，可以考慮改成以 xterm 送出的滾輪回報數計算（需另開工單）。

### 互動紀錄

- [12:22] 開工。yolo、`CT_INTERACTIVE=0`、worktree 隔離；沒有向塔台提問。
