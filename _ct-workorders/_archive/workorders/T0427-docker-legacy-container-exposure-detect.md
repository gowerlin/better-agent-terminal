---
schema_version: 1
schema_kind: workorder
id: T0427
title: "BUG-097 後續：偵測修復前建立的 Docker container（host publish 未綁 127.0.0.1 / 舊 image），警告並引導重建"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-097
priority: P1
sizing: S
created_at: "2026-10-05T05:47:15+08:00"
started_at: "2026-10-05T06:14:24+08:00"
updated_at: "2026-10-05T06:20:33+08:00"
completed_at: "2026-10-05T06:20:33+08:00"
target_version: next
depends_on:
  - T0426
related:
  - "T0418 回報區「遭遇問題」Scope 外 2（`startContainer` 非 `createIfMissing` 路徑只 `docker start`，既有 container 不會被修正）"
  - "D134 追加（使用者 05:46 斷點 C 裁決）"
affects_files:
  - electron/docker-lifecycle.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/steps/docker/
  - src/components/SettingsPanel.tsx
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - electron/__tests__/docker-lifecycle.test.ts
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不得自動刪除或重建使用者的 container**（可能帶 volume / mounts 與使用者資料）。只偵測 + 警告 + 提供使用者明確觸發的重建入口（若現有 UI 已有「重建 / 移除」動作就導向它；沒有則只給文字引導）。"
  - "🔴 偵測依據用 `docker inspect` 結構化欄位（`HostConfig.PortBindings` 的 `HostIp` 為空字串或 `0.0.0.0` / `::`），**不要**解析 `docker ps` 文字輸出。`execFile` + array args、container 名白名單 `/^[a-zA-Z0-9._-]+$/`、timeout 5s（CLAUDE.md）。"
  - "🔴 偵測點：容器啟動前（`startContainer` 的既有 container 路徑）與遠端 profile 開啟時擇一或兩者；偵測失敗（docker 不可用）不得阻擋原流程。"
  - "🔴 同工作樹有其他 Worker 平行。共用檔（`main.ts` / `preload.ts` / `electron.d.ts` / i18n）commit 前 `git diff <file>` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0427 — 既有 Docker container 暴露偵測

## 背景

T0418 修正後，**新建**的 container 以 `-p 127.0.0.1:<port>:9876` 發布、image 內 bind 對 container 介面。但修復前建立的 container 仍是 `-p <port>:9876`（host 全介面），且跑舊 image（container 內綁 127.0.0.1，實際連不上）。`startContainer` 非 `createIfMissing` 路徑只做 `docker start`，不會修正。

## 範圍

1. `docker-lifecycle.ts` 新增偵測函式（inspect → `{ exposed: boolean, hostIps: string[] }`）
2. 在啟動 / 開啟路徑呼叫，`exposed` 時以 toast / 精靈訊息警告並引導重建（i18n 三語）
3. 測試：mock `execFile` 回不同 `PortBindings` → 判定正確；docker 不可用時不拋、不阻擋

## 驗收條件

- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] 回報區附偵測點與 UX 說明、實機步驟（Docker Desktop 起來後：以舊參數 `docker run -p <port>:9876 …` 建 container → BAT 顯示警告）
- [ ] runtime lane（docker daemon 可用才做）：有則附證據，無則明記未驗證

## Sub-session 執行指示
1. 讀本工單 + T0418 回報區 + BUG-097
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（source / unit test / typecheck lane PASS；runtime lane **未驗證**——本機 Docker daemon 未啟動）

**Commit**：`89c538c`（`fix(docker): T0427 BUG-097 detect pre-fix containers exposed on all host interfaces`；10 檔，未 push。本行為 commit 後補記，未入該 commit）

#### Landing Zone Check

- **PASS** — C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 testable entries 皆 present（informational）；C-2 無 `branch` 欄位
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（evidence only）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

| 檔案 | 改動 |
|------|------|
| `electron/docker-lifecycle.ts` | 新增 `detectContainerExposure(name, { hostPort? })` → `DockerContainerExposure { ok, exposed, hostIps, legacyImage, error? }`；`execDocker` 加選用 `timeoutMs`（偵測用 5s）；`startContainer` 既有 container 路徑在 `docker start` **之前**偵測，`exposed` 或 `legacyImage` 時於回傳附 `exposure`（偵測失敗 / 乾淨時不附） |
| `electron/preload.ts` / `src/types/electron.d.ts` | `startContainer` 回傳型別加選用 `exposure`（各 1 行；IPC channel / 參數不變，`main.ts` 無需改動） |
| `src/components/setup-wizard/steps/docker/start-server.ts` | 既有 container 路徑改傳 `{ port }`（供偵測比對 host port；existing 路徑原本就不使用其他 option）；`startResult.exposure` 存在時以 i18n 文字推入 `ctx.warnings`（精靈警告區塊），**在 health 等待前**推入 |
| `src/locales/{en,zh-TW,zh-CN}.json` | 新增 `wizard.docker.warning.containerPortExposed` / `containerLegacyImage` |
| `electron/__tests__/docker-lifecycle.test.ts` | +21 tests（偵測 16 + `startContainer` existing 路徑 5） |
| `src/components/setup-wizard/steps/docker/__tests__/start-server.test.ts`（新） | 5 tests：existing 傳 `{ port }`、暴露警告內容、legacy image 警告於 unhealthy 失敗前已推入、乾淨時無警告、三語 key 存在 |

**偵測規則**（memory_overrides 第 2 條）
- `docker inspect --type container <name>`（`execFile` + array args、container 名經既有 `validateContainerName` 白名單、timeout 5s），解析 JSON 的 `HostConfig.PortBindings`，**不解析** `docker ps` 文字
- 判定範圍：container port `9876/tcp`（in-image bat-server 埠），以及 `HostPort` 等於精靈 `serverPort` 的 binding（使用者自建 container 若 bat-server 不在 9876 也能抓到）；其他無關埠（例如 `3000/tcp`）不警告，避免雜訊
- `exposed`：`HostIp` 非 loopback 即算——涵蓋工單列的 `''` / `0.0.0.0` / `::`，另含明確的 LAN IP（同屬對外暴露）；`127.x.x.x` / `::1` / `localhost` 視為安全。`hostIps` 去重保留 docker 原值（`''` 於 UI 顯示為 `0.0.0.0`）
- `legacyImage`（標題「舊 image」）：`Config.Entrypoint + Cmd` 含 `/opt/bat-server/bin/bat-server` 但無 `--bind-interface` ⇒ T0418 前的 image（container 內綁 127.0.0.1，publish 連不到）。非 bat-server image 不判定
- docker 不可用 / inspect 失敗 / JSON 無法解析 / 名稱非法 ⇒ `ok:false`、不 throw；`startContainer` 照常 `docker start`（不阻擋原流程）

**偵測點與 UX**
- 偵測點：`startContainer` 的既有 container 路徑（主程序，`docker start` 前）。`createIfMissing` 路徑不偵測（新建者必為 `127.0.0.1` publish）
- 遠端 profile 開啟時**未**加偵測：Docker profile 連線路徑不經 `startContainer`，且 `ProfilePanel` 不在 `affects_files`（memory_overrides 第 3 條「擇一或兩者」，擇一）
- UX：精靈「啟動 Docker 容器」步驟的警告區塊（`SetupWizardShell` 既有 `ctx.warnings` 琥珀色區塊）。兩則訊息各自獨立：
  - 暴露：說明埠發布在所有介面（列出 hostIps）、可被同網路機器連入；引導「重新執行精靈選『建立新的』（只綁 127.0.0.1），確認不需要舊資料後自行 `docker rm -f <name>`」；明示 BAT 不會修改或刪除
  - 舊 image：說明 publish 連不到 server；引導 `npm run build:docker-image` 後以「建立新的」重建
- **不自動刪除 / 重建**（memory_overrides 第 1 條）：精靈對既有 container 沒有重建 / 移除動作，故只給文字引導；測試鎖住 existing 路徑只呼叫 `inspect` / `start` / `exec`
- `SettingsPanel.tsx` 未改：該檔無 Docker 相關 UI，無可導向的重建入口

**實機步驟（Docker Desktop 起來後）**
1. 以舊參數建 container：`docker run -d --name bat-legacy -p 9876:9876 <舊 bat-server image> --port 9876 --token test`（或用新 image 但 `-p 9876:9876`，只驗暴露警告）
2. `docker inspect --format '{{json .HostConfig.PortBindings}}' bat-legacy` 應見 `"HostIp":""`
3. BAT → Profiles → 新增 Docker profile → 精靈選「使用既有」→ 選 `bat-legacy` → 跑到「啟動 Docker 容器」：警告區塊應出現「容器 bat-legacy 將 BAT 伺服器埠發布在主機所有網路介面（0.0.0.0）…」；舊 image 另見 legacy image 警告，且 health 為 unhealthy 時步驟失敗（警告仍在）
4. 確認 container 未被刪除：`docker ps -a --filter name=bat-legacy`
5. 對照組：精靈選「建立新的」→ 無警告；`docker port <name>` 為 `127.0.0.1:<port>`

#### 驗證證據

| Lane | 結果 | 證據 |
|------|------|------|
| unit（本單） | PASS | `npx vitest run electron/__tests__/docker-lifecycle.test.ts` **27/27**（原 6 + 新 21）；`npx vitest run src/components/setup-wizard/steps/docker/__tests__/start-server.test.ts` **5/5** |
| unit（全套） | PASS（本單範圍）/ 1 個無關失敗 | `npm run test:unit`：**137 files / 2197 passed / 1 failed / 1 skipped**。唯一失敗為 `electron/remote/__tests__/headless-always-local.test.ts` > `bindProxiedHandlersToIpc answers ALWAYS_LOCAL locally before the remote branch`——斷言 `electron/remote/headless-entry.ts` / `main.ts` 原始碼順序，兩檔皆為平行 Worker（T0443 等）未提交改動，本單未觸碰 |
| typecheck | PASS | `npx tsc --noEmit` **39** 個 error（≤ 40），grep 確認無一落在本單改動檔（`docker-lifecycle` / `start-server` / `preload` / `electron.d.ts` / locales） |
| build / e2e | 未跑 | 依 memory_overrides 第 4 條（L141） |
| runtime（docker） | **未驗證** | `docker version` → client `29.8.2`，server：`failed to connect to the docker API at npipe:////./pipe/docker_engine ... The system cannot find the file specified.`。未建舊參數 container、未實測警告顯示 |

### 遭遇問題

- **Shared 檔隔離（commit 方式偏差）**：`electron/preload.ts` / `src/types/electron.d.ts` 同時含平行 Worker T0436（`selectAttachments` / `readImageDataUrl`）與 T0443（`onClientStatusChanged` / `onInvokeRefused`）的未提交 hunk，`git commit --only` 會把它們一起帶進本單 commit。改以「`HEAD` 版本 + 本單 1 行替換」產生 blob（`git hash-object -w`）→ `git update-index --cacheinfo` 只 stage 本單 hunk → 其餘本單獨有檔 `git add` → 檢查 `git diff --cached` 只含本單 → `git commit`。未用 stash / reset / checkout / restore；平行 Worker 的工作樹改動保持未提交原狀
- **Scope 內小決策**：`exposed` 判定放寬到「任何非 loopback HostIp」（工單列 `''` / `0.0.0.0` / `::`，明確 LAN IP 同屬暴露）；另加 `legacyImage` 欄位對應標題「舊 image」，回傳形狀為工單 `{ exposed, hostIps }` 的超集
- **殘餘風險**：
  - 遠端 profile 開啟時不偵測：已用「使用既有」跑過精靈的舊 container 若不再進精靈，不會看到警告（需另單在 profile 連線 / `ProfileCardDetails` 加偵測入口，需 Docker profile 與 container 名的對應欄位）
  - `startContainer` 既有路徑多一次 `docker inspect`（≤ 5s timeout）；docker daemon 卡住時最多延遲 5s 再進 `docker start`（原本 `docker start` 本身也會卡住，無 timeout）
- 平行 Worker 未提交改動（`electron/main.ts`、`electron/remote/*`、`electron/pty-manager.ts`、`src/components/*AgentPanel.tsx` 等）未觸碰

### 回報時間

2026-10-05T06:19:50+08:00
