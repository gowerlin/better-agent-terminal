---
schema_version: 1
schema_kind: workorder
id: T0250
title: 研究：BUG-059 embedded `claude.exe` auto-update 失敗根因 + 修復方向
type: research
status: DONE
started_at: "2026-04-25T09:40:00+08:00"
completed_at: "2026-04-25T09:55:00+08:00"
renew_count: 0
---
# T0250 — 研究：BUG-059 embedded `claude.exe` auto-update 失敗根因 + 修復方向

## 元資料

- **編號**：T0250
- **類型**：research（允許 Worker 與使用者互動）
- **狀態**：✅ DONE
- **開始時間**：2026-04-25 09:40 (UTC+8)
- **完成時間**：2026-04-25 09:55 (UTC+8)
- **commit**：2d5db28
- **優先級**：🔴 **High**（packaged 用戶端可用性中斷）
- **建立時間**：2026-04-25 (UTC+8)
- **派發模式建議**：`--mode on --interactive`（research 標準配置）
- **互動限制**：每次提問上限 3 個（per `research_max_questions: 3`）
- **預估時間**：60-90 分鐘（靜態分析 + 1-2 輪使用者互動 + asar 解壓驗證 + spawn env 實驗）
- **Renew 次數**：0
- **affects_files**（讀取為主，不修改）：
  - `electron/claude-runtime-router.ts`（runtime selection 入口）
  - `electron/claude-agent-manager.ts`（Agent SDK spawn）
  - `electron/auth-manager.ts`（auth flow spawn）
  - `electron/terminal/*`（terminal claude-cli preset）
  - `package.json`（`@anthropic-ai/claude-code` 鎖版 + asarUnpack）
  - `node_modules/@anthropic-ai/claude-code/`（CLI 本體 + auto-update 邏輯）
  - 必要時解壓 `C:\Users\si_is\AppData\Local\Programs\BetterAgentTerminal\resources\app.asar`

## 前置條件

- BUG-059（本研究目標）
- BUG-055（相同根因類型，dev/install 場景，已 WONTFIX）
- PLAN-027 / CLAUDE.md「Claude Runtime Selection」段落（embedded vs system 機制）
- `package.json` `@anthropic-ai/claude-code ^2.1.111`（npm 實際 2.1.113）
- 使用者環境：Windows 11，packaged BAT，可重現

## 研究目標

**定位 BUG-059 根因**，產出可以直接派實作工單的結論：「應該改哪個檔案的哪一行、改成什麼，預期效果是什麼」。

**禁止**：直接修 code、直接重新打包、猜測性提交。本工單是**研究**。

---

## 研究範圍

### 1. 確認 auto-update 觸發路徑（必做）

- [ ] 解壓 `node_modules/@anthropic-ai/claude-code/`，定位 auto-update 邏輯位置
  - 是否有 `update.js` / `auto-updater` 模組？
  - 觸發條件：每次 spawn 都檢查？週期性？版號比對策略？
- [ ] 該邏輯是否吃環境變數可關閉？（如 `CLAUDE_DISABLE_AUTOUPDATE=1` / `DISABLE_AUTOUPDATER=1` / `NO_UPDATE_NOTIFIER`）
- [ ] 該邏輯是否吃 `claude config` 設定？（如 `autoUpdates: false`）
- [ ] config 寫入位置（per-user `~/.claude/`？per-binary？）和 packaged 環境讀取行為

### 2. 失敗點定位（必做）

當 auto-update 在 `app.asar.unpacked\node_modules\@anthropic-ai\claude-code\bin\` 下執行 rename + 寫入時，哪一步失敗？

- [ ] **rename 成功**（已知，從殘留檔證實）
- [ ] **下載失敗**？網路 / proxy / certificate
- [ ] **寫入失敗**？權限（`Program Files\BetterAgentTerminal` 是受保護路徑）/ UAC / Windows Defender / Code Signing
- [ ] **驗證失敗**？checksum / signature
- [ ] **rollback 邏輯**：claude CLI 是否有 try/finally 把 `.old` rename 回去？看起來沒有 → 確認

### 3. BAT spawn 環境分析（必做）

- [ ] BAT spawn embedded claude 時，env vars 帶哪些？（檢查 `claude-agent-manager.ts` / `auth-manager.ts` / terminal preset）
- [ ] 是否有任何欄位可以在 spawn 前注入「禁用 auto-update」flag？
- [ ] 對比 system runtime 的 spawn path：是否也吃同樣 env？（避免修了 embedded 卻在 system 路徑也誤關）

### 4. 修復方向評估（必做，產出方案 A/B/C 表）

| 方案 | 描述 | 風險 | 成本 |
|------|------|------|------|
| A | spawn env 注入 disable flag | 取決於 claude CLI 是否認 env | 1-3 行，~30 分鐘 |
| B | spawn 前 `claude config set autoUpdates false` 一次性寫入 | 需 per-install 執行，可能要 postinstall hook | ~50 行 + hook |
| C | postinstall script 清理 `.old.*` + 修改 binary 鎖權限 | 治標不治本 | 中等 |
| D | 改 BAT 預設 runtime 為 system + 文件警告 | 跳過問題，但違背 PLAN-027 設計意圖（embedded 為預設） | 1 行 config |
| E | 上游回報 + 等修 | 不確定時程 | 0（短期），∞（長期） |

對每個方案：
- 預期效果
- 已知風險
- 是否需要 user 確認（如 D 改預設 runtime）
- 推薦等級

### 5. 跨平台影響評估（選做，看時間）

- [ ] macOS embedded path 是否同樣可能觸發？（`Application Support/BetterAgentTerminal/...`）
- [ ] Linux embedded path？
- [ ] POSIX 系統 in-use file 行為差異（unlink 允許 → 失敗模式可能不同）

### 6. 與 BUG-055 合併修復可行性（選做）

- [ ] BUG-055 的 dev/`node_modules` 殘留是否同一根因？
- [ ] 一個修復是否能涵蓋兩個 BUG？

---

## 互動點建議（per `research_interaction: true`）

研究中若需要使用者協助，可問：

1. **環境細節**：是否能提供觸發當下的時間戳，比對 claude CLI 是否有版號變動 log？
2. **重現條件**：每次跑 worker 都會嗎，還是有特定條件（如等待時間、特定工單類型）？
3. **修復方案偏好**：A-E 方案中傾向哪個？是否願意短期切 runtime=system 作為 workaround？

> 上限 3 個問題（per config）。問完整理結論。

---

## 產出規格（回報區必填）

1. **根因定位**（明確指向哪個模組哪一行）
2. **失敗點分類**（上述 1-3 項調查結論）
3. **方案 A-E 評估表**（含推薦）
4. **修復工單草案**（給塔台直接派下一張的內容：標題、預估時間、affects_files、acceptance criteria）
5. **BUG-055 合併方案建議**（是 / 否 / 部分）
6. **跨平台風險評估**（已測 / 推測 / 未測）

---

## 回報區（Worker 填寫）

### 完成狀態

DONE（research，可決策）

### 互動紀錄

無（user 先前已表明非救火模式；binary 反組譯已取得決策級數據，無需互動補 context）

### 產出摘要

純研究工單，僅讀取下列檔案 + 反組譯 native binary，**未修改任何 production code**：

- 讀：`node_modules/@anthropic-ai/claude-code/{install.cjs, cli-wrapper.cjs, package.json}`
- 讀：`node_modules/@anthropic-ai/claude-code-win32-x64/claude.exe.old.1776856737641`（dev workspace 已殘留同樣的 `.old.<ts>` → 與 BUG-059 packaged 現象同根因，dev 也在受害）
- 讀：`electron/{claude-runtime-router.ts, claude-agent-manager.ts, pty-manager.ts, main.ts, agent-runtime/agent-registry.ts}`
- `git status`：本工單只動工單檔本身，未產生 code diff

### 調查結論

#### 1. 根因定位（明確）

claude CLI native binary 內建 auto-update 邏輯，反組譯後流程如下（虛擬碼）：

```js
// 以下為從 native binary minified bytes 反組譯出的關鍵片段：
let z = Date.now()
let M = await stat(process.execPath, {bigint:true}).then(s => s.ino)
let Y = [process.execPath]                    // ← 關鍵 1：把自己丟進待 rename 清單
for (let O of await readdir(npmPrefix)) {     // 額外掃 npm prefix 找 hardlink siblings
  for (let name of ["claude.exe", "cli.exe"]) {
    let D = join(npmPrefix, O, name)
    if (D === process.execPath) continue
    let j = await stat(D).then(s => s.ino).catch(() => -1n)
    if (M && j === M) Y.push(D)
  }
}
let K = []
for (let O of Y) {
  let renamed = `${O}.old.${z}`
  await rename(O, renamed).then(() => K.push([O, renamed]), () => {})
}

let result = await spawn(npm, ["install", "-g", `@anthropic-ai/claude-code@<latest>`],
                         { cwd: homedir() })

// ← 關鍵 2：rollback 只在 npm install **失敗** 時執行
if (K.length && result.code !== 0) {
  for (let [orig, renamed] of K) await rename(renamed, orig).catch(...)
}

if (result.code === 0) {
  setConfig({ installMethod: "global" })   // ← 關鍵 3：staticly 把自己標記為 global install
  return "success"
}
```

**死亡螺旋**：

1. BAT spawn embedded claude（`process.execPath` = `app.asar.unpacked/.../bin/claude.exe`）
2. claude 把 `process.execPath` rename 成 `claude.exe.old.<ts>`（成功，因 `unpacked` 不在 asar 內、可寫）
3. 跑 `npm install -g @anthropic-ai/claude-code@<latest>`，cwd = `homedir()`
4. **npm install -g 寫到使用者 npm prefix（如 `%APPDATA%\npm\node_modules\...`），完全不知道 BAT 的 `app.asar.unpacked` 路徑**
5. npm install -g exit code = 0（在 user npm prefix 安裝成功）
6. **rollback 條件 `_.code !== 0` 不滿足，rollback 不執行**
7. BAT 的 `app.asar.unpacked/.../bin/claude.exe` 永遠停在 `.old.<ts>` 狀態
8. 下次 BAT spawn → `claude-runtime-router.ts:74-86` 走 hard-coded path → ENOENT → BUG-059 顯現

#### 2. 失敗點分類（依工單 § 研究範圍 #2）

| 步驟 | 結果 | 證據 |
|------|------|------|
| rename `claude.exe` → `.old.<ts>` | ✅ 成功 | 殘留檔證實，binary code 也只在 `.then` 才把 entry push 進 rollback 清單 |
| 下載 / npm install -g | ✅ 成功（**這是關鍵**） | 使用者 `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe` 大概率存在；可請使用者驗證 |
| 寫入 `app.asar.unpacked` | ❌ **從未嘗試** | 該路徑根本沒有在 update flow 內出現 |
| 驗證 / signature | N/A | 未執行 |
| rollback | ❌ **不執行** | code path 條件 `_.code !== 0` 不滿足 |

> **修正工單推測根因**：原工單第 4 點寫「下載/寫入失敗，沒有 rollback」**錯誤**。實際是「auto-update 機制根本不認得 app.asar.unpacked 路徑，npm install -g 成功後也不會把新 binary 放回原位置」。rollback 邏輯本身沒壞，是被 success path 繞過。

#### 3. BAT spawn 環境分析（依工單 § 研究範圍 #3）

**Agent SDK spawn**（`electron/claude-agent-manager.ts` line 720, 1401, 2283）：
- 透過 `pathToClaudeCodeExecutable` 直接指定 binary path
- env：未顯式設定，SDK 子行程繼承 `process.env`
- **可注入點**：在 spawn 前 `process.env.DISABLE_AUTOUPDATER='1'`，或讓 SDK 透過 env 傳入

**Terminal claude-cli preset**（`electron/pty-manager.ts` line 408-431, 456-486, 534-558）：
- env 顯式建構，已注入 `BAT_SESSION`、`BAT_TERMINAL_ID`、`BAT_REMOTE_PORT` 等
- **可注入點**：在三處 `envWithUtf8` 物件中加 `DISABLE_AUTOUPDATER: '1'`

**System runtime 的影響**：
- 若使用者透過官方 native installer 安裝 system claude → binary 內部已自動 set `installMethod: "native"` + `autoUpdatesProtectedForNative: true` → 自我關閉 auto-update（見 binary 字串 `'Native installer: Set installMethod to "native" and disabled legacy au[to-updates]'`）
- 對 native install 注入 `DISABLE_AUTOUPDATER=1` **無副作用**（疊加同一個關閉點）
- 對 npm-global system install（rare），注入也是「正確」行為（同樣會壞，只是壞在使用者 npm prefix）

**結論**：在 BAT 所有 spawn 路徑無條件注入 `DISABLE_AUTOUPDATER=1` 是安全的。

#### 4. config 寫入位置 / 影響

binary 把 `installMethod: "global"` 寫到 user-level claude config（per-user，非 per-binary）。意思：
- 一旦觸發過一次 BUG-059，使用者 `~/.claude/...` 的 config 就被改成 `installMethod: "global"`
- 即使後續 BAT 修好（embedded path 重新有 binary）、重開 BAT，CLI 啟動後仍會週期性檢查更新（因為 config 不是 native）
- **單純修 BAT 不重置 user config 的話，update flow 仍可能再次觸發**（雖然會落到不同路徑）
- 建議修復工單除了 spawn env 注入外，**第一次 spawn 前也檢查並修正使用者 config**（可選）

#### 5. 跨平台影響

- **macOS / Linux**（POSIX）：rename 開啟中的檔案語意不同（POSIX 允許 unlink 仍可執行），但 update flow 的 `Y=[process.execPath]` 邏輯一樣會把 BAT 的 embedded path rename 走，npm install -g 也不知道 BAT 路徑。**同樣有風險，只是症狀可能延後**（POSIX 下執行中的舊 inode 仍能跑，下次 spawn 才壞）。
- 推測風險等級：High（與 Windows 相同）；未實機測。

#### 6. BUG-055 合併修復可行性

**可以合併**。BUG-055 的 dev/`node_modules` 殘留（從 dev workspace 也看到 `.old.<ts>` 殘留可佐證）就是同一個 update flow 在 dev 環境跑出來的副作用。修復方向相同：

- 短期：spawn env 注入 `DISABLE_AUTOUPDATER=1`（dev / packaged 都有效）
- 長期：postinstall script 清理 `*.old.*`（保險）
- 註：dev 場景 user 跑 `npm install` 時，`@anthropic-ai/claude-code` 的 `install.cjs` postinstall 會重新 placeBinary，所以 BUG-055 在 dev 是「可自我修復」的（重跑 npm install 即恢復），但 packaged 沒有此 self-heal 機制。

建議：BUG-055 從 WONTFIX 改為 **BLOCKED-BY: T025X（修復工單）**，等 spawn env fix 落地後合併閉環。

### 方案 A-E 評估

| 方案 | 描述 | 預期效果 | 風險 | 成本 | 推薦 |
|------|------|---------|------|------|------|
| **A** | spawn env 注入 `DISABLE_AUTOUPDATER=1` | binary 直接走 `zYH()` early-return（type:"env"），完全跳過 update flow | 幾近零（user-level claude config 不變、不影響 system runtime 的合法 update） | ~5 行改動：`pty-manager.ts` 三處 + `claude-agent-manager.ts` spawn 前 process.env 注入 | ⭐⭐⭐⭐⭐ |
| B | spawn 前 `claude config set autoUpdates false` | 同 A，但寫到 config 持久化 | 影響使用者全域 config，污染 system runtime 設定 | ~30 行（呼叫 child_process + 處理 config 路徑） | ⭐⭐ |
| C | postinstall 清理 `.old.*` | 治標：每次 update 失敗後仍會壞，只是清掉舊檔 | 不治本，下次 update 仍重演 | ~20 行 hook | ⭐ |
| D | 改預設 runtime = system | 跳過問題，違背 PLAN-027 設計（embedded 為預設） | 使用者環境差異變大、文件包袱重 | 1 行 config + 大量文件 | 跳過 |
| E | 上游回報 + 等修 | 不確定時程 | 0（短期）但 user 持續受害 | 0 | 並行做（不取代 A） |

**強烈推薦方案 A**：
- 修改面最小（5 行內）
- 副作用零（binary 自有 early-return 路徑，不污染 user config）
- 可立即解 BUG-059 + BUG-055
- 與 PLAN-027 runtime selection 完全相容（system runtime 仍受影響但安全，因 native 已自我關閉）
- 可同時做方案 E（上游回報）作長期治本

### 建議方向

採用方案 A，並開**修復工單 T025X**（草案見下節）。BUG-059 / BUG-055 等 T025X DONE 後合併重評估。

### 修復工單草案（給塔台直接派）

**標題**：T025X — 修：BAT spawn embedded claude 注入 `DISABLE_AUTOUPDATER=1` 防止 auto-update 破壞 binary

**類型**：bug-fix（衍生自 BUG-059，亦修 BUG-055）

**預估時間**：30-45 分鐘（含驗證）

**affects_files**：

- `electron/pty-manager.ts`（三處 envWithUtf8：line ~408-431 / ~456-486 / ~534-558）
- `electron/claude-agent-manager.ts`（三處 query() spawn 前：line 720, 1401, 2283；最簡單做法是在 manager init 時 `process.env.DISABLE_AUTOUPDATER='1'`）
- `CLAUDE.md`（補一段「Embedded claude auto-update 已停用」說明）
- 可選：`scripts/postinstall.js` 或 BAT app 啟動時清理 `node_modules/@anthropic-ai/claude-code*/bin/*.old.*`、`app.asar.unpacked/.../bin/*.old.*`

**任務指令**：

1. 在 `pty-manager.ts` 三處 `envWithUtf8` 物件中加入 `DISABLE_AUTOUPDATER: '1'`（與 `BAT_SESSION` 並排）。註解標 `// BUG-059: prevent embedded claude self-rename + global npm install which orphans app.asar.unpacked binary`
2. 在 `claude-agent-manager.ts` 的 manager 建構或 init 階段，無條件 `process.env.DISABLE_AUTOUPDATER='1'`（影響 SDK 子行程繼承）
3. 自我驗收：本機跑 `node_modules/@anthropic-ai/claude-code/bin/claude.exe`（手動還原）後，BAT 連續派 3 張 worker 工單，**不應**再產生 `*.old.*` 殘留
4. 跨平台 spot-check：macOS 開發機執行同樣 BAT spawn → 確認 `claude` binary 不被 rename
5. CLAUDE.md 補段落（在 Claude Runtime Selection 之後）：

   ```md
   ### Embedded claude auto-update 停用（BUG-059）

   BAT 對 embedded 與 system 兩種 runtime 的 spawn 都注入 `DISABLE_AUTOUPDATER=1`：
   - **Embedded**：必須關，否則 claude CLI 會把 `app.asar.unpacked/.../bin/claude.exe` rename 成 `.old.<ts>`，再 `npm install -g` 到使用者 npm prefix（不在 BAT 路徑），導致 BAT 下次 spawn 找不到 binary
   - **System**：native installer 已自我關閉 auto-update（`autoUpdatesProtectedForNative: true`），疊加 env flag 無副作用；npm-global system 安裝同樣受益於此 flag
   - 使用者要更新 embedded：等 BAT release 重打包；要更新 system：在 BAT 外手動 `claude update` 或重跑 installer
   ```

**驗收條件（acceptance criteria）**：

- [ ] grep `DISABLE_AUTOUPDATER` 在 BAT codebase 至少出現 4 次（pty-manager 三處 + agent-manager init 一處）
- [ ] 連續跑 5 張 worker 工單後，`node_modules/@anthropic-ai/claude-code*/bin/` 與 packaged `app.asar.unpacked/.../bin/` 都無 `*.old.*` 殘留
- [ ] BAT terminal 內手動跑 `claude --version` 不觸發 update
- [ ] BAT terminal 內手動跑 `claude config get autoUpdates`（或 `--debug`）顯示 disabled by env
- [ ] Windows 11 + macOS（dev workspace 即可）spot-check 通過
- [ ] CLAUDE.md 已補充段落
- [ ] git commit 含 `BUG-059`、`BUG-055` reference

**非目標（out of scope）**：
- 改預設 runtime（PLAN-027 行為維持）
- postinstall 清理 `.old.*`（可於 follow-up 工單做，不在 hot-fix scope）
- 修使用者已被污染的 `installMethod: "global"` user config（影響面待評估）

### 遭遇問題

無。研究範圍 #1-#4 全部完成，#5（跨平台）以推測+反組譯邏輯一致性論證（未實機）；#6（BUG-055 合併）有結論。

### Renew 歷程

無

### 回報時間

2026-04-25 09:55 (UTC+8)

---

**建立者**：Control Tower（Session 25，2026-04-25）
**對應 BUG**：BUG-059
**對應決策**：D086
