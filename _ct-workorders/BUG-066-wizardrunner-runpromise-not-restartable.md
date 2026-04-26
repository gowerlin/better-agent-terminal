# BUG-066 — `WizardRunner.run()` 失敗後 runPromise 不會重置，無法在同實例上重新啟動

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-066 |
| 標題 | WizardRunner 在 step 失敗 / cancel 後，runPromise 被 settle 為 rejected，後續呼叫 `run()` 直接返回舊 rejected promise，無法 retry |
| 嚴重度 | 🟢 Low |
| 可重現 | 100%（UI 「重新開始 wizard」按鈕用同實例） |
| Workaround | UI 每次重啟 wizard 建新 WizardRunner 實例（目前 ProfilePanel 大概率已這樣做） |
| 狀態 | 🚫 CLOSED 2026-04-26 — T0300 fix commit `a5841ae`（與 BUG-062 / BUG-068 同批）；v0.4.1 patch chain T0299-T0302 全綠 GO verdict |
| 建立時間 | 2026-04-26 17:18 (UTC+8) |
| 報告者 | T0293 review EC-005 |
| 影響範圍 | `src/components/setup-wizard/wizard-runner.ts:121-126`（run）+ `:160-205`（runInternal） |
| 修復策略 | 兩個方向選一：1) `runPromise = null` 在 settle 後立即清掉（允許 retry）；2) 第二次 run() 明確 throw `'Use a new WizardRunner instance'` 強制 caller 換實例 |
| Release target | v0.4.1 patch |
