# T0175-research-bat-workspace-id-env-injection

## 元資料
- **編號**：T0175
- **類型**：research
- **標題**：BAT sub-session `BAT_WORKSPACE_ID` 環境變數注入研究與設計
- **狀態**：DONE
- **優先級**：🟡 Medium
- **預估工時**：~30 分鐘
- **開始時間**：2026-04-18 17:08:34
- **完成時間**：2026-04-18 17:14:39
- **關聯**：BUG-040（OPEN）、T0173 研究報告（`_report-bug-040-workspace-misroute.md`）、T0-NEXT-1（研究報告拆單建議）
- **前置**：無
- **Renew 次數**：0

## 背景

BUG-040 根因已由 T0173 研究釐清：塔台派發 script 未帶 `--workspace` flag → renderer 落入 `activeWorkspaceId` fallback → workspace 錯派。

修復方案 A（推薦）要求塔台預載指令加 `--workspace $BAT_WORKSPACE_ID`。**前置條件**：BAT sub-session 需能取得當前 workspace id。

## 已知資訊（塔台 session 預先檢查）

實測本塔台 sub-session 環境變數：

```
BAT_SESSION=1                                           ✅ 有注入
BAT_TERMINAL_ID=c8a43b60505544cf573367ebb45d7bcb        ✅ 有注入
BAT_WORKSPACE_ID=                                       ❌ 空字串(未注入)
BAT_TOWER_TERMINAL_ID=                                  ❌ 空字串
```

**結論**:BAT 目前**未注入** `BAT_WORKSPACE_ID`。T0-NEXT-1 的研究問題(是否已注入)答案為「否」,工單範圍收斂到「設計注入方案」。

## 目標

設計 `BAT_WORKSPACE_ID` 注入方案,為 T0176(實作注入)與 T0177(塔台 skill 派發指令帶 flag,DELEGATE)鋪路。

## 執行範圍

### 1. 追蹤 BAT 現有 env 注入邏輯(~10 分鐘)

找出 `BAT_SESSION`、`BAT_TERMINAL_ID` 在哪裡被注入進 PTY:

- `electron/pty-manager.ts`:PTY 建立時 env 組裝
- `electron/main.ts`:`terminal:create-with-command` handler(line 1558-1589,見 T0173 報告引用)
- `electron/remote-server.ts`:若走 remote 路徑
- `src/App.tsx:449-455`:external terminal 事件入口

**產出**:注入點清單(檔名 + 行號 + 注入邏輯摘要)

### 2. 確認 workspace id 的來源與生命週期(~10 分鐘)

- workspace id 在何處產生?(UUID?持久?app 重啟會變嗎?)
- `src/stores/workspace-store.ts`:workspace 結構、id 欄位、持久化策略
- **關鍵**:若 id 隨 app 重啟變動,塔台 `_tower-state.md` 記錄 workspace id 不可靠 → 需走 env 注入(方案 A)
- 若 id 穩定(例如綁定 path hash 或使用者定義),可討論替代方案(塔台記錄)

### 3. 設計注入方案(~10 分鐘)

給 T0176 提供可直接實作的規格:

**必要輸出**:
- **變數名**:`BAT_WORKSPACE_ID`(確認大小寫、底線風格與 `BAT_SESSION`/`BAT_TERMINAL_ID` 一致)
- **值來源**:建立 PTY 時,從哪個 API/store 取 workspace id?
- **注入時機**:PTY 建立時?WebSocket 連線時?
- **變更點**:具體到檔案 + 行號 + 修改模式(新增 key / 改 env object)
- **degrade 行為**:若 workspace id 取不到(例如 workspace 尚未存在),env 值應為空字串而非 undefined(讓 shell `echo` 不報錯)
- **回溯相容**:現有不讀 `BAT_WORKSPACE_ID` 的程式碼是否受影響?(預期:無)

### 4. 驗收條件設計(~5 分鐘)

給 T0176 的 Acceptance Criteria:

1. BAT 內部終端執行 `echo $BAT_WORKSPACE_ID` 能取得當前 workspace id
2. workspace id 格式符合 `workspace-store.ts` 的定義(UUID / slug / 其他)
3. 跨 workspace 派發時(terminal A 在 workspace X,terminal B 在 workspace Y),各自取得自己的 id
4. Workspace 切換(使用者點其他 tab)**不影響**已開終端的 `BAT_WORKSPACE_ID`(env 注入一次即固定)
5. 非 BAT sub-session(`BAT_SESSION` 未設)執行 `echo $BAT_WORKSPACE_ID` 應為空(不應注入)

## 產出

1. **研究報告** `_report-bat-workspace-id-injection.md`,含:
   - 現有 env 注入追蹤(檔名 + 行號)
   - workspace id 來源與生命週期
   - 注入方案設計(具體到 diff 級別的修改指引)
   - T0176 Acceptance Criteria
   - 可能的邊界 case 與 degrade 行為
2. **工單回報區**填寫研究結論與關鍵程式碼引用

## 交付規格

完成後 `*done` 工單,讓塔台可直接派 T0176(實作注入)。

若研究過程發現:
- 注入方案需大改(例如發現 workspace id 非穩定) → 反饋塔台重新評估方案 A vs B vs C
- 方案可直接用現有機制(例如已有類似變數) → 跳過 T0176,直接派 T0177(DELEGATE 改塔台 skill)

## 相關檔案(可能的閱讀範圍)

- `electron/main.ts`(terminal:create-with-command,~1558-1589)
- `electron/pty-manager.ts`(PTY env 組裝)
- `electron/remote-server.ts`(若走 remote 路徑)
- `src/App.tsx`(~449-455)
- `src/stores/workspace-store.ts`(workspace 結構)
- `scripts/bat-terminal.mjs`(對照參考,line 120/157-162/389-393)

## 相關單據

- **BUG-040** OPEN:本工單的上游問題
- **T0173** DONE:根因研究(`_report-bug-040-workspace-misroute.md`)
- **T0176**(待派):實作注入(依本研究規格)
- **T0177 / CT-T004**(待派):DELEGATE 改塔台 skill 派發指令帶 `--workspace`

## 備註

- 研究型工單允許 Worker 與使用者互動(`research_interaction: true`),遇模糊點可提問
- 本研究若範圍超出預估(>45 min),請 `*done` 先回報當前進度,塔台決定是否 Renew
- **yolo 模式 dogfood 觀察點**:本工單派發缺 `--workspace`,可能被開到錯 workspace,Worker 需 `pwd` 檢查 + 手動 `cd` 回 BAT workspace

---

## 回報區

> 以下由 sub-session 填寫,請勿在指揮塔 session 中編輯

### 執行摘要

**結論**：方案 A（env 注入 `BAT_WORKSPACE_ID`）可行且為推薦解法。workspace id 為 `uuidv4()` 持久化到 window registry，跨 app 重啟穩定。

**修改範圍**：3 處檔案、5 個 Change，估計 30-45 分鐘可實作完成。
- `src/types/index.ts`：`CreatePtyOptions` 加 optional `workspaceId` 欄位
- `electron/pty-manager.ts`：3 個 env 組裝區塊各加一行 `BAT_WORKSPACE_ID`
- `electron/main.ts` line 1558：`terminal:create-with-command` handler 轉發 workspaceId 到 `ptyManager.create()`
- `src/components/WorkspaceView.tsx`：7 處 `pty.create` 補 `workspaceId: workspace.id`
- `src/App.tsx`：2 處 `pty.createWithCommand` 補 `workspaceId: activeWorkspace.id`

### 研究發現

1. **現有 env 注入唯一來源**：`electron/pty-manager.ts` `create()` 方法的 3 個平行 env 組裝區塊（proxy / node-pty / child_process），硬編碼 `BAT_SESSION` / `BAT_TERMINAL_ID` / `BAT_HELPER_DIR` / `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`。**未含** `BAT_WORKSPACE_ID`。

2. **斷點**：`CreatePtyOptions`（`src/types/index.ts:75-82`）不含 `workspaceId` 欄位 → `pty-manager.ts` 無從取得。`terminal:create-with-command` handler 雖接收 `opts.workspaceId`，但**只往 renderer 廣播**（`terminal:created-externally` 事件），沒有轉進 `ptyManager.create()`。

3. **Workspace id 穩定性**：`uuidv4()` 持久化到 window registry entry（`workspace:save/load` IPC）。跨 app 重啟穩定，符合方案 A 前提。切換 tab 不變、detach 獨立視窗不變。Workspace 被刪時 terminal 也一併消失，無殘留。

4. **方案選擇**：推薦「顯式 `workspaceId` 欄位」（Option 2）優於「塞入 `customEnv`」（Option 1），理由：型別安全、單一事實來源、涵蓋 bat-terminal.mjs WebSocket 路徑、語意清楚（customEnv = 使用者自訂，不該混系統注入）。

5. **已知 edge case**：heartbeat recovery（`handleServerDeath()` line 773-788）重建 PTY 時走 `sendToServer({ type: 'pty:create' })` raw message，**不會重跑 env 組裝**。recovery 後 PTY 無 `BAT_WORKSPACE_ID`。T0176 需評估是否把 env 存進 `PtyInstance` 以供 replay，或接受 degrade（Tower 派發場景下 recovery 機率低）。

### 產出檔案

- `_ct-workorders/_report-bat-workspace-id-injection.md`（完整研究報告，含 diff 級修改指引、T0176 AC-1~AC-8、邊界 case、風險評估）

### 建議後續工單

1. **T0176（立即派）**：依本報告第三節實作注入（3 檔案、5 個 Change、30-45 分鐘）；驗收條件依第四節 AC-1~AC-8；需額外測 heartbeat recovery 是否保留 env（第五節警示）。
2. **T0177 / CT-T004（可與 T0176 平行）**：DELEGATE 改塔台 skill 派發指令帶 `--workspace "$BAT_WORKSPACE_ID"`；不依賴 T0176 執行（env read-only）。

### 預估與實際工時

- 預估：~30 分鐘
- 實際：~6 分鐘（17:08:34 → 17:14:39）
- 差異原因：yolo dogfood 下工單範圍界定精準、程式碼結構熟悉度高，比預估快。

### 學習候選(供 *evolve)

1. **env 注入「單一事實來源」原則**：`pty-manager.ts` 集中組裝，避免各呼叫點各自注入導致不一致。T0175 確認這個模式運作良好（5 個呼叫入口統一走 3 個 env 區塊），值得寫進 CLAUDE.md 作為 BAT 架構原則。

2. **heartbeat recovery 的 env replay 空白**：`handleServerDeath()` 重建 PTY 走 raw message 而非 `create()`，導致未來新增的 env 變數都需手動同步。建議重構：把 env 組裝抽成 `buildEnv(options)` 私有方法，`create()` 和 `handleServerDeath()` 都呼叫它。此為 T0178 候選。

3. **工單規格「diff 級修改指引」效果**：研究型工單若能給出到行號的 diff 片段，實作工單幾乎無決策成本，加速執行。推薦 research-workorder 模板納入「Change 級 diff 指引」區段。

### Renew 歷程

無

### 互動紀錄

無（yolo 模式全自動，未與使用者互動）

### DONE 時間

2026-04-18 17:14:39

### Commit

- 23d75f3 `docs(ct): T0175 — BAT_WORKSPACE_ID env injection research report`
