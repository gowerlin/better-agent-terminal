---
schema_version: 1
schema_kind: workorder
id: T0427
title: "BUG-097 後續：偵測修復前建立的 Docker container（host publish 未綁 127.0.0.1 / 舊 image），警告並引導重建"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-097
priority: P1
sizing: S
created_at: "2026-10-05T05:47:15+08:00"
started_at: null
updated_at: "2026-10-05T05:47:15+08:00"
completed_at: null
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

### 產出摘要

### 遭遇問題

### 回報時間
