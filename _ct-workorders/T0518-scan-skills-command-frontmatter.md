---
schema_version: 1
schema_kind: workorder
id: T0518
title: "claude:scan-skills：commands 描述解析 YAML frontmatter（BUG-125）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-125
priority: P3
sizing: XS
created_at: "2026-10-14T04:03:26+0800"
target_version: "0.6.0-pre.7"
related:
  - BUG-125
  - "T0514（發現處，U4）"
affects_files:
  - electron/handlers/claude.ts
  - electron/__tests__/
  - electron/handlers/__tests__/
  - _ct-workorders/T0518-scan-skills-command-frontmatter.md
  - _ct-workorders/BUG-125-scan-skills-command-description-frontmatter.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 與 T0517 並行（T0517 改 `electron/remote/**`、`src/components/setup-wizard/**`、`src/locales/**`）：本單不改那些路徑；commit 用 `git commit --only` 或精準 `git add`。"
  - "🔴 不碰使用者正在用的 BAT；不消耗 Claude token。改 `electron/**` 驗收 `npm run typecheck:electron` = 0。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；寫檔 LF；不 push。"
---

# T0518 — scan-skills commands 描述（BUG-125）

## 任務

1. `electron/handlers/claude.ts` commands 分支（約 :297）：有 YAML frontmatter 時取 `description:`（與 skills 分支同規則，可抽共用函式），沒有才退回第一個非空行去 `#`；frontmatter 有但無 description → 取 frontmatter 之後第一個非空行
2. skills 分支行為不變（若抽共用函式，以測試證明 skills 結果不變）
3. 同一檔若還有其他「第一行當描述」處（如 star commands），一併檢查並在回報區說明是否處理

## 驗證

- 單元測試：有 / 無 frontmatter、frontmatter 無 description、引號包住的 description、CRLF 檔案
- `npm run typecheck:electron` = 0、`npx vite build` exit 0、`npm run test:unit` 全套通過

## 驗收條件

- [ ] 帶 frontmatter 的 command 顯示正確描述
- [ ] BUG-125：`status: FIXED`、`fixed_at`、body 狀態列與「根因與修正」同步

## Sub-session 執行指示

1. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
2. 實作 → 驗證 → 填回報區（DONE / PARTIAL / BLOCKED）
3. commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

