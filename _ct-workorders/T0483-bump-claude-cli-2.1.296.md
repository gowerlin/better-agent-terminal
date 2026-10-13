---
schema_version: 1
schema_kind: workorder
id: T0483
title: "內嵌 claude CLI 追版：@anthropic-ai/claude-code ^2.1.289 → ^2.1.296（含平台子套件），核對模型清單 / effort / 服務端版本門檻，SDK 維持 0.2 線"
type: implementation
status: TODO
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-10-13T22:53:16+08:00"
started_at: null
updated_at: "2026-10-13T22:53:16+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on: []
related:
  - "CLAUDE.md「Claude Agent SDK / CLI」：內嵌 CLI 落後即功能故障，每次預覽版發布前追版；SDK 刻意留在 0.2 線（D123）"
  - "T0371（前次追版 2.1.113 → 2.1.289 的做法與驗證項目）"
  - "T0473（allowScripts：`@anthropic-ai/claude-code` 已放行）；T0475（mac / Linux 內嵌 claude 指向 `claude-code-<platform>-<arch>[-musl]/claude`）"
affects_files:
  - package.json
  - package-lock.json
  - CLAUDE.md
  - electron/claude-agent-manager.ts
  - electron/claude-resolver.ts
  - src/lib/model-pricing.ts
  - src/lib/__tests__/model-pricing.test.ts
  - scripts/verify-native-modules.js
  - scripts/__tests__/
  - tests/claude-resolver.test.ts
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權修改 `package.json` 的 `@anthropic-ai/claude-code` 版本與對應 `package-lock.json` 變動（含 `@anthropic-ai/claude-code-*` 平台子套件）；其他相依**不得**連帶升版（lock diff 只能涉及 claude-code 系列，回報區附 diff 摘要）"
  - "🔴 `@anthropic-ai/claude-agent-sdk` 不動（D123：留 0.2 線）"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build（BUG-119 migration 會作用在使用者真實資料目錄）；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime"
  - "🔴 價格只能取自官方來源並在回報區附出處；查不到就不改計價表"
---

# T0483 — 內嵌 claude CLI 追版 2.1.296

## 背景

- 內嵌 `@anthropic-ai/claude-code` 實裝 `2.1.289`；`npm view @anthropic-ai/claude-code version` = `2.1.296`（2026-10-13 22:50 塔台查詢）
- 服務端以 CLI 版本擋新模型（`claude_code_version_too_old`），內嵌落後即可能功能故障

## 實作

1. 開工時再查一次 `npm view @anthropic-ai/claude-code version`；若已高於 2.1.296，取當下最新並在回報區說明
2. `package.json` 版本改為 `^<新版>`；`npm install`（或等效）更新 lock；確認 lock diff 只含 claude-code 本體與 `@anthropic-ai/claude-code-*` 子套件
3. 本機驗證內嵌 binary：`node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` = 新版；`node scripts/verify-native-modules.js` exit 0
4. 核對新版變化（以 CLI 實際輸出 / 套件內容 / 官方 changelog 為準，回報區附證據）：
   - 模型清單：有無新模型 ID 或改名 → 需要時更新 `BAT_BUILTIN_MODELS`（`electron/claude-agent-manager.ts`）；新模型的計價只在找得到官方價目時才加（`src/lib/model-pricing.ts` + 測試，point release 排在 base 前）
   - `supportedEffortLevels` 是否變動（`EFFORT_LEVELS`，`src/types/index.ts`）
   - 新模型的 CLI 版本門檻是否影響 `HEALTHY_MIN`（`electron/claude-resolver.ts`）—— 只在有證據時調整
   - `DISABLE_UPDATES` / `DISABLE_AUTOUPDATER` 行為是否仍有效（`claudeUpdateGuardEnv`）
   - 與 SDK 0.2.113 的相容性：Agent session（V1 query / V2 session / forkSession / getSupportedModels）以既有單元 / 整合測試覆蓋；如有可在 isolated runtime 執行的 smoke，回報結果
5. 測試與註解中寫死 `2.1.289` 的地方（`electron/remote-tools/__tests__/parse.test.ts`、`scripts/__tests__/*`、`tests/claude-resolver.test.ts`、`scripts/verify-native-modules.js` 等）：區分「代表內嵌實裝版本」（應更新）與「任意測試字串 / 歷史門檻」（不動），回報區逐一列出處置
6. CLAUDE.md「Claude Agent SDK / CLI」節更新實裝版本、日期與本單編號；歷史敘述（T0371 / T0368）保留

## 驗收條件

- [ ] 內嵌 `claude.exe --version` = 新版；`verify-native-modules` ✅
- [ ] lock diff 只涉及 claude-code 系列（回報區附 `git diff --stat package-lock.json` 與套件清單）
- [ ] `npm run test:unit` 全綠（回報 files / passed / skipped）；`npx vite build` exit 0；`npx tsc --noEmit -p .` 不高於基線 36
- [ ] 模型 / effort / 門檻核對結果（有改或無改都要附證據）
- [ ] 回報區列出需實機驗證項目（mac / Linux 內嵌 claude 由 pre.5 CI 的 `verify-packaged-native` 與實機確認）

## Sub-session 執行指示

1. 讀本工單 + CLAUDE.md「Claude Agent SDK / CLI」+ T0371 回報區 + 上列 affects_files
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；commit 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
