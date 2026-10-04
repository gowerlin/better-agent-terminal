---
schema_version: 1
schema_kind: workorder
id: T0378
title: "BUG-086 + BUG-087 修復：WSL 精靈無發行版誤報、linger 未帶使用者、unit 檔 `~`、失敗後 bundle 被回滾"
type: implementation
status: TODO
priority: P1
sizing: M
created_at: "2026-10-04T21:15:17+08:00"
updated_at: "2026-10-04T21:15:17+08:00"
target_version: next
depends_on: []
related:
  - "BUG-087（主修復對象，high；三個缺陷 A/B/C 與全部證據）"
  - "BUG-086（low；無發行版誤報為找不到 WSL2）"
  - "D126（本工單決策）"
  - "BUG-071（已 CLOSED；第 4 步下載流程已實機通過，勿回歸）"
  - "BUG-072（已 CLOSED；linger 文案 / bat-server.service timeout，可能與缺陷 B 同根因）"
affects_files:
  - electron/wsl-detect.ts
  - electron/wsl-systemd.ts
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/setup-wizard/error-mapper.ts
  - src/components/setup-wizard/wizard-runner.ts
  - src/components/setup-wizard/steps/wsl/detect-env.ts
  - src/components/setup-wizard/steps/wsl/pick-wsl-distro.ts
  - src/components/setup-wizard/steps/wsl/install-server-bundle.ts
  - src/components/setup-wizard/steps/wsl/write-systemd-unit.ts
  - src/locales/en.json
  - src/locales/zh-TW.json
  - src/locales/zh-CN.json
  - src/components/setup-wizard/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: on
  interactive: false
  intervention_type: none
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 child_process 一律 `execFile` / `spawn` + array args，timeout 必設；distro / username 等外部輸入過 `/^[a-zA-Z0-9._-]+$/` 白名單（CLAUDE.md Child Process Spawning）。禁用 shell-spawning exec API。"
  - "🔴 判斷 WSL 狀態以 **exit code** 為主，不依賴 `wsl.exe` 的本地化輸出字串（輸出為 UTF-16LE，且隨 Windows 語系變動）。"
  - "🔴 不得刪除 / 重建 / unregister 本機 WSL 發行版 `Ubuntu-24.04`（使用者測試環境，塔台已設定好 `gower` 使用者）。可在其中讀取狀態、`loginctl disable-linger gower` 重現、刪除精靈寫出的 `~/.config/systemd/user/bat-server.service`。"
  - "🔴 SSH / Docker 精靈不在範圍；共用模組（`error-mapper.ts`、`wizard-runner.ts`）若改動，SSH / Docker 既有測試必須全綠。"
  - "⚠️ 不 push。"
---

# T0378 — WSL 精靈：無發行版誤報 + systemd 步驟三缺陷

## 背景

BUG-071 修好後（第 4 步能下載並安裝 server bundle），使用者在乾淨的 `Ubuntu-24.04` 上跑 WSL 精靈，**第 5 步「寫入 systemd 使用者服務」必失敗**。塔台環境檢查找出三個缺陷（BUG-087 A/B/C）。另外一開始沒有發行版時，第 1 步誤報「找不到 WSL2」（BUG-086）。

**實作前完整讀 BUG-087 與 BUG-086**，所有指令輸出與程式位置都在那裡。

## 決策（D126）

### 1. 缺陷 A — linger 帶明確使用者名稱
- `electron/wsl-systemd.ts` `enableLinger()`：先取得發行版預設使用者（例如 `runWsl(distro, ['id', '-un'])`），過白名單 regex 後執行 `loginctl enable-linger <user>`
- 成功判定：以 `loginctl show-user <user> -p Linger` 回 `Linger=yes` 為準（ENXIO 時 `loginctl` 的 exit code 不可靠：塔台實測錯誤訊息印出但 `$?` 為 0）
- 已是 `Linger=yes` 時直接視為成功
- `error-mapper.ts` 的手動指令文案（`sudo loginctl enable-linger $USER`）保留，它本身正確

### 2. 缺陷 B — systemd unit 不得出現 `~`
- 改成**解析發行版使用者的絕對 `$HOME`**（例如 `/home/gower`），install path 與 data dir 都用絕對路徑，`ctx.serverInstallPath` 存絕對路徑；`ExecStart` / `Environment` 寫出絕對路徑
- **不用 `%h` specifier**：`escapeSystemdValue` 可能會跳脫 `%`，行為不透明。若 Worker 讀碼後確認 `%h` 更乾淨且不被跳脫，可以改用，但須在回報區說明理由
- `validateInstallPath()` 須接受絕對路徑（請確認現有 `assertValidUnixPath` 行為）
- 取得 `$HOME` 的方式：`execFile` array args，例如 `['-d', distro, '--', 'sh', '-c', 'printf %s "$HOME"']`（固定字串，無外部輸入插值），結果須為 `/` 開頭且通過路徑驗證

### 3. 缺陷 C — 失敗後回滾與重試的一致性
- **先查明**：第 5 步失敗時是誰、在什麼時機呼叫了 `install-server-bundle` 的 `rollback()`（`wizard-runner.ts` 的失敗 / 重試 / 取消流程）
- 目標行為：**可重試（retryable）的失敗不得回滾前面已成功的步驟**；回滾只在使用者「取消」整個精靈時執行。若查證後發現架構上有其他正當理由，改為「重試時從被回滾的最早步驟重跑」也可，但 UI 不得顯示已被回滾的步驟為 ✓
- 回報區須寫清楚查到的 rollback 觸發點與改法

### 4. BUG-086 — 區分「沒裝 WSL」與「有 WSL 沒發行版」
- `wsl -l -v` 非零 exit 時，以另一個 exit-code 訊號判斷 WSL 本身是否已安裝（例如 `wsl --status` 或 `wsl --version`；本機：WSL 2.7.13 已裝、無發行版時兩者皆 exit 0，`wsl -l -v` exit -1）
- 「有 WSL、沒發行版」回傳空清單或專屬錯誤類型，`error-mapper.ts` 新增對應分類，三語 i18n 文案引導：`wsl --install -d Ubuntu-24.04`（並提到可用 `wsl --list --online` 查看其他發行版）
- 「沒裝 WSL」的既有文案與行為不變
- ⚠️ 本機無法重現「完全沒裝 WSL」，以 mock 的 unit test 覆蓋；回報區註明未實機驗證

## 驗收

- unit（新增）：
  - linger：帶使用者名稱、`Linger=yes` 判定、已啟用直接成功、username 不合白名單 → 失敗
  - unit 檔內容：`ExecStart` / `Environment` 為絕對路徑，**不含 `~`**
  - 安裝路徑解析：`$HOME` 解析成功 / 失敗 / 非絕對路徑
  - rollback：可重試的失敗不觸發前步 rollback；取消時才 rollback（或依查證後的改法寫對應測試）
  - WSL 偵測三態與 `error-mapper` 新分類（含 i18n key 三語存在）
  - 測試檔位置須被 `vite.config.ts` `test.include` 涵蓋
- `npm run test:unit` 全綠（基線 **709**；回報新數字）
- `npx vite build` exit 0
- `npx tsc --noEmit` error 數不得高於 baseline **40**
- **本機 runtime（Worker 可做）**：在 `Ubuntu-24.04` 內以 node 直接呼叫（或 esbuild 打包到 scratchpad 呼叫）修改後的 `enableLinger` / `$HOME` 解析 / unit 內容產生函式；先 `loginctl disable-linger gower` 再驗證能自動啟用。若能以修好的 unit 內容在發行版內 `systemctl --user daemon-reload` 後看到 `Loaded: loaded`（不是 `bad-setting`）更好（bundle 不在時 `start` 失敗屬預期）。scratchpad 產物用完刪除
- **runtime 驗收（交使用者）**：新 build 從頭跑 WSL 精靈 9/9

## 範圍外

- NAT networking 警告（資訊性，connect-test 步驟才相關）
- SSH / Docker 精靈的同類問題（若讀碼時發現，記在回報區「殘餘風險」，不修）
- 本機 WSL 發行版的建立 / 移除

## Sub-session 執行指示

1. 讀取本工單 + `BUG-087` + `BUG-086`
2. 填 `started_at`、`status: IN_PROGRESS`（**`date "+%Y-%m-%dT%H:%M:%S%z"` 取系統時間，禁止手打**，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**（不是 `FIXED`）；BUG-086 / BUG-087 狀態由塔台更新，不要改 BUG 檔
5. commit 僅實際改動檔 + 新測試檔 + 本工單檔（`git commit --only ...`）；`AGENTS.md` 若 dirty 不要碰
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
