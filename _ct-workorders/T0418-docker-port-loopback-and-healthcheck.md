---
schema_version: 1
schema_kind: workorder
id: T0418
title: "BUG-097：Docker 遠端 host 埠綁 127.0.0.1、container 內 bat-server 對 container 介面 bind、HEALTHCHECK 修正"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-097
priority: P1
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: null
updated_at: "2026-10-05T05:35:22+08:00"
completed_at: null
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

### 產出摘要

### 遭遇問題

### 回報時間
