---
schema_version: 1
schema_kind: workorder
id: T0570
title: "發佈文件補齊：CHANGELOG.md / release-note.md 從 GitHub Releases 補齊 v0.4.3 起到 v0.6.1-pre.7 的所有版本；README.md 與現況對齊"
type: docs
status: TODO
repo: better-agent-terminal
project: release-docs
priority: P2
sizing: M
created_at: "2026-10-16T17:58:28+0800"
updated_at: "2026-10-16T17:58:28+0800"
started_at: ""
completed_at: ""
commit: ""
target_version: "docs（不需發版）"
depends_on: []
related:
  - "`_ct-workorders/_local-rules.md`「更版重點（Release notes）必寫」與「發佈後同步 repo 文件」（2026-10-16 使用者指示）"
affects_files:
  - CHANGELOG.md
  - release-note.md
  - README.md
  - _ct-workorders/T0570-backfill-changelog-release-notes.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改上列三個文件與本工單；不改程式碼、不改版號、不 push、不觸發 workflow、不建 tag、不改 GitHub Release 內容（`gh release edit` 禁止）；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`（`src/styles/settings.css` 的 M 不是你的變更）。"
  - "🔴 所有 `gh` 指令都帶 `-R gowerlin/better-agent-terminal`（L122；不帶會打到上游 tony1223）。只讀：`gh release list` / `gh release view --json tagName,name,body,publishedAt`。"
---

# T0570 — CHANGELOG / release-note 補齊

## 背景

使用者 2026-10-16 指示：每次發佈後同步更新 `README.md`、`release-note.md`、`CHANGELOG.md`（規則見 `_ct-workorders/_local-rules.md`「發佈後同步 repo 文件」），並要求第一次同步時**從 GitHub Releases 補齊 0.5.x 起所有版本**。

現況：
- `CHANGELOG.md`：最後一個版本段是 `## [0.4.2] — 2026-05-23`，之後的變更堆在 `## [Unreleased]`（英文，最新一筆約 T0374，2026-10-04）。
- `release-note.md`：仍是上游 `# Release Notes — v2.1.x`（v2.1.6 以下），不是本 fork 的內容。
- 本 fork desktop tag（2026-10-16）：`v0.4.3`、`v0.5.0-pre.2`、`v0.5.1`–`v0.5.8`、`v0.5.9-pre.1`–`pre.4`、`v0.6.0-pre.1`–`pre.11`、`v0.6.1-pre.1`–`pre.7`。`server-bundle-v*` 不是 desktop 版本，不列。

## 任務

1. **資料來源**：每個 desktop tag 以 `gh release view <tag> -R gowerlin/better-agent-terminal --json tagName,name,body,publishedAt` 取更版重點與發佈日期。release body 只有自動產生的一行 `Full Changelog`（或空白）時，改以 `git log --oneline <上一版>..<本版> | grep -v "(ct)"` 的 commit 整理成使用者看得懂的條列（附 BUG / PLAN / T 編號），並在該版標註「（依 commit 整理）」。
2. **`CHANGELOG.md`**：
   - 保留標題與 `[0.4.2]` 以前的既有段落不動。
   - `## [Unreleased]` 內已發佈的項目：以 `git tag --contains <commit>` 判斷落在哪一版，移進該版段落（內容保留，不必翻譯）；之後 `[Unreleased]` 只留真正未發佈的項目（沒有就留空段）。
   - 每版一段 `## [<版號>] — <YYYY-MM-DD>`（日期取 `publishedAt` 轉 UTC+8 的日期），最新在上；分類 `Added` / `Fixed` / `Changed`（沿用檔案既有的英文標題），條列可用該版更版重點的繁體中文內容。
3. **`release-note.md`**：改為本 fork 的版本紀錄。開頭 `# Release Notes — Better Agent Terminal（gowerlin fork）`，每版 `## v<版號>（<YYYY-MM-DD>）`，內容 = 該版 GitHub 更版重點（繁體中文，去掉每版結尾的 `Full Changelog` 連結可保留為最後一行），最新在上。原上游 v2.1.x 內容移到檔案最下方 `## 上游歷史（tony1223/better-agent-terminal v2.1.x）`，內容不改。
4. **`README.md`**：檢查功能、下載 / 平台支援、版號範例、發行流程描述是否與目前（0.6.1-pre.7）相符，只修不符之處（例：版號範例、平台說明、近期新功能若「功能特色」完全沒提到可補一行）。不重寫整份。
5. 回報區列出：每版的資料來源（release body / 依 commit 整理）、`[Unreleased]` 項目的搬移結果、README 修改點（或「無需修改」）。

## 驗收條件

- [ ] `CHANGELOG.md` 含 v0.4.3 起到 v0.6.1-pre.7 每個 desktop 版本一段，日期正確，最新在上；`[Unreleased]` 不再含已發佈項目
- [ ] `release-note.md` 為本 fork 版本紀錄（v0.6.1-pre.7 在最上），上游內容移到最下方
- [ ] `README.md` 與現況相符（或回報「無需修改」）
- [ ] Markdown 無斷裂（標題層級一致、表格 / 清單格式正確）；只 commit 上列檔案

---

## 回報區

> 以下由 sub-session 填寫
