---
schema_version: 1
schema_kind: workorder
id: T0390
title: "PLAN-036 P0-C：`pty:*` + `settings:get-shell-path` 共用註冊並上線 headless（冪等 create、斷線不 kill、env 隔離、shell 驗證）"
type: implementation
status: TODO
priority: P1
sizing: M
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-05T00:20:00+08:00"
started_at: null
completed_at: null
target_version: next
depends_on: [T0388, T0389]
related:
  - "PLAN-036 / D129"
  - "T0386 回報區 §4（PTY 重連語意 / helper env / shell 路徑）、§5（安全限制）、§7（P0 可用定義）、建議工單清單 C"
affects_files:
  - electron/handlers/pty.ts
  - electron/main.ts
  - electron/pty-manager.ts
  - electron/shell-path-resolver.ts
  - electron/remote/headless-entry.ts
  - electron/remote/headless-channel-status.ts
  - electron/remote/__tests__/headless-pty.test.ts
  - electron/remote/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。"
  - "🔴 不得碰使用者 WSL 內的 `bat-server.service` / `~/.local/bat-server`；WSL 部署交使用者以 T0391 工具執行。"
  - "🔴 headless 遠端 shell env **不得**注入 server token / `BAT_REMOTE_*`；`pty:create` 的 `shell` 參數於 headless 端驗證為絕對路徑且存在。"
  - "🔴 No Regressions：本機終端行為不變（smoke 必做）。不 push。"
---

# T0390 — headless 終端上線

## 範圍（依 T0386 §4 / §5 / §7）

1. `electron/handlers/pty.ts`（新）：`registerPtyHandlers(register, deps)` 註冊 `pty:*`（create / write / resize / kill / restart / get-cwd，以 `PROXIED_CHANNELS` 實際清單為準）+ `settings:get-shell-path`；Electron main 改呼叫它（取代 `main.ts:1964-1976` / `:2172-2183` 內聯註冊），headless 也呼叫它
2. direct 模式 `pty:create` **冪等**：同 id 已存在即回 `true` 不重開；修正舊行程 exit 時 `instances.delete(id)` 誤刪新 entry
3. client 斷線不 kill PTY；斷線期間輸出回放（50 行 ring buffer）是否實作由 Worker 決定並寫理由；孤兒 PTY 回收策略寫進回報區（實作可留 P1）
4. headless env：不注入 helper dir、不注入 server token；`shell` 參數驗證
5. `shell-path-resolver.ts` `auto` 在 Linux 無 `$SHELL` 時的 fallback 與 PtyManager（`/bin/bash`）對齊
6. parity 清單（T0388）移除已上線 channel
7. **T0388 交接**（`694771c`）：
   - 共用 module 掛到 `electron/remote/headless-entry.ts` 的 `HEADLESS_HANDLER_MODULES`；HostDeps 由 `createHeadlessHostDeps(dataDir)` 組（型別見 `electron/handlers/types.ts`）
   - 從 `electron/remote/headless-channel-status.ts` `HEADLESS_UNSUPPORTED` 移除 P0 的 7 個（`pty:*` 6 + `settings:get-shell-path`），parity test 會檢查
   - `ALWAYS_LOCAL_CHANNELS` 目前兩份（`main.ts` 與 `headless-channel-status.ts`，parity test 讀 main.ts 原始碼比對）：本單會改 `main.ts`，順手改為 `main.ts` import `headless-channel-status.ts` 的那份，刪除重複
   - 整合測試用 `electron/remote/__tests__/helpers/headless-harness.ts`（測試檔頭需 `// @vitest-environment node`）

## 驗收

- vitest headless 整合（T0388 harness，真 node-pty）：`pty:create → write → 收到 output → resize → kill → exit`；重送同 id `pty:create` 不重 spawn；env 不含 token；非法 shell 被拒
- `npm run test:unit` 全綠；`npx vite build` exit 0；`npx tsc --noEmit` ≤ **40**
- 本機 smoke：本機終端開啟 / 輸入 / resize / 關閉正常
- **P0 實機驗收（交使用者）**：用 T0391 工具部署到 WSL → WSL profile 開出視窗 → 預設終端出現 bash prompt → 輸入 / resize / kill / restart / cwd 正確 → 關閉 BAT 重開後同 id 終端不重複 spawn。回報區寫出完整步驟

## Sub-session 執行指示

1. 讀取本工單 + PLAN-036 + T0386 回報區 + T0388 / T0389 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
