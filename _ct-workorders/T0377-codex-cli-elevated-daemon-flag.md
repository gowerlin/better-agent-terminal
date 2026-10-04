---
schema_version: 1
schema_kind: workorder
id: T0377
title: "BUG-085 修復：提權 Windows 下 codex-cli 啟動指令注入 -c features.daemon_auto_start=false + 一次性提示"
type: implementation
status: IN_PROGRESS
priority: P2
sizing: M
created_at: "2026-10-04T20:39:03+08:00"
updated_at: "2026-10-04T20:41:02+08:00"
started_at: "2026-10-04T20:41:02+08:00"
completed_at: null
target_version: next
depends_on: [T0375]
related:
  - "BUG-085（修復對象）"
  - "T0375（研究，方案 B' 與全部證據；實作前必讀其回報區）"
  - "D124（本工單決策）"
affects_files:
  - electron/agent-runtime/agent-registry.ts
  - electron/windows-elevation.ts
  - electron/main.ts
  - src/components/WorkspaceView.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 只注入 `codex-cli` 定義；`codex-agent` / `codex-agent-worktree`（SDK 路徑）**不得**注入（T0375 證實不受影響）。"
  - "🔴 提權偵測用 `execFile` + **System32 絕對路徑** + timeout 5s（CLAUDE.md Child Process Spawning；Git Bash 的 `whoami` 是 `/usr/bin/whoami`）。禁用 shell-spawning exec API。"
  - "🔴 不改 UAC / 登錄檔 / 使用者 `~/.codex/config.toml`；不 push。"
  - "⚠️ 並行工單 T0376 改 `.vscode/scripts/release.ps1` / `scripts/build-version.js`，與本單無檔案重疊；不要碰那些檔。"
---

# T0377 — BUG-085 修復：提權 Windows 的 codex-cli daemon 旗標

## 背景

Codex CLI 0.160 的 Windows daemon 拒絕在提權權杖下啟動，BAT 的 Codex CLI 終端 preset 與以 codex-cli 派發的 Tower Worker 在提權環境（UAC 停用、或以系統管理員執行 BAT）直接 exit 1。**實作前完整讀 T0375 回報區**，所有證據與方案比較都在那裡。

## 決策（D124）：方案 B' + 一次性提示

1. **提權偵測**（新檔 `electron/windows-elevation.ts`）：Windows 以 `execFile('%SystemRoot%\\System32\\whoami.exe', ['/groups'])` 判斷是否含 `S-1-16-12288`（High Mandatory Level）；非 Windows 恆 `false`；偵測失敗 / 逾時 → `false`（不注入，維持現狀）。app ready 時偵測一次並 cache
2. **注入點**：`electron/agent-runtime/agent-registry.ts` `buildLaunchCommand()`，`definitionId === 'codex-cli'` 且 elevated 時插入 `-c features.daemon_auto_start=false`（**不用 `--no-daemon`**：PATH 上舊版 codex 0.133 會 exit 2）。registry 保持同步 API，以 setter（例如 `setElevated(bool)`）注入偵測結果。所有入口都經過此 choke point（renderer `WorkspaceView.tsx` 經 IPC `agent:build-launch-command`、`main.ts` `buildAgentPromptCommand()`）
   - 去重：customArgs 已含 `--no-daemon` 或 `daemon_auto_start` 時不注入
3. **一次性提示**：提權時首次開 Codex CLI 分頁 toast，說明「BAT 以系統管理員權限執行，Codex CLI 已自動停用背景 daemon」+ 手動繞法 `--no-daemon`；i18n 三語。提示每次 app 執行最多一次即可（不需持久化）

## 驗收

- unit（新增）：`buildLaunchCommand('codex-cli')` elevated true / false 的輸出；customArgs 含 `--no-daemon` / `daemon_auto_start` 去重；`codex-agent` 不注入；`whoami /groups` 輸出解析（High / Medium / 空 / 錯誤 → false）。測試檔位置須被 `vite.config.ts` `test.include` 涵蓋
- `npm run test:unit` 全綠（基線 673；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline 40
- 本機 runtime 可選：Worker 本身在提權 shell，可用 node 直接呼叫偵測函式印結果（不需啟動 app）
- **runtime 驗收（交使用者）**：新 build 開 Codex CLI 分頁應進 TUI 而非 exit；UAC 開啟機器的非提權 BAT 不應帶此旗標（本機無法驗）

## 範圍外

- Settings 層 codex runtime 選擇（BUG-083 S3 後排項）
- 「已有非提權 daemon」情境（T0375 標為無法判定，需 UAC 開啟機器）
- 使用者手打 `codex` 的情境（只靠提示文字）

## Sub-session 執行指示

1. 讀取本工單 + `BUG-085` + **T0375 回報區**
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG-085 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 結果摘要

方案 B'（D124）已實作：BAT 啟動時偵測自身 Windows 提權 → `codex-cli` launch command 在 `codex` 之後注入 `-c features.daemon_auto_start=false`；提權時首次開 Codex CLI 分頁顯示一次性 i18n toast（含手動繞法 `--no-daemon`）。`codex-agent` / `codex-agent-worktree`（SDK 路徑）不注入。

### Landing Zone Check

| 檢查 | 結果 | 說明 |
|------|------|------|
| C-0 repo identity | ⚠️ WARN | frontmatter 無 `repo`（`absent`）；`basename(REPO_ROOT)` = `better-agent-terminal` |
| C-1 work order path | ✅ PASS | 位於 `REPO_ROOT/_ct-workorders/` |
| C-3 affects_files | ⚠️ 部分 | 6/7 存在；`electron/windows-elevation.ts` 為本單新建（祖先 `electron/` 存在 → present） |
| C-2 branch | ℹ️ n/a | 無 `branch` 欄位；實際 `main` |

整體 **WARN**（僅 C-0 欄位缺）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（evidence only）。`CT_MODE=on`、`CT_INTERACTIVE=0`。

### 實作內容

| 檔案 | 變更 |
|------|------|
| `electron/windows-elevation.ts`（新） | `parseWhoamiGroupsElevated()`（以 SID `S-1-16-12288` 判定，不依賴語系化群組名；擋 `S-1-16-122880` 等前綴誤判）、`getWhoamiPath()`（`%SystemRoot%\System32\whoami.exe` 絕對路徑）、`detectWindowsElevation(deps)`（`execFile` + `['/groups']` + timeout 5000 + `windowsHide`；非 Windows 不 spawn 恆 `false`；error / timeout / 同步 throw → `false`）、`getWindowsElevation()`（每行程 cache 一次） |
| `electron/agent-runtime/agent-registry.ts` | `CODEX_DISABLE_DAEMON_ARGS` 常數；`setElevated()` / `isElevated()`；`buildLaunchCommand(definitionId, options?, extraArgs?)` 新增選用第三參數 `extraArgs`（**只用於去重，不附加**，呼叫端照舊自行附加 customArgs），`definitionId === 'codex-cli'` && elevated && customArgs 不含 `--no-daemon` / `daemon_auto_start` 時，於 `codex` 之後（launch options / customArgs / `resume`/`fork` 子命令之前）插入旗標。registry 維持同步 API |
| `electron/main.ts` | `ensureElevationApplied()`（memoized：`getWindowsElevation()` → `agentRegistry.setElevated()` + log）；`app.whenReady` 中於 `startTerminalServer()` 前 non-blocking 啟動偵測；IPC `agent:build-launch-command` 改 async，先 `await ensureElevationApplied()` 再以 persisted `agentCustomArgs[definitionId]` 去重；`buildAgentPromptCommand()`（Tower 派發 / remote）同樣先 await，`extraArgs` 計算上移（值不變）並傳入去重 ⇒ 啟動初期還原分頁 / 派發不會與偵測競態 |
| `src/components/WorkspaceView.tsx` | 4 個 `buildLaunchCommand` 呼叫點（還原分頁 / 預設 agent 分頁 / 新增分頁 / restart）於拿到指令後呼叫 `noticeCodexDaemonRef.current(cmd)`：指令含 `features.daemon_auto_start=false` 且本 renderer 尚未提示過 → `CtToast` warning 12s。以 ref 實作，未改既有 effect 的 dependency list；toast 以 `createPortal` 掛到 `document.body`，非作用中（hidden）workspace 觸發也看得到 |
| `src/locales/{en,zh-TW,zh-CN}.json` | 新增 `toast.codexCli.elevatedDaemonDisabled` 三語 |
| `electron/__tests__/agent-registry-codex-elevation.test.ts`（新） | 10 tests：旗標字面值、預設非提權、非提權不變、提權注入位置、與 launch options 順序、不附加 customArgs、`--no-daemon` / `daemon_auto_start`（`-c` 與 `--disable` 兩種）去重、`codex-agent` / `codex-agent-worktree` 回 `null`、gemini / copilot 不注入 |
| `electron/__tests__/windows-elevation.test.ts`（新） | 11 tests：High → true、Medium → false、空 / null / undefined → false、語系化群組名靠 SID、SID 前綴誤判、System32 絕對路徑、非 Windows 不 spawn、`/groups` + timeout 5000、error/timeout → false、同步 throw → false |

測試檔位於 `electron/__tests__/`，已被 `vite.config.ts` `test.include` 的 `'electron/__tests__/**/*.test.ts'` 涵蓋。

### 驗證（證據分道）

| 分道 | 結果 | 證據 |
|------|------|------|
| unit（新增） | ✅ PASS | 2 files / 21 tests passed |
| `npm run test:unit` | ✅ PASS | 50 files / **709** tests passed。709 = 基線 673 + 本單 21 + 並行 T0376 未 commit 的 `electron/__tests__/build-version.test.ts` 15（單獨跑確認 15 passed）⇒ 不含 T0376 為 694 |
| `npx tsc --noEmit` | ✅ PASS | **40** errors（= baseline 40；本單改動檔零 error） |
| `npx vite build` | ✅ PASS | exit 0 |
| 本機 runtime（偵測函式） | ✅ PASS | esbuild 打包 `windows-elevation.ts` 至 scratchpad 以 node 呼叫：`whoami path: C:\WINDOWS\System32\whoami.exe`、`elevated: true`（23ms）；對照 PowerShell `WindowsPrincipal.IsInRole(Administrator)` = `True`。scratchpad 產物已刪 |
| runtime：新 build 開 Codex CLI 分頁進 TUI | ⏳ 交使用者 | 未啟動 app。旗標在 codex 0.160 / 0.133 ConPTY 下可越過檢查已由 T0375 實測 |
| runtime：UAC 開啟 + 非提權 BAT 不帶旗標 | ⏳ 交使用者 | 本機 `EnableLUA=0` 無法驗；邏輯由 unit「非提權不變」+「Medium → false」覆蓋 |

### 偏離 / 設計說明

- **去重的 customArgs 來源**：renderer 的 4 個呼叫點自行附加 customArgs，IPC 簽章（`preload.ts` / `electron.d.ts`，不在 `affects_files`）未改；改由 main 的 IPC handler 讀 persisted `settings.json` 的 `agentCustomArgs[definitionId]` 傳給 registry。若使用者剛改 customArgs 而尚未寫檔，最差只是旗標重複（T0375：兩者並存仍可執行），不影響功能。
- **一次性提示的範圍**：「每個 renderer 執行一次」（module-level flag）；detached workspace 視窗是獨立 renderer，可能各提示一次。Tower / remote 經 `buildAgentPromptCommand()` 派發的分頁有注入旗標但不顯示 toast（不經 WorkspaceView 呼叫點）。均符合工單「每次 app 執行最多一次即可、不需持久化」的寬鬆要求。
- **提權判定只認 High（`S-1-16-12288`）**，依工單字面。以 SYSTEM（`S-1-16-16384`）執行 BAT 的情境不注入（極少見，未列範圍）。

### 殘餘風險 / 後續

- T0375 標註的「已有非提權 daemon」情境仍無法判定（需 UAC 開啟機器）。
- 使用者手打 `codex` 不會被注入，僅靠 toast 文字提示 `--no-daemon`。
- 建議塔台：使用者 runtime 驗收（提權機開 Codex CLI 分頁 + Tower 以 codex-cli 派發一張工單）；BUG-085 狀態由塔台更新（本單未改 BUG 檔）。

### 互動紀錄

無（`CT_INTERACTIVE=0`）。

### 變更檔案

- `electron/windows-elevation.ts`（新）
- `electron/agent-runtime/agent-registry.ts`
- `electron/main.ts`
- `src/components/WorkspaceView.tsx`
- `src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`
- `electron/__tests__/agent-registry-codex-elevation.test.ts`（新）
- `electron/__tests__/windows-elevation.test.ts`（新）
- `_ct-workorders/T0377-codex-cli-elevated-daemon-flag.md`

並行 T0376 的 dirty 檔（`.vscode/scripts/release.ps1`、`scripts/build-version.js`、`electron/__tests__/build-version.test.ts`、T0376 工單檔）未碰、未 commit。UAC / 登錄檔 / `~/.codex/config.toml` 未改動。

### Commit

見下方 commit 紀錄（`git commit --only`，不 push）。
