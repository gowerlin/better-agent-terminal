# T0276 — Impl PLAN-007 WSL E2E + 3 User Journeys + ProfilePanel Integration

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0276 |
| 類型 | impl(Phase 2 capstone) |
| Phase | PLAN-007 Phase 2(WSL deployment)第四張(收尾) |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 11:14 (UTC+8) |
| 派發時間 | (待派發,鏈式自動) |
| 完成時間 | - |
| Sizing | M (spec 估 4-8h;校準後預期 wall 15-35 min) |
| 依賴 | T0275(systemd + 後半 wizard ✅)、T0274(wizard runner + 前半 wizard ✅) |
| 後續 | Phase 2 完整收尾 → 進入 Phase 3(Docker) |
| 工作目錄 | `../bat-plan-007`(worktree on `feature/plan-007-remote-dev`,HEAD `5d75d4b`) |
| 互動旗標 | `--no-interactive`(yolo,鏈式末張) |
| `affects_files` | `tests/wsl-wizard-e2e.test.ts` (新建)、`src/components/setup-wizard/SetupWizardShell.tsx`、`src/components/setup-wizard/wsl-flow.ts` (新建)、`src/components/ProfilePanel.tsx`、`docs/wsl-deployment.md` (新建)、`tests/wsl-flow-journeys.test.ts` (新建)、`src/components/setup-wizard/steps/wsl/install-server-bundle.ts`(可能 ext) |

## 目標

PLAN-007 Phase 2 收尾:把 T0273-T0275 的零件接成可使用的端到端流程,實作 3 個 user journey 的 mock-based e2e 測試,接 ProfilePanel "Add WSL Profile" 入口,寫使用者文件。

**重要前提**:此工單不要求 real WSL 環境跑 e2e(CI 沒有 WSL,且 BAT 開發機不一定每次都有 WSL2 + systemd)。所有 e2e 用 **mocked IPC + mocked HTTPS server** 跑通邏輯路徑;real WSL 驗證留 release pre-flight checklist(由人類執行)。

## 範圍

### 新增

1. **`src/components/setup-wizard/wsl-flow.ts`** — WSL flow orchestration helper
   - export `buildWslWizardSteps(): WizardStep[]`,組裝 9 個 step(detect-env / pick-wsl-distro / wsl-systemd-check / install-server-bundle / write-systemd-unit / fetch-fingerprint / connect-test / write-profile / done)為 ordered array
   - export `createWslWizardContext(initial: { profileName: string }): WizardContext`,初始化 ctx with sensible defaults(`port: 9876` / `warnings: []` / `serverInstallPath: '~/.local/bat-server'`)
   - 純函數模組,無 IPC 直呼叫(那是 step 內部做的);可單測

2. **`tests/wsl-wizard-e2e.test.ts`** — Mock-based e2e(node:test runner)
   - 用 `tests/__mocks__/electron-api.ts`(若不存在則新建)mock `window.electronAPI.{wsl, wslSystemd, profile, remote}` 的關鍵方法
   - 起一個 mock HTTPS server(Node 內建 `node:https`,自簽 cert via `selfsigned`,**注意 selfsigned 已是 dependency from T0182**;若未在 worktree 則用最簡單的 `crypto` self-signed)監聽 port 9876
   - 跑完整 9-step happy path,assert ctx 累積正確、所有 step succeed、ProfileEntry 被建立
   - 至少 5 個 fixture/case(setup + journey 1-3 + 1 個 rollback case)
   - **不需 React DOM 渲染**,只測 wizard-runner + step + mocked IPC

3. **`tests/wsl-flow-journeys.test.ts`** — 3 user journey 各自一個 case
   - **Journey 1: Happy path(mirrored mode)** — Win 11 23H2+ 帶 WSL2 + Ubuntu + systemd 啟用 + mirrored network → 9 step 全 succeed → connect-test 拿到完整 metadata → profile 寫入
   - **Journey 2: NAT mode 降級** — 同 happy path 但網路模式偵測為 NAT(目前 spec 第 4 步 mirrored vs NAT 偵測由本工單實作,簡化為 ctx 注入 `networkMode: 'nat'`)→ wizard 在 connect-test 前加 warning「請切 mirrored 或手動填 WSL IP」,但仍可繼續(`localhost:port` 在 mirrored 永遠通,NAT 環境用戶須手動處理)
   - **Journey 3: 跨 distro 切換** — 第一次 wizard 跑完建 profile A(Ubuntu),使用者再跑一次選 Debian → 建 profile B → 兩個 profile 並存於 profile-manager
   - 每個 case 寫 fixture + assertion,跑完 wizard + 驗證最終狀態

4. **`docs/wsl-deployment.md`** — 使用者文件(英文 + 繁中對照可選,預設英文為主)
   - 章節:
     - **Prerequisites**:Windows 11 22H2+(mirrored mode 推薦 23H2+)、WSL2 + Ubuntu/Debian 等 distro、systemd 啟用(`/etc/wsl.conf` 設 `[boot]\nsystemd=true`)
     - **Installation**:BAT app → Profiles → "Add Profile" → Type: WSL → wizard 9 step 流程說明(每個 step 一段)
     - **Mirrored mode setup**:`%UserProfile%\.wslconfig` 加 `[wsl2]\nnetworkingMode=mirrored`,重開 WSL
     - **Troubleshooting**:
       - WSL1 警告:「BAT 僅支援 WSL2,請執行 `wsl --set-version <distro> 2`」
       - systemd 未啟:fall back 到 wsl exec 啟動,但連線會在 BAT 退出時斷
       - mirrored 不可用:NAT mode 自動回退,使用者須在 `%UserProfile%\.wslconfig` 切回或手動填 WSL IP
       - Permission denied 在 install path:檢查 `~/.local` 權限
     - **Uninstallation**:wizard 提供的 rollback chain 可從 ProfilePanel 觸發(刪除 profile + remove systemd unit + rm install path)
   - 100-300 行範圍

5. **`src/components/setup-wizard/steps/wsl/install-server-bundle.ts`**(extend)— 加 mirrored vs NAT mode 偵測
   - run 內加:`detectNetworkMode(distro)` helper(內聯或抽到 wsl-detect)— 在 distro 內 cat `/proc/net/route` 或 `ip addr`,看 default gateway 是否與 Win host 同 subnet(mirrored 為 yes,NAT 為 no)
   - 寫 `ctx.networkMode: 'mirrored' | 'nat' | 'unknown'`
   - **注意**:此偵測 best-effort,失敗時 `unknown`,不阻擋

### 修改

6. **`src/components/setup-wizard/SetupWizardShell.tsx`** — 補 wizard launch hook
   - export `useWslWizardController()` React hook(或類似 controller pattern)— 接收 `onComplete: (profileId: string) => void`,內部用 `wsl-flow.ts` 組 steps + ctx
   - 加上「WSL1 偵測」與「systemd 未啟」的 user-facing warning UI(從 ctx.warnings 讀,顯示在 step list 上方)

7. **`src/components/ProfilePanel.tsx`** — 加 "Add WSL Profile" 按鈕
   - 既有 "Add Profile" 按鈕已存在(讀 ProfilePanel 既有結構);新增子選單或直接擴 dropdown 含 type:`Local` / `Remote (Manual)` / `WSL` 三選項
   - 選 WSL → 開啟 SetupWizardShell modal(或 inline panel)→ 跑 wizard → 完成後刷新 profile list
   - **不要重寫 ProfilePanel**(L2400+ 大檔,既有 baseline TS errors 在此檔內)— 只新增最小入口
   - **避免觸發既有 TS errors**:不動 L576 的 `parseConnectionUrl` 區段;新增 code 集中在獨立函數或新 import block

8. **`tests/wizard-runner.test.ts`**(extend)— 加 1 個 case 跑 `buildWslWizardSteps()` 全 9 step + happy path,確保 `wsl-flow.ts` 與 wizard-runner 整合無漏

### Out of scope(不做)

- ❌ 不跑 real WSL e2e(留 release pre-flight 人工驗收,docs 寫驗收 checklist)
- ❌ 不重寫 ProfilePanel.tsx 既有結構(只加最小 entry)
- ❌ 不修 既有 baseline TS errors(L576 `parseConnectionUrl` 等,非本工單範圍)
- ❌ 不引入 Playwright(mock-based e2e 用 node:test 即可;Playwright 留 Phase 5 整合測試)
- ❌ 不接 PLAN-007 Phase 3 Docker / Phase 4 SSH 入口(分別由 T0279 / T0284 處理)
- ❌ 不寫 i18n 文件翻譯(英文版優先,繁中翻譯標 future)
- ❌ 不引入新 dep(Mock 用 node:test built-in `mock`、HTTPS 用 `node:https`)
- ❌ **嚴禁** `child_process` 走 shell 的 API — 統一 `execFile`/`spawn`(此工單 IO 少,主要在既有 wsl-detect / wsl-systemd 已 cover)

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §4.1 | WSL 啟動方式 + 8-step UX + 3 user journey + path translation |
| `_ct-workorders/T0263-research-plan007-wsl-deployment.md` §1.1 | Happy path 60 秒 user story(L538) |
| `_ct-workorders/T0263-research-plan007-wsl-deployment.md` §3 | path translation + edge cases |
| `electron/wsl-detect.ts`(T0274) | mirrored 偵測 helper 可加到此檔 |
| `electron/wsl-systemd.ts`(T0275) | systemd unit lifecycle 已落地 |
| `src/components/setup-wizard/`(T0274/T0275) | wizard runner + UI shell + 9 step 已落地 |
| `src/components/ProfilePanel.tsx`(既有) | 找 "Add Profile" 入口位置 |
| `electron/profile-manager.ts` | profile-manager.list/get/delete IPC 已存在 |

## AC(驗收條件)

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `src/components/setup-wizard/wsl-flow.ts` 存在,export `buildWslWizardSteps` + `createWslWizardContext` | grep export |
| AC2 | `tests/wsl-wizard-e2e.test.ts` 存在,mock-based e2e 跑 9-step happy path,≥5 cases 全綠 | 跑指令看輸出 |
| AC3 | `tests/wsl-flow-journeys.test.ts` 存在,3 個 user journey 各 1 case 全綠(happy / NAT / 跨 distro) | 跑指令看輸出 |
| AC4 | `docs/wsl-deployment.md` 存在,涵蓋 Prerequisites / Installation / Mirrored mode / Troubleshooting / Uninstallation 五大章節,100-300 行 | 檔案存在 + wc -l + grep 章節 heading |
| AC5 | mirrored vs NAT 偵測加進 `install-server-bundle.ts`(或 wsl-detect 新 helper),寫 `ctx.networkMode` | grep `networkMode` |
| AC6 | `SetupWizardShell.tsx` 有 wizard launch hook(`useWslWizardController` 或類似)+ ctx.warnings UI 顯示 | grep + 檢視 source |
| AC7 | `ProfilePanel.tsx` 加 "WSL" 入口(dropdown 或子選單),點擊開啟 wizard modal/panel;**既有 baseline TS errors 數量未增加** | grep + tsc 比對 baseline |
| AC8 | `tests/wizard-runner.test.ts` 加 1 case 跑 `buildWslWizardSteps()` 全 9 step happy path | grep + 跑測試 |
| AC9 | TypeScript strict 編譯通過(T0276 觸碰檔案零新增 error,允許既有 37 errors) | `tsc --noEmit` 比對 baseline |
| AC10 | docs/wsl-deployment.md 包含「real WSL pre-flight checklist」(release 人工驗收清單)— 至少 5 條檢查項 | grep "checklist" + count items |

## 守則(嚴格)

1. **工作分支**:worktree `../bat-plan-007`,接 `5d75d4b`(T0275 DONE)。**嚴禁切回 main**。
2. **commit message**:`feat(wsl): T0276 e2e + 3 user journeys + ProfilePanel integration + docs\n\n工單:T0276\n依賴:T0274 / T0275`
3. **工單檔不寫**:Worker 嚴禁修改 `_ct-workorders/T0276-*.md`
4. **不動 main metadata**:不要 `git checkout main`、不要動主線任何檔案
5. **工具白名單**:Read / Edit / Write / Bash / Grep / Glob
6. **emoji**:除測試輸出 `✅/❌` 與既有 UI icon 外,程式碼禁用
7. **不引入新 dep**:Mock 用 node:test built-in;HTTPS 用 `node:https`
8. **ProfilePanel 最小擾動**:既有 baseline TS errors 不修(留給未來工單),只加 minimum WSL entry,**不重構**
9. **🔒 安全強制**:沿用既有 `execFile`/`spawn` 規則;新增的 mirrored 偵測 helper 也走 `execFile`,validation 沿用 `wsl-validate.ts`
10. **docs 風格**:英文為主,技術詞精準,範例命令完整可複製;Troubleshooting 章節對應 ctx.warnings 各情境
11. **完成判定**:10 個 AC 全部通過後 commit,訊息 `T0276 完成`。失敗訊息 `T0276 失敗:<原因>`。完成後 PLAN-007 Phase 2 capstone 達成,Phase 2 全部 4 張(T0273-T0276)收尾

## 預期 wall

**15-35 min**(校準後;e2e mock infra 是新工作但 wizard runner / steps / IPC 全已備,主要工作量在 mock 設計 + 3 journey fixture + docs 撰寫;ProfilePanel 入口最小擾動;mirrored 偵測 helper 簡單)。

## Phase 2 完成里程碑(Worker 完成後塔台會慶祝)

T0273 + T0274 + T0275 + T0276 = PLAN-007 Phase 2 完整收尾。下一階段為 Phase 3(Docker deployment,T0277-T0280)。

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
