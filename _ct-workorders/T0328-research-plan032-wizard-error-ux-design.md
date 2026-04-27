# T0328 — Research PLAN-032 Wizard Error UX 設計探索（Stepper 擴充 + error mapping + pre-flight framework）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0328 |
| 類型 | research（互動式研究，多 phase 盤點 + 方案評估 + 拆單建議） |
| 所屬 | PLAN-032 — Setup Wizard Error UX Overhaul |
| 狀態 | 🔄 IN_PROGRESS（執行中） |
| 建立時間 | 2026-04-27 12:58 (UTC+8) |
| 派發時間 | （待塔台派發） |
| 開始時間 | 2026-04-27 13:27 (UTC+8) |
| Sizing | L（estimate 60-120 min wall；6 phase 盤點 + 方案矩陣 + 拆單 + reachability matrix。對照 GP099/T0313 預期 ~15 min wall 落於下界以下） |
| 依賴 | PLAN-030 ✅（Stepper 元件 + 設計規範）/ PLAN-031 主體 ✅（三平台 install-bundle step 結構參考）/ BUG-072/073/074（root cause 三同族） |
| 後續 | 拍板後拆 Sprint 2-5 共 ~10-12 張實作工單 |
| 互動旗標 | `--mode ask --interactive`（研究型工單，允許 Worker 提問澄清；最多 3 輪互動） |
| Renew 次數 | 0 |
| 工作目錄 | main repo（不需 worktree，純讀取 + 文件產出） |
| `affects_files` | `_ct-workorders/T0328-*.md`（自身回報區） + 可能新增 `_spec-wizard-error-ux.md`（如 Worker 判定需獨立 spec） |

## 背景

PLAN-030 完工後 dogfood 揭三同族 wizard UX BUG（BUG-072/073/074）。塔台已升格為 PLAN-032（Wizard Error UX Overhaul），v0.4.3 獨立 release。

**核心缺失**：
1. Pre-flight 偵測層（環境就緒度檢查）
2. Error mapping 策略（stderr → 友善人話）
3. Stepper status 缺 `awaiting-input` 語意
4. Recovery action 場景化（重試 / 我已修好 / 連結 / 跳過）

**參考 PLAN-031 T0313 模式**：先研究展開 6 phase + reachability matrix + 拍板項 + 拆單表，後續實作鏈式 YOLO 0 Renew（GP110 實證）。

## 研究目標

回答以下 6 個問題，產出**可拍板的設計提案**（含拆單建議表 + reachability matrix）：

1. **現況到底如何？** PLAN-030 Stepper 元件對 input step 的處理機制？三平台 wizard step 各自的 error path 現況？
2. **Stepper `awaiting-input` 設計？** 視覺、a11y、status transition、與既有 5 status 互動、callsite 影響面？
3. **Error mapping framework 設計？** matcher 策略（regex / errorCode / class）、dictionary 結構、平台共享 vs 平台專屬、i18n hook？
4. **Pre-flight framework 設計？** 同步 / 非同步 API、cache 策略、與 step 生命週期整合、失敗 UX？
5. **Recovery action 抽象？** 「重試」/「我已修好」/「開連結」/「跳過」的型別、step 如何宣告、UI render 方式？
6. **拆單建議？** Sprint 2-5 共幾張工單？哪些可平行？依賴關係？哪些 errorCode 在當前 schema 下可達 vs unreachable？

## 範圍（6 Phase）

### Phase A：現況盤點

#### A.1 PLAN-030 Stepper 元件現況

讀取下列檔案，提取 Stepper status / props / events：

- `src/components/Stepper/Stepper.tsx`（或實際路徑）
- `src/components/Stepper/types.ts`
- `src/components/Stepper/Stepper.test.tsx`
- `docs/design/bat-stepper-design-language.md`

**紀錄項**：
- 現有 5 status (`idle/running/done/failed/skipped`) 各自視覺 / 行為
- input step 目前如何處理（是否有專屬 prop？還是混用 `running` + custom render？）
- status transition 邏輯（誰決定 status 變化？step 內部 / 外部 controller？）
- a11y 規範（aria-current / aria-busy / role 等）

#### A.2 三平台 wizard step 結構盤點

實際讀取下列檔案，分析 error path：

- `src/components/setup-wizard/steps/wsl/*.ts`（特別是 BUG-072 涉及的 linger / write-systemd-unit / start-server-service）
- `src/components/setup-wizard/steps/ssh/*.ts`（特別是 BUG-074 涉及的 configure-host）
- `src/components/setup-wizard/steps/docker/*.ts`（特別是 BUG-073 涉及的 detect-env）
- `src/components/setup-wizard/SetupWizardShell.tsx`（或主 controller）

**紀錄項**：
- 每個 step 目前 error 怎麼拋（throw / return / state）
- 三平台是否共享 step 介面 / step base type
- input step 目前如何被觸發（initial render 就跑 main action？）— 這是 BUG-074 root cause 關鍵
- 三平台 step list 中哪些是 input step（盤點完整）

#### A.3 BUG 三同族 root cause 細節

針對 BUG-072 / BUG-073 / BUG-074 各自 stderr / 呼叫鏈，記錄：

| BUG | Step file | 拋錯位置 | stderr / Error 類型 | 現有 status 顯示 | 期望 status |
|-----|-----------|---------|---------------------|----------------|------------|
| 072 | wsl/install-server-bundle.ts? | linger 啟用 / systemd 啟動 timeout | child_process stderr 字串 | failed | failed + 友善訊息 + 「我已修好」action |
| 073 | docker/detect-env.ts? | docker info 失敗 | docker CLI stderr 字串 | failed | failed + 友善訊息 + 連結 action |
| 074 | ssh/configure-host.ts? | initial validate 失敗 | "SSH host is required" string | failed | awaiting-input |

### Phase B：方案設計（4 個子方案）

#### B.1 Stepper `awaiting-input` 設計 spike

**設計選項**：
- **B.1-A**：新增獨立 status `awaiting-input`，視覺：藍色 outline + 圖示 🔵 + 不顯示 Retry/Skip（語意清楚但動 type）
- **B.1-B**：複用 `running` + 加 `awaitingInput: true` flag（最小變動但 status 語意混亂）
- **B.1-C**：input step 完全脫離 stepper status flow，render 為獨立 prompt UI（最大彈性但破壞統一感）

**評估維度**：型別變動 / a11y / 設計規範一致性 / callsite 影響面 / future extensibility

#### B.2 Error mapping framework 設計 spike

**設計選項**：
- **B.2-A**：純 regex matcher，每個 platform 一份 dictionary（簡單但 brittle）
- **B.2-B**：errorCode + matcher 混合（規範化 errorCode 是中長期 win 但需現有 step 補 errorCode）
- **B.2-C**：class instanceof + matcher chain（最 OOP 但複雜）

**評估維度**：實作複雜度 / 維護性 / i18n hook 自然度 / 與現有 step error 結構契合度

#### B.3 Pre-flight framework 設計 spike

**設計選項**：
- **B.3-A**：每個 step optional `preflight: () => Promise<PreflightResult>` field（簡單）
- **B.3-B**：preflight 為獨立 step type，wizard runner 識別並特化處理（語意清楚但動結構）
- **B.3-C**：preflight 寫進 step main action 開頭（不抽象，每個 step 自行處理）

**評估維度**：boilerplate 量 / cache 自然度 / 失敗 UX 統一度

#### B.4 Recovery action 抽象 spike

**設計選項**：
- **B.4-A**：`actions: Action[]`，每個 Action 為 `{ label, kind, handler }`（彈性最大）
- **B.4-B**：固定 4 種 enum（retry / fixed-and-retry / open-link / skip），step 選用（簡單但缺彈性）
- **B.4-C**：hybrid — 預設 4 種 + 允許 custom（推薦？）

### Phase C：支援矩陣 / Reachability Matrix

#### C.1 Status transition matrix

列出 `idle → running → done/failed/skipped/awaiting-input` 所有合法 transition + 不合法 transition。

#### C.2 Error mapping reachability matrix

針對三平台目前實際會出現的 error 種類，列：

| Platform | Step | Error pattern | 對應 friendly message | 在當前 schema 下可達? | 是否本 PLAN 涵蓋 |
|----------|------|---------------|----------------------|---------------------|----------------|
| WSL | install-server-bundle | linger fail | "無法自動啟用 systemd lingering..." | 是（BUG-072） | 是 |
| WSL | start-bat-server | systemd timeout | "服務啟動逾時..." | 是（BUG-072 連帶） | 是 |
| Docker | detect-env | daemon not running | "未偵測到 Docker daemon" | 是（BUG-073） | 是 |
| SSH | configure-host | input required | "SSH host is required" | 應改 awaiting-input | 是（BUG-074） |
| ... | ... | ... | ... | ... | ... |

**目的**：避免拆單時把 unreachable error 列入工單範圍（GP112 dead errorCode finding 教訓）。

### Phase D：拆單建議

#### D.1 Sprint 2-5 工單列表

格式：

| 工單號 | 標題 | Sprint | Sizing | 依賴 | 平行可? | OOS 範圍 |
|--------|------|--------|--------|------|--------|----------|
| T03xx | Stepper 擴充 awaiting-input | 2 | M | — | 否（其他工單依賴此） | 不改視覺 design tokens |
| T03xx | WizardErrorMapper framework | 2 | M | — | 是（與 Stepper 平行） | 不寫具體 dictionary 內容 |
| T03xx | WizardPreflight framework | 2 | M | — | 是 | 不串既有 step |
| ... | ... | ... | ... | ... | ... | ... |

#### D.2 依賴圖（mermaid 或 ASCII）

```
T0328 (research)
  ↓
Sprint 2 (parallel):
  T03xx Stepper awaiting-input ───┐
  T03xx ErrorMapper ──────────────┤
  T03xx Preflight ────────────────┤
  T03xx 設計規範更新 ──────────────┤
                                  ↓
Sprint 3 (parallel):
  T03xx BUG-072 WSL linger ────┐
  T03xx BUG-073 Docker daemon ─┤
  T03xx BUG-074 SSH awaiting ──┤
                               ↓
Sprint 4: T03xx 跨平台 input step 統一
                               ↓
Sprint 5: integration tests + audit + release notes
```

#### D.3 Reachability matrix 整合

D.1 表格每行加註「在當前 schema 下是否可達」欄位（GP112 規範）。

### Phase E：拍板項（給塔台）

回報區「拍板項」段落列出**至少 5 個**待塔台拍板的設計選擇（B.1/B.2/B.3/B.4 各方案 + BUG-072 fallback 策略 + i18n 範圍 + ship gate 切點 + cache 策略 等）。

### Phase F：可選 — 獨立 spec 文件

若 Worker 判定 framework 設計需獨立 spec（避免後續工單反覆引用 T0328 大段內容），可主動建立：

- `_ct-workorders/_spec-wizard-error-ux.md`

內容包含：
- Stepper status 完整規範（含 awaiting-input）
- WizardErrorMapper API + 範例 dictionary
- WizardPreflight API + 範例
- Recovery action 列舉

## 互動模式

`--mode ask --interactive`，最多 3 輪互動。Worker 在以下情境**應**詢問塔台：

- 三方案 tradeoff 模糊到無法在工單內決定（如 B.1 三選一）
- 發現 PLAN-030 既有 Stepper 設計與本 PLAN 假設衝突
- BUG 觸發機制與工單描述不符（如實際讀檔發現 step 結構不一樣）
- 拍板項超過 8 個（範圍過大，建議先收斂）

塔台在此預先回答常見問題：

- **Q：i18n 是否本 PLAN 落地？** 否，只留 hook（D106 拍板項）
- **Q：所有 input step 統一改是否本 PLAN？** 偏向是（D105 拍板項）
- **Q：Stepper 視覺風格爭議？** Worker 給 3 種 mockup 描述，塔台拍板（D102）

## 驗收條件

回報區必含：

- ✅ Phase A 三段現況盤點完成（含具體檔案路徑 + 程式碼引用）
- ✅ Phase B 四個 spike 各列 3 方案 + 評估表
- ✅ Phase C status transition + reachability matrix 兩張表
- ✅ Phase D 拆單表（含依賴圖 + reachability 註）
- ✅ Phase E 拍板項列表（≥5 項，每項含選項 + 推薦 + 理由）
- ✅ （可選）Phase F spec 文件已建立

## 參考資料

- BUG-072: `_ct-workorders/BUG-072-wsl-systemd-linger-error-handling.md`
- BUG-073: `_ct-workorders/BUG-073-docker-wizard-daemon-not-running-error-handling.md`
- BUG-074: `_ct-workorders/BUG-074-ssh-wizard-input-step-shows-failed-on-init.md`
- PLAN-030 設計規範: `docs/design/bat-stepper-design-language.md`
- PLAN-031 研究模板: `_ct-workorders/T0313-research-plan031-server-bundle-distribution-design.md`（同類 6 phase + reachability 結構）

---

## 回報區（Worker 填）

### 完成摘要

- 完成狀態：DONE（研究結論可拍板；未做 runtime code 變更）
- 交付物：
  - `_ct-workorders/_spec-wizard-error-ux.md`
  - 本工單 Phase A-E 完整研究回報
- 核心結論：
  1. 現況缺口不只在 `Stepper`，而是 `Stepper StepStatus` + `WizardRunner WizardStepStatus` + `SetupWizardShell` failed-action wiring三層一起缺少 `awaiting-input` 語意。
  2. 推薦採 **B.1-A / B.2-B / B.3-A / B.4-C**：新增獨立 `awaiting-input` status、混合式 `errorCode + regex matcher`、`preflight` step hook、hybrid recovery actions。
  3. Docker/WSL/SSH 三族已具備部分基礎：SSH 已有 structured `errorCode` 與友善 hint，Docker/WSL 仍多為 raw string throw；因此先做 framework、再逐步把各 step 接上最划算。
- 關鍵程式碼依據：
  - `src/components/Stepper/types.ts`：`StepStatus` 只有 `pending/running/completed/failed/skipped/rolled-back`
  - `src/components/setup-wizard/wizard-runner.ts:74-95,237-287`：runner 只有 `Pending/Running/Succeeded/Failed/RolledBack`，失敗即進 retry/skip loop
  - `src/components/setup-wizard/SetupWizardShell.tsx:103-144,367-416`：UI 只把 `Failed` 映到 `errorMessage + failed actions`
  - `src/components/setup-wizard/steps/ssh/configure-host.ts:79-80`：空 host 直接 `throw new Error(...)`
- sprint-status.yaml：未更新。根目錄 `sprint-status.yaml` 仍是舊 Phase 1/2 摘要追蹤，未覆蓋目前 CT v4.x workorder 體系；本次研究結果保留在工單與 spec。

### Phase A：現況盤點

#### A.1 PLAN-030 Stepper 元件現況

| 項目 | 現況 | 依據 |
|------|------|------|
| Status 集 | 6 個：`pending/running/completed/failed/skipped/rolled-back`，沒有 `awaiting-input` | `src/components/Stepper/types.ts` |
| 預設 icon/color | `pending ○`, `running 🔄`, `completed ✓`, `failed ✗`, `skipped ⏭`, `rolled-back ↩` | `src/components/Stepper/status-preset.ts` |
| 錯誤顯示 | 只有 `status === 'failed'` 才 render `errorMessage`；vertical 模式另外 render `renderFailedActions` slot | `src/components/Stepper/Stepper.tsx:155-167,224-231` |
| current step 推導 | 先找第一個 `running`，否則取最後 completed 的下一個 | `src/components/Stepper/Stepper.tsx:9-19` |
| a11y | root `role=\"list\"` + `aria-label`；step `role=\"listitem\"`；current step 用 `aria-current=\"step\"`；failed message 用 `role=\"alert\" aria-live=\"polite\"`；clickable step 才有 `role=\"button\"`/鍵盤支援 | `src/components/Stepper/Stepper.tsx:98-167,185-236` |
| spec 約束 | vertical 模式負責顯示 L1-L5；failed step 必須有 actionable recovery；status 規格文件仍只有 6 種 | `docs/design/bat-stepper-design-language.md:45-57,119-150,218-220` |

補充：`Stepper.test.tsx` 也明確以「6 status」為測試基線，代表任何 `awaiting-input` 落地都要同步改 test 與 spec。見 `src/components/Stepper/__tests__/Stepper.test.tsx:15-24,32-39,51-58`。

#### A.2 三平台 wizard step 結構 / error path 盤點

**共享骨架**

- 三平台都走同一套 `WizardRunner` + `SetupWizardShell`。
- `WizardStep` 共用欄位只有 `id/title/appliesTo/run/rollback/retryable/labelKey/descriptionKey/groupKey/editableFromFailure`，沒有 `kind`、`preflight`、`errorCode` schema、`actions` schema。見 `src/components/setup-wizard/wizard-runner.ts:56-72`。
- `SetupWizardShell` 會把 runner snapshot 映成 `StepDescriptor`，並把 `snapshot.error` 直接塞進 `errorMessage`。見 `src/components/setup-wizard/SetupWizardShell.tsx:126-144`。
- Runner 執行模型是「step 進入 `Running` → `await step.run()` → 成功 `Succeeded` / throw `Failed` → 如果 retryable 則停在 retry/skip loop」。沒有「等待輸入」停駐點。見 `src/components/setup-wizard/wizard-runner.ts:237-287`。

**WSL**

| Step | 當前 error path | 備註 |
|------|-----------------|------|
| `detect-env` | `wsl.list()` 失敗就 throw raw string 包裝訊息 | `src/components/setup-wizard/steps/wsl/detect-env.ts:22-31` |
| `pick-wsl-distro` | 透過 `ctx.requestChoice(...)` 取得互動選擇，不靠 failed state 做 prompt | 現有 input prompt 範式已存在 |
| `wsl-systemd-check` | 缺 distro 時 throw；systemd 關閉時只寫 warning，不 fail | `src/components/setup-wizard/steps/wsl/wsl-systemd-check.ts:13-25` |
| `write-systemd-unit` | 缺前置條件時 throw；write unit 失敗 throw 固定字串；linger 失敗只 push warning；startService 失敗直接 throw backend error | `src/components/setup-wizard/steps/wsl/write-systemd-unit.ts:21-68` |

**Docker**

| Step | 當前 error path | 備註 |
|------|-----------------|------|
| `detect-env` | Docker flow 直接重用 WSL shared `detect-env`；對 docker 只呼叫 `window.electronAPI.docker.status()`，`!available` 時 raw propagate `status.error` | `src/components/setup-wizard/docker-flow.ts:15-26`, `src/components/setup-wizard/steps/wsl/detect-env.ts:13-19` |
| `pick-container` | 透過 `ctx.requestChoice(...)` 問 `new/existing`；若 existing 且沒 container 才 throw | `src/components/setup-wizard/steps/docker/pick-container.ts:18-46` |
| `install-server-bundle` | mostly guard error；無 mapping | `src/components/setup-wizard/steps/docker/install-server-bundle.ts:24-45` |
| `start-server` | startContainer / health check 失敗皆 throw raw string | `src/components/setup-wizard/steps/docker/start-server.ts:32-53` |

**SSH**

| Step | 當前 error path | 備註 |
|------|-----------------|------|
| `configure-ssh-host` | 先 cache alias；若 `sshHost` 空白立刻 `throw new Error('SSH host is required...')` | `src/components/setup-wizard/steps/ssh/configure-host.ts:65-80` |
| `verify-ssh-auth` | 已有 `errorCode` 分支：`no-ssh/permission-denied/host-key/connect-timeout/...`，組合友善 hint 後 throw | `src/components/setup-wizard/steps/ssh/verify-auth.ts:77-90` |
| `start-server` | 已有 structured `errorCode` → `startServerErrorHint(...)` → throw | `src/components/setup-wizard/steps/ssh/start-server.ts:28-95,157-162` |

結論：三平台共享 step 介面，但錯誤成熟度不一致。SSH 已接近 framework-ready；Docker/WSL 仍多為 raw strings。

#### A.3 BUG-072 / 073 / 074 root cause 細節

| BUG | Step file | 拋錯位置 / path | 當前 UI status | 期望 |
|-----|-----------|-----------------|----------------|------|
| 072 | `src/components/setup-wizard/steps/wsl/write-systemd-unit.ts` | linger 失敗目前只寫 warning（`ctx.warnings.push(...)`），真正阻塞多半在 `startService(...).ok === false` 時 `throw new Error(startResult.error)` | `failed` + raw backend訊息 | `failed` + mapped friendly copy + `fixed-and-retry` / journal guidance |
| 073 | `src/components/setup-wizard/steps/wsl/detect-env.ts`（docker 分支） | `docker.status().available === false` 時直接 `throw new Error(status.error || ...)` | `failed` + 原生 docker CLI/connect 訊息 | `failed` +「Docker Desktop 未安裝/未啟動」人話 + download/start actions |
| 074 | `src/components/setup-wizard/steps/ssh/configure-host.ts` | `!state.sshHost` 時在 first run 直接 throw | `failed` + Retry/Skip/Cancel | `awaiting-input`，顯示 prompt / 繼續 / 取消，不算錯誤 |

額外發現：

- `SetupWizardShell` 已有 `activeChoice` prompt 區塊，可 render options + skip；說明 BAT 已經有「互動式等待」的 UI 容器，只是現在只支援 choice prompt，不支援 freeform input/form prompt。見 `src/components/setup-wizard/SetupWizardShell.tsx:202-230`。
- `SetupWizardShell.test.tsx` 目前只測 `running`、`failed actions`、`jumpToStep`、`completed click-through`，沒有任何 `awaiting-input` 測試基線。見 `src/components/setup-wizard/__tests__/SetupWizardShell.test.tsx:89-268`。

### Phase B：方案 spike

#### B.1 Stepper `awaiting-input`

| 方案 | 優點 | 缺點 | 結論 |
|------|------|------|------|
| B.1-A 新增獨立 status `awaiting-input` | 語意最清楚；a11y/CTA/render rule 可獨立；最符合 BUG-074 本質 | 要動 `StepStatus`、`WizardStepStatus`、spec、tests、CSS | **推薦** |
| B.1-B 複用 `running` + `awaitingInput: true` flag | 型別面積較小 | 兩套語意來源；current step 與 visual rule 會分裂；callsite 更難懂 | 不推薦 |
| B.1-C input step 脫離 stepper flow | prompt 可高度自由 | 破壞 wizard「單一流程感」；也無法在 stepper 上表達目前卡在哪一步 | 不推薦 |

推薦理由：問題不是純 CSS，而是 state machine 缺語意。既然 `failed`、`skipped`、`rolled-back` 都是獨立 status，`awaiting-input` 也應如此。

#### B.2 Error mapping framework

| 方案 | 優點 | 缺點 | 結論 |
|------|------|------|------|
| B.2-A 純 regex + 每平台 dictionary | 上線快 | brittle；無法重用 SSH 現有 `errorCode` | 可當 fallback，不宜當主方案 |
| B.2-B `errorCode + regex` 混合 | 兼容現況；讓 SSH 立即受益；Docker/WSL 可漸進遷移 | framework 稍複雜 | **推薦** |
| B.2-C class / instanceof chain | 抽象漂亮 | 現況 step 幾乎都 throw `Error` 字串；需要大重構才有價值 | 不推薦 |

推薦理由：`verify-ssh-auth` 與 `start-server` 已經證明 `errorCode` 值得投資，但 `detect-env` / `write-systemd-unit` 還沒跟上，所以混合式最合理。

#### B.3 Pre-flight framework

| 方案 | 優點 | 缺點 | 結論 |
|------|------|------|------|
| B.3-A `preflight?: () => Promise<PreflightResult>` | 最少 boilerplate；可先掛在既有 step；便於 cache | runner 要補一層 hook | **推薦** |
| B.3-B preflight 當獨立 step type | 視覺語意清楚 | step list 會膨脹；很多 preflight 只想做 guard 不想額外占一步 | 可做後續延伸，不作 v1 |
| B.3-C 每個 step 自行處理 | 零 framework 成本 | 重複實作；錯誤文案與 cache 散落 | 不推薦 |

推薦理由：本 PLAN 的重點是「統一 UX」，不是再把平台特例分散回各 step。

#### B.4 Recovery actions

| 方案 | 優點 | 缺點 | 結論 |
|------|------|------|------|
| B.4-A 任意 `actions: Action[]` | 最彈性 | 缺少設計約束；各 step 容易各畫各的 | 次佳 |
| B.4-B 固定 4 enum | 規格最簡單 | 無法表達 `fixed-and-retry`、`open-link` 與未來 custom | 太僵硬 |
| B.4-C hybrid：內建 kind + 允許 custom | 大多數情境可標準化，仍保留擴充性 | 型別稍多 | **推薦** |

建議內建 kinds：

- `retry`
- `fixed-and-retry`
- `open-link`
- `edit-config`
- `skip`
- `cancel`
- `custom`

### Phase C：Reachability Matrix

#### C.1 Status transition matrix

| From | To | 合法? | 備註 |
|------|----|------|------|
| `pending` | `running` | 是 | 現況 runner 行為 |
| `pending` | `awaiting-input` | 是 | 建議新增，input step 初始停駐 |
| `awaiting-input` | `running` | 是 | 使用者提交後開始執行 |
| `awaiting-input` | `failed` | 是 | 使用者提交無效或外部驗證失敗 |
| `running` | `completed` | 是 | 現況 runner 行為 |
| `running` | `failed` | 是 | 現況 runner 行為 |
| `running` | `skipped` | 是 | 透過 failed loop 的 skip 或 choice skip |
| `running` | `rolled-back` | 是 | rollback path |
| `failed` | `pending` | 是 | retry / jumpToStep reset |
| `failed` | `awaiting-input` | 否（直接） | 必須經 reset/retry 明確回到等待輸入 |
| `completed` | `awaiting-input` | 否 | 已完成 step 不應倒流成等待輸入 |
| `skipped` | `awaiting-input` | 否 | 同上 |

#### C.2 Error mapping reachability matrix

| Platform | Step | Error pattern / code | Friendly message intent | 當前 schema 可達? | 本 PLAN 涵蓋 |
|----------|------|----------------------|-------------------------|-------------------|--------------|
| WSL | `write-systemd-unit` | `Unable to enable linger automatically: ...` warning | 說明 lingering / 手動 `loginctl` / 再試 | 部分可達，只在 warning panel，不是 failed CTA | 是 |
| WSL | `write-systemd-unit` | `startResult.error` from `startService` | 服務啟動失敗，提示 journal / 修好後重試 | 是，作為 failed raw error | 是 |
| WSL | `wsl-systemd-check` | systemd disabled | fallback manual start，非 fatal | 是，warning only | 是 |
| Docker | `detect-env` | daemon not running / missing pipe / cannot connect | Docker Desktop 未安裝或未啟動 | 是，failed raw error | 是 |
| Docker | `pick-container` | no containers in existing mode | 說明改選 create-new | 是 | 是 |
| Docker | `start-server` | startContainer fail / unhealthy / timeout | 容器啟動或健康檢查失敗 | 是，failed raw error | 是 |
| SSH | `configure-ssh-host` | empty host before submit | 應為 awaiting-input，不是 failed | **不可正確表達**（現況錯映） | 是 |
| SSH | `verify-ssh-auth` | `no-ssh` | 安裝 OpenSSH client | 是，已有 code/hint | 是 |
| SSH | `verify-ssh-auth` | `permission-denied` | 產 key / 配置 key | 是，已有 code/hint | 是 |
| SSH | `verify-ssh-auth` | `host-key` | 手動接受 host key 後 retry | 是，已有 code/hint | 是 |
| SSH | `verify-ssh-auth` | `connect-timeout` | 檢查主機與防火牆 | 是，已有 code/hint | 是 |
| SSH | `start-server` | `unit-write-failed` / `enable-failed` / `start-failed` / `verify-failed` | platform-specific remediation | 是，已有 code/hint | 是 |

Reachability takeaway：

- **已可達且最值得先 framework 化**：Docker `detect-env`、WSL `write-systemd-unit`、SSH `configure-ssh-host`
- **已半結構化，可作 reference implementation**：SSH `verify-ssh-auth`、`start-server`
- **當前 schema unreachable / mis-modeled**：input step 的「尚未輸入」狀態

### Phase D：拆單建議

#### D.1 Sprint 2-5 建議工單列表

| 工單號 | 標題 | Sprint | Sizing | 依賴 | 平行可? | Reachable? | OOS |
|--------|------|--------|--------|------|--------|------------|-----|
| T03xx | Stepper + WizardRunner `awaiting-input` 狀態擴充 | 2 | M | — | 否（多票依賴） | 是 | 不做視覺 token 重構 |
| T03xx | WizardErrorMapper framework（registry + fallback） | 2 | M | — | 是 | 是 | 不一次清完所有字典 |
| T03xx | WizardPreflight hook + cache | 2 | M | — | 是 | 是 | 不抽成獨立 visual step |
| T03xx | Recovery actions schema + SetupWizardShell wiring | 2 | M | Stepper status 擴充 | 部分 | 是 | 不做 arbitrary plugin actions |
| T03xx | 設計規範 / tests 更新（Stepper + SetupWizardShell） | 2 | S | Stepper status 擴充 | 是 | 是 | 不做多語文案落地 |
| T03xx | BUG-074 SSH input-step awaiting-input 落地 | 3 | M | awaiting-input + recovery wiring | 是 | 是 | 不做完整 freeform form-builder |
| T03xx | BUG-073 Docker detect-env mapping + download/start actions | 3 | M | ErrorMapper + open-link action | 是 | 是 | 不做 Docker advanced settings UI |
| T03xx | BUG-072 WSL linger/systemd mapping + fixed-and-retry flow | 3 | M | ErrorMapper + recovery wiring | 是 | 是 | 不改 deployment model |
| T03xx | Cross-platform input step abstraction（choice vs form prompt） | 4 | M/L | BUG-074 learning | 否 | 是 | 不重寫整個 detail panel |
| T03xx | Integration tests: transition matrix + mapped UX cases | 5 | M | 前述 framework 與 bugfix | 是 | 是 | 不做 full e2e lab infra |
| T03xx | Audit / release notes / docs polish | 5 | S | 全部完成 | 是 | 是 | 不改 unrelated wizard copy |

總量：約 10-11 張，符合工單預估的「Sprint 2-5 共 ~10-12 張」。

#### D.2 依賴圖

```text
T0328 research
  |
  +-- Sprint 2 foundation
  |    +-- A. awaiting-input state
  |    +-- B. error mapper
  |    +-- C. preflight hook
  |    +-- D. recovery actions
  |    +-- E. tests/spec refresh
  |
  +-- Sprint 3 platform fixes
  |    +-- BUG-074 SSH input-step UX
  |    +-- BUG-073 Docker daemon UX
  |    +-- BUG-072 WSL linger/systemd UX
  |
  +-- Sprint 4 abstraction
  |    +-- unified input-step model
  |
  +-- Sprint 5 verification
       +-- integration tests
       +-- audit + release notes
```

#### D.3 拆單順序建議

1. 先做 `awaiting-input`、ErrorMapper、Recovery actions。
2. `preflight` 可與 ErrorMapper 平行，但至少要在 Docker/WSL bugfix 前落地一版 hook。
3. BUG-074 先做，因為它會迫使 runner/detail panel 的 input contract定型。
4. BUG-073 / BUG-072 再套 framework；這兩張可平行。
5. 最後再收斂 cross-platform input abstraction 與整合測試。

### Phase E：拍板項

1. **Stepper 狀態擴充**
   - 選項：
     - A. 新增 `awaiting-input`
     - B. 沿用 `running` + flag
     - C. input prompt 脫離 stepper
   - 推薦：A
   - 理由：狀態機才是缺口，flag 只會把語意藏到 callsite。

2. **Error mapping 策略**
   - 選項：
     - A. 純 regex
     - B. `errorCode + regex` 混合
     - C. exception class 鏈
   - 推薦：B
   - 理由：SSH 現成可用，Docker/WSL 又能漸進補齊。

3. **Pre-flight 形態**
   - 選項：
     - A. `step.preflight`
     - B. 獨立 preflight step
     - C. 各 step 自行處理
   - 推薦：A
   - 理由：最小侵入，便於 cache 與統一 failure UX。

4. **Recovery actions 模型**
   - 選項：
     - A. 任意 actions array
     - B. 固定 enum only
     - C. hybrid typed actions
   - 推薦：C
   - 理由：既能規範共用 UX，也保留 open-link / custom 擴充。

5. **BUG-072 fallback 策略**
   - 選項：
     - A. 僅提示手動 `loginctl enable-linger`
     - B. 完全放棄 linger，改每次臨時啟動
     - C. 先嘗試 linger，失敗時提供 manual fix + optional fallback
   - 推薦：C
   - 理由：保留原 deployment 設計，同時降低卡死率。

6. **input step 範圍**
   - 選項：
     - A. 只修 SSH `configure-host`
     - B. 抽象為全 wizard 通用 input-step contract
   - 推薦：先 A 後 B
   - 理由：Sprint 3 可先止血 BUG-074，Sprint 4 再一般化，風險較低。

7. **i18n 範圍**
   - 選項：
     - A. 本 PLAN 只留 `messageKey` hook，不補全翻譯
     - B. 連英文與中英文案一起落地
   - 推薦：A
   - 理由：塔台預答已偏向只留 hook；先固化 API，比先寫大量 copy 更重要。

8. **Ship gate**
   - 選項：
     - A. foundation + BUG-074 就出貨
     - B. 三個 bug family 都補齊再出貨
   - 推薦：B
   - 理由：這三個問題被定義成同族 UX overhaul；拆半套出貨會讓使用者對 wizard 心智更混亂。

### Phase F：（可選）Spec 文件

- 已建立：`_ct-workorders/_spec-wizard-error-ux.md`
- 內容涵蓋：
  - `awaiting-input` status contract
  - `WizardStep.kind / preflight / getRecoveryActions` 建議 API
  - ErrorMapper registry shape
  - Recovery action 型別
  - 首批 mapping target
- 建議後續工單直接引用此 spec，而不是重複擷取 T0328 長文段落。

### 互動紀錄

無

### OOS but justified（如有）

無 runtime code 變更、無 UI prototype、無 locale 文案落地。這些都刻意留給後續實作工單，避免研究工單在未拍板前先綁死實作。

---

**狀態**：🔄 IN_PROGRESS
