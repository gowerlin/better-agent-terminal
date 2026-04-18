# BAT `BAT_WORKSPACE_ID` 環境變數注入研究報告

**工單**：T0175
**日期**：2026-04-18
**上游**：BUG-040（OPEN）、T0173 研究報告 `_report-bug-040-workspace-misroute.md`
**下游**：T0176（實作注入，依本報告規格）、T0177 / CT-T004（DELEGATE 改塔台 skill）

---

## 摘要

**結論**：方案 A（env 注入）可行且為推薦解法。workspace id 為 `uuidv4()` 持久化到 window registry，跨 app 重啟穩定。env 注入只需改 3 處（`pty-manager.ts` 的 3 個 env 組裝區塊）+ type 擴充 + 8 個 renderer 呼叫點補欄位，零 IPC 協定破壞、零回溯相容風險。

---

## 一、現有 env 注入邏輯追蹤

### 1.1 注入唯一來源：`electron/pty-manager.ts` `create()`

三個平行 env 組裝區塊（依執行路徑分支），均硬編碼下列變數：

| 變數 | 來源 | 何處使用 |
|------|------|---------|
| `BAT_SESSION='1'` | 常數 | skill 偵測 BAT 環境 |
| `BAT_TERMINAL_ID` | `options.id` | bat-notify.mjs 自我識別 |
| `BAT_HELPER_DIR` | `resolveHelperDir()` | 定位 bat-terminal.mjs / bat-notify.mjs |
| `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` | `getRemoteServerInfo()` | WebSocket 連線（條件式） |

**具體位置**：

- `electron/pty-manager.ts:408-429`（Terminal Server proxy 路徑，目前預設）
- `electron/pty-manager.ts:453-482`（node-pty 直接 spawn 路徑）
- `electron/pty-manager.ts:529-552`（child_process fallback 路徑）

### 1.2 呼叫入口

| 入口 | 檔案 | 行號 | 備註 |
|------|------|------|------|
| IPC handler | `electron/main.ts` | 1545 | `pty:create` 直接轉交 `ptyManager.create()` |
| 外部（WebSocket）| `electron/main.ts` | 1558-1589 | `terminal:create-with-command`，接受 `opts.workspaceId` 但**只往 renderer 廣播**，未傳給 `ptyManager.create()` |
| renderer 直接 | `src/components/WorkspaceView.tsx` | 435, 485, 523, 556, 573, 658, 735 | 7 處 `pty.create`，均已在 scope 內有 `workspace` 物件 |
| renderer CT 派發 | `src/App.tsx` | 793, 811 | 2 處 `pty.createWithCommand`（ct-exec / ct-done） |
| bat-terminal.mjs | `scripts/bat-terminal.mjs` | 389-400 | WebSocket invoke `terminal:create-with-command`，payload 已含 `workspaceId` |

### 1.3 關鍵斷點（為何目前未注入）

- **`CreatePtyOptions`**（`src/types/index.ts:75-82`）**不含** `workspaceId` 欄位 → `pty-manager.ts` 無從取得 → env 組裝時只能寫死 `BAT_TERMINAL_ID`。
- `terminal:create-with-command` handler 雖收到 `opts.workspaceId`，但只傳到 `terminal:created-externally` 事件（renderer 用），**沒有**轉進 `ptyManager.create()` 的 env。

---

## 二、workspace id 來源與生命週期

### 2.1 產生

`src/stores/workspace-store.ts:124`：

```typescript
addWorkspace(name: string, folderPath: string): Workspace {
  const workspace: Workspace = {
    id: uuidv4(),          // ← 128-bit UUID v4
    name,
    folderPath,
    createdAt: Date.now()
  }
```

### 2.2 持久化

- Workspace state（含 id）經 `workspace:save` IPC 寫入 window registry entry（`electron/main.ts:1608-1626`）。
- 開啟時由 `workspace:load` 還原（`electron/main.ts:1627-1639`）。
- **app 重啟後 id 不變**，符合方案 A 前提。

### 2.3 穩定性結論

| 場景 | id 是否穩定 |
|------|-----------|
| app 重啟 | ✅ 穩定（persisted in registry） |
| 使用者切換 workspace tab | ✅ 不變（只是 activeWorkspaceId 指向改變） |
| Workspace 被刪除 | 🔴 id 消失（但 terminal 也一起刪，無殘留問題） |
| Workspace detach 為獨立視窗 | ✅ 穩定（同一 entry） |

→ **env 注入一次固定在 PTY 建立時**，即使之後 workspace 被刪或使用者切 tab 都不影響已開 PTY 的 env。這正是工單驗收條件 4 要求的行為。

---

## 三、注入方案設計

### 3.1 推薦方案：**顯式 `workspaceId` 欄位**（Option 2）

相較把值塞進 `customEnv`（Option 1），**顯式欄位**的優勢：

1. 型別安全（TypeScript 編譯期檢查漏填）
2. 單一事實來源（main process 注入，renderer 只負責傳 id）
3. 涵蓋 bat-terminal.mjs 的 WebSocket 路徑（見 3.3）
4. 清楚語意：`customEnv` 是「使用者/workspace 自訂 env」，不該混入系統注入變數

### 3.2 變數命名

| 欄位 | 值 |
|------|---|
| **變數名** | `BAT_WORKSPACE_ID` |
| **命名風格** | 全大寫 + 底線，與 `BAT_SESSION` / `BAT_TERMINAL_ID` 一致 |
| **值型別** | string（UUID v4，36 字元，含 hyphen） |
| **degrade 值** | 空字串 `''`（不是 undefined） |

### 3.3 Diff 級修改指引（給 T0176）

#### Change 1：型別擴充

**File**：`src/types/index.ts:75-82`

```diff
 export interface CreatePtyOptions {
   id: string;
   cwd: string;
   type: 'terminal';
   agentPreset?: AgentPresetId;
   shell?: string;
   customEnv?: Record<string, string>;
+  workspaceId?: string;   // T0176: for BAT_WORKSPACE_ID env injection
 }
```

#### Change 2：`pty-manager.ts` 3 處 env 組裝（proxy / node-pty / child_process）

**File**：`electron/pty-manager.ts`

每個 env object 加一行（degrade 用空字串）：

```diff
 const envWithUtf8 = {
   ...process.env as Record<string, string>,
   ...customEnv,
   // ... 既有內容 ...
   BAT_SESSION: '1',
   BAT_TERMINAL_ID: id,
+  BAT_WORKSPACE_ID: options.workspaceId ?? '',
   BAT_HELPER_DIR: resolveHelperDir(),
   // ...
 }
```

> 同時在 `create()` 函式開頭的解構賦值加入 `workspaceId`：
> `const { id, cwd, type, shell: shellOverride, customEnv = {}, workspaceId } = options`
> （目前第 379 行）

套用位置：
- line 419（proxy 路徑 env object，`BAT_TERMINAL_ID` 之後）
- line 470（node-pty 路徑 env object，`BAT_TERMINAL_ID` 之後）
- line 546（child_process 路徑 env object，`BAT_TERMINAL_ID` 之後）

#### Change 3：`terminal:create-with-command` 轉發 workspaceId

**File**：`electron/main.ts:1558-1589`

```diff
   registerHandler('terminal:create-with-command', (_ctx, opts: { id: string; cwd: string; command: string; shell?: string; customEnv?: Record<string, string>; workspaceId?: string }) => {
     if (!ptyManager) return false
     const created = ptyManager.create({
       id: opts.id,
       cwd: opts.cwd,
       type: 'terminal',
       shell: opts.shell,
       customEnv: opts.customEnv,
+      workspaceId: opts.workspaceId,
     })
```

#### Change 4：renderer 呼叫點補欄位

**File**：`src/components/WorkspaceView.tsx`（7 處，均已在 scope 有 `workspace` 物件）

7 處 `window.electronAPI.pty.create({...})` 各加一行：
```typescript
workspaceId: workspace.id,
```

**File**：`src/App.tsx`（2 處，均已在 scope 有 `activeWorkspace` 物件）

line 793-798 和 811-816 的 `createWithCommand` 各加一行：
```typescript
workspaceId: activeWorkspace.id,
```

#### Change 5（可選）：preload 型別

若 `electron/preload.ts` 對 `pty.create` / `pty.createWithCommand` 有獨立型別宣告，同步加 `workspaceId?: string`。若直接轉發 `CreatePtyOptions`，無需改動。

---

## 四、T0176 Acceptance Criteria

| # | 條件 | 驗證方式 |
|---|------|---------|
| AC-1 | BAT 內部終端執行 `echo $BAT_WORKSPACE_ID` 輸出當前 workspace UUID | 手動 |
| AC-2 | 輸出值符合 UUID v4 格式（`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`）且與 renderer `workspaceStore.getState().workspaces` 中的 id 匹配 | 手動比對 |
| AC-3 | 跨 workspace 隔離：terminal A（ws-X）與 terminal B（ws-Y）各自顯示自己的 id | 手動開兩個 ws 各建終端 |
| AC-4 | 切換 workspace tab 後，已開終端再次 `echo $BAT_WORKSPACE_ID` 值**不變**（env 注入一次固定） | 手動 |
| AC-5 | 非 BAT session（外部終端機直接 `echo $BAT_WORKSPACE_ID`）→ 空輸出（不被注入） | 手動於系統 shell |
| AC-6 | `terminal:create-with-command` WebSocket 呼叫帶 `workspaceId` 時，目標終端 env 正確注入 | 用 `bat-terminal.mjs --workspace <id> bash` 驗證 |
| AC-7 | 不帶 `workspaceId` 時（向後相容）env 值為空字串，不影響 PTY 建立 | 移除 AC-6 的 `--workspace` flag 重跑 |
| AC-8 | `npx vite build` 成功（型別檢查通過） | CI/本地 build |

---

## 五、邊界 case 與 degrade 行為

| 情境 | 預期行為 |
|------|---------|
| `options.workspaceId` 為 `undefined`（未傳） | 注入 `BAT_WORKSPACE_ID=''`（空字串），不拋錯 |
| Workspace 在 PTY 建立時不存在（理論不該發生，但防禦性） | 呼叫端責任：renderer 端 `workspace.id` 本來就是 UUID，不會空；若空表示上游 bug |
| 跨 workspace move terminal（`workspace:move-to-window`）| env 已固定在 PTY 建立時，移動後 env 仍為舊 ws id。**這是預期行為**（符合 AC-4 的「env 一次注入」原則）。若未來要求隨 move 更新，需另行設計（PTY 環境變數不可熱更新，只能重建 PTY） |
| PTY 重建（heartbeat recovery，`handleServerDeath()` line 773-788） | ⚠️ **潛在問題**：`handleServerDeath()` 重建 PTY 時走 `sendToServer({ type: 'pty:create', ... })` 直接送 raw message，**不會重跑 `create()` 的 env 組裝**。意味著 recovery 後的 PTY 無 `BAT_WORKSPACE_ID`。**T0176 需評估是否在 `oldInstances` 中一併保存 env 以供 replay**，或接受「recovery 後 env 失效」的副作用（Tower 派發場景下機率低）。 |

---

## 六、對 T0177（塔台 skill 派發帶 flag）的下游影響

T0176 完成後：
- BAT 內部終端 `$BAT_WORKSPACE_ID` 可用。
- 塔台 skill（`~/.claude/skills/control-tower/references/worker-dispatch.md` 或類似）應改為：
  ```bash
  node scripts/bat-terminal.mjs \
    --workspace "$BAT_WORKSPACE_ID" \
    --notify-id "$BAT_TERMINAL_ID" \
    claude "/ct-exec T####"
  ```
- 這是 CT-T004（DELEGATE）的實作內容，**不屬於本工單範圍**。

---

## 七、風險評估

| 風險 | 等級 | 緩解 |
|------|------|------|
| 型別破壞（`CreatePtyOptions` 擴充） | 🟢 低 | 新欄位為 optional，現有呼叫點無須改動即可編譯通過 |
| 環境變數名稱衝突 | 🟢 低 | `BAT_*` 前綴受控，無第三方占用 |
| heartbeat recovery 後 env 丟失 | 🟡 中 | 見第五節；建議 T0176 納入 `PtyInstance` 保存 env |
| WebSocket 呼叫端（bat-terminal.mjs）行為改變 | 🟢 低 | `workspaceId` 已為既有 payload 欄位，只是補上傳遞鏈 |

---

## 八、給塔台的建議

1. **直接派 T0176**：依本報告第三節 5 個 Change 實作，預估 30-45 分鐘。
2. **T0177（CT-T004）** 可與 T0176 **平行進行**：skill 改動不依賴 T0176 實際執行（env 變數 read-only），只要 T0176 merge 前測不 regression 即可。
3. **T0176 驗收時額外提示測 heartbeat recovery 場景**（第五節警示）；若發現 env 丟失，視影響決定是否當下修或拆 T0178。
