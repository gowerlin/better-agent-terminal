# Wizard Error UX Framework — Developer Guide

> **Status**: PLAN-032 Sprint 2（T0334），最後同步 commit pending
> **Audience**: 接手 Sprint 3 BUG-072/073/074 修復、或日後新增 Setup Wizard error mapping / preflight / recovery action 的開發者
> **Authoritative spec**: `_ct-workorders/_spec-wizard-error-ux.md`

---

## 1. 三層架構

PLAN-032 Sprint 2 在 SetupWizard 上落地了三層 framework：

| 層 | 模組 | 工單 | 職責 |
|----|------|------|------|
| Stepper status | `src/components/Stepper/` | T0330 | 把 `awaiting-input` 加進 7-status 視覺契約；input step 開啟期間流轉到此狀態，避開 failed 的 a11y / 視覺語意 |
| WizardRunner state machine | `src/components/setup-wizard/wizard-runner.ts` | T0330 / T0332 | `requestChoice` 期間自動標 `awaiting-input`；`runStepWithPreflight` 把 preflight failure mapped 為失敗 snapshot |
| ErrorMapper + Preflight + RecoveryActions | `src/components/setup-wizard/{error-mapper,preflight}.ts` + `SetupWizardShell.tsx` 的 dispatchAction | T0331 / T0332 / T0333 | 4-stage error resolver、per-session preflight cache、`WizardRecoveryAction` discriminated union 與對應 UI dispatch |

整體 data flow：

```
Step run() throws Error
    ↓
WizardRunner snapshots failed + error.message
    ↓
SetupWizardShell.useMemo(resolveWizardError)
    ↓
WizardMappedError { title, body, rawError, detailMode, actions }
    ↓
panel render（rose-200 title / rose-100 body / pre raw / actions slot）
    ↓
button click → dispatchAction(action) → runner.retry / runner.jumpToStep / shell.openExternal / cancel
```

---

## 2. 我要新增一個 mapped error

1. 在 `src/components/setup-wizard/error-mapper.ts` 的 `DEFAULT_WIZARD_ERROR_REGISTRY` append 新 entry：

   ```ts
   {
     id: 'my-error-id',
     platforms: ['ssh'],            // 'all' | ('wsl'|'ssh'|'docker'|'local')[]
     stepIds: ['my-step'],          // optional, stage-2 限定
     errorCodes: ['my-code'],       // optional, stage-1 exact match
     patterns: [/expected.*regex/i],// stage-2/3 regex
     messageKey: 'my.error.key',
     detailMode: 'append-raw',      // or 'hidden-by-default'
     actions: [
       { kind: 'fixed-and-retry', label: '我已修好，重試' },
       { kind: 'cancel', label: '取消' },
     ],
   }
   ```

2. 在同檔的 `MESSAGE_DICT` 補對應 key：

   ```ts
   'my.error.key': {
     title: '錯誤標題（zh-TW）',
     body: '說明 body 文字（zh-TW），可空字串會 fallback 到 raw error.message',
   }
   ```

3. 跑 `npm run test:unit -- error-mapper` 確認 resolver 命中你的 entry（建議補一個 unit test 用真實 error message 驗證）。

> **未來**：當 `MESSAGE_DICT` 拆出至 i18n loader 後，第 2 步會改為「在 `src/locales/{en,zh-TW,zh-CN}.json` 補 wizard.errors.* keys」，並由 `i18n-completeness.test.ts` 驗證三檔同步。目前（Sprint 2）字典僅 zh-TW，OOS for translation per D108。

---

## 3. 我要新增一個 preflight check

1. 在 step descriptor 上加 `preflight`（需先讓 step 走 `runStepWithPreflight`）：

   ```ts
   preflight: async (ctx): Promise<WizardPreflightResult> => {
     const ok = await checkSomething()
     if (!ok) {
       return {
         ok: false,
         errorCode: 'my-preflight-failure',
         errorMessage: 'human readable explanation',
         cacheKey: 'my-step:preflight',  // optional, opt-in 快取
       }
     }
     return { ok: true }
   }
   ```

2. 失敗時 `errorCode` 應對到 ErrorMapper registry 某個 entry 的 `errorCodes`，讓 UI 直接顯示 mapped 訊息。

3. 確認 cache 行為：相同 `cacheKey` 在同一 wizard session 中只會跑一次（per-session cache，不持久化）。詳見 `preflight.test.ts`。

---

## 4. 我要新增一個 recovery action kind

1. 擴 `WizardRecoveryAction` discriminated union（`error-mapper.ts`）：

   ```ts
   export type WizardRecoveryAction =
     | { kind: 'retry'; label?: string }
     | { kind: 'fixed-and-retry'; label?: string }
     | { kind: 'open-link'; label: string; href: string }
     | { kind: 'edit-config'; label?: string; targetStepId?: string }
     | { kind: 'skip'; label?: string }
     | { kind: 'cancel'; label?: string }
     | { kind: 'custom'; label: string; run: () => Promise<void> | void }
     | { kind: 'my-new-kind'; label?: string; /* + 你的 metadata */ }
   ```

2. 在 `SetupWizardShell.tsx` 的 `dispatchAction` switch 加 case：

   ```ts
   case 'my-new-kind':
     await doSomething()
     return
   ```

3. 在 `wizard.action.*` i18n keys 三檔（`en` / `zh-TW` / `zh-CN`）補 default label：

   ```json
   "wizard": {
     "action": {
       "myNewKind": "Default label"
     }
   }
   ```

4. 把該 key 加入 `src/locales/__tests__/i18n-completeness.test.ts` 的 `REQUIRED_WIZARD_ACTION_KEYS` 陣列，讓三檔同步由 CI 守住。

5. 跑 `npm run test:unit` 全綠後 commit。

---

## 5. 不要做的事

- ❌ 不要把 input step 標 `failed`（BUG-074 root cause）。改用 `kind: 'input'` + `awaiting-input` 狀態。
- ❌ 不要在 `awaiting-input` 上掛 `role="alert"`。中性等待態走 `aria-current="step"` + `aria-describedby`，failure-only 才用 alert。
- ❌ 不要在 `error-mapper.ts` 的 `MESSAGE_DICT` 加翻譯字串到非 zh-TW（D108 嚴禁，framework only no copy）。要補翻譯請開新工單與翻譯流程。
- ❌ 不要繞過 `dispatchAction` 直接從 button onClick 調 `runner.jumpToStep`。所有 recovery action 必須過 dispatcher，避免狀態不一致。

---

## 6. 相關工單清單

| 工單 | 範圍 | 落地 commit |
|------|------|------------|
| T0330 | Stepper `awaiting-input` 狀態 + WizardRunner state machine | `e0a23e5` |
| T0331 | `WizardErrorMapper` framework + 3-entry baseline registry | `85eb8ff` |
| T0332 | `useWizardPreflight` hook + per-session cache | `8bb972e` |
| T0333 | `WizardRecoveryAction` discriminated union + `dispatchAction` UI | `a24ba4a` |
| T0334（本檔）| 設計規範 + visual snapshots + i18n completeness + 開發者指南 | pending |

Sprint 3（BUG fixes）將套用本 framework：T0335（BUG-074 SSH input step）、T0336（BUG-073 Docker download/start）、T0337（BUG-072 WSL linger fixed-and-retry）。

---

## 7. 最後同步

> 本檔最後同步：T0334 / 2026-04-27。
> 若擴 framework（新增 status / preflight contract / action kind）請同步更新本檔，避免 drift。
