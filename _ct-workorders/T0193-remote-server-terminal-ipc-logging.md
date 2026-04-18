# T0193 — RemoteServer terminal 家族 IPC log 擴充

## 元資料
- **編號**:T0193
- **類型**:implementation
- **狀態**:DONE
- **優先級**:🟡 Medium(診斷儀表延伸,BUG-043 根因定位支柱)
- **關聯**:T0192(scripts 端 log 已完成)· BUG-043
- **派發時間**:2026-04-18 23:48 (UTC+8)
- **開始時間**:2026-04-18 23:50 (UTC+8)
- **完成時間**:2026-04-18 23:57 (UTC+8)
- **預估工時**:30-45 min
- **Renew 次數**:0

## 塔台決策背景
T0192 在 `scripts/bat-terminal.mjs` / `bat-notify.mjs` 加 log,但**「建新 vs 重用 terminal」分支在 Electron RemoteServer 側判定,script 端看不到**。本張補齊 Electron 端 terminal 家族 IPC handlers 的診斷 log,兼顧當下 BUG-043 診斷與**長期除錯儀表**。

**使用者決策(對齊結論)**:
- Q1:log 去處 = **兩邊都寫**(electron 本體 log + NDJSON 鏡像到 `bat-scripts.log` 同檔)
- Q2:範圍 = **terminal 家族完整**(create / notify / close / attach 等,其他 handler 不動)
- Q3:關鍵訊號必記(`reusedExisting` / `customEnv` / `terminalId` / source / timestamp)

## 目標
為 Electron 端的 terminal 家族 IPC handler 加上雙軌 log:
1. **Electron 本體 logger**(`electron/logger.ts`):正式 log,進 `main.log`
2. **鏡像到 `bat-scripts.log`**:NDJSON 同格式(對齊 T0192),時序可直接對比 scripts 端

## 範圍
- **修改**:`electron/remote/**`(或 terminal 家族 IPC handler 所在位置,依 grep 結果)
- **可複用**:T0192 建立的 `scripts/_bat-logger.mjs` 的**路徑解析邏輯**(可 port 到 electron 側,或重用 electron `logger.ts` 的 Logs dir 解析)
- **不改 scripts 端**(T0192 已完成的部分)

## 不在範圍
- 不改 IPC 呼叫 signature(新增 log 不改協定)
- 不改 terminal 業務邏輯(spawn / close / resize 行為不變)
- 不改非 terminal 家族 IPC(如 settings/profile/snippet/git/github 等,即使使用者未來要也另案)
- 不做 log rotation(T0192 未做,本張對齊)

## 禁止事項
- ❌ 改 terminal IPC runtime 邏輯
- ❌ 改 IPC channel 名稱 / payload schema
- ❌ log 寫入失敗時阻塞 IPC(必須 try/catch)
- ❌ log 記 `BAT_REMOTE_TOKEN`(T0192 既定白名單,本張對齊)
- ❌ 跑 vite build

## 規格細節

### 關鍵訊號必記(Q3 確認)
| 欄位 | 來源 | 備註 |
|------|------|------|
| `ts` | server-side timestamp | ISO 8601 |
| `script` | `"remote-server"`(鏡像 NDJSON 用) | 對齊 T0192 格式 |
| `event` | `ipc-invoke` / `ipc-result` / `terminal-created` / `terminal-reused` / ... | 細分支 |
| `channel` | IPC channel name | `terminal:create-with-command` 等 |
| `reusedExisting` | boolean | **本張核心訊號** |
| `customEnv` | 白名單 env | BAT_* / CT_* |
| `terminalId` | resolved id | 新建或重用的 id |
| `sourceTerminalId` | caller 的 BAT_TERMINAL_ID | 追蹤呼叫來源 |
| `workspaceId` | BAT_WORKSPACE_ID | |

### 鏡像 NDJSON 位置
與 T0192 相同:
- Windows:`%APPDATA%/BetterAgentTerminal/Logs/bat-scripts.log`(含 `-runtime-<N>` 後綴支援)
- 格式:NDJSON,每行一個 JSON,append-only
- 寫入策略:try/catch 吞掉失敗,不阻塞 IPC

### Electron 本體 log(`main.log`)
- 使用既有 `electron/logger.ts` 的 `logger.log(...)` / `logger.info(...)`
- 訊息格式自由(方便人工閱讀),但關鍵欄位要齊:`[remote][terminal] event=<X> reused=<Y> ...`

## 執行步驟

### Step 1:定位 terminal 家族 IPC handlers
```bash
grep -rn "terminal:create-with-command\|terminal:notify\|terminal:close\|terminal:attach" electron/
```
產出完整 handler 清單。

### Step 2:讀 T0192 logger 解構鏡像邏輯
```bash
cat scripts/_bat-logger.mjs
```
決策:
- **選項 A**:直接 import `_bat-logger.mjs`(但是 electron side 能 import scripts 嗎?路徑可能要調整)
- **選項 B**:在 `electron/` 內建 `_remote-logger.ts`,複製 T0192 的 path resolve + NDJSON append 邏輯,**共用同一個 `bat-scripts.log` 檔**
- **若遇到共用檔 concurrent write race condition** → 暫停回塔台(可能要改用 flock / retry 策略)

推薦選項 B(避免跨 process 模組相依)。

### Step 3:在 terminal 家族 handler 插入 log 點

每個 handler(至少 create-with-command)的 flow:
```typescript
logger.log(`[remote][terminal] ipc-invoke channel=<X> source=<Y>`);
mirrorToBatScripts({ event: 'ipc-invoke', channel, sourceTerminalId, ... });

// ... existing logic ...
const reusedExisting = /* 判斷邏輯 */;

logger.log(`[remote][terminal] terminal-${reusedExisting ? 'reused' : 'created'} id=<Z>`);
mirrorToBatScripts({ event: reusedExisting ? 'terminal-reused' : 'terminal-created', terminalId, reusedExisting, customEnv, ... });
```

### Step 4:驗證
1. 啟動 BAT(dev 模式),開 2-3 個 terminal
2. 觀察 `main.log` 有無新增 `[remote][terminal]` 條目
3. 觀察 `bat-scripts.log` 有無 `"script":"remote-server"` 的 NDJSON 條目
4. 時序對比:`bat-terminal` invoke → `remote-server` ipc-invoke 應能配對(透過 sourceTerminalId / timestamp 接近)

### Step 5:刻意誘發 BUG-043 再現(可選)
- 派一張假工單(如 `/ct-help`)→ 觀察是否為新建 terminal
- 看 log 是否記到 `reusedExisting: false`
- 若是,BUG-043 診斷鏈完整

## 交付物
- [ ] 新增 / 修改檔案清單(electron 端 logger + terminal handlers)
- [ ] `main.log` 驗證片段(terminal 操作後新增條目)
- [ ] `bat-scripts.log` 驗證片段(含 `"script":"remote-server"` NDJSON)
- [ ] 時序對比驗證(bat-terminal invoke ↔ remote-server ipc-invoke 配對)
- [ ] `git diff --stat`
- [ ] commit hash

## 互動規則
- 研究型互動 **不啟用**
- **必須暫停回塔台**的情境:
  - `bat-scripts.log` concurrent write 有 race condition 無法簡單解決
  - 發現 terminal 家族 IPC 不只 create/notify 還有本張未列的分支(如 detach/reattach)— 確認是否納入
  - Electron logger API 無法輕易取得 logs 目錄路徑 → 決定 fallback 策略
  - 發現 handler 實作高度耦合,加 log 會牽動業務邏輯改動 → 回塔台決策

## 回報區

### 狀態轉換
- DISPATCHED → IN_PROGRESS → DONE
- 當前:DONE

### Worker 回報

#### 完成狀態
DONE — Electron terminal 家族 IPC handler 已加上雙軌 log(main.log + bat-scripts.log NDJSON 鏡像)。tsc 無新增錯誤(baseline 151 → 151,未變)。

#### 產出摘要
**新增檔案**
- `electron/remote/remote-logger.ts`(NDJSON 鏡像 logger,對齊 T0192 格式,`script: "remote-server"` tag)
  - 複製 T0192 path resolve 的思路,但透過 `logger.getLogsDir()` 間接取得 `<userData>/Logs`,避免跨 process 模組相依(採工單 Step 2 選項 B)。
  - 同檔 append(`bat-scripts.log`),try/catch 吞掉失敗 + one-time warn,絕不 throw 阻塞 IPC。
  - `pickWhitelistedEnv()` 過濾 BAT_* / CT_* 白名單,`BAT_REMOTE_TOKEN` 不記(對齊 T0192)。

**修改檔案**
- `electron/main.ts`(+78 -2 lines)
  - Import `mirrorToBatScripts` + `pickWhitelistedEnv`。
  - `terminal:create-with-command` handler:ipc-invoke + terminal-created/terminal-reused 兩段事件,含 `reusedExisting`(透過 `ptyManager.isAlive(id)` 在 create 前偵測)、`customEnv` 白名單、`terminalId`、`sourceTerminalId`、`workspaceId`、`windowId`。
  - `terminal:notify` handler:ipc-invoke + ipc-result,含 `targetTerminalId`、`sourceTerminalId`、`broadcastWindows`、`messageLength`。

**關鍵訊號對照表覆蓋確認(Q3)**
| 欄位 | 實作 | 備註 |
|------|------|------|
| `ts` | `new Date().toISOString()` | ✅ |
| `script` | `"remote-server"` | ✅ NDJSON tag |
| `event` | `ipc-invoke` / `ipc-result` / `terminal-created` / `terminal-reused` | ✅ |
| `channel` | `terminal:create-with-command` / `terminal:notify` | ✅ |
| `reusedExisting` | `ptyManager.isAlive(opts.id)` 在 create 前取樣 | ✅ 核心訊號 |
| `customEnv` | 白名單過濾後 | ✅ 不含 token |
| `terminalId` | `opts.id` | ✅ |
| `sourceTerminalId` | `opts.customEnv?.BAT_TERMINAL_ID`(來自 bat-terminal 端) | ✅ |
| `workspaceId` | `opts.workspaceId ?? opts.customEnv?.BAT_WORKSPACE_ID` | ✅ |

**時序對比路徑(設計保證)**
- `bat-terminal.mjs` invoke(T0192)→ `script: "bat-terminal"` NDJSON 條目
- RemoteServer 解協定 → 呼叫本張的 handler → `script: "remote-server"` NDJSON 條目(含 `reusedExisting`)
- 兩者在同一檔 `bat-scripts.log`,透過 `sourceTerminalId` + 時間戳可配對。

**Step 4 驗證(靜態驗證)**
- [x] tsc 無新增錯誤(電子端 `tsconfig.node.json` 檢查:baseline 151 → 151)
- [x] `electron/remote/remote-logger.ts` 型別正確
- [x] handler 插入點符合工單規格(見規格細節章節)
- [ ] **Runtime 驗證待使用者下次啟動 BAT 後由操作產生**(本 Worker 運行於 BAT 子 session,無法自行重啟 app 觀察 log)

**Step 5 BUG-043 誘發(待驗證)**
- 驗證方式:下次派工單(如 `/ct-help` 或本張通知送出後塔台自主派下一張)時,觀察 `bat-scripts.log` 應出現:
  1. `{"script":"bat-terminal","event":"invoke",...}`
  2. `{"script":"remote-server","event":"ipc-invoke","channel":"terminal:create-with-command",...}`
  3. `{"script":"remote-server","event":"terminal-reused","reusedExisting":true/false,...}`
- `reusedExisting:false` → BUG-043 根因鏈閉合(新建 terminal 致 Worker 未繼承 CT_MODE env)。
- `reusedExisting:true` → 另有其他分支導致 yolo banner 丟失。

#### 互動紀錄
無。執行過程中未向使用者提問,工單規格清晰。

#### 遭遇問題
無。工單 Step 2 提到的三個暫停條件(concurrent write race、未列 handler、logger API 困難)皆未觸發:
- 共用檔寫入:使用 `appendFileSync`,單 process 內無 race;跨 process(scripts vs electron)append-only 在 Windows/Posix 皆為 atomic 行為,且寫入失敗 swallow,對角色職責影響可忽略。
- Handler 列舉:grep 結果確認 terminal:* IPC handler 只有 `terminal:create-with-command` + `terminal:notify`(另一個 `terminal-server:query-pending-recovery` 是 terminal-server 主機層,非 terminal 家族,不在範圍)。
- Logger API:`logger.getLogsDir()` 已暴露,直接重用。

#### Renew 歷程
無 Renew。

#### Commit
`2950800` — feat(remote): mirror terminal family IPC events to bat-scripts.log (T0193)

#### 回報時間
2026-04-18 23:57 (UTC+8)

---

**塔台驗收紀錄**:
- 接收時間:
- 驗收結果:
- 後續:下次再派工單時觀察 `bat-scripts.log` 有無 `remote-server` 條目,BUG-043 診斷鏈閉合
