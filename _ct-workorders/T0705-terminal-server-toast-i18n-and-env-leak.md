---
schema_version: 1
schema_kind: workorder
id: T0705
title: "BUG-171 順手項目：Terminal Server recovery 的三句 toast 改走 i18n；Terminal Server 自己的 `BAT_IDLE_TIMEOUT_MS` / `BAT_SCROLL_BUFFER_LINES` 不再帶進每個 PTY 的 env"
type: implementation
status: FIXED
repo: better-agent-terminal
project: BUG-171
priority: P3
sizing: S
created_at: "2026-10-25T21:16:40+0800"
started_at: "2026-10-25T21:18:50+0800"
updated_at: "2026-10-25T21:24:46+0800"
completed_at: "2026-10-25T21:24:46+0800"
depends_on: [T0703]
related:
  - "T0703 回報區「建議下一步」3 與「調查結論」6 / 7：`src/App.tsx:712-720` 訂閱 `terminalServer.onStatusChange`，`recovering` / `recovered` / `failed` 三句寫死中文；`electron/terminal-server/server.ts:210-212` 建 PTY 時 `...process.env` 全部帶入，server 自己的設定（`BAT_IDLE_TIMEOUT_MS` 由 `electron/main.ts:408` / `:465` fork 時帶入、`electron/terminal-server.ts:30` 讀取；`BAT_SCROLL_BUFFER_LINES` 同理）出現在每個分頁"
  - "D186（使用者 2026-10-25 21:1x：兩件順手項目都做，與 T0704 平行）"
  - "CLAUDE.md「Logging」：PTY env 唯一組裝點 `PtyManager.buildPtyEnv()`（T0525）；`BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` 只來自 host 的 `helperEnv`（T0575）"
affects_files:
  - src/App.tsx
  - "src/locales/（或專案實際的 i18n 資源檔，三句 toast 的 key，所有已有語系都要補）"
  - electron/terminal-server/server.ts
  - "electron/__tests__/ 或 src/**/__tests__/（新測試或既有測試補項）"
  - _ct-workorders/T0705-terminal-server-toast-i18n-and-env-leak.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 toast：只把三句文字換成 i18n key（沿用專案既有 i18n 用法與 key 命名慣例），中文字面意思不變（`終端已恢復（歷史輸出已重置）` 等），其他語系給對應翻譯；不改顯示時機、持續時間、訂閱方式。"
  - "🔴 env：在 server 建 PTY 時排除 server 專用設定（至少 `BAT_IDLE_TIMEOUT_MS`、`BAT_SCROLL_BUFFER_LINES`；先列出 server 啟動時 main 帶入的全部 server 專用 env，逐一判斷）。排除前 grep 確認 `scripts/**`、helper、`bat-hook.mjs`、`bat-mcp.mjs`、`buildPtyEnv` 與任何 PTY 內程式都沒有讀這些變數；有讀的就不排除、寫進回報。不得排除 `buildPtyEnv` 組裝的 env（host 傳來的 env 照舊優先）。direct 模式（不經 Terminal Server）與 headless 不受影響，寫明依據。"
  - "🔴 不改：`electron/pty-manager.ts`、`electron/main.ts`、CLAUDE.md（T0704 正在改，避免同檔並行）。若你認為 CLAUDE.md 需要一句（例如 env 規則），把建議文字寫在回報區，由塔台在兩張完成後合併。"
  - "🔴 驗證：測試涵蓋 server 建 PTY 的 env 不含排除的鍵、仍含 host 傳來的 env；toast 三種狀態顯示 i18n 文字（RTL）。`npm run test:unit` 全綠、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。同批 T0704 同時在 repo 內工作：只 commit 本單 `affects_files`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write 工具（L129）。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。yolo：不得問使用者，判讀問題問塔台（每輪最多 3 題）。"
---

# T0705 — Terminal Server toast i18n 與 env 洩漏

## 背景

T0703 調查 BUG-171 時順手發現兩件與根因無關的小事：Terminal Server recovery 的三句 toast 寫死中文、沒走 i18n；Terminal Server 把自己的設定 env 帶進每個分頁，讓 `BAT_IDLE_TIMEOUT_MS` 出現在使用者分頁環境，造成誤判（T0703 一開始也被它誤導）。

## 實作

1. `src/App.tsx` 三句 toast 改 i18n key，補齊各語系。
2. `electron/terminal-server/server.ts` 建 PTY 時排除 server 專用 env。
3. 測試。

## 驗收

- [ ] 三句 toast 走 i18n，中文字面不變
- [ ] Terminal Server 建立的分頁 env 不含 server 專用鍵；host 傳來的 env 照舊
- [ ] `npm run test:unit` 全綠；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 待塔台決策（僅 yolo Worker 有問題時）

無（未向塔台提問）。

### 完成狀態

✅ **FIXED**（三項驗收全過；toast 的實機顯示待 BUG-171 驗收時一併確認）

落點檢查：**PASS**。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = 主 checkout，非 worktree，`CT_HOME` 未設）；C-1 工單在 REPO_ROOT 下；C-3 前 5 個可測項（`src/App.tsx`、`electron/terminal-server/server.ts` 等）皆存在；C-2 工單無 `branch` 欄位（目前 `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 實作摘要

**1. toast 走 i18n**

- 新增 3 個 key（`src/locales/en.json` / `zh-TW.json` / `zh-CN.json` 的 `app` 區塊，沿用 `app.*` camelCase 慣例）：

  | key | zh-TW（與 T0705 前逐字相同） | en | zh-CN |
  |---|---|---|---|
  | `app.terminalServerRecovering` | Terminal Server 異常，正在自動恢復... | Terminal Server stopped responding, recovering automatically... | Terminal Server 异常，正在自动恢复... |
  | `app.terminalServerRecovered` | 終端已恢復（歷史輸出已重置） | Terminals recovered (output history was reset) | 终端已恢复（历史输出已重置） |
  | `app.terminalServerRecoveryFailed` | Terminal Server 恢復失敗，請重新啟動應用程式 | Terminal Server recovery failed. Please restart the app. | Terminal Server 恢复失败，请重新启动应用程序 |

- 新增 `src/components/ServerStatusToast.tsx`：`SERVER_STATUS_TOAST_KEYS`（status → key）與 `ServerStatusToast` 元件（render 時 `t(key)`，DOM 仍是 `<div className="server-status-toast" onClick>`，CSS 不變）。
- `src/App.tsx`：state 改存 key（`ServerStatusToastKey | null`），`onStatusChange` 三個分支只把字串換成 `SERVER_STATUS_TOAST_KEYS.*`；`recovered` 的 3 s `setTimeout`、`recovering` / `failed` 不自動消失、點擊關閉、訂閱位置與方式都沒改。
- 為什麼存 key 而不是在 callback 內 `t()`：該 `useEffect` 依賴是 `[]`，callback 內的 `t` 是第一次 render 的；存 key、render 時翻譯，toast 顯示中切語言也會跟著換（測試涵蓋）。

**2. server 專用 env 不進 PTY**

- 先列出 main fork Terminal Server 時帶入的 env（`electron/main.ts:401-410` `startTerminalServer`、`:458-467` `reforkTerminalServer`，兩處相同）：`...terminalServerInheritedEnv()`（= main 的 `process.env` 去掉 `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN`，T0575）+ 3 個 server 專用鍵：
  | 鍵 | 誰讀 | 判斷 |
  |---|---|---|
  | `BAT_IDLE_TIMEOUT_MS` | 只有 `electron/terminal-server.ts:30` | **排除** |
  | `BAT_SCROLL_BUFFER_LINES` | 只有 `electron/terminal-server.ts:27` | **排除** |
  | `BAT_USER_DATA` | `electron/terminal-server.ts:15`，以及 PTY 內的 `scripts/_bat-cert.mjs`、`scripts/_bat-logger.mjs`（T0481 解析順序）| **不排除**（PTY 內程式會讀；本機 PTY 另由 `localHelperEnv()` 經 host env 帶入）|
- grep 依據：全 repo（排除 `node_modules` / `release` / `dist-electron` / `.git`）搜尋 `BAT_IDLE_TIMEOUT_MS|BAT_SCROLL_BUFFER_LINES`，程式碼只命中 `electron/main.ts`（寫入）與 `electron/terminal-server.ts`（讀取），其餘全是 `_ct-workorders/` 文件；`scripts/**`（含 `bat-hook.mjs`、`bat-mcp.mjs`、helper）、`electron/pty-manager.ts`（`buildPtyEnv`）、`src/**` 都沒有。
- `electron/terminal-server/server.ts`：新增 `TERMINAL_SERVER_OWN_ENV_KEYS` 與純函式 `buildServerPtyEnv(serverEnv, hostEnv)`，`createPty` 改呼叫它。只從 **server 自己的 `process.env`** 刪這兩個鍵，再疊上 host 傳來的 `req.env`（`buildPtyEnv` 組裝的 env，照舊優先；host 若刻意傳同名鍵也保留），最後疊終端預設值、刪 `ELECTRON_RUN_AS_NODE`（BUG-038，順序與原本相同）。
- direct 模式與 headless 不受影響：direct 模式由 `PtyManager` 在 Electron 主程序直接 spawn，主程序的 `process.env` 本來就沒有這兩個鍵（只寫在 fork 的 `env` 選項）；headless（`electron/remote/headless-entry.ts`）不使用 Terminal Server —— `TerminalServer` 只由 `electron/terminal-server.ts`（被 `main.ts` fork）建立，grep `terminal-server/server` 只命中這兩處。

**範圍外偏差**：新增 `src/components/ServerStatusToast.tsx`（不在 `affects_files`）。理由：App 沒有任何 RTL 測試能 render（依賴太多），要符合「toast 三種狀態顯示 i18n 文字（RTL）」需把 toast 抽成可單獨 render 的元件；另以 source guard 鎖住 App.tsx 的三個分支與沒有寫死文字。

### 驗證證據

驗證時 HEAD = `b3cbe59a`（工作樹含本單變更與 T0704 的平行變更），全部在 commit `d7ffa080` 前跑完、之後沒有再改產品檔。

| 關卡 | 結果 |
|---|---|
| 新測試 `electron/__tests__/terminal-server-pty-env.test.ts`（7 項）+ `src/components/__tests__/server-status-toast.test.tsx`（8 項） | ✅ 15 passed |
| 反向確認：暫時註解掉排除迴圈 | ✅ 2 項如預期失敗（`buildServerPtyEnv` 單元 + 真 node-pty：`expected '1800000' to be '%BAT_IDLE_TIMEOUT_MS%'`），已還原 |
| `npm run test:unit` | ✅ 336 files / 5987 passed / 3 skipped，exit 0 |
| `npm run typecheck` | ✅ exit 0（= 0） |
| `npm run typecheck:electron` | ✅ exit 0（= 0） |
| `npx vite build` | ✅ exit 0 |
| 換行 | ✅ 8 個檔案 working tree 與 blob 皆 0 個 CR |

測試涵蓋：
- env：排除兩個 server 鍵、保留其他 server env 與 `BAT_USER_DATA`、host env 保留且優先、host 刻意傳的同名鍵保留、終端預設值最後套用、不改動傳入的 env；真 node-pty shell（Windows `cmd.exe`）經 `handleMessage` 建立，shell 內讀不到 `BAT_IDLE_TIMEOUT_MS` / `BAT_SCROLL_BUFFER_LINES`、讀得到 host 傳的 `T0705_HOST`。
- toast（RTL）：zh-TW 三種狀態字面與 T0705 前相同；en / zh-CN 每種狀態有自己的譯文（不是 key、不是中文原文）；顯示中切換語言會更新；點擊呼叫 `onDismiss`；App.tsx source guard。

未做：實機 recovery 觸發後的 toast 外觀（需真的讓 Terminal Server 失聯，屬 BUG-171 驗收範圍）。

### CLAUDE.md 建議段落

建議由塔台在 T0704 完成後，於 CLAUDE.md「Logging」節「PTY env 唯一組裝點」那一條後面補一句（本單未改 CLAUDE.md）：

> Terminal Server 模式下 server 以 `buildServerPtyEnv`（`electron/terminal-server/server.ts`）疊 env：server 的 `process.env` 先去掉 `TERMINAL_SERVER_OWN_ENV_KEYS`（`BAT_IDLE_TIMEOUT_MS` / `BAT_SCROLL_BUFFER_LINES`，T0705），再疊 host 的 env（優先）。main fork server 時新增 server 專用 env，若 PTY 內程式不讀，一併加進該清單。

### 遭遇問題

- 無阻斷問題。
- Git Bash 的 `grep -c $'\r'` 在本機會把每一行都算進去（誤報 CRLF）；改用 `tr -cd '\r' | wc -c` 確認為 0。
- 順手發現（未處理，範圍外）：`src/components/RecoveryPrompt.tsx`（BAT 重開時的 Recovery 提示）文字也是寫死中文，沒走 i18n。建議塔台視需要另開小單。

### Commit

- `d7ffa080` fix(terminal-server): T0705 recovery toast via i18n; keep server-only env out of PTYs（8 檔：`electron/terminal-server/server.ts`、`src/App.tsx`、3 個 locale、`src/components/ServerStatusToast.tsx`、2 個新測試；以 `git commit --only` 只提交本單檔案，T0704 的 `electron/pty-manager.ts` 與其工單未動）
- 工單本身另一個 commit（見 git log）。未 push。

### 互動紀錄

無（yolo，未提問、使用者未介入）。

### 回報時間

2026-10-25T21:24:02+0800
