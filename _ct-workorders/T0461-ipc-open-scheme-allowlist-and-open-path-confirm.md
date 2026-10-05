---
schema_version: 1
schema_kind: workorder
id: T0461
title: "IPC shell:open-external 只放行 http / https / mailto（擋 ms-msdt: / search-ms: 等協定處理器）；shell:open-path 套用 T0460 可執行檔確認"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-105
priority: P1
sizing: S
created_at: "2026-10-05T11:25:30+08:00"
started_at: null
updated_at: "2026-10-05T11:25:30+08:00"
completed_at: null
target_version: next
depends_on:
  - T0460
related:
  - "T0460（`380cecf`）回報區「遭遇問題」2：`shell:open-path` 對 renderer 任意路徑直接 `openPath`；非 http(s) / 非 file scheme（`ms-msdt:` / `search-ms:` 等）仍交給 `shell.openExternal`"
  - "T0457 `navigation-guard.ts`（`isExternalBrowserUrl`）；T0460 `open-external-guard.ts`（`handleOpenExternal` / `isExecutablePath` / 確認框）"
  - "D134 追加（塔台 11:25 依授權直接決定：收緊方向）"
affects_files:
  - electron/main.ts
  - electron/open-external-guard.ts
  - electron/__tests__/
  - src/types/electron.d.ts
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先盤點** renderer 端所有 `shell.openExternal(` / `shell.openPath(` 呼叫者與其 URL / 路徑來源（使用者點擊的 agent 輸出、Markdown、設定頁固定連結、檔案樹等），列出實際用到的 scheme，回報區附表。若發現專案內確實需要 `http(s)` / `mailto` / `file` 以外的 scheme（例：`vscode:` 開 VS Code，T0078-T0082），列入白名單並說明依據；**不得**放行 `ms-msdt:` / `search-ms:` / `ms-*:` / `javascript:` / `data:` / `vbscript:` 等。"
  - "🔴 `shell:open-external`：非 file 分支只對白名單 scheme `openExternal`，其他回 `'invalid'`（或新結果碼）+ log 只含 scheme，不開啟。`shell:open-path`：沿用 T0460 `isExecutablePath` + 確認框（取消不開）；資料夾 / 非可執行檔行為不變。判斷放 `open-external-guard.ts` 純函式並單測。"
  - "🔴 既有正常功能不得回歸：開資料夾、開一般檔、http(s) 連結、設定頁 / About 連結。`electron.d.ts` 的回傳型別可同步為結果字串（呼叫端不讀回傳值時相容）。"
  - "🔴 T0459（研究，只讀）同時執行。`main.ts` commit 前 `git diff electron/main.ts` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；不得以 `git show HEAD:… >` 覆寫取紅燈）；寫檔維持 LF；不 push。"
---

# T0461 — IPC 開啟 scheme 白名單 + open-path 確認

## 驗收條件

- [ ] 回報區附呼叫者 / scheme 盤點表與白名單依據
- [ ] 測試：`ms-msdt:` / `search-ms:` / `MS-MSDT:` / `javascript:` / `data:` / 未知 scheme 不開；http / https / mailto（+ 依盤點加入者）照舊；open-path 可執行檔跳確認、取消不開、資料夾與一般檔照舊
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0460 / T0457 回報區 + `electron/open-external-guard.ts`
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 盤點 → 先寫測試（紅）→ 實作（綠）；填回報區；完成寫 **`DONE`**
4. commit 實際改動檔 + 本工單；不 push；依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
