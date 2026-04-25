# T0260-research-plan007-remote-server-scoping

## 元資料
- **工單編號**：T0260
- **任務名稱**：PLAN-007 遠端 / 容器開發支援 — 範圍盤點與拆單建議（scoping）
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-25 21:30 (UTC+8)
- **開始時間**：2026-04-25 21:33 (UTC+8)
- **類型**：research（純偵察 + 設計拆單，不寫 production code）
- **互動模式**：enabled（探索性高，遇 BAT 架構設計分支可問塔台）
- **Renew 次數**：0
- **預估 wall time**：30-60 min
- **預估 context cost**：中（讀 PLAN-018 相關 source + claude-runtime-router + tunnel-manager + 相關 spec/report 檔）
- **關聯**：
  - 母 PLAN：PLAN-007（💡 IDEA → 本工單為 Phase A 可行性研究的第一張 scoping）
  - 框架重整：使用者授權將 PLAN-007 框架從原「AI Agent 跨環境執行」改為「**BAT terminal server 跨環境部署 + 本地 BAT client 連線**」
  - 既有基底：PLAN-018（BAT remote server，wss + TLS + token + bind-interface）
  - 後續工單：T0261/T0262/T0263/T0264（4 環境平行 research，由本工單建議拆單）+ T0265（彙整）
- **affects_files**：
  - `_ct-workorders/T0260-*.md`（自身回報，唯一寫入目標）

---

## 背景與框架重整

PLAN-007 原構想（2026-04-13 寫的）是「BAT 在 host 跑，AI Agent 透過 SSH/WSL/Docker 跨環境執行」。

使用者於 2026-04-25 第二十七 session 重新對齊，**框架翻轉**為：

> 把 BAT 終端拆成 client/server 兩端 — server 端可跑在 Host / SSH 遠端 / WSL / Docker container，本地 BAT 作為 client 連過去，「**像連本地 terminal server 一樣的體驗**」。

這條路線跟 PLAN-018（既有 wss + TLS + token + bind interface）是直接延伸 — PLAN-018 已做了 server / client 拆分基底（`electron/remote/`、`tunnel-manager`、`certificate.ts`），現在要擴充其**部署 topology**。

本工單為 PLAN-007 重啟後的**第一張**研究工單，目的：
1. 盤點 BAT 現有 remote server 架構，釐清哪些是 host-bound、哪些可遠端化
2. 把 4 種目標環境（BAT-remote 強化 / Docker / WSL / SSH）的差異**分類**（transport vs OS vs packaging）
3. 為後續 4 張平行 research 工單（T0261-T0264）建議**拆單範圍細則**，避免重疊或漏項

**這張工單不對任何環境下結論**，那是 T0261-T0264 各自的事。本工單只回答「應該怎麼拆 4 張，每張該看什麼」。

---

## 任務目標

### 1. BAT remote server 現狀盤點（PLAN-018 產物）

讀以下檔案/區域並摘要架構：

| 區域 | 路徑 | 盤點重點 |
|------|------|----------|
| Remote server 入口 | `electron/remote/` 目錄 | 整體模組劃分、server 啟動流程、IPC 與本地 BAT 的橋接點 |
| 隧道管理 | `electron/remote/tunnel-manager.ts`（如存在） | bind-interface 三選項、token 管理、QR payload 格式 |
| TLS 自簽憑證 | `electron/remote/certificate.ts` | 憑證生成、儲存路徑、fingerprint 驗證流程、過期/重生策略 |
| ProfilePanel UI | `src/components/` 內 ProfilePanel 相關 | client 端如何儲存 server 連線資訊（fingerprint、token） |
| Claude runtime router | `electron/claude-runtime-router.ts` | 跨 runtime（embedded/system claude）如何選擇，是否與 remote server 部署 topology 有交集 |
| PTY / terminal 後端 | `electron/pty-manager.ts` + `electron/terminal/` | terminal session 的建立流程（哪些步驟必須在 host 跑、哪些可遠端化） |
| Native modules | `package.json` `build.asarUnpack` 列表 + 相關 require 點 | 哪些 native modules 是 host-bound（無法跨 OS）、哪些可在 server 端遠端執行 |

**輸出**：一段架構摘要（300-500 字），標記每個元件的「**host-bound** / **可遠端化** / **transport-only**」三分類。

### 2. PLAN-018 現狀差距快速掃描（為 T0261 鋪路）

不深入分析，僅列點：
- multi-client 支援？（同時多個本地 BAT 連同一 server）
- reconnect / heartbeat 機制？
- TLS 憑證自動 renew？（檔內自述「90 天內自動重生」是否真的觸發過）
- Token rotation？
- Server 端是否需要 Electron main process？或可純 Node.js / headless 模式？

**輸出**：條列 5-10 個差距項，每項 1-2 行說明。**不要評估優先級**，那是 T0261 的事。

### 3. Topology 分類框架

針對 4 個目標環境（BAT-remote 強化 / Docker / WSL / SSH），建立分類矩陣，每環境填寫：

| 維度 | BAT-remote 強化 | Docker | WSL | SSH |
|------|----------------|--------|-----|-----|
| **Transport 差異** | ?（已有 wss） | ? | ? | ? |
| **Host OS 差異** | ?（同 OS） | ? | ? | ? |
| **Packaging 差異** | ?（無新需求） | ? | ? | ? |
| **Native module 影響** | ?（無） | ? | ? | ? |
| **GUI 需求** | ?（client 端） | ? | ? | ? |
| **既有元件可重用度** | 高 | ? | ? | ? |
| **新增複雜度估計** | 低（補強既有） | ? | ? | ? |

**輸出**：完整填好的 7×4 矩陣（每格 1 行說明），標記哪些維度「**4 環境共通可抽象**」vs「**每環境必須個別處理**」。

### 4. T0261-T0264 拆單範圍細則建議

針對 4 張平行 research 工單，**逐張**建議：
- **scope（要做什麼）**：條列 4-8 項調查重點
- **out-of-scope（不做什麼）**：條列 2-4 項明確排除
- **affects_files 預估**：哪些 source 檔需要讀 / 不需要讀
- **estimate**：sizing（XS/S/M/L/XL）+ wall time 估計
- **互動旗標建議**：enabled / disabled + 理由
- **依賴**：是否依賴其他環境的研究結論（理想：4 張獨立可平行）

**4 張對應**：
- **T0261**：BAT-remote（PLAN-018）強化研究 — 既有 server 的 multi-client / reconnect / cert renewal / production hardening
- **T0262**：Docker 部署研究 — BAT server 容器化（image strategy / native module / volume / port）
- **T0263**：WSL 部署研究 — WSL 內跑 BAT server，Win client 連 localhost / Win↔Linux 路徑映射
- **T0264**：SSH 部署研究 — BAT server 跑遠端 Linux/macOS，SSH tunnel BAT wss / VS Code Remote SSH 比對

**輸出**：4 張工單的「拆單建議卡」（每張 ~15-25 行）。**不要寫整張完整工單檔**，只寫塔台用以草擬工單的範圍細則。

### 5. T0265 彙整工單建議

最後給 T0265（彙整工單）的建議：
- 統合 4 張結論到哪個 spec 文件名稱（建議 `_spec-remote-dev-support-2026-04.md`）
- 應該包含哪些跨環境共通章節（vs 各環境獨立章節）
- PLAN-007 IDEA → PLANNED 的子工單拆解原則（哪個環境先做 MVP）

**輸出**：一段 200-300 字的 T0265 scope 草稿。

---

## 執行步驟

### Step 1：環境快照
```bash
git status
git log --oneline -10
```
確認 working tree 乾淨，記錄起點 HEAD。

### Step 2：BAT remote server 現狀盤點
讀「任務目標 1」表中所有檔案/區域，整理架構摘要 + 三分類標記。

### Step 3：PLAN-018 差距條列
讀相關 source + 工單檔（grep `_ct-workorders/T0182*` `_ct-workorders/T0181*` 等 PLAN-018 相關工單），列差距 5-10 條。

### Step 4：Topology 分類矩陣
基於 Step 2-3 結論 + 對 4 環境的常識判斷（不需要為 Docker/WSL/SSH 細查）填表。標記共通可抽象 vs 必須個別。

### Step 5：拆單建議卡
為 T0261-T0264 各寫一張範圍細則卡。**遇設計分支可用互動模式問塔台**（如「server 模式要不要含 Electron renderer」）。

### Step 6：T0265 彙整建議
寫 200-300 字 scope 草稿。

### Step 7：填寫回報區
所有結論彙整到本工單下方「回報」區段。**禁止寫入其他任何檔案**。

---

## AC（acceptance criteria）

- **AC1**：BAT remote server 架構摘要完成（300-500 字 + 三分類標記）
- **AC2**：PLAN-018 差距清單完成（5-10 條，每條 1-2 行）
- **AC3**：Topology 分類矩陣完整填寫（7 維度 × 4 環境 = 28 格全填）
- **AC4**：T0261-T0264 拆單建議卡 4 張全寫（每張含 scope / out-of-scope / affects_files / estimate / 互動旗標 / 依賴）
- **AC5**：T0265 彙整建議完成（200-300 字 scope 草稿）
- **AC6**：working tree 在工單結束時 vs 起點 byte-identical（除本工單檔回報區）
- **AC7**（選填，互動允許下）：若遇 BAT 設計分支需塔台拍板，已用互動模式問過並記錄於「互動紀錄」區段

---

## 嚴格禁止

- ❌ 寫入除本工單回報區以外的任何檔案（含 spec 文件、PLAN-007 本身、`_tower-state.md`、`_decision-log.md`、其他工單檔）
- ❌ 對 4 個目標環境本身下技術結論（那是 T0261-T0264 各自的事）
- ❌ 跑 `npm install` / `npm run build` / 啟動 dev server
- ❌ 修改任何 source code、設定檔、`package.json`
- ❌ 直接草擬 T0261-T0264 的完整工單檔（只寫範圍細則卡，工單由塔台寫）
- ❌ 跨工單決策（PLAN-007 該怎麼拆、MVP 哪個先 → 回塔台）

---

## 互動模式提示

**enabled**。預期可能的提問場景：

1. 「server 模式應該包含 Electron renderer 還是 headless」— 設計取捨，看你心中的 BAT remote 架構偏好
2. 「Docker image 應該打 dev base 還是 minimal runtime」— 影響 T0262 的 scope
3. 「SSH 部署是否要 cover Windows OpenSSH server 端」— 影響 T0264 的 scope
4. 「WSL 部署是否需要研究 WSL1 vs WSL2 差異」— 影響 T0263 的 scope

每次提問上限 3 題（依 `research_max_questions: 3` 預設）。若無分支可逕行給出建議方案 + 理由。

---

## 回報

### 互動紀錄

無。執行過程中所有設計分支（互動模式提示中列舉的 4 個候選問題）皆有足夠 context 直接給出建議方案 + 理由，未觸發塔台提問。決策一律寫入下方 Step 5 拆單建議卡的 scope / out-of-scope。

### Step 1 — 環境快照

- `git status`：working tree 乾淨；唯一未追蹤檔為本工單 `_ct-workorders/T0260-research-plan007-remote-server-scoping.md`（建立時即未 commit）
- `git log --oneline -10` HEAD：`bcb2e3d chore(tower-state): session 26 exit snapshot`
- 起點 HEAD 記錄：`bcb2e3d`

### Step 2 — BAT remote server 現狀盤點

#### 架構摘要

PLAN-018 已把 BAT remote 拆成 4 個正交層次：

1. **Transport 層**（`electron/remote/remote-server.ts` 480 行 + `remote-client.ts` 329 行）：以 `https.createServer({cert, key})` + `WebSocketServer({server})` 撐 `wss://` upgrade；client 端走 `WebSocket(url, {rejectUnauthorized: false})` + `getPeerCertificate().fingerprint256` 自手動 TOFU 驗證。auth handshake 用單一 token frame（5s timeout、per-IP brute-force ban：5 fails / 60s → 10min），auth 後才允許其他 frame；每 30s 從 server 發 ping，閒置連線靠此偵測；`maxPayload` 32MB 上限。
2. **應用協定層**（`protocol.ts` 69 行 + `handler-registry.ts` 21 行 + `broadcast-hub.ts` 9 行）：定義 `RemoteFrame` 型別（invoke / invoke-result / event / auth / ping），`PROXIED_CHANNELS` 列舉約 90 條可代理的 IPC channel（涵蓋 pty / claude / git / fs / profile / settings / snippet / workspace / terminal-notify），`PROXIED_EVENTS` 列舉 host→client 推播事件。`broadcastHub` 是 host 端 EventEmitter，把任何本機 `webContents.send` 同時 mirror 給已連線的遠端 client。
3. **安全儲存層**（`certificate.ts` 121 行 + `secrets.ts` 99 行 + `tunnel-manager.ts` 63 行）：自簽憑證（10 年期、SAN 含 `localhost`/`127.0.0.1`/`::1`，selfsigned v5 async API），存於 `userData/server-cert.json`，90 天內自動 regen；token 走 Electron `safeStorage`（DPAPI / Keychain），Linux 無 keychain fallback plaintext + warn。`tunnel-manager` 只負責列出本機 IPv4（Tailscale 100.x 優先，其餘 LAN）並組 `wss://` URL。
4. **整合層**（`electron/main.ts:420` 起、`electron/pty-manager.ts:432/489/564`）：T0129 在 startup 自動 `remoteServer.start()`；PtyManager 透過 `getRemoteServerInfo` callback 在每個 PTY spawn 時注入 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`，這是 BAT 內部終端能 self-loop 連回 host 的關鍵橋樑。

#### 元件三分類標記

| 元件 | 路徑 | 分類 | 備註 |
|------|------|------|------|
| `RemoteServer` (wss + auth + brute-force) | `electron/remote/remote-server.ts` | **可遠端化** | 純 Node + ws，不依賴 Electron renderer |
| `RemoteClient` (TOFU + reconnect) | `electron/remote/remote-client.ts` | **可遠端化** | 但需要 `BrowserWindow` 注入做 event forward —— 可改 callback interface |
| `certificate.ts` (selfsigned) | `electron/remote/certificate.ts` | **可遠端化** | 純 fs + crypto + selfsigned；任何 Node 環境皆可 |
| `secrets.ts` (safeStorage) | `electron/remote/secrets.ts` | **host-bound** | `safeStorage` 是 Electron API，headless server 必須改走 OS keychain 直連或降級 plaintext |
| `tunnel-manager.ts` | `electron/remote/tunnel-manager.ts` | **transport-only** | 純 `os.networkInterfaces`，無狀態 |
| `protocol.ts` / `handler-registry.ts` / `broadcast-hub.ts` | `electron/remote/` | **transport-only** | 純型別 + EventEmitter |
| `PtyManager` (`@lydell/node-pty`) | `electron/pty-manager.ts` | **可遠端化** | node-pty 是 Linux/macOS/Windows 各有 native binary，跨 OS 部署需重編 |
| Terminal Server (forked Node) | `electron/terminal-server.ts` + `terminal-server/` | **可遠端化** | 已是獨立 Node process，搬到容器最自然 |
| `claude-runtime-router` | `electron/claude-runtime-router.ts` | **host-bound 部分** | 讀 `app.getPath('userData')` settings.json + 用 `app.isPackaged` 判路徑；server 化要拆 `app.*` 依賴 |
| `claude-agent-manager` (Agent SDK 子行程) | `electron/claude-agent-manager.ts` | **可遠端化** | 子行程透過繼承 env 注入 `DISABLE_AUTOUPDATER=1`；server 端要保證 `claude` binary 存在 |
| `voice-handler` (whisper-node-addon) | `electron/voice-handler.ts` | **host-bound** | `@kutalia/whisper-node-addon` 是 client 端 UX，不需要遠端化 |
| `better-sqlite3` (snippet-db) | `electron/snippet-db.ts` | **可遠端化** | native module，server 端需 rebuild ABI |
| `@img/sharp` (image processing) | `electron/image-utils.ts` | **可遠端化** | platform-specific binary，跨 OS 部署需重編 |
| BrowserWindow / renderer / Magic / Settings UI | `src/`、`electron/window-registry.ts` | **host-bound (client only)** | client 必須是 Electron + Chromium，無法 headless 化 |
| `update-checker` | `electron/update-checker.ts` | **host-bound (client only)** | 自動更新只對 client BAT 有意義 |
| `tray` / `system:resume` / GPU detection | `electron/main.ts`、`gpu-detector.ts` | **host-bound (client only)** | OS UX，不需遠端 |

**結論**：BAT 的 client/server 拆分基底已經七成完成 —— transport / 應用協定 / certificate 都是 OS-agnostic 純 Node；真正需要重構的只有「`safeStorage` 依賴」與「`app.*` 路徑依賴」兩處，其餘是 packaging（native module per-OS rebuild）的工程議題。

### Step 3 — PLAN-018 差距清單

1. **Multi-client 支援不完整**：`RemoteServer.clients: Map<WebSocket, AuthenticatedClient>` 結構支援多個 client，但 PROXIED_EVENTS 廣播是「fan-out 給所有 authenticated clients」 —— 沒有 per-client filter；多個 client 同時連線時，A 看到 B 的 PTY output、claude stream，**會洩漏 session 隔離邊界**。
2. **Reconnect / heartbeat 半完成**：client 端 `computeReconnectDelay` 已實作 exponential backoff + jitter（base 1s、max 30s）；server 端 30s `ws.ping()` 也有；**但 client 沒實作 pong-timeout 偵測**，server 死鎖（不 close）時 client 會卡在「假連線」狀態。
3. **TLS 憑證自動 renew 路徑未驗證**：`loadOrCreateServerCertificate` 寫了 90 天前 regen 的邏輯，但 server 起來後不會中途偵測「now 距離 expiresAt 小於 threshold」，僅在 startup load 時檢查 —— **長時間運行（月～年）的 server 不會自動 renew**，要重啟才觸發。
4. **Token rotation 缺失**：`server-token.json` 只在初次或顯式 `start(port, token)` 帶入新 token 時更新；沒有定期輪替機制，洩漏後須手動清除檔案重啟。
5. **Server 仍綁 Electron main process**：`remote-server.ts` 自身只用 `ws` + `https` + `crypto` + `os`（無 Electron 依賴），但**啟動入口在 `electron/main.ts`** 與 `BrowserWindow` lifecycle 綁定；headless server mode 需要拆出獨立 entry。
6. **`safeStorage` 依賴讓 headless 困難**：`secrets.ts` 直接 `import { safeStorage } from 'electron'`，server 在無 Electron runtime 時整檔 import 失敗；headless 部署必須抽介面。
7. **bind-interface 三選項對容器/SSH 不夠**：`localhost` / `tailscale` / `all` 缺「特定網卡 by name」（容器需 `eth0` only）與「Unix domain socket」（SSH tunnel 最自然路徑）。
8. **certificate SAN 缺遠端 hostname**：自簽憑證 SAN 寫死 `localhost` / `127.0.0.1` / `::1`，遠端透過 IP（如 Tailscale 100.x）連線時 fingerprint pin 雖然可過，但若日後改 hostname-based CN 驗證會失效。
9. **`broadcastHub.on('broadcast', listener)` 沒有 leak 檢查**：每個 RemoteServer instance 註冊一個 listener，多次 start/stop 若 listener 沒清乾淨會累積（程式碼有 off 但缺整合測試）。
10. **TLS handshake 失敗的錯誤回報粗糙**：`recovered.restartError` 只在 hot-switch port 失敗回報，client 端 fingerprint mismatch / cert expired 都統一報 `errorCode: 'fingerprint-mismatch'`，使用者難分辨「是不是該重新 pin」。

### Step 4 — Topology 分類矩陣

| 維度 | BAT-remote 強化（T0261） | Docker（T0262） | WSL（T0263） | SSH（T0264） |
|------|------------------------|----------------|--------------|--------------|
| **Transport 差異** | 沿用 wss + TOFU；補 multi-client 隔離 / pong-timeout / token rotation | wss 不變；新增「container-internal port」vs「host-published port」雙層映射 | wss 不變；走 `localhost` bind 即可（WSL2 mirrored mode 自動 forward） | wss **可改走 SSH local-forward `-L 9876:localhost:9876`**；或保留 wss 直連走 SSH host network |
| **Host OS 差異** | 同 OS（client/server 同台或同 LAN） | server 進 Linux container（image base：`node:20-bookworm-slim` / Alpine 評估）；client 仍跨 OS | server 在 WSL2 (Linux)；client 在 Windows | server 多元（Linux server / macOS dev box / Windows OpenSSH server）；client 跨 OS |
| **Packaging 差異** | 無新需求 | 需做 Dockerfile + image build pipeline；node-pty / better-sqlite3 / sharp 必須在 Linux base 重 build native | 沿用 Linux build（npm install on WSL）；`@lydell/node-pty-linux-x64` 在 WSL2 內建可用 | 需要在遠端 server 上手動 install BAT server bundle（npm tarball / git clone + build），無正式 release artifact |
| **Native module 影響** | 無 | **高** —— `@kutalia/whisper-node-addon`、`@lydell/node-pty`、`@img/sharp`、`better-sqlite3` 全要 Linux ABI；whisper-node-addon 在 server 端可省略（語音是 client UX） | 中 —— WSL Ubuntu/Debian 與 packaged Linux build 差異不大，pre-built `@lydell/node-pty-linux-x64` 應可直接跑 | **高** —— 跨 OS / arch（Linux x64、Linux arm64、macOS arm64、Windows）對 server 端要全部 cover |
| **GUI 需求** | client 端必有 GUI；server 端目前 piggyback Electron main，可演化為 headless | server 必須 **headless**（容器無 X server）→ 強制 `safeStorage` 抽象 + 拆 `app.*` 依賴 | server 可選 headless；多數使用情境是 WSL 純 backend，BAT GUI 在 Windows | server 必須 headless；client 端 BAT GUI 透過 SSH tunnel 連 wss |
| **既有元件可重用度** | **極高**（純強化）；`remote-server.ts` / `remote-client.ts` / `certificate.ts` 不動 | **高**：transport 層不動，packaging 層全新 | **極高**：與 BAT-remote 強化幾乎 1:1，差異僅 path 映射 | **高**：transport 不動，僅多一層 SSH tunnel 抽象 |
| **新增複雜度估計** | **低**（補強既有，10 條差距清單分批做） | **中-高**（Dockerfile + headless mode + native rebuild + image size 控制） | **低-中**（路徑映射是主要工作，Win↔Linux path translation 要在 client/server 兩端對稱） | **中**（多 OS server build artifact + SSH tunnel UX + key 管理） |

**共通可抽象維度**（4 環境共用，應集中處理）：
- Transport 層（wss + TOFU + token + brute-force + heartbeat） — T0261 範圍
- Headless server entry（拆 `app.*` 依賴 + `safeStorage` 抽象） — T0261 範圍，是 T0262/T0264 前置
- Multi-client session 隔離（per-client event filter） — T0261 範圍

**每環境必須個別處理維度**：
- Native module per-OS/arch build pipeline（T0262 / T0264 各自）
- Path 映射（T0263 Win↔Linux 為主，T0264 跨 OS path 也要看）
- Server 啟動 / 部署 UX（容器 `docker run` / WSL `wsl --exec` / SSH `ssh && bat-server`）
- Discovery / pairing UX（QR / clipboard / 已知 host 列表）

### Step 5 — 拆單建議卡

#### T0261 BAT-remote 強化 — 範圍細則

**scope（要做什麼）**：
1. Multi-client session 隔離 —— per-client event filter，避免 A 看到 B 的 PTY output 與 claude stream
2. Heartbeat 雙向 timeout —— client 端 pong-timeout 偵測，假連線狀態自動重連
3. Certificate 中途自動 renew —— server 起來後定期檢查 expiresAt，距 90 天觸發 in-place regen + reload（涉及通知 client 重新 TOFU pin 的 UX）
4. Token rotation —— 定時輪替策略（手動觸發 + 過期門檻），含舊 token grace period
5. Headless server entry 抽象 —— 拆 `electron/remote/remote-server.ts` 對 `electron` package 的依賴，新建 `electron/remote/server-entry-headless.ts` 純 Node 入口（為 T0262/T0264 鋪路）
6. `safeStorage` 介面抽象 —— `secrets.ts` 改為 strategy pattern（Electron / OS-keychain / plaintext），讓 headless mode 不被 Electron import 卡住
7. bind-interface 擴充 —— 新增「by interface name」與「Unix domain socket」兩選項，覆蓋容器與 SSH 場景
8. 錯誤分類細化 —— TLS handshake 失敗區分 cert-expired / fingerprint-mismatch / handshake-protocol，UI 給差異化建議

**out-of-scope（不做什麼）**：
1. 不做 packaging（容器 / WSL / SSH 都是其他工單）
2. 不動 PROXIED_CHANNELS 列表
3. 不做 client UX 重設計（fingerprint pin / token rotation 的 UI 細節留給 PLAN-007 後期）
4. 不引入新依賴（除非 strategy pattern 抽象需要）

**affects_files 預估**：
- 必讀：`electron/remote/remote-server.ts`、`remote-client.ts`、`certificate.ts`、`secrets.ts`、`broadcast-hub.ts`、`protocol.ts`、`electron/main.ts`（420-489 區段）
- 不需讀：UI components、agent-runtime/、git/、terminal-server/

**estimate**：M（10-14h）；wall time 1-2 個工作日
**互動旗標建議**：enabled（headless 抽象的介面設計會有取捨，例如「是否保留向下相容單一 `Secrets` 物件」可能要拍板）
**依賴**：無（4 張中最先做，是其他 3 張的前置）

#### T0262 Docker 部署 — 範圍細則

**scope（要做什麼）**：
1. Dockerfile 設計 —— base image 選型（推薦 `node:20-bookworm-slim`，理由：whisper / sharp / node-pty 皆有 prebuilt linux-x64 binary 且 glibc 版本足夠；Alpine musl 會踩 native module 不相容的雷）
2. Image build pipeline —— multi-stage（builder + runner）以縮小 final image；evaluate runtime 是否要含 `claude` CLI（embedded vs system，依 PLAN-027 的 runtime router 邏輯）
3. Native module 跨 arch 策略 —— linux-x64 / linux-arm64 雙 image vs single multi-arch
4. Volume / port mapping 設計 —— `userData` 應該 mount host volume 還是 named volume？token / cert 持久化策略
5. Container-internal port vs host-published port 雙層映射對 client connect URL 的影響
6. 安全考量 —— 容器跑 root 還是 non-root user？claude / claude-agent-sdk 對檔案權限的假設盤點
7. 健康檢查 —— `HEALTHCHECK` 該用 wss probe 還是 http endpoint
8. 啟動 UX —— `docker run -p 9876:9876 -v bat-data:/data ghcr.io/.../bat-server`，token 怎麼傳給 client（env / file / stdout）

**out-of-scope（不做什麼）**：
1. 不做 docker-compose 範例（單 image 為主，compose 是後續 enhancement）
2. 不做 k8s / swarm 部署
3. 不動 BAT GUI 端 client 邏輯（client 跨 OS 連同一個 Linux server image 是基本前提）
4. 不研究 Podman / containerd 替代

**affects_files 預估**：
- 必讀：`package.json` (build / asarUnpack / extraResources)、`electron/main.ts` (startup 流程)、`electron/terminal-server.ts`、`electron/voice-handler.ts`（whisper 是否要剝離）
- 不需讀：UI components、git/、agent-runtime 內部

**estimate**：L（14-20h）；wall time 2-3 個工作日
**互動旗標建議**：enabled（base image / native module 策略 / 雙 arch 與否，這些設計分支需要拍板）
**依賴**：T0261 headless entry 完成後才能做（否則 server 進不了容器）

#### T0263 WSL 部署 — 範圍細則

**scope（要做什麼）**：
1. WSL2 內 BAT server 啟動方式 —— `wsl -d Ubuntu -e node /path/bat-server.mjs` vs WSL 內手動 `npm start`
2. localhost loopback 行為 —— WSL2 mirrored mode（Win 11 23H2+）vs NAT mode 對 `127.0.0.1:9876` bind 的影響
3. Win↔Linux path 映射 —— BAT client（Windows）開 `C:\foo` 路徑，server（WSL Linux）需翻成 `/mnt/c/foo`；反向 server 回傳 `/home/user/proj` 給 client 也要轉成 `\\wsl$\Ubuntu\home\user\proj` 或 `\\wsl.localhost\Ubuntu\...`
4. PTY shell 預設 —— bash vs zsh，環境變數繼承策略
5. WSL1 vs WSL2 是否都要 cover —— **建議僅 WSL2**（WSL1 的 socket 行為與 native module 限制太多，YAGNI）
6. claude CLI 安裝路徑 —— WSL Linux 內裝 `~/.local/bin/claude`（anthropic installer），與 Windows BAT 內嵌的 `claude.exe` 互不衝突
7. 開機自動啟動 —— WSL `--exec` + Windows scheduled task 還是純手動

**out-of-scope（不做什麼）**：
1. 不研究 WSL1（如上）
2. 不做 GUI（WSL 內不裝 Electron，純 server）
3. 不做 GPU passthrough / CUDA on WSL2（與 PLAN-007 無關）

**affects_files 預估**：
- 必讀：`electron/path-guard.ts`（如存在；T0183 產物）、`electron/remote/remote-server.ts`、`electron/pty-manager.ts`（path resolve）、profile 相關 UI（path input 的 placeholder UX）
- 不需讀：claude-agent-manager 細節（只要 server 能 spawn）

**estimate**：M（8-12h）；wall time 1-2 個工作日
**互動旗標建議**：enabled（path 映射策略對使用者體驗影響大，需確認預期 UX）
**依賴**：T0261 headless entry；可與 T0262 並行（兩者皆是 Linux server）

#### T0264 SSH 部署 — 範圍細則

**scope（要做什麼）**：
1. SSH tunnel 路徑選型 —— **推薦 `ssh -L`**（client 端建立 local-forward 9876→remote 9876），避開 wss 直曝公網；備案：wss 直連走 SSH host network（適合 Tailscale 已有的場景）
2. 遠端 server bundle 安裝方式 —— git clone + `npm install` + `npm run build:headless`（依賴 T0261 headless entry）vs 預先打 npm tarball 上傳
3. 跨 OS server 支援矩陣 —— Linux x64（VPS 主流）/ Linux arm64（Raspberry Pi、AWS Graviton）/ macOS arm64（dev box）/ Windows OpenSSH server（**建議排除，OpenSSH on Win 對 PTY 支援差，YAGNI**）
4. SSH key 管理 UX —— BAT 是否內嵌 ssh-agent 整合，或讓使用者用 OS 既有 ssh config（推薦後者，less moving parts）
5. Profile 設定欄位 —— host / user / port / identity-file / forward-port，QR pairing 在此模式下無意義（SSH 已建立信任鏈）
6. Reconnect 行為 —— SSH tunnel 斷掉時 client 端是否自動 `ssh -R` 重建？
7. VS Code Remote SSH 比對 —— 寫 1-2 段比較，為什麼 BAT 不直接複用 vscode-server 模式（保留 BAT 自己的 transport）

**out-of-scope（不做什麼）**：
1. 不研究 Windows OpenSSH server 端（如上 YAGNI）
2. 不研究 Mosh / SSH3
3. 不做 SSH key 內建 keygen UI（用 OS 既有）
4. 不做 jump host / bastion 多跳

**affects_files 預估**：
- 必讀：`electron/remote/remote-client.ts`（tunnel mode 抽象插入點）、profile 相關 UI、`electron/main.ts` (remote-connect handler)
- 不需讀：certificate / secrets（SSH 信任鏈接管 TLS 信任）

**estimate**：L（12-16h）；wall time 2 個工作日
**互動旗標建議**：enabled（tunnel 路徑選型 / 跨 OS server 支援矩陣是策略決定）
**依賴**：T0261 headless entry；T0262 / T0263 結論可參考但不阻塞

### Step 6 — T0265 彙整建議

**T0265 scope 草稿**（200-300 字）：

T0265 為 PLAN-007 Phase A 可行性研究的彙整工單，整合 T0261-T0264 四份結論，產出單一 spec 文件 `_spec-remote-dev-support-2026-04.md`，作為 PLAN-007 從 💡 IDEA → 📋 PLANNED 的拍板依據。

文件結構建議分三段：

**第一段：跨環境共通章節**（取自 T0261 結論）—— headless server entry 抽象介面、`safeStorage` strategy pattern、multi-client session 隔離、heartbeat 雙向 timeout、certificate 自動 renew、bind-interface 擴充選項。這些是所有 4 個環境的共同地基，**T0261 完成後其他 3 環境才能起跑**。

**第二段：各環境獨立章節**（每環境一節）—— 依 T0262/T0263/T0264 結論寫 packaging / 啟動 UX / native module / path 映射等差異點，每節結尾附「該環境的 MVP 切片」（最小可動 demo 所需的子集）。

**第三段：MVP 路徑與拆單建議**—— 推薦 MVP 順序為 T0263 (WSL) → T0262 (Docker) → T0264 (SSH)，理由：WSL 風險最低（與 T0261 強化幾乎共用 codebase）、Docker 是社群最高需求、SSH 涉及最多跨 OS / 安全議題故壓最後。文件須明列每環境的「子工單拆解原則」（依 native module / packaging / UX 三軸），讓塔台後續開實作工單有依據。**T0265 不對任何技術選型下最終定論**——所有選型已在 T0261-T0264 各自決定，T0265 僅做彙整與 MVP 順序拍板。

### 給塔台的下一步建議

**拆單順序建議**：

不建議「4 張完全平行」。最佳順序：

1. **T0261 先做完**（M, 10-14h）—— headless entry + `safeStorage` 抽象是其他 3 張的硬前置，平行做會踩到「介面還沒定」的反覆 rebase。
2. **T0263 (WSL) + T0262 (Docker) 平行**（兩者皆是 Linux server，差異在 packaging）—— 同時開可以互相驗證 headless entry 抽象是否漏設計。
3. **T0264 (SSH) 最後**（依賴前面成果，且涉及最多跨 OS server build artifact）。

或者保守一點：T0261 → T0263 → T0262 → T0264 序列（風險最低、context 切換最少）。

**風險提醒**：

- **T0262 風險最高**：native module 跨 arch + image size 控制 + base image 選型有「踩雷重來」風險；whisper-node-addon 若無法在 Alpine 跑就會卡關（已建議 bookworm-slim 規避）。
- **T0264 結論最不確定**：SSH tunnel 路徑選型（local-forward vs 直連）會強烈影響 client UX；跨 OS server build artifact 的維護成本估計不準。
- **T0261 風險最低**：純強化現有 PLAN-018 codebase，10 條差距獨立可驗證。

**可能延伸出新 PLAN / EXP 的早期訊號**：

- **PLAN-XXX「BAT server multi-arch release pipeline」**：T0262 + T0264 完成後，npm tarball / Docker image / SSH bundle 三種發佈通道會浮出來，需要獨立 release 工程化。
- **EXP「Headless BAT server feasibility spike」**：若 T0261 拆 `app.*` 依賴比預期困難，可開 EXP 確認可行性再決定要不要繼續 PLAN-007。
- **PLAN-XXX「Profile remote pairing UX 重設計」**：multi-environment profile 列表（local / WSL / docker / SSH）會讓現有 ProfilePanel UI 不夠用。

### 收尾 commit
- 工單元資料：IN_PROGRESS → DONE，填完成時間
- commit hash：（待填）
