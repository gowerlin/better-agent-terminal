# 塔台待辦（PLAN-068）

> CLAUDE.md「塔台回合訊息卡（PLAN-068 W3 / T0905）」節的完整內容。規格來源：T0902 回報區（第一版＋〈第二版（Renew #1，D328）〉）。W0 的版本閘門（`--bat-contract`、`towerContract`）見 [tower-tab-title.md](tower-tab-title.md)。本檔目前只有 W3（回合訊息卡的資料層）；待辦分頁的 UI（W4 / W6）與通知保護（W1 / W2）由各自的工單補上。

## 回合訊息卡：資料層（W3 / T0905）

- **用途**：已宣告契約 v2 的塔台分頁，每回合一張卡片，內容是該回合 claude 的最後一則助理訊息；右側欄「待辦」分頁的「💬 塔台訊息」區（W6）讀這些卡片。
- **唯一實作**：host `electron/tower-cards.ts`（`TowerCardStore`、`registerTowerCardHandlers`，不 import electron，本機 `electron/main.ts` 與 headless `createHeadlessTerminalQueryModule` 共用）；型別與上限 `src/types/tower-cards.ts`；renderer `src/stores/tower-cards-store.ts`（只資料）。

### 來源

| 塔台 | 怎麼來 | 程式 |
|---|---|---|
| claude-cli 塔台 | `Stop` hook 的 `last_assistant_message` | `scripts/bat-hook.mjs stop` → `terminal:report-hook` → `ReportHookDeps.onStop` → `TowerCardStore.offerHookStop` |
| Claude Agent 面板塔台 | 面板 query 的 `result`（`subtype: 'success'` 的 `result` 文字） | `ClaudeAgentManager.setTurnResultListener` → `offerPanelMessage` |
| codex 塔台 | 沒有（D158，T0902 §4） | — |

### hook 端（`scripts/bat-hook.mjs`）

- 只有 `stop` 事件讀 `last_assistant_message`；非字串或空白 → 不送。stdin 沿用 `STDIN_MAX_BYTES`（256 KiB），超過整個輸入讀不到，照舊只回報 `stop`（不帶訊息）。
- 送出前截到 `LAST_MESSAGE_MAX_BYTES` = 16 KiB（UTF-8 位元組，切在字元邊界，`truncateUtf8`），截過就帶 `messageTruncated: true`。
- `stop` 回報另帶 `origin: 'injected'` 與 `set: BAT_HOOK_SET`（= 2；`electron/bat-mcp-launch.ts` 的 `BAT_HOOK_SET` 寫在 `BAT_CLAUDE_HOOKS` 旁，兩處由 `scripts/__tests__/bat-hook-last-message.test.mjs` 守住相等）。其他事件的回報**逐字不變**（host 把沒有 `origin` 的回報當成 `injected`，T0902 §7.4）。
- 🔴 T0590 規則不變：一律 exit 0、stdout 不輸出、總時限 1.8 s、任何失敗靜默；`at`（T0790）規則不變。bat-scripts.log 只多 `messageBytes`（長度），不記訊息。

### host 端：`terminal:report-hook`

- 新欄位都是選填、格式不對就忽略（不回錯）：`origin`（`injected` / `plugin`，`parseHookOrigin`）、`set`（整數 1–1000，`parseHookSet`）、`lastAssistantMessage`（只看 `stop`；字串且 ≤ `REPORT_HOOK_MESSAGE_MAX_CHARS` = 64 Ki 字元）、`messageTruncated`（只有 `true` 算數）。
- **注入＋plugin 去重**（§7.4）：同一個 PTY 收過 `injected` 的回報後，`plugin` 的回報回 `{ ok: true, terminalId, result: 'duplicate' }`、不套用（tracker 不動、不進卡片），每個 PTY 只記一行 `[hooks] terminal=<id> plugin reports dropped …`。紀錄跟著 PTY 結束 / Terminal Server recovery 消失（`TerminalBlockedTracker.acceptHookOrigin` / `getHookSet`；`PtyManager` 同名方法）。`plugin` 由 W9 的 launcher 帶。
- 套用後的 `stop` 交給 `onStop(terminalId, { message?, set? })`；handler 不記錄、不 mirror、不回傳訊息內容。回傳形狀與 T0905 前相同。

### 卡片 store（`TowerCardStore`）

| 規則 | 內容 |
|---|---|
| 誰的訊息會留下 | 只有 `towerContractStatus(role, towerContract) === 'match'`（已宣告塔台＋`--bat-contract 2`）。其他分頁（Worker、一般 claude、沒宣告契約或契約不是 2 的塔台）收到即丟，不存內容；每個分頁只記一行 `dropped: not a contract-2 Tower (length=<n>…)`。判定在收件當下做：塔台之後改宣告，已有的卡片留到 PTY 結束，新的不收 |
| 面板塔台 | 面板沒有 `--set-role`，由呼叫端 `setPanelTower(id, true)` 宣告（§6′：面板以 `_tower-state.md` 的 `bat_contract` 判定，renderer 讀檔，W4 提供判定）。**T0905 沒有任何地方呼叫它**，所以面板目前不產生卡片；`setPanelTower(id, false)` 清掉該面板的卡片 |
| 遮罩 | 收件即 `redactTerminalSecrets`（含 server token 字面值），日誌只記遮罩次數 |
| 大小 | 遮罩後再截到 `TOWER_CARD_MAX_BYTES` = 16 KiB（UTF-8），`truncated` = hook 截過或 host 截過 |
| 上限 | 每個分頁最近 `TOWER_CARDS_MAX` = 30 張未釘選（超過丟最舊的）；釘選另計，最多 `TOWER_CARDS_PINNED_MAX` = 10 張（第 11 張 → `PIN_LIMIT`）；取消釘選後算回 30 張內（可能擠掉最舊的未釘選卡） |
| 去重 | 同一分頁、同一 session id（hook：`PtyManager.getClaudeSessionId`；面板：`panel:<id>`）＋內容 SHA-256，`TOWER_CARDS_DEDUPE_WINDOW_MS` = 10 s 內只留一張（注入與 plugin 都回報同一個 `Stop` 的情況）。10 s 後同樣內容算新的一回合 |
| 沒有訊息的 `stop` | 契約 v2 塔台的計數 `stopsWithoutMessage` 加一（G7：claude 太舊沒有這個欄位，或回合結束時沒有文字）；W6 依此顯示原因 |
| 狀態 | 未讀 / 已讀 / 釘選存在 host，多視窗一致 |
| 生命週期 | PTY 結束（exit / kill，所以 ⏻ 重啟也算）清空；Terminal Server recovery 清空所有 PTY 分頁（面板不受影響）；面板 session dispose（`claude:dispose-session`）清空該面板。不寫檔、不跨 BAT 重開 |
| 日誌 | `[tower-cards] terminal=<id> card added source=<hook\|panel> bytes=<n>[ truncated][ masked=<n>] cards=<n>[ evicted=<n>]`、`duplicate dropped`、`read=<n>`、`pinned` / `unpinned`、`cleared=<n>`、`cleared <n> card(s) (<原因>)`、`… refused: helper capability`。🔴 永遠不記訊息內容 |

### channel 與事件（proxied）

| channel | 參數 | 回傳 |
|---|---|---|
| `tower-cards:list` | `{ terminalIds? }`（省略 = host 上所有有卡片的分頁與已宣告的面板塔台） | `{ ok: true, entries: TowerCardsEntry[] }` |
| `tower-cards:mark-read` | `{ terminalId, cardIds? }`（省略 = 全部） | `{ ok: true, changed }` |
| `tower-cards:pin` | `{ terminalId, cardId, pinned }` | `{ ok: true, changed }` / `NOT_FOUND` / `PIN_LIMIT` |
| `tower-cards:clear` | `{ terminalId, cardIds?, includePinned? }`（沒有 `cardIds` = 所有未釘選；`includePinned` = 全部） | `{ ok: true, changed }` |
| 事件 `tower-cards:changed` | `{ terminalId, revision, unread, total }` | 🔴 只有數字，不含卡片文字 |

- `TowerCardsEntry`：`{ terminalId, alive, revision, cards（舊 → 新）, unread, stopsWithoutMessage }`；卡片 `{ id, terminalId, source, text, truncated, createdAt, read, pinned }`。`revision` 是整個 host 共用的遞增數字；沒有卡片的分頁回目前的值（不會比視窗看過的舊），視窗據此丟掉副本。
- 🔴 四個 channel 都**不在** `HELPER_CHANNEL_ROLES`，handler 另外拒絕 `ctx.helper`（`FORBIDDEN`）：Worker 與塔台自己的 PTY 權杖都不能讀或改卡片（R7）。舊 bat-server 沒有 handler → 視窗的呼叫 reject。
- 本機視窗走 `ipcMain`（`PROXIED_CHANNELS`），遠端視窗經 RemoteClient 送到該 profile 的 bat-server；事件經 `PROXIED_EVENTS` 到該 profile 的視窗。`path-aware-channels.ts` 歸為不轉換路徑（卡片文字照塔台寫的原樣）。

### renderer（`src/stores/tower-cards-store.ts`）

- `createTowerCardsSync({ api, terminalIds, onPtyExit?, onClientStatusChanged?, log? }).start()`：開始時抓一次視窗的分頁；`tower-cards:changed` 的 `revision` 比副本新 → 重抓該分頁；`pty:exit` 丟副本；遠端「未連線 → 已連線」時以 `tower-cards:list` 對帳（強制取代，比照 T0749），抓失敗保留原狀。
- 讀取：`useTowerCards(id)`、`getTowerCards(id)`、`towerCardsUnread(id)`。已讀 / 釘選 / 清除直接呼叫 `window.electronAPI.towerCards`，結果由 host 的事件帶回，store 不自己改卡片。
- 🔴 T0905 沒有接到 `App.tsx`（不在範圍）：W6 在 App 呼叫一次 `createTowerCardsSync(...).start()`；卡片區仍以分頁的契約狀態（`tower-contract-store`）決定要不要顯示。

### claude 版本（G7）

- `Stop` hook 的 `last_assistant_message`：最早出現在 **claude `2.1.47`**（`2.1.45` 沒有；`2.1.46` 未發佈到 npm）。T0905 以 `npm pack` 逐版二分查 `@anthropic-ai/claude-code`（`cli.js` 版查 `cli.js`，原生二進位版查 `@anthropic-ai/claude-code-linux-x64` 的執行檔），比對完整識別字（`last_assistant_message` 後面不接 `_`：較早版本已有不相干的遙測欄位 `last_assistant_message_id`，`1.0.64` 起）。`2.1.47` 的 hook 輸入 schema：`Stop` / `SubagentStop` 的 `last_assistant_message: string().optional()`（"Text content of the last assistant message before stopping"），值是最後一則助理訊息的文字區塊以空白串接後 trim，空字串時不帶。
- 比這舊的 system claude：`stop` 照樣回報，只是沒有訊息（`stopsWithoutMessage` 增加，W6 顯示「升級 claude」）。內嵌 claude（`^2.1.331`）有這個欄位（`2.1.331` 執行檔也確認有）。

### 已知限制

- 卡片只在 host 記憶體，BAT 重開或 bat-server 重啟後沒有（T0902 §3，不重建 transcript）。
- 面板塔台的判定（`setPanelTower`）要等 W4；W3 只提供介面與測試。
- 實際訊息大小、多段文字 / 工具呼叫回合的內容未實測（T0902 待實機 T-4）；注入＋plugin 並存的去重未實機（T-10，plugin 由 W9 提供）。

### 驗證

- 單元：`electron/__tests__/tower-cards.test.ts`（store、handlers、不在 helper 範圍）、`electron/__tests__/tower-cards-report-hook.test.ts`（report-hook 新欄位、origin 去重、onStop）、`electron/__tests__/tower-cards-panel-source.test.ts`（面板來源）、`scripts/__tests__/bat-hook-last-message.test.mjs`（hook 端、`BAT_HOOK_SET` 相等、整支腳本 exit 0 / stdout 空）、`electron/__tests__/terminal-blocked-state.test.ts`「T0905: Stop sends last_assistant_message …」（真腳本經 RemoteServer）、`src/stores/__tests__/tower-cards-store.test.ts`。
- headless：`electron/remote/__tests__/headless-tower-cards-e2e.test.ts`（真 headless＋node-pty：塔台 PTY 內宣告契約 2 並回報、Worker 與未宣告契約的塔台被丟、塔台自己的權杖呼叫 `tower-cards:*` 被拒、視窗 list / mark-read、PTY 結束清空、事件不含文字）。
