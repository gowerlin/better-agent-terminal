---
schema_version: 1
schema_kind: workorder
id: T0712
title: "單元測試相容 Node 26：Node 內建的全域 `localStorage` 蓋掉 jsdom 的，`copy-remote-path.test.tsx` 失敗"
type: implementation
status: PENDING
repo: better-agent-terminal
project: ""
priority: P3
sizing: S
created_at: "2026-10-30T13:57:15+0800"
started_at: ""
updated_at: "2026-10-30T13:57:15+0800"
completed_at: ""
depends_on: []
related:
  - "T0710 回報區〈驗證〉與〈遭遇問題〉：本機 Node v26.13.0 跑 `npm run test:unit`，`src/__tests__/copy-remote-path.test.tsx` 2 項失敗（`FileTree.tsx:234` 的 `localStorage.getItem` 讀到 undefined；Node 警告 `--localstorage-file was not provided`）；`NODE_OPTIONS=--no-webstorage` 後全套 343 檔 / 6115 passed"
  - "CI `.github/workflows/tests.yml` 用 `node-version: '24'`"
  - "CLAUDE.md「Frontend unit tests」節"
affects_files:
  - vitest.setup.ts
  - "vite.config.ts（只動 `test` 區塊）"
  - "package.json（只在必須改 test script 時；不得改 dependencies）"
  - "scripts/run-legacy-tests.mjs（只在 `test:legacy` 也受影響時）"
  - "受影響的測試檔（只在修正方式必須動到它們時）"
  - CLAUDE.md
  - _ct-workorders/T0712-vitest-node26-webstorage.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 目標：本機 Node 26 與 CI 的 Node 24 跑 `npm run test:unit` 都全綠，不需要使用者自己設 `NODE_OPTIONS`。先確認根因（Node 26 的全域 `localStorage` 與 jsdom 的 `window.localStorage` 哪個被測試讀到、為何 `getItem` 是 undefined），回報區寫明。"
  - "🔴 🔴 不得讓 Node 24 壞掉：Node 24 可能不認得 `--no-webstorage`，未知旗標會讓 Node 直接結束 → CI Test gate 全紅、擋發版。若用執行旗標，必須依 Node 版本或 `process.allowedNodeEnvironmentFlags` 決定是否加；較建議在 `vitest.setup.ts` 讓測試一律拿到 jsdom 的 storage（或等效作法），與 Node 版本無關。方案自行決定，回報區說明理由。"
  - "🔴 不改產品程式碼（`src/**` 非測試檔、`electron/**`）；不改 Node / npm 版本要求、不加 `engines`；不新增依賴。"
  - "🔴 驗證：本機 Node 26 跑 `npm run test:unit` 全綠（不帶 NODE_OPTIONS）；再用 Node 24 跑一次全綠（本機有 Node 24 就直接跑；沒有就用 `npx -y node@24 …` 或等效方式，做不到就寫明並至少證明設定在 Node 24 不會因未知旗標失敗）。`npm run test:legacy` 在 Node 26 跑一次，結果寫回報區（若失敗且與 webstorage 無關，只記錄不修）。`npm run typecheck` = 0。"
  - "🔴 文件：CLAUDE.md「Frontend unit tests」節加一行（Node 26 webstorage 的處理與位置）；`##` 標題不改名。"
  - "🔴 範圍：不改 `electron/ct-install-detect.ts`、`electron/handlers/ct-config.ts`、`src/types/ct-config-sources.ts`、`src/components/TowerOverview.tsx`、locales、`docs/agent-guide/ct-*.md`（T0711 同時在改）。"
  - "🔴 Git：`git commit --only <檔案>`，只 commit 本單 `affects_files`；不 push、不觸發 workflow、不建 tag。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。工單完成狀態寫 `DONE`。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。yolo：不得問使用者，判讀問題問塔台（每輪最多 3 題）。"
---

# T0712 — 單元測試相容 Node 26

## 背景

開發機 Node 已是 v26.13.0（CI 為 24）。Node 26 內建的全域 `localStorage` 讓 jsdom 測試讀到沒有 `getItem` 的物件，`copy-remote-path.test.tsx` 2 項失敗；加 `NODE_OPTIONS=--no-webstorage` 後全過。本單讓兩個 Node 版本都不需手動設定就全綠。

## 驗收

- [ ] 根因寫在回報區
- [ ] Node 26 不帶 `NODE_OPTIONS` 跑 `npm run test:unit` 全綠
- [ ] Node 24 仍全綠（或至少證明不會因未知旗標失敗）
- [ ] `npm run test:legacy`（Node 26）結果記錄在回報區
- [ ] 不改產品程式碼、不加依賴
- [ ] CLAUDE.md「Frontend unit tests」節補一行
- [ ] `npm run typecheck` = 0

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策（僅 yolo Worker 有問題時）

（沒有提問就刪除本段）

### 完成狀態

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
