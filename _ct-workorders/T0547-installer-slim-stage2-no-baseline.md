---
schema_version: 1
schema_kind: workorder
id: T0547
title: "安裝檔瘦身第二階段（D146）：安裝檔不再內建 server bundle baseline，改隨需下載 + wizard「匯入本機 tarball」+ 無 baseline 時的 cache 驗證；`compression: maximum`"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: L
created_at: "2026-10-16T01:10:56+0800"
updated_at: "2026-10-16T01:11:21+0800"
started_at: "2026-10-16T01:11:21+0800"
completed_at: ""
commit: ""
target_version: "0.6.1-pre.4"
depends_on: [T0546]
related:
  - "D146（本單決策；推翻 D092 的「安裝檔內建 baseline」部分，D093 / D095 / D120 保留）"
  - "T0544 研究報告 §3「A — 安裝檔不附 server bundle baseline」與「D — 壓縮格式」：fallback 現況、兩個缺口、實作範圍、風險、驗證方式（行號引用以該報告為準，請先重新確認）"
  - "T0546（第一階段，已改 `package.json` build / verify 腳本 / workflows；本單在其之上修改）"
  - "CLAUDE.md「Server bundle baseline（PLAN-031）」「Packaging / Release 前置檢查」；docs/server-bundle-distribution.md；PLAN-031；BUG-071"
affects_files:
  - package.json
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - scripts/fetch-baseline-tarball.mjs
  - scripts/verify-helper-bundle.js
  - scripts/verify-packaged-native.js
  - scripts/report-artifact-sizes.mjs
  - scripts/__tests__/
  - electron/remote/server-bundle-distributor.ts
  - electron/remote/server-bundle-download.ts
  - electron/remote/__tests__/
  - electron/__tests__/
  - electron/preload.ts
  - electron/main.ts
  - src/components/
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - docs/server-bundle-distribution.md
  - CLAUDE.md
  - _ct-workorders/T0547-installer-slim-stage2-no-baseline.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ D146 授權推翻 D092 的「安裝檔內建 baseline」：三平台 `extraResources` 移除 `dist-baseline`、`prebuild` / `build:*` 不再需要 `fetch:baseline`、workflow 的 desktop build job 不再下載 `dist-baseline`。**`server-bundle` job 與 `server-bundle-v<版號>` 發佈（D120）一律保留**——runtime 下載的來源就是它。"
  - "🔴 不做：codex 不內建（B，使用者選繼續內建）、ULMO dmg（D2）、server bundle 改 xz（D3）、locales（C6）。`package.json` 不升降任何套件版本，`version` 不動。"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。`src/styles/settings.css` 的 M 狀態不是你的變更；commit 用 `--only`。"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build / 打包產物；不碰使用者正在用的 BAT（port 9876）、`C:\\Program Files\\BetterAgentTerminal`、使用者的 `%APPDATA%\\BetterAgentTerminal\\bat-server-bundles` 快取；測試用隔離 userData。不得對使用者的 WSL `Ubuntu-24.04` 內 `~/.local/bat-server`（現行 0.5.9-pre.4，systemd 執行中）做安裝或覆蓋。"
  - "🔴 遵守 CLAUDE.md「Child Process Spawning」：匯入 tarball 的路徑來自使用者選檔，不得進 shell；只用 `execFile` / `spawn` + array args 或 Node API。"
---

# T0547 — 安裝檔瘦身第二階段：不內建 server bundle baseline（D146）

## 背景

T0546（第一階段）完成後預估 exe ≈ 454 / zip ≈ 570 / AppImage ≈ 554 / dmg ≈ 640 MiB，其中 server bundle baseline 仍佔 Win / Linux ≈ 159、mac ≈ 298 MiB（T0546 後 tarball 已去掉 SDK binary）。使用者決定（D146）：安裝檔不再附 baseline，首次設定遠端時下載；並提供「匯入本機 tarball」給離線 / 內網；同時套用較強壓縮。預估結果（T0544 §4 S3 + D1）：exe ≈ 267 / zip ≈ 412 / AppImage ≈ 280 / dmg ≈ 296 MiB。

## 範圍

### 1. 打包不再內建 baseline
- `package.json`：三平台 `extraResources` 移除 baseline；`prebuild` / `build:dir` / `build:release` 等不再強制 `fetch:baseline`（`fetch:baseline` 指令本身可保留供手動 / 測試）。
- `scripts/verify-helper-bundle.js`：移除「dist-baseline 缺 tarball 即 abort」；改為斷言安裝檔設定**不含** baseline。
- `scripts/verify-packaged-native.js`：T0546 的 `baseline` 檢查改為「`resources/bat-server-baseline` 不存在」。
- workflows：desktop build job 移除下載 `dist-baseline` 的 step（與其 debug list）；`server-bundle` job、`server-bundle-baseline` artifact、`Create server bundle release` step **保留**。
- `scripts/report-artifact-sizes.mjs` 照常量測。

### 2. runtime：無 baseline 時的下載與 cache（T0544 指出的缺口 1）
- distributor 在沒有內建 baseline 時，直接走 GitHub Release 下載（`stripSnapshotSuffix(app.getVersion())`，`BAT_SERVER_BUNDLE_BASE_URL` override 不變）。
- **cache 驗證不得依賴 baseline manifest**：以下載時取得的 `manifest.json` / `.sha256` sidecar 驗證並與 tarball 一起存進 cache；之後離線時，cache 內 tarball 以其自身 sidecar 驗證即可使用。
- 錯誤訊息（三語）：下載失敗時清楚提示「可改用匯入本機 tarball」與 `BAT_SERVER_BUNDLE_BASE_URL`。

### 3. 匯入本機 tarball（T0544 指出的缺口 2）
- 在需要 server bundle 的 wizard 步驟（WSL / SSH；Docker 若同路徑一併）提供「匯入本機 tarball…」：選 `bat-server-<target>-v<版號>.tar.gz`，同目錄必須有 `.sha256`（或讓使用者另選），驗證通過才放進 cache 並繼續安裝；target / 版號與需求不符 → 明確錯誤（三語）。
- 檔名 / target / 版號以白名單 regex 驗證（CLAUDE.md「Child Process Spawning」）；複製用 Node fs API。
- 不影響已存在的 cache 與下載路徑；匯入後與下載後的 cache 格式一致。

### 4. 壓縮（D1）
- `build.compression: "maximum"`（AppImage → squashfs xz；dmg → UDBZ；NSIS → 7z 最高等級）。回報區記錄本機 Windows 打包時間前後差異；dmg / AppImage 的影響由 CI 實測。

### 5. 文件與小修
- `CLAUDE.md`「Server bundle baseline（PLAN-031）」改寫為「不內建、隨需下載 + 匯入」（標 D146 / T0547，保留 D093 / D095 / D120 與 per-host target 對照的歷史說明）、「Packaging / Release 前置檢查」同步；`docs/server-bundle-distribution.md` 同步。
- T0546 回報的小議題：`build:dir` / `build` 前清空 `dist-electron`（vite 不清 outDir，舊 chunk 會全部打進 asar）——用跨平台 Node 寫法（例 `node -e "fs.rmSync(...)"` 或小腳本），不用 shell `rm -rf`。

## 驗收條件

- [ ] 單元測試：distributor（無 baseline → 下載；下載後 cache 以 sidecar 驗證；離線 + 有 cache → 可用；離線 + 無 cache → 錯誤提示含匯入選項）、匯入（正確 / sha 不符 / target 不符 / 版號不符 / 非法檔名）、verify 腳本新規則、`package.json` 不含 baseline
- [ ] 隔離 runtime（`--runtime=<高號碼>`、空的 `bat-server-bundles`）實測：distributor 從 GitHub 下載 `server-bundle-v0.6.1-pre.3` 的 linux-x64（以 `BAT_SERVER_BUNDLE_BASE_URL` 或版本覆寫指到已發佈版號）並通過驗證；中斷網路（或指向不可達 URL）後以匯入 T0546 本機建出的 tarball 成功放進 cache。**不得**實際安裝到使用者的 WSL / SSH 目標（只驗到 cache 與 wizard 狀態；若需要真實安裝，用 e2e / 隔離目標並在回報區說明）
- [ ] 本機 Windows `--dir` 打包成功、`verify-packaged-native.js --platform win` 通過、`resources/bat-server-baseline` 不存在；回報 `win-unpacked` 大小與打包時間
- [ ] `npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠、`npx vite build` 成功；受影響的 e2e（遠端 wizard / server bundle 相關 spec）實跑或說明為何不需要
- [ ] 三語 i18n 鍵齊全（既有 locale 一致性測試通過）
- [ ] 回報區列出：預估四個產物大小、只能在 CI / 實機驗證的項目（dmg UDBZ 掛載速度、AppImage xz 啟動、NSIS 安裝時間、真實 WSL / SSH 首次下載安裝）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**：範圍 1–5 全部落地，單元測試 / typecheck / vite build / 本機 Windows `--dir` 打包與 verify / 隔離 runtime 實測都通過。dmg / AppImage / NSIS 安裝與真實 WSL / SSH 首次下載安裝只能在 CI / 實機驗證（見下方「只能在 CI / 實機驗證」）。

**要塔台注意的實測結果**：`compression: "maximum"` 對 **NSIS 沒有效果**。electron-builder 26.8.1 的 `compute7zCompressArgs` 對非 zip 格式一律 `-mx=9`，所以 normal 已經是最高等級，T0544 估的「exe ≈ 267」不成立，exe 實際約 **298 MiB**。zip 則幾乎沒有收益，打包時間卻變成 8 倍（數字見下）。依工單照做頂層 `maximum`（AppImage xz / dmg UDBZ 仍有效），建議另開小單決定是否加 `build.win.compression: "normal"`。

Landing check：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`，相符（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單在 `REPO_ROOT/_ct-workorders/`，PASS
- C-3（資訊用）：前 5 個可測項目 `package.json`、`.github/workflows/pre-release.yml`、`.github/workflows/release.yml`、`scripts/fetch-baseline-tarball.mjs`、`scripts/verify-helper-bundle.js` 都存在
- C-2：工單沒有 `branch` 欄位，HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

環境：`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 產出摘要

**變更檔案**
| 檔案 | 內容 |
|---|---|
| `package.json` | 三平台 `extraResources` 的 baseline 移除（win / mac / linux 都沒有 `extraResources` 了）；刪除 `prebuild`；`build:dir` / `build:release` 不再跑 `fetch:baseline`（`fetch:baseline` 指令保留）；新增 `clean:dist-electron`（`node -e` 呼叫 `fs.rmSync`，`maxRetries: 3`），由 `build` / `build:dir` 先執行；`build.compression: "maximum"`。版本與相依套件都沒動 |
| `scripts/verify-helper-bundle.js` | T0316 的「dist-baseline 缺 tarball 即 abort」改成反向檢查 `checkNoServerBundleBaseline`：頂層或 `build.<platform>` 的 `extraResources` / `extraFiles` 只要 `from` 是 `dist-baseline`、`to` 是 `bat-server-baseline`、或 filter 是 `bat-server-*.tar.gz[.sha256]`，就 exit 1 |
| `scripts/verify-packaged-native.js` | T0546 的 `baseline`（只擋 D092 以外的 target）改成 `server-bundle-baseline`：`resources/bat-server-baseline` 只要存在（包括空目錄）就算失敗；移除 `expectedBaselineTargets`；成功訊息改成 `no server bundle baseline` |
| `scripts/fetch-baseline-tarball.mjs` | 只改開頭註解：build 不再呼叫，留給手動 / 測試使用 |
| `.github/workflows/pre-release.yml` / `release.yml` | build job 移除「Download server bundle baselines into dist-baseline/」與「List dist-baseline (debug)」；`build.needs` 改成 `[prepare, typecheck]`，跟 server-bundle 並行；`release.needs` 改成 `[prepare, build, server-bundle-manifest]`，server bundle 失敗時仍然不發版。`server-bundle` / `server-bundle-manifest` job、`server-bundle-baseline` artifact、`Create server bundle release` step 都保留，只更新註解 |
| `electron/remote/server-bundle-cache.ts`（新） | sha256sum 格式 sidecar 的 parse / format（`<hex>  <filename>`、CRLF、`*` 前綴都接受；sidecar 寫的檔名必須相符）、檔名白名單 `SERVER_BUNDLE_FILENAME_RE`、`writeSha256Sidecar`（先寫 tmp 再 rename，失敗不 throw）、`hashFile`、`lookupCachedTarball`（用 cache 自己的 sidecar 驗證；不符就連同 sidecar 一起刪除） |
| `electron/remote/server-bundle-distributor.ts` | 查找順序改成：先查有 sidecar 的 cache（不連網、不需 baseline）→ baseline（只為 T0547 前的安裝檔 / 自帶 baseline 的 fork 保留；沒有 sidecar 的舊 cache 也在這一層驗證並補 sidecar；baseline 損毀仍 fail-closed）→ 下載。baseline 複製進 cache 時一併寫 sidecar。失敗結果帶 `arch` / `version`；下載失敗的 `error` 結尾附 `downloadFailureHint`（要匯入的檔名，以及 `BAT_SERVER_BUNDLE_BASE_URL`） |
| `electron/remote/server-bundle-download.ts` | 下載驗證成功後、以及 cache 命中時，都寫 sidecar（T0547 前沒有 sidecar 的舊 cache 會在這時補上） |
| `electron/remote/server-bundle-import.ts`（新） | `importServerBundleTarball`：絕對路徑 → 檔名白名單 → target / 版號必須等於需求 → sidecar（≤ 4 KiB、寫的檔名相符）→ 用 Node stream 一邊複製到 tmp 一邊算 SHA-256 → 相符才 rename 進 cache 並寫 sidecar；不符就刪掉 tmp，cache 不會留下未驗證的檔案。`importLocalServerBundle`：IPC 參數驗證（arch 白名單、版號格式、去掉快照後綴、對話框標題 ≤ 200 字）+ 注入的對話框（先選 tarball，同目錄沒有 `.sha256` 才再請使用者選）。全程不經 shell |
| `electron/main.ts` | 新增本機 IPC `server-bundle:import-local`（`dialog.showOpenDialog` 的包裝，不在 PROXIED_CHANNELS） |
| `electron/preload.ts` / `src/types/electron.d.ts` | `remote.serverBundle.importLocal`；`distribute` 的失敗型別加上 `arch?` / `version?` |
| `src/components/setup-wizard/server-bundle-import.ts`（新） | `distributeFailureError`：`download-failed` / `no-source-available` 丟出 `code = 'server-bundle-unavailable'`，並記錄 `ctx.state.serverBundleImportTarget`；`importServerBundleForRetry`；匯入錯誤碼對應到 i18n 鍵 |
| `src/components/setup-wizard/steps/{wsl,ssh}/install-server-bundle.ts` | 失敗時改丟 `distributeFailureError`（訊息仍是 `[errorCode] error`）；成功時清掉匯入目標 |
| `src/components/setup-wizard/error-mapper.ts` | 新增動作 kind `import-server-bundle`；registry `server-bundle-unavailable`（wsl / ssh 的 `install-server-bundle`）→ 匯入 / 重試 / 取消 |
| `src/components/setup-wizard/SetupWizardShell.tsx` | `import-server-bundle` 動作：匯入 → 成功後 `retryCurrentStep()`；匯入結果以 `.bat-wizard-action-notice` 顯示（info / success / error），換步驟時清除；有防連點 |
| `src/locales/{en,zh-TW,zh-CN}.json` | `wizard.action.importServerBundle`、`wizard.shared.error.serverBundleUnavailable.{title,body}`（說明 D146、匯入、`BAT_SERVER_BUNDLE_BASE_URL`）、`wizard.shared.bundleImport.*`（對話框標題、進度、成功、9 種錯誤） |
| 測試（新 / 改） | `electron/remote/__tests__/server-bundle-offline-cache.test.ts`（新，26 項）、`src/components/setup-wizard/__tests__/server-bundle-import.test.tsx`（新，8 項）、`scripts/__tests__/server-bundle-helpers.test.mjs`（+8 項：`package.json` 沒有 baseline / 有 `compression` / 清 `dist-electron` 實際執行，以及 verify 腳本對 5 種 baseline 寫法 fail、對沒有 `dist-baseline` 的情況 pass）、`scripts/__tests__/verify-packaged-native.test.mjs`（fixture 移除 baseline；新增「有 tarball / 空目錄都 fail」） |
| `CLAUDE.md` / `docs/server-bundle-distribution.md` | 「Server bundle baseline（PLAN-031）」改寫為不內建 + 隨需下載 + 匯入（標 D146 / T0547，保留 D092 per-host 矩陣作為歷史、D093 / D095 / D120 不變）；「Packaging / Release 前置檢查」補瘦身規則（不內建 baseline、compression 實際效果、清 `dist-electron`）、CI `needs`、`server-bundle-baseline` 檢查 id；docs 新增「匯入本機 tarball」一節與排錯條目 |

**驗證證據**
| 關卡 | 結果 |
|---|---|
| `npm run typecheck` | 0 錯誤 |
| `npm run typecheck:electron` | 0 錯誤 |
| `npm run test:unit` | 241 檔、4040 通過、1 skipped（既有），全綠（01:36 最終一輪） |
| `npx vite build` | 成功（`build:dir` 內一次，最後再單獨跑一次） |
| `npm run build:dir`（本機 Windows） | 成功，13 s（clean → verify-native-modules → verify-helper-bundle「OK: no server bundle baseline」→ verify-renderer-imports → vite build → electron-builder --dir） |
| `verify-packaged-native.js --platform win --out release --arch x64` | ✅「embedded claude … (PE machine 0x8664), no server bundle baseline, 8 runtime package(s) / 15 with dependencies」 |
| `resources/bat-server-baseline` | 不存在（`win-unpacked/resources` 只有 `app.asar`、`app.asar.unpacked/`、`scripts/`） |
| `win-unpacked` 大小 | 1125 MiB（`du -sm` 1126；T0546 為 1354 MiB，因當時內建的是 pre.3 release 的 229 MiB baseline） |
| 打包時間 normal vs maximum（`electron-builder --prepackaged release/win-unpacked`） | NSIS：normal 25 s / 312,525,518 bytes；maximum 23 s / 312,525,436 bytes（等於沒差）。zip：normal 47 s / 432,395,748 bytes；maximum 375 s / 431,119,545 bytes（-0.3%；這段時間另有一個 e2e 在跑，時間略偏高）。暫存輸出已刪除 |
| 隔離 runtime 實測（暫用 spec，跑完已刪除，內容見下） | ✅ 1 passed（11.4 s），詳見下方 |
| e2e `t0512-profile-panel-layout.spec.ts`（source build，wizard 完成畫面會呼叫 `server-bundle:distribute`，用 mock 的 ok 結果） | ✅ 2 passed |

**隔離 runtime 實測**（source build，`--runtime=e2e-t0547-online-…` / `e2e-t0547-offline-…`，`bat-server-bundles` 原本不存在；SSH draft profile `sshServerArch: 'x86_64'`，只做 arch 對應，不連任何 SSH / WSL 目標；結束後 userData 已刪除，Terminal Server 沒有殘留）
- A（線上）：`distribute` 6.2 s → `source: 'download'`，從 `server-bundle-v0.6.1-pre.3` 下載 `bat-server-linux-x64-v0.6.1-pre.3.tar.gz`（240,089,624 bytes，sha256 `d1c7e96d…3ceed`，與 release manifest 相符）；cache 內容 = tarball + `.sha256`，sidecar 內容 = `d1c7e96d…  bat-server-linux-x64-v0.6.1-pre.3.tar.gz\n`；第二次 `distribute` → `source: 'cache'`
- B（不可達：`BAT_SERVER_BUNDLE_BASE_URL=http://127.0.0.1:9/unreachable`）：`distribute` → `download-failed`，`arch: linux-x64`、`version: 0.6.1-pre.3`，訊息結尾附「Import a local tarball instead (bat-server-linux-x64-v0.6.1-pre.3.tar.gz with ….sha256, from the server-bundle-v0.6.1-pre.3 release), or point BAT_SERVER_BUNDLE_BASE_URL at a mirror.」；匯入 `…-v0.6.0.tar.gz` → `version-mismatch`；匯入 T0546 本機建出的 `dist-server/bat-server-linux-x64-v0.6.1-pre.3.tar.gz`（166,335,381 bytes，sha256 `f4b95920…674071`）→ ok，cache = tarball + sidecar；之後 `distribute`（mirror 仍不可達）0.4 s → `source: 'cache'`
- main 的 `dialog.showOpenDialog` 以 `app.evaluate` stub 成指定路徑；渲染端走 `window.electronAPI.remote.serverBundle.*`，所以 preload → IPC → main → 模組全程都是真實的
- wizard 畫面（失敗 → 按鈕 → 匯入 → 重試 → 安裝）在 `server-bundle-import.test.tsx` 以真的 WSL 步驟 + Shell 驗證；隔離實例沒有走 wizard UI，因為走到 install 步驟就會真的安裝到 WSL / SSH 目標（工單禁止）

**預估四個產物大小（MiB）**
| 產物 | 結果 | 依據 |
|---|---:|---|
| exe（NSIS） | **298.0** | 本機實測（312,525,436 bytes）；D1 無效 |
| zip | **411.1**（normal 412.4） | 本機實測 |
| AppImage | ≈ 280 | T0544 §4 S3 + D1 推估（squashfs xz），待 CI |
| dmg | ≈ 296 | T0544 §4 S3 + D1 推估（UDBZ），待 CI |

**只能在 CI / 實機驗證**
- dmg UDBZ 的大小、掛載速度；AppImage xz 的大小與啟動時間（mac / Linux CI job 的 `report-artifact-sizes`）
- NSIS 完整重裝與安裝時間（CLAUDE.md 規定 release 前要做）
- CI Windows job 的 zip maximum 時間（本機 375 s）
- 真實 WSL / SSH 首次設定：線上下載 → 安裝、離線 → 匯入 → 安裝（需要隔離的 WSL distro / SSH 目標；這次沒有碰使用者的 `Ubuntu-24.04` / `~/.local/bat-server`）
- `pre-release.yml` 新的 `needs`（build 與 server-bundle 並行、release 等兩者）要在下次發佈時確認

### 互動紀錄
無（`CT_INTERACTIVE=0`，沒有詢問）

### Renew 歷程
無

### 遭遇問題

1. **D1 對 NSIS 無效、zip 收益極小**（見完成狀態）。依工單維持頂層 `compression: "maximum"`。**建議**另開小單加 `build.win.compression: "normal"`（`platformPackager.compression`：平台值優先，NSIS 不受影響，zip 每次發版省約 5 分鐘），或接受目前的成本。CLAUDE.md 已寫入實測與覆寫方式。
2. **範圍偏差（新增檔案）**：`affects_files` 沒有列出 `electron/remote/server-bundle-cache.ts`、`electron/remote/server-bundle-import.ts`。sidecar 邏輯如果放進 download 模組，會被 distributor 測試整個 mock 掉，所以獨立成新檔；兩者都在工單範圍 2 / 3 內。
3. **跑實測時的測試錯誤**：第一次 runtime spec 把 `sshServerArch` 寫成 `Linux x86_64`，結果是 `arch-detection-failed`（distributor 要的是 `uname -m` 的值）。已改成 `x86_64` 重跑通過；renderer 測試裡同樣的寫法（`distribute` 是 mock，不影響結果）也一併修正。
4. **觀察（未修，不在範圍內）**：不可達 URL（ECONNREFUSED）在 0.0 s 內就失敗，沒有重試。`toAttemptError` 只讀 `e.cause?.code`，Node fetch 在 Windows 上的 cause 拿不到 code，所以重試表對連線錯誤其實沒生效。這是既有行為，結果只是更快失敗。
5. **後續（不在 affects_files 內，未改）**：
   - `.vscode/scripts/release.ps1` 的說明與 DryRun 訊息仍然寫「build:release = fetch:baseline + …」，`BAT_BASELINE_VERSION` 已沒有作用
   - `e2e/real-remote/t0514-env.mjs` / `t0515-wizard-env.mjs` / `t0520-env.mjs` 預設讀 `C:\Program Files\BetterAgentTerminal\resources\bat-server-baseline`，`e2e/pre5-ssh-alias.spec.ts` / `pre6-wizard-acceptance.spec.ts` / `pre7-acceptance.spec.ts` 也讀已安裝的 baseline。裝上 0.6.1-pre.4 之後，這些路徑不再存在，要改指 `--baseline-dir` / `BAT_E2E_PRE5_SSH_BUNDLE_DIR`（例如 `npm run fetch:baseline` 抓下來的 `dist-baseline/`），或改讀 `bat-server-bundles` cache
   - D094 的大小上限需要依 CI 實測重新討論（exe 298 > 280）
6. 工作區原本就有、不屬於本單的 `src/styles/settings.css` 修改沒有動，commit 時用 `--only` 排除。

### 回報時間
2026-10-16T01:38:04+0800
