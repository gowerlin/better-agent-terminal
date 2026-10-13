---
schema_version: 1
schema_kind: workorder
id: T0470
title: "mac CI 打包後檢查兩個 arch 產物的 app.asar.unpacked 內 whisper.node（BUG-116 修復方向 4 CI 部分），pre-release.yml + release.yml"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: BUG-116
priority: P1
sizing: S
created_at: "2026-10-13T16:17:57+08:00"
started_at: "2026-10-13T16:19:08+08:00"
updated_at: "2026-10-13T16:19:08+08:00"
completed_at: null
target_version: next
depends_on:
  - T0468
related:
  - "BUG-116 根因：上游 @kutalia/whisper-node-addon 出貨 mac-<arch>，loader 找 darwin-<arch>；T0468 自有 loader 先找 mac-<arch> 再找 darwin-<arch>"
  - "T0468 scripts/verify-native-modules.js：只檢查 host arch（macos-latest = arm64）的 node_modules，不檢查打包產物"
  - "package.json build.mac.target：dmg × [x64, arm64]（D057，不可改回 universal）"
affects_files:
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - scripts/verify-packaged-native.js
  - scripts/__tests__/
  - CLAUDE.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 不 push、不觸發任何 GitHub workflow、不建 tag；CI 實跑驗證留給下一次發版（塔台會在 v0.6.0-pre.3 run 觀察本步驟）"
  - "🔴 只動 affects_files 列出的檔案（新腳本命名可調整，回報區說明）；與 T0469 並行（T0469 改 electron/voice-opencc.ts），`git add` 只加本單檔案"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；寫檔維持 LF；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀查詢可用）"
---

# T0470 — mac CI 打包產物 whisper.node 檢查

## 任務

1. 新增打包後檢查腳本（建議 `scripts/verify-packaged-native.js`，零依賴 Node）：給定 electron-builder 輸出目錄，找出 mac 兩個 arch 的 `.app`（electron-builder dual-arch 的實際輸出目錄名請從設定 / 官方行為確認，例如 `release/mac/` 與 `release/mac-arm64/`），檢查 `Contents/Resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist/<dir>/whisper.node` 存在，`<dir>` 依 T0468 loader 規則（`mac-<arch>` 優先、`darwin-<arch>` fallback；規則與 `electron/whisper-addon-loader.ts` 同步並加註）。任一 arch 缺 → exit 1 + actionable 訊息（列出找過的路徑）；找不到某 arch 的 `.app` 也算失敗（避免靜默略過）
2. `pre-release.yml` 與 `release.yml` 的 mac job：在 `Package for macOS` 之後、上傳 artifact 之前加一步執行該腳本（`if: matrix.platform == 'mac'` 或該檔等價條件）
3. 單元測試：以暫存目錄假造 .app 樹，覆蓋：兩 arch 皆有 → 0；缺一 arch binary → 1；只有 `darwin-<arch>` → 0；缺某 arch 的 .app → 1
4. `CLAUDE.md`「Packaging / Release 前置檢查」補兩句：`verify-native-modules.js` 已含 host 平台 whisper binary 檢查（T0468）；mac CI 打包後以本腳本檢查兩 arch 產物（T0470）。CI pipeline 那句的步驟順序同步更新

## 驗收條件

- [ ] 新測試綠；`npm run test:unit` 全套 0 failed
- [ ] workflow YAML 語法有效（有 `actionlint` 就跑；沒有則以 node 的 YAML parser 或等價方式至少 parse 一次並在回報區說明）
- [ ] 回報區附 pre-release.yml / release.yml 新增步驟的 diff 摘要（含行號）

## Sub-session 執行指示

1. 讀本工單 + BUG-116 + `electron/whisper-addon-loader.ts` + 兩個 workflow 的 mac job
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

DONE — 打包後檢查腳本、兩個 workflow mac 步驟、單元測試、CLAUDE.md 皆完成；CI 實跑驗證依工單留給下一次發版（v0.6.0-pre.3）。

**Landing Zone Check：PASS**
- C-0：frontmatter `repo: better-agent-terminal` vs `basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`.github/workflows/*.yml`、`scripts/`、`CLAUDE.md` 皆存在 → PASS（資訊性）
- C-2：工單無 `branch` 欄位，HEAD = `main` → 不適用
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

| 檔案 | 變更 |
|---|---|
| `scripts/verify-packaged-native.js`（新） | 零依賴 CJS。`node scripts/verify-packaged-native.js [--out <dir>] [--arch x64,arm64]`（預設 `<repo>/release`、`x64,arm64`）。每個 arch 掃 `<out>/mac`（x64）/ `<out>/mac-<arch>`（其他）下所有 `*.app`，檢查 `Contents/Resources/app.asar.unpacked/node_modules/@kutalia/whisper-node-addon/dist/{mac-<arch>,darwin-<arch>}/whisper.node`（順序同 loader）。任一 arch 無 `.app` 或任一 `.app` 缺 binary → exit 1，列出 `no .app found in <dir>` 或每個 `looked for:` 路徑 + 修復提示。`require.main === module` 才執行 main，測試可直接 require |
| `scripts/__tests__/verify-packaged-native.test.mjs`（新） | 10 tests：目錄規則與 `electron/whisper-addon-loader.ts`、`scripts/verify-native-modules.js` parity；arch→輸出目錄對應；兩 arch 皆有 → ok + CLI exit 0；缺一 arch binary（只放錯 arch 的 binary）→ exit 1 且 stderr 列 `mac-x64` / `darwin-x64` 路徑；只有 `darwin-<arch>` → exit 0；缺 x64 `.app` → exit 1；輸出目錄不存在 → 全 arch 失敗；`parseArgs` 預設 / 覆寫 / 錯誤參數 |
| `.github/workflows/pre-release.yml` | `build` job，`Package for macOS` 之後新增步驟（見下 diff） |
| `.github/workflows/release.yml` | 同上 |
| `CLAUDE.md`「Packaging / Release 前置檢查」 | Build fail-fast 條補「`verify-native-modules.js` 也檢查 host 平台 whisper binary（T0468）」；新增「mac 打包產物檢查」條（T0470）；CI pipeline 順序補 `electron-builder` →（mac job）`verify-packaged-native.js` → 上傳 artifact |

**electron-builder dual-arch 輸出目錄確認**（取自本機 `node_modules`）：`app-builder-lib/out/platformPackager.js:89-91` `computeAppOutDir` = `<out>/<buildConfigurationKey><archSuffix>`（mac 無 `-unpacked`）；`builder-util/out/arch.js:35-37` `getArchSuffix` 在 arch == defaultArch（未設時為 x64）回 `""`，否則 `-<arch>`。⇒ x64 → `release/mac/BetterAgentTerminal.app`、arm64 → `release/mac-arm64/BetterAgentTerminal.app`（`macPackager.js:194`）。腳本不寫死 productName，掃該目錄所有 `*.app`。

**Workflow diff 摘要**

`pre-release.yml`（`@@ -209,0 +210,6 @@`，新步驟名在 L212；`Package for macOS` L206-208，`Upload macOS artifacts` 移至 L229）：
```yaml
+      # BUG-116 / T0470: verify-native-modules.js only sees the host arch (arm64);
+      # check the whisper binary inside both packaged .app (x64 + arm64).
+      - name: Verify packaged whisper binary (macOS x64 + arm64)
+        if: matrix.platform == 'mac'
+        run: node scripts/verify-packaged-native.js --out release --arch x64,arm64
+
```
`release.yml`（`@@ -198,0 +199,6 @@`，新步驟名在 L201；`Package for macOS` L191-197，`Upload macOS artifact` 移至 L218）：內容同上。

**偏離 / 備註**
- 目錄規則為第三份複本（`.js` 不能 import `.ts`；`verify-native-modules.js` 被 require 時會跑 main，故不從它 import），三處皆加「keep in sync」註解，並由新測試斷言 parity。
- `release.yml` 的 mac build 沒有獨立 `verify-native-modules.js` 步驟（由 `build-version.js` side-effect require 執行），本單未動，維持既有行為。
- 確認本機 `node_modules/@kutalia/whisper-node-addon/dist/` 同時有 `mac-x64/whisper.node` 與 `mac-arm64/whisper.node`（npm 套件與 arch 無關），x64 `.app` 預期能通過，不會誤報。

### 驗證結果

| Lane | 結果 | 證據 |
|---|---|---|
| 新測試 | PASS | `npx vitest run scripts/__tests__/verify-packaged-native.test.mjs` → 1 file / 10 tests passed |
| 全套單元測試 | PASS | `npm run test:unit` → Test Files 172 passed (172)，Tests 2900 passed / 1 skipped，0 failed（輸出中的 `Error: AttachConsole failed` 堆疊為既有 `@lydell/node-pty` conpty agent 雜訊，與本單無關） |
| Workflow YAML | PASS（js-yaml parse） | 本機無 `actionlint`；以 `node_modules/js-yaml` `load()` 兩檔皆 parse 成功，並斷言 `build` job 步驟順序 `Package for macOS`(idx 10/11) < `Verify packaged whisper binary`(11/12) < `Upload macOS artifact(s)`(14/15)，`if` = `matrix.platform == 'mac'`，`run` 字串正確 |
| Build | PASS | `npx vite build` 成功 |
| CLI smoke | PASS | 對不存在目錄執行 → 兩 arch 皆報 `no .app found in ...`，exit=1 |
| CI 實跑 | 未執行（依工單） | 不 push、不觸發 workflow；塔台於 v0.6.0-pre.3 run 觀察本步驟 |

**Commit**：見下方 commit hash（只 `git add` 本單 5 個檔案 + 工單；T0469 的 `electron/voice-opencc.ts` / T0469 工單未納入）。未 push。

### 回報時間

"2026-10-13T16:21:55+08:00"
