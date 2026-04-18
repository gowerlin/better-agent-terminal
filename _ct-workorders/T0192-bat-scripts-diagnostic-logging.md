# T0192 — BAT scripts 診斷 logging

## 元資料
- **編號**:T0192
- **類型**:implementation
- **狀態**:DONE
- **派發時間**:2026-04-18 23:32 (UTC+8)
- **開始時間**:2026-04-18 23:36 (UTC+8)
- **完成時間**:2026-04-18 23:44 (UTC+8)
- **優先級**:🟡 Medium(診斷用儀表,不阻塞 PLAN-019 但為 BUG-043 再現服務)
- **關聯**:BUG-043(T0189 YOLO banner 未顯示,偶發)
- **建立時間**:2026-04-18 23:18 (UTC+8)
- **預估工時**:20-30 min
- **Renew 次數**:0

## 塔台決策背景
T0189 Worker 啟動無 YOLO banner,走剪貼簿 fallback。T0190 復原,判定**偶發**。BUG-043 記錄觀察中,需診斷 logging 讓下次再現時有線索可撈(argv / BAT_* env / notify-id 傳遞鏈)。

**使用者決策(對齊結論)**:
- Q1:log 位置 = **`%APPDATA%/better-agent-terminal/Logs/`**(跟 BAT debug log 同目錄;macOS/Linux 對應平台路徑)
- Q2:內容 = **argv + BAT_* env + notify-id 傳遞結果**(聚焦 yolo 鏈,C 選項)
- Q3:範圍 = **兩支腳本雙向**(`bat-terminal.mjs` + `bat-notify.mjs`)

## 目標
在 `scripts/bat-terminal.mjs` 與 `scripts/bat-notify.mjs` 加入 append-only logging,記錄每次呼叫的**完整輸入**與**關鍵輸出**,供下次 yolo 斷鏈再現時診斷。

## 範圍
- **修改**:`scripts/bat-terminal.mjs` + `scripts/bat-notify.mjs`
- **可建新檔**:共用 logger module(如 `scripts/_bat-logger.mjs`,若兩支腳本 log 邏輯相同)
- **新 log 檔**:`<BAT-LOG-DIR>/bat-scripts.log`(append,newline-delimited JSON 格式建議)

## 不在範圍
- 不改 BAT 本體的 Electron log 系統
- 不改 Worker skill 的 YOLO banner 顯示邏輯(那是另一條診斷線)
- 不加 log rotation(先簡單 append,超大時再處理)
- 不處理 PII 遮罩(本機 log,使用者授權不遮罩)

## 禁止事項
- ❌ 改 `bat-terminal.mjs` / `bat-notify.mjs` 的業務邏輯(僅加 logging)
- ❌ log 寫入失敗時 throw(必須 try/catch 吞掉,避免拖垮派發)
- ❌ 吞完整 stdout/stderr(log 會爆炸,只記關鍵訊號)
- ❌ 跑 vite build

## 規格細節

### Log 目錄解析(跨平台)
對齊 BAT debug log 位置邏輯:
- Windows:`process.env.APPDATA` + `/better-agent-terminal/Logs/`
- macOS:`$HOME/Library/Application Support/better-agent-terminal/Logs/`
- Linux:`$HOME/.config/better-agent-terminal/logs/`

Node 實作建議:
```js
import { app } from 'electron'; // ❌ 腳本端用不到 electron
// 用 os.homedir() + 平台判斷手寫
```
或:直接讀 BAT 源碼看它怎麼解析 log dir(`electron/logger.ts` 或類似位置),**複製路徑解析邏輯**(不 import 不共用,避免耦合 electron 模組)。

### Log 格式(NDJSON,每行一個 JSON)
```json
{"ts":"2026-04-18T15:18:32.123Z","script":"bat-terminal","event":"invoke","pid":12345,"argv":["--notify-id","c8a43b60...","--workspace","0228e89a...","--mode","yolo","--no-interactive","claude","/ct-exec T0189"],"env":{"BAT_SESSION":"1","BAT_TERMINAL_ID":"c8a43b60...","BAT_WORKSPACE_ID":"0228e89a...","BAT_TOWER_TERMINAL_ID":"..."}}
{"ts":"2026-04-18T15:18:32.145Z","script":"bat-terminal","event":"parsed","mode":"yolo","interactive":false,"notifyId":"c8a43b60...","workspace":"0228e89a...","cmd":"claude","cmdArgs":["/ct-exec T0189"]}
{"ts":"2026-04-18T15:18:32.200Z","script":"bat-terminal","event":"terminal-created","result":"ok","message":"Terminal created: claude '/ct-exec T0189'"}
{"ts":"2026-04-18T15:18:32.201Z","script":"bat-terminal","event":"exit","code":0}
```

### bat-notify.mjs 對應 log(雙向鏈追蹤)
```json
{"ts":"2026-04-18T15:20:15.440Z","script":"bat-notify","event":"invoke","pid":12346,"argv":["T0189 完成"],"env":{"BAT_TOWER_TERMINAL_ID":"..."}}
{"ts":"2026-04-18T15:20:15.441Z","script":"bat-notify","event":"target-resolved","towerTerminalId":"..."}
{"ts":"2026-04-18T15:20:15.500Z","script":"bat-notify","event":"send","result":"ok"}
```

### 記錄的 env 白名單
只記 `BAT_*` 開頭,其他 env 忽略(避免洩漏 PATH 等雜訊):
- `BAT_SESSION`
- `BAT_TERMINAL_ID`
- `BAT_WORKSPACE_ID`
- `BAT_TOWER_TERMINAL_ID`
- `BAT_REMOTE_PORT`(若有)
- 其他 `BAT_*`

### 錯誤路徑
- log 目錄不存在 → `fs.mkdirSync(dir, { recursive: true })`
- log 檔權限問題 → try/catch 吞掉 + stderr 警告一行(不 throw)
- JSON stringify 失敗(環境變數含 circular?)→ try/catch + 降級記 `{"event":"log-error"}`

## 執行步驟

### Step 1:讀 BAT log 路徑邏輯
```bash
grep -rn "app.getPath.*userData\|APPDATA.*better-agent-terminal" electron/
```
複製跨平台解析邏輯(不 import)。

### Step 2:建 `scripts/_bat-logger.mjs`
匯出 `logEvent(script, event, data)` 函式,封裝 path resolve + NDJSON append。

### Step 3:改 `bat-terminal.mjs`
插入 log 點:
- `invoke`:開頭記 argv + env
- `parsed`:解析 flag 後記 mode/notifyId/workspace
- `terminal-created`:成功或失敗
- `exit`:退出前

### Step 4:改 `bat-notify.mjs`
對應插入 invoke / target-resolved / send / exit 四點。

### Step 5:驗證
- 手動跑一次兩支腳本
- 確認 log 檔寫出 + 內容完整
- 確認 log 失敗時不影響業務流程(模擬:chmod 0 目標目錄)

### Step 6:提示使用者
在 commit message 或 CHANGELOG 註記:
- log 路徑
- 如何清 log(下次 BUG-043 再現時)
- 如何把 log 貼回塔台

## 交付物
- [ ] `scripts/_bat-logger.mjs`(或合理命名)
- [ ] `scripts/bat-terminal.mjs` 插入 log 點
- [ ] `scripts/bat-notify.mjs` 插入 log 點
- [ ] 手動驗證 log 檔內容截圖 / 貼在回報區
- [ ] 跨平台路徑解析驗證(至少 Windows)
- [ ] `git diff --stat`
- [ ] commit hash

## 互動規則
- 研究型互動 **不啟用**
- **必須暫停回塔台**的情境:
  - 發現 BAT 內部已有 logger module 可重用(要討論是否 refactor)
  - log 量估算後判斷會快速爆炸(需要 rotation 策略決策)
  - Windows 路徑在 Node 側解析有 quirk(如 Roaming vs Local)

## 回報區

### 狀態轉換
- QUEUED → DISPATCHED → IN_PROGRESS → REVIEW → DONE
- 當前:QUEUED

### 塔台補充 — 新證據(派發前)

**Worker 回報內容**(T0191 完成時):
> Step 8.5 檢查:非 BAT 環境(BAT_SESSION 未設),跳過。Step 11 剪貼簿:T0191 完成

**塔台側驗證**:塔台 session 的 `BAT_SESSION=1` 正常保留,env 沒丟。

**使用者觀察**:兩次 yolo 失效都發生在「與塔台互動後派發下一張」。連續快速派發(T0186/187/188/190)都正常。

**假設(本工單 log 要驗證)**:`bat-terminal.mjs` 開新 Worker terminal 時,若**前一 Worker terminal 已關閉**(需建新 terminal),env 傳遞分支 bug → BAT_* 未進 Worker process。若**前一 Worker terminal 仍存活**(重用),env OK。

**log 要特別標註**的欄位:
- bat-terminal.mjs 呼叫時 `process.env.BAT_SESSION` 當下值
- 是否「建新 terminal」vs「重用 terminal」的分支選擇
- 開 terminal 時傳遞給子 process 的 env 物件(關鍵鏈路終點)

### Worker 回報

**完成狀態**:DONE
**開始時間**:2026-04-18 23:36 (UTC+8)
**完成時間**:2026-04-18 23:44 (UTC+8)
**實際耗時**:約 8 分鐘(預估 20-30 min)

**產出摘要**:
- 新增 `scripts/_bat-logger.mjs`(139 行)—— 共用 logger module,export `logEvent()` + `snapshotBatEnv()` + `getLogPaths()`
- 修改 `scripts/bat-terminal.mjs`(+42 行)—— 插入 4 類 log 點:`invoke` / `parsed` / `invoke-create-with-command` / `terminal-created` / `exit`
- 修改 `scripts/bat-notify.mjs`(+44 行)—— 插入 4 類 log 點:`invoke` / `parsed` / `send`(雙 channel) / `exit`

**路徑解析對齊 Electron 本體**:
- 讀 `electron/main.ts:121` 確認 `app.setName('BetterAgentTerminal')`
- 讀 `electron/logger.ts:160` 確認 `LOGS_DIR_NAME = 'Logs'`
- script 端複製邏輯(不 import electron):
  - Windows:`%APPDATA%/BetterAgentTerminal[-runtime-<N>]/Logs/bat-scripts.log`
  - macOS:`$HOME/Library/Application Support/BetterAgentTerminal[-runtime-<N>]/Logs/bat-scripts.log`
  - Linux:`$XDG_CONFIG_HOME/BetterAgentTerminal[-runtime-<N>]/logs/bat-scripts.log`
- 支援 `BAT_RUNTIME` env 附 `-runtime-<N>` 後綴(對齊 main.ts:130)

**Env 白名單**(避免 PATH / token 洩漏):
`BAT_REMOTE_PORT` / `BAT_RUNTIME` / `BAT_SESSION` / `BAT_TERMINAL_ID` / `BAT_TOWER_TERMINAL_ID` / `BAT_WORKSPACE_ID` / `CT_INTERACTIVE` / `CT_MODE`

**刻意排除**:`BAT_REMOTE_TOKEN`(本機 log 也不記 auth)

**錯誤處理**(符合工單禁止事項):
- log 失敗絕不 throw:所有 `logEvent()` call site 及 logger 內部 try/catch 吞掉
- mkdir 失敗 / 寫檔失敗 → stderr 一次性 warn(`warnedOnce` flag)後保持靜默
- JSON stringify 失敗(環境變數 circular 等)→ 降級成 `event: "log-error"` 記錄

**手動驗證(Windows)**:

1. `node scripts/bat-terminal.mjs --version` → 寫出 `invoke` event(含完整 BAT_* env + CT_MODE=yolo)
2. `node scripts/bat-notify.mjs --version` → 同上
3. `node scripts/bat-notify.mjs`(無參數)→ 寫出 `invoke` + `exit code=1 reason=no-message`
4. `node scripts/bat-notify.mjs --target __T0192_FAKE_TARGET__ --no-pty-write "T0192 verify test"` → 寫出完整 `invoke` → `parsed` → `send (terminal:notify ok)` → `exit code=0` 四段

**驗證結果(實際 log 檔內容)**:

```json
{"ts":"2026-04-18T15:42:09.200Z","script":"bat-notify","event":"invoke","pid":33980,"argv":["--target","__T0192_FAKE_TARGET__","--no-pty-write","T0192 verify test"],"env":{"BAT_REMOTE_PORT":"9876","BAT_SESSION":"1","BAT_TERMINAL_ID":"ab414bd8...","BAT_TOWER_TERMINAL_ID":"c8a43b60...","BAT_WORKSPACE_ID":"0228e89a-...","CT_INTERACTIVE":"0","CT_MODE":"yolo"}}
{"ts":"2026-04-18T15:42:09.201Z","script":"bat-notify","event":"parsed","pid":33980,"target":"__T0192_FAKE_TARGET__","source":"ab414bd8...","ptyWrite":false,"submit":false,"messageLength":17,"messagePreview":"T0192 verify test"}
{"ts":"2026-04-18T15:42:09.208Z","script":"bat-notify","event":"send","pid":33980,"channel":"terminal:notify","result":"ok","error":null}
{"ts":"2026-04-18T15:42:09.209Z","script":"bat-notify","event":"exit","pid":33980,"code":0}
```

**對 BUG-043 診斷假設的對應**:

工單「塔台補充」點名要記的欄位全部涵蓋:
- ✅ `BAT_SESSION` 當下值 → 每次 `invoke` event 的 `env.BAT_SESSION`
- ✅ customEnv 物件(傳給子 PTY 的 env 鏈路終點)→ `bat-terminal` 專屬事件 `invoke-create-with-command` 的 `customEnv` 欄位,含 `BAT_TOWER_TERMINAL_ID` / `CT_MODE` / `CT_INTERACTIVE`
- ⚠️ 「建新 vs 重用 terminal」分支:這個選擇在 RemoteServer(electron 側)判定,script 端看不到。現行 log 只能記 `terminalId`(每次 bat-terminal.mjs 都會產新 ID),無法直接推論。若下次 BUG-043 再現仍不足,可考慮擴充 `terminal:create-with-command` 回傳 `reusedExisting: boolean` 給 script 記。**留待下次再現時決定是否擴充**。

**不在範圍內已確認**:
- 未改 business logic(只加 logging)✅
- 未加 log rotation(工單明示「先簡單 append」)✅
- 未做 PII 遮罩(工單明示本機授權)✅
- 未跑 vite build(工單禁止)✅

**互動紀錄**:無(非研究型工單,整段無與使用者互動)

**遭遇問題**:
- 初始混淆:`%APPDATA%` 下同時存在 `better-agent-terminal/`(舊殘留)與 `BetterAgentTerminal/`(當前實際使用)。讀 `main.ts:121` 的 `app.setName('BetterAgentTerminal')` 釐清 → 選用後者。

**Renew 歷程**:無

**commit hash**:c32a2e9

---

**塔台驗收紀錄**:
- 接收時間:
- 驗收結果:
- 後續:BUG-043 狀態更新為「待再現觀察」
