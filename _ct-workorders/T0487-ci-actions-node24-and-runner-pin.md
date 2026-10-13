---
schema_version: 1
schema_kind: workorder
id: T0487
title: "CI 執行環境：GitHub Actions 改用原生 Node 24 的版本（消除 Node 20 deprecated 警告）+ ubuntu-latest 改為明確版本（10/19 起改 Ubuntu 26）"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-13T23:13:05+08:00"
started_at: null
updated_at: "2026-10-13T23:13:05+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on: []
related:
  - "pre.3 / pre.4 CI annotations：`actions/checkout@v4`、`actions/setup-node@v4`、`actions/upload-artifact@v4`、`actions/download-artifact@v4` 被強制以 Node 24 執行；`The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026`"
  - "CLAUDE.md「Release」「Packaging / Release 前置檢查」（CI pipeline 順序不可變）"
affects_files:
  - ".github/workflows/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改 `uses:` 版本與 `runs-on:` 標籤，以及版本升級必要的參數調整；job / step 順序、條件、指令不變"
  - "🔴 每個新版本須以 `gh api` / release notes（唯讀）確認存在、原生 Node 24、breaking changes；影響本 repo 用法者逐條說明調整"
  - "🔴 server-bundle 刻意用 `ubuntu-22.04`（glibc 相容）——不改"
  - "🔴 **批次並行（D139）**：同一工作樹有其他 Worker 同時進行。commit 一律 `git commit --only <本單檔案…>`，不得 stage / commit 他人檔案；全套測試或 build 若因他人未提交的 WIP 失敗，於回報區列出失敗檔與歸屬，並以本單檔案相關測試為準（不得為此修改他人範圍的檔案）"
  - "🔴 **不改 `CLAUDE.md`**（除非本單 frontmatter 另有授權）：需更新的文件內容寫在回報區「CLAUDE.md 建議文字」，由 T0493 統一套用"
  - "🔴 tsc：本單改動的檔案不得新增 `tsc` 錯誤（總數會因 T0486 並行變動，以檔案為單位比較）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime，結束只刪自己建立的目錄"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）；換行維持各檔現況"
---

# T0487 — CI 執行環境：GitHub Actions 改用原生 Node 24 的版本（消除 Node 20 deprecated 警告）+ ubuntu-latest 改為明確版本（10/19 起改 Ubuntu 26）

## A. Actions 版本

- 盤點所有 workflow 的 `uses:`（含第三方 release / dispatch actions），列出現行版本、建議版本、是否原生 Node 24、breaking changes
- 升級到原生 Node 24 的 major；upload / download artifact 需成對相容（artifact 名稱、`merge-multiple`、保留期等行為差異要確認）
- 第三方 action 若無 Node 24 版本，列出並維持現狀

## B. Runner 標籤

- 所有 `ubuntu-latest` 改為明確版本，預設 `ubuntu-24.04`（目前實際使用、維持 AppImage glibc 基線）；選其他版本須說明理由
- `macos-latest` / `windows-latest` 是否釘版：評估後回報建議（本單不改，除非有即將遷移的公告證據）

## 驗收條件

- [ ] 所有 workflow YAML 可解析（js-yaml）；若可用，以 actionlint 類工具檢查（不可用則說明）
- [ ] 回報區附 `uses:` 對照表與證據連結；`git diff --stat`
- [ ] 實跑驗證留待 pre.5 CI（塔台觀察）

## Sub-session 執行指示

1. 讀本工單 + D139 + 「related」列出的來源 + affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
