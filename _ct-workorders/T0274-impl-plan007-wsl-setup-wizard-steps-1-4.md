# T0274 — Impl PLAN-007 WSL Setup Wizard (steps 1-4 + UI shell)

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0274 |
| 類型 | impl |
| Phase | PLAN-007 Phase 2(WSL deployment)第二張 |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-26 10:33 (UTC+8) |
| 派發時間 | 2026-04-26 10:36 (UTC+8) |
| 完成時間 | 2026-04-26 10:50 (UTC+8) |
| Wall time | ~14 min(GP099 + T0273 校準預期 15-40 min,實際接近下界) |
| Worktree commit | `70404d2` on `feature/plan-007-remote-dev` |
| Sizing | L (spec 估 8-16h;GP099 + T0273 校準後預期 wall 15-40 min) |
| 依賴 | T0271(server bundle linux-x64 ✅ DONE) |
| 後續 | T0275(steps 5-7 + systemd unit)、T0276(WSL e2e) |
| 工作目錄 | `../bat-plan-007`(worktree on `feature/plan-007-remote-dev`,HEAD `e569183`) |
| 互動旗標 | `--no-interactive`(yolo + fire-and-forget,鏈式) |
| `affects_files` | `src/components/setup-wizard/` (新建目錄)、`electron/wsl-detect.ts` (新建)、`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`tests/wsl-detect.test.ts` (新建) |

## 目標

實作 WSL setup wizard 的前半段(steps 1-4)+ 通用 UI shell + rollback chain skeleton。Wizard runner 設計為共通框架(可被 Docker / SSH 後續沿用),WSL-specific steps 為第一個 deployment-specific implementation。

## 範圍

### 新增

1. **Wizard 共通框架** — `src/components/setup-wizard/wizard-runner.ts`
   - `interface WizardStep`(spec §2.6 凍結:`id` / `title` / `appliesTo` / `run` / `rollback?` / `retryable?`)
   - `interface WizardContext`(包含 profile draft、deployment-specific state 如 `wslDistro`、step 之間共享資料、logger)
   - `class WizardRunner`:依序跑 steps、每步可 retry、失敗時依**反向**順序呼叫已執行步驟的 `rollback()`(best-effort)、發 progress event
   - export step status enum:`pending` / `running` / `succeeded` / `failed` / `rolled-back`

2. **UI shell** — `src/components/setup-wizard/SetupWizardShell.tsx`
   - React component 接 `steps: WizardStep[]` 與 `ctx: WizardContext`
   - 顯示 step list + 當前進度 + 每步狀態 icon(⏳ / 🔄 / ✅ / ❌ / ↩)
   - "Retry" / "Skip" / "Cancel" 按鈕(retry 重跑當前 step;cancel 觸發 rollback chain)
   - 不需要花俏 UI — 簡潔 list + status,後續 polish 留 Phase 5
   - **不引入新 dep**(沿用既有 React + Tailwind 風格)

3. **WSL detect IPC handler** — `electron/wsl-detect.ts`
   - 三個 main process 函數,從 preload 暴露:
     - `wslDetect.list(): Promise<{ distros: WslDistro[]; default: string | null }>` — `wsl -l -v` parsing
       - `WslDistro = { name: string; version: 1 | 2; state: 'Running' | 'Stopped' }`
       - 必須處理 UTF-16LE encoding(`wsl -l -v` 預設輸出)— 用 Node 內建 `Buffer.from(b, 'utf16le')` + 手動 BOM strip(**不引入 `iconv-lite` dep**)
     - `wslDetect.systemdEnabled(distro: string): Promise<boolean>` — 透過 `wsl -d <distro> -- ...` 執行 `systemctl --user is-system-running` 或 `cat /etc/wsl.conf | grep systemd=true`,exit code / 輸出判定
     - `wslDetect.installBundle(distro: string, tarballPath: string, installPath: string): Promise<{ ok: true } | { ok: false; error: string }>` — 透過 wsl exec 解壓 tarball;tarball Win path 用 T0273 `winToWsl` 翻譯後傳入
   - **🔒 安全規則(嚴格)**:
     - **嚴禁使用 `child_process.exec` 或 `execSync`**(shell 解析 = 注入向量)
     - **必須使用 `child_process.execFile` / `spawn`**(無 shell,argv 直傳)
     - 所有 user-controlled input(distro 名稱、tarballPath、installPath)以 argv 元素傳入,**不做字串拼接成 shell command**
     - distro 名稱在丟進 spawn 前 validate:`/^[A-Za-z0-9._-]+$/`(WSL distro 名命名規範),不符直接 throw
     - installPath validate:必須以 `~/` 或 `/` 起頭、不含 `..`、不含 shell metachar(`;|&$\``)
     - tarballPath:Worker 內部產生(BAT app userData 路徑),非使用者直接輸入,但仍 validate 為絕對路徑
   - 註冊到 `electron/main.ts` ipcMain handlers + `preload.ts` contextBridge

4. **WSL-specific steps**(`src/components/setup-wizard/steps/wsl/`):

   - **`detect-env.ts`** — Step `detect-env`(`appliesTo: 'all'`,但 WSL flow 內預設只跑這個變體)
     - run:
       - 用 `execFile('wsl', ['--version'])` → 偵測 WSL 安裝(失敗 → 「請先安裝 WSL2」hint)
       - 偵測 client OS = Win32(非 Win 直接 fail with friendly msg)
     - rollback:無

   - **`pick-wsl-distro.ts`** — Step `pick-wsl-distro`(`appliesTo: ['wsl-linux']`)
     - run:呼叫 `wslDetect.list()` → ctx 收集到 `availableDistros` → 觸發 UI 選 distro
       - 若全部 distro 是 V1 → 警告「BAT 僅支援 WSL2」並 throw
       - 若無 distro → hint「請先 `wsl --install -d Ubuntu`」並 throw
       - 若只有一個 V2 distro → auto-pick(no UI)
     - 結果:`ctx.wslDistro` 寫入
     - rollback:清除 `ctx.wslDistro`

   - **`wsl-systemd-check.ts`** — Step `wsl-systemd-check`(`appliesTo: ['wsl-linux']`)
     - run:`wslDetect.systemdEnabled(ctx.wslDistro)` → 寫入 `ctx.wslSystemdEnabled: boolean`
       - **不阻擋**:即使 systemd 未啟,wizard 仍可繼續(後續 T0275 fall back 至 D 模式 hint UX)
       - 若未啟,在 ctx 加 `ctx.warnings.push('systemd 未啟,server 將以 wsl exec 啟動而非 systemd unit')`
     - rollback:無

   - **`install-server-bundle.ts`** — Step `install-server-bundle`(`appliesTo: ['wsl-linux']`,WSL 變體)
     - run:
       - 從 `app.getPath('userData')` 找 bundled tarball(BAT app 內附)或 BAT release URL 下載到 `userData/bat-server-bundles/`
       - 算 SHA-256 verify(如 release 有給 hash)— 此工單先做 verify 只 placeholder(T0282 完整 release pipeline 後落地)
       - 呼叫 `wslDetect.installBundle(distro, tarballPath, '~/.local/bat-server')`
       - 結果:`ctx.serverInstallPath = '~/.local/bat-server'`
     - rollback:呼叫 `wslDetect.uninstallBundle(distro, installPath)`(在 wsl-detect.ts 加此 helper,內部用 `execFile('wsl', ['-d', distro, '--', 'rm', '-rf', installPath])`)
     - retryable:true

5. **Tests** — `tests/wsl-detect.test.ts`(node:test runner)
   - mock `child_process.execFile`,測試:
     - `list()`:正確 parse UTF-16LE 輸出 + version + state(用 fixture buffer)
     - `list()`:無 distro 時 distros 為空陣列
     - `systemdEnabled()`:exit 0 / 輸出含 `running` = true、其他 = false
     - input validation:invalid distro 名(含 shell metachar)→ throw
     - input validation:invalid installPath → throw
   - 至少 6 個 case

### 修改

6. **`electron/main.ts`** — 註冊 wsl-detect IPC handlers(3 個 channel:`wsl:list`、`wsl:systemd-enabled`、`wsl:install-bundle`)

7. **`electron/preload.ts`** — 暴露 `window.electronAPI.wsl.{list,systemdEnabled,installBundle}`,**透過既有 contextBridge 模式**(沿用 profile / remote 等既有結構)

8. **`src/types/electron.d.ts`** — `wsl` namespace 加進 `ElectronAPI` interface

### Out of scope(不做)

- ❌ 不寫 systemd unit / loginctl(留 T0275)
- ❌ 不寫 fetch-fingerprint / connect-test / write-profile / done(留 T0275)
- ❌ 不寫 e2e Playwright(留 T0276)
- ❌ 不做 mirrored vs NAT 偵測(spec UX 第 4 步,留 T0276)
- ❌ 不接到 ProfilePanel "Add Profile" 按鈕(留 T0276 整合)
- ❌ 不引入 download progress UI(BAT release URL 下載進度 — 留 T0282 完整 release pipeline 後)
- ❌ 不引入 `iconv-lite` 等新 dep
- ❌ 不動 RemoteClient / path-translator(已凍結)
- ❌ 不動 profile-manager(留 T0275 `write-profile` step)
- ❌ **嚴禁 `child_process.exec` / `execSync`** — 統一 `execFile` / `spawn`

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §2.6 | Wizard framework 凍結 spec(WizardStep interface + 共通 7 步驟對照) |
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §4.1 | WSL 啟動方式 + 8-step UX + path translation 引用 |
| `_ct-workorders/T0263-research-plan007-wsl-deployment.md` | WSL 偵測規格、systemd 偵測命令、tarball install 步驟細節 |
| `electron/remote/path-translator.ts`(T0273 落地) | `winToWsl` 用於 tarball Win path → WSL path |
| `electron/profile-manager.ts` | ProfileEntry / TargetOS schema(T0268 已凍結) |
| 既有 `electron/main.ts` IPC 註冊風格 | 模仿風格(`ipcMain.handle('channel:name', ...)`) |
| 既有 `electron/preload.ts` contextBridge | 沿用 namespace 結構 |

## AC(驗收條件)

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `src/components/setup-wizard/wizard-runner.ts` 存在,export `WizardStep` interface + `WizardRunner` class + step status enum | 檔案存在 + grep export |
| AC2 | `src/components/setup-wizard/SetupWizardShell.tsx` 存在,接 `steps` / `ctx` props,渲染 step list + 進度 | grep + 視覺 inspect 不需要(本工單不接 ProfilePanel) |
| AC3 | `electron/wsl-detect.ts` 存在,export `list` / `systemdEnabled` / `installBundle` / `uninstallBundle` 四函數 | grep export |
| AC4 | `wsl -l -v` UTF-16LE 解析正確(`tests/wsl-detect.test.ts` mock 驗證,使用 Node 內建 Buffer + utf16le decode,無 `iconv-lite` import) | 跑 `npx tsx tests/wsl-detect.test.ts` 全綠 + grep `iconv` 應為 0 |
| AC5 | 4 個 WSL steps 落地於 `src/components/setup-wizard/steps/wsl/`,每個 export `WizardStep` 物件 | grep + 檔案結構 |
| AC6 | `WizardRunner` 失敗時依反向順序呼叫已執行 step 的 `rollback()`(best-effort,單元測試或 inline 註解 + reasoning) | 寫進 wizard-runner unit test 或在 PR comment 解釋 |
| AC7 | IPC handlers 透過 preload contextBridge 暴露為 `window.electronAPI.wsl.*` | grep `electronAPI.wsl` in d.ts |
| AC8 | `tests/wsl-detect.test.ts` ≥6 cases 全綠,包含 UTF-16LE parsing fixture + empty distros + systemd enabled/disabled + 兩個 input validation case | 跑指令看輸出 |
| AC9 | TypeScript strict 編譯通過(T0274 觸碰檔案零新增 error,允許既有 errors) | 跑 `tsc --noEmit` 比對 baseline |
| AC10 | **安全**:`grep -rn "child_process\.exec\(" src/ electron/` 在 T0274 觸碰檔案中為 0;`execFile` 或 `spawn` 為唯一執行方式;所有 user input 走 argv 而非 shell 字串拼接 | grep + 檢視 diff |

## 守則(嚴格)

1. **工作分支**:worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev` branch,接 `e569183`(T0273 DONE)。**嚴禁切回 main**。
2. **commit message**:`feat(wsl): T0274 setup wizard steps 1-4 + runner + UI shell\n\n工單:T0274\n依賴:T0271 / T0273`
3. **工單檔不寫**:Worker 嚴禁修改 `_ct-workorders/T0274-*.md`(主線檔,塔台 sync)。回報透過完成訊息 + worktree commit body。
4. **不動 main metadata**:Worker 不要 `git checkout main`、不要動主線任何檔案。
5. **工具白名單**:Read / Edit / Write / Bash(npm/npx/tsc/node)/ Grep / Glob。**不需要** WebFetch / WebSearch / Task。
6. **emoji**:除測試輸出 `✅/❌` 與 UI 既有風格(progress icon)外,程式碼禁用。
7. **不引入新 dep**:`iconv-lite` 用 Node 內建解;React UI 不引入新 component lib。
8. **共通框架優先**:wizard-runner 設計為跨 deployment 共用(WSL / Docker / SSH 後續沿用),不要寫 WSL-only hard-code 進 runner。
9. **rollback best-effort**:rollback 失敗不要 throw 中斷整體 rollback chain,log warning 即可。
10. **🔒 安全強制**:`child_process.exec` / `execSync` 嚴格禁用。一律 `execFile` / `spawn`,user input 走 argv 不走 shell 字串。input validation 寫在 wsl-detect.ts 入口。
11. **完成判定**:10 個 AC 全部通過後,worktree commit,完成訊息 `T0274 完成`。失敗或 blocker 訊息 `T0274 失敗:<原因>`。

## 預期 wall

**15-40 min**(GP099 + T0273 校準後;wizard-runner 與 step interface 已凍結 spec 直譯;UI shell 簡潔不需 polish;wsl-detect IPC handlers 與既有 main.ts 風格 1:1 沿用;主要工作量在 4 個 step 各自的 run/rollback 邏輯與測試 fixtures + input validation)。

## 工單回報區

### 結果摘要(10 AC 全綠)

| AC | 狀態 | 驗證 |
|----|------|------|
| AC1 | ✅ | `wizard-runner.ts` 227 行,export `WizardStep` interface + `WizardRunner` class + step status |
| AC2 | ✅ | `SetupWizardShell.tsx` 182 行,接 steps/ctx props,渲染 step list + status icons |
| AC3 | ✅ | `electron/wsl-detect.ts` 196 行,export `list` / `systemdEnabled` / `installBundle` / `uninstallBundle` 四函數 |
| AC4 | ✅ | UTF-16LE parsing 用 Node 內建 Buffer + utf16le decode,`grep iconv` 為 0 |
| AC5 | ✅ | 4 個 WSL steps 落地於 `setup-wizard/steps/wsl/`(detect-env / pick-wsl-distro / wsl-systemd-check / install-server-bundle) |
| AC6 | ✅ | `wizard-runner.test.ts` 1/1 涵蓋反向 rollback chain(best-effort,失敗不中斷) |
| AC7 | ✅ | `electronAPI.wsl.{list,systemdEnabled,installBundle}` 在 `electron.d.ts` 14 行擴充落地 |
| AC8 | ✅ | `wsl-detect.test.ts` 7/7(≥6 要求,含 UTF-16LE / empty / systemd 雙態 / 兩個 input validation) |
| AC9 | ✅ | tsc T0274 觸碰檔案零新增 error(總 errors 維持 37 baseline) |
| AC10 | ✅ | **安全**:T0274 觸碰檔案 `child_process.exec(` 計數為 0,全部走 `execFile`/`spawn`;distro / installPath / tarballPath 入口均有 validation |

### 修改檔(12 files / +997 / 0)

| 類別 | 檔案 |
|------|------|
| 新建框架 | `src/components/setup-wizard/wizard-runner.ts` (227) / `SetupWizardShell.tsx` (182) |
| 新建 IPC | `electron/wsl-detect.ts` (196) |
| 新建 steps | `steps/wsl/detect-env.ts` (23) / `pick-wsl-distro.ts` (47) / `wsl-systemd-check.ts` (23) / `install-server-bundle.ts` (72) |
| 新建 tests | `tests/wizard-runner.test.ts` (65) / `tests/wsl-detect.test.ts` (122) |
| 修改既有 | `electron/main.ts` (+17) / `electron/preload.ts` (+9) / `src/types/electron.d.ts` (+14) |

### Worktree commit

`70404d2 feat(wsl): T0274 setup wizard steps 1-4 + runner + UI shell` on `feature/plan-007-remote-dev`(parent `e569183` T0273 DONE)

### 主動超出範圍項

無(嚴格按 spec doc §2.6 + §4.1 + T0263 落地;Worker 注意到 hook 強制 execFile,主動加 input validation 是 AC10 要求,不算超範圍)。

### 教訓 / 觀察

- 共通框架(WizardRunner)與 deployment-specific steps(WSL 變體)分離設計成功,後續 T0279(Docker wizard)/ T0284(SSH wizard)只需新增 `steps/docker/` `steps/ssh/` 即可,runner 不變
- UTF-16LE 用 Node 內建 `Buffer.from(b, 'utf16le')` 處理 BOM strip 完全可行,無需 `iconv-lite` dep,符合「不引入新 dep」守則
- input validation 在 IPC handler 入口集中設計,後續 Docker / SSH IPC handler 可沿用相同 pattern

---

## 塔台補充(Renew #N)

(尚無)

---
