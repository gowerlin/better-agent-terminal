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

（Worker 填）

### Phase A：現況盤點

（Worker 填）

### Phase B：方案 spike

（Worker 填）

### Phase C：Reachability Matrix

（Worker 填）

### Phase D：拆單建議

（Worker 填）

### Phase E：拍板項

（Worker 填）

### Phase F：（可選）Spec 文件

（Worker 填）

### 互動紀錄

（Worker 填）

### OOS but justified（如有）

（Worker 填）

---

**狀態**：🔄 IN_PROGRESS
