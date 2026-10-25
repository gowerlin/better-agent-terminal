---
schema_version: 1
schema_kind: workorder
id: T0705
title: "BUG-171 順手項目：Terminal Server recovery 的三句 toast 改走 i18n；Terminal Server 自己的 `BAT_IDLE_TIMEOUT_MS` / `BAT_SCROLL_BUFFER_LINES` 不再帶進每個 PTY 的 env"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-171
priority: P3
sizing: S
created_at: "2026-10-25T21:16:40+0800"
started_at: ""
updated_at: "2026-10-25T21:16:40+0800"
completed_at: ""
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

### 完成狀態

### 實作摘要

### 驗證證據

### CLAUDE.md 建議段落

### 遭遇問題

### Commit

### 回報時間
