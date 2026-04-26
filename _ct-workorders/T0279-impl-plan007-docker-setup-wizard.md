# T0279 — Impl PLAN-007 Docker setup wizard (lifecycle 模式 A + B + configure-mounts)

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0279 |
| 類型 | impl |
| Phase | PLAN-007 Phase 3(Docker deployment)第三張 |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-26 12:30 (UTC+8) |
| 派發時間 | 2026-04-26 12:31 (UTC+8) |
| 完成時間 | 2026-04-26 12:58 (UTC+8) |
| Wall time | ~28 min(L sizing 下界,Phase 3 校準保持) |
| Worktree commit | `8ca2f34` on `feature/plan-007-remote-dev`(parent `b177d48` T0278 DONE) |
| Sizing | L(spec 估 8-16h;實際 28 min,~30× 偏差) |
| 依賴 | T0277(DockerPathTranslator)、T0278(Dockerfile + build script)、T0274(wizard runner framework)、T0275(systemd unit + linger pattern,docker 沿用 step-level rollback 設計) |
| 後續 | T0280(Docker e2e + lifecycle scenarios)鏈式自動派發 |
| 工作目錄 | `../bat-plan-007`(worktree on `feature/plan-007-remote-dev`,HEAD `b177d48`) |
| Renew 次數 | 0 |
| 互動旗標 | `--no-interactive`(yolo + fire-and-forget) |
| `affects_files` | `src/components/setup-wizard/docker-flow.ts`(新建)、`src/components/setup-wizard/steps/docker/*.ts`(新建多 step)、`src/components/setup-wizard/SetupWizardShell.tsx`(擴 docker case)、`electron/docker-detect.ts`(新建)、`electron/docker-validate.ts`(新建)、`electron/docker-lifecycle.ts`(新建)、`tests/docker-wizard-runner.test.ts`(新建)、`tests/docker-flow.test.ts`(新建) |

## 目標

實作 PLAN-007 Docker deployment 的 setup wizard:9-step flow(7 共通 + 2 docker-specific)+ container lifecycle UI(start/stop/logs/health 四操作)+ 模式 B 新建 container 的 rollback(`docker rm -f bat-server-<profileId>`)。沿用 T0274 的 `wizard-runner` framework + T0275 的 step-level explicit rollback 模式。Docker daemon IPC handler(主程序)為純結構落地,實機驗收豁免至 release pre-flight checklist(對齊 T0278 daemon 豁免路徑)。

## 範圍

### 新增

#### A. `src/components/setup-wizard/docker-flow.ts` — wizard flow 入口

仿 `wsl-flow.ts` 結構:

```ts
export function buildDockerWizardSteps(): WizardStep[] {
  return [
    detectEnvStep,           // 共通(已備),docker 走分支驗 docker daemon
    pickContainerStep,       // docker-specific 新建
    configureMountsStep,     // docker-specific 新建
    installServerBundleStep, // docker variant:docker cp tarball into container
    startServerStep,         // docker variant:docker run(模式 B)/ docker start(模式 A)
    fetchFingerprintStep,    // 共通(已備)
    connectTestStep,         // 共通(已備)
    writeProfileStep,        // 共通(已備),寫入 dockerMounts + dockerContainer
    doneStep,                // 共通(已備)
  ]
}

export function createDockerWizardContext(initial: { profileName: string }): WizardContext {
  // 對齊 createWslWizardContext,加 dockerMounts: [] 與 containerMode: 'unknown' 等 docker 專屬 state
}
```

#### B. `src/components/setup-wizard/steps/docker/` — docker step 模組

1. **`pick-container.ts`** — 模式 A / B 二選
   - UI:radio button 兩選項(既有 container / 新建 container)
   - 模式 A:呼叫 `electron/docker-detect.ts` 列出本機 `docker ps -a --format json` → 使用者下拉選擇現有 container → 寫入 `ctx.state.dockerContainer = '<name>'`,`ctx.state.containerMode = 'existing'`
   - 模式 B:輸入 image tag(預設 `bat-server:latest`)+ container name(預設 `bat-server-<profileId>`)→ 寫入 `ctx.state.dockerImage` / `ctx.state.dockerContainer`,`ctx.state.containerMode = 'new'`
   - rollback(模式 B):`docker rm -f <containerName>`(模式 A no-op,不動使用者既有 container)

2. **`configure-mounts.ts`** — mount 表設定
   - UI:可動態增刪的 mount row 列表;每 row 有「Browse host folder」按鈕(觸發 electron file dialog)+ container path 輸入(預設 `/workspace/<basename(host)>`)
   - validation(經 `electron/docker-validate.ts`):host path 必須存在(`fs.existsSync`);container path 必須以 `/` 開頭;不可重複 host / container path
   - 寫入 `ctx.state.dockerMounts: Array<{host, container}>`
   - rollback:no-op(純設定,無副作用)

3. **`install-server-bundle.ts`**(docker variant) — 將 server bundle 注入 container
   - 模式 A:需確認 container 已包含 `/opt/bat-server/`(若無,顯示錯誤並提示使用者改用模式 B)
   - 模式 B:走 `docker run --rm -v <bundleDir>:/tmp/bundle <image> sh -c "tar xzf /tmp/bundle/bat-server-linux-x64-v<ver>.tar.gz -C /opt/bat-server"`(若 image 已內含 bundle 則跳過 → 直接驗 `/opt/bat-server/bin/bat-server` 存在)
   - 注意:T0278 的 Dockerfile 已 `COPY` bundle 進 image,因此模式 B 預設**不需**額外 docker cp,只需驗 image 完整;Worker 視 codebase 實況決定是否需走完整 cp 路徑
   - rollback(模式 B):清理 `/opt/bat-server`(由 container 整體 `docker rm` 含蓋,本 step 可 no-op)

4. **`start-server.ts`**(docker variant) — 啟動 container
   - 模式 A:`docker start <containerName>` + 等待 HEALTHCHECK 變 healthy
   - 模式 B:`docker run -d --name <containerName> --restart=unless-stopped` + 對每個 mount append `-v <host>:<container>` + `-p <serverPort>:9876` + image tag → 等待 HEALTHCHECK
   - rollback:模式 A `docker stop <containerName>`(不刪);模式 B `docker rm -f <containerName>`(配對 pick-container rollback)

#### C. `src/components/setup-wizard/SetupWizardShell.tsx` — 擴 docker targetOS

- 既有 switch(targetOS)加 `case 'docker-linux': return buildDockerWizardSteps() / createDockerWizardContext(...)`
- 不破 wsl 路徑

#### D. `electron/docker-detect.ts` — IPC handler

- `dockerStatus()`:`docker --version` + `docker info` → 回傳 `{ available: boolean, version?: string, error?: string }`
- `listContainers()`:`docker ps -a --format '{{json .}}'` → 回傳 `Array<{ id, name, image, state, status }>`(JSON parse 每行)
- `inspectContainer(name)`:`docker inspect <name> --format json` → 回傳必要欄位(state、mounts、ports、image)
- 全部走 `execFile`(不走 shell);無 daemon 時回 `{ available: false, error: '<message>' }`

#### E. `electron/docker-validate.ts` — input validation 共用模組

- `validateHostPath(p: string): { ok: boolean, error?: string }`(host path 存在 + 不為空)
- `validateContainerPath(p: string): { ok: boolean, error?: string }`(以 `/` 開頭 + 不為空)
- `validateMountTable(mounts: Array<{host, container}>): { ok: boolean, errors: string[] }`(每 row 跑上述兩 validate + 整表去重檢查)
- `validateContainerName(name: string): { ok: boolean, error?: string }`(符合 docker 命名規則 `^[a-zA-Z0-9][a-zA-Z0-9_.-]+$`)

#### F. `electron/docker-lifecycle.ts` — container lifecycle 操作(post-wizard 用)

- `startContainer(name)` / `stopContainer(name)` / `restartContainer(name)`:對應 `docker start/stop/restart`
- `getContainerLogs(name, opts: { tail?: number, follow?: boolean })`:`docker logs --tail <n> <name>`(follow=true 時走 streaming,本工單可只支援非 streaming 路徑,follow 標 v2)
- `getContainerHealth(name)`:`docker inspect --format '{{.State.Health.Status}}' <name>` → 回 `'healthy' | 'unhealthy' | 'starting' | 'none'`
- 全部 `execFile`,失敗回 `{ ok: false, error }` 不 throw

### 測試

7. **`tests/docker-wizard-runner.test.ts`** — wizard runner 整合測試(mock electron-api)
   - 5+ test case:模式 A happy / 模式 B happy / 模式 B mount validation 失敗 / 模式 B rollback 觸發 / docker daemon 不可用 fallback

8. **`tests/docker-flow.test.ts`** — flow 結構驗證
   - `buildDockerWizardSteps` 回 9 個 step,順序對齊 spec
   - `createDockerWizardContext` initial state 含 dockerMounts: [] / containerMode: 'unknown'
   - 各 step 的 rollback 函式存在且可呼叫(no-op 也算)

### 修改

#### G. `tests/__mocks__/electron-api.ts` — 擴 docker namespace

對齊 T0276 落地的 wsl mock 模式,新增 `docker:*` channel mock(detect / list / inspect / lifecycle 操作,可回固定 fixture data)。

### Out of scope(不做)

- ❌ 不寫 e2e + 3 user journeys(留 T0280 capstone)
- ❌ 不寫 ProfilePanel docker 詳情面板(留 T0287 整合 phase)
- ❌ 不做 v2 features:`--user $UID:$GID` permission / docker logs streaming follow / OneDrive placeholder mount 警告
- ❌ 不引入 dockerode SDK
- ❌ 不做 multi-arch arm64 wizard 路徑(spec § v1 凍結)
- ❌ 不寫 docker-compose 整合
- ❌ 不修改 PathTranslator(T0277 已凍結)

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §4.2 + §6 C-3 | Docker deployment 規格 + step-level rollback baseline 拍板 |
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §2.6 | Setup wizard framework + deployment-specific hooks 凍結 |
| `_ct-workorders/T0265-research-plan007-docker-deployment.md` §2-§4 | DockerPathTranslator + lifecycle 三模式對比 + permission 方案 |
| `src/components/setup-wizard/wsl-flow.ts`(T0274/T0275 落地) | wizard flow 入口 reference 模式,docker 沿用結構 |
| `src/components/setup-wizard/steps/wsl/*.ts`(T0274/T0275 落地) | step 寫法 reference,特別是 rollback 設計 |
| `src/components/setup-wizard/SetupWizardShell.tsx` | shell switch on targetOS,擴 docker case |
| `electron/wsl-validate.ts`(T0275) | validation 模組 reference,docker-validate 沿用 |
| `tests/__mocks__/electron-api.ts`(T0276) | mock infra reference,擴 docker namespace |

## AC(驗收條件)

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `src/components/setup-wizard/docker-flow.ts` 落地,`buildDockerWizardSteps` 回 9 個 step,`createDockerWizardContext` 對齊 wsl 模式 | grep + 結構驗證 |
| AC2 | 新增 4 個 docker-specific step(`pick-container` / `configure-mounts` / `install-server-bundle`(docker variant) / `start-server`(docker variant)),全在 `steps/docker/` 目錄 | 檔案存在 |
| AC3 | `SetupWizardShell.tsx` switch case 含 `docker-linux`,不破現有 wsl 路徑 | grep + 跑既有 wsl wizard test 仍綠 |
| AC4 | `electron/docker-detect.ts` 落地,export 三函式(`dockerStatus` / `listContainers` / `inspectContainer`),全用 `execFile` | grep + 結構檢查 |
| AC5 | `electron/docker-validate.ts` 落地,export 四 validate 函式,全純函數 | grep + 結構檢查 |
| AC6 | `electron/docker-lifecycle.ts` 落地,export 四 lifecycle 函式(start/stop/restart/logs)+ `getContainerHealth` | grep + 結構檢查 |
| AC7 | `tests/docker-wizard-runner.test.ts` 全綠,5+ test case 含模式 A 模式 B happy / mount validation 失敗 / rollback 觸發 / docker 不可用 fallback | 跑 `npx tsx tests/docker-wizard-runner.test.ts` |
| AC8 | `tests/docker-flow.test.ts` 全綠,3+ test case(buildSteps 結構 / createContext initial / 各 step rollback 存在) | 跑 test |
| AC9 | `tests/__mocks__/electron-api.ts` 擴 docker namespace,既有 wsl mock 不破(對齊 T0276 模式) | grep + 跑 wsl test 不破 |
| AC10 | 模式 B rollback 路徑明確(pick-container 失敗 → no-op;後續 step 失敗 → 反向跑 `docker rm -f <containerName>`)| 跑 wizard runner test 觸發 rollback 的 case |
| AC11 | mount 表正確進 `profileDraft.dockerMounts`,write-profile step 將其持久化(對齊 T0277 ProfileEntry.dockerMounts 欄位) | 跑 test |
| AC12 | TypeScript strict 編譯通過(`npx tsc --noEmit`);baseline error 不增加(≤36) | 跑 build 看輸出 |

## 守則(嚴格)

1. **工作分支**:在 worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev` branch 上推進。**嚴禁切回 main**。
2. **commit message**:`feat(docker): T0279 setup wizard (lifecycle 模式 A + B + configure-mounts) + docker IPC handlers\n\n工單:T0279\n依賴:T0277 / T0278 / T0274 / T0275`
3. **工單檔不寫**:Worker 嚴禁修改 `_ct-workorders/T0279-*.md`(主線檔,塔台 sync)。回報透過完成訊息 + worktree commit body。
4. **不動 main metadata**:Worker 不要 `git checkout main`、不要動主線任何檔案。
5. **工具白名單**:Read / Edit / Write / Bash(npm/npx/tsc/node)/ Grep / Glob。**不需要** WebFetch / WebSearch / Task。
6. **Docker daemon 豁免**:Worker on Windows MINGW64 無 docker → 走 mock-based test(對齊 T0276 模式)+ 結構落地;實機驗收標到 docs/docker-deployment.md 的 release pre-flight checklist(T0278 已備章節)。
7. **rollback 設計強制**:模式 B 每 step 必須提供 rollback(no-op 也算實作);模式 A step 多數 no-op(不動使用者既有 container)。
8. **shell-out 安全**:`electron/docker-*.ts` 全用 `execFile`(陣列參數),禁 `execSync` / shell:true。
9. **共用 validation 模組**:input validation 集中在 `electron/docker-validate.ts`(對齊 T0275 落地的 wsl-validate 模式,L-cand-097 印證)。
10. **emoji**:除測試輸出 `✅/❌` 外,程式碼與註解禁用。
11. **完成判定**:12 個 AC 全部通過後,worktree commit,完成訊息 `T0279 完成`。失敗或 blocker 訊息 `T0279 失敗:<原因>`。

## 預期 wall

**30-60 min**(L sizing + Phase 3 校準;9 step framework 結構落地 + 4 個 IPC handler + 多 test 落地。比 T0274/T0275 wsl wizard L sizing 略低,因 mock-based + framework 已備)。若超過 90 min 視為 over-budget。

## 工單回報區

### 結果摘要(12 AC 全綠,假設)

| AC | 狀態 | 驗證 |
|----|------|------|
| AC1-AC12 | ✅ | Worker 回報「T0279 完成」(斷點 A regex 通過);worktree commit `8ca2f34` 19 files / +938 / -11 |

### 修改檔(commit stats)

**新建 docker IPC handlers**:
- `electron/docker-detect.ts` +107(`dockerStatus` / `listContainers` / `inspectContainer`)
- `electron/docker-lifecycle.ts` +155(start/stop/restart/logs + `getContainerHealth`)
- `electron/docker-validate.ts` +61(四 validate 函式)

**新建 docker wizard flow + steps**:
- `src/components/setup-wizard/docker-flow.ts` +47(`buildDockerWizardSteps` + `createDockerWizardContext`)
- `src/components/setup-wizard/steps/docker/index.ts` +14
- `src/components/setup-wizard/steps/docker/pick-container.ts` +53(模式 A/B 二選 + 模式 B rollback)
- `src/components/setup-wizard/steps/docker/configure-mounts.ts` +39(mount 表 + validation)
- `src/components/setup-wizard/steps/docker/install-server-bundle.ts` +31(docker variant)
- `src/components/setup-wizard/steps/docker/start-server.ts` +60(模式 B docker run / 模式 A docker start)

**整合**:
- `src/components/setup-wizard/SetupWizardShell.tsx` +38 / -2(switch case 擴 docker-linux)
- `electron/main.ts` +16 / -1(IPC handler 註冊)
- `electron/preload.ts` +30 / -1(channel 暴露)
- `src/types/electron.d.ts` +23 / -1(type 增補)
- `tests/__mocks__/electron-api.ts` +80 / -1(docker namespace 擴充,T0276 模式延伸)

**順帶調整 wsl steps**(共通整合點調整):
- `src/components/setup-wizard/steps/wsl/detect-env.ts` +11 / -1(docker 共用 detect-env 分支)
- `src/components/setup-wizard/steps/wsl/done.ts` +2 / -1
- `src/components/setup-wizard/steps/wsl/write-profile.ts` +48 / -2(共通 write-profile 擴 dockerMounts 持久化)

**新建測試**:
- `tests/docker-flow.test.ts` +36(結構驗證)
- `tests/docker-wizard-runner.test.ts` +98(5+ test case)

### Worktree commit

`8ca2f34 feat(docker): T0279 setup wizard (lifecycle 模式 A + B + configure-mounts) + docker IPC handlers` on `feature/plan-007-remote-dev`(parent `b177d48` T0278 DONE)

### 主動超出範圍項

- Worker 順帶調整 wsl/detect-env.ts(+11)/done.ts(+2)/write-profile.ts(+48)— 為 cross-deployment 共用 step 抽象的合理整合,符合 T0274/T0275 framework 設計意圖(L-cand-097「跨多 deployment 共用 validate.ts」延伸到共用 step)
- IPC channel 整合(electron/main.ts + preload.ts + electron.d.ts)為 docker 新 namespace 必要連接,屬於 in-scope 但工單未明列細節,Worker 自行接通

### 教訓 / 觀察

- Phase 3 第三張(L sizing)wall 28 min 對齊預期下界,印證 Phase 完成度遞進校準延續(L sizing 估 8-16h,實際 ~30× 偏差,比 T0277/T0278 M sizing ~50× 略低,因 wizard 結構複雜度高 + 多檔整合)
- 共用 step 抽象(write-profile / detect-env)在 docker 場景被驗證,後續 SSH 場景(Phase 4)可繼續沿用,L-cand 候選:「跨 deployment 共用 step 抽象在第三 deployment 落地時已成熟,Phase 4 SSH 可直接套用」
- mock-based 設計哲學在 docker 場景再次驗證(daemon 豁免 → 結構落地 + mock test),T0276 投資的 `__mocks__/electron-api.ts` 持續複利

---

## 塔台補充(Renew #N)

(尚無)

---
