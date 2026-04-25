# T0261-spike-exp-headless-001-server-poc

## 元資料
- **工單編號**：T0261
- **任務名稱**：EXP-HEADLESS-001 T-A — BAT remote server headless 啟動 PoC（純 Node + secrets strategy + echo client）
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-25 21:50 (UTC+8)
- **開始時間**：2026-04-25 21:49 (UTC+8)
- **類型**：spike（PoC 證可行性，不交付 production code）
- **互動模式**：enabled（spike 過程必然踩雷，遇設計分支可問塔台）
- **Renew 次數**：0
- **預估 wall time**：60-90 min（硬性止損 3 小時）
- **預估 context cost**：中-高（讀 `electron/remote/` 全模組 + 寫兩支 PoC 腳本 + 重構 secrets.ts）
- **關聯**：
  - 母 EXP：EXP-HEADLESS-001（🧪 EXPLORING，本工單為其唯一 T-A）
  - 前序：T0260 scoping（✅ DONE，commit `9e9d1dd`）— 結論「BAT remote 拆分七成完成，唯二瓶頸是 `secrets.ts` + `claude-runtime-router`」
  - 母 PLAN：PLAN-007（💡 IDEA，等本 spike + Phase A research 全部結論才升 PLANNED）
- **affects_files**：
  - **worktree** `../bat-headless-spike`（新建）：
    - 新增 `scripts/spike-headless-server.mjs`
    - 新增 `scripts/spike-headless-client.mjs`
    - 修改 `electron/remote/secrets.ts`（重構為 strategy pattern）
    - 視需要新增其他輕量輔助檔（如 echo handler 註冊點）
  - **主線**（嚴格禁止寫入）：除本工單檔回報區 + EXP-HEADLESS-001 工單檔結論記錄區外，**禁止任何修改**

---

## 任務目標

證明 BAT remote server 能在純 Node.js 環境（無 Electron runtime）跑起 wss + auth + echo。**這是 PLAN-007 整條路線的可行性錨點**——若 spike 失敗，T0261 之後的 4 張 research 全部需要重新設計。

具體要達成的 6 個 AC（見「AC」章節）對應 EXP-HEADLESS-001 母單的成功標準 AC1-AC6。

---

## 執行步驟

### Step 1：worktree 建立

```bash
git worktree add ../bat-headless-spike -b exp/headless-server-spike
cd ../bat-headless-spike
git status   # 確認 clean
git log --oneline -3   # 確認分支點
```

**注意路徑**：worktree 在主 repo **同層的兄弟目錄**，不是 sub-folder。所有後續操作都在 `../bat-headless-spike` 內進行。

### Step 2：worktree 依賴安裝

```bash
npm install
# 若 npm ci 跑不通可降級 npm install
# 預期 native module rebuild：better-sqlite3、@lydell/node-pty 等
```

確認 `node_modules/ws`、`node_modules/selfsigned`、`node_modules/electron`（即使是 spike 我們仍需 type definitions 與 strategy fallback 的 ElectronSafeStorageStrategy 寫法）都有。

### Step 3：盤點 `app.*` / `safeStorage` 依賴擴散範圍

**先 grep 不要動 code**：

```bash
grep -rn "import.*safeStorage" electron/ --include="*.ts"
grep -rn "from 'electron'" electron/remote/ --include="*.ts"
grep -rn "app\.getPath\|app\.isPackaged" electron/remote/ --include="*.ts"
grep -rn "webContents\|ipcMain\|BrowserWindow" electron/remote/ --include="*.ts"
```

把結果記錄到本工單回報區「依賴掃描」段。如果 `electron/remote/` 內**有任何非 secrets.ts 的檔案** import `electron` package，回塔台問怎麼處理（互動模式啟用）。

### Step 4：拆 `secrets.ts` 為 strategy pattern

讀現行 `electron/remote/secrets.ts` 99 行，理解現有 API surface。重構成：

```typescript
// secrets-strategy.ts (新增)
export interface SecretStrategy {
  encrypt(plain: string): string;
  decrypt(encrypted: string): string;
  isAvailable(): boolean;
  describeBackend(): string;  // for log
}

// secrets-strategy-electron.ts (新增)
export class ElectronSafeStorageStrategy implements SecretStrategy {
  // 沿用現有 safeStorage 邏輯
}

// secrets-strategy-plaintext.ts (新增)
export class PlaintextStrategy implements SecretStrategy {
  // base64 + warn log,僅 spike / Linux fallback 用
}

// secrets.ts (重構為工廠 + facade)
export function createSecrets(strategy?: SecretStrategy): Secrets {
  const s = strategy ?? autoDetectStrategy();
  return new Secrets(s);
}

function autoDetectStrategy(): SecretStrategy {
  // 偵測 process.versions.electron + safeStorage.isEncryptionAvailable()
  // 失敗 fallback 到 PlaintextStrategy
}
```

**重要**：保持 `secrets.ts` 對外的 API 完全不變（其他模組呼叫處不動）。只是把實作分層、加上 strategy injection 點，spike 才能注入 plaintext。

**禁止**：動 `secrets.ts` 以外的 `electron/remote/` 檔案（除非 Step 3 grep 出非預期依賴需處理）。

### Step 5：寫 server 入口腳本 `scripts/spike-headless-server.mjs`

**純 Node ESM** 入口，**禁止** import `electron` package（除型別 only）。

骨架（你可以調整，但核心元素要在）：

```javascript
// scripts/spike-headless-server.mjs
import { RemoteServer } from '../electron/remote/remote-server.ts';  // 視 ts compile 狀況或改 .mjs
import { createSecrets } from '../electron/remote/secrets.ts';
import { PlaintextStrategy } from '../electron/remote/secrets-strategy-plaintext.ts';
import { loadOrCreateServerCertificate } from '../electron/remote/certificate.ts';
import path from 'node:path';
import os from 'node:os';

const SPIKE_DATA_DIR = path.join(os.tmpdir(), 'bat-headless-spike-data');
// 創 dir if not exists

const secrets = createSecrets(new PlaintextStrategy());
const cert = await loadOrCreateServerCertificate(SPIKE_DATA_DIR);

// hardcode token,印出 fingerprint 給 client 用
const TOKEN = 'spike-token-12345';
console.log('SPIKE_FINGERPRINT=' + cert.fingerprint);
console.log('SPIKE_TOKEN=' + TOKEN);

// 註冊 echo handler(若 PROXIED_CHANNELS 不夠就臨時加)
// ...

const server = new RemoteServer({...});  // 視實際 RemoteServer constructor 簽名
await server.start(9876, TOKEN);
console.log('Spike server listening on wss://127.0.0.1:9876');

// 阻塞 process,等 client 連線
process.stdin.resume();
```

**處理 ts → js 的策略**（依 worktree 環境）：
- 選項 A：worktree 已有 `tsx` 或 `ts-node`，可直接 `npx tsx scripts/spike-headless-server.mjs`（推薦）
- 選項 B：用 `npm run compile`（若有）先 build 出 dist，再 import dist 路徑
- 選項 C：把 .ts 改寫成 .mjs（只針對 spike 入口，**不改主線 .ts 檔**）

選哪個都可以，記錄理由到回報。

### Step 6：寫 client 腳本 `scripts/spike-headless-client.mjs`

```javascript
// scripts/spike-headless-client.mjs
import WebSocket from 'ws';

const SERVER_FINGERPRINT = process.env.SPIKE_FINGERPRINT;
const SERVER_TOKEN = process.env.SPIKE_TOKEN || 'spike-token-12345';

const ws = new WebSocket('wss://127.0.0.1:9876', { rejectUnauthorized: false });

ws.on('upgrade', (res) => {
  // verify fingerprint via res.socket.getPeerCertificate
  const cert = res.socket.getPeerCertificate();
  if (cert.fingerprint256 !== SERVER_FINGERPRINT) {
    console.error('FINGERPRINT MISMATCH'); process.exit(1);
  }
});

ws.on('open', () => {
  // send auth frame
  ws.send(JSON.stringify({ type: 'auth', token: SERVER_TOKEN }));
});

let pingReceived = false;
let echoSent = false;

ws.on('message', (data) => {
  const frame = JSON.parse(data);
  console.log('CLIENT RECV:', frame.type);

  if (frame.type === 'ping' && !pingReceived) {
    pingReceived = true;
    console.log('AC4-ping ✅');
  }

  if (frame.type === 'invoke-result') {
    console.log('AC4-echo ✅', frame.payload);
    process.exit(0);
  }

  if (frame.type === 'auth-ok' && !echoSent) {
    echoSent = true;
    ws.send(JSON.stringify({
      type: 'invoke',
      id: 'echo-1',
      channel: 'spike:echo',
      payload: 'hello',
    }));
  }
});

ws.on('error', (err) => { console.error('CLIENT ERR:', err); process.exit(1); });
```

**注意**：實際 frame schema 以 `electron/remote/protocol.ts` 為準（auth handshake 細節、ping payload 格式、invoke id 規則）。讀 protocol.ts 後對齊。

### Step 7：跑通 PoC

兩個 terminal：

```bash
# terminal 1
cd ../bat-headless-spike
npx tsx scripts/spike-headless-server.mjs
# 印出 SPIKE_FINGERPRINT=...

# terminal 2(複製 fingerprint)
cd ../bat-headless-spike
SPIKE_FINGERPRINT=<貼上> npx tsx scripts/spike-headless-client.mjs
# 預期看到 AC4-ping ✅ AC4-echo ✅ → exit 0
```

若任何一步卡住，**先 grep 程式碼找根因，不要在 spike 階段試圖修復生產層次的問題**。卡 30 min 仍解不開 → 回塔台問。

### Step 8：驗 AC5（process tree 不含 Electron）

server 跑著的時候另開 terminal：

```bash
# Windows
tasklist | grep -i node    # 應該有 spike-headless-server 對應的 node.exe
tasklist | grep -i electron  # 應該為空(若 BAT 主程式沒在跑)

# 或更精準
wmic process where "commandline like '%spike-headless%'" get processid,name,commandline
```

**注意**：若使用者本機正在跑 BAT 主程式，`electron.exe` 會在 process list 裡 — 要確認的是 **spike server 的 process tree** 不含 electron，而非整個系統。可用 `--inspect` 或 `process.versions.electron === undefined` 在 spike 程式內 self-assert。

### Step 9：填寫回報

詳見「回報」段。**禁止寫入除本工單回報區 + EXP-HEADLESS-001 結論記錄區**外的任何主線檔案。

worktree 內的檔案不受此限制（spike code 本來就在 worktree）。

### Step 10：worktree 處理（待塔台決策後執行）

**Worker 不主動清 worktree**。回報塔台後由塔台決策：
- CONCLUDED → 結論寫入 EXP-HEADLESS-001 「結論記錄」CONCLUDED 路徑 → 清 worktree
- ABANDONED → 同上 ABANDONED 路徑 → 清 worktree
- PARTIAL → 塔台決定下一步

---

## AC（acceptance criteria）

對應 EXP-HEADLESS-001 母單成功標準：

- **AC1**：worktree 內以 `node` (非 electron) 跑起 entry 腳本，成功 listen on `127.0.0.1:9876` 並回 wss upgrade
- **AC2**：自簽憑證 generate / load 流程不依賴 Electron API（`certificate.ts` 在純 Node 跑通）
- **AC3**：`secrets.ts` 抽出 strategy interface 並落實 ≥ 2 個 strategy（Electron / Plaintext），spike 走 plaintext
- **AC4**：client 腳本完成 TLS handshake（fingerprint TOFU）+ token auth + 收到 ≥ 1 個 ping + 送出 1 條 echo invoke + 收到 invoke-result
- **AC5**：spike server process tree 不含 Electron（純 node.exe / node）
- **AC6**：本工單回報區寫滿結論摘要

**可選 AC**（達成更好，未達不影響 CONCLUDED）：
- AC7：echo handler 註冊機制可重用（不是 hardcode 一次性 if-branch）
- AC8：reconnect 一次驗證（client disconnect → reconnect → 再做一次 echo）

---

## 嚴格禁止

- ❌ 在主線分支（`main`）做任何修改 / commit
- ❌ 修改主線 `_ct-workorders/` 內除本工單檔回報區 + `EXP-HEADLESS-001-*.md` 結論記錄區外的任何檔案
- ❌ 修改主線 `_tower-state.md` / `_decision-log.md` / `_learnings.md`
- ❌ 修改 `package.json` 主版本依賴（worktree 內也不要動，只裝既有依賴）
- ❌ 跨工單決策（PoC 失敗了下一步、`app.*` 依賴擴散到非 remote/ 怎麼辦 → 回塔台）
- ❌ 為了讓 spike 跑通而**綠化測試**（如硬編 fingerprint 跳過驗證、跳過 brute-force ban、停用 token check）— 這是假驗收
- ❌ 把 spike code 從 worktree commit 到主線

---

## 互動模式提示

**enabled**。預期可能的提問場景：

1. 「`electron/remote/` 內 X.ts 也 import 了 `electron`，要抽介面嗎？」 — 看擴散程度，可能升 ABANDONED 或請塔台縮 scope
2. 「`broadcast-hub` 對 `webContents.send` 強依賴，spike 階段省略 host→client 推播 OK 嗎？」 — 可，spike 不證 broadcast
3. 「`tsx` / `ts-node` 不在 worktree 依賴內，要改用 `npm run compile` 還是改寫 .mjs？」 — 看哪個踩雷少
4. 「reconnect 行為碰到 brute-force ban 觸發，要調整 ban threshold 嗎？」 — 不要，sleep 過冷卻時間或重啟 server，不動產品邏輯
5. 「PROXIED_CHANNELS 找不到無 host-bound 依賴的 channel 來測 echo，可以臨時加一個 `spike:echo` handler 嗎？」 — 可，但只在 worktree 內加，不要污染主線設計

每次提問上限 3 題（依 `research_max_questions: 3` 預設）。能自己拍板的逕行決定 + 寫回報。

---

## 失敗 / PARTIAL 處理

任一觸發 EXP-HEADLESS-001 失敗標準（時間止損 / 架構止損 / 連鎖依賴 / Worker 申請）：
1. 立即停止 PoC 工作
2. 把已查清的事實寫滿回報（依賴擴散範圍、踩到的雷、`app.*` 依賴清單）
3. 工單狀態填 **FAILED** 或 **PARTIAL**
4. 觸發 yolo 斷點 B（`yolo_max_retries: 1`），塔台會 pause

---

## 回報

### 完成狀態

**CONCLUDED ✅** — AC1-AC6 全綠 + 可選 AC7/AC8 也達成。一次跑通，未觸發任何止損條件。

### 開始 / 完成時間

- 開始：2026-04-25 21:49
- 完成：2026-04-25 22:18
- wall time：≈29 min（顯著低於估時 60-90 min；節省主因：Step 3 grep 結果顯示 server-side 只有 `secrets.ts` 一處 electron import，secrets 重構與腳本撰寫是並行能規劃完的小範圍）

### 互動紀錄

無使用者互動。所有設計分支均自行拍板：
- 改用 port 9877（規避 BAT_REMOTE_PORT=9876 的 live server 衝突）—— 工單未明示，但屬執行細節，未動產品邏輯
- ts→js 處理選 **Option A**（worktree 已有 tsx 4.21.0，零成本）
- 加 `setSecretStrategy` 為 spike 注入點（不破壞向下相容；保留 `autoDetectStrategy` 為 lazy default）
- echo 改用 `registerHandler('spike:echo', ...)` — `remote-server.ts` 的 `invoke` 路徑不檢查 `PROXIED_CHANNELS`，註冊即可（無需動 protocol.ts）
- 「ping」改由 client 主動送 `{type:'ping'}` → server 回 `{type:'pong'}`（read protocol.ts 後對齊；server 內部用 `ws.ping()` 做 protocol-level heartbeat，不發應用層 frame，原工單骨架描述需修正）

### Step 1-2 — worktree 建立 + 依賴安裝結果

- `git worktree add ../bat-headless-spike -b exp/headless-server-spike` 一次成功；HEAD = `2a9a906`
- `npm install` 順利完成（28s），785 packages
- `npm rebuild better-sqlite3` postinstall 執行成功（"rebuilt dependencies successfully / postinstall done"）
- `tsx 4.21.0` / `node 25.9.0`、`ws`、`selfsigned`、`electron` 全部 OK

### Step 3 — 依賴掃散

#### `safeStorage` import 點

```
electron/remote/secrets.ts:1:import { safeStorage } from 'electron'
electron/remote/secrets.ts:22,32,39,53,57:safeStorage usage
electron/remote/remote-server.ts:375  // 僅是註解（"Persist token after server is listening (encrypted via safeStorage)"）
```

僅 `secrets.ts` 有實際 import 與用法。✅ 已預期。

#### `electron/remote/` 內 electron import 點

```
electron/remote/secrets.ts:1:        import { safeStorage } from 'electron'    ← 已知，已重構
electron/remote/remote-client.ts:4:  import { BrowserWindow } from 'electron'  ← client-side（host 端拉 client 的 broadcast 出口），不在 server headless 範圍
```

**非預期依賴：0**。`remote-client.ts` 的 `BrowserWindow` 是 host 端用來把遠端事件轉發給 BrowserWindow 的，與 server 入口無關 — PLAN-007 後續處理 host headless 時才需要面對。

#### `app.getPath` / `app.isPackaged` 在 remote/ 的擴散

```
electron/remote/remote-server.ts:135:  configDir: string = '' // Set by main.ts to app.getPath('userData')
```

只是欄位註解。`RemoteServer` 本身不呼叫 `app.*`，`configDir` 由外部注入（spike 注入 `os.tmpdir()` 子路徑）。✅ 0 個實際依賴。

#### `webContents` / `ipcMain` / `BrowserWindow` 在 remote/ 的使用

```
electron/remote/remote-client.ts:4,53,65,215   ← 全部在 client-side，server 不依賴
```

`broadcast-hub.ts` 是純 EventEmitter，無 IPC 依賴。`RemoteServer` 訂閱 `broadcastHub` 但只把事件序列化到 ws frame，不碰 webContents。✅ server-side 0 依賴。

### Step 4 — secrets.ts strategy 重構

實際拆成 **4 個檔案**（比工單骨架略多一個 strategy interface 檔，方便未來新增 strategy 時免動 facade）：

#### 介面草圖（`electron/remote/secrets-strategy.ts`）

```typescript
export interface PersistedSecretV1 {
  v: 1
  encrypted: boolean
  data: string
}

export interface SecretStrategy {
  encrypt(plain: string): PersistedSecretV1
  decrypt(record: PersistedSecretV1): string
  isAvailable(): boolean
  describeBackend(): string
}
```

#### 實作 1：`ElectronSafeStorageStrategy`（`secrets-strategy-electron.ts`）

- 用 `process.versions.electron` 守門 + `require('electron')` lazy load，避免在純 Node 觸發 import 失敗
- 接受 constructor 注入 mock safeStorage 方便測試
- `decrypt` 容忍 `encrypted: false` 的 record（讀其他機器寫的 plaintext fallback），保留升級前的混合可讀性
- `isAvailable()` 走 try/catch 避免 keychain 故障時 throw

#### 實作 2：`PlaintextStrategy`（`secrets-strategy-plaintext.ts`）

- `isAvailable()` 永遠回 true（fallback always works）
- `encrypted: false` 寫入；遇到 `encrypted: true` 的 record decrypt 時 throw（不允許「假裝能讀」）
- 內建 `warnOnUse` 開關（spike 設 false，production fallback 設 true，由 `secrets.ts` 自動偵測時建構）

#### 工廠 / auto-detect 邏輯（`secrets.ts`）

```typescript
let activeStrategy: SecretStrategy | null = null

function autoDetectStrategy(): SecretStrategy {
  const electron = new ElectronSafeStorageStrategy()
  if (electron.isAvailable()) return electron
  logger.warn('[Secrets] Electron safeStorage unavailable ... Falling back to PlaintextStrategy.')
  return new PlaintextStrategy()
}

export function setSecretStrategy(strategy: SecretStrategy | null): void {
  activeStrategy = strategy
}
export function getSecretStrategy(): SecretStrategy {
  if (!activeStrategy) activeStrategy = autoDetectStrategy()
  return activeStrategy
}
```

模組級 `encryptString` / `decryptPersisted` / `readSecretFile` / `writeSecretFile` / `isSafeStorageAvailable` 全部改 delegate 到 `getSecretStrategy()`。

#### secrets.ts 對外 API 是否保持向下相容

**是**。所有公開函數簽名與行為對 production 呼叫端完全等價：
- 在 Electron 環境 → auto-detect 選到 `ElectronSafeStorageStrategy`，路徑與重構前一致
- 在 Linux 無 keychain → auto-detect fallback 到 `PlaintextStrategy`，行為與重構前的 `warnFallbackOnce` + plaintext write 一致
- legacy `{ token: string }` shape 仍能讀（`readSecretFile` 內保留分支）
- 新增 `setSecretStrategy` / `getSecretStrategy` 是純 additive — production 不會呼叫

### Step 5-6 — entry / client 腳本骨架

#### server 腳本（`scripts/spike-headless-server.mjs` 關鍵段）

```javascript
// AC5 self-assert
if (process.versions.electron) { /* exit 2 */ }

const SPIKE_PORT = 9877  // 9876 已被 live BAT 佔用
const SPIKE_DATA_DIR = path.join(os.tmpdir(), 'bat-headless-spike-data')
fs.mkdirSync(SPIKE_DATA_DIR, { recursive: true })

const [{ RemoteServer }, { registerHandler }, { setSecretStrategy }, { PlaintextStrategy }] =
  await Promise.all([
    import('../electron/remote/remote-server.ts'),
    import('../electron/remote/handler-registry.ts'),
    import('../electron/remote/secrets.ts'),
    import('../electron/remote/secrets-strategy-plaintext.ts'),
  ])

setSecretStrategy(new PlaintextStrategy({ warnOnUse: false }))
registerHandler('spike:echo', (_ctx, ...args) => ({ echoed: args, at: Date.now() }))

const server = new RemoteServer()
server.configDir = SPIKE_DATA_DIR
const result = await server.start(SPIKE_PORT, 'spike-token-12345', 'localhost')
console.log('SPIKE_FINGERPRINT=' + result.fingerprint)
// + SIGINT/SIGTERM handlers + process.stdin.resume()
```

#### client 腳本（`scripts/spike-headless-client.mjs` 關鍵段）

```javascript
const ws = new WebSocket('wss://127.0.0.1:9877', { rejectUnauthorized: false })

ws.on('upgrade', (res) => {
  const fp = res.socket.getPeerCertificate()?.fingerprint256
  if (fp !== EXPECTED_FINGERPRINT) failAndExit('fingerprint mismatch')
})
ws.on('open', () => ws.send(JSON.stringify({ type:'auth', id, token, args:['spike-headless-client'] })))
// auth-result → send {type:'ping'} → pong → send {type:'invoke', channel:'spike:echo'} → invoke-result → exit 0
```

#### ts → js 處理方式選用

**Option A**：`npx tsx scripts/spike-headless-server.mjs`。
- 理由：`tsx 4.21.0` 已隨 dev 依賴裝起來（不需動 `package.json`），ESM dynamic import + TS resolution 一步到位；改 `.mjs` 寫 `import('./xxx.ts')` 也能工作
- 不選 B（`npm run compile`）：spike 不需要 dist 產物，多一步無價值
- 不選 C（手寫 .mjs port）：會破壞 `secrets-strategy-electron.ts` 的型別協同，且要維護兩份

### Step 7-8 — PoC 執行結果

| AC | 狀態 | 證據 |
|----|------|------|
| AC1 wss listen | ✅ | server log: `[RemoteServer] Started on 127.0.0.1:9877 (bind=localhost), fingerprint=69:43:AE:77:9A:BB:E8:CD..., token=spike-to...` + `[spike-server] Listening on wss://127.0.0.1:9877 — node 25.9.0, electron=undefined` |
| AC2 cert 純 Node | ✅ | `loadOrCreateServerCertificate(SPIKE_DATA_DIR)` 在 plain Node (`process.versions.electron === undefined`) 下成功產出 cert + key + fingerprint，寫入 `%TMP%/bat-headless-spike-data/server-cert.json`；selfsigned v5 async API 正常 |
| AC3 secrets strategy | ✅ | `setSecretStrategy(new PlaintextStrategy({ warnOnUse: false }))` 注入後，`server.start(...)` 內部 `persistToken` 路徑寫出 `server-token.json` 成功（worktree 內 inspect tmp dir 確認 `{"v":1,"encrypted":false,"data":"spike-token-12345"}`）；無任何 safeStorage 呼叫 |
| AC4 client handshake + auth + ping + echo | ✅ | client 印出全部 5 個 sub-tick：`tlsHandshake/fingerprintMatch/authOk/pingPong/echoOk` 均 true，`OVERALL: ✅ PASS`；echo payload `{"echoed":["hello",{"from":"spike-client"},42],"at":1777125432801}` 完整回送 |
| AC5 process tree 無 Electron | ✅ | `Get-CimInstance Win32_Process` 過濾 `CommandLine like '%spike-headless%'`：3 個 `node.exe` 全部從 `C:\Program Files\nodejs\node.exe`（非 electron），electron 過濾 count = 0；同時程式內 self-assert `process.versions.electron === undefined` 也通過 |
| AC6 回報完整 | ✅ | 本回報區 |
| AC7 echo handler 可重用 | ✅ | 用 production 的 `registerHandler('spike:echo', fn)` API，未動 `protocol.ts`；同樣機制可註冊任意 `spike:*` channel |
| AC8 reconnect 一次驗證 | ✅ | 第二次跑 client 同樣 OVERALL PASS（server 沒重啟，token 持久化 + cert reuse + handler 仍註冊） |

### 踩到的雷（已解 / 未解）

| 雷 | 狀態 | 處理 |
|----|------|------|
| `BAT_REMOTE_PORT=9876` 已被 live BAT server 佔用 | 已解 | spike 改 9877，不影響工單目標 |
| 工單骨架描述「server 主動送 ping」不符實際 | 已解 | 讀 `protocol.ts` + `remote-server.ts:306` 後改由 client 送 `{type:'ping'}` → server 回 `{type:'pong'}`；server 內部用 `ws.ping()` 做 protocol-level heartbeat 不是應用層 frame |
| 工單骨架的 `auth-ok` frame 名稱與實際不符 | 已解 | 對齊 `protocol.ts` 的 `auth-result` |
| `ElectronSafeStorageStrategy` 在 pure Node `require('electron')` 會解析到 binary path 字串 | 已解 | 加 `process.versions.electron` 守門 + try/catch；spike path 完全跳過此 strategy |
| Git CRLF warnings | 未解（不需解） | Windows 環境正常現象，不影響功能 |

### 剩餘未解 `app.*` 依賴清單

**server-side：0**。詳見 Step 3 回報。

**client-side（不在本 spike 範圍，但記錄供 PLAN-007 後續處理）**：
- `electron/remote/remote-client.ts:4,53,65,215` 對 `BrowserWindow` + `webContents.send` 強依賴
  - 影響評估：headless host（Linux server / WSL / Docker）上不需要把遠端事件轉給 BrowserWindow，這層可以在 PLAN-007 拆 host 模式時改成 EventEmitter / stdout / 其他 sink
  - 工程量估計：100-150 行重構（拆 transport-agnostic 的 dispatcher interface + 兩個實作 BrowserWindow / null-sink）

### 給塔台的下一步建議

- **spike 標：CONCLUDED ✅** — AC1-AC8 全綠，未觸發任何止損條件
- **T0262 BAT-remote 強化 research 應重點處理**（按優先級）：
  1. **headless server entry contract 規格化**：把 spike 的 `RemoteServer + configDir + setSecretStrategy + registerHandler` 組合升成正式 `createHeadlessServer(opts)` API，並寫成 PLAN-007 的「server 入口介面 spec」
  2. **token 持久化策略 in headless**：本 spike 用 `os.tmpdir()`，production headless 應該用 `XDG_DATA_HOME` / `--data-dir` 顯式指定（避免 tmp 清掉導致 token rotate）
  3. **cert renewal trigger in headless**：90 天 renew 邏輯目前依賴 `loadOrCreateServerCertificate` 自動跑，headless 模式下要不要加 admin endpoint 強制 rotate？（待 research）
  4. **handler-registry 動態載入**：spike 只註冊 `spike:echo`；production headless 需要把 `pty:*` / `claude:*` / `terminal:*` 等 handlers 全部註冊起來，每個 handler 各自的 host 端依賴（PTY、claude CLI、git、fs）需要逐個檢查 headless 可行性 — **這是 PLAN-007 的下一個 spike 候選**
- **PLAN-007 風險提醒**：
  - 預期 server-side 工程量：**小**（secrets 已拆完，加個正式 entry script + 文件，估 1-2 天）
  - 預期 host-side（remote-client.ts）工程量：**中**（拆 BrowserWindow 出 dispatcher interface，估 3-5 天）
  - 預期 handler 大盤點工程量：**大但可拆解**（每個 channel 一張小工單，估 2-4 週分批）
  - **總體 PLAN-007 改 PLANNED 是安全的**（spike 已證可行性錨點）

### 收尾 commit

- worktree 內：`17ac525` on `exp/headless-server-spike` —— `spike(headless): EXP-HEADLESS-001 PoC — wss + plaintext secrets + echo client`
- 主線：見下方 Step 8 commit hash（chore workorder + EXP 結論記錄）
- worktree 處理：依 Step 10 待塔台決策（CONCLUDED 路徑 → 清 worktree）

### Renew 歷程

無
