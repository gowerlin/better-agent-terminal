---
schema_version: 1
schema_kind: workorder
id: T0570
title: "發佈文件補齊：CHANGELOG.md / release-note.md 從 GitHub Releases 補齊 v0.4.3 起到 v0.6.1-pre.7 的所有版本；README.md 與現況對齊"
type: docs
status: IN_PROGRESS
repo: better-agent-terminal
project: release-docs
priority: P2
sizing: M
created_at: "2026-10-16T17:58:28+0800"
updated_at: "2026-10-16T18:06:21+0800"
started_at: "2026-10-16T18:06:21+0800"
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

### 結果摘要

DONE。`CHANGELOG.md` / `release-note.md` 補齊 v0.4.3 起到 v0.6.1-pre.7 的 32 個 desktop 版本（`server-bundle-v*` 未列），最新在上；`[Unreleased]` 已清空；`README.md` 修正 7 處與現況不符的描述。只改程式外的三個文件與本工單；未 push、未動 GitHub Release、未建 tag。

### Landing check

- C-0：PASS（frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：PASS；C-3：PASS（三個文件皆存在）；C-2：無 `branch` 欄位（目前 `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 啟動時 status 為 `TODO`（非 `PENDING`），照常改為 `IN_PROGRESS`

### 每版資料來源

日期 = `gh release view --json publishedAt` 轉 UTC+8。

| 版本 | 日期 | 來源 |
|------|------|------|
| v0.6.1-pre.7 | 2026-10-16 | release body |
| v0.6.1-pre.6 | 2026-10-16 | release body |
| v0.6.1-pre.5 | 2026-10-16 | release body |
| v0.6.1-pre.4 | 2026-10-16 | release body |
| v0.6.1-pre.3 | 2026-10-15 | release body |
| v0.6.1-pre.2 | 2026-10-15 | release body |
| v0.6.1-pre.1 | 2026-10-15 | release body |
| v0.6.0-pre.11 | 2026-10-15 | release body |
| v0.6.0-pre.10 | 2026-10-14 | release body |
| v0.6.0-pre.9 | 2026-10-14 | release body |
| v0.6.0-pre.8 | 2026-10-14 | release body |
| v0.6.0-pre.7 | 2026-10-14 | release body |
| v0.6.0-pre.6 | 2026-10-14 | release body |
| v0.6.0-pre.5 | 2026-10-14 | release body |
| v0.6.0-pre.4 | 2026-10-13 | release body |
| v0.6.0-pre.3 | 2026-10-13 | release body |
| v0.6.0-pre.2 | 2026-10-05 | 依 commit 整理 |
| v0.6.0-pre.1 | 2026-10-05 | 依 commit 整理 |
| v0.5.9-pre.4 | 2026-10-04 | 依 commit 整理（CHANGELOG 用原 `[Unreleased]` 條目） |
| v0.5.9-pre.3 | 2026-10-04 | 依 commit 整理（同上） |
| v0.5.9-pre.2 | 2026-09-02 | 依 commit 整理（同上） |
| v0.5.9-pre.1 | 2026-09-01 | 依 commit 整理（同上） |
| v0.5.8 | 2026-05-24 | 依 commit 整理 |
| v0.5.7 | 2026-05-23 | 依 commit 整理 |
| v0.5.6 | 2026-05-17 | 依 commit 整理 |
| v0.5.5 | 2026-05-17 | 依 commit 整理 |
| v0.5.4 | 2026-05-17 | 依 commit 整理 |
| v0.5.3 | 2026-05-15 | 依 commit 整理（自動 body 只列 PR #18） |
| v0.5.2 | 2026-05-15 | 依 commit 整理 |
| v0.5.1 | 2026-05-07 | 依 commit 整理 |
| v0.5.0-pre.2 | 2026-04-28 | 依 commit 整理 |
| v0.4.3 | 2026-04-27 | 依 commit 整理 |

- 「依 commit 整理」的版本在兩個檔案的該版標題下都標註了「（依 commit 整理）」，release-note 另補上以上一個 desktop tag 為基準的 `Full Changelog` 連結（原自動內容的基準常是 `server-bundle-v*`）。
- commit 篩選：工單寫的 `grep -v "(ct)"` 會一併濾掉 `fix(ct): …` 這類 scope 為 `ct` 的實際修正（例 T0360 / T0361、T0359、PLAN-034），因此改為只排除結尾是 `(ct)` 的記帳 commit，再人工略過工單 / state 記帳類 commit。
- CHANGELOG 分類：`新增` → Added、`修正` → Fixed、`更新` / `打包與建置` / `打包與相依` / `其他` → Changed、`已知事項` → Known issues（沿用 `[0.4.2]` 段既有的標題）；`重點` 的每一條依內容分到 Added / Fixed / Changed；`⚠️` 段（pre.3 Intel Mac、pre.4 資料目錄）在 CHANGELOG 濃縮成一條 Changed，完整表格留在 release-note；`已驗收` 段只放 release-note。每版開頭「版號 … 接續 …」、結尾 macOS 一行與 `Full Changelog` 只放 release-note。

### `[Unreleased]` 搬移結果

15 條全部已發佈（`git blame` 找出新增該條的 commit，再 `git tag --contains` 取第一個 desktop tag），內容逐字搬移（以排序比對確認一致）：

- v0.5.9-pre.4：Fixed T0374、T0372、T0371、T0370、T0367；Changed T0373、T0370、T0369
- v0.5.9-pre.3：Fixed T0365；Changed T0363
- v0.5.9-pre.2：Fixed T0362
- v0.5.9-pre.1：Fixed T0360、T0361；Changed T0360、T0361

`v0.6.1-pre.7..HEAD` 只有兩筆 `(ct)` 記帳 commit，`[Unreleased]` 留空段。`[0.4.2]` 以下逐字未動（`diff` 確認）。

### release-note.md

- 開頭 `# Release Notes — Better Agent Terminal（gowerlin fork）`，每版 `## v<版號>（<日期>）`，內容 = GitHub 更版重點全文（含 `Full Changelog` 一行），版本之間以 `---` 分隔。
- 原上游 v2.1.x 內容移到最下方 `## 上游歷史（tony1223/better-agent-terminal v2.1.x）`，文字未改。
- **偏離**：為了讓標題層級一致，release body 內的 `##` 標題與上游段的 `##`–`####` 標題各降一級（版本標題才是 `##`）。上游段只改了標題層級，沒有改文字。

### README 修改點

1. 「AI Agent 整合」補一行：用量限制自動繼續（PLAN-044，pre.6）
2. 「Control Tower 整合」補一行：Worker / 塔台分頁標題、`--close-worker` 回收、右鍵批次關閉（PLAN-041 / T0553 / T0562）
3. 「Remote dev support」補兩行：多個遠端 profile 同時連線（PLAN-039）、遠端 AI 工具面板（PLAN-037 / pre.5 nvm）
4. 「Remote dev support」的 server bundle 分發描述：原「installer 內建 baseline + GitHub Release fallback」已不符（D146 / pre.4 起安裝檔不內建），改為「第一次設定時下載並快取，離線可匯入本機 tarball」
5. 「其他功能」：「環境變數編輯器」改為「工作區設定（環境變數、預設 Agent、啟動參數）」（PLAN-040）；補一行終端貼上規則（BUG-128 / BUG-130）
6. 多語系：原列 7 種語言，`src/locales/` 實際只有 `en` / `zh-TW` / `zh-CN`，改為三語
7. 「發行」版號範例 `v0.6.0` / `v0.6.0-pre.3` → `v0.6.1` / `v0.6.1-pre.7`，並加上 release-note.md / CHANGELOG.md 連結

平台說明（macOS 只有 arm64）、預覽版 / 正式版流程、資料目錄說明已與現況相符，未改。

### 驗證

- 標題結構：`grep "^## "` 確認 CHANGELOG 32 個版本段 + `[Unreleased]`，順序由新到舊，`[0.4.2]` 以下不變；release-note 只有 32 個版本標題與上游歷史為 `##`
- 三個檔案皆為 LF（`grep -c $'\r'` = 0；`.gitattributes` 為 `eol=lf`，index 本來就是 LF）
- 只是文件變更，未跑 build / test

### 觀察（給塔台）

- `CHANGELOG.md` 既有的 `## [0.4.2] — 2026-05-23` 段，內容實際是在 tag v0.5.0-pre.2–v0.5.8 期間發佈的（當時 `package.json` 仍為 0.4.1 / 0.4.2，tag 已是 v0.5.x）。依工單不改該段，只在 v0.5.0-pre.2 與 v0.5.8 兩段加註說明。
- v0.4.3 的 BUG-075 修正 commit 引用的 T0341 / T0343 與 PLAN-032 的 T0341 編號重複（當時跨專案工單編號撞號），已照 commit 原文記錄。

### Commit

見 frontmatter `commit`（`git commit --only` 四個檔：`CHANGELOG.md`、`release-note.md`、`README.md`、本工單；`src/styles/settings.css` 未納入）。
