# 工單 T0249-release-v0.3.1-local-prepare

## 元資料
- **工單編號**：T0249
- **任務名稱**：v0.3.1 hotfix release 本地準備（CHANGELOG + bump + commit，不 push 不 tag）
- **狀態**：DONE
- **類型**：execution
- **intervention_type**：fire-and-forget
- **affects_files**：
  - `CHANGELOG.md`
  - `package.json`
  - `package-lock.json`
- **建立時間**：2026-04-23 19:12 (UTC+8)
- **開始時間**：2026-04-23 19:27 (UTC+8)
- **完成時間**：2026-04-23 19:33 (UTC+8)
- **關聯 BUG**：BUG-058（VERIFY 中，本工單完成後由使用者手動 push + tag 觸發 CI build → 實測 → CLOSED）
- **關聯工單**：T0247（filter fix, commit `a460d8b`）+ T0248（預防機制, commits `a73a965` + `1009154`）
- **關聯版本**：v0.3.0 → v0.3.1 hotfix

## 工作量預估
- **預估規模**：小（3 檔編輯 + 1 commit）
- **Context Window 風險**：低
- **降級策略**：無需降級

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：YOLO 模式 BAT 派發

## 規格層級自問

- [x] **目標層**：執行（明確輸出：3 檔修改 + 1 commit）
- [x] **決策權歸屬**：Worker 按 CHANGELOG 既有格式自行決定措辭細節，scope 已明示
- [x] **資訊完整度**：commit hash + BUG-058 背景 + 本工單提供完整 entry 草稿 → 足夠
- [x] **回頭成本**：A 級（本地 commit 可 reset --soft 或 revert）
- [x] **記憶覆蓋**：無衝突

## 任務指令

### 前置條件
需載入的文件清單：
- `CHANGELOG.md`（參考既有 entry 格式，在頂部新增）
- `package.json`（version 欄位）
- `package-lock.json`（根層 + `packages[""]` 的 version 欄位）
- `_ct-workorders/BUG-058-bat-helper-scripts-missing-in-packaged-install.md`（BUG 背景）
- `_ct-workorders/T0247-fix-bug058-extraresources-filter-glob.md`（filter fix）
- `_ct-workorders/T0248-prevent-helper-bundle-drift-static-check.md`（預防機制）
- `CLAUDE.md` § Release（release 命名慣例參考）

### 輸入上下文

BUG-058（🔴 High）：v0.3.0 NSIS installer 打包漏 `_bat-logger.mjs` + `_bat-cert.mjs`，根因是 `package.json` `build.extraResources[0].filter` 嚴格白名單漏列兩個 `_bat-*.mjs` 依賴。

修復鏈已完成：
- **T0247**（`a460d8b`）：filter 改 glob 白名單 `["*.mjs"]`
- **T0248**（`a73a965` + `1009154`）：新增 `verify-helper-bundle.js` import graph 靜態驗證 + CLAUDE.md 備忘

現在需要以 **v0.3.1 hotfix** 形式釋出。本工單只做**本地準備**，不做 push / tag（Worker 嚴禁 push + tag；release 觸發由使用者手動執行）。

### 具體範圍

#### 1. 更新 `CHANGELOG.md`

在頂部（最新 entry 上方）新增 v0.3.1 entry。**格式要對齊既有 CHANGELOG 慣例**（Worker 讀 CHANGELOG 最前面一兩個 entry 學格式後照抄）。

**內容要點**（Worker 可潤飾措辭，重點資訊必須包含）：

```markdown
## [0.3.1] - 2026-04-23

### Fixed
- **BUG-058**: Packaged NSIS installer missing `_bat-logger.mjs` and `_bat-cert.mjs` helper dependencies.
  Root cause: `package.json` `build.extraResources[0].filter` was a strict whitelist that only included
  `bat-terminal.mjs` and `bat-notify.mjs`, dropping their ESM relative imports.
  Fixed by switching to glob whitelist `["*.mjs"]` (commit `a460d8b`).

### Added
- **Build-time fail-fast for helper bundle drift**: New `scripts/verify-helper-bundle.js` statically
  parses every `scripts/*.mjs` relative `.mjs` import and checks that each target is covered by
  `extraResources[].filter`. Integrated into `npm run build` / `build:dir` / `build:release` pipelines,
  plus a standalone `npm run verify:helpers` entry point. Prevents future regressions of the BUG-058
  class when new helpers or filter changes are introduced (commits `a73a965` + `1009154`).
```

**Worker 可自由決定**：
- 措辭細節（如「drift」要不要翻 / 怎麼翻，但若既有 CHANGELOG 是英文就保持英文）
- `### Fixed` / `### Added` section 是否與既有格式一致（若既有用 `### 修復` / `### 新增` 中文 section 則改成中文）
- 是否額外加 `### Changed` / `### Internal` 段描述（按現有 convention）

**Worker 不自由決定**：
- 版本號（必須 `0.3.1`）
- 日期（必須 `2026-04-23`）
- BUG-058 + commit hash 必須引用
- 兩大變更都要列（Fixed 類 + Added 類）

#### 2. 更新 `package.json`

```
"version": "0.3.0"   →   "version": "0.3.1"
```

#### 3. 更新 `package-lock.json`

同步 bump version。至少兩處需要改：
- 根層 `"version": "0.3.0"` → `"0.3.1"`
- `"packages"` 物件中 `""` key（代表 root package）的 `"version"` 欄位

Worker 用 `jq` / 手動 edit / `npm version --no-git-tag-version 0.3.1` 皆可。

> ⚠️ **不要跑 `npm install`**：會引入其他 dep tree 變動。只改 version 欄位。

> ⚠️ **不要用 `npm version 0.3.1`**（不帶 `--no-git-tag-version`）：預設會自動 commit + tag，違反本工單「不 tag」規則。

#### 4. Commit

```bash
git add CHANGELOG.md package.json package-lock.json
git commit -m "chore(release): v0.3.1"
```

Commit 訊息嚴格用 `chore(release): v0.3.1`（對齊 CLAUDE.md release 慣例與專案 commit 歷史）。

### 預期產出

- `CHANGELOG.md` 新增 v0.3.1 entry
- `package.json` version `0.3.1`
- `package-lock.json` version 同步
- 1 個 commit（`chore(release): v0.3.1`）

### 驗收條件

- [ ] `CHANGELOG.md` 頂部新增 `## [0.3.1] - 2026-04-23` entry，包含 BUG-058 修復 + verify-helper-bundle.js 預防兩大變更
- [ ] BUG-058 + commit hash（T0247 `a460d8b`、T0248 `a73a965` + `1009154`）皆有引用
- [ ] `package.json` `"version": "0.3.1"`
- [ ] `package-lock.json` 根層 + `packages[""]` 雙處 version 皆為 `"0.3.1"`
- [ ] commit 訊息為 `chore(release): v0.3.1`
- [ ] commit 包含三個檔案（只有這三個，無其他變動）
- [ ] **未** `git push`
- [ ] **未** `git tag`

### 不在本工單範圍（🚨 硬限制）

- **🚨 禁止 `git push`**：本工單嚴禁推送到遠端
- **🚨 禁止 `git tag`**：本工單嚴禁建立 tag（tag 會觸發 GitHub Actions release workflow）
- **🚨 禁止 `npm version` 不帶 `--no-git-tag-version` 的用法**：會自動 commit + tag
- **其他變更**：不動 source code、不跑 build、不動 electron/ renderer 等任何目錄

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 讀取 `CHANGELOG.md` 前幾個 entry 學格式
4. 在頂部新增 v0.3.1 entry
5. 改 `package.json` version 0.3.0 → 0.3.1
6. 改 `package-lock.json` 兩處 version 0.3.0 → 0.3.1
7. `git status` + `git diff` 確認改動範圍
8. `git add` 三個檔 → `git commit -m "chore(release): v0.3.1"`
9. `git log -1` 確認 commit 成功
10. 填寫回報區 + 狀態 + 完成時間

### 執行注意事項
- **嚴禁 push / tag**：違反即 FAILED
- **嚴禁 npm install**：只改 version，不 resolve dep tree
- **CHANGELOG 格式要對齊現有 convention**：讀前 2 個 entry 照抄格式
- **Version 檢查**：改完後跑 `grep -n '"version"' package.json package-lock.json` 確認只有 `0.3.1` 出現在預期位置

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
DONE

### 產出摘要

**Commit**: `eca8ab6` — `chore(release): v0.3.1`

**修改檔（3 檔，exactly）**：
- `CHANGELOG.md`：頂部 `## [Unreleased]` 下方、`## [0.3.0]` 上方新增 `## [0.3.1] — 2026-04-23 — Hotfix: Packaged Helper Bundle` entry，英文對齊 v0.3.0 既有慣例（`### Fixed` + `### Added` sections）。
  - **Fixed**：BUG-058 全文引用 + commit `a460d8b`（filter 改 glob whitelist `["*.mjs"]`）
  - **Added**：`scripts/verify-helper-bundle.js` 描述 + commits `a73a965` + `1009154`（build pipeline 整合 + CLAUDE.md 備忘）
- `package.json`：`"version": "0.3.0"` → `"0.3.1"`（line 3）
- `package-lock.json`：雙處 `0.3.0` → `0.3.1`（line 3 root、line 9 `packages[""]`）

**verification**：
- `git diff --cached --stat` 顯示 `3 files changed, 13 insertions(+), 3 deletions(-)`
- `git log -1 --stat` 確認 commit 僅含三個檔案
- `git tag --list 'v0.3.1'` 為空 → 未建立 tag ✅
- 未執行 `git push`、`npm install`、`npm version`（只做文字級 Edit）

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用（此為 release 準備工單，無 sprint 背景）

### 回報時間
2026-04-23 19:33 (UTC+8)
