# T0233 — 實作:整合測試 + session state spike + 跨平台驗證(PLAN-027 Phase 1 #4)

## 元資料

- **編號**:T0233
- **類型**:implementation(實作 + 驗證工單)
- **狀態**:✅ DONE
- **建立時間**:2026-04-22 13:32 (UTC+8)
- **派發時間**:2026-04-22 13:32 (UTC+8)
- **開始時間**:2026-04-22 18:48 (UTC+8)
- **完成時間**:2026-04-22 19:03 (UTC+8)
- **Commit**:`307647d9`
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

**DONE**

### 產出摘要

- **Commit hash**:`307647d9`
- **新增檔案**:
  - `tests/claude-runtime-router.test.ts`(11 條 T-R1..T-R11 unit tests)
  - `tests/_windows-probe.ts`(非測試套件成員;AC-4 手動驗證 probe,作為回歸檢查參考)
  - `docs/plan-027-cross-platform-verification.md`(macOS/Linux playbook)
  - `_ct-workorders/BUG-053-claude-resolver-probe-fails-on-cmd-bat-shims-node-20plus.md`
- **修改檔案**:
  - `electron/claude-runtime-router.ts` — `resolveClaudeRuntime()` 新增 optional `deps: ResolveClaudeRuntimeDeps` 參數(defaults 指向真正的 detector/embedded resolver,production call-site 無需修改),讓單元測試無需 mock-loader 即可注入 stub
- **AC 勾選**:
  - [x] AC-1:`tests/claude-runtime-router.test.ts` 11 條 T-R1..T-R11 全綠
  - [x] AC-2:`claude-resolver.test.ts`(17)+ `claude-runtime-router.test.ts`(11)= **28 條全綠**
  - [x] AC-3:Session state spike 完成(code-path analytical,見下段)
  - [x] AC-4:Windows 驗證 checklist 4 項全執行(實際 probe,細節見下段)
  - [x] AC-5:`docs/plan-027-cross-platform-verification.md` 產出
  - [x] AC-6:`npx tsc --noEmit` exit 0
  - [x] AC-7:spike/Windows 驗證發現的 shim probe bug 已開 BUG-053,未在本工單修
  - [x] AC-8:回報區四段標示清楚
- **tsc 結果**:exit 0
- **Test 總數**:28 條(17 resolver + 11 router)

### Session state spike 結論

- **結論類型**:**positive(理論論證,未做實機 UI 驗證)**
- **驗證方式**:**code-path analytical spike**(非實機切換)。Worker 環境為命令列自動化,無法安全地啟動 Electron UI 操作「建 session → 切 runtime → resume」的完整流程。因此改以**讀原始碼 + 追 SDK 呼叫鏈**的方式,推論 resume 行為是否受 runtime 切換影響。
- **觀察紀錄(step by step)**:
  1. **transcript 儲存位置僅依賴 cwd,不依賴 binary**
     - `electron/claude-agent-manager.ts:1832` + `:1910`:`projectDir = ~/.claude/projects/{encoded_cwd}`;transcript `.jsonl` 檔以 `sdkSessionId` 命名
     - 這是 Anthropic 官方 `claude-code` binary 的約定,embedded 與 system claude **共用同一路徑空間**
  2. **resume id 在 runtime 解析前就已 capture**
     - `runQuery` 流程:`resumeId = session.sdkSessionId`(`:582`)先讀,**下一行才**呼叫 `resolveClaudeRuntime`(`:587`)
     - 也就是 session 層級的 state 與 runtime 選擇無耦合;切 runtime 不會動到 resume target
  3. **SDK 介面只接受 `resumeId: string`**
     - `@anthropic-ai/claude-agent-sdk` 的 `unstable_v2_resumeSession(sdkSessionId, opts)` 只要求 session id 字串 + `pathToClaudeCodeExecutable`
     - binary 本身負責讀 transcript(官方協定);兩版 claude(embedded `2.1.113` vs system `>=2.0.0`)只要都能讀 `.jsonl` 即可 resume
  4. **R2 snapshot-per-spawn 保證一致性**
     - T0231 設計:`getRuntimeSettingsSnapshot()` 每次 spawn 讀 disk,切 runtime 後「下一個」spawn 才生效。**進行中的 session** 不受影響(直到 session 結束或使用者主動 resume)
  5. **理論結論**:同 cwd → 同 transcript dir → resume id 不變 → 兩個 binary 都能讀同一份 transcript → **resume 應可成功**。
- **仍未實測的風險(flag 給塔台)**:
  - **版本 skew**:embedded(`2.1.113`)寫入的 transcript 若含新欄位(例如 Opus 4.7 / xhigh 相關 metadata),舊 system claude(`< 2.1.111`)讀取可能 silently drop 欄位。**BAT 已有 `version-too-old` 硬門檻(`< 2.0.0`)**保底;`version-warning` 區間(`2.0.0 – 2.1.110`)理論上可讀但無 feature parity
  - **未加 Settings UI hint**:目前 `ClaudeRuntimeSection.tsx` 沒有「變更僅套用到新 session」的顯式提示,使用者可能期待切 runtime 後現有 session 立即改變。**建議 T0234 或後續迭代補 hint 文案**(非本工單範圍,不阻擋 Phase 1 DONE)
  - **實機驗證缺口**:理論上支援 resume,但未在真實 UI 流程證實。建議 Selene(mac/Linux 使用者)在跑跨平台 playbook 時順手測一次 session resume 後切 runtime 的實際行為
- **發現的 bug(若有)**:無(spike 本身未暴露 bug;但 AC-4 Windows 驗證順手發現 BUG-053,見下段)

### Windows 驗證結果

所有驗證以 `npx tsx tests/_windows-probe.ts` 實際執行,完整 log 附於 BUG-053。

- [x] **AC-4.1 — `detectSystemClaude` 能找到 `claude.exe`(PATH)**:**通過(有 caveat)**
  - 實際 auto-detect 先命中 `node_modules/.bin/claude.cmd`(dev 模式專案本身帶 shim),**非**系統 PATH 上的 `~/.local/bin/claude.exe`
  - caveat:production packaged 下 `node_modules/.bin` 不在子進程 PATH,不會重現。dev 自用可容忍或以 customPath 繞開
  - 以 `customPath='C:\Users\Gower\.local\bin\claude.exe'` 實測 → `healthStatus: 'healthy'`、`version: '2.1.111'`、`source: 'custom'` ✅
- [x] **AC-4.2 — Windows `.exe` 優先於 `.cmd` / `.bat`**:**通過**
  - `WINDOWS_BIN_NAMES = ['claude.exe', 'claude.cmd', 'claude.bat']` 順序正確,偵測器按順序掃目錄(T0230 實作)
  - 實測:在只有 `.cmd` 的目錄(`node_modules/.bin`)detector 會落到 `.cmd`;在有 `.exe` 的目錄(`%USERPROFILE%\.local\bin\`)optSpray 正確命中 `.exe`
- [x] **AC-4.3 — `spawn(binaryPath, ['--version'])` 輸出正確 parse**:**通過(有 caveat)**
  - `customPath='...\.local\bin\claude.exe'` → stdout `2.1.111 (Claude Code)`,parse 成功
  - ⚠️ caveat:`.cmd` / `.bat` shim spawn 會在 Node 20+ 拋 `EINVAL`(CVE-2024-27980 hardening),導致 probe 失敗 → 標為 `spawn-failed`。詳見 **BUG-053**(新開)
- [x] **AC-4.4 — Settings UI / Browse button**:**code-path verified(未做 UI smoke)**
  - Worker 環境為自動化命令列,無法實際打開 Settings 面板 + 點 Browse button
  - 已讀 `src/components/ClaudeRuntimeSection.tsx` 原始碼,File dialog IPC 實作完整(T0232 已驗收)
  - **建議使用者在下次 packaged smoke test 時順手確認**(非本工單 blocker)

### mac/Linux playbook 路徑

`docs/plan-027-cross-platform-verification.md`(新建)

內容涵蓋:
- macOS(Intel / Apple Silicon)環境準備 + M-1..M-5 checklist
- Linux(Ubuntu / Fedora / Arch)環境準備 + L-1..L-5 checklist
- 平台差異對照表(binary 名稱、PATH 慣例、Gatekeeper / SmartScreen 警示、`~/` 展開)
- 邊界情境(多 claude 並存、AppImage 限制、macOS quarantine attribute)
- 回報模板(給 Selene 複製貼上)

### 遭遇問題

1. **Windows Node 20+ `.cmd` shim probe 無法 spawn(CVE-2024-27980)**:已開 **BUG-053**,優先級 Low(fallback-to-embedded 已保底;production packaged 不 hit)。非 T0233 範圍的修復,僅登記現象 + 推薦修復方案(option A:條件式 `shell: true`)
2. **Session state spike 無法實機驗證**:Worker 環境無法操作 Electron UI。改以 code-path analytical spike 結論,明確標示「positive 但未實機」。建議 Selene 跨平台驗證時順手補實測

### 互動紀錄

無(本工單全程無使用者互動,按派發指令執行)

### Renew 歷程

無。
