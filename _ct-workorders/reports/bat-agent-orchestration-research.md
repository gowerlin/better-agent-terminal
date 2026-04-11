# BAT Agent Orchestration — 技術研究文件

> **建立**:2026-04-11 10:25 (UTC+8)
> **作者**:塔台 session(research mode)
> **目的**:讓 BAT(better-agent-terminal)成為 AI agent 的編排平台,支援塔台 auto-session 的**雙向自動化閉環**,不限 Claude Code CLI。
> **狀態**:📋 研究階段(尚未實作,待使用者 review 後決策)

---

## 目錄

1. [背景與動機](#1-背景與動機)
2. [問題定義](#2-問題定義)
3. [技術名詞快速字典](#3-技術名詞快速字典)
4. [BAT 現況盤點](#4-bat-現況盤點)
5. [使用者意圖澄清](#5-使用者意圖澄清)
6. [下行方案評估(塔台 → Agent)](#6-下行方案評估塔台--agent)
7. [上行方案評估(Agent → 塔台)](#7-上行方案評估agent--塔台)
8. [推薦方案:OSC + File Watch](#8-推薦方案osc--file-watch)
9. [未解決的技術疑慮](#9-未解決的技術疑慮)
10. [決策矩陣](#10-決策矩陣)
11. [分階段實作路徑](#11-分階段實作路徑)
12. [風險評估](#12-風險評估)
13. [延伸想像:BAT 作為 AI Agent Orchestration Platform](#13-延伸想像bat-作為-ai-agent-orchestration-platform)

---

## 1. 背景與動機

### 現況(手動流程)

```
塔台產生工單(.md 檔案)
    ↓ (使用者複製「/ct-exec T####」)
使用者開新 terminal tab
    ↓ (使用者貼上 + Enter)
Sub-session 啟動、執行、填回報區
    ↓ (使用者回塔台 tab)
使用者告訴塔台「T#### 完成」
    ↓
塔台讀回報區、更新狀態、派下一張
```

**每一步都需要使用者介入複製/貼上/切換 tab/輸入回報。**

### 目標(自動化閉環)

```
塔台產生工單
    ↓ 自動
BAT 在同視窗開新 tab + 載入 agent 指令(自動)
    ↓
Agent 執行任務、填回報區(不知道 BAT 存在)
    ↓ 自動
BAT 偵測回報區被填寫,通知塔台 tab(自動)
    ↓
塔台自動處理下一步(讀回報、派下一張或結案)
```

**整個迴圈使用者零介入**(除非需要決策或查看結果)。

### 為什麼現在做

1. **Dog-food BAT** — BAT 就是為了成為好用的 AI agent 終端而生,塔台 + 工單流程是它的最佳驗證情境
2. **塔台效率瓶頸** — 手動複製/貼上是目前 Phase 1 驗收流程最慢的環節(每張工單 30-60 秒損耗)
3. **BAT 產品差異化** — 目前市面上沒有 terminal 以「AI agent 編排平台」為賣點

---

## 2. 問題定義

### 核心問題

**在 Electron terminal emulator(BAT)中,如何讓執行於某個 tab 內的程式(塔台、worker agent)能主動觸發 BAT 的動作,例如「開新 tab + 注入指令」或「通知其他 tab」?**

### 問題分解

1. **下行**(塔台 → BAT → 新 tab 的 agent):
   - 塔台如何告訴 BAT「開新 tab,執行 copilot --yolo -i ..."」?
   - 塔台本身是 BAT 的 PTY 子進程,無法直接呼叫 BAT 的 Electron main IPC
2. **上行**(agent 完工 → BAT → 塔台 tab):
   - Agent 如何告訴塔台「我做完了」?
   - Agent 可能是 Claude Code、Copilot、Cursor、Aider、Gemini CLI、自製 agent,**不能假設 agent 配合**

### 限制條件

- ✅ **塔台和 agent 都在 BAT 同一個視窗的不同 tab**(不是跨 BAT 實例)
- ✅ **所有 agent 種類都要支援**(agent-agnostic)
- ✅ **Agent 完成工作後不一定會主動通知**(有些直接退出、有些是互動式 TUI 不退出、有些根本不知道 BAT)
- ✅ **但 Agent 都會填寫工單的「回報區」**(這是塔台設計的交付契約)

---

## 3. 技術名詞快速字典

> 讀這份文件前,先理解這些概念。每個名詞附一句話解釋 + 關鍵影響面。

### Electron 相關

| 名詞 | 解釋 | 為什麼重要 |
|------|------|-----------|
| **Main Process** | Electron 的主進程,跑 Node.js,管 window 和 OS 資源 | BAT 的 `electron/main.ts` 就在這裡跑 |
| **Renderer Process** | Electron 的畫面進程,跑 Chromium + JS,管 UI | BAT 的 React app 在這裡跑 |
| **Preload Script** | Main 和 Renderer 之間的安全橋樑,用 `contextBridge` 暴露 API | `electron/preload.ts`,定義 `window.electronAPI` |
| **IPC(Inter-Process Communication)** | Main 和 Renderer 之間傳訊息的機制 | `ipcMain.handle` / `ipcRenderer.invoke` 就是這個 |
| **BrowserWindow** | Electron 的視窗物件,每個 BAT window 就是一個 | Tab 通常共用一個 BrowserWindow |

### Terminal 相關

| 名詞 | 解釋 | 為什麼重要 |
|------|------|-----------|
| **PTY(Pseudo-Terminal)** | 一對 master/slave 的假終端,讓程式以為自己連到真終端 | BAT 每個 tab 都背後掛一個 PTY |
| **PTY Master** | PTY 的「控制端」,terminal emulator(BAT)寫入這邊給 shell 看 | 這是**注入訊息**的入口 |
| **PTY Slave** | PTY 的「執行端」,shell(bash/pwsh)連到這邊 | Shell 讀寫 stdin/stdout 都走這邊 |
| **xterm.js** | JavaScript 寫的 terminal emulator 套件,BAT renderer 用來顯示 terminal 畫面 | 可註冊 OSC handler 攔截自訂 escape sequence |
| **stdin / stdout** | 標準輸入輸出,shell 從 stdin 讀使用者輸入,印到 stdout | **Agent/塔台讀到 stdin 的訊息會視為「使用者輸入」** |

### Escape Sequences

| 名詞 | 解釋 | 為什麼重要 |
|------|------|-----------|
| **ANSI Escape Sequence** | 終端的控制碼,以 `\033` (ESC) 開頭,用來移動游標、改顏色等 | `echo -e "\033[31mRed\033[0m"` 就是這個 |
| **OSC(Operating System Command)** | 特殊的 escape sequence,格式 `\033]<number>;<data>\a`,用來讓 shell 和終端傳遞「系統級」訊息 | iTerm2 / Windows Terminal / VS Code 都用 OSC 做 vendor-specific 功能 |
| **OSC 1337** | iTerm2 佔用的 OSC 碼,用來傳遞 iTerm2 專屬功能(內嵌圖片、badge 等) | BAT 可以用同一個碼或自訂 |
| **Bracketed Paste Mode** | Terminal 告訴 shell「接下來這段是貼上的,不是手敲的」的機制 | 前面 BUG-001 就是沒做 bracketed paste 導致 OAuth 貼碼被截斷 |

### IPC / 跨進程通訊

| 名詞 | 解釋 | 為什麼重要 |
|------|------|-----------|
| **Named Pipe** | Windows 的進程間通訊機制,`\\.\pipe\xxx` 路徑 | 跨進程即時通訊的主流選擇 |
| **Unix Socket** | macOS/Linux 的等價物,`/tmp/xxx.sock` 路徑 | 同上 |
| **Env Var Injection** | 父進程在 spawn 子進程時,在 env 注入特定變數 | VS Code 的 `VSCODE_IPC_HOOK_CLI` 就是這個 — 子進程讀 env 找 socket |
| **Single Instance Lock** | Electron 應用只允許一個實例的機制,第二次啟動會把 argv 轉給第一個實例 | BAT 已經有 (`app.requestSingleInstanceLock()`) |

### 檔案監聽

| 名詞 | 解釋 | 為什麼重要 |
|------|------|-----------|
| **fs.watch** | Node.js 內建的檔案監聽 API | Windows 下有 bug,會漏事件、觸發多次 |
| **chokidar** | 第三方檔案監聽套件,包 fs.watch + 修正 bug | 業界主流,推薦 |
| **Debounce** | 短時間內連續觸發的事件合併成一次 | 避免 agent 分多次寫檔時觸發多次通知 |

---

## 4. BAT 現況盤點

透過 `grep` 和 `main.ts` 部分讀取,確認的既有基礎設施:

### ✅ 已具備

| 基礎設施 | 位置 | 說明 |
|---------|------|------|
| Single Instance Lock | `main.ts:155` | 啟用,第二次啟動會轉給第一個實例 |
| second-instance event handler | `main.ts:782` | 已解析 `--profile=<id>` 參數 |
| Window Registry | `window-registry.ts` | 多視窗、多 workspace、多 tab 的狀態管理 |
| PTY Manager | `pty-manager.ts` | PTY 生命週期管理 |
| IPC 架構 | `main.ts` 大量 `ipcMain.handle` | 完整 Main/Renderer 通訊基礎 |
| **Supervisor IPC** | `main.ts:2034-2048` | **⚠️ 關鍵發現**(見下) |

### ⚠️ 關鍵發現:Supervisor IPC

`main.ts` 已註冊三個 `supervisor:*` handler:

- `supervisor:list-workers(workspaceTerminalIds)` — 列出 workers
- `supervisor:send-to-worker(targetId, text)` — **把 text 送到某個 worker**
- `supervisor:get-worker-output(targetId, lines)` — **讀某個 worker 的 output**

**未驗證**:`send-to-worker` 的實際實作是「寫入 target PTY 的 stdin」還是「發 JS 事件給 TerminalPanel 顯示」?

- **如果是寫 PTY stdin** → 塔台 Claude Code 會視為使用者輸入,自動觸發「T#### 完成」的處理邏輯,整個上行機制 70% 免費
- **如果是 JS 事件** → 上行需要另外打造「注入到 PTY」的 IPC

這是**整個推薦方案的最關鍵前提**,見 [第 9 節](#9-未解決的技術疑慮)。

### ❌ 尚缺

| 缺失 | 影響 |
|------|------|
| OSC handler 註冊 | 無法從 terminal 內程式觸發 BAT 動作 |
| Env var 注入(`BAT_TAB_ID` 等) | Terminal 內程式無法得知自己在 BAT 裡、無法找到 parent tab |
| 檔案監聽機制 | 無法 agent-agnostic 地偵測工單完成 |
| OSC protocol 設計 | 沒有定義的 action 清單、安全模型 |

---

## 5. 使用者意圖澄清

**原本塔台誤解為**:從 BAT 外部(例如 Git Bash、Windows Terminal)跨進程啟動 BAT exe,走 single-instance lock 讓 BAT 開新視窗。

**實際需求**:
- 塔台 Claude Code 就在 BAT 的某個 tab 裡跑
- 所有 sub-session 都在**同一個 BAT 視窗**的新 tab
- **不需要**跨進程啟動、不需要 single-instance lock、不需要外部 exe 呼叫
- 所以真正的機制是 **terminal 內程式 → BAT renderer/main 的反向通訊**

### 圖示

```
┌─────────────── BAT 單一視窗 ────────────────┐
│  ┌────────┐  ┌────────┐  ┌────────┐         │
│  │ Tab 1  │  │ Tab 2  │  │ Tab 3  │         │
│  │ 塔台    │  │ Worker │  │ Worker │         │
│  │ (Claude)│  │(Copilot)│  │(Aider)│         │
│  └───┬────┘  └───▲────┘  └───▲────┘         │
│      │           │           │               │
│      │發 OSC 請求BAT:        │               │
│      ├───────────┴───────────┘               │
│      │ 1. 開新 tab + inject cmd              │
│      │ 2. 監聽工單檔案                       │
│      │                                        │
│      │ Agent 完工寫回報區                     │
│      │         ↓                              │
│      │  BAT file watcher 偵測                 │
│      │         ↓                              │
│      │  BAT 把「T#### 完成」寫入塔台 PTY stdin│
│      ↓                                        │
│  塔台 Claude Code 視為使用者輸入,自動處理    │
└──────────────────────────────────────────────┘
```

---

## 6. 下行方案評估(塔台 → Agent)

### 方案 A:OSC Escape Sequence

**原理**:塔台 `printf` 輸出特殊 escape sequence,xterm.js 攔截(不顯示到畫面),轉發到 BAT renderer/main 執行動作。

**範例(塔台側)**:
```bash
printf '\033]1337;BAT=new-tab;cmd=%s;cwd=%s\a' \
  "$(echo 'copilot --yolo -i "讀取 T0013..."' | base64)" \
  "$(echo "$PWD" | base64)"
```

**BAT 側要做**:
1. xterm.js 的 `term.parser.registerOscHandler(1337, handler)` 註冊 OSC 1337
2. Handler 解析 payload → 分派到對應 renderer IPC
3. Renderer 呼叫現有的 workspace store 建立新 tab
4. 新 tab 建立完成後,write cmd 到新 tab 的 PTY stdin + `\r`

**先例**:
- iTerm2 的 OSC 1337(內嵌圖片、badge、cwd 提示等)
- Windows Terminal 的 OSC 9;4(顯示 task progress)
- VS Code 的 `code` command 部分機制

**優點**:
- ✅ 終端原生機制,**零額外 IPC 基礎設施**
- ✅ 塔台端實作只是一行 `printf`
- ✅ 跨 shell、跨 agent 自動相容(任何程式都能 print)
- ✅ 跨平台(所有 PTY 都支援 escape)
- ✅ xterm.js 有原生 API 支援

**缺點**:
- ⚠️ **安全**:terminal 內任何程式都能發 OSC(需設計 opt-in + token)
- ⚠️ 改動涉及 xterm.js 設定 + IPC 轉發 + renderer 新 tab 邏輯(預估 3-4 檔案)
- ⚠️ Base64 encoding 讓塔台端的 shell script 可讀性下降

### 方案 B:BAT CLI 工具 + Socket IPC

**原理**:BAT 啟動 PTY 時,注入 env var(`BAT_IPC_SOCKET=\\.\pipe\bat-xxx`),並在 PATH 前面加一個 bin 目錄(裡面放 `bat` 指令)。Terminal 內程式執行 `bat new-tab ...`,`bat` 指令讀 env 找 socket,透過 pipe 把 JSON 送給 BAT main。

**範例(塔台側)**:
```bash
bat new-tab --cmd "copilot --yolo -i '讀取 T0013...'"
```

**BAT 側要做**:
1. Main process 啟動 Named Pipe server(Windows)或 Unix Socket server(Mac/Linux)
2. PTY 啟動時注入 env + PATH
3. 打包一個 `bat` 命令(Node script 或 Go binary)進 release
4. `bat` 命令讀 env → 連 pipe → 送 JSON → 等回應
5. Main 處理 JSON action → dispatch 到 renderer

**先例**:
- VS Code `code` command(透過 `VSCODE_IPC_HOOK_CLI` env var)
- Zed `zed` command
- Cursor `cursor` command

**優點**:
- ✅ **使用者體驗極佳**(像普通 CLI,例如 `bat new-tab --cmd "..."` 比 `printf '\033]...'` 直觀)
- ✅ **可擴展性好**(`bat close-tab / bat list / bat focus / bat split` 一個一個加)
- ✅ 跟業界標準一致(VS Code / Cursor 都這樣做)
- ✅ 安全模型自然(只有 BAT 子孫進程有 env,外部進程無法呼叫)

**缺點**:
- ⚠️ **改動範圍大**:bin 打包 + socket server + PATH 注入 + 跨平台 IPC
- ⚠️ 需要打造一個完整的 BAT 產品功能,不是兩小時的原型
- ⚠️ 跨平台 IPC 要分別處理 Windows Named Pipe 和 Unix Socket

### 方案 C:URL Protocol Handler(`bat://`)

**原理**:註冊 `bat://` URL protocol,用 `start bat://new-tab?cmd=...` 觸發。

**不選原因**:
- ❌ 需要 reinstall BAT 才能註冊 protocol
- ❌ URL encoding 中文 + 長 cmd 複雜
- ❌ 需要跨進程啟動,跟「同視窗內」需求不符

### 方案 D:HTTP Localhost API

**原理**:BAT main 開 localhost HTTP server,terminal 內用 `curl` 呼叫。

**不選原因**:
- ❌ **安全風險**:任何本機程式都能呼叫(不只 BAT 子孫)
- ❌ 過度工程(HTTP 是完整 protocol stack)
- ❌ Port 衝突問題

### 下行方案比較

| 面向 | A. OSC | B. CLI + Socket | C. URL Protocol | D. HTTP |
|------|--------|----------------|-----------------|---------|
| 改動範圍 | 小(3-4 檔案) | 大(新 bin + socket + PATH) | 中 + reinstall | 大 + 安全設計 |
| 使用者體驗 | 中(要 encode) | 優(像原生 CLI) | 差(URL 複雜) | 中 |
| 安全模型 | 需設計 | 天然(env gating) | 弱 | 需嚴格 |
| 可擴展性 | 中 | 高 | 低 | 高 |
| 業界先例 | iTerm2、WinTerm | VS Code、Zed | 無 terminal 先例 | 少 |
| **定位** | **快速原型** | **完整產品功能** | **不適合** | **不適合** |

**推薦**:**Phase 1 做 A(OSC),Phase 2 升級到 B(CLI + Socket)**。兩者不衝突,可無痛替換。

---

## 7. 上行方案評估(Agent → 塔台)

**關鍵前提**:使用者要求**支援所有 AI agent**,不限 Claude Code CLI。這排除了任何需要 agent 配合的機制。

### 機制 1:Agent 主動發 OSC / 呼叫 CLI

**原理**:Agent 完工時自己發 `\033]1337;BAT=notify;...\a` 或呼叫 `bat notify ...`。

**排除原因**:
- ❌ 需要 agent 知道 BAT 存在 + 知道 OSC 協議 / bat CLI
- ❌ 每個 agent(copilot / aider / cursor / ...)都要在 prompt 加指示,**爆炸性擴展**
- ❌ Agent 執行失敗、被 Ctrl+C、hang 住時不會通知
- ❌ **違反 agent-agnostic 要求**

### 機制 2:BAT 偵測 PTY process exit

**原理**:BAT 的 pty-manager 監聽新 tab 的 child process exit 事件,退出時通知塔台。

**問題**:
- ⚠️ 有些 agent 是互動式 TUI(例如 copilot `-i`),執行完任務後**不退出**,停在 TUI 等更多輸入
- ⚠️ Exit code ≠ 任務是否成功(可能是使用者 Ctrl+C、可能是 hang 被 kill)
- ⚠️ 無法判斷「完工」還是「失敗退出」
- ⚠️ **對互動式 agent 失效**

### 機制 3:BAT 監聽工單檔案變動 ⭐ 推薦

**原理**:塔台派工單時告訴 BAT「請監聽 T0013 工單檔案,當『回報區的完成狀態欄位』被填寫時通知我」。BAT 用 chokidar 監聽檔案,偵測到條件滿足 → 通知塔台 tab。

**為什麼這個方案是對的**:

1. **Agent 不需要知道 BAT 存在** — 它只要按工單規範寫入回報區(這本來就是契約)
2. **工單檔案是塔台 ↔ agent 的天然介面** — 不發明新契約,用現成的
3. **跨 agent 自動支援** — copilot / aider / cursor / claude / gemini / 任意 agent,只要會寫檔就行
4. **不依賴 agent lifecycle** — 不管 agent 退出、hang、互動式 TUI,都只看檔案內容
5. **失敗也能偵測** — agent 把狀態填成 FAILED / BLOCKED 也會觸發

**範例(塔台側)**:
```bash
# Step 1: 要求 BAT 監聽工單檔案
printf '\033]1337;BAT=watch;token=%s;path=%s;condition=report_status_filled;target=%s;message=%s\a' \
  "$BAT_OSC_TOKEN" \
  "$(encode '_ct-workorders/T0013-fix-voice-download-ipc-drift.md')" \
  "$BAT_TAB_ID" \
  "$(encode 'T0013 完成')"

# Step 2: 開新 tab 跑 agent
printf '\033]1337;BAT=new-tab;...\a'

# Step 3: 塔台繼續待機,等收到「T0013 完成」訊息自動處理
```

**BAT 側要做**:
1. chokidar 監聽 path
2. 收到 fs event → 讀檔 → parse `### 完成狀態` 欄位
3. 判斷非空 + 不是 placeholder(例如 `(DONE / FAILED / BLOCKED / PARTIAL)`) + 是合法狀態字串
4. 條件滿足 → 透過 `supervisor:send-to-worker(target, message + '\r')` 注入塔台 PTY

**優點**:
- ✅ **真正 agent-agnostic**
- ✅ 零 agent 配合
- ✅ 跨 agent lifecycle
- ✅ 失敗也偵測得到
- ✅ 利用現有契約

**缺點**:
- ⚠️ fs.watch 在 Windows 要用 chokidar + debounce
- ⚠️ condition parser 要維護(未來要支援更多 condition)
- ⚠️ **需要先驗證 `supervisor:send-to-worker` 真的是寫 PTY stdin**(見第 9 節)

### 上行方案比較

| 方案 | Agent-Agnostic | 完工偵測精度 | 改動範圍 | 推薦 |
|------|:-------------:|:-----------:|:-------:|:----:|
| 1. Agent 主動發 OSC | ❌ | 高 | 小 | ❌ |
| 2. PTY exit 偵測 | 部分 | 低(無法區分完工/錯誤) | 小 | ❌ |
| 3. **檔案監聽** | ✅ | 高(看回報區) | 中 | ✅ |

---

## 8. 推薦方案:OSC + File Watch

### 架構總覽

```
        塔台 tab                          BAT main                       新 tab
         (Claude Code)                   (Electron)                      (任意 agent)
              │                              │                                │
              │                              │                                │
   ┌──── auto-session on ────┐               │                                │
   │                         │               │                                │
   │  印出 OSC watch ────────┼──────────────▶│                                │
   │  "監聽 T0013.md + 條件"  │               │ chokidar.watch('T0013.md')    │
   │                         │               │                                │
   │  印出 OSC new-tab ──────┼──────────────▶│                                │
   │  "開 tab 跑 copilot"    │               │ 呼叫 workspace store           │
   │                         │               │ 建立新 terminal                │
   │                         │               │ pty write cmd + \r ─────────▶ │
   │  待機                    │               │                                │ copilot 跑...
   │  (Claude Code 讀 stdin) │               │                                │
   │                         │               │                                │ 寫入工單回報區
   │                         │               │                                │ ### 完成狀態
   │                         │               │                                │ DONE
   │                         │               │◀─── chokidar fs event ─────── │
   │                         │               │ 讀檔 → parse 完成狀態          │
   │                         │               │ 條件滿足                       │
   │                         │               │ supervisor:send-to-worker(     │
   │                         │               │   target=塔台 tab id,          │
   │                         │               │   text="T0013 完成\r"          │
   │                         │               │ )                              │
   │                         │               │                                │
   │◀── PTY stdin 注入 ──────┼───────────────│                                │
   │  "T0013 完成\r"         │               │                                │
   │                         │               │                                │
   │ Claude Code 視為        │               │                                │
   │ 使用者輸入              │               │                                │
   │ ↓                        │               │                                │
   │ 塔台 skill 處理          │               │                                │
   │ ↓                        │               │                                │
   │ 讀工單回報區             │               │                                │
   │ ↓                        │               │                                │
   │ 更新 Sprint 狀態         │               │                                │
   │ ↓                        │               │                                │
   │ 派下一張工單             │               │                                │
```

### OSC 協議設計

**OSC 碼**:`1337`(沿用 iTerm2 的 vendor OSC,避免與標準 OSC 衝突)或自訂(例如 `7777`)。實作時二選一。

**格式**:
```
\033]1337;BAT=<action>;<key1>=<value1>;<key2>=<value2>;...\a
```

- `\033]1337;` — OSC 起始
- `BAT=<action>` — 必填,identifier BAT vendor action
- `token=<value>` — 必填,安全 token(env 裡的 `BAT_OSC_TOKEN`)
- 其他 key=value 依 action 決定
- `\a`(`\x07` BEL)— OSC 結束符

**編碼規則**:
- 含特殊字元(空格、`;`、中文)的 value 用 **base64 encode**
- Key name 不編碼(純 ASCII)
- Boolean 用 `1`/`0`

### Action 清單

| Action | 方向 | 參數 | 對應 BAT 行為 |
|--------|------|------|--------------|
| `new-tab` | 塔台 → BAT | `cmd`(base64), `cwd`(base64), `parent=<tab-id>` | 在同視窗建立新 terminal,inject cmd 到新 tab PTY |
| `watch` | 塔台 → BAT | `path`(base64), `condition`, `target=<tab-id>`, `message`(base64) | chokidar 監聽 path,條件滿足時 notify target |
| `unwatch` | 塔台 → BAT | `path`(base64) | 停止監聽 |
| `notify` | Agent → BAT(可選) | `target=<tab-id>`, `message`(base64) | 直接寫入 target tab 的 PTY stdin(快速路徑) |
| `focus` | 任意 → BAT | `target=<tab-id>` | 切換到指定 tab |
| `list` | 任意 → BAT | - | 列出所有 tab(回寫到發送端 stdin) |

### Env Var 注入(由 BAT pty-manager 負責)

每個 BAT 啟動的 PTY,在 env 加入:

| Env Var | 值 | 用途 |
|---------|-----|------|
| `BAT_TAB_ID` | `<uuid>` | 此 terminal 的 tab 唯一識別 |
| `BAT_OSC_TOKEN` | `<random-uuid>` | 此 session 的 OSC 權限 token |
| `BAT_PARENT_TAB_ID` | `<uuid>` 或空 | 建立此 tab 的父 tab id(若由 OSC new-tab 建立) |
| `BAT_VERSION` | `2.1.3` | BAT 版本,方便 agent 判斷相容性 |

**Parent 關係**:塔台派工單時,透過 `new-tab` 的 `parent=$BAT_TAB_ID` 告訴 BAT「新 tab 的 parent 是我」,BAT 建立新 tab 時把 parent id 注入新 tab 的 `BAT_PARENT_TAB_ID`。這讓:
- Agent 可以從 env 讀 parent id,若想走「快速路徑 notify」就有對象
- 不想走快速路徑也沒關係,檔案監聽兜底

### Condition 設計(MVP 只做一個)

**`condition=report_status_filled`**

**判定規則(塔台偏好 2-B)**:
1. 讀取 path 指定的檔案內容
2. 找到 `### 完成狀態` 區塊
3. 下一行非空、非 placeholder(`(DONE / FAILED / BLOCKED / PARTIAL)`)
4. 內容必須是合法狀態字串之一:`DONE` / `PARTIAL` / `FAILED` / `BLOCKED`
5. 滿足以上所有條件 → 觸發 notify

**為什麼要這麼嚴**:
- 寬鬆判定(例如「任何非空」)可能誤觸發(agent 寫了半成品)
- 嚴格判定確保「agent 已經明確說完工」才通知塔台
- 塔台被誤喚醒的成本比等待的成本高(context 汙染)

### 安全模型

| 威脅 | 對策 |
|------|------|
| Terminal 內其他程式發 OSC 偽造塔台 | **Token gating** — OSC 必須帶 `token=<BAT_OSC_TOKEN>`,與 env 裡的值比對 |
| Token 被偷看(例如 `env \| grep BAT`) | 只有同 PTY 的進程能看到 env,跨 PTY 看不到 |
| 外部程式(非 BAT 子孫)偽造 | 外部程式沒有 env,無 token,直接被拒 |
| OSC 被記錄到 log 洩漏 | base64 encoding + logger 禁止 verbose dump payload |
| Target tab 猜測 | Tab ID 是 UUID v4,猜測空間 2^128 |
| Watch 任意檔案 | **Path 白名單**:只允許 `_ct-workorders/` 和專案根目錄下 |

**安全等級**:對標 VS Code `VSCODE_IPC_HOOK_CLI` 的 env-based capability 模型。**足夠 dog-food,不是銀行級安全**。

### Debounce 策略

**塔台偏好 3-A**:**300ms debounce**
- chokidar 的 `awaitWriteFinish` 選項設 300ms
- 避免 agent 分多次寫檔時觸發多次
- Windows fs.watch 的 flaky 行為用 300ms 可穩定

---

## 9. 未解決的技術疑慮

**這些必須在 T0014 開工前驗證,避免整個方案建在錯誤假設上。**

### 疑慮 1(Critical):`supervisor:send-to-worker` 實際實作

**問題**:這個 handler 是寫入 target PTY 的 stdin(真正模擬使用者輸入),還是只是發 JS 事件給 TerminalPanel 顯示?

**影響**:
- **若是寫 PTY stdin** → 塔台 Claude Code 會把訊息當使用者輸入處理,**整個上行方案可行**
- **若是 JS 事件** → Claude Code 看不到訊息,上行方案需要改走其他路徑(例如新增「寫 PTY」專用 IPC)

**驗證方式**:grep `supervisor:send-to-worker` 的實作,看它呼叫 `pty.write(...)` 還是 `window.webContents.send(...)`

**塔台目前的推測**:80% 機率是寫 PTY(因為名字叫 "send-to-worker",符合 supervisor 模式的語意)

### 疑慮 2:Claude Code 對 PTY stdin 注入訊息的反應

**問題**:如果寫入是「T0013 完成\r」,Claude Code 會:
- (a) 把它當使用者輸入處理 ✅
- (b) 把它當 paste 處理(可能走 bracketed paste path)
- (c) 忽略,因為它是「非互動來源」

**影響**:若走 (b),需要包 bracketed paste markers(`\033[200~` ... `\033[201~`)避免被當「粘貼事件」處理

**驗證方式**:實際實驗,寫一個小 script 往跑著 Claude Code 的 PTY 寫入測試訊息,觀察反應

### 疑慮 3:Windows fs.watch 穩定性

**問題**:Windows 下 fs.watch 會漏事件、觸發兩次

**緩解**:用 chokidar(它處理了這些 bug) + `awaitWriteFinish` debounce

**殘餘風險**:chokidar 仍有極端邊界案例(例如外部工具改檔時 inode 變動)

### 疑慮 4:xterm.js OSC handler 是否能阻止 escape 顯示

**問題**:OSC handler 回傳 `true` 時 xterm.js 會不會把 escape sequence 當作已處理,不顯示到 buffer?還是還是會顯示一段奇怪的文字?

**驗證方式**:讀 xterm.js 文件 + 小實驗

### 疑慮 5:Bracketed Paste Mode 干擾

**問題**:前面 BUG-001 解決後,BAT 的 xterm.js 啟用了 bracketed paste mode。這會影響 OSC 處理嗎?

**緩解**:OSC 是 C1 控制碼,跟 bracketed paste 的 CSI 是不同 layer,理論上不衝突,但要驗證

### 疑慮 6:多 tab 同時監聽的資源消耗

**問題**:如果塔台派 10 張工單,BAT 會同時監聽 10 個檔案。chokidar 每個 watch 會佔用 fs handle,Windows 有 handle 上限。

**緩解**:**watch 去重** — 如果同一個檔案已被監聽,只累加 target 清單;監聽到第一個觸發後自動 unwatch

### 疑慮 7:Agent hang 住的 timeout

**問題**:Agent 跑到一半 hang 住,永遠不寫回報區,塔台會永遠等下去

**緩解**:
- 塔台派工單時帶 `timeout_ms`(例如 30 分鐘)
- BAT 建立 watch 時記下 deadline
- 超時自動 unwatch + 通知塔台 `T#### timeout`

---

## 10. 決策矩陣

**請在以下選項中勾選你的選擇。塔台會根據結果產生 T0014 / T0015 工單。**

### D1:下行機制

| 選項 | 說明 | 塔台偏好 | 你的選擇 |
|------|------|:-------:|:-------:|
| A | OSC Escape Sequence(快速原型) | ✅ | [ ] |
| B | CLI + Socket(完整方案) | - | [ ] |
| C | Phase 1 做 A,Phase 2 做 B(分階段) | - | [ ] |

### D2:上行機制

| 選項 | 說明 | 塔台偏好 | 你的選擇 |
|------|------|:-------:|:-------:|
| A | **檔案監聽 `watch`**(純 agent-agnostic) | ✅ | [ ] |
| B | Agent 主動 `notify`(依賴 agent 配合) | - | [ ] |
| C | 雙軌(主 watch,次 notify 作快速路徑) | - | [ ] |

### D3:`report_status_filled` condition 判定嚴格度

| 選項 | 說明 | 塔台偏好 | 你的選擇 |
|------|------|:-------:|:-------:|
| A | 只要「### 完成狀態」下一行非空就觸發 | - | [ ] |
| B | 必須是 `DONE`/`PARTIAL`/`FAILED`/`BLOCKED` 其中之一 | ✅ | [ ] |
| C | 整個回報區都要有內容才觸發(更嚴) | - | [ ] |

### D4:檔案監聽 debounce

| 選項 | 值 | 塔台偏好 | 你的選擇 |
|------|-----|:-------:|:-------:|
| A | 300ms | ✅ | [ ] |
| B | 1s(保守) | - | [ ] |
| C | 無 debounce(塔台端做冪等) | - | [ ] |

### D5:OSC 碼選擇

| 選項 | 說明 | 塔台偏好 | 你的選擇 |
|------|------|:-------:|:-------:|
| A | 沿用 OSC 1337(跟 iTerm2 一樣,用 `BAT=` 前綴區分) | ✅ | [ ] |
| B | 自訂 OSC 7777(避免與 iTerm2 衝突) | - | [ ] |
| C | 自訂 OSC 8000(沒人用) | - | [ ] |

### D6:安全模型

| 選項 | 說明 | 塔台偏好 | 你的選擇 |
|------|------|:-------:|:-------:|
| A | Env token(VS Code 風格) | ✅ | [ ] |
| B | 無 token,MVP 先不管 | - | [ ] |
| C | HMAC 簽名(過度) | - | [ ] |

### D7:工單拆分

| 選項 | 說明 | 塔台偏好 | 你的選擇 |
|------|------|:-------:|:-------:|
| A | 一張大工單 T0014 | - | [ ] |
| B | 兩張:T0014(BAT 端)+ T0015(塔台端) | ✅ | [ ] |
| C | 三張:T0014(BAT OSC 基礎)+ T0015(塔台整合)+ T0016(文件 + 工具) | - | [ ] |

### D8:Phase 1 包含 Timeout 機制?

| 選項 | 說明 | 塔台偏好 | 你的選擇 |
|------|------|:-------:|:-------:|
| A | 是,MVP 就包含 timeout + 自動 unwatch | ✅ | [ ] |
| B | 否,Phase 2 再補 | - | [ ] |

---

## 11. 分階段實作路徑

### Phase 1 — MVP(本次 T0014 / T0015 目標)

**範圍**:
- BAT 端 OSC handler 基礎(`new-tab` / `watch` / `unwatch` / `focus`)
- chokidar file watcher + `report_status_filled` condition parser
- Env 注入(`BAT_TAB_ID` / `BAT_OSC_TOKEN` / `BAT_PARENT_TAB_ID`)
- Token-based 安全模型
- 塔台 auto-session.md 擴展:偵測 BAT → 走 OSC
- 工單派發 flow 改為 `watch + new-tab`

**不包含**:
- `notify` 快速路徑
- `list` action
- BAT CLI binary
- 完整 GUI 設定頁面(BAT 裡沒有 OSC 管理 UI)

**估計改動**:
- BAT 端 5-7 檔案(main + preload + renderer + pty-manager + xterm setup)
- 塔台端 2-3 檔案(auto-session.md + ct-exec SKILL.md + 可能少量 main skill)
- 文件 1-2 檔案(protocol spec)

**估計工期**:1-2 天(不含驗證時間)

### Phase 2 — 完整產品功能

**範圍**:
- `bat` CLI binary(對標 VS Code `code`)
- Named Pipe(Windows)/ Unix Socket(Mac/Linux)IPC server
- 多 action:`bat new-tab / notify / focus / list / close / split / move`
- BAT 設定頁面(OSC 開關、token 輪替、action 白名單)
- 對外公開 Protocol Spec
- 其他工具整合範例(Aider、Cursor 的 hook)

**估計工期**:1 週以上

### Phase 3 — 生態系

**願景**:BAT 成為 AI agent orchestration 的標準
- 第三方 agent 主動支援 BAT 協議
- Community-contributed actions
- 與 Claude Agent SDK 深度整合
- GitHub Copilot、Cursor 官方支援

---

## 12. 風險評估

### 技術風險

| 風險 | 機率 | 影響 | 緩解 |
|------|-----|------|------|
| `supervisor:send-to-worker` 不是寫 PTY stdin | 20% | 高(上行方案要重做) | 動工前驗證(疑慮 1) |
| Claude Code 不把 PTY 注入當使用者輸入 | 15% | 高(上行方案要改) | 實驗驗證(疑慮 2) |
| Windows fs.watch 不穩 | 10% | 中(通知延遲/漏) | chokidar + debounce |
| xterm.js OSC 顯示殘留 | 20% | 中(畫面有垃圾字) | 實驗驗證 |
| 多 watch 資源爆量 | 5% | 低 | watch 去重 |

### 安全風險

| 風險 | 機率 | 影響 | 緩解 |
|------|-----|------|------|
| Terminal 內惡意程式偽造塔台 | 低 | 高(可執行任意命令) | Token gating + path 白名單 |
| Token 洩漏到 log | 低 | 中 | Logger 禁 verbose |
| Path traversal 攻擊 | 低 | 中 | Path 白名單 + canonical 化 |

### 使用者體驗風險

| 風險 | 機率 | 影響 | 緩解 |
|------|-----|------|------|
| Agent 完工但檔案沒寫完 | 20% | 中(塔台誤判 FAILED) | `awaitWriteFinish` debounce |
| Agent hang 住塔台等爆 | 30% | 高(完全卡住) | Timeout 機制(D8) |
| Worker context window 爆表 | 10% | 中(工單中斷) | 這是工單設計問題,與本方案無關 |

---

## 13. 延伸想像:BAT 作為 AI Agent Orchestration Platform

### 產品定位升級

目前 BAT 的定位是「Windows terminal aggregator with multi-workspace support and Claude Code integration」。

這個研究的結論暗示了一個**更大的定位**:

> **BAT = AI-friendly terminal designed for multi-agent orchestration**

### 為什麼這是差異化賣點

市面上的 terminal emulator(iTerm2 / Windows Terminal / Wezterm / Kitty / Alacritty)都是**純 terminal**:
- 目標是「更快、更漂亮、更多 feature」
- 使用者是「工程師打 command」
- **對 AI agent 沒有一等公民支援**

BAT 如果實作本研究的方案,會成為**第一個**:
- 讓 AI agent 能從 terminal 內反向控制 terminal 的 emulator
- 提供 agent-agnostic 的 orchestration primitive
- 內建工作流引擎(檔案監聽 + 條件觸發 + notify)

### 可能的殺手級場景

1. **塔台 / BMad-Method dog-food**(本研究的動機)
2. **Agent pipelines**:`bat exec "claude analyze --watch '**/*.ts'"` 啟動一個 watcher agent,改檔就重新分析
3. **跨 agent 工作流**:T0013 給 copilot、T0014 給 cursor、T0015 給 aider,塔台統一調度
4. **Multi-agent 對話**:多個 agent 在不同 tab 跑,透過 BAT 互相 notify 形成對話
5. **IDE 替代品**:Aider / Cursor 本身是 CLI-first,BAT + 協議可以組成 "agentic IDE without IDE"

### 競品分析

| 競品 | AI Agent 支援 | 差異 |
|------|--------------|------|
| iTerm2 | ❌ 無 | 純 terminal,OSC 1337 只是自用 feature |
| Windows Terminal | ❌ 無 | Microsoft 想做,但綁 Copilot 太死 |
| Wezterm | ❌ 無 | Lua scriptable,但 agent orchestration 不是目標 |
| Warp | ⚠️ 有 AI,但閉源 + 綁自家 agent | 商業模式綁定,不 open |
| BAT(本研究後) | ✅ Agent-agnostic orchestration | **獨有** |

### Roadmap 建議(脫離塔台 scope)

這個研究如果變成 BAT 的產品 Roadmap,應該:
1. **v2.2**:實作 Phase 1(內部 dog-food)
2. **v2.3**:實作 Phase 2(公開 `bat` CLI + Protocol Spec)
3. **v2.5**:官方整合範例(Aider / Cursor / Claude)
4. **v3.0**:AI Agent Orchestration 作為 BAT 的主打賣點

---

## 附錄 A:參考資料

- **iTerm2 OSC 1337 Proprietary Escape Codes**:https://iterm2.com/documentation-escape-codes.html
- **Windows Terminal OSC 9;4 Progress Indicator**:https://learn.microsoft.com/windows/terminal/tutorials/progress-bar-sequences
- **VS Code Remote CLI Design**:`VSCODE_IPC_HOOK_CLI` env var mechanism
- **xterm.js Parser API**:https://github.com/xtermjs/xterm.js/blob/master/typings/xterm.d.ts (`registerOscHandler`)
- **chokidar**:https://github.com/paulmillr/chokidar (跨平台檔案監聽)
- **Node.js fs.watch quirks**:https://nodejs.org/api/fs.html#caveats

## 附錄 B:相關既有工單 / 學習紀錄

- **L007** — vite build 通過 ≠ 型別正確(本方案大量新增 IPC contract,同樣風險)
- **L008** — 平行工單必須明確檔案所有權邊界(T0014 / T0015 要仔細劃分 BAT 端 vs 塔台端)
- **T0013** — voice IPC drift(同樣是「跨工單 IPC contract drift」的問題,本方案的 OSC 協議設計要從 T0013 教訓中學習,**單一 source of truth**)

---

## 結語

這份研究的核心洞察是:

1. **塔台在 BAT 裡跑,不需跨進程** — 之前誤以為要啟動外部 exe,是重大理解偏差
2. **下行和上行可共用 OSC 通道** — 一個機制搞定雙向
3. **上行必須 agent-agnostic** — 用工單檔案(天然契約)作為訊號源,不依賴 agent 配合
4. **BAT 已有 `supervisor:send-to-worker`** — 若它真的是寫 PTY,整個上行方案 70% 免費(待驗證)
5. **這不只是塔台 hack,是 BAT 的產品級功能** — 值得進入正式 Roadmap

**下一步**:等使用者 review 決策矩陣 + 回應疑慮 1 的驗證問題,然後產生 T0014 / T0015 工單。

在那之前,此研究已記入塔台 Backlog,標記為「待決策」。
