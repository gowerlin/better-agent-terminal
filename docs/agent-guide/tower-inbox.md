# 塔台訊息與待辦（PLAN-068）

> CLAUDE.md 對應小節：「塔台等使用者回答時保留 Worker 通知（T0788 / BUG-196，D227）」（送通知的保護）、「塔台分頁標題（T0562，D147）」（契約 v2 版本閘門）。改這個功能時兩邊一起更新。
>
> 規格：T0902 回報區（第一版＋〈第二版（Renew #1，D328）〉）。本檔目前只寫 W1＋W2（T0904）；W3–W9 完成時各自補節。

## 版本閘門（R9′）

本檔的功能只對「已宣告 BAT ↔ CT 契約 2 的塔台分頁」生效：`towerContractStatus(role, towerContract) === 'match'`（`src/lib/tower-contract.ts`，W0 / T0903）。主行程讀 `PtyManager.getTerminalRole` / `getTowerContract`，renderer 讀 `tower-contract-store`（`terminal:role-changed` 的 `towerContract`）。

| 分頁 | B0 | `draft` / `reading` / 原子送出 / 回答 | T0788 對話框保留 |
|---|---|---|---|
| 契約 2 的塔台 | ✅ | ✅ | ✅ |
| 未宣告 / 契約 1 / 契約 > 2 的塔台 | — 合成 keydown（同今天） | — 直接寫入（同今天） | ✅（不綁版本） |
| 不是塔台 | — | — | ✅ |

🔴 版本不符或非塔台：行為與 T0904 前逐位元相同（e2e ① 量到 #23 照舊重現）。

## W1：B0 —— 通知的 Enter 不搶畫面（T0904）

- 契約 2 塔台收到 `terminal:keypress`（`bat-notify --submit`、保留後送出的 Enter、回答的 Enter）→ `terminal.input('\r', false)`（`submitEnterWithoutFocus`，`src/lib/tower-submit-enter.ts`）：xterm 自己的資料路徑、不當成使用者輸入 → 不捲到底、不清選取、不搶焦點；位元組與 Enter 鍵相同（`\r`）。
- 其他分頁與 T0566 用量限制續行：照舊合成 keydown（`dispatchSyntheticEnterKeydown`）＋`terminal.focus()`。
- 判斷唯一實作 `towerSubmitEnterPath(status)`；接線 `TerminalPanel.tsx` `onTerminalKeypress` → `dispatchEnter({ withoutFocus })`。
- helper 的 Enter 仍寫 `{ auto: true }`（T0788 第 9 點）；回答的 Enter（keypress 帶 `userInput: true`）寫 `{ submit: true }`：算使用者輸入、並關閉原子窗口。
- 🔴 升級 xterm 時必跑 `src/lib/__tests__/tower-submit-enter.test.ts`（真 xterm 5.5.0 在 jsdom `open()`：位元組相同、viewport 不動、選取保留、焦點不動；對照 keydown 路徑會捲到底、清選取）。

## W2：保留佇列擴充（T0904）

`NotifyHoldController`（`electron/notify-hold.ts`，本機與 headless 共用）是契約 2 塔台的唯一寫入閘門：helper 通知一律經它（沒有要保留時也由它寫入＝pass-through）。

| reason | 觸發（host） | 放行 | 上限 | 擋誰 |
|---|---|---|---|---|
| `permission` / `question` / `elicitation` / `input`（T0788） | hook / OSC `blocked` | 離開 blocked ＋安靜 1 s | 不設（D228） | helper 通知、回答；所有分頁 |
| `draft` | S1：最後一次 Enter / Ctrl+C 之後有其他使用者輸入 | 使用者 Enter / Ctrl+C ＋安靜 1 s；或「立即送出」 | 不設；保留滿 5 分鐘發一次系統通知 | helper 通知、回答 |
| `reading` | renderer 回報（proxied `terminal:reading-state`） | 回報 `false`（renderer 已含停手 10 s）＋安靜 1 s | 每個佇列 60 s（`NOTIFY_HOLD_READING_MAX_MS`），到時照送 | 只擋 helper 通知；🔴 不擋回答 |
| `queued` | 前面還有保留項目，或原子窗口開著 | 前一則送完 | — | — |

保留時 helper 照舊拿到 `{ ok: true, held: true }`；`held-full`（8 筆）、不設逾時、PTY 結束 / ⏻ / recovery 丟棄都與 T0788 相同。

### S1 草稿判斷（`src/lib/tower-input-draft.ts` `trackDraft`）

只看使用者送進該 PTY 的位元組（`pty:write` 的使用者輸入路徑：本機視窗或 headless client；終端自動回應不算），保守規則——誤判只會多保留：

| 輸入 | 效果 |
|---|---|
| `\r`（bracketed paste 外）、Ctrl+C `\x03` | 清除草稿 |
| 可列印字元、Tab、`\n`、bracketed paste（含其中的 `\r`）、Alt＋鍵（含 Alt+Enter）、↑ / ↓、CSI u 鍵、不認得的序列 | 有草稿 |
| 單獨 Esc、←/→/Home/End/Insert/Delete/PageUp/PageDown、focus 回報、滑鼠回報、游標位置回報、Backspace 與其他 C0 | 不變 |

已知誤判：游標移動後刪光、`/` 選單選完、Tab 補完到空字串都還算有草稿 → 「📨 待送」顯示「你在輸入」＋「立即送出」，5 分鐘提醒一次。所有分頁都追蹤（便宜、不改行為），只有契約 2 塔台用來保留。

### 閱讀信號（`src/lib/tower-reading-state.ts` `TowerReadingTracker`）

renderer 只對契約 2 塔台分頁啟用（`TerminalPanel.tsx`）：normal buffer `viewportY < baseY`、有選取（`onScroll` / `onSelectionChange`）、或滾輪 / PageUp / Shift+PageUp（container capture listener）→ 閱讀中；最後一個信號結束後再維持 `TOWER_READING_LINGER_MS` = 10 s。只在值改變時呼叫 `pty.setReadingState(terminalId, reading)`；停用（契約改變、分頁卸載）時若回報過 `true` 先送一次 `false`。

host：`setReading(id, reporter, reading)`，`reporter` = `conn:<connectionId>` / `win:<windowId>`（`readingReporterOf`，`electron/handlers/pty.ts`），任一 reporter 為 `true` 即閱讀中；PTY 結束清除。

### 原子送出（250 ms 窗口）

- helper 文字送出（pass-through 或保留後送出）時開窗口（`openAtomic`）；同分頁的使用者輸入由 host 暫存（`holdUserWrite`），直到視窗寫回 `{ auto: true }` / `{ submit: true }` 的 `\r`（`afterSubmitWrite`）或 `NOTIFY_HOLD_ATOMIC_MAX_MS` = 1 s，然後依序補寫。
- 窗口開著時，同分頁的下一則 helper 通知排隊（`queued`）；保留佇列送下一則前等上一則的窗口關閉。
- pass-through 的那則：同一 helper 連線的下一個 keypress 照舊送出（不進佇列）；期間分頁變成 blocked → keypress 依 T0788 保留，窗口 1 s 後補寫使用者輸入。
- 只預填（不帶 `--submit`）時沒有 Enter，使用者輸入 1 s 後補寫。

### 回答（W5 的介面）

`enqueueAnswer(targetId, text, { connectionId? })`：單行、1–1,000 字（不含 `\r` / `\n`）；只接受契約 2 塔台（否則 `not-contract-tower`）；受 prompt 與 `draft` 擋、不受 `reading` 擋；排在已保留的通知後面；沒被擋就立即送出（不等安靜 1 s）。Enter 以 keypress（`source: 'answer'`、`userInput: true`）由視窗產生，寫 `{ submit: true }`：算使用者輸入。`^[UA]-\d+：` 前綴、IPC `tower-inbox:answer` 與 UI 在 W5。

### 「📨 待送」與「立即送出」

- `terminal:notify-hold-changed` 多 `reason`（只有契約 2 塔台；其他分頁的事件與 T0788 相同，沒有這個欄位）、項目多 `kind: 'answer'`。
- 縮圖選單顯示原因（你在輸入 / 你在閱讀 / 等你回答對話框 / 排隊）；原因是 `draft` / `reading` 時有「立即送出」（本機 IPC `terminal:notify-hold-send-now`，`sendNow`）：該分頁所有項目（依序）不再受 `draft` / `reading` 擋；🔴 prompt 仍擋（Enter 會作答，BUG-196）。有草稿時立即送出的文字會接在草稿後面一起送出（使用者自己的選擇，tooltip 說明）。
- 5 分鐘提醒：主行程送 `terminal:notify-hold-reminder`（本機視窗），持有該分頁的視窗（`TerminalPanel`）以系統通知（Web `Notification`）顯示一次。

## 日誌

```
[notify-hold] passed terminal=<塔台> source=<Worker> part=text len=<n> (atomic)
[notify-hold] held terminal=<塔台> source=<Worker|answer> … reason=draft|reading|… part=text|enter len=<n> queued=<N>
[notify-hold] atomic closed terminal=<塔台> cause=enter|timeout|replaced kept=<筆數> bytes=<n>
[notify-hold] reading terminal=<塔台> reading=true|false
[notify-hold] reading limit terminal=<塔台> after=60000ms count=<N>
[notify-hold] reminder terminal=<塔台> reason=draft count=<N>
[notify-hold] send-now terminal=<塔台> count=<N> [(still held: <prompt reason>)]
[notify-hold] answer terminal=<塔台> source=answer len=<n> (sending)
[tower-reading] terminal=<塔台> reading=true|false            ← renderer
[terminal-submit] remote Enter input terminal=<塔台> trace=<id> path=xterm-input …   ← renderer（B0）
```

🔴 不記文字、草稿、回答內容；暫存的使用者輸入只記筆數與長度。

## 已知限制

- 遠端 profile 視窗：保留與 `draft` / `reading` 在 bat-server 上照樣生效（`terminal:reading-state` 是 proxied channel），但「📨 待送」清單、「立即送出」、5 分鐘提醒只在本機視窗（T0788 的既有限制：`terminal:notify-hold-*` 沒有加進 `PROXIED_CHANNELS` / `PROXIED_EVENTS`）。遠端使用者的草稿保留在送出 / Ctrl+C 後自然放行，但看不到原因。要支援需另開工單。
- fullscreen claude：BAT 看不到 claude 內部捲動，只看滾輪 / PageUp 事件（停手 10 s 放行）。
- S1 是推估（見上表）；codex 的 Ctrl+C / Enter / Shift+Enter 行為待實機（T0902 T-5）。
- `reading` 60 s 是從「閱讀開始擋住這個佇列」起算，到時再加安靜 1 s。
- 原子窗口暫存最多 1 s：helper 的 Enter 晚於 1 s 抵達（極慢的遠端連線）時，使用者輸入先補寫，退回今天的行為。

## 驗證

- 單元：`src/lib/__tests__/tower-input-draft.test.ts`、`tower-reading-state.test.ts`、`tower-submit-enter.test.ts`（真 xterm＋TerminalPanel source guard）；`electron/__tests__/notify-hold-contract-tower.test.ts`（版本閘門、draft、reading、原子送出、回答、立即送出、提醒、日誌）、`notify-hold-contract-handlers.test.ts`（共用 handler＋真 PtyManager）；`src/components/__tests__/notify-hold-reason-menu.test.tsx`（原因、立即送出、三語系）。T0788 既有 `notify-hold.test.ts` / `notify-hold-ask-held-full.test.ts` 不改、全綠。
- e2e（隔離實例，假 TUI，不需登入）：`e2e/t0904-tower-notify-protection.spec.ts`（`e2e/fixtures/fake-line-editor.mjs`、`notify-job-runner.mjs`）：① 未宣告塔台 #23 重現、② 契約 2 草稿分開送出、③ 窗口內打字 / Enter、④ 閱讀 60 s 上限＋viewport 不動（B0）、⑤ 停手 10 s 放行。需先 `npx vite build`。
- 待實機（T0902）：T-1 / T-2（真 claude 塔台的 #23 與捲動）、T-3（fullscreen＋Auto-scroll）、T-5（codex 輸入框）、T-7（WSL 塔台的 `draft` / `reading`）、T-8（舊 CT＋新 BAT 保護停用）。
