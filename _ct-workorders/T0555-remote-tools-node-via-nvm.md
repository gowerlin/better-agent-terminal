---
schema_version: 1
schema_kind: workorder
id: T0555
title: "遠端工具「Node.js」改為可一鍵安裝：透過 nvm（`~/.nvm`，不需 sudo）安裝最新 LTS；偵測能看到 nvm 管理的 node（非互動 shell 也一樣），比照 uv 的使用體驗"
type: feature
status: PARTIAL
repo: better-agent-terminal
project: "PLAN-037 延伸（使用者需求，第六十六 session）"
priority: P2
sizing: M
created_at: "2026-10-16T03:34:44+0800"
updated_at: "2026-10-16T04:50:48+0800"
started_at: "2026-10-16T04:19:35+0800"
completed_at: "2026-10-16T04:50:48+0800"
commit: "e9cae8d8"
target_version: "0.6.1-pre.5（與 T0551–T0554 同批）"
depends_on: []
related:
  - "T0407（PLAN-037 研究：node v1 不提供按鈕的理由，`_ct-workorders/T0407-research-remote-ai-toolchain.md` 第 139 / 161 行）；T0408–T0415（偵測、食譜、完成標記、host 白名單、安裝 runner）"
  - "`src/lib/remote-tools/recipes.ts`（`case 'node'` → `no-recipe`）、`electron/handlers/remote-tools.ts`（偵測）"
affects_files:
  - src/lib/remote-tools/recipes.ts
  - src/lib/remote-tools/install-request.ts
  - src/lib/remote-tools/install-runner.ts
  - src/lib/remote-tools/sentinel.ts
  - electron/handlers/remote-tools.ts
  - "src/components/remote-tools/**、src/components/profiles/RemoteToolsEntry.tsx（若顯示需調整）"
  - "src/locales/*.json（三語）"
  - "src/lib/remote-tools/__tests__/**（含 snapshot）、electron/**/__tests__/**"
  - "scripts/smoke-remote-headless.mjs（S10 判定若需補 node / nvm 欄位）"
  - "CLAUDE.md（若遠端工具段落需補）"
  - _ct-workorders/T0555-remote-tools-node-via-nvm.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 T0553 / T0554 在你之前進行（分頁標題、WSL / SSH 精靈 rollback）；不要動它們的檔案，以 HEAD 為準。"
  - "🔴 child_process 規則照 CLAUDE.md「Child Process Spawning」：`execFile` / `spawn` + array args，禁用 shell 模板字串；外部輸入白名單；timeout 必設。安裝指令沿用既有 install-runner（在遠端終端分頁打入指令）與 host 白名單，nvm 安裝來源加進白名單時寫明來源（`raw.githubusercontent.com/nvm-sh/nvm/<釘選 tag>/install.sh`），**釘選 nvm 版本 tag**，不用 `master`。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）。WSL 實機：可在 `Ubuntu-24.04` 實際安裝 nvm + Node LTS（使用者已同意）；不得改 `/mnt/c` 下任何東西，不動 Windows 端的 nvm4w / npm。server 結束時仍在 9877、active、指紋不變。"
  - "🔴 nvm 會改 `~/.bashrc`（追加載入片段）——這是 nvm 官方行為、可接受；不得刪改 `.bashrc` 其他內容。安裝前記錄 `.bashrc` sha256 與備份路徑，回報區列出差異。"
---

# T0555 — 遠端工具 Node.js：透過 nvm 一鍵安裝

## 背景

遠端工具清單（PLAN-037）中 Node.js 是「可選」且**沒有一鍵安裝**（顯示「此工具沒有一鍵安裝。安裝說明」）。T0407 的理由：claude / codex 的官方 installer 都不需要 node；bat-server 自帶的 node 不在 PATH；Ubuntu 24.04 apt 的 `nodejs` 只有 18.19。

使用者需求（2026-10-16）：Node 也要能一鍵安裝，並以 **nvm** 管理版本，比照 Python 透過 uv。

## 已知技術點

- nvm 是 sourced shell 函式（`$NVM_DIR/nvm.sh`），安裝腳本會在 `~/.bashrc`（或 `~/.profile` / `~/.zshrc`）追加載入片段。Ubuntu 預設 `.bashrc` 在非互動 shell 開頭就 return，所以 BAT 偵測（login / 非互動 shell 的 `command -v node`）很可能看不到 nvm 管理的 node。
- `nvm install --lts` 下載 nodejs.org 的 binary，並以 SHASUMS256 校驗。
- 偵測時要注意 T0407 記錄的 Windows interop 遮蔽：WSL 的 PATH 有大量 `/mnt/*`，`command -v npm` 可能解析到 `/mnt/c/nvm4w/nodejs/npm`。這種情況要沿用既有的 interop-only 警示，不能當成已安裝。

## 任務

1. **偵測**：node 偵測先嘗試載入 `${NVM_DIR:-$HOME/.nvm}/nvm.sh`（存在才載入），再取 `node --version` 與路徑；另回報 nvm 是否存在與其版本（顯示在卡片上，例如「nvm 0.40.x」）。interop-only 的 node 仍視為未安裝並保留警示。本機短連線與遠端視窗兩條偵測路徑行為一致。
2. **安裝食譜**：Linux（apt / dnf / apk 皆可，不需 sudo）：釘選 tag 的 nvm `install.sh` → 載入 nvm → `nvm install --lts` → `nvm alias default 'lts/*'` → 寫完成標記（沿用 sentinel 機制）。確認對話框顯示來源與完整性說明（nvm tag、Node SHASUMS，三語）。macOS（SSH 目標）：同樣用 nvm；若既有架構不支援 macOS 食譜，就維持說明連結並在回報區寫明。Alpine（musl）：nodejs.org 沒有官方 musl binary，nvm 會改成從原始碼編譯，太慢 → 此平台維持「沒有一鍵安裝」並附說明。
3. **已安裝 node 但非 nvm**（例如 apt 的 18.x）：顯示版本；是否提供「透過 nvm 安裝 LTS」由你決定並說明（不得移除系統 node）。
4. **更新**：nvm 管理的 node 若不是最新 LTS，比照 claude 的「更新」按鈕（`nvm install --lts --reinstall-packages-from=current` 或等價做法，取捨寫進回報區）；做不到就只做安裝。
5. **測試**：食譜 snapshot / 單元測試（指令內容、host 白名單、平台分支、Alpine 不提供）、偵測解析（nvm 存在 / 不存在 / interop-only / apt node）。
6. **WSL 實機**（`Ubuntu-24.04`，條件見 memory_overrides）：以隔離實例（本機 build）開啟工具面板 → 對 Node.js 按安裝 → 遠端分頁跑完 → 「重新檢查」顯示 node LTS 版本與 nvm；另以非互動方式（`wsl -d Ubuntu-24.04 --exec bash -lc 'command -v node'` 與 BAT 偵測）確認看得到。smoke `npm run smoke:remote:headless` 13/13。
7. 更新 T0407 / PLAN-037 相關描述不必改歷史，只在 CLAUDE.md（若有遠端工具段落）或 docs 補 node / nvm 行為。

## 驗收條件

- [x] Node.js 卡片在 Linux（apt / dnf）有一鍵安裝；Alpine 維持說明連結
- [ ] 安裝後偵測顯示 node LTS 版本與 nvm 版本；非互動 shell 也看得到（偵測 ✅、BAT 終端 ✅、`bash -lic` ✅；`bash -lc` ❌，見回報區）
- [x] interop-only node 不被當成已安裝
- [x] nvm 版本釘選、來源加入白名單、確認對話框有來源與完整性說明（三語）
- [x] `npm run test:unit` 全綠（含新測試，基線以 HEAD 為準）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功
- [x] WSL 實機安裝成功、smoke 13/13；`.bashrc` 只多出 nvm 的載入片段

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

**PARTIAL**：功能、測試、WSL 實機安裝與 smoke 全部通過；只有驗收「非互動 shell 也看得到」中的 `wsl -d Ubuntu-24.04 --exec bash -lc 'command -v node'` **看不到** nvm 的 node（`bash -lic` 看得到；BAT 偵測與 BAT 終端都看得到）。原因：nvm 官方把載入片段追加在 `~/.bashrc` 結尾，Ubuntu 預設 `.bashrc` 對非互動 shell 第 6–9 行就 `return`，所以單純 `bash -lc` 永遠到不了那幾行。要讓 `bash -lc` 也看得到，必須改動 `~/.profile`（或把片段改寫進 `.profile`）。這超出本單已核准的變更範圍（memory_overrides 只核准 nvm 改 `.bashrc`），因此沒有做，留給塔台決定（見「遭遇問題」第 1 點）。

Commit：`e9cae8d8` feat(remote-tools): T0555 one-click Node.js through nvm（22 檔，未 push）。

落點檢查：**PASS**。C-0 `repo`=`better-agent-terminal`，`basename(REPO_ROOT)`=`better-agent-terminal`，相符。C-1 工單位於 REPO_ROOT 底下。C-3 抽查 `affects_files` 前 5 項，全部存在。C-2 工單沒有 `branch` 欄位，HEAD 為 `main`。`BAT_WORKSPACE_ID`=`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只作紀錄）。CT_MODE=`yolo`，CT_INTERACTIVE=`0`。

### 產出摘要

**偵測**（`electron/remote-tools/probe-script.ts`、`parse.ts`、`src/types/remote-tools.ts`）
- login probe 若 `${NVM_DIR:-$HOME/.nvm}/nvm.sh` 存在，就在子 `/bin/sh` 內載入它，套用既有的 `bat_run 8` 逐指令逾時。nvm.sh 損毀或卡住都不會中斷 probe（dash 實測語法錯誤的 nvm.sh 仍能完成）。只取兩行輸出：`nvm --version`，以及 nvm 啟用的 node。
- 該 node 位於 `$NVM_DIR/versions/node/*/bin/node` 底下時，優先於 PATH 上的 node（與使用者終端的行為一致）。WSL 下若路徑在 `/mnt/<drive>/`，仍重新套用 interop 規則，判為 interop-only，不算已安裝。
- 報告新增兩個欄位，只出現在 node：`nvm?: { version?: string }`（顯示用），以及 `nvmManaged?: boolean`（enum 類旗標，只在 node 為 ok 時設定）。parser 白名單只多 `tool.node.nvm` / `tool.node.nvm_managed` 兩個 key，版本字串經 `LOOSE_VERSION_RE` 解析。
- server view probe 不變。schema 仍為 v1：舊 server 照常回答，只是少了這兩個欄位（回滾後實測舊 probe 也偵測到 `node=ok@24.22.0`，因為 `-l -i` 會載入 rc）。
- 本機短連線（`remoteTools.detect(profileId)`）與遠端視窗（`remote-tools:detect`）走同一個 server handler。e2e 驗證了前者，smoke S10 驗證了後者，兩者結果一致。

**食譜**（`src/lib/remote-tools/recipes.ts`）
- `NVM_VERSION_TAG = 'v0.40.8'`（2026-09-21 發佈，以 `gh api repos/nvm-sh/nvm/releases` 確認為最新版；不用 master）。白名單新增 `raw.githubusercontent.com`。
- install（Linux apt / dnf / yum / none / linuxbrew，以及 macOS；不需 sudo）：
  `export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && mkdir -p "$NVM_DIR" && curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | METHOD=script bash && . "$NVM_DIR/nvm.sh" && nvm install --lts && nvm alias default 'lts/*'`
  - 用 `METHOD=script`：nvm.sh 從同一個 tag 以 curl 下載，不依賴 git，也避開 macOS `/usr/bin/git` stub 跳出 CLT 對話框。
  - 先 `export` 並 `mkdir` NVM_DIR：避免 install.sh 在設有 `XDG_CONFIG_HOME` 時改裝到 `$XDG_CONFIG_HOME/nvm`（與偵測路徑不一致）。
- Alpine / musl（apk 或 musl 旗標）：新的 unsupported 原因 `node-musl-source-build`，附 nodejs.org 連結。OS 為 unknown 時回 `no-recipe`。
- 確認對話框：integrity 為 `nvmNodeShasums`（帶 `{{nvmTag}}`，文字說明 SHASUMS256.txt 校驗）。`scriptPinned` 旗標讓對話框改顯示「固定發行版本標籤、未以雜湊鎖定」，不顯示原本「vendor 每次發佈都會改」的說明。安裝位置顯示 `~/.nvm`。三個 notes：改 rc 檔（含 `bash -lc` 的限制）、保留系統 node、需重開分頁。三語齊全。

**任務 3：已安裝但非 nvm 的 node（例如 apt 18.x）**
- 決定：顯示版本，並在旁邊提供非 primary 的「透過 nvm 安裝 LTS」按鈕與一行說明，系統 node 不移除。
- 理由：使用者需求就是以 nvm 管理版本；nvm 的 node 只會在有載入 nvm 的 shell 中優先使用，apt 套件完全不動。
- Alpine 上已安裝的 node：不顯示按鈕，也不顯示 unsupported 提示。

**任務 4：更新**
- nvm 管理的 node 一律顯示「更新」（不強調，與 claude 相同）。指令：
  `export NVM_DIR=… && . "$NVM_DIR/nvm.sh" && if [ "$(nvm version-remote --lts)" = "$(nvm current)" ]; then echo "Node.js $(nvm current) is already the latest LTS"; else nvm install --lts --reinstall-packages-from=current && nvm alias default 'lts/*'; fi`
- 取捨一：不在偵測時判斷「是否已是最新 LTS」。那需要每次偵測都連 nodejs.org，會拖慢偵測，離線時也會失敗，所以按鈕常駐，由指令自行判斷。
- 取捨二：必須先比對版本。nvm v0.40.8 原始碼（`nvm.sh` 4903 行）顯示，`--reinstall-packages-from=current` 遇到 current 就是目標版本時，會回 `Can not reinstall packages from the current version` 並 exit 2，所以先比對、已是最新就 exit 0。
- 舊版本保留。`default` 改為 `lts/*`，這點寫在 note 裡。

**UI**（`tool-actions.ts`、`RemoteToolsPanel.tsx`、`InstallConfirmDialog.tsx`）
- node 列顯示 `nvm 0.40.8` chip，偵測不到版本時只顯示 `nvm`。
- 「透過 nvm 安裝 LTS」按鈕沿用 curl 檢查：curl 不可用時停用並顯示提示。
- install-runner 完成後的重開提示，node 改用 `remoteToolInstall.hint.reopenTabsNvm`。原提示寫死 `~/.local/bin`，對 nvm 不正確。

**測試**
- recipes：釘選 tag、不含 master、各平台分支、Alpine / musl / unknown、install 步驟、update 指令、snapshot 更新。
- parse：nvm 管理、nvm 已裝但未用（apt node）、無 nvm、interop-only、nvm 沒回版本、偽造 key、版本字串 sanitize。
- probe：source guard 更新（只 source nvm.sh、只在 login view、interop 規則套用兩次），並新增 POSIX 實 shell 測試（Windows 上 skip，另以 WSL dash 手動跑過四種情境）。
- panel / dialog：nvm 更新、apt node 旁裝、curl 缺、interop、Alpine、對話框內容、zh-TW / zh-CN tag。
- 其他：install-runner node 重開提示、i18n completeness、smoke S10 evidence（`node=ok@24.22.0(nvm 0.40.8, managed)`，只顯示、不參與判定）。
- e2e：`e2e/t0555-node-nvm-wsl.spec.ts`，opt-in（`BAT_E2E_T0555=1`），三語 UI 比對；`~/.nvm` 已存在時 skip。

**文件**：`docs/remote-dev-overview.md` 新增「Remote tools: Node.js via nvm (T0555)」一節。CLAUDE.md 沒有遠端工具段落，未改。

**驗證**
| 項目 | 結果 |
|---|---|
| `npm run test:unit` | PASS：252 檔，4345 passed，3 skipped |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npx vite build` | 成功 |
| WSL 實機：隔離實例（本機 build）→ Profiles 卡片工具面板 → Node.js「安裝」→ 確認對話框（v0.40.8、SHASUMS256.txt）→ 遠端視窗分頁執行 | PASS：exit 0，輸出含 `Checksums matched!`、`Now using node v24.22.0 (npm v11.19.1)`、`default -> lts/*` |
| 「重新檢查」 | PASS：`Node.js 已安裝 24.22.0 nvm 0.40.8 … 更新 /home/gower/.nvm/versions/node/v24.22.0/bin/node`；`remoteTools.detect` 回 `nvm.version=0.40.8`、`nvmManaged=true` |
| 非互動 `bash -lc 'command -v node'` | ❌ `node-not-found`（見「完成狀態」） |
| `bash -lic` | PASS：`/home/gower/.nvm/versions/node/v24.22.0/bin/node v24.22.0` |
| BAT 偵測（非互動 `/bin/sh` probe） | PASS |
| 更新路徑：已是最新 LTS（`remote-tools-install-check.mjs --tool node --kind update --yes`） | PASS：exit 0，偵測前後皆 24.22.0 |
| 更新路徑：舊版 → 新版（`/tmp` 暫存 NVM_DIR、`PROFILE=/dev/null`，不碰 `~/.nvm` 與任何 rc 檔，結束後刪除） | PASS：v22.23.3 + `semver` → v24.22.0，全域套件重裝，default → `lts/*`；第二次執行印出「already the latest LTS」並 exit 0 |
| `npm run smoke:remote:headless` | 13/13，三次：基線、部署新 probe 後、回滾後 |
| `.bashrc` | 只多 nvm 的 1 空行 + 3 行（`export NVM_DIR="$HOME/.nvm"`、nvm.sh 載入、bash_completion 載入）。sha256 `342099da…9bb8`（117 行）→ `e111bf20…cb90`（121 行）。備份：`~/.bashrc.t0555-20261016-042526.bak`。`.profile` 未變（`28b4a453…a4`） |
| WSL server | 結束時 9877、active、指紋 `22:3A:E4:C7…79:97` 不變 |
| 使用者 BAT（9876）與 `/mnt/c` | 9876 未碰；`/mnt/c`、nvm4w 均未改動 |

**WSL server JS**
- 以 `node scripts/dev-deploy-headless.mjs --target wsl:Ubuntu-24.04 --tag t0555 --yes` 部署新 probe 做驗證。
- 驗證完以 `--rollback --yes` 還原為原本的 0.6.1-pre.4，`.bak-t0555` 備份檔保留在 `~/.local/bat-server/electron/remote/`。
- 要在現有 server 看到 nvm 欄位，需等發版或再跑一次 deploy。

### 互動紀錄

無（CT_INTERACTIVE=0，yolo）。自行決定的事項：任務 3 的旁裝按鈕、任務 4 的更新常駐按鈕與「先比對」寫法、`METHOD=script`、`NVM_DIR` 先設定、`bash -lc` 不改 `.profile`，理由見上。

### Renew 歷程

無。

### 遭遇問題

1. **`bash -lc` 看不到 nvm 的 node**（待塔台決策）。選項：
   - (a) 維持現狀：nvm 官方行為，只改 `.bashrc`，BAT 終端與偵測都正常，對話框已說明限制。**建議採用。**
   - (b) 安裝時另在 `~/.profile` 追加同樣的載入片段：`bash -lc` 也看得到；但會多改一個使用者檔案，互動 login shell 會載入 nvm 兩次（多 0.2–0.5 s）。
   - (c) 以 `PROFILE=~/.profile` 讓 nvm 只寫 `.profile`：zsh 使用者會失去 nvm，不建議。
   - 採 (b) 時需開新單，並同步更新 memory_overrides 的已核准變更範圍。
2. **e2e 第一次執行失敗**：隔離實例跟隨 OS 語言（繁中），英文按鈕名稱比對不到。已改為三語 locale 比對，第二次通過。
3. **nvm install.sh 的 `nvm_check_global_modules`**：在 WSL 上 `command -v npm` 會解析到 `/mnt/c/nvm4w/nodejs/npm`，install.sh 會以唯讀方式執行它的 `npm --version` / `npm list -g`，不會修改 Windows 端。這次實測沒有輸出任何警告。
4. **probe 的 `bat_run 8` 依賴 `timeout`**：主機沒有 `timeout` 時，nvm 子 shell 只受整體 20 s 逾時限制（與既有 `--version` 行為相同）。

### 回報時間

2026-10-16T04:49:20+0800

---

## 塔台收單（第六十六 session，2026-10-16T04:53:33+0800）

- 📋 **T0555 PARTIAL 確認**：`e9cae8d8`（22 檔）。塔台複驗 @ `e9cae8d8`：`npm run test:unit` 4345 passed / 252 files（3 skipped）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0；WSL：server 0.6.1-pre.4 active，`bash -lc 'command -v node'` → not found、`bash -lic` → `/home/gower/.nvm/versions/node/v24.22.0/bin/node`（與回報一致）。
- 未過的 gate：非互動 login shell 看不到 nvm 的 node。使用者選擇選項 b（加有防重複的 profile 片段）→ **T0556**。T0556 DONE 後依「Resolved PARTIAL 補正規則」把本單補正為 DONE。
- 任務 3 / 4 的自行決定（apt node 旁裝按鈕、更新常駐 + 先比對）、`METHOD=script`、`NVM_DIR` 先設定皆採納。
- 依 `worker_auto_close` 規則，PARTIAL 不自動回收 Worker 分頁（`b95c21e2…`）。
- WSL 留下的檔案：`~/.bashrc.t0555-20261016-042526.bak`、`~/.local/bat-server/electron/remote/*.bak-t0555`（4 個），待使用者決定刪除。
