# EXP-HEADLESS-001 — BAT remote server headless 啟動可行性 spike

## 元資料

| 欄位 | 內容 |
|------|------|
| **編號** | EXP-HEADLESS-001 |
| **TOPIC** | HEADLESS（BAT server headless 化系列） |
| **狀態** | ✅ CONCLUDED（2026-04-25，T0261 spike PASS） |
| **建立時間** | 2026-04-25 21:45 (UTC+8) |
| **驅動決策** | T0260 結論：BAT remote 拆分七成完成，唯二瓶頸是 `secrets.ts` 對 `safeStorage` 的 import 依賴 + `claude-runtime-router` 對 `app.*` 的依賴 |
| **關聯 PLAN** | PLAN-007（💡 IDEA → 待 spike + Phase A research 完成才升 PLANNED） |
| **關聯工單** | T0260（scoping，✅ DONE，commit `9e9d1dd`） |
| **後續規劃** | T0261-T0265 research 全部依賴 spike 結論 |

---

## 實驗假設

**BAT remote server（`electron/remote/remote-server.ts` + transport / protocol / certificate / handler-registry）能在純 Node.js 環境（無 Electron runtime）啟動 wss server、完成 TLS handshake、通過 token auth、accept 至少 1 個 client connection、回應至少 1 條 echo frame**。

若假設成立 → PLAN-007 整條路線（Docker / WSL / SSH 部署）有可行性錨點，T0261 research 可放心展開 headless 介面設計。

若假設不成立 → 必須拆 wss / 改 transport / 換架構，PLAN-007 重新評估。

---

## Worktree 建立

```bash
# 建議 worktree 命名
git worktree add ../bat-headless-spike -b exp/headless-server-spike

# 結果處理(依實驗結論)
# 成功(CONCLUDED)→ spike code 不合併主線(僅作為佐證),產出 spec 章節寫入 T0261
# 失敗(ABANDONED)→ 丟棄 worktree + 分支,主線零污染,PLAN-007 重新評估
```

**Spike code 不回主線**：本 EXP 目的是「證可行性」非「交付 production code」，PoC 結束後不論成功失敗都丟 worktree。產出物是 spec 章節（寫入 T0261 工單回報）+ 本工單的結論記錄。

---

## Phase 1 拆單計畫（1 張，極小 scope）

| 工單 | 類型 | Sizing | 範圍 |
|------|------|--------|------|
| **T-A**（待派發為 T####） | spike | M | worktree 建立 + 拆 `secrets.ts` strategy + 寫純 Node entry 腳本 + wss server 啟動 + 最小 echo client 測試 |

---

## 成功標準（CONCLUDED 條件）

**全部達成才標 CONCLUDED**：

- [ ] **AC1**：worktree 內以 `node` (非 electron) 跑起一支 entry 腳本，成功 listen on `127.0.0.1:9876` 並回 wss upgrade（`https.createServer + WebSocketServer`）
- [ ] **AC2**：自簽憑證 generate / load 不依賴 Electron API（`certificate.ts` 在 `selfsigned` v5 + `crypto` 即可跑）
- [ ] **AC3**：`secrets.ts` 抽出 strategy interface（至少含 `electron-safeStorage` 與 `plaintext-fallback` 兩實作），spike 用 plaintext 路徑，整檔不再 `import { safeStorage }`
- [ ] **AC4**：用 `node` entry 起 server 後，在同 worktree 用 `node` 跑一個極簡 client（重用 `remote-client.ts` 或自寫 ws client）完成：
  - TLS handshake（fingerprint TOFU）
  - token auth handshake
  - 收到 server 至少 1 個 ping frame（30s heartbeat 第一發）
  - 主動送出 1 條 echo invoke frame（不需要走完整 PROXIED_CHANNELS，找一個無 host-bound 依賴的 channel 或自加一個 echo handler 即可）
  - 收到 server 回 invoke-result
- [ ] **AC5**：上述全程 server 端 process tree **不含 Electron**（`ps -ef | grep electron` 為空，僅有 `node` process）
- [ ] **AC6**：本 EXP 工單回報區寫滿結論摘要（含 secrets.ts 拆分後的介面草圖、entry 腳本骨架、剩餘未解的 `app.*` 依賴清單）

---

## 失敗標準（ABANDONED 條件）

任一觸發即標 ABANDONED：

- **時間止損**：worktree 工作累計超過 **3 小時**仍無法跑通 AC1-AC4
- **架構止損**：發現 `remote-server.ts` 有未盤點的 Electron runtime 依賴（如 `webContents` / `ipcMain` 在熱路徑），抽不開
- **`broadcast-hub` 死結**：host→client event forward 強依賴 `webContents.send`，抽出後 PROXIED_EVENTS 整條鏈斷
- **多重 transitive dependency**：`secrets.ts` 拆解後發現 `protocol.ts` 或 `handler-registry.ts` 也偷偷 import `electron`，連鎖阻擋
- **Worker 主動申請**：在執行過程中發現「真要拿掉 Electron 依賴需要重構 ≥3 個非 remote/ 模組」，回塔台要求停止

---

## Out of scope（spike 不做）

- ❌ Multi-client 同連測試（T0261 強化階段才做）
- ❌ Cert renewal 中途檢查（T0261 強化階段才做）
- ❌ Token rotation（T0261 強化階段才做）
- ❌ PROXIED_CHANNELS 完整 90 條代理測試（只測 echo 1 條）
- ❌ PTY spawn / claude-agent-sdk 整合（純 transport 證可行）
- ❌ 跨 OS / 跨 arch 測試（spike 只在 Windows host 上跑 node 即可）
- ❌ Docker image build / WSL 部署（後續工單）
- ❌ Production-ready code（spike code 不回主線）

---

## 風險清單

| 風險 | 嚴重度 | 偵測 | 緩解 |
|------|-------|------|------|
| `safeStorage` 依賴比預期深（多檔 import） | 🟡 中 | grep `import.*safeStorage` 跨整個 `electron/` | 改用 strategy pattern，不去動非 remote/ 區域 |
| `app.getPath('userData')` 在 transport 層被偷用 | 🟡 中 | grep `app\.getPath` `app\.isPackaged` 跨 `electron/remote/` | 寫測試前先掃描，發現後抽介面或 hardcode worktree path |
| `broadcast-hub` 對 `webContents.send` 有強依賴 | 🟡 中 | 讀 `broadcast-hub.ts` 9 行 + 找呼叫點 | 抽 EventEmitter wrapper，spike 階段省略 host→client 推播 |
| `selfsigned@v5` async API 在純 Node 跑不起 | 🟢 低 | 直接呼叫 `await selfsigned.generate(...)` | 已知 PLAN-018 用 v5，主線在 Electron 跑得起，純 Node 應該 OK |
| `ws` package 與 `https.createServer` 在 Electron 41 / Node 24 ABI 差異 | 🟢 低 | spike 在 worktree `npm install` 後直跑 | Electron embedded Node 24 vs system Node 24 ABI 應一致 |

---

## T-A 工單 scope（待派發時編號為 T0261 或更後）

> 註：spike 工單編號將在派發時分配（T#### 序列）。目前 placeholder 為 T-A。實際派發時直接以下一個可用 T 編號（**T0261**）建立工單檔。

**任務目標**：
1. 建立 worktree `../bat-headless-spike`，分支 `exp/headless-server-spike`
2. 跑 `npm install` 確保 worktree 依賴可用（如 `npm ci` 跑不通可降級 `npm install`）
3. 拆 `electron/remote/secrets.ts` 為 strategy pattern：
   - 介面：`interface SecretStrategy { encrypt(plain: string): string; decrypt(encrypted: string): string; isAvailable(): boolean }`
   - 實作 1：`ElectronSafeStorageStrategy`（沿用現有 `safeStorage` 邏輯）
   - 實作 2：`PlaintextStrategy`（spike 用，附 warn log）
   - 工廠：根據 runtime 偵測（`typeof process.versions.electron === 'string'`）選 strategy
4. 寫一支 entry 腳本 `scripts/spike-headless-server.mjs`：
   - 純 Node ESM
   - 載入 `RemoteServer` + `PlaintextStrategy`
   - 起在 `127.0.0.1:9876`，token 寫死 `spike-token-12345`，hardcode worktree 路徑作為 `userData` 替代
   - 註冊一個 echo handler（`PROXIED_CHANNELS` 不夠就臨時加 `'spike:echo'`）
5. 寫一支 client 腳本 `scripts/spike-headless-client.mjs`：
   - 純 Node ESM
   - 連 `wss://127.0.0.1:9876`（`rejectUnauthorized: false` + 手動 fingerprint pin from server stdout）
   - auth with `spike-token-12345`
   - 等收到 1 個 ping
   - 送 `{type: 'invoke', channel: 'spike:echo', payload: 'hello'}`
   - 等收到 invoke-result，印出
   - exit
6. 整個 spike 在 worktree 執行兩支腳本驗證 AC1-AC5
7. 工單回報寫滿結論：
   - secrets.ts strategy 介面草圖（含程式碼片段）
   - entry / client 腳本骨架（含程式碼片段）
   - 過程踩到的雷（已解 / 未解）
   - 剩餘 `app.*` 依賴清單（`grep -r "app\.getPath\|app\.isPackaged" electron/remote/` + 跨層擴散範圍）
   - PoC 是否達成 AC1-AC5 各項

**互動模式**：enabled（spike 過程必然踩雷，遇分支可問塔台：「broadcast-hub 怎麼處理」「app.getPath 是 hardcode 還是抽 IConfig」這類取捨）

**affects_files**：
- worktree 內：新增 `scripts/spike-headless-server.mjs`、`scripts/spike-headless-client.mjs`、修改 `electron/remote/secrets.ts`（重構為 strategy）
- 主線（**禁止**寫入）：本 EXP 工單 `EXP-HEADLESS-001-*.md` 回報區、T-A 工單檔本身回報區

**禁止**：
- ❌ 在主線分支（`main`）做任何修改
- ❌ commit 到 main
- ❌ 動 `package.json` 主版本依賴
- ❌ 跨工單決策（PoC 失敗了下一步怎麼辦 → 回塔台）
- ❌ 修塔台 meta 檔（`_tower-state.md` / `_decision-log.md`）

**估時**：60-90 min wall time（worktree 建立 5 min + secrets 重構 15-20 min + entry/client 腳本 20-30 min + 跑通 + 寫回報 20 min）；硬性止損 3 小時

---

## 結論記錄（T0261 完成於 2026-04-25）

### CONCLUDED ✅

- [x] **AC1-AC6 全綠** + 可選 AC7、AC8 也達成（worktree commit `17ac525` on `exp/headless-server-spike`）
- [x] **secrets.ts strategy 介面草圖**：拆成 4 檔
  - `secrets-strategy.ts`（interface + `PersistedSecretV1` 型別）
  - `secrets-strategy-electron.ts`（`ElectronSafeStorageStrategy`，dynamic require + `process.versions.electron` 守門）
  - `secrets-strategy-plaintext.ts`（`PlaintextStrategy`，含 one-shot warn 開關）
  - `secrets.ts`（facade，公開 API 完全相容；新增 `setSecretStrategy` / `getSecretStrategy`）
- [x] **entry / client 腳本骨架**：`scripts/spike-headless-server.mjs` + `scripts/spike-headless-client.mjs`，均為純 ESM、tsx 跑（worktree 已有 tsx 4.21.0，免新增依賴）
- [x] **剩餘 `app.*` 依賴清單（remote/ 內，server-side）**：**0**
  - `electron/remote/` 整個 server 路徑只有 `secrets.ts` import electron（已重構）
  - `remote-server.ts:135` 的 `configDir` 是字串欄位，由 main.ts 從外部注入（headless 入口自帶 tmp dir 即可，無需動 server）
  - `remote-server.ts:375` 那行只是註解
  - **唯一 client-side 依賴**：`remote-client.ts` import `BrowserWindow`（**不在 server headless 範圍內**，PLAN-007 的 host 端議題另外處理）
- [x] **PoC code 處理**：丟在 `../bat-headless-spike` worktree（不回主線）
- [x] **下一步**：派 T0262 BAT-remote 強化 research，把 spike 經驗寫入 headless entry 介面設計 spec（要點見 T0261 回報區「給塔台的下一步建議」）

### ABANDONED 路徑

- 未觸發（spike 一次跑通，未踩到時間止損 / 架構止損 / 連鎖依賴 / Worker 申請任一條件）

---

## 給塔台的決策追蹤

- 本 EXP 通過 → 推 T0261 BAT-remote 強化研究 + headless 介面設計（spec only，不重構）
- 本 EXP 失敗 → 暫停 T0261-T0265 全部，開 T0261-alt 研究替代架構
- T-A 工單派發時 yolo 模式 + interactive enabled（spike 必然有設計分支）
- T-A 失敗或 PARTIAL 都觸發塔台 pause（D 模式 + yolo_max_retries: 1）
