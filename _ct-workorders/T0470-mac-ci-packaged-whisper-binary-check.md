---
schema_version: 1
schema_kind: workorder
id: T0470
title: "mac CI 打包後檢查兩個 arch 產物的 app.asar.unpacked 內 whisper.node（BUG-116 修復方向 4 CI 部分），pre-release.yml + release.yml"
type: implementation
status: PENDING
repo: better-agent-terminal
project: BUG-116
priority: P1
sizing: S
created_at: "2026-10-13T16:17:57+08:00"
started_at: null
updated_at: "2026-10-13T16:17:57+08:00"
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

### 產出摘要

### 驗證結果

### 回報時間
