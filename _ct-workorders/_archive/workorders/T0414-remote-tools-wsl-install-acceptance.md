---
schema_version: 1
schema_kind: workorder
id: T0414
title: "PLAN-037 G：WSL Ubuntu-24.04 實機安裝驗收（協定層自動化）——經 headless PTY 實際執行 claude / codex / uv / gh / rg 食譜，驗證完成標記、重新偵測與 T0407 剩餘風險"
type: test
status: DONE
started_at: "2026-10-05T03:45:41+08:00"
updated_at: "2026-10-05T04:05:32+08:00"
completed_at: "2026-10-05T04:05:32+08:00"
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: M
created_at: "2026-10-05T03:44:40+08:00"
target_version: next
depends_on:
  - T0408
  - T0409
  - T0411
  - T0412
related:
  - "T0407 回報區「剩餘風險」與建議清單 G 的 8 項驗收重點"
  - "T0409 回報區「剩餘風險」；T0412 回報區「T0414 實機步驟」（UI 部分由使用者另行操作）"
affects_files:
  - _ct-workorders/T0414-remote-tools-wsl-install-acceptance.md
  - scripts/remote-tools-install-check.mjs
  - scripts/__tests__/remote-tools-install-check.test.mjs
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "✅ **使用者已同意（2026-10-05 03:44）在 WSL `Ubuntu-24.04` 實際安裝**：claude、codex、uv（使用者空間 install.sh → `~/.local/bin`）、gh、rg（apt + sudo；此帳號 sudo 免密碼）。這是本 PLAN 第一次允許實際安裝。"
  - "🔴 只能在 **WSL `Ubuntu-24.04`** 安裝；不得動 Windows 主機上的任何工具、不得在其他 distro / 機器安裝。只安裝上列 5 個工具，不另裝其他套件（apt 依賴除外）。"
  - "🔴 安裝一律經 **headless bat-server 的 PTY**（`pty:create` → `pty:write`），指令一律取自 `buildInstallPlan()` / `buildUpdatePlan()` + `wrapWithSentinel()`，與 BAT 實際路徑相同；不得手打或改寫指令。"
  - "🔴 不得 restart / redeploy `bat-server.service`；不得修改 `~/.local/bat-server`；不得登入任何工具（不執行 `claude auth login` / `codex login` / `gh auth login`）；不讀任何 credential 內容。"
  - "🔴 自建 PTY 一律帶唯一前綴並在 `finally` kill；不碰其他 PTY。"
  - "🔴 不改產品程式碼（`electron/`、`src/`）。發現產品 bug 只回報。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0414 — WSL 實機安裝驗收（PLAN-037 G）

## 元資料
- **工單編號**：T0414
- **任務名稱**：remote-tools WSL 實機安裝驗收
- **狀態**：DONE
- **建立時間**：2026-10-05 03:44 (UTC+8)
- **intervention_type**：fire-and-forget

## 背景

PLAN-037 A-F（T0408-T0413）已完成，WSL server 已部署 T0411（smoke 10/10，S10 偵測：git / curl / bash / python3 ok；claude / gh / codex / rg / uv / node missing）。本單用**協定層**（同 `scripts/smoke-remote-headless.mjs` 的 client：TLS pin + token）實際在 WSL 上跑安裝，驗證整條路徑在真實環境可行。精靈 / 設定頁 / 跨視窗的 UI 點擊由使用者另外以新 build 操作（T0412 回報區步驟），不在本單。

## 範圍

1. 建 `scripts/remote-tools-install-check.mjs`（可重用的開發工具；沿用 smoke 的連線與 `--target wsl:<distro>` 解析，可 import smoke 的 client 或抽共用）：
   - `remote-tools:detect` → 以 `normalizeRecipeEnv` + `buildInstallPlan` / `buildUpdatePlan` 產生 plan（`src/lib/remote-tools/*` 為 TS，`.mjs` 如何引用由 Worker 決定：esbuild 轉譯或 `tsx`，回報說明）
   - 開 PTY（cwd `$HOME`、shell `/bin/bash`、**不帶 agentPreset**）→ 寫入 `wrapWithSentinel(plan.command, nonce) + '\r'` → `createSentinelMatcher` 判定 exit code → 再 `remote-tools:detect` 比對
   - 預設 dry-run（只印 plan）；`--yes` 才實際執行；`--tool <id>` 指定工具；輸出每步證據
   - 若做成 commit 的工具，補單元測試（參數解析 / dry-run 不寫入）
2. 依序實際安裝：**claude → uv → codex → rg → gh**，每個記錄：指令、exit code、耗時、安裝前後偵測（status / path / version / serverVisible）
3. 驗收重點（T0407 G）：
   - ① 完成標記：每個安裝都正確回報 exit code
   - ② 重新偵測：安裝後 status 變 `ok`（或合理的 `not-on-path`，說明原因）
   - ③ 新 login shell 看得到 `~/.local/bin`：安裝後**新開** PTY 跑 `command -v claude codex uv`
   - ④ interop 遮蔽：login 視角下 codex 是否從 `interop-only` 變為 `~/.local/bin/codex`（記錄 PATH 順序）
   - ⑤ `DISABLE_AUTOUPDATER=1` 環境下 claude install.sh / `claude install` 是否成功；並確認安裝 PTY 的 env **沒有** `DISABLE_UPDATES`
   - ⑥ `codex login status` 未登入時的 exit code（印出 code，丟棄 stdout）
   - ⑦ sudo 需要密碼的情境：此帳號為 NOPASSWD，**無法覆蓋**，標 NOT COVERED
   - ⑧ Docker root 無 sudo：**無法覆蓋**，標 NOT COVERED
   - 另：claude `buildUpdatePlan`（`claude update`）跑一次；codex installer 對 shell profile 的修改內容（列出新增的區塊，不改它）
4. 安裝後跑一次 `npm run smoke:remote:headless -- --target wsl:Ubuntu-24.04`，確認仍 10/10，S10 反映新狀態

## 驗收條件

- [ ] 5 個工具的安裝結果表（含 ①②③④）與原始證據
- [ ] ⑤ ⑥ 的結論；⑦ ⑧ 標 NOT COVERED
- [ ] 安裝後 smoke 10/10
- [ ] 若有 commit 的腳本：`npm run test:unit` 全綠（基線 1614）；`npx tsc --noEmit` ≤ 40
- [ ] 回報區列出 WSL 上被修改的檔案 / 目錄清單（`~/.local/bin/*`、`~/.local/share/claude`、`~/.codex`、shell profile、apt 套件），供使用者知悉

## Sub-session 執行指示
1. 讀本工單 + T0407 回報區（§2、剩餘風險、建議清單 G）+ T0409 / T0412 回報區 + `scripts/smoke-remote-headless.mjs`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 先 dry-run 全部工具並把 plan 寫進回報區 → 再 `--yes` 依序安裝
4. 填回報區；完成寫 **`DONE`**；某個工具安裝失敗但腳本正確 → 仍 `DONE`，失敗列入「遭遇問題」交塔台
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE —— 5 個工具全部經 headless PTY 實際安裝成功（exit 0，安裝後偵測皆為 `ok`）。claude `update` 跑過一次。安裝後 smoke 10/10。①-⑥ 有結論；⑦⑧ 標 NOT COVERED。
**發現 1 個產品問題**：codex installer 結尾會跳出互動提示，卡住完成標記。見「遭遇問題」1，交塔台處理。

**落點檢查**：PASS
- C-0：frontmatter `repo: better-agent-terminal` == `basename(REPO_ROOT)` `better-agent-terminal`
- C-1：工單位於 REPO_ROOT 之下
- C-3（資訊性）：`scripts/remote-tools-install-check.mjs` 與其測試檔是新檔，最近的上層目錄 `scripts/`、`scripts/__tests__/` 都存在 ⇒ present
- C-2：工單未指定 branch；實際在 `main`
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅作紀錄）
- 執行環境：`CT_MODE=on`、`CT_INTERACTIVE=0`

**驗收條件**
| # | 項目 | 結果 | 證據 |
|---|------|------|------|
| 1 | 5 個工具的安裝結果表（含 ①②③④）與原始證據 | ✅ PASS | 見「安裝結果」「驗收重點」。原始 JSON 在 session scratchpad（`dryrun.json`、`shell-before.json`、`install-{claude,uv,codex,rg,gh}.json`、`update-claude.json`、`shell-after.json`），關鍵欄位已摘錄到本回報 |
| 2 | ⑤ ⑥ 的結論；⑦ ⑧ 標 NOT COVERED | ✅ PASS | 見「驗收重點」 |
| 3 | 安裝後 smoke 10/10 | ✅ PASS | `npm run smoke:remote:headless -- --target wsl:Ubuntu-24.04`（04:03:03 開始）：**10/10 PASS**，沒有殘留 smoke PTY。<br>S10：`claude=ok@2.1.285 git=ok@2.43.0 gh=ok@2.102.0 codex=ok@0.160.0 curl=ok@8.5.0 bash=ok@5.2.21 rg=ok@14.1.0 uv=ok@0.12.23 python3=ok@3.12.3 node=missing`。<br>S9：`system /home/gower/.local/bin/claude 2.1.285 (healthy)`，embedded 為 2.1.289 |
| 4 | commit 的腳本：`npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40 | ✅ PASS | `npm run test:unit`：106 files，**1640 passed**、1 skipped（基線 1614，本單新增 26）。`npx tsc --noEmit`：**40**（= 基線，本單檔案 0 筆） |
| 5 | WSL 被修改的檔案 / 目錄清單 | ✅ PASS | 見「WSL 上被修改的項目」 |

**產出：`scripts/remote-tools-install-check.mjs`**（可重用的開發工具）
- **連線**：直接 import `scripts/smoke-remote-headless.mjs` 匯出的 `SmokeClient`（TLS pin + token）、`resolveWslTarget` / `resolveUrlTarget`、`PtyTracker`、`ptyCreateOutcome`。沒有另外抽共用模組。`--target wsl:<distro>` 與 `--url/--token-file/--fingerprint` 的參數規則都與 smoke 相同。
- **TS 引用方式**：使用 Node 24 內建的 type stripping（Node 24.21.0，不需旗標），不用 esbuild 或 tsx，也不新增依賴。
  - `module.registerHooks` 註冊一個只作用於 `src/` 的 resolve hook。
  - 這個 hook 會替 `src/` 內不帶副檔名的相對 import 補上 `.ts`，並標記為 `format: 'module-typescript'`，因此不會出現 MODULE_TYPELESS 警告。
  - 實際載入 `recipes.ts`、`sentinel.ts`、`types/remote-tools.ts` 這三個**原始檔**，與 BAT 用的程式碼是同一份。
- **流程**：與 T0412 runner 相同：
  1. `remote-tools:detect` → `normalizeRecipeEnv` → `buildInstallPlan` / `buildUpdatePlan`
  2. `pty:create({ id, cwd: $HOME, type: 'terminal', shell: '/bin/bash' })`，**不帶 agentPreset**
  3. 等到第一段輸出後再延遲 500 ms
  4. `pty:write(wrapWithSentinel(plan.command, nonce) + '\r')`
  5. 用 `createSentinelMatcher(nonce)` 讀取原始 `pty:output` 取得 exit code
  6. 再呼叫一次 `remote-tools:detect`
- **選項**：
  - 預設 dry-run：只做偵測並印出 plan，不呼叫 `pty:create` / `pty:write`。
  - `--yes`：實際執行。
  - `--tool <id>`：可重複指定，會驗證是否在 `REMOTE_TOOL_IDS` 內。
  - `--kind install|update`。
  - `--shell-check`：新開 login PTY 檢查 ③④⑥。
  - `--json`：機器可讀輸出。
- **診斷指令**：除了安裝指令之外，只會打入檔案內固定的 one-liner。
  - 內容：`DISABLE_*` 變數名稱與值、shell profile 的 cksum 與行數（以及新增的行）、`command -v`、PATH 中的順序索引、`codex login status` 的 exit code。
  - 輸出以 base64 包裝，並加 nonce 標記。終端回顯的只是格式字串，所以不會誤判。
  - 不 dump 完整 env：PTY env 含 `BAT_REMOTE_TOKEN`。測試有斷言這一點。
- **PTY 管理**：id 格式為 `t0414-<stamp>-<rand>-<step>`。每個 PTY 都在 `finally` 中 kill，之後用 `pty:write` 確認回傳 `pty-not-found`。所有執行都回報 `leftovers: []`。
- **測試**：`scripts/__tests__/remote-tools-install-check.test.mjs`，26 tests。
  - 參數解析：預設值、`--tool` 重複與去重、11 種拒絕情況、target 只能擇一。
  - dry-run 只呼叫 `remote-tools:detect`。
  - `--yes`：寫入內容 == `wrapWithSentinel(plan.command, nonce) + '\r'`；`pty:create` 參數完整相等且 `not.toHaveProperty('agentPreset')`；有重新偵測與 kill。
  - exit 非 0 ⇒ 整體失敗，但仍會重新偵測並 kill。
  - unsupported ⇒ 不開 PTY。
  - 其他：probe 標記無法被回顯誤判、profile 差異比對、`main` 的 exit code。

### dry-run plan
`node scripts/remote-tools-install-check.mjs --target wsl:Ubuntu-24.04`（03:49:51，exit 0）
- env：`{"osFamily":"linux","pkgManager":"apt","privilege":"passwordless","musl":false,"osId":"ubuntu","osVersion":"24.04","arch":"x86_64","isWsl":true}`
- 連線：`wss://127.0.0.1:9877`（BAT_SERVER_PORT）

| 工具 | sudo | plan.command |
|------|------|--------------|
| claude | 否 | `curl -fsSL https://claude.ai/install.sh \| bash -s stable` |
| uv | 否 | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| codex | 否 | `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` |
| rg | 是 | `sudo apt-get update && sudo apt-get install -y ripgrep` |
| gh | 是 | `(command -v wget >/dev/null 2>&1 \|\| (sudo apt-get update && sudo apt-get install -y wget)) && sudo mkdir -p -m 755 /etc/apt/keyrings && out=$(mktemp) && wget -nv -O"$out" https://cli.github.com/packages/githubcli-archive-keyring.gpg && cat "$out" \| sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null && rm -f "$out" && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && sudo mkdir -p -m 755 /etc/apt/sources.list.d && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \| sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && sudo apt-get update && sudo apt-get install -y gh` |
| claude（update） | 否 | `claude update` |

實際打入 PTY 的字串 = 上表指令 + `; printf '\n__BAT_TOOL_DONE_%s_%s__\n' '<16 hex nonce>' "$?"` + `\r`（各次的 `typed` 都記錄在 JSON 中）。

### 安裝結果
依序執行 `--tool <id> --yes`。安裝前 5 個工具都是 `{"status":"missing","serverVisible":false,"login":"n/a"}`。

| # | 工具 | 開始 | exit code（①） | 耗時 | 安裝後偵測（②） | 安裝 PTY env（⑤） | profile 變更 |
|---|------|------|---------------|------|----------------|------------------|-------------|
| 1 | claude | 03:50:16 | **0** | 11.98 s | `ok` `/home/gower/.local/bin/claude` **2.1.285**，`serverVisible:false`，`login:loggedOut` | `DISABLE_AUTOUPDATER=1`（無 `DISABLE_UPDATES`） | 無 |
| 2 | uv | 03:50:36 | **0** | 1.65 s | `ok` `/home/gower/.local/bin/uv` **0.12.23**，`serverVisible:false` | 同上 | 無 |
| 3 | codex | 03:50:45 | **0**（⚠️ 見下方說明） | 641.75 s（實際安裝約數秒，其餘時間卡在互動提示） | `ok` `/home/gower/.local/bin/codex` **0.160.0**，`serverVisible:false`，`login:loggedOut` | 同上 | 無 |
| 4 | rg | 04:02:16 | **0** | 11.85 s | `ok` `/usr/bin/rg` **14.1.0**，`serverVisible:true` | 同上 | 無 |
| 5 | gh | 04:02:35 | **0** | 3.60 s | `ok` `/usr/bin/gh` **2.102.0**，`serverVisible:true`，`login:loggedOut` | 同上 | 無 |
| — | claude `update` | 04:02:45 | **0** | 0.57 s | 前後皆為 `ok` 2.1.285 | 同上 | 無 |

輸出摘錄（ANSI 已去除）：
- claude：`Installing Claude Code native build stable...` → `⚠ Setup notes: Native installation exists but ~/.local/bin is not in your PATH.`（這個 PTY 是在 `~/.local/bin` 建立之前開的）→ `✔ Claude Code successfully installed! Version: 2.1.285 Location: ~/.local/bin/claude` → `✅ Installation complete!` → `__BAT_TOOL_DONE_<nonce>_0__`
- uv：`downloading uv 0.12.23 x86_64-unknown-linux-gnu` / `installing to /home/gower/.local/bin` / `everything's installed!`
- codex：`Resolved version: 0.160.0` → `Installing standalone package to ~/.codex/packages/standalone/releases/0.160.0-x86_64-unknown-linux-musl` → `/home/gower/.local/bin is already on PATH` → `Codex CLI 0.160.0 installed successfully.` → **`Start Codex now? [y/N]`** → （送出 Enter 後）`__BAT_TOOL_DONE_<nonce>_0__`
- rg / gh：apt 正常安裝（`Setting up ripgrep (14.1.0-1)`、`Setting up gh (2.102.0)`）。sudo 為 NOPASSWD，沒有出現提示。
- claude update：`Current version: 2.1.285` / `Checking for updates to stable version...` / `Claude Code is up to date (2.1.285)`

⚠️ **codex 的 exit 0 有人為介入**：install.sh 的 `prompt_yes_no "Start Codex now?"` 從 `/dev/tty` 讀取回答，PTY 中的 `sh`（pid 4311，狀態 `S+`）一直停在前景等待。
- 處理方式：用另一條連線，只對本單建立的 PTY（`t0414-20261005035046-779f1a-codex`）呼叫 `pty:get-buffer` 確認提示內容，然後在 04:01:28 寫入一個 `\r`。
- 這等於選擇預設值 N，不會啟動 codex。之後標記立即回報 0。
- 沒有改寫安裝指令（見「互動紀錄」）。

**codex installer 對 shell profile 的修改**：本次沒有修改。
- 原因：`add_to_path()` 檢查 `":$PATH:"` 時，`~/.local/bin` 已經在 PATH 上（claude 先建立了這個目錄，而 codex 的 PTY 是之後才開的 login shell），所以直接 return。
- 讀 install.sh（只下載到 scratchpad 閱讀，未執行）得知：如果 `~/.local/bin` 不在 PATH 上，會依 `$SHELL` 選 profile（linux bash 用 `~/.bashrc`、zsh 用 `~/.zshrc`、其他用 `~/.profile`；darwin zsh 用 `~/.zprofile`、bash 用 `~/.bash_profile`），並 append 以下區塊：
  ```
  # >>> Codex installer >>>
  export PATH="/home/<user>/.local/bin:$PATH"
  # <<< Codex installer <<<
  ```
  如果區塊已存在，則就地改寫。
- 腳本對 5 個工具的安裝都做了 profile cksum 前後比對：`.profile 636641418/27` 與 `.bashrc 1623673384/117` 全程不變。
- claude 與 uv 也都沒有改 profile：claude 只印出提示；uv 因為 PATH 上已有 `~/.local/bin`，所以略過。

### 驗收重點 ①-⑧

| # | 項目 | 結論 | 證據 |
|---|------|------|------|
| ① | 完成標記 | ✅ PASS | 6 次執行（5 install + 1 update）都由 `createSentinelMatcher` 從原始 `pty:output` 解出 exit 0。sudo 的 apt 長輸出、ANSI、`\x1b7\x1b8` 都不影響判定。⚠️ codex 必須先回答互動提示，標記才會出現（遭遇問題 1） |
| ② | 重新偵測 | ✅ PASS | 安裝後 5 個工具都從 `missing` 變成 **`ok`**，path 與 version 正確。detect 的 login probe 每次都是新的 login shell，所以第一次建立 `~/.local/bin` 之後立刻看得到，沒有出現 `not-on-path`。`serverVisible`：`~/.local/bin` 下的三個工具為 `false`，`/usr/bin` 下的 rg / gh 為 `true`，與 T0407 剩餘風險 5 相符 |
| ③ | 新 login shell 看得到 `~/.local/bin` | ✅ PASS | `--shell-check --yes`（新開的 PTY `t0414-20261005040256-bf2a83-shell`）：`command -v` 的結果為 claude=`/home/gower/.local/bin/claude`、codex=`/home/gower/.local/bin/codex`、uv=`/home/gower/.local/bin/uv`、gh=`/usr/bin/gh`、rg=`/usr/bin/rg`；`~/.local/bin` 位於 PATH 第 1 項（共 11 項）。安裝前的基線 PTY 中五者皆為空，PATH 共 10 項，沒有 `~/.local/bin`。**舊分頁看不到**也有證據：claude 的安裝 PTY 在目錄建立前開啟，installer 自己警告 `~/.local/bin is not in your PATH` |
| ④ | interop 遮蔽 | ✅ PASS（結論修正 T0407 的前提） | **BAT 視角（headless PTY 與 detect probe）根本沒有 interop 遮蔽**：bat-server 由 systemd user 啟動，WSL 不會把 Windows PATH 附加到這類程序上，所以 PTY 的 login PATH 中 `/mnt/*` 為 0 項（安裝前 10 項 / 安裝後 11 項）。也因此 codex 安裝前的偵測是 `missing`，不是 `interop-only`。<br>**wsl.exe 的 login 視角**（使用者從 Windows 開 WSL 終端）：安裝後 `type -ap codex` = `/home/gower/.local/bin/codex`、`/mnt/c/Users/Gower/AppData/Roaming/npm/codex`；PATH 中 `~/.local/bin` 是**第 1 項**，第一個 `/mnt/` 是第 11 項（共 68 項）⇒ `~/.local/bin/codex` 蓋過 interop 版本 |
| ⑤ | `DISABLE_AUTOUPDATER=1` 下 installer / `claude install` 是否成功；PTY 沒有 `DISABLE_UPDATES` | ✅ PASS | 每個安裝 PTY 用 `env \| grep -E '^DISABLE_(UPDATES\|AUTOUPDATER)='` 檢查，結果都只有 `DISABLE_AUTOUPDATER=1`，沒有 `DISABLE_UPDATES`。claude install.sh（內部會跑 `claude install`）exit 0，輸出 `✔ Claude Code successfully installed!`。`claude update` 也在同樣的 env 下 exit 0。⇒ `DISABLE_AUTOUPDATER` 不會擋手動安裝或更新。T0407 剩餘風險 1 解除 |
| ⑥ | `codex login status` 未登入時的 exit code | ✅ **exit=1** | 新 login PTY 執行 `timeout 30 codex login status >/dev/null 2>&1`（stdout 與 stderr 都丟棄），結果為 `codex=/home/gower/.local/bin/codex exit=1`。與 T0407 讀原始碼的結論（1 = 未登入或錯誤）一致。T0407 剩餘風險 2 解除 |
| ⑦ | sudo 需要密碼 | ⏭️ **NOT COVERED** | 這個帳號是 NOPASSWD（`/etc/sudoers.d/90-gower-nopasswd`），且工單禁止在其他 distro 或機器安裝 |
| ⑧ | Docker root 無 sudo | ⏭️ **NOT COVERED** | 工單只允許在 WSL Ubuntu-24.04 執行 |

另外：
- claude 的 `stable` 頻道目前是 **2.1.285**，低於內嵌的 2.1.289，但 ≥ `HEALTHY_MIN` 2.1.280，所以偵測與 S9 都是 healthy。
- 未測 T0409 的剩餘風險「`curl | sh` 失敗卻回 0」。這需要斷網，超出本單範圍。

### WSL 上被修改的項目
（只看 stat 與目錄列表，沒有讀任何 credential 的內容）

| 項目 | 來源 | 時間 |
|------|------|------|
| `~/.local/bin/`（新目錄） | claude installer 建立 | 03:50 |
| `~/.local/bin/claude` → `~/.local/share/claude/versions/2.1.285`（symlink） | claude | 03:50 |
| `~/.local/share/claude/versions/2.1.285`（230 MB） | claude | 03:50 |
| `~/.cache/claude/`（含 `staging`）、`~/.local/state/claude/` | claude | 03:50:23 |
| `~/.claude/`：目錄原本就存在。新增或更新了 `settings.json`、`cache/changelog.md`、`downloads/`、`sessions/`、`backups/`；另有 `~/.claude.json` | claude install（mtime 03:50:23–29） | 03:50 |
| `~/.local/bin/uv`、`~/.local/bin/uvx`；`~/.config/uv/uv-receipt.json` | uv | 03:50:40 |
| `~/.local/bin/codex` → `~/.codex/packages/standalone/current/bin/codex`（symlink） | codex | 03:50 |
| `~/.codex/`（新目錄，427 MB）：`packages/standalone/{releases/0.160.0-x86_64-unknown-linux-musl, current, auto-update-version, install.lock}`、`tmp/arg0/...` | codex（`tmp/arg0` 可能是 `codex --version` 或 `codex login status` 產生的） | 03:50 起 |
| `~/.local/state/gh/` | gh 首次執行（detect probe 的 `gh auth status`） | 04:02:40 |
| apt 套件：`ripgrep 14.1.0-1`、`gh 2.102.0`（`/var/log/apt/history.log`：`apt-get install -y ripgrep`、`apt-get install -y gh`）。wget 原本已安裝，沒有另外裝 | rg / gh 食譜 | 04:02 |
| `/etc/apt/keyrings/githubcli-archive-keyring.gpg`（新檔）、`/etc/apt/sources.list.d/github-cli.list`（新檔） | gh 食譜 | 04:02 |
| apt 套件索引（`apt-get update` 兩次） | rg / gh 食譜 | 04:02 |
| shell profile | **沒有變更**（`.profile` / `.bashrc` 的 cksum 與行數前後相同） | — |

沒有 restart 或 redeploy `bat-server.service`，沒有動 `~/.local/bat-server`，也沒有登入任何工具。

### 互動紀錄
- **04:01:28 codex 互動提示（Worker 自行決定，非使用者介入）**：codex install.sh 結尾的 `Start Codex now? [y/N]` 讓標記一直等不到。
  - 處理：先對自己的 PTY 用 `pty:get-buffer` 確認提示內容，再 `pty:write('\r')`。這等於選擇預設值 N，不會啟動 codex。
  - 理由：這只是回答 installer 的提示，不是打入指令或改寫指令，等同使用者在 UI 安裝分頁按 Enter。若不處理，腳本要等到 15 分鐘逾時並送 Ctrl+C，exit code 證據就拿不到。
  - 兩個一次性連線腳本 `getbuf.mjs` / `enter.mjs` 放在 session scratchpad，只接受 `t0414-` 開頭的 id，不 commit。

### Renew 歷程
無

### 遭遇問題
1. 🔴 **產品問題（交塔台，未改產品碼）：codex 食譜在 BAT 安裝分頁會卡在互動提示**
   - 現象：`curl -fsSL https://chatgpt.com/codex/install.sh | sh` 安裝完成後，會從 `/dev/tty` 讀取 `Start Codex now? [y/N]` 的回答，期間不會印出完成標記。
   - 對 UI 的影響（T0412 流程）：
     - 分頁停在提示上，沒有完成 toast，也沒有自動重新偵測，直到使用者在分頁中回答。
     - 若使用者回答 `y`，codex TUI 會在安裝分頁中啟動，要等 codex 結束後才會回報標記與 toast。
   - 建議修法：`src/lib/remote-tools/recipes.ts` 的 codex 食譜改成 `curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh`。
     - 依據：install.sh 的 usage 第 100 行有 `CODEX_NON_INTERACTIVE  Set to 1, true, or yes to skip prompts`；`prompt_yes_no` 遇到這個值直接 `return 1`，也就是選 No。
     - 副作用：另一個提示 `Uninstall the existing <npm|bun|brew>-managed Codex now?` 也會自動選 No，只保留 PATH 衝突的提示訊息。
     - 需要同步更新的檔案：`src/lib/remote-tools/recipes.ts`、`src/lib/remote-tools/__tests__/__snapshots__/recipes.test.ts.snap`（Linux 矩陣快照）。
     - apk 版的食譜同樣適用。`sh` 前面的 env 前綴寫法是 POSIX sh 合法語法，`wrapWithSentinel` 不受影響。
2. **T0407 §0 的 interop 前提只適用 wsl.exe 開的 shell**：bat-server（systemd user）衍生的 PTY 與 detect probe 的 PATH 中沒有 `/mnt/*`，因此 BAT 視角下 `interop-only` 在這台 WSL **不會出現**（codex 安裝前是 `missing`）。偵測的分類邏輯本身沒有錯，只是這個 fixture 的情境在真實 BAT 路徑上不會觸發。不需要修改，僅供塔台更新認知。
3. `serverVisible:false` 適用於 `~/.local/bin` 下的 claude、codex、uv（T0407 剩餘風險 5 屬實；systemd unit 的 PATH 不含 `~/.local/bin`，屬 PLAN-035 範圍）。
4. claude installer 在「安裝分頁開啟時 `~/.local/bin` 還不存在」的情況下會印 `Native installation exists but ~/.local/bin is not in your PATH. Run: echo 'export PATH=...' >> ~/.bashrc`。Ubuntu 的 `~/.profile` 會在下一個 login shell 自動加入 PATH，所以**不需要**照做；T0412 的「舊分頁需重開」toast 已涵蓋這個情況。可考慮在 i18n 文案中補一句「不需要照 installer 的提示修改 .bashrc」（建議，非必要）。
5. 第一次跑 codex 時，`Bash` 工具 600 s 前景逾時，命令被移到背景，但仍正常完成（JSON 完整寫出）。不影響結果。
6. 測試輸出中的 `Error: AttachConsole failed` 是既有的 conpty 雜訊，與本單無關。

**Commit**：見下方（`git commit --only` 本單 3 個檔案；未 push）。

### 回報時間
2026-10-05T04:03:51+08:00
