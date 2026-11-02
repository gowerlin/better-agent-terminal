---
schema_version: 1
schema_kind: workorder
id: T0782
title: "接受 npm 12 重算 lock 帶出的 `peer` 旗標變更（約 100 項，版本不變），先確認打包閉包與 CI `npm ci` 不受影響"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T14:28:11+0800"
depends_on: []
related:
  - "T0779〈遭遇問題〉與〈後續建議〉（在 HEAD 重現：npm 12.2.1 對 HEAD 的 `package.json` ＋ lock 跑 `npm install --package-lock-only --ignore-scripts` 產生 100 項只有 `peer` 旗標翻轉、0 項版本變更）；D222"
  - "CLAUDE.md「Packaging / Release 前置檢查」節的安裝檔瘦身（T0546）與 T0719 / BUG-176（electron-builder 只沿 `dependencies` / `optionalDependencies` 收集，peer-only 不打包；`scripts/__tests__/asar-runtime-deps.test.mjs` 讀 lock 的 production 閉包）；「本機開發：npm 12 install scripts」節（npm 12 本機 / CI 版本差異）；`docs/agent-guide/npm12-install-scripts.md`"
affects_files:
  - package-lock.json
  - _ct-workorders/T0782-accept-npm12-lock-peer-flags.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 做法：在 HEAD（T0779 之後）跑 `npm install --package-lock-only --ignore-scripts`（npm 12），`git diff package-lock.json` 只允許 `\"peer\": true` 行的新增 / 刪除；任何 `version` / `resolved` / `integrity` / 新增或移除套件 → 停下回報 PARTIAL（列出 diff），不 commit。記錄筆數與受影響套件清單（分成「加上 peer」「去掉 peer」兩組）。"
  - "🔴 先查影響再 commit：① 加上 `peer: true` 的套件裡，有沒有安裝檔白名單（`build.files`）或 `asar-runtime-deps.test.mjs` 的執行期依賴（特別是 `@anthropic-ai/sdk`、`@modelcontextprotocol/sdk`、`zod` 等 T0719 相關套件）；② 讀 `asar-runtime-deps.test.mjs` 怎麼從 lock 算 production 閉包，判斷 `peer` 旗標會不會改變結果；③ `npx vite build` 後跑 `npx vitest run scripts/__tests__/asar-runtime-deps.test.mjs`（新 lock）全綠；④ `npm run build:dir` ＋ `node scripts/verify-packaged-native.js --platform win --out release --arch x64` 綠（`runtime-require` 檢查）；⑤ CI 用 `actions/setup-node` node 24 附的 npm（不是 npm 12）跑 `npm ci`：在 scratch 副本用該版 npm（例 `npx npm@<CI 版本> ci --ignore-scripts --dry-run`，版本以 node 24 附帶的 npm 為準並寫明怎麼查到）確認接受新 lock，且 npm 11 不會因此重寫或報錯。任一項失敗或結果改變 → 停下回報 PARTIAL，不 commit。"
  - "🔴 驗證：`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit` 全綠（`electron/__tests__/worktree-status-after-close.test.ts` 若在全套負載下逾時，單檔重跑並記錄；這是已知觀察，不算本單失敗）。不跑 e2e（lock 中繼資料變更、不改版本）。"
  - "🔴 不改：`package.json`、任何套件版本、`allowScripts`。不跑 `npm install` 的完整安裝以外的 dedupe / audit fix / update。"
  - "🔴 文件：若查證結果值得留給下一個人（例：「npm 12 會把 X 類套件標 peer，對打包沒有影響，原因是…」），在回報區寫清楚，並建議塔台是否補一行到 `docs/agent-guide/npm12-install-scripts.md`；本單不直接改 docs。"
  - "🔴 不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有 T0781 並行（只研究、不改 lock），不得碰它的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0782 — 接受 npm 12 的 lock `peer` 旗標變更

## 元資料

- **工單編號**：T0782
- **類型**：implementation（lock 中繼資料）
- **優先級**：P2
- **建立時間**：2026-11-02T14:28:11+0800
- **預估規模**：S

## 背景

T0779 升 Electron 時發現：npm 12 重算 `package-lock.json` 會另外翻轉約 100 項套件的 `peer` 旗標，版本、下載位置、雜湊都不變；在 HEAD 不改任何東西也會重現，與 electron 無關。T0779 依工單規定沒有寫入，但之後每張改相依的工單都會碰到。塔台建議先查證對打包與 CI 沒有影響，再一次接受（D222）。

## 範圍

1. 重算 lock，確認只有 `peer` 旗標變更。
2. 查證打包閉包（白名單、`asar-runtime-deps.test.mjs`、`verify-packaged-native`）與 CI `npm ci` 不受影響。
3. 驗證後 commit lock。

## 不做

- 不改任何套件版本或 `package.json`；不改 docs（只在回報區建議）。

## 驗收

- [ ] diff 只有 `peer` 旗標（筆數、兩組清單）
- [ ] 打包閉包影響分析與 `asar-runtime-deps.test.mjs` 綠
- [ ] `build:dir` ＋ `verify-packaged-native` 綠
- [ ] CI 版本 npm 的 `npm ci` 接受新 lock（怎麼查到 CI 的 npm 版本）
- [ ] typecheck 0 / 0、`test:unit` 全綠

---

## 回報區

> 以下由 sub-session 填寫

### 完成狀態

### 產出摘要

### 驗證

### 遭遇問題

### 互動紀錄

### 後續建議

### commit 狀態

### 回報時間
