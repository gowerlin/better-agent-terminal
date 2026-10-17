# Build Toolchain

> 從 CLAUDE.md「Build Toolchain」節搬出（T0595）。本檔為該節完整原文；CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結。

- Vite 7.x（2026-04-18 PLAN-003 Group B / T0163 升級，原 vite 5.4.21 → 7.3.2，清除 esbuild SSRF 與 vite path traversal 2 個 moderate CVE）。
- Plugin 組合：
  - `@vitejs/plugin-react` ^5.0.0（實裝 5.2.0）
  - `vite-plugin-electron` ^0.29.1（stable，官方宣告支援 vite 7/8）
  - `vite-plugin-electron-renderer` ^0.14.6（無 peer 限制）
- `vite.config.ts` 目前未用 vite 7 移除的 API（`splitVendorChunkPlugin`、`transformIndexHtml` 舊 hook 格式、`resolve.conditions` custom、Sass）；若日後新增構建設定請留意這些被移除的 API。
- 下次升級目標：vite 8（等 `vite-plugin-electron@1.0.0` GA 脫離 beta，預估 6-12 個月後）。相關研究見 T0162、決策見 D052/D053。

# electron-builder 26 migration notes

- **mac.notarize 格式變更**：v26 將 `mac.notarize` 從物件（`{ teamId }`）改為 boolean，認證資訊統一從環境變數讀取。目前 `package.json` 設為 `notarize: true`。
- **啟用 mac notarization 需設以下環境變數任一組合**（官方推薦組合 1）：
  1. `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`
  2. `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`（本專案 teamId = `8JVDJGLLYR`）
  3. `APPLE_KEYCHAIN` + `APPLE_KEYCHAIN_PROFILE`
- **CI workflow 注意**：`.github/workflows/pre-release.yml` 目前 mac job 未設 `APPLE_*` secrets，實際無 notarization（與升級前行為一致）。若要啟用，需補環境變數到 `Package for macOS` step。
- **Windows 打包驗收**：NSIS installer 產出約 172 MB、zip 約 230 MB；electron-builder 26 在 Windows 禁止跑 `--mac --dir`（v24 曾允許），但 schema parse 仍可通過。
- **mac 只打 arm64 dmg**（2026-10-13 D136，v0.6.0-pre.3 起；取代 D057 的雙 arch dmg）：`mac.target.arch = ["arm64"]`，產出 `BetterAgentTerminal-*-arm64.dmg`，**不支援 Intel Mac**。原因（BUG-117 / T0474）：macOS CI 只有一台 arm64 host，`npm ci` 只裝 host 平台的 optional 子套件、`build.npmRebuild: false`，x64 `.app` 實際打包的是 arm64 的內嵌 claude / codex / node-pty / whisper，Intel Mac 上全不可用。要恢復 x64 必須改成 Intel runner 獨立 job（D136 不採用的 B1），不要在 arm64 host 上替換子套件（B2，whack-a-mole）。**不要改成 `"universal"`**（D057 仍有效）— `@electron/universal` 合併 ASAR 時對 `asarUnpack` 內所有 bit-identical 檔案都要求 `x64ArchFiles` 規則覆蓋，本專案 `@anthropic-ai/claude-code`、`@anthropic-ai/claude-agent-sdk`、`@lydell/node-pty-*` 都 ship 全平台 binary（`@img/**` 自 T0503 起不打包），維護 pattern 是 whack-a-mole。完整 root cause 與 5 次 CI run 失敗記錄見 `_ct-workorders/EXP-BUILDER26-001` 的「CI 實戰後續」段落。
