---
schema_version: 1
schema_kind: workorder
id: T0840
title: "PLAN-043 W3：精靈「一次同意」清單＋ `plan-wsl-environment` / `apply-wsl-environment`（P-1 WSL2 轉換、P-2 systemd、P-3 預設使用者、P-4 linger）＋ `wsl-systemd-check` 改驗證"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: L
created_at: "2026-11-04T09:17:09+0800"
started_at: "2026-11-04T12:15:20+0800"
updated_at: "2026-11-04T12:47:01+0800"
completed_at: "2026-11-04T12:47:01+0800"
session_ids:
  - "452cba2e-ce3a-403a-b7e3-35c4e6530c99"
depends_on: [T0839, T0830, T0835]
related:
  - "PLAN-043 Phase 2；D272；T0831 回報區（〈調查結論〉2 全節、4、5，〈建議下一步〉W3）；T0830（step abort）；T0838 / T0839"
affects_files:
  - _ct-workorders/T0840-wsl-consent-and-apply.md
  - src/components/setup-wizard/
  - electron/wsl-env-apply.ts
  - electron/wsl-systemd.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - docs/wsl-deployment.md
  - CHANGELOG.md
  - tests/wsl-wizard-e2e.test.ts
  - tests/wizard-runner.test.ts
  - tests/__mocks__/electron-api.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 使用者裁決（D272）：精靈取消時**不還原**已套用的環境修正，保留備份並在 done / 取消畫面列出「已變更項目＋備份位置」；P-6 不做。環境都正常時（0 項）不顯示清單、精靈行為除多兩個瞬間完成的步驟外不變；新步驟 `appliesTo: ['wsl-linux']`，SSH / Docker 不受影響。"
  - "🔴 本機實測（使用者 D272 同意）：只可用**拋棄式發行版**（`wsl --import BAT-T-0840-<用途> <scratchpad 內目錄> <rootfs> --version 1` 之類），測完 `wsl --unregister` 該拋棄式發行版；🔴 不得改、停或重啟使用者既有的發行版（`Ubuntu-24.04`）；任何 `wsl --shutdown` 先停下問塔台（塔台轉問使用者時段）。rootfs 來源要是官方映像，下載放 scratchpad、收尾刪除。"
  - "🔴 內容寫入（`/etc/wsl.conf`、密碼等）一律走 stdin，不放 argv、不寫 log；寫入前備份；每項修正冪等、執行前重新偵測、執行後重新驗證（不信 exit code）。Dialog 照 CLAUDE.md（ModalOverlay＋`onEscape`，新 Dialog 進 `dialog-escape.test.tsx` 規則）；日誌走 logger / `debug.log`，順便改掉 `wsl-flow.ts` 的 `console.*`。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0840 — PLAN-043 W3：一次同意＋自動修正

## 元資料
- **工單編號**：T0840｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0839、T0830（runner AbortSignal、Shell 中止 UI 同檔）、T0835（同改 locales）
- **規模**：L｜**降級**：先完成 runner `requestConsent`＋清單 UI＋P-2（systemd），P-1 / P-3 可回 PARTIAL 由塔台另開

## 任務指令
1. 讀 T0831 回報區（全文），依〈調查結論〉2 實作流程位置、`requestConsent`、checklist、`apply-wsl-environment`、錯誤碼、失敗處理與可逆性、中止（`--set-version` 標「無法中止」）。
2. P-2 `--terminate` 是否足以讓 systemd 生效：在拋棄式發行版實測；不足時依 T0831 設計另列「`wsl --shutdown`」單獨同意項（實測前先問塔台）。
3. i18n、`docs/wsl-deployment.md`、`CHANGELOG.md` `[Unreleased]`。
4. 測試：runner `requestConsent`（比照 `wizard-runner.transitions.test.ts`）、checklist RTL、apply 各項（mock）、0 項不回歸、SSH / Docker 精靈不回歸、`npm run test:legacy` 的 WSL 精靈測試。
5. **T0839 交接**（塔台 2026-11-04 11:58 併入，見 T0839 回報區〈產出摘要〉與〈遭遇問題〉）：
   - 計畫來源：IPC `wsl:detect-facts` → `buildWslEnvPlan(facts)`（`src/components/setup-wizard/wsl-env-plan.ts`）；item / notice 形狀照該檔，不另寫判斷。
   - `wizard.wsl.plan.*` 的 i18n 字串**尚未加**（en / zh-TW / zh-CN），本單補齊，並把這些 key 加進 `i18n-completeness.test.ts` 的檢查清單。
   - 探測會冷啟動 Stopped 的發行版（實測約 7 s）：plan 步驟要顯示進行中狀態、可被 T0830 的中止打斷。
   - systemd 判斷：facts 用 `/proc/1/comm`，既有 `wsl-systemd-check` 用 `systemctl --user is-system-running`。把 `wsl-systemd-check` 改成驗證時決定是否統一，寫進回報。
   - P-3（root）、P-7（WSL 太舊）、`AllowWSL=0`、WSL 未安裝只出提示（notice），不出可勾項目。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npm run test:legacy` 全過、`npx vite build` 成功
- [ ] 拋棄式發行版實測紀錄（P-1 / P-2 / P-3 / 中止），測完已 unregister
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：legacy 精靈測試寫死「9 個步驟」，可否改 `tests/` 底下的 WSL 精靈測試與共用 mock？
- **提問時間**：2026-11-04T12:18:54+0800
- **背景**：本單在 WSL 流程加 `plan-wsl-environment` / `apply-wsl-environment` 兩步（9 → 11）。`npm run test:legacy` 的 `tests/wsl-wizard-e2e.test.ts:26`、`tests/wizard-runner.test.ts:72,89,116` 斷言 `snapshots.length === 9`；共用 mock `tests/__mocks__/electron-api.ts` 沒有 `wsl.detectFacts` 與新的 apply / systemd 驗證 IPC。`tests/` 不在 `affects_files`。
- **選項**：
  - A：放行改這 3 個檔（WSL 步驟數 9 → 11、測試名稱跟著改；mock 補 `detectFacts`（預設回健康環境 → 0 項）、`applyEnvItem`、`systemdRunning`）。Docker 的兩個 `length, 9` 不動。
  - B：不改 `tests/`，產品端在 IPC 不存在時退回舊行為（plan 當 0 項、systemd 驗證退回 `systemdEnabled`）；但步驟數斷言仍會失敗 → `test:legacy` 不會全過。
  - 其他
- **建議**：A。步驟數改變是本單規格的直接結果；mock 只補 IPC、不改既有斷言的意思。
- **影響**：選 B 則驗收條件「`npm run test:legacy` 全過」無法達成。
- **是否阻擋後續步驟**：不阻擋實作，只阻擋最後的 `test:legacy` 驗收與 commit。
- **通道**：BAT（`q-e42318d1-fee75c740aa07114`），塔台 12:19 答覆 A，內容記在〈互動紀錄〉。

### 完成狀態

- **狀態**：DONE（降級條款未用到：runner `requestConsent`、清單、P-1 / P-2 / P-3 / P-4 全部完成）
- **session_id**：452cba2e-ce3a-403a-b7e3-35c4e6530c99
- **落點檢查**：PASS。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1：工單在 `REPO_ROOT/_ct-workorders/`；C-3：`affects_files` 抽查的路徑都存在或祖先存在（`electron/wsl-env-apply.ts` 為新檔）；C-2：沒有 `branch` 欄位（實際 `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_REMOTE_TOKEN` 已設定；`CT_HOME` 未設（不是 worktree）。
- **產品 commit**：`790aacf972bf95102853824a8e3eb3605486a2ba`（30 個檔，`git add` 明確路徑；沒有 push）。驗證關卡跑在這個 commit 的工作樹內容上（跑完才 commit，之後沒有再改產品檔）。工單檔另有 commit。
- **相關通過案例**：工單沒有這一段，不適用。

### 產出摘要

**流程**（`wsl-flow.ts`，11 步）：`detect-env → pick-wsl-distro → plan-wsl-environment（新，kind:'input'）→ apply-wsl-environment（新）→ wsl-systemd-check（改驗證）→ install-server-bundle → …`。兩個新步驟 `appliesTo: ['wsl-linux']`；SSH / Docker 流程沒有新步驟（測試斷言）。

| 項目 | 實作 | 位置 |
|---|---|---|
| runner `requestConsent` | `WizardConsentRequest` / `WizardConsentItem`（形狀同 `WslEnvPlanItem`），包裝方式與 `requestChoice` 相同（`maybeWrapInputRequests`：input 步驟切 `awaiting-input`、T0830 中止時 reject） | `wizard-runner.ts` |
| 「無法中止」標記 | `ctx.setUninterruptible(key \| null)` → snapshot `uninterruptibleKey`；每次嘗試各自一份，步驟結束清掉；Shell 顯示該文字 | `wizard-runner.ts`、`SetupWizardShell.tsx` |
| checklist UI | 在精靈詳細面板內（不是 Dialog，所以不經 `ModalOverlay`）：每項顯示範圍標籤（全機 / 此發行版 / 此使用者）、必要 / 選用 / 自動、副作用；固定項沒有可操作的勾選框；`disabledReasonKey` 的項目不能勾並說明原因；勾選項目會停止發行版時，確認鈕上方一行總結＋目前 Running 的發行版；必要項沒勾時顯示提示 | `WizardConsentChecklist.tsx` |
| `plan-wsl-environment` | `wsl.detectFacts(distro, { operationId })`（可中止）→ `buildWslEnvPlan`（不另寫判斷）。0 項 → 不顯示清單、直接成功。blocking notice → `wsl-policy-blocked` / `wsl-not-installed`；其他 notice（P-3 root、P-7 太舊、探測失敗）→ warning。固定項一律算同意；不能勾的必要項 → `wsl-env-item-unavailable`；只缺 WSL2 轉換 → `wsl-requires-wsl2`（與以前選發行版步驟的錯誤同訊息同 code）；其他必要項沒勾 → `wsl-env-required-declined`（「重新選擇」/ 取消）；選用沒勾 → warning。結果存 `ctx.state.wslApprovedItems` | `steps/wsl/plan-wsl-environment.ts` |
| `apply-wsl-environment` | 依序 `wsl2-convert` → `enable-systemd`（`enable-linger` 照舊由 write-systemd-unit 做）；每項經 IPC `wsl:apply-env-item`；變更記到 `ctx.state.wslAppliedChanges`（失敗 / 中止前已做的也記）；必要項失敗 → 錯誤碼原樣（重試 / 略過（可能影響連線）/ 取消）；選用項失敗 → warning；`rollback()` 只清同意結果、保留變更清單（註解寫明 D272 理由） | `steps/wsl/apply-wsl-environment.ts` |
| main 端修正 | `WslEnvApplier`：每項先重新偵測（已符合 → `already`，不寫、不 terminate），之後以實際狀態驗證（不信 exit code）。P-2：root 讀 `/etc/wsl.conf`（原始位元組）→ T0838 `setIniValue` 只改 `[boot] systemd=true`、保留編碼與換行 → 存在時先 `cp -p` 到 `iniBackupPath`（系統時間）→ 內容走 stdin 寫暫存檔再 `mv` → 讀回驗證 → `wsl --terminate` → 等 PID 1 = systemd（最多 4 次）。解析不了的檔不寫。WSL1 只宣告不 terminate。P-1：`wsl --set-version <d> 2`（**不帶** signal、timeout 60 min）→ `wsl -l -v` 驗證。日誌只記項目 / 結果 / 數量 / 耗時。錯誤碼 `wsl-set-version-failed` / `wsl-systemd-enable-failed` / `wsl-terminate-failed` / `wsl-env-apply-invalid` | `electron/wsl-env-apply.ts`（不 import electron、不在 import 期取 userData） |
| IPC | `wsl:apply-env-item`、`wsl:systemd-running`（本機 `ipcMain.handle`）；`wsl:detect-facts` 多 `options.operationId`（不帶時參數與 T0839 相同）；`wsl-detect.execFileBuffered` / `detectWslFacts` 多 `signal` | `main.ts`、`preload.ts`、`electron.d.ts`、`wsl-detect.ts`、`wsl-facts.ts` |
| `wsl-systemd-check` | 改為驗證：`wsl.systemdRunning`（`/proc/1/comm`）不是 systemd → `wsl-systemd-disabled`（已修正重試 / 取消），不再只警告 | `steps/wsl/wsl-systemd-check.ts`、`wsl-detect.ts` `systemdRunning` |
| `pick-wsl-distro` | 有 WSL2 發行版時行為不變（只列 WSL2）；**只有** WSL1 時改成從 WSL1 中選，交給 plan 提議轉換 | `steps/wsl/pick-wsl-distro.ts` |
| 錯誤畫面 | registry 新增 `wsl-policy-blocked`、`wsl-env-required-declined`、`wsl-env-item-unavailable`、`wsl-env-apply-failed`（三個 apply 錯誤碼共用）、`wsl-systemd-disabled`；`wsl-requires-wsl2` 的 stepIds 加 `plan-wsl-environment` | `error-mapper.ts` |
| 完成 / 取消畫面 | `WslAppliedChangesBox`：列出「WSL 環境的變更」＋備份路徑（或「原本沒有這個檔案」）＋「不會自動還原」 | `WizardConsentChecklist.tsx`、`SetupWizardShell.tsx` |
| 日誌（F4） | `wsl-flow.ts` 的 `console.*` 改為 `createWslWizardLogger()` → `window.electronAPI.debug.log` | `wsl-flow.ts` |
| i18n | en / zh-TW / zh-CN 各 59 個 key（`wizard.wsl.plan.*` 含 T0839 用到的全部 key、`wizard.wsl.apply.*`、兩個新步驟、`systemdCheck.description` 改寫、5 組錯誤）；`i18n-completeness.test.ts` 加 T0840 區塊：明確 key 清單＋從 `wsl-env-plan.ts` 原始碼抓出的每個 `${KEY}.*` key、三語 key 集合一致、placeholder 保留 | `src/locales/*.json`、`src/locales/__tests__/i18n-completeness.test.ts` |
| 文件 | `docs/wsl-deployment.md`：先決條件、11 步表、新節〈Environment check and fixes〉、rollback、中止、疑難排解、實機清單；`CHANGELOG.md` `[Unreleased]` Added / Changed 各一條 | |

**T0839 交接的決定**
- systemd 判斷**統一**成 `/proc/1/comm`：`wsl-systemd-check` 驗證與 plan 用同一個信號，所以「已宣告 `systemd=true` 但還沒重啟」在兩邊都算沒有（舊的 `systemdEnabled` 會因 wsl.conf 宣告而放行，然後到第 8 步才失敗）。`degraded` 也算有 systemd（舊判斷 `systemctl --user is-system-running` 只認 `running`，degraded 會退到 wsl.conf 宣告）。舊的 `systemdEnabled` / IPC `wsl:systemd-enabled` 保留不動，舊 preload 時退回它。
- plan 步驟的探測可被 T0830 中止（實測 20 ms 中止）；跑的時候顯示既有的「執行中」＋步驟說明「可能會啟動已停止的發行版，需要幾秒鐘」。
- P-3 / P-7 / `AllowWSL=0` / WSL 未安裝只出提示；P-5 / P-6 不在清單。

**行為變化（逐項）**

| # | 情境 | 以前 | 現在 |
|---|---|---|---|
| 1 | 環境正常 | 9 步 | 11 步，兩個新步驟瞬間完成，畫面不多任何東西 |
| 2 | 只有 WSL1 發行版 | 選發行版步驟失敗 `wsl-requires-wsl2`＋`wsl1Only` 警告 | 選出 WSL1 發行版，清單提議轉換（預設不勾）；不勾 → 同一個 `wsl-requires-wsl2` 錯誤（在檢查步驟） |
| 3 | systemd 沒開 | 警告後繼續，第 8 步 write-profile 失敗並整個 rollback | 清單提議開啟並自動套用；沒開成 → 第 5 步 `wsl-systemd-disabled` 停下 |
| 4 | `[boot] systemd=true` 但尚未重啟 | 視為有 systemd | 視為沒有；清單提議（只 terminate、不改檔） |
| 5 | systemd `degraded` | 只看 wsl.conf 宣告 | 算有 systemd |
| 6 | WSL 精靈日誌 | `console.*`（不進磁碟日誌） | `debug.log` |
| 7 | `wsl.detectFacts` 帶 operationId | — | 可中止；不帶時呼叫參數與 T0839 相同 |

### 驗證證據分道

| 分道 | 結果 |
|---|---|
| source | PASS：`wsl-env-apply.ts` 沒有 electron import、沒有 shell 型 exec API、沒有 `getPath(`（source guard 測試）；所有 child_process 都是 `execFile` / `spawn` 陣列參數＋timeout；腳本為固定字串；發行版名稱先過白名單；`/etc/wsl.conf` 內容只走 stdin（測試斷言 argv 不含檔案內容） |
| 型別 | PASS：`npm run typecheck` = 0、`npm run typecheck:electron` = 0 |
| 單元測試 | PASS：`npm run test:unit` 432 個檔通過 / 3 skipped，7618 個測試通過 / 40 skipped，0 失敗。新增 `electron/__tests__/wsl-env-apply.test.ts`（20 個：already / 備份＋只改一行＋stdin / UTF-16 BOM＋CRLF 保留 / 沒有檔案不備份 / 只 terminate / 解析不了不寫 / 讀回驗證 / terminate 後仍非 PID 1 / terminate 失敗 / WSL1 不 terminate / 兩種中止 / signal＋timeout / 轉換 already、applied（無 signal、60 min）、exit≠0 但已是 2、仍是 1、轉換中中止 / 輸入白名單 / source guard）、`src/components/setup-wizard/__tests__/wsl-env-consent.test.tsx`（28 個：runner `requestConsent` 狀態轉換比照 transitions 測試、中止 reject＋rollback、`setUninterruptible`；plan 0 項不回歸、operationId、同意、各錯誤碼、notice → warning、舊 preload；apply 順序、變更紀錄、無法中止標記、失敗、中止、rollback 保留變更；systemd 驗證＋舊 preload 退回；流程順序與 SSH / Docker 無新步驟；checklist RTL 3 個；Shell 整合 3 個：清單→套用→完成畫面列變更、健康環境無清單、清單開著時中止）。既有測試改 2 個斷言（下方〈遭遇問題〉） |
| legacy | PASS：`npm run test:legacy` 33 檔通過、472 個測試 0 失敗（含 `wsl-wizard-e2e`、`wizard-runner`、`wsl-flow-journeys`、`wizard-rollback*`、SSH / Docker 精靈測試） |
| build | PASS：`npx vite build` 成功 |
| 本機拋棄式發行版實測 | PASS（2026-11-04 12:20–12:43，見下表）；只動 `BAT-T-0840-*`，`Ubuntu-24.04` 全程 Stopped、沒有被讀寫或 terminate；沒有執行 `wsl --shutdown` |
| runtime（真的 BAT 視窗跑精靈） | 未做：本單的實機驗證在 main 端模組層（`npx tsx` 直接呼叫 `WslEnvApplier` / `detectWslFacts` / `buildWslEnvPlan`）；畫面行為由 RTL 與 Shell 整合測試涵蓋 |

**拋棄式發行版實測紀錄**（rootfs：`https://cloud-images.ubuntu.com/wsl/releases/24.04/current/ubuntu-noble-wsl-amd64-wsl.rootfs.tar.gz`，下載到 scratchpad、`SHA256SUMS` 驗證 OK；WSL 2.7.14.0、Windows build 28000）

| # | 發行版 | 測什麼 | 結果 |
|---|---|---|---|
| 0 | `BAT-T-0840-sysd`（`--import … --version 2`，預設 root） | **`--terminate` 是否足以讓 `[boot] systemd` 生效**（手動：`systemd=false` → terminate → PID 1 = `init`；改 `true` → terminate → PID 1 = `systemd`、`is-system-running` = `running`，2.8 s） | **足夠**，不需要另列 `wsl --shutdown` 同意項（所以沒有向塔台提 `--shutdown` 問題） |
| 1 | 同上 | P-2 經本單程式：前提 `systemd=false`＋註解＋`[user]` 段 | plan = `enable-systemd`（必要、預設勾）＋`enable-linger`（固定）＋notice `default-user-root`；apply → `applied`、3.2 s、備份 `/etc/wsl.conf.bat-backup-20261104-123923`（內容 = 原檔）、新檔只有 `systemd=false`→`true` 一行不同、權限 `644 root:root`、沒有殘留 `.bat-tmp`、`systemdRunning()` = true；重新算 plan = 0 項；再 apply → `already`（不寫、不 terminate） |
| 2 | `BAT-T-0840-wsl1b`（`--version 1`，`systemd=false`） | P-1＋P-2 | plan = `wsl2-convert`（必要、預設不勾）＋`enable-systemd`＋`enable-linger`；轉換 → `applied`、13.5 s、`wsl -l -v` = 2；之後 plan 剩 `enable-systemd`；apply → `applied`、4.9 s、PID 1 = systemd；最後 plan = 0 項 |
| 3 | 兩者 | P-3（預設使用者 root，uid 0） | 只出 notice `default-user-root`，不出項目（符合 T0839 設計） |
| 4 | `BAT-T-0840-sysd` | 中止 `enable-systemd`（150 ms 後 abort） | 164 ms 結束、`aborted: true`、`/etc/wsl.conf` 沒被改 |
| 5 | 同上 | 中止 `detectWslFacts`（20 ms 後 abort） | 20 ms 返回（子程序被結束）；精靈端隨後以 abort 處理 |
| 6 | `BAT-T-0840-wsl1a`（`--version 1`） | **原始量測**：`wsl --set-version` 執行 3 s 後結束 `wsl.exe` client，轉換會不會繼續 | **不會繼續**：181 s 後仍是 VERSION 1（Stopped），發行版內容完好（可正常執行、`/etc` 160 項）。⇒ T0831「結束 client 推論不會停下轉換」在 2.7.14 不成立（見〈遭遇問題〉） |
| 收尾 | — | `wsl --unregister` 三個拋棄式發行版（exit 0），刪掉 rootfs 與匯入目錄 | `wsl -l -v` 只剩 `Ubuntu-24.04`（Stopped、VERSION 2） |

### 互動紀錄

- [12:18] Q-1（BAT 通道，`q-e42318d1-fee75c740aa07114`）：legacy 精靈測試寫死 9 步，可否改 `tests/` 的 3 個檔？ → A（塔台，12:19）：選 A，放行 `tests/wsl-wizard-e2e.test.ts`、`tests/wizard-runner.test.ts`、`tests/__mocks__/electron-api.ts`；Docker / SSH 斷言（含 `length 9`）不動、mock 預設健康環境、不在 `tests/` 新增檔、三檔補進 `affects_files`；B 的「IPC 不存在時退回舊行為」成本低時保留。 → Action：三檔已補進 frontmatter `affects_files`，`tower_question` 已刪除；產品端保留舊 preload 的退回路徑。

- 沒有 compact / resume。三個塔台補充檢查節點（驗證前、產品 commit 前、填回報前）都沒有新的 `## 塔台補充（…）`。
- 沒有問 `wsl --shutdown`：實測 `--terminate` 已足夠，沒有執行任何 `--shutdown`。

### Renew 歷程

（無）

### 遭遇問題

- **`--set-version` 其實可被中斷（與 T0831 推論相反）**：WSL 2.7.14 上結束 `wsl.exe` client 後轉換沒有繼續、發行版留在 VERSION 1 且完好。本單**照工單規格**仍把轉換標成「無法中止」（不傳 signal，UI 說明轉換完成後才停止）：中途打斷大型發行版的轉換是否安全（例如磁碟已轉一半）沒有驗證，保守做法不變。是否改成可中止由塔台決定（後續）。
- **既有測試改了 2 個斷言**（都在 `src/components/setup-wizard/__tests__/`，屬 P-1 規格的直接結果）：`pick-wsl-distro.test.ts`「只有 WSL1 → 失敗」改成「只有一個 WSL1 → 自動選」＋新增「多個 WSL1 → 詢問」「WSL1 / WSL2 混合 → 只列 WSL2（不變）」；`step-error-i18n.test.tsx`「選發行版只有 WSL1 → `wsl-requires-wsl2`」改成「選發行版成功、plan 沒勾轉換 → 同一個訊息與 code」。`STEP_CODES` 補上本單 8 組錯誤碼。legacy 3 檔依 Q-1 塔台答覆修改（WSL 步驟數 9 → 11、mock 補 3 個 IPC，Docker / SSH 斷言未動，`tests/` 沒有新檔）。
- **後續（不在本單範圍）**：
  1. `e2e/v071-pre2-acceptance.spec.ts:848-877` 的 V3 兩項仍斷言舊行為（`wsl1Only` 警告、`systemdDisabled` 警告）；本單後只有 WSL1 時不再出 `wsl1Only` 警告（改由清單提議轉換），systemd 沒開時第 5 步直接失敗。該 spec 不在驗收關卡內，沒有執行也沒有改；下次跑這份驗收前需要更新（`e2e/` 目前有 T0836 在改，請塔台排序）。
  2. `wizard.wsl.warning.wsl1Only` / `systemdDisabled` 兩個 i18n key 已沒有程式使用（`i18n-completeness.test.ts` 仍列著，e2e 也引用），保留未刪。
  3. checklist 樣式用 inline style（`src/styles/setup-wizard.css` 不在 `affects_files`）。
  4. 精靈在真的 BAT 視窗內、對拋棄式發行版從頭跑一次（畫面＋IPC＋實際修正）沒有做；可併入下一張需要實機的單（W4 或 W8）。
- 工作目錄裡有塔台 / 其他工單的檔（`_ct-workorders/T0836-…`、`_tower-state.md`）在本單期間有變動，都沒有動、沒有 stage。

### 回報時間

- 2026-11-04T12:45:39+0800
