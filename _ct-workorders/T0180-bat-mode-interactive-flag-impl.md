# 工單 T0180-bat-mode-interactive-flag-impl

## 元資料
- **工單編號**：T0180
- **任務名稱**：BAT 端 `--mode` / `--interactive` flag 接收 + env 注入（BUG-041 Phase 2.2）
- **類型**：implementation
- **狀態**：IN_PROGRESS
- **開始時間**：2026-04-18 18:56 (UTC+8)
- **建立時間**：2026-04-18 18:55 (UTC+8)
- **預估工時**：30 分鐘（依 T0179 報告 E.1 建議）
- **優先級**：🔴 High（BUG-041 修復路徑第 2 步；先改 BAT 再改 skill，保護漸進升級）
- **Renew 次數**：0

## 前置條件

- **T0179 DONE**（`fb1b095`）：研究報告 `_report-t0179-worker-yolo-flag-protocol.md` E.1 節為本工單權威規格來源
- **BUG-041 OPEN**：yolo mode Worker 側未偵測（本工單為 Phase 2.2 實作）
- **T0176 先例**（`6282ea0`）：BAT `customEnv` spread 架構已就位（`electron/pty-manager.ts` / `electron/main.ts` 零改動）
- **D062**：Worker 無狀態原則（本工單為 BAT 側基礎建設，Worker 側改動在 CT-T006）

## 背景

延續 BUG-040 Phase 1 成功經驗（T0176 注入 `BAT_WORKSPACE_ID` env 只改 `bat-terminal.mjs` 單檔），本工單用相同 pattern 注入 `CT_MODE` / `CT_INTERACTIVE` env，為後續 Worker skill 無狀態化（CT-T006）鋪路。

## 修改規格

**唯一修改檔**：`scripts/bat-terminal.mjs`

**不得觸碰**：
- ❌ `electron/pty-manager.ts`（`...customEnv` spread 已就位）
- ❌ `electron/main.ts`
- ❌ 任何 skill 檔案（`~/.claude/skills/**`）
- ❌ 任何其他 `.mjs` / `.ts` / `.tsx` 檔

### Step 1：擴充 `KNOWN_FLAGS`（行 71 附近）

在 `KNOWN_FLAGS` 陣列加入三個新 flag：
- `'--mode'`
- `'--interactive'`
- `'--no-interactive'`

### Step 2：更新 `HELP_TEXT`（行 52-69 附近）

Options 區段補三個新 flag 說明，Examples 區段加一條示範：

```
node scripts/bat-terminal.mjs --notify-id <id> --workspace <uuid> --mode yolo --interactive claude "/ct-exec T0001"
```

### Step 3：新增變數宣告（行 120-123 附近）

```javascript
let mode = null;
let interactive = null;  // null = 未指定 / true = --interactive / false = --no-interactive
```

### Step 4：state machine 加分支（行 125-175 附近）

- `--mode <value>`：
  - 校驗 `value ∈ {yolo, ask, off, on}`（正則 `^(yolo|ask|off|on)$`）
  - 不合法 → `console.error('Invalid --mode value: ...')` + `process.exit(1)`
  - 合法 → `mode = value`
- `--interactive`：`interactive = true`
- `--no-interactive`：`interactive = false`

### Step 5：擴充 `invokePayload.customEnv`（行 389-393 附近）

```javascript
if (mode) {
  invokePayload.customEnv = { ...invokePayload.customEnv, CT_MODE: mode };
}
if (interactive === true) {
  invokePayload.customEnv = { ...invokePayload.customEnv, CT_INTERACTIVE: '1' };
}
if (interactive === false) {
  invokePayload.customEnv = { ...invokePayload.customEnv, CT_INTERACTIVE: '0' };
}
```

（注意：`interactive === null` 時**不**注入 env，讓 Worker 走工單內定規則；這是 Q3.A 嚴格無狀態原則的落實 — 旗標只在使用者明示時才傳遞）

### Step 6：驗收腳本（手動）

完成後執行驗證（不需寫成 test）：

```bash
# AC-1：env 正確注入
node scripts/bat-terminal.mjs --notify-id test --workspace $BAT_WORKSPACE_ID --mode yolo --interactive claude "/ct-exec T0000"
# 在新 terminal 執行 printenv CT_MODE CT_INTERACTIVE → yolo / 1

# AC-2：非法 mode 值拒絕
node scripts/bat-terminal.mjs --mode invalid
# 預期：exit 1 + 錯誤訊息

# AC-3：向下相容（不傳新 flag）
node scripts/bat-terminal.mjs --notify-id test --workspace $BAT_WORKSPACE_ID claude "/ct-exec T0000"
# 新 PTY printenv CT_MODE CT_INTERACTIVE → 兩個都無值

# AC-4：--help 顯示新 flag
node scripts/bat-terminal.mjs --help | grep -E 'mode|interactive'

# AC-5：build 無 regression
npx vite build

# AC-6：heartbeat recovery env 保留
# （若無法手測請於回報區註記「測試受限」並說明）
```

## 驗收條件 (AC)

- **AC-1**：`--mode yolo --interactive` 啟動的新 PTY `printenv CT_MODE CT_INTERACTIVE` 回 `yolo` / `1`
- **AC-2**：`--mode invalid` 指令 exit 1 並顯示錯誤訊息
- **AC-3**：**不**傳任何新 flag 時新 PTY **無** `CT_MODE` / `CT_INTERACTIVE`（向下相容，延續現行 BAT 行為）
- **AC-4**：`--help` 輸出含 `--mode` / `--interactive` / `--no-interactive` 說明
- **AC-5**：`npx vite build` 通過（確認 build pipeline 無 regression）
- **AC-6**：heartbeat recovery 場景下新 env 保留（若手測受限，回報區註記；此條不阻塞 DONE）
- **AC-7**：commit 訊息：`feat(bat): inject CT_MODE / CT_INTERACTIVE env on PTY creation (BUG-041 Phase 2.2)`

## 研究範圍（實作邊界）

**允許**：
- 讀 `scripts/bat-terminal.mjs` 當前實作（含 T0176 修改）
- 讀 `_report-t0179-worker-yolo-flag-protocol.md`（E.1 為權威規格）
- 讀 `_ct-workorders/_report-bat-workspace-id-injection.md`（T0175 先例）
- 執行 `npx vite build` / `node scripts/bat-terminal.mjs --help` 等驗收指令

**禁止**：
- ❌ 改 `pty-manager.ts` / `main.ts` 或任何 `.ts` / `.tsx`
- ❌ 改任何 skill 檔案（含塔台、Worker、ct-exec、ct-done、ct-fieldguide 等）
- ❌ 改任何其他工單檔案（除本工單回報區）
- ❌ 改任何 PLAN / BUG 檔案
- ❌ 解決 Worker skill 側讀取邏輯（那是 CT-T006 的範圍）

## 交付規格

### D1. 代碼改動

單檔 `scripts/bat-terminal.mjs`（5 個定位：行 71 / 52-69 / 120-123 / 125-175 / 389-393）。

### D2. Commit

單一 commit：
```
feat(bat): inject CT_MODE / CT_INTERACTIVE env on PTY creation (BUG-041 Phase 2.2)
```

包含：
- 僅 `scripts/bat-terminal.mjs` + 本工單回報區更新
- `_tower-state.md` **不**由 Worker 寫（塔台職責）

### D3. 驗收證據

工單回報區貼 AC-1~AC-6 測試結果：
- AC-1：`printenv` 輸出
- AC-2：`exit 1` + 錯誤訊息截圖或文字
- AC-3：`printenv` 空值確認
- AC-4：`--help` 輸出相關行
- AC-5：`vite build` 結尾摘要
- AC-6：若手測受限，說明原因

## 互動規則

**本工單禁止 Worker 互動**（implementation 工單，規格已由 T0179 報告 § E.1 完整提供）：
- 遇到規格不明 → 先讀 `_report-t0179-worker-yolo-flag-protocol.md` § E.1
- 仍不明 → 停止工作，回塔台討論（不自作主張）
- 發現 T0179 報告規格有誤 → 回塔台指出（不自行修改）

## 相關單據

- **BUG-041** OPEN：yolo mode Worker 側未偵測（本工單為 Phase 2.2）
- **T0179** DONE（`fb1b095`）：Phase 2.1 研究，報告 § E.1 為本工單權威規格
- **T0176** DONE（`6282ea0`）：Phase 1 BAT env 注入先例（`customEnv` spread 架構建立）
- **下游未來工單**（T0180 完成後依序派）：
  - CT-T006 DELEGATE：Worker skill（ct-exec + ct-done）改讀 env、移除 config 讀取
  - CT-T005 DELEGATE：塔台 skill 派發指令加 `--mode` + 啟動詢問面板

## 備註

- 本工單 pattern 與 T0176 幾乎一致（同檔案、同 customEnv 架構），預期 Worker 6-10 min 可收工（L061 連續命中中）
- Worker 側 yolo 自動送出**尚未修**（BUG-041 Phase 2 完結才修），Worker 完成 T0180 後仍預期走 Step 11 剪貼簿

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

完成 BAT 端 `--mode` / `--interactive` / `--no-interactive` flag 解析與 env 注入，完全依 T0179 報告 § E.1 規格。單檔改動 `scripts/bat-terminal.mjs` 五個定位點（與工單規格一致）：

1. `KNOWN_FLAGS` 擴充 3 個新 flag
2. `HELP_TEXT` Options 與 Examples 區段補說明
3. 變數宣告加 `mode` / `interactive`（預設 null = 未指定，嚴格無狀態落實 Q3.A）
4. state machine 加三分支：`--mode` 正則校驗 `^(yolo|ask|off|on)$`，非法值 exit 1；`--interactive` / `--no-interactive` 互斥布林
5. `invokePayload.customEnv` spread 注入（unset 不注入，沿 T0176 pattern）

Pattern 與 T0176 BAT_WORKSPACE_ID 注入完全一致，不觸碰 `pty-manager.ts` / `main.ts` / 任何 skill。

### AC 驗收結果

| AC | 結果 | 證據 |
|----|------|------|
| AC-1 | ✅ | `--mode yolo --interactive` 啟動 PTY + env probe 檔案輸出：`{"CT_MODE":"yolo","CT_INTERACTIVE":"1"}`（並保留 `BAT_WORKSPACE_ID`） |
| AC-2 | ✅ | `node scripts/bat-terminal.mjs --mode invalid` → `Error: Invalid --mode value: 'invalid' (expected one of: yolo, ask, off, on)` + exit 1 |
| AC-3 | ✅ | 不傳新 flag 啟動 PTY + env probe 檔案輸出：`{"CT_MODE":null,"CT_INTERACTIVE":null}`（僅 `BAT_WORKSPACE_ID` 保留，向下相容成立） |
| AC-4 | ✅ | `--help` 輸出 Options 區段含 `--mode <value>` / `--interactive` / `--no-interactive` 三行說明，Examples 含新組合範例 |
| AC-5 | ✅ | `npx vite build` 三個環境全部通過：main.js 231.37 kB、preload.js 16.38 kB、terminal-server.js 6.72 kB，vite 7.3.2 無 warning |
| AC-6 | ⚠️ 測試受限 | heartbeat recovery 需模擬 WebSocket 斷線重連，無 test harness；邏輯證據：customEnv 透過 pty-manager.ts `...customEnv` spread 在 PTY spawn 時一次性注入，後續 heartbeat 僅維持 ws 連線而不重建 PTY，故 env 本質上一旦注入即永久保留（T0176 BAT_WORKSPACE_ID 已以同 pattern 驗證此行為） |
| AC-7 | ✅ | commit 訊息依工單規格：`feat(bat): inject CT_MODE / CT_INTERACTIVE env on PTY creation (BUG-041 Phase 2.2)` |

### 驗收過程補充

**E2E 驗證方法**（為驗 AC-1 / AC-3 而暫建的 probe）：
- 暫建 `scripts/_t0180-env-probe.mjs`：`writeFileSync` 把 `process.env.CT_MODE / CT_INTERACTIVE / BAT_WORKSPACE_ID / BAT_TOWER_TERMINAL_ID` 寫 JSON 到檔案
- 透過 `bat-terminal.mjs --workspace $BAT_WORKSPACE_ID [flags...] node scripts/_t0180-env-probe.mjs <out.json>` 啟 PTY 執行 probe
- 驗證完成後已刪除 probe 腳本與產出檔案（`ac1-result.json`、`ac3-result.json`），git status 無殘留

### 修改檔案清單

- `scripts/bat-terminal.mjs`（單檔，5 個定位點，+40 -3）

### Commit

（待 commit 後補 hash）

### Renew 歷程

（無）

### DONE 時間

2026-04-18 19:01 (UTC+8)
