---
schema_version: 1
schema_kind: workorder
id: T0407
title: "研究：遠端 AI 工具套件檢查與一鍵安裝（PLAN-037）—— 工具清單、官方安裝方式、偵測、精靈 / 設定頁整合、拆單"
type: research
status: DONE
repo: better-agent-terminal
project: PLAN-037
priority: P2
sizing: M
created_at: "2026-10-05T02:28:57+08:00"
started_at: "2026-10-05T02:30:10+08:00"
updated_at: "2026-10-05T02:48:07+08:00"
completed_at: "2026-10-05T02:48:07+08:00"
target_version: next
depends_on: []
related:
  - "PLAN-037（本研究服務的計劃）/ D131"
  - "PLAN-036（headless handler 層；T0405 git 上遠端依賴本 PLAN）"
  - "PLAN-035（WSL 全自動化精靈）"
  - "T0386 回報區 §4（claude runtime / auth 現況）"
affects_files:
  - _ct-workorders/T0407-research-remote-ai-toolchain.md
interaction:
  mode_hint: on
  interactive: true
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **研究單不改產品程式碼**。只寫本工單回報區。"
  - "🔴 遠端實測只做**唯讀偵測**（`command -v`、`--version`、`cat /etc/os-release`、`sudo -n true` 之類）；**不得在 WSL / 任何遠端實際安裝或移除套件**，不得 restart `bat-server.service`，不得對 `~/.local/bat-server` 寫入。"
  - "🔴 不得把任何 token / credential 內容寫進回報區（只記「存在 / 不存在」）。"
  - "🔴 T0401 平行在改 `electron/` / `src/`：本單只讀。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）。不 push。"
---

# T0407 — 研究：遠端 AI 工具套件檢查與一鍵安裝

## 元資料
- **工單編號**：T0407
- **任務名稱**：研究：遠端 AI 工具套件
- **狀態**：DONE
- **類型**：research
- **互動模式**：enabled（每次提問 ≤ 3 題，選項式 + 「其他」兜底）
- **intervention_type**：context-dependent
- **affects_files**：只寫本工單
- **建立時間**：2026-10-05 02:28 (UTC+8)

## 研究目標

使用者已裁決（D131）：做「**檢查＋一鍵安裝**」——偵測遠端各工具的安裝狀態 / 版本 / 登入狀態；缺的工具以按鈕在**遠端終端分頁**打入官方安裝指令（需 sudo 的在分頁內輸入密碼；不需 sudo 的裝到 `~/.local/bin`）；入口為 WSL / SSH 精靈最後一步＋遠端 profile 設定頁。本研究要產出**可直接拆成實作單**的設計。

## 已知資訊

- 遠端功能走 headless bat-server（PLAN-036）：client → `PROXIED_CHANNELS` → headless handler；共用模組在 `electron/handlers/*.ts`（`registerXxxHandlers(register, deps)`），parity / electron-free 守門
- server bundle 已內嵌 claude-code（Agent 面板用 `node_modules/@anthropic-ai/claude-code/bin/claude`），不含 codex；runtime router 可選 system claude（`electron/claude-resolver.ts` 會 fallback 掃 `~/.local/bin`）
- WSL Ubuntu 24.04 實測：無系統 claude、`~/.claude/.credentials.json` 不存在（T0386 §4）；systemd user service 的 PATH 不含 `~/.local/bin`
- 遠端終端分頁已可用（P0）；T0403 起 `pty:create` 回報 `created`
- 精靈：`src/components/setup-wizard/`（WSL / SSH / Docker 三條線；PLAN-035 持續改動中）
- 專案規則：child_process 一律 `execFile` / `spawn` + array args、外部輸入過白名單、必設 timeout（CLAUDE.md）

## 調查範圍與研究指引

1. **工具清單**：至少 claude CLI、codex CLI、git、gh；評估是否納入 node / npm（codex 若走 npm 安裝需要）、ripgrep、uv / python 等 AI agent 常用依賴。每項標「必要 / 建議 / 可選」
2. **官方安裝方式**（以官方文件為準，附來源 URL；查不到官方來源的標「未證實」）：
   - 依平台：Ubuntu / Debian（apt）、Fedora / RHEL（dnf）、Alpine（apk，Docker 常見）、macOS（SSH 目標，brew / 官方 installer）
   - 每項：是否需要 sudo、安裝位置、完整性校驗方式（簽章 / sha256 / apt repo key）、升級方式、與 BAT embedded claude 的關係（避免 BUG-059 類自我更新問題）
3. **偵測**：版本、PATH 可見性（login shell vs systemd service env 差異）、登入狀態（claude / codex / gh 各自的判斷方式，只判斷存在與否）、套件管理器與 sudo 可用性（`sudo -n true`）。以 WSL Ubuntu-24.04 唯讀實測
4. **執行模型**：偵測走新的 headless channel（命名、parity 分類）還是在終端分頁跑腳本？安裝一律走「在遠端終端分頁打入指令」——指令如何組（避免 shell injection；使用者可見、可中止）、如何得知完成並重新偵測
5. **UI 整合**：精靈最後一步與設定頁的共用元件；與 PLAN-035 精靈改動的檔案邊界；i18n
6. **安全**：不自動執行 `curl | sh` 而不顯示內容？（評估：顯示指令讓使用者確認 vs 直接打入）；來源 pin；不把 server token 暴露給安裝腳本
7. **拆單**：工單清單（標題 / sizing / affects_files / 依賴 / 可否與 PLAN-036 T0401-T0406 平行，**特別標出與 `main.ts` / `protocol.ts` / `headless-entry.ts` 的檔案鎖衝突**）

## 互動規則
- 可主動向使用者提問以縮小範圍；每次 ≤ 3 題；每題提供選項 + 「其他：________」
- 互動紀錄寫入回報區

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE —— 7 項調查範圍全部有結論；使用者已裁決 3 個設計分歧點（Q1-Q3）；建議工單 7 張，已標出檔案鎖。

**落點檢查**：PASS
- C-0：frontmatter `repo: better-agent-terminal` == `basename(REPO_ROOT)` `better-agent-terminal`
- C-1：工單位於 REPO_ROOT 之下
- C-3：不適用（`affects_files` 只有本工單）
- C-2：工單未指定 branch；實際在 `main`
- `BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅作紀錄）
- 執行環境：`CT_MODE=on`、`CT_INTERACTIVE=1`

**本單遵守的限制**
- 沒有改任何產品程式碼。
- WSL 只做唯讀偵測：`command -v`、`--version`、`cat /etc/os-release`、`sudo -n true`、`sudo -n -l`、`systemctl --user cat` / `show`、讀 `/proc/<pid>/environ` 的 PATH / HOME / SHELL、`[ -e ]` 檢查檔案是否存在。
- 沒有安裝或移除任何套件，沒有 restart `bat-server.service`，沒有寫入 `~/.local/bat-server`。
- 沒有讀任何 credential 檔的內容，也沒有記錄任何 token 值。
- 執行期間 T0401 已 commit（`53efb8e` / `ed1e2ac`）。本單引用的檔案行號以該 HEAD 為準。

### 互動紀錄

| # | 問題 | 選項 | 使用者裁決（2026-10-05 02:30–02:45 間） |
|---|------|------|------------------|
| Q1 | 偵測要在哪裡執行？ | Server 端新模組 / Client 端走傳輸層（仿 arch-detect） / 在終端分頁跑腳本 | **Server 端新模組**：`electron/handlers/remote-tools.ts` + proxied `remote-tools:detect`；本機視窗另以 `remote:detect-tools(profileId)` 開短連線呼叫 |
| Q2 | 按下「安裝」後，指令怎麼送進遠端終端分頁？ | 確認框後自動執行 / 打入但不按 Enter / 直接執行不確認 | **確認框後自動執行**：確認框顯示完整指令、來源 URL、是否需要 sudo、安裝位置；按確認後打入並送 Enter；指令尾端附完成標記，偵測到標記就自動重新偵測 |
| Q3 | 有多種官方來源時，預設安裝策略？ | 使用者空間優先 / 簽章套件庫優先 / 兩種都提供 | **使用者空間優先**：claude、codex（還有 uv）用官方 install.sh，免 sudo，裝到 `~/.local/bin`；git / gh / rg 用發行版套件管理器（gh 走官方簽章 repo） |

### 調查結論

#### §0 WSL Ubuntu-24.04 唯讀實測（2026-10-05 02:30–02:45 間）

| 項目 | 結果 |
|------|------|
| OS / 架構 | `ubuntu 24.04 (ID_LIKE=debian)`、`x86_64`；`/etc/wsl.conf` 設 `systemd=true`，interop 為 enabled |
| 套件管理器 | 只有 `apt-get`（沒有 dnf / yum / apk / brew） |
| sudo | `sudo -n true` → **免密碼通過**。來源是 `/etc/sudoers.d/90-gower-nopasswd`，是使用者自己設的，不是 BAT 寫入（T0266 決策：不要求 NOPASSWD）⇒ 設計**不得假設免密碼** |
| 已安裝 | `git 2.43.0`、`python3 3.12.3`、`curl 8.5.0`、`wget`、`tar` |
| 未安裝（Linux 版） | `claude`、`gh`、`node`、`rg`、`uv`、`unzip`；`~/.local/bin` 目錄不存在 |
| 🔴 Windows interop 遮蔽 | login shell 的 PATH 有 **57 個 `/mnt/*` 項目**。`command -v codex` 會解析到 `/mnt/c/Users/Gower/AppData/Roaming/npm/codex`，`npm` 會解析到 `/mnt/c/nvm4w/nodejs/npm`；`gh.exe`、`claude.exe`、`git.exe` 也都找得到 Windows 版。⇒ 偵測**必須把 `/mnt/<drive>/...` 歸類為 `interop-only`**，否則會誤判成「已安裝」 |
| 登入 shell PATH | 沒有 `~/.local/bin`。原因：`~/.profile:25-26` 只在**登入當下**目錄已存在時才 prepend ⇒ 第一次安裝到 `~/.local/bin` 之後，**舊分頁看不到**，要開新的 login shell |
| server（systemd user）PATH | `bat-server.service` 的 MainPID 環境：`PATH=/usr/local/sbin:...:/snap/bin`，不含 `~/.local/bin`，也不含 `/mnt/*`（不受 interop 污染）。unit 只設 `BAT_PORT` / `BAT_SERVER_PORT` / `BAT_DATA_DIR` / `BAT_SERVER_DATA_DIR` |
| 認證狀態（只看是否存在） | `~/.claude/.credentials.json`、`~/.claude.json`、`~/.codex/auth.json`、`~/.config/gh/hosts.yml` 全部 absent；`ANTHROPIC_API_KEY` / `CLAUDE_CODE_OAUTH_TOKEN` / `OPENAI_API_KEY` / `GH_TOKEN` / `GITHUB_TOKEN` 全部 unset |
| server bundle | `~/.local/bat-server/node_modules/@anthropic-ai/` 有 `claude-code`（`2.1.289`）+ `claude-code-linux-x64` + `claude-agent-sdk(-linux-x64)`；不含 codex。已部署的 `handlers/` 目錄是空的（部署版本早於 T0401） |

#### §1 工具清單與分級

| 工具 | 分級 | 理由 |
|------|------|------|
| `claude`（系統版） | **必要** | Agent 面板用 bundle 內嵌版，不需要系統版；但遠端**終端**裡的 `claude` 與 `claude-cli` preset 走 PATH，WSL 實測沒有。登入狀態存在使用者的 config dir，內嵌版與系統版共用，任一邊登入兩邊都生效 |
| `git` | **必要** | T0405（git / worktree 上遠端）與 Claude Agent 的工具呼叫都依賴它；大多數發行版已預裝 |
| `gh` | 建議 | GitHub 面板 / PR 流程（T0405 的 `github:*`） |
| `codex` | 建議 | 遠端 Codex 面板目前被隱藏（`src/lib/remote-unsupported.ts:10`，headless 沒有 codex manager），所以 v1 只服務終端用途；之後面板上遠端時才會改成依能力顯示 |
| `curl` + `bash` | 前置條件 | 所有 install.sh 都需要。Alpine 預設兩者都沒有，Claude 官方文件要求先 `apk add bash curl` |
| `rg`（ripgrep） | 可選（**musl 上是必要**） | Claude Code 自帶 rg；只有 musl（Alpine）要另外裝，並設定 `USE_BUILTIN_RIPGREP=0` |
| `uv` / `python3` | 可選 | MCP server 常用 `uvx`；python3 多半已預裝 |
| `node` / `npm` | 可選，v1 不提供安裝鈕 | 選定的 claude / codex 安裝方式**都不需要 node**；bat-server 自帶 node runtime，而且不在 PATH 上。只顯示偵測結果（含 interop-only 警示），並附 nodejs.org 的 nvm 指引連結 |

#### §2 官方安裝方式（以官方文件為準）

只列 **v1 實際採用的組合**；其他來源（claude 的 apt/dnf/apk repo、npm、brew cask）作為備註保留，給「兩種都提供」日後擴充用。

| 工具 | 平台 | 指令 | sudo | 位置 | 完整性 | 升級 | 來源 |
|------|------|------|------|------|-------|------|------|
| claude | Linux / macOS / WSL | `curl -fsSL https://claude.ai/install.sh \| bash -s stable` | 否（腳本拒絕在 sudo 下執行，除非 `CLAUDE_INSTALL_ALLOW_SUDO=1`，此點來自讀腳本） | `~/.local/bin/claude` → `~/.local/share/claude/versions/` | 對照 `manifest.json` 驗 sha256。manifest 的 GPG 簽章（指紋 `31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE`，2.1.89 起提供）需另外手動驗 | 自動更新；或 `claude update` | https://code.claude.com/docs/en/setup |
| claude（Alpine 前置） | Alpine 3.19+ | `apk add bash curl libgcc libstdc++ ripgrep`，再設定 `USE_BUILTIN_RIPGREP=0`（settings.json `env`） | root | — | apk 簽章 | — | 同上 §Alpine |
| claude（備註） | apt / dnf / apk | 官方簽章 repo（`downloads.claude.ai/claude-code/{apt,rpm,apk}/stable`） | 是 | 系統 | repo GPG | 跟系統升級，不自動更新 | 同上 §Install with Linux package managers |
| codex | Linux / macOS | `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` | 否 | `~/.local/bin/codex` → `~/.codex/packages/standalone`（可用 `CODEX_INSTALL_DIR` 改）；**腳本會在 shell profile 加 PATH 區塊** | 對照 `codex-package_SHA256SUMS` 驗 sha256，沒有 GPG | 重跑腳本或 `codex update` | https://github.com/openai/codex README（已核實）；install / update 細節來自讀腳本與原始碼 |
| git | Debian / Ubuntu | `sudo apt-get update && sudo apt-get install -y git` | 是 | 系統 | 發行版 repo 簽章 | apt upgrade | https://git-scm.com/install/linux |
| git | Fedora / RHEL | `sudo dnf install -y git` | 是 | 同上 | 同上 | dnf upgrade | 同上 |
| git | Alpine | `apk add git`（非 root 時加 `sudo`） | root | 同上 | 同上 | apk upgrade | 同上 |
| git | macOS | `brew install git`；沒有 brew 時是 `xcode-select --install`，**這是 GUI 對話框，經 SSH 無法完成** ⇒ 只顯示手動指引 | 否 | brew | brew | brew upgrade | https://git-scm.com/install/mac |
| gh | Debian / Ubuntu | 官方 keyring + apt repo 一長串（`cli.github.com/packages`，keyring `githubcli-archive-keyring.gpg`） | 是 | 系統 | repo GPG（指紋 `2C6106201985B60E6C7AC87323F3D4EA75716059`） | apt | https://github.com/cli/cli/blob/trunk/docs/install_linux.md |
| gh | Fedora / RHEL | `dnf config-manager` 加 `https://cli.github.com/packages/rpm/gh-cli.repo`（dnf5 / dnf4 語法不同），再 `sudo dnf install gh` | 是 | 系統 | repo GPG | dnf | 同上 |
| gh | Alpine | `apk add github-cli` | root | 系統 | apk | apk | 同上，但官方頁標為 **Community (Unofficial)** ⇒ UI 要標「非官方維護」 |
| gh | macOS | `brew install gh` | 否 | brew | brew | brew | 同上 |
| rg | apt / dnf / apk / brew | `apt-get install ripgrep` / `dnf install ripgrep`（RHEL 要先開 EPEL） / `apk add ripgrep`（community） / `brew install ripgrep` | 是（brew 除外） | 系統 | repo | — | https://github.com/BurntSushi/ripgrep |
| uv | Linux / macOS | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | 否 | `~/.local/bin` | 腳本內建各平台 sha256 | `uv self update` | https://docs.astral.sh/uv/getting-started/installation/ |
| node（不提供按鈕） | — | nodejs.org 列出 nvm / fnm 等；Ubuntu 24.04 apt 的 `nodejs` 是 18.19.1 | nvm 不需要 sudo | `~/.nvm` | SHASUMS 簽章 | — | https://nodejs.org/en/download |

**登入狀態判斷（只取 exit code，丟棄 stdout）**

| 工具 | 指令 | 判斷 | 備註 |
|------|------|------|------|
| claude | `claude auth status` | 0 = 已登入、1 = 未登入（cli-reference） | JSON 輸出可能含 `email`，probe **丟棄 stdout** |
| codex | `codex login status` | 0 = 已登入、1 = 未登入或錯誤（讀原始碼 `codex-rs/cli/src/login.rs` 得知，文件**未證實**） | API key 會遮罩成前 8 碼 + `***` |
| gh | `gh auth status --hostname github.com` | 認證有問題時回 1；會連網驗證 token ⇒ 要設 timeout，逾時歸類 `unknown` | 🔴 **絕不可用 `gh auth token` 或 `--show-token`**。既有 `github:check-cli`（`main.ts:2325-2368`）用 `gh auth token` 判斷登入，這會把 token 印到 stdout。T0405 把它搬進共用模組時要一併改掉 |
| 後備 | 檔案存在檢查 | `[ -e ~/.claude/.credentials.json ]`、`[ -e ~/.codex/auth.json ]`、`[ -e ~/.config/gh/hosts.yml ]`；環境變數只回報「有 / 沒有設定」 | 只看是否存在，不讀內容 |

**與 BAT 內嵌 claude 的關係（BUG-059 類問題）**
- native installer 的系統 claude 裝在 `~/.local/share/claude`，與內嵌 bundle（`~/.local/bat-server/node_modules/...`）路徑完全分開 ⇒ 自我更新不會動到內嵌版，沒有 BUG-059 的 rename 風險。
- `claudeUpdateGuardEnv('system')` 不注入 `DISABLE_UPDATES`，與這個設計一致。
- ⚠️ **交互作用**：headless PTY 對**所有**終端注入 `DISABLE_AUTOUPDATER=1`（`pty-manager.ts:614`），而且 `ClaudeAgentManager` 對整個 process 也設了（`claude-agent-manager.ts:280`）。結果是在 BAT 遠端終端裡啟動的系統 claude **永遠不會背景自動更新**，只能手動 `claude update`。
  - ⇒ 工具面板要顯示「系統 claude 版本 < `HEALTHY_MIN` 2.1.280」或「可更新」，並提供「更新」按鈕，打入 `claude update`。
- ⚠️ install.sh 下載後會跑 `claude install`，而官方文件說 `DISABLE_UPDATES` 會擋 `claude install`。
  - ⇒ 安裝分頁**必須用 `agentPreset` none**（不要用 `claude-cli*`，它會注入 `DISABLE_UPDATES`）。
  - `DISABLE_AUTOUPDATER` 對 installer 是否有影響**未實測**（本單禁止實際安裝）⇒ 列入實機驗收單。

#### §3 偵測設計

**固定 probe 腳本**
- 是編譯期常數：POSIX sh，**零插值**，沒有任何外部輸入。
- 以 `execFile(shell, [...args, PROBE])` 加 array args 執行，符合 CLAUDE.md 的 child_process 規範。
- 輸出格式：
  - 以 `__BAT_TOOLS_PROBE_V1_BEGIN__` / `_END__` 包起來，中間是 `key=value` 行。
  - 解析端只接受白名單 key；value 只留可列印字元，長度上限 256。
  - 結構化結果是 `RemoteToolsReport`（`schemaVersion: 1`）。

**兩個視角，兩者都回報**
1. **login 視角**（使用者在終端看到的）：`execFile(loginShell, ['-l', '-i', '-c', PROBE], { timeout: 20000, stdin 給 /dev/null })`。
   - 要用 `-i`，因為遠端 PTY 是 `-l -i`（`pty-manager.ts:561-567`）；nvm 等工具只在 `.bashrc` 加 PATH，codex installer 也寫 profile。
   - `loginShell` 沿用遠端 PTY 解析 shell 的同一邏輯。
   - 路徑要過 `/^\/[A-Za-z0-9._\/-]+$/`，basename 要在 `{bash, zsh, sh, dash, ksh}` 之內，否則退回 `/bin/sh -l`。
   - `-i` 在沒有 tty 時 stderr 會出現 job control 警告，靠標記解析就不受影響。
2. **server 視角**（headless handler 之後 execFile 看得到的）：`execFile('/bin/sh', ['-c', PROBE_PATH_ONLY])`，只回報每個工具在 server PATH 上**是否可見**。
   - WSL 實測：`~/.local/bin` 在 server 視角看不到。

**每個工具**
- `command -v <t>` 取得路徑。
  - WSL 上（判斷依據：`/proc/sys/fs/binfmt_misc/WSLInterop` 存在或有 `$WSL_DISTRO_NAME`），路徑符合 `^/mnt/[a-z]/` 就歸 `interop-only`，**不執行**。
  - 再額外掃 `~/.local/bin`、`/usr/local/bin`、`/opt/homebrew/bin`，找出「已安裝但不在 PATH」的情況（對應首次安裝後的舊分頁）。
- 版本：`"$p" --version | head -n1`。有 `timeout` 就用 `timeout 5`；macOS 沒有，就靠整體 execFile timeout。
  - 解析：claude 重用 `claude-resolver.ts:60` 的正規式；codex 重用 `parseCodexVersion`（`codex-runtime-resolver.ts:30`）；git / gh 用 `\d+\.\d+\.\d+`。
- 狀態 enum：`ok | missing | interop-only | not-on-path | too-old | error`。

**登入**
- 照上表只看 exit code；gh 用 `timeout 8`，逾時記 `unknown`。
- 系統 claude 不存在時，面板改用既有的 `claude:auth-status`（內嵌 runtime，`handlers/claude.ts:187-213`，已在 headless 上線）。兩者共用同一個 config dir。

**環境**
- `/etc/os-release` 的 `ID` / `VERSION_ID` / `ID_LIKE`，加上 `uname -s -m`。
- musl：`/lib/libc.musl-*` 或 `ldd --version` 含 musl。
- 套件管理器：依 `apt-get` → `dnf` → `yum` → `apk` → `brew` 的順序找第一個。
- 權限：`id -u` 為 0 ⇒ `root`（**Docker 容器常見：root 而且沒有 sudo 指令，指令要去掉 `sudo` 前綴**）；沒有 `sudo` ⇒ `sudo-missing`；`sudo -n true` 成功 ⇒ `passwordless`，否則 `password-required`。

**可重用的既有程式**
- `claude-resolver.ts` 的版本正規式與 `HEALTHY_MIN`。
- `codex-runtime-resolver.ts` 的 `parseCodexVersion`。
- `arch-detect.ts` 的 `NAME_RE` / timeout 寫法。
- probe 本身另寫，因為要在同一次 shell 呼叫裡取得 login 視角，不能逐工具 spawn。

#### §4 執行模型（Q1 + Q2 裁決落地）

**偵測**
- 新共用模組 `electron/handlers/remote-tools.ts`，匯出 `registerRemoteToolsHandlers(register, deps)`，不 import electron。它註冊 proxied channel `remote-tools:detect`，回傳 `RemoteToolsReport`。
- headless 端：在 `headless-entry.ts:129` 的 `createHeadlessHandlerModules` 加入這個模組。
- Electron 端：在 `main.ts` 也註冊。Windows 主機回 `{ unsupported: 'host-platform' }`；macOS / Linux 本機 profile 可以直接得到本機偵測結果。
- 本機視窗（精靈、設定頁）的 proxied 呼叫不會轉送，所以要新增 local-only 的 `ipcMain.handle('remote:detect-tools', profileId)`：
  - 走 `new RemoteClient()` → connect → `invoke('remote-tools:detect')` → disconnect，與 `remote:test-connection`（`main.ts:2900`）、`remote:list-profiles`（`main.ts:3114`）同一範式。
  - `profileId` 的驗證比照 `remote:detect-arch`（`main.ts:2919-2929`）。
- **舊 server 相容**：還沒重新部署的 server 會回 `No handler for channel: remote-tools:detect`。用既有的 `unsupportedRemoteChannel()`（`src/lib/remote-unsupported.ts:16-33`）辨識，UI 顯示「遠端伺服器版本過舊，請重新部署」。
- **parity 分類**：已在 headless 註冊，所以**不需要**進 `HEADLESS_UNSUPPORTED`。`remote:detect-tools` 只是 `ipcMain.handle`，不是 `register`，不會影響 `proxied-channels-binding.test.ts`。要同步改 `preload.ts` 與 `src/types/electron.d.ts`。
- smoke 腳本加一步 `S10 remote-tools:detect`（`scripts/smoke-remote-headless.mjs`）。

**安裝**
- 安裝分頁一定開在**遠端 profile 視窗**裡。理由：
  - workspace store 是每個視窗各自一份。
  - 要讓使用者在分頁裡輸入 sudo 密碼，看得見、也能 Ctrl+C 中止。
- 從本機視窗（精靈、設定頁）按「安裝」的流程：
  1. 確認框（Q2）。
  2. 呼叫 local-only `remote-tools:request-install({ profileId, toolId, nonce })`。main 把請求暫存在 `pendingInstalls: Map<profileId, Request>`，再沿用 `app:open-new-instance` 的邏輯（`main.ts:3312`）開啟或聚焦該 profile 的視窗。
  3. 遠端視窗連線後，呼叫 local-only `remote-tools:take-pending-install` 取走請求。
  4. 遠端視窗確保有 workspace（新精靈建出來的 profile 可能沒有 workspace，就在遠端 `$HOME` 自動建一個「BAT Tools」），然後 `addTerminal`（`agentPreset` 不設），再用 `createPtyThenLaunch`（`src/lib/pty-replay.ts:77`，`created === true` 才打字），打入「指令 + 完成標記」並送 `\r`。
- 已經在遠端視窗內觸發的安裝，直接在原視窗執行，不經過 main。
- **完成標記**
  - 指令尾端附加 `; printf '\n__BAT_TOOL_DONE_%s_%s__\n' '<nonce>' "$?"`。
  - `nonce` 由 client 端產生，16 hex，符合 `^[0-9a-f]{16}$`。
  - 終端回顯的是 printf 格式字串，**不會**出現「nonce + 數字」的組合，所以不會誤判。
  - 掃描 `pty.onOutput` 時先去掉 ANSI，並處理跨 chunk 拼接。
  - 偵測到標記後：exit code 0 ⇒ 自動 `remote-tools:detect` 並 toast 結果；非 0 ⇒ 保留分頁並顯示「安裝失敗，請看終端輸出」。
  - 不管成功或失敗，都提示「已開啟的舊分頁需重開才會看到 `~/.local/bin`」（§0 的 `~/.profile` 行為）。
- **登入**：「登入」按鈕交給 PLAN-036 **T0402（遠端登入引導）** 共用，不在 PLAN-037 另做一套。PLAN-037 面板只顯示狀態，並呼叫 T0402 提供的動作。

#### §5 UI 整合

- **共用元件** `src/components/remote-tools/RemoteToolsPanel.tsx`，props 為 `{ profileId, host: 'wizard' | 'profile' | 'remote-window' }`。
  - 依「必要 / 建議 / 可選」分組。
  - 每一列顯示：狀態、路徑、版本、登入狀態、server PATH 是否可見。
  - 操作：「重新檢查」「安裝」「更新」（claude）。
  - 另含確認框 `InstallConfirmDialog.tsx`。
- **精靈入口**：在 `SetupWizardShell.tsx` 的**完成區塊**（`:643-647`）渲染這個面板，**不新增 WizardStep**。理由：
  1. `WizardStep` 只能跑 task / input，不能渲染複雜 UI（`wizard-runner.ts:110-138`）。
  2. PLAN-035 Phase 2 的 P2-c（requestConsent + 清單 UI）會改 `wizard-runner.ts` 與 `SetupWizardShell.tsx`。只碰完成區塊，可以把衝突面縮到 Shell 的一小段。
  
  WSL / SSH / Docker 三條線共用 `steps/wsl/done.ts`，Docker 一併顯示（容器常是 root、沒有 sudo，指令會去掉 sudo）。
- **設定頁入口**：放在 `ProfileCard` 的 `expandedExtras`（`profiles/ProfileCard.tsx:30, 168`，在 `ProfilePanel.tsx:559, 657` 使用），只對遠端 profile 顯示。
- **i18n**：新增扁平 namespace `remoteTools.*`，例如 `remoteTools.title`、`remoteTools.tier.{required,recommended,optional}`、`remoteTools.tool.<id>.name`、`remoteTools.status.<enum>`、`remoteTools.confirm.*`、`remoteTools.serverTooOld`。三語都要補，並擴充 `src/locales/__tests__/i18n-completeness.test.ts` 檢查 `remoteTools.*`。

#### §6 安全

- **要不要直接 `curl | sh`**：採 Q2 的「確認框後自動執行」。確認框必須顯示：
  - 完整指令（可複製）
  - 官方文件 URL（可點，用外部瀏覽器開）
  - 腳本 URL，附「檢視腳本內容」連結
  - 是否需要 sudo、安裝位置、完整性機制（例如「installer 對照 manifest 驗 sha256」）
  - 非官方來源的警示（Alpine 的 gh）
  
  不 pin 腳本內容的雜湊：vendor 每次發版都會改腳本，pin 了會一直壞。完整性靠 TLS 加 installer 內建的 sha256 驗證。這點在確認框裡誠實寫出來。
- **來源 pin**
  - 所有 URL 與指令放在 **client 端的常數食譜表**（`src/lib/remote-tools/recipes.ts`），只允許 `claude.ai`、`chatgpt.com`、`astral.sh`、`cli.github.com` 這幾個 host（加測試守門）。
  - **server 回傳的偵測結果只能映射成 enum**（套件管理器、權限、musl、os family），版本、路徑等字串只拿來顯示，**絕不插進指令**。
  - ⇒ 即使 server 被竄改或版本太舊，也無法注入指令。
- **server token**
  - headless PTY 已經把繼承來的 `BAT_*` 全部清掉（`headless-entry.ts:42-53` 的 `isHeadlessScrubbedEnvKey`），而且 headless 永遠不設 `BAT_REMOTE_*`。所以安裝腳本在遠端分頁內**看不到 server token**，這有 `headless-pty.test.ts:197, 281` 守門。
  - 安裝流程不另外傳入任何環境變數。
- **probe 本身**
  - 固定腳本，零插值，有 timeout。
  - 登入檢查丟棄 stdout，不讀 credential 內容。
  - 禁止 `gh auth token` / `--show-token`（加一個測試，掃 probe 常數裡不可以出現這兩個字串）。

### 建議方向

- **推薦**：照 Q1-Q3 裁決實作。
  - 偵測：server 端共用模組，加本機短連線入口。
  - 安裝：一律在遠端 profile 視窗的終端分頁進行；確認框之後自動執行，附完成標記，完成後自動重新偵測。
  - 來源：使用者空間的官方 install.sh 優先，git / gh / rg 走發行版套件管理器。
  - 純邏輯（probe 解析、食譜）先做，不受檔案鎖限制；`main.ts` / `protocol.ts` / `headless-entry.ts` 的接線排進 PLAN-036 的串行波次。
- **備選**：如果要讓 T0405 早一點開工，可以把「跨視窗安裝執行」（下表 E）挪到 T0405 之後。T0405 只依賴**偵測**（知道遠端有沒有 git / gh），不依賴安裝。代價是違反 D131「實作在 T0405 前完成」的字面意思，需要塔台裁決。
- **剩餘風險**
  1. 在遠端 PTY 有 `DISABLE_AUTOUPDATER=1` 的環境下，install.sh / `claude install` 能不能正常完成，**沒有實測**（列入 G）。
  2. `codex login status` 的 exit code 語意只有讀原始碼得到，文件未證實（列入 G）。
  3. 遠端 profile 沒有 workspace 時要自動建 workspace，這個 UX 需要在 E 裡確認。
  4. macOS SSH 目標沒有 brew 時，git 只能給手動指引。
  5. 從 server 視角看，`~/.local/bin` 的工具不可見。T0405 的 git / gh resolver 要比照 `gh-resolver.ts` 掃常見位置，或日後在 systemd unit 加 `Environment=PATH=%h/.local/bin:...`（PLAN-035 範圍）。

### 建議工單清單

> 編號由塔台分配；以下用 A-G 代稱。🔒 = 碰到 D130 定義的串行檔案鎖。

| 代號 | 標題 | sizing | affects_files（主要） | 依賴 | 能否與 PLAN-036 平行 |
|------|------|--------|---------------------|------|-------------------|
| A | remote-tools 偵測核心：固定 probe 腳本 + 輸出解析 + `RemoteToolsReport` 型別 | S-M | `electron/remote-tools/probe-script.ts`、`electron/remote-tools/parse.ts`、`src/types/remote-tools.ts`、`electron/remote-tools/__tests__/*`（fixture：WSL interop、Alpine root 無 sudo、macOS、未裝 / 未登入、gh 逾時） | — | ✅ **現在就能開**，沒有共用檔 |
| C | 安裝食譜 + 完成標記：tool × pkgManager × 權限 × musl → `InstallPlan`；`wrapWithSentinel` / `matchSentinel`；URL host 白名單 | S-M | `src/lib/remote-tools/recipes.ts`、`src/lib/remote-tools/sentinel.ts`、`src/lib/remote-tools/__tests__/*` | A（只依賴型別） | ✅ 可與 A 平行（先約定型別） |
| B | headless 接線：`electron/handlers/remote-tools.ts` + proxied `remote-tools:detect` + 本機 `remote:detect-tools` 短連線 + preload / 型別 + parity / smoke S10；完成後重新部署 WSL server | M | 🔒 `electron/main.ts`、🔒 `electron/remote/protocol.ts`、🔒 `electron/remote/headless-entry.ts`、`electron/handlers/remote-tools.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`electron/remote/__tests__/*`、`scripts/smoke-remote-headless.mjs`（+ test） | A | ❌ 與 **T0404**（headless-entry）、**T0405**（main / headless-entry）、**T0406**（main / protocol / headless-entry）串行。建議排在 T0404 之後、T0405 之前；T0402 若會碰 `main.ts` 也要串行 |
| D | `RemoteToolsPanel` + `InstallConfirmDialog` + i18n（先 mock API 開發） | M | `src/components/remote-tools/*`、`src/styles/*`（新檔為主）、`src/locales/{en,zh-TW,zh-CN}.json`、`src/locales/__tests__/i18n-completeness.test.ts` | A、C | ✅ 只有 locales 是各單共用的熱檔；commit 時用 `--only` 精準分段（L138） |
| E | 跨視窗安裝執行：`remote-tools:request-install` / `take-pending-install` 佇列 + 遠端視窗消化（確保 workspace、建立分頁、`createPtyThenLaunch` + 標記掃描、完成後重新偵測與 toast） | M-L | 🔒 `electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`src/hooks/useRemoteToolInstall.ts`（新）、`src/App.tsx` 或 `src/components/WorkspaceView.tsx` | B、C、D | ❌ `main.ts` 與 T0405 / T0406 串行（備選：挪到 T0405 之後） |
| F | 入口整合：精靈完成區塊 + `ProfileCard.expandedExtras` | S-M | `src/components/setup-wizard/SetupWizardShell.tsx`（只動完成區塊 `:643-647`）、`src/components/ProfilePanel.tsx` | D（E 未完成前，安裝鈕可先隱藏） | ⚠️ 與 PLAN-036 不衝突；與 **PLAN-035 P2-c**（尚未開單，會改 `SetupWizardShell.tsx` / `wizard-runner.ts`）衝突 ⇒ 排在 P2-c 開單之前，或與它串行 |
| G | 實機驗收（第一次允許實際安裝）：WSL Ubuntu-24.04 真的裝 claude / codex / gh / uv | S-M | 只寫工單回報區；可加 Playwright e2e | B、E、F | 驗收重點：① 完成標記 ② 自動重新偵測 ③ 新 login shell 看得到 `~/.local/bin` ④ interop 遮蔽在安裝後被 `~/.local/bin` 蓋過 ⑤ `DISABLE_AUTOUPDATER` 環境下 installer 是否正常 ⑥ `codex login status` 的 exit code ⑦ sudo 需要密碼的情境（用一個沒有 NOPASSWD 的帳號或容器）⑧ Docker root 無 sudo 的容器 |

**建議波次**（接在 D130 之後）：
1. ④ T0402 ∥ T0404 ∥ **A ∥ C**
2. **D**（A、C 完成後；可與 ④ 重疊）
3. **B**（T0404 完成後）
4. **E ∥ F**
5. **G**
6. T0405
7. T0406

**PLAN-037 範圍外的後續**（建議記入 PLAN-036 / PLAN-035）：
- T0405 把 `github:check-cli` 移進共用模組時，把 `gh auth token` 改成 `gh auth status` 的 exit code（避免 token 出現在 stdout）。
- 遠端 Codex 面板的隱藏，改成依偵測結果（能力）決定（需要 headless codex manager DI 之後才有意義）。
- systemd unit / launchd plist 的 PATH 是否加 `~/.local/bin`（PLAN-035）。

### Renew 歷程
無

### 遭遇問題
- Git Bash 呼叫 `wsl.exe` 時，MSYS 會把 Windows 路徑參數轉譯掉，腳本找不到（exit 127）。改用 `MSYS_NO_PATHCONV=1` 加 `/mnt/c/...` 路徑後解決。只影響偵測手法，不影響結論。
- 執行期間 T0401 完成並 commit（`53efb8e`）。調查代理一開始把 T0401 的檔案標成「未 commit」，最後的引用已依 HEAD 校正。
- 所有標「未證實」的項目都已列入 G 的驗收重點：`codex login status` 的 exit code 語意、install.sh 在 `DISABLE_AUTOUPDATER` 下的行為、claude installer 以 root（不是透過 sudo）執行時的行為。

### 回報時間
2026-10-05T02:48:07+08:00
