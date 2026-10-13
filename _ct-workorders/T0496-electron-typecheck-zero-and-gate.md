---
schema_version: 1
schema_kind: workorder
id: T0496
title: "electron 端 typecheck 清零（typecheck:electron 基線 77 → 0）+ 加入 CI 硬 gate"
type: implementation
status: TODO
repo: better-agent-terminal
project: D139
priority: P2
sizing: M
created_at: "2026-10-13T23:24:58+08:00"
started_at: null
updated_at: "2026-10-13T23:24:58+08:00"
completed_at: null
target_version: v0.6.0-pre.5
depends_on:
  - "T0484"
  - "T0485"
  - "T0491"
  - "T0492"
  - "T0495"
related:
  - "T0486 回報區 B 節（`typecheck:electron` 定義、77 筆基線清單、為何不把 target 寫進 tsconfig.node.json）與「CI gate 建議」2(a)"
  - "L146"
affects_files:
  - "electron/"
  - "vite.config.ts"
  - ".github/workflows/pre-release.yml"
  - ".github/workflows/release.yml"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 修型別不改行為：不用 `any` / `@ts-ignore` 掩蓋；必要的 `@ts-expect-error` 附理由並列出；涉及 IPC / handler 簽章時 trace 所有 consumer（No Regressions）"
  - "🔴 不把 `target` 寫進 `tsconfig.node.json`（T0486：會經 root references 影響 vite / esbuild 的 class field 語意）"
  - "🔴 開工時重新量測基線（T0484 / T0485 / T0491 / T0492 已改動 electron 檔，數字可能不是 77）；回報區附開工與完工清單"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build；需要啟動時用 `--runtime=<高號碼>` 或 e2e isolated runtime"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0496 — electron typecheck 清零 + gate

## 實作

1. 重新量測 `npm run typecheck:electron`，逐檔修正到 0（最大宗：`electron/main.ts`、`electron/claude-agent-manager.ts`）
2. 測試檔的型別錯誤以正確型別 / fixture 修正
3. 在 T0495 的 `typecheck` job 加第三步 `npm run typecheck:electron`（依賴鏈不用改；先以 `npm ci --ignore-scripts` 驗證 `tsconfig.node.json` 的 include 不需要 postinstall 產物），失敗阻擋 release
   - 順手：`release.yml:161,165` step 名稱「Rebuild @lydell/node-pty for Electron」改為與 pre-release.yml 一致的「Rebuild native modules for Electron」（實際為全量 `@electron/rebuild`，T0492 範圍外發現 3）
   - 順手：T0487 後所有 action 皆原生 node24，評估移除 `pre-release.yml` 頂層 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`（`release.yml` 本來就沒有）；移除前確認 actionlint / 版本表無仍為 node20 的 action
4. 驗證：`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠；`npx vite build` exit 0；e2e `smoke` / `detached-workspace` / `plan039-multi-remote` 回歸（isolated runtime）；actionlint 0 筆

## 驗收條件

- [ ] 兩個 typecheck = 0（附輸出）；開工 / 完工錯誤清單
- [ ] 每個非顯然修正的行為不變說明（特別是 IPC handler 參數、remote-server、ssh-start-server）
- [ ] unit / vite / e2e 回歸；workflow gate 與 actionlint
- [ ] CLAUDE.md 建議文字（Type check 節：electron 基線改為 0、gate 說明）

## Sub-session 執行指示

1. 讀本工單 + D139 + T0486 回報區 + 相關 electron 檔
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

（Worker 填寫）
