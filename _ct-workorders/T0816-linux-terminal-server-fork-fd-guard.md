---
schema_version: 1
schema_kind: workorder
id: T0816
title: "Linux：Terminal Server 的 fork 改經 fd guard——只留 IPC 與 AppImage keepalive（fd 4）、不當 crashpad client（PLAN-062 方案 A3、BUG-209）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: M
isolation: worktree
created_at: "2026-11-03T22:19:09+0800"
started_at: ""
updated_at: "2026-11-03T22:19:09+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "PLAN-062；BUG-209；D260；T0812 回報區（〈2〉成因、〈3〉比較表、〈5〉實作工單草案）；T0807（`electron/child-process-fd-guard.ts`、`runWithoutChildProcessFdGuard`）；T0806（`guardPtySpawnFds`）；T0704（recovery re-fork）；T0578（Recovery 提示）；CLAUDE.md「Linux child_process 子程序只保留 stdio」「Terminal Server 存活判定與 recovery」節；`docs/agent-guide/linux-pty-fd-inheritance.md`"
affects_files:
  - electron/main.ts
  - electron/child-process-fd-guard.ts
  - "electron/appimage-keepalive.ts（新增）"
  - "electron/__tests__/child-process-fd-guard*.test.ts"
  - "electron/__tests__/appimage-keepalive.test.ts（新增）"
  - "electron/__tests__/**（本單相關的 source guard / 既有測試調整）"
  - "e2e/linux/**（新 spec 或擴充 t0807）"
  - ".github/workflows/linux-acceptance.yml（只在需要新 step 時）"
  - CLAUDE.md
  - docs/agent-guide/linux-pty-fd-inheritance.md
  - "docs/agent-guide/terminal-server-recovery.md（只在需要記一句時）"
  - _ct-workorders/T0816-linux-terminal-server-fork-fd-guard.md
renew_count: 0
workdir: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 範圍以 T0812〈5〉實作工單草案為準（必守規則逐條照做）：主行程兩個 Terminal Server fork 點（`electron/main.ts` 約 `:418` / `:479`）收成一個 helper（例 `forkTerminalServer`），拿掉 `runWithoutChildProcessFdGuard`；fd guard 加範圍旗標（例 `runWithoutCrashpadClient(fn)`：該次 spawn 從 envPairs 去掉 `CRASHDUMP_SIGNAL_FD` / `CRASHPAD_HANDLER_PID`，guard 因此不保留那個 fd；可巢狀、例外後還原）；新增 `findAppImageKeepaliveFd`（只在 `process.env.APPIMAGE` 有值時，找出主行程持有、另一端在 `exe === APPIMAGE` 程序手上的 pipe fd；找不到回 null）；fork 的 stdio：有 keepalive → `['ignore','ignore','ignore','ipc', <keepalive fd>]`，沒有 → `['ignore','ignore','ignore','ipc']`（🔴 不得用 `'ignore'` 佔第 5 格）；server 的 fd 只剩 0–3（＋keepalive 時 4）、env 沒有兩個 crashpad 變數；T0704 re-fork 走同一個 helper；keepalive 偵測失敗 → 照舊啟動、記一行 `[terminal-server]` debug log、不丟例外。"
  - "🔴 只有 Linux：Windows / macOS 的 fork 參數、env、日誌完全不變（單元測試守住）；Windows 的同類現象（server 繼承主行程 std handle）只寫進文件、不修；headless 不受影響（bat-server 不 fork Terminal Server）。Terminal Server 不再是 crashpad client（T0812 實測目前本來就不產生 dump），文件寫明。T0806 `guardPtySpawnFds`、T0807 安裝點規則不變。"
  - "🔴 驗證：`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npm run test:legacy`、`npx vite build`；單元（範圍旗標去掉兩個 env pair 且不保留該 fd、巢狀與例外還原；keepalive 偵測以假 /proc 涵蓋有 / 沒有 APPIMAGE、多個 pipe、讀取失敗；非 Linux 不變）＋突變檢查。Linux 驗收（AppImage、隔離 runtime、只開 shell 分頁）K1–K5：K1 保留 server 離開後主行程 fd 1 / 2 的 inode 無持有者（以 /proc 判定或 `bash -c 'out=$(…)'` 計時 ≤ 10 s；🔴 不要拿 Playwright `app.close()` 計時，FUSE 持有 Playwright 的 fd 3 / 4）；K2 server 的 fd 只有 0–4、env 無兩個 crashpad 變數名稱、`ss` 找不到對端是 crashpad 的 socket；K3 一般啟動時主行程結束後 `/proc/mounts` 仍有該 mount、讀 `/proc/<server>/exe` 後段不出錯；K4 重開同一 runtime 出現 Recovery 提示、按「還原」後原 shell 能執行指令；K5 renderer `Page.crash` 仍產生 `pending/*.dmp`；T0806 F1–F6、T0807 G1–G3（含 T0810 的 AppImage 對照組）不回歸。"
  - "🔴 CI 驗證（已授權）：push 分支 `ct/T0816`（只限這個分支；不得 push `main`），`gh workflow run desktop-build.yml -R gowerlin/better-agent-terminal -f ref=ct/T0816` 打 AppImage，再 `gh workflow run linux-acceptance.yml -R gowerlin/better-agent-terminal --ref ct/T0816 -f build_run_id=<desktop-build run id>`，必要時迭代；最後一次 run id 與 22.04 / 24.04 結果寫進回報區；驗完 `git push origin --delete ct/T0816`。所有 `gh` 指令帶 `-R gowerlin/better-agent-terminal`（L122）。本機 WSL 可先試跑（`electron-builder --linux` 或 desktop-build artifact），WSL 使用者的 `~/.config/BetterAgentTerminal`、`~/bat-build`、`~/.claude`、`~/.codex`、原本在跑的 bat-server 不改不停；🔴 L185：不開 agent 分頁、不送按鍵、不登入。"
  - "🔴 worktree：依 ct-exec § Worktree Isolation（工單寫回主 checkout、在 worktree 自行安裝依賴）。CLAUDE.md 只改「Linux child_process 子程序只保留 stdio」節（T0815 在主 checkout 改其他節，合併由塔台處理）。yolo：不得問使用者；問題依 ct-exec § Questions For Tower 問塔台。不發版、不 push `main`。Git：只 commit 本單範圍。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）。"
---

# T0816 — Linux：Terminal Server 的 fork 改經 fd guard（PLAN-062 A3、BUG-209）

## 元資料

- **工單編號**：T0816
- **類型**：implementation
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-03T22:19:09+0800
- **預估規模**：M
- **隔離**：worktree（與 T0815 並行）

## 背景

T0812（研究，`v0.7.4-pre.4`）：Linux 上 Terminal Server 是 crashpad client（Electron 在 `ELECTRON_RUN_AS_NODE` 的 fork 自動加 crashpad env 與 fd），crashpad handler 持有主行程 stdout / stderr，所以保留 server 離開時 `out=$(…)`、`| tee` 會等到 server 結束（PLAN-062）。方案 A3（fork 經 fd guard、只留 IPC 與 keepalive）實測 `out=$(…)` 908 ms 返回，dump 無損失（目前 server 本來就不產生 dump），T0704 recovery 與 T0578 Recovery 提示正常。同時修好 BUG-209（一般啟動時 keepalive fd 3 被 IPC 蓋掉，server 沒持有 keepalive → mount 被卸載）。使用者 2026-11-03 裁示實作（D260）。

## 範圍

見 memory_overrides；細節以 T0812 回報區〈5〉草案為準。

## 不做

- Windows / macOS、Playwright＋AppImage 的 `app.close()`（FUSE 持有 Playwright 額外傳入的 fd，不可控）、Linux node 模式子程序不產生 dump 的原因查證、發版、push `main`。

## 驗收

- [ ] 實作說明（helper、範圍旗標、keepalive 偵測、stdio 配置、非 Linux 不變的證據）
- [ ] 單元＋突變檢查
- [ ] typecheck 0 / 0、unit、legacy、vite build
- [ ] linux-acceptance（`--ref ct/T0816`）最後一次 run：K1–K5、T0806 F1–F6、T0807 G1–G3，22.04 / 24.04
- [ ] 文件更新（CLAUDE.md 該節、docs）
- [ ] 遠端 `ct/T0816` 已刪、worktree head SHA

---

## 回報區

<!-- Worker 由此往下寫 -->
