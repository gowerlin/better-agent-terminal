---
schema_version: 1
schema_kind: workorder
id: T0646
title: "PLAN-049 W2c：「遠端開發」頁（`/remote/`）——overview、WSL、SSH、Docker 四頁，改寫成繁中使用者語氣"
type: feature
status: DONE
started_at: "2026-10-18T18:15:13+08:00"
updated_at: "2026-10-18T18:31:23+08:00"
completed_at: "2026-10-18T18:31:23+08:00"
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T18:13:30+0800"
depends_on: [T0635]
related:
  - "D159（CT 不開源、不提供取得管道）；D160（`docs/` 只取遠端部署指南改寫、不上站原文）；D164（視覺方向）；D165 / D166（CT 字樣規則）"
  - "主規格：`_ct-workorders/_spec-site-v2-bat-ct-story.md` § 6（`/remote/` 另開單）、§ 7（視覺）、§ 8（文案與內容規則）；設計語言 `docs/design/site-design-language.md`"
  - "T0622 回報區 Q3-1（`docs/remote-dev-overview.md` 改寫上「遠端開發」頁、內部編號需清除）、Q3-2 頁面表（`/remote/`：overview、wsl、ssh、docker）"
  - "前例：T0635（`/features`、`/faq` 的 `TODO(W2c)`）、T0638（`/cases`，回報區格式）"
affects_files:
  - "site/remote/index.md（新，overview）"
  - "site/remote/wsl.md（新）"
  - "site/remote/ssh.md（新）"
  - "site/remote/docker.md（新）"
  - "site/.vitepress/config.mts（nav / sidebar：換掉兩處 `TODO(W2c)`）"
  - "site/.vitepress/theme/**（只在既有元件不夠用時新增元件 / 樣式，例如本機 ↔ 遠端架構示意 SVG）"
  - "site/features.md（只把 `TODO(W2c)` 註解處改成連到 `/remote/` 各頁）"
  - "site/faq.md（選做：「遠端開發」節加連到 `/remote/` 的連結，不改既有答案的事實）"
  - _ct-workorders/T0646-site-w2c-remote.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 **`frontend-design`** skill（名稱以 skill 清單為準）；清單裡沒有 → `BLOCKED` 回報。另用 `bmad-editorial-review-prose`（文案校稿）。"
  - "🔴 **來源與事實**：底稿是 `docs/remote-dev-overview.md`、`docs/wsl-deployment.md`、`docs/ssh-deployment.md`、`docs/docker-deployment.md`（英文、2026-10-16 最後更新，含內部編號約 50 處）。這四份**可能落後於目前行為**：每個寫上站的步驟與限制都要對照目前的程式碼或 `docs/agent-guide/`（至少 `remote-security.md`、`multi-remote-profiles.md`、`remote-tower-notify.md`、`packaging-release-checks.md` 的 server bundle 節與 `docs/server-bundle-distribution.md`）。底稿與程式碼衝突時以程式碼為準，並把衝突列進回報區「底稿落後清單」（檔案 + 段落 + 實際行為 + 出處）。**不改 `docs/*.md` 本身**（不在 `affects_files`）。"
  - "🔴 已知必須反映的現況（底稿可能沒寫或寫錯）：安裝檔不內建伺服器套件，第一次設定時從 GitHub `server-bundle-v<版號>` 下載並快取，下載失敗可匯入本機 tarball；同時最多 8 個遠端連線；macOS 只有 Apple Silicon；遠端塔台 / Worker 每個分頁拿自己的範圍權杖（與 `/control-tower` 的『支援的 Agent 與遠端』一致）。逐項以程式碼確認後再寫，確認不了就不寫。"
  - "🔴 **CT 字樣規則（D159 / D165 / D166）**：網站不得出現 CT 文件名、CT 版本號、星號 / 斜線 / 錢字號開頭的指令、skill 名稱、CT 資料路徑、取得管道、委派單編號、規則或決策編號。遠端頁提到 Control Tower 時只寫「遠端那一側也要能執行 Control Tower」這類概念（沿用 `/control-tower` 既有寫法），不寫安裝方式。"
  - "🔴 **隱私**：範例主機名、使用者名稱、IP、路徑、distro / container 名一律用明顯虛構的值（例如 `dev-server`、`you@dev-server`、`192.0.2.10`（RFC 5737 文件用位址）、`demo-shop`）；不得出現真實帳號、真實主機、本機使用者路徑、權杖、憑證指紋實值、上游作者路徑。"
  - "🔴 不得誇大、不得與 BAT 的真實行為衝突：回報區附「主張 → 出處」（出處 = 程式碼檔:函式 / `docs/agent-guide/` 檔名 / README 段落）。不寫未實機驗證的平台承諾（例如 macOS 主機的 SSH 目標若無實測就照底稿的限制寫，不加碼）。"
  - "🔴 **Worker 不 push、不改 GitHub 設定**；只改 `affects_files`；不新增 npm 依賴；`site/` 內 grep `T0\\d{3}`、`D1\\d{2}`、`BUG-\\d+`、`PLAN-\\d+`、`_ct-workorders`、`CLAUDE.md` = 0（include 原文除外）。"
  - "🔴 **預覽伺服器**（L164）：不要用背景 shell 跑 `vitepress preview` 再靠結束 shell 收尾。改用 `e2e-results/site-preview/serve.mjs` 服務 `dist` 的複本，用完以埠查 PID 結束；回報寫明已無殘留程序。"
  - "🔴 非隔離工單。另一張工單 T0647（PLAN-051 研究，唯讀）可能同時進行，它只改自己的工單檔，不碰。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。"
---

# T0646 — 「遠端開發」頁（`/remote/`）

## 目標

PLAN-049 網站 v2 的 W2c。`/features` 已有一節「遠端開發：WSL、SSH、Docker」的摘要，但讀者想真的接上遠端時沒有地方看步驟。本單把 `docs/` 的四份英文部署指南改寫成四頁繁中、使用者語氣的設定指南：先幫讀者選對環境，再一步步帶過設定精靈，最後列常見狀況。

## 頁面結構（可依內容調整並在回報說明）

1. **`/remote/`（overview）**
   - 一句話說明模式：BAT 留在你的電腦，Agent 在遠端環境執行；遠端裝的是同一份 BAT 伺服器套件，連線加密並以憑證指紋確認對象
   - 本機 ↔ 遠端的示意圖（SVG，沿用 D164 的線條語彙，跟著深淺色切換，有文字等價說明）
   - 「該選哪一種」對照（WSL / SSH / Docker：適合情境、需要什麼、限制），窄螢幕改卡片（沿用 `CardTable` 等既有元件）
   - 共通概念：設定精靈做了哪些事、伺服器套件從哪來（下載 / 快取 / 匯入本機檔案）、同時多個遠端、升級與移除、在遠端用塔台與 Worker（連到 `/control-tower#agents`）
2. **`/remote/wsl`、`/remote/ssh`、`/remote/docker`**：各自的前置條件 → 設定精靈步驟 → 連線後能做什麼 → 升級 / 移除 → 常見狀況（底稿的 troubleshooting 改寫，只留使用者會遇到的）
3. 頁尾連到 `/faq#remote`、`/contribute`（遠端問題回報要附什麼）

## 其他要做的事

- `config.mts`：nav 與 sidebar 換掉兩處 `TODO(W2c)`（nav 放「遠端開發」→ `/remote/`，位置照註解；sidebar 加四頁一組），註解移除
- `site/features.md`：`TODO(W2c)` 註解處改成連到 `/remote/` 各頁，移除註解
- （選做）`site/faq.md`「遠端開發」節加一句連到 `/remote/`
- 插圖位置可留 `<!-- TODO(W3): 截圖 -->`（W3 補設定精靈截圖），比照 `/features`

## 驗證

- `bmad-editorial-review-prose` 審四頁；採納 / 不採納列在回報區
- `site/` 內 `npm ci` + `npm run build`：0 錯誤、0 死連結；console 0；手機無整頁水平捲動；reduced-motion 下無動畫
- CT 字樣 grep = 0（網站自己的路由 `/control-tower`、`/control-tower-tour` 除外）＋既有內部編號 grep = 0；隱私 grep（本機使用者名、`tonyqwang`、`gowerlin` 以外的帳號、真實 IP）= 0
- 截圖存 `e2e-results/site-w2c/`（不入版控）：四頁桌面 1440 / 手機 390 × 淺 / 深色（每頁至少一張；overview 每個 h2 一張）
- 預覽伺服器用完已結束（L164）

## 驗收

- `/remote/` 四頁完成，nav / sidebar / `/features` 都連得到；`TODO(W2c)` 全數清除
- 內容對得上目前程式碼；回報區附「主張 → 出處」與「底稿落後清單」
- build 0 錯誤、0 死連結；console 0；手機無水平捲動；CT 字樣 / 內部編號 / 隱私 grep = 0
- 回報區附：截圖清單、文案校稿採納清單、給使用者的預覽指令
- 未 push、未改 GitHub 設定；本機沒有殘留的預覽伺服器

---

## 回報區

### 結果摘要

**DONE**。`/remote/` 四頁（overview、WSL、SSH、Docker）完成，nav / sidebar / `/features` / `/faq` 都連得到，`TODO(W2c)` 全數清除。build 0 錯誤、0 死連結；24 次載入（6 頁 × 1440 / 390 × 淺 / 深）console 0、整頁水平捲動 0、reduced-motion 下執行中動畫 0；CT 字樣 / 內部編號 / 隱私 grep = 0。

內容以程式碼為準（四個唯讀子代理分別對照 WSL / SSH / Docker / 共通行為，我再抽查關鍵點）。四份底稿都有大量落後，最重要的三點已寫進網站：**Docker 精靈需要自己從原始碼建置 `bat-server:latest` 映像**（安裝檔與 GitHub 都沒有發佈）、**SSH 不支援密碼登入且只剩 tunnel 模式**、**WSL 沒有 systemd 就無法完成設定**（底稿說可以 fallback）。

### Landing Zone Check

- PASS。C-0：`repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1：工單在 REPO_ROOT 下；C-3：`site/` 祖先存在（informational）；C-2：工單無 `branch` 欄位。
- `CT_HOME` 未設定（非隔離）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。
- 開工時 `status` 是 `TODO`（不是 `PENDING`），照 `PENDING` 處理改為 `IN_PROGRESS`。

### 修改的檔案

| 檔案 | 內容 |
|---|---|
| `site/remote/index.md`（新） | 總覽：模式說明、`RemoteBridge` 示意圖、「該選哪一種」`CardTable`、設定精靈做了哪些事、伺服器套件從哪來、憑證指紋、同時多個遠端、斷線與重新連線、遠端 AI 工具、升級與移除、在遠端用塔台與 Worker（連 `/control-tower#agents`） |
| `site/remote/wsl.md`（新） | 開始之前 → 設定精靈 9 步 → 連上之後 → 升級 / 移除 → 常見狀況 |
| `site/remote/ssh.md`（新） | 開始之前（含 `~/.ssh/config` 範例）→ 精靈 8 步 → 連上之後 → 升級 / 移除（Linux / macOS）→ 常見狀況 |
| `site/remote/docker.md`（新） | 「需要自己建置映像」警告、準備映像、精靈 9 步、兩種模式對照（`CardTable`）、埠衝突警告、升級 / 移除、常見狀況 |
| `site/.vitepress/theme/components/RemoteBridge.vue`（新） | 本機 ↔ 遠端示意 SVG：沿用 `ContractFlow` 的雷達同心圓 + 十字線；桌面左右排、窄螢幕上下排（兩張 SVG 擇一顯示）；不用紫色（這張圖沒有塔台，錨點 A1）；暖黃只用在分岔點一處；`figcaption.sr-only` 文字等價；靜態 |
| `site/.vitepress/theme/index.ts` | 註冊 `RemoteBridge` |
| `site/.vitepress/theme/custom.css` | `.remote-bridge` / `.rb-*` 樣式（全部用既有 tokens，跟著深淺色）、`.remote-next` |
| `site/.vitepress/config.mts` | nav「遠端開發」→ `/remote/`（「功能」之後，照原註解位置）；sidebar 新增「遠端開發」組（總覽 / WSL / SSH / Docker）；移除兩處 `TODO(W2c)` |
| `site/features.md` | `TODO(W2c)` 註解改成連到 `/remote/` 三頁的一句話，註明 Docker 需自己建置映像 |
| `site/faq.md`（選做） | 「遠端開發」節開頭加一句連到 `/remote/`；既有答案未改 |

頁面結構與工單相同；overview 的「共通概念」拆成多個 h2，方便各頁以錨點連過來（`/remote/#server-bundle`、`#fingerprint`、`#remote-tools`）。插圖位置留 `<!-- TODO(W3): 截圖 -->`。

### 主張 → 出處

| 主張（網站） | 出處 |
|---|---|
| 入口：側欄「配置」→「+ 更多 ▾」→「新增 WSL / Docker / SSH 設定檔」；WSL、Docker 在「容器類」，SSH 在「遠端類」 | `src/components/Sidebar.tsx`、`ProfilePanel.tsx`、`profiles/AddProfileMenu.tsx`；`src/locales/zh-TW.json` `profiles.addWslProfile` 等 |
| WSL 精靈 9 步與步驟名稱 | `src/components/setup-wizard/wsl-flow.ts` `buildWslWizardSteps`、`steps/wsl/*`；zh-TW 步驟 label |
| WSL1 發行版被濾掉；只有一個 WSL2 時自動選 | `steps/wsl/pick-wsl-distro.ts` |
| 沒有 systemd 實際無法完成（拿不到權杖，寫入連線設定失敗並復原） | `steps/wsl/wsl-systemd-check.ts`、`write-profile.ts`（"Remote token missing"）、`wizard-runner.ts` |
| 發行版名稱白名單；不限 Ubuntu / Debian | `electron/wsl-validate.ts` |
| WSL 埠 9877–9976、避開 BAT 自己的伺服器埠、升級沿用原埠 | `electron/wsl-systemd.ts` `pickServerPort` / `pickServerPortForUnit` |
| linger 失敗時的提示與「我已執行命令，重試」 | `error-mapper.ts`；zh-TW `wizard.wsl.error.*` |
| BAT 開著時讓發行版保持執行、不改 `.wslconfig` | `electron/wsl-keepalive.ts`、`main.ts` `syncWslKeepAlive` |
| 新增工作區的資料夾對話框從 `\\wsl.localhost\<發行版>\home\<使用者>` 開始 | `electron/wsl-workspace-folder.ts`、`main.ts` `wslFolderDefaultForSender` |
| 升級：先裝到 `.bat-new`、舊版留在 `.bat-old` 到完成才刪；取消回到原狀；同發行版同埠更新原設定、保留名稱 | `electron/server-bundle-install-script.ts`、`steps/wsl/install-server-bundle.ts`、`write-systemd-unit.ts` rollback、`write-profile.ts` `findExistingProfiles`；`docs/agent-guide/remote-security.md` |
| 刪除設定只刪本機、遠端伺服器還在；沒有一鍵移除 | `electron/profile-manager.ts` `delete`、`main.ts` `profile:delete` |
| SSH 支援 linux-x64 / linux-arm64 / darwin-arm64；不支援 Intel Mac | `src/lib/arch-normalize.ts` `normalizeArch`；`server-bundle-cache.ts` `SERVER_BUNDLE_FILENAME_RE` |
| SSH 只能金鑰 / ssh-agent（`BatchMode=yes`）；新主機金鑰自動接受（`accept-new`） | `electron/remote/ssh-args.ts` `buildBaseSshArgs` |
| 只有 tunnel 模式、伺服器只聽 localhost、本機端埠由系統挑選 | `steps/ssh/configure-host.ts` `normalizeSshTunnelMode`、`ssh-start-server.ts` `serverArgs`、`ssh-tunnel.ts`；`__tests__/ssh-tunnel-only.test.ts` |
| 精靈只問主機；別名來自 `~/.ssh/config` 的 `Host`（不含 `Include`、萬用字元）；跳板機只透過別名 | `steps/ssh/configure-host.ts`、`electron/remote/ssh-config-parser.ts` `listSshHosts`、`ssh-args.ts` |
| SSH 精靈 8 步、安裝路徑 `~/.local/bat-server`、systemd `bat-server` / LaunchAgent `com.bat-server`；macOS LaunchAgent 登入後才啟動 | `ssh-flow.ts` `buildSshWizardSteps`、`steps/ssh/*`、`ssh-start-server.ts` `renderSystemdUnit`（`RunAtLoad`） |
| 「SSH 認證失敗」→「修改 SSH 設定」；「SSH 伺服器不允許 port forwarding」→「已修復，重試」；BAT 不產生金鑰 | `error-mapper.ts`（`ssh-permission-denied`、`ssh-forwarding-denied`）、`steps/ssh/verify-auth.ts`、`verify-remote.ts` |
| SSH 視窗不能附加本機檔案 | `electron/remote/path-translator.ts` `resolveClientPaths`（`ssh-local-file`） |
| SSH 通道連續 5 次重建失敗後停止；狀態「連線中斷」；關窗 15 秒後連線釋放 | `remote-client.ts` `TUNNEL_MAX_RESTART_FAILURES`；zh-TW `profiles.statusReason.linkLost`；`remote-connection-registry.ts` `IDLE_GRACE_MS`；`docs/agent-guide/multi-remote-profiles.md` |
| Docker 不裝套件、用 `bat-server:latest`；映像要從原始碼 `npm run build:docker-image` 建置；linux/amd64、root | `docker-flow.ts` `DEFAULT_IMAGE`、`steps/docker/install-server-bundle.ts`、`docker/Dockerfile`、`scripts/build-docker-image.mjs`、`package.json` |
| Docker 兩種模式（按鈕只有英文 Create new / Use existing）；Use existing 取 `docker ps -a` 第一個；Create new 名稱 `bat-server-profile`、衝突加 `-2` | `steps/docker/pick-container.ts` |
| 只能掛一個資料夾、路徑 `/workspace/<資料夾名稱>`、Use existing 不套用掛載 | `steps/docker/configure-mounts.ts`、`electron/docker-lifecycle.ts` |
| 容器只對 `127.0.0.1` 公開、埠固定 9876、`unless-stopped`、最多等 45 秒 healthy；憑證在 volume | `electron/docker-lifecycle.ts`（`DOCKER_PUBLISH_HOST`）、`docker-flow.ts` `DEFAULT_SERVER_PORT`、`steps/docker/start-server.ts` |
| BAT 自己的伺服器啟動時在 `127.0.0.1:9876` 開，與 Docker 容器的埠衝突；可在「設定 > 進階 > 遠端存取 > 伺服器 Port」改 | `electron/main.ts`（T0129 auto-start、`REMOTE_PORT_DEFAULT`）、`electron/remote/remote-server.ts`（localhost → `127.0.0.1`）、`src/components/SettingsPanel.tsx`、zh-TW `settings.remotePortLabel` / `remotePortSave` |
| 已開的分頁記著舊埠 | `CLAUDE.md`「Logging」節（PTY env 在 spawn 時組裝）；`electron/main.ts` T0129 註解 |
| Docker 取消只動這次建立 / 啟動的容器；精靈每次都新增設定 | `steps/docker/ownership.ts`、`start-server.ts` rollback、`write-profile.ts` |
| 伺服器套件：快取 → 下載 `server-bundle-v<版號>`；「無法下載 BAT 伺服器套件」→「匯入本機 tarball…」；`BAT_SERVER_BUNDLE_BASE_URL` | `electron/remote/server-bundle-distributor.ts`、`server-bundle-cache.ts`、`src/components/setup-wizard/server-bundle-import.ts`；`docs/server-bundle-distribution.md`；`packaging-release-checks.md` server bundle 節 |
| 指紋：精靈記下、每次核對、不符時在送權杖前斷線；「遠端配置未受信任」、「指紋不符」 | `remote-client.ts`、`remote-connect-plan.ts`、`electron/remote/certificate.ts`；zh-TW `remoteProfileFailure.trust`、`profiles.statusProbeError.fingerprintMismatch`；`docs/agent-guide/remote-security.md` |
| 指紋不符時重跑精靈更新同一筆（WSL / SSH） | `steps/wsl/write-profile.ts` `findExistingProfiles` / `updateExistingProfiles` |
| 最多 8 個遠端；「遠端配置已達上限」；15 秒釋放；已開的設定再開會切過去 | `remote-connection-registry.ts`；zh-TW `remoteProfileLimit`；`App.tsx` `handleProfileNewWindow`；`docs/agent-guide/multi-remote-profiles.md` |
| 斷線時操作不執行、不改在本機執行，顯示提示 | `App.tsx`（T0443 toast）；`docs/agent-guide/multi-remote-profiles.md` |
| 遠端 AI 工具：偵測 10 項、可安裝的項目、nvm 免 sudo、musl 限制；在精靈完成時與展開遠端設定時出現 | `src/types/remote-tools.ts`、`src/lib/remote-tools/recipes.ts`、`SetupWizardShell.tsx`、`ProfilePanel.tsx`；`docs/remote-dev-overview.md` nvm 節（與程式碼一致） |
| 遠端 Claude Code 面板可用、Codex 面板不支援遠端視窗；派 Codex Worker 需遠端裝 codex | `RemoteAgentUnavailable.tsx`；`headless-entry.ts` `createHeadlessAgentAvailabilityCheck`（`AGENT_UNAVAILABLE`）；`docs/agent-guide/remote-tower-notify.md` |
| 每個遠端分頁拿自己的權杖，伺服器權杖不進分頁；自動送出需要 BAT 視窗連著，否則回報仍填在塔台輸入列 | `electron/remote/helper-capability.ts`、`headless-entry.ts` `buildHeadlessHelperEnv`；`docs/agent-guide/remote-tower-notify.md`；`site/control-tower.md#agents` |

### 底稿落後清單（`docs/*.md` 未修改）

**`docs/wsl-deployment.md`**

| 段落 | 底稿 | 實際 | 出處 |
|---|---|---|---|
| Prerequisites | Windows 11 22H2 以上（建議 23H2） | 不檢查 Windows 版本；build 22621 只用來解釋 Mirrored 警告 | `electron/wsl-detect.ts` `windowsSupportsMirrored` |
| Prerequisites | 只限 Ubuntu / Debian | 任何名稱合法的 WSL2 發行版 | `electron/wsl-validate.ts` |
| Prerequisites | 套件要先放在 `userData/bat-server-bundles` | 自動下載 / 快取，失敗可匯入 | `server-bundle-distributor.ts` |
| Installation | `Profiles` → `Add WSL Profile` | 「配置」→「+ 更多 ▾」→「新增 WSL 設定檔」 | `ProfilePanel.tsx` |
| Step 2 | 只寫自動選 | 多個時要選 | `pick-wsl-distro.ts` |
| Step 3 | 只看 `systemctl --user` | 另接受 `/etc/wsl.conf` 的 `systemd=true` | `wsl-detect.ts` `systemdEnabled` |
| Step 4 | 網路模式 mirrored / nat / unknown | 另有 virtioproxy / none；用 `wslinfo` + `.wslconfig` 判斷 | `wsl-detect.ts` `detectNetworkMode` |
| Step 5 | linger「可以時」啟用 | linger 失敗會擋下並給恢復按鈕；埠範圍 9877–9976 沒寫 | `write-systemd-unit.ts`、`wsl-systemd.ts` |
| Step 6 | 呼叫 HTTPS fingerprint endpoint | 讀 TLS 握手的憑證 | `steps/wsl/fetch-fingerprint.ts` |
| Troubleshooting | 沒有 systemd 可 fallback 到 `wsl exec` | fallback 一定在寫入連線設定時失敗並復原 | `write-profile.ts` |
| Troubleshooting | 「Profile created but connect-test failed」 | 連線測試在寫設定之前，不會發生 | `wsl-flow.ts` 步驟順序 |
| Rollback | step id `verify-remote-connection` / `create-remote-profile` / `finalize-wsl-setup`；完成前不寫設定 | `connect-test` / `write-profile` / `done`；設定在 `write-profile` 就寫入，取消時刪除或還原 | `wsl-flow.ts`、`write-profile.ts` |
| Editing | ProfileCard 有「Re-run wizard」按鈕、「Pin expected fingerprint」在卡片上 | 沒有重跑按鈕；釘選按鈕在 ⚙「編輯連線」對話框，英文 | `ProfileCard.tsx`、`EditRemoteProfileModal.tsx` |
| Uninstall | 清理指令 | 漏 `.bat-old` / `.bat-new`、`loginctl disable-linger`、Windows 端快取 | `server-bundle-install-script.ts` |
| 全文 | — | 沒寫 keepalive、匯入本機 tarball、`BAT_SERVER_BUNDLE_BASE_URL` | `wsl-keepalive.ts`、`server-bundle-import.ts` |

**`docs/ssh-deployment.md`**

| 段落 | 底稿 | 實際 | 出處 |
|---|---|---|---|
| Prerequisites | BAT v0.0.16+、OpenSSH 8.0+ | 不檢查版本（`accept-new` 需 OpenSSH 7.6+） | `ssh-args.ts` |
| Prerequisites | 可用密碼（互動） | `BatchMode=yes`，密碼不可能 | `ssh-args.ts` `buildBaseSshArgs` |
| Prerequisites | 需要 `bash` | 指令在 `sh` 下執行；另需 `loginctl`、`awk`、`/proc`（Linux）、`lsof`（macOS） | `ssh-start-server.ts` `buildVerifyCommand` |
| Installation | `Profiles` → `Add SSH Profile` | 「配置」→「+ 更多 ▾」→「新增 SSH 設定檔」 | `ProfilePanel.tsx` |
| SSH-config alias | 用 `ssh -G` 列別名；只需選安裝路徑與 tunnel 模式 | 直接讀 `Host` 行；只問主機，安裝路徑固定 | `ssh-config-parser.ts`、`configure-host.ts` |
| Installation 表 | 上傳有速度 / ETA 進度條 | 沒有顯示 | `ssh-bundle-uploader.ts` |
| Tunnel vs Direct | 兩種模式、`ssh -L 9876:localhost:9876` | 只有 tunnel；本機端埠由系統挑 | `configure-host.ts`、`ssh-tunnel.ts` |
| systemd vs launchd | `enable --now`；macOS log `~/Library/Logs/com.bat-server.log` | `enable` + `restart` + 每次 linger；plist 沒設 log 路徑 | `ssh-start-server.ts` |
| Troubleshooting | permission-denied 有 A/B/C 三選項（含金鑰檔選擇器） | 「修改 SSH 設定」/「重試」/「取消」，沒有金鑰檔選擇器 | `error-mapper.ts` |
| Troubleshooting | 埠 51820 | 9876 | `ssh-flow.ts` `DEFAULT_SERVER_PORT` |
| Troubleshooting | 退避 1→2→4→8→16 s、5 次後跳對話框 | 上限 30 s + 抖動；5 次只限通道重建，沒有對話框 | `remote-client.ts` `computeReconnectDelay` |
| Rollback | 一律 `rm -rf`；完成前不寫設定 | 升級時還原 `.bat-old` / `.bat-prev`；設定在第 7 步寫入 | `server-bundle-install-script.ts`、`write-profile.ts` |
| Editing | 有「Re-run wizard」與傳輸模式切換 | 都沒有 | `ProfileCard.tsx` |
| Uninstall | — | 漏資料目錄（`~/.local/share/bat-server`、macOS `~/Library/Application Support/bat-server`）與 `.bat-old` / `.bat-prev` | `ssh-wizard-verify.ts` |

**`docs/docker-deployment.md`**

| 段落 | 底稿 | 實際 | 出處 |
|---|---|---|---|
| Prerequisites | 要切到 `feature/plan-007-remote-dev` 分支 | 過時；但仍需原始碼才能建映像 | `scripts/build-docker-image.mjs` |
| Notes | 「Docker setup wizard integration is tracked separately」 | 精靈已存在 | `docker-flow.ts` |
| Usage Modes | mode A / mode B | UI 只有英文「Create new / Use existing」；Use existing 不能選容器，取 `docker ps -a` 第一個 | `pick-container.ts` |
| Dev Container | 以 mode A 重用精靈建立的容器 | 精靈建立的容器以 `--token` 帶權杖、沒寫 `server-token.json`，Use existing 讀不到權杖；也不套用掛載（程式碼追蹤，未實測） | `docker-lifecycle.ts`、`headless-entry.ts` |
| Rollback | 有 `build-image` / `start-container` 步驟；stop + rm | 沒有建置步驟；`start-server` 只 `rm -f` 這次建立的容器；Use existing 若這次才啟動會停回去 | `steps/docker/start-server.ts`、`ownership.ts` |
| Editing | ProfileCard 顯示 image tag / container id / restart policy、有「Re-run wizard」 | 顯示 Container / Host / Target / Mounts；沒有重跑按鈕；釘選按鈕在「編輯連線」 | `DockerDetails.tsx`、`EditRemoteProfileModal.tsx` |
| Health check | `starting` 約 10 秒 | 精靈最多等 45 秒 | `start-server.ts` |
| Mounts | 多個掛載的表 | 只能一個資料夾、路徑固定 | `configure-mounts.ts` |
| 全文 | — | 沒寫 BAT 自己的伺服器也用 9876、會與容器埠衝突 | `main.ts`、`docker-flow.ts` |

**`docs/remote-dev-overview.md`**

| 段落 | 底稿 | 實際 | 出處 |
|---|---|---|---|
| Troubleshooting › Connection lost | 約 30 秒後跳出「Retry now / Open profile」對話框 | 沒有對話框；狀態燈 + 一次性提示 | `remote-client.ts`、`App.tsx` |
| Troubleshooting › Fingerprint mismatch | 在 profile 上按「Pin expected fingerprint」 | 按鈕在「編輯連線」裡、英文；按完再按「儲存」會把舊指紋寫回去（見後續建議 3） | `EditRemoteProfileModal.tsx`、`ProfilePanel.tsx` `handleSaveRemote` |
| Choosing your deployment | 可依指南乾淨移除 | 沒有移除 UI，刪設定不停伺服器 | `profile-manager.ts` |
| Profile schema migration | 提示重跑精靈 | 英文 banner + targetOS 下拉；zh-TW 缺 `profiles.legacyTargetOsPrompt` | `ProfilePanel.tsx` |
| Remote Tower › Capability scope | 塔台只有 create-agent-command；raw command 一律 Forbidden | 另有 raw command、close-worker、set-role、提問與查詢 | `helper-capability.ts` `HELPER_CHANNEL_ROLES` |
| PathTranslator | SSH 附件會轉換 | SSH 視窗一律拒絕本機檔案 | `path-translator.ts` `resolveClientPaths` |
| TLS | 指向 CLAUDE.md「Remote 資安」 | 細節已搬到 `docs/agent-guide/remote-security.md` | — |
| 相關文件 | `docs/server-bundle-distribution.md` 提到「Upgrade server bundle」按鈕 | 不存在 | — |

### 驗證

| Lane | 結果 | 證據 |
|---|---|---|
| source / docs | PASS | 四頁內容逐項對照程式碼（上表）；`site/` grep `T0\d{3}`、`D1\d{2}`、`BUG-\d+`、`PLAN-\d+`、`_ct-workorders`、`CLAUDE.md`、`TODO(W2c)` = 0 |
| CT 字樣 | PASS | `site/remote/` grep 命令 / skill 名稱 / CT 資料路徑 / 取得管道 = 0；唯一命中是網站路由 `../control-tower#agents` |
| 隱私 | PASS | 範例只有 `dev-server`、`you@dev-server`、`jump-host`、`192.0.2.10`（RFC 5737）、`127.0.0.1`；本機使用者名 / `tonyqwang` / 真實 IP = 0；`gowerlin` 只出現在既有 `faq.md` 的 repo 連結 |
| build | PASS | `site/` `npm ci` + `npm run build`：build complete、0 錯誤、0 死連結（VitePress 預設遇死連結即失敗） |
| runtime smoke | PASS | Playwright（系統 Chrome）載入 `/remote/`、`/remote/wsl`、`/remote/ssh`、`/remote/docker`、`/features#remote-dev`、`/faq#remote` × 1440 / 390 × 淺 / 深 = 24 次：全部 HTTP 200、console error / warning 0、`scrollWidth > clientWidth` 0、reduced-motion 下 `document.getAnimations()` 執行中 0；390 寬時示意圖切到上下排 |
| 文案校稿 | PASS | `bmad-editorial-review-prose`，見下 |
| 預覽伺服器 | PASS | `e2e-results/site-preview/serve.mjs`（本單新建，不入版控）服務 `dist` 複本 `e2e-results/site-preview/dist-copy`，用完以埠 4179 查 PID 10044 結束；之後埠 4179 無 listener、無 `serve.mjs` / `vitepress` 的 node 程序 |

Playwright 自帶的 chromium 版本不符（`chromium_headless_shell-1217` 不存在），改用 `channel: 'chrome'`；未安裝任何東西。

### 截圖清單（`e2e-results/site-w2c/`，不入版控，共 45 張）

- 四頁 + `/features`、`/faq` 整頁：`<頁>-<1440|390>-<light|dark>.png`（`remote-index`、`remote-wsl`、`remote-ssh`、`remote-docker`、`features`、`faq`，24 張）
- overview 每個 h2（1440，淺 / 深）：`remote-index-h2-<choose|wizard|server-bundle|fingerprint|multiple|reconnect|remote-tools|upgrade-remove|tower>-<light|dark>.png`（18 張）
- 示意圖：`remote-index-figure-1440-dark.png`、`remote-index-figure-390-light.png`、`remote-index-figure-390-dark.png`（圖下文字改字之前拍的；改字後的版本在整頁截圖裡）
- 截圖腳本：`e2e-results/site-w2c/shoot.mjs`

### 文案校稿採納清單（`bmad-editorial-review-prose`）

| 原文 | 改為 | 採納 |
|---|---|---|
| 精靈若警告「映像是舊版建置的」… | 精靈若警告容器用的映像建置於網路修正之前… | ✅ 引號內不是 UI 原文 |
| …表示那是別處建立的舊容器。 | …表示那是 BAT 改成只對本機公開之前建立的舊容器。 | ✅ 與精靈說明一致 |
| 預設也是 9876，和容器要用的埠相同，容器會因為… | 預設也是 9876。兩者用同一個埠時，容器會因為… | ✅ 拆句 |
| 會避開 BAT 自己的遠端伺服器用的埠（WSL 頁） | 會避開 BAT 自己的伺服器用的埠 | ✅ 與 Docker 頁用語一致 |
| Worker 做完時自動按下送出 | Worker 做完時要自動送出回報 | ✅ 主詞不明 |
| 「伺服器」與「伺服器套件」混用 | — | ❌ 刻意：Docker 的伺服器在映像裡，不是下載的套件；overview 與示意圖統一用「執行同一個 BAT 伺服器」，「伺服器套件」只用在可下載的 tarball |

### 給使用者的預覽指令

```bash
cd site
npm ci
npm run build
npx vitepress preview --port 4173
# 開 http://localhost:4173/better-agent-terminal/remote/ ，看完按 Ctrl+C 結束
```

### Commit

- 產品：`478d1848` `feat(site): /remote/ remote development guides for WSL, SSH and Docker (T0646)`（10 個檔案，`git commit --only`）
- 工單檔：本次收尾 commit
- 未 push、未改 GitHub 設定；`src/styles/settings.css` 與 T0647 / T0648 工單檔未碰

### 遭遇問題 / 偏差

- 底稿與程式碼差距比預期大（四份都有），網站一律以程式碼為準；Docker 頁因此以「目前需要自己建置伺服器映像」的警告開頭，與工單預想的「一步步帶過精靈」不同。
- 只依程式碼推論、未實機驗證的兩點，網站已保守措辭：Docker「Use existing」接上 Create new 建立的容器時「可能讀不到權杖」；BAT 自己的 9876 與 Docker 容器埠衝突（兩邊程式碼都固定 `127.0.0.1:9876`，衝突是確定的，但沒有實際跑 `docker run` 看錯誤訊息）。
- macOS 主機上的 Docker：程式碼沒有平台限制，但無實測，網站不寫 macOS 可用與否。

### 給塔台的後續建議（範圍外，未處理）

1. **`site/features.md`「遠端開發」節有兩句與程式碼不符**：「附加到 Agent 對話裡的檔案路徑，會自動在 Windows、Linux、macOS 的格式之間轉換」——SSH 視窗一律拒絕本機檔案（`path-translator.ts` `resolveClientPaths`）；「伺服器套件…第一次設定時從 GitHub 下載」不適用 Docker。本單只改 `TODO(W2c)` 那一行，建議另開小單。
2. **Docker 精靈與 BAT 自己的伺服器搶 9876**（產品問題）：`docker-flow.ts` `DEFAULT_SERVER_PORT = 9876` 與 `main.ts` `REMOTE_PORT_DEFAULT = 9876` 都綁 `127.0.0.1`，預設設定下 Create new 應該一定失敗。建議開 BUG：Docker 精靈改用 WSL 的挑埠邏輯（`pickServerPort`）。
3. **指紋重新釘選會被「儲存」蓋回**（產品問題）：`EditRemoteProfileModal` 的「Pin expected fingerprint」立即寫入新指紋，但對話框的 `editRemoteFingerprint` 仍是舊值，按「儲存」會寫回舊指紋（`ProfilePanel.tsx` `handleSaveRemote`），釘選錯誤也被吞掉。網站因此改建議「重跑精靈」。
4. **Docker 映像沒有發佈管道**：一般使用者無法走 Docker 路線；可考慮在 release 附 `bat-server` 映像，或讓精靈把已下載的伺服器套件裝進任意容器。
5. **Docker「Use existing」不能選容器**，且精靈每次都新增設定（不像 WSL / SSH 會更新）。
6. **英文 UI 字樣**：Docker 模式按鈕、WSL 發行版選單、WSL1 / systemd 警告、精靈 modal 標題「Add WSL / SSH Profile」、卡片 tooltip（Open / Edit / Delete）、「Pin expected fingerprint」；zh-TW 缺 `profiles.legacyTargetOsPrompt`。
7. **SSH 認證失敗的 zh-TW 文案提到「帳號密碼」**，但 BAT 無法用密碼登入。
8. 四份 `docs/*.md` 需要依上面的落後清單更新（本單依規定未改）。

### 互動紀錄

無（yolo，未向塔台提問）。
