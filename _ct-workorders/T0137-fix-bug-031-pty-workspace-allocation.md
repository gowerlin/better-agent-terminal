# 工單 T0137-fix-bug-031-pty-workspace-allocation

## 元資料
- **工單編號**：T0137
- **任務名稱**：BUG-031 修復 — 外部 PTY workspace 分配（active 預設 + `--workspace` 旗標）
- **狀態**：🔄 IN_PROGRESS
- **類型**：修復（bug fix）+ 小幅功能擴充（CLI 旗標）
- **建立時間**：2026-04-17 02:48 (UTC+8)
- **開始時間**：2026-04-17 02:57 (UTC+8)
- **關聯 BUG**：BUG-031（OPEN → 工單啟動時 FIXING）
- **修復策略**：Q1.B 強化方案 — 預設改為 active workspace + 新增 `--workspace <id>` 旗標供進階場景

## 工作量預估
- **預估規模**：中（跨 4-5 檔案，~80-150 行）
  - `scripts/bat-terminal.mjs`（+ `--workspace` 旗標 + protocol payload 擴充）
  - `electron/remote/protocol.ts`（payload 欄位定義）
  - `electron/remote/remote-server.ts`（接收 workspace 參數）
  - `electron/main.ts`（`terminal:created-externally` 廣播 payload 擴充）
  - `src/stores/workspace-store.ts` 或對應 store（`addExternalTerminal` 邏輯：預設讀 active workspace ID，旗標時用指定 ID）
- **Context Window 風險**：中
- **降級策略**：若 context 緊張，先做核心修復（active 預設），`--workspace` 旗標延後

## Session 建議
- **建議類型**：🆕 新 Session（在 better-agent-terminal **active workspace** 手動開 PTY）
- **啟動方式**（避開 BUG-031）：使用者在 BAT 點「+」開新 PTY → 輸入：
  ```
  claude "/ct-exec T0137"
  ```
- **環境驗證**：Worker 啟動後第一件事確認 `pwd` 在 `D:/ForgejoGit/BMad-Guide/better-agent-terminal/better-agent-terminal/`

---

## 任務指令

### 前置條件（必讀）
- `_ct-workorders/BUG-031-external-terminal-ui-not-synced.md`（修正版描述：workspace 分配錯誤，非 UI 不同步）
- `_ct-workorders/T0135-runtime-acceptance-bat-ct-v4.1.md`（Item 5.2 證實程式碼鏈路 PASS — `electron/main.ts:1345` 廣播 + `App.tsx:446-452` `addExternalTerminal`）
- `_ct-workorders/T0130-*.md`（外部終端 UI 同步原始實作）
- `_ct-workorders/T0131-*.md`（`bat-terminal.mjs` CLI 設計）

### 修復目標

#### Goal 1：預設行為修正（核心）
外部建立的 PTY **預設加到當前 active workspace**，而非 default workspace（BUG-031 的當前錯誤行為）。

#### Goal 2：CLI 旗標擴充（強化）
新增 `bat-terminal.mjs --workspace <workspace-id>` 旗標：
- 提供時 → PTY 分配到指定 workspace
- 未提供時 → fallback 到 Goal 1 行為（active workspace）

---

### 實作步驟（建議順序）

#### Step 1：根因定位（grep 5-10 分鐘）

```bash
# 找 addExternalTerminal 實作
grep -rn "addExternalTerminal" src/ electron/

# 找 active workspace 取得方式
grep -rn "activeWorkspace\|currentWorkspace\|workspace.*active" src/stores/

# 找 default workspace 邏輯（猜測 BUG-031 根因在這）
grep -rn "default.*workspace\|workspaces\[0\]" src/stores/ src/components/
```

回報實際根因到工單回報區（哪一行把 PTY 分配給了 default workspace）。

#### Step 2：實作 Goal 1（預設行為修正）

修 `addExternalTerminal(info)`：
- 從 store 讀取 `activeWorkspaceId`
- 把 PTY tab 加到該 workspace 的 tab list

#### Step 3：實作 Goal 2（CLI 旗標）

`scripts/bat-terminal.mjs`：
```javascript
// 解析 --workspace 旗標
let workspaceId = null
const wsIdx = args.indexOf('--workspace')
if (wsIdx >= 0) {
  workspaceId = args[wsIdx + 1]
  args.splice(wsIdx, 2)
}

// 加入 invoke payload
const payload = { /* 原有 */, workspaceId }
```

`electron/remote/protocol.ts` + `electron/main.ts` + `addExternalTerminal`：
- payload 加 `workspaceId?: string`
- main.ts 廣播時帶 workspaceId
- `addExternalTerminal({ ..., workspaceId })`：
  - `if (workspaceId) → 用指定 workspace`
  - `else → fallback 用 activeWorkspaceId`

#### Step 4：自我測試（在當前 BAT — 修復前）

⚠️ **注意**：修復後**還沒重 build**前，當前 BAT 仍是舊版（有 BUG-031），所以這次測試只能驗證程式碼邏輯，無法驗證 runtime 行為。

```bash
# Test 1：Goal 1 — 不帶 --workspace，PTY 應加到 active workspace（修復後 BAT 才能驗）
node scripts/bat-terminal.mjs claude "/ct-status"

# Test 2：Goal 2 — 帶 --workspace，PTY 應加到指定 workspace
node scripts/bat-terminal.mjs --workspace <some-workspace-id> claude "/ct-status"
```

修復前 Test 1 預期：PTY 跑到 BMad-Guide（複現 BUG-031）— 這是 baseline。

#### Step 5：commit + 提示使用者 rebuild

修復完成後 commit，並在工單回報區明確告訴塔台：

```
⚠️ 此修復需要使用者重 build + 安裝新版 BAT 才能 runtime 驗證（BUG-031 屬 main process / renderer 邏輯，不會 hot-reload）。

建議塔台動作：
1. 提醒使用者：cd 到 better-agent-terminal → npm run build → 安裝新版（覆蓋當前 BAT）
2. 重啟 BAT（會自動清掉所有現有 PTY，含 BMad-Guide 的孤兒 Worker）
3. 在新版 BAT 內派 T0137 acceptance 工單做 runtime 驗證
```

---

### 完成條件

- [ ] Step 1 根因已定位（明確指出哪一行改了什麼）
- [ ] Step 2 預設行為修正完成（active workspace）
- [ ] Step 3 `--workspace` 旗標實作完成
- [ ] 程式碼變更通過 type-check / lint（`npm run check` 或對應命令）
- [ ] 工單回報區寫清楚 Step 1-3 的修改位置 + 行號
- [ ] commit 訊息：`fix: BUG-031 — external PTY allocation to active workspace + --workspace flag`

---

## 收尾步驟（強制）

```bash
# Worker 自查 type-check 通過後
git add scripts/bat-terminal.mjs electron/remote/protocol.ts electron/remote/remote-server.ts electron/main.ts src/stores/<相關 store>.ts _ct-workorders/T0137-*.md _ct-workorders/BUG-031-*.md
git commit -m "fix: BUG-031 — external PTY allocation to active workspace + --workspace flag

Default behavior: bat-terminal.mjs created PTY now goes to ACTIVE workspace
(was: always default workspace, breaking auto-session BAT routing UX).
Optional --workspace <id> flag for explicit assignment.

Closes BUG-031 pending runtime verification after BAT rebuild + reinstall."
```

回塔台說：「T0137 程式碼修復完成，commit <hash>。**請使用者 rebuild + 重裝 BAT**，再開新工單做 runtime acceptance（這個修復要重啟 RemoteServer 才生效）。」

---

## 工單回報區（Worker 填寫）

### 根因定位

`src/stores/workspace-store.ts:326-335`（修改前）：

```typescript
addExternalTerminal(info: { id: string; cwd: string; command?: string }): TerminalInstance | null {
  if (this.state.terminals.some(t => t.id === info.id)) return null
  // Find workspace by matching cwd, fallback to active workspace
  let workspace = this.state.workspaces.find(w => info.cwd.startsWith(w.folderPath))
  if (!workspace) {
    workspace = this.state.workspaces.find(w => w.id === this.state.activeWorkspaceId)
  }
  if (!workspace) return null
```

**BUG-031 root cause**：`cwd.startsWith(folderPath)` 以 **第一個 prefix match** 為準，不是 longest match。當使用者同時打開 parent folder workspace（如 `D:/ForgejoGit/BMad-Guide`）和子專案 workspace（如 `D:/ForgejoGit/BMad-Guide/better-agent-terminal/better-agent-terminal`）時，Tower 派發 Worker 的 cwd 會同時 match 兩者，`find()` 回傳工作區陣列中較早出現的那個（通常是 parent），導致 PTY 跑錯 workspace。即使 active workspace 是子專案，cwd-match 優先於 active-fallback，所以 BUG-031 表現為「PTY 總是跑到 default / 較早建立的 workspace」。

### 修改位置

| 檔案 | 行號 | 變更 |
|------|------|------|
| `src/stores/workspace-store.ts` | 324-340 | `addExternalTerminal(info)` 加 `workspaceId?: string` 參數；新分配邏輯：**explicit workspaceId → active workspace**，移除 cwd-match |
| `electron/main.ts` | 1323-1354 | `terminal:create-with-command` handler 接受 `workspaceId?: string`；廣播 `terminal:created-externally` payload 帶上 workspaceId |
| `electron/preload.ts` | 24-25, 37-41 | `createWithCommand` / `onCreatedExternally` 型別簽章加 `workspaceId?` |
| `src/types/electron.d.ts` | 21-25 | `ElectronAPI.pty.createWithCommand` 型別加 workspaceId；補上原本缺的 `onCreatedExternally` / `onTerminalNotified` 宣告 |
| `src/App.tsx` | 444-452 | `onCreatedExternally` handler 把 `info`（含 workspaceId）直接轉給 `addExternalTerminal`；debug log 包含 workspaceId |
| `scripts/bat-terminal.mjs` | 14-16, 49-51, 83-91, 277-278 | 新增 `--workspace <id>` 旗標；解析後寫入 invoke payload 的 workspaceId 欄位 |

### 新行為規格

- **Goal 1（預設）**：`bat-terminal.mjs` 建立的 PTY 永遠落在 **currently active workspace**，與 cwd 無關。
- **Goal 2（顯式）**：`bat-terminal.mjs --workspace <id>` → PTY 落在指定 workspace；若 id 在 UI 中不存在則 fallback 回 active workspace（避免 payload 壞導致 PTY 完全消失）。
- 向後相容：所有現有 caller（未帶 workspaceId）行為等同 Goal 1，比原本 cwd-match 更可預期。

### 驗證

- ✅ `npx vite build`（T0137 關聯區段的 type-check 無新增錯誤；既有 legacy type-errors 與本修復無關，詳下方）
- ⚠️ **Runtime 驗證無法在本 session 做**：修改涉及 main process + preload + renderer，必須 rebuild + 重裝 BAT 才生效。當前 BAT 仍是舊版（BUG-031 還在），測試只能證明「程式碼會編譯」，不能證明「行為已修正」。

#### Legacy type-errors 說明
`npx tsc --noEmit` 顯示 ~60 個既有錯誤（例如 `ElectronAPI.profile` / `ElectronAPI.snippet` 未宣告、`SessionMeta` 欄位缺失等），**全部與 T0137 scope 無關**，為 `src/types/electron.d.ts` 長期失同步造成。僅針對本工單修改的 `electron.d.ts:21` 周邊無錯誤。Vite build 通過（esbuild 不做 strict 型別檢查）。

### 遭遇問題

無。實作路徑與工單設計完全吻合，pipeline 每一環（CLI → protocol → main → preload → d.ts → renderer → store）都只加一個 optional 欄位即可。

### 互動紀錄

無（整個 session 按工單直接執行，沒有需要向使用者確認的決策）。

### Renew 歷程

無。

### 回報時間

2026-04-17 03:02 (UTC+8)

### 給塔台的交接訊息

⚠️ **此修復屬 main process + renderer IPC 邏輯，當前執行中的 BAT 不會 hot-reload**。建議流程：

1. 提醒使用者：
   ```bash
   cd D:/ForgejoGit/BMad-Guide/better-agent-terminal/better-agent-terminal
   npm run build          # vite + electron-builder
   # 或直接：npm run build:dir 做 unpacked 版本快速驗證
   ```
2. 安裝新版（覆蓋當前 BAT 安裝）
3. 重啟 BAT（會清掉所有 PTY，包含先前 BUG-031 留下的「跑到 BMad-Guide 孤兒 Worker」）
4. 開新工單做 runtime acceptance：
   - **Test 1（Goal 1）**：active workspace = better-agent-terminal → Tower 派工 → 新 Worker PTY **應該出現在 better-agent-terminal 的 tab 列，不是 BMad-Guide**
   - **Test 2（Goal 2）**：`node scripts/bat-terminal.mjs --workspace <bmad-guide-ws-id> claude "/ct-status"` → PTY 應落在指定 workspace（即使 active 是其他）
   - **Test 3（fallback）**：`--workspace <不存在的 id>` → 應 fallback 到 active workspace（不應消失）

BUG-031 狀態：⏳ FIXING → ✅ FIXED（等 runtime 驗收後由使用者決定 → CLOSED）。
