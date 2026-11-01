---
schema_version: 1
schema_kind: workorder
id: T0772
title: "pre.4 自動化驗收（安裝版）：環境類 —— BUG-189 npm 安裝的 codex（暫存 prefix）、BUG-191 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 下以 plugin 安裝 CT"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T05:08:42+0800"
depends_on: []
related:
  - "BUG-189（T0758 `ddfb4f38`）、BUG-191（T0760 `eb5c0589`）；D215（本批自動化驗收）"
  - "既有 e2e：`e2e/t0742-codex-no-daemon.spec.ts`（含 T0758 的 npm shim 情境）；隔離實例 `e2e/fixtures/electron-isolation.ts`（`BAT_E2E_EXECUTABLE`）"
  - "CLAUDE.md「BAT MCP shim」節（codex 共用 daemon、`--no-daemon`、`resolveNpmCodexShim`）、「Claude Agent SDK / CLI」節（Claude 設定目錄、plugins 目錄 `resolveClaudePluginsDir`）、「CT plugin 安裝」節；`docs/agent-guide/bat-mcp-shim.md`、`docs/agent-guide/ct-plugin-install.md`"
affects_files:
  - "e2e/t0772-*.spec.ts（新增，檔名可調）"
  - "e2e/t0742-codex-no-daemon.spec.ts（只在需要支援安裝版時小改，不得改斷言語意）"
  - docs/agent-guide/bat-mcp-shim.md
  - docs/agent-guide/ct-plugin-install.md
  - _ct-workorders/T0772-acceptance-pre4-npm-codex-plugin-dir.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 驗收對象：優先用安裝版 `C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe`（FileVersion `0.7.3-pre.4`）以 `BAT_E2E_EXECUTABLE` 啟動隔離實例；不行再用現有 source build `dist` / `dist-electron`（04:29 由 `31fa4974` 建出，與 tag `v0.7.3-pre.4` 的 `src` / `electron` / `scripts` 無差異），回報逐情境寫明。🔴 不得跑 `npx vite build`（T0770–T0773 並行）。🔴 不改 `e2e/fixtures/electron-isolation.ts`。"
  - "🔴 情境 ①（BUG-189）：在暫存目錄以 `npm i -g --prefix <暫存目錄> @openai/codex@0.166.0` 安裝（使用者機器的 codex 是原生安裝版，🔴 不動使用者的 PATH、全域 npm、`~/.codex`、原生 codex）；隔離實例的 PATH 把該 prefix 放最前面、`CODEX_HOME` 指向暫存目錄（不登入）。a) Settings 關 BAT MCP → 開 Codex CLI 分頁 → 啟動命令含 `--no-daemon`；隔離實例 debug log 的 `[codex-version]` 解析到 npm 安裝的原生 `codex.exe` 與版本（不是 `version=unknown (first codex on PATH is …codex.cmd …)`）。b) 開 BAT MCP → 走 BAT MCP 注入路徑（依 CLAUDE.md 規則不加 `--no-daemon`）。c) 塔台分頁以 helper 派一個 codex Worker（`--agent codex-cli` 一類，依 helper 實際參數）→ 記錄 `blockedDetection` 與 `--wait-started` 結果（codex 未登入時的畫面照實記錄，不算缺陷）。另跑 t0742-codex-no-daemon。npm 下載失敗（網路）→ 該項 BLOCKED，其他照做。"
  - "🔴 情境 ②（BUG-191）：隔離實例 env 設 `CLAUDE_CODE_PLUGIN_CACHE_DIR=<暫存目錄>`、`CLAUDE_CONFIG_DIR=<另一個暫存目錄>`（🔴 不動使用者的 `~/.claude`），以內嵌 CLI（`claude plugin marketplace add` / `claude plugin install`）安裝 CT plugin `ct@<marketplace>`：優先用公開的 CT marketplace 或本機 CT repo（唯讀取用，不改它）；兩者都不可行時，比照 T0760 建一個假 marketplace（plugin 名 `ct`、含 `ct-exec` 等 SKILL.md），並寫明用哪個。驗：`installed_plugins.json` 確實在 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 下；BAT 的 skill 面板 / `*` 補全列出 CT 的 skill；指揮塔總覽 `*config` 的預設值層來源讀得到（`ct:read-config-sources`）。對照：不設 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 時路徑不變（`<設定目錄>/plugins`）。"
  - "🔴 隔離與安全：一律用隔離實例，不碰使用者正在用的 BAT；暫存目錄名含 `t0772`，跑完刪除（npm prefix、CODEX_HOME、CLAUDE_CONFIG_DIR、plugin cache 都刪）。不得複製、讀出或印出任何認證檔或權杖內容，不傾印整個 `process.env`。不改產品程式碼；發現產品缺陷 → 〈發現的問題〉附重現步驟與證據，由塔台開 BUG。"
  - "🔴 驗證：spec 跑 1 次，失敗時同一情境最多重跑 1 次並記錄（並行負載可能造成逾時）。`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 在 tsconfig 範圍外就註明）。docs：`bat-mcp-shim.md`「codex 共用 daemon」驗證清單補一行（npm 安裝 codex 實測）、`ct-plugin-install.md` 驗證清單補一行（`CLAUDE_CODE_PLUGIN_CACHE_DIR` 實測）。不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）：回報與 spec 不得出現使用者家目錄路徑或帳號。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0772 — pre.4 自動化驗收（安裝版）：環境類

## 元資料

- **工單編號**：T0772
- **類型**：implementation（驗收用 e2e，不改產品程式碼）
- **優先級**：P2
- **建立時間**：2026-11-02T05:08:42+0800
- **預估規模**：S

## 背景

`v0.7.3-pre.4` 已發佈。使用者選擇以自動化取代手動實機驗收（D215）。BUG-189 要 npm 安裝的 codex、BUG-191 要 `CLAUDE_CODE_PLUGIN_CACHE_DIR` 加 plugin 安裝的 CT，兩者都和使用者目前的安裝方式不同，所以在暫存目錄與隔離實例內建出這兩種環境驗收，不動使用者的環境。

## 範圍

1. 情境 ① BUG-189、② BUG-191（見 frontmatter）。
2. 不回歸 t0742-codex-no-daemon。
3. docs 各一行。

## 不做

- 不動使用者的 PATH、全域 npm、`~/.codex`、`~/.claude`、原生 codex。
- 不改產品程式碼、不 build、不改共用 fixture。

## 驗收

- [ ] 情境 ①a–c、②逐項結果，每項寫明驗收對象（安裝版 / source build）與用了哪個 marketplace
- [ ] t0742-codex-no-daemon 綠、兩個 typecheck = 0
- [ ] 暫存目錄已清除
- [ ] 〈發現的問題〉與〈仍需手動〉

---

## 回報區
