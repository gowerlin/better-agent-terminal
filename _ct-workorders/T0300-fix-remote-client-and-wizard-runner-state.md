# T0300 — Fix v0.4.1 RemoteClient + WizardRunner State（BUG-062 + BUG-066 + BUG-068）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0300 |
| 類型 | fix（v0.4.1 patch） |
| Phase | v0.4.1 patch chain 第 2 張 |
| 狀態 | ✅ DONE 2026-04-26 — fix commit `a5841ae`（修 BUG-062 + BUG-066 + BUG-068,v0.4.1 patch chain 第 2 張）;metadata drift 在 session 32 *sync 時補回 |
| 建立時間 | 2026-04-26 18:35 (UTC+8) |
| 派發時間 | （待派） |
| 完成時間 | （待） |
| Wall time | （待） |
| Sizing | M（GP099 校準後預期 wall 10-20 min — 3 個小範圍 fix + 對應 test） |
| 依賴 | T0299 ✅、BUG-062、BUG-066、BUG-068 |
| 後續 | T0301（i18n + schema-driven）→ T0302（v0.4.1 verification + bump） |
| 工作目錄 | **main repo**，branch **`release/v0.4.0`** |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `electron/remote/remote-client.ts`、`src/components/setup-wizard/wizard-runner.ts`、`tests/remote-client-middleware.test.ts`、`tests/wizard-runner.test.ts` |

## 目標

修復 3 個 v0.4.1 backlog BUG（皆為小範圍 race / state machine corner）：

- **BUG-062**（F-006）：`RemoteClient` upgrade handler fingerprint mismatch 後缺 `return`，理論 race window
- **BUG-066**（EC-005）：`WizardRunner.run()` 失敗後 runPromise 不重置，無法在同實例重啟
- **BUG-068**（EC-007）：`RemoteClient.invoke` 中途 reconnect 換 translator，args 用 A / result 用 B

## 範圍

### 修改

1. **`electron/remote/remote-client.ts`** — BUG-062 + BUG-068 兩處小修
   - **BUG-062 修法**：upgrade handler fingerprint mismatch 區塊加 early-return：
     ```ts
     if (mismatch) {
       this._connected = false  // 移到 settle 前
       this.ws?.close()
       settle({ ok: false, errorCode: 'fingerprint-mismatch' })
       return  // ← 補 early-return（防 'open' / 'message' handler 被觸發）
     }
     ```
   - **BUG-068 修法**：`invoke` 開始時 capture translator reference 給 args + result 共用：
     ```ts
     async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
       // BUG-068: freeze translator per-invoke 避免 reconnect 中途 swap
       const translator = this.translator
       if (!translator) { /* legacy / no-translator path */ }
       const translatedArgs = translateInvokeArgs(channel, args, translator)
       const result = await this.send({ channel, args: translatedArgs })
       return translateInvokeResult(channel, result, translator)  // 同一 reference
     }
     ```
2. **`src/components/setup-wizard/wizard-runner.ts`** — BUG-066 修法
   - 兩個方向選一（**選方向 A：清掉 runPromise 允許 retry**）：
     ```ts
     async run(): Promise<WizardResult> {
       if (!this.runPromise) {
         this.runPromise = this.runInternal()
       }
       try {
         const result = await this.runPromise
         return result
       } finally {
         // 失敗或 cancel 後 reset，下次 run() 可重啟
         if (this.runPromise && (await this.runPromise).ok === false) {
           this.runPromise = null
         }
       }
     }
     ```
   - **替代方向 B**（更明確）：第二次 run() 在 settle 後直接 throw `'WizardRunner: previous run failed; create new instance to retry'` 強制 caller 換實例
   - **塔台建議方向 A**（讓 caller 重試更友善）

### 補測試

3. **`tests/remote-client-middleware.test.ts`**
   - BUG-062 case：mock ws 模擬「fingerprint mismatch 後 ws fire 'open'」→ assert send 不會被呼叫（驗證 early-return 生效）
   - BUG-068 case：mock 在 invoke 中途 swap `this.translator`，確認 result 翻譯仍用舊 reference（不被 swap 影響）
4. **`tests/wizard-runner.test.ts`**
   - BUG-066 case：runner.run() 失敗 → runner.run() 第二次能重新走完（不返回舊 rejected）
   - 邊界 case：第二次 run() 也失敗 → runPromise 仍 reset，第三次可再 run

### Out of scope（不做）

- ❌ 不修 baseline BUG-061
- ❌ 不擴 v0.4.1 其他 BUG（BUG-063/064/065/067 已或將於別張處理）
- ❌ 不重構 RemoteClient / WizardRunner 整體架構
- ❌ 不寫 production trace log（log strategy 留 future）
- ❌ 不擴展 IPC channel set（T0270 凍結）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/BUG-062-*.md` | fingerprint mismatch race 詳情 + 修法 |
| `_ct-workorders/BUG-066-*.md` | WizardRunner runPromise reset 詳情 + 兩個修法選項 |
| `_ct-workorders/BUG-068-*.md` | invoke translator freeze 詳情 + 修法 |
| `electron/remote/remote-client.ts` 現況 | upgrade handler / invoke 既有實作 |
| `src/components/setup-wizard/wizard-runner.ts` 現況 | run / runInternal 既有實作 |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | BUG-062 修：fingerprint mismatch 區塊末尾有 `return`；`_connected = false` 移到 settle 之前 | grep + diff |
| AC2 | BUG-068 修：`invoke` 開始時 capture translator reference 給 args + result 共用 | grep + diff |
| AC3 | BUG-066 修：`WizardRunner.run()` 失敗後 runPromise reset 為 null（or 明確 throw 換實例） | grep + diff |
| AC4 | `tests/remote-client-middleware.test.ts` 補 ≥ 2 case（fingerprint race + invoke translator freeze）全綠 | 跑指令 |
| AC5 | `tests/wizard-runner.test.ts` 補 ≥ 2 case（fail 後 retry / 二次 fail 後三次 retry）全綠 | 跑指令 |
| AC6 | 既有 remote-client / wizard-runner test 全部仍綠（zero regression） | 跑指令 |
| AC7 | TypeScript baseline drift = 0 | 跑 tsc |
| AC8 | git diff stat：受影響 ≤ 100 lines net add（小範圍 fix） | 計算 |
| AC9 | invoke translator freeze test：模擬 swap mid-flight，確認 result 翻譯走舊 reference | 視覺 review test code |
| AC10 | wizard-runner retry test：兩次 run() 各觸發完整 runInternal flow（不共用 promise） | 視覺 review test code |

## 守則（嚴格）

1. **工作分支**：main repo cwd，**`release/v0.4.0`** branch
2. **commit message**：`fix(remote/wizard): T0300 RemoteClient + WizardRunner state (BUG-062 + BUG-066 + BUG-068)\n\n工單：T0300\n依賴：BUG-062 + BUG-066 + BUG-068\n3 處小範圍 fix：fingerprint return / runPromise reset / invoke translator freeze`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0300-*.md`
4. **工具白名單**：Read / Edit / Write / Bash / Grep / Glob
5. **emoji**：除測試輸出外禁用
6. **零 regression**：既有 test 必須全綠
7. **defensive 修法**：BUG-062 是 defensive return（成本為 0），BUG-066 是清狀態，BUG-068 是 capture reference — 三者都是「最小修改」原則
8. **不擴範圍**：僅修 BUG-062 + BUG-066 + BUG-068
9. **塔台建議 BUG-066 方向 A**（reset runPromise 允許 retry，比 throw 換實例 caller-friendly）
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0300 完成`

## 預期 wall

**10-20 min**（GP099 校準後；3 處 fix 各 5-15 行小改 + 4 個 test case + 簡單 mock setup）

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0300 完成」訊息後從本檔讀回報區）
