---
schema_version: 1
schema_kind: workorder
id: T0477
title: "README 過期資訊修正：badge（version / electron / platform）、技術堆疊表、「發行」段改為本 fork 實際流程"
type: implementation
status: TODO
repo: better-agent-terminal
project: docs
priority: P3
sizing: S
created_at: "2026-10-13T20:03:17+08:00"
started_at: null
updated_at: "2026-10-13T20:03:17+08:00"
completed_at: null
target_version: v0.6.0-pre.4
depends_on:
  - T0476
related:
  - "T0476 回報區 B 段「另注意」（badge `version-2.1.3` / `electron-28.3.3`、發行段範例 `v2.1.4`）"
  - "CLAUDE.md「Release」節（預覽版走 `pre-release.yml` workflow_dispatch、版號必須顯式指定、gh 一律帶 -R）"
  - "D136（mac 只 arm64）"
affects_files:
  - README.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改 README.md；不 push、不觸發 workflow、不建 tag；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持檔案現況"
---

# T0477 — README 過期資訊修正

## 背景

README 多處停在上游 v2.1.x / Electron 28 時期，與本 fork（`v0.6.x`、Electron 41、Vite 7、mac 只 arm64）不符。

## 範圍

### A. Badge（`README.md:7-10`）

塔台決定（避免再次過期）：
- **Version**：改用動態 badge，取本 fork 最新 release（含 prerelease），例如 `https://img.shields.io/github/v/release/gowerlin/better-agent-terminal?include_prereleases&label=version`；連結到 `https://github.com/gowerlin/better-agent-terminal/releases`
- **Electron**：改用讀 `package.json` 的動態 badge（`https://img.shields.io/github/package-json/dependency-version/gowerlin/better-agent-terminal/dev/electron`；electron 在 `devDependencies`，請以實際欄位確認路徑），或靜態 `electron-41`。擇一並在回報區說明理由
- **Platform**：反映 D136——例如 `Windows | macOS (Apple Silicon) | Linux`
- License badge 不動
- shields.io URL 請以 `curl -sI` 或等效方式確認回 200 且為 SVG（唯讀網路請求可以）

### B. 技術堆疊表（`README.md:187-197`）

依 `package.json` 實際相依核對每一列：React / TypeScript、Electron 41、Vite 7 + electron-builder 26 等。特別核對：
- 「儲存 | better-sqlite3」：先以 grep 確認 app 是否真的使用 better-sqlite3（T0473 發現無任何 import）；若未使用，改寫為實際的設定 / 資料儲存方式或刪除該列，回報區附 grep 證據
- 「AI」列：如已整合 Codex（`@openai/codex-sdk` 等，以 `package.json` 為準）則一併列出
- 不要列沒有實際使用的技術

### C. 「發行」段（`README.md:202-221`）

改寫為本 fork 實際流程（以 CLAUDE.md「Release」節為準，簡述即可，不必全文照搬）：
- 版號範例改為 `v0.6.0` / `v0.6.0-pre.3`
- 預覽版：`gh workflow run pre-release.yml -R gowerlin/better-agent-terminal -f version=X.Y.Z-pre.N`（版號必須顯式指定、不帶 `v`）
- 正式版：push `vX.Y.Z` tag 觸發 `release.yml`
- 「VSCode Task『CI/CD: 觸發 Pre-Release』」：確認 `.vscode/tasks.json` 是否存在該 task 且帶 `-R` / 顯式版號；不存在或會留空版號則刪除該句，回報區說明

### D. 其他

- 全文 grep `2\.1\.[0-9]`、`28\.3`、`Electron 28`、`Vite 5`、`x64.*dmg` / Intel Mac 相關描述，列出並修正明確過期者；「致謝」段的上游署名保留
- 不改功能描述段落的內容（除非與上述版號 / 平台直接衝突）

## 驗收條件

- [ ] README 無 `version-2.1.3`、`electron-28`、`Electron 28`、`Vite 5`、`v2.1.4`
- [ ] badge URL 皆可取得（回報區附 HTTP 狀態）
- [ ] 技術堆疊表每列有 `package.json` 或 grep 依據
- [ ] 發行段指令與 CLAUDE.md「Release」一致
- [ ] 回報區附 `git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + README + `package.json` + CLAUDE.md「Release」節
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案與 README；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
