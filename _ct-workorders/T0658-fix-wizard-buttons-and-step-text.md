---
schema_version: 1
schema_kind: workorder
id: T0658
title: "BUG-163：設定精靈的選項按鈕 / 輸入框改用 App 既有樣式（不靠 Tailwind）；更正 WSL / SSH / Docker 步驟說明；修完重拍網站的 3 張精靈截圖"
type: bugfix
status: FIXED
repo: better-agent-terminal
project: BUG-163
priority: P2
sizing: M
created_at: "2026-10-18T19:47:34+0800"
started_at: "2026-10-18T19:49:08+0800"
updated_at: "2026-10-18T19:59:45+0800"
completed_at: "2026-10-18T19:59:45+0800"
depends_on: [T0656]
related:
  - "BUG-163；T0656 回報區（`e2e/site-media.spec.ts` 手動執行方式、`e2e-media/` 輸出、stub 精靈資料）；T0652 / BUG-158（精靈 i18n key）；T0646 / T0653（精靈實際步驟與行為的程式碼出處）"
affects_files:
  - "src/components/setup-wizard/SetupWizardShell.tsx"
  - "src/components/setup-wizard/**（只在步驟說明 / 標籤的來源在 step 定義時）"
  - "src/styles/**（新增 / 沿用精靈用的 class；🔴 `src/styles/settings.css` 已有使用者未提交的變更，**不得改這個檔**，需要樣式請放別的檔）"
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json（步驟說明）"
  - "src/components/setup-wizard/__tests__/**、src/locales/__tests__/**（受影響的測試）"
  - "site/public/media/wizard-wsl.png、site/public/media/wizard-ssh.png、site/public/media/wizard-docker.png（重拍後替換）"
  - "e2e/site-media.spec.ts（只在重拍需要微調時）"
  - _ct-workorders/T0658-fix-wizard-buttons-and-step-text.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 樣式：先查 App 其他對話框 / 設定頁現有的按鈕與輸入框 class（例如 ModalOverlay 底下的對話框、Settings 的按鈕），沿用既有 class 或 CSS 變數；**不要引入 Tailwind 或任何新 npm 依賴**。`SetupWizardShell.tsx` 裡所有 Tailwind 寫法（不只按鈕）都要檢查，實際沒作用的一併換掉，列在回報區。深色 / 淺色主題（若 App 支援）都要看。"
  - "🔴 步驟說明：WSL / SSH / Docker 三個精靈的步驟標題與說明逐一對照實際行為（T0653 已更新的 `docs/*-deployment.md` 與程式碼），改成使用者看得懂的文字、不含內部用語（`BAT_AUTH_OK`、probe 等）；三語一致；`data-testid`、step id、日誌、比對字串不動。受影響的 e2e locator 只改檔、不跑（見下）。"
  - "🔴 重拍：修完後 `npx vite build`，再 `BAT_SITE_MEDIA=1 npx playwright test e2e/site-media.spec.ts`（PowerShell：`$env:BAT_SITE_MEDIA='1'; npx playwright test e2e/site-media.spec.ts`），從 `e2e-media/` 取 3 張精靈截圖替換 `site/public/media/wizard-*.png`；其他素材**不替換**（範圍外）。🔴 只准跑 `e2e/site-media.spec.ts` 這一支；跑之前確認沒有其他 Worker 正在跑 Playwright。隔離實例不得改 `USERPROFILE` / `HOME`（T0656：會讓 Electron 取不到 userData）。重拍的 3 張逐張過隱私清單（T0622 § 3-3），回報附檢查表與大小。"
  - "🔴 非隔離工單。T0657（`electron/**` blocked-state、`scripts/bat-hook.mjs`）與 W4 工單（`site/.vitepress/config.mts`、`site/public/og*`、`.github/workflows/pages.yml`）可能同時進行，不碰它們的檔；`npx vite build` 會帶入 T0657 未提交的 electron 變更，只影響截圖用的產物，回報註明拍攝時的 HEAD。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。不 push。"
---

# T0658 — 精靈按鈕樣式與步驟說明

## 背景

T0656 拍網站截圖時發現：設定精靈的選項按鈕（WSL 發行版、SSH 主機、Docker 容器模式）寫的是 Tailwind class，但 App 沒有載入 Tailwind，實際顯示成白底原生按鈕；步驟說明也過時（SSH 第一步寫要選帳號、port、金鑰、安裝路徑，其實只問主機；第二步寫「執行 BAT_AUTH_OK probe」）。網站 `/remote/` 三頁的精靈截圖因此也拍到這個樣子。詳見 BUG-163。

## 要做的事

1. 盤點 `SetupWizardShell.tsx` 中沒作用的 Tailwind 寫法，改用 App 既有樣式。
2. 更正三個精靈的步驟說明（三語）。
3. 測試：受影響的 unit test 更新；新增至少一個斷言確認選項按鈕不再只有 Tailwind class（或使用了指定的既有 class）。
4. 重拍 3 張精靈截圖並替換網站素材。
5. 截圖（不入版控）：精靈第一步 WSL / SSH / Docker 各一張（修正後），放 `e2e-media/` 或 scratchpad。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數）
- `npx vite build` 成功
- `site/` `npm run build` 0 錯誤 0 死連結

## 驗收

- 精靈按鈕 / 輸入框與 App 一致；步驟說明正確、無內部用語
- 網站 3 張精靈截圖已換成修正後的畫面，隱私檢查通過
- 回報區附：Tailwind 寫法清單與替換、步驟說明前後對照（三語）、隱私檢查表、commit
- 只改 `affects_files`；未 push

---

## 回報區

### 結果摘要

**FIXED**。`SetupWizardShell.tsx` 的 52 個 `className` 字串中 46 個含 Tailwind 寫法（App 未載入 Tailwind，全部沒作用），已全數換掉：按鈕 / 輸入框改用 Profiles 面板既有的 `.profile-action-btn`（`primary` / `danger`）與 `.profile-name-input`（`src/styles/settings.css`，未修改該檔），其餘改用 `src/styles/setup-wizard.css` 新增的 `.bat-wizard-*` class（App CSS 變數 + Stepper 狀態色 `status-preset.ts`）。WSL / SSH / Docker 三個精靈的步驟說明（21 個 key × 三語）對照 `docs/*-deployment.md` 與程式碼改寫，移除 `BAT_AUTH_OK`、probe、TOFU、ssh+tar、plist、healthy、bind mounts 等內部用語。重拍 3 張精靈截圖並替換 `site/public/media/wizard-*.png`。

### 落地檢查

- **PASS**。C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）。C-1 PASS。C-3：`src/components/setup-wizard/SetupWizardShell.tsx` 等皆存在（資訊性）。C-2 無 `branch` 欄位。
- `CT_HOME` 未設定（非 worktree）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

### Tailwind 寫法清單與替換（`SetupWizardShell.tsx`）

| 位置 | 原寫法（皆無作用） | 替換 |
|---|---|---|
| 外框 `<section>` | `rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-100 shadow-lg` | 移除，只留 `bat-wizard-shell`（外層 `.settings-body` 已有 padding；原本實際就沒有框線，維持現狀） |
| 標頭 / 標題 / 進度文字 | `mb-4 flex items-center justify-between gap-4`、`text-lg font-semibold`、`text-sm text-neutral-400` | `bat-wizard-header` / `bat-wizard-title` / `bat-wizard-progress-text` |
| 進度條 | `h-2 w-40 overflow-hidden rounded-full bg-neutral-800`、`h-full bg-emerald-500 transition-all` | `bat-wizard-progress-track` / `bat-wizard-progress-fill`（修正前高度 0、**完全看不到**） |
| 兩欄 grid | `grid grid-cols-1 gap-4 md:grid-cols-[…]` | 移除（`.bat-wizard-grid` 已由 T0311 以 CSS 實作） |
| 詳細區標頭 | `text-xs uppercase tracking-wide text-neutral-500`、`text-base font-semibold text-neutral-100`、`mt-1 text-sm text-neutral-400` | `bat-wizard-detail-kicker` / `-detail-title` / `-detail-description` |
| 等待第一步 / 執行中 / 失敗 / 已跳過文字 | `text-sm text-neutral-400`、`text-sm text-sky-300`、`mt-2 text-sm text-rose-300`、`mt-2 text-sm text-amber-300` | 無 class（`.bat-wizard-detail-empty p`）/ `bat-wizard-running` / `bat-wizard-error-text` / `bat-wizard-skipped-note`（間距由 `.bat-wizard-detail-body > *`） |
| mapped error 標題 / 內文 / 顯示詳情 / raw | `text-sm font-semibold text-rose-200`、`mt-1 text-sm text-rose-100`、`mt-2 text-xs text-rose-300 underline`、`mt-2 whitespace-pre-wrap rounded border border-rose-900/60 bg-rose-950/40 p-2 text-xs text-rose-200` | `bat-wizard-mapped-error-title` / `-mapped-error-body` / `bat-wizard-link-btn` / `bat-wizard-mapped-error-raw`（`.bat-wizard-mapped-error` 外框新增樣式，比照 Stepper 錯誤訊息；原本另有 `mt-2`） |
| action notice | 依 tone 切 `text-rose-300` / `text-emerald-300` / `text-sky-300` + `mt-2 text-sm` | 單一 `bat-wizard-action-notice`，顏色由既有 `data-tone` 屬性選擇器 |
| 選項提示框 / 文字輸入表單 | `mt-3 rounded-lg border border-sky-700 bg-sky-950/40 p-4`、`font-medium text-sky-100`、`mt-1 text-sm text-sky-200`、`mt-3 flex flex-wrap gap-2` | `bat-wizard-prompt` / `-prompt-title` / `-prompt-description` / `bat-wizard-actions` |
| **選項按鈕**（WSL 發行版、SSH 主機、Docker 模式）與「跳過」 | `rounded-md border border-sky-600 px-3 py-2 text-sm text-sky-100 transition hover:bg-sky-900`、`rounded-md border border-neutral-700 … hover:bg-neutral-800` | **`profile-action-btn`**（+ 無樣式標記 `bat-wizard-choice`） |
| 文字輸入框 | `mt-3 w-full rounded-md border border-sky-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100` | **`profile-name-input`** + `bat-wizard-text-input`（寬 100%、上距） |
| 送出 / 取消、返回目前步驟 | `rounded-md border … hover:bg-*`（外層 `mt-3`） | **`profile-action-btn primary`** / **`profile-action-btn`**（外層 `bat-wizard-actions`） |
| 欄位錯誤 | `mt-2 text-sm text-rose-300` | `bat-wizard-field-error` |
| 失敗步驟的復原按鈕 | `rounded-md border px-2 py-1 text-xs transition ${tone}`（cancel rose / edit-config amber / open-link・import sky / 其他 neutral） | **`profile-action-btn bat-wizard-action-btn`**，`cancel` 加 **`danger`**；其餘不再分色。外層 `.bat-stepper-failed-actions` 的 `flex flex-wrap gap-2` 也移除（stepper.css 已有） |
| 警告 / 精靈錯誤 / 完成框 | `mt-3 rounded-lg border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-200`、rose、emerald 同型；標頭 `text-xs uppercase tracking-wide text-*-400`；`mt-1` | `bat-wizard-box` + `bat-wizard-warnings` / `-error-box` / `-complete`，標頭 `bat-wizard-box-header` |
| 遠端工具區 | `mt-3` | 移除（`.bat-wizard-remote-tools` 加上距） |

- `data-action-kind` / `data-tone` / `role` / `id`（`bat-wizard-active-prompt`）/ 既有 `bat-wizard-*`、`bat-stepper-*` class 名稱全部保留，e2e locator 不受影響（未改任何 e2e 檔）。
- 主題：App 只有深色主題（`src/styles/base.css` 只定義一組 `:root` 變數，無淺色切換），新樣式全用 `var(--bg-*)` / `var(--text-*)` / `var(--border-color)`；只檢查深色。

### 步驟說明前後對照（三語，`原 → **新**`）

| key | en / zh-TW / zh-CN |
|---|---|
| `wizard.shared.step.detectEnv.description` | Confirm the target runtime is reachable before installing the BAT server. → **Check that WSL or Docker is available on this computer.**<br>確認目標執行環境可連線後再安裝 BAT 伺服器。 → **確認這台電腦上的 WSL 或 Docker 可以使用。**<br>确认目标运行环境可连接后再安装 BAT 服务器。 → **确认这台电脑上的 WSL 或 Docker 可以使用。** |
| `wizard.shared.step.fetchFingerprint.description` | Pin the server's self-signed TLS fingerprint for trust-on-first-use. → **Read the new server's certificate fingerprint and remember it, so later connections trust only this server.**<br>釘選伺服器自簽 TLS 指紋（首次信任原則 TOFU）。 → **讀取新伺服器的憑證指紋並記下來，之後連線只信任這台伺服器。**<br>钉选服务器自签 TLS 指纹（首次信任 TOFU）。 → **读取新服务器的证书指纹并记下来，之后连接只信任这台服务器。** |
| `wizard.shared.step.connectTest.description` | Open a TLS handshake and authenticate against the freshly started server. → **Connect to the new server with its access token and the recorded fingerprint, the same way the saved profile will.**<br>建立 TLS 連線並驗證新啟動的伺服器。 → **用存取權杖與剛記下的指紋連到新伺服器，方式與之後儲存的連線設定相同。**<br>建立 TLS 连接并验证刚启动的服务器。 → **用访问令牌与刚记下的指纹连接新服务器，方式与之后保存的连接配置相同。** |
| `wizard.shared.step.writeProfile.description` | Persist the verified profile so it appears in the profile picker. → **Save the verified profile so it appears in the Profiles panel.**<br>保存已驗證的連線設定，後續可在設定選單看到。 → **儲存已驗證的連線設定，之後可在「配置」面板看到。**<br>保存已验证的连接配置，可在配置选单中查看。 → **保存已验证的连接配置，之后可在「配置」面板中看到。** |
| `wizard.shared.step.done.description` | Wrap up and surface any post-install hints. → **Finish and list any notes collected during setup.**<br>收尾並顯示安裝後提示。 → **完成設定，並列出過程中的注意事項。**<br>收尾并显示安装后提示。 → **完成设置，并列出过程中的注意事项。** |
| `wizard.wsl.step.pickDistro.description` | Pick a WSL2 distro to host the BAT server. → **Choose the WSL2 distro that will run the BAT server. If there is only one, it is chosen automatically.**<br>挑一個 WSL2 發行版來託管 BAT 伺服器。 → **選擇要執行 BAT 伺服器的 WSL2 發行版；只有一個時會自動選取。**<br>挑一个 WSL2 发行版来托管 BAT 服务器。 → **选择要运行 BAT 服务器的 WSL2 发行版；只有一个时会自动选取。** |
| `wizard.wsl.step.systemdCheck.description` | Confirm systemd is enabled inside the chosen distro (required for service management). → **Check that systemd is enabled in the distro. The BAT server runs as a systemd service; without it a later step fails.**<br>確認所選發行版已啟用 systemd（服務管理必需）。 → **確認發行版已啟用 systemd。BAT 伺服器以 systemd 服務執行，未啟用時後面的步驟會失敗。**<br>确认所选发行版已启用 systemd（服务管理必需）。 → **确认发行版已启用 systemd。BAT 服务器以 systemd 服务运行，未启用时后面的步骤会失败。** |
| `wizard.wsl.step.installBundle.description` | Stream the BAT server bundle into the WSL distro and unpack it. → **Get the BAT server for this BAT version (from the local cache or a download from GitHub) and install it in the distro.**<br>將 BAT 伺服器套件串流進 WSL 並解壓。 → **取得這個 BAT 版本的伺服器套件（本機快取，或從 GitHub 下載），安裝到發行版內。**<br>将 BAT 服务器套件流式传送进 WSL 并解压。 → **获取这个 BAT 版本的服务器套件（本机缓存，或从 GitHub 下载），安装到发行版内。** |
| `wizard.wsl.step.writeSystemdUnit.label` | Write systemd user service → **Set up and start the server service**<br>寫入 systemd 使用者服務 → **設定並啟動伺服器服務**<br>写入 systemd 用户服务 → **配置并启动服务器服务** |
| `wizard.wsl.step.writeSystemdUnit.description` | Install and enable the bat-server systemd user unit. → **Pick a free port, register the BAT server as a user service that starts automatically, and start it.**<br>安裝並啟用 bat-server systemd user unit。 → **挑選可用的 port，把 BAT 伺服器註冊成會自動啟動的使用者服務，並啟動它。**<br>安装并启用 bat-server systemd user unit。 → **挑选可用的端口，把 BAT 服务器注册为会自动启动的用户服务，并启动它。** |
| `wizard.docker.step.pickContainer.description` | Reuse an existing container or create a new one for the BAT server. → **Create a new container for the BAT server, or use your most recent existing container.**<br>重用既有容器或建立新容器來跑 BAT 伺服器。 → **建立新容器來執行 BAT 伺服器，或使用最近建立的既有容器。**<br>重用现有容器或新建容器来运行 BAT 服务器。 → **新建容器来运行 BAT 服务器，或使用最近创建的现有容器。** |
| `wizard.docker.step.configureMounts.label` | Configure bind mounts → **Choose workspace folder**<br>設定 bind mounts → **選擇工作資料夾**<br>配置 bind mounts → **选择工作文件夹** |
| `wizard.docker.step.configureMounts.description` | Map host workspace directories into the container. → **Pick one folder on this computer to share with the container. It appears in the container as /workspace/<folder name>.**<br>將主機工作區目錄掛載進容器。 → **選一個本機資料夾分享給容器，在容器內的路徑是 /workspace/<資料夾名稱>。**<br>将宿主机工作区目录挂载进容器。 → **选一个本机文件夹共享给容器，在容器内的路径是 /workspace/<文件夹名称>。** |
| `wizard.docker.step.installBundle.description` | Confirm the BAT server bundle is present inside the container image. → **The BAT server is already included in the Docker image, so nothing is copied.**<br>確認容器映像中已包含 BAT 伺服器套件。 → **Docker 映像已內含 BAT 伺服器，不需另外複製。**<br>确认容器镜像中已包含 BAT 服务器套件。 → **Docker 镜像已内置 BAT 服务器，不需要另外复制。** |
| `wizard.docker.step.startServer.description` | Launch the container and wait for it to become healthy. → **Create or start the container and wait until it is ready (up to 45 seconds).**<br>啟動容器並等待 healthy 狀態。 → **建立或啟動容器，並等待它就緒（最多 45 秒）。**<br>启动容器并等待 healthy 状态。 → **创建或启动容器，并等待它就绪（最多 45 秒）。** |
| `wizard.ssh.step.configureHost.label` | Configure SSH host → **Choose SSH host**<br>設定 SSH 主機資訊 → **選擇 SSH 主機**<br>配置 SSH 主机信息 → **选择 SSH 主机** |
| `wizard.ssh.step.configureHost.description` | Pick host, user, port, identity, and install path. BAT connects through an SSH tunnel. → **Pick a host from ~/.ssh/config, or enter one by hand. BAT always connects through an SSH tunnel.**<br>選擇主機、帳號、port、金鑰與安裝路徑；BAT 一律透過 SSH 通道連線。 → **從 ~/.ssh/config 選擇主機，或手動輸入；BAT 一律透過 SSH 通道連線。**<br>选择主机、账号、端口、密钥与安装路径；BAT 始终通过 SSH 通道连接。 → **从 ~/.ssh/config 选择主机，或手动输入；BAT 始终通过 SSH 通道连接。** |
| `wizard.ssh.step.verifyAuth.description` | Test BAT_AUTH_OK probe and detect the remote OS / home directory. → **Sign in to the host over SSH and check its operating system and home folder. A host key seen for the first time is accepted automatically.**<br>執行 BAT_AUTH_OK probe 並偵測遠端 OS 與家目錄。 → **以 SSH 登入主機，並確認作業系統與家目錄；第一次連線的主機金鑰會自動接受。**<br>执行 BAT_AUTH_OK probe 并检测远端 OS 与家目录。 → **以 SSH 登录主机，并确认操作系统与家目录；首次连接的主机密钥会自动接受。** |
| `wizard.ssh.step.installBundle.description` | Pipe the BAT server bundle to the remote host over ssh+tar. → **Get the BAT server for the host's platform (from the local cache or a download from GitHub) and install it in ~/.local/bat-server on the host.**<br>透過 ssh+tar pipe 將 BAT 伺服器套件傳到遠端主機。 → **取得符合主機平台的 BAT 伺服器套件（本機快取，或從 GitHub 下載），安裝到主機的 ~/.local/bat-server。**<br>通过 ssh+tar pipe 将 BAT 服务器套件传到远端主机。 → **获取符合主机平台的 BAT 服务器套件（本机缓存，或从 GitHub 下载），安装到主机的 ~/.local/bat-server。** |
| `wizard.ssh.step.startServer.label` | Start bat-server (SSH) → **Start BAT server**<br>啟動 bat-server（SSH） → **啟動 BAT 伺服器**<br>启动 bat-server（SSH） → **启动 BAT 服务器** |
| `wizard.ssh.step.startServer.description` | Install and enable systemd unit (Linux) or launchd plist (macOS). → **Register the BAT server as a user service (systemd on Linux, launchd on macOS) and start it. It listens only on the host itself.**<br>安裝並啟用 systemd unit（Linux）或 launchd plist（macOS）。 → **把 BAT 伺服器註冊成使用者服務（Linux 用 systemd、macOS 用 launchd）並啟動；只在主機本機監聽。**<br>安装并启用 systemd unit（Linux）或 launchd plist（macOS）。 → **把 BAT 服务器注册为用户服务（Linux 用 systemd、macOS 用 launchd）并启动；只在主机本机监听。** |

- 改了 label 的只有 4 個（原 label 不準或是內部用語）：`wsl.writeSystemdUnit`（原「寫入 systemd 使用者服務」，實際還挑 port、啟動、linger）、`docker.configureMounts`（bind mounts）、`ssh.configureHost`（第一步只選主機）、`ssh.startServer`（`bat-server（SSH）`）。其餘 label 不變。
- step id、step `title`（英文 fallback / 日誌用）、錯誤比對字串都沒動。

### 測試

- 更新 `SetupWizardShell.test.tsx` 的 T0334 / T0341 visual contract：原本斷言 Tailwind class（`text-rose-200`、`border-rose-900/60` 等），改斷言新的 `bat-wizard-mapped-error-*` class。
- 新增 `SetupWizardShell.styles.test.tsx`（4 個測試）：選項 / 跳過按鈕是 `profile-action-btn` 且在 `.bat-wizard-prompt` 內；文字輸入框是 `profile-name-input`、送出是 `profile-action-btn primary`；失敗步驟復原按鈕全是 `profile-action-btn`、cancel 帶 `danger`；source guard：`SetupWizardShell.tsx` 所有 `className` 字串不得含 Tailwind 寫法（以同一 regex 對修正前的檔案驗證：52 個字串抓到 46 個）。

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run typecheck` | **0**（PASS） |
| `npm run typecheck:electron` | **0**（PASS） |
| `npm run test:unit` | **PASS**：315 files、5467 passed / 3 skipped。log 中的 `AttachConsole failed`（`@lydell/node-pty` `conpty_console_list_agent.js`）是子程序雜訊，非測試失敗 |
| `npx vite build` | **PASS** |
| `site/` `npm run build` | **PASS**：`build complete`；VitePress 遇死連結即失敗 → 0 錯誤 0 死連結。建置時工作樹含 W4（T0659）當時未提交的 `site/` 變更 |
| `BAT_SITE_MEDIA=1 npx playwright test e2e/site-media.spec.ts` | **PASS**（2 passed，1.1 min）。執行前確認無其他 Playwright 程序（`Win32_Process` 命令列無 `playwright`）；未改 `USERPROFILE` / `HOME`；spec 未修改 |

- 拍攝時 HEAD = `56a9a6ec588128351c29491829d2302a9280cfd4`（工作樹另含本單未提交的變更；當時 T0657 的 electron 變更已提交、W4 的 `site/` 變更未提交，不影響精靈畫面）。

### 截圖與隱私檢查（T0622 § 3-3）

| 檔案 | 尺寸 | 大小 | ① 權杖 | ② 使用者路徑 / 帳號 / 用量 | ③ 私人 repo / 工作區 / 工單 | ④ CT 路徑 / 內容 | ⑤ 未沿用舊 assets |
|---|---|---|---|---|---|---|---|
| `site/public/media/wizard-wsl.png` | 1922×1202 | 187,579 B | ✅ 無 | ✅ 無（狀態列未入鏡） | ✅ 只有 `demo-shop` / `demo-api` / `docs-site`、stub 發行版 `Ubuntu-24.04` / `Debian`、背景虛構 `T1026` | ✅ 只有分頁標題 `Demo Agent · Tower` | ✅ |
| `site/public/media/wizard-ssh.png` | 1922×1202 | 184,946 B | ✅ 無 | ✅ 無 | ✅ stub 別名 `dev-server` / `build-box` | ✅ 同上 | ✅ |
| `site/public/media/wizard-docker.png` | 1922×1202 | 187,999 B | ✅ 無 | ✅ 無 | ✅ 同 WSL | ✅ 同上 | ✅ |

- 不入版控的截圖（「要做的事」第 5 點）：`e2e-media/wizard-wsl.png`、`e2e-media/wizard-ssh.png`、`e2e-media/wizard-docker.png`（gitignored）。WSL / Docker 的第 1 步「偵測目標環境」自動完成，畫面停在第一個需要選擇的第 2 步；SSH 停在第 1 步。`e2e-media/` 其他素材未替換。

### Commit

- 產品：`9d8e1985d093717f56de43348ba6b51c74383d18` — `fix(wizard): app button/input styles, plain step text, new site shots (T0658)`（10 files：`SetupWizardShell.tsx`、2 個測試檔、3 個 locale、`setup-wizard.css`、3 張 png；`git commit --only`）
- 工單：本檔另一個 commit。未 push。未碰 `src/styles/settings.css`（仍是使用者未提交的變更）與 T0657 / T0659 的檔案。

### 遭遇問題

- 無阻斷。

### 後續建議（範圍外，給塔台）

1. `docs/wsl-deployment.md` / `docs/ssh-deployment.md` / `docs/docker-deployment.md` 步驟表的「Label」欄仍是舊 label（已改 4 個：`Write systemd user service` → `Set up and start the server service`、`Configure bind mounts` → `Choose workspace folder`、`Configure SSH host` → `Choose SSH host`、`Start bat-server (SSH)` → `Start BAT server`），不在本單 `affects_files`。另 `docs/wsl-deployment.md` 步驟 3 寫「the wizard then fails at step 8」，依步驟表應是步驟 5（寫入服務），可一併查。
2. `site/remote/ssh.md:37` 截圖 alt 文字寫「目前在設定 SSH 主機資訊」，新畫面標題是「選擇 SSH 主機」（意思仍對，可順手改）；不在本單範圍，且 W4 正在改 `site/`。
3. 失敗步驟復原按鈕原本依 kind 分色（只是沒生效），現在只有 cancel 用 `danger`；若想讓「開啟連結 / 匯入 tarball」更醒目，可再決定是否加 `primary`。

### 互動紀錄

- 無（yolo，未向塔台提問）。
