---
schema_version: 1
schema_kind: workorder
id: T0722
title: "「Claude Agent V1」改名「Claude Agent」（V2 已下架、不再分版本）：顯示名稱、預設標題判斷與舊存檔遷移"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T09:49:34+0800"
started_at: ""
updated_at: "2026-11-01T09:49:34+0800"
completed_at: ""
depends_on: []
related:
  - "D194（使用者：「Claude Agent V1 拿掉 V1 因為已無分版本」）；D123 Phase 2 / T0718（V2 下架、舊 V2 分頁自動遷移成 `claude-code`，預設標題改成 `Claude Agent V1`，唯一實作 `src/lib/retired-agent-presets.ts`）"
  - "T0718 回報區「後續候選」：改名牽涉預設標題判斷（`isDefaultTerminalTitle`）"
  - "CLAUDE.md「塔台分頁標題（T0562，D147）」（標題唯一實作 `src/lib/tower-terminal-title.ts`、`isDefaultTerminalTitle`、BAT 命名一律 `setAutoTitle`）、「Claude Agent SDK / CLI」（retired preset 遷移）"
  - "T0720 / T0721（同時進行的研究單，只讀，不跑 build）"
affects_files:
  - src/types/agent-presets.ts
  - electron/agent-runtime/agent-registry.ts
  - src/components/ThumbnailBar.tsx
  - src/lib/tower-terminal-title.ts
  - src/lib/retired-agent-presets.ts
  - "src/locales/（若有含 `V1` 的顯示字串）"
  - "src/**/__tests__/ 與 electron/__tests__/ 中斷言 `Claude Agent V1` / `V2` 的測試（目前約 7 檔）"
  - CLAUDE.md
  - docs/agent-guide/tower-tab-title.md
  - docs/agent-guide/claude-agent-sdk-cli.md
  - site/features.md
  - _ct-workorders/T0722-rename-claude-agent-v1.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先全面盤點再改：`grep` 整個 repo（排除 `_ct-workorders/`、`node_modules/`、`dist*/`、`release/`、`CHANGELOG.md`、`release-note.md`）找 `Claude Agent V1`、`Claude Agent V2`、`Agent V1`、i18n key 與 e2e；塔台初步計數 16 檔 38 處（見 `affects_files`），以你的盤點為準。不在 `affects_files` 但必須改的檔案，先用 BAT 通道問塔台。"
  - "🔴 行為規格：① 新分頁、「+」選單、縮圖、預設標題一律顯示「Claude Agent」；② 預設標題判斷（`isDefaultTerminalTitle` 等）把 `Claude Agent`、舊的 `Claude Agent V1`、`Claude Agent V2` 都當成預設標題（之後 BAT 仍可自動改名，例如塔台標題）；③ 舊存檔遷移：分頁的 `title` / `autoTitle` 等於舊預設標題（`Claude Agent V1` / `Claude Agent V2`）時改成 `Claude Agent`，使用者自訂的標題、`sdkSessionId`、`model` 不動；遷移邏輯集中在 `src/lib/retired-agent-presets.ts`（或同層唯一實作），不要在 consumer 內聯；④ preset id（`claude-code`）、helper `--agent` 別名、IPC / remote 協定一律不變；舊 client ↔ 新 server 相容性寫進回報。"
  - "🔴 驗收：`npm run test:unit` 全過（新增：遷移 V1 / V2 預設標題 → `Claude Agent`、自訂標題不動、`isDefaultTerminalTitle` 認得三種舊新值）；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功。CLAUDE.md 只改必要的一兩句（遵守檔頭「CLAUDE.md 撰寫規則」），細節寫 docs。"
  - "🔴 不發版、不改版號、不改 `CHANGELOG.md` / `release-note.md` / README（發版時塔台處理）。"
  - "🔴 同時有 T0720 / T0721 研究 Worker 在本 repo 只讀；它們不跑 build，你可以照常跑 build / 測試。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 commit 不寫真名、家目錄路徑或權杖。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0722 — 「Claude Agent V1」改名「Claude Agent」

## 元資料

- **工單編號**：T0722
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T09:49:34+0800
- **預估規模**：S

## 目標

T0718（D123 Phase 2）下架 Claude Agent V2 後，SDK 面板只剩一種，「V1」已沒有對照意義。使用者決定（D194）拿掉「V1」，顯示名稱改為「Claude Agent」。

## 範圍

1. 顯示名稱：preset 名稱（renderer `src/types/agent-presets.ts`、main `electron/agent-runtime/agent-registry.ts`）、縮圖列 / 「+」選單（`ThumbnailBar.tsx`）、i18n。
2. 預設標題判斷：`src/lib/tower-terminal-title.ts`（`isDefaultTerminalTitle`）認得新名稱與兩個舊名稱。
3. 舊存檔遷移：`src/lib/retired-agent-presets.ts` 把舊預設標題遷移成新名稱（T0718 會把 V2 預設標題改成 `Claude Agent V1`，本單改成直接遷移到 `Claude Agent`）。
4. 測試、CLAUDE.md（必要句）、`docs/agent-guide/`、`site/features.md`。

## 不做

- 不改 preset id、helper 參數、IPC / remote 協定。
- 不處理 T0721 的三項候選。
- 不發版。

## 驗收

- [ ] 盤點清單（檔案 / 處數）與實際改動對照
- [ ] 行為規格 ①–④ 各有測試或證據
- [ ] `npm run test:unit` 全過；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功
- [ ] 舊 client ↔ 新 server 相容性說明

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 改動摘要

### 驗證結果

### 遭遇問題

### 回報時間
