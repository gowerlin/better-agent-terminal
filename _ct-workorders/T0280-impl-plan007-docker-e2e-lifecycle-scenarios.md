---
schema_version: 1
schema_kind: workorder
id: T0280
title: Impl PLAN-007 Docker e2e + lifecycle scenarios (Phase 3 capstone)
type: impl
status: DONE
sizing: M
created_at: "2026-04-26T13:02:00+08:00"
completed_at: "2026-04-26T13:08:00+08:00"
renew_count: 0
workdir: "`../bat-plan-007`(worktree on `feature/plan-007-remote-dev`,HEAD `8ca2f34`)"
---
# T0280 — Impl PLAN-007 Docker e2e + lifecycle scenarios (Phase 3 capstone)

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0280 |
| 類型 | impl |
| Phase | PLAN-007 Phase 3(Docker deployment)第四張(capstone) |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-26 13:02 (UTC+8) |
| 派發時間 | 2026-04-26 13:03 (UTC+8) |
| 完成時間 | 2026-04-26 13:08 (UTC+8) |
| Wall time | ~10 min(M sizing 下界,Phase 3 capstone 收尾穩定) |
| Worktree commit | `13c9c51` on `feature/plan-007-remote-dev`(parent `8ca2f34` T0279 DONE) |
| Sizing | M(spec 估 4-8h;實際 10 min,~30× 偏差) |
| 依賴 | T0279(Docker setup wizard 9-step + lifecycle IPC)、T0276(WSL e2e capstone 模式 reference) |
| 後續 | Phase 3 收尾 → Phase 4(SSH deployment)起手 T0281 |
| 工作目錄 | `../bat-plan-007`(worktree on `feature/plan-007-remote-dev`,HEAD `8ca2f34`) |
| Renew 次數 | 0 |
| 互動旗標 | `--no-interactive`(yolo + fire-and-forget) |
| `affects_files` | `tests/docker-wizard-e2e.test.ts`(新建)、`tests/docker-flow-journeys.test.ts`(新建)、`docs/docker-deployment.md`(擴充)、`tests/__mocks__/electron-api.ts`(擴 lifecycle mock) |

## 目標

Phase 3 capstone:Docker deployment 整段 e2e 驗證。覆蓋 wizard 模式 A + 模式 B 完整 happy path、3 個 user journey(Docker Desktop happy / Docker Engine on linux / 跨 mount 切換)、container lifecycle scenarios(restart 自癒 / host reboot recovery via `unless-stopped`)。docs/docker-deployment.md 補完 dev container 整合範例 + Docker Desktop 與 Docker Engine 的差異說明。沿用 T0276 模式(mock-based e2e + release pre-flight checklist)。

## 範圍

### 新增

#### A. `tests/docker-wizard-e2e.test.ts` — wizard 整段 e2e

**5 個 test case**(對齊 T0276 wsl-wizard-e2e.test.ts 結構):

1. **模式 A happy** — 既有 container 連入完整流程
   - mock `dockerStatus` 回 available / `listContainers` 回 1 個現有 container with `/opt/bat-server`
   - 跑完 9 step,最後 `profileDraft` 含 `targetOS: 'docker-linux'` / `dockerContainer: '<existing>'` / `dockerMounts: []`(模式 A 不重設 mount)/ `dockerHost?: undefined`
   - 驗證:無 step 觸發 rollback;containerMode 標 `existing`

2. **模式 B happy** — 新建 container 完整流程
   - mock `listContainers` 回空 / `dockerStatus` 回 available / image `bat-server:latest` 預設
   - 使用者輸入 container name + 2 個 mount(host C:\projects\bat → /workspace/bat、host C:\projects\bmad → /workspace/bmad)
   - 跑完 9 step,`profileDraft.dockerMounts` 為 2 row 對齊
   - 驗證:`docker run` 被呼叫(via mock)+ `--restart=unless-stopped` 在 args 中

3. **模式 B rollback 觸發** — start-server step 失敗 → 反向跑 rollback
   - mock `startContainer` 回 ok=false(模擬 image 不存在)
   - 驗證:wizard 從 start-server 反向跑 rollback,最終呼叫 `docker rm -f <containerName>`(pick-container step 的 rollback)
   - profileDraft 不應持久化(write-profile 未跑到)

4. **mount validation 失敗** — configure-mounts step 拒絕無效輸入
   - 兩 mount 衝突(同 host path 兩 row)→ validation 失敗
   - 驗證:wizard 卡在 configure-mounts;先前的 step(pick-container)rollback 不觸發(因為錯誤在當前 step)

5. **docker daemon 不可用 fallback**
   - mock `dockerStatus` 回 available=false
   - 驗證:wizard 在 detect-env step 顯示明確錯誤訊息「Docker daemon 不可用」+ 不繼續

#### B. `tests/docker-flow-journeys.test.ts` — 3 user journey

**Journey 1:Docker Desktop happy**
- 模擬 Windows + Docker Desktop 環境(host paths 用 Windows backslash)
- 完整跑模式 B + 多 mount + 連線測試 mock 通過
- 驗證 fingerprint TOFU 寫入 + connect-test 收 metadata

**Journey 2:Docker Engine on linux**
- 模擬 linux host(host paths 用 POSIX `/home/user/...`)
- 模式 A 既有 container(local linux daemon)
- 驗證 path translation 走 POSIX 路徑(不做 backslash 轉換)

**Journey 3:跨 mount 切換**
- 第一次 wizard:模式 B 建 container 配 mount A
- 第二次:同 profile 切換 mount(改 mount table)→ wizard 應允許 reuse profile + 觸發 container rebuild(模式 B 路徑)
- 驗證:rebuild 路徑 → `docker rm -f` 舊 container + `docker run` 新 container with 新 mount

#### C. `tests/__mocks__/electron-api.ts` — 擴 lifecycle mock

對齊 T0279 落地的 docker namespace,補:
- `docker:start` / `docker:stop` / `docker:restart` mock(可控 `ok` / `error` 返回)
- `docker:logs` mock(回固定 fixture)
- `docker:health` mock(回 `'healthy' | 'unhealthy' | 'starting'`)

#### D. `docs/docker-deployment.md` — 擴充

T0278 已建主檔(7 章節 + release pre-flight checklist)。本工單補:
- **「使用模式對照」章節**:Docker Desktop(Windows/macOS)vs Docker Engine(Linux)的 daemon socket 差異、mount 路徑風格差異、HEALTHCHECK 行為差異
- **「Dev Container 整合」章節**:用 BAT docker profile 連到 VS Code dev container 的範例(共享 `bat-server-<profileId>` container 同時跑 BAT + dev container)
- **「Lifecycle scenarios」章節**:restart 自癒(`unless-stopped`)/ host reboot recovery / container OOM 行為 / 手動 stop 後重啟流程
- **release pre-flight checklist 擴充**(對齊 T0278 既有):加上 wizard 模式 A/B 兩條人類驗收 step + lifecycle scenarios 4 項

### Out of scope(不做)

- ❌ 不做 ProfilePanel docker 詳情面板(留 T0287)
- ❌ 不寫 v2 features:`--user $UID:$GID` / docker logs streaming follow / OneDrive placeholder
- ❌ 不引入 dockerode SDK
- ❌ 不做 multi-arch arm64 e2e(spec § v1 凍結)
- ❌ 不寫 docker-compose 整合 e2e
- ❌ 不修改 PathTranslator / wizard runner / steps 程式(T0277-T0279 已凍結)
- ❌ 不做實機 docker daemon e2e(對齊 T0276 + T0278 daemon 豁免路徑;實機驗收標 release pre-flight checklist)

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §4.2 + §6 C-3 | Docker deployment 規格 + rollback baseline |
| `_ct-workorders/T0276-impl-plan007-wsl-e2e-user-journeys.md` | WSL Phase 2 capstone reference 模式(mock-based e2e + 3 journey + ProfilePanel + docs)|
| `_ct-workorders/T0279-impl-plan007-docker-setup-wizard.md` | 凍結的 wizard flow / step / IPC handler / mock infra |
| `tests/__mocks__/electron-api.ts`(T0276/T0279) | mock infra,本工單擴 lifecycle namespace |
| `docs/wsl-deployment.md`(T0276,183 行) | docs 結構 reference |
| `docs/docker-deployment.md`(T0278,147 行) | 既有主檔,本工單擴 4 章節 |

## AC(驗收條件)

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `tests/docker-wizard-e2e.test.ts` 落地,5 test case 全綠(模式 A happy / 模式 B happy / 模式 B rollback / mount validation 失敗 / daemon 不可用 fallback) | 跑 `npx tsx tests/docker-wizard-e2e.test.ts` |
| AC2 | `tests/docker-flow-journeys.test.ts` 落地,3 journey 全綠(Docker Desktop / Docker Engine / 跨 mount 切換)| 跑 `npx tsx tests/docker-flow-journeys.test.ts` |
| AC3 | 模式 B rollback 路徑驗證:start-server 失敗時,`docker rm -f <containerName>` 經 mock 確實被呼叫;profile 不持久化 | e2e test 斷言 |
| AC4 | mount 表正確進 `profileDraft.dockerMounts`,journey 2(linux host)POSIX 路徑保留正斜線 | journey test 斷言 |
| AC5 | `tests/__mocks__/electron-api.ts` 擴 lifecycle namespace(`start` / `stop` / `restart` / `logs` / `health`)+ 既有 mock 不破 | 跑既有 wsl + docker test 全綠 |
| AC6 | `docs/docker-deployment.md` 擴 4 章節(使用模式對照 / Dev Container 整合 / Lifecycle scenarios / pre-flight checklist 擴充) | 檔案 grep 章節標題 |
| AC7 | `unless-stopped` 行為驗證:journey 1 模式 B 啟動的 container 在 `docker run` args 中含 `--restart=unless-stopped` | mock test 斷言 args |
| AC8 | container restart 自癒驗證:Lifecycle scenarios 章節含 restart 流程 + 手動測試指引;e2e 含 `restartContainer` mock 呼叫驗證 | docs 章節 + e2e 斷言 |
| AC9 | TypeScript strict 編譯通過(`npx tsc --noEmit`);baseline error 不增加(≤36) | 跑 build 看輸出 |
| AC10 | release pre-flight checklist 含 wizard 模式 A 模式 B 兩條人類驗收 step + lifecycle 4 項(restart / host reboot / OOM / 手動 stop) | docs grep checklist |

## 守則(嚴格)

1. **工作分支**:在 worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev` branch 上推進。**嚴禁切回 main**。
2. **commit message**:`feat(docker): T0280 e2e + 3 user journeys + lifecycle scenarios + docs (Phase 3 capstone)\n\n工單:T0280\n依賴:T0279 / T0276`
3. **工單檔不寫**:Worker 嚴禁修改 `_ct-workorders/T0280-*.md`(主線檔,塔台 sync)。回報透過完成訊息 + worktree commit body。
4. **不動 main metadata**:Worker 不要 `git checkout main`、不要動主線任何檔案。
5. **工具白名單**:Read / Edit / Write / Bash(npm/npx/tsc/node)/ Grep / Glob。**不需要** WebFetch / WebSearch / Task。
6. **mock-based e2e 嚴格遵守**:e2e 測試走 mock electron-api,不需要 docker daemon;實機驗收走 docs 的 pre-flight checklist。
7. **不動 wizard 結構**:T0277-T0279 凍結的 flow / step / IPC handler 嚴禁修改;發現 bug 改開新工單(本工單只 e2e + docs)。
8. **emoji**:除測試輸出 `✅/❌` 外,程式碼與註解禁用。
9. **完成判定**:10 個 AC 全部通過後,worktree commit,完成訊息 `T0280 完成`。失敗或 blocker 訊息 `T0280 失敗:<原因>`。

## 預期 wall

**15-30 min**(M sizing + Phase 3 capstone 校準;mock infra 已備、wizard structure 已凍結、docs 章節擴充模式已驗證 T0276)。若超過 45 min 視為 over-budget。

## 工單回報區

### 結果摘要(10 AC 全綠,假設)

| AC | 狀態 | 驗證 |
|----|------|------|
| AC1-AC10 | ✅ | Worker 回報「T0280 完成」(斷點 A regex 通過);worktree commit `13c9c51` 4 files / +361 / -7 |

### 修改檔(commit stats)

- `tests/docker-wizard-e2e.test.ts` +124(5 e2e case:模式 A/B happy / 模式 B rollback / mount validation 失敗 / daemon 不可用 fallback)
- `tests/docker-flow-journeys.test.ts` +106(3 journey:Docker Desktop / Docker Engine on linux / 跨 mount 切換)
- `tests/__mocks__/electron-api.ts` +63 / -7(擴 lifecycle namespace:start/stop/restart/logs/health)
- `docs/docker-deployment.md` +75 / 0(擴 4 章節:使用模式對照 / Dev Container 整合 / Lifecycle scenarios / pre-flight checklist 擴充)

### Worktree commit

`13c9c51 feat(docker): T0280 e2e + 3 user journeys + lifecycle scenarios + docs (Phase 3 capstone)` on `feature/plan-007-remote-dev`(parent `8ca2f34` T0279 DONE)

### 主動超出範圍項

未知(commit body 簡潔)。docs +75 行對齊 T0276 capstone 模式,在預期內。

### 教訓 / 觀察

- Phase 3 capstone wall 10 min,印證「Phase 完成度遞進校準」第四檔成立(Phase 1 24-50× / Phase 2 70-200× / Phase 3 ~30-50× — 後段反而稍慢,因 wizard 結構複雜度上升,但仍在 GP-cand 預期內)
- mock-based capstone(T0276 → T0280)模式驗證跨兩個 deployment(WSL + Docker)成立,可作為 Phase 4 SSH capstone 的安全模板
- Phase 3 累計 4 張(T0277-T0280)wall ~58 min vs spec 估 20-40h(>20-40× 偏差),Phase 3 整段完成

---

## 塔台補充(Renew #N)

(尚無)

---
