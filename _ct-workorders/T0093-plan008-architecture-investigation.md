# 工單 T0093 — PLAN-008 架構調查：狀態持久化 + PTY 脫鉤

## 元資料
- **工單編號**：T0093
- **任務名稱**：PLAN-008 架構調查：狀態持久化 + PTY 脫鉤
- **狀態**��DONE
- **開始時間**：2026-04-13 15:14 UTC+8
- **建立時間**：2026-04-13 15:30 UTC+8
- **相關票號**：PLAN-008

---

## 🎯 目標

**本工單只做調查 + 提案，不實作任何修改。**

深入研究 BAT 現有架構，評估三種 PTY 脫鉤方案，並就狀態持久化提出具體設計，回報塔台讓使用者決策。

---

## 📋 背景

詳見 PLAN-008。核心需求：
1. BAT 全狀態即時 + 定時持久化
2. PTY 終端進程不隨主進程關閉
3. 孤兒進程 TTL 回收
4. 啟動時詢問復原

---

## ⚠️ 跨平台強制約束

**所有方案必須支援 Windows / macOS / Linux，並在 runtime 自動偵測平台。**

### 跨平台 IPC 通訊機制對照

| 機制 | Windows | macOS | Linux | 備注 |
|------|---------|-------|-------|------|
| Unix socket (`AF_UNIX`) | ✅ Win10 1903+ | ✅ | ✅ | 需確認 Electron 版本對應 Windows 最低要求 |
| Named pipe (`\\.\pipe\`) | ✅ | ❌ | ❌ | Windows 專屬 |
| TCP localhost | ✅ | ✅ | ✅ | 全平台，但需 port 管理 |
| `child_process.fork` IPC | ✅ | ✅ | ✅ | Node.js 內建，訊息傳遞模式 |

### 平台自動偵測範本

```typescript
import os from 'os'

function getIPCPath(id: string): string {
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\bat-terminal-${id}`
  }
  return path.join(app.getPath('userData'), `bat-terminal-${id}.sock`)
}
```

### 各方案跨平台影響評估重點

| 方案 | 跨平台挑戰 |
|------|-----------|
| A 獨立 Server | IPC 需區分 Win32 named pipe vs Unix socket，需封裝統一介面 |
| B tmux 後端 | **Windows 無原生 tmux**，需偵測 WSL / Cygwin，覆蓋率不完整 → 不建議 |
| C OS-level 脫鉤 | `detached` 行為在 Windows/Unix 不同（Win: job object，Unix: setsid），需個別處理 |

> 請在回報中明確說明每方案在三個平台的可行性，並確認 BAT 現有 Electron 版本對應的 Windows 最低版本支援。

**現有基礎**（已知）：
- `rest-session` / `wake-session`：保留 `sdkSessionId`，Agent 可自動接續
- `/resume` 指令：手動恢復 Claude SDK session
- `electron-store` 或 `localStorage`：確認是否已有狀態儲存機制

---

## ✅ 任務清單

### Part A：盤點現有狀態管理

```bash
# 找現有狀態儲存
grep -r "electron-store\|localStorage\|writeFile\|userData\|app.getPath\|persistState\|saveState" \
  electron/ src/ --include="*.ts" --include="*.tsx" -l

# 找 workspace 相關狀態
grep -r "workspace\|Workspace\|addWorkspace\|removeWorkspace" \
  src/ --include="*.tsx" --include="*.ts" -l

# 找現有 PTY 進程管理
grep -r "node-pty\|pty\.spawn\|IPtyForkOptions\|detached\|unref" \
  electron/ --include="*.ts" -l
```

調查項目：
- [ ] 目前是否有任何狀態持久化機制（`electron-store` / `localStorage` / JSON 檔）？
- [ ] 工作區狀態存在哪裡（React state / Zustand / 其他）？
- [ ] PTY 進程如何生成（`pty.spawn` 參數，是否有 `detached` 選項）？
- [ ] 主進程關閉時是否有 `app.on('before-quit')` 清理邏輯？
- [ ] `electron/main.ts` 的 window 管理方式（關閉時做了什麼）？

### Part B：評估三種 PTY 脫鉤方案

#### 方案 A：獨立 Terminal Server 進程

**架構**：
```
BAT 主進程
    └─ IPC/Unix Socket ─→ terminal-server.js（獨立 Node.js 進程）
                              ├─ PTY 1（bash @ /workspace/A）
                              ├─ PTY 2（zsh @ /workspace/B）
                              └─ PTY 3（PowerShell @ /workspace/C）

BAT 關閉 → terminal-server.js 繼續存活
BAT 重啟 → 重連 terminal-server.js，取回 PTY 輸出流
```

**評估重點**：
- terminal-server 如何持續存活（`detached: true` + `unref()`）
- BAT 與 server 的通訊協定（Unix socket / named pipe / TCP localhost）
- Windows 的 named pipe 可行性（`\\.\pipe\bat-terminal-server`）
- Electron `userData` 路徑下管理 server PID 的可行性
- 確認 node-pty 在獨立進程中是否能正常運作

**調查指令**：
```bash
# 確認 node-pty 版本與 API
cat package.json | grep "node-pty"
grep -r "pty.spawn\|IPty\b" electron/ --include="*.ts" -A 5
```

#### 方案 B：tmux / screen 作為 PTY 後端

**架構**：
```
BAT → 建立 tmux session → 在 tmux pane 中執行命令
BAT 關閉 → tmux session 繼續存活
BAT 重啟 → attach 到現有 tmux session
```

**評估重點**：
- Windows 是否有可用的 tmux（WSL tmux、Cygwin tmux）
- 現有 BAT 使用 node-pty 的程式碼需要多大幅度重寫
- tmux 的程式化控制（`tmux new-session`, `tmux send-keys` 等）
- 跨平台一致性問題（macOS/Linux 有 tmux，Windows 需要替代方案）

#### 方案 C：OS-level 進程脫鉤（`detached: true` + Unix Socket 重連）

**架構**：
```typescript
// node-pty 生成時設定 detached
const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-256color',
  cwd: workingDir,
  env: process.env,
  // node-pty 不直接支援 detached，但可透過包裝器
})

// 輸出轉存至 socket 或 ring buffer
const socketPath = `${userData}/pty-${id}.sock`
// 子進程掛接到 Unix socket，BAT 重啟後重連讀取
```

**評估重點**：
- node-pty 是否支援 Unix socket 模式或類似機制
- ring buffer 實作（保留最後 N 行供重連後重播）
- Windows 的 Unix socket 支援（Windows 10 1903+ 支援 AF_UNIX）
- 進程存活但無人連接時的資源消耗

### Part C：狀態持久化設計

不論選哪個 PTY 方案，狀態儲存的設計是共通的。

**建議儲存格式**（`userData/bat-state.json`）：

```json
{
  "version": 1,
  "savedAt": "ISO-8601",
  "activeWorkspaceId": "ws-001",
  "workspaces": [
    {
      "id": "ws-001",
      "name": "ForgejoGit",
      "path": "/d/ForgejoGit",
      "terminals": [
        {
          "id": "term-001",
          "shell": "bash",
          "cwd": "/d/ForgejoGit/project",
          "title": "main",
          "ptyPid": 12345,
          "scrollBuffer": "最後 N 行（限制大小）"
        }
      ],
      "agentSessions": [
        {
          "id": "agent-001",
          "sdkSessionId": "sess_xxxx",
          "title": "Claude Agent V1",
          "lastActivity": "ISO-8601"
        }
      ],
      "layout": {
        "type": "split",
        "direction": "horizontal",
        "ratio": 0.5
      }
    }
  ]
}
```

**儲存觸發**：
- 即時：`workspace.add/remove`、`tab.add/remove/switch`、`terminal.cwd-change`
- 定時：每 30 秒 `setInterval`（保底）
- 關閉前：`app.on('before-quit')` 最後一次強制寫入

**孤兒回收 registry**（`userData/bat-pty-registry.json`）：
```json
{
  "ptys": [
    { "pid": 12345, "workspaceId": "ws-001", "termId": "term-001", "lastSeen": "ISO-8601" }
  ]
}
```

### Part D：評估表 + 推薦

填寫最終評估：

| 方案 | Windows | macOS | Linux | 改動量 | 統一介面難度 | 推薦 |
|------|---------|-------|-------|--------|-------------|------|
| A 獨立 Server | | | | | | |
| B tmux 後端 | | | | | | |
| C OS-level 脫鉤 | | | | | | |

> 評分說明：✅ 可行 / ⚠️ 有條件可行（說明條件）/ ❌ 不可行

### Part E：回報格式

1. **現有狀態管理摘要**（目前有無持久化、存在哪裡）
2. **PTY 現有架構摘要**（spawn 方式、關閉行為）
3. **三方案可行性評估**
4. **推薦方案 + 理由**
5. **狀態儲存格式建議**（是否需調整上方 JSON 設計）
6. **實作分 Phase 估時**
7. **需使用者決定的問題**

---

## ⚠️ 重要約束

- **禁止修改任何程式碼**
- 只讀取、分析、提案

---

## 🔍 驗收標準

- [ ] 現有 PTY 架構（spawn 方式、detached 選項）已確認
- [ ] 現有狀態儲存機制已確認
- [ ] 三方案均有跨平台可行性評估
- [ ] 有明確推薦方案 + 理由
- [ ] 有 Phase 分拆的實作估時
- [ ] 列出需使用者決策的問題

---

## 📝 回報區（Sub-session 填寫）

**完成時間**：2026-04-13 15:20 UTC+8

---

### 1. 現有狀態管理摘要

**狀態持久化**：✅ **有**，使用直接 JSON 檔案寫入（無 `electron-store`）

| 儲存位置 | 管理模組 | 內容 |
|---------|---------|------|
| `userData/windows.json` | `WindowRegistry` | workspaces、terminals、activeIds、window bounds |
| `userData/profiles/*.json` | `ProfileManager` (V2) | 多視窗 snapshot，每個 window 含 workspaces + terminals |
| `userData/workspaces.json` | 舊版（已遷移至 windows.json） | 向後相容遷移邏輯保留 |
| `userData/settings.json` | 直接 `writeFile` | 使用者設定 |
| `userData/custom-clis.json` | 直接 `writeFile` | 自訂 CLI 工具定義 |
| `userData/snippets.json` | `SnippetDB` | 程式碼片段 |

**持久化的資料**：
- workspace：`id`, `name`, `folderPath`, `createdAt`
- terminal：`id`, `workspaceId`, `type`, `agentPreset`, `title`, `alias`, `cwd`, `sdkSessionId`, `model`, `sessionMeta`
- 視窗狀態：`activeWorkspaceId`, `activeGroup`, `activeTerminalId`, `bounds`

**未持久化的資料**：
- ❌ 終端 scroll buffer 內容（xterm.js scrollback 僅在記憶體中）
- ❌ PTY 進程（關閉即銷毀）
- ❌ 終端輸出歷史
- ❌ UI 佈局狀態（split 方向、比例等）

**儲存觸發方式**：
- **事件驅動**：`workspace-store.ts` 每次狀態變更都呼叫 `this.save()`（~15 個觸發點）
- **before-quit**：`app.on('before-quit')` 存所有 profile snapshots
- **視窗 bounds**：debounced 1s 儲存 move/resize
- ❌ **無定時儲存**：無 `setInterval` 保底機制 → crash 時可能遺失最後一次事件驅動儲存後的變更

---

### 2. 現有 PTY 架構摘要

**PTY 引擎**：`@lydell/node-pty` v1.1.0（node-pty maintained fork）

**Spawn 方式**：
```typescript
pty.spawn(shell, args, {
  name: 'xterm-256color',
  cols: 120, rows: 30,
  cwd,
  env: envWithUtf8  // 含 LANG, LC_ALL, TERM, BAT_SESSION 等
})
// ⚠️ 無 detached 選項、無 socket 模式
```

**平台差異處理**：
| 平台 | Shell | Args |
|------|-------|------|
| Windows PowerShell | `pwsh`/`powershell` | `-ExecutionPolicy Bypass -NoLogo` |
| Windows Git Bash | `bash` | `--login -i` |
| macOS / Linux | default shell | `-l -i` |

**清理行為**：
- `PtyManager.kill(id)`：`pty.kill()` + Windows 額外 `taskkill /F /T /PID`
- `PtyManager.dispose()`：遍歷所有 instances 逐一 kill
- `cleanupAllProcesses()`：kill 所有 PTY + Claude Agent + Remote Server

**關閉流程**：
```
before-quit → save profiles → cleanupAllProcesses() → app.quit()
window-all-closed → cleanupAllProcesses() → app.quit() → setTimeout(process.exit, 2000)
```

**Agent 會話**：
- `sdkSessionId` 追蹤在 `claude-agent-manager.ts`（`sdkSessionIds` Map）
- 已持久化到 terminal metadata → 重啟可帶入 resume
- rest/wake/resume 機制存在，但 PTY 進程不存活則 CLI 已終止

---

### 3. 三方案跨平台可行性評估

| 方案 | Windows | macOS | Linux | 改動量 | 統一介面難度 | 推薦 |
|------|---------|-------|-------|--------|-------------|------|
| A 獨立 Server | ✅ Named pipe + TCP | ✅ Unix socket | ✅ Unix socket | 中高 | 中（封裝 IPC 層） | ⭐ 推薦 |
| B tmux 後端 | ❌ 無原生 tmux | ✅ Homebrew | ✅ apt/yum | 中 | 高（Windows 缺口） | ❌ 不推薦 |
| C OS-level 脫鉤 | ⚠️ 需 wrapper | ⚠️ 需 wrapper | ⚠️ 需 wrapper | 高 | 高（本質退化為 A） | ⚠️ 不獨立推薦 |

#### 方案 A 詳細評估：獨立 Terminal Server 進程

**架構**：
- 獨立 Node.js 進程 `bat-terminal-server.js`，以 `child_process.fork` 啟動（內建 IPC）
- Server 內部使用 `@lydell/node-pty` 管理所有 PTY 實例
- BAT 主進程透過 `child_process.fork` IPC channel 通訊
- Server 設定 `detached: true` + `unref()` 讓其在主進程關閉後存活

**IPC 策略（推薦 fork IPC 為主，fallback TCP）**：

| 階段 | IPC 方式 | 原因 |
|------|---------|------|
| 初次啟動 | `child_process.fork` 內建 IPC | 全平台一致、零設定、自動 JSON 序列化 |
| 重連（主進程重啟） | TCP localhost | fork IPC 斷開後需 fallback，TCP 全平台可靠 |
| 備選 | Unix socket (macOS/Linux) + Named pipe (Win) | 效能更好但需平台分支 |

**Windows 可行性**：
- `child_process.fork` + `detached: true` ✅ 完全支援
- TCP localhost ✅ 全平台
- Named pipe ✅ Windows 專屬高效選項
- Electron 28 (Chromium 120) → Windows 10+ → AF_UNIX ✅ Win10 1903+

**macOS/Linux 可行性**：
- `child_process.fork` ✅
- Unix socket ✅ 原生支援
- TCP localhost ✅ fallback

**關鍵技術要點**：
1. node-pty 在獨立 Node 進程中可正常運作（已是 native addon）
2. 需實作 ring buffer 保留最後 N 行輸出供重連重播
3. Server 需寫 PID file 到 `userData/bat-pty-server.pid` 供重連偵測
4. 輸出轉發需高效二進制協議（或 JSON-RPC over fork IPC）

**改動範圍**：
- 新增：`electron/terminal-server.ts`（獨立進程）
- 重構：`electron/pty-manager.ts`（從直接 spawn 改為 proxy to server）
- 修改：`electron/main.ts`（startup 啟動 server / 重連邏輯）

#### 方案 B 詳細評估：tmux 後端

**致命缺陷**：Windows 無原生 tmux
- WSL 中的 tmux 只能管 WSL 內的 shell，無法管 native Windows 進程
- Cygwin/MSYS2 tmux 不穩定，非標準使用場景
- 需維護兩套邏輯（tmux for macOS/Linux，另一套 for Windows）→ 維護成本不可接受

**結論**：❌ 不推薦，跨平台覆蓋率不足

#### 方案 C ���細評估：OS-level 進程脫鉤

**核心問題**：`@lydell/node-pty` 的 `IPtyForkOptions` **沒有 `detached` 選項**
- node-pty 使用 native PTY API（Linux: forkpty, macOS: forkpty, Windows: ConPTY）
- 這些 API 不支援 detached mode — PTY master fd 綁定在建立它的進程上
- 要 detach，必須在一個 wrapper 進程中建立 PTY → 本質退化為方案 A

**結論**：⚠️ 技術上可行但退化為不成熟的方案 A，不建議獨立實施

---

### 4. 推薦方案

**推薦：方案 A（獨立 Terminal Server 進程）**

**推薦理由**：
1. **唯一全平台可行方案**：三個 OS 都有清晰實作路徑
2. **架構清晰**：Server/Client 分離，職責明確
3. **IPC 選擇豐富**：`child_process.fork` 為主（零設定）、TCP 為重連 fallback
4. **與現有程式碼相容**：`pty-manager.ts` 只需改為 proxy，其餘 UI/store 不需改動
5. **可獨立部署**：Server 可獨立升級、debug、監控
6. **方案 B/C 都有致命缺陷**：B 缺 Windows 覆蓋、C 退化為 A 的不成熟版

---

### 5. 狀態儲存格式建議

工單中建議的 `bat-state.json` schema **大致可行**，但建議以下調整：

**不需新增 `bat-state.json`**：現有 `windows.json` + `profiles/*.json` 已覆蓋 workspace/terminal 狀態，只需**擴充現有 schema**。

**建議擴充項目**：

```diff
// WindowEntry (window-registry.ts) 擴充
  terminals: [
    {
      id, workspaceId, type, shell, alias, cwd, sdkSessionId, model,
+     ptyServerId: string,     // terminal-server 中的 PTY ID（供重連）
+     scrollBufferLines: number // 保留行數設定
    }
  ],
+ layout?: {                   // UI 佈局狀態
+   type: 'split' | 'tabs',
+   direction?: 'horizontal' | 'vertical',
+   ratio?: number
+ }
```

**新增檔案**：
```
userData/bat-pty-server.pid     — Server PID（啟動偵測用）
userData/bat-pty-registry.json  — 孤兒回收 registry（如 PLAN-008 設計）
```

**儲存觸發建議強化**：
- ✅ 保留現有事件驅動儲存
- ➕ 新增 `setInterval` 30 秒保底（防 crash 遺失）
- ➕ `app.on('before-quit')` 已有，OK

---

### 6. Phase 分拆估時

| Phase | 內容 | 預估規模 | 前置 |
|-------|------|---------|------|
| Phase 1 | 定時保底儲存 + UI 佈局持久化 | 小（2-3h） | 無 |
| Phase 2 | Terminal Server 獨立進程 + IPC 協議 | 大（8-12h） | 無 |
| Phase 3 | PtyManager 改為 Server Proxy | 中（4-6h） | Phase 2 |
| Phase 4 | 重連邏輯（啟動偵測 + 重播 buffer） | 中（4-6h） | Phase 2, 3 |
| Phase 5 | 孤兒回收 + TTL 清理 | 小（2-3h） | Phase 2 |
| Phase 6 | 啟動復原提示 UI | 小（2-3h） | Phase 1, 4 |

**建議執行順序**：Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Phase 1 可獨立先做（改善現有問題），Phase 2-6 為 Terminal Server 主線。

---

### 7. 需使用者決定的問題

1. **IPC 策略選擇**：fork IPC（推薦、簡單）vs Unix socket + Named pipe（效能更好但需更多平台分支）？
2. **scroll buffer 持久化**：是否需要保存終端輸出歷史？若是，保留多少行？（建議 1000 行，約 100KB/terminal）
3. **Server 生命週期**：Server idle 多久後自動關閉？（建議 30 分鐘無連線則 shutdown，如 PLAN-008 設計）
4. **Phase 1 獨立先行**：是否先做定時保底儲存 + 佈局持久化（快速改善，不依賴 Server 架構）？
5. **Agent 會話復原**：PTY server 存活時，Agent CLI 進程也跟著存活嗎？還是只保留 PTY shell，Agent 靠 `sdkSessionId` resume？
6. **Remote 模式相容**：BAT 已有 Remote Server 架構（`electron/remote/`），Terminal Server 是否需與 Remote 模式整合？

---

### 互動紀錄

無（本工單為純調查，無需使用者決策）

### 遭遇問題

無
