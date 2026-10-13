---
schema_version: 1
schema_kind: workorder
id: T0495
title: "CI 加入 npm run typecheck 硬 gate（src/ 基線 0）"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-13T23:24:58+08:00"
started_at: null
updated_at: "2026-10-13T23:24:58+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0486"
  - "T0494"
related:
  - "T0486 回報區「CI gate 建議」1（`typecheck` 立即可設硬 gate；放 Linux job 或獨立輕量 job）"
  - "CLAUDE.md「Packaging / Release 前置檢查」CI pipeline 順序"
affects_files:
  - ".github/workflows/pre-release.yml"
  - ".github/workflows/release.yml"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只新增 typecheck gate；既有 job / step 順序、條件、指令不變。typecheck 失敗必須讓發版失敗（release job 不得在 typecheck 失敗時執行）"
  - "🔴 `typecheck:electron` 本單**不**加入 gate（基線 77，由 T0496 清零後加入）"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；T0492 / T0496 之後也會改 workflows，本單須先完成"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況（`pre-release.yml` 工作樹為 CRLF）"
---

# T0495 — CI typecheck gate

## 實作

- 在 `pre-release.yml` / `release.yml` 加入 `npm run typecheck`，擇一並說明理由：
  - (a) 獨立輕量 job（`ubuntu-24.04`，`npm ci --ignore-scripts` + `npm run typecheck`），列為 `build`（或 `release`）的 `needs`
  - (b) 放在 Linux build job 的 `npm ci` 之後、`verify-native-modules.js` 之前
- 評估 `--ignore-scripts` 對 typecheck 是否足夠（型別只需套件的 `.d.ts`）；若用 (a)，確認不會拖慢關鍵路徑（並行於 server-bundle）
- 驗證：js-yaml 解析；`go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7` 0 筆；讀 workflow 的既有單元測試（`scripts/__tests__/verify-packaged-native.test.mjs` 等）通過；本機 `npm run typecheck` = 0

## 驗收條件

- [ ] 兩個 workflow 都有 typecheck gate，失敗會阻擋 release（說明依賴鏈）
- [ ] YAML / actionlint / 既有測試通過；`git diff --stat`
- [ ] CLAUDE.md 建議文字（CI pipeline 順序段）；實跑留待 pre.5 CI

## Sub-session 執行指示

1. 讀本工單 + D139 + T0486 回報區 + 兩個 workflow
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
