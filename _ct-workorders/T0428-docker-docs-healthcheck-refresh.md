---
schema_version: 1
schema_kind: workorder
id: T0428
title: "Docker 文件同步 T0418：移除明文 /health 說明，改為 TLS 探測 + docker inspect health；BAT_PORT → BAT_SERVER_PORT；loopback publish 說明"
type: documentation
status: DONE
repo: better-agent-terminal
project: BUG-097
priority: P2
sizing: S
created_at: "2026-10-05T05:47:15+08:00"
started_at: "2026-10-05T05:49:09+08:00"
updated_at: "2026-10-05T05:50:31+08:00"
completed_at: "2026-10-05T05:50:31+08:00"
target_version: next
depends_on: []
related:
  - "T0418 回報區「遭遇問題」Scope 外 1；commit `b17b0ba`"
  - "D134 追加（使用者 05:46 斷點 C 裁決）"
affects_files:
  - docs/docker-deployment.md
  - docs/plan-007-release-checklist.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **只改文件**，不改程式碼。內容以 `b17b0ba` 後的實際檔案為準：`docker/Dockerfile`（HEALTHCHECK / ENTRYPOINT / ENV）、`electron/docker-lifecycle.ts`（`-p 127.0.0.1:<port>:9876`）、`scripts/verify-docker-image.mjs`。"
  - "🔴 RemoteServer 是 TLS / WSS 端點，沒有 `/health` 路由——文件**不得**再出現 `curl … /health`。存活檢查改寫為 `docker inspect --format '{{.State.Health.Status}}' <name>`、`docker port <name>`（應顯示 `127.0.0.1:<port>`）、BAT 連線測試。"
  - "🔴 補一段「修復前建立的 container」說明：舊 container 仍是全介面 publish + 舊 image，需刪除重建（指令範例只放正確寫法）。"
  - "🔴 同工作樹有其他 Worker 平行。不需跑測試（純文件），但 commit 前 `git status` 確認只提交上述兩檔 + 本工單。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0428 — Docker 文件同步

## 背景

T0418（`b17b0ba`）把 Docker 遠端的健康檢查改為 TLS handshake 探測、host publish 綁 `127.0.0.1`、`ENV BAT_PORT` 更正為 `BAT_SERVER_PORT`。文件仍描述舊行為：`docs/docker-deployment.md` :76 / :127 / :135 / :142 / :161 / :189 / :256 與 `docs/plan-007-release-checklist.md:84` 提及 `/health` 或 `BAT_PORT`。

## 範圍

1. 逐處更正上述位置（行號可能漂移，以 grep `/health`、`BAT_PORT` 為準）
2. 新增 / 更新「埠暴露與安全」說明：host 只綁 loopback、container 內 bind all 的原因
3. 新增「修復前建立的 container」段

## 驗收條件

- [ ] `grep -n "/health\|BAT_PORT\b" docs/docker-deployment.md docs/plan-007-release-checklist.md` 無過時描述（若保留需是「已移除」的歷史說明）
- [ ] 回報區附修改處清單

## Sub-session 執行指示
1. 讀本工單 + T0418 回報區 + `docker/Dockerfile`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 修改 → 自檢
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 兩份文件 + 本工單；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

DONE

### 產出摘要

**Landing check**：PASS — C-0 `repo: better-agent-terminal` vs `basename(REPO_ROOT)=better-agent-terminal` 相符；C-1 工單位於 REPO_ROOT 下；C-3 兩檔皆存在；C-2 無 branch 欄位（HEAD=`main`）。`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。CT_MODE=yolo、CT_INTERACTIVE=0。

**內容依據**：`docker/Dockerfile`（HEALTHCHECK TLS 探測 / `ENV BAT_SERVER_PORT=9876` / ENTRYPOINT `--bind-interface all`）、`electron/docker-lifecycle.ts`（`DOCKER_PUBLISH_HOST='127.0.0.1'`、`-p 127.0.0.1:<port>:9876`）、`scripts/verify-docker-image.mjs`（逐字斷言 HEALTHCHECK 指令與時序）、T0418 回報區。

**修改處清單**

`docs/docker-deployment.md`
1. Container Behavior：port 行補 `ENV BAT_SERVER_PORT`；entrypoint 更正為 `tini -- bat-server --bind-interface all`
2. 原 :76 `curl -fk "https://127.0.0.1:${BAT_PORT}/health"` → 新 `### Health check` 小節：說明 RemoteServer 為 TLS/WSS、無 HTTP 路由；貼實際 node TLS handshake 指令、時序（30s/5s/10s/3）、`rejectUnauthorized:false` 理由、與 verify 腳本耦合；加「舊版 `/health` 與 `BAT_PORT` 已移除（BUG-097 / T0418）」歷史註記；host 端改用 `docker inspect --format '{{.State.Health.Status}}'`
3. 新增 `### Port exposure and security`：host 只綁 loopback（`-p 127.0.0.1:<port>:9876`）、container 內 bind all 的原因（docker forward 經 container 網卡，container 內綁 127.0.0.1 會連不上）、安全前提與殘餘暴露（同 docker network 其他 container 可達，仍需 token + TLS）；`docker port <name>` 應顯示 `127.0.0.1:<port>`
4. Dev Container Integration 範例 `-p 9876:9876` → `-p 127.0.0.1:9876:9876`，並加連結至安全段
5. 新增 `## Containers created before the BUG-097 fix`：mode A / reconnect 只 `docker start`、不改 port binding 與 image；舊 container 為全介面 publish + 舊 image（container 內綁 127.0.0.1 連不上、healthcheck 恆 unhealthy）；以 `docker port` 判別，`npm run build:docker-image` → `docker rm -f <name>` → wizard mode B / Re-run wizard 重建；data volume 保留 `server-token.json` / `server-cert.json`，無 volume 時需 Pin expected fingerprint（指令範例只放正確寫法）
6. 原 :127 Restart self-heal → `docker inspect` health + `docker port` + BAT 重連
7. 原 :135 Host reboot → BAT 連線測試 + `docker inspect` health
8. 原 :142 OOM / crash → BAT 連線測試 + health 回 `healthy`
9. 原 :161 Manual Smoke Test：`docker run --rm --name bat-server-smoke -p 127.0.0.1:9876:9876`；`curl.exe … /health` → `docker port`（期望 `9876/tcp -> 127.0.0.1:9876`）+ `docker inspect` Status / json + BAT profile 連線測試
10. 原 :189 HEALTHCHECK failing → 依序檢查 `.State.Health` Log、`docker logs`、`printenv BAT_SERVER_PORT`、修復前 container 指引
11. 原 :256 Release Pre-Flight：smoke 指令綁 loopback；`curl … /health` → `docker port` 檢查（smoke 與 mode B 皆須 `127.0.0.1`）、`docker inspect` health、BAT 連線測試

`docs/plan-007-release-checklist.md`
12. 原 :84 `/health reports healthy` → `docker inspect --format '{{.State.Health.Status}}'` 回 `healthy`（註明無 `/health` 路由）；新增 `docker port` 僅 `127.0.0.1:<port>` 檢查項

**驗收**
- source/docs lane：`grep -n "/health\|BAT_PORT" docs/docker-deployment.md docs/plan-007-release-checklist.md` → 剩 7 處，全部為「無 `/health` 路由 / 已移除 / 舊 image 探測不存在路由」的說明，無過時操作指示 — PASS
- build / tests：純文件，依工單不跑 — N/A
- runtime：未在 Docker 上實測文件中的指令（沿 T0418 runtime lane 待補驗）

### 遭遇問題

- 無阻斷。Scope 外觀察：`docs/docker-deployment.md` Prerequisites 仍寫「`feature/plan-007-remote-dev` branch」，與目前 main 開發不符，未改（非本單範圍）。
- `docs/docker-deployment.md` 工作樹為 LF（git 提示下次會轉 CRLF），既有狀態，未變動換行慣例。
- 同工作樹平行 Worker 的未提交改動（`electron/handlers/pty.ts`、`src/components/*` 等）未觸碰；commit 以 `--only` 限定兩份文件 + 本工單。

### 回報時間

2026-10-05T05:50:31+08:00
