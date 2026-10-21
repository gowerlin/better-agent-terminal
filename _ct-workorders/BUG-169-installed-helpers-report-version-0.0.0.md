---
schema_version: 1
schema_kind: bug
id: BUG-169
title: "安裝版的 helper 回報版號 v0.0.0（`--version`、BAT MCP `serverInfo.version`）：helper 讀 `<scripts>/../package.json`，安裝目錄的 `resources/` 沒有這個檔"
status: FIXED
severity: low
reproducibility: always
created_at: "2026-10-21T22:17:40+0800"
updated_at: "2026-10-21T23:41:10+0800"
impact:
  - helper-scripts
  - bat-mcp
links:
  discovered_in: "T0689 回報區「遭遇問題」第 1 點（2026-10-21，`build:dir` 產物實測）"
  related: [T0689, D179, T0691]
---

# BUG-169 — 安裝版的 helper 回報版號 v0.0.0

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟢 low（只影響顯示；塔台判讀 helper 一律看 exit code，不讀版號） |
| 可重現 | 一定（安裝版） |
| **狀態** | ✅ FIXED：T0691（`b0ff5673`，方向 ①：打包時在 resources 放只含 name / version 的 package.json），等下一個預覽版的安裝版驗收；原本排除於 `v0.7.1-pre.5`（D179） |
| 回報者 | T0689 Worker |

## 現象

`bat-terminal.mjs` / `bat-notify.mjs` / `bat-mcp.mjs` 以 `join(<helper 所在目錄>, '..', 'package.json')` 讀版號，讀不到時 fallback `0.0.0`。開發環境是 repo 根目錄的 `package.json`，版號正確；安裝版的 helper 在 `<安裝目錄>/resources/scripts/`，而 `resources/` 底下沒有 `package.json`（app 的 `package.json` 在 `app.asar` 裡），所以：

- `bat-terminal.mjs --version`、`bat-notify.mjs --version`、`bat-mcp.mjs --version` 印 `v0.0.0`（T0689 在 `release/win-unpacked/resources/scripts` 實測）。
- BAT MCP `initialize` 回傳的 `serverInfo.version` 是 `0.0.0`。

T0689 改 `extraResources` 前同樣如此（`*.mjs` 也不含 `package.json`），不是回歸。server bundle 不受影響：`build-server-bundle.mjs` 在 bundle 根目錄寫了只含 `name` / `version` 的 `package.json`。

## 修正方向（待設計）

- ① 打包時讓安裝目錄有可讀的版號來源（例如 `resources/` 放只含 `name` / `version` 的檔；注意 T0689 規定 `resources/scripts` 只放 6 個執行期 helper，`verify-packaged-native.js` 會擋多出的檔案）。
- ② 由 PTY env 提供版號（必須經 `PtyManager.buildPtyEnv()`；BAT MCP 的 codex `env_vars` 白名單也要同步加）。
- 兩者擇一或並用由修正單評估；修正後以 `build:dir` 產物實測三個 helper 的 `--version` 與 MCP `serverInfo.version`。

## 修復紀錄

- **工單**：T0691；commit `b0ff5673`（`fix: installed helpers report the packaged version (T0691, BUG-169)`），未 push。
- **方式**（方向 ①）：electron-builder `afterPack` hook（`package.json` `build.afterPack` = `./scripts/version-manifest.cjs`）在 `<resources>/package.json`（win / linux `resources/`，mac `<App>.app/Contents/Resources/`）寫入只含 `name` / `version` 的檔，版號取 `packager.appInfo.version`（實際寫進 `app.asar` 的版號，CI 的 `VERSION` env 經 `build-version.js` 改寫 `package.json` 後由 electron-builder 讀到）。server bundle 根目錄的 `package.json` 改用同一個 `versionManifestContent`。helper 的版號讀法不變。`resources/scripts` 仍只有 6 個執行期 helper。
- **守門**：`scripts/verify-packaged-native.js` 新增 `helper-version`（存在、可解析、只有 `name` / `version`、非空且不是 `0.0.0`、等於 `app.asar` 的版號）；三平台 fixture 綠燈與紅燈（缺檔、`0.0.0`、多出欄位、版號不符）。
- **Electron 不會把它當 app 載入**：Electron 41.2.1 的 browser init 只讀 `<resources>/{app,app.asar,default_app.asar}/package.json`（`appSearchPaths`）。
- **實測**（`npm run build:dir`，Windows x64）：`release/win-unpacked/resources/package.json` = `{ "name": "better-agent-terminal", "version": "0.7.1-pre.5" }`；在 `resources/scripts`、清掉 `BAT_*` 連線 env 執行 `bat-terminal.mjs` / `bat-notify.mjs` / `bat-mcp.mjs --version` 都印 `v0.7.1-pre.5`；BAT MCP `initialize`（不連線）回 `serverInfo.version: "0.7.1-pre.5"`；暫時移走該檔則回到 `v0.0.0` / `"0.0.0"`（確認原因）。CI 路徑演練（`CI=true VERSION=v0.7.1-t0691.1 node scripts/build-version.js` → `electron-builder --win --dir`）：resources / app.asar / `--version` 皆 `0.7.1-t0691.1`，演練後 `package.json` / lock 無 diff。`verify-packaged-native.js --platform win` 綠。
- **未驗**：mac / Linux 實際產物（由 CI 的 `verify-packaged-native.js` 驗）、NSIS 安裝後的安裝目錄（下一個預覽版驗收）。
