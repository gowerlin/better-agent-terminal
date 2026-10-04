---
schema_version: 1
schema_kind: plan
id: PLAN-036
title: headless bat-server 功能 handler 層（終端 / Agent / git / fs），讓 WSL / SSH / Docker 遠端 profile 真正可用
status: IN_PROGRESS
priority: high
created_at: "2026-10-04T23:34:17+08:00"
updated_at: "2026-10-05T00:57:46+08:00"
links:
  research_workorder: T0386
  p0_workorders: [T0388, T0389, T0390, T0391, T0393]
  related: [BUG-094, T0385, PLAN-035, PLAN-031, PLAN-015, BUG-093]
---

# PLAN-036 — headless bat-server 功能 handler 層

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-036 |
| 優先級 | 🔴 High |
| 狀態 | 🔄 IN_PROGRESS（Phase 0 T0386 DONE；P0 T0388-T0391 + T0393 全 DONE（00:57），待 P0 實機驗收） |
| 建立時間 | 2026-10-04 23:34 (UTC+8) |
| 決策 | D129（架構：共用註冊模組 + DI；fs roots 由 client 推送；遠端 Agent 沿用遠端 router） |

## 背景與動機

T0385（BUG-094）盤點證實：headless bat-server（WSL / SSH / Docker 遠端 profile 的伺服器端）**註冊的功能 handler 數量為 0**。

- `scripts/bat-server.mjs:118` 呼叫 `createHeadlessServer` 不傳 `handlers`
- `_spec-remote-dev-support-2026-04.md` §2.3 規劃的 `electron/handlers/`（renderer-agnostic 純 JS handler）從未落地；`build-server-bundle.mjs` 的複製步驟因目錄不存在而靜默略過
- T0385 只補了開 profile 主路徑（`profile:*` 子集 + `settings:load/save`），遠端 profile 現在能開出**空視窗**，但 `pty:*` / `claude:*` / `git:*` / `fs:*` 等全部 `No handler for channel`

⇒ PLAN-007 / PLAN-031 / PLAN-035 一路做的遠端環境（打包、分發、精靈、常駐）最終交付的伺服器**沒有可用功能**。

## 缺口（T0385 回報區 B-2，T0386 複核）

| 優先 | 缺口 | 已知難點 |
|---|---|---|
| P0 | `settings:get-shell-path` + `pty:*`（6 個） | `electron/pty-manager.ts` import `electron` `app` / `BrowserWindow`；bundle 已含 `@lydell/node-pty-<target>` |
| P1 | `claude:*`（約 40 個） | `claude-agent-manager.ts` 依賴 runtime router / settings；bundle 已含 claude-code / agent-sdk |
| P2 | `git:*` / `git-scaffold:*` / `fs:*` / `image:read-as-data-url` / `github:*` / `worktree:*` | path sandbox（`isPathAllowed`）在 headless 需重新定義 |
| P3 | `snippet:*`（better-sqlite3）、`terminal:*`（Tower 通知） | 次要 |

## 階段

1. **Phase 0**：研究 T0386 —— 解耦策略、共用 handler 架構（避免 Electron 端與 headless 端雙實作漂移）、分階段拆單
2. **Phase 1+**：依 T0386 拆單（預期 P0 終端先行）

## 相關觀察（T0385）

- `App.tsx` initProfile 的 `remote.connect(host, port, token)` 不帶 fingerprint，會以新 client 取代 main 已做 pin 驗證的 client
- 本機驗證 headless 改動缺工具：無 local-tarball override、manifest 產生器要求三 target、`fetch:baseline` 無 skip 旗標

## P0 拆單（D129，2026-10-04 23:58）

| 工單 | 內容 | 依賴 | 狀態 |
|---|---|---|---|
| T0388 | 共用骨架 `electron/handlers/types.ts` + channel parity test + electron-free guard + vitest headless harness | — | ✅ DONE（`694771c`，00:17 複驗） |
| T0389 | claude-runtime-router 設定注入 + embedded resolver 合一（bundle `bin/claude`）+ PtyManager DI | T0387（`main.ts`） | ✅ DONE（`566c6da`，00:20 複驗：1039 tests / vite / tsc 40；本機 smoke 終端 / claude-cli / Agent 三項） |
| T0390 | `pty:*` + `settings:get-shell-path` 上線 headless（冪等 create、斷線不 kill、env 隔離） | T0388、T0389 | ✅ DONE（`f2b68ce`，00:41 複驗：1051 tests / vite / tsc 40；HEADLESS_UNSUPPORTED 96 → 89） |
| T0391 | `scripts/dev-deploy-headless.mjs`（JS-only 部署到 WSL / dir，dry-run 預設） | — | ✅ DONE（`f102a55`，00:17 複驗；`npm run deploy:headless:dev`） |
| T0393 | 遠端視窗 shell 清單依遠端 OS 過濾 + WSL 工作區資料夾挑選預設 WSL home、`/mnt/c` 提示（使用者 2026-10-05 00:02 實機回報後裁決納入 P0） | T0390 | ✅ DONE（`c58fc80`，00:57 複驗：乾淨 worktree 1047 + dev-deploy 27 = 1074 / vite / tsc 40） |

P0 可用定義：WSL profile 開出視窗 → 預設終端出現 bash prompt → 輸入 / resize / kill / restart / cwd 正確 → 關閉 BAT 重開後同 id 終端不重複 spawn → 設定可選 bash、新增工作區預設開在 WSL home（T0393）。

P1-P3（T0386 建議清單 E-K）：P0 實機驗收後開單。

## P0 進度備註（2026-10-05 00:17）

- T0388：`HEADLESS_UNSUPPORTED` 初始 96（P0 7 / P1 43 / P2 30 / P3 16）+ headless 已支援 8 + ALWAYS_LOCAL 2 = `PROXIED_CHANNELS` 106；parity / electron-free 守門皆做負向驗證
- T0391：`npm run deploy:headless:dev -- --target wsl:Ubuntu-24.04`（預設 dry-run，`--yes` 寫入並 `.bak-<tag>` 備份，`--rollback` 還原）；WSL `--yes` + restart 段未實機（工單禁令），P0 實機驗收時首次使用
- 待辦（非阻擋）：`dev-deploy-headless.mjs` 會隨安裝檔出貨（`extraResources` `*.mjs`，無害）；build 設定解析器兩份（`dev-deploy-headless.mjs` / `__tests__/helpers/server-bundle-config.ts`）宜合併；Windows 上 schema-only `build-server-bundle` 停在 `pruneAnthropicPackages`（既有）；tarball 內含 `electron/remote/*.ts` 原始碼（既有，無用負載）
- 塔台驗證環境備註：scratchpad git worktree（`node_modules` 以 junction 共用）下 `scripts/__tests__/dev-deploy-headless.test.mjs` 載入即 `SyntaxError`（無堆疊），主工作區 27/27 pass；判定為驗證環境異常，未深追

## P1 候選（T0390 回報，2026-10-05 00:41）

- 斷線期間輸出回放：拉取式 `pty:get-buffer(id)`（結果只回呼叫者、不廣播；ring buffer 需避免切斷 VT escape）。P0 現況：重開 BAT 後還原的遠端終端畫面為空，按 Enter 出現 prompt
- 孤兒 PTY 回收：無 client 閒置 N 小時（建議 24h）回收、client 對帳、每台 server PTY 上限（建議 64）；需 `RemoteServer` 提供 client 數 / 連線事件
- `pty:create` 回傳「是否為新 spawn」：create 冪等後，還原 terminal-driven agent preset 時會把啟動指令再打進仍在跑 agent 的 shell（本機 Terminal Server 模式自 T0111 即如此）
- 遠端 `BAT_SESSION=1` 但無 `BAT_HELPER_DIR`：遠端 Tower auto-session 會走 fallback（P3 / K 再決定）
- 既有 bug 另案：BUG-101（本機 Terminal Server 模式 restart 失聯）

