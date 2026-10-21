---
schema_version: 1
schema_kind: workorder
id: T0697
title: "內嵌 codex 追版：@openai/codex-sdk ^0.160.0 → ^0.163.0（含 @openai/codex 與平台子套件），核對原生 binary 路徑解析、Codex 面板、BAT MCP / OSC 7501 / daemon 整合點"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-10-22T01:44:28+0800"
target_version: "0.7.1-pre.6"
depends_on: []
related:
  - "D181（`v0.7.1-pre.6` 發版批次）：塔台 2026-10-22 01:4x 查 `npm view @openai/codex-sdk version` = 0.163.0，實裝 `@openai/codex-sdk` / `@openai/codex` 0.160.0；使用者選「加 codex 追版再發」"
  - "T0690（內嵌 claude CLI 追版 2.1.306）：步驟、lock 只動目標套件的做法、驗證項目與證據格式都照它做"
  - "`electron/codex-agent-manager.ts`（`@openai/codex-sdk` 動態 import、原生 binary 路徑 `@openai/codex-<platform>-<arch>/vendor/<triple>/bin/codex[.exe]`（>= 0.160））、`electron/codex-bundled-path.ts`（註解：沿用 SDK 0.160 `resolveNativePackage()` / `prependPathDirs()`）"
  - "CLAUDE.md「BAT MCP shim」節：codex 升版時必跑 `e2e/t0592-codex-tower-worker.spec.ts`；codex 共用 daemon（T0648 / T0651）升版時查 `tui/src/daemon_startup.rs` `config_exclusion`。「blocked 狀態偵測」/「Worker 啟動確認」節：codex OSC 7501 需 `>= 0.163.0`，codex 升版時必跑 `e2e/t0621-codex-osc-state.spec.ts`"
  - "`docs/agent-guide/usage-limit-continue.md`：用量限制句型取自 codex-cli 0.160.0 / 0.162.1 binary（T0564）"
affects_files:
  - package.json
  - package-lock.json
  - CLAUDE.md
  - docs/agent-guide/
  - electron/codex-agent-manager.ts
  - electron/codex-bundled-path.ts
  - electron/__tests__/
  - src/lib/usage-limit.ts
  - src/lib/__tests__/
  - scripts/verify-native-modules.js
  - scripts/verify-packaged-native.js
  - scripts/__tests__/
  - e2e/
  - _ct-workorders/T0697-bump-embedded-codex-0.163.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權修改 `package.json` 的 `@openai/codex-sdk` 版本與對應 `package-lock.json`（含 `@openai/codex` 與 `@openai/codex-*` 平台子套件）；其他相依**不得**連帶升版：lock diff 只能涉及 codex 系列與 root `dependencies` 那一行，npm 產生的 `peer` 等旗標雜訊比照 T0541 / T0690 以移植方式去掉，回報區附 `git diff --stat package-lock.json` 與逐套件比對。"
  - "🔴 `package.json` 的 `version` 欄位不動（塔台發版時另行處理）；`@anthropic-ai/*` 不動。"
  - "🔴 開工時再查一次 `npm view @openai/codex-sdk dist-tags` / `time` 與 `npm view @openai/codex dist-tags`；latest 若已高於 0.163.0，取當下 latest 並在回報區說明；SDK 與 codex 版本不一致時以 SDK 的 dependency 為準。"
  - "🔴 核對新版變化（官方 release notes / CHANGELOG 0.161 起各版、套件內容、binary 字串；附證據）：① 原生 binary 的套件目錄結構仍符合 `codex-bundled-path.ts` / `codex-agent-manager.ts` 的解析（含 legacy 分支），`verify-native-modules.js` / `verify-packaged-native.js` 若有 codex 檢查項同步核對；② SDK API（`codex-agent-manager.ts` 用到的 export 與選項）沒有破壞性變動；③ BAT 整合點：`-c mcp_servers.bat.*`（含 `env_vars`）、`--no-daemon`（`codexNoDaemonDecision`）、`tui/src/daemon_startup.rs` 的 `config_exclusion`、`-c check_for_update_on_startup=false`、OSC 7501 序列格式（`src/lib/codex-terminal-state.ts`）、`src/lib/usage-limit.ts` 的 codex 句型仍出現在新 binary。任何一項有變動而會影響 BAT 時，先用 BAT 通道問塔台，不要自行改產品行為。"
  - "🔴 測試、註解、docs 中寫死 `0.160.0` 的地方：區分「代表內嵌實裝版本」（更新）與「歷史實測紀錄 / 任意測試字串 / 版本門檻」（不動，例如 `>= 0.156.0`、`>= 0.163.0` 門檻與 T0586 / T0592 的實測敘述），回報區逐一列出處置。"
  - "🔴 驗證：內嵌 codex 原生 binary `--version` = 新版；`node scripts/verify-native-modules.js` exit 0；`npm run test:unit` 全綠；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；e2e `e2e/t0592-codex-tower-worker.spec.ts` 與 `e2e/t0621-codex-osc-state.spec.ts`（需先 `npx vite build`，CLAUDE.md 規定 codex 升版必跑）綠。e2e 只用隔離實例；不得以預設實例（無 `--runtime`）啟動 source build；不碰使用者正在用的 BAT 與其 userData；不開會耗 token 的 codex turn。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），本單原則上不需要 gh。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`，scratchpad 路徑也一樣。yolo：不得問使用者，判讀問題問塔台。"
---

# T0697 — 內嵌 codex 追版 0.163

## 背景

- 內嵌 `@openai/codex-sdk` / `@openai/codex` 實裝 `0.160.0`；塔台 2026-10-22 01:4x 查 `npm view @openai/codex-sdk version` = `0.163.0`。
- 內嵌 codex 供 Codex 面板（SDK 路線）與 e2e（T0592 app-server）使用；codex CLI 分頁用系統 codex，不受影響。
- 本單完成、塔台聯合驗證後即發 `v0.7.1-pre.6`（D181），與 BUG-169（T0691）、T0692、T0694 同批。

## 實作

照 T0690「實作」1–6 的做法，對象換成 codex：

1. 開工時再查 latest（見 `memory_overrides` 第 3 條）。
2. `package.json` 改 `@openai/codex-sdk` 為 `^<新版>`；更新 lock；lock diff 只含 codex 系列。
3. 內嵌原生 binary `--version`、`verify-native-modules`。
4. 核對新版變化（見 `memory_overrides` 第 4 條，含原生路徑解析、SDK API、BAT 整合點與 `usage-limit.ts` 句型）。
5. 寫死 `0.160.0` 的測試 / 註解 / docs 逐一處置。
6. CLAUDE.md 與 docs 更新內嵌實裝版本（歷史實測敘述保留）。

## 驗收

- [ ] 內嵌 codex `--version` = 新版；`verify-native-modules` ✅
- [ ] lock diff 只涉及 codex 系列（附 diff 摘要與逐套件比對）
- [ ] `npm run test:unit`、`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] e2e t0592 / t0621 綠
- [ ] 原生路徑解析 / SDK API / BAT 整合點 / `usage-limit.ts` 句型的核對結果（有改或無改都附證據）
- [ ] 回報區列出需實機驗證的項目（mac / Linux 內嵌 codex 由 pre.6 CI 的 `verify-packaged-native` 確認；Codex 面板實際對話需真人）

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 版本與 lock

### 核對結果

### 寫死版本的處置

### 驗證證據

### 需實機驗證

### 遭遇問題

### Commit

### 回報時間
