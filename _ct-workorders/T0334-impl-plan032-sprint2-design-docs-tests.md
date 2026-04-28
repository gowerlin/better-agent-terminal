---
schema_version: 1
schema_kind: workorder
id: T0334
title: "PLAN-032 Sprint 2: 設計規範 + visual snapshot tests + i18n hook 整理（Sprint 2 收尾）"
type: docs
status: DONE
created_at: "2026-04-27T23:32:00+08:00"
started_at: "2026-04-27T23:33:00+08:00"
completed_at: "2026-04-27T23:43:00+08:00"
renew_count: 0
---
# T0334 — PLAN-032 Sprint 2: 設計規範 + visual snapshot tests + i18n hook 整理（Sprint 2 收尾）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0334 |
| 標題 | 更新 `docs/design/bat-stepper-design-language.md` 加 `awaiting-input` 規範 + Stepper visual snapshot tests + i18n hook 文件補完 |
| 類型 | docs + tests（規範收尾） |
| 優先級 | 🟡 Medium（Sprint 2 收尾，無新功能；為 Sprint 3 BUG fix 工單與後續開發者鋪規範路） |
| 狀態 | ✅ DONE |
| 開始時間 | 2026-04-27 23:33 (UTC+8) |
| 完成時間 | 2026-04-27 23:43 (UTC+8) |
| 建立時間 | 2026-04-27 23:32 (UTC+8) |
| 派發模式 | `--mode yolo --no-interactive` |
| 關聯 PLAN | PLAN-032（Sprint 2 收尾，最後一票） |
| 關聯 spec | `_ct-workorders/_spec-wizard-error-ux.md` § 1（visual contract）/ § 4（preflight）/ § 5（recovery actions） |
| 關聯前序 | T0330 ✅ `e0a23e5` / T0331 ✅ `85eb8ff` / T0332 ✅ `8bb972e` / T0333 ✅ `a24ba4a` |
| 關聯文件 | `docs/design/bat-stepper-design-language.md`（PLAN-030 產出，現需擴 awaiting-input） |
| 預估時間 | 30-60 min（S，純文件 + tests，無框架改動） |
| Renew 次數 | 0 |
| affects_files | `docs/design/bat-stepper-design-language.md`（更新 § 3 狀態-視覺對應表 + § 7 Don't 反例 + § 8 i18n 段落）、`src/components/Stepper/__tests__/Stepper.test.tsx`（新增 awaiting-input visual snapshot）、`src/components/setup-wizard/__tests__/SetupWizardShell.test.tsx`（新增 mapped error visual snapshot 1-2 case）、`src/locales/{en,zh-TW,zh-CN}.json`（補 wizard error mapping i18n keys 文件化說明）、可選 `docs/design/wizard-error-ux.md`（新檔，把 Sprint 2 落地的 framework 文件化給 Sprint 3 開發者） |

## 背景

Sprint 2 四支 framework 工單（T0330/T0331/T0332/T0333）已落地，PLAN-032 Sprint 2 進入收尾。本票只做：

1. **設計規範同步**：把 `awaiting-input` 視覺/a11y/transition 規範加入 PLAN-030 的 design language 文件（避免下次有人改 Stepper 不知此狀態存在）
2. **Visual snapshot tests**：補 Stepper + SetupWizardShell 在 awaiting-input + mapped error 場景的 snapshot，鎖視覺契約（T0339 integration matrix 仍待 Sprint 5）
3. **i18n hook 文件化**：T0333 已補 `wizard.action.fixedAndRetry` / `wizard.action.showDetails`，本票把所有 wizard error mapping 相關 i18n keys 整理列表，並在 design doc 寫清「framework 已 i18n-ready，未補翻譯內容」（D108 範圍）

**不做**（OOS）：
- ❌ 補翻譯字串（D108：framework hook only，no copy）
- ❌ a11y audit（留 Sprint 5 / T0339）
- ❌ Sprint 3 BUG 修復

## 目標（驗收條件，工單級）

### AC-1：design language 文件擴充

`docs/design/bat-stepper-design-language.md`：

#### § 3 狀態-視覺對應表 加入新 row

```markdown
| `awaiting-input` | `●` | `#38bdf8`（藍） | 等待使用者輸入（input step kind） | 不掛 `role="alert"`，不顯示 Retry/Skip CTA |
```

#### § 3 Severity 順序更新

從 PLAN-030 既有：`failed > running > skipped > rolled-back > pending > completed`
更新為：`failed > running > awaiting-input > skipped > rolled-back > pending > completed`

並加註：「awaiting-input 排在 running 後 skipped 前，因為它代表使用者主動干預中（高於被略過，但低於正在執行的步驟）」

#### § 6 適用情境清單

「✅ 已套用」加入：
- SetupWizard input steps（SSH `configure-host`、WSL `pick-wsl-distro`、Docker `pick-container` / `configure-mounts`）— 透過 `WizardStepKind = 'input'` 自動標註，runner 在 `requestChoice` pending 期間流轉到 awaiting-input

#### § 7 Don't 反例 加入

```markdown
### ❌ 不要把 input step 標 `failed`

input step（`kind: 'input'`）開啟時應顯示為 `awaiting-input`，不是 `failed`。
舊版 SSH wizard 第 1 步開啟時誤示 failed（紅 X + Retry/Skip）→ BUG-074 root cause。

### ❌ 不要在 awaiting-input 上掛 `role="alert"`

`role="alert"` 是 failure-only。awaiting-input 是中性狀態，使用 `aria-current="step"` + `aria-describedby` 點到 prompt region 即可。
```

#### § 8 i18n 段落擴充（如未存在則新增）

```markdown
### Wizard Error Mapping i18n keys

framework 已 i18n-ready（PLAN-032 Sprint 2，T0331 ErrorMapper 採 `messageKey` lookup）。
目前覆蓋下列 keys（zh-TW / en / zh-CN 三檔）：

- `wizard.action.fixedAndRetry`：「已修復，重試」
- `wizard.action.showDetails`：「顯示詳細」
- `docker.daemon.unavailable`：title + body（zh-TW 字典在 error-mapper.ts 內）
- `wsl.linger.failure`：title + body
- `ssh.auth.permission-denied`：title + body
- `fallback`：title 「步驟發生錯誤」+ body（取 raw error.message）

> 後續開發者新增 registry entry 時，請同步在三 locale 檔案補 i18n keys（即使暫時複製 zh-TW 內容）。
> 字典目前內嵌於 `error-mapper.ts` `MESSAGE_DICT`，未來可拆出至 i18n loader（OOS）。
```

### AC-2：Stepper visual snapshot tests

`src/components/Stepper/__tests__/Stepper.test.tsx`：

新增 1-2 case：

1. **awaiting-input visual snapshot**：渲染含一個 `awaiting-input` step 的 Stepper，`toMatchInlineSnapshot()` 鎖：
   - icon 為 `●`
   - 顏色 hex 為 `#38bdf8`
   - 不含 `role="alert"`
   - 不渲染 Retry/Skip 按鈕
2. **awaiting-input + 其他狀態混合 snapshot**：渲染含 `[completed, running, awaiting-input, pending]` 四個 step，鎖整體 layout 與 severity 排序顯示

### AC-3：SetupWizardShell mapped error visual snapshot

`src/components/setup-wizard/__tests__/SetupWizardShell.test.tsx`：

新增 1 case（補 T0333 5 case 之外）：

1. **mapped error 完整視覺 snapshot**：模擬 `snapshot.status='failed'` + `mappedError={ title, body, actions: [open-link, fixed-and-retry, cancel], detailMode: 'append-raw', rawError }`，`toMatchInlineSnapshot()` 鎖：
   - title 顯示為 rose-200 semibold
   - body 顯示為 rose-100
   - raw 在 `<pre>` 內、有 border + dark bg
   - 3 個按鈕順序與文字正確
   - `data-action-kind` 屬性正確（讓 BUG fix 工單可錨定測試）

### AC-4：i18n keys 完整性檢查

新增小型測試（同檔或新檔 `i18n-completeness.test.ts`）：

```ts
import en from '@/locales/en.json';
import zhTW from '@/locales/zh-TW.json';
import zhCN from '@/locales/zh-CN.json';

const REQUIRED_WIZARD_KEYS = [
  'wizard.action.fixedAndRetry',
  'wizard.action.showDetails',
];

it.each(REQUIRED_WIZARD_KEYS)('locale files contain key %s', (key) => {
  // 用 lodash.get 或 split('.').reduce 取巢狀
  expect(getNested(en, key)).toBeDefined();
  expect(getNested(zhTW, key)).toBeDefined();
  expect(getNested(zhCN, key)).toBeDefined();
});
```

> 後續開發者改動 registry 或 actions 時若漏補 i18n key，此測試會掉。

### AC-5（可選）：wizard-error-ux.md 開發者指南

新檔 `docs/design/wizard-error-ux.md`，內容：

- Framework 三層架構：Stepper status / WizardRunner state machine / ErrorMapper + Preflight + RecoveryActions
- 「我要新增一個 mapped error」流程：
  1. 在 `error-mapper.ts` `DEFAULT_WIZARD_ERROR_REGISTRY` append entry
  2. 在 `MESSAGE_DICT` 補 messageKey 對應
  3. 在 `src/locales/*.json` 補 i18n keys（若 framework 升級到 i18n loader 後）
  4. 跑 i18n completeness test 確認
- 「我要新增一個 preflight check」流程：
  1. 在 step 定義加 `preflight: async (ctx) => ...`
  2. 回傳 `WizardPreflightResult`（ok / warningOnly / cacheKey）
  3. 失敗時 errorCode 對到 ErrorMapper registry 的 entry
- 「我要新增一個 recovery action kind」流程：
  1. 擴 `WizardRecoveryAction` union
  2. 在 `SetupWizardShell.dispatchAction` 加 case
  3. 補 default label 與 i18n key

> 此檔讓 Sprint 3 BUG fix 工單與未來開發者快速上手，避免再次找 spec 拼湊。

### AC-6：build / test 全綠

- `npm run test:unit` 全綠（baseline 244 + 本票 ≥3 = ≥247）
- `npx vite build` 綠
- `docs/design/bat-stepper-design-language.md` markdown lint 綠（沿用既有 lint config）

## 實作順序建議

1. **Step 1**：`docs/design/bat-stepper-design-language.md` 更新（§ 3 / § 6 / § 7 / § 8）
2. **Step 2**：（可選）新增 `docs/design/wizard-error-ux.md`
3. **Step 3**：Stepper.test.tsx 加 awaiting-input snapshot（1-2 case）
4. **Step 4**：SetupWizardShell.test.tsx 加 mapped error 完整 snapshot（1 case）
5. **Step 5**：i18n completeness test（新檔或併入既有）
6. **Step 6**：`npm run test:unit` 全綠
7. **Step 7**：commit `docs(setup-wizard): finalize PLAN-032 Sprint 2 design language and i18n hook docs (T0334)`

## 風險與緩解

| 風險 | 緩解 |
|------|------|
| inline snapshot 因 className 微變動頻繁 fail | 用 `data-testid` + property assertion 取代部分視覺，僅 snapshot 真正穩定的 layout |
| i18n 三檔 keys 不一致導致測試紅 | 本票第一步先掃三檔差異，確保 baseline 一致再加 completeness test |
| 既有 design doc 結構變動破壞既有 reader 預期 | 只 append section，不重排既有；新增段標明確 「PLAN-032 Sprint 2 補入」 |
| `wizard-error-ux.md` 新檔內容過時（與程式碼 drift） | 文件最後一段加「最後同步：T0334 / commit hash」並備註「若擴 framework 請同步更新此檔」 |

## 自檢清單

- [ ] AC-1：design language 文件 § 3/§ 6/§ 7/§ 8 更新完成
- [ ] AC-2：Stepper awaiting-input visual snapshot 1-2 case 通過
- [ ] AC-3：SetupWizardShell mapped error 完整 snapshot 通過
- [ ] AC-4：i18n completeness test 通過（≥2 keys 三檔齊備）
- [ ] AC-5（可選）：wizard-error-ux.md 開發者指南產出
- [ ] AC-6：build / test 全綠（baseline 244 + ≥3 → ≥247）
- [ ] commit message：`docs(setup-wizard): finalize PLAN-032 Sprint 2 design language and i18n hook docs (T0334)`

## YOLO 模式 — Sprint 2 收尾

T0334 DONE → **PLAN-032 Sprint 2 完整收尾**（5/5 工單），可進入 Sprint 3：

- **T0335**：BUG-074 SSH input-step `awaiting-input` 落地（套用 T0330 framework）
- **T0336**：BUG-073 Docker detect-env mapping + download/start actions（套用 T0331/T0333 framework）
- **T0337**：BUG-072 WSL linger/systemd mapping + fixed-and-retry flow（套用 T0331/T0333 framework）

塔台 T0334 收尾後決定：直接續 Sprint 3 鏈式派發 / 或暫停讓使用者驗收 / 或收工。

## 回報區（Worker 填寫）

### 實作摘要

PLAN-032 Sprint 2 收尾完成。本票交付：

1. **`docs/design/bat-stepper-design-language.md` v1.1**：新增 `awaiting-input` 狀態到 § 2 type union（6 → 7 values）、§ 3 狀態-視覺對應表（icon `●` / 色 `#38bdf8` / a11y 行為 / BUG-074 規範說明）、§ 3 severity 順序更新（含 awaiting-input 在 running 後 skipped 前的位序解釋）、§ 6 新增「Setup Wizard input steps」已套用列、§ 7 新增 2 條 Don't 反例（「不要把 input step 標 failed」、「不要在 awaiting-input 上掛 role=alert」）、§ 8 新增「Wizard Error Mapping i18n keys」段落（列出 `wizard.action.*` 7 keys + `error-mapper.ts` `MESSAGE_DICT` 4 keys + 後續開發者 callout）。
2. **`docs/design/wizard-error-ux.md`（新檔）**：開發者指南，三層架構說明（Stepper status / WizardRunner state machine / ErrorMapper+Preflight+RecoveryActions）+ 三段「我要新增 mapped error / preflight / recovery action kind」流程指引 + 工單清單與 last-sync 標記。
3. **Stepper visual snapshot（`Stepper.visual.snapshot.test.tsx` 新檔，2 case）**：lock awaiting-input 單列視覺契約（icon / color / a11y / status-class）、lock `[completed, running, awaiting-input, pending]` 混合排序的 status-class fingerprint inline snapshot。
4. **SetupWizardShell mapped error snapshot（appended T0334 describe block，1 case）**：lock docker daemon 失敗的完整 mapped-error panel（title rose-200 semibold / body rose-100 / `<pre>` raw with border + dark bg / 3 buttons fingerprint inline snapshot：open-link / fixed-and-retry / cancel）。
5. **i18n completeness test（`src/locales/__tests__/i18n-completeness.test.ts` 新檔）**：守住 `wizard.action.*` 7 keys 三檔（en / zh-TW / zh-CN）齊備 + key set 完全相同（22 cases：7 keys × 3 locales + 1 set-equality test）。

### 文件變動範圍

`docs/design/bat-stepper-design-language.md` 補丁清單（v1.0 → v1.1）：

- header version 升級至 v1.1，加列 `error-mapper.ts` 為參考實作
- § 2 `StepStatus` union 7 values（新增 `awaiting-input`）+ Sprint 2 出處註記
- § 3 表格新增 `awaiting-input` row + 表後 callout 強調「不是錯誤態」
- § 3 severity 順序加入 `awaiting-input`（running 後 skipped 前）+ 位序解釋
- § 6 「✅ 已套用」追加「Setup Wizard input steps」row
- § 7 Don't 反例追加 2 條（input-step-as-failed / role=alert on awaiting-input）
- § 8 新增 `#### Wizard Error Mapping i18n keys` subsection

新檔 `docs/design/wizard-error-ux.md`（約 130 行）：三層架構 + 3 段 how-to + 工單清單。

### Snapshot 測試錨定點

| 檔案 | 鎖契約方式 | 變動敏感度 |
|------|-----------|----------|
| `Stepper.visual.snapshot.test.tsx` | property assertion（textContent / style.color / aria-* / className 包含 `bat-stepper-status-*`）+ inline snapshot of status-class fingerprint array | 對 className 順序與全文外觀**不敏感**；對狀態語意 class（`bat-stepper-status-awaiting-input`）+ a11y attrs + preset icon/color **敏感** |
| `SetupWizardShell.test.tsx` T0334 block | property assertion（rose-200 / rose-100 / border-rose-900/60 / bg-rose-950/40 className 子集）+ `data-action-kind` button fingerprint inline snapshot | 對 button label 文字、`data-action-kind` 屬性、按鈕順序**敏感**；對外層 panel 結構鬆綁（不 lock outerHTML） |

刻意避用 `toMatchInlineSnapshot()` lock 整段 outerHTML（工單風險段落已警告：className 微變動 → 頻繁 false fail）。

### i18n keys 三檔同步狀況

| Key | en.json | zh-TW.json | zh-CN.json |
|-----|---------|-----------|-----------|
| `wizard.action.retry` | Retry | 重試 | 重试 |
| `wizard.action.skip` | Skip | 跳過 | 跳过 |
| `wizard.action.cancel` | Cancel | 取消 | 取消 |
| `wizard.action.editConfig` | Edit settings | 編輯設定 | 编辑设置 |
| `wizard.action.skipChoice` | Skip | 跳過 | 跳过 |
| `wizard.action.fixedAndRetry` | Already fixed, retry | 已修復，重試 | 已修复，重试 |
| `wizard.action.showDetails` | Show details | 顯示詳細 | 显示详细 |

三檔在本票完成前**已齊備**（T0309 baseline + T0333 補入 fixedAndRetry/showDetails），本票只新增 completeness test 守住 future drift，未補翻譯字串（D108 嚴禁）。

### 偏離 spec 的決策

無實質偏離。AC-2 / AC-3 採「property assertion + 範圍縮小的 inline snapshot」取代「整段 outerHTML inline snapshot」，**已在工單風險段落明確授權**（「用 `data-testid` + property assertion 取代部分視覺，僅 snapshot 真正穩定的 layout」）。

### 自檢結果

- [x] AC-1：design language 文件 § 2 / § 3 / § 6 / § 7 / § 8 全部更新
- [x] AC-2：Stepper awaiting-input visual snapshot 2 case（單列契約 + 混合 fingerprint）
- [x] AC-3：SetupWizardShell mapped error 完整 snapshot 1 case（docker daemon scenario）
- [x] AC-4：i18n completeness test 22 case 全綠（7 keys × 3 locales + 1 set-equality）
- [x] AC-5（可選）：`docs/design/wizard-error-ux.md` 開發者指南產出
- [x] AC-6：`npm run test:unit` 269 pass / 269（baseline 244 + 本票新增 25）；`npx vite build` 綠
- [x] commit hash：`4b43a4f`（reverse-write 規則，commit 後填入）

### 後續建議

- T0334 DONE → **PLAN-032 Sprint 2 完整收尾（5/5）**
- Sprint 3 可立即派發鏈式工單：
  - **T0335**（BUG-074 SSH input-step `awaiting-input` 落地）：套用本票 Stepper 規範 § 3 + § 7 第一條 Don't；驗收用本票 Stepper.visual.snapshot.test.tsx 作對照
  - **T0336**（BUG-073 Docker detect-env mapping + actions）：registry 新增 entry 走「我要新增一個 mapped error」流程（wizard-error-ux.md § 2）
  - **T0337**（BUG-072 WSL linger fixed-and-retry flow）：sniff 既有 wsl-linger-failure entry，補 errorCodes / 確認 fixed-and-retry callsite
- 派 Sprint 3 工單時建議 attach `docs/design/wizard-error-ux.md` 為前置條件閱讀，可省 30+ min 規格摸索

---

**狀態流轉**：📋 PENDING → 🔄 IN_PROGRESS → ✅ DONE
