---
schema_version: 1
schema_kind: workorder
id: T0507
title: "Setup wizard error-mapper 全面三語化：MESSAGE_DICT 與 action label 寫死 zh-TW → en / zh-CN 介面也顯示中文；改走 i18n key 並更新 T0341 visual contract"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-14T00:36:35+08:00"
started_at: null
updated_at: "2026-10-14T00:36:35+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0506"
related:
  - "T0506 回報區「後續建議」2：`ssh-configure-host-empty` 等 entry 走寫死 zh-TW 的 `MESSAGE_DICT`（`src/components/setup-wizard/error-mapper.ts:111` 起）與 action label；T0341 visual contract 測試鎖住 `修改 SSH 設定` / `取消`"
  - "T0506 新增的 `ssh-configure-host-invalid` entry（i18n key `wizard.ssh.error.hostInvalid.*` + Shell 以 `wizard.action.*` 翻譯 action）為範本；T0378 `lookupMessage` i18next 路徑"
affects_files:
  - "src/components/setup-wizard/error-mapper.ts"
  - "src/components/setup-wizard/"
  - "src/locales/"
  - "src/components/setup-wizard/__tests__/"
  - "src/locales/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 zh-TW 文案逐字保留（搬進 zh-TW locale）；en / zh-CN 新譯，術語與既有 locale 一致；不得改變 entry 的匹配規則（platforms / stepIds / errorCodes / patterns）與 actions 的 kind / targetStepId"
  - "🔴 T0341 visual contract：以「i18n 後在 zh-TW 下輸出不變」為準更新測試，並新增 en / zh-CN 斷言；不得只刪斷言"
  - "🔴 若 `MESSAGE_DICT` 仍有非 wizard 的 consumer（grep），保持相容或一併遷移並說明"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；`npm run typecheck` 維持 0"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0507 — wizard error-mapper 三語化

## 實作

1. 盤點 `error-mapper.ts` 所有 entry 的 message 來源（`MESSAGE_DICT` / i18n key）與 action label 寫死處；以及 Shell 端如何顯示（`lookupMessage`、action label 翻譯）
2. 全部改走 i18n key（比照 T0506 `ssh-configure-host-invalid`）；action label 由 Shell 以 `wizard.action.*` 翻譯（缺 key 補三語）
3. `MESSAGE_DICT` 移除或改為 key 對照（說明選擇）
4. 測試：每個 entry 三語皆有 title / body（completeness 守門）；T0341 visual contract 在 zh-TW 下不變、en / zh-CN 顯示對應語言

## 驗收條件

- [ ] entry 清單與遷移對照表（entry id → key）
- [ ] `npx vitest run src/components/setup-wizard src/locales`；`npm run test:unit`、`npm run typecheck`、`npx vite build`
- [ ] 回報區：`git diff --stat`、CLAUDE.md 建議文字（如需）

## Sub-session 執行指示

1. 讀本工單 + D139 + T0506 回報區 + `error-mapper.ts` + Shell 顯示 mapped error 的元件 + T0341 測試
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
