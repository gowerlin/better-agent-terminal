---
schema_version: 1
schema_kind: workorder
id: T0651
title: "BUG-159：codex 分頁在 BAT MCP 沒注入時加 `--no-daemon`（版本確認後才加）；文件寫明「非 features 的 `-c` → embedded」不變式並加 source guard"
type: bugfix
status: TODO
repo: better-agent-terminal
project: BUG-159
priority: P3
sizing: S
created_at: "2026-10-18T18:37:00+0800"
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
