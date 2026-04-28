# Wizard Error UX Framework — Developer Guide

> **Status**: PLAN-032 Sprint 5（T0341，2026-04-28），對齊 Sprint 2-4 全部落地實況
> **Audience**: 日後新增 Setup Wizard error mapping / preflight / recovery action / input step 的開發者
> **Authoritative spec**: `_ct-workorders/_spec-wizard-error-ux.md`
> **Cross-link**: 視覺契約見 [bat-stepper-design-language.md](./bat-stepper-design-language.md)（特別是 § 3 狀態-視覺對應表 與 § 7 Don't 反例）

---

## 1. 三層架構

PLAN-032 Sprint 2-4 在 SetupWizard 上落地了三層 framework：

| 層 | 模組 | 工單 | 職責 |
|----|------|------|------|
| Stepper status | `src/components/stepper/` | T0330 | 把 `awaiting-input` 加進 7-status 視覺契約；input step 開啟期間流轉到此狀態，避開 failed 的 a11y / 視覺語意 |
| WizardRunner state machine | `src/components/setup-wizard/wizard-runner.ts` | T0330 / T0332 / T0340 | `requestChoice` 期間自動標 `awaiting-input`；`runStepWithPreflight` 把 preflight failure mapped 為失敗 snapshot；`kind: 'input'` step 進場直接標 `awaiting-input`（T0340 input-kind rollout）|
| ErrorMapper + Preflight + RecoveryActions | `src/components/setup-wizard/{error-mapper,preflight}.ts` + `SetupWizardShell.tsx` 的 dispatchAction | T0331 / T0332 / T0333 / T0339 | 4-stage error resolver、per-session preflight cache、`WizardRecoveryAction` discriminated union 與對應 UI dispatch；T0339（BUG-076）修復 SetupWizardShell 採用 runner-shipped `mappedError`，避免重新解析時掉 `errorCode` |

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

> **未來**：當 `MESSAGE_DICT` 拆出至 i18n loader 後，第 2 步會改為「在 `src/locales/{en,zh-TW,zh-CN}.json` 補 wizard.errors.* keys」，並由 `i18n-completeness.test.ts` 驗證三檔同步。目前（Sprint 2-4）字典僅 zh-TW，OOS for translation per D108。

### 2.1 目前 ship 的 6 個 registry entries（Sprint 2-3 落地）

| # | id | platform | stepIds | 觸發 | detailMode | actions | 工單 |
|---|----|----------|---------|------|-----------|---------|------|
| 1 | `docker-daemon-unavailable` | docker | `detect-env` | errorCode `docker-daemon-down` 或 `pipe.*docker_engine` 等 regex | append-raw | open-link / fixed-and-retry / cancel | T0331 baseline + T0336 BUG-073 |
| 2 | `wsl-linger-failure` | wsl | `write-systemd-unit` | errorCode `wsl-linger-failed` 或 `Could not enable linger` regex | append-raw | fixed-and-retry / skip / cancel | T0331 baseline + T0337 BUG-072 |
| 3 | `wsl-service-start-timeout` | wsl | `write-systemd-unit` | errorCode `wsl-service-start-timeout` 或 `Timed out waiting for.*service to become active` regex | append-raw | fixed-and-retry / skip / cancel | T0337 BUG-072 |
| 4 | `wsl-not-installed` | wsl | `detect-env` | errorCode `wsl-not-installed` / `wsl-not-on-windows`（**無 regex**，僅 Stage-1 errorCode 命中） | append-raw | open-link / fixed-and-retry / cancel | T0337 BUG-072（fix 收尾於 T0339 / BUG-076）|
| 5 | `ssh-permission-denied` | ssh | `verify-ssh-auth` | errorCode `permission-denied` 或 `permission denied` regex | hidden-by-default | edit-config（→ `configure-ssh-host`）/ retry / cancel | T0331 baseline |
| 6 | `ssh-configure-host-empty` | ssh | `configure-ssh-host` | errorCode `configure-host-empty` 或 `SSH host is required` regex | hidden-by-default | edit-config / cancel（**嚴格 2-action set**，不給 retry/skip — 空值是使用者誤輸不是環境錯誤） | T0335 BUG-074 |

> **Visual snapshot 鎖定**：`SetupWizardShell.test.tsx` 對全部 6 個 entries 各有一個 inline snapshot test（T0334 docker-daemon + T0341 補完 5 個），鎖 title / body / raw render / action fingerprint，作為 visual regression guard。
>
> **errorCode-only entries 的特殊性**（#4 wsl-not-installed）：完全不依賴 regex，僅靠 Stage-1 errorCode 命中。早期 SetupWizardShell 在 render 時重新解析 `snap.error`（純 message string）會掉 errorCode 而 fall through 到 fallback；T0339 / BUG-076 修為「優先採用 runner-shipped `snap.mappedError`」。新增 errorCode-only entry 時請務必驗證對應 visual snapshot 不退化到 fallback。

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

## 4.5 Input step contract（PLAN-032 Sprint 4 落地）

T0340 把所有等待使用者輸入的 wizard step 統一標 `kind: 'input'`：

| 平台 | step id | 互動方式 |
|------|---------|---------|
| SSH | `configure-ssh-host` | `requestChoice`（hostname picker / manual entry）|
| WSL | `pick-wsl-distro` | `requestChoice`（distro list） |
| Docker | `pick-container` | `requestChoice`（container list） |
| Docker | `configure-mounts` | **native dialog**（`electronAPI.dialog.showOpenDialog`），**不**走 `requestChoice` |

`kind: 'input'` 的效果：

- 進場直接標 `awaiting-input`（中性藍），**不會**先閃現 `failed`（BUG-074 root cause 的反面）
- 視覺契約見 `bat-stepper-design-language.md` § 3 與 § 7 第 6/7 條

### 已知 spec 偏離：configure-mounts 採 native dialog

spec § 5（input-step contract）建議所有 input step 走 `requestChoice` 統一介面，但 `configure-mounts` 需要使用者「點選資料夾」，HTML/React 沒有可用的內建 picker。決策（T0340 偏離 spec 第 1 項）：

- 採 `electronAPI.dialog.showOpenDialog` native dialog 而非加一個 `requestFolder` helper
- 仍標 `kind: 'input'` 與 `awaiting-input` 狀態（視覺契約一致）
- trade-off：runner 對此 step 沒有 `requestChoice` snapshot，e2e 測試需 mock 整個 dialog API

未來若再有 input step 需要 folder picker，再決定是否抽 `requestFolder` 共用 helper（OOS for PLAN-032）。

---

## 5. 不要做的事

- ❌ 不要把 input step 標 `failed`（BUG-074 root cause）。改用 `kind: 'input'` + `awaiting-input` 狀態。
- ❌ 不要在 `awaiting-input` 上掛 `role="alert"`。中性等待態走 `aria-current="step"` + `aria-describedby`，failure-only 才用 alert。
- ❌ 不要在 `error-mapper.ts` 的 `MESSAGE_DICT` 加翻譯字串到非 zh-TW（D108 嚴禁，framework only no copy）。要補翻譯請開新工單與翻譯流程。
- ❌ 不要繞過 `dispatchAction` 直接從 button onClick 調 `runner.jumpToStep`。所有 recovery action 必須過 dispatcher，避免狀態不一致。

---

## 6. 相關工單清單

### Sprint 2（Framework 落地）

| 工單 | 範圍 |
|------|------|
| T0330 | Stepper `awaiting-input` 狀態 + WizardRunner state machine |
| T0331 | `WizardErrorMapper` framework + 3-entry baseline registry |
| T0332 | `useWizardPreflight` hook + per-session cache |
| T0333 | `WizardRecoveryAction` discriminated union + `dispatchAction` UI |
| T0334 | 設計規範 v1 + docker-daemon visual snapshot + i18n completeness + 開發者指南 |

### Sprint 3（BUG fixes 套用 framework）

| 工單 | 範圍 |
|------|------|
| T0335 | BUG-074 SSH `configure-host` input step（registry entry #6） |
| T0336 | BUG-073 Docker daemon download/start（registry entry #1 errorCode 補強） |
| T0337 | BUG-072 WSL linger / service-start-timeout / not-installed（registry entries #2 #3 #4） |

### Sprint 4（input-kind rollout）

| 工單 | 範圍 |
|------|------|
| T0340 | 4 個 input step 統一 `kind: 'input'`（含 configure-mounts native-dialog 偏離 spec） |

### Sprint 5（整合測試 + BUG fix + 收尾）

| 工單 | 範圍 |
|------|------|
| T0338 | Integration tests：transition matrix + mapped error UX |
| T0339 | BUG-076 fix — SetupWizardShell `resolveMappedErrorForSnapshot` 改採 runner-shipped `mappedError`（保 `errorCode`，修 wsl-not-installed fallback bug）|
| T0341（本檔）| Sprint 5 收尾 audit：docs polish + 補完 5 個 mapped error visual snapshots + v0.4.2 release notes 草稿 |

---

## 7. 最後同步

> 本檔最後同步：T0341 / 2026-04-28（PLAN-032 Sprint 5 收尾，對齊 Sprint 2-4 全部落地實況 + 6-entry registry catalog + input-kind contract）。
> 若擴 framework（新增 status / preflight contract / action kind / registry entry）請同步更新本檔，避免 drift。
