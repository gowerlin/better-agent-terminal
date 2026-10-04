---
schema_version: 1
schema_kind: workorder
id: T0428
title: "Docker 文件同步 T0418：移除明文 /health 說明，改為 TLS 探測 + docker inspect health；BAT_PORT → BAT_SERVER_PORT；loopback publish 說明"
type: documentation
status: PENDING
repo: better-agent-terminal
project: BUG-097
priority: P2
sizing: S
created_at: "2026-10-05T05:47:15+08:00"
started_at: null
updated_at: "2026-10-05T05:47:15+08:00"
completed_at: null
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

### 產出摘要

### 遭遇問題

### 回報時間
