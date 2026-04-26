# T0275 — Impl PLAN-007 WSL Setup Wizard (steps 5-7 + systemd unit)

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0275 |
| 類型 | impl |
| Phase | PLAN-007 Phase 2(WSL deployment)第三張 |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 10:51 (UTC+8) |
| 派發時間 | (待派發,鏈式自動) |
| 完成時間 | - |
| Sizing | M (spec 估 4-8h;校準後預期 wall 12-30 min) |
| 依賴 | T0274(wizard runner + steps 1-4 ✅)、T0272(createHeadlessServer factory ✅) |
| 後續 | T0276(WSL e2e + 3 user journeys) |
| 工作目錄 | `../bat-plan-007`(worktree on `feature/plan-007-remote-dev`,HEAD `70404d2`) |
| 互動旗標 | `--no-interactive`(yolo,鏈式) |
| `affects_files` | `electron/wsl-systemd.ts` (新建)、`electron/wsl-validate.ts` (新建)、`src/components/setup-wizard/steps/wsl/` (新增 5 steps)、`electron/main.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`tests/wsl-systemd.test.ts` (新建) |

## 目標

完成 WSL setup wizard 的後半段(steps 5-7)+ user-level systemd unit 寫入 + linger 啟用 + fingerprint TOFU + connect-test。Wizard 至此可端到端跑完(detect-env → done),產出可連線的 remote profile。

## 範圍

### 新增

1. **`electron/wsl-systemd.ts`** — main process IPC handler,export 4 個函數 + 1 個純函數 helper:
   - `wslSystemd.writeUnit(distro, unit)` — 在 WSL distro 內 `~/.config/systemd/user/bat-server.service` 寫入 unit content;透過 `wsl exec` + `tee` + stdin pipe 寫入(不走字串拼接 shell command)
   - `wslSystemd.enableLinger(distro)` — 在 distro 內呼叫 `loginctl enable-linger`;失敗(權限/systemd 未啟)回 `{ ok: false, error }` 不 throw
   - `wslSystemd.startService(distro, serviceName)` — `systemctl --user daemon-reload` + `enable --now` + poll `status` 至 active(timeout 10s)
   - `wslSystemd.removeUnit(distro, serviceName)` — rollback 用,stop + disable + rm unit file
   - `renderSystemdUnit(opts: { execStart, description?, environment? }): string` — 純函數,產生 INI 格式 unit 內容;特殊字元 escape;單測友善

   - **🔒 安全規則(嚴格)**:
     - **嚴禁** `child_process` 中會走 shell 的 API(亦即帶字串拼接 + shell 解析的執行函數)
     - **必須** 使用 `execFile` 或 `spawn`,argv 直傳,無 shell
     - 所有 user-controlled input(distro / serviceName / unit fields)走 argv 元素,不做字串拼接成 shell command
     - validation 沿用下方第 2 點的 `wsl-validate.ts`

2. **`electron/wsl-validate.ts`** — 抽出 T0274 既有 validation logic 為共用模組
   - export `assertValidDistro(distro: string): void`(`/^[A-Za-z0-9._-]+$/`)
   - export `assertValidUnixPath(path: string, allowTilde?: boolean): void`(必須 `~/` 或 `/` 起頭、不含 `..`、不含 shell metachar `;|&$\``)
   - export `assertValidServiceName(name: string): void`(`/^[A-Za-z0-9._-]+\.service$/`)
   - **T0274 既有 wsl-detect.ts 內聯 validation 改為 import 此檔**(refactor pass);既有 wsl-detect.test.ts 7 個 case 仍應全綠

3. **5 個新 wizard steps**(`src/components/setup-wizard/steps/wsl/`):

   - **`write-systemd-unit.ts`** — Step `write-systemd-unit`(`appliesTo: ['wsl-linux']`)
     - run:
       - 從 ctx 讀 `serverInstallPath` / `wslDistro` / `serverPort`(T0274 已寫;無 port 時 default 9876)
       - 構造 unit:`execStart = '<serverInstallPath>/bin/bat-server'`,加 `Environment=BAT_PORT=<port>` `BAT_DATA_DIR=$HOME/.local/share/bat-server` `Restart=on-failure`
       - 呼 `wslSystemd.writeUnit` → `enableLinger`(失敗只 warn)→ `startService`
       - 結果寫 `ctx.systemdServiceActive: boolean`
       - **若 `ctx.wslSystemdEnabled === false`(T0274 step 3 結果)**:此 step 跳過,寫 `ctx.systemdServiceActive = false` + `ctx.fallbackStartHint = 'wsl exec'`
     - rollback:`wslSystemd.removeUnit(distro, 'bat-server.service')`
     - retryable:true

   - **`fetch-fingerprint.ts`** — Step `fetch-fingerprint`(`appliesTo: 'all'`)
     - run:
       - 用 Node 內建 `node:https` GET `https://localhost:<port>/fingerprint`,**TOFU 模式**(首次 enrollment,接受任意自簽 cert,`rejectUnauthorized: false`)
       - 取得 SHA-256 fingerprint → 寫 `ctx.fingerprint: string`
       - 若 `ctx.systemdServiceActive === false`,此 step skip,寫 `ctx.fingerprint = null`
     - rollback:無
     - retryable:true(connection refused 重試上限 5 次,間隔 1s)

   - **`connect-test.ts`** — Step `connect-test`(`appliesTo: 'all'`)
     - run:
       - 構造臨時 RemoteClient(import 既有 `electron/remote/remote-client.ts`)
       - 用 ctx 的 `port` / `token` / `fingerprint`(此時應 pin)connect → 等 `auth-result` event
       - 取得 metadata(`serverPlatform` / `serverArch` / `nodeVersion` / `bundleVersion` 等)寫 `ctx.serverMetadata`
       - 立即 disconnect(僅驗證)
       - 若 `ctx.systemdServiceActive === false` 或 `ctx.fingerprint == null`,skip 寫 `ctx.connectTestSkipped = true`
     - rollback:無
     - retryable:true(timeout 5s,3 retry)

   - **`write-profile.ts`** — Step `write-profile`(`appliesTo: 'all'`)
     - run:
       - 構造 ProfileEntry:`{ id, name, type: 'remote', targetOS: 'wsl-linux', wslDistro, host: 'localhost', port, token, fingerprint, ... }`
       - 呼 profile-manager.create(既有 IPC channel)
       - 寫 `ctx.createdProfileId`
     - rollback:profile-manager.delete(createdProfileId)
     - retryable:false

   - **`done.ts`** — Step `done`(`appliesTo: 'all'`)
     - run:純 UI step,顯示 `ctx.serverMetadata` 摘要 + `ctx.warnings` 清單(systemd 未啟等);無 IO
     - rollback:無

4. **Tests** — `tests/wsl-systemd.test.ts`(node:test runner)
   - mock `child_process.execFile`,測試:
     - `renderSystemdUnit` 純函數:基本 unit 格式、environment 多筆、special char escape(空格 / 引號 / 換行)
     - `writeUnit()`:正確構造 wsl exec argv、tee stdin pipe 模擬
     - `enableLinger()`:exit 0 → ok、exit ≠ 0 → ok=false 帶 error
     - `startService()`:daemon-reload + enable --now + status poll loop
     - input validation:invalid distro / serviceName / unit path → throw
   - 至少 8 個 case

### 修改

5. **`electron/main.ts`** — 註冊 4 個新 IPC channels(`wsl-systemd:write-unit` / `:enable-linger` / `:start-service` / `:remove-unit`)

6. **`electron/preload.ts`** — 暴露 `window.electronAPI.wslSystemd.{writeUnit, enableLinger, startService, removeUnit}`

7. **`src/types/electron.d.ts`** — `wslSystemd` namespace 加進 `ElectronAPI`

8. **`electron/wsl-detect.ts`**(refactor)— 內聯 validation 改 import `wsl-validate.ts`(行為不變,T0274 既有 wsl-detect.test.ts 7 case 仍綠)

### Out of scope(不做)

- ❌ 不寫 e2e Playwright(留 T0276)
- ❌ 不接到 ProfilePanel "Add Profile" 按鈕(留 T0276 整合)
- ❌ 不做 mirrored vs NAT 偵測(留 T0276)
- ❌ 不做 WSL1 警告流程(留 T0276)
- ❌ 不做 download progress UI
- ❌ 不動 RemoteClient / path-translator / profile-manager schema(已凍結)
- ❌ **嚴禁** `child_process` 走 shell 的 API — 統一 `execFile` / `spawn`
- ❌ 不引入新 dep(systemd unit 純文字,不需 ini lib)

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §2.6 | Wizard framework 凍結 spec |
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §4.1 | WSL 啟動方式(A: systemd unit + D: hint UX 兜底) |
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §3 | createHeadlessServer / token persistence / cert renewal |
| `electron/remote/headless-entry.ts`(T0272 落地) | bat-server CLI 啟動方式 |
| `electron/remote/certificate.ts`(T0272 ext) | TOFU fingerprint 來源 |
| `electron/remote/remote-client.ts` | connect-test 使用既有 client |
| `electron/profile-manager.ts` | profile-manager.create IPC |
| `electron/wsl-detect.ts`(T0274 落地) | execFile pattern + validation 沿用 |
| `electron/main.ts`(T0274 修改) | IPC 註冊風格沿用 |

## AC(驗收條件)

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `electron/wsl-systemd.ts` 存在,export 4 個函數 + `renderSystemdUnit` 純函數 | grep export |
| AC2 | `electron/wsl-validate.ts` 存在,export 3 個 validation helpers;wsl-detect.ts 改用 import(行為不變,既有 wsl-detect.test.ts 7/7 仍綠) | grep + 跑 wsl-detect.test.ts |
| AC3 | 5 個新 wizard steps(write-systemd-unit / fetch-fingerprint / connect-test / write-profile / done)落地於 `setup-wizard/steps/wsl/` | grep + 檔案結構 |
| AC4 | systemd unit 內容由 `renderSystemdUnit` 純函數產生,測試覆蓋 ≥3 case | wsl-systemd.test.ts |
| AC5 | TOFU fetch-fingerprint step 接受自簽 cert(註解或 `rejectUnauthorized: false` 顯式標註首次 enrollment 用) | grep + 檢視 source |
| AC6 | `ctx.systemdServiceActive === false` 時,後續 fetch-fingerprint / connect-test 正確 skip 而非失敗 | step 內邏輯 + test case |
| AC7 | `tests/wsl-systemd.test.ts` ≥8 cases 全綠 | 跑指令看輸出 |
| AC8 | TypeScript strict 編譯通過(T0275 觸碰檔案零新增 error,允許既有 37 errors) | 跑 `tsc --noEmit` 比對 baseline |
| AC9 | **安全**:`grep -rn "child_process\.exec(" electron/wsl-systemd.ts` 為 0(只允 execFile / spawn);input validation 沿用 `wsl-validate.ts` | grep + 檢視 diff |
| AC10 | wizard-runner 整合測試:跑完 9 個 step happy path(T0274 4 + T0275 5),所有 step succeed,ctx 累積完整 | wizard-runner.test.ts 加 case |

## 守則(嚴格)

1. **工作分支**:worktree `../bat-plan-007`,接 `70404d2`(T0274 DONE)。**嚴禁切回 main**。
2. **commit message**:`feat(wsl): T0275 wizard steps 5-7 + systemd unit + linger\n\n工單:T0275\n依賴:T0272 / T0274`
3. **工單檔不寫**:Worker 嚴禁修改 `_ct-workorders/T0275-*.md`
4. **不動 main metadata**:不要 `git checkout main`、不要動主線任何檔案
5. **工具白名單**:Read / Edit / Write / Bash / Grep / Glob
6. **emoji**:除測試輸出 `✅/❌` 與既有 UI icon 外,程式碼禁用
7. **不引入新 dep**:systemd unit 純文字;TOFU HTTPS 用 Node 內建 `node:https`(`rejectUnauthorized: false` 僅首次 enrollment)
8. **共通框架優先**:wizard-runner 不動;新 step 沿用 T0274 框架
9. **🔒 安全強制**:`child_process` 走 shell 的 API 嚴格禁用;`execFile` / `spawn` only;validation 集中於 `wsl-validate.ts`
10. **systemd unit 格式**:`Restart=on-failure` / `RestartSec=2s` / `Type=simple`;`[Unit] / [Service] / [Install]` 三 section 完整;`renderSystemdUnit` 純函數無副作用
11. **完成判定**:10 個 AC 全部通過後 commit,訊息 `T0275 完成`。失敗訊息 `T0275 失敗:<原因>`

## 預期 wall

**12-30 min**(校準後;wsl-systemd 與 wsl-detect 結構同構;5 個新 step 沿用 T0274 step pattern;wsl-validate refactor 工程量低;主要工作量在 systemd unit 純函數設計 + skip-if-no-systemd 分支)。

## 工單回報區

> Worker 收尾後,在此貼:
> 1. 結果摘要(AC 逐項勾選)
> 2. worktree commit hash
> 3. 主動超出範圍項(若有)
> 4. 教訓 / 觀察(可空)

(Worker 填)

---

## 塔台補充(Renew #N)

(尚無)

---
