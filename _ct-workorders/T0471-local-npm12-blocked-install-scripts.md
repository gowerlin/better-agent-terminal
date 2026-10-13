---
schema_version: 1
schema_kind: workorder
id: T0471
title: "本機開發環境 npm 12 預設擋 install scripts：補跑 claude-code 安裝腳本、確認 postinstall（npm rebuild better-sqlite3）行為，並在 CLAUDE.md 記錄本機安裝步驟"
type: implementation
status: PENDING
repo: better-agent-terminal
project: dev-env
priority: P2
sizing: S
created_at: "2026-10-13T16:17:57+08:00"
started_at: null
updated_at: "2026-10-13T16:17:57+08:00"
completed_at: null
target_version: next
depends_on:
  - T0470
related:
  - "T0467 回報區「repo node_modules 修復」：本機 npm 12.2.0（Node v24.21.0）`npm ci` 後 electron / esbuild / sharp / better-sqlite3 / claude-code / electron-winstaller 的 install scripts 被擋；已手補前四者，`@anthropic-ai/claude-code` 的 `install.cjs` 未補；未執行 `npm install-scripts approve`（會改 package.json）"
  - "CI 用 actions/setup-node node-version '24'（隨附 npm，非 12）→ 本單只處理本機"
affects_files:
  - node_modules/
  - CLAUDE.md
  - scripts/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **不改 `package.json` / `package-lock.json`**（不執行 `npm install-scripts approve`、不加 allow-scripts 設定到 tracked 檔）；不執行 `npm ci` / `npm install`（node_modules 已由 T0467 還原，只補跑被擋的腳本）。若結論是「必須改 package.json 才合理」，回報區給方案與利弊，由塔台裁決"
  - "🔴 不升降級使用者的全域 node / npm；可唯讀查詢 `npm config`、npm 12 的 install-scripts 相關文件"
  - "🔴 禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；寫檔維持 LF；不 push"
---

# T0471 — 本機 npm 12 install scripts

## 任務

1. 確認現況：npm 12 擋了哪些套件的哪些 lifecycle script（含本 repo 自己的 `postinstall`：`npm rebuild better-sqlite3` 是否也被擋）；以 `npm query` / `npm ls` / npm 12 文件為依據
2. 補跑 `@anthropic-ai/claude-code` 的安裝腳本，確認內嵌 claude 可用：`node_modules` 內 claude 執行檔 `--version` 輸出 `2.1.289`（以 `electron/claude-resolver.ts` 的 embedded 解析邏輯找到的路徑為準）
3. 其他被擋但未補的腳本（如 `electron-winstaller`）逐一判斷是否影響本機 dev / 本機打包（`release.ps1`），需要就補跑
4. `CLAUDE.md` 新增短節「本機開發：npm 12 install scripts」：症狀、被擋清單、補跑指令（或一支 `scripts/` 下的輔助腳本，若做了）、CI 不受影響的原因
5. 驗證：`npx vite build` exit 0；`npm run test:unit` 0 failed；`node scripts/verify-native-modules.js` exit 0

## 驗收條件

- [ ] 內嵌 claude `--version` = `2.1.289`（證據）
- [ ] 被擋腳本清單與處置表（補跑 / 不需要 + 理由）
- [ ] CLAUDE.md 新節；上述三項驗證綠

## Sub-session 執行指示

1. 讀本工單 + T0467 回報區「repo node_modules 修復」段
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案（node_modules 不進 git）；不 push；依派發 mode 通知塔台

---

## 回報區

### 完成狀態

### 產出摘要

### 驗證結果

### 回報時間
