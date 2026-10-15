---
schema_version: 1
schema_kind: workorder
id: T0541
title: "內嵌 claude CLI 追版：@anthropic-ai/claude-code ^2.1.296 → ^2.1.300（含平台子套件），核對模型清單 / effort / 服務端版本門檻，SDK 維持 0.2 線"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-10-15T17:41:45+0800"
updated_at: "2026-10-15T17:41:45+0800"
target_version: "0.6.1-pre.3"
depends_on: []
related:
  - "CLAUDE.md「Claude Agent SDK / CLI」：內嵌 CLI 落後即功能故障，每次預覽版發布前追版；SDK 刻意留在 0.2 線（D123）"
  - "T0483（前次追版 2.1.289 → 2.1.296 的做法與驗證項目，照同一套流程）"
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
  - _ct-workorders/T0541-bump-claude-cli-2.1.300.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權修改 `package.json` 的 `@anthropic-ai/claude-code` 版本與對應 `package-lock.json` 變動（含 `@anthropic-ai/claude-code-*` 平台子套件）；其他相依**不得**連帶升版（lock diff 只能涉及 claude-code 系列，回報區附 diff 摘要）"
  - "🔴 `@anthropic-ai/claude-agent-sdk` 不動（D123：留 0.2 線）"
  - "🔴 不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。`src/styles/settings.css` 的 M 狀態不是你的變更，不要 commit 它；commit 用 `--only`。"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime。不碰使用者正在用的 BAT（port 9876）。"
  - "🔴 價格只能取自官方來源並在回報區附出處；查不到就不改計價表"
  - "🔴 `package.json` 的 `version` 欄位不要動（塔台發版時另行處理）。"
---

# T0541 — 內嵌 claude CLI 追版 2.1.300

## 背景

- 內嵌 `@anthropic-ai/claude-code` 實裝 `2.1.296`（T0483）；`npm view @anthropic-ai/claude-code version` = `2.1.300`（2026-10-15 17:41 塔台查詢；npm 發佈時間 2.1.299 = 2026-10-14T00:23Z、2.1.300 = 2026-10-14T14:27Z）
- 使用者指示「先追版內嵌 Claude CLI，然後發 pre.3」：本單完成後塔台即發 `0.6.1-pre.3`

## 實作

照 T0483「實作」1–6 步驟，版本號換成本單：

1. 開工時再查一次 `npm view @anthropic-ai/claude-code version`；若已高於 2.1.300，取當下最新並在回報區說明
2. `package.json` 改為 `^<新版>`；更新 lock；確認 lock diff 只含 claude-code 本體與 `@anthropic-ai/claude-code-*` 子套件
3. 內嵌 binary：`node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` = 新版；`node scripts/verify-native-modules.js` exit 0
4. 核對新版變化（以 CLI 實際輸出 / 套件內容 / 官方 changelog 為準，附證據）：模型清單（`BAT_BUILTIN_MODELS`、`MODEL_LIMITS`、計價表）、`supportedEffortLevels`（`EFFORT_LEVELS`）、服務端門檻與 `HEALTHY_MIN`、`DISABLE_UPDATES` / `DISABLE_AUTOUPDATER` 是否仍有效、SDK 0.2.113 相容性（既有測試）
5. 測試 / 註解中寫死 `2.1.296` 的地方：區分「代表內嵌實裝版本」（更新）與「任意測試字串 / 歷史門檻」（不動），逐一列出處置
6. CLAUDE.md「Claude Agent SDK / CLI」與「本機開發：npm 12 install scripts」中的實裝版本、日期、本單編號；歷史敘述保留

## 驗收條件

- [ ] 內嵌 `claude.exe --version` = 新版；`verify-native-modules` ✅
- [ ] lock diff 只涉及 claude-code 系列（附 `git diff --stat package-lock.json` 與套件清單）
- [ ] `npm run test:unit` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0
- [ ] 模型 / effort / 門檻核對結果（有改或無改都要附證據）
- [ ] 回報區列出需實機驗證項目（mac / Linux 內嵌 claude 由 pre.3 CI 的 `verify-packaged-native` 與實機確認）

## 回報區

（Worker 填寫）
