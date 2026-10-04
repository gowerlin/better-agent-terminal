---
schema_version: 1
schema_kind: bug
id: BUG-097
title: "Docker 遠端：`-p` 未綁 host 127.0.0.1（全介面暴露）、container 內 bat-server 綁 127.0.0.1（推測連不上）、HEALTHCHECK `/health` 無路由"
status: OPEN
severity: high
reproducibility: unknown
created_at: "2026-10-04T23:58:00+08:00"
updated_at: "2026-10-04T23:58:00+08:00"
impact:
  - docker-remote
  - security
links:
  fix_workorder: null
  related: [T0386, PLAN-036]
---

# BUG-097 — Docker 埠暴露與可達性

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🔴 high（PLAN-036 P0 上線 `pty:create` 後，Docker profile 一旦可連即為 LAN 上的 container root shell；目前推測連不上，暴露面有限） |
| 可重現 | 未實測（程式碼證據 + 推測） |
| **狀態** | 📂 OPEN（建議在 PLAN-036 P0 上線前或同時修） |
| 回報者 | T0386 Worker（研究目標 5 安全） |

## 現象（程式碼證據）

- `electron/docker-lifecycle.ts:75` `'-p', \`${port}:9876\`` —— 未綁 `127.0.0.1`，host 所有介面暴露（塔台 23:56 複核）
- container 內 bat-server 不帶 `--bind-interface`（`docker/Dockerfile:22` ENTRYPOINT）⇒ 綁 container 自己的 127.0.0.1，**推測** `-p` 轉發連不到
- `docker/Dockerfile:20` HEALTHCHECK 打 `/health`，`electron/remote/remote-server.ts` 無此路由

## 修復方向

- host 端 `-p 127.0.0.1:${port}:9876`；container 內 `--bind-interface all`；補 `/health` 或移除 HEALTHCHECK
- 驗證：本機 `docker run` 後以 TLS 連 `127.0.0.1:<port>`、`docker inspect` health 狀態
