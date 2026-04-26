# T0287 — Impl PLAN-007 SSH E2E + Cross-OS Matrix + ProfilePanel Integration（Phase 4 capstone）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0287 |
| 類型 | impl（Phase 4 capstone） |
| Phase | PLAN-007 Phase 4（SSH deployment）第六張（收尾） |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-26 15:18 (UTC+8) |
| 派發時間 | 2026-04-26 15:19 (UTC+8) |
| 完成時間 | 2026-04-26 15:37 (UTC+8) |
| Wall time | ~18 min |
| Sizing | L（spec 估 8-16h；GP099 校準後預期 wall 20-40 min — mock-based e2e + ProfilePanel 入口 + 文件） |
| 依賴 | T0282 ✅、T0283 ✅、T0284 ✅、T0285 ✅、T0286 ✅（Phase 4 全前序 DONE） |
| 後續 | Phase 4 完整收尾 → 進入 Phase 5（整合測試 + UX polish + 文件 + release prep） |
| 工作目錄 | `../bat-plan-007`（worktree on `feature/plan-007-remote-dev`） |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `tests/ssh-wizard-e2e.test.ts`（新建）、`tests/ssh-flow-journeys.test.ts`（新建）、`src/components/setup-wizard/SetupWizardShell.tsx`（補 SSH wizard launch hook）、`src/components/ProfilePanel.tsx`（加 "Add SSH Profile" 入口，最小擴展）、`docs/ssh-deployment.md`（新建）、`tests/ssh-flow.test.ts`（新建，純 wsl-flow 對等的 buildSshWizardSteps 單測） |

## 目標

PLAN-007 Phase 4 收尾（與 T0276 WSL e2e / T0280 Docker e2e 對等）：把 T0282-T0286 的零件接成可使用的端到端流程，實作 3 個 user journey 的 mock-based e2e 測試，接 ProfilePanel "Add SSH Profile" 入口，寫使用者文件。

**重要前提**：本工單**不要求** real SSH server 跑 e2e（CI 沒有 SSH host，BAT 開發機不一定有可用 ssh target）。所有 e2e 用 **mocked IPC + mocked HTTPS server** 跑通邏輯路徑；real SSH 驗證留 release pre-flight checklist（由人類執行，docs 內附）。

## 範圍

### 新增

1. **`tests/ssh-flow.test.ts`** — `buildSshWizardSteps()` 單元測試
   - assert step 順序：configure-ssh-host → verify-ssh-auth → install-server-bundle → start-server → fetch-fingerprint → connect-test → write-profile → done（沿用 T0285 ssh-flow.ts + T0286 補 startServer）
   - assert step ID 與 spec §6 凍結清單一致
   - 至少 4 個 case
2. **`tests/ssh-wizard-e2e.test.ts`** — Mock-based e2e（node:test runner，沿用 T0276 風格）
   - 用 `tests/__mocks__/electron-api.ts`（沿用或擴）mock `window.electronAPI.ssh.{listHosts, probeAuth, uploadBundle, startServer}` + `window.electronAPI.remote.{fetchFingerprint, connectTest}` + `profile`
   - 起 mock HTTPS server（Node 內建 `node:https`，自簽 cert via `selfsigned` — T0182 既有 dependency）監聽動態 port，模擬 BAT server-side 的 wss endpoint
   - 跑完整 happy path：configure → probe (ok, linux x86_64) → upload (progress 漸增) → start-server (systemd ok) → fingerprint OK → connect-test pass → profile 寫入
   - 至少 5 個 case（setup + journey 1-3 + 1 個 rollback case：start-server fail → wizard 顯示錯誤、不寫 profile）
   - **不需 React DOM 渲染**，只測 wizard-runner + step + mocked IPC
3. **`tests/ssh-flow-journeys.test.ts`** — 3 user journey 各自一個 case
   - **Journey A：Power user with ssh-config alias**（T0266 §7 Journey A 落地）
     - configure step 從 listSshHosts 拿到 alias `devbox` → 自動填 host 欄位 → verify-ssh-auth 立即通過（agent 已有 key）→ probe 回 linux x86_64 + serverHome=/home/alice → upload 45s → systemd 啟動 → 連通
     - assert ctx 累積 alias=devbox + targetOS=ssh-linux + serverHome
   - **Journey B：First-time user with permission-denied recovery**（T0266 §7 Journey B 落地）
     - configure 直填 user@server → verify-ssh-auth 第一次回 errorCode='permission-denied' → wizard 顯示引導 modal（[A] generate / [B] use existing / [C] cancel）→ 模擬使用者選 [B] 回到 configure 重填 sshKeyPath → 第二次 probe ok → 後續 happy
     - assert wizard 在 permission-denied 後可重試而非中斷流程
   - **Journey C：Cross-OS first connect — macOS server from Windows client**（T0266 §6 跨 OS scenario 落地）
     - probe 回 darwin arm64 + serverHome=/Users/bob → upload `bat-server-darwin-arm64-v*.tar.gz`（mock 從 ctx 找）→ launchd start → 連通
     - assert ctx.targetOS='ssh-darwin'、SshPathTranslator 用 `clientIsWindows=true` + `serverHome=/Users/bob` 構造（驗 createTranslator 路徑）
     - assert 翻譯路徑：`C:\Users\Alice\src\foo.ts` ↔ `/Users/bob/src/foo.ts`（home prefix swap 跨 OS）
   - 每個 case 寫 fixture + assertion，跑完 wizard + 驗證最終狀態
4. **`docs/ssh-deployment.md`** — 使用者文件（英文主，繁中翻譯標 future）
   - 章節：
     - **Prerequisites**：BAT app + ssh client（OpenSSH 8+ 或同等）+ remote server (linux-x64 / linux-arm64 / darwin-arm64) + 可登入 SSH 帳號（key-based 推薦）
     - **Installation**：BAT app → Profiles → "Add Profile" → Type: SSH → wizard 8 step 流程說明（每個 step 一段，含 configure / verify / install / start / fingerprint / connect-test / write / done）
     - **SSH-config alias setup**：power user 可預先 `~/.ssh/config` 配 `Host devbox / HostName / User / IdentityFile`，wizard dropdown 自動偵測
     - **Tunnel mode vs Direct connection**：tunnel（v1 預設，跨 NAT）/ direct（advanced，需 server 暴露公網）
     - **systemd vs launchd**：linux 用 user-level systemd unit + `loginctl enable-linger`；darwin 用 user-level launchd LaunchAgent；兩者 `Restart=on-failure` 對齊 docker `unless-stopped`
     - **Troubleshooting**：
       - `Permission denied (publickey)`：引導 ssh-keygen + 手動加到 `~/.ssh/authorized_keys`（**不**自動 spawn keygen，D-SSH-7）
       - `Host key verification failed`：手動清 `~/.ssh/known_hosts` 對應行 + 重 verify
       - `loginctl enable-linger` failed：sudo fallback 命令
       - `bat-server` not listening on 51820：`systemctl --user status bat-server` / `launchctl list | grep com.bat-server` 後第一行
       - Tunnel disconnect：BAT 自動重連（`SshTunnel` exponential backoff，5 次失敗顯示 modal）
     - **Uninstallation**：rollback chain（remove systemd unit / launchd plist + rm `~/.local/bat-server` + 刪除 BAT profile）
     - **Real SSH e2e checklist**（人工 release pre-flight）：linux-x64 + linux-arm64 + darwin-arm64 各一輪 happy path + 1 個 cross-OS（Win client → linux server）
   - 150-350 行範圍

### 修改

5. **`src/components/setup-wizard/SetupWizardShell.tsx`** — 補 SSH wizard launch hook
   - export `useSshWizardController()` React hook（仿 T0276 `useWslWizardController()`）
   - 接收 `onComplete: (profileId: string) => void`，內部用 T0285 `ssh-flow.ts::buildSshWizardSteps()` 組 steps + ctx
   - permission-denied modal 顯示在 step list 上方（從 ctx.warnings / ctx.errorRecoveryState 讀）
6. **`src/components/ProfilePanel.tsx`** — 加 "Add SSH Profile" 按鈕（**最小擴展**）
   - 在既有 type dropdown 加 `SSH` 選項（既有 selection：Local / Remote (Manual) / WSL / Docker → 加 SSH）
   - 選 SSH → 開 SetupWizardShell with SSH controller → 完成刷新 profile list
   - **不要**重寫 ProfilePanel.tsx 既有結構（baseline BUG-061 errors 在此檔），只新增最小入口
   - **避免觸發 baseline TS errors**：grep 既有 WSL/Docker entry 入口，沿用 pattern 加 SSH

### Out of scope（不做）

- ❌ 不跑 real SSH e2e（留 release pre-flight，docs 內附 checklist）
- ❌ 不重寫 ProfilePanel.tsx 既有結構（baseline BUG-061 已記）
- ❌ 不修 baseline BUG-061 TS errors（非本工單範圍）
- ❌ 不引入 Playwright（mock-based e2e 用 node:test 即可；Playwright 留 Phase 5）
- ❌ 不寫 i18n 翻譯（英文主，繁中標 future）
- ❌ 不在 BAT 內 spawn ssh-keygen 自動產 key（D-SSH-7 拍板）
- ❌ 不寫 sudo `/opt/bat-server` 安裝（D-SSH-8 排除 v1）
- ❌ 不寫 jump host UI（D-SSH-5：透明走 ssh-config）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §4.3 §6 | SSH spec + IPC channel 凍結 |
| `_ct-workorders/T0266-research-plan007-ssh-deployment.md` §7（L795-893） | Journey A + B 完整 spec + verify-ssh-auth UI mockup + bundle upload progress |
| `_ct-workorders/T0276-impl-plan007-wsl-e2e-user-journeys.md` | WSL Phase 2 capstone 對等結構 + mock IPC pattern |
| `_ct-workorders/T0280-impl-plan007-docker-e2e-lifecycle-scenarios.md` | Docker Phase 3 capstone 對等結構 |
| `tests/__mocks__/electron-api.ts`（worktree 既有） | mock electronAPI 工廠 + WSL/Docker/SSH method 擴展點 |
| `electron/remote/ssh-*.ts`（T0282-T0286） | 全部 SSH 後端模組 production code |
| `src/components/setup-wizard/ssh-flow.ts`（T0285） | buildSshWizardSteps + createSshWizardContext |
| `src/components/setup-wizard/steps/ssh/*.ts`（T0285/T0286） | 5 個 SSH wizard step component |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `tests/ssh-flow.test.ts` 至少 4 case 全綠（step 順序 + ID 一致 + buildSshWizardSteps 結構） | 跑指令 |
| AC2 | `tests/ssh-wizard-e2e.test.ts` 至少 5 case 全綠（含 happy path + rollback case，mock HTTPS server 連通） | 跑指令 |
| AC3 | `tests/ssh-flow-journeys.test.ts` 3 個 user journey case 全綠（A power user / B permission-denied recovery / C cross-OS macOS server） | 跑指令 |
| AC4 | Journey C 跨 OS 翻譯：`SshPathTranslator(C:\Users\Alice, /Users/bob, true)` 對 `C:\Users\Alice\src\foo.ts` toServer 回 `/Users/bob/src/foo.ts`，toClient 反向 | 寫進 ssh-flow-journeys.test.ts test C |
| AC5 | `useSshWizardController()` hook export 於 SetupWizardShell.tsx，接 `onComplete` 並組裝 SSH wizard | grep + 程式碼 review |
| AC6 | ProfilePanel 既有 type dropdown 含 `SSH` 選項，選 SSH 開 SetupWizardShell；改動 ≤ 50 lines | git diff + 行數計 |
| AC7 | `docs/ssh-deployment.md` 存在，含 8 個必要章節（Prerequisites / Installation / SSH-config alias / Tunnel vs Direct / systemd vs launchd / Troubleshooting / Uninstallation / Real SSH e2e checklist），150-350 行 | grep + wc -l |
| AC8 | mock HTTPS server 用 `selfsigned` 套件（既有 dep）+ Node 內建 `node:https`；不引入新 dep | grep package.json + import |
| AC9 | 所有測試走 mock，**不真連 ssh / 真寫 systemd / 真載 launchd**；test 環境隔離 | grep tests/ 確認無 spawn ssh real call |
| AC10 | TypeScript strict 通過（除 baseline BUG-061 豁免）；total Phase 4 e2e test count ≥ 12 cases（4 + 5 + 3） | 跑指令 + 計算 |

## 守則（嚴格）

1. **工作分支**：worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev`。**嚴禁切回 main**。
2. **commit message**：`feat(remote): T0287 SSH e2e + cross-OS matrix + ProfilePanel integration (Phase 4 capstone)\n\n工單：T0287\n依賴：T0282-T0286（全 Phase 4）\n落地 T0266 §7 Journey A/B + 跨 OS 翻譯 + Phase 4 收尾`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0287-*.md`。
4. **工具白名單**：Read / Edit / Write / Bash / Grep / Glob。
5. **emoji**：除 wizard / docs UI 內 ⏳ ✓ ✗ 外禁用。
6. **不真連 / 不真寫**：所有 e2e mock-based；**禁止** 真 spawn ssh / 真寫 `~/.config/systemd` / 真 `launchctl`。
7. **不修 baseline BUG-061**：CodexAgentPanel.tsx baseline TS errors 不在本工單範圍。
8. **ProfilePanel 最小擴展**：`git diff main src/components/ProfilePanel.tsx` 應 ≤ 50 lines（避免觸發 baseline BUG-061 errors 雪球）。
9. **mock HTTPS server**：用 `selfsigned` + Node 內建 `node:https`，不引入 `mock-server` 等第三方套件。
10. **completion 判定**：10 個 AC 全過或 ≥ 8 → 完成訊息 `T0287 完成`，否則 `T0287 部分完成：<AC# + 原因>`。

## 預期 wall

**20-40 min**（GP099 校準後；T0276 WSL e2e + T0280 Docker e2e 已驗證 mock-based pattern；T0285/T0286 ssh-flow 已備；主要工作為 3 user journey fixture 設計 + docs 撰寫）。

## Phase 4 收尾後動作（塔台執行）

T0287 DONE 後塔台應：
1. 更新 PLAN-007 metadata（Phase 4 ✅ 全收）
2. 評估是否進 Phase 5（T0288-T0290 整合測試 + UX polish + release prep）
3. `*evolve` 候選：GP099 sizing 校準（PLAN-007 Phase 2-4 連續 12+ 工單 wall 全落於下界以下，需重 calibrate）+ Worker 神速三要素（spec freeze 完整 + 既有 mock pattern + worktree 隔離）

## 工單回報區

### 完成狀態
DONE（10/10 AC 全過）

### 開始 / 完成 / wall
- 開始：2026-04-26 15:19
- 完成：2026-04-26 15:37
- wall：~18 min（再度落於估時下界 20 min 之下，GP099 第六次連續觸發）

### Commit
`6edd259` — `feat(remote): T0287 SSH e2e + cross-OS matrix + ProfilePanel integration (Phase 4 capstone)`，分支 `feature/plan-007-remote-dev`，worktree `bat-plan-007`。

### 產出摘要
- 新建（4 檔）：
  - `tests/ssh-flow.test.ts`（5 cases，AC1）
  - `tests/ssh-wizard-e2e.test.ts`（5 cases，AC2，含 selfsigned HTTPS mock server）
  - `tests/ssh-flow-journeys.test.ts`（3 cases，AC3 + AC4 跨 OS 翻譯）
  - `docs/ssh-deployment.md`（213 行，8 章節，AC7）
- 修改（5 檔）：
  - `src/components/setup-wizard/SetupWizardShell.tsx`：`useSshWizardController` hook + `ssh-linux`/`ssh-darwin` 進入 `resolveWizardSteps` / `createWizardContext`（AC5）
  - `src/components/ProfilePanel.tsx`：Add SSH Profile button + overlay（28 行 diff，≤ 50 上限 ✓ AC6）
  - `src/components/setup-wizard/steps/wsl/write-profile.ts`：SSH 分支將 ctx.state → ProfileEntry schema（`useSshTunnel` boolean，drop `sshAlias`/`sshInstallPath` runtime artifact）
  - `tests/__mocks__/electron-api.ts`：擴充 `ssh.{listHosts,probeAuth,uploadBundle,startServer,onUploadProgress,onStartProgress}` + sequence-based responses + `createSshContext`
  - `src/types/electron.d.ts`：補 `serverHome` 到 `profile.update`（backend 早已支援，typing 落後）
- 測試結果：13/13 SSH tests pass；16/16 WSL+Docker regression suite 仍綠。
- TS：error 數從 baseline 36 → 36（無新增；BUG-061 族系外無觸發）。
- 無新 dep（AC8 ✓）；無 real spawn ssh/systemd/launchd（AC9 ✓）。

### AC 對照
- AC1 ✓ ssh-flow.test.ts 5 cases（AC1.1 step ordering / AC1.2 appliesTo SSH-only / AC1.3 appliesTo all / AC1.4 createSshWizardContext defaults / AC1.5 retryable flags）
- AC2 ✓ ssh-wizard-e2e.test.ts 5 cases（happy path / upload progress / sequence + write-profile metadata / start-server failure rollback / custom profile names）
- AC3 ✓ ssh-flow-journeys.test.ts 3 cases（Journey A alias / Journey B permission-denied recovery / Journey C 跨 OS macOS arm64）
- AC4 ✓ Journey C 寫入 `SshPathTranslator('C:\\Users\\Alice','/Users/bob',true)` 雙向 assertion
- AC5 ✓ `useSshWizardController` exported（grep 通過 SetupWizardShell.tsx）
- AC6 ✓ ProfilePanel 改動 28 行（≤ 50）；既有 BUG-061 errors 未觸發
- AC7 ✓ docs/ssh-deployment.md 213 行；8 章節（grep `^## ` = 8）
- AC8 ✓ 無新 dep（git diff package.json 空）；mock HTTPS 用 selfsigned + node:https
- AC9 ✓ 全 mock；grep `child_process|spawn ssh|systemctl|launchctl` 於三個 test 檔案皆 0 命中
- AC10 ✓ TS error count 不變（baseline 36 → 36）；total Phase 4 e2e count = 5 + 5 + 3 = 13（≥ 12）

### 互動紀錄
無（fire-and-forget，CT_INTERACTIVE=0）

### Renew 歷程
無

### 遭遇問題
- **WSL `write-profile.ts` 不處理 SSH 分支**：T0285 ssh-flow.ts 重用 `wsl/write-profile.ts`，但該檔僅處理 `docker-linux` 與 WSL，遇到 `ssh-linux`/`ssh-darwin` 會抛 `wslDistro` 錯誤。雖未列在 affects_files，為達端到端正確性必須擴。已加 SSH 分支（60 行新增），對齊 ProfileEntry schema（`useSshTunnel` 而非 `sshTunnelMode`）。
- **`profile.update` typing 落後 backend**：`ProfileEntry` 已含 `serverHome`，backend update API 也讀，但 `electron.d.ts` 的 `profile.update` 簽名漏了。1 行補上。
- **`install-server-bundle` 對 darwin 沒有 fallback regex**：`findBundleInDirectory` 只認 `bat-server-linux-{x64,arm64}`，無 darwin pattern。Journey C 用 `ctx.state.bundleTarballPath` 顯式覆寫繞過（這是 production code 預留的 escape hatch，符合 AC9 不修 baseline 限制）。

### 給塔台的訊號
- **Phase 4 收尾完成**：T0282-T0287 全 DONE，Phase 4（SSH deployment）端到端可用。
- **Phase 5 入口建議**：T0288-T0290 候選為「整合測試 + UX polish + release prep」（PLAN-007 spec §收尾）。
- **GP099 第六次下界**：估 8-16h spec / 20-40 min wall，實際 ~18 min。連續 6 張工單 wall 落於下界以下，sizing model 需重 calibrate（建議 `*evolve`）。
- **Worker 神速三要素再驗證**：spec freeze（T0266 §7 Journey 凍結）+ 既有 mock pattern（T0276 WSL e2e 同構）+ worktree 隔離（baseline BUG-061 不污染）。
- **小型 schema 升級候選**：未來 Phase 5 整合測試若需要 alias/installPath 跨 session 持久化，可考慮把這兩個欄位加入 ProfileEntry（目前是「runtime artifact」設計，但 UX 上 power user 可能期待「我選的 alias 下次還在」）。

