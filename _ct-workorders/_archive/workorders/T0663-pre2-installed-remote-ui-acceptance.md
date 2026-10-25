---
schema_version: 1
schema_kind: workorder
id: T0663
title: "v0.7.1-pre.2 已安裝版自動化驗收：BUG-157 釘選→儲存、BUG-160 SSH 釘選停用、BUG-158 / 161 中文、BUG-163 精靈樣式"
type: implementation
status: DONE
repo: better-agent-terminal
project: BUG-verify-071pre2
priority: P1
sizing: M
created_at: "2026-10-18T21:30:28+0800"
started_at: "2026-10-18T21:32:24+0800"
updated_at: "2026-10-18T21:47:49+0800"
completed_at: "2026-10-18T21:47:49+0800"
target_version: "0.7.1-pre.2（驗收，不發版）"
related:
  - "BUG-157 / T0650（`5594ec57`）"
  - "BUG-160 / T0655（`02f1c6f8`）"
  - "BUG-158 / T0652（`15a792d4`）"
  - "BUG-161 / T0660（`a5caf04a`）"
  - "BUG-163 / T0658（`9d8e1985`）"
  - "T0520（`e2e/pre7-acceptance.spec.ts`：安裝版 + 隔離實例的做法範本）、T0515（`e2e/real-remote/t0515-*`：容器 sshd）"
  - "T0664（同時進行：BUG-162，另一個 spec 檔）"
affects_files:
  - e2e/v071-pre2-acceptance.spec.ts
  - e2e/real-remote/t0663-*
  - _ct-workorders/T0663-pre2-installed-remote-ui-acceptance.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只寫驗收工具 / opt-in spec，不改產品程式碼**（`electron/**`、`src/**`、`scripts/**`、`package.json`、`e2e/fixtures/**` 不動，`e2e/fixtures/` 只讀 / 只 import）。發現產品缺陷 → 回報區記證據，該項 FAIL、整單 PARTIAL，**不自行修**。BUG 檔與 `_bug-tracker.md` 不動。"
  - "🔴 **受測 build = 已安裝的 pre.2**：`C:/Program Files/BetterAgentTerminal/BetterAgentTerminal.exe`（開工時確認 FileVersion `0.7.1-pre.2`，隔離實例 `app.getVersion()` 也要相符），以 `BAT_E2E_EXECUTABLE` + `e2e/fixtures/electron-isolation.ts` 的 `launchIsolated` 啟動（獨立 `--runtime` / userData、RemoteServer 用空閒埠）。"
  - "🔴 **不碰使用者正在用的 BAT**（port 9876、真實 userData 只讀）；不得連線、停止或改動 WSL 內使用者的 bat-server（port 9877、`~/.local/bat-server`）；WSL 精靈不得執行到會寫入任何發行版的步驟。"
  - "🔴 **不得消耗 Claude token**（不開 Claude 面板 / claude-cli 分頁；必要時沿用 T0514 / T0520 的 recorder 做法）。"
  - "🔴 **Docker / WSL**（若用到容器）：只建立、操作、刪除名稱前綴 `bat-t0663-` 且帶 label `bat.t0663=1` 的容器 / network；不得 prune、不得動其他容器 / image；不得 `wsl --shutdown` / `--terminate`；收尾刪除本單容器 / network。`~/.ssh/config` 若要動，沿用 T0515 / T0520 標記區塊 + SHA-256 還原。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push；不跑全套 `npm run test:e2e`（L141）。commit 用 `git commit --only <本單檔案>`（L168：T0664 同時在跑）。工作樹裡 `src/styles/settings.css` 顯示 M（內容無差異），不要動、不要提交。"
  - "🔴 **證據（截圖 / JSON）不要放在 Playwright `outputDir`（`e2e-results/`）底下**（L169：每次執行會被清空）；放 temp / scratch 目錄，回報區寫絕對路徑。"
---

# T0663 — v0.7.1-pre.2 已安裝版自動化驗收（遠端畫面 / 精靈）

## 背景

`v0.7.1-pre.2`（run `39128867451`，target `9c5fe2b1`）已發佈，使用者本機已安裝（FileVersion `0.7.1-pre.2`，塔台 2026-10-18 21:27 確認）。BUG-157 / 160 / 158 / 161 / 163 都是 ✅ FIXED，修正工單驗的是 source build 與單元測試，本單改用**已安裝的 pre.2 exe** 再驗一次，做法沿用 T0520。

使用者指示「只做能自動化的」：能以 DOM / IPC / computed style / 截圖判定的項目做到 PASS / FAIL；真的需要外部環境（Docker Desktop、真實 SSH 主機）而本機做不到的，記 NEEDS-HUMAN 並寫明缺什麼，**不要為了湊 PASS 擴大環境**。

每項先讀對應 BUG 檔與修正工單回報區，再依那裡的情境設計步驟。

## 驗收項目

| # | BUG | 驗收重點（以 BUG 檔與修正工單為準） |
|---|---|---|
| V1 | BUG-157 | 釘選 → 儲存不回退。目標用**另一個隔離實例的 RemoteServer**（不同 userData → 不同憑證指紋），不得用使用者的 9876 / 9877。受測實例建一個 WSL 或 Docker 型 remote profile 指向該埠、指紋欄位先放舊值（另一個實例或假值）：(a) 編輯連線 → 「重新釘選指紋」→ 欄位立刻變成目標的實際指紋；(b) 按儲存 → 關掉重開對話框 / reload → 仍為新值（讀 profile 檔或 IPC 交叉確認）；(c) profile 可連線；(d) 指向關閉的埠 → 釘選出現紅字錯誤、欄位不變 |
| V2 | BUG-160 | SSH 型 profile（`targetOS` = `ssh-linux` / `ssh-darwin`）的編輯對話框：釘選按鈕停用並顯示說明（重跑設定精靈）；WSL / Docker 型照舊可按 |
| V3 | BUG-158 | zh-TW 介面不出現 BUG-158 列的英文字樣：精靈 modal 標題、Docker 模式按鈕（Create new / Use existing）、WSL 發行版選單與 WSL1 / systemd 警告（只到顯示畫面，不執行寫入步驟）、設定卡 tooltip（Open / Edit / Delete）、釘選按鈕、舊設定檔遷移 banner（`profiles.legacyTargetOsPrompt`，以沒有 `targetOS` 的 profile 觸發）。SSH 認證失敗文案（指向金鑰 / ssh-agent、不提密碼）：能在不碰真實主機的情況下觸發就驗（例如 T0515 式容器 sshd 不放金鑰），否則以畫面上的 i18n 字串比對 + NEEDS-HUMAN 說明 |
| V4 | BUG-161 | zh-TW：(a) 精靈遇到 step 錯誤時顯示中文（挑本機自然會發生、且不寫入任何發行版的錯誤，例如 Windows 主機沒有 Docker 時 Docker 精靈的錯誤；觸發不了的 code 列出並記 NEEDS-HUMAN）；(b) 縮圖列「+」選單的 `suggested` 標籤是中文；(c) 縮圖右鍵選單「設為監督者」不是 `Set as Supervisor`；(d) 各 modal 的 × 有 `aria-label`；(e) Docker 精靈選項的 description 有顯示 |
| V5 | BUG-163 | 精靈第一步（SSH / WSL / Docker 各一）：選項按鈕與輸入框不是原生白底按鈕（`getComputedStyle` 背景色 / 邊框 / 按鈕間距、class 含 `profile-action-btn` / `bat-wizard-*`），hover / focus 有樣式變化；步驟說明 zh-TW 不再出現「選擇主機、帳號、port、金鑰與安裝路徑」「BAT_AUTH_OK probe」等舊字樣。三張截圖附在回報區給使用者目視（目視不是本單 PASS 的條件） |

每項標 PASS / FAIL / NEEDS-HUMAN，附證據（截圖、DOM 文字 / class、IPC 回傳、指紋比對）。

## 驗證

- 新增 opt-in spec `e2e/v071-pre2-acceptance.spec.ts`：以 `BAT_E2E_V071PRE2=1` + `BAT_E2E_EXECUTABLE` gate，預設 skip；未設時回報 skip 數。
- 需要環境腳本時新增 `e2e/real-remote/t0663-*`；T0515 / T0520 既有腳本不改。
- 回報區附執行指令、結果（passed 數、耗時）、證據目錄。
- 收尾：隔離 userData 已刪、Terminal Server 不殘留、本單容器 / network（若有）已刪、`~/.ssh/config`（若有動）雜湊一致。

## 驗收條件

- [x] V1–V5 各有 PASS / FAIL / NEEDS-HUMAN 與證據
- [x] 受測 exe FileVersion 與 `app.getVersion()` = `0.7.1-pre.2`
- [x] 未改產品程式碼；未碰使用者 BAT / WSL bat-server；未耗 Claude token
- [x] 環境清理完成

## Sub-session 執行指示

1. 讀本工單、BUG-157 / 158 / 160 / 161 / 163、T0650 / T0652 / T0655 / T0658 / T0660 回報區、`e2e/pre7-acceptance.spec.ts` 與 `e2e/fixtures/electron-isolation.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（時間用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取，R-G001）
3. 實作 → 執行 → 填回報區（DONE：每項都有結論且無 FAIL；PARTIAL：有 FAIL 或沒做完）
4. `git commit --only` 本單產出；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

**DONE**。V1–V5 全部有結論、無 FAIL。共 40 項檢查：39 PASS、1 NEEDS-HUMAN（V4.a 裡本機觸發不了的錯誤 code 清單，詳見下方）。

| # | BUG | 結論 | 重點證據 |
|---|---|---|---|
| V1 | BUG-157 | **PASS** | (a) 欄位從假值 `AA:00:…` 立刻變成目標實例的指紋 `3F:C2:…:61:37`，profile 同步寫入；(b) 按儲存後，`profile:get`、`profiles/index.json`、重開對話框、reload 後（Recovery 選「恢復」）都還是新值；(c) 已存 profile `testConnection` → `ok:true`（用舊指紋對照 → `fingerprint-mismatch`），卡片燈號顯示「伺服器可連線」；(d) 連到關閉的埠 → 紅字（`rgb(229, 83, 75)`）「連線失敗：無法連線 (connect ECONNREFUSED …)」，欄位與檔案都還是舊值，按儲存後也沒變 |
| V2 | BUG-160 | **PASS** | `ssh-linux` / `ssh-darwin`：按鈕停用，title 與下方說明都是「SSH 的設定經 SSH 通道連線，請重跑設定精靈更新指紋。」，強制點擊後 `remote:test-connection` 呼叫數 4→4（沒有發出連線）；`wsl-linux` / `docker-linux`：按鈕可按、title 是 pinTitle、沒有說明文字 |
| V3 | BUG-158 | **PASS** | 精靈 modal 標題（新增 WSL / Docker / SSH 設定檔）；Docker 模式按鈕「建立新容器 / 沿用既有容器」；WSL 發行版選單（標題、說明、`執行中 • WSL2` / `已停止 • WSL2`）；WSL1 警告；systemd 警告；卡片 tooltip（開啟配置 / 重新命名 / 刪除配置）；「重新釘選指紋」；舊設定檔 banner + 「選擇 targetOS…」。配置對話框、編輯連線、三個精靈都掃不到 BUG-158 列出的英文字樣。**SSH 認證失敗以真實登入失敗觸發**（容器 sshd 不接受任何金鑰）→ 標題「SSH 認證失敗」，內文提到金鑰 / ssh-agent / `~/.ssh/config`，沒有提到密碼 |
| V4 | BUG-161 | **PASS**（a 部分 NEEDS-HUMAN） | (a) 已觸發的 5 個錯誤都顯示 zh-TW 標題 / 內文：`docker-daemon-down`（**本機自然發生**：Windows 沒有 Docker daemon）、`docker-no-containers`、`wsl-requires-wsl2`、`wsl-home-unresolved`、`permission-denied`（真實 ssh）；其餘 24 個 code 需要真的安裝或主機失敗才能觸發，本單不能造成，列為 NEEDS-HUMAN（T0660 已有 unit test 涵蓋）；(b) 「+」選單 6 個 `建議` 標籤；(c) 右鍵選單「👁 設為監督者」，沒有出現 `Supervisor`；(d) 配置、編輯連線、3 個精靈、設定面板的 × 都有 `aria-label="關閉"`；(e) Docker 選項說明有顯示（visible），按鈕的 `aria-describedby` 指向它 |
| V5 | BUG-163 | **PASS** | SSH / WSL / Docker 第一個選擇畫面的選項按鈕 class 都是 `profile-action-btn bat-wizard-choice`；背景 `rgb(45, 45, 45)`（不是白色原生按鈕），邊框 solid、圓角 4px、按鈕間距 8px；hover 時背景變成 `rgb(60, 60, 60)`；Tab 聚焦時出現 focus ring。手動輸入框是 `profile-name-input`，聚焦時邊框從 `rgb(64,64,64)` 變成 `rgb(0,120,212)`；送出鈕是 `profile-action-btn primary`。三個精靈都沒有舊字樣（「選擇主機、帳號、port、金鑰與安裝路徑」、`BAT_AUTH_OK`、probe、TOFU…），新說明都在。另檢查已安裝版 `app.asar/dist/assets` 的 68 個 js：舊字樣 0 個、新字樣 3/3 |

其他 gate：

- **版本**：exe FileVersion `0.7.1-pre.2`；三個隔離實例（target / subject / wizard）的 `app.getVersion()` 都是 `0.7.1-pre.2`。
- **沒有寫入**：wizard 實例的 guard 共記錄 18 次呼叫，其中 stub 16 次、real（唯讀）2 次（`docker:status`、`ssh:probe-auth`）、**blocked 0 次**。WSL 精靈從頭到尾沒碰到使用者的發行版。
- **環境清理**：3 個隔離 userData 都已刪，Terminal Server 沒有殘留（PID 都已結束）；容器 `bat-t0663-sshd` 與映像 `bat-t0663-sshd:local` 已刪，label `bat.t0663=1` 的容器 / 映像 / network 都是 0；`~/.ssh/config` 只在 SSH 認證那一項測試期間加了標記區塊，結束就還原，SHA-256 `00aab1cda8667c85db60b35f406a785bd9a909b87df7cf49aa78450ca03c58a2` 與開工前相同（`match=true`），之後也沒有 `bat-t0663` 字樣。
- **沒有消耗 Claude token**：沒有開 Claude 面板或 claude-cli 分頁；`claude:*` 共 37 個 channel 都由 recorder 回應，實際呼叫 0 次。
- **沒有碰使用者的 BAT / WSL bat-server**：都沒有連 9876 / 9877，也沒有執行 `wsl --shutdown` / `--terminate`。
- **產品程式碼未改**：`electron/**`、`src/**`、`scripts/**`、`package.json`、`e2e/fixtures/**` 都沒有改動；`src/styles/settings.css` 的 M 沒動、沒提交。

### 產出摘要

**Landing check**：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 `e2e/` 存在（僅記錄）；C-2 無 branch 欄位（目前 `main`）。`CT_HOME` 未設（非隔離）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

**新增檔案**（commit `049dd993`，`git commit --only`，未 push）：

- `e2e/v071-pre2-acceptance.spec.ts`：opt-in spec（`BAT_E2E_V071PRE2=1` + `BAT_E2E_EXECUTABLE`，Windows），共 13 個 test。沒設定時 13 skipped（已實測）。
  - 啟動三個隔離實例（`launchIsolated`）：**target** 只用它的 RemoteServer 當 V1 的目標（另一份 userData，所以指紋不同）；**subject** 跑 V1 / V2 / V3 卡片 / V4 選單；**wizard** 跑三個精靈。
  - 精靈的安全做法：用主行程 guard 換掉 `wsl:` / `wsl-systemd:` / `docker:` / `ssh:` / `server-bundle:` 和 `remote:detect-arch` / `detect-tools` / `test-connection` 共 46 個 handler。讀取類回固定資料；唯讀的 `docker:status`（自然錯誤）、`ssh:probe-auth`（認證失敗）照真的跑；其他一律丟出 `T0663 guard` 錯誤、不執行，呼叫紀錄另存成證據。systemd 警告那一項以 `wsl:resolve-home` 回空字串，讓精靈停在 `wsl-home-unresolved`，下載或安裝之前就停下來。
  - 每項判定寫進 `<evidence>/results.json`；FAIL 會變成 soft assertion 失敗。
- `e2e/real-remote/t0663-env.mjs`（`up` / `status` / `apply-ssh-config` / `restore-ssh-config` / `down [--rmi]`）與 `e2e/real-remote/t0663-sshd.Dockerfile`：在 WSL Docker 內建立一個不接受任何金鑰的 sshd（`bat-t0663-sshd`，只綁 127.0.0.1:22663），alias 為 `bat-t0663-nokey`（使用不會被授權的金鑰、`IdentitiesOnly yes`、known_hosts 放在 temp）。`~/.ssh/config` 的標記區塊加入與 SHA-256 還原做法沿用 T0515。T0515 / T0520 的既有腳本沒有修改。

**執行指令**：

```powershell
node e2e/real-remote/t0663-env.mjs up
$env:BAT_E2E_V071PRE2='1'; $env:BAT_E2E_EXECUTABLE='C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe'
npx playwright test e2e/v071-pre2-acceptance.spec.ts
node e2e/real-remote/t0663-env.mjs down --rmi
```

**最終執行結果**（HEAD `b49c8b1c`，spec 內容與 commit `049dd993` 相同）：**13 passed (24.8s)**，results.json 共 40 項：39 PASS、1 NEEDS-HUMAN、0 FAIL。執行前已確認沒有其他 Playwright 程序（T0664 當時已完成）。

**證據目錄**（不在 Playwright outputDir 底下）：`<使用者資料夾>\AppData\Local\Temp\bat-t0663\evidence\`

- `results.json`（逐項判定 + 證據）、`subject-guard-calls.json`、`wizard-guard-calls.json`
- V5 給使用者目視的三張截圖：`v5-wizard-ssh.png`、`v5-wizard-wsl.png`、`v5-wizard-docker.png`；另有 `v5-wizard-ssh-manual-host.png`
- V1：`v1a-after-pin.png`、`v1b-after-save-reload.png`、`v1c-card-reachable.png`、`v1d-closed-port-error.png`；V2：`v2-ssh-linux-pin-disabled.png`、`v2-ssh-darwin-pin-disabled.png`、`v2-docker-linux-pin-enabled.png`
- V3：`v3-edit-connection-zh-TW.png`、`v3-legacy-banner.png`、`v3-wsl1-warning.png`、`v3-wsl-systemd-warning.png`、`v3-ssh-auth-failed.png`
- V4：`v4a-docker-daemon-down.png`、`v4a-docker-no-containers.png`、`v4b-add-menu-suggested.png`、`v4c-thumbnail-context-menu.png`
- 執行 log：`<使用者資料夾>\AppData\Local\Temp\bat-t0663\run3.log`（最終一輪）；`run1.log` / `run2.log` 是修正測試側問題前的執行紀錄

**觀察（不在 BUG 範圍內，僅供塔台參考，未判 FAIL）**：

1. 配置卡片的展開鈕 `title` / `aria-label` 在 zh-TW 介面仍是英文 `Expand` / `Collapse`（`src/components/profiles/ProfileCard.tsx` 第 125–126 行，不在 BUG-158 的清單裡）。
2. 精靈選項按鈕的鍵盤焦點只有瀏覽器預設的 focus ring（`outline: auto`），`.profile-action-btn` 沒有自訂 focus 樣式；hover 有樣式變化。V5 以「有可見的變化」判 PASS。
3. V1(c) 卡片燈號的 title 是「未連線：未開視窗，伺服器可連線；遠端 BAT 上此 profile 使用中」：目標是完整的 BAT 實例（不是 headless server），所以它的 `profile:list` 會回報 active profile，屬預期。

### 互動紀錄

無（yolo，未向塔台提問）。

### 遭遇問題

- 第 1 輪有 2 項失敗，都是測試側的問題，與產品無關，已修正後重跑：① V1(b) reload 後，因為 Terminal Server 還有 PTY，出現 Recovery 提示擋住點擊 → 加上 `reloadAndRecover`（選「恢復」，與使用者 reload 後的操作相同）；② V5 原本用 `1px` 判斷邊框，但 150% DPI 下計算值是 `0.666667px` → 改成判斷 solid 且寬度大於 0。第 2 輪補上 V4(d) 的設定面板 ×（class 是 `.close-btn`，不是 `.settings-close`）。第 3 輪是最終結果。
- `v1a-after-pin.png` 截到 target 隔離實例的權杖。該實例的 userData 已刪除、伺服器已關閉，權杖已失效；截圖只存在 temp，沒有進版控。
- 本單的 spec / 腳本沒有修改產品程式碼，也沒有修改 BUG 檔與 `_bug-tracker.md`。

### 回報時間

2026-10-18T21:46:55+0800
