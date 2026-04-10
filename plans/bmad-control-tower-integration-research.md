# BMad Control Tower × BAT 整合研究

> 研究日期：2026-04-10
> 分支：research/bmad-control-tower-integration

---

## 1. BMad Control Tower 核心架構概述

### 1.1 角色分離：Tower / Worker

Control Tower 採用嚴格的指揮-執行分離模式：

| 角色 | 職責 | 限制 |
|------|------|------|
| **Tower** | 需求對齊、工單派發、進度追蹤、品質閘門 | **禁止**直接讀寫程式碼、修改檔案 |
| **Worker (ct-exec)** | 在獨立 sub-session 執行工單指令 | 只做工單內指定的工作 |

### 1.2 通訊媒介：檔案驅動（File-Driven）

所有 Tower ↔ Worker 的通訊透過 **磁碟上的 .md 工單檔案**，不依賴任何 IPC、WebSocket 或 API：

```
_ct-workorders/
├── T0001-create-project-context.md   ← 工單（派發 + 回報都在此檔）
├── _tower-state.md                   ← 塔台記憶/進度快照
├── _decisions.md                     ← 決策日誌
├── _learnings.md                     ← 學習紀錄
├── _tower-registry.md                ← 多塔台登記（並行時）
├── _cross-tower-notes.md             ← 跨塔台留言板
└── sprint-status.yaml                ← Sprint 進度
```

### 1.3 Auto-Session 機制

Tower 派發工單後，透過 Bash 白名單自動開新 session：

| 環境 | 指令 |
|------|------|
| Windows Terminal | `wt -w 0 nt claude "/ct-exec T0001"` |
| VS Code 終端 | `claude "/ct-exec T0001"` |
| macOS Terminal | `open -a Terminal claude "/ct-exec T0001"` |
| 降級：剪貼簿 | `pwsh -Command "Set-Clipboard -Value '/ct-exec T0001'"` |

### 1.4 工單生命週期

```
PENDING → IN_PROGRESS → DONE / FAILED / BLOCKED / PARTIAL
                     ↘ INTERRUPTED（session 中斷）
```

---

## 2. BAT 現有架構的對應能力

### 2.1 Agent Runtime 抽象

BAT 已有 `AgentDefinition` + `AgentProvider` + `AgentSession` 抽象層，支援：
- **integrated** (claude-code SDK)：完整結構化事件
- **terminal-driven** (claude-cli, codex, gemini, copilot)：PTY 驅動
- **hybrid**：混合模式

### 2.2 多終端 + 多工作區

每個 Workspace 有多個 Terminal/Agent instance，ThumbnailBar 提供視覺化管理。

### 2.3 IPC / Remote 通道

`electron/remote/protocol.ts` 定義了完整的跨進程通道：pty、claude session、git、fs、workspace 等。

### 2.4 Worktree 支援

BAT 內建 Git Worktree 管理，可為 Agent 創建隔離工作目錄。

---

## 3. 整合方案分析

### 方案 A：BAT 作為 Tower 的終端環境（最小侵入）

**概念**：讓 Control Tower 偵測到 BAT 作為終端環境，BAT 無需改動核心邏輯。

**Tower 側偵測**：
- `auto-session` 環境偵測新增 BAT 類型
- Tower 使用 BAT 的 IPC 開新終端分頁（而非 `wt` 指令）

**BAT 側實現**：
- 暴露 `electronAPI.terminal.createWithCommand(cwd, command)` IPC
- Tower 工單派發時呼叫此 API 自動開新終端 + 執行 `/ct-exec T####`

**優點**：最小改動，Tower 架構不變
**缺點**：Tower 仍是純文字 AI session，無法利用 BAT 的結構化 UI

---

### 方案 B：BAT 提供 Control Tower 視覺化面板（中度整合）

**概念**：BAT 新增專用 Panel 顯示 Tower 狀態，讀取 `_ct-workorders/` 目錄做即時呈現。

**新增元件**：
1. **ControlTowerPanel**：讀取 `_ct-workorders/` 顯示工單列表、狀態、Sprint 進度
2. **WorkOrderViewer**：顯示單張工單詳情、回報狀態
3. **TowerStatusBar**：在 StatusLine 顯示目前工單數、進行中數量

**資料流**：
```
_ct-workorders/*.md  ──(fs:watch)──→  ControlTowerPanel (React)
                                          ├── 工單列表（狀態色碼）
                                          ├── Sprint 進度條
                                          └── 一鍵開 Worker session
```

**功能**：
- 監聽 `_ct-workorders/` 目錄變化，即時更新面板
- 解析工單 Markdown 前置資料（frontmatter）取得狀態
- 點擊工單 → 開新終端 + 自動送入 `/ct-exec T####`
- Sprint 進度視覺化（yaml 解析 `sprint-status.yaml`）

**優點**：豐富的視覺整合，Tower + BAT 互補
**缺點**：需解析 Tower 的工單格式，格式變化需追蹤

---

### 方案 C：BAT 原生 Tower 模式（深度整合）

**概念**：將 Tower 邏輯嵌入 BAT，Tower session 用 BAT 的結構化 UI 取代純文字。

**架構**：
```
BAT Window
├── Tower Panel（指揮台）
│   ├── 需求對齊對話區
│   ├── 工單列表 + 狀態
│   ├── Sprint 看板
│   └── 派發按鈕 → 自動開 Worker 分頁
├── Worker Terminal 1（ct-exec T0001）
├── Worker Terminal 2（ct-exec T0002）
└── Worker Terminal 3（開發中...）
```

**優點**：一體化體驗，Tower 和 Worker 在同一視窗
**缺點**：耦合度高，開發成本大，Tower skill 更新時需同步

---

## 4. 推薦整合路線圖

### Phase 1：環境偵測 + Auto-Session 整合（方案 A）
- BAT 暴露 IPC：`bat:create-terminal-with-command`
- Control Tower SKILL.md 的 auto-session 偵測新增 BAT 類型
- 偵測方式：`$BAT_SESSION` 或 `$TERM_PROGRAM == "better-agent-terminal"`
- Tower 派發工單時，BAT 自動開新 terminal + 注入 `/ct-exec T####`

**BAT 改動**：
1. main.ts 設定環境變數 `BAT_SESSION=1`, `TERM_PROGRAM=better-agent-terminal`（對 PTY 子進程）
2. 新增 IPC handler `terminal:create-with-command(workspaceId, command, cwd?)`
3. 該 handler 等同 `handleAddTerminal()` + 自動在新終端寫入 command

### Phase 2：工單狀態面板（方案 B 部分）
- 新增 `ControlTowerPanel` 元件，放入 docking 系統
- 使用 `fs:watch` 監聽 `_ct-workorders/` 目錄
- 解析工單 .md 的 metadata（狀態、時間、預估）
- 顯示工單卡片列表 + 狀態色碼
- 點擊工單 → 一鍵開 `/ct-exec T####` 終端

### Phase 3：Sprint 視覺化 + Tower 對話整合
- 解析 `sprint-status.yaml` 顯示看板/甘特圖
- Tower Agent session 的結構化訊息呈現
- 工單完成自動通知 Tower session

---

## 5. 關鍵整合介面

### 5.1 BAT 需暴露的新介面

```typescript
// Phase 1: 環境變數
// pty-manager.ts: createPty 時設定
env.BAT_SESSION = '1'
env.TERM_PROGRAM = 'better-agent-terminal'
env.BAT_WORKSPACE_ID = workspaceId

// Phase 1: IPC handler
ipcMain.handle('terminal:create-with-command', async (_event, opts: {
  workspaceId: string,
  command: string,
  cwd?: string,
  agentPreset?: AgentPresetId,
}) => {
  // 建立新終端 → 寫入 command 到 PTY
})
```

### 5.2 Control Tower 需修改的部分

```
control-tower/references/auto-session.md:
  偵測優先級新增：
  | 0 | BAT (Better Agent Terminal) | $BAT_SESSION 存在 | 透過 BAT IPC 開新分頁 |
```

### 5.3 工單格式解析（Phase 2 需要）

工單 .md 的 metadata 可用正則解析：
```
- **工單編號**：T0001
- **狀態**：DONE
- **建立時間**：2026-04-10 15:30:00 (UTC+8)
```

或考慮約定 YAML frontmatter 格式以便結構化解析。

---

## 6. 待確認事項 — 驗證計畫

### Q1: Tower auto-session 白名單能否透過 Electron IPC 開新分頁？

**結論**：**可行，但需 BAT 提供 CLI 入口作為橋接**

**驗證步驟**：
1. 在 `pty-manager.ts` 的 `create()` 中，把 `TERM_PROGRAM` 從 `better-terminal` 改為 `better-agent-terminal`，並新增 `BAT_SESSION=1`
2. 在 BAT 終端中開 `claude` session，執行 `echo $BAT_SESSION` 和 `echo $TERM_PROGRAM` 確認子進程能拿到
3. Tower auto-session 機制是 **Bash 白名單**（直接 spawn 指令），不走 Electron IPC
4. 因此需提供 CLI 入口：`bat-cli --exec "command" --workspace <id>` 或透過 **deep link** (`bat://exec?cmd=...`)
5. 最簡方案：BAT 監聽 local socket/named pipe，Tower 用 `curl` 或 `nc` 送指令

**測試腳本**：
```bash
# 驗證 env 在 PTY 子進程中可見
# 在 BAT 終端內執行：
echo "BAT_SESSION=$BAT_SESSION"
echo "TERM_PROGRAM=$TERM_PROGRAM"
# 預期：BAT_SESSION=1, TERM_PROGRAM=better-agent-terminal
```

---

### Q2: Tower v3 工單格式是否穩定？

**結論**：**格式半穩定，建議容錯解析**

**驗證步驟**：
1. 從 `D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\control-tower\references\work-order-template.md` 取得工單模板
2. 寫解析函式，用正則提取 metadata（工單編號、狀態、建立時間）
3. 對 BMad-Guide repo 的 git log 檢查 `work-order-template.md` 的變更頻率
4. 若 frontmatter (YAML) 存在則優先用：結構化解析；否則 fallback 正則

**測試腳本**：
```typescript
// tests/workorder-parser.test.ts
const sampleWorkOrder = `
- **工單編號**：T0001
- **標題**：建立專案上下文
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-10 15:30:00 (UTC+8)
- **預估複雜度**：M
`
// 驗證解析出 { id: 'T0001', status: 'IN_PROGRESS', ... }
```

```bash
# 檢查 BMad-Guide 工單模板歷史變更次數
cd "D:\ForgejoGit\BMad-Guide"
git log --oneline -- "BMad-Control-Tower/control-tower/references/work-order-template.md" | wc -l
```

---

### Q3: BAT Workspace ↔ Tower project-context 如何映射？

**結論**：**1:1 最自然 — 一個 BAT Workspace 對應一個 `_ct-workorders/` 目錄**

**驗證步驟**：
1. 確認 Tower 的 `_ct-workorders/` 位於專案根目錄
2. BAT 的 `workspace.folderPath` 即為專案根 → `path.join(folderPath, '_ct-workorders')` 就是工單目錄
3. 驗證：建一個測試 workspace，手動建 `_ct-workorders/` 目錄 + 放一個假工單 .md
4. 確認 `fs.existsSync(path.join(workspace.folderPath, '_ct-workorders'))` 可偵測

**測試腳本**：
```bash
# 在任一專案目錄建立模擬工單
mkdir -p _ct-workorders
cat > _ct-workorders/T0001-test.md << 'EOF'
- **工單編號**：T0001
- **標題**：測試工單
- **狀態**：PENDING
EOF
# 在 BAT 中開此目錄為 Workspace → 驗證 ControlTowerPanel 能偵測到
```

---

### Q4: cc-launcher 與 BAT SkillsPanel 是否需要對接？

**結論**：**Phase 1-2 不需要，可列為 Phase 3+ 考慮**

**驗證步驟**：
1. 比較功能重疊度：
   - BAT SkillsPanel：顯示 `~/.claude/skills/` 目錄內容、skill YAML 預覽
   - cc-launcher：skill vault 管理（安裝/移除/更新/版本控制）
2. 確認 cc-launcher 是否有 REST API 可供 BAT 呼叫
3. 若 cc-launcher-desktop (Tauri) 已啟動，BAT 不應重複此功能

**測試腳本**：
```bash
# 檢查 cc-launcher 是否提供 API
cd "D:\ForgejoGit\BMad-Guide\cc-launcher"
grep -r "app.get\|app.post\|router\." src/ --include="*.ts" | head -20
# 確認有哪些 endpoint 可用
```

---

### Q5: Remote 場景下 `fs:watch` 對 `_ct-workorders/` 是否可行？

**結論**：**已有建設，可行**

**驗證步驟**：
1. BAT Remote Protocol 已有 `fs:watch`、`fs:unwatch`、`fs:changed` channel（見 `protocol.ts`）
2. Remote Server 端執行 `fs.watch()`，透過 broadcast 推送 `fs:changed` 事件
3. 驗證：連線至 Remote BAT instance → watch 一個目錄 → 在 remote 端新增檔案 → 確認 client 收到 event

**測試腳本**：
```typescript
// 在 renderer 中測試
const watchId = await window.electronAPI.fs.watch(
  path.join(workspace.folderPath, '_ct-workorders')
)
window.electronAPI.fs.onChanged((event) => {
  console.log('Work order changed:', event)
})
// 手動在 _ct-workorders/ 新增檔案 → 確認 console 有輸出
```

---

## 6.1 驗證優先級與排程

| # | 問題 | 阻塞階段 | 驗證難度 | 優先級 |
|---|------|----------|----------|--------|
| Q1 | Auto-session 偵測 | Phase 1 | 低（改 env 即可） | **P0** |
| Q3 | Workspace 映射 | Phase 2 | 低（目錄偵測） | **P0** |
| Q2 | 工單格式穩定性 | Phase 2 | 中（需寫 parser） | **P1** |
| Q5 | Remote fs:watch | Phase 2+ | 中（需 remote env） | **P2** |
| Q4 | cc-launcher 對接 | Phase 3+ | 低（功能比較） | **P3** |

> **建議執行順序**：Q1 → Q3 → Q2 → Q5 → Q4
> Q1 + Q3 在 Phase 1 分支就可驗證（只改 env + 偵測目錄）
> Q2 在 Phase 2 開始時驗證（寫 parser 前先確認格式）

---

## 7. 參考連結

| 資源 | 路徑 |
|------|------|
| Control Tower SKILL.md | `D:\ForgejoGit\BMad-Guide\BMad-Control-Tower\control-tower\SKILL.md` |
| Auto-Session 規格 | `BMad-Control-Tower\control-tower\references\auto-session.md` |
| 工單系統 | `BMad-Control-Tower\control-tower\references\work-order-system.md` |
| 工單模板 | `BMad-Control-Tower\control-tower\references\work-order-template.md` |
| 多塔台協議 | `BMad-Control-Tower\control-tower\references\multi-tower-protocol.md` |
| ct-exec SKILL | `BMad-Control-Tower\ct-exec\SKILL.md` |
| cc-launcher | `D:\ForgejoGit\BMad-Guide\cc-launcher\README.md` |
| cc-launcher-desktop | `D:\ForgejoGit\BMad-Guide\cc-launcher-desktop\README.md` |
| BAT Agent Runtime Types | `electron\agent-runtime\types.ts` |
| BAT Remote Protocol | `electron\remote\protocol.ts` |
