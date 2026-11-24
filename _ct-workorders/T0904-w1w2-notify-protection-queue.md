---
schema_version: 1
schema_kind: workorder
id: T0904
title: "PLAN-068 W1＋W2（在 `v0.8.x`）：送通知的保護 —— B0 通知不搶捲動 / 選取 / 焦點、#23 草稿保護（`draft`）、B 閱讀保護（`reading`）、文字＋Enter 原子送出、回答進同一佇列的基礎；只對契約 v2 塔台"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T05:12:00+08:00"
updated_at: "2026-11-25T05:44:19+08:00"
started_at: "2026-11-25T05:11:53+08:00"
completed_at: "2026-11-25T05:44:19+08:00"
session_ids:
  - "905158f2-42c4-4dd3-a786-afb47726c9f6"
target_version: "0.8.x（與 CT 6.1.0 同日發佈）"
depends_on: [T0903]
related:
  - "PLAN-068；T0902（規格：§1〈終端內的行為〉、§2.4、§5、§6′、R2′ / R3′、調查結論 §1（#23 重新評估、信號 S1、250 ms 窗口）與 §2（B0 `terminal.input('\\r', false)`）、第二版拆單 W1 / W2 列）；T0903（W0）；GitHub #23 / #24；D332 / D333"
  - "T0788（`NotifyHoldController`、`notify-hold-store`、「📨 待送 N」）、T0566（用量限制自動繼續的 Enter 路徑）、T0749（attention 對帳）；CLAUDE.md「塔台等使用者回答時保留 Worker 通知（T0788 / BUG-196，D227）」節、`docs/agent-guide/notify-hold.md`"
affects_files:
  - _ct-workorders/T0904-w1w2-notify-protection-queue.md
  - electron/notify-hold.ts
  - electron/handlers/pty.ts
  - electron/handlers/terminal.ts
  - electron/pty-manager.ts
  - electron/remote/
  - electron/preload.ts
  - electron/main.ts
  - electron/__tests__/
  - src/components/TerminalPanel.tsx
  - src/components/TerminalThumbnail.tsx
  - src/stores/notify-hold-store.ts
  - src/types/
  - src/lib/
  - src/lib/__tests__/
  - src/__tests__/
  - src/components/__tests__/
  - src/locales/
  - scripts/bat-notify.mjs
  - scripts/__tests__/
  - tests/bat-*.test.mjs
  - e2e/
  - CLAUDE.md
  - docs/agent-guide/
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0904（塔台已預先從 `v0.8.x` `d6b9ce86` 建立分支 `ct/T0904`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0904` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `d6b9ce86e30129a1ea8c29d1f5fe5b8e078454c8`（含 W0 T0903），不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 規格來源：T0902 回報區（第一版＋〈第二版（Renew #1，D328）〉）是唯一規格；W0 已完成（T0903，`src/lib/tower-contract.ts`、`PtyManager.getTowerContract(id)`、`tower-contract-store`、`terminal:role-changed` 的 `towerContract`），**新功能只對 `towerContract == 2` 的塔台分頁生效**（R9′ 全部綁版本），既有 T0788 保留與所有現有行為不綁版本、不得改變（🔴 不回歸）。只做本單列的範圍；其他 W 單的範圍不做。與本單平行的還有 T0904（W1+W2）、T0905（W3）、T0906（W4），各自分支，由塔台的合併工單整合；改到共用檔（例 `electron/preload.ts`、`src/types/electron.d.ts`、proxied channel 清單、locales）時只做本單需要的增量。"
  - "🔴 驗證：worktree `npm ci`；**每次產品 commit 前先完整跑一次 `npm run test:unit`**（T0903 教訓：改回應形狀會打到既有 `toEqual` 斷言），最後在 head 上完整執行要第一次就全綠（附 passed / files 數）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；動到 helper 時 `npm run verify:helpers` exit 0。e2e 只用隔離實例（`launchIsolated`），不得以預設實例啟動；不碰使用者正在用的 BAT（安裝版）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn（需要真實回合的項目寫「待實機」並對應 T0902 待實機清單編號）。`TMP` 用系統預設（T0716）。程序清理照 D308。"
  - "🔴 文件：CLAUDE.md 只加一兩句＋唯一實作位置＋🔴 不變式，細節寫進 `docs/agent-guide/tower-inbox.md`（W0 已寫在 `tower-tab-title.md`；本單若需要新檔就建立並更新 `docs/agent-guide/README.md` 索引）。CLAUDE.md < 100k 字元、小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）；日誌不記訊息內容、權杖、env。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
  - "🔴 本單範圍（W1＋W2 合併，因兩者都改 `TerminalPanel.tsx`）：① **B0**：`towerContract == 2` 的塔台分頁，helper 通知（與日後回答）的 submit Enter 改用 `terminal.input('\\r', false)`（不捲動、不清選取、不搶焦點），仍寫 `{ auto: true }`；其他分頁（含非塔台分頁收到的 bat-notify）與 T0566 路徑維持現狀（R3′，測試守住）。② **`draft`**（#23）：host 以 S1 規則追蹤塔台分頁輸入框是否有使用者草稿（最後一次 Enter / Ctrl+C 之後有其他使用者輸入 = 有草稿；bracketed paste 內的 `\\r` 不算送出），有草稿時保留 helper 通知，放行 = 使用者 Enter / Ctrl+C 後安靜 1 s，或「立即送出」；**不設上限**，保留滿 5 分鐘發一次系統通知。③ **`reading`**（B）：renderer 回報塔台分頁「閱讀中」（normal buffer `viewportY < baseY`、有選取、或最近 10 s 有滾輪 / PageUp / Shift+PageUp），停手 10 s 放行、**最長 60 s**；🔴 不擋使用者自己的回答；遠端以新的 proxied channel `terminal:reading-state { terminalId, reading }`（只有布林）。④ **原子送出**：`towerContract == 2` 的塔台分頁，helper 通知一律經 `NotifyHoldController`（不保留時 pass-through），文字送出到 `{ auto: true }` 的 `\\r` 抵達之間（最多 1 s），同分頁的使用者輸入由 host 暫存、Enter 後原樣補寫。⑤ 「📨 待送」顯示保留原因（你在輸入 / 你在閱讀 / 等你回答對話框）＋「立即送出」。⑥ 佇列要能接受「回答」來源的項目（介面與測試即可；回答的 UI 與 IPC 在 W5），規則照 §2.4 表（回答受 blocked / `draft` 保護、不受 `reading` 擋，回答的 Enter 算使用者輸入）。"
  - "🔴 不得改變：T0788 的 reason（`permission` / `question` / `elicitation` / `input`）對所有分頁照舊、`held-full` / 8 筆上限 / 不設逾時（D228）、`bat-notify` / `bat-terminal` 的 exit code 與 stdout、`{ auto: true }` 不算使用者輸入（T0788 第 9 點）、`terminal:notify` 不寫 PTY（T0716）、日誌只記 id / reason / 長度。版本不符或非塔台分頁：行為與今天完全相同（R9′）。"
  - "🔴 #23 驗證：e2e 隔離實例以假 TUI（node 行編輯器腳本，不需登入 claude）重現「草稿＋通知被同一個 Enter 送出」並驗證修正（T0902 建議），另測 250 ms 窗口內打字與按 Enter 兩種情況、`reading` 的 60 s 上限、版本不符時行為不變。真 xterm 單元測試：B0 往上捲時 `viewportY` 不變、選取保留、焦點不變、`onData` 位元組與 keydown 路徑相同。"
---

# T0904 — PLAN-068 W1＋W2：送通知的保護

## 背景

GitHub #24（塔台訊息讀到一半被擠走）與 #23（Worker 通知混進塔台輸入框的草稿）的整合設計已雙方核定（T0902、BAT D329 / D330、CT D868）。T0902 查證：#23 在現行程式仍會發生（塔台 `idle` 或 `working` 時都會；寫入與 Enter 之間 250 ms 窗口雙向出錯）；畫面被拉回底部有一部分是 BAT 自己的 submit Enter 走 xterm 使用者輸入路徑造成（B0）。W0（T0903）已提供每個塔台分頁的 `towerContract`。

## 實作

照 `memory_overrides` 的範圍與 T0902 §2.4 / §5 / R2′ / R3′：host（`NotifyHoldController`，本機與 headless 共用）＋ renderer（`TerminalPanel.tsx` 的 Enter 與閱讀信號、「📨 待送」）。順帶把 T0903〈遭遇問題〉2 提到的 `electron/remote/path-aware-channels.ts` `terminal:role-changed` 說明字串補上 `mode` / `towerContract`（`electron/remote/` 在 `affects_files`）。

## 驗收

- [x] B0：v2 塔台分頁通知不捲動 / 不清選取 / 不搶焦點；其他分頁與 T0566 不變
- [x] `draft`：草稿不被混入（假 TUI e2e 重現並修正）；放行條件、「立即送出」、5 分鐘提醒
- [x] `reading`：延後與 60 s 上限；遠端 channel；不擋回答
- [x] 原子送出：250 ms 窗口兩種情況
- [x] 回答來源項目的佇列規則（介面與測試）
- [x] 版本不符 / 非塔台：行為與今天相同；T0788 既有測試全綠
- [x] 驗證關卡（commit 前完整 test:unit；head 第一次即綠）、文件、隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（Worker 範圍的驗收全數通過；需要真 claude / codex / WSL 的項目列為待實機，見下）
- **session_id**：905158f2-42c4-4dd3-a786-afb47726c9f6

### 產出摘要

**版本閘門（R9′）**：新功能只在 `towerContractStatus(role, towerContract) === 'match'` 時生效（host 讀 `PtyManager.getTerminalRole` / `getTowerContract`，renderer 讀 `tower-contract-store`）。其他分頁（未宣告 / 契約 1 / 契約 > 2 / 非塔台）與 T0566：行為與今天相同；T0788 的 reason 對所有分頁照舊（`notify-hold.test.ts`、`notify-hold-ask-held-full.test.ts` 一行未改、全綠）。

| 範圍 | 實作 |
|---|---|
| ① B0 | `src/lib/tower-submit-enter.ts`（`towerSubmitEnterPath` / `submitEnterWithoutFocus` = `terminal.input('\r', false)`）；`TerminalPanel.tsx` `onTerminalKeypress` → `dispatchEnter({ withoutFocus })`。helper Enter 仍寫 `{ auto: true }`；T0566 路徑不變（source guard 守住）。 |
| ② `draft`（#23） | S1 純函式 `src/lib/tower-input-draft.ts` `trackDraft`（`\r` / Ctrl+C 清除；bracketed paste 內的 `\r` 不算送出；單獨 Esc、方向左右、PageUp/Down、focus / 滑鼠 / CPR 回報不變）；host `NotifyHoldController.onUserInput(id, data)`。放行：使用者 Enter / Ctrl+C ＋安靜 1 s，或「立即送出」；不設上限；滿 5 分鐘發一次 `terminal:notify-hold-reminder`（本機視窗，持有分頁的 `TerminalPanel` 以系統通知顯示）。 |
| ③ `reading`（#24） | renderer `src/lib/tower-reading-state.ts` `TowerReadingTracker`（normal buffer `viewportY < baseY`、選取、滾輪 / PageUp；停手 10 s）→ 新 proxied channel `terminal:reading-state { terminalId, reading }`（`electron/handlers/pty.ts`，本機與 headless 共用；`ctx.helper` → `forbidden`；未加進 `HELPER_CHANNEL_ROLES`；`PROXIED_CHANNELS` ＋ path-aware 分類）。host 每佇列最長 60 s；🔴 不擋回答。 |
| ④ 原子送出 | 契約 2 塔台的 helper 寫入一律經 controller（不保留時由它寫入＝pass-through，回傳寫入結果）；文字到 Enter（視窗的 `{ auto: true }` / `{ submit: true }` `\r`，最多 1 s）之間，使用者輸入由 host 暫存（`holdUserWrite`）、Enter 後依序補寫（`afterSubmitWrite`）；保留送出時同樣開窗口，下一則等窗口關閉。 |
| ⑤ 「📨 待送」 | 事件 `terminal:notify-hold-changed` 多 `reason`（只有契約 2 塔台）；縮圖選單顯示原因（你在輸入 / 你在閱讀 / 等你回答對話框 / 排隊）、`draft` / `reading` 時有「立即送出」（本機 IPC `terminal:notify-hold-send-now` → `sendNow`；🔴 不越過 prompt reason）；回答項目標「你的回答」；三語系。 |
| ⑥ 回答來源 | `enqueueAnswer(targetId, text, { connectionId? })`：單行、≤ 1,000 字、只收契約 2 塔台；受 prompt / `draft` 擋、不受 `reading` 擋、排在已保留通知之後；Enter 以 keypress `userInput: true` 由視窗寫 `{ submit: true }`（算使用者輸入，關閉窗口）。IPC / UI 留給 W5。 |
| 順帶 | `electron/remote/path-aware-channels.ts` `terminal:role-changed` 說明補 `mode?` / `towerContract`（T0903〈遭遇問題〉2）。 |
| 文件 | 新增 `docs/agent-guide/tower-inbox.md`（README 索引已加）；`notify-hold.md` 加「契約 2 的塔台」節；CLAUDE.md T0788 節加一點（唯一實作位置＋🔴 不變式）。 |

**變更檔案**（30）：`electron/notify-hold.ts`、`electron/handlers/pty.ts`、`electron/main.ts`、`electron/preload.ts`、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、`src/components/TerminalPanel.tsx`、`src/components/TerminalThumbnail.tsx`、`src/stores/notify-hold-store.ts`、`src/types/notify-hold.ts`、`src/types/electron.d.ts`、`src/locales/{en,zh-TW,zh-CN}.json`、新 `src/lib/tower-input-draft.ts` / `tower-reading-state.ts` / `tower-submit-enter.ts`；測試 `electron/__tests__/notify-hold-contract-tower.test.ts`（35）、`notify-hold-contract-handlers.test.ts`（7，真 PtyManager）、`src/lib/__tests__/tower-input-draft.test.ts`、`tower-reading-state.test.ts`、`tower-submit-enter.test.ts`（真 xterm＋source guard）、`src/components/__tests__/notify-hold-reason-menu.test.tsx`；e2e `e2e/t0904-tower-notify-protection.spec.ts`＋`e2e/fixtures/fake-line-editor.mjs` / `notify-job-runner.mjs`；文件 4 檔。`electron/handlers/terminal.ts`、`scripts/bat-notify.mjs` 未改（helper 的參數、exit code、stdout 不變）。

**驗證**（`validated_sha` = `45020cf1`）

| 關卡 | 結果 |
|---|---|
| `npm run test:unit`（head 上完整一次） | ✅ 第一次即全綠：Test Files 472 passed / 3 skipped（475）；Tests 8677 passed / 42 skipped（8719） |
| commit 前完整 `test:unit` | 第一次 1 檔 6 個失敗（`src/__tests__/terminal-context-menu.test.tsx`：它的 xterm mock 只保留一個 `onSelectionChange` callback，我的第二個訂閱蓋掉了既有的選取保持）→ 改為共用既有訂閱（產品碼改法，不改測試）→ 再跑全綠 |
| `npm run test:legacy` | ✅ files 33 passed, 0 failed；tests 472 passed |
| `npx vite build` | ✅ exit 0 |
| `npm run typecheck` / `typecheck:electron` | ✅ 0 / 0 |
| `verify:helpers` | 不適用（未動 helper） |
| B0 真 xterm（5.5.0，jsdom `open()`） | ✅ `onData` 位元組 = keydown 路徑（`['\r']`）；往上捲後 `viewportY` 不變（keydown 路徑捲到底）；選取保留（keydown 清除）；焦點留在原元素 |
| e2e 隔離實例（`launchIsolated`，假 TUI，未啟動 claude / codex，連跑 2 次皆通過） | ① 未宣告塔台：#23 照舊重現（送出 `draft-one T0904 one`，R9′ 不變）；② 契約 2：草稿 `draft-two` 由使用者 Enter 單獨送出，通知 1.27 s 後單獨送出，縮圖 `data-notify-hold-reason="draft"`；③a 250 ms 窗口內打字：通知單獨送出、`z` 留在輸入框；③b 窗口內按 Enter：通知只送一次、接著使用者的空 Enter；④ 閱讀（真的捲動 xterm、renderer 回報）：保留 61.0 s 後送出，viewport 69 → 69 不動（B0 實機）；⑤ 捲回底部後 11.3 s 送出；日誌無通知 / 草稿文字、無權杖 |
| 程序清理（D308） | e2e 後 Terminal Server `alive after teardown: false`、runtime userData 已刪；無 `fake-line-editor` / `notify-job-runner` / `e2e-t0904` 殘留程序 |

**落點檢查**：PASS。C-0 `repo` = `better-agent-terminal` = `basename "$CT_HOME"`；C-1 工單在 `$CT_HOME/_ct-workorders/` 下；C-3 `affects_files` 皆存在（informational）；merge-base `v0.8.x` = `d6b9ce86e30129a1ea8c29d1f5fe5b8e078454c8`（符合）。`CT_HOME` 已設、`CT_WORKTREE_BRANCH` = `ct/T0904`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

**待實機**（T0902 編號）：T-1 / T-2（真 claude 塔台的 #23 與捲動拉回）、T-3（fullscreen＋Auto-scroll）、T-5（codex 輸入框的 Ctrl+C / Enter / Shift+Enter 是否符合 S1）、T-7（WSL 塔台的 `draft` / `reading`）、T-8（舊 CT＋新 BAT 保護停用）。

**建議後續（交塔台）**
1. 遠端 profile 視窗看不到「📨 待送」、原因、「立即送出」與 5 分鐘提醒（T0788 既有限制：`terminal:notify-hold-*` 未進 `PROXIED_CHANNELS` / `PROXIED_EVENTS`）。保留本身在 bat-server 照常生效，但遠端使用者的 `draft` 保留沒有可見提示。建議另開工單讓這三者可 proxied（W5 的回答 UI 也會需要）。
2. CLAUDE.md 目前 126,809 字元（本單 +706），T0904 前已超過 100k 目標（< 150k 上限）；建議另開整理單。

### 互動紀錄
- [05:11] 開工：落點檢查 PASS；merge-base 符合；`npm ci` 完成。
- 既有 notify-hold / remote channel 測試（62 檔 990 項）在改動後全綠。
- e2e 第一次即通過；之後 `test:unit` 全套發現 `terminal-context-menu.test.tsx` 6 項失敗（重複的 `onSelectionChange` 訂閱），改為共用既有訂閱後全綠；重建後 e2e 一次因測試夾具讀到寫到一半的 `line.json` 失敗（夾具改為暫存檔＋改名、讀取端容忍），再跑通過。
- 塔台補充檢查（驗證前 / commit 前 / 回報前）：無新段落。

### Renew 歷程
無

### 遭遇問題
- 以 bash heredoc 夾帶 Python 修改檔案時，`\\r` 被收成真的 CR（R-G005 第 3 點），造成 `TerminalPanel.tsx` / `notify-hold.ts` 註解出現裸 CR（`tsc` 報錯才發現）；已改正並改用 Edit 工具。
- 一次 Write 誤寫到 worktree 外（`.bat-worktrees/better-agent-terminal/src/...`，少了 `T0904`）；已立即刪除該檔與三層空目錄，未影響任何 checkout。
- `core.autocrlf=true` 環境下 `grep -c $'\r'` 誤報 CR；以 `tr -cd '\r' | wc -c` 確認提交內容皆為 LF。

### 隔離分支證據
- branch：`ct/T0904`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`，與 main 的共同祖先；實際分支點 `v0.8.x` `d6b9ce86e30129a1ea8c29d1f5fe5b8e078454c8`，屬預期）
- validated_sha：`45020cf1d1e2558d1c70c602b426a72cdfe4e246`
- head_sha：`45020cf1d1e2558d1c70c602b426a72cdfe4e246`
- validated_sha ≠ head_sha 的說明：相同

### 回報時間
2026-11-25T05:43:25+08:00
