---
schema_version: 1
schema_kind: workorder
id: T0473
title: "package.json 加 npm 12 allowScripts（approve 5 個、處理 electron-winstaller）+ 查證並修正 postinstall / CLAUDE.md 的 npm rebuild better-sqlite3 是否產出 Electron ABI（T0471 建議 1、3）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: dev-env
priority: P1
sizing: M
created_at: "2026-10-13T16:39:22+08:00"
started_at: null
updated_at: "2026-10-13T16:39:22+08:00"
completed_at: null
target_version: v0.6.0-pre.3
depends_on:
  - T0472
related:
  - "T0471 回報區：npm 12.2.0 擋 better-sqlite3 / electron / electron-winstaller / esbuild / sharp / @anthropic-ai/claude-code 的 install scripts；根 postinstall 的 `npm rebuild better-sqlite3` 走同一 gate 成 no-op；CI 用 Node 24 隨附 npm 11.19.0"
  - "CLAUDE.md「Electron Runtime」：『postinstall 已自動跑 npm rebuild better-sqlite3』『NODE_MODULE_VERSION mismatch 先執行 npm rebuild better-sqlite3』；「本機開發：npm 12 install scripts（T0471）」節"
  - "pre-release.yml：npm ci → @electron/rebuild → verify-native-modules"
affects_files:
  - package.json
  - package-lock.json
  - CLAUDE.md
  - node_modules/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "✅ **本單授權修改 `package.json`**（覆寫 T0471 的禁令）：新增 npm 12 的 install scripts 允許設定；必要時修改 `postinstall`。`package-lock.json` 只允許因上述變更產生的必要差異（理想為零；有差異需逐處解釋）"
  - "✅ 允許在本機跑 `npm ci` 驗證新設定（T0472 已結束，無並行 Worker）；跑完後本機必須恢復完整可用：`node scripts/verify-native-modules.js` exit 0（含 T0472 新增的 claude stub / better-sqlite3 .node 檢查）、內嵌 claude `--version` = `2.1.289`、better-sqlite3 在 Electron 下可開 `:memory:`"
  - "🔴 **CI 相容是硬條件**：npm 11（CI）遇到新欄位必須無錯誤、行為不變；以 npm 11 實測（例：`npx -y npm@11` 在 scratchpad 複製 package.json + lock 做最小驗證），不得全域降級 npm；寫法優先採不綁版本號的 entry（若 npm 12 支援），避免每次升版都要重新 approve"
  - "🔴 不升降級全域 node / npm；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；寫檔維持 LF；不 push"
---

# T0473 — allowScripts + postinstall ABI

## 任務

1. **allowScripts**：依 npm 12 官方格式在 `package.json` 允許 `better-sqlite3`、`electron`、`esbuild`、`sharp`、`@anthropic-ai/claude-code` 的 install scripts；`electron-winstaller` 明確 deny 或不列入（依格式語意擇一並說明）。驗證：本機 npm 12 `npm install-scripts ls` 不再列出被擋項（electron-winstaller 除外）；`npm ci` 後不需任何手動補跑即通過 memory_overrides 第 2 條三項檢查
2. **postinstall ABI 查證**：npm 11 情境下（CI 與一般開發者），根 `postinstall` 的 `npm rebuild better-sqlite3` 產出的是 Node ABI 還是 Electron ABI 145？以證據回答（`process.versions.modules`、prebuild-install / node-gyp 的 runtime 判定、實測 binary 在 Node 與 Electron 下能否載入）。若產出 Node ABI → 改 postinstall 為產出 Electron ABI 的指令（例：repo 既有的 `@electron/rebuild`，不新增套件；若需新增依賴，回報區給理由），並確認不破壞 CI 的 `npm ci` → `@electron/rebuild` 順序（重複 rebuild 可接受但要說明耗時）；mac 分支的 plutil 段保持不變
3. **CLAUDE.md**：「Electron Runtime」相關兩句與「本機開發：npm 12 install scripts（T0471）」節依結論改寫（allowScripts 生效後哪些手動步驟不再需要、仍需要的保留）；另在「Packaging / Release 前置檢查」的 Build fail-fast 條補一句 T0472 新增的 claude stub / better-sqlite3 `.node` 檢查
4. 驗證：`npx vite build` exit 0；`npm run test:unit` 0 failed；`node scripts/verify-native-modules.js` exit 0；`node scripts/verify-helper-bundle.js` exit 0

## 驗收條件

- [ ] npm 12：`npm ci` 後零手動步驟，三項本機檢查通過（證據）
- [ ] npm 11：同一 `package.json` / lock 的 `npm ci`（或等價最小驗證）無錯誤、行為不變（證據）
- [ ] postinstall ABI 結論 + 修正（或「無需修正」的證據）
- [ ] CLAUDE.md 更新；build / unit / verify 全綠

## Sub-session 執行指示

1. 讀本工單 + T0471、T0472 回報區 + CLAUDE.md 相關節 + `package.json` scripts
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案（node_modules 不進 git）；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

### 產出摘要

### 驗證結果

### 回報時間
