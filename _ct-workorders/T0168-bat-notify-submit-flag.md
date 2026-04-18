# T0168-bat-notify-submit-flag

## 元資料
- **工單編號**：T0168
- **任務名稱**：實作：`scripts/bat-notify.mjs` 新增 `--submit` flag（append `\r` 自動送出）
- **狀態**：DONE
- **開始時間**：2026-04-18 12:53 (UTC+8)
- **完成時間**：2026-04-18 13:00 (UTC+8)
- **類型**：implementation
- **互動模式**：disabled（規格明確，不需互動）
- **建立時間**：2026-04-18 12:50 (UTC+8)
- **預估工時**：1-1.5h（含驗證）
- **預估 context cost**：低（單檔 < 50 行改動）
- **關聯 PLAN**：PLAN-020（工單 1/5）
- **關聯研究**：T0167（見 `_report-plan-020-yolo-feasibility.md` §D 工單 1）
- **關聯決策**：D059（PLAN-020 啟動）、D060（Q2.A 資訊來源）
- **依賴**：無（PLAN-020 工單 1，可立刻執行）
- **風險**：🟢

## 目標

讓 `bat-notify.mjs` 在呼叫方要求時，把訊息**真正送出**（append `\r` 觸發 PTY 讀入），不再只是「預填」。這是 yolo 模式 Worker→Tower 自動化的核心能力，其他 4 張工單都依賴本工單。

## 範圍

**納入**：
1. `scripts/bat-notify.mjs` 的 argv 解析（約 line 88 附近）新增 `--submit` flag
2. 訊息送出路徑（line 305 附近 `args: [target, message]`）依 flag 決定是否 append `\r`
3. `--submit` 與 `--no-pty-write` 的互斥檢查（同時指定 → exit 1）
4. 雙終端互測驗證（兩個 BAT 終端互相送訊息）
5. 回歸驗證（無 `--submit` 時行為與現狀一致）

**排除**：
- 不改 `scripts/bat-terminal.mjs`
- 不改 `electron/terminal-server.ts` / `electron/pty-manager.ts`
- 不改任何 skill 檔案（Layer 1 唯讀）
- 不改 `package.json`
- 不改 TypeScript 型別

## 詳細規格

### 1. argv 解析新增

現行 flag：`--target`、`--source`、`--no-pty-write`

新增：`--submit`（boolean，預設 false）

語意：
- `--submit` 有設定 → 目標 PTY 收到 `message + \r`（自動送出）
- 未設定 → 現有行為（只預填，不送）

### 2. 互斥規則

- `--submit` + `--no-pty-write`：邏輯矛盾（一個要送、一個不寫 PTY）→ exit 1 + 錯誤訊息
- `--submit` 下 `terminal:notify`（Toast）仍正常執行（不受影響）

### 3. 訊息組裝

line 305 附近：
```js
// Before
args: [target, message]

// After
args: [target, submit ? message + '\r' : message]
```

（具體實作可視 Worker 判斷，確保不影響其他 flag）

### 4. CLI 使用範例（加到 header comment）

```
# 預填（現狀）：
node scripts/bat-notify.mjs "T0168 完成"

# 預填並自動送出（新）：
node scripts/bat-notify.mjs --submit "T0168 完成"

# 互斥錯誤：
node scripts/bat-notify.mjs --submit --no-pty-write "msg"
# → Error: --submit and --no-pty-write are mutually exclusive
# → exit 1
```

## 驗收條件

### 功能驗證
- ✅ **A1**：無 flag 呼叫行為與現狀一致（目標 PTY 僅預填，不送出）
- ✅ **A2**：`--submit` 使目標 PTY 收到 `\r`
  - **雙終端互測**：
    1. 開兩個 BAT 終端 A / B，取得 B 的 `BAT_TERMINAL_ID`
    2. 在 A 執行：`node scripts/bat-notify.mjs --submit --target <B-id> "echo ok"`
    3. 預期 B 終端出現 `echo ok` 並自動執行，列印 `ok`
- ✅ **A3**：`--submit --no-pty-write` 回傳 exit code 1 + 清楚錯誤訊息
- ✅ **A4**：`--submit` 下 `terminal:notify`（UI Toast + tab badge）仍顯示
- ✅ **A5**：`--source` / `--target` / 其他現有 flag 相容性不變

### 程式碼品質
- ✅ **Q1**：新增的 argv 解析風格與現有 code 一致
- ✅ **Q2**：header comment 更新（Usage 範例新增 `--submit`）
- ✅ **Q3**：錯誤訊息清楚可讀
- ✅ **Q4**：無 ESLint warning / 型別錯誤

### 邊界處理
- ✅ **B1**：`message` 為空字串時 `--submit` 行為合理（送一個 `\r` = 空行送出？或拒絕？實作者判斷，寫入回報）
- ✅ **B2**：`message` 已含 `\r` 或 `\n` 結尾時 `--submit` 不重複 append（避免雙 `\r`）

## Commit 策略

- 單一 commit：`feat(scripts): add --submit flag to bat-notify.mjs (PLAN-020 W1)`
- 不 push（使用者控制推送時機）
- 收尾時呼叫 `bat-notify.mjs`（若可）回報塔台：`node scripts/bat-notify.mjs --source "T0168" --target $BAT_TOWER_TERMINAL_ID "T0168 完成"`
  - 注意：**不使用 `--submit` flag**（yolo 尚未啟用，仍由使用者手動送出）

## 注意事項

- 本工單是 PLAN-020 的第 1 張，**不啟用 yolo**（yolo 要等工單 3/4 完成 + 上游 skill 更新後才能用）
- 本工單產出的 `--submit` 能力**只會被 yolo 模式呼叫**，目前無人使用是正常狀態
- 驗收 A2 雙終端互測時，如果 target PTY 沒反應，先確認 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` env 有繼承到子 session

## 收尾

1. Commit（見上方策略）
2. 填寫下方回報區
3. （可選）呼叫 `bat-notify.mjs` 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 開始時間 / 完成時間
- 開始：2026-04-18 12:53 (UTC+8)
- 完成：2026-04-18 13:00 (UTC+8)

### Commit
`c4b2a19` — feat(scripts): add --submit flag to bat-notify.mjs (PLAN-020 W1)

### 驗收結果
- ✅ **A1** 無 flag 行為不變：靜態程式碼驗證 — `payload = message`（與現狀相同），新增程式碼僅在 `submit=true` 分支生效
- 🟡 **A2** `--submit` 送 `\r`：程式碼驗證（`payload = message + '\r'`）；雙終端實機互測由使用者在 Tower session 執行（子 session 若對自身 PTY 注入 `\r` 會干擾 claude-code 自身 stdin，不適合自測）
- ✅ **A3** 互斥檢查：已實測 `--submit --no-pty-write` → `exit=1` + `Error: --submit and --no-pty-write are mutually exclusive`
- ✅ **A4** Toast 不受影響：未修改 `terminal:notify` 路徑
- ✅ **A5** 其他 flag 相容：僅新增一個 `indexOf/splice` 區塊，未動到 `--target` / `--source` / `--no-pty-write` 解析
- ✅ **Q1** 風格一致：沿用既有 `indexOf` + `splice` + boolean pattern（同 `--no-pty-write`）
- ✅ **Q2** header 更新：新增「Pre-fill AND auto-submit」Usage 區塊，註明 PLAN-020 與互斥規則
- ✅ **Q3** 錯誤訊息清楚：`--submit and --no-pty-write are mutually exclusive`（單行，標準格式）
- ✅ **Q4** 語法/型別：`node --check` 通過；專案無 lint/tsc 對 `.mjs` 的設定
- ✅ **B1** 空字串：既有 `if (!message)` 檢查已於 `--submit` 解析後生效（實測 `--submit ""` → `exit=1 Message is required`），不需特別處理
- ✅ **B2** 已含 `\r\n`：`endsWithNewline = /[\r\n]$/.test(message)`；若為真則 `payload = message`（不雙加）

### 變更摘要
單檔 `scripts/bat-notify.mjs`，+22/-2 行（含註解）：
1. Header Usage 新增 `--submit` 範例區塊（5 行）
2. argv 解析新增 `submit` 變數 + `--submit` flag 解析（7 行）
3. 互斥檢查（5 行）：`submit && !ptyWrite` → `exit 1`
4. 錯誤訊息更新：`[--no-pty-write]` → `[--no-pty-write|--submit]`
5. Step 2 payload 組裝（3 行）：`payload = submit && !endsWithNewline ? message + '\r' : message`

未影響：Toast 路徑、WS 連線、auth、現有 flag、`terminal:notify` args、其他檔案。

### Worker 筆記
- **B1 決策**：空字串由既有 `!message` 檢查擋下（`.trim()` 後 `""` 為 falsy），無需在 `--submit` 加特例；保持單一錯誤路徑。
- **B2 實作**：用 regex `/[\r\n]$/` 同時涵蓋 `\r`、`\n`、`\r\n`，避免三種組合的雙重結尾。
- **A2 實機互測策略**：由於子 session 本身跑在 BAT PTY 內，`--target` 指向自己會把 `\r` 餵回自己的 stdin（污染 claude-code 輸入流），故未在 sub-session 自測。建議使用者收到本單完成通知後，於 Tower session 用兩顆普通 bash 終端跑 `node scripts/bat-notify.mjs --target <B-id> --submit "echo ok"` 驗證（T0170 / T0171 若由 yolo 模式觸發也會順帶驗證 A2）。
- **互斥 flag 順序**：`--submit` 解析放在 `--no-pty-write` 之後，因為互斥檢查需要兩個 flag 都已解析。若使用者混用 `--no-pty-write --submit`（任一順序）都會正確報錯。
- **給 PLAN-020 後續工單的提醒**：T0170（yolo Worker 收尾）呼叫本腳本時，完成狀態 `DONE / PARTIAL / FAILED` 的訊息末尾無 `\r`，直接加 `--submit` 即可；不用自行處理末端換行。
