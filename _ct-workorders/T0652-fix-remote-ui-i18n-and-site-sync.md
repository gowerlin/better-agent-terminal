---
schema_version: 1
schema_kind: workorder
id: T0652
title: "BUG-158：遠端設定畫面的英文字樣改走 i18n、補齊缺的 key、修正 SSH 認證失敗的「帳號密碼」文案；同步網站 `/remote/` 引用的 UI 字樣與指紋段落"
type: bugfix
status: DONE
repo: better-agent-terminal
project: BUG-158
priority: P3
sizing: M
created_at: "2026-10-18T18:44:16+0800"
started_at: "2026-10-18T18:51:34+0800"
updated_at: "2026-10-18T19:12:18+0800"
completed_at: "2026-10-18T19:12:18+0800"
depends_on: [T0649, T0650]
related:
  - "BUG-158（T0646 回報區「給塔台的後續建議」第 6、7 點）；T0650 回報區「偏差」「給塔台：網站 `/remote/` 指紋段落」「後續建議」（需處理的字串、指紋段落建議）；T0649 回報區（若列出需要的新 key）"
  - "網站規則：`_ct-workorders/_spec-site-v2-bat-ct-story.md` § 8（文案與內容規則）；CT 字樣規則 D159 / D165 / D166；預覽伺服器 L164"
affects_files:
  - "src/locales/en.json、src/locales/zh-TW.json、src/locales/zh-CN.json"
  - "src/components/setup-wizard/**（精靈 modal 標題、WSL 發行版選單、WSL1 / systemd 警告、Docker 模式按鈕、error-mapper 文案）"
  - "src/components/profiles/**、src/components/ProfilePanel.tsx（設定卡 tooltip、`Pin expected fingerprint`、`Pinned fingerprint (read-only)`、相關 `title`、`profiles.legacyTargetOsPrompt` banner）"
  - "src/locales/__tests__/**、src/**/__tests__/**（i18n key 一致性測試、受字串影響的既有測試）"
  - "site/remote/index.md、site/remote/wsl.md、site/remote/ssh.md、site/remote/docker.md（只改引用到的 UI 字樣與指紋段落）"
  - _ct-workorders/T0652-fix-remote-ui-i18n-and-site-sync.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 範圍是**遠端設定相關畫面**（WSL / SSH / Docker 精靈、配置面板 / 設定卡 / 編輯連線對話框、遷移 banner）的使用者可見字串，不擴及其他功能的英文字樣（另列清單給塔台）。開工先 grep 這些元件的硬寫字串，列出最終清單（原文 → key → zh-TW / zh-CN / en）寫進回報區；BUG-158 的清單是起點，以實際程式碼為準。"
  - "🔴 不改行為、不改字串以外的邏輯；`data-testid`、程式內部比對用的字串、log 訊息、送進 PTY / 遠端的命令字串一律不動。改字串後若有 e2e / unit test 以文字定位元素，同步更新（改用 role / testid 更好，但不擴大範圍）。"
  - "🔴 SSH 認證失敗文案：BAT 的 SSH 一律 `BatchMode=yes`（`electron/remote/ssh-args.ts` `buildBaseSshArgs`），只能用金鑰 / ssh-agent；文案改成指向金鑰、ssh-agent、`~/.ssh/config`，不得提密碼。三個語系一致。"
  - "🔴 中文用語：繁中介面一律台灣用語（設定、連線、伺服器、憑證、指紋、發行版、容器），簡中照既有 zh-CN 用語；與網站 `/remote/` 的稱呼一致。en 保留原意。"
  - "🔴 **網站同步**（`site/remote/*.md`）：① 網站引用到的 UI 字樣改成修正後的中文字樣（例如 Docker 模式按鈕、「Pin expected fingerprint」、精靈標題）；② 指紋段落（`site/remote/index.md` `#fingerprint`）依 T0650 回報區建議：保留「重跑精靈」為主，加「在編輯連線裡重新釘選」作為另一個做法，並寫明兩點——釘選以**已儲存**的連線資料連線、會接受當下回應的伺服器並送出權杖，只適合確定是自己剛重裝的伺服器；要同時改位址 / 權杖時先儲存再釘選；伺服器資料被刪、權杖也換掉時仍要重跑精靈。③ 若 T0649（BUG-156）已修正 Docker 埠衝突，依 T0649 回報區的「網站 `/remote/docker` 埠衝突段落怎麼改」一併更新（T0649 未修正或回報 FAILED 則不動）。CT 字樣 / 內部編號 / 隱私 grep = 0；`npm run build` 0 錯誤 0 死連結。"
  - "🔴 **Worker 不 push、不改 GitHub 設定**；網站預覽用 `e2e-results/site-preview/serve.mjs` 服務 dist 複本，用完以埠查 PID 結束（L164）。"
  - "🔴 非隔離工單。T0651（codex `--no-daemon`，改 `electron/agent-runtime/**`、`electron/bat-mcp-launch.ts` 等）可能同時進行，不碰它們的檔。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`；產品與網站可分兩個 commit。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
---

# T0652 — 遠端畫面 i18n 與網站同步

## 背景

T0646 改寫網站 `/remote/` 時發現遠端設定相關畫面殘留不少英文字樣、zh-TW 缺 `profiles.legacyTargetOsPrompt`，而且 SSH 認證失敗的中文文案提到「帳號密碼」，但 BAT 無法用密碼登入（BUG-158）。T0650 修 BUG-157 時刻意沒動字串，留下的清單：`Pin expected fingerprint`、`Pinned fingerprint (read-only)`、兩個按鈕 / 欄位 `title`。網站 `/remote/` 目前引用這些英文原字樣，指紋段落只建議重跑精靈。

## 要做的事

1. 盤點遠端設定相關元件的硬寫英文字串與缺的 key，列最終清單。
2. 改走 i18n：三個語系補齊；修正 SSH 認證失敗文案。
3. 測試：既有 i18n key 一致性測試通過（三語系 key 相同）；受影響的測試同步更新；若沒有 key 一致性測試，回報說明，不新增大型測試框架。
4. 網站同步（見 memory_overrides）。
5. 截圖（不入版控）：`e2e-results/t0652/`——可行時以隔離實例拍精靈 / 編輯連線對話框的 zh-TW 畫面；網站 `/remote/` 修改處桌面 1440 淺 / 深色各一張。

## 驗證

- `npm run typecheck` = 0、`npm run typecheck:electron` = 0
- `npm run test:unit` 全綠（回報 passed / files 數）
- `npx vite build` 成功
- `site/` 內 `npm run build`：0 錯誤、0 死連結；CT 字樣 / 內部編號 / 隱私 grep = 0


## 塔台補充（派工前，2026-10-18 18:51，T0649 / T0650 回報後）

1. **加做 Docker 埠錯誤的 i18n**（T0649 回報區第 2、8 節）：新增 `wizard.docker.error.portInUse.{title,body}`（en / zh-TW / zh-CN；`docker-port-unpublished` 可另給 key 或併入，回報說明），並在 error-mapper registry 加 entry `{ id: 'docker-port-in-use', platforms: ['docker'], stepIds: ['start-server'], errorCodes: ['docker-port-in-use'], actions: [retry, cancel] }`（`docker-port-unpublished` 同理）。`error-mapper.test.ts` 要求每個 entry 三語 title / body 齊全。affects_files 加 `src/components/setup-wizard/**` 已涵蓋 error-mapper。
2. **網站 `/remote/docker` 埠段落**（BUG-156 已 FIXED，`99abe9a1`）：照 T0649 回報區第 7 節改——第 66 行改寫為精靈挑埠（9877 起、避開 BAT 伺服器埠、只對 `127.0.0.1` 公開、設定檔記實際埠；Use existing 沿用容器公開的埠，容器須以 `-p 127.0.0.1:<port>:9876` 公開）；刪除「先把 BAT 自己的伺服器埠改掉」warning；「埠已經被占用」改成兩種情況。另把 overview / features 若有「Docker 固定 9876」的敘述一併修正。
3. **網站上線時機**：網站改版要等含 `99abe9a1` / 本單產品修正的預覽版發佈後才 push（舊版仍固定 9876）。Worker 照常 commit、不 push；塔台在發版後才 push 網站。
4. **commit 注意**（T0649 實例）：`git commit --only <檔案>` 會收整個檔案的工作樹內容；若某個檔案同時有 T0651 Worker 未 commit 的 hunk（目前 `electron/main.ts`、`electron/remote/headless-entry.ts`、`electron/agent-runtime/agent-registry.ts`、`electron/bat-mcp-launch.ts`、`src/lib/bat-mcp-launch.ts` 等），不要碰那些檔；本單理應不需要改它們，真的需要時先在工單提問。

## 驗收

- zh-TW 介面的遠端設定畫面不再出現 BUG-158 清單上的英文；SSH 認證失敗文案不提密碼
- 網站 `/remote/` 的 UI 字樣與產品一致；指紋段落含「重新釘選」做法與兩點說明
- 驗證全過；回報區附字串清單、範圍外英文字樣清單（給塔台）、截圖清單、給使用者的網站預覽指令、commit
- 只改 `affects_files`；未 push

## 回報區

### 結果摘要

- 遠端設定相關畫面（配置面板 / 設定卡 / 編輯連線、WSL / SSH / Docker 精靈的提示與警告）的硬寫英文改走 i18n，三語系各補 48 個 key（含 `profiles.legacyTargetOsPrompt` / `selectTargetOs` / `connectionUrlPlaceholder` 三個「程式有呼叫、語系檔沒有」的 key）。
- SSH 認證失敗文案（`wizard.ssh.error.permissionDenied.body`）三語改為指向金鑰、ssh-agent、`~/.ssh/config`，不提密碼。
- 塔台補充 1：error-mapper 新增 `docker-port-in-use`、`docker-port-unpublished` 兩個 entry（`docker-port-unpublished` 另給 key `wizard.docker.error.portUnpublished`：訊息與處理方式不同，未併入）。
- 網站：`/remote/docker` 改成中文按鈕名稱、精靈挑埠、刪掉「先把 BAT 自己的伺服器埠改掉」warning、埠占用改兩種情況；`/remote/#fingerprint` 加「重新釘選」做法與注意事項。
- 驗證全過；未 push。狀態 FIXED。

### Landing Zone Check

- 結果：PASS（C-3 記 INFO）
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS。`CT_HOME` 未設定（非隔離工單），`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`。
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS。
- C-3：`affects_files` 是帶說明文字的條目（含 `**`、全形頓號），逐條取最近存在的祖先（`src/locales`、`src/components/setup-wizard`、`src/components/profiles`、`src/locales/__tests__`、`site/remote`）皆存在 → present；C-0 已 PASS，僅記錄。
- C-2：無 `branch` 欄位；目前分支 `main`。
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

### 字串清單（原文 → key → zh-TW / zh-CN；en 與原文相同，除非另註）

**配置面板 / 設定卡 / 編輯連線**

| 位置 | 原文 | key | zh-TW | zh-CN |
|---|---|---|---|---|
| `ProfilePanel.tsx` 舊版 banner | This profile has no targetOS — connecting in legacy mode…（`t()` fallback，語系檔原本沒有 key） | `profiles.legacyTargetOsPrompt` | 這個配置沒有設定 targetOS，目前以舊版模式連線（不轉換路徑）。設定 targetOS 後，才會在不同作業系統之間轉換路徑。 | 这个配置没有设置 targetOS，…（同義） |
| 同上 下拉選單 | Select targetOS…（fallback） | `profiles.selectTargetOs` | 選擇 targetOS… | 选择 targetOS… |
| `ProfilePanel.tsx` 新增遠端 指紋欄 placeholder | Expected fingerprint (leave blank for first-time TOFU) | `profiles.fingerprint.expectedPlaceholder` | 預期的憑證指紋（第一次連線留空，連線時自動記下） | 预期的证书指纹（首次连接留空，连接时自动记下） |
| 同上 `title` | Read-only. Click 'Fetch profiles' … 'Pin expected fingerprint' … | `profiles.fingerprint.expectedTitle`（`{{fetch}}` / `{{pin}}` 取自按鈕 key） | 唯讀。按「取得配置」會在第一次連線時記下指紋；既有的配置請在「編輯連線」裡按「重新釘選指紋」。 | 只读。点击“获取配置”…“重新固定指纹”。 |
| `ProfilePanel.tsx` 三個精靈 modal 標題 | Add WSL / Docker / SSH Profile | 沿用 `profiles.addWslProfile` / `addDockerProfile` / `addSshProfile` | 新增 WSL / Docker / SSH 設定檔 | 添加 WSL / Docker / SSH 配置 |
| `EditRemoteProfileModal.tsx` 網址欄 | Paste connection URL (wss://…)（fallback） | `profiles.connectionUrlPlaceholder` | 貼上連線網址（wss://host:port?token=…&fp=…） | 粘贴连接网址（…） |
| 同上 指紋欄 placeholder | Pinned fingerprint (read-only) | `profiles.fingerprint.pinnedPlaceholder` | 已釘選的憑證指紋（唯讀） | 已固定的证书指纹（只读） |
| 同上 指紋欄 `title` | Read-only. Use 'Pin expected fingerprint' below… | `profiles.fingerprint.pinnedTitle` | 唯讀。要向伺服器重新取得，請按下方的「重新釘選指紋」。 | 只读。…“重新固定指纹”。 |
| 同上 按鈕 | Pin expected fingerprint | `profiles.fingerprint.pin` | 重新釘選指紋 | 重新固定指纹 |
| 同上 按鈕 `title` | Fetch current server fingerprint and pin it… | `profiles.fingerprint.pinTitle` | 向伺服器取得目前的憑證指紋並釘選，之後每次連線都以它核對 | 从服务器获取当前的证书指纹并固定，… |
| `ProfileCard.tsx` ↗ / ✎ / ✕ tooltip | Open / Edit / Delete | 沿用 `profiles.switchProfile` / `profiles.rename` / `profiles.deleteProfile`（en 變成 Open Profile / Rename / Delete Profile；✎ 實際是改名） | 開啟配置 / 重新命名 / 刪除配置 | 打开配置 / 重命名 / 删除配置 |
| `ProfileCard.tsx` 類型徽章 | Local / Remote（WSL / Docker / SSH 為產品名，不譯） | `profiles.details.local` / 沿用 `profiles.remote` | 本機 / 遠端 | 本机 / 远程 |
| `AddProfileMenu.tsx` | suggested | `profiles.addMenuSuggested` | 建議 | 推荐 |
| `details/*.tsx` 欄位名 | Type / Local / Updated / Server / Host / Target / Container / Mounts（表頭 Host / Container）/ Distro / Service / Connection / Key / Notice | `profiles.details.{type,local,updated,server,host,target,container,mounts,mountHost,mountContainer,distro,service,connection,key,notice}` | 類型 / 本機 / 更新時間 / 伺服器 / 主機 / 遠端配置 / 容器 / 掛載（本機 / 容器）/ 發行版 / 服務 / 連線 / 金鑰 / 注意 | 类型 / 本机 / 更新时间 / 服务器 / 主机 / 远程配置 / 容器 / 挂载（本机 / 容器）/ 发行版 / 服务 / 连接 / 密钥 / 注意 |
| `RemoteLegacyDetails.tsx` | No targetOS — legacy mode (no path translation). | `profiles.details.legacyNotice` | 沒有設定 targetOS，以舊版模式連線（不轉換路徑）。 | 没有设置 targetOS，… |
| `SshDetails.tsx` | (legacy direct setting ignored) | `profiles.details.legacyDirectIgnored` | （舊版的直連設定已忽略） | （旧版的直连设置已忽略） |

**設定精靈**

| 位置 | 原文 | key | zh-TW | zh-CN |
|---|---|---|---|---|
| `steps/docker/pick-container.ts` 提示標題 / 說明 | Choose Docker container mode / Use an existing container or let BAT create… | `wizard.docker.pickContainer.{title,description}` | 選擇 Docker 容器模式 / 沿用既有的容器，或讓 BAT 建立並管理一個專用的容器。 | 选择 Docker 容器模式 / … |
| 同上 按鈕（經既有 `labelKey`） | Create new / Use existing | `wizard.docker.pickContainer.{new,existing}.label` | 建立新容器 / 沿用既有容器 | 创建新容器 / 沿用已有容器 |
| 同上 選項說明（Shell 目前不顯示 option description，一併翻譯） | BAT creates a new container… / BAT starts an existing container… | `wizard.docker.pickContainer.{new,existing}.description` | （已翻譯） | （已翻译） |
| 同上 警告 | Docker container X already exists and was left untouched; BAT will create Y instead. | `wizard.docker.warning.nameTaken`（日誌 `ctx.logger.info` 保持英文原文） | Docker 容器 X 已經存在，BAT 不會動它，改為建立 Y。 | … |
| `steps/docker/install-server-bundle.ts` 警告 | Existing container X must already contain /opt/bat-server. | `wizard.docker.warning.existingNeedsBundle` | 既有容器 X 裡必須已經有 /opt/bat-server。 | … |
| `steps/wsl/pick-wsl-distro.ts` 提示 | Choose a WSL2 distro / Select the distro where BAT should install… | `wizard.wsl.pickDistro.{title,description}` | 選擇 WSL2 發行版 / 選擇要讓 BAT 安裝遠端伺服器套件的發行版。 | … |
| 同上 WSL1 警告 | BAT only supports WSL2. Run `wsl --set-version <distro> 2`… | `wizard.wsl.warning.wsl1Only` | BAT 只支援 WSL2。請先執行 `wsl --set-version <發行版名稱> 2` 再繼續。 | … |
| `steps/wsl/wsl-systemd-check.ts` | systemd is not enabled. BAT will fall back to a manual `wsl exec`… | `wizard.wsl.warning.systemdDisabled` | 發行版沒有啟用 systemd。BAT 會改用手動的 `wsl exec` 啟動指令。 | … |
| `steps/wsl/write-systemd-unit.ts` | Unable to enable linger automatically: … | `wizard.wsl.warning.lingerFailed` | 無法自動啟用 linger：… | … |
| `steps/wsl/done.ts` | systemd is unavailable; use the fallback command: … | `wizard.shared.warning.systemdFallback` | 無法使用 systemd，請改用備用指令：… | … |
| `steps/ssh/configure-host.ts` 別名選單 | Select SSH host / Pick an alias from ~/.ssh/config to connect to. | `wizard.ssh.pickHost.{title,description}` | 選擇 SSH 主機 / 從 ~/.ssh/config 選一個要連線的別名。 | … |
| 語系檔（既有 key 改文案） | 請檢查 SSH key 是否正確設定，或確認帳號密碼。 | `wizard.ssh.error.permissionDenied.body` | BAT 只能用 SSH 金鑰登入。請確認金鑰已載入 ssh-agent，或已在 ~/.ssh/config 為這台主機設定 IdentityFile；再到終端機執行 `ssh <主機>`，確認不必回答任何提示就能登入。 | （同義）；en：BAT signs in with SSH keys only. Make sure your key is loaded in ssh-agent, or set as IdentityFile … without any prompt. |
| `error-mapper.ts` 新 entry `docker-port-in-use`（retry / cancel，append-raw） | 原本走 fallback「步驟發生錯誤」+ 英文原始訊息 | `wizard.docker.error.portInUse.{title,body}` | BAT 伺服器埠無法使用 / 分「BAT 正在建立的容器 → 重試換埠」「沿用的容器公開在 BAT 自己的伺服器埠 → 改設定或改選建立新容器」兩種 | … |
| `error-mapper.ts` 新 entry `docker-port-unpublished`（retry / cancel，append-raw） | 同上 | `wizard.docker.error.portUnpublished.{title,body}` | 容器沒有公開 BAT 伺服器埠 / 改選「建立新容器」，或以 `-p 127.0.0.1:<埠>:9876` 重新建立容器後重試 | … |

`data-testid`、日誌、命令字串、錯誤 `code`、比對用字串都沒動。en 文字除 ProfileCard 三個 tooltip（改用既有 key）與 SSH 認證失敗內文外，與原文相同。

### 範圍外英文字樣（給塔台，未處理）

1. **精靈 step 丟出的原始錯誤訊息**（沒有 error-mapper entry 時以 fallback 顯示英文原文）：例 `pick-container.ts`「No Docker containers found…」「Docker containers … through … already exist…」、docker `install-server-bundle.ts`「Choose a Docker container before…」「Unable to inspect Docker container…」、`wsl-systemd-check.ts`「Select a WSL distro before checking systemd.」、`pick-wsl-distro.ts`「BAT requires WSL2…」、`write-systemd-unit.ts`「Failed to write BAT systemd unit」、`ssh/start-server.ts`、`detect-env.ts` preflight reason 等。它們同時是日誌與部分測試的比對字串，要逐一建 error-mapper entry 或 key，規模宜另開單。
2. `wizard-runner.ts` 的復原警告「Could not finish cleaning up after "<step.title>"…」「Could not undo "<step.title>"…」（含英文 step title）。
3. `SshDetails.tsx` / `WslDetails.tsx` 的值「systemd (user)」「launchd」「tunnel → localhost:<port>」與 `default`（遠端 profile id），屬技術值，未譯。
4. `ThumbnailBar.tsx` 縮圖列「+」選單的 `suggested`（3 處，非遠端畫面）；本單只改了配置面板的同款標籤，兩處現在不一致。
5. 各 modal 的 `&times;` 關閉鈕沒有 `aria-label`（無障礙，非字串翻譯）。
6. `SetupWizardShell` 不顯示選項的 `description`（`WizardChoiceOption.description`）；Docker 選項說明已翻好，但畫面看不到。

### 驗證

| Lane | 結果 | 證據 |
|---|---|---|
| typecheck | PASS | `npm run typecheck` = 0、`npm run typecheck:electron` = 0 |
| unit | PASS | `npm run test:unit`：**314 files passed、5443 passed、3 skipped**（exit 0）。相關子集（setup-wizard / profiles / components/__tests__ / locales）57 files、761 passed |
| i18n 一致性 | PASS | 既有 `src/locales/__tests__/i18n-completeness.test.ts` 只涵蓋部分命名空間；本單加 T0652 區塊（新 key 三語非空、8 個根節點三語 key 相同、三語 SSH 認證失敗文案含 ssh-agent 且不含 password / 密碼 / 密码）。另以腳本比對三語完整 key 集合：zh-TW / zh-CN 對 en 缺 0、多 0。`error-mapper.test.ts` 既有「每個 entry 三語 title / body」對兩個新 entry 通過 |
| build | PASS | `npx vite build` exit 0 |
| e2e | PASS | `e2e/t0567-dialog-esc.spec.ts`（精靈標題改走 i18n 後同步改 locator）在隔離實例通過 |
| runtime smoke（zh-TW） | PASS（部分） | 隔離實例（語言預設 zh-TW）以暫時腳本拍配置卡片、編輯連線、+ 更多選單、Docker 精靈；Docker 精靈因本機 Docker daemon 未啟動，停在「未偵測到 Docker daemon」，**模式按鈕沒有實機截圖**（由 unit test 與 key 檢查涵蓋）。WSL / SSH 精靈未拍（會安裝伺服器 / 會拍到本機 SSH 別名） |
| 網站 build | PASS | `site/` `npm run build`：build complete、0 錯誤；VitePress 遇死連結即失敗（未設 `ignoreDeadLinks`）→ 0 死連結 |
| 網站 grep | PASS | `site/`（排除 node_modules / dist / cache）grep `T0\d{3}`、`D1\d{2}`、`BUG-\d+`、`PLAN-\d+`、`_ct-workorders`、`CLAUDE.md` = 0；`site/remote/` CT 字樣（skill 名稱 / 塔台指令 / CT 資料路徑）只命中既有網站路由 `../control-tower#agents`；隱私（使用者名、真實 IP、權杖、本機路徑）= 0 |
| 網站 runtime | PASS | 預覽伺服器服務 dist 複本，`/remote/`、`/remote/docker` × 1440 × 淺 / 深：HTTP 200、console error / warning 0、無水平捲動 |
| 預覽伺服器（L164） | PASS | `e2e-results/site-preview/serve.mjs`（重建，見偏差）埠 4179，用完以埠查 PID 40488 結束；之後 4179 無 listener、無 `serve.mjs` / `vitepress` node 程序 |
| 文案校稿 | PASS | `bmad-editorial-review-prose`：採納 3 處（「只對…公開」補主詞、「Docker 無法公開精靈挑好的埠」、「再重新打開編輯連線」），修正後重建網站通過 |

驗證時 HEAD = `e8d69af9`（非隔離工單，工作樹含本單未 commit 的變更）；之後的兩個 commit 只收這些變更，未再改內容。

### 網站改了什麼

- `site/remote/docker.md`：精靈第 2、5 步（按鈕中文名稱、建立新容器時先挑埠）；兩種模式表頭與說明改「建立新容器 / 沿用既有容器」；「連接埠與資料」改為兩種模式各自的埠（9877 起、避開 BAT 伺服器埠、只對 `127.0.0.1`；沿用既有容器須以 `-p 127.0.0.1:<埠>:9876` 公開）；刪除「先把 BAT 自己的伺服器埠改掉」warning；「埠已經被占用」改成「BAT 伺服器埠無法使用」的兩種情況 +「容器沒有公開 BAT 伺服器埠」；升級、公開在所有介面兩處按鈕名稱。
- `site/remote/index.md` `#fingerprint`：保留重跑精靈為主，新增「WSL 與 Docker 可在編輯連線裡重新釘選指紋」與四點注意（以已儲存資料連線、不核對指紋、會送出權杖，只用於確定是自己剛重裝的伺服器；未儲存的修改不會用上，先儲存再重新打開；資料被刪、權杖換掉仍要重跑精靈；SSH 請重跑精靈）。
- `site/remote/wsl.md`、`site/remote/ssh.md`：引用的字樣（「新增 WSL / SSH 設定檔」、步驟名稱、SSH 只能用金鑰）與修正後的產品一致，未修改。
- overview / features 沒有「Docker 固定 9876」的敘述（grep `9876` 只命中 docker.md），未修改。
- 依塔台補充 3：網站 commit 不 push，等含 `99abe9a1` 與本單的預覽版發佈後由塔台 push。

### 截圖清單（`e2e-results/t0652/`，不入版控）

- 產品（隔離實例，zh-TW）：`profiles-card-zh-TW.png`（徽章、舊版 targetOS 提示、細節欄位）、`edit-connection-zh-TW.png`（重新釘選指紋按鈕、指紋欄）、`add-menu-zh-TW.png`、`docker-wizard-zh-TW.png`（精靈標題；停在 Docker daemon 未啟動）
- 網站（1440，淺 / 深各一）：`remote-index-fingerprint-1440-{light,dark}.png`、`remote-docker-wizard-1440-{light,dark}.png`、`remote-docker-port-data-1440-{light,dark}.png`、`remote-docker-port-in-use-1440-{light,dark}.png`。網站截圖在文案校稿之前拍，校稿改的 3 處字詞沒有反映在截圖上。
- 腳本：`e2e-results/t0652/shoot.mjs`（網站）；產品截圖用的暫時 Playwright spec 跑完已刪除。

### 給使用者的網站預覽指令

```bash
cd site
npm ci
npm run build
npx vitepress preview --port 4173
# 開 http://localhost:4173/better-agent-terminal/remote/docker 與 /remote/#fingerprint ，看完按 Ctrl+C 結束
```

### Commit

- `15a792d4` fix(i18n): translate remote setup screens and fix the SSH auth-failed copy (T0652, BUG-158)（26 檔：語系、元件、精靈 step、error-mapper、測試、`e2e/t0567-dialog-esc.spec.ts`）
- `8347b3d4` docs(site): remote pages follow the translated UI, Docker port pick, re-pin fingerprint (T0652, BUG-158)（`site/remote/docker.md`、`site/remote/index.md`）
- 工單檔另一個 commit。皆用 `git commit --only`；`src/styles/settings.css` 未碰。未 push。

### 遭遇問題 / 偏差

- 🔴 **`e2e-results/` 被 Playwright 清空**：`playwright.config.ts` 的 `outputDir` 是 `e2e-results`，Playwright 每次執行會清空它。本單跑 e2e（t0567 + 截圖 spec）時，原有的 `e2e-results/site-preview/`（`serve.mjs`、`dist-copy`）與其他工單留下的截圖目錄（例如 T0646 的 `site-w2c/`）一併被刪除；不在版控，無法復原。`site-preview/serve.mjs` 已重建（服務 `dist-copy`，預設埠 4179）。建議往後要保留的預覽工具 / 截圖放在 `outputDir` 以外，或把 Playwright `outputDir` 改到子目錄。
- `e2e/t0567-dialog-esc.spec.ts` 不在 `affects_files`：它以英文 `'Add SSH Profile'` 找精靈標題，改走 i18n 後在 zh-TW 會找不到，依 memory_overrides「以文字定位的 e2e 同步更新」改成同檔既有的三語 regex `ADD_SSH`，實跑通過。
- 範圍判斷：除 BUG-158 清單外，另納入同畫面的設定卡細節欄位、類型徽章 Local / Remote、`suggested`、SSH 別名選單、Docker 容器警告、linger / systemd fallback 警告；精靈 step 的原始錯誤訊息列為範圍外（上方第 1 點）。
- ProfileCard 三個 tooltip 改用既有 key，en 文字由 Open / Edit / Delete 變成 Open Profile / Rename / Delete Profile（✎ 實際是改名，原文「Edit」與行為不符）。
- `details/*.tsx`、`steps/wsl/done.ts`、`steps/wsl/wsl-systemd-check.ts` 工作區原為 CRLF（index 為 LF），寫回時統一 LF，diff 只含實際修改。
- `wizard-rollback-ownership.test.ts` 加 `import '../../../i18n'`（警告改走 i18next，沒載入 i18n 的測試檔會拿到 undefined）。

### 給塔台：後續建議

1. **SSH 設定的「重新釘選指紋」會連本機的埠**（產品問題，未改）：`handlePinFingerprint`（`src/components/ProfilePanel.tsx`）以 `remoteHost:remotePort` 直接呼叫 `remote:test-connection`，不經 SSH 通道；SSH 設定的 `remoteHost` 是 `localhost`、`remotePort` 是主機上伺服器的埠。通常只是連不上，但若本機剛好有別的 BAT 伺服器聽在同一埠（例如 WSL 伺服器 9877 起，或本機 BAT 自己的伺服器），會把它的指紋釘進 SSH 設定，並把 SSH 設定的權杖送給它。建議 SSH 設定停用該按鈕或改走通道。網站已寫「SSH 的設定請重跑設定精靈」。
2. `docker-port-unpublished` 的動作照塔台指示用 retry / cancel；使用者得先自行重建容器或改選建立新容器，之後可考慮加 `edit-config` 回到「選擇 Docker 容器模式」。
3. 範圍外英文字樣清單（上方）可另開 i18n 批次。

### 互動紀錄

無（yolo，未向塔台提問）。
