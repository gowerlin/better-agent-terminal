---
schema_version: 1
schema_kind: workorder
id: T0506
title: "SSH profile 顯示：空 user（alias）不再顯示成 user@host:22 + `configure-host-invalid` 補 error-mapper entry（三語）"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P3
sizing: S
created_at: "2026-10-14T00:31:26+08:00"
started_at: null
updated_at: "2026-10-14T00:31:26+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0505"
related:
  - "T0505 回報區「後續建議」：`src/components/profiles/details/SshDetails.tsx:17` 對空 user 顯示 `{sshUser || 'user'}@host:{port || 22}`，alias profile 看起來像缺資料；`configure-host-invalid` 沒有 error-mapper entry，走 fallback"
  - "`src/components/setup-wizard/error-mapper.ts:324`（`ssh-configure-host-empty` entry 為範本）；T0502 `configure-host-invalid` 的產生點"
affects_files:
  - "src/components/profiles/details/SshDetails.tsx"
  - "src/components/setup-wizard/error-mapper.ts"
  - "src/locales/"
  - "src/components/profiles/"
  - "src/components/setup-wizard/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 顯示規則：空 user → 只顯示 host（可加「由 ~/.ssh/config 決定使用者」提示，三語）；port 未設 → 不顯示 `:22`（或顯示為預設值的明確標示，擇一說明）；有值時顯示不變"
  - "🔴 error-mapper：`configure-host-invalid` entry 比照 `ssh-configure-host-empty`（標題 / 內文 / 建議動作；有 edit-config 跳回時指向 `configure-ssh-host`），三語；i18n completeness 測試通過"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md；`npm run typecheck` 維持 0"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0506 — SSH 顯示與錯誤對應

## 實作

1. `SshDetails.tsx`：依 memory_overrides 顯示規則修改；其他顯示 SSH target 的地方（profile 列表、標題等）一併 grep 檢查同類寫法
2. `error-mapper.ts`：新增 `configure-host-invalid` entry + 三語 locale key
3. 測試：顯示（空 user / 有 user / 無 port / 有 port）；mapper 命中與動作

## 驗收條件

- [ ] 單元測試；`src/locales/__tests__/i18n-completeness.test.ts` 通過
- [ ] `npm run test:unit`、`npm run typecheck`、`npx vite build`
- [ ] 回報區：其他顯示點清單與處置、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0505 / T0502 回報區 + 相關檔案
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
