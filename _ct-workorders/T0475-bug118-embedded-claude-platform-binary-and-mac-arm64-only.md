---
schema_version: 1
schema_kind: workorder
id: T0475
title: "BUG-118 修復（非 Windows 打包版內嵌 claude 改指平台子套件 binary）+ BUG-117 B3（mac 只打 arm64 dmg）+ verify-packaged-native 擴充（內嵌 claude 存在 / arch、Mach-O cputype 全掃、Linux 產物）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-118
priority: P0
sizing: M
created_at: "2026-10-13T17:03:12+08:00"
started_at: null
updated_at: "2026-10-13T17:03:12+08:00"
completed_at: null
target_version: v0.6.0-pre.3
depends_on:
  - T0474
related:
  - "D136（使用者裁決：BUG-118 放進 pre.3 採 A1；BUG-117 採 B3 停發 x64 dmg）"
  - "BUG-118 / BUG-117 全文；T0474 回報區 E2 / E4 / E5 與「verify 擴充 (a)(b)(c)」"
  - "T0470 scripts/verify-packaged-native.js；T0472 scripts/verify-native-modules.js（classifyEmbeddedClaude / executableFormat 可重用）"
  - "BUG-052（electron-packaged 版面固定 bin/claude.exe 的由來）"
affects_files:
  - electron/claude-runtime-router.ts
  - electron/__tests__/
  - scripts/verify-packaged-native.js
  - scripts/__tests__/
  - package.json
  - .github/workflows/pre-release.yml
  - .github/workflows/release.yml
  - CLAUDE.md
  - docs/
  - README.md
  - _ct-workorders/BUG-117-mac-x64-dmg-ships-arm64-native-binaries.md
  - _ct-workorders/BUG-118-non-windows-package-missing-embedded-claude.md
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "✅ 本單授權修改 `package.json` 的 `build.mac.target`（arch 只留 `arm64`）；其他 `package.json` 欄位不動；`package-lock.json` 不得變動"
  - "🔴 **Windows 行為不得改變**：win32 的 electron-packaged / node-modules 版面仍解析 `bin/claude.exe`（單元測試證明）；node-modules（dev）版面行為不變"
  - "🔴 不 push、不觸發 workflow、不建 tag；CI 實跑留給 pre.3（塔台觀察）。不執行任何下載回來的 release 產物"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；寫檔維持 LF；`gh` 一律帶 `-R gowerlin/better-agent-terminal`（唯讀）"
---

# T0475 — BUG-118 修復 + mac 只打 arm64 + 打包產物驗證擴充

## A. BUG-118：內嵌 claude 指向平台子套件 binary（方案 A1）

1. `electron/claude-runtime-router.ts` `resolveEmbeddedClaudePath()`：`electron-packaged` 版面且 `process.platform !== 'win32'` 時，優先回傳 `<resources>/app.asar.unpacked/node_modules/@anthropic-ai/claude-code-<platform>-<arch>[-musl]/claude`（musl 判定沿用專案既有作法；若無，以 claude-code `install.cjs` 的判定邏輯為準並在回報區說明）；不存在才 fallback `bin/claude.exe`。實際打包檔名 / 路徑以 T0474 E2 / E4 為準（`claude-code-darwin-arm64/claude`、`claude-code-linux-x64/claude`）
2. embedded 分支（`resolveClaudeRuntime()` 約 `:236-242`）補 existsSync：兩個候選都不存在時，行為比照 system 偵測失敗（若 `fallbackToEmbedded` 語意不適用，至少 `logger.error` 一次並讓錯誤訊息指出缺哪個檔，不要讓 SDK 丟出難懂的 ENOENT）。決策點與既有 degraded reason / toast 機制對齊，回報區說明
3. 檢查所有使用內嵌路徑的呼叫點（Agent SDK `pathToClaudeCodeExecutable`、terminal claude-cli preset、auth-manager、`getSupportedModels` probe 等）都經由同一解析，不另有寫死 `bin/claude.exe` 的地方
4. 單元測試：darwin-arm64 / linux-x64 / linux-x64-musl / win32-x64 × electron-packaged / node-modules；子套件 binary 缺時 fallback；兩者皆缺時的錯誤路徑

## B. BUG-117：mac 只打 arm64（B3）

1. `package.json` `build.mac.target[].arch` → `["arm64"]`
2. `pre-release.yml` / `release.yml`：mac verify 步驟改 `--arch arm64`；release job 收集 / 上傳 mac 產物的路徑或 glob 若綁定 x64 檔名（無後綴 `.dmg`）一併調整；檢查 Homebrew dispatch（`release.yml`）payload 是否引用 x64 dmg，若有 → 回報區說明影響與建議（不要改下游 repo）
3. `CLAUDE.md`：「electron-builder 26 migration notes」的「mac 打包採雙 arch dmg（D057）」條改寫為 arm64-only（D136），保留「不要改回 universal」理由；「Packaging / Release 前置檢查」相關句同步
4. README / docs 若有 Intel Mac 下載說明 → 改為「不支援 Intel Mac（自 v0.6.0-pre.3 起，D136）」

## C. `scripts/verify-packaged-native.js` 擴充（T0474 建議 a/b/c）

1. **mac**：對每個 `.app`
   - (a) 以 `Contents/MacOS/<exe>` 的 cputype 為基準 arch
   - (b) 掃 `Contents/Resources/app.asar.unpacked` 下所有 Mach-O（含 fat），cputype 必須等於基準或 fat 內含基準；ELF / PE 不檢查；允許清單只放刻意跨平台 / 跨 arch 的目錄（如 whisper `dist/linux-*`、`dist/win32-*`、`dist/mac-<非基準 arch>/`），並在程式碼註解說明
   - (c) 依 A 的解析規則找出內嵌 claude，必須存在且 cputype 符合基準
   - 既有 whisper 檢查保留
2. **Linux**：新增模式檢查 `release/linux-unpacked`（實際目錄以 electron-builder 行為為準）內的內嵌 claude（`claude-code-linux-x64/claude`）存在且為 ELF x86-64；加進 `pre-release.yml` / `release.yml` linux job（`Package for Linux` 之後、上傳前）
3. Mach-O / ELF 判定可重用 T0472 的 `executableFormat` 等（或抽共用模組，`.js` 間 require 即可）；T0474 的判定常數：Mach-O magic `0xFEEDFACF`、fat `0xCAFEBABE`、cputype x86_64 `0x01000007`、arm64 `0x0100000C`
4. 單元測試以暫存假樹覆蓋：arm64 `.app` 全 arm64 → 0；混入 x86_64 / 缺內嵌 claude → 1；fat 含基準 → 0；Linux 缺 claude → 1；ELF 非 x86-64 → 1

## 驗收條件

- [ ] `npm run test:unit` 全套 0 failed（基線 2920）；`npx vite build` exit 0；electron 型別 scratchpad tsconfig 0 新錯；`npx tsc --noEmit` ≤ 36
- [ ] **以 pre.2 實物回放 C 的檢查**（可選但強烈建議）：下載 `v0.6.0-pre.2` arm64 dmg 與 AppImage 到 scratchpad 本單專用新目錄，以 7-Zip 靜態解開，對解出的 `.app` / AppImage 目錄執行新版 verify → **應 FAIL 且指出缺內嵌 claude**（證明新檢查抓得到 BUG-118）；全程不執行產物內任何程式，完成後刪除下載與解壓檔
- [ ] workflow YAML parse 成功（js-yaml），步驟順序斷言
- [ ] BUG-117 / BUG-118 檔：補「修復（T0475）」段、狀態改 ✅ FIXED、`fix_workorder: T0475`（`_bug-tracker.md` 由塔台 sync）

## Sub-session 執行指示

1. 讀本工單 + D136 + BUG-117 / BUG-118 + T0474 回報區 + `electron/claude-runtime-router.ts` + `scripts/verify-packaged-native.js` + 兩個 workflow 的 mac / linux job
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

### 產出摘要

### 驗證結果

### 回報時間
