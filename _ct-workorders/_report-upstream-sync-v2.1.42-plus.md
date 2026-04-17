# Upstream Sync Report: v2.1.42+ (T0164)

> 延續 PLAN-010（v2.1.3 → v2.1.42，188 commits 分析）— 本輪評估自 `lastSyncCommit = 8d23e6e`（2026-04-16）之後 upstream 新增的 13 個 commit。

- **調查日期**：2026-04-18
- **工單**：T0164（research，互動模式 enabled）
- **使用者決策**：Q1=A（#7 列為 Phase 2 移植、開獨立 PLAN）／Q2=B-or-C（#10 perf 不實作，報告列拆分方案備存）／Q3=B（詳細報告）

---

## 1. 總覽

| 項目 | 值 |
|---|---|
| 新 commit 數 | 13（扣除 2 merge 後實質 11 個）|
| Tag 跨度 | v2.1.42 → v2.1.46-pre.1（含 v2.1.43 / v2.1.44 / v2.1.45 / v2.1.41-pre.10）|
| 總檔案變更規模 | +1617 / -463（主要來自 #7 remote 資安加固 +1288/-285）|
| Fork 現況 | `version.json` 2.1.42-pre.2，SDK ^0.2.104、CLI ^2.1.97；`_ct-workorders/` 與 Electron 41 / builder 26 / vite 7 等升級屬 fork 專屬先行 |
| 總體建議 | **部分同步** — Phase 1 cherry-pick 3 包、Phase 2 獨立開 PLAN 移植 1 包、Phase 3 skip 4 包 |

### 1.1 Tag 時序

| Tag | commit | 時間 | 主題 |
|---|---|---|---|
| v2.1.42 | 357b868 | 2026-04-16 23:06 | Opus 4.7 + SDK/CLI 2.1.110 |
| v2.1.43 | e74e29c | 2026-04-16 23:12 | WorkerPanel TDZ fix |
| v2.1.44 | bdb14f7 (merge) | 2026-04-17 00:08 | merge main |
| v2.1.45 | 9c3daf8 | 2026-04-17 00:55 | re-add xhigh + SDK 2.1.111 |
| v2.1.41-pre.10 | 458d14e | 2026-04-17 15:24 | PTY/markdown/archive perf |
| v2.1.46-pre.1 | 5d9f486 | 2026-04-17 14:11 | selfsigned v5 async fix |
| (upstream/main) | 92c4dec | 2026-04-17 20:48 | worker PowerShell 相容 |

> 註：v2.1.41-pre.10 時序看似比 v2.1.45 晚，但 tag 編號較早 — 這是 upstream 同時維護兩條 tag 軌跡（release / pre-release）的自然現象。

---

## 2. 分類摘要

| 類別 | 數量 | Commit |
|---|---|---|
| **cherry-pick** | 3 | #1 Opus 4.7、#3 workspace:load fix、#4-6 EFFORT_LEVELS+xhigh 最終狀態（合成 9c3daf8）|
| **移植（port）** | 1 包（2 commit）| #7 + #8 remote 資安加固 |
| **skip** | 4 | #2 TDZ fix、#9 keychain harden、#10 perf、#11 PowerShell worker |
| **merge commits** | 2 | bdb14f7, 8b0671d（不計入）|

---

## 3. 逐 commit 分析

### 3.1 cherry-pick 類

---

#### 🟢 #1 — `357b868` v2.1.42：feat Opus 4.7 + SDK/CLI 2.1.110

- **類別**：cherry-pick
- **判準**：純功能新增，fork 目前無 Opus 4.7 支援，邏輯相容
- **衝突風險**：低
- **預估工時**：0.3h（僅檔案插入 + 版本驗證）

**檔案動向**：
| 檔案 | 變更內容 | Fork 衝突 |
|---|---|---|
| `electron/claude-agent-manager.ts` | `BAT_BUILTIN_MODELS` 陣列首插入兩項 `claude-opus-4-7` / `claude-opus-4-7[1m]` | 無 — fork line 19-21 即為 opus-4-6，直接前插 |
| `src/components/ClaudeAgentPanel.tsx` | `MODEL_PRICING` 加 `opus-4-7: P(5, 25)`；`getModelPricing` 加 `opus-4-7` if 檢查 | 無 — fork line 3511-3520 結構一致 |
| `package.json` | `@anthropic-ai/claude-agent-sdk` 0.2.104 → 0.2.110、`@anthropic-ai/claude-code` 2.1.104 → 2.1.110 | 需檢查 fork 目前版 `^0.2.104` / `^2.1.97`，建議直接升到 9c3daf8 的 `^0.2.111` / `^2.1.111`（合併 #6）|

**Diff 預覽**（`electron/claude-agent-manager.ts`）：

```diff
 const BAT_BUILTIN_MODELS: Array<{ value: string; displayName: string; description: string }> = [
+  { value: 'claude-opus-4-7',     displayName: 'Opus 4.7 (200k)',  description: 'claude-opus-4-7 · 200k context' },
+  { value: 'claude-opus-4-7[1m]', displayName: 'Opus 4.7 (1M)',   description: 'claude-opus-4-7 · 1M context · CLI recommended for better cache efficiency' },
   { value: 'claude-opus-4-6',     displayName: 'Opus 4.6 (200k)',  description: 'claude-opus-4-6 · 200k context' },
```

---

#### 🟢 #3 — `0bc3bc1`：fix(remote) workspace:load + window identity（PR #88）

- **類別**：cherry-pick
- **判準**：P0 bug 修復（remote client 連線後 UI 卡在歡迎頁、window title 錯亂）— fork 有完整 remote 架構，適用
- **衝突風險**：中（觸及 IPC handler registry、preload、App.tsx 初始化）
- **預估工時**：1.0h（含回歸測試）

**問題描述**（from upstream commit msg）：
1. **Bug A**：`workspace:save / workspace:load` handler 依賴 `ctx.windowId`，但 remote protocol 不轉發 → handler 早退返回 null → UI 空白
2. **Bug B**：`profile:list` 被 proxy 到 remote → 返回的是 host 的 profile list → renderer 找不到本機 local alias → window title fallback 到 "Default"、remote.connect 分支被跳過

**修復手法**：
| 檔案 | 變更 |
|---|---|
| `electron/main.ts` | 新增 `ALWAYS_LOCAL_CHANNELS = new Set(['workspace:save', 'workspace:load'])`；`bindProxiedHandlersToIpc` 加判斷；新增 `profile:list-local` IPC |
| `electron/preload.ts` | `profile.listLocal` 新增 API |
| `src/App.tsx` | 初始化流程中，profile 找不到時 fallback 到 `listLocal()` |

**Diff 預覽**（`electron/main.ts`）：

```diff
+// Local-only profile list (never proxied to remote)
+ipcMain.handle('profile:list-local', () => profileManager.list())

+const ALWAYS_LOCAL_CHANNELS = new Set([
+  'workspace:save', 'workspace:load',
+])

 function bindProxiedHandlersToIpc() {
   for (const channel of PROXIED_CHANNELS) {
     ipcMain.handle(channel, async (event, ...args: unknown[]) => {
-      if (remoteClient?.isConnected) {
+      if (remoteClient?.isConnected && !ALWAYS_LOCAL_CHANNELS.has(channel)) {
         return remoteClient.invoke(channel, args)
       }
```

**Fork 相容性**：fork `electron/main.ts` line 1608 / 1627 已有 `registerHandler('workspace:save'...)` / `('workspace:load'...)`，line 74 已 import `handler-registry`，表示架構一致可直接套。

---

#### 🟢 #4-6 合成 — EFFORT_LEVELS 抽取 + xhigh 最終狀態（最終合成 `9c3daf8`）

> 4 個原子 commit：`41b4357`（加 xhigh）→ `8a4298e`（重構為 EFFORT_LEVELS const + 暫移 xhigh）→ merge → `9c3daf8`（re-add xhigh + SDK 2.1.111）。cherry-pick 時**只取最終合成狀態**，不逐個套。

- **類別**：cherry-pick（三合一）
- **判準**：型別系統統一 + 新 effort level `xhigh`（CLI 2.1.111+ 支援）
- **衝突風險**：低-中（6 檔案聯動但都是型別變更）
- **預估工時**：0.7h

**檔案動向**：
| 檔案 | 變更 |
|---|---|
| `src/types/index.ts` | 新增 `export const EFFORT_LEVELS = ['low','medium','high','max','xhigh'] as const`；`export type EffortLevel = typeof EFFORT_LEVELS[number]`；原 `defaultEffort?: 'low'\|...\|'max'` 改用 `EffortLevel` |
| `src/stores/settings-store.ts` | import `EffortLevel`，`setDefaultEffort` 型別改用之 |
| `src/components/SettingsPanel.tsx` | `<option>` 改用 `EFFORT_LEVELS.map(...)`；`(Opus only)` 標記僅 `max` 顯示 |
| `src/components/ClaudeAgentPanel.tsx` | import `EFFORT_LEVELS`；effort `<select>` 改用 map；`startSession` effort 型別改 `EffortLevel` |
| `electron/main.ts` | import `EffortLevel`；`claude:set-effort` handler 型別改用之 |
| `electron/claude-agent-manager.ts` | import `EffortLevel`；`SessionInstance.effort`、`startSession`、`setEffort` 型別改用之 |
| `package.json` | SDK/CLI 升 `^0.2.111` / `^2.1.111` |

**Diff 預覽**（`src/components/ClaudeAgentPanel.tsx` effort `<select>`）：

```diff
-<option value="low">low</option>
-<option value="medium">medium</option>
-<option value="high">high</option>
-<option value="max">max</option>
+{EFFORT_LEVELS.map(level => (
+  <option key={level} value={level}>{level}</option>
+))}
```

**Fork 衝突點**：fork `src/types/index.ts` line 223 目前 `defaultEffort?: 'low' | 'medium' | 'high' | 'max'` — cherry-pick 時：
1. 宣告 `EFFORT_LEVELS` const 須放於 fork 既有 `FONT_OPTIONS`、`STATUSLINE_ITEMS` 等 const export 附近
2. 所有引用 `'low' | 'medium' | 'high' | 'max'` 聯合型別的地方要換成 `EffortLevel`
3. 若 fork 有 BAT 專屬 effort level 控制邏輯（supervisor 模式可能有）需個別檢查

---

### 3.2 移植（port）類

---

#### 🟡 #7 + #8 — 一包：`3a0af80` + `5d9f486` remote 資安加固

- **類別**：移植（Q1=A，列為 Phase 2 獨立 PLAN 處理）
- **判準**：P0 資安修復（fork 現 remote 模式啟用等同裸露）+ 大規模且與 fork 可能已有改動互相衝突 → 不適合單一 cherry-pick
- **衝突風險**：高（16 files, +1288/-285）
- **預估工時**：6-10h（含新檔建立、既有 remote 檔合併、手動測試、憑證/token 遷移）

**安全性改動清單**（依 upstream commit msg 分 P0/P1/P2）：

**P0（Security）**：
- **wss://** 改用自簽憑證 + SHA-256 fingerprint pinning（TOFU）
- 憑證私鑰與 token 從 plaintext 改存 Electron **`safeStorage`**
- `bind-interface` 選項（localhost/tailscale/all）— **預設 localhost，修正原 `0.0.0.0` 裸露**

**P1（Reliability）**：
- client reconnect 改指數退避 + jitter（原固定 3s）
- `remote:connect/disconnect` mutex 序列化（防切 profile 競態）
- per-IP auth 失敗節流（5 fails/60s → 10min ban）
- 未 auth client 傳非 auth frame 直接關閉
- WebSocket `maxPayload` 32 MB cap
- **path sandbox**（新檔 `path-guard.ts`）套在 `fs:readdir/readFile/search/watch` + `image:read-as-data-url` — 擋 `~/.ssh`、keychain、credential stores
- `image:read-as-data-url` 加 10 MB cap + try/catch

**P2（Maintainability）**：
- `claude:abort-session` 加入 `PROXIED_CHANNELS`（原本被靜默降級為 local）
- `electron.d.ts` 改 import `ElectronAPI` 型別（原本手動維護 drift）
- Profiles 加 `remoteFingerprint` 欄位；ProfilePanel/SettingsPanel 表單與 QR payload 都支援

**新檔**：
- `electron/path-guard.ts`（+78）
- `electron/remote/certificate.ts`（+103）
- `electron/remote/secrets.ts`（+54）

**`5d9f486` 依附修復**：`selfsigned@5.generate()` 回傳 Promise，原同步呼叫返回 Promise 物件導致 `.cert/.private` undefined → `Cannot read properties of undefined (reading 'replace')` — 與 #7 捆綁移植。

**PLAN-### 建議結構**（供未來開單時參考）：
| Phase | 範圍 | 預估 |
|---|---|---|
| P.1 | 新增 `path-guard.ts` + 套到既有 IPC | 1.5h |
| P.2 | `certificate.ts` + `secrets.ts` + `safeStorage` 接線 | 2h |
| P.3 | `remote-server.ts` wss + fingerprint pinning + brute-force 節流 | 2h |
| P.4 | `remote-client.ts` 指數退避 + mutex | 1h |
| P.5 | ProfilePanel/SettingsPanel `remoteFingerprint` UI + QR payload 擴充 | 1h |
| P.6 | 手動測試（跨機連線 / TOFU 首次與二次 / path-guard 阻擋 / ban 行為） | 1.5h |
| P.7 | 相依 `5d9f486` 的 selfsigned v5 async 驗證 | 0.3h |

---

### 3.3 skip 類

---

#### 🔴 #2 — `e74e29c` v2.1.43：fix WorkerPanel reloadProcfile TDZ

- **類別**：skip
- **判準**：**fork 與 upstream `WorkerPanel.tsx` 架構完全不同**
  - upstream：**Procfile 多進程管理**（`reloadProcfile`、`stopProcess`、`restartProcess`、`startProcess` 等 ~500+ 行）
  - fork：**supervisor 模式狀態面板**（110 行，`workerStatuses`、`supervisor.listWorkers`、`handleSend` 等）
- **動作**：不 cherry-pick，不影響 fork（fork 無此 TDZ 錯誤源）

---

#### 🔴 #9 — `b3032ce`：security account-manager macOS keychain harden

- **類別**：skip
- **判準**：**fork 無 `electron/account-manager.ts` 檔**（fork ls 確認不存在）
- **動作**：不適用；若未來 fork 引入帳戶管理功能需同步審視

---

#### 🔴 #10 — `458d14e` v2.1.41-pre.10：perf PTY/markdown/archive 優化

> Q2 決定：**不實作**（怕 regression 影響 BAT 既有客製化），但**拆分方案於此備存**供未來考慮

- **類別**：skip（當前）＋未來拆分選項 B
- **判準**：含 5 檔案優化，與 fork 的 supervisor mode + worker panel + BAT 內部終端路由客製化互相作用尚未驗證
- **動作**：本輪不進 Phase 1；若未來 BAT 穩定後需提效再開工單重審

**5 個優化重點**：
| # | 檔案 | 優化 | 本輪建議 | 未來 B 拆分 |
|---|---|---|---|---|
| a | `electron/pty-manager.ts` | 8 ms window coalesce PTY output（首 chunk 即時送、後續批次）| skip | **高風險**（BAT supervisor / worker panel interactive latency 未驗證）|
| b | `src/components/ClaudeAgentPanel.tsx` | `renderChatMarkdown` FIFO cache 500 + archive 非同步化（`finally` 清 flag） | skip | **中風險**（fork ClaudeAgentPanel 已有大量客製，需驗證 cache key 無副作用）|
| c | `electron/snippet-db.ts` | 300 ms debounce + 外部變更時 drop pending + close 時 flush | skip | **低風險**（獨立模組，可單獨 cherry-pick）|
| d | `src/components/TerminalPanel.tsx` | IME composition / contextmenu listener effect teardown 清理 | skip | **低風險**（記憶體洩漏修補，獨立影響）|
| e | `electron/main.ts` | 1 行 import 變更 | skip | 隨 a-d 附帶 |

**B 拆分建議優先順序**（若未來重審）：c → d → b → a（由低風險到高風險）。

---

#### 🔴 #11 — `92c4dec`：fix(worker) PowerShell-compatible launch on Windows

- **類別**：skip
- **判準**：**與 #2 同理** — fork `WorkerPanel.tsx` 是 supervisor 模式，無 `exec bash -c '...'` 啟動邏輯（無 `buildLaunchCommand`、無 Procfile 進程啟動）
- **動作**：不適用；若 fork 未來引入類似 Procfile 管理再評估

---

### 3.4 Merge commits（不計入）

- `bdb14f7` v2.1.44：main 分支自合，無程式碼實質改動
- `8b0671d`：合入 `bat/worktree-01e64d7d`，內容已在 `41b4357`

---

## 4. 建議 Phase

### Phase 1 — cherry-pick 快速收益（建議工單：T0165 Phase 1）

| Cherry | 說明 | 工時 |
|---|---|---|
| C1.1 | `357b868` + `9c3daf8` 合併套：Opus 4.7 + SDK/CLI 2.1.111 + EFFORT_LEVELS + xhigh | 1.0h |
| C1.2 | `0bc3bc1`：remote workspace:load fix + profile:list-local | 1.0h |

**Phase 1 總計**：~2h（含建置與手動驗證）

> 建議 C1.1 與 C1.2 分別用獨立 commit，方便回退。

#### C1.1 關鍵執行順序（使用者特別指示）

> 使用者於 [07:06] 補充：**「還要先升級 claude-agent-sdk 以支援 Opus 4.7，upstream v2.1.46-pre.1」**。Opus 4.7 模型在 fork 內能否正常跑，取決於 SDK/CLI 版本；若模型先進 builtin list 但 SDK 未升，會出現 API 呼叫失敗或 model-not-supported 錯誤。

C1.1 必須按下列順序執行，**不可顛倒**：

| 順序 | 步驟 | 檔案 | 驗證 |
|---|---|---|---|
| ① | 升 `@anthropic-ai/claude-agent-sdk` `^0.2.104` → `^0.2.111` | `package.json`、`package-lock.json` | `npm ls @anthropic-ai/claude-agent-sdk` |
| ② | 升 `@anthropic-ai/claude-code` `^2.1.97` → `^2.1.111` | 同上 | `npm ls @anthropic-ai/claude-code` |
| ③ | `npm install` + 啟動 BAT 確認既有 session 仍正常（Opus 4.6 / Sonnet 等） | — | build + smoke test |
| ④ | 新增 `EFFORT_LEVELS` const + `EffortLevel` type + `xhigh` 成員 | `src/types/index.ts` | `tsc --noEmit` 通過 |
| ⑤ | 所有引用點替換型別（6 檔案） | 見 §3.1 #4-6 表格 | 同上 |
| ⑥ | `BAT_BUILTIN_MODELS` 插入 `claude-opus-4-7` 兩項 | `electron/claude-agent-manager.ts` | — |
| ⑦ | `MODEL_PRICING` 加 `opus-4-7: P(5, 25)` + `getModelPricing` if 檢查 | `src/components/ClaudeAgentPanel.tsx` | — |
| ⑧ | `npx vite build` 確認無 TS/build error | — | build pass |
| ⑨ | 手動測試：切到 Opus 4.7 發一則訊息、切 effort 為 `xhigh` | — | 訊息返回正常、無 API error |

**關鍵對應**：upstream v2.1.46-pre.1（`5d9f486`）本身只修 selfsigned，**SDK/CLI 版本來自 v2.1.45（`9c3daf8`）的 `^0.2.111` / `^2.1.111`** — 即 C1.1 對應的目標版本。v2.1.46-pre.1 的 selfsigned fix 屬於 Phase 2 remote 資安加固的依附修復，**不在 C1.1 範圍內**。

**風險**：若 fork 既有程式碼有 Opus 4.7 無法支援的 API 呼叫方式（如舊版 SDK 的參數名），步驟 ③ smoke test 會抓到；此時回退 SDK/CLI 版本並開票調查。

### Phase 2 — 移植（建議單獨開 PLAN-###）

| 移植包 | 說明 | 工時 |
|---|---|---|
| P2.1 | `3a0af80` + `5d9f486` remote 資安加固 | 6-10h |

> 依 Q1=A 決策 → 另開 PLAN-###（建議命名 PLAN-018-remote-security-hardening），不納入 T0165 本輪 cherry-pick。

### Phase 3 — skip（理由留存）

| Skip | 理由 |
|---|---|
| `e74e29c` | fork WorkerPanel 架構不同（supervisor ≠ Procfile）|
| `b3032ce` | fork 無 account-manager.ts |
| `458d14e` | perf 優化於 BAT 客製化環境有 regression 風險，Q2 決定不實作（B 拆分方案備存）|
| `92c4dec` | 與 `e74e29c` 同，不適用 |

---

## 5. 下一步選項

- **[A] 開實作工單 T0165 執行 Phase 1 cherry-pick 3 包**（建議）
  - 同時開 PLAN-018 規劃 Phase 2 remote 資安加固（不阻塞 T0165）
  - 完成後更新 `version.json.lastSyncCommit` 為 `92c4dec`
- **[B] 只做 Phase 1 其中一部分**
  - 建議只做 C1.1（Opus 4.7 + SDK/CLI 升級），C1.2 等 remote 測試環境準備好再做
- **[C] 放棄本輪同步**
  - 原因：本週已完成 PLAN-016 / PLAN-005 / PLAN-003 多項升級，context 已飽和
  - 風險：Opus 4.7 無法立即在 BAT 內使用
- **[D] 先開 PLAN-018（Phase 2）再回頭做 Phase 1**
  - 原因：remote 資安是 P0，應優先處理
  - 缺點：Phase 2 工時 6-10h 不適合本週完成

**推薦**：**[A]** — T0165（Phase 1, ~2h）當天可做完，PLAN-018（Phase 2）排下一週。Phase 3 的 skip 理由已記錄，日後 upstream 若再改動可回看本報告。
