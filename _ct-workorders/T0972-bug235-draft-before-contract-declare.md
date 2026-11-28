---
schema_version: 1
schema_kind: workorder
id: T0972
title: "BUG-235 重修：啟動參數回合（`/control-tower`）送出前的草稿沒被清掉——`user-prompt-submit` 早於塔台 `--set-role --bat-contract 2`，T0964 的清除條件 `isContractTower` 不成立"
type: bugfix
status: DONE
repo: better-agent-terminal
priority: P1
sizing: S
created_at: "2026-11-28T15:42:36+0800"
started_at: "2026-11-28T15:44:24+0800"
completed_at: "2026-11-28T15:59:27+0800"
updated_at: "2026-11-28T15:59:27+0800"
session_ids:
  - "887e33c9-148c-4c5b-be55-d6556a876c21"
target_version: "下一個預覽版（`0.8.1-pre.5`，發版前與使用者確認）"
depends_on: []
related:
  - "BUG-235；T0964（`onPromptSubmitted`，`electron/notify-hold.ts`）；T0970（交付版驗收 R2 FAIL：B3 時序）；D503"
affects_files:
  - _ct-workorders/T0972-bug235-draft-before-contract-declare.md
  - electron/notify-hold.ts
  - electron/pty-manager.ts
  - electron/terminal-role.ts
  - electron/handlers/
  - electron/__tests__/
  - src/lib/tower-input-draft.ts
  - src/lib/__tests__/
  - docs/agent-guide/tower-inbox.md
  - docs/agent-guide/notify-hold.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0972` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 已查證的原因（T0970 回報區〈R2 判讀〉，交付版 `v0.8.1-pre.4` 實測）：`NotifyHoldController.onPromptSubmitted`（`electron/notify-hold.ts:553` 附近）第一個條件 `!state?.draft || state.inPaste || !this.isContractTower(id)` 就 return。啟動參數 `/control-tower` 那個回合的 `user-prompt-submit` 一定比塔台同一回合的 `--set-role tower --bat-contract 2` 早（實測 64–65 s；BUG-235 原始日誌 03:59:16.9 vs 03:59:37），當下分頁不是契約 2 塔台 → 草稿不清 → 回合結束後第一筆待辦分頁回答 `held … reason=draft`（pre.4 與 pre.3 相同）。T0970 B3 時序：草稿（F12 `csi~:24`）→ 357 ms → `user-prompt-submit` → `set-role … contract=2` → 回答 `held`。"
  - "🔴 修法（塔台裁示，D503；依序評估，選第一個成立的）：① 若 `draft` 狀態只在契約 2 塔台被讀取（保留、原因顯示、立即送出等所有讀者；請逐一核對並在回報區列出），`onPromptSubmitted` 的清除不再以 `isContractTower` 為前提（其餘條件：有草稿、不在括號貼上、hook 前 300 ms 無輸入、2 s 內無 Enter，全部不變）——非塔台分頁清掉草稿不影響任何行為。② 若 ① 不成立（有非契約 2 的讀者），改為：`user-prompt-submit` 時不論契約記下「送出前的草稿可清」（同一套 300 ms / 2 s 條件），之後該分頁經 `--set-role --bat-contract 2` 成為契約 2 塔台時，若記下之後沒有新的使用者輸入，就清掉草稿。🔴 兩種都不得放寬：送出後才打的字仍保留；括號貼上中不清。修法需要動 `--set-role` 契約或 helper 輸出 → 停下問塔台。"
  - "🔴 回歸測試：以 T0970 B3 時序為案例（草稿 → 357 ms → submit（尚未宣告契約）→ 宣告契約 2 → 待辦分頁回答 → 立即送出，修正前失敗）；另加：宣告前的 submit 之後又打字 → 宣告後回答仍保留；括號貼上中 submit → 不清；T0964 既有案例（已宣告契約 2 的分頁）照舊。既有測試不改斷言（只能新增；若既有斷言記錄的正是「非契約 2 不清」且屬讀者行為以外的純實作細節，先問塔台）。"
  - "🔴 不得改變：`draft` 的判定（`trackDraft`、單鍵例外、提示期間按鍵）、`enqueueAnswer` 的保留規則、T0965 / T0968 / T0971 的選單與 Esc 流程、T0966 計數、Worker 通知保留、`tower-inbox:answer` / `tower-inbox:menu-hint` 契約；日誌只記類別、長度、id，不記內容。"
  - "🔴 不回歸（R-G003）：T0904 / T0940 / T0964 / T0965 / T0966 / T0968 / T0971 相關案例與 T0970 R1 / R3 / R4 / R5（已 PASS）逐一核對，回報區列〈相關通過案例〉。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。不碰使用者正在用的安裝版 BAT。可選：用 T0970 的驅動（`e2e/manual/ct-accept-act.mjs input`、`ct610-driver.ts`，見 `e2e/manual/README.md` T0970 段）以本分支打包的隔離實例重跑 R2；做不到就列〈待實機〉。"
  - "🔴 文件：`docs/agent-guide/tower-inbox.md`（「claude 取走輸入框時清掉草稿」一節補宣告前送出的情況）、`notify-hold.md`；CLAUDE.md 只在需要時補一句（標題不改，T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；長內容用 Write / Edit（R-G005）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（L177）。"
---

# T0972 — BUG-235 重修：宣告契約前送出的草稿也要清

## 背景

T0970 以交付版 `v0.8.1-pre.4` 驗收 A-26：R1（閒置時回答）、R3 / R4 / R5 PASS，但 R2 FAIL——「以塔台開啟 Claude」後、啟動參數回合送出前按過鍵，回合結束後第一筆回答仍卡在待送，與 pre.3 相同，正好是 BUG-235 原始情境的時段。原因：T0964 的清除只對已宣告契約 2 的塔台，而啟動參數回合的 `user-prompt-submit` 比塔台宣告早約 1 分鐘。依 `_local-rules.md`〈驗收失敗處理〉「原問題未解」，BUG-235 退回 FIXING、派本單。

## 範圍

- 依 frontmatter 的 ① / ② 修 `onPromptSubmitted`（或宣告時補清）。
- 回歸測試（B3 時序）、文件。

## 不做

- 不改草稿判定與保留規則；不改契約；不發版。

## 驗收

- [x] 回報區列出 `draft` 的所有讀者與採用 ① 或 ② 的理由
- [x] B3 時序回歸測試（修正前失敗、修正後通過）；送出後打的字仍保留；括號貼上不清
- [x] 〈相關通過案例〉判定
- [x] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [x] 〈待實機〉步驟（或隔離實例重跑 R2 的結果）；docs 更新

---

## 回報區

### 待塔台決策

#### Q-1：方案 ① 會改到既有斷言 `notify-hold-prompt-submit.test.ts:149-159`（「v1 塔台／非塔台：submit 後 `hasDraft` 仍為 true」），可以改嗎？
- **提問時間**：2026-11-28T15:45:27+0800
- **背景**：`draft` 的讀者逐一核對完，會改變行為的三處（`holdReason` L787–792、`headHold` L811/817、`considerMenuEsc` L1008/1025）都先判 `isContractTower`；`onUserInput` 讀前一個狀態只影響下一個狀態與 `draft set` 日誌（清掉後與契約 2 塔台清掉時完全相同）；renderer 沒有讀者；`hasDraft` 公開方法只有測試在用。⇒ ① 成立。但 T0964 的 `it.each(['a v1 Tower', 'not a Tower'])` 斷言非契約 2 分頁 submit 後 `hasDraft('tower') === true`——這是讀者行為以外的純實作細節，正是工單說「先問塔台」的情況。
- **選項**：
  - A. 採 ①，把該 `it.each` 改成「v1 塔台／非塔台：草稿同樣被清（之後宣告契約 2 也不會被它擋），且不記任何保留、不排程佇列」；其餘既有斷言不動。
  - B. 改採 ②（submit 時記下「可清」，宣告契約 2 時若之後沒有新輸入才清），既有斷言不動；但要在 `--set-role` 路徑加一個 hook（`terminal-role.ts` / PtyManager → NotifyHold），程式較多、多一個時序狀態。
  - 其他。
- **建議**：A。理由：① 是工單指定的第一順位且已核對成立；被改的斷言只記錄內部狀態，沒有任何使用者看得到的行為依賴它；② 多一條跨模組接線與狀態，風險較高。
- **影響**：只影響 `electron/__tests__/notify-hold-prompt-submit.test.ts` 那一個 `it.each` 的斷言內容。
- **是否阻擋後續步驟**：是（決定採 ① 或 ②）。
- **塔台答覆 Q-1**：A（BAT 通道，2026-11-28 15:46）。採 ①；允許把該 `it.each` 改成「v1 塔台／非塔台：submit 後草稿同樣被清、不記任何保留、不排程佇列，之後宣告契約 2 也不會被它擋」，測試名稱註明 T0972 依塔台裁示（D503 / Q-1）；其餘既有斷言不動；回報區〈相關通過案例〉列出這一條的前後差異與 draft 讀者核對清單。

#### Q-2：T0970 實錄的 B3 在 hook 前 517 ms 有信任對話框的 Enter，① 修正後仍會被（不得放寬的）2 s Enter 保護窗留下草稿。照現有範圍收單，還是擴大範圍？
- **提問時間**：2026-11-28T15:49:01+0800
- **背景**：T0970〈R2 第 3 次（B3）〉日誌：信任 ↓ 07:37:17.127 → **信任 Enter 07:37:18.545** → F12 18.704（`draft set … csi~:24`）→ `user-prompt-submit` 19.062。工單 frontmatter 寫的 B3 是「草稿 → 357 ms → submit」，① 修正後這個時序會清（測試已證：修正前失敗、修正後通過）；但實錄裡 Enter 距 hook 517 ms < `NOTIFY_HOLD_SUBMIT_ENTER_GUARD_MS` = 2 s，`onPromptSubmitted` 會走 `draft kept`，回答仍 `held … reason=draft`。R2 第 1 次（B）也一樣（`\r`＋F12 同一次寫入，距 hook 859 ms）。T0970 以 `ct-accept-act.mjs` 在信任 Enter 後 150 ms 送 F12，所以照原驅動重跑 R2 會再 FAIL。實際使用中工作區已信任、沒有信任對話框時（BUG-235 原始情境多半如此），① 已涵蓋。
- **選項**：
  - A. 照現有範圍收單：① 已涵蓋「沒有 Enter 在 hook 前 2 s 內」的情況；回報區寫明實錄 B3 會被 Enter 保護窗留下，R2 重跑時 F12 要在信任 Enter 2 s 之後、hook 之前 ≥ 300 ms 送（或用已信任的工作區，沒有信任對話框）；另加一條測試記錄「hook 前 517 ms 有 Enter → 保留」是刻意的。要涵蓋信任 Enter 的情況由塔台另開單。
  - B. 本單擴大範圍：分頁的第一個 `user-prompt-submit`（該 PTY 第一次回合，啟動參數送出）不套用 2 s Enter 保護窗（300 ms 輸入窗照舊）。需要主行程知道「這次 submit 是啟動參數」（例如 PTY 生命週期內第一次 `user-prompt-submit`），屬放寬保護窗，與 frontmatter「兩種都不得放寬」衝突，要塔台裁示。
  - 其他。
- **建議**：A。理由：frontmatter 明定 300 ms / 2 s 條件不變、不得放寬；信任 Enter 之後 2 s 內打的字（例如真的打了文字）claude 會不會留在輸入框無法確定，放寬有把通知混進使用者文字的風險；實際情境（已信任工作區）① 已涵蓋。
- **影響**：A 只多一條測試與回報說明；B 要改 `onPromptSubmitted` 的條件並加測試、文件。
- **是否阻擋後續步驟**：是（決定收單範圍）。
- **塔台答覆 Q-2**：A（BAT 通道，2026-11-28 15:57）。照現有範圍收單，不放寬 300 ms / 2 s；加一條測試記錄「hook 前 517 ms 有 Enter → 保留」是刻意的（名稱註明 T0972 Q-2）；回報寫明 R2 重跑做法並寫進〈待實機〉；能用隔離實例重跑就做，做不到列〈待實機〉。「信任對話框 Enter 之後立刻按鍵」由塔台另記候選，本單不做。

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-28T15:59:27+0800
- **session_id**：887e33c9-148c-4c5b-be55-d6556a876c21
- **摘要**：採 D503 方案 ①：`onPromptSubmitted` 的清除不再以 `isContractTower` 為前提（有草稿、不在括號貼上、hook 前 300 ms 無輸入、2 s 內無 Enter，四個條件不變）；只有契約 2 塔台在清除後重新排程佇列（非契約 2 分頁的行為完全不變）；非契約 2 分頁的日誌多註 `; not a contract-2 Tower yet`。工單寫的 B3 時序（草稿 → 357 ms → submit → 宣告契約 2 → 回答）修正前失敗、修正後立即送出。T0970 實錄的 B3 另有信任對話框 Enter（hook 前 517 ms），依 Q-2 = A 照舊被 2 s Enter 保護窗保留（刻意，已寫測試與文件）。

### 落點檢查

- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單在 `$CT_HOME/_ct-workorders/` 下 → PASS
- C-3：`electron/notify-hold.ts` 等皆存在 → PASS
- C-2：工單無 `branch` 欄位；目前分支 `ct/T0972`
- 證據：`CT_HOME` = `D:\ForgejoGit\@Gower_Labs\BMad-Guide\better-agent-terminal\better-agent-terminal`、`CT_WORKTREE_BRANCH` = `ct/T0972`、`BAT_WORKSPACE_ID` 已設定（只作證據）、`BAT_REMOTE_TOKEN` 已設定、`CT_MODE` = `yolo`

### `draft` 讀者核對（採 ① 的理由）

| 讀者 | 位置 | 是否先判 `isContractTower` | 非契約 2 分頁清掉草稿的影響 |
|---|---|---|---|
| `holdReason`（Worker 通知／回答要不要保留、保留原因） | `electron/notify-hold.ts` 約 L792 | 是（`if (this.isContractTower(targetId)) { … hasDraft … }`） | 無 |
| `headHold`（佇列頭能不能送、「立即送出」、5 分鐘草稿提醒經 `noteHold` → `headHold`） | 約 L811 / L817 | 是（`!this.isContractTower(id)` → `return null`） | 無 |
| `considerMenuEsc`（T0965 / T0968 選單 Esc 的 `draft` 等待） | 約 L1008 / L1025 | 是（開頭 `!this.isContractTower(id)` → return） | 無 |
| `onUserInput` 讀前一個狀態（`trackDraft` / `trackDraftDuringPrompt` / `answersSingleKeyPrompt` / `draftCause`） | 約 L513–530 | 否 | 只決定下一個狀態與 `draft set` 診斷日誌；`scanDraft` 只在 `!draft` 時記 cause，清掉後與契約 2 塔台清掉時完全相同；單鍵調查只掃契約 2 塔台（`onPtyOutput`） |
| `menuEscPreview`（T0971 提示行） | 約 L629 | 不讀草稿 | 無 |
| renderer / 其他模組 | `src/**`、`electron/**` grep `hasDraft` / `drafts` | — | 沒有讀者（`ClaudeAgentPanel.tsx` 的 `hasDraftRef` 是面板自己的附件，與此無關） |
| `hasDraft()` 公開方法 | — | — | 只有測試在用 |

⇒ ① 成立（不需 ②）。另：清除後的 `schedule(id)` 只對契約 2 塔台呼叫，非契約 2 分頁的佇列（T0788 prompt 保留）排程時機不變。`--set-role` 契約與 helper 輸出都沒動。

### 修改檔案（`ct/T0972`）

- `electron/notify-hold.ts`：`onPromptSubmitted` 拿掉 `!this.isContractTower(id)` 前提；`schedule` 改為只對契約 2 塔台；非契約 2 的 `draft cleared` 日誌加 `; not a contract-2 Tower yet`；註解（T0972、`NOTIFY_HOLD_SUBMIT_QUIET_MS` 說明）。
- `electron/__tests__/notify-hold-prompt-submit.test.ts`：依 Q-1 改一條 `it.each`（見〈相關通過案例判定〉），新增 describe `T0972 / BUG-235`（6 條）。
- `docs/agent-guide/tower-inbox.md`（「claude 取走輸入框時清掉草稿」節：宣告契約前送出的回合、已知限制與 R2 重跑做法）、`docs/agent-guide/notify-hold.md`（T0972 一句、日誌行）、`CLAUDE.md`（T0964 那句補一句，標題不變）。

### 回歸測試

| 案例 | 修正前（`git show HEAD:electron/notify-hold.ts` 暫代，跑完還原） | 修正後 |
|---|---|---|
| T0970 B3（工單時序）：F12 → 357 ms → submit（未宣告）→ 64 s → 宣告契約 2 → 回答 `held: false`、立即寫入 | FAIL | PASS |
| v1 塔台／非塔台：submit 後草稿被清、不記保留、不排程、之後宣告契約 2 回答立即送出（Q-1 改寫的 `it.each`，2 條） | FAIL | PASS |
| 宣告前的 300 ms 輸入窗／2 s Enter 窗照樣保留（日誌 `draft kept` 2 行） | FAIL（修正前不記日誌） | PASS |
| 日誌不含內容、註明 `not a contract-2 Tower yet` | FAIL | PASS |
| submit 之後又打字 → 宣告後回答仍保留 | PASS | PASS |
| 括號貼上中 submit → 不清，宣告後回答保留 | PASS | PASS |
| T0972 Q-2（刻意）：T0970 B3 實錄（信任 ↓ → 1418 ms → 信任 Enter → 159 ms → F12 → 358 ms → submit，Enter 距 hook 517 ms）→ 保留，`draft kept … input 358 ms / Enter 517 ms before` | （Q-2 後新增） | PASS |
| T0964 既有案例（已宣告契約 2）：報告案例、被擋回答送出、Enter 後打字保留、300 ms 窗、2 s 窗、括號貼上、無草稿不記日誌、去重、診斷 | PASS | PASS（斷言未改） |

修正前結果：`Tests 5 failed | 23 passed (28)`（失敗的正是上表前 4 列共 5 條）。

### 相關通過案例判定

- **改了斷言的既有案例（塔台 Q-1 = A 允許）**：`notify-hold-prompt-submit.test.ts` 的 `it.each(['a v1 Tower', 'not a Tower'])`。前：「submit 後草稿狀態不動（`hasDraft === true`）」。後：「草稿同樣被清（`hasDraft === false`）、日誌 `draft cleared … not a contract-2 Tower yet`、沒有 `draft kept`、佇列 0、沒有計時器；之後宣告契約 2，回答 `held: false` 立即寫入」。測試名稱註明 `T0972, D503 / Q-1`。改的是內部狀態，沒有使用者看得到的行為依賴它（見讀者核對表）。
- T0904（契約 2 通知保護 `draft` / `reading` / 原子送出）：`notify-hold-contract-tower.test.ts` 全過，斷言未改 → 成立。
- T0940（不進輸入框的按鍵、單鍵調查）：`notify-hold-single-key.test.ts` 全過 → 成立（`trackDraft` / 單鍵例外 / 提示期間按鍵都沒改）。
- T0964（已宣告契約 2 的清除、去重、診斷）：見上表 → 成立。
- T0965 / T0968 / T0971（選單 Esc、`menu_open`、提示行）：`notify-hold-question-menu.test.ts` 等全過；`considerMenuEsc` / `menuEscPreview` 未改 → 成立。
- T0966（「Worker 等你」不算回答）：renderer 端，未改；全套 unit 全過 → 成立。
- T0970 R1（閒置時回答立即送出）：已宣告塔台無草稿時路徑未變 → 成立。R3（真草稿保留＋去重＋只送一次）：草稿在回合結束後才打、沒有 submit → 不受影響 → 成立。R4（保留期間不列 Worker 區、標題數字不增）：未改 → 成立。R5（日誌不含內容與權杖）：新日誌只有 terminal id 與固定字串，測試斷言不含內容 → 成立。
- 改變任何通過案例：無（只有上面依塔台裁示改寫的內部狀態斷言）。

### 驗證（`validated_sha` = `abcff41d`）

- `npm ci`：exit 0（`electron-winstaller` install script 被擋，屬預期）
- `npm run test:unit`：head 第一次完整執行全綠——`Test Files 532 passed | 3 skipped (535)`、`Tests 9624 passed | 42 skipped (9666)`（`6f3cb80d` 上另跑一次亦全綠：9618 passed / 47 skipped）
- `npx vite build`：exit 0
- `npm run typecheck`：exit 0（= 0）
- `npm run typecheck:electron`：exit 0（= 0）

### 待實機

- 隔離實例重跑 R2 **未做**：需要先打包本分支（`build:dir`）、一個已登入的測試用 claude 設定目錄（`CT610_CONFIG_DIR`）與裝好的 CT，本 session 沒有這些環境；不碰使用者的安裝版 BAT。
- R2 重跑做法（Q-2 = A）：
  1. 用本分支打包的隔離實例（`e2e/manual/ct610-driver.ts`＋`ct-accept-act.mjs`，見 `e2e/manual/README.md`），工作區**已信任**（先在同一個 `CLAUDE_CONFIG_DIR` 對該資料夾信任一次，或沿用 T0970 已信任的資料夾），「以塔台開啟 Claude」。
  2. claude 進全螢幕、啟動參數 `/control-tower` 送出前，以 `ct-accept-act.mjs input` 送 F12（`\x1b[24~`），與 hook 至少相隔 300 ms；若一定會出現信任對話框，F12 要在信任 Enter **2 s 之後**、hook 前 ≥ 300 ms 送。
  3. 預期日誌：`draft set … cause=csi~:24` → `draft cleared terminal=<id> (user-prompt-submit; not a contract-2 Tower yet)` → `set-role … contract=2` → 回合結束後待辦分頁回答 `answer … (sending)` / `sent … reason=none`，沒有 `held … reason=draft`。
  4. 對照（刻意保留）：信任 Enter 後 < 2 s 內按 F12 → `draft kept … Enter <n> ms before` → 回答 `held … reason=draft`（Q-2，塔台另記候選）。

### Commit

- 產品（worktree `ct/T0972`）：`6f3cb80d`（修正＋測試＋文件）、`abcff41d`（Q-2 刻意保留測試）、`c1abe148`（tower-inbox.md 已知限制與 R2 重跑做法，純文件）
- `branch`：`ct/T0972`
- `base_sha`：`07afa77b3a3a414d4734f0f6022fc93706e27740`
- `validated_sha`：`abcff41d15adea86ef8f55a16b034cd0eff03095`
- `head_sha`：`c1abe1489b86ddabdd7edc42686611d1b9392bfd`
- validated ≠ head 的說明：`c1abe148` 只改 `docs/agent-guide/tower-inbox.md`（一句已知限制），不在 build / typecheck 輸入內，也沒有測試讀它（grep `tower-inbox.md` 於測試檔無命中）→ 不需重跑。
- 工單（主 checkout）：`ef7dd653`（開工＋Q-1）、Q-1 答覆＋Q-2 一筆、收單一筆。未 push。

### 遭遇問題

- T0970 實錄 B3 與工單 frontmatter 寫的 B3 時序不同：實錄裡信任對話框 Enter 比 hook 早 517 ms，① 修正後仍被 2 s Enter 保護窗保留 → 問塔台 Q-2，答 A（照範圍收單，刻意保留）。T0970 R2 第 1 次（B）同理（`\r`＋F12 同一次寫入，距 hook 859 ms）。
- 全套 skipped 數兩次不同（47 → 42），是依環境略過的測試，兩次都 0 failed。

### 後續建議

- 塔台候選（Q-2）：「信任對話框 Enter 之後立刻按鍵」—— 若要涵蓋，可評估「PTY 的第一個 `user-prompt-submit`（啟動參數回合）不套 2 s Enter 保護窗」，但屬放寬保護窗、要另行裁示。
- R2 依〈待實機〉重跑後，BUG-235 才能 CLOSED。

### 互動紀錄

- [15:45] Q-1: 方案 ① 會改到 `notify-hold-prompt-submit.test.ts:149-159` 的斷言，可以改嗎？ → A（塔台）: 選 A，採 ①，改該 `it.each` 並註明 T0972 / D503 / Q-1 → Action: 實作 ①、改寫該案例、回報列前後差異與讀者核對。
- [15:49] Q-2: T0970 實錄 B3 有信任 Enter（hook 前 517 ms），照範圍收單還是擴大？ → A（塔台）: 選 A，不放寬，加刻意保留測試、寫 R2 重跑做法、能重跑就做 → Action: 加測試 `T0972 Q-2 (intended)`、文件補已知限制、隔離實例重跑列〈待實機〉。

## 塔台收單補記

- 2026-11-28 16:00 (UTC+8) 收單：DONE 確認（方案 ①；`validated_sha` `abcff41d`，head `c1abe148` 只多一筆 `tower-inbox.md` 純文件 commit）。`--close-worker --delay-ms 10000 --worktree keep` exit 0；`--worktree-status` `outOfScopeFiles` / `conflicts` / `dirty` 空，但判準 1（`main` 已併入 T0970 `e2e/manual/`）、2（validated ≠ head）不成立 → 合併工單 T0975（mechanical，在合併結果重跑完整驗收）。隔離實例重跑 R2 未做 → 列 BUG-235 收尾的待實機（D506）。
