# 研究報告：BUG-040 `bat-terminal.mjs` workspace 錯派根因

- **對應工單**：T0173
- **產出時間**：2026-04-18 (UTC+8)
- **相關 BUG**：BUG-040（OPEN）
- **相關先例**：BUG-031 CLOSED（T0137 commit `f325d1d`）

---

## TL;DR（一句話結論）

BUG-040 的黏著**不是 cwd 黏著**，而是 `activeWorkspaceId`（UI 當前焦點 workspace）黏著。根因是**塔台派發 script 未帶 `--workspace` flag**，renderer 端的 `addExternalTerminal` 落入「fallback 到 activeWorkspaceId」分支，於是新終端被派到「使用者當下點開的 workspace tab」而非「派發時意圖的 workspace」。

**BUG-040 非 BUG-031 regression，而是 T0137 設計後果**：T0137 刻意移除 cwd-based workspace 匹配，要求呼叫方 explicit 傳 `--workspace`，但塔台 skill 的預載指令未跟進。

---

## 根因段（程式碼證據）

### 呼叫鏈

```
塔台派發
  └─ bat-terminal.mjs --notify-id <id> claude "/ct-exec T####"    ← 未帶 --workspace
      └─ WebSocket invoke { id, cwd, command }                     ← workspaceId 為 undefined
          └─ main.ts: terminal:create-with-command handler
              ├─ ptyManager.create({ id, cwd, ... })                ← PTY cwd 正確（是 process.cwd()）
              └─ win.webContents.send('terminal:created-externally', { id, cwd, command, workspaceId: undefined })
                  └─ renderer: App.tsx onCreatedExternally
                      └─ workspaceStore.addExternalTerminal(info)   ← 決定 workspace 歸屬
```

### 關鍵分配邏輯（`src/stores/workspace-store.ts:331-342`）

```ts
addExternalTerminal(info: { id: string; cwd: string; command?: string; workspaceId?: string }) {
  if (this.state.terminals.some(t => t.id === info.id)) return null

  let workspace: Workspace | undefined
  if (info.workspaceId) {
    workspace = this.state.workspaces.find(w => w.id === info.workspaceId)
  }
  if (!workspace) {
    workspace = this.state.workspaces.find(w => w.id === this.state.activeWorkspaceId)  // ★ 黏著源
  }
  if (!workspace) return null
  ...
}
```

- `info.workspaceId` 未傳 → 直接 fallback 到 `activeWorkspaceId`
- `activeWorkspaceId` = 使用者當下點開的 workspace tab
- **cwd 完全沒參與 workspace 選擇**（T0137 刻意移除，註釋 `src/stores/workspace-store.ts:329` 明確寫 "cwd-based matching was removed..."）

### 塔台派發未帶 `--workspace` 的證據

`~/.claude/skills/control-tower/SKILL.md:40-41` 與 `auto-session.md:113`：

```bash
node scripts/bat-terminal.mjs --notify-id $BAT_TERMINAL_ID claude "/ct-exec T####"
```

無 `--workspace <id>` 參數。塔台 skill 完全依賴 renderer 的 fallback 行為。

### 對照 BUG-040 觀察表重新解讀

| 次序 | 派發時使用者 focus 的 workspace | `activeWorkspaceId` | 實際派到 | 與觀察吻合？ |
|------|-------------------------------|---------------------|---------|------------|
| 3（派 T0171 → 期望 BAT） | CT（正在盯 CT-T002 Worker） | CT | CT ❌ | ✅ 完全吻合 |
| 5（重派 CT-T002 → 期望 BAT） | BAT（T0171 剛完成，焦點回 BAT） | BAT | BAT ✅ | ✅ 完全吻合 |

**重點**：BUG-040 原推論「最近活躍終端 cwd 黏著」方向不正確；正確是「UI 當前 focus 的 workspace 黏著」。兩者現象相似（都與「前一張 Worker 結束」相關），因為使用者看 Worker 完成通常會切去該 tab 查看，導致 focus 與 cwd 偶然相關。

---

## BUG-031 對照

| 項 | BUG-031（已修） | BUG-040（本案） |
|----|----------------|----------------|
| 症狀 | external PTY 總是落在 parent workspace（cwd first-match） | external PTY 黏著使用者當下 focus 的 workspace |
| 根因機制 | cwd prefix 匹配取第一個 | explicit workspaceId 缺失時 fallback 到 activeWorkspaceId |
| T0137 修復 | 移除 cwd 匹配 + 新增 `--workspace` flag | — |
| 與 BUG-040 關係 | **非** regression。T0137 的修復**未**被破壞；問題在 **呼叫端未使用**新 flag | 設計後果：塔台 skill 未跟進 T0137 的 explicit 介面 |

**結論**：BUG-031 修復穩定，BUG-040 是「新介面未被呼叫端採用」的設計未完成。

---

## 修復方案設計

### 方案 A：塔台派發 script 帶 `--workspace`（推薦）

**變更**：`~/.claude/skills/control-tower/SKILL.md` + `references/auto-session.md`，預載指令改為：

```bash
node scripts/bat-terminal.mjs \
  --notify-id $BAT_TERMINAL_ID \
  --workspace $BAT_WORKSPACE_ID \
  claude "/ct-exec T####"
```

- **前提**：塔台 Worker 需要知道「派發目標 workspace 的 id」。兩個來源：
  - （A1）塔台 sub-session 環境變數 `BAT_WORKSPACE_ID`（BAT 已注入 `BAT_TERMINAL_ID`、`BAT_SESSION`，需確認是否也注入 `BAT_WORKSPACE_ID`）
  - （A2）塔台的本地規則 `_ct-workorders/_local-rules.md` 或工單元資料寫明 workspace id，Worker 在派發時 substitute
- **優點**：
  - 零 BAT 程式碼改動（flag 已存在）
  - 可控性最高，符合 T0137 explicit 設計
  - 跨專案 DELEGATE 工單也能正確派發
- **風險**：
  - 塔台需改 skill（動到 skill 檔，非 BAT repo）
  - 若 workspace id 變動（例如刪除重建 tab），派發會失敗 → 需 fallback 機制

### 方案 B：`bat-terminal.mjs` 依 cwd 猜 workspace（不推薦）

**變更**：`scripts/bat-terminal.mjs` 在未傳 `--workspace` 時，查 `activeWorkspaceId` 以外的 workspace 列表，用 cwd prefix 匹配最長項。

- **優點**：零塔台改動
- **風險**：
  - 形同回到 BUG-031 機制（longest-prefix 雖比 first-match 好，但仍是「隱式匹配」，違背 T0137 explicit 原則）
  - 新增邏輯需跨 main↔renderer 取 workspace 清單（`bat-terminal.mjs` 目前純 WebSocket client，不知道 workspaces）
  - 不處理 DELEGATE 跨 repo 工單（cwd 不在任何 workspace prefix 下 → 還是 fallback）

### 方案 C：main.ts 中間層依 cwd 匹配 workspace（折衷）

**變更**：`electron/main.ts` 的 `terminal:create-with-command` handler 在 `opts.workspaceId` 未傳時，**向 renderer 查詢** workspace 清單並用 cwd prefix 匹配 longest-prefix，成功就補 `workspaceId` 再 broadcast。

- **優點**：呼叫端（bat-terminal.mjs）零改動
- **風險**：
  - 跨 main↔renderer 同步 workspace 狀態（目前 workspace 狀態只在 renderer store）→ 需新 IPC
  - 仍是隱式匹配，違背 T0137 設計
  - 複雜度最高

### 推薦方案：A（塔台派發帶 `--workspace`）

**理由**：
1. T0137 已定案 explicit 設計，方案 A 完成介面使用
2. BAT 程式碼零改動
3. 與現有機制正交（不破壞 T0137 的 activeWorkspaceId fallback 作為安全網）

**實作前提**（需先確認）：
- BAT 是否注入 `BAT_WORKSPACE_ID` 環境變數到 sub-session？（未確認，請見「建議實作工單列表」T0-NEXT-1）
- 若沒注入 → 需補注入邏輯（BAT 端改動）

---

## 風險分析

| 風險 | 評估 | 緩解 |
|------|------|------|
| Worker 手動 cd workaround 兼容性 | 無影響（workaround 是 Worker 內部行為，與 workspace 分配正交） | — |
| T0137 BUG-031 修復被撤銷 | 方案 A 不撤銷；方案 B/C 會風險 | 不採 B/C |
| 使用者刪除 workspace 後重新派發 | 舊 workspace id 失效 → fallback 到 activeWorkspaceId（現有行為） | 可接受，非 regression |
| 跨專案 DELEGATE 工單 | 方案 A 在跨 repo 時仍能帶正確 workspace id（只要塔台知道目標） | ✅ |
| yolo 模式自動派發 | 修復後，yolo 派發不再受「使用者焦點飄移」影響 | ✅ 重要改善 |

---

## 衍生問題 / 風險

1. **BAT 環境變數是否暴露 workspace id？** — 需查 `electron/remote-server.ts` 與 PTY 建立時的 env 注入邏輯。若沒有，方案 A 需先解這個前置條件。
2. **`_tower-state.md` 或 BAT 工作目錄的隱含 workspace mapping** — 塔台本地規則（`_ct-workorders/_local-rules.md`）可能要記錄 workspace id，但 id 會隨 app 重啟變動（非持久 UUID？需驗證）
3. **跨專案 workspace id 解析** — DELEGATE 工單派發到另一 repo 時，目標 workspace 可能還不存在（需先開），這是另一獨立問題

---

## 建議實作工單列表

### T0-NEXT-1：研究 BAT workspace id 環境變數暴露（研究型，~30 分鐘）

- **目標**：確認 BAT sub-session 是否能取得當前 workspace id
- **範圍**：讀 `electron/remote-server.ts`、`electron/pty-manager.ts`、`scripts/bat-notify.mjs`（對照參考），檢查 PTY env 注入
- **產出**：
  - 若已有：列出環境變數名稱，給 T0-NEXT-2 直接用
  - 若沒有：設計注入方案（變數名、值來源、變更點）
- **前提**：無
- **風險**：🟢

### T0-NEXT-2：塔台 skill 派發指令帶 `--workspace`（實作，~20 分鐘）

- **目標**：修改塔台 skill（`~/.claude/skills/control-tower/SKILL.md` + `references/auto-session.md`），預載指令加 `--workspace $BAT_WORKSPACE_ID`
- **前提**：T0-NEXT-1 確認環境變數名稱
- **變更檔案**：
  - `~/.claude/skills/control-tower/SKILL.md`（Worker 派發指令表）
  - `~/.claude/skills/control-tower/references/auto-session.md`（auto-session 說明）
  - 可能的 dogfood reference 檔
- **驗收條件**：
  1. 在 BAT 派發新工單，不論使用者當下 focus 哪個 workspace，新終端落在派發指定的 workspace
  2. 未設 `$BAT_WORKSPACE_ID` 時 degrade 為現狀（不崩潰）
- **風險**：🟡（改 skill 檔，需驗收）

### T0-NEXT-3（可選）：若 T0-NEXT-1 結論為「未注入」→ 新增 env 注入（實作，~30 分鐘）

- **目標**：在 BAT sub-session 建立時注入 `BAT_WORKSPACE_ID=<current-workspace-id>`
- **前提**：T0-NEXT-1 確認需要注入
- **變更檔案**：`electron/main.ts`（terminal:create-with-command handler）或 `electron/pty-manager.ts`（PTY env 組裝）
- **驗收條件**：BAT 內部終端 `echo $BAT_WORKSPACE_ID` 能取得正確 id
- **風險**：🟡

### 派發順序

T0-NEXT-1 → 視結果 →（T0-NEXT-3 若需要）→ T0-NEXT-2

---

## 附錄：引用程式碼位置

| 檔案 | 行數 | 說明 |
|------|------|------|
| `scripts/bat-terminal.mjs` | 120 | `cwd = process.cwd()` 預設 |
| `scripts/bat-terminal.mjs` | 157-162 | `--workspace` flag 解析 |
| `scripts/bat-terminal.mjs` | 389-393 | invoke payload 組裝（含 workspaceId） |
| `electron/main.ts` | 1558-1589 | `terminal:create-with-command` handler |
| `electron/main.ts` | 1579-1584 | `terminal:created-externally` broadcast（含 workspaceId） |
| `electron/preload.ts` | 38-42 | `onCreatedExternally` bridge |
| `src/App.tsx` | 449-455 | renderer 接收 external terminal 事件 |
| `src/stores/workspace-store.ts` | 324-362 | `addExternalTerminal`（★ 黏著源：line 340 fallback） |
| `~/.claude/skills/control-tower/SKILL.md` | 40-41 | 塔台派發指令（未帶 `--workspace`） |
| T0137 commit | `f325d1d` | BUG-031 修復（移除 cwd-matching，新增 `--workspace` flag） |
