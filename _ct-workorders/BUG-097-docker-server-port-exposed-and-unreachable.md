---
schema_version: 1
schema_kind: bug
id: BUG-097
title: "Docker 遠端：`-p` 未綁 host 127.0.0.1（全介面暴露）、container 內 bat-server 綁 127.0.0.1（推測連不上）、HEALTHCHECK `/health` 無路由"
status: FIXED
severity: high
reproducibility: unknown
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-05T05:43:39+08:00"
impact:
  - docker-remote
  - security
links:
  fix_workorder: T0418
  related: [T0386, PLAN-036]
---

# BUG-097 — Docker 埠暴露與可達性

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（PLAN-036 P0 上線 `pty:create` 後，Docker profile 一旦可連即為 LAN 上的 container root shell；目前推測連不上，暴露面有限） |
| 可重現 | 未實測（程式碼證據 + 推測） |
| **狀態** | 🔧 FIXED（T0418，等 runtime 驗收：本機 Docker daemon 未起，image build / `docker run` / health 未實測） |
| 回報者 | T0386 Worker（研究目標 5 安全） |

## 現象（程式碼證據）

- `electron/docker-lifecycle.ts:75` `'-p', \`${port}:9876\`` —— 未綁 `127.0.0.1`，host 所有介面暴露（塔台 23:56 複核）
- container 內 bat-server 不帶 `--bind-interface`（`docker/Dockerfile:22` ENTRYPOINT）⇒ 綁 container 自己的 127.0.0.1，**推測** `-p` 轉發連不到
- `docker/Dockerfile:20` HEALTHCHECK 打 `/health`，`electron/remote/remote-server.ts` 無此路由

## 修復方向

- host 端 `-p 127.0.0.1:${port}:9876`；container 內 `--bind-interface all`；補 `/health` 或移除 HEALTHCHECK
- 驗證：本機 `docker run` 後以 TLS 連 `127.0.0.1:<port>`、`docker inspect` health 狀態

## 修復（T0418）

- host 端 `-p 127.0.0.1:${port}:9876`（`electron/docker-lifecycle.ts` `DOCKER_PUBLISH_HOST`），單元測試鎖住
- `docker/Dockerfile` ENTRYPOINT 加 `--bind-interface all`；`ENV BAT_SERVER_PORT=9876`（取代無人讀的 `BAT_PORT`）
- HEALTHCHECK 改為 bundle node 的 TLS handshake 探測（不加 HTTP `/health`）；`scripts/verify-docker-image.mjs` 同步
- wizard `waitForHealthy` 等待 5s → 45s（首次 probe 在 interval 30s 後）
- 待驗：Docker 可用時 build image → `verify:docker-image` → wizard 新建 container → health `healthy`、`docker port` 為 `127.0.0.1:<port>`、BAT 連線成功；既有 container 需重建（見 T0418 回報區）
