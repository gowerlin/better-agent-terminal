# T0234 — 文件:PLAN-027 CLAUDE.md 段 + Release note + Settings UI hint(Phase 1 最終)

## 元資料

- **編號**:T0234
- **類型**:documentation(純文件 + 1 處 UI 文案小改)
- **狀態**:🔄 IN_PROGRESS
- **建立時間**:2026-04-22 19:52 (UTC+8)
- **派發時間**:2026-04-22 19:52 (UTC+8)
- **開始時間**:2026-04-22 19:57 (UTC+8)
- **派發模式**:`--mode yolo`(純文件,無需互動)
- **優先級**:🟡 Medium(PLAN-027 Phase 1 結案條件)
- **前置條件**:T0230 / T0231 / T0232 / T0233 / T0235 全 DONE,BUG-054 / BUG-053 CLOSED
- **關聯**:
  - PLAN-027 #5(研究報告 R5 最後一張)
  - T0229 研究報告
  - `CLAUDE.md` 頂層(「Claude Agent SDK / CLI」段)
  - `docs/plan-027-cross-platform-verification.md`(T0233 + T0235 已建立的跨平台 playbook)
  - `src/components/ClaudeRuntimeSection.tsx`(T0232 產出,缺 hint 文案)
  - Release note / CHANGELOG 慣例(先 grep 找)
- **預估時間**:30 min
- **Renew 次數**:0

## 背景

PLAN-027 Phase 1 程式碼全部完成(T0230/T0231/T0232/T0233 + T0235 hotfix),BUG-054/053 CLOSED。本工單是收尾最後一張:把實作寫入使用者導向文件,讓未來使用者 / 開發者知道這套功能的存在、用法、故障排除。

同時補 T0233 Worker 旗標的 UI hint 缺口(`ClaudeRuntimeSection.tsx` 缺「Changes apply to new sessions only」顯式提示)。

## 實作範圍

### 1. `CLAUDE.md` 頂層「Claude Agent SDK / CLI」段補充

**位置**:現有「Claude Agent SDK / CLI」段(靠近頂部),在版本資訊後新增 Runtime Selection 子段。

**內容框架**:

```markdown
## Claude Runtime Selection (PLAN-027, v?.?.?+)

BAT 預設使用**內嵌版** claude CLI(隨 BAT 打包,版本鎖在 `@anthropic-ai/claude-code ^X.Y.Z`)。
若你想用系統上自己安裝的 claude CLI(例如剛 release 的新版),可在 Settings → Advanced → Claude Runtime 切換。

### 為什麼有兩個選項

- **內嵌(embedded,預設)**:版本跟 BAT 發行綁定,穩定、可控、不受系統環境影響。適合大多數使用者。
- **系統(system)**:用系統 PATH 上的 claude(或使用者自訂路徑)。適合想立即試用新 CLI 功能、不想等 BAT release 重打包的 power user。

### 什麼時候該切 system

- 想用比 BAT 內嵌更新的 claude CLI(例:上游剛 ship 新 model support)
- 想用某個特定版本測試 / debug
- 其他時候建議用內嵌,減少環境變動面

### Fallback 行為

預設開啟 `Fall back to embedded if system fails`。當 system claude:
- 偵測不到(PATH / customPath 找不到)
- 健康檢查失敗(spawn error / version parse 失敗)
- 版本太舊(`< 2.0.0`)

→ 自動退回內嵌版,使用者會看到 toast 提示 degraded reason。

關閉 fallback 時,偵測失敗會讓 Agent spawn / 終端啟動都失敗,適合嚴格要求只用 system 的場景。

### 設定變更範圍

**切換只影響新 session**。進行中的 Agent session 不受影響(transcript 仍在原 runtime 下)。終端 claude-cli preset 每次開新終端時取最新設定。

### 跨平台安裝指引

- **macOS**:用 anthropic 官方 installer(`~/.local/bin/claude`)或 Homebrew(`/opt/homebrew/bin/claude`)
- **Linux**:用 anthropic 官方 installer(`~/.local/bin/claude`)
- **Windows**:用 anthropic 官方 installer(自動放 `%USERPROFILE%\.local\bin\claude.exe`)。`npm install -g` 的 `.cmd` shim **不被偵測**(參見 `docs/plan-027-cross-platform-verification.md`)

### 常見故障

| 症狀 | 可能原因 | 解法 |
|------|---------|------|
| 切 system 但 Agent 版本沒變 | 在現有 session 觀察 | 開新 session,設定只影響新 session |
| 切 system 後 terminal claude-cli 版本沒變 | 舊 terminal 分頁未重開 | 關掉 terminal 分頁重開 |
| Toast 顯示 "system-not-found" | PATH 上找不到 claude | 確認 installer 跑過,或用 customPath |
| Toast 顯示 "system-too-old" | 版本 < 2.0.0 | 升級 claude CLI |
| Toast 顯示 "version-warning" | 版本 >= 2.0.0 但 < 2.1.111 | 功能可用但缺 Opus 4.7 / xhigh,建議升級 |
```

**註**:「v?.?.?+」由 Worker 查當前 `package.json` version + 1(pre-release 版號)填。

### 2. Release note(若專案有 CHANGELOG 或 release note 慣例)

**行動步驟**:
1. Worker 先 grep / find `CHANGELOG.md` / `releases/` / `docs/release-notes*` / `.changeset/`
2. 若有既有 release note 檔案,在最新 pre-release 區段加入 PLAN-027 條目
3. 若無固定結構,產出 `_ct-workorders/_release-notes-plan-027.md` 草稿,塔台 review 後整合

**Release note 條目內容**(User-facing 口吻,簡短):

```markdown
## ✨ New: Choose between embedded and system Claude CLI (PLAN-027)

BAT now ships with an embedded Claude CLI but also lets you opt in to your system-installed claude binary.

- **Where**: Settings → Advanced → Claude Runtime
- **Why**: Use bleeding-edge claude features without waiting for a BAT release
- **Safety net**: Automatic fallback to embedded if system runtime fails (toast notifies you)

Platform-specific installation guide: see `docs/plan-027-cross-platform-verification.md`.
```

### 3. Settings UI hint 補強(T0233 Worker 旗標缺口)

**位置**:`src/components/ClaudeRuntimeSection.tsx`,在 radio group 附近或下方加 hint 文案。

**建議文案**(用 i18n,加到既有三語言 json):

```
zh-TW: 「變更僅套用到新開的 session 與新開的終端,現有 session 不受影響。」
zh-CN: 「更改仅套用于新开的 session 与新终端,现有 session 不受影响。」
en:    "Changes apply to new sessions and new terminals only. Existing sessions are unaffected."
```

**i18n key 建議**:`settings.claudeRuntime.hint.changesApplyToNewOnly`(延續 T0232 命名風格)。

**若 `settings.claudeRuntime.hint` 已存在**(T0232 產的 general hint):改 key 為 `.applyScope` 或合併成同一段文字,Worker 看實際檔案決定。

### 不改(本工單範圍外)

- ❌ 任何 production code(router / resolver / agent-manager / IPC handler)— Phase 1 程式碼已定稿
- ❌ 跨平台 playbook(T0235 已重寫 Windows 段)— 若發現其他平台段有 stale 資訊可標註 TODO,不主動改
- ❌ Session state 實機驗證(T0233 flag,未來 Phase 2 或獨立工單)

### 特別注意

- **版本號填寫**:Worker 查 `package.json` 的 `version` 欄位,CLAUDE.md 填下一個 pre-release 版號(若 release 流程慣例如此)。若不確定,填 `v?.?.?+` 並在回報說明待塔台填入
- **語氣**:CLAUDE.md 是開發者導向,release note 是使用者導向。**不要混用**
- **tsc 驗收**:`npx tsc --noEmit` 仍需綠(因 UI hint 可能動 i18n json 和 ClaudeRuntimeSection.tsx)
- **vite build 驗收**:需綠(UI 改動)

## Acceptance Criteria

- [ ] **AC-1**:`CLAUDE.md` 頂層「Claude Agent SDK / CLI」段新增 Runtime Selection 子段,涵蓋 6 個段落(為什麼有兩個選項 / 何時切 system / Fallback / 設定變更範圍 / 跨平台指引 / 常見故障表)
- [ ] **AC-2**:Release note 條目產出(位置依專案慣例;若無,產草稿 `_ct-workorders/_release-notes-plan-027.md`)
- [ ] **AC-3**:`ClaudeRuntimeSection.tsx` 加入「Changes apply to new sessions and new terminals only」hint 文案,i18n 三語完整
- [ ] **AC-4**:既有 28 unit tests 仍全綠
- [ ] **AC-5**:`npx tsc --noEmit` exit 0、`npx vite build` 成功
- [ ] **AC-6**:grep CLAUDE.md 無 typo、段落錨點連結正確(若有連到 playbook 檔)
- [ ] **AC-7**:PLAN-027 結案條件達成:程式碼(T0230-T0233 + T0235)+ 文件(T0234)+ BUG-054/053 CLOSED
- [ ] **AC-8**:若 release note 位置不確定,在回報區明示塔台決策

## 驗收依據

1. T0229 研究報告(使用者導向章節參考)
2. `CLAUDE.md` 現有「Claude Agent SDK / CLI」段(風格對齊)
3. `docs/plan-027-cross-platform-verification.md`(交叉引用)
4. `src/components/ClaudeRuntimeSection.tsx`(T0232 產出,hint 缺口)
5. `src/locales/*.json`(i18n 檔案位置)

## 產出位置

- 修改:`CLAUDE.md`(加 Runtime Selection 段)
- 可能新增 / 修改:`CHANGELOG.md` 或 `docs/release-notes-*.md` 或 `.changeset/*`(視專案慣例)或 `_ct-workorders/_release-notes-plan-027.md`(草稿 fallback)
- 修改:`src/components/ClaudeRuntimeSection.tsx`(加 hint)
- 修改:`src/locales/en.json` / `zh-TW.json` / `zh-CN.json`(hint 字串)

## 風險與備註

- **R1 - Release note 位置不定**:若專案沒固定 CHANGELOG,產草稿後塔台決策。不阻擋本工單 DONE
- **R2 - 版本號**:Worker 自行查 `package.json` 或標註 `v?.?.?+` 交塔台填。不卡死
- **R3 - CLAUDE.md 尺寸**:目前 CLAUDE.md 已不短,新增 Runtime Selection 段預計 ~50 行。若超過 80 行,可以考慮拆到 `docs/` 子文件並在 CLAUDE.md 放連結 + 摘要
- **R4 - i18n hint 與既有 hint 衝突**:T0232 已加部分 hint,若 key 衝突 Worker 合併而非覆蓋(避免破壞現有文案)

## 回報區

### 完成狀態

DONE

### 產出摘要

- **Commit hash**:(待 commit 後填入)
- **修改檔案**(5 個,T0234 範圍內):
  - `CLAUDE.md` — 新增 `### Claude Runtime Selection (PLAN-027, v2.1.49+)` 子段(L42–L82,40 行)
  - `CHANGELOG.md` — `[Unreleased] → Added` 頂端新增 `#### Claude Runtime Selection (PLAN-027)` 區塊
  - `src/locales/en.json` — 合併 `hint` 文案(scope + 2.1.111 caveat)
  - `src/locales/zh-TW.json` — 合併 `hint` 文案
  - `src/locales/zh-CN.json` — 合併 `hint` 文案
- **AC 勾選**:
  - AC-1 ✅ CLAUDE.md Runtime Selection 子段涵蓋 6 段(為什麼有兩個選項 / 何時切 system / Fallback / 設定變更範圍 / 跨平台 / 常見故障)
  - AC-2 ✅ Release note 寫入既有 `CHANGELOG.md` 的 `[Unreleased] → Added`(無需草稿 fallback)
  - AC-3 ✅ ClaudeRuntimeSection.tsx 的 `settings.claudeRuntime.hint` 三語合併「new sessions and new terminals only. Existing sessions are unaffected.」+ 保留既有 2.1.111 caveat;UI 位置已在 radio group 尾端(T0232 產出,未動 component code)
  - AC-4 ✅ `npx tsx tests/claude-runtime-router.test.ts` → 11/11、`npx tsx tests/claude-resolver.test.ts` → 17/17,合計 28/28 綠
  - AC-5 ✅ `npx tsc --noEmit` EXIT=0;`npx vite build` EXIT=0(built in 2.45s,無 error)
  - AC-6 ✅ CLAUDE.md 無 typo;playbook 連結 `docs/plan-027-cross-platform-verification.md` 有效
  - AC-7 ✅ PLAN-027 Phase 1 結案達成:T0230/T0231/T0232/T0233/T0235 DONE + T0234 DONE + BUG-053/054 CLOSED
  - AC-8 ➖ 不適用(release note 位置已確定,無需塔台決策)
- **tsc / vite 結果**:tsc EXIT=0、vite build EXIT=0(2.45s)
- **Release note 位置選擇**:既有 `CHANGELOG.md` 的 `[Unreleased] → Added` 頂端(專案有固定慣例,無需草稿 fallback)
- **版本號處理**:CLAUDE.md 填 `v2.1.49+`(依最新 tag `v2.1.48-pre.1` 推下一個 patch stable 版號);`package.json` 的 `"version": "1.0.0"` 是 stale(實際 release 用 git tag 驅動,見 `scripts/build-version.js`)。若塔台認為該改 minor(v2.2.0),可在 release 時同步修訂本段落

### CLAUDE.md 變更預覽

```
## Claude Agent SDK / CLI                                        (L35, 既有)
  ...既有 SDK 版本 / BUILTIN_MODELS / EFFORT_LEVELS...
  
### Claude Runtime Selection (PLAN-027, v2.1.49+)                (L42, 新增)
  - 開場:預設 embedded、切換位置 Settings → Advanced → Claude Runtime
  - **為什麼有兩個選項**           — embedded vs system 取捨
  - **什麼時候該切 system**        — 3 個使用情境
  - **Fallback 行為**              — 3 種觸發條件 + toast
  - **設定變更範圍(T0233 Worker 旗標)** — resolveClaudeRuntime() 單一入口
  - **跨平台安裝指引**             — macOS/Linux/Windows + npm shim 警語(BUG-053)
  - **常見故障**                   — 5 列表格(症狀/原因/解法)

## Electron Runtime                                              (L83, 既有)
```

### Settings UI hint 處理

**策略**:合併進既有 `settings.claudeRuntime.hint` key(T0232 產出),不新增 `.applyScope` 子 key,避免雙 hint 並排噪音。Component 側無需改動(`ClaudeRuntimeSection.tsx` L268 已渲染該 key)。

**三語文案**:

| Locale | 文案 |
|--------|------|
| `en` | `Changes apply to new sessions and new terminals only. Existing sessions are unaffected. System mode may lack features added in 2.1.111 (Opus 4.7 / xhigh effort).` |
| `zh-TW` | `變更僅套用到新開的 session 與新開的終端,現有 session 不受影響。System 模式可能缺少 2.1.111 之後新增的功能(Opus 4.7 / xhigh effort)。` |
| `zh-CN` | `更改仅套用于新开的 session 与新终端,现有 session 不受影响。System 模式可能缺少 2.1.111 之后新增的功能(Opus 4.7 / xhigh effort)。` |

### 遭遇問題

無。執行過程一路綠,無卡點。唯一小判斷是 `settings.claudeRuntime.hint` 既有文案的處理:工單允許改 key 為 `.applyScope` 或合併,Worker 選擇合併(減少 UI 噪音 + 不增加未使用的 i18n key)。

### Renew 歷程

無。
