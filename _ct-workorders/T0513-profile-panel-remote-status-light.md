---
schema_version: 1
schema_kind: workorder
id: T0513
title: "Profile（配置）對話框 remote 卡片狀態燈：headless profile 永遠紅燈修正，並區分已連線 / 閒置 / 連線失敗（BUG-123）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-123
priority: P2
sizing: S
created_at: "2026-10-14T03:27:58+0800"
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

