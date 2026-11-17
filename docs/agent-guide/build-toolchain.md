# Build Toolchain

> 從 CLAUDE.md「Build Toolchain」節搬出（T0595）。本檔為該節完整原文；CLAUDE.md 該節保留用途、必守規則、唯一實作位置與本檔連結。

- Vite 7.x（2026-04-18 PLAN-003 Group B / T0163 升級，原 vite 5.4.21 → 7.3.2，清除 esbuild SSRF 與 vite path traversal 2 個 moderate CVE）。T0873（npm audit，2026-11-17）lock 內升到 vite 7.3.8（esbuild 0.28.2）、vitest / `@vitest/ui` 4.1.12（`package.json` 範圍改 `^4.1.12`），仍是同一主版本。
- Plugin 組合：
  - `@vitejs/plugin-react` ^5.0.0（實裝 5.2.0）
  - `vite-plugin-electron` ^0.29.1（stable，官方宣告支援 vite 7/8）
  - `vite-plugin-electron-renderer` ^0.14.6（無 peer 限制）
- `vite.config.ts` 目前未用 vite 7 移除的 API（`splitVendorChunkPlugin`、`transformIndexHtml` 舊 hook 格式、`resolve.conditions` custom、Sass）；若日後新增構建設定請留意這些被移除的 API。
- 下次升級目標：vite 8（等 `vite-plugin-electron@1.0.0` GA 脫離 beta，預估 6-12 個月後）。相關研究見 T0162、決策見 D052/D053。

## mermaid：不打包 elkjs（T0878 / D299）

- **原因**：mermaid 12 內建 ELK layout，依賴 `elkjs` 0.12.x（`EPL-2.0 OR GPL-3.0-or-later`，約 1.5 MB）。vite 會把它打成 lazy chunk `dist/assets/elk-*.js`，隨 `app.asar` 與安裝檔散布。BAT 以 `layout: 'dagre'` 渲染（`src/components/FileTreeMarkdown.tsx`），執行時用不到 ELK，所以不散布它（D299）。
- **替換點**：mermaid 12.3.0 的 `node_modules/mermaid/dist/chunks/mermaid.core/elk-*.mjs` 以 `import ELK from "elkjs/lib/elk.bundled.js"` 匯入（該檔第 32 行附近；`chunk-*.mjs` 的 `elkLayoutLoaders` 以 `import("./elk-….mjs")` lazy 載入它）。`vite.config.ts` 的 `resolve.alias` 把所有 `elkjs` specifier（`/^elkjs(?:\/.*)?$/`）換成 `src/lib/elkjs-stub.ts`。以套件路徑比對，不依賴 mermaid chunk 的雜湊檔名；不改 `node_modules`、不 patch mermaid。
- **空殼行為**：`ELK` 類別的 `layout()` 等方法回傳 rejected Promise（訊息 `ELK_NOT_BUNDLED_MESSAGE`）。圖裡寫 `layout: elk`（front matter）時，mermaid 在該圖畫錯誤圖（「Syntax error in text」＋版本），同頁其他圖照常渲染，沒有未處理的例外。`flowchart-elk` 在 BAT 設定下本來就以 dagre 排版（有無空殼結果相同）。其他 7 種圖與 T0876 最終的 SVG 逐字相同（class 圖的邊框控制點每次渲染本來就隨機）。
- **大小**：`dist/assets` JS 總和 7,274,042 → 5,796,971 bytes；`elk-*.js` 1,513,070 → 36,121 bytes（只剩 mermaid 自己的 ELK renderer＋空殼）。
- **守門測試** `scripts/__tests__/no-elkjs-in-dist.test.mjs`：
  1. `vite.config.ts` 有 alias 這一行、空殼的 `layout()` 會 reject；
  2. 已安裝的 mermaid 只以 `MERMAID_ELKJS_SPECIFIERS`（目前 `elkjs/lib/elk.bundled.js`）匯入 elkjs；
  3. 有 `dist/assets` 時（`npx vite build` 後），沒有 JS 含 elkjs 的特徵字串（`org.eclipse.elk`、`Eclipse Public License`），每個 `elk-*.js` < 200 KB 且含空殼訊息；沒有 build 時跳過這項。
- 🔴 **升 mermaid 時**：跑上面的測試。匯入 specifier 改了（例如改用 `elkjs/lib/elk-api.js`、或把 elkjs 內嵌進 mermaid 自己的 chunk）→ 測試失敗；確認 alias 仍涵蓋新的匯入、空殼的 API 與新呼叫方式相容（mermaid 只呼叫 `new ELK()` 與 `layout()`），再更新 `MERMAID_ELKJS_SPECIFIERS`。也要確認 mermaid 對 layout 失敗仍是「該圖顯示錯誤圖、其他圖照常」。
- **圖指定 ELK 時改用 dagre 並顯示說明（T0879 / D300）**：Markdown 預覽渲染前以 `applyMermaidElkFallback`（`src/lib/mermaid-elk-fallback.ts`）把 front matter `config.layout` 或 `%%{init|initialize: …}%%` 頂層 `layout` 的 `elk` / `elk.*` 改成 `dagre`，圖下方顯示一行說明（`sidebar.mermaidElkFallback`）；只改傳給 mermaid 的文字，認不出的寫法照原文渲染（上述錯誤圖），升 mermaid 時一併確認 layout 的設定來源沒變（`src/lib/__tests__/mermaid-elk-fallback.test.ts`）。

# electron-builder 26 migration notes

- **mac.notarize 格式變更**：v26 將 `mac.notarize` 從物件（`{ teamId }`）改為 boolean，認證資訊統一從環境變數讀取。目前 `package.json` 設為 `notarize: true`。
- **啟用 mac notarization 需設以下環境變數任一組合**（官方推薦組合 1）：
  1. `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`
  2. `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`（本專案 teamId = `8JVDJGLLYR`）
  3. `APPLE_KEYCHAIN` + `APPLE_KEYCHAIN_PROFILE`
- **CI workflow 注意**：`.github/workflows/pre-release.yml` 目前 mac job 未設 `APPLE_*` secrets，實際無 notarization（與升級前行為一致）。若要啟用，需補環境變數到 `Package for macOS` step。
- **Windows 打包驗收**：NSIS installer 產出約 172 MB、zip 約 230 MB；electron-builder 26 在 Windows 禁止跑 `--mac --dir`（v24 曾允許），但 schema parse 仍可通過。
- **Electron 45（T0784）**：electron-builder 26.8.1 不升也能打 Electron 45.2.1（Windows x64 `npm run build:dir` ＋ `verify-packaged-native.js` 綠）。打包用的 Electron zip 由 electron-builder 自己以 `@electron/get` 下載（log 的 `downloaded url=…/v45.2.1/electron-v45.2.1-win32-x64.zip`），不依賴 `node_modules/electron/dist`（Electron 42 起 `npm ci` 不下載 binary）。Electron 44 起 ANGLE 靜態連結，`win-unpacked/` 不再有 `libEGL.dll` / `libGLESv2.dll`（打包檢查本來就不看這兩個檔）。macOS / Linux 打包待 `desktop-build.yml` 驗。vite / `vite-plugin-electron` 0.29.1 不變，`vite build` 產出的 `dist-electron/preload.js` 仍只 `require("electron")`（Electron 45 sandbox preload 拿不到 `Buffer` / `setImmediate` 等 shim，preload 沒用到）。
- **mac 只打 arm64 dmg**（2026-10-13 D136，v0.6.0-pre.3 起；取代 D057 的雙 arch dmg）：`mac.target.arch = ["arm64"]`，產出 `BetterAgentTerminal-*-arm64.dmg`，**不支援 Intel Mac**。原因（BUG-117 / T0474）：macOS CI 只有一台 arm64 host，`npm ci` 只裝 host 平台的 optional 子套件、`build.npmRebuild: false`，x64 `.app` 實際打包的是 arm64 的內嵌 claude / codex / node-pty / whisper，Intel Mac 上全不可用。要恢復 x64 必須改成 Intel runner 獨立 job（D136 不採用的 B1），不要在 arm64 host 上替換子套件（B2，whack-a-mole）。**不要改成 `"universal"`**（D057 仍有效）— `@electron/universal` 合併 ASAR 時對 `asarUnpack` 內所有 bit-identical 檔案都要求 `x64ArchFiles` 規則覆蓋，本專案 `@anthropic-ai/claude-code`、`@anthropic-ai/claude-agent-sdk`、`@lydell/node-pty-*` 都 ship 全平台 binary（`@img/**` 自 T0503 起不打包），維護 pattern 是 whack-a-mole。完整 root cause 與 5 次 CI run 失敗記錄見 `_ct-workorders/EXP-BUILDER26-001` 的「CI 實戰後續」段落。
