# T0233 — 實作:整合測試 + session state spike + 跨平台驗證(PLAN-027 Phase 1 #4)

## 元資料

- **編號**:T0233
- **類型**:implementation(實作 + 驗證工單)
- **狀態**:🔨 IN_PROGRESS
- **建立時間**:2026-04-22 13:32 (UTC+8)
- **派發時間**:2026-04-22 13:32 (UTC+8)
- **開始時間**:2026-04-22 18:48 (UTC+8)
- **派發模式**:`--mode yolo --interactive`(spike 結果可能需要塔台介入決策,保留互動)
- **優先級**:🟡 Medium(PLAN-027 Phase 1 收尾驗證)
- **前置條件**:T0230 ✅、T0231 ✅、T0232 ✅(Phase 1 後端 + UI 全到位)
- **關聯**:PLAN-027 #4、T0229 研究報告 R4 陷阱 #4(session state)、`electron/claude-resolver.ts`、`electron/claude-runtime-router.ts`、`src/components/ClaudeRuntimeSection.tsx`
- **預估時間**:45 min(含 spike 結果判斷時間)
- **Renew 次數**:0

## 背景

Phase 1 程式碼完成(T0230/T0231/T0232)。本工單驗證**行為正確性**,分三塊:
1. **單元測試補強** — router 的 fallback 路徑 + 事件去重邏輯
2. **Session state spike**(R4 陷阱 #4) — 切 runtime 後能否 resume 同一 sdkSessionId
3. **跨平台手動驗證** — Windows / macOS / Linux(Worker 只能做 Windows,mac/Linux 寫成 playbook 給 Selene 做)

## 實作範圍

### 1. Unit tests 補強(`tests/claude-runtime-router.test.ts`)

**新增測試檔**,覆蓋 T0231 `resolveClaudeRuntime()` 邏輯:

- **T-R1**:`mode: embedded` → 直接回 embedded path,無偵測呼叫
- **T-R2**:`mode: system` + `detectSystemClaude` 回 healthy → 回 system path,`source: 'system'`,`healthStatus: 'healthy'`
- **T-R3**:`mode: system` + detect 回 null + `fallbackToEmbedded: true` → 回 embedded path + `source: 'system-fallback-to-embedded'` + `degraded.reason: 'system-not-found'`
- **T-R4**:`mode: system` + detect 回 `version-too-old` + `fallbackToEmbedded: true` → fallback,`degraded.reason: 'system-too-old'`
- **T-R5**:`mode: system` + detect 回 `spawn-failed` + `fallbackToEmbedded: true` → fallback,`degraded.reason: 'system-unhealthy'`
- **T-R6**:`mode: system` + detect throws + `fallbackToEmbedded: true` → fallback,`degraded.reason: 'detect-threw'`
- **T-R7**:`mode: system` + 任一失敗 + `fallbackToEmbedded: false` → throws `SystemClaudeUnavailableError`
- **T-R8**:`mode: system` + `version-warning` → 回 system path + `healthStatus: 'version-warning'`(**不** fallback)
- **T-R9**:`shouldEmitRuntimeEvent(sessionId, 'degraded')` 第一次呼叫回 true,第二次同 session 同 type 回 false
- **T-R10**:`shouldEmitRuntimeEvent` 同 session 不同 type(degraded / warning)各自獨立判斷
- **T-R11**:`clearRuntimeEventHistory(sessionId)` 後,同 session 再發事件應可通過

**Mock 策略**:`detectSystemClaude` 用 vi.fn / sinon.stub 注入。若沒有 mock 工具,可提取為 dependency injection(Worker 自決改 router 簽名允許注入 detector)。

**驗收**:`npx tsx tests/claude-runtime-router.test.ts` 全綠,加上既有 `claude-resolver.test.ts` 17 條,總共應 **28 條 unit test 全通過**。

### 2. Session state spike(R4 陷阱 #4)

**問題**:切 runtime 後 resume 同一 `sdkSessionId` 是否可行?

**研究報告 R4 推測**:同 cwd → 同 transcript dir → 理論可 resume,但需實機驗證。

**Spike 步驟**:

1. **準備**:BAT dev mode 啟動(`npm run dev` 或對應 script),Settings 預設 `embedded`
2. **建 session**:開一個 Claude Agent session,對話 1-2 輪(確保 sdkSessionId 建立 + transcript 存檔),記錄 sdkSessionId
3. **切 runtime**:Settings → Advanced → Claude Runtime 改 `system`(若本機 system claude 存在且 healthy)
4. **重啟 session**:**不關 BAT**,嘗試 resume 剛才那個 sdkSessionId(透過 UI 或直接 IPC)
5. **觀察**:
   - ✅ Resume 成功,對話歷史完整、能繼續對話 → spike 結論 **positive**,無需額外處理
   - ⚠️ Resume 成功但行為異常(歷史不對 / 某些狀態遺失)→ spike 結論 **partial**,記錄 degraded behavior
   - ❌ Resume 失敗(error / session not found)→ spike 結論 **negative**,需新工單補 transcript migration 或強制新 session 邏輯

**結果記錄**:在本工單回報「Session state spike 結論」區塊詳細描述觀察 + log。

**如 Worker 本機 system claude 不可用**:
- 用「內嵌 → 改 customPath 指回內嵌」模擬 runtime 切換(同版本 binary 但走 router 的 system path)
- 或 skip spike,標註「need external runtime to spike」交塔台決策

### 3. 跨平台手動驗證 playbook

**Worker 只做 Windows 這塊**(自身環境),其他平台寫成 playbook。

#### Windows(Worker 本機實測)

- [ ] `detectSystemClaude` 能正確找到 `claude.exe`(PATH 上有的話)
- [ ] Windows 若同目錄有 `.cmd` + `.exe`,`.exe` 優先(驗證 T0230 AC-4 實際行為)
- [ ] `spawn(binaryPath, ['--version'])` 在 Windows 正確輸出 + parse 成功
- [ ] Settings UI 在 Windows 顯示正常,Browse button 能開檔案對話框

#### macOS / Linux playbook(寫給 Selene / 未來使用者)

產出 `docs/plan-027-cross-platform-verification.md`(或附在 `_report-plan027-*.md`),含:
- 環境準備步驟(system claude 如何裝、PATH 如何設)
- 驗證 checklist(5-10 條,每條含預期結果 + 失敗如何回報)
- 已知平台差異(macOS `/opt/homebrew/bin` / Linux `~/.local/bin`)
- 邊界情境(Gatekeeper toast、`~/` 展開、多 claude 並存)

### 不改(本工單範圍外)

- ❌ CLAUDE.md / Release note(交 T0234 / #5)
- ❌ 修改 Phase 1 既有實作(T0230/T0231/T0232)— 除非 spike 發現 bug,需另開 BUG 單
- ❌ 實際跑 mac / Linux 驗證(Worker 做不了,只產 playbook)

### 特別注意(教訓)

- **引用來源教訓繼續**:測試檔若引用型別,全從 `src/types/index.ts` 或 `electron/claude-runtime-router.ts` 匯入
- **Mock 工具**:專案測試目前用 `tsx`(見 T0230 測試執行方式),非 vitest/jest。若要 mock,可能要**手工 dependency injection**(Worker 先看 `claude-resolver.test.ts` 怎麼寫的,沿用 pattern)
- **Spike 失敗不算工單失敗**:spike 只是驗證未知,negative 結論也是合法產出。關鍵是記錄清楚

## Acceptance Criteria

- [ ] **AC-1**:`tests/claude-runtime-router.test.ts` 新增 11 條測試(T-R1 到 T-R11),全綠
- [ ] **AC-2**:`npx tsx tests/claude-resolver.test.ts` + `npx tsx tests/claude-runtime-router.test.ts` 合計 28 條全綠
- [ ] **AC-3**:Session state spike 完成,結論記錄於回報區(positive / partial / negative 三選一,附觀察 log)
- [ ] **AC-4**:Windows 跨平台驗證 checklist 4 項全勾(或無法驗證的標註理由)
- [ ] **AC-5**:macOS / Linux playbook 產出(`docs/plan-027-cross-platform-verification.md` 或附於研究報告)
- [ ] **AC-6**:`npx tsc --noEmit` exit 0(新增測試檔也要型別正確)
- [ ] **AC-7**:若 spike 發現 bug → **不**在本工單修,開 BUG 單並登記。本工單只負責報告結果
- [ ] **AC-8**:回報區清楚標示:(a)router 測試結果、(b)spike 結論 + 證據、(c)Windows 驗證結果、(d)mac/Linux playbook 路徑

## 驗收依據

1. T0229 研究報告 R4 陷阱 #4(session state)章節
2. T0231 `claude-runtime-router.ts` 原始碼(測試目標)
3. `tests/claude-resolver.test.ts`(測試風格參考)
4. Windows 本機 `claude.exe` 若有(spike 用)

## 產出位置

- 新檔:`tests/claude-runtime-router.test.ts`
- 新檔:`docs/plan-027-cross-platform-verification.md`(或附在 `_ct-workorders/_report-plan027-claude-runtime-selection.md` 尾端)
- 本工單回報區的 spike 結論段落
- 若發現 bug:新 BUG 單(`*bug` 觸發流程)

## 風險與備註

- **R1 - System claude 不可用**:Worker 本機若沒裝系統 claude,spike 做不了真正切換。處理方式見「實作範圍 #2 最後一段」
- **R2 - Spike 結論 negative**:若 resume 失敗,本工單**不**修,開 BUG 單交塔台決策。可能影響 PLAN-027 DONE 條件(要加「restart session when runtime changes」到 Settings UI hint)
- **R3 - 測試 mock 難度**:若 tsx 裸環境難 mock,接受用 dependency injection 重構 router(這算是 refactoring,不是新功能,Worker 自決)
- **R4 - 互動時機**:spike 結論 partial / negative 時、或 refactoring router 簽名時,**回塔台問**。Windows 驗證和 playbook 寫作純執行,自決
- **R5 - mac/Linux playbook 深度**:不要寫成教學書,checklist 精簡 5-10 條即可,能讓 Selene 照做就好

## 回報區

### 完成狀態

(待 Worker 填寫)

### 產出摘要

(待 Worker 填寫)
- Commit hash:
- 新增檔案:
- 修改檔案:
- AC 勾選:(AC-1 到 AC-8 逐項勾)
- tsc 結果:
- Test 總數:(應 28 條)

### Session state spike 結論

(待 Worker 填寫)
- 結論類型:positive / partial / negative
- 驗證方式:(實機切換 / 或 customPath 模擬 / 或無法驗證)
- 觀察紀錄:(step by step)
- 發現的 bug(若有):

### Windows 驗證結果

(待 Worker 填寫,4 條 checklist 逐項)

### mac/Linux playbook 路徑

(待 Worker 填寫)

### 遭遇問題

(待 Worker 填寫;無問題寫「無」)

### Renew 歷程

無。
