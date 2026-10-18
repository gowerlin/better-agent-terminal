---
schema_version: 1
schema_kind: workorder
id: T0651
title: "BUG-159：codex 分頁在 BAT MCP 沒注入時加 `--no-daemon`（版本確認後才加）；文件寫明「非 features 的 `-c` → embedded」不變式並加 source guard"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-159
priority: P3
sizing: S
created_at: "2026-10-18T18:37:00+0800"
started_at: "2026-10-18T18:38:32+08:00"
updated_at: "2026-10-18T18:51:34+08:00"
completed_at: "2026-10-18T18:51:34+08:00"
depends_on: [T0648]
related:
  - "BUG-159；T0648 回報區（原始碼證據 § 1、影響表 § 3、建議 § 4）；D169"
  - "T0377 / BUG-085 `CODEX_DISABLE_DAEMON_ARGS` / `hasCodexDaemonOptOut`（`electron/agent-runtime/agent-registry.ts`）；T0375（0.133 遇 `--no-daemon` exit 2）；T0584 BAT MCP 注入唯一實作 `buildBatMcpLaunchArgs`（`electron/bat-mcp-launch.ts`）與 renderer `withBatMcpLaunchArgs`（`src/lib/bat-mcp-launch.ts`）；T0621 `createCodexOscVersionCheck`（`electron/codex-osc-version.ts`）"
affects_files:
  - electron/agent-runtime/agent-registry.ts
  - "electron/bat-mcp-launch.ts、src/lib/bat-mcp-launch.ts（只在注入判斷需要時）"
  - "electron/codex-osc-version.ts 或新的版本檢查模組（只在需要沿用 / 擴充版本檢查時）"
  - "electron/terminal-command-handlers.ts、electron/remote/headless-entry.ts（只在 helper 派工 / headless 路徑需要同步時）"
  - "electron/__tests__/**、src/**/__tests__/**"
  - docs/agent-guide/bat-mcp-shim.md
  - "CLAUDE.md（只在「BAT MCP shim」節加一行不變式）"
  - _ct-workorders/T0651-fix-codex-no-daemon-when-no-bat-mcp.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍是 T0648 建議的 **S 版**：只在「BAT 會替這個 codex 分頁注入 helper env，但 BAT MCP 沒注入」時加 `--no-daemon`。不要改成所有 codex 分頁一律加（M 版，不在本單）。BAT MCP 有注入、helper 派工（已有 `check_for_update_on_startup`）的命令列不得因本單改變（測試斷言）。"
  - "🔴 版本：先查證 `--no-daemon` 從哪個 codex 版本開始有（`codex --help` 原文、codex changelog / release notes、原始碼 tag），回報寫出處。只在確認版本支援時才加；版本確認不到（讀不到版本、PATH 第一個是 npm shim、低於門檻）就**不加**，維持現狀（elevated 時的 `CODEX_DISABLE_DAEMON_ARGS` 照舊）。版本檢查一律 `execFile` + timeout + 快取（可沿用 `createCodexOscVersionCheck` 的作法），不得讓 `buildLaunchCommand` 變成會卡住 UI 的同步 spawn；若手動分頁路徑拿不到非同步版本結果，回報說明取捨（例如只用已快取的結果），不要硬改成同步。"
  - "🔴 參數位置：`--no-daemon` 是 root 選項，放在 `codex` 之後、子命令（`resume` / `fork`）之前，與現有 `CODEX_DISABLE_DAEMON_ARGS` 同一位置。使用者自訂參數已含 `--no-daemon` / `daemon_auto_start` / `--remote` 時不加（擴充 `hasCodexDaemonOptOut`；`--remote` 與 `--no-daemon` 併用 codex 會報錯）。elevated 時已加 `CODEX_DISABLE_DAEMON_ARGS` 的情況是否再加 `--no-daemon`，依版本判斷並在回報說明。"
  - "🔴 BAT MCP shim 規則不變：不得改 `mcp_servers.bat.*` 注入方式、不得把權杖放進命令列（CLAUDE.md「BAT MCP shim」🔴）；`bat-mcp-launch.test.ts` 的 `buildLaunchCommand(` 計數 source guard 若受影響，同步更新並說明。不注入 codex hooks、`-c notify`、`-c tui.*`（CLAUDE.md「blocked 狀態偵測」🔴）。"
  - "🔴 文件：`docs/agent-guide/bat-mcp-shim.md` 加「codex 共用 daemon」一節（機制摘要、哪些分頁走 embedded、`features.daemon_auto_start=false` 擋不住既有 daemon、codex 升版時查 `tui/src/daemon_startup.rs` `config_exclusion`、本單的 `--no-daemon` 條件）；CLAUDE.md「BAT MCP shim」節只加一行不變式並連到 docs（遵守 CLAUDE.md 開頭的撰寫規則）。source guard：測試鎖住「BAT MCP 有注入時 codex 命令列含非 features 的 `-c`」以及本單新增的 `--no-daemon` 條件。"
  - "🔴 非隔離工單。T0649（Docker 精靈）、T0650（`ProfilePanel.tsx` / `EditRemoteProfileModal.tsx`）同時進行，不碰它們的檔。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。不得停止 / 重啟使用者的 codex daemon 或改 `~/.codex/`。"
---

# T0651 — codex 分頁在 BAT MCP 沒注入時不走共用 daemon

## 背景

T0648 以 codex `rust-v0.163.0` 原始碼確認：共用 daemon 模式下，shell 命令、MCP server、hook 都取 daemon 程序的環境（屬於第一個啟動 daemon 的分頁）。BAT 的 codex 分頁目前靠非 features 的 `-c`（BAT MCP 的 `mcp_servers.bat.*`、派工的 `check_for_update_on_startup`）讓 codex 走 embedded；剩下「非系統管理員 + 手動 codex 分頁 + BAT MCP 沒注入」會接上 daemon，分頁內的 helper 讀到別的分頁的 `BAT_*`。詳見 BUG-159。

## 要做的事

1. 列出 BAT 所有 codex 啟動路徑（renderer 手動分頁、⏻ 重啟 / 還原、helper 派工、headless、Codex SDK 面板）與各自目前帶哪些 daemon 相關參數 / 非 features 的 `-c`，寫進回報區（可引用 T0648 § 3 再核對）。
2. 查證 `--no-daemon` 的起始版本並寫出處。
3. 實作 S 版：BAT MCP 沒注入且 BAT 注入 helper env 的 codex 分頁，版本確認支援時加 `--no-daemon`；其餘路徑命令列不變。
4. 文件與 source guard（見 memory_overrides）。
5. 測試：BAT MCP 開 → 命令列不變（含非 features `-c`、無 `--no-daemon`）；BAT MCP 關 + 版本支援 → 有 `--no-daemon` 且位置正確（含 resume）；版本不支援 / 未知 → 不加；自訂參數含 `--no-daemon` / `daemon_auto_start` / `--remote` → 不加；helper 派工命令列不變。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數；基線 5384 / 311，T0649 / T0650 可能同時增加測試，以實際數字為準）
- `npx vite build` 成功
- 實機（可行時，不呼叫模型）：本機 codex `--help` 確認 `--no-daemon` 存在；本機為 elevated，無法實測 daemon 行為，寫明

## 驗收

- 剩下的情境改走 embedded（版本確認時）；其他路徑命令列不變
- 文件與 CLAUDE.md 不變式、source guard 完成
- 三項驗證通過；回報區附啟動路徑表、`--no-daemon` 版本出處、測試清單、commit
- 只改 `affects_files`；未 push

## 回報區

### 結論摘要

- **S 版完成**：codex 分頁在「BAT MCP 的 args 沒注入」時（Settings 關、RemoteServer 未 listen、找不到 `bat-mcp.mjs`、自訂參數自己定義 `mcp_servers.bat`），若 PATH 上的 codex `>= 0.156.0`，BAT 加 `--no-daemon`。BAT MCP 有注入的分頁、helper 派工的命令列**不變**（測試逐字比對）。版本確認不到（讀不到版本、Windows PATH 第一個是 npm shim、低於 0.156.0、pre-release 的 0.156.0）就不加，維持現狀（elevated 時的 `CODEX_DISABLE_DAEMON_ARGS` 照舊）。
- **`--no-daemon` 起始版本 = codex `rust-v0.156.0`**（出處見 § 2）。
- **不需要同步 spawn**：renderer 的手動分頁 / ⏻ 重啟 / 還原 / 預設 Agent 終端都經 `withBatMcpLaunchArgs` → `agent:bat-mcp-launch-args`，這個 handler 本來就是 async（T0641 的 claude `--name` 版本檢查同一模式），所以版本檢查放在 handler（host 端），`buildLaunchCommand` 維持同步、沒有改動。
- 文件、CLAUDE.md 一行不變式、source guard 完成；typecheck ×2 = 0、unit 全綠、vite build 成功。模型呼叫 0 次。

### 1. BAT 的 codex 啟動路徑（實作後）

依據：T0648 § 3，本單再核對原始碼（`src/components/WorkspaceView.tsx` 四處 `buildLaunchCommand(` + `withBatMcpLaunchArgs`、`electron/terminal-command-handlers.ts` `createAgentPromptCommandBuilder`、`electron/remote/headless-entry.ts`、`electron/codex-agent-manager.ts`）。

| 路徑 | 組裝點 | daemon 相關參數 / 非 features 的 `-c`（T0651 前） | T0651 後 |
|---|---|---|---|
| helper 派工的 codex Worker（本機 / headless） | `createAgentPromptCommandBuilder` | `-c check_for_update_on_startup=false`（一律，自訂參數已設時不加）；BAT MCP 開時另有 `-c mcp_servers.bat.*`；elevated 時 `-c features.daemon_auto_start=false` | **不變**（builder 不問版本檢查，request 沒有 `codexNoDaemon` → `not-checked`） |
| 手動新建分頁 / 還原分頁 / 預設 Agent 終端 / ⏻ 重啟（renderer 4 處） | `buildLaunchCommand` → `withBatMcpLaunchArgs` → `agent:bat-mcp-launch-args` | BAT MCP 有注入：`-c mcp_servers.bat.*`；elevated：`-c features.daemon_auto_start=false` | BAT MCP 有注入：**不變**（也不跑 `codex --version`） |
| 同上，BAT MCP 沒注入 | 同上 | 無（elevated 時只有 `features.daemon_auto_start=false`，擋不住既有 daemon） | `--no-daemon`（codex `>= 0.156.0` 時；elevated 時在 `-c features.daemon_auto_start=false` 之後）；確認不到 → 不變 |
| 遠端視窗（WSL / SSH / Docker）的分頁 | 同上，handler 由 headless 註冊（`createHeadlessBatMcpHost`） | 同上兩列 | 同上兩列（server 端 PATH 的 codex 版本） |
| Codex SDK 面板（`codex exec`） | `electron/codex-agent-manager.ts` | — | 不變（`exec` 沒有 daemon 路徑） |
| raw command 模式（`terminal:create-with-command`） | — | 不經 BAT 組裝 | 不變 |

### 2. `--no-daemon` 起始版本查證

- 本機 `codex --version` = `codex-cli 0.163.0`；`codex --help` 原文：`--no-daemon` / `Run without the shared background server, even if it is already running`。
- codex 原始碼 `codex-rs/tui/src/cli.rs`（`gh api repos/openai/codex/contents/...?ref=<tag>` 逐 tag 查 `no_daemon`）：`rust-v0.133.0` / `0.140.0` / `0.150.0` / `0.155.0` / `0.155.1` **沒有**；`rust-v0.156.0`（commit `fe74a774532af67b5a4a3dec03ce9469e17f89af`，2026-09-22）起**有**（`/// Run without the shared background server, even if it is already running.` `#[arg(long)] pub no_daemon: bool`），0.157–0.163 皆有。
- codex `rust-v0.156.0` release notes 原文：「Update the local background server through `/daemon`, or bypass it with `--no-daemon`. (#45854, #46088)」。
- 門檻 `CODEX_NO_DAEMON_MIN_VERSION = '0.156.0'`（`electron/codex-osc-version.ts`）；`0.156.0-alpha.*` 不算（保守，未逐一查 alpha）。舊版遇 `--no-daemon` exit 2（T0375：0.133）。

### 3. 實作

- `electron/codex-osc-version.ts`：抽出 `createCodexVersionReader`（原 `createCodexOscVersionCheck` 的探測 + 快取 + `[codex-version]` 日誌，行為與日誌格式不變，T0621 測試照過），`createCodexOscVersionCheck` 改用它；新增 `codexVersionAtLeast`、`CodexNoDaemonSupport`、`createCodexNoDaemonSupportCheck`（`execFile` + 5 s timeout、路徑 + mtime 快取、只快取讀到的版本）。
- `electron/agent-runtime/agent-registry.ts`：`hasCodexDaemonOptOut` 改 export；新增 `codexArgsRuleOutNoDaemon` = `hasCodexDaemonOptOut` ∪ `--remote`（`(^|\s)--remote(\s|=|$)`，不誤判 `--remote-auth-token-env`）。elevated 的 `CODEX_DISABLE_DAEMON_ARGS` 判斷**沒改**（仍只看 `hasCodexDaemonOptOut`），所以 elevated 路徑命令列不變。
- `electron/bat-mcp-launch.ts`：`BatMcpLaunchRequest.codexNoDaemon`、`BatMcpHost.codexNoDaemonSupport`、結果欄位 `noDaemon` / `noDaemonReason`（`user-args` / `codex-too-old` / `version-unknown` / `not-checked`）；`codexNoDaemonDecision` 只在 codex 且 MCP args 沒進去時生效（Settings 關的提前 return 也處理）；`needsCodexNoDaemonSupport` / `withCodexNoDaemonSupport`，只有 `registerBatMcpHandlers` 呼叫；日誌 `→ injected: --no-daemon; mcp=no (<原因>)` 或 `→ not injected (<原因>); no-daemon=no (<reason>)`。`mcp_servers.bat.*` 注入方式、權杖處理完全沒動。
- `electron/main.ts` `batMcpHost.codexNoDaemonSupport`、`electron/remote/headless-entry.ts` `createHeadlessBatMcpHost` 加同一檢查。`src/lib/bat-mcp-launch.ts` 只補註解（renderer 邏輯不變，host 回的字串照舊接在 base command 後、自訂參數前）。
- **elevated 時是否再加 `--no-daemon`**：加（版本確認時）。理由：codex 0.163 在 elevated 時已自設 `no_daemon`，再加無害；0.156–0.162 的 elevated 行為未逐版查證（T0377 只確認 0.160+ 拒絕自動啟動，未確認是否仍會連上既有 daemon），加上可以補這段。實機 `codex -c features.daemon_auto_start=false --no-daemon resume --help` exit 0。
- 自訂參數含 `-c mcp_servers.bat.*`（使用者自己接 MCP）時 BAT MCP 不注入，仍會加 `--no-daemon`（使用者的 `-c` 本來就讓 codex 走 embedded，加上無害）。
- `bat-mcp-launch.test.ts` 的 `buildLaunchCommand(` 計數 source guard 不受影響（renderer 沒改，仍 4 處）。沒注入 codex hooks、`-c notify`、`-c tui.*`。

### 4. 測試清單（新增 `electron/__tests__/codex-no-daemon-launch.test.ts`，16 tests）

- 版本門檻：`0.156.0` 起、`0.155.1` / `0.133.0` / `0.156.0-alpha.3` 不算；`createCodexNoDaemonSupportCheck` >= 門檻 → inject、舊版 → `codex-too-old`、快取；讀不到 / 無 codex / Windows npm shim 在前 → `version-unknown`。
- BAT MCP 開：帶了 `codexNoDaemon` 的結果與不帶時**完全相同**，無 `--no-daemon`；source guard：`codexMcpOverrides` 每個值都是 `mcp_servers.bat.*`、不是 `features.*`，`-c` 數量一致。
- BAT MCP 沒注入（Settings 關 / endpoint 未 ready / shim 不在 / 無 helper dir）+ 支援 → `args: '--no-daemon'`。
- 太舊 / unknown / 沒檢查 → 不加，原因正確；自訂參數 `--no-daemon` / `-c features.daemon_auto_start=false` / `--disable daemon_auto_start` / `--remote …` / `--remote=…` → `user-args`；`--remote-auth-token-env` 不算。claude / 其他 agent 從不得到 `--no-daemon`。
- handler：MCP 開時不呼叫版本檢查；MCP 關 + 支援 → 依 WorkspaceView 的組法得到 `codex --no-daemon resume --last`，elevated → `codex -c features.daemon_auto_start=false --no-daemon resume --last`；太舊 / 自訂 `--no-daemon`（檢查不呼叫）/ host 沒有檢查 / 檢查丟例外 → `''`，日誌逐行比對。
- helper 派工：MCP 關（Settings 關、endpoint 未 ready）時命令列與沒有 MCP dep 的版本逐字相同（`codex -c check_for_update_on_startup=false --yolo '$ct-exec T0651'`），MCP 開時仍是 `-c mcp_servers.bat.* … -c check_for_update_on_startup=false`，兩者都無 `--no-daemon`，版本檢查從未被呼叫。
- source guard：`await withCodexNoDaemonSupport(` 只出現在 `registerBatMcpHandlers` 內一次；`terminal-command-handlers.ts` 不含 `codexNoDaemon`；main / headless 的 host 有接檢查；派工的 `CODEX_DISPATCH_NO_UPDATE_CHECK` 仍為 `check_for_update_on_startup=false`。

### 5. 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | PASS（0） |
| `npm run typecheck:electron` | PASS（0；第一次跑出新測試檔 1 個 TS2339，修正測試寫法後 0） |
| `npm run test:unit` | PASS：**314 files / 5431 passed / 3 skipped**（基線 311 / 5384；增量含本單 1 檔 16 tests 與同時進行工單的測試）。輸出中的 Node stack trace 是既有測試刻意觸發的子程序錯誤，不是失敗 |
| `npx vite build` | PASS（exit 0） |
| 實機（不呼叫模型） | `codex --help` 有 `--no-daemon`；`codex --no-daemon resume --help`、`codex -c features.daemon_auto_start=false --no-daemon resume --help` 皆 exit 0（root 選項放在子命令前可解析）。`--no-daemon --remote … --help` exit 0：`--help` 先結束，`--remote` 併用的錯誤在執行期（`startup_orchestration.rs`），本單以 `user-args` 避開。本機 UAC 關閉、全部 elevated（T0648 § 2），**無法實測 daemon 行為** |

- 註：全量 unit test 跑在 commit 前的工作樹上；之後只改了新測試檔一行（型別收窄，`?.match` → 三元式），該檔重跑 16/16 通過、`typecheck:electron` = 0，commit 內容即為驗證過的內容加這一行。

### 6. Commit

- 產品 commit：`5b1be0f5cfa8098397188c875941067690206e9e`（`fix(codex): --no-daemon for codex tabs without BAT MCP (T0651, BUG-159)`），`git commit --only` 9 個檔：`CLAUDE.md`、`docs/agent-guide/bat-mcp-shim.md`、`electron/__tests__/codex-no-daemon-launch.test.ts`（新）、`electron/agent-runtime/agent-registry.ts`、`electron/bat-mcp-launch.ts`、`electron/codex-osc-version.ts`、`electron/main.ts`、`electron/remote/headless-entry.ts`、`src/lib/bat-mcp-launch.ts`。
- 工單 commit：本檔另一個 commit（`git commit --only`）。未 push。
- `electron/agent-runtime/agent-registry.ts` 的工作樹原本是 CRLF（index 為 LF、`eol=lf`），已轉成 LF；commit 內容只有本單的行變更。

### 落點檢查

- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。
- C-1：工單在 REPO_ROOT 下 → PASS。
- C-3：`electron/agent-runtime/agent-registry.ts`、`docs/agent-guide/bat-mcp-shim.md` 存在（其餘項為說明文字）→ informational PASS。
- C-2：工單無 `branch` 欄位，目前 `main`。
- 非隔離工單（`CT_HOME` 未設）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- 結果：PASS。

### 遵守的限制

- 只改 `affects_files`；沒碰 T0649 / T0650 的檔與 `src/styles/settings.css`（M 不是本單）。沒用 `git stash` / `reset` / `checkout --` / `restore`。
- 沒停止 / 重啟任何 codex daemon、沒改 `~/.codex/`；`gh api` 只讀 openai/codex 公開資料。
- 範圍維持 S 版（不是所有 codex 分頁一律加）。

### 遭遇問題

- 用 Bash heredoc 跑 python 改檔時，工具把 `\\` 收成 `\`，`codex-osc-version.ts` 被寫進一個 NUL 字元與一個真換行；已改用檔案腳本修正，commit 內容確認無 NUL（`git show HEAD:… | python` 檢查 clean）、T0621 測試照過。

### 後續建議

- M 版（所有 codex 分頁一律 `--no-daemon`，不再依賴 codex 的未文件化規則）留給塔台決定是否開單；本單文件已寫明升版時查 `config_exclusion`。

### 互動紀錄

無（yolo，未提問）。
