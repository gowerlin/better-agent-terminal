---
schema_version: 1
schema_kind: workorder
id: T0502
title: "Setup wizard：pick-container 選「Use existing」但無容器時 retry 卡死（containerMode 驗證通過後才寫入）+ configure-ssh-host 無 alias 時無法手動輸入 host"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-13T23:41:46+08:00"
started_at: null
updated_at: "2026-10-13T23:41:46+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0500"
related:
  - "T0500 回報區「觀察」1：第一次執行 `pick-container` 選「Use existing」但沒有容器 → 失敗後 retry 因 `containerMode` 已存成 `'existing'` 不再詢問，一直失敗，只能 cancel"
  - "T0500 回報區「觀察」2：`configure-ssh-host.ts:123` 錯誤訊息寫「or type host」，但 UI 沒有手動輸入 host 的管道，`~/.ssh/config` 無 alias 時無法完成"
  - "T0500 `resetForEdit` / `*EditRequested` 旗標設計；T0444 / T0489 擁有權與 rollback 規則"
affects_files:
  - "src/components/setup-wizard/steps/docker/pick-container.ts"
  - "src/components/setup-wizard/steps/ssh/configure-host.ts"
  - "src/components/setup-wizard/"
  - "src/locales/"
  - "src/components/setup-wizard/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不改任何 rollback 語意（T0444 / T0489 / T0500）；`containerMode` 延後寫入不得讓 rollback 失去判斷本次建立容器所需的資訊（測試證明）"
  - "🔴 手動輸入 host：若 wizard context 沒有文字輸入能力，可新增（例如 `ctx.requestText`）並在 Shell 實作；需三語 i18n；輸入以 SSH host 合法字元白名單驗證（CLAUDE.md 外部輸入規則：`/^[a-zA-Z0-9._-]+$/`，user@host / port 是否支援依既有 profile 欄位決定並說明）"
  - "🔴 不改 `integration.transitions.test.ts`；新測試放新檔"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md；`npm run typecheck` 維持 0"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0502 — wizard 兩個卡死路徑

## A. pick-container retry 卡死

- `containerMode` 改為選擇通過驗證（例如「Use existing」時確實有容器）後才寫入 `ctx.state`；或失敗時讓 retry 重新詢問（擇一並說明）
- 測試：選 existing 無容器 → 失敗 → retry 重新詢問 → 改選 new 成功；rollback 擁有權不變

## B. configure-ssh-host 手動輸入

- 無 alias（或使用者選「手動輸入」）時提供文字輸入 host；驗證後寫入 `sshHost` / `profileDraft.sshHost`
- 錯誤訊息與 UI 一致（若仍無法手動輸入則改訊息，但本單目標是提供輸入）
- 測試：無 alias → 手動輸入成功；不合法輸入被拒；有 alias 時行為不變；T0500 跳回重問仍正常

## 驗收條件

- [ ] A / B 單元測試；`npx vitest run src/components/setup-wizard`
- [ ] `npm run test:unit`、`npm run typecheck`、`npx vite build`
- [ ] 回報區：設計選擇、i18n key、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0500 / T0489 回報區 + 相關 steps 與 Shell
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
