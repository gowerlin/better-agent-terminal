---
schema_version: 1
schema_kind: workorder
id: T0547
title: "安裝檔瘦身第二階段（D146）：安裝檔不再內建 server bundle baseline，改隨需下載 + wizard「匯入本機 tarball」+ 無 baseline 時的 cache 驗證；`compression: maximum`"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: L
created_at: "2026-10-16T01:10:56+0800"
updated_at: "2026-10-16T01:10:56+0800"
started_at: ""
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

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 回報時間
