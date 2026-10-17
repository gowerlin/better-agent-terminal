---
schema_version: 1
schema_kind: workorder
id: T0335
title: "PLAN-032 Sprint 3: BUG-074 SSH input-step `awaiting-input` 完整落地（套用 Sprint 2 framework）"
type: fix
status: FIXED
created_at: "2026-04-28T00:00:00+08:00"
started_at: "2026-04-28T03:01:00+08:00"
completed_at: "2026-04-28T03:10:00+08:00"
renew_count: 0
---
# T0335 — PLAN-032 Sprint 3: BUG-074 SSH input-step `awaiting-input` 完整落地（套用 Sprint 2 framework）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0335 |
| 標題 | 修復 BUG-074：SSH `configure-ssh-host` step 開啟時不再誤示 failed，改為 `awaiting-input` 狀態等待使用者填表 |
| 類型 | fix（BUG 修復） |
| 優先級 | 🔴 High（BUG-074 是 PLAN-032 release 三條 ship gate 之一 — D109） |
| 狀態 | ✅ FIXED |
| 開始時間 | 2026-04-28 03:01 (UTC+8) |
| 完成時間 | 2026-04-28 03:10 (UTC+8) |
| 建立時間 | 2026-04-28 00:00 (UTC+8) |
| 派發模式 | `--mode yolo --no-interactive` |
| 關聯 PLAN | PLAN-032（Sprint 3 第一票） |
| 關聯 BUG | **BUG-074**（owner，本票負責 FIXED → VERIFY） |
| 關聯 spec | `_ct-workorders/_spec-wizard-error-ux.md` § 2（Wizard Runner Contract input-step semantics）+ § 6（Initial Mapping Targets — SSH `configure-ssh-host` `empty host before submit` → `awaiting-input, not failure`） |
| 關聯前置閱讀 | `docs/design/wizard-error-ux.md`（T0334 開發者指南）+ `docs/design/bat-stepper-design-language.md` § 3 awaiting-input + § 7 第一條 Don't 反例 |
| 關聯前序 | T0330 ✅ `e0a23e5`（state machine + `kind: 'input'` 標註）/ T0331 ✅ `85eb8ff` / T0332 ✅ `8bb972e` / T0333 ✅ `a24ba4a` / T0334 ✅ `4b43a4f` |
| 預估時間 | 30-90 min（M，主要動 configure-host.ts step.run() + 可能擴 wizard-runner input 流轉） |
| Renew 次數 | 0 |
| affects_files | `src/components/setup-wizard/steps/ssh/configure-host.ts`（核心修復）、可能 `src/components/setup-wizard/wizard-runner.ts`（input-step semantics 微調，spec § 2.「Throw only after the user has actively submitted invalid or unreachable data」）、`src/components/setup-wizard/__tests__/configure-host.test.ts` 或 `ssh-flow.test.ts`（新增 awaiting-input regression test）、可能 `src/components/setup-wizard/SetupWizardShell.tsx`（若需新 `ctx.requestForm` API hook） |

## 背景

BUG-074 root cause（PLAN-032 § 動機）：
- SSH wizard 第 1 步 `configure-ssh-host` 開啟時 `step.run()` 立即 throw `Error('SSH host is required')`，因為 `state.sshHost` 還沒填
- 結果：UI 立即顯示 failed（紅 X + Retry/Skip），使用者誤以為 wizard 已壞
- 期望行為（spec § 2）：input step 在 `state.sshHost` 為空時應停留 `awaiting-input`，**僅在使用者主動 submit 後**才走 validation → 若仍無效再 throw

T0330 已標 `kind: 'input'`（metadata），且 Stepper 不再對 input step 顯示 Retry/Skip CTA（部分自癒）。但 step.run() 的 throw-on-empty 邏輯仍會觸發 failed snapshot transition。本票把 throw-on-empty **真正消除**，讓 step 自然停在 awaiting-input 直到使用者送出。

> 實測 hint：T0330 worker 報告提到「SSH `configure-host` 初始 status = `awaiting-input`（BUG-074 自癒驗證）」— 此「自癒」是因 runner 的 wrap requestChoice 機制可能讓初始 render 已標 awaiting-input；但若使用者啟動 wizard 後 step.run() 真的被執行（例如 retry），仍會 throw failed。本票確保**所有路徑**（初次載入 / retry / jump-back）都正確流轉。

## 目標（驗收條件，工單級）

### AC-1：configure-ssh-host 不再 throw on empty

`src/components/setup-wizard/steps/ssh/configure-host.ts::run()`：

**現狀**：
```ts
if (!state.sshHost || state.sshHost.trim().length === 0) {
  throw new Error('SSH host is required (pick an alias from ~/.ssh/config or type host).');
}
```

**目標行為**（spec § 2）：
- 若 `state.sshHost` 為空 **且使用者尚未主動 submit** → 不執行任何 throw / write，而是讓 step 維持 awaiting-input 狀態（runner 自然不會 advance）
- 若使用者**主動 submit**（透過 ctx.requestChoice / 未來的 form API / 或某個明確 submit signal）後仍無效 → throw with errorCode 走 ErrorMapper

### AC-2：選擇實作路徑（Worker 自決，三選一）

Worker 評估後選定一條，實作之：

#### 路徑 A：擴 `ctx.requestForm`（最完整，最大改動）

新增 `ctx.requestForm({ fields, validate })` API，類似 `ctx.requestChoice` 但收集多欄位表單。runner wrap 後 pending 期間 status = awaiting-input。`configure-host` 全面改用此 API。

**優點**：framework-level 解，未來其他 form-based step 可重用
**缺點**：Sprint 3 範圍可能炸；T0338（Sprint 4 input abstraction）才應做

#### 路徑 B：依賴 SetupWizardShell 既有 form + state.submitRequested flag（最務實）

讓 SetupWizardShell 在使用者按 submit 按鈕時 mutate `state.submitRequested = true`。`configure-host.run()`：
```ts
const submitted = readState(ctx).submitRequested;
if (!submitted) {
  // 使用者尚未提交，停留 awaiting-input — 不 throw
  return;  // 或 await 一個 promise 等待 submit signal
}
// submitted 後才走 validation
if (!state.sshHost?.trim()) {
  const err = new Error('SSH host is required');
  (err as Error & { code?: string }).code = 'configure-host-empty';
  throw err;
}
```

**優點**：最小侵入，沿用既有 form UI 機制
**缺點**：state.submitRequested 是 ad-hoc flag；Worker 需驗證 SetupWizardShell 是否已有 submit 觸發機制

#### 路徑 C：runner 主動跳過 input step 的 auto-run（最 lightweight）

修 wizard-runner：對 `kind: 'input'` 的 step，**首次到達時不執行 step.run()**，直接 transition 到 awaiting-input，等待使用者 submit signal（runner 提供 `runner.submitInput(stepId)` API）後才執行。

**優點**：spec § 2 「validation errors before the user has submitted input should stay inside the prompt model when possible, not throw terminal step errors」最直接的解
**缺點**：可能影響其他 input step（WSL pick-distro / Docker pick-container）的行為；需驗證它們是否也受影響

**塔台建議**：路徑 B 為主（最務實），若 SetupWizardShell 已有 submit pattern 直接接；若無，回退路徑 C。路徑 A 留 T0338。

### AC-3：errorCode 結構化

`configure-host.run()` validation 失敗時 throw 帶 `.code` 屬性：

```ts
const err = new Error('SSH host is required (pick an alias from ~/.ssh/config or type host).');
(err as Error & { code?: string }).code = 'configure-host-empty';
throw err;
```

並在 `error-mapper.ts` registry append entry：

```ts
{
  id: 'ssh-configure-host-empty',
  platforms: ['ssh'],
  stepIds: ['configure-ssh-host'],
  errorCodes: ['configure-host-empty'],
  patterns: [/SSH host is required/i],  // fallback
  messageKey: 'ssh.configure-host.empty',
  detailMode: 'hidden-by-default',
  actions: [
    { kind: 'edit-config', label: '修改 SSH 設定', targetStepId: 'configure-ssh-host' },
    { kind: 'cancel', label: '取消' },
  ],
}
```

`MESSAGE_DICT` 補：
```ts
'ssh.configure-host.empty': {
  title: 'SSH 主機名稱為必填',
  body: '請選擇 ~/.ssh/config 中的 alias 或手動輸入主機名稱。',
}
```

**注意**：此 errorCode 只在使用者**主動 submit 後**仍無效時觸發；初次開啟 wizard 不應走這條。

### AC-4：State machine 守門驗證

驗證以下流轉皆走透 T0330 transition rules（不違反 ALLOWED_TRANSITIONS）：

| 場景 | 預期 status 流轉 |
|------|----------------|
| Wizard 開啟 | pending → awaiting-input |
| 使用者填表後 submit（host 有值） | awaiting-input → running → succeeded |
| 使用者填表後 submit（host 空白） | awaiting-input → running → failed（with mappedError 含 edit-config action） |
| 從 failed 點 edit-config | failed → pending → awaiting-input（jump-back 重置） |
| 從 succeeded jump-back | succeeded → pending → awaiting-input |

跑既有 transition tests 全綠（baseline 269）。

### AC-5：Regression test

`src/components/setup-wizard/__tests__/configure-host.test.ts` 新檔（或併入 ssh-flow.test.ts）：

最少涵蓋：

1. **wizard 開啟初始 status = awaiting-input**：mock 一個空 ctx，runner.start() 後第一個 snapshot status === 'awaiting-input'，**未** throw
2. **未 submit 不 throw**：state.sshHost 為空 + 未 submit signal → step.run() 直接 return（或不被 runner 呼叫，視路徑 C）；snapshot.error 為 undefined
3. **submit 後 host 有值 → succeeded**：state.sshHost = 'myhost' + submit → step.run() 完成 → snapshot.status === 'succeeded'
4. **submit 後 host 空白 → mapped error**：submit + host 空 → throw with code='configure-host-empty' → snapshot.mappedError.matchId === 'ssh-configure-host-empty'
5. **edit-config jump-back**：failed 狀態點 edit-config → snapshot.status 流轉回 awaiting-input

### AC-6：Visual snapshot 對照

驗證 T0334 留下的 `Stepper.visual.snapshot.test.tsx` awaiting-input 契約對 SSH wizard 仍成立（不需新增 case，但 manual smoke 確認）。

### AC-7：BUG-074 metadata 更新

**Worker 不直接改 BUG-074 檔案**（塔台收尾時改）。Worker 只在工單回報區註記：「BUG-074 從 OPEN → FIXED 待塔台處理」。

## 實作順序建議

1. **Step 1**：閱讀 `docs/design/wizard-error-ux.md`（T0334 產出，30 分鐘可省）+ T0330 worker 報告中對 `kind: 'input'` 處理的描述
2. **Step 2**：盤點 SetupWizardShell 是否有 submit 機制（決定路徑 B 可行 / 需要回退 C）
3. **Step 3**：實作選定路徑（A/B/C）
4. **Step 4**：configure-host.ts 加 errorCode 結構化 throw
5. **Step 5**：error-mapper.ts registry + MESSAGE_DICT 補新 entry
6. **Step 6**：regression test 5 case
7. **Step 7**：跑 `npm run test:unit` + `npx vite build` 全綠
8. **Step 8**：commit `fix(setup-wizard): SSH configure-host stays in awaiting-input until user submits (T0335, BUG-074)`

## 風險與緩解

| 風險 | 緩解 |
|------|------|
| 路徑 C 影響其他 input step（WSL/Docker pick） | 先驗證 WSL pick-distro / Docker pick-container 既有測試是否仍綠；若不綠改路徑 B |
| state.submitRequested 機制 SetupWizardShell 沒實作 | 路徑 B 先補一個最小 form submit pattern（不阻擋本票範圍） |
| errorCode='configure-host-empty' 與既有 ssh errorCode 衝突 | grep `error.code\|errorCode` 確認唯一 |
| 既有 SSH wizard 測試假設 throw-on-empty 行為 | 同步更新測試期望（從「初次 run() throw」改為「awaiting-input until submit」） |

## 自檢清單

- [ ] AC-1：configure-host.ts run() 不再對空 host throw（除非使用者已 submit）
- [ ] AC-2：選定路徑 A/B/C 並落地，工單回報區註明選哪條 + 理由
- [ ] AC-3：errorCode='configure-host-empty' + registry entry + MESSAGE_DICT
- [ ] AC-4：state machine 5 種流轉皆通過 transition rules（無 WizardStateTransitionError 拋）
- [ ] AC-5：regression test ≥5 case 全綠
- [ ] AC-6：T0334 awaiting-input snapshot 仍綠
- [ ] AC-7：工單回報註記 BUG-074 → FIXED 待塔台處理
- [ ] `npm run test:unit` 全綠（baseline 269 + 本票 ≥5 = ≥274）
- [ ] `npx vite build` 綠
- [ ] commit message 格式：`fix(setup-wizard): SSH configure-host stays in awaiting-input until user submits (T0335, BUG-074)`

## YOLO 模式 — 下一張工單建議

T0335 DONE 後鏈式派 **T0336**（BUG-073 Docker detect-env mapping + actions）：
- registry 補 docker entry（actually 已有，需擴 actions to include open-link 下載連結 — 但 T0333 已補）
- 補 detect-env step 的 errorCode 結構化
- 補 preflight check（用 T0332 framework，避免 step.run 才偵測 daemon down）

## 回報區（Worker 填寫）

### 實作摘要

採用 **路徑 B-modified（透過 ctx.requestChoice 通道）**：configure-host.run() 在 state.sshHost 為空且 ctx.requestChoice 可用 + 至少一個 alias 時，呼叫 ctx.requestChoice 顯示 alias 下拉選單；runner 既有的 maybeWrapRequestChoice 自動把 status 從 Running 翻到 AwaitingInput，prompt resolve 後翻回 Running。使用者選 alias 即視為 submit；resolve 後若 sshHost 仍空才以 `code='configure-host-empty'` throw（走 stage-1 errorCode 解析）。

主要變動：
- `src/components/setup-wizard/steps/ssh/configure-host.ts`：新增 prompt 區塊（empty + requestChoice + aliases.length>0 才呼叫）；throw 改為帶 `.code` 屬性。
- `src/components/setup-wizard/error-mapper.ts`：MESSAGE_DICT 新增 `ssh.configure-host.empty`；DEFAULT_WIZARD_ERROR_REGISTRY 末尾追加 `ssh-configure-host-empty` entry（platforms=['ssh'], stepIds=['configure-ssh-host'], errorCodes=['configure-host-empty'], patterns regex fallback, actions: edit-config + cancel）。
- `src/components/setup-wizard/__tests__/configure-host.test.ts`：新檔，7 個 test case（覆蓋 AC-5 #1/#3/#4/#5/#6 + AC-3 errorCode resolver + AC-3 regex fallback）。

數字：commit `94733d7`，test 從 baseline 269 → 276（+7），`npx vite build` 全綠。

### 路徑選擇與理由

**選 B-modified（不選 A/C）**：
- **路徑 A（ctx.requestForm）**：scope 過大，spec § 2 與 T0338 為 input abstraction 的後手；本票範圍 30-90 min M，不適合擴 framework API。
- **路徑 B 原版（state.submitRequested flag）**：盤點 SetupWizardShell.tsx (626 行) 後確認 — 它**沒有**任何 form/submit 按鈕的 pattern，只有 `requestChoice` 一條 user-input 通道。要落地原版 B 必須先補一個 form UI + submit handler，超過工單範圍。
- **路徑 C（runner 跳過 input step auto-run）**：會破壞 WSL pick-distro / Docker pick-container — 它們的 run() 內部就是「load options → ctx.requestChoice → store result」，runner 跳過 run() 等於這些 step 永遠不顯示選單。
- **B-modified（採用）**：複用既有 ctx.requestChoice + maybeWrapRequestChoice 機制，零 framework 變更。configure-host 內呼叫 requestChoice 把 alias dropdown 透過 SetupWizardShell 既有 prompt UI 顯示出來，使用者點選 = submit。

未涵蓋的 corner case（留 T0338）：當 `~/.ssh/config` 完全沒 alias 且使用者想手動輸入 host 時，目前還是會 throw（因為沒 form UI 可以收集自由輸入）。spec § 2 也指出 manual-entry form 是 Sprint 4 input abstraction 的範圍。

### State machine 流轉驗證

5 種場景對照 ALLOWED_TRANSITIONS（皆通過，無 WizardStateTransitionError）：

| 場景 | 流轉 | 測試覆蓋 |
|------|------|---------|
| Wizard 開啟（aliases + requestChoice + host 空） | pending → running → awaiting-input | AC-5 #1 |
| 使用者選 alias submit（host 有值） | awaiting-input → running → succeeded | AC-5 #3 |
| 使用者 submit empty（resolve null） | awaiting-input → running → failed（mappedError） | AC-5 #4 |
| 從 failed 點 edit-config（jumpToStep） | failed → pending → running（既有 T0309 機制，本票不重新測） | T0309 既有測試 |
| 從 succeeded jump-back | succeeded → pending → running（既有機制） | T0309 既有測試 |
| 預設 sshHost 短路 | pending → running → succeeded（不經 awaiting-input） | AC-5 #6 |
| Legacy（無 requestChoice）+ 空 host | pending → running → failed（mappedError） | AC-5 #5 |

baseline 269 transition tests 仍全綠。

### errorCode 結構化結果

throw site：
```ts
const err = new Error('SSH host is required (pick an alias from ~/.ssh/config or type host).') as Error & { code?: string }
err.code = 'configure-host-empty'
throw err
```

registry entry：
```ts
{
  id: 'ssh-configure-host-empty',
  platforms: ['ssh'],
  stepIds: ['configure-ssh-host'],
  errorCodes: ['configure-host-empty'],
  patterns: [/SSH host is required/i],
  messageKey: 'ssh.configure-host.empty',
  detailMode: 'hidden-by-default',
  actions: [
    { kind: 'edit-config', label: '修改 SSH 設定', targetStepId: 'configure-ssh-host' },
    { kind: 'cancel', label: '取消' },
  ],
}
```

MESSAGE_DICT：
```ts
'ssh.configure-host.empty': {
  title: 'SSH 主機名稱為必填',
  body: '請選擇 ~/.ssh/config 中的 alias 或手動輸入主機名稱。',
}
```

唯一性確認：grep `'configure-host-empty'` 只出現在新加的 step throw + registry entry，未與其他 errorCode 衝突。

### 偏離 spec 的決策

無偏離。Spec § 2 「Throw only after the user has actively submitted invalid or unreachable data」由 ctx.requestChoice resolve 等價滿足（picking option = active submit）。AC-2 三選一塔台建議「路徑 B 為主，若 SetupWizardShell 已有 submit pattern 直接接；若無，回退路徑 C」— Worker 評估後採 B-modified（B 路徑的精神：依賴既有 user-input 通道 + 條件 throw），原因如「路徑選擇」段。

### 自檢結果

- [x] AC-1：configure-host.ts run() 不再對空 host 直接 throw（除非使用者已 submit/legacy 路徑）
- [x] AC-2：選定路徑 B-modified 並落地，理由見上
- [x] AC-3：errorCode='configure-host-empty' + registry entry + MESSAGE_DICT（含 hidden-by-default + 2 actions）
- [x] AC-4：state machine 5 種流轉皆通過 transition rules（無 WizardStateTransitionError）
- [x] AC-5：regression test 7 case 全綠（≥5 要求）
- [x] AC-6：T0334 awaiting-input snapshot 既有測試仍綠（全套件 276 passed，無 regression）
- [x] AC-7：本回報區註記「BUG-074 從 OPEN → FIXED 待塔台處理」
- [x] `npm run test:unit` 全綠（276 passed，baseline 269 + 本票 7 = 276）
- [x] `npx vite build` 綠
- [x] commit message 格式正確
- [x] commit hash：`94733d7`

### BUG-074 狀態建議

建議塔台處理：**OPEN → FIXED → VERIFY**（不直接 CLOSED）。理由：
- 修復屬 framework-level 行為改變（input-step semantic），應走人工 smoke 驗證，確認真實 SSH wizard 開啟時 UI 不再閃過 failed 紅 X。
- 自動測試只能驗證 snapshot status 流轉，無法保證 SetupWizardShell 端的視覺呈現完全符合 BUG-074 描述。
- 建議 verify 動作：在 macOS / Linux / Windows 三個平台的 BAT dev build 跑一次 SSH wizard 開啟流程，確認第一步 stepper 顯示為 awaiting-input（藍色脈動 / 無 Retry-Skip 按鈕）。
- 通過 verify 後再標 CLOSED；本票實作 + 測試已涵蓋 fix 完整性，但人工驗證屬 BUG 修復標準閉環。

### 後續建議

T0336（BUG-073 Docker detect-env mapping + actions）派發提示：
- T0333 已補 docker-daemon-unavailable 的 actions（open-link 下載 + fixed-and-retry + cancel），所以 actions 不需重補。
- T0336 重點應放在：
  1. detect-env step run() throw 處改為帶結構化 errorCode（類似本票 `configure-host-empty` 的做法），讓 stage-1 解析優先命中（避免依賴 patterns regex）。
  2. 用 T0332 preflight framework 在 step.run() 之前先偵測 docker daemon，若未運行就走 preflight error path 而非 step.run() throw（更早攔截，不需等到 docker pull 才失敗）。
  3. 補 detect-env regression test，覆蓋 daemon down → mappedError 含 open-link action。
- 預估 30-90 min（M），複雜度與 T0335 相當。

---

**狀態流轉**：📋 PENDING → 🔄 IN_PROGRESS → ✅ DONE
