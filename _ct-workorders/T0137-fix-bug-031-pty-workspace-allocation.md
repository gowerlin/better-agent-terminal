# 工單 T0137-fix-bug-031-pty-workspace-allocation

## 元資料
- **工單編號**：T0137
- **任務名稱**：BUG-031 修復 — 外部 PTY workspace 分配（active 預設 + `--workspace` 旗標）
- **狀態**：📋 TODO
- **類型**：修復（bug fix）+ 小幅功能擴充（CLI 旗標）
- **建立時間**：2026-04-17 02:48 (UTC+8)
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

> Worker 完成後在此填寫修復細節 + 根因定位 + 測試結果

(待 Worker 填寫)
