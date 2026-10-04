---
schema_version: 1
schema_kind: workorder
id: T0456
title: "遠端 helper 可用性收尾：headless PTY PATH 尾端附加 <installRoot>/bin + BAT_HELPER_NODE；bat-terminal.mjs 對 server 回 false（未建立）改 exit 1"
type: fix
status: PENDING
repo: better-agent-terminal
project: PLAN-036
priority: P2
sizing: S
created_at: "2026-10-05T07:07:03+08:00"
started_at: null
updated_at: "2026-10-05T07:07:03+08:00"
completed_at: null
target_version: next
depends_on:
  - T0434
related:
  - "T0434（`aeac517`）回報區「遭遇問題」2 / 3；WSL smoke S10 `node=missing`"
  - "D134 追加（塔台 07:07 依授權直接決定）"
affects_files:
  - electron/remote/headless-entry.ts
  - scripts/bat-terminal.mjs
  - electron/remote/__tests__/
  - scripts/__tests__/
  - tests/
  - CLAUDE.md
  - docs/remote-dev-overview.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 (1) `buildHeadlessHelperEnv` 有注入 helper env 時：PTY 的 `PATH` **尾端**附加 `<installRoot>/bin`（使用者自己的 node 仍優先；不得 prepend），並注入 `BAT_HELPER_NODE=<installRoot>/bin/node`（存在才注入）。無 helper env 時不動 PATH。`isHeadlessScrubbedEnvKey` 規則不變（`BAT_HELPER_NODE` 為顯式注入）。測試：PATH 尾端、key 集合（同步更新 T0434 S13 的 `REMOTE_TOWER_ENV_KEYS` drift 守門與 CLAUDE.md / docs 的 env 表）。"
  - "🔴 (2) `scripts/bat-terminal.mjs`：invoke 結果為 `false`（未建立）時印錯誤並 **exit 1**（不再印 `✓ Terminal created`）；`true` 照舊 exit 0、`{ ok:false }` 物件路徑（T0433）不變。這會影響本機路徑——先 grep 本機 `terminal:create-*` handler 何時回 false，回報區列出情境；塔台 auto-session 只信任 exit code（不讀 stdout），改為 exit 1 與之一致。"
  - "🔴 T0455 平行改 `remote-server.ts`（本單不碰）；T0454 平行改 `scripts/__tests__/`（不同測試檔即可，共用檔精準 stage）。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；不得以 `git show HEAD:… >` 覆寫取紅燈）；寫檔維持 LF（勿用文字模式 Python 寫出 CRLF，T0434 遭遇問題 5）；不 push；不部署 WSL。"
---

# T0456 — 遠端 helper node 與 bat-terminal exit code

## 驗收條件

- [ ] 測試：helper env 注入時 PATH 以 `<installRoot>/bin` 結尾、`BAT_HELPER_NODE` 正確；無 helper env 時 PATH 不變；bat-terminal `false` → exit 1
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0434 / T0433 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
