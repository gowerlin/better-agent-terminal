# T0181 研究報告 — PLAN-018 拆分規格

> **研究日期**：2026-04-18
> **工單**：T0181（research，互動模式 enabled）
> **前置**：T0164 研究報告 `_report-upstream-sync-v2.1.42-plus.md` §3.2 #7+#8 / §4 Phase 2
> **目標**：將 PLAN-018（Remote 資安加固，整包 6-10h）拆為 3 張可獨立執行的下游工單
> **方法**：Q1.C（先讀內部 T0164 報告 + fork 現況 → 網路補讀 upstream）+ Q3.C（自適應熱區審計）

---

## 摘要

| 項目 | 結論 |
|------|------|
| 推薦拆分方案 | **3 張工單**（維持 T0181 原建議，無合併/再拆） |
| T0182 | TLS + fingerprint pinning（**4-5h**，原估 2-3h **上修**）|
| T0183 | Path sandbox（**1.5-2h**）|
| T0184 | Brute-force 防護 + 連線穩定性（**1.5-2h**，含 reconnect backoff / mutex / maxPayload / image cap）|
| 依賴關係 | **T0182 → T0184 序列**（T0184 需 wss 完成）；**T0183 可與 T0182 並行** |
| 執行順序 | **T0182 → (T0183 並行) → T0184**，總工時 7-9h |
| Fork 客製化熱區 | **中度影響**（fork remote 模組 612 行，上游重寫 +1288/-285）→ 3 處必保留 |
| 風險等級 | 🟡 Medium（P0 資安但測試環境需雙端準備） |
| Worker 互動 | 無需提問（拆分方案清晰、熱區明確、行號可定位）|

---

## A. Upstream 改動理解（G1）

### A.1 T0164 報告重點引用

依 `_report-upstream-sync-v2.1.42-plus.md` §3.2 #7+#8（line 163-207）：

**P0（Security）**：
- `wss://` + 自簽憑證 + SHA-256 fingerprint pinning（TOFU）
- 憑證私鑰與 token 改存 Electron **`safeStorage`**
- `bind-interface`（localhost/tailscale/all）— **預設 localhost**，修正 fork 現行 `0.0.0.0` 裸露

**P1（Reliability）**：
- client reconnect → 指數退避 + jitter（原固定 3s）
- `remote:connect/disconnect` mutex 序列化
- per-IP auth 失敗節流（5 fails/60s → 10min ban）
- 未 auth 傳非 auth frame → 直接關閉（fork 目前只回 error）
- WebSocket `maxPayload` 32 MB cap
- **path sandbox** 新檔 `path-guard.ts` 套於 `fs:readdir/readFile/search/watch` + `image:read-as-data-url`
- `image:read-as-data-url` 加 10 MB cap + try/catch

**P2（Maintainability）**：
- `claude:abort-session` 加入 `PROXIED_CHANNELS`
- `electron.d.ts` 改 import `ElectronAPI` 型別
- Profiles 加 `remoteFingerprint` 欄位；ProfilePanel/SettingsPanel + QR payload 支援

### A.2 Upstream 新增檔案（Fork 需新建）

| 檔案 | 上游行數 | Fork 狀態 | 所屬工單 |
|------|---------|----------|---------|
| `electron/path-guard.ts` | +78 | 不存在 → 新建 | **T0183** |
| `electron/remote/certificate.ts` | +103 | 不存在 → 新建 | **T0182** |
| `electron/remote/secrets.ts` | +54 | 不存在 → 新建 | **T0182** |

### A.3 Upstream 主 commit `3a0af80` + 依附 `5d9f486`

- `3a0af80`：16 檔案主體 +1288 / -285
- `5d9f486` (v2.1.46-pre.1)：selfsigned@5 async 修復（`generate()` 回 Promise），與 `3a0af80` 捆綁
- 技術細節：`await selfsigned.generate(attrs, options)` 回 `{ cert, private }`，舊版 v4 同步呼叫直接回結果，v5 若未 `await` 會拿到 Promise 物件 → `.cert / .private` undefined → `Cannot read properties of undefined (reading 'replace')`

### A.4 Fork 對應檔案 locate（grep 結果）

| Fork 檔案 | 行號 | 內容 | 涉及工單 |
|----------|------|------|---------|
| `electron/remote/remote-server.ts` | 全檔 228 行 | WebSocket server、token 明文 persist、`host: '0.0.0.0'`（L76）、auth handshake（L98-114）、無 mutex/節流 | **T0182 / T0184** |
| `electron/remote/remote-client.ts` | 全檔 233 行 | WebSocket client、`ws://` 連線（L52）、固定 3s reconnect（L166-183） | **T0182 / T0184** |
| `electron/remote/tunnel-manager.ts` | 55 行 | QR payload 建構（L23-34），目前只含 host/port/token | **T0182** |
| `electron/main.ts` | L2292 `fs:readdir` | 無 sandbox 檢查 | **T0183** |
| `electron/main.ts` | L2302 `fs:readFile` | 僅 512 KB cap，無路徑檢查 | **T0183** |
| `electron/main.ts` | L2310 `fs:stat` | 無檢查 | **T0183** |
| `electron/main.ts` | L2316 `fs:search` | recursive walk，無 sandbox | **T0183** |
| `electron/main.ts` | L2231-2290 `fs:watch / reset-watch / unwatch` | 無 sandbox | **T0183** |
| `electron/main.ts` | L2497-2503 `image:read-as-data-url` | 無 size cap、無 try/catch | **T0183** |
| `electron/main.ts` | L2506-2538 `remote:start-server / tunnel:get-connection` | 無 bind-interface 選項 | **T0182** |
| `electron/main.ts` | L2541-2586 `remote:connect / disconnect / test-connection / list-profiles` | 無 mutex | **T0184** |
| `electron/profile-manager.ts` | L6-16 `ProfileEntry` interface | 無 `remoteFingerprint` 欄位 | **T0182** |
| `electron/profile-manager.ts` | L203-220 `create`、L349-360 `update` | 需擴充 remoteFingerprint | **T0182** |
| `electron/preload.ts` | L343, L377-411 `profile` + `remote` API 型別宣告 | 需加 `remoteFingerprint` | **T0182** |
| `src/components/ProfilePanel.tsx` | L8-10, L36-38, L131-133, L191-193 | 表單狀態、create 呼叫 | **T0182** |

---

## B. 拆分方案（G2）

### B.1 推薦方案：維持 T0181 原設計（3 張工單）

**理由**：

1. **T0182 合併 TLS + fingerprint**：兩者在 upstream 同屬連線層（同 commit `3a0af80`）；`5d9f486` 是 `3a0af80` 的 selfsigned 依附修復，不宜拆開；`safeStorage` 整合同屬憑證/金鑰儲存，與 TLS 強相關
2. **T0183 獨立 path sandbox**：`path-guard.ts` 完全獨立模組（78 行新檔），只改 6 個 IPC handler，無連線層耦合，可並行實作
3. **T0184 包含 brute-force + 連線穩定性**：per-IP 節流、指數退避、mutex、maxPayload、image 10MB cap 都是「連線穩定性與 auth 保護」相關，且單獨 brute-force 只有 1h 不值一張工單，合併後 1.5-2h 規模合理

### B.2 替代方案考量（給塔台參考，但**不推薦**）

**方案 B**：TLS 和 fingerprint 再分 2 張（T0182a / T0182b）
- ❌ 不推薦：fingerprint pinning 依賴 TLS 憑證指紋，拆分後 T0182b 無法獨立測試
- ❌ upstream 原本就在同一 commit，硬拆違反原子設計

**方案 C**：T0183 + T0184 合併為 1 張
- ❌ 不推薦：path sandbox 與連線層完全解耦，合併後工單邊界模糊，不利 review
- ❌ 工時會膨脹到 3-4h，失去小切片優勢

**方案 D**：路徑沙盒拆為「fs:\* 系列」+「image:\* 系列」2 張
- ❌ 不推薦：`path-guard.ts` 是單一模組，兩個 caller 套同一個函式，無合理拆分點

### B.3 Fork 既有偏離對拆分方案的影響

| Fork 偏離點 | 是否阻礙拆分 | 備註 |
|------------|-------------|------|
| `ALWAYS_LOCAL_CHANNELS`（workspace:save/load）@ main.ts L2368-2376 | ❌ 無影響 | T0165 C1.2 已加，upstream 也已併入 |
| Supervisor routing（BAT 內部終端） | ⚠️ 需注意 | **T0184 須保留** supervisor 模式下 auth 節流範圍僅涵蓋 remote 連線，不影響 supervisor IPC |
| Profile `profile:list-local` | ❌ 無影響 | 不走 remote invoke，path sandbox 無關 |

---

## C. T0182 規格（TLS + fingerprint pinning + safeStorage + remoteFingerprint）

### 背景

將 fork remote 連線從明文 `ws://` 升級為 `wss://` + 自簽憑證 + SHA-256 fingerprint pinning（TOFU 模型），並將憑證私鑰與 token 改存 Electron `safeStorage`；Profile/QR payload 擴充 `remoteFingerprint` 欄位。

### 前置條件

- **T0164 DONE**：見報告 §3.2 #7（L163-207）
- **Upstream commit**：`3a0af80`（連線層安全）+ `5d9f486`（selfsigned v5 async 修復）
- **依賴套件**（需新增）：`selfsigned@^5.x`（package.json 加入）

### 修改檔案清單

| 檔案 | 行號 | 改動類型 |
|------|------|---------|
| `electron/remote/certificate.ts` | **新檔 ~103 行** | 新建：self-signed cert 生成（async）、fingerprint 計算 |
| `electron/remote/secrets.ts` | **新檔 ~54 行** | 新建：safeStorage 包裝（encrypt/decrypt string） |
| `electron/remote/remote-server.ts` | 1-228 **整段改寫** | `new WebSocketServer` 改用 `https.createServer` + cert + WebSocketServer upgrade；token loader 改走 `secrets.ts` |
| `electron/remote/remote-server.ts` | L76（bind） | `host: '0.0.0.0'` → `host: <bindInterface>`（預設 `'127.0.0.1'`）|
| `electron/remote/remote-server.ts` | L56-68 `persistToken` / `loadPersistedToken` | 改用 `secrets.ts` 替代 `fs.writeFileSync` plaintext |
| `electron/remote/remote-client.ts` | L52 `ws://` | 改為 `wss://` + `rejectUnauthorized: false` + fingerprint 驗證 hook（`ws` 模組的 `checkServerIdentity` 或 `upgrade` event 驗 cert） |
| `electron/remote/remote-client.ts` | L38-75 `connect()` | 擴充 `fingerprint` 參數，連線後於 `ws.on('open')` 或 upgrade 階段比對指紋 |
| `electron/remote/tunnel-manager.ts` | L23-34 `getConnectionInfo` | 新增 `fingerprint` 參數，QR payload 格式擴充 |
| `electron/remote/tunnel-manager.ts` | L12-17 `TunnelResult` interface | 加入 `fingerprint: string` 欄位 |
| `electron/main.ts` | L79 `import { getConnectionInfo }` | 補 `fingerprint` 取得邏輯 |
| `electron/main.ts` | L2521-2538 `tunnel:get-connection` | 將 server cert 指紋傳入 `getConnectionInfo` |
| `electron/main.ts` | L2506-2509 `remote:start-server` | 擴充 `bindInterface` 參數（optional） |
| `electron/main.ts` | L2541-2554 `remote:connect` | 擴充 `fingerprint` 參數，傳給 `RemoteClient.connect` |
| `electron/main.ts` | L2564-2573 `remote:test-connection` | 同上 |
| `electron/main.ts` | L2574-2586 `remote:list-profiles` | 同上 |
| `electron/profile-manager.ts` | L6-16 `ProfileEntry` | 加 `remoteFingerprint?: string` |
| `electron/profile-manager.ts` | L203-220 `create()` | 接受並儲存 `remoteFingerprint` |
| `electron/profile-manager.ts` | L349-360 `update()` | 支援 `remoteFingerprint` 更新 |
| `electron/preload.ts` | L343, L377-411 | 型別擴充 `remoteFingerprint` + `bindInterface` |
| `src/components/ProfilePanel.tsx` | L8-10, L36-38 | 新增 `remoteFingerprint` 狀態 |
| `src/components/ProfilePanel.tsx` | L131-133, L191-193 | create/update 呼叫加入 `remoteFingerprint` |
| `src/components/ProfilePanel.tsx` | L289, L305 附近 | 新增 fingerprint 輸入欄位（可空白，TOFU 時自動填入） |
| `src/components/SettingsPanel.tsx` | remote 區塊（待 grep 定位） | 新增 `bindInterface` 下拉（localhost/tailscale/all）|
| `package.json` | dependencies | 加 `"selfsigned": "^5.0.0"` |

### 改動方向（不寫 diff，只描述）

1. **Cert 生成**（`certificate.ts`）：
   - `async generateSelfSignedCert(): Promise<{ cert: string, key: string, fingerprint: string }>`
   - `fingerprint = createHash('sha256').update(cert).digest('hex').toUpperCase()` + `:` 每 2 字元分隔
   - Cert 存於 `app.getPath('userData')/server-cert.json`（含過期時間檢查，建議 10 年 expiry）
2. **Secrets 儲存**（`secrets.ts`）：
   - `encryptString(plain: string): Buffer` → `safeStorage.encryptString(plain)`
   - `decryptString(encrypted: Buffer): string` → `safeStorage.decryptString(encrypted)`
   - 包裝 `safeStorage.isEncryptionAvailable()` 檢查，失敗時 fallback 到 plaintext + warn log
3. **Server 升級**：`new WebSocketServer({ server: httpsServer })`；`httpsServer` 由 `https.createServer({ cert, key }, ...)` 建立
4. **Client 驗 fingerprint**：Upgrade 階段取得 `socket.getPeerCertificate().fingerprint256`，比對 profile 儲存的 fingerprint；首次連線（TOFU）自動儲存，後續驗證
5. **QR payload 擴充**：`{ url, token, fingerprint, mode, addresses }`，QR code reader 端（mobile / ProfilePanel 的 listRemoteProfiles 流程）需更新

### AC 對照表

| AC | 驗收條件 | 驗證方法 |
|----|---------|---------|
| AC-1 | 連線協定為 `wss://` | grep `electron/remote/remote-client.ts:52` 應為 `wss://`；連線後 `ws.url` 以 `wss://` 開頭 |
| AC-2 | Server 預設 bind `127.0.0.1` | grep `remote-server.ts` host 預設值；runtime 檢查 `netstat -an \| grep :9876` 只 listen 本機 |
| AC-3 | Token 不以 plaintext 儲存 | `cat server-token.json` 應為 encrypted buffer（hex/base64），不可見 raw token 字串 |
| AC-4 | Profile 含 `remoteFingerprint` 欄位 | `ProfileEntry` 型別 grep；runtime 建立 remote profile 後檢查 JSON |
| AC-5 | 首次連線自動儲存 fingerprint（TOFU） | 手動測：新建 remote profile → 連線 → 檢查 profile JSON 有 `remoteFingerprint` |
| AC-6 | 二次連線 fingerprint 不符時拒絕 | 手動測：改 server cert → client 連線應失敗 + log 顯示 fingerprint mismatch |
| AC-7 | QR payload 含 fingerprint | grep `tunnel-manager.ts` `TunnelResult` 型別；runtime call `tunnel:get-connection` 結果含 `fingerprint` |
| AC-8 | selfsigned v5 async 正確 await | grep `certificate.ts` 含 `await selfsigned.generate(...)`；無 `.cert replace` runtime error |
| AC-9 | SettingsPanel 有 bindInterface 選項 | UI 手動檢查；切換後重啟 server，netstat 驗證 bind 地址 |
| AC-10 | `vite build` + `tsc --noEmit` 皆通過 | `npx vite build`、`npx tsc --noEmit` exit 0 |

### 測試策略

- **單元測試**：`certificate.ts` generateSelfSignedCert() 輸出格式（cert PEM / fingerprint 格式 `XX:XX:...`）；`secrets.ts` encrypt → decrypt roundtrip
- **整合測試**：remote-server 啟動後 `curl -k https://127.0.0.1:9876/` 能取得 cert；fingerprint 計算與 client 端一致
- **手動驗證**：
  1. 啟動 server A → 新建 client B 的 remote profile → 首次連線 TOFU 儲存指紋
  2. 停 server A → 重啟（cert 不變）→ B 連線應成功
  3. 刪 server A 的 cert → 重啟（新 cert）→ B 連線應失敗 + fingerprint mismatch 錯誤
  4. 測 bind-interface 三種：localhost / tailscale / all
  5. QR code 掃描（或手動解碼）驗證含 fingerprint

### 工時估計（含 buffer）

| 階段 | 工時 |
|------|------|
| 讀懂 upstream `3a0af80` + `5d9f486` diff（GitHub 線上取得） | 0.7h |
| 新建 `certificate.ts` + `secrets.ts` | 1h |
| Remote-server WSS 升級 + bind-interface | 1h |
| Remote-client fingerprint 驗證 | 0.8h |
| Profile/UI/QR payload 擴充 | 0.8h |
| 手動測試（跨機連線 / TOFU / mismatch / bind-interface） | 1h |
| 文件 + CLAUDE.md 更新 | 0.2h |
| **總計** | **5.5h**（含 buffer，T0164 原估 2-3h 明顯低估，本規格上修） |

### 與其他工單依賴

- **與 T0183 並行可行**：T0183 只改 fs IPC handler，T0182 只改 remote 連線層，零交集
- **是 T0184 的前置**：T0184 的 per-IP 節流需在 WSS server 上實作，auth 失敗偵測也需整合到新的 TLS 升級流程

---

## D. T0183 規格（Path sandbox + image cap）

### 背景

新增 `electron/path-guard.ts` 提供「workspace 路徑白名單」機制，套用於所有 fs:* IPC handler 與 image:read-as-data-url，阻絕 path traversal 讀取 `~/.ssh`、keychain、credential stores 等敏感目錄；同時為 `image:read-as-data-url` 加 10 MB cap 與 try/catch 保護。

### 前置條件

- **T0164 DONE**：見報告 §3.2 #7 P1（L181-185）
- **Upstream commit**：`3a0af80` 的 `path-guard.ts` 部分（78 行新檔）

### 修改檔案清單

| 檔案 | 行號 | 改動類型 |
|------|------|---------|
| `electron/path-guard.ts` | **新檔 ~78 行** | 新建：`isPathAllowed(requestedPath): boolean`、`assertPathAllowed(requestedPath): void`、workspace 白名單管理（register/unregister） |
| `electron/main.ts` | L2231 `fs:watch` | 進入前 `assertPathAllowed(dirPath)` |
| `electron/main.ts` | L2255 `fs:reset-watch` | 同上 |
| `electron/main.ts` | L2283 `fs:unwatch` | 同上 |
| `electron/main.ts` | L2292 `fs:readdir` | 同上 |
| `electron/main.ts` | L2302 `fs:readFile` | 同上 |
| `electron/main.ts` | L2310 `fs:stat` | 同上 |
| `electron/main.ts` | L2316 `fs:search` | 同上（recursive walk 需在每個子路徑 assert） |
| `electron/main.ts` | L2497-2503 `image:read-as-data-url` | `assertPathAllowed(filePath)` + 新增 10 MB cap（`stat.size > 10 * 1024 * 1024`）+ 包 try/catch |
| `electron/main.ts` | workspace open/close 處（待 grep `workspace:open / add-workspace / remove-workspace`） | 註冊/登出 workspace 路徑到 path-guard 白名單 |

### 改動方向

1. **path-guard.ts 核心 API**：
   ```
   registerWorkspace(absPath: string): void  // 加入白名單
   unregisterWorkspace(absPath: string): void
   isPathAllowed(requestedPath: string): boolean  // normalize + 檢查是否在任一 workspace 樹下
   assertPathAllowed(requestedPath: string): void  // 不允許時 throw new Error('Path access denied: ...')
   ```
2. **Normalize 邏輯**：
   - `path.resolve(requestedPath)` → 消除 `..` 和 symlink
   - 檢查 `resolved.startsWith(workspacePath + path.sep)` 或 `resolved === workspacePath`
3. **各 IPC handler 在入口處呼叫 `assertPathAllowed`**，失敗時 error frame 返回 client（或 `return { error: 'Path access denied' }`）
4. **`fs:search` 的 recursive walk**：起始點 assert；walk 過程若遇 symlink 或 `..` 導致跳出 workspace → continue（不 throw，因為搜尋工具不應為單一檔案整個失敗）
5. **image:read-as-data-url 10 MB cap**：`const stat = await fs.stat(filePath); if (stat.size > 10 * 1024 * 1024) throw new Error('Image too large')`
6. **image 錯誤處理**：整個 handler 包 try/catch，失敗時回 `data:image/png;base64,` 空字串或 throw，由 renderer 顯示錯誤圖示

### AC 對照表

| AC | 驗收條件 | 驗證方法 |
|----|---------|---------|
| AC-1 | `path-guard.ts` 存在且 export 所有必要 API | grep 檔案存在、grep `export function (register\|unregister\|is\|assert)PathAllowed` |
| AC-2 | 所有 fs:* handler 進入時呼叫 `assertPathAllowed` | grep `registerHandler('fs:.*assertPathAllowed`（context -A 5）|
| AC-3 | `image:read-as-data-url` 呼叫 `assertPathAllowed` | grep main.ts L2497-2503 附近含 `assertPathAllowed` |
| AC-4 | `image:read-as-data-url` 10 MB cap | grep main.ts L2497-2503 附近含 `10 * 1024 * 1024` 或常數名 `MAX_IMAGE_SIZE` |
| AC-5 | 嘗試讀 workspace 外路徑應被拒絕 | 手動測：於 renderer 呼叫 `fs:readFile('/Users/X/.ssh/id_rsa')` 應回 `{ error: 'Path access denied' }` |
| AC-6 | workspace 內正常路徑應可讀 | 手動測：現有 workspace 檔案操作（編輯、檢視）無 regression |
| AC-7 | `fs:search` 不因 symlink 跳出 workspace 整個失敗 | 手動測：workspace 內有 symlink 指向外部 → search 不 throw，只 skip |
| AC-8 | Workspace 新增/刪除時 path-guard 白名單同步 | 手動測：新增 workspace → 立即可讀；刪 workspace → 立即不可讀 |
| AC-9 | `vite build` + `tsc --noEmit` 皆通過 | `npx vite build`、`npx tsc --noEmit` exit 0 |

### 測試策略

- **單元測試**（`path-guard.test.ts`）：
  - `registerWorkspace('/a')` 後 `isPathAllowed('/a/b/c')` → true
  - `registerWorkspace('/a')` 後 `isPathAllowed('/a/../b')` → false
  - `registerWorkspace('/a')` 後 `isPathAllowed('/a')` → true（允許根目錄本身）
  - symlink 跳出 workspace → false
- **手動驗證**：
  1. 正常檔案瀏覽、編輯、搜尋 — 無 regression
  2. `fs:readFile('/Users/<user>/.ssh/id_rsa')` via devtools → error
  3. 圖片貼上超過 10 MB → error 訊息「Image too large」
  4. 新增 workspace 後可讀、刪 workspace 後不可讀

### 工時估計（含 buffer）

| 階段 | 工時 |
|------|------|
| 讀懂 upstream `path-guard.ts` + 套用點 diff | 0.4h |
| 新建 `path-guard.ts` + 單元測試 | 0.5h |
| 套用至 8 個 IPC handler | 0.4h |
| workspace 註冊/登出 hook 串接 | 0.3h |
| 手動測試 | 0.3h |
| **總計** | **1.9h**（含 buffer） |

### 與其他工單依賴

- **與 T0182 完全獨立可並行**：零檔案交集
- **與 T0184 無直接依賴**：可先後任意順序

---

## E. T0184 規格（Brute-force 防護 + 連線穩定性）

### 背景

為 remote server 加上 per-IP auth 失敗節流（5 fails/60s → 10min ban），remote client 改用指數退避 + jitter（原固定 3s），`remote:connect/disconnect` 加 mutex 序列化，WebSocket 加 32 MB `maxPayload` cap，未 auth 傳非 auth frame 直接關閉。

### 前置條件

- **T0182 DONE**（本工單的 brute-force 節流需在 WSS server 上實作；mutex 需在擴充後的 connect 流程中加入）
- **T0164 DONE**：見報告 §3.2 #7 P1（L179-184）
- **Upstream commit**：`3a0af80` 相關片段

### 修改檔案清單

| 檔案 | 行號 | 改動類型 |
|------|------|---------|
| `electron/remote/remote-server.ts` | L16-22 class 欄位 | 新增 `authFailures: Map<string, { count: number; firstFailAt: number; bannedUntil?: number }>` |
| `electron/remote/remote-server.ts` | L70-76 `start()` | `WebSocketServer` 構造參數加 `maxPayload: 32 * 1024 * 1024` |
| `electron/remote/remote-server.ts` | L78 `wss.on('connection')` | 取得 `req.socket.remoteAddress`；連線前檢查 ban 狀態 |
| `electron/remote/remote-server.ts` | L98-114 auth handshake | auth 失敗時：計數 + `count >= 5 && now - firstFailAt <= 60000` → 設 `bannedUntil = now + 10 * 60 * 1000`；成功時清除該 IP 紀錄 |
| `electron/remote/remote-server.ts` | L116-119 未 auth 傳非 auth frame | 從「回 error」改為「close connection」 |
| `electron/remote/remote-client.ts` | L166-183 `scheduleReconnect` | 固定 3s → 指數退避 `min(30s, 1s * 2^attempt) + random(0, 1s)`；新增 `reconnectAttempts` counter |
| `electron/main.ts` | L2506 附近（模組頂層或函式內） | 加 `let remoteOpMutex: Promise<unknown> = Promise.resolve()`（session-level mutex） |
| `electron/main.ts` | L2541-2554 `remote:connect` | 包 `remoteOpMutex = remoteOpMutex.then(...)` |
| `electron/main.ts` | L2555-2559 `remote:disconnect` | 同上 |

### 改動方向

1. **Auth 節流**：
   - Map key = IP（IPv4/IPv6）
   - Entry：`{ count, firstFailAt, bannedUntil? }`
   - Auth 失敗：若 `bannedUntil && now < bannedUntil` → 直接 close（不給機會）；否則 count++，若 `count >= 5 && now - firstFailAt <= 60000` → 設 `bannedUntil`
   - 60s 窗口過了之後重置 count/firstFailAt
   - 成功 auth：`authFailures.delete(ip)`
2. **指數退避**：
   ```
   const attempt = this.reconnectAttempts  // 累計次數
   const base = Math.min(30000, 1000 * Math.pow(2, attempt))
   const jitter = Math.random() * 1000
   const delay = base + jitter
   ```
   連線成功時 `this.reconnectAttempts = 0`
3. **Mutex 序列化**：
   - 簡易 Promise chain：`remoteOpMutex = remoteOpMutex.then(actualHandler).catch(() => {})`
   - 每次 connect/disconnect 的 handler body 改寫為等待 mutex 解鎖
4. **maxPayload**：WebSocket 限制單一訊息 32 MB，防止惡意端送超大 payload 導致 OOM
5. **未 auth 非 auth frame**：fork L116-119 改為 `this.sendFrame(ws, ...); ws.close()`

### AC 對照表

| AC | 驗收條件 | 驗證方法 |
|----|---------|---------|
| AC-1 | WSS server `maxPayload` = 32 MB | grep `remote-server.ts` 含 `maxPayload: 32` |
| AC-2 | Auth 失敗 per-IP 節流生效 | 手動測：快速連續 5 次錯誤 token → 第 6 次直接 close + `authFailures` Map 有紀錄 |
| AC-3 | Ban 期間（10 min）後解除 | 單元測試或手動：advance time → ban 自動過期，可重新 auth |
| AC-4 | 未 auth 傳非 auth frame → close | 手動測：不送 auth，直接送 invoke frame → ws 收到 close，非只有 error frame |
| AC-5 | Client 指數退避生效 | 手動測：關 server，觀察 client 重連間隔 1s → 2s → 4s → ... 封頂 30s + jitter（log 顯示）|
| AC-6 | Connect/disconnect mutex 序列化 | 手動測：快速切換 profile → 連線狀態不錯亂（觀察 log 順序）|
| AC-7 | Client reconnect 成功後重置 counter | 重連成功後關掉 server，觀察下次重試間隔回到 ~1s |
| AC-8 | `vite build` + `tsc --noEmit` 皆通過 | 同上 |

### 測試策略

- **單元測試**：
  - `remote-server.authFailures` Map 邏輯（模擬 6 次失敗 → 觀察 bannedUntil 設置）
  - client 指數退避計算（給定 attempt 值，驗證 delay 範圍）
- **整合測試**：`ws` CLI 工具或 `wscat` 手動連線，模擬 brute-force 場景
- **手動驗證**：
  1. Brute-force：跑 `for i in {1..10}; do wscat -c wss://... --no-check; done` → 前 5 次收 auth fail，後續直接 close
  2. Ban 計時：手動 ban 後，跳 10 min（或改 constant 為 10s 加速測試）→ ban 解除
  3. Reconnect：關 server 後，log 應顯示退避延遲遞增，連線恢復後 counter 重置
  4. 併發：快速 profile 切換 10 次 → remote state 穩定無洩漏

### 工時估計（含 buffer）

| 階段 | 工時 |
|------|------|
| 讀懂 upstream `3a0af80` 相關片段 | 0.3h |
| Per-IP auth 節流實作 + 單元測試 | 0.5h |
| 指數退避 + jitter | 0.3h |
| Mutex 序列化 | 0.3h |
| maxPayload + 未 auth close | 0.1h |
| 手動測試（brute-force / reconnect / mutex） | 0.4h |
| **總計** | **1.9h**（含 buffer） |

### 與其他工單依賴

- **依賴 T0182 DONE**：brute-force 節流需在 `wss` server 上套；未 auth close 需配合新的 auth 流程；mutex 需涵蓋 fingerprint 驗證新分支
- **與 T0183 獨立**

---

## F. 測試策略彙整

### 整合測試（跨 3 張工單）

- **端到端場景 1：首次 TOFU + path sandbox**
  1. A 機啟動 server（T0182）→ B 機新建 remote profile 首次連線（T0182 TOFU）→ 開 workspace 檔案（T0183 path-guard 允許）→ 嘗試讀 `~/.ssh`（T0183 拒絕）
- **端到端場景 2：Fingerprint mismatch + brute-force**
  1. A 機重建 cert → B 機連線失敗（T0182 mismatch）→ 用舊 token 猛連（T0184 ban）→ 等 ban 解除
- **端到端場景 3：斷線重連 + mutex**
  1. 連線中斷 → client 指數退避重連（T0184）→ 重連期間快速切 profile → mutex 防止 race（T0184）
- **回歸測試**：PLAN-018 完成後需手動驗證 T0165（workspace:load fix、Opus 4.7）不受影響

### 自動化測試覆蓋

- `certificate.test.ts`：cert 生成格式、fingerprint 計算
- `secrets.test.ts`：encrypt/decrypt roundtrip
- `path-guard.test.ts`：白名單邊界、symlink、`..` 跳出
- `remote-server.test.ts`：authFailures Map 狀態機
- `remote-client.test.ts`：指數退避數學

### 手動驗證點彙整

| 工單 | 必測項目 |
|------|---------|
| T0182 | TOFU 首次儲存指紋、cert 更換後 mismatch 拒絕、bind-interface 三選項、QR payload 含 fingerprint |
| T0183 | workspace 內正常、workspace 外 + `~/.ssh` 拒絕、image 10 MB cap、workspace add/remove 即時生效 |
| T0184 | Brute-force 5 次觸發 ban、10min 後解除、指數退避 log、profile 快速切換穩定 |

---

## G. 依賴圖與時程（G5）

### G.1 依賴關係

```
T0182 (TLS + fingerprint)  ──────┐
                                 ├──> T0184 (Brute-force + 連線穩定性)
T0183 (Path sandbox)  ─（可並行）─┘
```

- **T0182 → T0184**：**必須序列**。理由：
  - T0184 的 per-IP 節流需掛在 WSS server auth handshake 上
  - T0184 的 mutex 需涵蓋 fingerprint 驗證新分支
  - Auth 失敗訊息路徑會因 T0182 改寫
- **T0182 ⇄ T0183**：**完全並行可行**。零檔案交集：
  - T0182 只改 `electron/remote/*.ts` + `profile-manager.ts` + UI
  - T0183 只改 `electron/main.ts` 的 fs/image IPC handler + 新 `path-guard.ts`

### G.2 建議執行順序

**路徑 A（推薦，總工時 7-9h）**：
```
Day 1 AM: T0182 (5.5h)  ═╗
Day 1 PM: T0183 (1.9h)   ╠═ 並行可行，同日完成
Day 2 AM: T0184 (1.9h)
```

**路徑 B（保守，總工時 ~9h）**：
```
Day 1: T0182 (5.5h) 單獨
Day 2 AM: T0183 (1.9h)
Day 2 PM: T0184 (1.9h)
```

**推薦路徑 A**：T0182 最耗時但其他兩張獨立，並行可省半天；但若單人開發 context 負荷高，B 較穩。

### G.3 PLAN-018 DONE 條件

PLAN-018 狀態轉 DONE 的判準：
- T0182 / T0183 / T0184 三張全部 DONE
- 整合測試場景 1-3 全部通過
- `version.json.lastSyncCommit` 更新為 `5d9f486`（upstream 同步位點）
- CLAUDE.md 補充「Remote 資安」段（bind-interface、fingerprint 管理、path-guard 白名單機制）

---

## H. Fork 客製化熱區清單（G4）

**結論**：fork 有**中度客製化影響**，有 3 處必須在實作時保留或調整。

| # | 檔案/區域 | Fork 客製化內容 | 對下游工單的影響 | 保留建議 |
|---|----------|----------------|-----------------|---------|
| 1 | `electron/main.ts` L2368-2376（`ALWAYS_LOCAL_CHANNELS`） | T0165 C1.2 已加（workspace:save/load）| T0182 改寫 handler 時**不得移除** | 保持邏輯：`bindProxiedHandlersToIpc` 內 `if (remoteClient?.isConnected && !ALWAYS_LOCAL_CHANNELS.has(channel))` |
| 2 | `electron/main.ts` Supervisor routing（BAT 內部終端） | fork 獨有 `supervisor:list-workers / send-to-worker / get-worker-output`（L2828-2847） | T0184 auth 節流不得涵蓋 supervisor IPC（那是 local only） | T0184 實作時 scope 僅限 remote-server `ws.on('connection')`，不影響 supervisor |
| 3 | `electron/profile-manager.ts` L18-22 `ProfileIndex.activeProfileIds` | fork 多 profile 啟用設計（upstream 可能只 single active） | T0182 `remoteFingerprint` 加到 `ProfileEntry` 即可，**不影響** `ProfileIndex` 結構 | Fingerprint 屬於 per-profile 資料，無需改 index |

**額外注意**：
- Fork `tunnel-manager.ts` 的 `TailscaleMode` 判斷（`100.x.x.x`）為 upstream 所無 — T0182 擴充 `TunnelResult` 加 `fingerprint` 時需保留 mode 邏輯
- Fork `preload.ts` 的 `remote` API 命名與 upstream 一致，擴充 `remoteFingerprint` / `bindInterface` 參數無衝突

---

## I. 風險與待定項

### I.1 已識別風險

| # | 風險 | 嚴重度 | 緩解方式 |
|---|------|-------|---------|
| R1 | T0182 工時上修至 5.5h（原估 2-3h），可能擠壓 T0184 | 🟡 Medium | 若 Day 1 T0182 延宕，T0183/T0184 改 Day 2 執行；不強迫並行 |
| R2 | `safeStorage` 在 Linux 無 keychain 時會 fallback，降低安全性 | 🟡 Medium | 在 `secrets.ts` 包裝層加 `safeStorage.isEncryptionAvailable()` 檢查 + warn log；若不可用，fallback 到 plaintext（與現況相同）|
| R3 | WSS 升級後，行動裝置（QR code 流程）可能不接受 self-signed cert | 🟢 Low-Medium | T0182 手動驗證項目 5 「QR 掃描」需跨裝置測；若失敗，QR payload 需包含 cert PEM 供 client 匯入（不在本輪範圍） |
| R4 | path-guard 對 symlink 的處理若太嚴格可能破壞現有 workspace 開發流程 | 🟢 Low | T0183 AC-7 明確要求「symlink 跳出不 throw 只 skip」 |
| R5 | Brute-force 節流使用 in-memory Map，server 重啟會清除 | 🟢 Low | 可接受：server 重啟本身就是狀態重置；若要持久化可後續擴充 |

### I.2 研究中未決問題（供塔台審視）

**Q1**（實作細節，非阻塞）：`secrets.ts` 在 `safeStorage` 不可用時是否該 fail-closed？
- 選項 A（推薦）：fallback 到 plaintext + warn，維持 fork 現行行為
- 選項 B：fail-closed，拒絕啟動 remote server（更安全，但對 Linux 無 keychain 使用者破壞體驗）
- **建議**：選 A，CLAUDE.md 明確記錄限制

**Q2**（擴充考量，非本輪）：bind-interface 若選 `tailscale`，但機器無 tailscale 介面時如何處置？
- 選項 A：啟動時檢查，找不到 tailscale 介面 → 回報 error，不 fallback
- 選項 B：fallback 到 localhost + warn
- **建議**：選 A（fail-closed，避免意外暴露）；T0182 實作時於 `remote:start-server` handler 驗證

**Q3**（UI 決策）：ProfilePanel fingerprint 欄位首次連線前是否可空白？
- 建議：**允許空白**（TOFU 流程需要），連線成功後自動回寫並顯示（read-only + 「Pin expected fingerprint」按鈕）

### I.3 塔台開單時注意

- **T0182 / T0183 / T0184 檔名建議**：
  - `T0182-remote-tls-fingerprint.md`
  - `T0183-remote-path-sandbox.md`
  - `T0184-remote-brute-force.md`
- **互動模式**：三張都建議 `research: false`（實作型工單，不需 Worker 提問）
- **commit 策略**：每張工單單一 commit；PLAN-018 於 T0184 commit 時同步 `version.json.lastSyncCommit` → `5d9f486`

---

**報告完成時間**：2026-04-18 19:55 (UTC+8)

