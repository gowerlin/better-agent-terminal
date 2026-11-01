---
schema_version: 1
schema_kind: workorder
id: T0755
title: "headless server 啟動時以登入 shell 取得 PATH（PLAN-057 實作，預設開、可關）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: M
created_at: "2026-11-02T00:46:30+0800"
depends_on: [T0754]
related:
  - "PLAN-057；D206 / D207；T0754 回報區（結論、量測數據 A–E、③ 影響盤點、④ 套用點、⑥ 開關、⑦ 實作單草案）——本單的設計依據，請先讀"
  - "`electron/early-path-fix.ts`（macOS Electron 主程序，本單不改）；`electron/remote/headless-entry.ts`（`readHeadlessSettings`、`headlessHelperPathEnv`）"
  - "T0748 / T0749 的測試專用 headless server 做法；T0743 的 WSL Docker 做法"
affects_files:
  - electron/remote/headless-login-path.ts
  - electron/remote/server-entry.ts
  - scripts/bat-server.mjs
  - electron/remote/__tests__/headless-login-path.test.ts
  - src/types/index.ts
  - src/stores/settings-store.ts
  - src/components/SettingsPanel.tsx
  - src/components/__tests__/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - docs/agent-guide/headless-login-shell-path.md
  - docs/agent-guide/README.md
  - CLAUDE.md
  - _ct-workorders/T0755-headless-login-shell-path.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 設計照 T0754 草案⑦，加上 D207 三點：① 不加環境變數覆蓋，只有 `<dataDir>/settings.json` `headlessLoginShellPath`（布林，`!== false` 為開，啟動時讀一次）；② WSL 的 `/mnt/<磁碟>/` 項不過濾，日誌只記數量；③ 分頁 PATH 的 `~/.local/bin` 多一份接受，不改 `PtyManager`。"
  - "🔴 必守：取法 `<shell> -l -i -c` ＋每次隨機標記、只取最後一組；`spawn` `detached: true`，逾時 3000 ms 以 `process.kill(-pid, 'SIGKILL')` 砍整個程序群組，以 `exit` 事件結束並 `destroy()` stdout / stderr（🔴 不得用 `execFile` / `spawnSync` 的 timeout，T0754 數據 D）；shell 選法 `SHELL` → `os.userInfo().shell` → `/bin/sh`，白名單沿用 `selectLoginShell`，fish 另用 `string join : $PATH`；合併：登入 PATH 在前、原 PATH 獨有項接後、去重保留首次、只收絕對路徑、有換行 / NUL 整個不用；任何失敗 PATH 不動、記一行、照常啟動；🔴 開關關閉時不 spawn、不碰 `process.env`（測試守住）。日誌不記完整 PATH。win32 不執行（headless 只跑在 Linux / macOS）。"
  - "🔴 套用點：`scripts/bat-server.mjs` `main()`，`resolveDataDir` 之後、`createHeadlessServer` 之前 `await serverEntry.applyHeadlessLoginShellPath?.(…)`；不放進 `createHeadlessServer`（source guard 守住順序）。新模組不 import electron。不改 `PtyManager`、`early-path-fix.ts`、git / gh resolver、遠端工具面板、systemd / launchd 範本。"
  - "🔴 驗證：草案⑦的單元測試、真 shell 測試（win32 skip）、6 項突變檢查（逐項記錄失敗訊息）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`。WSL 實機用測試專用 headless server（`/tmp/bat-e2e-t0755*`、`env -i $(systemctl --user show-environment)` ＋ `setsid`、不經 systemd、隨機 port）：開啟 → `applied` 且伺服器檢視 claude / codex / uv 為 found；`false` → `off` 且與現況相同；分頁 PATH 只多一份 `~/.local/bin`；使用者 bat-server MainPID / unit 狀態前後相同。Docker：`bat-e2e-t0755-` 容器驗 `applied`、結束清掉（不得 `prune`、不碰使用者容器）。不用 SSH 主機；macOS 未實測照實寫。需要 server bundle 時只在測試目錄建，不升級使用者 server。"
  - "🔴 CLAUDE.md 新增一節（3–12 行，依『CLAUDE.md 撰寫規則』），細節寫進 `docs/agent-guide/headless-login-shell-path.md` 並更新索引。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」（家目錄寫 `<使用者家目錄>`，不寫使用者容器名稱）。"
---

# T0755 — headless server 的登入 shell PATH（實作）

## 元資料

- **工單編號**：T0755
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-02T00:46:30+0800
- **預估規模**：M

## 背景

bat-server 由 systemd / launchd / 容器 ENTRYPOINT 啟動，PATH 只有系統預設值，server 程序的子程序（Claude 面板的 Bash 工具 / MCP 等）找不到 `~/.local/bin`、nvm、Homebrew。T0754 量測完成並給出設計；使用者決定照草案實作（D206 預設開、可關；D207 不加環境變數、不過濾 `/mnt`、接受分頁重複）。

## 範圍

1. 新模組 `electron/remote/headless-login-path.ts`（`resolveLoginShellPath` 純邏輯、`applyHeadlessLoginShellPath` 套用）；`server-entry.ts` 匯出；`bat-server.mjs` 呼叫。
2. Settings：`AppSettings.headlessLoginShellPath`、store setter、`SettingsPanel.tsx` 遠端視窗區塊（BAT MCP 旁）、三語系。
3. 文件：docs 新檔、索引、CLAUDE.md 一節。

## 不做

- 不改 `PtyManager`、`early-path-fix.ts`、git / gh resolver、遠端工具面板、unit / plist 範本；不加環境變數覆蓋；不升級使用者 bat-server；不發版。

## 驗收

- [ ] 單元測試、真 shell 測試、6 項突變檢查
- [ ] typecheck 0 / 0、`test:unit`、`vite build`
- [ ] WSL 測試 server：開啟 `applied`、關閉 `off` 與現況相同、分頁 PATH 只多一份；使用者 bat-server 前後相同
- [ ] Docker `bat-e2e-t0755-` 容器 `applied`、資源已清
- [ ] CLAUDE.md 一節 ＋ docs 檔 ＋ 索引

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
