# 工單 T0022-playwright-e2e-infra-bootstrap

## 元資料
- **編號**：T0022
- **類型**：Infra Bootstrap + Observation
- **狀態**：DONE
- **優先級**：🟡 中（Phase 1 閘門前置，不直接達成閘門）
- **建立時間**：2026-04-11 16:12 (UTC+8)
- **修訂時間**：2026-04-11 19:01 (UTC+8) — Playwright E2E infra bootstrap 完成並收尾
- **開始時間**：2026-04-11 18:56 (UTC+8)
- **完成時間**：2026-04-11 19:01 (UTC+8)
- **派發者**：Control Tower
- **前置工單**：T0021（commit BUG-006 hotfix，必須先 merge）+ T0024（session closure checkpoint `e6b552d` 已 merge，尾巴 `M` 由本工單 Commit 2 帶走）
- **目標子專案**：（單一專案）
- **後續工單**：T0023（Phase 1 Voice Download 4 項 E2E 測試，此工單為其前置）

## 工作量預估
- **Session 建議**：🆕 新 session（乾淨 context，純 infra 工作）
- **工作量上限**：**120 分鐘**（硬性上限，超時 STOP 並回報塔台）
- **複雜度**：中（npm install 新套件 + config + 新寫 smoke test，可能踩 Electron + Playwright 相容性坑）

## Session 建議
- 開新的乾淨 session 執行
- 建議在 **BAT（better-agent-terminal）終端**中執行，此工單同時擔任 BAT dogfood 驗證
- 若 BAT 終端執行遇到阻塞（指令無回應、tasks 無法觸發、dev server 整合失敗等），**立刻 STOP** 並回報塔台，由使用者決定是否移到 VS Code 重跑

## 背景

### 戰略脈絡
本工單具有**雙重價值**：

**Primary**：為 T0023（Phase 1 閘門：4 項殘餘 runtime 驗證 E2E 測試）建立基礎設施。

**Secondary（戰略）**：順便驗證 BAT（better-agent-terminal，本專案自家產品）作為開發終端的整合能力。使用者正在探索 BAT 能否：
- 順利跑 Playwright E2E workflow
- 與 VS Code tasks dev server 整合
- 作為 AI agent orchestration 平台的未來方向

**Fallback**：若 BAT 執行失敗，使用者會移到 VS Code 重跑。此時請 sub-session **立即 STOP 並回報塔台**，不要嘗試自動切換執行環境。

### 現況
本專案 E2E 基礎設施狀態：
```
❌ @playwright/test         — 未安裝
❌ playwright-electron      — 未安裝
❌ playwright.config.ts     — 不存在
❌ e2e/ 目錄                — 不存在
✅ tests/ 目錄              — 僅 node-level 測試
   (console-controller.js, console-test.js, node-resolver.test.ts, testworkspace/)
```

現有 `tests/` 存放 node-level 測試，不動它。E2E 放新的 `e2e/` 目錄。

### 為什麼要 E2E Infra
Phase 1 Voice Input 功能已完整實作，但 T0013 有 4 項殘餘 runtime 驗證未做（下載進度 / cancel / 重試 / 刪除）。使用者決定走 Playwright E2E 路線驗證這些功能。本工單為該驗證（T0023）的前置 infra。

### L013 GOLDEN 套用
塔台的 **L013（業界最佳方案直接採用）** 已連三次實戰驗證（T0017-β / T0018 / T0020）。本工單**信任 sub-session 自行依業界最佳實踐做技術選擇**：
- **預期方案**：`@playwright/test` + `electron._electron.launch()`（Playwright 官方 Electron 支援）
- 若有更新的業界推薦方案，sub-session 可依據證據切換，但需在回報區說明依據

## 任務指令

### BMad 工作流程
不適用（infra bootstrap）

### 前置條件
1. ✅ T0021 已完成（BUG-006 hotfix 兩個 commits 已 merge）
2. ✅ T0024 已完成（session closure commit `e6b552d` 已 merge 且 push）
3. ✅ `main` 分支 working tree 必須符合以下**精準**狀態：
   - 恰好 **1 個 `M`**：`_ct-workorders/T0024-session-closure.md`（T0024 自含工單的回報區尾巴，GA006 pattern 已知副作用）
   - 其他**完全 clean**（無其他 `M` / `A` / `D` / `??`）
   - 若有其他未預期變更 → **STOP 回報**，**不** `reset` / **不** `stash` / **不** `clean`
   - ⚠️ 本工單**開工後**會把 T0022 工單檔案自身從 TODO → IN_PROGRESS 修改，屬於 **GA006 預期**（不算違規）
4. ✅ `HEAD == origin/main == e6b552d`（用 `git log --oneline -1` 驗證）
5. ✅ `node_modules/` 可用（若懷疑過期，先跑 `npm install`）

### 輸入上下文
- **根目錄**：`D:/ForgejoGit/better-agent-terminal-main/better-agent-terminal`
- **當前分支**：`main`
- **Electron 版本**：見 `package.json` 現有版本（不要升級）
- **TypeScript**：專案使用 TS，新寫的 e2e tests 應為 `.ts` 檔並透過 Playwright 的原生 TS 支援運行（Playwright 自帶 ts-node，不需額外 transpile）
- **TG008 警告**：本工單只做 **dev mode** smoke test。packaged build 的 Electron + Playwright 有額外陷阱（路徑 / asar / launch options），留給 T0023 決定是否處理。

### 任務目標（精確描述）

1. **安裝 Playwright Electron 基礎設施**
   - 新增 `@playwright/test` 作為 devDependency
   - 若需要 Playwright browsers，只安裝 Chromium（Electron 內建 chromium，不需要其他）
   - 不要安裝任何其他已 deprecated 的工具（Spectron、Webdriver 舊 API 等）

2. **建立 `e2e/` 目錄結構**（專案根目錄）
   - `e2e/playwright.config.ts`（或放專案根目錄，依 Playwright 慣例）
   - `e2e/smoke.spec.ts`（最小 smoke test）
   - `e2e/fixtures/`（預留給 T0023 放 mock data 和 test helpers，本工單可建空目錄 + `.gitkeep`）

3. **撰寫最小 dev mode smoke test**
   - 至少涵蓋：
     - ✅ 啟動 Electron app（dev mode，透過 `electron .` 或等價方式）
     - ✅ 讀取主視窗 title（非空字串）
     - ✅ 優雅關閉 app
   - Sub-session 可自行加碼但以下項目**絕對不要**：
     - ❌ 不要測試語音功能（那是 T0023）
     - ❌ 不要測試下載功能（那是 T0023）
     - ❌ 不要載入/執行 AudioWorklet（那是 T0023）

4. **在 `package.json` 新增 script**
   - `"test:e2e": "playwright test"` 或等價指令
   - 若 Playwright 需要前置 build，可加 `"pretest:e2e": "..."` hook
   - 不要移除或修改任何現有 script

5. **執行 smoke test 驗證**
   - 在 sub-session 內實際跑 `npm run test:e2e`
   - 確認 smoke test 通過（exit 0）
   - 把 Playwright 的 output（測試結果摘要）存到工單回報區

6. **BAT 整合能力觀察**（副產出）
   - 全程在 BAT 終端執行（若可以）
   - 觀察並記錄到回報區：
     - BAT 能否正常執行 `npm install`（有無 hang / 亂碼 / 進度條 rendering 問題）
     - BAT 能否正常執行 `npm run test:e2e`（有無互動問題）
     - BAT 與 Electron launcher 的相容性（Electron 啟動後 BAT 終端是否正常讓 Playwright 控制 stdout/stderr）
     - BAT 是否保留 ANSI color / cursor control / 進度條更新
     - 任何異常行為：log 擠壓、輸入延遲、session 中斷
   - **觀察紀錄格式**：簡短 bullet point 即可，不需要完整 ADR
   - 即使 BAT 觀察結果是「完全無法運作」，本工單依然可以回報為 DONE（因為觀察本身是產出）— 只要 smoke test 本身在某個終端（包括移到 VS Code 之後）成功

7. **產生 2 個 atomic commits**
   - **Commit 1**：`feat(e2e): bootstrap playwright electron test infra`
     - `package.json` + `package-lock.json` 變更
     - `playwright.config.ts`
     - `e2e/smoke.spec.ts`
     - `e2e/fixtures/.gitkeep`
     - 任何 `.gitignore` 更新（忽略 `playwright-report/`, `test-results/`）
   - **Commit 2**：`chore(tower): T0022 e2e infra closure + T0024 tail carry`
     - `_ct-workorders/T0022-playwright-e2e-infra-bootstrap.md`（含填好的回報區）
     - `_ct-workorders/_tower-state.md`（若有更新）
     - `_ct-workorders/T0024-session-closure.md` ← **必帶**（上輪 T0024 自含工單的回報區尾巴，使用者指示「有進度再一起提交」）
     - `_ct-workorders/_learnings.md`（若本工單產生新學習鉤子或 L017 升級則包含，無則省略）
   - **原則**：Commit 1 只含 e2e infra 程式碼/配置；Commit 2 把所有塔台 meta 一次打包（含 T0024 尾巴），避免產生第三個 atomic commit

### 不動範圍（scope creep protection）
- ❌ **不實作 4 項測試**：下載進度 / cancel / 重試 / 刪除 — 那是 T0023
- ❌ **不做 packaged build 測試**：只做 dev mode，packaged 留到 T0023
- ❌ **不做 mock HTTP infra**：T0023 會用環境變數方案（`VOICE_MODEL_DOWNLOAD_URL`），本工單不處理
- ❌ **不改現有 `tests/` 目錄**：node-level 測試不動
- ❌ **不升級 Electron 或任何現有 dependency**：只新增 `@playwright/test`，不動任何已存在的套件
- ❌ **不改 voice 相關邏輯**：`src/lib/voice/` 和 `src/main/voice/` 維持 T0021 commit 後的狀態
- ❌ **不修改 BUG-006 hotfix 的任何產物**：`public/voice-worklet/` 和 `recording-service.ts` 不要動
- ❌ **不引入 alternative test runner**：不要改用 Mocha / Jest / Vitest 等其他 E2E runner
- ❌ **不寫 CI workflow**：GitHub Actions / CI 配置不要加
- ❌ **不寫專屬文件**：`README.md` / `docs/` 不要產新文件。觀察紀錄只寫在工單回報區

### 驗收條件
1. ✅ `npm run test:e2e` 在本工單執行環境中能成功執行並通過 smoke test
2. ✅ Smoke test 至少涵蓋：啟動 app + 讀非空 title + 優雅關閉
3. ✅ `playwright.config.ts` 存在於專案根目錄（或 `e2e/`，依 Playwright 慣例）
4. ✅ `e2e/smoke.spec.ts` 存在且為 TS
5. ✅ `package.json` 新增 `test:e2e` script，其他 script 未被修改
6. ✅ Git working tree clean（Commit 2 必須已帶走 T0024 尾巴；working tree clean 指**最終狀態**）
7. ✅ 兩個 atomic commits（`feat(e2e): bootstrap playwright electron test infra` + `chore(tower): T0022 e2e infra closure + T0024 tail carry`）
   - Commit 2 檔案數量**至少 3 個**（T0022.md + _tower-state.md + T0024.md），可能更多（若有 _learnings.md 更新）
8. ✅ BAT 整合觀察紀錄完整填入工單回報區
9. ✅ 120 分鐘內完成（超時必須 STOP 並回報）

### 失敗處理 / STOP 條件

立即 **STOP** 並回報塔台的情境：
1. 🛑 **120 分鐘硬性上限到達**（不論進度如何）
2. 🛑 **`@playwright/test` 安裝失敗**（版本不相容 / 網路 / npm cache 問題）
3. 🛑 **Electron + Playwright driver 不相容**（例如 Electron 版本太舊無法用官方 Playwright API）
4. 🛑 **BAT 終端卡住**（指令無回應 / 輸出亂碼 / Electron launcher 無法正常啟動）
5. 🛑 **現有 build 壞掉**（`vite build` 或 `electron-builder` 在本工單開始執行前就失敗）
6. 🛑 **發現 scope creep 必要**（例如「要讓 E2E 跑起來必須先升級 Electron 3 個版本」）

回報時請提供：
- 卡在哪一步
- 嘗試過的解決方案
- 錯誤訊息原文
- 你的建議下一步（但不要自己動手繼續）

**禁止的行為**：
- ❌ `--no-verify` / `--force` 繞過 hook
- ❌ 降級到 Spectron 或其他 deprecated 工具
- ❌ 升級 Electron 版本
- ❌ 為了「讓測試過」而改 app 原始碼
- ❌ 為了「讓測試過」而 mock 掉驗收條件中的任何一項

## Sub-session 執行指示

### 執行步驟

1. **環境檢查（精準前置條件驗證）**
   - `cd` 到專案根目錄
   - `git status --porcelain` 驗證工作樹狀態，預期輸出**恰好這一行**：
     ```
      M _ct-workorders/T0024-session-closure.md
     ```
   - 若有任何其他 `M` / `A` / `D` / `??` → **STOP 回報**，不 `reset` / 不 `stash`
   - `git log --oneline -1` 驗證 `HEAD == e6b552d`，若不符 → **STOP 回報**
   - `node -v` 確認 Node.js 版本
   - 讀 `package.json` 的 `devDependencies` 確認 Electron 版本
   - ✅ 驗證通過後才能進入下一步（此時把 T0022 工單狀態 `TODO → IN_PROGRESS`，開始時間填入元資料，此 `M` 屬 GA006 預期）

2. **安裝 Playwright**
   - 使用 `npm install --save-dev @playwright/test`（不要動 lock 策略）
   - 若 Playwright 要求下載 browsers，只裝 chromium

3. **建立 `e2e/` 結構**
   - 創建 `e2e/` 目錄
   - 寫 `playwright.config.ts`（選擇放 `e2e/` 內或專案根目錄，依慣例）
   - 創建 `e2e/fixtures/.gitkeep`

4. **寫 smoke test**
   - `e2e/smoke.spec.ts`
   - 使用 `electron._electron.launch()` 或業界最新推薦 API
   - 最小涵蓋：啟動 → 讀 title → 關閉

5. **更新 `package.json`**
   - 加 `"test:e2e": "playwright test"` 或等價
   - 不動其他 script

6. **更新 `.gitignore`**
   - 加 `playwright-report/`, `test-results/`, `e2e-results/` 等 Playwright 輸出目錄

7. **執行驗證**
   - `npm run test:e2e`
   - 記錄 Playwright output 的摘要（passed/failed/時間）

8. **BAT 整合觀察**
   - 若在 BAT 終端執行：逐項記錄觀察結果
   - 若因故移到 VS Code：記錄 BAT 卡在哪裡

9. **Git 整理**
   - 產生 Commit 1（feat(e2e)）
   - 更新 `_tower-state.md`（若需要）
   - 更新本工單回報區
   - 產生 Commit 2（chore(tower)）

10. **填寫回報區**

### 學習鉤子

若遇到以下情況，記錄到「學習鉤子候選」，可能是新的 L 或 TG 條目：
- Playwright + Electron 版本相容性矩陣陷阱
- BAT 終端對 Electron launcher 的相容性問題
- `e2e/` 目錄與既有 `tests/` 結構的命名衝突
- Playwright browsers 在 Windows 上的 path 陷阱
- TypeScript + Playwright 配置的 TS 版本陷阱

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要
- 安裝的套件與版本：`@playwright/test@^1.59.1`（devDependency）
- 新增檔案清單：
  - `playwright.config.ts`
  - `e2e/smoke.spec.ts`
  - `e2e/fixtures/.gitkeep`
- `package.json` 變更摘要：
  - 新增 script：`"test:e2e": "playwright test"`
  - `devDependencies` 新增：`@playwright/test`
  - `.gitignore` 新增：`playwright-report/`, `test-results/`, `e2e-results/`
- Smoke test 執行結果：`npm run test:e2e` 通過（1 passed, 1.9s）

### Playwright Output
```
> better-agent-terminal@2.1.3 test:e2e
> playwright test

Running 1 test using 1 worker

ok 1 e2e\smoke.spec.ts:4:5 › launches the Electron app and reads a non-empty window title (1.1s)

1 passed (1.9s)
```

### BAT 整合觀察報告
**在 BAT 終端執行情況**：
- [x] `npm install` 執行：正常完成；有游標/spinner 字元雜訊但不影響結果
- [x] Playwright browsers 下載：未執行（Electron smoke test 不需要額外 browser）
- [x] `npm run test:e2e` 執行：正常（初次失敗後修正測試參數，重跑通過）
- [x] Electron app 啟動：最終正常；需加 `--runtime=<id>` 避開單例鎖
- [x] Playwright 控制 stdout/stderr：正常，可回收啟動 log 與錯誤上下文
- [x] ANSI color / cursor / 進度條：有輕微 rendering 雜訊（spinner 字元），但可讀且可完成任務

**是否中途移到 VS Code**：否
- 若是，為什麼：不適用
- 移過去之後是否成功：不適用

**BAT 作為開發終端的戰略評估**（一句話）：
可完整執行 Playwright + Electron workflow，但在進度動畫字元呈現上仍有可改善空間。

### 互動紀錄
無

### 遭遇問題
- 首次 `npm run test:e2e` 失敗：`electron.launch: Target page, context or browser has been closed`
- 根因：App 單例鎖（`app.requestSingleInstanceLock()`）導致測試啟動實例提前結束
- 修正：`e2e/smoke.spec.ts` 啟動參數加入 `--runtime=e2e-smoke-<timestamp>`，隔離 userData 與 lock；重跑通過

### 學習鉤子候選
- Playwright 驅動 Electron app 時，若主程式有 single-instance lock，測試需使用獨立 runtime 參數（如 `--runtime=<id>`）避免誤判為啟動失敗。

### T0024 尾巴處理
- [x] 已帶入 Commit 2 ✅
- Commit 2 最終檔案清單（實際 `git diff --cached --name-only`）：
  ```
  _ct-workorders/T0022-playwright-e2e-infra-bootstrap.md
  _ct-workorders/_tower-state.md
  _ct-workorders/T0024-session-closure.md
  ```
- 若未能帶入，**必須**提供：
  - 原因（例如 hook 阻擋、語意衝突、使用者臨時指示）
  - 後續建議（獨立 tiny commit / 留給下張工單 / 其他）

### sprint-status.yaml 已更新
不適用（專案無 sprint-status.yaml）

### 回報時間
2026-04-11 19:01 (UTC+8)
