---
schema_version: 1
schema_kind: workorder
id: T0365
title: "BUG-071：desktop release 自動發佈 server-bundle-v* + 修正預設下載網址 owner"
type: fix
status: PENDING
priority: P1
sizing: S
created_at: "2026-10-04T13:12:47+08:00"
updated_at: "2026-10-04T13:12:47+08:00"
started_at: null
completed_at: null
target_version: "0.5.9-pre.3"
depends_on: []
related:
  - "BUG-071（FIXING，本工單為修復載體）"
  - "D120（本工單決策依據）"
  - "PLAN-031（server bundle distribution）"
  - "D092（per-host baseline matrix）/ D093（server-bundle-v* 獨立 tag 命名）/ D095（BAT_SERVER_BUNDLE_BASE_URL override）"
affects_files:
  - src/lib/arch-normalize.ts
  - src/lib/__tests__/server-bundle-download.test.ts
  - scripts/fetch-baseline-tarball.mjs
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - docs/server-bundle-distribution.md
  - CLAUDE.md
  - CHANGELOG.md
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不要 push、不要推任何 tag、不要觸發 workflow、不要建立任何 GitHub release**。本工單只交付 source + workflow 檔案改動；發 `v0.5.9-pre.3` 與確認 release 產出由塔台在你回報後執行。"
  - "🔴 **網址格式不改**：仍是 `<base>/server-bundle-v<版號>/<asset>`。只改 owner（`anthropics` → `gowerlin`）。不要改成掛在 desktop `v<版號>` release 上（D120 已否決該選項）。"
  - "🔴 `gh` 指令若需要（唯讀查詢）一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "不改 `build-server-bundle.yml`（手動 tag 線保留為備援，D120 未廢除它）。"
---

# T0365 — BUG-071：desktop release 自動發佈 `server-bundle-v*` + 修正預設下載網址 owner

- **狀態**：PENDING
- **任務類型**：fix（程式 + CI workflow + 文件）
- **工作量預估**：S
- **Context Window 風險**：低~中（8 檔，workflow 兩檔需讀全段 job）

## 背景

BUG-071 原症狀（wizard install-bundle step placeholder throw）已由 PLAN-031 修掉，installer 也內建了 linux-x64 baseline。但塔台 2026-10-04 複查發現 **runtime fallback 下載整條斷線**（詳見 `BUG-071` 檔尾「第四十九 session 複查」、`_decision-log.md` D120）：

1. `src/lib/arch-normalize.ts:28` `DEFAULT_RELEASE_BASE_URL = 'https://github.com/anthropics/better-agent-terminal/releases/download'` —— **該 repo 不存在**（404）。`scripts/fetch-baseline-tarball.mjs:217,319` 同樣寫死；`src/lib/__tests__/server-bundle-download.test.ts` 有斷言引用
2. `gowerlin/better-agent-terminal` 上 **0 個** `server-bundle-v*` release。`pre-release.yml` / `release.yml` 的 `server-bundle-manifest` job 只把 baseline 上傳成 Actions artifact `server-bundle-baseline`（`release.yml:103-111`、`pre-release.yml:138-146`），從未發佈到 Release
3. runtime 下載流程（`electron/remote/server-bundle-download.ts`）會依序抓 `manifest.json` → tarball（含 sha256 驗證），網址為 `${base}/server-bundle-v${version}/...`

## 範圍

### Part A — 預設下載網址 owner

- `src/lib/arch-normalize.ts` `DEFAULT_RELEASE_BASE_URL` → `https://github.com/gowerlin/better-agent-terminal/releases/download`
- `scripts/fetch-baseline-tarball.mjs` 兩處（:217、:319）同步改，並把檔頭註解 :30 的範例網址一起改
- 更新 `src/lib/__tests__/server-bundle-download.test.ts` 的相關斷言
- 完成後 `grep -rn "anthropics/better-agent-terminal" --exclude-dir=node_modules --exclude-dir=_ct-workorders .`（排除建置產物目錄）須為 0

### Part B — desktop workflow 自動發佈 server bundle release

在 `pre-release.yml` 與 `release.yml` **各自**新增發佈步驟，規格：

| 項目 | 要求 |
|------|------|
| 來源 | 下載同一 run 的 `server-bundle-baseline` artifact（沿用既有 artifact，**不要**重建 tarball） |
| tag | `server-bundle-v<版號>`，版號取 `needs.prepare.outputs` 中與 desktop 相同的版號（**不帶** `v` 前綴的那個值；desktop tag 是 `v<版號>`）—— 請讀 `prepare` job 確認 output 名稱 |
| 資產 | 3 arch × (`bat-server-<arch>-v<版號>.tar.gz` + `.sha256`) + `manifest.json`。檔名須與 `server-bundle-download.ts` / `server-bundle-download-helpers.ts` 組出的 URL **完全一致**——請讀這兩檔核對，不要憑推測 |
| prerelease | 恆為 `true`（與 `build-server-bundle.yml:160` 一致；避免成為 repo 的 Latest release） |
| 時機 | **desktop release 發佈成功之後**才發（`needs` 依賴 desktop `release` job，或在同一 job 內接在 desktop release step 之後）。build 失敗時不得留下孤兒 server-bundle release |
| target commit | 與 desktop release 同一 commit |
| 權限 | 確認 job 有 `contents: write` |
| release body | 簡短說明即可，例如「Server bundle for BAT v<版號>. Consumed by the setup wizard runtime download; not for manual install.」 |

action 沿用 repo 既有的 `softprops/action-gh-release@v1`，參數寫法參考 `build-server-bundle.yml:153-168`。

### Part C — 文件

- `CLAUDE.md`：「Server bundle 是獨立 tag 線」節（及「Server bundle baseline（PLAN-031）」節中 `Server bundle release（獨立 tag）` 那條）補上：自 D120 起 `pre-release.yml` / `release.yml` 發佈 desktop release 時**同時自動發佈** `server-bundle-v<版號>`；`build-server-bundle.yml` 手動 tag 線保留為備援。預設下載來源為 gowerlin
- `docs/server-bundle-distribution.md`：對應段落同步（若有提到預設網址或發佈流程）
- `CHANGELOG.md` `## [Unreleased]` → `### Fixed` 補一筆（refs: BUG-071, T0365, D120）

## 明確排除（不要做）

- ❌ 不要 push / 推 tag / `gh workflow run` / `gh release create`（見 memory_overrides）
- ❌ 不要改 `build-server-bundle.yml`
- ❌ 不要改網址格式、manifest schema、tarball 命名、`BAT_SERVER_BUNDLE_BASE_URL` override 邏輯
- ❌ 不要改 D092 per-host baseline matrix（Windows installer 仍只內建 linux-x64）
- ❌ 不要做 PLAN-031 AC-9「升級既有 server UI」
- ❌ 不要碰 `AGENTS.md`（既有 dirty）
- ❌ 不要 bump `package.json` 版號（塔台發版時處理）

## 驗收條件

- [ ] AC-1 `anthropics/better-agent-terminal` 在原始碼 / scripts / 測試 / 文件中 grep 為 **0**（排除 `node_modules`、`_ct-workorders`、建置產物）
- [ ] AC-2 `npm run test:unit` 全綠，基線 **550**（不得減少）
- [ ] AC-3 `npx vite build` 成功
- [ ] AC-4 兩個 workflow YAML 語法有效（以 `node -e` + `js-yaml` 或 repo 既有可用工具 parse 成功；若本機有 `actionlint` 亦可跑）
- [ ] AC-5 在回報區列出：新步驟所在 job 名、`needs` 鏈、tag 運算式、`files:` 清單，並逐一對照 `server-bundle-download*.ts` 組出的 URL 證明資產檔名一致（**附上兩邊的程式碼行號**）
- [ ] AC-6 `git diff --stat` 僅動 `affects_files`

> **驗證 lane 說明**：本工單交付 source / build / test / YAML 靜態驗證。release 是否真的產出 `server-bundle-v0.5.9-pre.3`、資產能否下載、wizard 實機能否跑完，屬 CI / runtime lane，由塔台發版後驗收，**不在本工單**。

## Sub-session 執行指示

1. 讀取本工單全部內容 + `BUG-071` 檔尾複查段 + `_decision-log.md` D120
2. 填入 `started_at`、`status: IN_PROGRESS`（**用 `date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，見全域 R-G001）
3. 讀 `src/lib/arch-normalize.ts`、`src/lib/server-bundle-download-helpers.ts`、`electron/remote/server-bundle-download.ts`（URL 組法）
4. 讀 `pre-release.yml` / `release.yml` 的 `prepare` / `server-bundle-manifest` / `release` job 全段，與 `build-server-bundle.yml` release job
5. 實作 Part A → B → C
6. 跑 AC-1 ~ AC-6
7. 填寫回報區、更新 `status` / `completed_at` / `updated_at`
8. commit（`git commit --only` 精確指定 `affects_files` 中實際改動的檔），訊息建議：`fix(server-bundle): auto-publish server-bundle-v* with desktop release; fix default base URL owner (T0365)`
9. 依 `auto-session: on` 協定通知塔台（`bat-notify.mjs`，**不加 `--submit`**）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 驗收條件逐項

### 遭遇問題

### 回報時間
