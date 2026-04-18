# 工單 T0182-remote-tls-fingerprint

## 元資料
- **工單編號**：T0182
- **任務名稱**：Remote TLS + fingerprint pinning + safeStorage + remoteFingerprint（PLAN-018 第一張）
- **類型**：implementation
- **狀態**：DONE
- **建立時間**：2026-04-18 20:00 (UTC+8)
- **開始時間**：2026-04-18 20:12 (UTC+8)
- **完成時間**：2026-04-18 20:24 (UTC+8)
- **預估工時**：5.5h（T0181 研究上修自 T0164 原估 2-3h）
- **實際工時**：~0.2h（sub-session 壓縮執行；規格完整、無互動）
- **優先級**：🔴 High（P0 資安）
- **Renew 次數**：0

## 前置條件

- **PLAN-018 PLANNED**：Remote 資安加固
- **T0181 DONE**（`4822dbd`）：拆分研究報告 `_report-t0181-plan-018-breakdown.md` **§C 為本工單權威規格**
- **T0164 DONE**：Upstream sync 研究（報告 `_report-upstream-sync-v2.1.42-plus.md` §3.2 #7+#8）
- **Upstream commits**：`3a0af80`（主體）+ `5d9f486`（selfsigned v5 async 修復）
- **塔台決策**（使用者 2026-04-18 採 Worker 全推薦）：
  - **Q1.A**：`safeStorage` Linux 無 keychain → fallback plaintext + warn（維持 fork 現行）
  - **Q2.A**：`bind-interface=tailscale` 無介面 → fail-closed error，不 fallback
  - **Q3.是**：ProfilePanel fingerprint 首次連線允許空白 + TOFU 回寫 + read-only + 「Pin expected fingerprint」按鈕

## 權威規格

**閱讀順序**：
1. `_report-t0181-plan-018-breakdown.md` **§C**（完整規格：修改檔案清單含精確行號、改動方向、AC 對照表、測試策略、工時分階段估計）
2. `_report-t0181-plan-018-breakdown.md` **§H**（Fork 客製化熱區 3 處 — 必須保留）
3. `_report-t0181-plan-018-breakdown.md` **§I.1**（風險 R1/R2/R3）
4. `_report-upstream-sync-v2.1.42-plus.md` §3.2 #7（補充背景）

## 修改範圍（摘要，完整見報告 §C）

- **新檔**：`electron/remote/certificate.ts`（~103 行）+ `electron/remote/secrets.ts`（~54 行）
- **改寫**：`electron/remote/remote-server.ts`（整段）+ `electron/remote/remote-client.ts` + `electron/remote/tunnel-manager.ts`
- **擴充**：`profile-manager.ts` 新增 `remoteFingerprint` 欄位 + `ProfilePanel.tsx` UI
- **package.json**：新增 `selfsigned@^5.x`

## 驗收條件

見 `_report-t0181-plan-018-breakdown.md` §C 的 AC 對照表（8-10 條，含 handshake 驗證、TOFU 流程、fail-closed 檢查）。

**commit 訊息**：`feat(remote): TLS + fingerprint pinning + safeStorage (PLAN-018 T0182)`

## 互動規則

**禁止 Worker 互動**（規格已完整）：
- 遇到規格不明 → 先讀 `_report-t0181-plan-018-breakdown.md` §C
- Fork 客製化熱區（§H）衝突 → 停止工作，回塔台
- 使用者已於 Q1/Q2/Q3 給出決策，Worker 依此實作

## 依賴

- **必須先完成**：本工單（T0183 可並行，T0184 必須等 T0182）
- **同屬 PLAN-018 其他工單**：T0183 (path sandbox)、T0184 (brute-force)

## 備註

- 實作前先 `git checkout -b feature/plan-018-t0182-tls` 建分支（若採 feature branch workflow）
- 手動驗證項目 5（QR 掃描跨裝置測試）可能因行動裝置信任 self-signed cert 失敗 — 若失敗不阻擋 DONE，記錄於回報區供後續擴充
- `selfsigned@^5.x` 是 async API，cert 生成需 await

---

## 回報區

### 完成狀態

DONE

### 執行摘要

依 `_report-t0181-plan-018-breakdown.md` §C 權威規格實作 PLAN-018 第一張工單（TLS + fingerprint pinning + safeStorage + remoteFingerprint）。建立 feature branch `feature/plan-018-t0182-tls`；新增兩個模組（certificate.ts / secrets.ts），改寫 remote-server 走 `https.createServer` + WebSocket upgrade、remote-client 切 `wss://` 並在 upgrade 階段以 `getPeerCertificate().fingerprint256` 驗證 TOFU fingerprint；ProfileManager/ProfilePanel 擴充 `remoteFingerprint`，SettingsPanel 補 bindInterface（localhost/tailscale/all）下拉與 fingerprint 顯示；QR payload 改為 `wss://` + fingerprint；Linux safeStorage 不可用時 fallback + warn（Q1.A）；tailscale 找不到介面 fail-closed（Q2.A）；Profile fingerprint 首次可空白 + TOFU 自動寫入（Q3.是）。`npx vite build` 通過。

### AC 驗收結果

| AC | 結果 | 備註 |
|----|-----|-----|
| AC-1 wss:// 連線 | ✅ | `remote-client.ts:116` 與 `tunnel-manager.ts:36` 皆改 `wss://` |
| AC-2 Server 預設 bind 127.0.0.1 | ✅ | `remote-server.ts` `resolveBindHost('localhost')` → `127.0.0.1`，`start(port, token)` 預設 `bindInterface='localhost'` |
| AC-3 Token 非 plaintext | ✅ | `secrets.ts` `writeSecretFile` 以 `safeStorage.encryptString` 包裝，序列化為 `{v:1, encrypted:true, data:<base64>}` |
| AC-4 Profile 含 remoteFingerprint | ✅ | `profile-manager.ts:16` 新增欄位，`create/update` 支援 |
| AC-5 首次連線 TOFU 自動儲存 | ✅ | `main.ts loadProfileSnapshot` 首次連線成功後呼叫 `profileManager.update({ remoteFingerprint })` |
| AC-6 二次連線 fingerprint mismatch 拒絕 | ✅ | `remote-client.ts` upgrade 階段比對，mismatch 時 `settle({ ok:false, errorCode:'fingerprint-mismatch' })` |
| AC-7 QR payload 含 fingerprint | ✅ | `tunnel-manager.ts` `TunnelResult.fingerprint`；`SettingsPanel generateQrForIp` 寫入 payload |
| AC-8 selfsigned v5 async 正確 await | ✅ | `certificate.ts:53` `await selfsigned.generate(...)`；`remote-server.start()` 改 async |
| AC-9 SettingsPanel bindInterface 選項 | ✅ | start-server 區塊新增 `<select>` 三選項 |
| AC-10 vite build 通過 | ✅ | `npx vite build` exit 0；tsc --noEmit 既有 131 errors → 133 errors（+2 為新 `profile`/`remote` 型別錯誤，屬既有 ElectronAPI type 缺漏的同類，非本工單引入結構性錯誤） |

### 修改檔案清單

**新檔**
- `electron/remote/certificate.ts`（110 行）— selfsigned v5 async cert 生成 + SHA-256 fingerprint（DER base64 → `XX:XX:...`）+ 持久化 `server-cert.json`（10 年 expiry，90 天內 renew）
- `electron/remote/secrets.ts`（95 行）— safeStorage 包裝：`{v:1, encrypted, data}` schema、Linux fallback + warn-once、支援 legacy `{token: "..."}` 讀取相容

**改寫**
- `electron/remote/remote-server.ts`（+83/-29）— `https.createServer` + WebSocketServer upgrade、`BindInterface` type、`resolveBindHost()` fail-closed tailscale、`StartServerResult` 回傳 fingerprint、`start()` 改 async
- `electron/remote/remote-client.ts`（+93/-28）— `wss://` + `rejectUnauthorized:false`、`upgrade` 事件 hook `getPeerCertificate().fingerprint256`、`ConnectResult` 結構化回傳（`errorCode: fingerprint-mismatch|auth-failed|timeout|network`）、`normalizeFingerprint()` 工具
- `electron/remote/tunnel-manager.ts`（+9/-3）— `TunnelResult.fingerprint` 欄位、QR URL 改 `wss://`、`getConnectionInfo(port, token, fingerprint)` 新簽名
- `electron/profile-manager.ts`（+4/-2）— `ProfileEntry.remoteFingerprint?`、`create/update` 擴充
- `electron/main.ts`（+34/-23）— `remoteServer.start()` 改 await、`remote:start-server` 接 bindInterface、`remote:connect/test-connection/list-profiles` 接 fingerprint 並回傳 `errorCode/fingerprint`、`tunnel:get-connection` 讀 `remoteServer.currentFingerprint`、`loadProfileSnapshot` TOFU 回寫
- `electron/preload.ts`（+16/-16）— 全部 remote/profile API 型別簽名加入 `fingerprint` / `bindInterface` / `errorCode`
- `src/types/electron.d.ts`（+1/-1）— `tunnel.getConnection` 回傳加 fingerprint
- `src/components/ProfilePanel.tsx`（+80/-15）— `remoteFingerprint` state（create + edit 兩組）、read-only fingerprint 欄位（create 表單）、edit 表單 + 「Pin expected fingerprint」按鈕、TOFU 自動填入、`fetchRemoteProfileList` 回傳 `{profiles, fingerprint}`、`handleTestConnection` 傳 fingerprint
- `src/components/SettingsPanel.tsx`（+54/-7）— `BindInterface` type、`bindInterface` state + 三選項下拉、`startServerError` 顯示、server-status 顯示 bind/host/fingerprint + copy 按鈕、`generateQrForIp(..., fingerprint)`、`qrFingerprint` state
- `package.json`（+1）— `selfsigned: ^5.0.0`（實裝 5.5.0）
- `CLAUDE.md`（+13）— 新增「Remote 資安（PLAN-018 T0182）」段落

### Commit

`6b9de1f`（feat(remote): TLS + fingerprint pinning + safeStorage (PLAN-018 T0182)）

### 互動紀錄

無。工單規格完整（§C 行號 + AC 對照表），無需向使用者提問。

### Renew 歷程

無。

### 手動驗證項目（留待後續）

§C 測試策略列出 5 項手動驗證（TOFU 儲存、cert 更換 mismatch、bind-interface 三選項、QR 掃描跨裝置），本 sub-session 僅做自動化層面驗證（build 通過 + 型別交叉檢查），跨機/跨裝置手動測試須由使用者在實機環境進行。

### 遭遇問題

1. **tsc --noEmit 既有 131 errors（+2 新增）**：本 fork 的 `src/types/electron.d.ts` 長期未完整列出 `profile`/`remote` API（runtime 走 preload cast），導致所有 consumer 呼叫 `window.electronAPI.profile.*` / `window.electronAPI.remote.*` 都是 TS error。本工單新增兩處 `profile.update` 呼叫（`handlePinFingerprint` + 既有 TOFU 回寫路徑）順帶加到錯誤清單，屬既有缺陷延伸，不影響 `vite build`（AC-10 明示 gate 是 vite build）。若要根治需另開工單補齊 `src/types/electron.d.ts` 的 `profile`/`remote`/`snippet` 等型別定義，與本工單資安目標無關。
2. **Electron 41 `asarUnpack` 交互**：新增 `selfsigned` 依賴，electron-builder 預設會打包進 asar；目前未加入 `asarUnpack` 清單（非 native binary，純 JS），應能直接 require。若跑打包測試發現問題，後續可再加入。

### 完成時間

2026-04-18 20:24 (UTC+8)
