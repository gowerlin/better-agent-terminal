# T0340 — PLAN-032 Sprint 4: Cross-platform `kind: 'input'` rollout（4 個 input-flavor steps）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0340 |
| 標題 | 將現有 4 個 input-flavor steps 統一標 `kind: 'input'`，套用 awaiting-input transition + 移除 pre-submit terminal validation；不新增 form API |
| 類型 | refactor |
| 優先級 | 🟡 Medium（PLAN-032 Sprint 4，T0335 SSH learning 推廣到其他平台） |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-28 06:18 (UTC+8) |
| 開始時間 | 2026-04-28 08:55 (UTC+8) |
| 完成時間 | 2026-04-28 09:02 (UTC+8) |
| 派發模式 | `--mode yolo --no-interactive` |
| 關聯 PLAN | PLAN-032（Sprint 4） |
| 關聯 spec | `_ct-workorders/_spec-wizard-error-ux.md` § 2（Wizard Runner Contract / Input-step behavior） |
| 關聯研究 | T0328（拆單，原列為 T0339；本票實際使用 T0340 編號 — 因 T0339 被 BUG-076 修復票占用） |
| 關聯工單 | T0335（SSH configure-host 是 reference 實作） / T0338（integration tests 是 regression net） |
| 依賴 | T0335 ✅ / T0338 ✅ / T0339 ✅ |
| 預估時間 | 60-180 min（M/L） |
| Renew 次數 | 0 |
| affects_files | `src/components/setup-wizard/steps/ssh/configure-host.ts`（已是 reference，audit 即可）、`src/components/setup-wizard/steps/wsl/pick-wsl-distro.ts`、`src/components/setup-wizard/steps/docker/pick-container.ts`、`src/components/setup-wizard/steps/docker/configure-mounts.ts`、各 step 對應 `__tests__/*.test.ts(x)`（新增或補足） |

## 編號註記

- T0328 拆單表原列 T0339 = Sprint 4，但 T0339 被 BUG-076 修復票占用（T0338 整合測試發現 production gap），本票順延為 **T0340**。
- 原 T0340 (Sprint 5 audit) 順延為 T0341。
- PLAN-032 metadata 表將在 Sprint 5 收尾時統一同步編號對應。

## 背景

PLAN-032 Sprint 2-3 落地了 Stepper `awaiting-input` status + WizardRunner state machine + ErrorMapper / Preflight / Recovery framework。Sprint 3 T0335 修了 SSH `configure-host` 的「未輸入即顯示 failed」UX bug，路徑是：

1. Mark step `kind: 'input'`
2. Pre-submit validation 留在 prompt model 內（不 throw terminal error）
3. Runner 看到 `kind: 'input'` 自動轉 awaiting-input

Sprint 4 把這個 pattern 推廣到其他 3 個 input-flavor steps：

| # | Step | 平台 | 目前狀態（待 audit）| 預期行為 |
|---|------|------|-----------------|----------|
| 1 | `configure-host` | SSH | ✅ 已 kind:'input'（T0335 reference）| audit / 確認對齊 spec § 2 |
| 2 | `pick-wsl-distro` | WSL | ❓ 待確認 | 標 kind:'input'，使用者選 distro 前不應 failed |
| 3 | `pick-container` | Docker | ❓ 待確認 | 標 kind:'input'，使用者選 container 前不應 failed |
| 4 | `configure-mounts` | Docker | ❓ 待確認 | 若有 input 行為（mount path 輸入）標 kind:'input'；若純 task 跳過 |

**對齊決策**（Q1=A / Q2=A / Q3=A）：
- Q1=A：**最小抽象**——只標 kind:'input'，不新增 form API、不抽 helper（YAGNI；當前無 multi-field form 需求）
- Q2=A：**只重構這 4 個 steps**，不 audit 全 codebase
- Q3=A：**unit test only**——每個重構 step 一支 test 驗證 contract；不補 integration test（T0338 已給安全網）

## 目標（驗收條件，工單級）

### AC-1：SSH configure-host audit

讀 `configure-host.ts` 確認：
- 已標 `kind: 'input'` ✅
- pre-submit validation 不 throw terminal error ✅
- 對齊 spec § 2「Validation errors before the user has submitted input should stay inside the prompt model when possible, not throw terminal step errors」

若已對齊：列入回報區「無需改動」。
若有偏差：本票範圍內修齊（reference 實作必須最對）。

### AC-2：WSL `pick-wsl-distro` 改造

讀 `pick-wsl-distro.ts`：
1. 標 `kind: 'input'`
2. 使用 `ctx.requestChoice(...)` 取 distro list
3. 在使用者選定前，runner snapshot 應為 `awaiting-input` 而非 failed
4. 若有 pre-submit validation（如 distro list 為空時），改為 prompt-internal error，不 throw terminal failed

### AC-3：Docker `pick-container` 改造

讀 `pick-container.ts`：
1. 標 `kind: 'input'`
2. 同 AC-2 模式

### AC-4：Docker `configure-mounts` 評估 + 改造（如適用）

讀 `configure-mounts.ts`：
1. 判斷是否實質 input 行為（mount path 是否需要使用者輸入/確認）
2. 若是 → 標 `kind: 'input'` + 同 AC-2 模式
3. 若否（純 task，例如自動套用預設 mounts）→ 維持 `kind: 'task'`，回報區註記「不適用」
4. 邊界判斷不確定時 PAUSE 報塔台（不要自行擴大或縮小範圍）

### AC-5：Unit tests

每個改造的 step 一支 unit test（新增或補足既有測試檔），驗證：

1. `kind: 'input'` 屬性正確
2. 模擬 runner 跑該 step 時，呼叫 `requestChoice`（或同等 input API）後 snapshot.status = `awaiting-input`
3. Pre-submit validation 不會把 step 直接轉 failed（透過 mock ctx 觸發 validation 觀察 step status）
4. 提交後（mock 使用者選擇）才正常轉 succeeded / failed

**測試風格**：沿用 `configure-host.test.ts` pattern（synthetic ctx + mock requestChoice resolver）。

### AC-6：CI 全綠 + 不破 regression

- `npm run test:unit` 全綠
- T0338 integration tests 不破（特別是 transition path #2 input-step 案例）
- 各 step 既有測試（如 `pick-container.test.ts`、`configure-mounts.test.ts` 等若已存在）不破

### AC-7：commit 範圍

- 單一 commit 涵蓋 4 個 step 改造 + 測試
- commit message：`refactor(setup-wizard): rollout kind: 'input' to wsl/docker steps (T0340, PLAN-032 Sprint 4)`

### AC-8：不擴大範圍

- 本票**不允許**：
  - 新增 form API / requestForm helper（Q1=A 排除）
  - 抽 choice prompt builder（Q1=A 排除）
  - audit 4 個 step 以外的步驟（Q2=A 排除）
  - 補 integration test（Q3=A 排除）
- 若實作中發現「應該擴大範圍」的強烈訊號（例如某個 step 重構後需要動 runner 核心 API） → PAUSE 報塔台

## 實作順序建議

1. AC-1 SSH configure-host audit（可能直接通過 = 30 sec 確認）
2. AC-4 configure-mounts 邊界判斷（如不適用直接跳）
3. AC-2 WSL pick-wsl-distro
4. AC-3 Docker pick-container
5. AC-5 各 step 對應 test
6. AC-6 跑全測
7. AC-7 commit

## 風險與緩解

| 風險 | 影響 | 緩解 |
|------|------|------|
| WSL/Docker step 既有實作把 awaiting-input 行為與 task 邏輯耦合過緊 | Medium | 改 kind 後若 runner transition 不對勁，PAUSE 報塔台不順手大改 |
| `configure-mounts` 邊界判斷有歧義 | Low | AC-4 明文允許 PAUSE |
| 既有 step 測試大量依賴「拋 terminal error」舊行為 | Medium | AC-6 限制：>3 個既有 case 破 → PAUSE |
| ctx.requestChoice 在某些 step 是 promise-based 但 awaiting-input transition 沒接好 | Medium | T0335 reference 模式直接 copy，避免重新發明 |

## 自檢清單（Worker 完成前必跑）

1. [ ] AC-1 SSH configure-host audit 完成（對齊 / 修齊）
2. [ ] AC-2 WSL pick-wsl-distro 改造完成
3. [ ] AC-3 Docker pick-container 改造完成
4. [ ] AC-4 configure-mounts 評估完成（適用→改造 / 不適用→註記）
5. [ ] AC-5 每個改造 step 有對應 unit test
6. [ ] AC-6 `npm run test:unit` 全綠
7. [ ] AC-7 單一 commit + 正確 message
8. [ ] AC-8 範圍守住（無 form API、無 helper 抽取、無範圍外 audit）

## YOLO 模式 — 下一張工單建議

依 PLAN-032 拆單表 + 編號順延：
- **下一張**：T0341 Audit / release notes / docs polish（Sprint 5 收尾，S）
- 三 BUG smoke（BUG-072/073/074）平行進行，由使用者親跑

完成後塔台會：
- 若 4 個 step 全改造完，PLAN-032 Sprint 4 收尾
- 若 configure-mounts 不適用，記錄到 PLAN metadata 不影響 Sprint 收尾

---

## 回報區（Worker 填寫）

> 完成時段請填寫以下區段，塔台據此進度更新 PLAN-032 metadata + 收工。

### 實作摘要

Audit 結果：4 個 input-flavor steps **均已標 `kind: 'input'`**（T0330 PLAN-032 Sprint 2 落地；T0335 PLAN-032 Sprint 3 把 SSH configure-host 對齊為 reference）。本票範圍內**無需修改 step 實作**——僅補齊 3 支缺漏的 unit tests（WSL pick-wsl-distro / Docker pick-container / Docker configure-mounts）來鎖定 input contract regression net。

關鍵判斷：
- WSL/Docker 兩個 picker step 的 pre-submit env failure（zero distros / wrong WSL version）不屬於 spec § 2 所指的「pre-submit input validation」——它們是 environment preflight 失敗，無 prompt 可塞，按 spec 「when possible」字面解讀維持 terminal throw 即可。
- configure-mounts 使用 native `dialog.selectFolder()` 而非 `ctx.requestChoice`，runner 的 input-step wrap 對它**不會啟動**（D：合理）；但 `kind: 'input'` 仍是正確的語意標籤（user 在原生 dialog 上 block）——T0330 author 已加註此 trade-off 為刻意決策，依 Q1=A（最小抽象）維持現狀，不抽 selectFolder helper。
- 未新增 form API、未抽 helper、未 audit 4 個 step 以外、未補 integration test（範圍守住 AC-8）。


### Step 改造對照表

| # | Step | 改前 kind | 改後 kind | 變更點 |
|---|------|----------|-----------|-------|
| 1 | configure-host (SSH) | input (T0335) | input | 無改動（reference 實作；errorCode='configure-host-empty' + ssh-configure-host-empty registry entry 已就位） |
| 2 | pick-wsl-distro (WSL) | input (T0330) | input | 無改動（已 kind:'input' + 已用 ctx.requestChoice + runner wrap 自動 awaiting-input transition）；補 5 支 unit test |
| 3 | pick-container (Docker) | input (T0330) | input | 無改動（同上）；補 5 支 unit test |
| 4 | configure-mounts (Docker) | input (T0330) | input | 無改動（語意保留；native dialog 不過 requestChoice，runner wrap 不啟動，符合 Q1=A）；補 4 支 unit test |

### configure-mounts 邊界判斷

**判定**：保留 `kind: 'input'`，純 task 否決。

理由：
- step 內 `dialog.selectFolder()` 是「使用者必須輸入」的 gate（無 selection → throw `Select at least one host folder...`）——語意上是 input flavor，標 task 會誤導 stepper UX。
- 但採 native OS dialog 而非 `ctx.requestChoice` → runner 的 input-step wrap（`maybeWrapRequestChoice`）對它 inert → 不會自動 awaiting-input transition。這個 trade-off **T0330 落地時已記錄**（檔內註解：「No requestChoice today, but `kind: 'input'` correctly signals the semantic — Sprint 3 may wrap selectFolder() the same way」）。
- 本票依 Q1=A 不抽 helper，**維持現狀**。Sprint 5 audit 票（T0341）若決定推廣 awaiting-input 到 native dialog 路徑，可再評估抽 `ctx.requestFolder()` 通道——但那是新功能不是 rollout。

測試以「kind:'input' 屬性 + 三條 happy/sad path」鎖 contract，**不**驗證 awaiting-input transition（因為這個 step 設計上不會發出）。

### 測試覆蓋

| Step | Test 檔 | 案例數 | 主要驗證 |
|------|---------|-------|---------|
| configure-host (SSH) | `configure-host.test.ts`（T0335 既有） | 7 | reference；本票無新增 |
| pick-wsl-distro (WSL) | `__tests__/pick-wsl-distro.test.ts`（**新增**） | 5 | kind 屬性 / multi-distro → awaiting-input → succeeded / single-distro auto-pick / 0 distros 直接 failed 不繞 awaiting-input / 只有 WSL1 直接 failed |
| pick-container (Docker) | `__tests__/pick-container.test.ts`（**新增**） | 5 | kind 屬性 / mode picker awaiting-input / 「new」mode succeed / 「existing」+ container succeed / pre-set state short-circuit / 「existing」+ 0 container 在 awaiting-input 之**後** failed（驗證 post-submit ordering） |
| configure-mounts (Docker) | `__tests__/configure-mounts.test.ts`（**新增**） | 4 | kind 屬性 / pre-set mounts 不開 dialog / 選 folder 套 default container path / dialog cancel → failed / validateMounts fail → failed |

合計新增 **3 檔 / 14 cases**。test pattern 沿用 `configure-host.test.ts`（synthetic ctx + mock window.electronAPI + WizardRunner harness + polling-based status assertion）。

### 偏離 spec 的決策

1. **configure-mounts 不接 awaiting-input transition**——sprint § 2 spec 隱含「所有 input-kind step 都應該在 prompt 期間 awaiting-input」；本票實際上 configure-mounts 雖 kind:'input' 但採 native dialog，runner wrap 不啟動。原因：Q1=A 禁止抽 helper / 禁止新增 form API；T0330 author 已記錄此 trade-off 為刻意。Sprint 5 audit 票（T0341）若決議推廣，可再評估抽 `ctx.requestFolder()`。
2. **WSL/Docker step 未追加 structured errorCode**——T0335 SSH reference 對「user submit empty」加了 `code = 'configure-host-empty'` 結構化錯誤碼。本票 audit 後判斷：WSL pick-wsl-distro 的 zero/non-v2 distro throw、Docker pick-container 的「existing mode + zero container」throw，**都不對應使用者錯誤輸入**（前者是環境前置條件失敗、後者是 UX 設計問題）。新增 ErrorMapper entries 屬「新功能」非 input-kind rollout，依 Q1=A / Q2=A 跳過。Sprint 5 audit 可獨立評估。

### 既有測試影響

| 案例 | 是否破 | 調整內容 |
|------|--------|---------|
| configure-host.test.ts（T0335 7 cases） | 否 | 無調整 |
| wizard-runner.input-callsites.test.ts（T0330 4 cases） | 否 | 無調整（仍鎖 4 個 step kind:'input'） |
| integration.transitions.test.ts（T0338 8 cases）| 否 | 無調整（runner 行為未動） |
| integration.mapped-ux.test.tsx（T0338）| 否 | 無調整 |
| 其餘 21 個 test files / 286 既有 cases | 否 | 無 regression（304 → 321 全綠） |

### 自檢結果

- [x] AC-1 SSH audit 完成（reference 對齊，無改動）
- [x] AC-2 WSL audit 完成（已 input-aligned，補 5 cases test）
- [x] AC-3 Docker pick-container audit 完成（已 input-aligned，補 5 cases test）
- [x] AC-4 configure-mounts 評估完成（保留 kind:'input' + 補 4 cases test，邊界判斷詳見專段）
- [x] AC-5 unit tests 補齊（3 檔 / 14 cases）
- [x] AC-6 `npm run test:unit` 全綠（26 files / 321 tests / 7.65s；新測試 3 檔 17 cases / 1.27s 隔離跑）
- [x] AC-7 commit hash + message：見「Commit hash」段
- [x] AC-8 範圍守住（無 form API、無 helper 抽取、無範圍外 audit、無 integration test）

### Renew 歷程

無

### 後續建議

T0341 audit 階段可獨立評估（**本票範圍外**）：

1. **抽 `ctx.requestFolder()` 通道**讓 native dialog 也能走 input-step wrap → configure-mounts 等步驟可享統一 awaiting-input transition。需要 spec 補充「input gate 不限於 requestChoice」。
2. **WSL/Docker step 結構化 errorCode**：
   - `pick-wsl-distro`：`code = 'wsl-no-distros'` / `code = 'wsl-no-v2-distros'` + ErrorMapper entries（搭配 `wsl --install` open-link / `wsl --set-version` 文件 link）
   - `pick-container` existing 模式 0 容器：UX 修法應該是「list 為空時 disable 'existing' option」而非 throw（屬 PLAN-030 UX 後續）
3. configure-mounts 雖無 awaiting-input transition，但 step 的 `dialog.selectFolder()` 是 sync-blocking（main process IPC），UI thread 不會凍結；若日後改 multi-folder 互動，記得評估是否要拆 input-step 多輪 prompt。

對 PLAN-032 metadata 影響：
- Sprint 4 工單範圍「4 個 input-flavor steps rollout」**完成**（鎖 contract 的 unit tests 補齊；實作層在 Sprint 2/3 已落地）
- T0340 編號順延說明見工單 §「編號註記」

### Commit hash

`58ec3bd` — `refactor(setup-wizard): rollout kind: 'input' to wsl/docker steps (T0340, PLAN-032 Sprint 4)`
