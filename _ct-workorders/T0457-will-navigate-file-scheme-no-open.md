---
schema_version: 1
schema_kind: workorder
id: T0457
title: "will-navigate / setWindowOpenHandler 對 file: 等本機 scheme 不 shell.openExternal（只 preventDefault）——避免導航到本機 .bat / .exe 時經 ShellExecute 執行"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-105
priority: P1
sizing: XS
created_at: "2026-10-05T07:28:38+08:00"
started_at: null
updated_at: "2026-10-05T07:28:38+08:00"
completed_at: null
target_version: next
depends_on:
  - T0439
related:
  - "T0439（`ea35f19`）回報區「殘留風險」/ 遭遇問題 4：`electron/main.ts` 約 :1006-1012 `will-navigate` 對任何非 app URL 一律 `shell.openExternal(url)`，含 `file://`；Windows 正式版 `appUrl` 為反斜線形式，`file:///C:/…` 永不 startsWith"
  - "D134 追加（塔台 07:28 依授權直接決定）"
affects_files:
  - electron/main.ts
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先盤點**所有會 `shell.openExternal` 的導航 / 新視窗入口（`will-navigate`、`setWindowOpenHandler`、`will-redirect`、其他 `openExternal` 呼叫端），列出各自接受的 URL 來源。"
  - "🔴 規則：只有 `http:` / `https:`（以及專案既有明確需要的 `mailto:` 等，回報區列出依據）可 `openExternal`；`file:` / `javascript:` / `data:` / 未知 scheme 一律 `preventDefault` 且不開啟，log 一行（不含完整本機路徑以外的敏感資訊）。app 自身 URL 判斷改用 URL 解析後比較（處理 Windows 反斜線 / 大小寫），不要用字串 startsWith。判斷抽純函式並單測（含 `file:///C:/x.bat`、`FILE://`、`file:\\\\server\\share`、http / https 放行、app URL 放行）。"
  - "🔴 不得改變既有 http(s) 連結開外部瀏覽器的行為。"
  - "🔴 `main.ts` commit 前 `git diff electron/main.ts` 確認只含本單 hunk（必要時 `git apply --cached` 精準 stage）。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138；不得以 `git show HEAD:… >` 覆寫取紅燈）；寫檔維持 LF；不 push。"
---

# T0457 — 導航不開本機檔

## 驗收條件

- [ ] 回報區附 `openExternal` 入口盤點
- [ ] 純函式測試（file / javascript / data / 大小寫 / UNC 拒絕；http(s) / app URL 放行）
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 36

## Sub-session 執行指示
1. 讀本工單 + T0439 回報區
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
