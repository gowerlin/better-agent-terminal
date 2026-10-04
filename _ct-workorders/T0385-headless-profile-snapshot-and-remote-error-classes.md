---
schema_version: 1
schema_kind: workorder
id: T0385
title: "BUG-094 修復：headless bat-server 補遠端 profile 所需 channel（含 `profile:load-snapshot`），並把「連不上」錯誤分類"
type: implementation
status: TODO
priority: P1
sizing: M
created_at: "2026-10-04T23:21:01+08:00"
updated_at: "2026-10-04T23:21:01+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: []
related:
  - "BUG-094（修復對象）"
  - "PLAN-035 Phase 1 實機驗收"
  - "BUG-093（下一張，串行；本單不做）"
affects_files:
  - electron/remote/headless-entry.ts
  - electron/remote/
  - scripts/bat-server.mjs
  - scripts/_bat-server-helpers.mjs
  - electron/main.ts
  - electron/__tests__/
  - tests/headless-server.test.ts
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不得停止、重裝或改寫使用者 WSL 內現有的 `bat-server.service` / `~/.local/bat-server`；不得 `wsl --shutdown` / `--terminate`。本機 runtime 驗證以 scratchpad 或另一個埠（非 9876 / 9877）啟動 headless 執行。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設（CLAUDE.md Child Process Spawning）。禁用 shell-spawning exec API。"
  - "🔴 Renderer 不得 import Node builtin（D090）；main 端 log 用 `logger`。"
  - "⚠️ 本單之後串行 BUG-093（SSH 精靈 tunnel），本單不碰 `src/components/setup-wizard/`。不 push。"
---

# T0385 — headless 補 channel + 遠端錯誤分類

## 背景（BUG-094）

PLAN-035 Phase 1 實機驗收（安裝版 = 本機 build `0.5.9-pre.4`，含 T0384）：WSL 精靈全程通過，`bat-server.service` 在 `127.0.0.1:9877` 正常執行、keep-alive 生效、主機可連線、認證與指紋都通過；但開啟 profile 時跳 `Remote profile unreachable … not running or did not respond within 6 seconds.`

BAT log：

```
[RemoteClient] Connected to localhost:9877 (fingerprint=22:3A:E4:C7:4F:4F:7C:D1...)
[ERROR] [profile] remote profile wsl-ubuntu-24-04 snapshot fetch failed: No handler for channel: profile:load-snapshot
```

塔台初判（詳見 BUG-094）：

1. `profile:load-snapshot` 只在 Electron 主程式註冊（`electron/main.ts:3024`），headless server 沒有
2. `electron/main.ts:1236-1238` 把任何 invoke 錯誤都映射成 `remote-unreachable`，對話框文案誤導

## 範圍

### A. 盤點（先做，寫進回報區）

- 列出 **client 端在遠端 profile 流程中會對遠端 invoke 的 channel**（開啟 profile、還原視窗 / workspace、開終端、Agent 等主要路徑），對照 headless server 實際註冊的 handler，產出差異表：channel / client 呼叫點 / headless 是否有 / 缺少的影響
- 釐清 headless 的 profile 模型：headless 有沒有 profile store；`remoteProfileId || 'default'` 在 headless 的語意；`load-snapshot` 應回什麼（`null` → client 走什麼路？空視窗？預設 workspace？）

### B. 修復

1. headless 註冊 `profile:load-snapshot`（以及盤點出的**開啟 profile 主路徑上**必定會撞到的其他缺口）。回傳語意以 client 端現有處理為準，讓 WSL profile 能開出可用視窗
2. 盤點出的其他缺口若超出主路徑（例如次要功能），**不在本單補**，列在回報區由塔台拆單
3. `electron/main.ts` 錯誤分類：至少區分
   - 連線失敗（refused / timeout）→ 維持現有「未執行或未回應」
   - 指紋不符 / 認證失敗 → 指出是信任 / token 問題
   - 已連線但遠端呼叫失敗（如 `No handler for channel`）→ 指出伺服器版本與 BAT 不相容或功能未支援，附原始錯誤
   - 對話框文案沿用現有英文風格（`dialog.showMessageBox`，非 i18n）；若 Worker 認為應走 i18n，回報區提出，不在本單改

### C. 交付到 WSL 的路徑（只調查、寫進回報區）

WSL 內的 bat-server 來自 server bundle（baseline tarball 由 `prebuild` 從 GitHub Release 抓，本機打包不會帶本地 headless 改動）。回報：使用者要在本機驗證本修復，需跑哪些指令（例如 `npm run build:server-bundle:linux-x64` → 如何讓精靈 / 打包使用本地 tarball → 重新部署到 WSL）。若現有流程做不到，說明缺口，不在本單加工具。

## 驗收

- unit：headless 端 `profile:load-snapshot` handler（有 / 無 snapshot）；main 端錯誤分類（三類各一例以上）
- `npm run test:unit` 全綠（基線 **905**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **本機 runtime**：在 scratchpad / 非 9876、9877 的埠啟動 headless server，以 RemoteClient（或等價腳本）invoke `profile:load-snapshot` 得到非錯誤回應；驗完停掉、清乾淨
- **runtime 驗收（交使用者）**：依 C 的步驟部署後，WSL profile 能開出視窗

## Sub-session 執行指示

1. 讀取本工單 + BUG-094
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. A 盤點 → B 實作 → 驗收 → C 調查
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；B-2 有未補缺口時仍可 DONE，但須列清單。BUG 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
