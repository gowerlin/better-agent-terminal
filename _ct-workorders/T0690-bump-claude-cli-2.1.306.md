---
schema_version: 1
schema_kind: workorder
id: T0690
title: "內嵌 claude CLI 追版：@anthropic-ai/claude-code ^2.1.300 → ^2.1.306（含平台子套件），核對模型清單 / effort / 門檻 / update guard / BAT 整合點，SDK 維持 0.2 線"
type: implementation
status: TODO
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-10-21T22:17:40+0800"
target_version: "0.7.1-pre.5"
depends_on: []
related:
  - "CLAUDE.md「Claude Agent SDK / CLI」：內嵌 CLI 落後即功能故障，每次預覽版發布前追版；SDK 刻意留在 0.2 線（D123）"
  - "T0541（前次追版 2.1.296 → 2.1.300：步驟、lock 移植做法、驗證項目與證據格式都照它做）；T0483（更早一次）"
  - "D179（`v0.7.1-pre.5` 發版前小批）：塔台 2026-10-21 22:15 聯合驗證時查到 `npm view @anthropic-ai/claude-code version` = 2.1.306（2.1.301–2.1.306 發佈於 2026-10-15～2026-10-21T02:28Z），實裝 2.1.300，依 CLAUDE.md 追版規則併入本批"
affects_files:
  - package.json
  - package-lock.json
  - CLAUDE.md
  - docs/agent-guide/claude-agent-sdk-cli.md
  - electron/claude-agent-manager.ts
  - electron/claude-resolver.ts
  - src/lib/model-pricing.ts
  - src/lib/__tests__/model-pricing.test.ts
  - src/types/index.ts
  - src/lib/usage-limit.ts
  - scripts/verify-native-modules.js
  - scripts/__tests__/
  - _ct-workorders/T0690-bump-claude-cli-2.1.306.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "✅ 本單授權修改 `package.json` 的 `@anthropic-ai/claude-code` 版本與對應 `package-lock.json`（含 `@anthropic-ai/claude-code-*` 平台子套件）；其他相依**不得**連帶升版：lock diff 只能涉及 claude-code 系列與 root `dependencies` 那一行，npm 產生的 `peer` 等旗標雜訊比照 T0541 以移植方式去掉，回報區附 `git diff --stat package-lock.json` 與逐套件比對。"
  - "🔴 `@anthropic-ai/claude-agent-sdk` 不動（D123：留 0.2 線）；`package.json` 的 `version` 欄位不動（塔台發版時另行處理）。"
  - "🔴 開工時再查一次 `npm view @anthropic-ai/claude-code dist-tags` 與 `time`；latest 若已高於 2.1.306，取當下 latest 並在回報區說明。"
  - "🔴 核對新版變化（官方 changelog 2.1.301 起各節、CLI 實際輸出、binary 字串；附證據）：① 模型清單 / `supportedEffortLevels` / 計價（價格只能取自官方價目頁並附出處，查不到就不改）、服務端門檻與 `HEALTHY_MIN`；② update guard：`DISABLE_UPDATES` / `DISABLE_AUTOUPDATER` 仍有效；③ BAT 整合點：`--mcp-config=` / `--settings=` 的 hooks（`BAT_CLAUDE_HOOKS` 用到的事件）/ `--name` / `disableAllHooks` / `autoContinueAtUsageLimit`，以及 `src/lib/usage-limit.ts` 的句型仍出現在新 binary（T0566：句型取自 CLI 字串）。任何一項有變動而會影響 BAT 時，先用 BAT 通道問塔台，不要自行改產品行為。"
  - "🔴 測試與註解中寫死 `2.1.300` 的地方：區分「代表內嵌實裝版本」（更新）與「任意測試字串 / 歷史門檻」（不動），回報區逐一列出處置。CLAUDE.md「Claude Agent SDK / CLI」節與 `docs/agent-guide/claude-agent-sdk-cli.md` 更新實裝版本與本單編號，歷史敘述保留。"
  - "🔴 驗證：內嵌 `node_modules/@anthropic-ai/claude-code/bin/claude.exe --version` = 新版；`node scripts/verify-native-modules.js` exit 0；`npm run test:unit` 全綠；`npm run test:legacy` 全綠（已是發版關卡）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。不得以預設實例（無 `--runtime`）啟動 source build，需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime；不碰使用者正在用的 BAT。"
  - "🔴 Git：`git commit --only <檔案>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122），本單原則上不需要 gh。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」：回報裡的路徑用 repo 相對路徑或 `<使用者資料夾>`，scratchpad 路徑也一樣。yolo：不得問使用者，判讀問題問塔台。"
---

# T0690 — 內嵌 claude CLI 追版 2.1.306

## 背景

- 內嵌 `@anthropic-ai/claude-code` 實裝 `2.1.300`（T0541）；塔台 2026-10-21 22:15 查 `npm view @anthropic-ai/claude-code version` = `2.1.306`（`time`：2.1.301 = 2026-10-15T14:34Z … 2.1.306 = 2026-10-21T02:28Z）。
- CLAUDE.md 規定每次預覽版發布前追版（服務端以 CLI 版本擋新模型）。本單完成、塔台聯合驗證後即發 `v0.7.1-pre.5`（D179）。

## 實作

照 T0541「實作」1–6 與其回報區的做法，版本號換成本單：

1. 開工時再查 latest（見 `memory_overrides` 第 3 條）。
2. `package.json` 改 `^<新版>`；更新 lock；lock diff 只含 claude-code 系列。
3. 內嵌 binary `--version`、`verify-native-modules`。
4. 核對新版變化（見 `memory_overrides` 第 4 條，含 BAT 整合點與 `usage-limit.ts` 句型）。
5. 寫死 `2.1.300` 的測試 / 註解逐一處置。
6. CLAUDE.md 與 docs 更新實裝版本。

## 驗收

- [ ] 內嵌 `claude.exe --version` = 新版；`verify-native-modules` ✅
- [ ] lock diff 只涉及 claude-code 系列（附 diff 摘要與逐套件比對）
- [ ] `npm run test:unit`、`npm run test:legacy` 全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 模型 / effort / 計價 / 門檻 / update guard / BAT 整合點 / `usage-limit.ts` 句型的核對結果（有改或無改都附證據）
- [ ] 回報區列出需實機驗證的項目（mac / Linux 內嵌 claude 由 pre.5 CI 的 `verify-packaged-native` 確認）

---

## 回報區

### 完成狀態

### 修改內容

### 驗證結果

### Commit

### 遭遇問題

### 互動紀錄

### 回報時間
