# T0176-impl-bat-workspace-id-env-injection

## 元資料
- **編號**：T0176
- **類型**：implementation
- **標題**：BAT 端實作 `BAT_WORKSPACE_ID` env 注入
- **狀態**：DONE
- **開始時間**：2026-04-18 17:31:46
- **完成時間**：2026-04-18 17:37:52
- **優先級**：🟡 Medium
- **預估工時**：30-45 分鐘（研究報告估；L061 參考下實際可能 10-20 分鐘）
- **關聯**：BUG-040（OPEN，Phase 1 修復第 1 張）、T0175 研究報告、D062 設計原則
- **前置**：T0175 DONE ✅
- **Phase**：BUG-040 Phase 1（1/2）— 本張完成後派 CT-T004

## 背景

T0175 研究確認方案 A 可行，`workspace.id` 為 `uuidv4()` 持久化，跨重啟穩定。本工單依研究報告第三節規格實作 BAT 端注入。

配合 D062 設計原則：**runtime context 由塔台 explicit 傳遞**。T0176 先做 BAT 端基礎建設（注入能力），CT-T004 再改塔台 skill 使用此 flag。

## 執行範圍

**完全依照** `_report-bat-workspace-id-injection.md` **第三節「Diff 級修改指引」**：

| Change | 位置 | 動作 |
|--------|------|------|
| 1 | `src/types/index.ts` | `CreatePtyOptions` 加 optional `workspaceId?: string` |
| 2 | `electron/pty-manager.ts` | 3 個 env 組裝區塊各加一行 `BAT_WORKSPACE_ID` |
| 3 | `electron/main.ts:1558` | `terminal:create-with-command` handler 轉發 `workspaceId` 到 `ptyManager.create()` |
| 4 | `src/components/WorkspaceView.tsx` + `src/App.tsx` | renderer 呼叫點補 `workspaceId` 欄位（7 + 2 處） |
| 5（可選） | `electron/preload.ts` | preload 型別同步（若有 TS 錯誤才做） |

**不做**：
- 不動 `scripts/bat-terminal.mjs`（研究報告明示：BAT 端零改動，只改 electron/renderer 側）
- 不動塔台 skill 派發指令（CT-T004 負責）
- 不做 heartbeat recovery env replay（T0178 候選）

## Acceptance Criteria

**完全依照** `_report-bat-workspace-id-injection.md` **第四節 AC-1 ~ AC-8**：

1. **AC-1**：BAT 內部終端 `echo $BAT_WORKSPACE_ID` 能取得當前 workspace id（uuidv4 格式）
2. **AC-2**：workspace id 格式與 `workspace-store.ts` 一致
3. **AC-3**：跨 workspace 派發：terminal A 在 workspace X，terminal B 在 workspace Y，各自取得自己的 id
4. **AC-4**：Workspace 切換不影響已開終端的 `BAT_WORKSPACE_ID`（一次性注入）
5. **AC-5**：非 BAT session（未設 `BAT_SESSION`）執行 `echo $BAT_WORKSPACE_ID` 為空
6. **AC-6**：既有 terminal 不回溯生效（驗證 env 注入在 PTY 建立時一次性，app 重啟前保持原狀）
7. **AC-7**：TypeScript 編譯通過（`npx vite build` 成功）
8. **AC-8**：既有功能無 regression（基本測試：開終端、切 workspace、送 claude）

## 驗收前提

**需 app 重啟 + 新 sub-session** 才能驗收（env 注入在 PTY 建立時一次性，現有塔台 session 的 `$BAT_WORKSPACE_ID` 不會追溯生效）。

驗收流程：
1. Worker commit
2. 使用者 `npx vite build` + 重啟 BAT app
3. 開新塔台 session
4. 跑 `echo $BAT_WORKSPACE_ID` → 應非空（AC-1）
5. 跑 AC-3 跨 workspace 測試

## 產出

1. Commit（單一或多個原子 commit，依 Change 拆）
2. 工單回報區填寫：修改清單、commit hash、驗收結果（Worker 自測到 AC-7 編譯通過即可，AC-1~AC-6 需使用者重啟驗收）

## 交付規格

完成後 `/ct-done T0176`。塔台收到 DONE 後：
- 觸發 BUG-040 VERIFY 決策（等 AC-1~AC-6 使用者驗收）
- 驗收通過 → 派 CT-T004 DELEGATE（塔台 skill 派發指令加 `--workspace "$BAT_WORKSPACE_ID"`）
- AC-7 編譯失敗 → 退回 FIXING

## 相關單據

- **BUG-040** OPEN — 本工單是 Phase 1 第 1 張
- **T0175** DONE — 研究報告（`_report-bat-workspace-id-injection.md`）
- **CT-T004**（待派）— Phase 1 第 2 張（塔台 skill DELEGATE）
- **D062** — Worker 無狀態設計原則
- **T0178**（候選）— heartbeat recovery env replay（T0175 衍生，L068 候選）

## 相關檔案（閱讀 + 修改）

依研究報告第三節：
- `src/types/index.ts`（Change 1）
- `electron/pty-manager.ts`（Change 2，3 個 env 區塊）
- `electron/main.ts`（Change 3，line 1558 附近）
- `src/components/WorkspaceView.tsx`（Change 4，7 處 `pty.create`）
- `src/App.tsx`（Change 4，2 處 `pty.createWithCommand`）
- `electron/preload.ts`（Change 5 可選）

## 備註

- **yolo dogfood 觀察點 1**：本派發會踩 BUG-040（workspace 錯派，因塔台 skill 尚未加 `--workspace`），Worker 須 `pwd` 檢查 + 手動 `cd` 回 BAT workspace
- **yolo dogfood 觀察點 2**：Worker 完成後會踩 BUG-041（yolo gap），走 Step 11 剪貼簿降級，使用者需手動貼完成訊息到塔台 session
- **Phase 1 完整鏈路**：T0176 + CT-T004 必須**兩張都完成**才能驗證「Worker 派到正確 workspace」的完整路徑

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

依研究報告 `_report-bat-workspace-id-injection.md` 第三節規格實作 Change 1-4，Change 5（preload.ts / electron.d.ts）確認已有 `workspaceId?: string`，無須改動。5 個 source 檔案、12 處改動、1 次 commit、AC-7 編譯通過。

### 修改清單

| # | 檔案 | 改動 |
|---|------|------|
| 1 | `src/types/index.ts` | `CreatePtyOptions` 加 `workspaceId?: string`（含 T0176 註解） |
| 2 | `electron/pty-manager.ts` | `create()` 解構賦值加 `workspaceId`；3 個 env 區塊（proxy L408-429、node-pty L453-482、child_process L529-552）各加 `BAT_WORKSPACE_ID: workspaceId ?? ''` |
| 3 | `electron/main.ts` | `terminal:create-with-command` handler（L1558）呼叫 `ptyManager.create()` 時補 `workspaceId: opts.workspaceId` |
| 4a | `src/components/WorkspaceView.tsx` | 9 處補 `workspaceId: workspace.id`（7 處 `pty.create` L435/486/525/559/577/665/743 + 2 處 `pty.createWithCommand` L594/613）|
| 4b | `src/App.tsx` | 2 處 `pty.createWithCommand` 補 `workspaceId: activeWorkspace.id`（L793/811）|
| 5 | `electron/preload.ts` + `src/types/electron.d.ts` | **無須改動**（既有型別已含 `workspaceId?: string`）|

實際改動：12 處（比研究報告預估的 7+2=9 多出 2 處，因 WorkspaceView.tsx 的 2 處 `createWithCommand` 用於 ct-exec/ct-done，同樣需要 workspaceId 以符合 AC-3 跨 workspace 隔離）。

### Commit

- `6282ea0` feat(bat): inject BAT_WORKSPACE_ID env on PTY creation
  - 5 files changed, 27 insertions(+), 8 deletions(-)

### 編譯結果（AC-7）

✅ **通過** — `npx vite build` 成功（vite 7.3.2）
- renderer bundle: ✓ 52 modules transformed, built in 10.00s
- electron main: ✓ 52 modules transformed, built in 1.47s
- preload: ✓ 2 modules transformed, built in 26ms
- terminal-server: ✓ 5 modules transformed, built in 25ms
- 無 TypeScript 錯誤、無 linter 錯誤

### Regression 自測（AC-8）

- ✅ 編譯成功 — 既有型別擴充為 optional 欄位，未破壞現有呼叫鏈
- ✅ 型別相容性 — `workspaceId` 為 optional，bat-terminal.mjs payload 既有該欄位
- ⚠️ Runtime 驗證**需使用者重啟 app**（AC-1~AC-6），Worker 自測僅限編譯層。

### 待使用者驗收項目（AC-1~AC-6）

驗收流程（依工單「驗收前提」）：
1. 使用者 `npx vite build` + 重啟 BAT app
2. 開新塔台 session
3. **AC-1**：`echo $BAT_WORKSPACE_ID` → 輸出非空（uuidv4 格式）
4. **AC-2**：輸出 id 應匹配當前 workspace 的 id（可開 DevTools 看 `workspaceStore.getState()` 比對）
5. **AC-3**：開 workspace X + workspace Y，各建終端跑 `echo $BAT_WORKSPACE_ID`，輸出應不同
6. **AC-4**：切 workspace tab 後，原終端再次 `echo $BAT_WORKSPACE_ID` 值不變
7. **AC-5**：外部系統 shell（非 BAT）跑 `echo $BAT_WORKSPACE_ID` 應為空
8. **AC-6**：既有終端（重啟前開的）不受影響（env 一次性注入，重啟後才生效於新 PTY）

**第五節警示**：heartbeat recovery 場景（`handleServerDeath()` L773-788 用 raw `pty:create` message，不跑 `create()` env 組裝）後 env 會失效。T0175 L068 候選已記錄為 T0178，本工單不處理。

### 預估與實際工時

- 預估：30-45 分鐘（研究報告）
- 實際：~6 分鐘（17:31:46 → 17:37:52；含 build 驗證）
- 落差：研究報告 diff 級指引極清晰，加上 preload/electron.d.ts 已有 workspaceId 型別，省下型別同步時間。Worker 幾乎只做機械性 copy-paste + 補欄位。

### 學習候選（供 *evolve）

1. **研究報告品質指標**：T0175 報告給出精確行號 + diff 區塊 + AC 對照表，實作階段零歧義、零回查。**建議**：將 T0175 作為「研究型工單」的標竿模板，之後 research 工單都比照此格式輸出。
2. **研究報告低估實際範圍的模式**：T0175 只列 App.tsx 2 處 createWithCommand，漏列 WorkspaceView.tsx 的 2 處 createWithCommand（ct-exec/ct-done）。雖然 delta 只有 2 處，但顯示 grep `pty.create|createWithCommand` 應在研究階段就跑完整覆蓋，避免實作時補發現。**建議**：研究型工單的「呼叫入口」表應以 full grep 結果為準，而非選擇性摘要。
3. **preload.ts / electron.d.ts 預先有 workspaceId 的來源**：檢查既有 T0137 已補過 createWithCommand 的 workspaceId（payload 層），但**只轉發給 renderer 事件**未轉給 ptyManager.create()。這種「payload 有欄位但管線未貫通」的半成品，是 BUG-040 的技術債根源之一。**建議**：未來新增跨層欄位應一次貫通 payload → IPC → PtyManager → env 整條路徑。

### DONE 時間

2026-04-18 17:37:52
