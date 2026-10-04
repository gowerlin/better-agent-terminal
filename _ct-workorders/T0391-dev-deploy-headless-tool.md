---
schema_version: 1
schema_kind: workorder
id: T0391
title: "PLAN-036 P0-D：本機 headless dev 部署工具（JS-only esbuild → install root；WSL 目標預設 dry-run，`--yes` 才覆寫並備份）"
type: implementation
status: DONE
priority: P1
sizing: S
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-05T00:09:52+08:00"
started_at: "2026-10-05T00:02:24+08:00"
completed_at: "2026-10-05T00:09:52+08:00"
target_version: next
depends_on: []
related:
  - "PLAN-036 / D129"
  - "T0385 回報區 C（交付路徑缺口）、T0386 回報區 §6、建議工單清單 D"
  - "塔台 23:33-23:45 手動部署 T0385 JS 的實際流程（見下）"
affects_files:
  - scripts/dev-deploy-headless.mjs
  - package.json
  - docs/remote-dev-overview.md
  - scripts/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。"
  - "🔴 **不得對使用者 WSL 的 `~/.local/bat-server` 執行 `--yes` 寫入、不得重啟 `bat-server.service`**（目前跑著塔台部署的 T0385 JS，使用者驗收中）。WSL 目標只跑 dry-run；實際寫入測試只對 scratchpad 目錄。"
  - "🔴 child_process 一律 `execFile` / `spawn` + array args（`wsl.exe` 亦同），timeout 必設；distro 名稱過既有白名單 `/^[A-Za-z0-9._-]+$/`。禁用 shell-spawning exec API。"
  - "⚠️ `package.json` 只加一行 script，不動依賴。不 push。"
---

# T0391 — dev-deploy-headless 工具

## 背景

T0385 修的是 headless JS，但 WSL 內的 server 來自 GitHub Release 的 baseline tarball，本機打包不會帶本地改動。塔台 23:33-23:45 手動流程（本工具要把它變成一行指令）：

1. 用 `scripts/build-server-bundle.mjs` **相同的 esbuild 設定**（4 個 entryPoints：`server-entry` / `headless-entry` / `lockfile` / `dataDir`；externals **從該腳本解析，不手抄**——手抄曾漏 6 項）輸出到暫存目錄
2. 進 WSL：對 `~/.local/bat-server/electron/remote/` 的目標檔先備份 `<file>.bak-<tag>`（已存在則不覆蓋備份），再覆寫
3. `systemctl --user restart bat-server`，檢查 `is-active`、埠 LISTEN、journal 尾段
4. 踩到的坑：PowerShell → `wsl.exe -- bash -c '...'` 的 `$` 跳脫不可靠，改為「寫 bash 腳本檔 → `wsl.exe -d <distro> -- bash <script>`」才穩定
5. ⚠️ 重跑 WSL 精靈會重裝 baseline，把 dev 部署蓋回去 —— 工具輸出要提醒這點

## 範圍

- `scripts/dev-deploy-headless.mjs`：參數至少 `--target wsl:<distro>` / `--target dir:<path>`、`--yes`（否則 dry-run，只列將覆寫的檔案與雜湊）、`--no-restart`、`--tag`；`--rollback`（從 `.bak-<tag>` 還原）
- 輸出：部署前後 sha256、grep 指定 marker（可選 `--expect-string`）、restart 結果
- `package.json` script：`deploy:headless:dev`
- `docs/remote-dev-overview.md` 補一節用法與「精靈會蓋回」警告

## 驗收

- unit（可測部分）：參數解析、externals 由 build 腳本解析、distro 白名單、dry-run 不寫入
- `dir:` 目標對 scratchpad 實跑 `--yes` + `--rollback` 一輪；`wsl:Ubuntu-24.04` 只跑 dry-run（回報區附輸出）
- `npm run test:unit` 全綠；`npx vite build` exit 0；`npx tsc --noEmit` ≤ **40**

## Sub-session 執行指示

1. 讀取本工單 + T0385 回報區 C + T0386 回報區 §6
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 執行摘要

- 新增 `scripts/dev-deploy-headless.mjs`（`npm run deploy:headless:dev`）：以 `build-server-bundle.mjs` 的 esbuild 設定（**從腳本原始碼解析** entryPoints / `externalPackages` / bundle·platform·target·format·sourcemap，形狀漂移即 fail-fast，不 fallback 手抄清單）只產 4 支 JS 到 `dist-server/dev-deploy-headless/`（gitignored），再部署到 install root。
- 目標：`--target wsl:<distro>`（install root 預設 `~/.local/bat-server`，`--install-root` 可覆寫）/ `--target dir:<path>`。旗標：`--yes`（否則 dry-run，只列 built / installed sha256 與 action）、`--rollback`（亦需 `--yes`）、`--tag`（預設 `dev`）、`--no-restart`、`--expect-string`（可重複；built 與 installed 都 grep，缺漏 exit 2）。
- 備份語意：**同一 tag 第一次部署**記錄原件——存在則 `<file>.bak-<tag>`，不存在則 `<file>.bak-<tag>.absent` 標記；之後重部署一律不覆寫。`--rollback` 由 `.bak` 還原、對 `.absent` 標記則刪除部署產生的檔。
- WSL 實作：產生 bash 腳本檔 → `wsl.exe -d <distro> --exec wslpath -a <win>` 換路徑 → `wsl.exe -d <distro> --exec bash <script>`（全 `execFileSync` + array args，timeout 30s / 含 restart 60s）。`--exec` 不經 shell 解析命令列，避開 T0385 踩到的 `$` 跳脫問題。restart 後輸出 `RESTART_EXIT`、`IS_ACTIVE`、node/bat-server 的 `LISTEN` socket、journal 尾 15 行。
- distro / tag / 檔名一律過 `/^[A-Za-z0-9._-]+$/`；`--install-root` 限絕對 POSIX 或 `~/`、禁 `..` 與 shell 字元；所有嵌入 bash 的值以單引號跳脫（`shq`）。
- 工具輸出（WSL 目標）與 docs 皆帶「重跑 WSL 精靈會蓋回 baseline」警告。

### Landing Zone Check

- 結果：**WARN**（C-0 不可用）
- C-0：frontmatter `repo` = **absent**；`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）→ WARN「repo identity unavailable」，改依 C-3 + C-1
- C-1：PASS（工單位於 REPO_ROOT 下）
- C-3：4 項 testable 皆 present（`scripts/`、`package.json`、`docs/remote-dev-overview.md`；`scripts/__tests__/` 的最近祖先 `scripts/` 存在）
- C-2：工單無 `branch` 欄，略過（HEAD = `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發模式：`CT_MODE=on`、`CT_INTERACTIVE=0`

### 驗收

| 閘門 | 結果 | 證據 |
|---|---|---|
| unit（新）`scripts/__tests__/dev-deploy-headless.test.mjs` | PASS | 27 tests：參數解析（含 6 種 distro 注入字串被拒）、externals / entryPoints / options 由真實 build 腳本解析且與 `externalPackages` 完全一致、漂移 fail-fast、plan 分類、dir 部署 / 重部署 / rollback、`main()` deploy 與 rollback **dry-run 前後 install root 快照相等**、bash 腳本 inspect 唯讀 / 備份守門 / 引號跳脫，以及**以 Git Bash（明確路徑，不用 PATH `bash` 以免落到 WSL）實跑產生的 bash 腳本** inspect → deploy ×2 → rollback 一輪（verbose 確認未 skip） |
| `npm run test:unit` | PASS | 69 files / 997 tests passed（工作樹含 T0388 / T0389 進行中改動，亦一併綠） |
| `npx vite build` | PASS | exit 0 |
| `npx tsc --noEmit` | PASS（= 40，門檻 ≤ 40） | `grep -c "error TS"` = 40；本單新增檔為 `.mjs`，不在 tsc 範圍 |
| `npm run verify:helpers` | PASS | `all 13 helper .mjs files in extraResources are reachable via filter`（新檔無 relative `.mjs` import） |
| `dir:` 對 scratchpad 實跑 `--yes` + `--rollback` | PASS | 見「實跑輸出 A」 |
| `wsl:Ubuntu-24.04` dry-run | PASS（僅 dry-run） | 見「實跑輸出 B」；**未**對 WSL 執行 `--yes`、未重啟 `bat-server.service`（memory_overrides） |
| WSL `--yes` 部署 / restart 實機 | **未執行**（依工單禁令） | 交使用者 / 塔台於 P0 實機驗收時執行；bash deploy / rollback 分支已由 Git Bash 實跑覆蓋，`systemctl` / `ss` / `journalctl` 段未實跑 |

#### 實跑輸出 A — `dir:` scratchpad（原有 3 檔內容 `orig *`，`dataDir.js` 不存在）

```
== dry-run (--tag t0391 --expect-string createHeadlessServer) → exit 0，目錄內容未變
[dev-deploy-headless] expect-string (built) "createHeadlessServer": FOUND in server-entry.js×4, headless-entry.js×4
  server-entry.js      built=a3e906e85481 installed=1041be138034 action=overwrite backup=create
  headless-entry.js    built=cdbae681e2e0 installed=fdbac0483b66 action=overwrite backup=create
  lockfile.js          built=73a02c671277 installed=83b0b50f9015 action=overwrite backup=create
  dataDir.js           built=47b318487def installed=MISSING action=create backup=absent-marker
[dev-deploy-headless] dry-run: nothing written. Re-run with --yes to apply.
== --yes → exit 0
[dev-deploy-headless] expect-string (installed) "createHeadlessServer": FOUND in server-entry.js×4, headless-entry.js×4
  (after) 4 檔 installed == built（action=unchanged）
[dev-deploy-headless] ✅ deployed sha256 matches built output
  目錄：dataDir.js + .bak-t0391.absent / headless-entry.js + .bak-t0391 / lockfile.js + .bak-t0391 / server-entry.js + .bak-t0391
== --yes 再一次（重部署）→ exit 0；server-entry.js.bak-t0391 內容仍為 "orig server-entry"
== --rollback --yes → exit 0
  server-entry.js      installed=a3e906e85481 backup=1041be138034 action=restore
  headless-entry.js    installed=cdbae681e2e0 backup=fdbac0483b66 action=restore
  lockfile.js          installed=73a02c671277 backup=83b0b50f9015 action=restore
  dataDir.js           installed=47b318487def backup=MISSING action=remove-created
[dev-deploy-headless] RESTORED server-entry.js / RESTORED headless-entry.js / RESTORED lockfile.js / REMOVED dataDir.js
  (after) 3 檔 installed == backup 原件；dataDir.js 與 .absent 標記已移除
```

#### 實跑輸出 B — `wsl:Ubuntu-24.04` dry-run（唯讀 inspect 腳本實際在 WSL 內執行）

```
[dev-deploy-headless] target=wsl:Ubuntu-24.04 ~/.local/bat-server mode=deploy tag=dev DRY-RUN (pass --yes to write)
[dev-deploy-headless] entryPoints (from build-server-bundle.mjs): electron/remote/server-entry.ts, electron/remote/headless-entry.ts, electron/remote/lockfile.ts, electron/remote/dataDir.ts
[dev-deploy-headless] externals (from build-server-bundle.mjs): 22 packages
[dev-deploy-headless] built into dist-server\dev-deploy-headless
[dev-deploy-headless] expect-string (built) "createHeadlessServer": FOUND in server-entry.js×4, headless-entry.js×4
[dev-deploy-headless] before (deploy plan):
  server-entry.js      built=a3e906e85481 installed=55b1e3441997 action=overwrite backup=create
  headless-entry.js    built=cdbae681e2e0 installed=6fad0f11462c action=overwrite backup=create
  lockfile.js          built=73a02c671277 installed=8aaa6158c1e5 action=overwrite backup=create
  dataDir.js           built=47b318487def installed=0e889c17d959 action=overwrite backup=create
[dev-deploy-headless] dry-run: nothing written. Re-run with --yes to apply.
[dev-deploy-headless] ⚠️ Re-running the WSL setup wizard reinstalls the baseline bundle and overwrites this dev deploy.
exit=0

== --rollback --tag t0385（dry-run）：正確辨識塔台 23:33 手動部署留下的備份
  server-entry.js      installed=55b1e3441997 backup=a48351399a21 action=restore
  headless-entry.js    installed=6fad0f11462c backup=341ed881bf2b action=restore
  lockfile.js          installed=8aaa6158c1e5 backup=MISSING action=skip-no-backup
  dataDir.js           installed=0e889c17d959 backup=MISSING action=skip-no-backup
```

> installed ≠ built 屬預期：塔台手動版只建 2 個 entry、未帶 `sourcemap: 'inline'`、externals 為手抄 6 項，且 repo 已有後續改動。

### 變更檔案

- `scripts/dev-deploy-headless.mjs`（新）
- `scripts/__tests__/dev-deploy-headless.test.mjs`（新）
- `package.json`（+1 行 `deploy:headless:dev`，未動依賴）
- `docs/remote-dev-overview.md`（新增「Dev deploy of headless server JS (contributors)」一節，含精靈會蓋回警告）
- `vite.config.ts`（+2 行：vitest `include` 加 `scripts/__tests__/**/*.test.mjs`）—— **超出 `affects_files`**，見偏差 1
- 本工單檔

### 偏差 / 風險

1. **`vite.config.ts` 不在 `affects_files`**：工單指定測試放 `scripts/__tests__/`，但 vitest `include` 為白名單、未涵蓋該目錄，不加則 `npm run test:unit` 不會跑到新測試。只加 1 個 include pattern + 註解。
2. **實作中自抓 bug（已修）**：初版重部署時，對「原本不存在、首次部署才建立」的檔會把 dev 版備份成 `.bak-<tag>`，使 rollback 還原成 dev 版而非刪除。改為「`.bak` 與 `.absent` 皆不存在才記錄原件」，JS 與 bash 兩邊同修並補測試。
3. **工具會隨安裝檔出貨**：`package.json` `build.extraResources` 對 `scripts` 用 `*.mjs` filter，`scripts/dev-deploy-headless.mjs` 會被打包進 `resources/scripts/`（無害：未被任何程式載入、無 relative import；`verify:helpers` 通過）。若要排除需改 `extraResources.filter`（超出本單「package.json 只加一行 script」限制），交塔台決定。
4. **WSL `--yes` / restart 路徑未在真 WSL 實跑**（工單禁令）。cp / 備份 / rollback 邏輯以同一份產生器的腳本在 Git Bash 實跑驗過；`systemctl --user restart`、`ss -ltnp`、`journalctl --user` 三段只有字串層級測試，首次實機使用請留意輸出。
5. **並行 Worker**：執行期間 T0388 改了 `scripts/build-server-bundle.mjs`（移除 `handlers/` 複製），未觸及 esbuild 呼叫，解析結果不變（重驗 4 entry / 22 externals）。T0388 讓 `headless-entry.ts` import `electron/handlers/*` 後，本工具經 esbuild import graph 自動帶入，無需調整。本單 commit 不含 T0388 / T0389 的檔案。
6. 執行過一次唯讀的 `git stash list`（只列出，未 push / pop / drop），未違反 L138 禁令，記錄備查。

### 互動紀錄

無（`CT_INTERACTIVE=0`）。

### Commit

- `f102a55` feat(scripts): dev-deploy-headless tool for local headless JS deploy (T0391, PLAN-036 P0-D) — 6 檔（`git commit --only`，未含 T0388 / T0389 工作樹改動）
- 本收尾 commit：工單 status → `DONE`、`completed_at`
- 未 push
