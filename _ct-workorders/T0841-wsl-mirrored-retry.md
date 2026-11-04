---
schema_version: 1
schema_kind: workorder
id: T0841
title: "PLAN-043 W4：connect-test 失敗且網路模式是 NAT 時，提供「改用 Mirrored 並重試」（P-5，含原則檢查與 Running 發行版列表）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-04T09:17:09+0800"
started_at: "2026-11-04T12:48:05+0800"
updated_at: "2026-11-04T13:09:04+0800"
completed_at: "2026-11-04T13:09:04+0800"
session_ids:
  - "09d4172b-838a-4fdd-830f-b7eb84d9f380"
depends_on: [T0840]
related:
  - "PLAN-043 Phase 2；D272；T0831 回報區（P-5、〈調查結論〉4、〈建議下一步〉W4）；T0383 / T0653（NAT 一般可用）"
affects_files:
  - _ct-workorders/T0841-wsl-mirrored-retry.md
  - src/components/setup-wizard/
  - electron/wsl-env-apply.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - e2e/v071-pre2-acceptance.spec.ts
  - docs/wsl-deployment.md
  - CHANGELOG.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只在 connect-test 失敗且實際網路模式 = nat 時出現；有 WSL 網路原則（`AllowNetworkingModeUserSetting=0` / `DefaultNetworkingMode`）或使用者已在 `.wslconfig` 宣告非 mirrored 的 `networkingMode` → 不提供，只提示。同意框列出目前 Running 的發行版（`wsl --shutdown` 會全部關閉）；寫入前備份 `.wslconfig`，用 T0838 編輯器。"
  - "🔴 🔴 本單任何會執行 `wsl --shutdown` 的實測，先停下問塔台（使用者 D272：`--shutdown` 先問）；單元測試一律 mock。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0841 — PLAN-043 W4：改用 Mirrored 並重試

## 元資料
- **工單編號**：T0841｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-04 09:17 (UTC+8)
- **依賴**：T0840｜**規模**：S

## 任務指令
1. 讀 T0831 回報區 P-5 與〈調查結論〉4。
2. connect-test 錯誤畫面加動作「改用 Mirrored 並重試」→ 小型同意框 → 備份並寫 `.wslconfig` `[wsl2] networkingMode=mirrored` → `wsl --shutdown` → 等 keep-alive 拉起 → 重跑 connect-test。
3. 測試（mock）：條件判斷（nat / 原則 / 使用者已宣告）、同意框內容、寫入與備份、shutdown 後重跑。i18n、docs、`CHANGELOG.md`。
4. 實機 `--shutdown` 實測：先問塔台；未獲同意就列〈待實機驗收〉。
5. **塔台補充（開工前併入，來自 T0840 回報〈遭遇問題〉）**：
   - `e2e/v071-pre2-acceptance.spec.ts`（約 848–877 行）V3 兩項仍斷言舊行為（`wsl1Only` 警告、`systemdDisabled` 警告）；依 T0840 後的新行為更新斷言（只有 WSL1 → 清單提議轉換；systemd 沒開 → 清單提議開啟、沒開成則第 5 步 `wsl-systemd-disabled`）。只改斷言，不必在本單執行整份驗收 spec；能跑就跑並附輸出。
   - 沿用 T0840 的模組：`.wslconfig` 寫入走 `electron/wsl-env-apply.ts`（`WslEnvApplier`）的同一套「先偵測 → 備份 → stdin / 檔案寫入 → 讀回驗證」，同意框沿用 `WizardConsentChecklist.tsx` 的樣式與範圍標籤，不另寫一套。
   - 塔台裁決（不改）：`wsl --set-version` 維持「無法中止」標示（T0840 實測 2.7.14 結束 client 會中斷轉換且發行版完好，但大型發行版中途打斷的安全性未驗證，維持保守）。

### 驗收條件
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全過、`npx vite build` 成功
- [ ] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：要不要在使用者機器上做實機 `wsl --shutdown` 實測（工單第 4 步）？
- **提問時間**：2026-11-04T13:06:08+0800
- **背景**：產品已完成並 commit（`715c30de`），typecheck ×2 = 0、`test:unit` 全過、`test:legacy` 全過、`vite build` 成功、e2e V3 改後 4 項 PASS；單元測試全程 mock，沒有執行過 `--shutdown`。唯讀查到：本機 `%USERPROFILE%\.wslconfig` **已是** `networkingMode=Mirrored`、沒有 `HKLM\SOFTWARE\Policies\WSL`、唯一發行版 `Ubuntu-24.04`（Stopped）、build 28000。所以 P-5 在這台機器不會自然出現；實測必須先把使用者的 `.wslconfig` 暫改成 NAT。
- **選項**：
  - A：不做實機實測，列〈待實機驗收〉（附步驟），交使用者在同意的時段做。
  - B：做。流程：備份 `.wslconfig` → 暫改 `networkingMode=nat` → `wsl --shutdown`（#1）→ 以 `npx tsx` 直接呼叫 `WslEnvApplier.applyNetworkingMirrored('Ubuntu-24.04')`（寫回 mirrored＋備份、`wsl --shutdown`（#2）、等發行版 Running、`wslinfo` 驗證）→ 比對檔案與備份 → 把 `.wslconfig` 還原成原檔（逐位元比對）。共 **2 次 `--shutdown`**，會關閉所有發行版與 BAT 內的 WSL 分頁 / keep-alive；`Ubuntu-24.04` 會被啟動。不經精靈畫面（精靈需要完整的 WSL profile 流程）。
  - 其他
- **建議**：A。使用者機器已是 Mirrored，實測要先改壞再改回，且兩次 `--shutdown` 會打斷使用者其他 WSL 工作；邏輯已由 mock 單元測試＋e2e 涵蓋。
- **影響**：選 B 需約 2–3 分鐘、兩次全機 WSL 關閉；選 A 則實機驗收留給使用者。
- **是否阻擋後續步驟**：只阻擋第 4 步與收尾；其餘已完成。
- **通道**：BAT（`q-e42318d1-31e9885e78303735`），塔台 13:07 答覆 A，內容記在〈互動紀錄〉。

### 完成狀態

- **狀態**：DONE（實機 `--shutdown` 實測依 Q-1 塔台答覆 A（使用者裁決）不做，列〈待實機驗收〉）
- **session_id**：09d4172b-838a-4fdd-830f-b7eb84d9f380
- **落點檢查**：PASS。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1：工單在 `REPO_ROOT/_ct-workorders/`；C-3：`affects_files` 抽查路徑都存在；C-2：沒有 `branch` 欄位（實際 `main`）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_REMOTE_TOKEN` 已設定；`CT_HOME` 未設（不是 worktree）。
- **產品 commit**：`715c30de96ff94804cc2738bc1f4a5ae7b51773e`（19 個檔，`git add` 明確路徑；沒有 push）。驗證關卡跑在這個 commit 的程式碼上；之後只再改了 `docs/wsl-deployment.md`、`CHANGELOG.md`（同一個 commit 內、驗證後寫的文件，不影響關卡）。工單檔另有 commit（`032213f4` 提問、收尾 commit）。
- **相關通過案例**：工單沒有這一段，不適用。

### 產出摘要

**流程**（只在 WSL 精靈、`connect-test` 失敗且 `ctx.networkMode === 'nat'` 時）：

| 項目 | 實作 | 位置 |
|---|---|---|
| 條件判斷（純函式） | `wslMirroredRetryOffer(networkMode, facts)`：非 NAT / 非 Windows → 不提供、無提示；`AllowNetworkingModeUserSetting=0` 或有 `DefaultNetworkingMode` → `policy`；原則鍵讀不到 → `policy-unknown`；`.wslconfig` 無法讀 / 編碼錯 / 無法解析 → `wslconfig-unreadable`；已宣告非 mirrored（含未知值）→ `declared`（提示帶模式）；build < 22621 → `windows-unsupported`；WSL < 2.0.4 → `wsl-too-old`。已宣告 mirrored 但實際仍 NAT → **提供**（不寫檔、只 shutdown）。原則先於宣告判斷 | `src/components/setup-wizard/wsl-env-plan.ts` |
| connect-test 失敗 | NAT 失敗後照舊推 `connectFailedNat` 警告，再 `wsl.detectFacts(distro)`（可中止）算 offer：提供 → 丟 `wsl-connect-test-failed-nat`（原始錯誤文字保留）；不提供 → 照舊 `connect-test-failed`＋一行提示；`detectFacts` 不存在或失敗 → 與以前完全相同。SSH / Docker / 非 NAT 不呼叫 `detectFacts` | `steps/wsl/connect-test.ts` |
| 錯誤畫面 | 新 registry `wsl-connect-test-failed-nat`：動作「改用 Mirrored 並重試」→ 重試 / 略過 / 取消；`wsl-mirrored-retry-failed`（policy / declared / wslconfig-write / shutdown / not-applied 五個碼）：重試 / 略過 / 取消。`connect-test-failed` 不變 | `error-mapper.ts` |
| Shell 動作 | 新 action kind `wsl-mirrored-retry`：設 `ctx.state.wslMirroredRetryRequested` 後 `retryCurrentStep()`；同意框與套用都在步驟內（所以有 T0830 中止、無法中止標記、變更紀錄） | `SetupWizardShell.tsx` |
| 同意框 | 沿用 T0840 `WizardConsentChecklist`：一個選用項（預設不勾、範圍「此使用者」、副作用 `shutdown-all-distros`），勾選後確認鈕上方列出目前 Running 的發行版；新增選用的 `confirmKey` / `declineKey`（「改用 Mirrored 並重試」/「維持 NAT」）——T0840 的清單不帶這兩欄，畫面不變。重試時**重新偵測**（期間出現原則 → 只提示、不問） | `wizard-runner.ts`、`WizardConsentChecklist.tsx`、`connect-test.ts` `buildMirroredConsentRequest` |
| 套用（main） | `WslEnvApplier.applyNetworkingMirrored(distro)`：白名單 → 非 win32 拒絕 → `reg.exe query HKLM\SOFTWARE\Policies\WSL`（System32 絕對路徑）重新檢查原則 → 讀 `.wslconfig`（T0838 decoder）→ 宣告非 mirrored 不寫 → 已是 mirrored（不分大小寫）不寫 → 否則備份 `.wslconfig.bat-backup-<系統時間>`（`COPYFILE_EXCL`，不覆寫舊備份）→ `setIniValue` 只改一行、保留編碼與換行 → 暫存檔＋rename → 讀回驗證 → `wsl --shutdown`（**不帶** signal、timeout 60 s）→ 等發行版 Running（keep-alive 拉起，最多 20 次 × 1 s）→ `wsl -d <d> -- wslinfo --networking-mode` 必須是 `mirrored`。日誌只記項目 / 結果 / 數量 / 耗時，不記檔案內容 | `electron/wsl-env-apply.ts` |
| IPC | `wsl:apply-network-mirrored`（本機 `ipcMain.handle`，可中止）：呼叫前先 `wslKeepAlive.pin(distro)`；preload / 型別 `wsl.applyNetworkMirrored` | `main.ts`、`preload.ts`、`electron.d.ts` |
| 重跑連線測試 | 套用成功 → `ctx.networkMode = 'mirrored'`，連線測試改為最多 15 次 × 2 s（伺服器隨發行版重啟）；拒絕 → 不連線、直接丟同一個 NAT 錯誤（可再按）。失敗 / 中止前做的變更記進 `ctx.state.wslAppliedChanges`（`recordWslAppliedChanges` 由 apply 步驟匯出共用） | `connect-test.ts`、`apply-wsl-environment.ts` |
| 完成 / 取消畫面 | `WslAppliedChangesBox` 對 `network-mirrored` 用新文字（「已修改 <路徑>（WSL 網路模式改成 Mirrored；套用到這個 Windows 使用者的所有 WSL 2 發行版）」）＋備份路徑 | `WizardConsentChecklist.tsx` |
| i18n | en / zh-TW / zh-CN 各 20 個 key：`wizard.action.wslMirroredRetry`、`wizard.wsl.error.connectTestFailedNat.*` / `mirroredFailed.*`、`wizard.wsl.apply.changes.wslconfig`、`wizard.wsl.mirrored.*`（標題、說明、確認 / 維持、無法中止、項目、6 個提示）；T0840 根 `wizard.wsl.apply` 三語 key 集合仍一致 | `src/locales/*.json` |
| 文件 | `docs/wsl-deployment.md`：步驟表第 9 步、新小節〈Switch to Mirrored and retry (T0841)〉（不提供的情況表、5 個步驟、失敗與還原）、疑難排解〈NAT warning〉、實機清單一項；`CHANGELOG.md` `[Unreleased]` Added 一條 | |
| e2e 斷言（塔台補充） | `e2e/v071-pre2-acceptance.spec.ts`：V3 兩項改為新行為——只有 WSL1 → 清單出現 `wsl2-convert`（未勾）、無 `wsl1Only` 警告、確認後 `wsl-requires-wsl2`；systemd 沒開 → 清單出現 `enable-systemd`（已勾）、套用 stub 成功但 `wsl:systemd-running` false → 第 5 步 `wsl-systemd-disabled`（不碰安裝 IPC）。原本同測試的 `V4.a-wsl-home-unresolved` 移到第三個測試（健康環境、無清單）保留涵蓋。新增 `wslFactsStub()` | `e2e/v071-pre2-acceptance.spec.ts` |

**行為變化（逐項）**

| # | 情境 | 以前 | 現在 |
|---|---|---|---|
| 1 | WSL、NAT、連線測試失敗、無原則 / 無宣告 | `connect-test-failed`＋NAT 警告（文件教手動改） | 錯誤畫面多「改用 Mirrored 並重試」（標題「連線測試失敗（WSL 為 NAT 模式）」） |
| 2 | 同上但有網路原則 / 已宣告其他模式 / `.wslconfig` 壞 / Windows、WSL 太舊 | 同上 | 照舊 `connect-test-failed`，多一行原因提示 |
| 3 | NAT 連線成功、mirrored 失敗、SSH / Docker | — | 不變（不呼叫 `detectFacts`） |
| 4 | 舊 preload（沒有 `detectFacts`）或探測失敗 | — | 與以前完全相同 |

### 驗證證據分道

| 分道 | 結果 |
|---|---|
| source | PASS：`wsl-env-apply.ts` 仍沒有 electron import / `getPath(` / shell 型 exec（既有＋新 source guard）；`reg.exe` 用 System32 絕對路徑、陣列參數；`.wslconfig` 路徑使用時才解析；`main.ts` 在套用前 pin keep-alive（source guard） |
| 型別 | PASS：`npm run typecheck` = 0、`npm run typecheck:electron` = 0；e2e spec 另以 `tsc --noEmit --strict` 檢查無錯 |
| 單元測試 | PASS：`npm run test:unit` 434 個檔通過 / 3 skipped，7702 個測試通過 / 40 skipped，0 失敗。新增 `electron/__tests__/wsl-env-apply-mirrored.test.ts`（27 個：兩種原則與讀不到原則都不讀不寫不 shutdown、無網路值的原則鍵放行＋reg argv、5 種宣告值不寫、無法解析不寫、備份＋只加一行＋CRLF 保留＋暫存 rename＋讀回、UTF-16 BOM 保留、無檔建立不備份、已是 `Mirrored` 不寫但 shutdown、寫入沒生效不 shutdown、rename 失敗清暫存檔、不覆寫同名備份、shutdown 失敗、仍 NAT → not-applied、發行版一直沒 Running 仍以 wslinfo 驗證、shutdown 不帶 signal＋timeout、先中止則完全不動、shutdown 中中止則跳過驗證、日誌不含內容、白名單 / 非 Windows、`apply()` 不接受 P-5 id、main pin 順序、source guard）、`src/components/setup-wizard/__tests__/wsl-mirrored-retry.test.tsx`（53 個：offer 各組合、NAT 失敗各分支、同意框內容與 RTL（範圍、選用、總結列出 Running、確認 / 維持）、T0840 清單不變、同意→套用→無法中止標記→變更紀錄→延長重試成功、延長後仍失敗、拒絕（`[]` / `null`）不套用不連線、重試時重新偵測、5 種套用失敗碼、中止、operationId、registry 三組、Shell 整合 2 個（錯誤畫面→動作→同意框→完成畫面列 `.wslconfig` 變更；拒絕回到同一錯誤畫面）、i18n 三語 key / placeholder / 已翻譯、每個提示 key 存在）。全程 mock，**沒有執行過 `wsl --shutdown`** |
| legacy | PASS：`npm run test:legacy` 33 檔、472 個測試 0 失敗 |
| build | PASS：`npx vite build` 成功 |
| e2e（塔台補充要求「能跑就跑」） | PASS：`npm run build:dir` 打出 `release/win-unpacked`（0.7.4-pre.6，含本單），以 `BAT_E2E_V071PRE2=1`、`BAT_E2E_EXECUTABLE=<win-unpacked exe>` 跑 `-g "WSL wizard"`：4 passed。結果：`V3.wsl-wizard-title-and-distro-menu`、`V5.wsl-buttons`、`V5.wsl-step-text`、`V3.wsl1-convert-offered`、`V4.a-wsl-requires-wsl2`、`V3.wsl-systemd-offered`、`V4.a-wsl-systemd-disabled`、`V4.a-wsl-home-unresolved`、`SAFETY.wizard-no-write`（guard 19 次全 stub、0 blocked）、`CLEANUP.wizard` 全 PASS。spec 寫死 `EXPECTED_VERSION = '0.7.1-pre.2'`，版本 soft-fail 會讓 serial 模式後續測試不跑，所以用一份只改這個常數的暫存副本 `e2e/zz-t0841-tmp-v071.spec.ts` 執行，跑完即刪（沒有 commit）；第一次以原檔執行的結果是版本兩項 FAIL、其餘 PASS 但後 3 項未跑。證據在 scratchpad `t0841-e2e/results.json` |
| 實機 `--shutdown` | 未做（Q-1 塔台答覆 A，使用者裁決）；見〈待實機驗收〉 |

### 互動紀錄

- [13:07] Q-1（BAT 通道，`q-e42318d1-31e9885e78303735`）：要不要在使用者機器上做實機 `wsl --shutdown` 實測？ → A（塔台，使用者 2026-11-04 裁決）：選 A，不做實測、不改使用者的 `.wslconfig`；實機步驟寫進〈待實機驗收〉（前提：備份、暫改 NAT、同意時段；預期結果與還原步驟），然後收尾。 → Action：寫〈待實機驗收〉，`tower_question` 已刪除，收尾。
- 沒有 compact / resume。三個塔台補充檢查節點（驗證前、產品 commit 前、填回報前）都沒有新的 `## 塔台補充（…）`。

### 待實機驗收

> 只在使用者同意的時段做：會執行 **兩次** `wsl --shutdown`，所有發行版、BAT 內的 WSL 分頁與 keep-alive 都會被關閉。使用者這台機器的 `.wslconfig` 目前是 `networkingMode=Mirrored`（2026-11-04 唯讀查詢），所以要先暫改成 NAT 才會出現本功能。

**前提**
1. 關閉要保留的 WSL 工作。在 PowerShell 備份原檔：`Copy-Item $env:USERPROFILE\.wslconfig $env:USERPROFILE\.wslconfig.t0841-orig`，並記下雜湊 `Get-FileHash $env:USERPROFILE\.wslconfig`。
2. **刪除**（或以 `#` 註解掉）`[wsl2]` 的 `networkingMode=Mirrored` 那一行，讓 WSL 回到預設的 NAT。不要寫成 `networkingMode=nat`：使用者自己宣告的模式 BAT 依規則不改，只會出提示（`declared`），可另作為一項「不提供」的驗收。
3. `wsl --shutdown`（第 1 次），再開 BAT（含本單的版本），`wsl -d Ubuntu-24.04 -- wslinfo --networking-mode` 應為 `nat`。
4. 讓連線測試在 NAT 下失敗：例如在 `.wslconfig` `[wsl2]` 加 `localhostForwarding=false`（同樣要 shutdown 一次才生效，可與第 2 步一起改、共用第 3 步的 shutdown）。

**步驟與預期**
1. 新增 WSL profile，跑精靈到 `connect-test` → 失敗畫面標題「連線測試失敗（WSL 為 NAT 模式）」，有「改用 Mirrored 並重試」「重試」「略過」「取消」。
2. 按「改用 Mirrored 並重試」→ 同意框：一個項目（未勾、「此使用者」「選用」、⚠ 關閉所有 WSL 發行版）；勾選後確認鈕上方列出目前執行中的發行版（應含 `Ubuntu-24.04`）。先按「維持 NAT」→ 回到同一錯誤畫面、`.wslconfig` 沒變（雜湊不變）。
3. 再按一次動作、勾選、按「改用 Mirrored 並重試」→ 顯示「`wsl --shutdown` 開始後無法中途停止…」；完成後：`.wslconfig` 多了 `networkingMode=mirrored`（只有這一行不同），旁邊有 `.wslconfig.bat-backup-<時間>`（內容 = 步驟前的檔）；發行版被 keep-alive 拉起（`wsl -l -v` Running）；`wslinfo --networking-mode` = `mirrored`；連線測試通過（mirrored 下 `localhostForwarding` 不影響 localhost）；完成畫面「WSL 環境的變更」列出 `.wslconfig` 與備份路徑。
4. debug log 有一行 `[wsl-env-apply] network-mirrored -> applied changes=1 shutdown=true ms=…`，沒有檔案內容。
5. （選做）原則：建立 `HKLM\SOFTWARE\Policies\WSL` `AllowNetworkingModeUserSetting`=0（需系統管理員，做完要刪）→ 同樣失敗時沒有動作，多一行「Windows 原則決定 WSL 的網路模式…」提示。

**還原**
1. `Copy-Item $env:USERPROFILE\.wslconfig.t0841-orig $env:USERPROFILE\.wslconfig -Force`，比對雜湊與前提第 1 步相同。
2. `wsl --shutdown`（第 2 次），確認 `wslinfo --networking-mode` = `mirrored`。
3. 刪掉 `.wslconfig.t0841-orig`、`.wslconfig.bat-backup-*`、測試用的 WSL profile（以及第 5 步的原則值）。

### 遭遇問題

- **實作中發現並修掉的 bug**：`.wslconfig` 已寫 `networkingMode=Mirrored`（大寫）時，`setIniValue` 會把它改寫成小寫並建備份——WSL 不分大小寫，這不是必要的寫入。改為「已宣告且判定為 mirrored → 不寫」（測試「already networkingMode=mirrored」守住）。
- **e2e spec 的版本常數**：`EXPECTED_VERSION` 寫死 `0.7.1-pre.2`，在其他版本上 soft-fail 會讓 serial 模式後續測試不跑。本單只改 V3 斷言、沒有改這個常數（照「只改斷言」）；以暫存副本執行並刪除。之後若要讓這份 spec 在新版本上跑，需另行把版本改成參數（後續，不在本單範圍）。
- **`release/win-unpacked`**：為跑 e2e 執行了 `npm run build:dir`，產物在 gitignore 的 `release/`，留在原地（沒有動到 `release/` 既有的安裝檔）。
- **後續（不在本單範圍）**：P-6（`instanceIdleTimeout=-1`）依 T0831 Q-5 建議沒有做；同意框與 T0840 清單一樣用 inline style（`setup-wizard.css` 不在 `affects_files`）。
- 工作目錄沒有其他工單的未提交變更被動到。

### 回報時間

- 2026-11-04T13:07:38+0800
