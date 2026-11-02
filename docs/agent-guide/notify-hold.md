# 塔台等使用者回答時保留 Worker 通知（T0788 / BUG-196，D227）

> CLAUDE.md 對應小節：「塔台等使用者回答時保留 Worker 通知（T0788 / BUG-196，D227）」。改這個功能時兩邊一起更新。

## 為什麼

T0787 實測（隔離實例＋假模型，30 / 30）：塔台（claude-cli 分頁）停在權限對話框或 AskUserQuestion 時，Worker 的
`bat-notify --submit "T#### 完成"`（含 CT 批次提問最後一題的 `--ask --submit`）送出的 Enter 會替使用者選中預設選項：
權限對話框 →「1. Yes」→ 工具真的執行；AskUserQuestion → 第一個選項。只預填（不帶 `--submit`）不會作答，但文字被對話框吞掉。

根因：`pty:write`（`electron/handlers/pty.ts`）與 `terminal:keypress`（`electron/handlers/terminal.ts`）不看目標分頁是否在等使用者；
submit 的 Enter 由塔台分頁的 xterm 產生（`dispatchEnter` → xterm `onData` → renderer `pty.write`），主行程把它記成使用者輸入。

防護放在主行程，不靠 helper 先查再送：先查再送有競態窗口，而且舊 helper、手動腳本、遠端 headless 也要一起受保護。

## 契約（T0787 契約草案 v0，D227）

| # | 項目 | 內容 |
|---|---|---|
| 1 | 觸發 | helper 經 RemoteServer 呼叫（`ctx.helper`）的 `pty:write` / `terminal:keypress`，目標分頁 `TerminalBlockedTracker` 的 reason 是 `permission` / `question` / `elicitation` / codex `input`。`tower`（Worker 等塔台答覆）**不**觸發。`blockedDetection: none` 照現行行為送出，記 `[notify-hold] skipped (detection none)`。本機視窗 / headless client 的輸入、`{ auto: true }` 永遠不保留。目標已有保留項目時，之後的 helper 寫入一律排在後面（不插隊，`reason=queued`）。 |
| 2 | 保留單位 | 同一 helper 連線、同一目標，`pty:write` 後 `NOTIFY_HOLD_PAIR_WINDOW_MS` 內的 `terminal:keypress` 併成一筆；單獨的 `pty:write`（預填）或單獨的 keypress 各自一筆。 |
| 3 | 回應 | 保留時兩個 channel 都回 `{ ok: true, held: true }`。bat-notify 只看 `ok === false`，所以 **exit code 與 stdout 完全不變**。 |
| 4 | 送出 | 離開 hook / osc `blocked` 後連續安靜 `NOTIFY_HOLD_QUIET_MS`（期間的使用者輸入重新計時，新的 `blocked` 停止計時），依保留順序：文字 → `NOTIFY_HOLD_ENTER_DELAY_MS` → Enter（`terminal:keypress` 事件，照舊由視窗的 xterm 產生）；兩筆之間也等 `NOTIFY_HOLD_ENTER_DELAY_MS`。每一步前再檢查一次 `blocked`：文字送出後又 blocked，Enter 留著等下一次答完。 |
| 5 | 上限（CT 同意，D228） | 每個目標最多 `NOTIFY_HOLD_MAX_PER_TARGET` 筆，再多回 `{ ok: false, reason: 'held-full' }`（bat-notify exit 1，現行錯誤路徑）。配對的 keypress 併入已保留的那筆，不另佔名額，不會回 `held-full`。`--ask --submit` 的 `pty:write` 遇 `held-full`：bat-notify 既有的 `--ask` 失敗路徑先 `question:cancel` 已登記的題目，再 exit 1（stderr `ask: NOTIFY_STEP pty-write`、`ask: NOTIFY_FAILED`），CT 不會答到一題已改走工單的題目。🔴 **不設逾時**（Renew #1，D228）：逾時丟棄會讓通知無聲遺失（helper 拿到 ok，Worker 不走備援），逾時照送會重現 BUG-196。 |
| 6 | 提示與取消（同 T0769） | 塔台分頁縮圖顯示「📨 待送 N」，按下列出來源工單、時間、內容種類（文字＋Enter / 只有文字 / 只有 Enter），可逐筆或全部取消。取消只丟 PTY 寫入；toast、Worker ✓ 照舊。 |
| 7 | 生命週期 | 只在以下情況離開佇列：送出（第 4 點）、使用者取消（第 6 點）、PTY 結束（exit / kill，所以 ⏻ 重啟也算）、Terminal Server recovery 全部丟棄（記數量）；不持久化，BAT 重開即消失。 |
| 8 | 日誌 | 見下節；🔴 不記文字內容。 |
| 9 | submit Enter 不算使用者輸入（CT 同意，D228） | renderer 收到 `terminal:keypress` 後的 `dispatchEnter` 帶 `{ auto: true }`（`src/components/TerminalPanel.tsx`）：不清 `blocked`、不更新 `lastUserInputAt`、不取消該分頁的用量限制等待。焦點行為不變（`restoreFocus` 只給 T0566 的用量限制續行）。 |
| 10 | `--report-hold`（CT 同意不加，D228） | 不加。本單不改 `scripts/bat-notify.mjs` 的參數與輸出。 |

### 常數（`electron/notify-hold.ts`）

| 常數 | 值 | 說明 |
|---|---|---|
| `NOTIFY_HOLD_MAX_PER_TARGET` | 8 | 每個目標分頁最多保留幾筆 |
| `NOTIFY_HOLD_QUIET_MS` | 1 s | 離開 blocked 後要安靜多久才送 |
| `NOTIFY_HOLD_PAIR_WINDOW_MS` | 2 s | keypress 併入前一筆 write 的時間窗（bat-notify 間隔 250 ms） |
| `NOTIFY_HOLD_ENTER_DELAY_MS` | 250 ms | 文字與 Enter 之間、兩筆之間（同 bat-notify `SUBMIT_KEYPRESS_DELAY_MS`） |

CT 已回覆（BMad-Guide `_reply-2026-11-02-bat-notify-hold-contract.md`，CT D543 / BAT D228）：同意預設保留、上限 8 筆、第 9 / 10 點；兩種逾時方案都不採用（見第 5 點）。日後改值只改常數（與本檔、CLAUDE.md 對應小節）。

## 實作位置

- 唯一實作：`NotifyHoldController`（`electron/notify-hold.ts`）—— 保留佇列、合併、上限、送出排程（不設逾時，D228）。不 import electron，Electron main 與 headless 共用，deps 注入比照 `close-worker.ts` / `usage-limit-continue.ts`。只讀 `TerminalBlockedTracker`（經 PtyManager 的 `getBlockedState` / `getBlockedDetection`），不改它的判斷規則（T0590 / T0757 / T0621）。
- 接線：`pty:write`（`interceptWrite`；使用者輸入 → `onUserInput`）、`terminal:keypress`（`interceptKeypress`）只接線。
- Electron main（`electron/main.ts`）：`registerProxiedHandlers` 建立；PtyManager deps 的 `onBlockedChange` / `onPtyExit` / `onServerRecovery` 轉給它；保留的 Enter 經 `terminalEmit('terminal:keypress', …)`（所有視窗 + broadcastHub，同原路徑）；「待送 N」的事件 `terminal:notify-hold-changed` 只送本機視窗；renderer IPC `terminal:notify-hold-list` / `terminal:notify-hold-cancel` 是 `ipcMain.handle`（🔴 不是 RemoteServer / helper channel）。
- headless（`electron/remote/headless-entry.ts`）：`createHeadlessPtyModule` 建立，`onNotifyHold` 交給 terminal module 的 `terminal:keypress`；保留的 Enter 經 `host.emit`，沒有 client（`countRemoteReceivers` = 0）→ 丟棄並記 `dropped … (no-receiver)`。
- renderer：`src/stores/notify-hold-store.ts`（`useNotifyHold` / `cancelNotifyHold`，第一次使用時訂閱並拉一次清單）、`src/components/TerminalThumbnail.tsx`（`.notify-hold-badge` 與 `.notify-hold-menu` popover，點外部關閉）、i18n `notifyHold.*`（三語系）。共用型別 `src/types/notify-hold.ts`（不含文字）。

## 日誌

主行程 debug log（bat-scripts.log 另有 `notify-hold` 事件，欄位相同、無文字）：

```
[notify-hold] held terminal=<塔台> source=<Worker 分頁> [workorder=T####] reason=permission|question|elicitation|input|queued part=text|enter len=<n> queued=<N>
[notify-hold] sent terminal=<塔台> source=<…> reason=<r> part=text|enter len=<n>
[notify-hold] cancelled|dropped terminal=<塔台> source=<…> reason=<r> part=<…> len=<n> (<原因>)
[notify-hold] dropped terminal=<塔台> count=<N> (pty-ended|server-recovery)
[notify-hold] dropped terminal=<塔台> source=<…> reason=held-full (<r>) len=<n> max=8
[notify-hold] skipped (detection none) terminal=<塔台> source=<…> channel=pty:write|terminal:keypress
[remote][terminal] ipc-result channel=terminal:keypress result=held target=<塔台> trace=<id>
```

`dropped` 的原因：`pty-ended`、`server-recovery`、`write-failed:<reason>`、`no-receiver`（headless 沒有 client）、`held-full`。

## 已知限制

- `blockedDetection: none`（使用者關掉 hooks、非 claude / codex 分頁）照舊直接送出，Enter 仍可能作答對話框：BAT 無法判斷。
- 保留以 `TerminalBlockedTracker` 的狀態為準。T0788 e2e 量到一次（60 次裡 1 次，假模型回得極快）：claude 的 hook 回報亂序，`permission-request` 先到、`user-prompt-submit` 後到，把 `blocked` 清掉，對話框其實還在 → 那次通知不會被保留（`--submit` 時 Enter 仍會作答）。這是 hook 回報的既有競態（T0590 範圍，本單不改判斷規則），已回報塔台另案處理；e2e 偵測到就記 `RACE` 並重跑該情境（`races` 計數）。
- 遠端 profile 視窗：保留在 bat-server 上照樣生效，但「待送 N」與取消只在本機視窗（`terminal:notify-hold-*` 是 Electron 的本機 IPC，沒有加進 `PROXIED_CHANNELS` / `PROXIED_EVENTS`）。遠端視窗看不到待送清單；要支援需另開工單（protocol / path-aware 分類，D227 範圍外）。
- 送出時塔台若正在工作中（使用者答完後 claude 繼續原回合），文字會打進 claude 的輸入框、Enter 讓 claude 排隊 —— 與修正前塔台忙碌時收到通知相同。
- 文字送出後、Enter 送出前（250 ms）塔台若又進入 blocked：Enter 留著等下次答完，但已送出的文字可能被新對話框吞掉（與修正前同一個競態，窗口縮到 250 ms）。
- CT 看不到「通知被保留、塔台還沒看到」（第 10 點未加 `--report-hold`）。
- `--close-worker`：取消條件是**被關閉的 Worker 分頁**自己的使用者輸入（`close-worker.ts` `fire`），塔台分頁的 submit Enter 本來就不影響它（BUG-196「附帶發現」中這一項的推論不成立）；只有塔台分頁本身也是被排程關閉的 Worker 時才相關。第 9 點實際修到的是塔台分頁自己的 ⚠️ 與用量限制等待。

## 驗證清單

- 單元：`electron/__tests__/notify-hold.test.ts`（保留條件、`tower` 不觸發、`none` 跳過、合併窗口、上限 `held-full`（配對的 Enter 不佔名額）、不逾時、PTY 結束 / recovery 丟棄、送出順序、安靜重新計時、送出前再檢查、取消一筆 / 全部、日誌不含文字；接上真 PtyManager 的 handler 測試與突變對照；第 9 點：`{ auto: true }` 不清 blocked、不呼叫 `onUserInput`）。
- `--ask --submit` 遇 `held-full`：`electron/__tests__/notify-hold-ask-held-full.test.ts`（真的 handler 回的 `held-full` 交給 bat-notify → `question:cancel` 先於 exit 1、stderr `ask: NOTIFY_STEP pty-write`；真的問題 store 取消後狀態 `cancelled`）。
- 突變檢查：拿掉 `pty.ts` 的 `if (held) return held` 或 `terminal.ts` 的 `if (held) {…}` → 上述測試失敗。
- e2e：`e2e/t0787-notify-into-blocked-tower.spec.ts`（預設跑斷言版；`T0787_PROBE=1` 跑 T0787 探針）。Windows、內嵌 claude、先 `npx vite build`。10 情境 × 2 輪＋「待送 N」顯示與取消；第二個 test 是 codex 塔台的審批提示（OSC 7501 `input`，codex >= 0.163.0，找法同 `e2e/t0621-codex-osc-state.spec.ts`，找不到就 skip）：保留 → `y` 核准 → 模型收到通知。
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`。
