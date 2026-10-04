---
schema_version: 1
schema_kind: workorder
id: T0425
title: "BUG-098：移除 SSH 精靈 direct 模式，只保留 tunnel；既有 direct 設定 / profile 的相容處理"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-098
priority: P2
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: null
updated_at: "2026-10-05T05:35:22+08:00"
completed_at: null
target_version: next
depends_on:
  - T0424
related:
  - "BUG-098；BUG-093 / T0387（direct 模式驗證打 `<sshHost>:<serverPort>`）；BUG-097（同類暴露面）"
  - "D134（使用者 05:33 裁決：移除 direct，不修通）"
affects_files:
  - src/components/setup-wizard/steps/ssh/
  - src/components/setup-wizard/steps/wsl/write-profile.ts
  - src/components/setup-wizard/__tests__/
  - electron/remote/ssh-start-server.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/types/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **決策已定（D134）：移除 direct，不修通**。不要為 direct 設計對外 bind。遠端 bat-server 維持 `BAT_REMOTE_BIND=localhost`。"
  - "🔴 **相容性**：盤點 direct 模式值存在哪裡（精靈狀態、`configure-host` 選項、profile 欄位、設定檔）。已存在的 direct 值（例如舊 profile / 中途存檔的精靈狀態）必須**有定義的行為**：優先視為 tunnel；若無法安全轉換，載入時清楚提示而非靜默失敗。型別中若 `'direct'` 為 union 成員，移除後確認所有讀取點編譯通過。"
  - "🔴 依賴 T0424（同改 i18n 三語檔）。開工前 `git log --oneline -3` 確認。"
  - "🔴 同工作樹有其他 Worker 平行。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0425 — 移除 SSH direct 模式（BUG-098）

## 背景

SSH 精靈 direct 模式整條路徑不通：遠端 bat-server 固定綁 localhost（`ssh-start-server.ts` systemd / launchd 段）、profile 固定寫 `remoteHost: 'localhost'`（`write-profile.ts` SSH 分支）、`~/.ssh/config` alias 不解析 HostName。使用者裁決移除 direct，只留 tunnel（預設、安全、已可用）。

## 範圍

1. grep `'direct'` / connection mode 相關欄位於 `src/components/setup-wizard/**`、`electron/remote/**`、型別、i18n
2. 移除 UI 選項、direct 專屬驗證分支（`verify-remote.ts` 等）、只為 direct 存在的 i18n key
3. 相容處理（memory_overrides 第 2 條）
4. 測試：精靈只產出 tunnel；舊 direct 值的相容行為；`ssh-verify-remote.test.ts` 等既有測試同步

## 驗收條件

- [ ] 回報區附 direct 值出現點盤點與相容處理說明
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 40
- [ ] BUG-098 改 `FIXED`（處理方式：移除）並填 `links.fix_workorder: T0425`

## Sub-session 執行指示
1. 讀本工單 + BUG-098 + T0387 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + BUG-098；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
