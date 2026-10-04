---
schema_version: 1
schema_kind: workorder
id: T0418
title: "BUG-097：Docker 遠端 host 埠綁 127.0.0.1、container 內 bat-server 對 container 介面 bind、HEALTHCHECK 修正"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-097
priority: P1
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: "2026-10-05T05:39:21+08:00"
updated_at: "2026-10-05T05:43:52+08:00"
completed_at: "2026-10-05T05:43:52+08:00"
target_version: next
depends_on: []
related:
  - "BUG-097；T0386 研究目標 5（安全）；CLAUDE.md「Remote 資安」節（bind-interface 三選項）"
  - "D134（本 session 排程表第 2 列）"
affects_files:
  - electron/docker-lifecycle.ts
  - docker/Dockerfile
  - electron/__tests__/
  - src/components/setup-wizard/steps/docker/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **安全不變式**：host 端 publish 只能綁 `127.0.0.1`（`-p 127.0.0.1:<port>:9876`）。container 內 bind 對外（container 介面）是為了讓 docker 轉發可達，**前提是 host 端已綁 loopback**——兩者必須同一個 commit 落地，不可只改其一。"
  - "🔴 RemoteServer 是 TLS / WSS 端點，**不要**加明文 HTTP `/health` 路由，也不要用明文 `curl http://…/health`。HEALTHCHECK 改為 TCP 可連線檢查（例如以 image 內現有 runtime 做 `net.connect`），或移除 HEALTHCHECK；擇一並在回報區說明理由。"
  - "🔴 同工作樹有其他 Worker 平行。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。測試若紅在你沒碰的檔案，記入回報區、不要修。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；child_process 一律 `execFile` / `spawn` + array args（CLAUDE.md）。"
---

# T0418 — Docker 埠暴露與可達性（BUG-097）

## 背景

- `electron/docker-lifecycle.ts` 以 `'-p', \`${port}:9876\`` 發布埠 → host 所有介面暴露（PLAN-036 後 `pty:create` 已上線，可連即為 container root shell）
- `docker/Dockerfile` ENTRYPOINT 不帶 bind 設定 → bat-server 綁 container 的 127.0.0.1，推測 docker 轉發連不到
- `docker/Dockerfile` HEALTHCHECK 打 `/health`，`electron/remote/remote-server.ts` 無此路由

## 範圍

1. host 端 `-p 127.0.0.1:${port}:9876`；找出所有建立 docker run 參數的地方（含測試斷言）
2. container 內 bat-server 改為對 container 介面 bind：確認 bat-server 讀哪個設定（`--bind-interface` / `BAT_REMOTE_BIND` 等，見 `scripts/bat-server.mjs` / `electron/remote/headless-entry.ts`），用 Dockerfile ENV 或 ENTRYPOINT 參數設定 `all`
3. HEALTHCHECK 依 memory_overrides 第 2 條處理
4. 單元測試：docker run 參數斷言 `127.0.0.1:` 前綴
5. **runtime 驗證**：若本機 `docker` 可用（`docker version` exit 0），build image 後 `docker run`，以既有 TLS 連線方式（例如 `npm run smoke:remote:headless` 若支援 dir / host target，或 `electron/remote` 的 client）連 `127.0.0.1:<port>`，並 `docker inspect` health 狀態；docker 不可用則在回報區標明 runtime lane 未驗證，不算失敗

## 驗收條件

- [ ] `docker-lifecycle.ts` publish 綁 loopback，測試鎖住
- [ ] container bind + HEALTHCHECK 修正，回報區附理由
- [ ] `npm run test:unit` 全綠（基線 1867）；`npx tsc --noEmit` ≤ 40
- [ ] runtime lane：有 docker → 附連線 / health 證據；無 docker → 明記未驗證

## Sub-session 執行指示
1. 讀本工單 + BUG-097 + CLAUDE.md「Remote 資安」節
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**；BUG-097 改 `FIXED` 並填 `links.fix_workorder: T0418`
5. `git commit --only` 實際改動檔 + 本工單 + BUG-097；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（source / build-test lane 全 PASS；runtime lane **未驗證**——本機 Docker daemon 未啟動，依工單第 5 點不算失敗）

#### Landing Zone Check

- **PASS** — C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）；C-1 PASS；C-3 testable entries 皆 present（informational）；C-2 無 `branch` 欄位
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（evidence only）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

| 檔案 | 改動 |
|------|------|
| `electron/docker-lifecycle.ts` | 新增 `export const DOCKER_PUBLISH_HOST = '127.0.0.1'`；`docker run` publish 改為 `-p 127.0.0.1:${port}:9876`（原 `${port}:9876` 綁 host 全介面） |
| `docker/Dockerfile` | ① ENTRYPOINT 加 `"--bind-interface", "all"`（container 內 bind `0.0.0.0`，docker 轉發才可達）② `ENV BAT_PORT=9876` → `ENV BAT_SERVER_PORT=9876`（`scripts/bat-server.mjs` 讀的是 `BAT_SERVER_PORT`，`BAT_PORT` 在 image 內無人讀；不帶 `--port` 時原本會跑在預設 `54321`，與 `EXPOSE 9876` / HEALTHCHECK 不一致）③ HEALTHCHECK 改為以 bundle 內 `/opt/bat-server/bin/node` 做 **TLS handshake** 探測 |
| `scripts/verify-docker-image.mjs` | `EXPECTED_COMMAND` 同步新 HEALTHCHECK；新增 `EXPECTED_ENTRYPOINT` 斷言（鎖 `--bind-interface all`） |
| `src/components/setup-wizard/steps/docker/start-server.ts` | `waitForHealthy` 等待上限 5s → 45s（見下方理由） |
| `electron/__tests__/docker-lifecycle.test.ts`（新） | 6 tests：publish 斷言 `127.0.0.1:` 前綴（預設埠 / 自訂埠 / 帶 mounts+volume）、非法 container 名不呼叫 docker、Dockerfile 契約（ENTRYPOINT `--bind-interface all`、HEALTHCHECK 走 `tls.connect` 且不含 `/health` / `http://`、`ENV BAT_SERVER_PORT=9876`） |

**安全不變式**：host loopback publish 與 container `--bind-interface all` 在**同一個 commit** 落地（memory_overrides 第 1 條）。

**HEALTHCHECK 決策理由**（memory_overrides 第 2 條，擇「改為可連線檢查」而非移除）：
- RemoteServer 是 TLS/WSS 端點、無 HTTP 路由；不加明文 `/health`、不用明文 curl
- 選 TLS handshake（`tls.connect` + `rejectUnauthorized:false`，握手完成即 `end()` + exit 0；error / 4s timeout → exit 1）而非純 `net.connect`：多證明一層「TLS 端點真的起來了」，且不會在 server 端留下未完成 handshake 的連線；不送任何 token / HTTP request，跳過憑證驗證僅用於本機存活探測
- 保留 HEALTHCHECK（不移除）：wizard `start-server` 步驟與 `getContainerHealth` IPC 依賴 `healthy` / `unhealthy` 狀態；移除後只會回 `none` 而失去 crash 偵測
- 用 bundle 自帶 node（`verify-docker-image.mjs` 已斷言 `/opt/bat-server/bin/node` 存在），image 無需新增依賴；`curl` 套件仍保留（未刪，避免擴大範圍）
- 時序參數（30s / 5s / 10s / 3）不變，`verify-docker-image.mjs` 的 `EXPECTED_HEALTHCHECK` 不動

**wizard 等待時序（附帶修正，屬 affects_files 範圍）**：原 `waitForHealthy` 只等 10 × 500ms = 5s；Docker 首次 probe 在 `--interval=30s` 之後（未支援 / 未設 `--start-interval` 的 engine），container 前 30s 都是 `starting` ⇒ 即使 HEALTHCHECK 修好，wizard 仍必然 timeout。改為等到 45s（interval 30s + timeout 5s + 餘裕）。未加 `--start-interval`：舊版 builder / engine 可能不認得此 flag，風險大於收益。

#### 驗證證據

| Lane | 結果 | 證據 |
|------|------|------|
| source | PASS | Dockerfile `CMD` 行與 `verify-docker-image.mjs` `EXPECTED_COMMAND` 以 node 逐字比對 `match: true`；`node --check scripts/verify-docker-image.mjs` OK |
| probe 行為（本機模擬） | PASS | 以 `sh -c` 執行 Dockerfile 的 HEALTHCHECK 指令（node 路徑換本機 `node`）：對本機 selfsigned TLS server（`0.0.0.0:19876`）→ `exit=0`；對關閉埠 `19877` → `exit=1` |
| unit test | PASS | `npx vitest run electron/__tests__/docker-lifecycle.test.ts` 6/6；`npm run test:unit` **115 files / 1889 passed / 1 skipped**（基線 1867；增量含本工單 6 + 平行 Worker 新測試）。stderr 有 `conpty_console_list_agent.js AttachConsole failed` / `not a git repository` 雜訊，為既有測試輸出，不影響結果 |
| typecheck | PASS | `npx tsc --noEmit` **40** 個 error（≤ 40），grep 確認無一落在本工單改動檔 |
| build | 未跑 | 依 memory_overrides 第 3 條（L141）不跑 `npx vite build` / `npm run test:e2e` |
| runtime（docker） | **未驗證** | `docker version` → client `29.8.2`，server 連線失敗 `open //./pipe/docker_engine: The system cannot find the file specified.`（exit 1）。未 build image、未 `docker run`、未 `docker inspect` health、未做 TLS 連線 `127.0.0.1:<port>` |

### 遭遇問題

- **Scope 偏差（已做）**：`scripts/verify-docker-image.mjs` 不在 `affects_files`，但它逐字斷言舊 HEALTHCHECK 指令，不同步即令 image 驗證腳本必然失敗；依範圍第 1 點「含測試斷言」視為耦合契約一併更新
- **Scope 外、未做（建議塔台開單）**：
  1. `docs/docker-deployment.md` 仍有 6 處 `/health` / `curl -k https://127.0.0.1:9876/health` / `${BAT_PORT}` 說明（:76 / :127 / :135 / :142 / :161 / :189 / :256），`docs/plan-007-release-checklist.md:84` 亦提 `/health`——已與 image 實況不符，需改為 TLS 探測說明與 `docker inspect --format '{{.State.Health.Status}}'`
  2. **既有 container 不會被修正**：`startContainer` 非 `createIfMissing` 路徑只做 `docker start`，修復前建立的 container 仍是 `-p <port>:9876`（host 全介面）且跑舊 image（container 內綁 127.0.0.1 ⇒ 實際連不上）。需使用者刪除重建，或另開工單做偵測（`docker inspect` `HostConfig.PortBindings` 的 `HostIp` 為空 / `0.0.0.0` 時警告並引導重建）
  3. runtime lane 待 Docker Desktop 起來後補驗：`npm run build:docker-image`（或 `node scripts/build-docker-image.mjs`）→ `node scripts/verify-docker-image.mjs` → wizard 新建 container → `docker inspect` health 轉 `healthy`、`docker port <name>` 顯示 `127.0.0.1:<port>`、BAT 連線成功
- **殘餘風險**：
  - publish 只綁 IPv4 `127.0.0.1`；wizard `connect-test` / profile 使用 `localhost`。Node 24（Electron 41）`net` 預設 `autoSelectFamily=true`，`::1` 被拒時會 fallback 到 `127.0.0.1`，推論可連，但未 runtime 實測
  - container 內 `0.0.0.0` 對同一 docker network 上的其他 container 可達（仍需 token + TLS）；host LAN 不可達
- 平行 Worker 的未提交改動（`electron/main.ts`、`electron/handlers/git.ts`、`electron/remote/remote-client.ts`、`src/App.tsx` 等）未觸碰，commit 以 `--only` 排除

### 回報時間

2026-10-05T05:43:52+08:00
