---
schema_version: 1
schema_kind: workorder
id: T0548
title: "安裝檔瘦身收尾（T0547 後續）：Windows 改回 normal 壓縮、release.ps1 / real-remote e2e 不再讀安裝目錄 baseline、server bundle 下載對連線錯誤的重試"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-10-16T01:40:03+0800"
updated_at: "2026-10-16T01:56:43+0800"
started_at: "2026-10-16T01:40:27+0800"
completed_at: "2026-10-16T01:56:43+0800"
commit: "c389888b"
target_version: "0.6.1-pre.4"
depends_on: [T0547]
related:
  - "T0547 回報區「遭遇問題」1 / 4 / 5（本單三項的來源與證據）；D146"
affects_files:
  - package.json
  - .vscode/scripts/release.ps1
  - e2e/real-remote/t0514-env.mjs
  - e2e/real-remote/t0515-wizard-env.mjs
  - e2e/real-remote/t0520-env.mjs
  - e2e/pre5-ssh-alias.spec.ts
  - e2e/pre6-wizard-acceptance.spec.ts
  - e2e/pre7-acceptance.spec.ts
  - electron/remote/server-bundle-download.ts
  - electron/remote/__tests__/
  - scripts/__tests__/
  - CLAUDE.md
  - docs/server-bundle-distribution.md
  - _ct-workorders/T0548-installer-slim-followups.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF（`.ps1` 依該檔現有換行）。`src/styles/settings.css` 的 M 狀態不是你的變更；commit 用 `--only`。"
  - "🔴 `package.json` 只改 `build.win.compression`（第 1 項）；不升降套件版本，`version` 不動。"
  - "🔴 不得實際執行 `release.ps1`（只能 `-DryRun` 或靜態測試）；real-remote / pre5-7 e2e 需要真實 WSL / SSH 目標，**不要實跑**，只改路徑解析並以單元測試或 `node --check` / 型別檢查驗證。不碰使用者的 BAT（port 9876）與 WSL `Ubuntu-24.04`。"
---

# T0548 — 安裝檔瘦身收尾（T0547 後續）

## 1. Windows 改回 normal 壓縮

T0547 實測（electron-builder 26.8.1）：`compression: "maximum"` 對 NSIS 無效（非 zip 一律 `-mx=9`），zip 只省 0.3%、打包時間 47 s → 375 s。

- 在 `build.win` 加 `compression: "normal"`（平台值優先），頂層 `maximum` 保留給 AppImage（xz）/ dmg（UDBZ）。
- 補 / 改 `scripts/__tests__/` 的設定斷言；`CLAUDE.md`「Packaging / Release 前置檢查」中 T0547 寫的 compression 說明同步改成實際設定。

## 2. 不再讀安裝目錄的 baseline

T0547 起安裝檔沒有 `resources/bat-server-baseline`，以下仍預設讀它：

- `.vscode/scripts/release.ps1`：說明與 DryRun 訊息仍寫「build:release = fetch:baseline + …」、`BAT_BASELINE_VERSION`（已無作用）→ 改寫說明，移除或標示無作用的設定（保留對舊流程無害的部分即可，在回報區說明取捨）。
- `e2e/real-remote/t0514-env.mjs` / `t0515-wizard-env.mjs` / `t0520-env.mjs`、`e2e/pre5-ssh-alias.spec.ts` / `pre6-wizard-acceptance.spec.ts` / `pre7-acceptance.spec.ts`：baseline 來源改為依序 ① 明確參數 / env（`--baseline-dir`、`BAT_E2E_PRE5_SSH_BUNDLE_DIR` 等既有者）→ ② repo 的 `dist-baseline/`（`npm run fetch:baseline` 產出）→ ③ 使用者 userData 的 `bat-server-bundles` cache（含 `.sha256` sidecar 者）→ ④ 舊安裝目錄（T0547 前的安裝版）；都找不到時錯誤訊息說明 `npm run fetch:baseline`。
- `docs/server-bundle-distribution.md` 若有提到這些 e2e 的 baseline 來源，同步。

## 3. 下載對連線錯誤的重試

T0547 觀察：`server-bundle-download.ts` 的 `toAttemptError` 只讀 `e.cause?.code`，Windows 上 Node fetch 的連線錯誤（ECONNREFUSED / ECONNRESET / ETIMEDOUT / ENOTFOUND 等）拿不到 code，重試表對連線錯誤沒有生效，0 秒即失敗。

- 讓連線類錯誤被正確分類並套用既有重試表（從 `cause` 鏈、`AggregateError.errors`、`cause.errno` / `message` 等取得；分類方式寫明）。不改重試次數與間隔的產品值。
- 單元測試：模擬 Windows 形態的 fetch 錯誤（無 `cause.code`、`AggregateError`）會重試；4xx / sha 不符等非暫時性錯誤不重試（既有行為不變）。

## 驗收條件

- [ ] 三項落地，各有測試或靜態驗證
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠、`npx vite build` 成功（回報區附數字）
- [ ] 本機 `npm run build:dir` 成功，回報 Windows zip / NSIS 是否仍為 normal（可用 `electron-builder --prepackaged` 只打 zip 量時間，或說明為何不量）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（commit `c389888b`）：三項都已完成，每項都有測試或靜態驗證；四個驗收 gate 全部通過，`build:dir` 也成功，並已實測 zip 的壓縮參數與打包時間。

**Landing check**：PASS。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1：工單位於 REPO_ROOT 底下；C-3：`affects_files` 抽樣的路徑都存在（資訊性）；C-2：無 `branch` 欄位。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`CT_MODE=yolo`，`CT_INTERACTIVE=0`。

### 產出摘要

**1. Windows 改回 normal 壓縮**
- `package.json`：在 `build.win` 加 `"compression": "normal"`，頂層的 `maximum` 不動（留給 AppImage xz / dmg UDBZ）。`version` 與套件版本都沒有變動。
- `scripts/__tests__/server-bundle-helpers.test.mjs`：新增一個測試，用 app-builder-lib `PlatformPackager#compression` 的同一套解析（平台值 → 頂層值 → `normal`）斷言 win = normal、mac / linux = maximum。另外用 app-builder-lib 的 `compute7zCompressArgs` 斷言 Windows zip 的參數是 `-mx=7`，不含 `-mpass=15`。原本測試裡的 `compression === 'maximum'` 斷言移到這個新測試。
- 實測：`build:dir` 之後執行 `DEBUG=electron-builder npx electron-builder --win zip --x64 --prepackaged release/win-unpacked`，日誌顯示 `7za.exe args=a -bd -mx=7 -mtc=off -mm=Deflate -mcu …`，花 **46 s**（T0547 用 maximum 是 375 s），zip 大小 432,339,319 bytes（T0547 normal 為 432,395,748；兩次的 asar 內容不同，差距不代表壓縮效果）。量測用的 zip 已刪除（`release/` 本來就在 gitignore 裡）。NSIS 沒有打包：electron-builder 26.8.1 對非 zip 格式一律用 `-mx=9`（T0547 已實測），normal / maximum 的結果相同。
- `CLAUDE.md`「安裝檔瘦身規則」的壓縮段落改寫成實際設定（頂層 maximum + win normal、原因與 T0547 數據、測試位置）。

**2. 不再從安裝目錄讀 baseline**
- 新檔 `e2e/real-remote/baseline-source.mjs`：放共用的查找邏輯 `resolveBaselineSource`，依序找：① 明確目錄（`--baseline-dir`、`BAT_E2E_PRE5_SSH_BUNDLE_DIR`、新增的通用 `BAT_E2E_BASELINE_DIR`；有指定卻找不到會直接報錯，不會跳過）→ ② `<repo>/dist-baseline/`（需要 manifest，且 manifest 列出的 tarball 存在）→ ③ userData `bat-server-bundles` cache（tarball 要有檔名相符的 `.sha256` sidecar；有多個版本時優先選 repo package.json 的基底版號，否則選 mtime 最新的）→ ④ T0547 前安裝版的 `resources/bat-server-baseline`（`BAT_E2E_EXECUTABLE` 旁邊、`%ProgramFiles%`、`%LOCALAPPDATA%\Programs`）。全部找不到時拋錯，訊息提示 `npm run fetch:baseline`，並列出所有找過的位置。另外提供 `bundleMirrorContent`：給 pre5 的本機 mirror 用；cache 來源沒有 manifest，所以會合成一份能通過 `parseManifest` 的 manifest（其他 target 用 placeholder，請求時回 404）。
- `t0514-env.mjs` / `t0520-env.mjs`：預設路徑改成空字串，交給 resolver 處理。`connection.json` 的 `baseline` 多記 `source`（t0520 另記 `dir`）。t0520 原本就會實際計算 SHA-256 再比對，現在錯誤訊息會標明比對對象是 manifest 還是 sidecar。
- `t0515-wizard-env.mjs`：新增 `--baseline-dir` 參數，`docker-check` 改用 resolver，`out.bundle` 多記 `from`。
- `pre5-ssh-alias.spec.ts`：source build 依上面的順序起本機 mirror；找不到時照舊記 log，改走 release 下載。有明確目錄（`BAT_E2E_PRE5_SSH_BUNDLE_DIR` / `BAT_E2E_BASELINE_DIR`）時，installed build 也會用 mirror；沒有明確目錄時，installed build 維持自己的查找方式（T0547 前的版本用內建 baseline，D146 起走 release 下載，與產品行為一致）。
- `pre6-wizard-acceptance.spec.ts`：安裝目錄有 baseline 才記它，沒有就記錄會走 release 下載；另外記錄 docker-check lane 會用到哪個本機 bundle。
- `pre7-acceptance.spec.ts`：`ENV.version` 不再要求安裝目錄一定有 manifest（沒有就略過；有的話版號必須相符）。改為記錄 env script 的 `conn.baseline.source`，`Connection` 型別加上 `source?`。
- `.vscode/scripts/release.ps1`：說明改寫（D146：build 不再跑 fetch:baseline，發版時仍要一起發佈 `server-bundle-v<版號>`），刪掉 `BAT_BASELINE_VERSION` 的設定、備份與還原。DryRun 改成顯示實際流程（`clean:dist-electron → verify … → vite build → electron-builder`），並提示要另外有 `server-bundle-v<基底版號>` release（快照的 `-local.` / `.local.` 後綴會去掉）。
- `docs/server-bundle-distribution.md`：在歷史紀錄段落加上 e2e 的 tarball 來源順序；`CLAUDE.md` 的 `fetch:baseline` / baseline 版號段落同步更新。

**3. 下載時，連線錯誤會重試**
- 🔴 **T0547 的觀察要更正**：T0547 測的 URL 是 `http://127.0.0.1:9/unreachable`。9 號埠是 fetch 規範封鎖的連接埠，undici 會丟 `TypeError('fetch failed')`，cause 是 `Error('bad port')`，**沒有任何 code**，所以才會 0 秒失敗。這不是 ECONNREFUSED。我在 Node 24.22.0 與 Electron 41.2.1（`ELECTRON_RUN_AS_NODE`，Node 24.14.1）/ Windows 上實測：
  - `127.0.0.1:<關閉的埠>`：`TypeError` ← `Error{code:'ECONNREFUSED', errno:-4078}`
  - `localhost:<關閉的埠>`：`TypeError` ← `AggregateError{code:'ECONNREFUSED'}` ← 兩個 per-address Error
  - 也就是說，Windows 上真正的 ECONNREFUSED 本來就有 `cause.code`，原本的重試表已經會生效。
- 依工單要求，仍然把分類改得更穩健（`toAttemptError`，`electron/remote/server-bundle-download.ts`，改成 export）：
  - 走完整條 `cause` 鏈與 `AggregateError.errors`（深度上限 6、可處理循環）。
  - 每一層依序取 `code` → `errno`（字串，或負數經 `util.getSystemErrorName` 轉換）→ `message` 裡的 `E…` / `UND_ERR_…` 字樣。`UND_ERR_CONNECT_TIMEOUT` 視為 `ETIMEDOUT`。
  - 取第一個重試表接受的 code；都不接受時保留第一個找到的 code，供 log 使用。
  - 錯誤訊息加上最內層的細節，例如 `fetch failed (connect ECONNREFUSED 127.0.0.1:59999)`、`fetch failed (bad port)`。
  - 重試次數、間隔與 `shouldRetryError` 的產品值都沒有改。
- 新測試 `electron/remote/__tests__/server-bundle-download-retry.test.ts`（16 個）：分類部分涵蓋 cause.code、只有 AggregateError.errors、數字 errno（取本機 libuv 的值）、字串 errno、message 字樣、undici connect timeout、可重試 code 優先、`bad port` 沒有 code、循環 cause、非 Error 值，以及一個**真 socket** 案例（關閉的 `127.0.0.1` 與 `localhost` 埠都分類成 ECONNREFUSED）。下載流程部分用 fake timers：Windows 形態的 AggregateError（只有 errno、沒有 code）會重試 4 次；暫時性錯誤之後成功；`bad port` 只嘗試 1 次；404 只嘗試 1 次；SHA 不符只抓 1 次 tarball。

### 驗證

| Gate | 結果 |
|---|---|
| `npm run typecheck` | PASS，exit 0（0 errors） |
| `npm run typecheck:electron` | PASS，exit 0（0 errors） |
| `npm run test:unit` | PASS：243 files，4073 passed，1 skipped（跑完整套時 `dist-electron` 還沒建好；`vite build` 之後另外跑 `scripts/__tests__/asar-runtime-deps.test.mjs`，23/23 通過）。stderr 的 `AttachConsole failed` 是 node-pty 的已知輸出 |
| `npx vite build` | PASS（在 `build:dir` 裡執行，4 個 bundle 都顯示 `✓ built`） |
| `npm run build:dir` | PASS，exit 0，13 s；之後 `node scripts/verify-packaged-native.js --platform win --out release --arch x64` 也通過（PE x64 claude.exe、沒有 baseline、runtime 套件齊全） |
| Windows zip 壓縮 | `--prepackaged` 只打 zip：`-mx=7`（normal），46 s |
| release.ps1 | `-DryRun -SkipGitCheck` 與 `-DryRun -SkipGitCheck -Snapshot` 都輸出新訊息，working tree 沒有被改動（**沒有**實際執行打包） |
| e2e 相關 | 沒有實跑（依 memory_overrides）。`node --check` 三支 env script 通過；三支 env script 執行 `help` 都 exit 0；`npx playwright test --list` 三個 spec 都能載入（12 tests）；在本機呼叫 resolver 會命中 `dist-baseline/bat-server-linux-x64-v0.6.1-pre.3.tar.gz`；resolver 單元測試 `scripts/__tests__/e2e-baseline-source.test.mjs` 16/16 通過 |

### 互動紀錄
無（`CT_INTERACTIVE=0`，yolo）。

### Renew 歷程
無

### 遭遇問題

1. **T0547 的根因判斷有誤**（見產出 3）：「Windows 上 fetch 的 cause 拿不到 code」不成立；0 秒失敗是因為 9 號埠被 fetch 封鎖（`bad port`，屬於永久性錯誤，本來就不該重試）。分類仍依工單強化，並已寫進 CLAUDE.md。
2. **範圍偏差（新增檔案）**：`affects_files` 沒有列出 `e2e/real-remote/baseline-source.mjs`。六個 consumer 共用同一套查找邏輯，如果每個檔案各寫一份會不一致，所以獨立成一個檔案，並放在 `scripts/__tests__/` 測試。新的通用環境變數 `BAT_E2E_BASELINE_DIR` 也屬於這次的新增。
3. **release.ps1 的取捨**：`BAT_BASELINE_VERSION` 的設定與還原直接刪除，沒有保留（build 已經不 fetch，保留只會誤導）。`fetch-baseline-tarball.mjs` 仍然會讀這個變數，供手動 fetch 使用，所以沒有動它；`scripts/__tests__/fetch-baseline-version.test.mjs` 的測試名稱還提到 release.ps1，但測的是 fetch 腳本本身，不在本單範圍，所以沒有改。
4. **pre5 installed build 的語意**：沒有明確目錄時，installed build 不起 mirror，所以 D146 之後的 installed build 會實際從 GitHub release 下載（與產品行為一致）。若要離線執行，請設定 `BAT_E2E_PRE5_SSH_BUNDLE_DIR` / `BAT_E2E_BASELINE_DIR`。
5. 沒有更新 `docs/server-bundle-distribution.md`「GitHub Rate Limit」段落那句「重試策略：exponential backoff 至 reset time，最多 3 次」。這句和實作不一致（rate-limited 不會重試），但這是既有文字，不在本單範圍，建議之後順手修正。
6. 工作區原本就有、不屬於本單的 `src/styles/settings.css` 修改沒有動；commit 時用 `--only` 排除。

### 回報時間
2026-10-16T01:55:30+0800
