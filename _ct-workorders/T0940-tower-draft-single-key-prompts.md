---
schema_version: 1
schema_kind: workorder
id: T0940
title: "BUG-227：契約 2 塔台在 claude 的單鍵介面（意見調查列等）按數字鍵後不再被判成有草稿；待辦分頁回答不再卡在「📨 待送」"
type: bugfix
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P2
sizing: S
created_at: "2026-11-27T14:15:21+08:00"
started_at: "2026-11-27T14:16:50+08:00"
updated_at: "2026-11-27T14:34:12+08:00"
completed_at: "2026-11-27T14:34:12+08:00"
session_ids:
  - "d4db5adb-584b-4094-a95f-a7b5358a32f4"
target_version: "0.8.0-pre.9"
depends_on: []
related:
  - "BUG-227；D406；T0904（`draft` 保留，PLAN-068 W1＋W2）；T0939（發現，`ct620-accept/results-630/M-3.md` 與 S1-logs 有實錄）"
affects_files:
  - _ct-workorders/T0940-tower-draft-single-key-prompts.md
  - src/lib/tower-input-draft.ts
  - src/lib/__tests__/
  - electron/notify-hold.ts
  - electron/__tests__/
  - electron/main.ts
  - electron/remote/headless-entry.ts
  - electron/handlers/pty.ts
  - docs/agent-guide/tower-inbox.md
  - docs/agent-guide/notify-hold.md
  - CLAUDE.md
  - e2e/manual/README.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0940` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 先查證再改：① 重現與原因——T0939 實錄在 `<使用者資料夾>/AppData/Local/ct620-accept/results-630/M-3.md`、`S1-logs/`（PTY 全文、debug log 的 `[notify-hold] held … reason=draft`；只讀，不改、不複製進 repo，D176）；確認 claude 意見調查列（「How is Claude doing this session? … 0: Dismiss」）以單鍵作答、輸入框其實是空的。② 盤點 claude CLI（內嵌 `@anthropic-ai/claude-code` 版本）還有哪些「按一個鍵就作答、不進輸入框」的介面（例：數字選項的確認列、`y/n` 提示），列在回報區。③ 提出修法（建議至少比較兩案），寫在回報區〈設計〉；如果需要擴大到讀 PTY 輸出或新增協定，先問塔台。"
  - "🔴 修法方向（塔台建議，Worker 可依查證調整，偏離時問塔台）：草稿判斷仍是唯一實作 `trackDraft`（`src/lib/tower-input-draft.ts`）＋ `NotifyHoldController`（`electron/notify-hold.ts`）；例：host 已在看該分頁的 PTY 輸出（只讀，不改寫），在 claude 顯示單鍵介面時，緊接的單一可列印鍵不算草稿；或單鍵介面消失、輸入框重繪成空提示時清除草稿。🔴 不得改 BAT 寫進 PTY 的內容、不得替使用者送鍵；判斷要保守——判不出來就維持現行（寧可多保留，不可把通知混進使用者打到一半的字）。"
  - "🔴 不回歸：T0904 / T0917 既有行為與測試斷言不改（一般打字、貼上、↑ / ↓、Enter / Ctrl+C 清除、Esc、滑鼠、`reading` 保留、「立即送出」）；只在契約 2 塔台分頁生效（`towerContractStatus` `match`），其他分頁與 T0566 / T0788 路徑逐字不變；`notify-hold.test.ts` 既有斷言不改（必然衝突就問塔台）。"
  - "🔴 測試：純函式與 controller 單元測試——意見調查列出現後按 `0`（及其他單鍵）→ 不保留；一般輸入框打字 → 照舊保留；判不出時 → 照舊保留。若改動 PTY 輸出判讀，以 T0939 實錄的序列（自行改寫成去識別化的最小樣本）當 fixture。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。實機以隔離實例（`e2e/manual/` 驅動，T0939 做法）重現一次修正前後，或寫〈待實機〉；不碰安裝版 BAT；若要開 claude 回合，只開最少的 1 個，碰到用量上限就停。"
  - "🔴 文件：`docs/agent-guide/notify-hold.md` / `tower-inbox.md`「通知保護」`draft` 規則補一段（T0940）；CLAUDE.md「塔台等使用者回答時保留 Worker 通知」節對應一點視需要補一句（小節標題不改名，T0595）；`e2e/manual/README.md`〈已知限制〉那條（T0939）改寫或移除。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、主機名、IP、家目錄路徑（寫 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（`FIXED` 是 BUG 用的，L177）。"
---

# T0940 — 單鍵介面不算草稿（BUG-227）

## 背景

BUG-227（T0939 S1 M-3 發現）：契約 2 塔台分頁出現 claude 的意見調查列時，用數字鍵 `0` 關掉後，BAT 的草稿判斷（T0904 `trackDraft`）仍把那一鍵當成輸入框有字；下一則待辦分頁回答以 `reason=draft` 排進「📨 待送」，直到使用者在空輸入框按一次 Enter 才送出。回答不遺失、有提示，但使用者不知道要按 Enter。使用者 2026-11-27 指示開 BUG，並在 CT 判定（CT D913：BAT 端 0 項要改）回來後開修正單（D406）。

## 範圍

- 查證原因、盤點同類單鍵介面、比較修法。
- 修正：單鍵介面的作答鍵不算草稿（或介面結束時清除），判不出時照舊保守保留。
- 不回歸 T0904 / T0917 / T0788 / T0566。

## 驗收

- [x] 回報區〈查證〉〈盤點〉〈設計〉
- [x] 意見調查列按數字鍵後，待辦分頁回答立即送出；一般打字照舊保留（單元測試；實機見〈待實機〉）
- [x] 既有 notify-hold / tower-input-draft 測試斷言不改、全過；新增測試
- [x] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [x] 隔離實例重現修正前後，或〈待實機〉步驟
- [x] 文件

---

## 回報區

### 待塔台決策

#### Q-1：修法要讀塔台分頁的 PTY 輸出（唯讀），可以做嗎？範圍要不要含權限 / 提問提示？
- **提問時間**：2026-11-27T14:22:29+08:00
- **問題**：查證結果（見〈查證〉）：claude 的調查列讓按鍵**先進主輸入框**，400 ms 後才由調查列取走並清空輸入框。只看使用者送進 PTY 的位元組，分不出「調查列上按 `0`」與「在空輸入框打了 `0`」；要修 BUG-227 一定要看 claude 的畫面輸出（工單規定：要讀 PTY 輸出先問塔台）。另外盤點到權限提示 / AskUserQuestion 期間按的鍵也會被記成草稿（同一類問題，修法不需讀輸出，但要動 `electron/handlers/pty.ts`）。
- **選項**：
  - A：只做〈設計〉案 B（讀輸出，只涵蓋調查類單鍵介面）。
  - B：案 B ＋ 案 A（hook / osc 提示期間的按鍵不改變草稿狀態）。
  - C：只做案 A（不讀輸出；BUG-227 本身修不到，改寫〈已知限制〉）。
  - 其他。
- **建議**：B。理由：兩者都是「按鍵沒進輸入框卻被記成草稿」，案 A 很小、不讀輸出；案 B 沿用 `onPtyOutput` 既有接點（用量限制自動繼續 T0566 也是這樣讀 claude 輸出）、只讀不改寫，判不出時照舊保留。
- **影響**：案 B 要在 `affects_files` 以外改兩行接線：`electron/main.ts`（`onPtyOutput` 多呼叫 `notifyHold?.onPtyOutput`）、`electron/remote/headless-entry.ts`（同）。案 A 要改 `electron/handlers/pty.ts`（在 `manager.noteUserInput` 清掉 hook `blocked` 之前記下「這次輸入時有沒有提示」，交給 `onUserInput`）。請一併核准這三個檔加進範圍。
- **是否阻擋後續**：是（實作方向取決於答覆）。

### 查證

- 實錄（只讀，`<使用者資料夾>/AppData/Local/ct620-accept/results-630/`）：`M-3.md` 步驟 5～7；`S1-logs/debug-20261127-130907.log` 第 863 行 `[notify-hold] held … source=answer reason=draft part=text len=50 queued=1`（05:23:01Z），第 880–881 行使用者 Enter 後送出（05:23:47Z）。
- `S1-logs/tower-pty.txt.raw`：調查列 `How is Claude doing this session? (optional)` 與圖例 `1: Bad  2: Fine  3: Good  0: Dismiss`（空白多半以 `CSI 1 C` 表示），之後游標移到輸入列、緊接著輸出一個 `0`（= claude 把按鍵放進輸入框的回顯），之後整個畫面重繪、調查列消失；送出的回答是 `U-5：放棄 …`，前面沒有 `0`：輸入框最後確實是空的。
- claude 實作（內嵌 `@anthropic-ai/claude-code` 2.1.331 二進位內的 JS，壓縮後名稱）：調查元件以共用 hook（`qm({ inputValue, isValidDigit, onDigit, mountDelayMs })`）讀**主輸入框**的值：輸入框剛好是一個有效按鍵時，`Tye` = 400 ms 後（或使用者按 Enter 時立即）呼叫 `onDigit`、`setInputValue("")` 清空輸入框；調查出現後 `jp` = 600 ms 內按的鍵不算（留在輸入框）；輸入框不是剛好一個有效鍵（例 `12`、`5`）就照一般文字。⇒ 根因確認：BAT 的 `trackDraft` 看到 `0`（可列印字元）→ `draft`；claude 400 ms 後把輸入框清空，但沒有任何位元組讓 BAT 知道。

### 盤點（claude 2.1.331「按一個鍵就作答、按鍵不留在輸入框」的介面）

| 介面 | 機制 | 有效鍵 | 現行草稿判斷 |
|---|---|---|---|
| 意見調查列（標題可變：`How is Claude doing this session?`、`How well did Claude use its memory?`、`How was Claude's recollection?`、長對話 `How well is Claude following the instructions …`、compact 後、組織問卷），圖例 `1: Bad 2: Fine 3: Good [4: Unsure] 0: Dismiss` | 共用 hook，按鍵先進主輸入框 | `0`–`3`（有 `4: Unsure` 時含 `4`） | ❌ 誤記草稿（BUG-227） |
| 逐字稿分享 `Can Anthropic look at your session transcript …`，圖例 `y: Yes n: No d: Don't ask again` | 同一 hook | `y` / `n` / `d`（不分大小寫） | ❌ 誤記草稿 |
| bypass 原因調查 `Why bypass permissions instead of auto mode?`，圖例 `1: … 5: Other 0: Not now` | 同一 hook（另有 Enter / 其他鍵 → skipped） | `0`–`5` | ❌ 誤記草稿 |
| 權限提示（hook `permission`）、AskUserQuestion（`question`）、MCP elicitation（`elicitation`）、codex 審批（osc `input`） | 對話框取代輸入框，按鍵給對話框 | 數字 / 方向鍵 / `y`·`n` 等 | ❌ 作答鍵記成草稿；Enter 作答又會清掉提示前就有的草稿（反向誤判） |
| 調查後的追問（`What went wrong?` 等） | 自己的文字欄（不是主輸入框），Enter 送出 | 文字＋Enter | ✅ Enter 清除，結果正確 |

### 設計（比較）

- **案 A：提示期間的按鍵不改變草稿**（不讀輸出）。`pty:write` 的使用者輸入在 `manager.noteUserInput`（會清 hook `blocked`）**之前**記下該分頁當時是否處於 `NOTIFY_HOLD_REASONS` 提示；是 → 這次輸入不改變草稿狀態（不設、也不清）。涵蓋盤點第 4 列；修不到 BUG-227（調查列沒有 hook 信號）。`blockedDetection: none` 的分頁照舊。
- **案 B：認得 claude 的單鍵調查列**（讀 PTY 輸出，唯讀）。`NotifyHoldController.onPtyOutput(id, data)`（經 PtyManager 既有的 `onPtyOutput` deps）以純函式掃描輸出：去掉 ANSI（`CSI n C` 換成空白）後找到上表三種**圖例**之一 → 記下「單鍵介面出現、有效鍵集合、出現時間」。使用者輸入時，只有全部成立才不記草稿：① 目前沒有草稿、不在括號貼上中；② 這次輸入剛好是一個有效鍵；③ 介面出現已 ≥ 1 s（claude 的 600 ms 不收鍵＋餘裕）、≤ 30 min；④ 介面之後沒有其他寫入（任何使用者輸入、helper / 回答 / 自動寫入都把記錄清掉）。其他情況照現行 `trackDraft`。比對以圖例而不是標題（標題可變、使用者文件也可能含標題），判不出 → 照舊保留。CLI 改字串時要同步更新（比照 `src/lib/usage-limit.ts`）。
- **案 C：介面消失 / 輸入框重繪成空提示時清除草稿**（讀輸出）。要從 ConPTY 的部分重繪判斷輸入框是否為空，太脆弱，不建議。
- **建議**：案 B（修 BUG-227）＋ 案 A（同類、成本低）。等 Q-1 答覆後實作。

### 完成狀態

- **狀態**：DONE（Worker 步驟全部完成；實機重現改寫〈待實機〉）
- **branch**：`ct/T0940`
- **base_sha**：`d400fc3f788596e32f2d7b6930ca536e72c152e5`
- **validated_sha**：`f00fb06e4944553d2e39ec4c80a6b90e85851a58`
- **head_sha**：`f00fb06e4944553d2e39ec4c80a6b90e85851a58`（= validated_sha）
- **commits**：`8312ee6f` fix(notify-hold)…（產品＋測試＋文件）、`f00fb06e` test: typecheck:electron 的型別轉換（`8312ee6f` 上 `typecheck:electron` = 1 個錯誤，修正後在 `f00fb06e` 重跑全部關卡）
- **session_id**：d4db5adb-584b-4094-a95f-a7b5358a32f4

### 落點檢查

- PASS。C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`。C-1：工單在 `$CT_HOME/_ct-workorders/` 下。C-3：`src/lib/tower-input-draft.ts`、`electron/notify-hold.ts` 等存在。C-2：工單無 `branch` 欄位。
- `CT_HOME` = 主 checkout；`CT_WORKTREE_BRANCH` = `ct/T0940`；`BAT_WORKSPACE_ID` 已設定（只作證據）；`BAT_REMOTE_TOKEN` 已設定。

### 實作

- **案 A**（`src/lib/tower-input-draft.ts` `isSingleKeyInput` / `trackDraftDuringPrompt`；`electron/handlers/pty.ts`）：`pty:write` 的使用者輸入在 `manager.noteUserInput` 之前以 `notifyHold.isPromptShown(id)` 取「當下是否有 hook / osc 提示」，傳給 `onUserInput(id, data, { duringPrompt })`；提示期間的單一按鍵不設也不清草稿，貼上 / 多字元照 `trackDraft`。滑鼠按下另呼叫 `notifyHold.onMousePress`。
- **案 B**（`SINGLE_KEY_PROMPT_LEGENDS` / `normalizeScreenText` / `findSingleKeyPrompt` / `SingleKeyPromptScanner` / `answersSingleKeyPrompt`；`NotifyHoldController.onPtyOutput`；`electron/main.ts`、`electron/remote/headless-entry.ts` 的 `onPtyOutput` 各多一行）：只掃描契約 2 塔台的輸出（只讀），比對圖例；四個條件見〈設計〉與 docs。紀錄在任何使用者輸入、helper 寫入（`interceptWrite`）、送出（`send`）、`{ auto }` / `{ submit }` 寫入（`holdUserWrite` / `afterSubmitWrite`）、滑鼠按下、PTY 結束 / recovery 時忘掉；使用者按鍵後 2 s 內同一圖例（claude 回顯那一幀）不重新記錄。
- 依據的 claude 版本：內嵌 `@anthropic-ai/claude-code` **2.1.331**（worktree `npm ci` 後 `node_modules/@anthropic-ai/claude-code-win32-x64/package.json`）。圖例字串只在 `src/lib/tower-input-draft.ts`。
- T0904 / T0917 / T0788 / T0566：既有程式路徑只在 `onUserInput` 多分兩支（`duringPrompt`、調查列命中），其餘不變；`notify-hold*.test.ts`、`tower-input-draft.test.ts` 等既有斷言未改。

### 變更檔案

- `src/lib/tower-input-draft.ts`、`electron/notify-hold.ts`、`electron/handlers/pty.ts`、`electron/main.ts`、`electron/remote/headless-entry.ts`
- 新測試：`src/lib/__tests__/tower-input-draft-single-key.test.ts`（47 項）、`electron/__tests__/notify-hold-single-key.test.ts`（經真 `pty:write` handler）
- 文件：`docs/agent-guide/tower-inbox.md`（新〈不進輸入框的按鍵〉小節、日誌、已知限制、驗證）、`docs/agent-guide/notify-hold.md`、`CLAUDE.md`「塔台等使用者回答時保留 Worker 通知」節補一句（標題未改）、`e2e/manual/README.md`〈已知限制〉改寫

### 驗證

| 關卡 | 結果 |
|---|---|
| worktree `npm ci` | exit 0（`electron-winstaller` install script 未放行屬預期） |
| `npm run test:unit`（head `f00fb06e` 第一次完整執行） | ✅ 509 files passed / 3 skipped；9231 tests passed / 42 skipped |
| （參考）`8312ee6f` 上的完整執行 | ✅ 9226 passed / 47 skipped（當時還沒有 `dist-electron`，5 項依 build 產物的測試跳過） |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0（`f00fb06e`；`8312ee6f` 為 1，見 commits） |
| `npx vite build` | exit 0 |
| 新測試涵蓋（塔台指定五項） | 提示期間單鍵不設草稿 ✅、提示期間 Enter 不清既有草稿 ✅、提示期間貼上仍設草稿 ✅、調查列有效鍵不設草稿（回答立即送出）✅、調查列 < 1 s 或非有效鍵照舊設草稿 ✅；另含一般打字照舊、其他寫入後忘掉、回顯幀、版本不符不掃描、PTY 結束、日誌不含按鍵 |
| worktree `git status --porcelain` | 空 |

### 待實機

claude 的調查列由服務端隨機觸發，隔離實例無法穩定叫出，本單未開 claude 回合、未實機重現。步驟（下次 S1 類驗收或日常使用時）：

1. 契約 2 塔台分頁（`--set-role tower --bat-contract 2`）出現 `How is Claude doing this session? … 0: Dismiss` 時，等 ≥ 1 s，用鍵盤按 `0`（不要先點分頁）。
2. debug log 應有 `[notify-hold] single-key prompt shown terminal=<塔台> legend=rating` 與 `… answered … (no draft)`。
3. 從待辦分頁送出一則回答 → 應立即送進塔台（`[notify-hold] answer … (sending)`），縮圖沒有「📨 待送」。
4. 對照：調查列出現後先點分頁再按 `0` → 照舊 `reason=draft`（保守方向，文件已記）。
5. 權限提示用數字鍵作答後（hook 分頁），待辦分頁回答應立即送出。

### 相關通過案例判定

工單沒有〈相關通過案例〉段；不適用。

### 遭遇問題

- `8312ee6f` 上 `typecheck:electron` 有 1 個錯誤（新測試的型別轉換），以 `f00fb06e` 修正後全部關卡重跑。
- 主 checkout 的 `node_modules` 內嵌 claude 是 2.1.316（落後 lock 的 2.1.331）；盤點以 worktree `npm ci` 後的 2.1.331 為準，T0939 實測的 BAT `0.8.0-pre.8` 版本未另查。

### 後續建議

- 案 B 依賴 claude 的圖例字串：claude 升版時與 `src/lib/usage-limit.ts` 一起核對（docs 已註明）。
- 殘留誤判（調查列先點再按、1 s 內按鍵）屬保守方向；若實機常見，可另評估以輸出確認輸入列重繪來放寬。

### 互動紀錄

- [14:16] 開工：落點檢查 PASS（C-0 `repo` = `better-agent-terminal` = `basename "$CT_HOME"`），`CT_MODE=yolo`、`CT_INTERACTIVE=0`。
- [14:22] Q-1 → 塔台（讀 PTY 輸出與範圍）。
- [14:24] Q-1: 讀 PTY 輸出與範圍 → A（塔台，BAT 通道 `answered`，choice 2）: B（案 B ＋ 案 A），核准 `electron/main.ts`、`electron/remote/headless-entry.ts`、`electron/handlers/pty.ts` 加進範圍；案 A 限制：提示期間只有「單一按鍵」不改變草稿（不設不清），括號貼上或一次多個可列印字元照現行記草稿；案 B 照四個條件、圖例字串集中一處、回報列 claude 版本；案 C 不做；指定測試五項 → Action: frontmatter `affects_files` 補三檔、刪 `tower_question`，開始實作。
- [14:34] 實作與文件完成，`f00fb06e` 上全部關卡通過；三個塔台補充檢查節點都沒有新段落。收單。
