---
schema_version: 1
schema_kind: workorder
id: T0513
title: "Profile（配置）對話框 remote 卡片狀態燈：headless profile 永遠紅燈修正，並區分已連線 / 閒置 / 連線失敗（BUG-123）"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-123
priority: P2
sizing: S
created_at: "2026-10-14T03:27:58+0800"
started_at: "2026-10-14T03:29:15+0800"
updated_at: "2026-10-14T03:38:53+0800"
completed_at: "2026-10-14T03:38:53+0800"
target_version: "0.6.0-pre.7"
related:
  - BUG-123
  - "T0288（ProfileCard / StatusDot）"
  - "T0512 / BUG-122（同對話框版面，已 FIXED）"
  - "PLAN-039（RemoteConnectionRegistry：本機每個 remote profile 的 live 連線）"
affects_files:
  - src/components/ProfilePanel.tsx
  - src/components/profiles/
  - src/styles/settings.css
  - src/locales/
  - src/types/
  - electron/main.ts
  - electron/preload.ts
  - electron/remote/
  - src/components/__tests__/
  - src/components/profiles/__tests__/
  - electron/__tests__/
  - e2e/
  - _ct-workorders/T0513-profile-panel-remote-status-light.md
  - _ct-workorders/BUG-123-profile-panel-remote-status-always-red.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不碰使用者正在用的 BAT（port 9876、真實 userData、WSL 上執行中的 bat-server PID 381 / port 9877）；e2e / 截圖一律隔離實例。不消耗 Claude token。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 e2e（L141）。"
  - "🔴 改 `electron/**` 驗收 `npm run typecheck:electron` = 0；改 `src/**` 驗收 `npm run typecheck` = 0（CLAUDE.md Type check 節）。"
  - "🔴 新增 i18n 字串需三語（`src/locales/*.json`）齊備；renderer 日誌用 `window.electronAPI.debug.log`，electron 用 `logger`。"
---

# T0513 — Profile 對話框 remote 狀態燈（BUG-123）

## 背景

使用者回報：WSL Ubuntu-24.04 profile 的視窗開著、連線正常，「配置」對話框裡該卡片仍是 🔴（tooltip `Disconnected`）。截圖與塔台已確認的事實、根因定位見 **BUG-123**（請先讀，含兩張截圖路徑）。

一句話根因：`ProfilePanel.loadProfiles` 對 remote 卡片改問遠端 `profile:list` 的 `activeProfileIds`，但 headless bat-server 的 `profile:list`（`electron/remote/headless-handlers.ts:58`）是固定回空陣列的 stub ⇒ WSL / SSH / Docker profile 恆紅。

## 任務

1. **複核根因**（回報區寫明）；同時確認「指向另一台完整 BAT（非 headless）的 legacy remote profile」目前語意（`remoteProfileId` 比對遠端 BAT 的 active profile）是否仍正確，不得改壞
2. **燈號語意改為以本機事實為主**（建議方向，Worker 可依程式碼現況調整，取捨寫回報區）：
   - 🟢 **已連線**：本機對該 profile 有 live 連線 / 開著視窗（PLAN-039 `RemoteConnectionRegistry` 或本機 `activeProfileIds`，擇正確來源；detached / tray hidden 視窗的計算比照 `collectProfileWindows()`）
   - ⚪ **閒置**：沒開視窗，但伺服器可連（或未檢查）——不得用紅燈
   - 🔴 **連線失敗**：查詢失敗（連不上 / token / fingerprint 不符等），tooltip 帶簡短原因
   - 是否保留對遠端 `profile:list` 的查詢、legacy remote 是否保留原比對，由 Worker 決定並說明
3. tooltip 三語化（目前 `Connected` / `Disconnected` / `Idle` 寫死英文）
4. 對話框開著時，該 profile 連線 / 斷線後燈號是否需要即時更新：若既有事件可低成本接上就做，否則維持「開對話框時載入」並在回報區說明
5. 不改 headless `profile:list` 回傳的既有欄位語意，除非有充分理由（若改，列出所有 consumer）

## 驗證

- 單元測試：ProfilePanel / ProfileCard 燈號三狀態（含 headless 遠端回空陣列但本機已連線 → 🟢、查詢失敗 → 🔴、未開 → ⚪）
- 隔離實例 e2e 或截圖（source build，`npx vite build`）：可用 PLAN-039 e2e 的雙實例做法（`e2e/plan039-multi-remote.spec.ts`）或 IPC stub；附修改前 / 後截圖路徑
- `npx vite build` exit 0、`npm run typecheck` = 0、`npm run typecheck:electron` = 0（若動 electron）、相關 unit test 通過；跑 `npm run test:unit` 全套確認無回歸

## 驗收條件

- [ ] 開著視窗的 headless remote profile 顯示 🟢
- [ ] 未開視窗不再顯示紅燈；連線失敗才紅燈且 tooltip 有原因
- [ ] tooltip 三語
- [ ] legacy remote profile（指向完整 BAT）行為不變或改善（說明）
- [ ] BUG-123：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」段同步

## Sub-session 執行指示

1. 讀本工單、BUG-123、兩張截圖
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
4. commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區


### 結果摘要（Worker，2026-10-14）

- **結論**：DONE。remote 卡片燈號改以本機事實為主（PLAN-039 registry 連線 + 該 profile 的 live 視窗數），只有「沒有連線、也沒開視窗」的 profile 才探測目標，用來區分閒置 ⚪ 與連線失敗 🔴。tooltip 三語化，對話框開著時會即時跟著連線 / 斷線 / idle release 更新。
- **Landing check**：PASS。C-0：`repo: better-agent-terminal` = `basename(REPO_ROOT)` = `better-agent-terminal`；C-1：工單位於 REPO_ROOT 內；C-3：affects_files 路徑都存在（PASS）；C-2：工單沒有 `branch` 欄位（目前分支 `main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### 1. 根因複核

- 確認塔台定位正確：`ProfilePanel.loadProfiles` 對 remote 卡片呼叫 `remote:list-profiles`（臨時 RemoteClient 連到目標後 invoke `profile:list`），再拿 `remoteProfileId || 'default'` 比對遠端回傳的 `activeProfileIds`。headless 的 `profile:list`（`electron/remote/headless-handlers.ts:58`）固定回 `{ profiles: [], activeProfileIds: [] }`，所以結果一律 false，`ProfileCard` 再 fallback 到 `disconnected` → 🔴。查詢失敗時同樣回 `activeIds: []`，與「沒開視窗」無法分辨。
- **另外發現 ssh-\* profile 的問題**：ssh profile 的 `remoteHost:remotePort` 是伺服器端的 localhost，只有透過 SSH tunnel 才連得到（T0425 `resolveSshTunnelUse`）。舊探測沒走 tunnel，實際上是連到本機自己：如果本機 RemoteServer 剛好用同一個 port，會得到「本機 BAT 的 activeProfileIds」，燈號可能錯綠或錯紅。新做法對 ssh-\* 一律不直接探測。
- **legacy remote（指向完整 BAT）原本的語意**：renderer 從不呼叫 `profile.activate`，所以遠端 BAT 的 `activeProfileIds` 代表的是「遠端機器自己開著哪些 profile」，跟本機有沒有連上無關。舊綠燈 = 遠端機器上有人開著那個 profile，並不代表本機已連線。

### 2. 燈號語意（`src/components/profiles/remote-status.ts` `computeRemoteCardStatus`）

| 條件（依序判斷） | 燈 | tooltip（zh-TW） |
|---|---|---|
| registry 連線 `connected` | 🟢 connected | 已連線：本機持有此 profile 的連線 |
| registry entry 首次連線中 / `reconnecting` | 🟡 connecting（新增） | 連線中… / 重新連線中… |
| registry client 已斷（`disconnected`），或有開視窗但沒有連線 | 🔴 | 連線中斷：profile 視窗開著但未連線 |
| 有 host + token 但沒釘選 fingerprint（main 會拒絕連線） | 🔴 | 連線失敗：未釘選伺服器指紋（請重新配對） |
| 沒連線也沒視窗 → 探測失敗 | 🔴 | 連線失敗：<短原因> (<原始錯誤>)；短原因對應 `auth-failed` / `fingerprint-mismatch` / `timeout` / `network` / 其他 |
| 沒連線也沒視窗 → 探測成功 | ⚪ idle | 未連線：未開視窗，伺服器可連線（legacy 目標上該 profile 使用中時，加註「遠端 BAT 上此 profile 使用中」） |
| ssh-\*（不探測）、或沒有 host / token | ⚪ idle | 未連線：未開視窗（未檢查伺服器） |

- **資料來源**：新增 `remote:profile-connection-states`（`ipcMain.handle`，ALWAYS local），回傳 `{ profileId, state, windows }[]`。state 取自 `remoteConnections`（registry），windows 取自 `getWindowsForProfile()`，也就是 `collectProfileWindows()` 的算法：detached 視窗算在父視窗的 profile、縮到 tray 的 hidden 視窗也算。涵蓋範圍是 registry entries 加上 window registry 裡有 profileId 的視窗。純函式 `planProfileConnectionSnapshots` 放在 `electron/remote/remote-connect-plan.ts`。
- **為什麼不用本機 `activeProfileIds`**：它是持久化欄位，連線失敗或啟動時 unreachable 的情境下不一定反映 live 連線。registry 才是即時狀態，所以本機 `activeProfileIds` 只繼續用在 local 卡片（行為不變）。
- **保留遠端 `profile:list` 查詢，但只當探測用**：既有的 `remote:list-profiles` 本來就會回 errorCode 和原始錯誤；對 legacy 完整 BAT 還能附上「遠端使用中」提示。已連線或開著視窗的 profile 不探測，開對話框時因此少建一些臨時連線。
- **legacy remote 的行為變更（判斷為改善）**：本機已連線 → 🟢（舊版不一定）；本機沒連線但遠端機器開著該 profile → ⚪ 加 tooltip 提示（舊版是 🟢，容易誤會成本機已連線）；遠端可連但沒開 → ⚪（舊版 🔴）；連不上 → 🔴 加原因（舊版 🔴 但沒有原因）。
- **未改 headless `profile:list` 的回傳**（任務 5）：新邏輯不再依賴它，沒有必要動。

### 3. tooltip 三語

`src/locales/{en,zh-TW,zh-CN}.json` 的 `profiles` 下新增 `status.*`（4）、`statusReason.*`（9）、`statusProbeError.*`（5），三語齊備，`i18n-completeness.test.ts` 通過。`StatusDot` 改用 `t('profiles.status.*')`，hook 只放在 `StatusDot` 這個子元件裡，因為 `tests/profile-card.test.ts` 會把 `ProfileCard` 當普通函式直接呼叫。另外加了 `data-status` 屬性給測試用。

### 4. 即時更新

成本低，有做。main 的 `pushRemoteClientStatus`（connect / disconnect / reconnect / idle release / first-window release 都會經過這裡，T0443 已去重）在有實際變化時，額外對所有視窗送 `remote:profile-connections-changed`（不帶 payload）。ProfilePanel 開著時訂閱這個事件，收到後只重讀 `remote:profile-connection-states`，不重新探測目標。e2e 實測：關掉已連線 profile 的視窗，15.996 s 後（IDLE_GRACE_MS 15 s）燈號從 🟢 轉為 ⚪，不需重開對話框。已知限制：連線被釋放後該 profile 沒有探測結果，顯示為「未檢查伺服器」⚪，重開對話框才會重新探測。

### 5. 修改檔案

- `electron/remote/remote-connect-plan.ts`：`REMOTE_PROFILE_CONNECTIONS_CHANGED_CHANNEL`、`RemoteProfileLinkState`、`RemoteProfileConnectionSnapshot`、`planProfileConnectionSnapshots`
- `electron/main.ts`：`pushRemoteClientStatus` 廣播、`getProfileConnectionSnapshots`、`remote:profile-connection-states` handler
- `electron/preload.ts`、`src/types/electron.d.ts`：`remote.profileConnectionStates()` / `remote.onProfileConnectionsChanged()`
- `src/components/profiles/remote-status.ts`（新增）、`types.ts`（`ConnectionStatus` 加 `'connecting'`）、`index.ts`、`ProfileCard.tsx`（三語 `StatusDot`、🟡、`connectionStatusTitle`；remote 不再預設成紅燈）
- `src/components/ProfilePanel.tsx`：`loadProfiles` 改寫（本機狀態 → 篩選後探測；用 generation 防止舊結果覆蓋新結果）、訂閱即時更新、傳 `connectionStatus` / `connectionStatusTitle`
- `src/locales/*.json`：三語字串
- 測試：`src/components/profiles/__tests__/remote-status.test.ts`、`src/components/__tests__/profile-panel-remote-status.test.tsx`、`electron/remote/__tests__/remote-profile-connection-snapshots.test.ts`、`e2e/t0513-profile-status-light.spec.ts`
- `src/styles/settings.css` 不需改。工作區 CRLF 轉 LF 後 git 端沒有差異，未 commit。

### 6. 驗證

| lane | 結果 | 證據 |
|---|---|---|
| typecheck | PASS | `npm run typecheck` = 0、`npm run typecheck:electron` = 0 |
| build | PASS | `npx vite build` exit 0 |
| unit（新增） | PASS | remote-status 11 項、ProfilePanel 燈號 11 項（headless 空陣列但本機已連線 → 🟢、探測失敗 / rejected → 🔴 加原因、未開且可連 → ⚪、ssh 不探測、reconnecting 🟡 / 有視窗無連線 🔴、legacy 遠端使用中 ⚪ 加提示、legacy 本機連線 🟢、即時 push、zh-TW tooltip、舊 preload 缺 API 時降級）、electron snapshot 加 source guard 5 項 |
| unit 全套 | PASS | `npm run test:unit`：Test Files 209 passed、Tests 3501 passed / 1 skipped、exit 0 |
| e2e（隔離實例，source build） | PASS | `npx playwright test e2e/t0513-profile-status-light.spec.ts`：1 passed（18.0 s）；runtime `e2e-t0513-status-*`，結束後 userData 已刪、Terminal Server 已結束。沒有碰 port 9876、使用者的 userData，也沒有碰 WSL / docker / ssh |
| 修改前截圖 | 使用者回報 | BUG-123 所列 `…\7e9ce546-…\images\1.png` / `2.png`（WSL 卡片 🔴）。沒有另外 build 舊版重拍：禁止 stash / checkout，另開 worktree 需要完整 npm ci |
| 修改後截圖 | 已存 | `C:\Users\Gower\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\33690ae7-7473-44d5-b13d-bd913fda4639\scratchpad\t0513-evidence\after-dialog-connected.png`（Default 🟢 / Docker connected 🟢 / Docker idle ⚪ / WSL unreachable 🔴 / SSH ⚪）、`C:\Users\Gower\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\33690ae7-7473-44d5-b13d-bd913fda4639\scratchpad\t0513-evidence\after-unreachable-tooltip-hover.png`、`C:\Users\Gower\AppData\Local\Temp\claude\D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal\33690ae7-7473-44d5-b13d-bd913fda4639\scratchpad\t0513-evidence\after-dialog-released.png`（Docker connected 釋放後轉 ⚪） |
| e2e 實測 tooltip | — | `已連線：本機持有此 profile 的連線` / `未連線：未開視窗，伺服器可連線` / `連線失敗：無法連線 (connect ECONNREFUSED 127.0.0.1:53604)` / `未連線：未開視窗（未檢查伺服器）` |
| 真實 WSL profile 實機驗收 | 需真人 | 要用新版 BAT 開 WSL Ubuntu-24.04 視窗，再看配置對話框 → 預期 🟢（AI 不碰使用者正在用的 BAT） |

- 備註：`tests/profile-card.test.ts`（node:test，不在 `test:unit` 範圍）用 `npx tsx --test` 跑時，`SshDetails differentiates …` 1 項失敗。原因是 `SshDetails` 自 T0506 起用了 `useTranslation`，被當普通函式呼叫就會出錯，這是先前就有的問題，本單沒有動 `SshDetails`。同檔的 `ProfileCard` 相關案例全部通過。

### 7. 偏差 / 後續

- 新增 🟡 `connecting` 狀態（工單建議三態）：reconnecting 是暫時狀態，標成紅色會誤導，標成白色又會蓋掉「視窗開著卻沒連上」的事實。
- 後續建議（非必要）：釋放後重新探測一次，讓 ⚪ 從「未檢查」變成「可連線 / 失敗」；修 `tests/profile-card.test.ts` 的 SshDetails 案例（另案）。

### Commit

`90b35ee` fix(profiles): T0513 remote card status light from local connection state (BUG-123)；未 push。
