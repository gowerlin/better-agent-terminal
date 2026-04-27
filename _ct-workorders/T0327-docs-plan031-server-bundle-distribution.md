# T0327 — Docs PLAN-031 Server bundle distribution 用戶文件 + CLAUDE.md 更新

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0327 |
| 類型 | docs（user-facing 文件 + CLAUDE.md「Packaging/Release 前置檢查」段落更新 + 可能 README pointer） |
| 所屬 | PLAN-031 — Server Bundle Distribution / Sprint 5 |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-27 11:05 (UTC+8) |
| 派發時間 | 2026-04-27 11:05 (UTC+8) |
| 開始時間 | 2026-04-27 11:07 (UTC+8) |
| 完成時間 | 2026-04-27 11:11 (UTC+8) |
| Commit | bdd2f92 |
| Sizing | S（estimate 30-45 min wall） |
| 依賴 | T0314 ✅（spec 凍結） / T0315-T0325 ✅（全套實作 + tests） |
| 平行 | 無（Sprint 5 收尾，T0324/T0326 等下個 session） |
| 後續 | PLAN-031 結案 → BUG-071 CLOSED |
| 互動旗標 | `--mode yolo --no-interactive` |
| Renew 次數 | 0 |
| 工作目錄 | main repo |
| `affects_files` | `docs/server-bundle-distribution.md`（新建，user-facing） / `CLAUDE.md`（擴 Packaging/Release 段） / 可能 `README.md`（pointer if 已有 docs/ 引用結構） |

## 背景

PLAN-031 Sprint 1-5 已落地：
- Spec：`_ct-workorders/_spec-server-bundle-distribution.md`（T0314 內部 spec，凍結 D092-D098 拍板項）
- 實作：T0315-T0323（11 工單，11 commits，覆蓋 distribution stack）
- 測試：T0325（187 tests，含 11 download + 8 distributor integration + 8 playwright skeleton）

**還缺 user-facing 文件**：
1. `docs/server-bundle-distribution.md` — 給開發者/contributor 看，說明 BAT 如何取得 server bundle、debug 流程、私有部署
2. CLAUDE.md「Packaging / Release 前置檢查」更新 — 加入 `fetch:baseline` step + `dist-baseline/` 驗證 + server bundle release 工作流程

## 塔台已拍板項

| 編號 | 議題 | 決策（已寫入 spec §2）|
|------|------|----------------------|
| D092 | Baseline matrix | C-narrow + Mac 雙 tarball |
| D093 | Release tag namespace | 雙 Release（`vX.Y.Z` + `server-bundle-vX.Y.Z`） |
| D094 | Mac installer size | 280 MB cap |
| D095 | Fallback URL env | `BAT_SERVER_BUNDLE_BASE_URL` |
| D096 | Docker distributor fallback | v1 不做 |
| D097 | DGX Spark dogfood | user 親跑 |
| D098 | 升級既有 server UI | v0.5.0 含（T0326 範疇） |

## 範圍（3 deliverable）

### Deliverable 1：`docs/server-bundle-distribution.md`（新建）

**讀者**：BAT contributor / advanced user / 私有部署管理員。

**結構**（必填段落）：

```markdown
# BAT Server Bundle Distribution

## 動機（給未讀 spec 的人 30 秒理解）
為什麼 server bundle 需要獨立 distribution？BUG-071 + PLAN-031 簡述。

## Distribution 三層 lookup（運行時行為）
1. Cache（userData/bat-server-bundles/）
2. Baseline（installer 內建，installer 安裝後解壓到 resourcesPath/bat-server-baseline/）
3. Download（GitHub Release fallback）

## Per-host baseline matrix（C-narrow，D092）
| BAT host | 內建 tarball |
（同 spec §3.1 表）

## Architecture detection（三平台）
- WSL: execFile('wsl', ['-d', distro, '--', 'uname', '-m'])
- SSH: 重用 verify-auth probe（profile.sshServerArch）
- Docker: image-based（D096，不走 distributor）

## SHA256 manifest schema（簡化版）
引用 spec §9，含 example。

## 私有部署 / fork
設定 `BAT_SERVER_BUNDLE_BASE_URL` env：
- 範例：`export BAT_SERVER_BUNDLE_BASE_URL=https://my.cdn/bundles`
- 預期 endpoint 結構：/manifest.json + /bat-server-{arch}-v{ver}.tar.gz + /*.sha256

## GitHub Rate Limit 處理
- 預設 anonymous 60 req/hr
- 設 `GITHUB_TOKEN` env 提升至 5000 req/hr（spec §8 v2 候選）
- Rate-limited 時 BAT 顯示 actionable msg 含 reset time

## DGX Spark / ARM64 Linux 特別說明
- arch=linux-arm64 走 download fallback（C-narrow Mac/Win/Linux x64 host installer 不內建）
- `npm run fetch:baseline` 在 build 時自動取
- 若 BAT host=Linux arm64（如 Asahi）installer 才會內建 linux-arm64 baseline

## 升級既有 server bundle（v0.5.0+）
T0326 範疇預告：ProfilePanel 將提供「Upgrade server bundle」按鈕。

## 排錯
- 「Server bundle tarball not found」→ 跑 `npm run fetch:baseline` 或檢查網路
- 「baseline corrupted」→ 重跑 BAT installer
- 「rate-limited」→ 等 reset 或設 GITHUB_TOKEN
- 「unsupported-arch」→ remote 是 Supported Servers 矩陣外的 arch（非 x86_64/aarch64/darwin-arm64）

## 相關工單與決策
- PLAN-031 / D092-D098
- T0313 research / T0314-T0325 實作 + 測試 / T0324 dogfood
- 內部 spec：`_ct-workorders/_spec-server-bundle-distribution.md`
```

**寫作風格**：
- 中文 + technical English terms
- 引用具體檔名 + 命令（grep-friendly）
- 避免重述 spec 完整內容（pointer to spec）
- 開頭 30 秒讀者能 grok 「為什麼存在」+「怎麼用」

### Deliverable 2：CLAUDE.md「Packaging / Release 前置檢查」段落擴張

現有段落（line 151-158）只談 native modules + helper bundle 驗證。新增 server bundle baseline 段落：

```markdown
### Server bundle baseline（PLAN-031）

- **`npm run fetch:baseline` 在 build 前**：electron-builder build 前必跑（`prebuild` hook 已自動串接），從 GitHub Release 抓對應 host arch 的 baseline tarball 到 `dist-baseline/`
- **per-host matrix（C-narrow）**：
  - Win × x64 → `linux-x64`
  - Mac × arm64 → `linux-x64 + darwin-arm64`
  - Linux × x64 → `linux-x64`
  - Linux × arm64 → `linux-arm64`
- **fail-fast**：`scripts/verify-helper-bundle.js` 已擴 server bundle 檢查（T0316 落地），dist-baseline 缺 tarball 即 abort with actionable msg
- **Server bundle release（獨立 tag）**：`server-bundle-vX.Y.Z` tag push 觸發 `.github/workflows/build-server-bundle.yml`（與 desktop release `pre-release.yml` 完全解耦，spec §6 C-1 + D093）
- **Mac installer size cap**：280 MB（D094）；超出觸發塔台復議
- **私有 fork**：設 `BAT_SERVER_BUNDLE_BASE_URL` env override GitHub Release 預設（D095）
- **詳細**：見 `docs/server-bundle-distribution.md`
```

**插入位置**：CLAUDE.md「Packaging / Release 前置檢查」段尾（既有 4 個 bullet 之後）。

### Deliverable 3：README.md pointer（如適用）

如本專案 README.md 既有 `docs/` 連結結構（如 contributor section），新增 `docs/server-bundle-distribution.md` 的 pointer。

如 README.md 無此結構（純 user-facing intro）→ 跳過此 deliverable，不強行插入。

Worker 探查後決定。

## 範圍排除（不在本工單）

- ❌ 不寫 `_spec-server-bundle-distribution.md`（T0314 已落地，本工單僅 user-facing 文件）
- ❌ 不修 BUG-071（PLAN-031 結案後自動 CLOSE）
- ❌ 不寫 T0324 / T0326 內容（外部依賴）
- ❌ 不擴 `_decision-log.md`（D092-D101 等塔台 *sync 整理）
- ❌ 不改 production code

## 驗收條件

- AC-1：`docs/server-bundle-distribution.md` 存在，含 9 必填段落（動機 / 三層 lookup / matrix / arch detect / manifest / 私有部署 / rate limit / DGX Spark / 排錯 / 相關工單）
- AC-2：CLAUDE.md 「Packaging / Release 前置檢查」段尾擴 server bundle baseline 段落
- AC-3：README.md 評估後決定是否加 pointer（worker 回報判斷理由）
- AC-4：`npm run test:unit` 全綠（既有 187 tests 不破，本工單不新增 test）
- AC-5：`npx tsc --noEmit` 無新錯誤（本工單不改 .ts）
- AC-6：commit 訊息走 `chore(docs): T0327 - PLAN-031 server bundle distribution 用戶文件`

## Worker 守則

1. **不重述 spec**：spec §X 已有的內容，docs 用 pointer 引用，不複製貼上
2. **可 grep**：所有檔名 / 命令 / env 名用 backtick 包，便於 future grep
3. **30 秒讀者**：每段開頭一句話讓人能跳讀
4. **CLAUDE.md 紀律**：擴段落不重構既有結構，純追加
5. **README pointer**：探查 README.md 既有結構決定，不強行插入
6. **child_process 紀律**：本工單純 docs，無 child_process
7. **commit 紀律**：單 commit
8. **規範性 scope expansion**：照既有模式回報區標「out-of-scope but justified」
9. **記憶覆寫**：本工單**沒有** `memory_overrides` 欄位

## Worker 回報區（Worker 填寫）

### 1. docs/server-bundle-distribution.md 摘要

- 新建：`docs/server-bundle-distribution.md`（約 130 行）
- 9 必填段落齊全：
  1. 動機（PLAN-030 → BUG-071 → PLAN-031 30 秒交代）
  2. Distribution 三層 lookup（Cache / Baseline / Download，含實作入口）
  3. Per-host baseline matrix（C-narrow + Mac 雙 tarball，D092）
  4. Architecture detection（WSL `execFile uname` / SSH `verify-auth probe` / Docker image-based）
  5. SHA256 manifest schema（簡化版 + pointer 到 spec §9）
  6. 私有部署 / fork（`BAT_SERVER_BUNDLE_BASE_URL` env，含 endpoint 結構範例，D095）
  7. GitHub Rate Limit 處理（anonymous 60/hr + `GITHUB_TOKEN` v2 候選 + actionable msg 行為）
  8. DGX Spark / ARM64 Linux 特別說明（C-narrow 對 arm64 的影響 + D097 dogfood 引用）
  9. 排錯（6 症狀 × 解法表）
- 額外段落：升級既有 server bundle（v0.5.0+ T0326 預告，D098）+ 相關工單與決策（PLAN-031 + 7 拍板項 + BUG-071 + PLAN-007/027 cross-link）
- 寫作風格遵守：中文 + technical English term；檔名 / 命令 / env 用 backtick；不複製 spec 內容（pointer 引用）

### 2. CLAUDE.md 擴張摘要

- 插入位置：「Packaging / Release 前置檢查」段尾（既有 5 個 bullet 之後，「Release」段之前）
- 新增 subsection：`### Server bundle baseline（PLAN-031）`，共 8 個 bullet
- 不重構既有結構（純追加，遵守 worker 守則 4）
- 內容覆蓋：`fetch:baseline` prebuild hook / per-host matrix / verify-helper-bundle 擴 server bundle 檢查 / 獨立 release tag (`server-bundle-vX.Y.Z`) / Mac 280 MB cap / `BAT_SERVER_BUNDLE_BASE_URL` / pointer 到新 docs

### 3. README.md 處理（加 pointer / 不加）

**結論**：加 pointer。

**探查結果**：README.md「Remote dev support」段（line 77-81）已有 `[Remote Dev Overview](docs/remote-dev-overview.md)` pointer 慣例，server bundle distribution 與 remote dev 同主軸，新增為兄弟 bullet 自然不突兀。

**插入內容**：在 `詳見 [Remote Dev Overview](docs/remote-dev-overview.md)` 下方加一行：
> Server bundle 分發機制（installer 內建 baseline + GitHub Release fallback）詳見 [Server Bundle Distribution](docs/server-bundle-distribution.md)

**判斷理由**：worker 守則 5「探查 README.md 既有結構決定」滿足；既有 docs/ link 慣例已立，pointer 補完不需 over-engineering。

### 4. PARTIAL / 矛盾項（如有）

無。三項 deliverable 皆完成。

### 5. Out-of-scope but justified（如有）

無 scope expansion。本工單嚴格落在 user-facing docs + CLAUDE.md 擴段 + README pointer 三者範圍內。

### AC 驗收

- AC-1 ✅ `docs/server-bundle-distribution.md` 存在，9 必填段落齊全（見 §1 摘要）
- AC-2 ✅ CLAUDE.md「Packaging / Release 前置檢查」段尾擴 server bundle baseline subsection
- AC-3 ✅ README.md 加 pointer（見 §3 判斷理由）
- AC-4 ✅ `npm run test:unit` 全綠（10 files / 187 tests passed, duration 7.23s）
- AC-5 ✅ `npx tsc --noEmit` 無新錯誤（殘留錯誤皆 pre-existing on `CodexAgentPanel.tsx` / `agent-profiles.ts`，與本工單 docs-only 修改無關）
- AC-6 ✅ commit 訊息走 `chore(docs): T0327 - PLAN-031 server bundle distribution 用戶文件`（見完成註記 commit hash）

### 完成註記

- 修改檔案：3 個
  - 新建：`docs/server-bundle-distribution.md`
  - 擴段：`CLAUDE.md`（Packaging / Release 前置檢查 → 新增 Server bundle baseline subsection）
  - 加 pointer：`README.md`（Remote dev support 段）
- 單 commit（遵守 worker 守則 7）
- commit hash：見元資料區「結束時間」下方填入
- 後續：PLAN-031 結案 → BUG-071 CLOSED（依工單元資料「後續」欄位）
