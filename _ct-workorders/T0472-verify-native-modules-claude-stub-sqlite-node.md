---
schema_version: 1
schema_kind: workorder
id: T0472
title: "verify-native-modules.js 加檢查：內嵌 claude-code 執行檔不是 stub、better-sqlite3 原生 .node 存在（T0471 建議 2）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: dev-env
priority: P1
sizing: S
created_at: "2026-10-13T16:39:22+08:00"
started_at: null
updated_at: "2026-10-13T16:39:22+08:00"
completed_at: null
target_version: v0.6.0-pre.3
depends_on:
  - T0471
related:
  - "T0471 回報區：npm 12 擋 install scripts 時 claude-code `bin/claude.exe` 是約 500 bytes 的 stub（內容 `Error: claude native binary not installed.`），`build.npmRebuild: false` 下會被原樣打進安裝檔；現行 verify 抓不到"
  - "T0468：verify-native-modules.js 已有 host 平台 whisper binary 檢查（WHISPER_ADDON_REQUIRED_HOSTS 只擋桌面 host、其他 host warn）"
affects_files:
  - scripts/verify-native-modules.js
  - scripts/__tests__/
  - electron/__tests__/whisper-addon-loader.test.ts
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不得讓任何既有 CI 呼叫點失敗**：呼叫者有 `pre-release.yml`（三平台 build job，於 `npm ci` + `@electron/rebuild` 之後）、`release.yml`（經 `build-version.js` side-effect require）、`build-server-bundle.yml:46`（含 `ubuntu-22.04-arm` 等非桌面 host，可能沒有 `@electron/rebuild`）。逐一讀這些 workflow 判斷各 host 在新檢查下的結果；不確定會通過的 host → 只 warn 不擋（比照 T0468 `WHISPER_ADDON_REQUIRED_HOSTS` 作法），回報區附各呼叫點 × host 的預期結果表"
  - "🔴 不改 `CLAUDE.md`（塔台會補一句文件）、不改 `package.json` / lock、不跑 `npm ci` / `npm install`（下一張 T0473 才會動 package.json 與 node_modules）"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；寫檔維持 LF；不 push"
---

# T0472 — verify-native-modules：claude stub 與 better-sqlite3 .node

## 任務

1. **內嵌 claude 不是 stub**：解析 host 平台的內嵌 claude 執行檔路徑（規則與 `electron/claude-runtime-router.ts` / `electron/claude-resolver.ts` 的 embedded 解析一致，例如 `node_modules/@anthropic-ai/claude-code/bin/claude(.exe)`；若由平台子套件提供，以實際規則為準）。判定 stub 以**內容 / 型態**為主（stub 腳本特徵字串、或非原生執行檔 magic bytes），大小門檻只作輔助；stub 或不存在 → 錯誤，訊息指向 CLAUDE.md「本機開發：npm 12 install scripts」節的補跑指令
2. **better-sqlite3 原生模組存在**：`node_modules/better-sqlite3/build/Release/better_sqlite3.node` 存在（只檢查存在，不檢查 ABI——本腳本以 Node 執行，Node 與 Electron ABI 不同）
3. 單元測試：以暫存假 node_modules 樹覆蓋 stub / 真執行檔 / 缺檔 / 非桌面 host warn 路徑；既有 whisper 規則 parity 測試不得壞
4. 本機實跑 `node scripts/verify-native-modules.js` → exit 0（T0471 後本機已完整）；並在 scratchpad 假樹上證明 stub 會 exit 1

## 驗收條件

- [ ] 新測試綠；`npm run test:unit` 全套 0 failed（基線 2900）
- [ ] 本機 verify exit 0；stub 情境 exit 1 + actionable 訊息
- [ ] 回報區附「呼叫點 × host × 預期結果」表

## Sub-session 執行指示

1. 讀本工單 + T0471 回報區 + `scripts/verify-native-modules.js` + 三個 workflow 呼叫點
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

### 產出摘要

### 驗證結果

### 回報時間
