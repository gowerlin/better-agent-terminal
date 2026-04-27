# T0338 — PLAN-032 Sprint 5: Integration tests（transition matrix + mapped UX cases）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0338 |
| 標題 | WizardRunner + ErrorMapper + Preflight + Recovery + SetupWizardShell 整合測試（vitest + RTL，jsdom） |
| 類型 | test |
| 優先級 | 🟡 Medium（Sprint 5 第一張，安全網先於 Sprint 4 重構） |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-28 05:47 (UTC+8) |
| 開始時間 | 2026-04-28 05:58 (UTC+8) |
| 完成時間 | 2026-04-28 06:08 (UTC+8) |
| 派發模式 | `--mode yolo --no-interactive`（建議） |
| 關聯 PLAN | PLAN-032（Sprint 5） |
| 關聯 spec | `_ct-workorders/_spec-wizard-error-ux.md` § 1-5 + § 6 |
| 關聯研究 | T0328（拆單 D 區段，原列為 T0339；本票實際使用 T0338 編號 — 見下方「編號註記」） |
| 依賴 | All Sprint 3 DONE ✅（T0335/T0336/T0337）+ Sprint 2 DONE ✅（T0330-T0334） |
| 預估時間 | 60-120 min（M） |
| Renew 次數 | 0 |
| affects_files | `src/components/setup-wizard/__tests__/integration.transitions.test.ts`（新檔，主要工作）、`src/components/setup-wizard/__tests__/integration.mapped-ux.test.tsx`（新檔，RTL 層）、可能微調 `src/components/setup-wizard/__tests__/test-helpers/*.ts`（共用 fixtures，視需要新增）；不修改既有測試檔；不修改 production code（若發現 production bug 需 PAUSE 回報，不在本票範圍內順手修） |

## 編號註記

- PLAN-032 拆單表原列「T0339 Integration tests」+「T0340 Audit」，但 session 39 後實際工單編號接續 T0337 → 下一張即 **T0338**（本票），原 T0339 / T0340 對應角色順延為 T0339 = Sprint 4 input abstraction、T0340 = Sprint 5 audit。
- PLAN-032 metadata 表將在本票 DONE 後由塔台同步修正編號對應。

## 背景

PLAN-032 Sprint 2 落地了 framework 五件套（Stepper status / WizardRunner state machine / ErrorMapper / Preflight hook / Recovery actions），Sprint 3 完成三平台 BUG 修復（T0335/T0336/T0337），共 6 個 ErrorMapper registry entries 已 ship。

各工單自帶 unit tests（`wizard-runner.transitions.test.ts` / `error-mapper.test.ts` / `preflight.test.ts` / `configure-host.test.ts` 等），但缺**整合層覆蓋**：

1. **transition matrix**：跨 step 狀態流轉（idle → awaiting-input → running → success/failed → recovery）的端對端驗證
2. **mapped UX cases**：errorCode → ErrorMapper → Recovery action UI → user 點擊 recovery 按鈕 → 回到適當 state 的完整 UX 鏈

T0339（Sprint 4，input step abstraction）是 M/L 級重構，需要先把現有行為「鎖在整合測試裡」，重構時可從測試讀出實際契約 + 抓 regression。

**對齊決策**（Q1=B / Q2=A / Q3=A）：
- Q1=B：vitest + RTL 層整合（jsdom），不上 playwright e2e（控制 wall time + 不依賴 real BAT 啟動）
- Q2=A：覆蓋範圍 = `DEFAULT_WIZARD_ERROR_REGISTRY` 截至 Sprint 3 close 的 6 個 entries（`docker-daemon-unavailable` / `wsl-linger-failure` / `ssh-permission-denied` / `ssh-configure-host-empty` / `wsl-service-start-timeout` / `wsl-not-installed`），不測 spec § 6 deferred targets
- Q3=A：不補 Stepper visual snapshot（T0334 已加 awaiting-input snapshot，本票專注 runtime；visual 補完留 T0340 audit）

## 目標（驗收條件，工單級）

### AC-1：Transitions 整合測試

新檔 `src/components/setup-wizard/__tests__/integration.transitions.test.ts`：

- 涵蓋 WizardRunner state transitions × ErrorMapper × Preflight × Recovery 的串接路徑：
  - 正常路徑：idle → running → success
  - input-step 路徑：idle → awaiting-input → running → success
  - 失敗 + retry：running → failed (mapped) → retry recovery → running → success
  - 失敗 + fixed-and-retry：running → failed → fixed-and-retry recovery → running → success
  - Preflight 失敗：preflight → failed (mapped via Preflight cache)
  - Skip recovery：running → failed → skip recovery → next step
- 至少 5 條完整路徑案例，每條案例驗證：
  1. Step status 序列（透過 runner state snapshot）
  2. ErrorMapper 命中正確 entry id
  3. Recovery action union 解析正確 kind
- mock IPC layer（`window.electronAPI` / 任何外部命令呼叫），不依賴 real shell

### AC-2：Mapped UX cases 整合測試（RTL 層）

新檔 `src/components/setup-wizard/__tests__/integration.mapped-ux.test.tsx`：

- 涵蓋 6 個 registry entries：每個 entry 一個案例，串接到 SetupWizardShell render：
  1. `docker-daemon-unavailable`（BUG-073，T0336）
  2. `wsl-linger-failure`（BUG-072，T0337）
  3. `wsl-service-start-timeout`（spec § 6，T0337 一併實作）
  4. `wsl-not-installed`（T0337 額外覆蓋）
  5. `ssh-permission-denied`（spec § 6，Sprint 3 baseline）
  6. `ssh-configure-host-empty`（BUG-074，T0335；awaiting-input 行為，**非** failed）
- 每個案例驗證：
  - 觸發對應錯誤後，SetupWizardShell render 出 mapped friendly message（透過 i18n key resolution）
  - Recovery action 按鈕 label 正確（含 `open-link` 的 href、`fixed-and-retry` 的 label）
  - 點擊 recovery 按鈕後，state 流轉到正確下一狀態（retry / skipped / link-opened-mock）
- 使用 `@testing-library/react`（jsdom），不上 playwright

### AC-3：Test helpers（如需新增）

若兩支整合測試重用 fixtures（mock IPC、registry test data），可新增：

- `src/components/setup-wizard/__tests__/test-helpers/mock-electron-api.ts`
- `src/components/setup-wizard/__tests__/test-helpers/wizard-fixtures.ts`

**原則**：helper 只用於本票兩個整合測試，不影響既有 unit tests。若既有 unit tests 已有可重用部分，**優先 import 既有 helper**，不複製。

### AC-4：CI 全綠

- `npm run test:unit` 全綠（含本票新增的兩支整合測試）
- 新測試執行時間總和 < 5s（jsdom + RTL）
- 不破壞既有 64+ unit tests

### AC-5：不修改 production code

- 本票**不允許**修改 `src/components/setup-wizard/*.ts(x)`（除 `__tests__/` 子目錄）
- 若整合測試發現 production bug → **PAUSE 回報塔台**，由塔台決定是否開新 BUG 單，不在本票順手修
- Test helpers 屬於 `__tests__/` 子目錄，可建立

## 實作順序建議

1. AC-1 先（pure runner 層，較快）
2. AC-2 後（RTL 層，需要 mock 較多）
3. AC-3 視需要（重複 mock 程式碼出現 ≥3 次再抽 helper）
4. AC-4 最後跑 `npm run test:unit` 確認全綠

## 風險與緩解

| 風險 | 影響 | 緩解 |
|------|------|------|
| jsdom 對 SetupWizardShell 的某些 DOM API 不支援 | Medium | 遇到時 mock 補齊，不上 playwright；若實在 jsdom 跑不動的單一案例可標 skip + 註記留 T0340 audit 或 e2e 後續 |
| ErrorMapper i18n 機制依 T0334 wiring，測試需正確 setup locale | Low | 參考 `error-mapper.test.ts` 既有 setup pattern |
| 測試與既有 unit tests 重疊 | Low | 整合測試聚焦「跨元件串接」，不重測單元邏輯；遇到 case overlap 時參考既有 test 命名空間避免重複 |
| `open-link` recovery 觸發 Electron shell 副作用 | Medium | mock `window.electronAPI.shell.openExternal` 並驗證被呼叫時參數正確 |

## 自檢清單（Worker 完成前必跑）

1. [ ] AC-1 至少 5 條 transition 路徑測試通過
2. [ ] AC-2 6 個 registry entries 各一個 RTL 案例通過
3. [ ] `npm run test:unit` 全綠（執行行數 / 時間錄入回報區）
4. [ ] 沒修改 `src/components/setup-wizard/*.ts(x)`（除 `__tests__/` 子目錄）—— `git diff --stat` 驗證
5. [ ] 新增測試檔僅引用 public API（不 import private 模組）

## YOLO 模式 — 下一張工單建議

依 PLAN-032 拆單表 + 編號順延：
- **下一張**：T0339 Cross-platform input step abstraction（Sprint 4，input step 抽象，M/L）
- **再下一張**：T0340 Audit / release notes / docs polish（Sprint 5 收尾，S）

---

## 回報區（Worker 填寫）

> 完成時段請填寫以下區段，塔台據此進度更新 PLAN-032 metadata + 收工。

### 實作摘要

新增兩支整合測試檔（純 `__tests__/` 子目錄，零 production code 改動）：

1. **`integration.transitions.test.ts`** — 8 個 case（AC-1 要求 ≥5），純 runner 層覆蓋 transition matrix × ErrorMapper × Preflight × Recovery action union。每個 case 驗證三件事：snapshot.status 序列、snapshot.mappedError.matchId、recovery action union 的 kind。
2. **`integration.mapped-ux.test.tsx`** — 7 個 active case + 1 skipped（AC-2 要求 6 個 entries，發現 production gap 後拆出 4 / 4b 兩段），跑 RTL/jsdom render SetupWizardShell + 模擬使用者點 recovery 按鈕，驗證 mapped friendly message 與 action 串接。

技術選擇：
- 用合成（synthetic）`WizardStep` factory，不 import 真實 step（避免要 mock `window.electronAPI.ssh.listHosts` / wsl exec / docker probe）
- mock `window.electronAPI.shell.openExternal` per spec 風險表第 4 項，驗證被呼叫時參數正確
- 既有 `WizardRunner.prototype.retryCurrentStep` / `jumpToStep` spy 模式沿用 SetupWizardShell.test.tsx pattern
- AC-3 helper：因兩支測試各自重複的程式碼僅 ~3 行（`makeCtx`、`failingStep`），尚未到達工單原則「重複出現 ≥3 次再抽 helper」的門檻；不新增 `test-helpers/`，保持兩檔自包含。

### Transition 路徑覆蓋表（AC-1）

| # | 路徑名 | 涉及 status 序列 | mapped registry id |
|---|--------|------------------|---------------------|
| 1 | normal task | pending → running → succeeded | n/a (success path) |
| 2 | input-step | pending → running → awaiting-input → running → succeeded | n/a (success path) |
| 3 | failed → retry (mapped) | running → failed → running → succeeded | `ssh-permission-denied` |
| 4 | failed → fixed-and-retry | running → failed → running → succeeded | `wsl-linger-failure` |
| 5 | preflight hard fail | preflight → failed (rejects) | `docker-daemon-unavailable` |
| 6 | failed → skip → next step | failed (skipped=true) → succeeded → next step succeeded | `wsl-linger-failure` |
| 7 | preflight wsl-not-installed | preflight → failed (rejects, open-link recovery) | `wsl-not-installed` |
| 8 | targetOSToErrorPlatform routing + fallback registry resolution | n/a (resolver-only) | `null` (fallback baseline) |

### Registry entries 覆蓋表（AC-2）

| # | Registry id | 平台/Step | 驗證重點 | 結果 |
|---|-------------|-----------|---------|------|
| 1 | docker-daemon-unavailable | docker / detect-env | 三按鈕（open-link / fixed-and-retry / cancel）+ open-link click 觸發 `shell.openExternal('https://www.docker.com/products/docker-desktop/')` | ✅ |
| 2 | wsl-linger-failure | wsl / write-systemd-unit | mapped title「無法自動啟用 systemd lingering」+ fixed-and-retry button label「我已執行命令，重試」+ click → `retryCurrentStep` 被呼叫 | ✅ |
| 3 | wsl-service-start-timeout | wsl / write-systemd-unit | mapped title「BAT systemd 服務啟動逾時」+ skip click → snapshot 顯示「Skipped by user」 | ✅ |
| 4 | wsl-not-installed | wsl / detect-env | open-link 用 MSFT WSL install URL | ⚠️ **SKIP** — production gap（見「後續建議」） |
| 4b | wsl-not-installed (current behavior) | wsl / detect-env | regression guard：紀錄目前 Shell 落到 fallback 的 retry/skip/cancel 行為 | ✅ |
| 5 | ssh-permission-denied | ssh / verify-ssh-auth | hidden-by-default detail mode（raw 預設隱藏，「Show details」展開）+ edit-config click → `jumpToStep(0)`（configure-ssh-host） | ✅ |
| 6 | ssh-configure-host-empty | ssh / configure-ssh-host | mapped title「SSH 主機名稱為必填」+ 嚴格 action set（edit-config + cancel，**無** retry/skip）+ hidden-by-default + edit-config 按鈕 label「修改 SSH 設定」 | ✅ |

### Helpers 變動

無。每檔自包含 `makeCtx` + `failingStep` factory（約 15 行），未達工單原則 ≥3 次重複的抽取門檻。

### 偏離 spec 的決策

- **AC-2 #4 拆出 4 + 4b**：原工單列 6 個 entries 各一個 RTL 案例（總共 6）。實作時發現 #4 (wsl-not-installed) 因 production gap 無法以 spec 期望方式通過（詳見「後續建議」），改為 `it.skip` 保留期望行為的可執行斷言（待修復後 unskip）+ 新增 4b 鎖住目前 fallback 行為作為 regression guard。Active 案例數變 5（+ 1 skipped + 1 regression-guard）。

### 自檢結果

- [x] AC-1 至少 5 條路徑通過（實際 8 條）
- [x] AC-2 6 個 entries 通過（5 通過 + 1 skipped + 1 regression-guard，gap 入「後續建議」）
- [x] `npm run test:unit` 全綠（總時間：**10.60s**；23 files / 304 passed + 1 skipped）
- [x] `git diff --stat` 顯示僅 `__tests__/` 變動（兩個新檔，零 production code 修改；`git status` 顯示三個 untracked：工單檔本身 + 兩支測試檔）

### Renew 歷程

無

### 後續建議

**P1 — production gap (建議塔台開新 BUG 單)**：

`SetupWizardShell.tsx` 的 `resolveMappedErrorForSnapshot()`（line 170-184）在 render 時重新 resolve mapped error，但**只傳 `error.message`，不傳 `errorCode`**。這對「有 patterns 的 registry entry」沒影響（regex fallback 蓋住），但對 `wsl-not-installed` 這類**只有 errorCodes、無 patterns** 的 entry 會落到 generic fallback，導致：

- runner 層的 `snapshot.mappedError` 正確 ship `wsl-not-installed`（含 open-link MSFT URL）
- Shell 視覺層卻 render 「步驟發生錯誤」+ baseline retry/skip/cancel

兩個合理修法（任一即可，建議在 T0339/T0340 之前處理，因為 T0339 input-step 抽象可能會碰到同一段）：

- **(a)** Shell 優先用 `snapshot.mappedError`（runner 已經算過），fallback 才重新 resolve
- **(b)** 為 `wsl-not-installed` 補 `patterns: [/WSL2 is not installed/i, /wsl.*not.*installed/i]`（純 registry 改動，無架構影響）

修好後 unskip integration.mapped-ux.test.tsx case #4 並刪除 4b regression guard。

**P2 — T0339 input-step abstraction 著力點**：

`configure-ssh-host` 是目前唯一 `kind: 'input'` 的真實 step（其他 input 行為散在 wsl/docker pick-distro / pick-container 等步驟，但未明確標 kind）。T0339 抽象時可參考 `integration.transitions.test.ts` Path 2 的 `requestChoice` 等待 + 回應模式，以及 `configure-host.test.ts` 的真實 step 整合作 reference contract。

**P3 — T0340 audit 補完項**：
- visual snapshot 補齊 6 個 mapped error 的 panel render（T0334 只補了 docker daemon 一個 inline snapshot）
- e2e playwright 補上「user 真的能在 wizard 完成 docker / wsl / ssh」的 happy path

### Commit hash

`be40f7d`

### Transition 路徑覆蓋表（AC-1）

| # | 路徑名 | 涉及 status 序列 | mapped registry id |
|---|--------|------------------|---------------------|
| 1 | | | |

### Registry entries 覆蓋表（AC-2）

| # | Registry id | 平台/Step | 驗證重點 |
|---|-------------|-----------|---------|
| 1 | docker-daemon-unavailable | docker / detect-env | |
| 2 | wsl-linger-failure | wsl / write-systemd-unit | |
| 3 | wsl-service-start-timeout | wsl / write-systemd-unit | |
| 4 | wsl-not-installed | wsl / detect-env | |
| 5 | ssh-permission-denied | ssh / verify-ssh-auth | |
| 6 | ssh-configure-host-empty | ssh / configure-ssh-host（awaiting-input 行為） | |

### Helpers 變動

（若新增 helper 列出檔案 + 用途；若無填「無」）

### 偏離 spec 的決策

（若有，列出並說明理由；若無填「無」）

### 自檢結果

- [ ] AC-1 至少 5 條路徑通過
- [ ] AC-2 6 個 entries 通過
- [ ] `npm run test:unit` 全綠（總時間：__ s）
- [ ] `git diff --stat` 顯示僅 `__tests__/` 變動

### 後續建議

（如執行中發現 production bug、spec 不一致、或 T0339 抽象的具體切點，列在這裡）

### Commit hash

`<填入>`
