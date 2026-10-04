---
schema_version: 1
schema_kind: workorder
id: T0435
title: "BUG-107：preload 暴露 webUtils.getPathForFile（shell.getPathForFile），修復 Claude 面板 / Sidebar / Codex 面板拖放取路徑；檔名改以 /[\\\\/]/ 切"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-107
priority: P1
sizing: S
created_at: "2026-10-05T05:51:45+08:00"
started_at: "2026-10-05T05:54:38+08:00"
updated_at: "2026-10-05T05:59:28+08:00"
completed_at: "2026-10-05T05:59:28+08:00"
target_version: next
depends_on: []
related:
  - "BUG-107；T0421 研究（`ffb06f8`）回報區「調查結論 §0」與拆單第 1 列"
  - "BUG-061（tsc 基線 40 中 `CodexAgentPanel.tsx` TS2339 這筆會消失 → 39）"
  - "D134 追加（T0421 拆單，使用者 05:51 裁決）"
affects_files:
  - electron/preload.ts
  - src/types/electron.d.ts
  - src/components/ClaudeAgentPanel.tsx
  - src/components/Sidebar.tsx
  - src/components/CodexAgentPanel.tsx
  - src/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 API 名稱沿用 Codex 既有呼叫 `window.electronAPI.shell.getPathForFile(file)`，preload 以 `webUtils.getPathForFile` 實作（`contextBridge` 內呼叫，不暴露 `webUtils` 物件本身）。"
  - "🔴 **本單不處理遠端路徑轉換**（T0437）。修好後遠端視窗附件會開始送出 client 路徑——這是已知且會在同一版由 T0437 擋住，不要在本單另做遠端判斷。"
  - "🔴 tsc 基線預期 40 → 39（`CodexAgentPanel.tsx` TS2339 消失）；回報區附前後數字。BUG-061 檔不改（塔台更新）。"
  - "🔴 同工作樹有其他 Worker 平行。共用檔（`preload.ts` / `electron.d.ts`）commit 前 `git diff <file>` 確認只含本單 hunk。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0435 — 拖放取路徑（BUG-107）

## 範圍

1. preload `shell.getPathForFile(file)` → `webUtils.getPathForFile(file)`；型別同步
2. `ClaudeAgentPanel.tsx`、`Sidebar.tsx` 的 `file.path` 改用此 API（grep 全庫 `\.path` 於 DragEvent / File 上下文，勿遺漏）
3. `addFileByPath` 等檔名切割改 `/[\\/]/`
4. 測試：RTL 模擬 drop（mock `getPathForFile`）→ 附件 / 工作區加入使用回傳路徑；Windows 路徑檔名正確

## 驗收條件

- [x] `npm run test:unit` 全綠；`npx tsc --noEmit` = 39（或說明差異）
- [x] 回報區附使用者實機步驟（本機：拖檔到 Claude 面板 / Sidebar / Codex 面板）
- [x] BUG-107 改 `FIXED`

## Sub-session 執行指示
1. 讀本工單 + BUG-107 + T0421 回報區 §0
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + BUG-107；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**

### Landing Zone Check

- 結果：**PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`affects_files` 前 5 筆皆存在 → PASS（informational）
- C-2：工單無 `branch` 欄位；HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 產出摘要

| 檔案 | 改動 |
|------|------|
| `electron/preload.ts` | import `webUtils`；`shell.getPathForFile: (file) => webUtils.getPathForFile(file)`（只暴露函式，不暴露 `webUtils` 物件） |
| `src/types/electron.d.ts` | `shell.getPathForFile: (file: File) => string` |
| `src/components/ClaudeAgentPanel.tsx` | `handleDrop` 改用 `window.electronAPI.shell.getPathForFile(file)`；`addFileByPath` 檔名改 `split(/[\\/]/)` |
| `src/components/CodexAgentPanel.tsx` | `addFileByPath` 檔名改 `split(/[\\/]/)`（拖放呼叫原本即用 `shell.getPathForFile`，現在 preload 有實作） |
| `src/components/Sidebar.tsx` | 外部資料夾拖放改用 `shell.getPathForFile`（Sidebar 原本已用 `/[/\\]/` 切檔名） |
| `src/__tests__/drag-drop-get-path-for-file.test.tsx`（新） | RTL：Claude / Codex 面板 drop → 附件 chip 的 `title` 為 mock 回傳的 Windows 路徑、檔名為 `report.txt`；圖片 drop 以回傳路徑呼叫 `image.readAsDataUrl`；空字串路徑略過。Sidebar drop → `workspaceStore.addWorkspace('my-project', 'D:\\code\\my-project')` + `save()`；空路徑不加入 |
| `electron/__tests__/preload-get-path-for-file.test.ts`（新） | mock `electron` 載入 preload，驗證 `shell.getPathForFile` 委派 `webUtils.getPathForFile`，且 `electronAPI.webUtils` 不存在 |

全庫 grep（`dataTransfer` / `getPathForFile` / `webUtils` / `File` 上下文的 `.path`）：DOM `File.path` 只有 Claude 面板與 Sidebar 兩處，已全數改掉；`ControlTowerPanel.tsx` 的 `file.path` 是 `fs.readdir` 的 `FileEntry`，非 DOM File，不動。`ThumbnailBar.tsx` 的 drag 為內部排序，不涉檔案。

### 驗證

| 閘 | 結果 | 證據 |
|----|------|------|
| 新測試 | PASS | `npx vitest run src/__tests__/drag-drop-get-path-for-file.test.tsx electron/__tests__/preload-get-path-for-file.test.ts` → 7 passed |
| 反向驗證（mutation） | PASS | 暫時把 Claude 面板檔名切割改回 `split('/')`、Sidebar 改回 `(file as any).path` → 對應 2 項測試失敗；已還原（diff 確認） |
| `npm run test:unit` | PASS | `Test Files 124 passed (124)`、`Tests 1961 passed \| 1 skipped (1962)` |
| `npx tsc --noEmit` | **39**（前 40） | 剩餘：`CodexAgentPanel.tsx` 32、`terminal-keyboard-event.test.ts` 5、`integration.transitions.test.ts` 1、`agent-profiles.ts` 1；`getPathForFile` 相關 0 筆 |
| `npx vite build` / `npm run test:e2e` | 未跑 | 依工單 memory_overrides（L141）不跑 |
| 實機拖放 | 未做 | Worker 無法操作 GUI 拖放；見下方使用者實機步驟 |

### 使用者實機步驟（本機視窗）

1. 啟動含本修正的 BAT（`npm run dev` 或下一版安裝檔）
2. **Claude 面板**：從檔案總管拖一個 `.txt`（例如 `C:\Users\<你>\Documents\a.txt`）到 Claude 面板 → 輸入區上方出現附件 chip，顯示 `a.txt`（不是整串路徑），滑鼠停留 title 為完整 `C:\…\a.txt`；再拖一張 `.png` → 出現圖片縮圖
3. 送出訊息 → 訊息帶 `@C:\…\a.txt` 前綴，agent 可讀檔
4. **Codex 面板**：同步驟 2（修正前會在 DevTools console 拋 `TypeError: window.electronAPI.shell.getPathForFile is not a function`，修正後正常）
5. **Sidebar**：從檔案總管拖一個資料夾到左側工作區清單 → 新增以資料夾名稱命名的工作區
6. ⚠️ 遠端視窗拖放附件會送出 client 路徑——已知，由 T0437 同版處理，本單不驗

### 遭遇問題

1. **tsc TS6305**：preload 委派測試原寫在 `src/__tests__/`，從 `src` import `electron/preload.ts` 觸發 `TS6305`（preload 屬 `tsconfig.node.json` 參照專案）。改放 `electron/__tests__/`（vitest `include` 已收錄、不在 root `tsc --noEmit` 範圍）。**偏離**：`affects_files` 只列 `src/__tests__/`，多一個 `electron/__tests__/preload-get-path-for-file.test.ts`，純測試檔。
2. **平行 Worker 干擾（已自行消失）**：第一次跑 `npm run test:unit` 有 3 項失敗、`tsc` 42 筆，全在 T0425 正在改的 SSH 檔（`ssh-verify-remote.test.ts`、未追蹤的 `remote-client-ssh-tunnel.test.ts` / `ssh-tunnel-only.test.ts`）；數分鐘後重跑全綠、tsc 39。本單未碰這些檔。
3. 測試用的 `window.electronAPI` 採寬鬆 Proxy mock；Claude 面板 statusline 會無防護地存 `getStatuslineExtras()` 結果，mock 回 `undefined` 時 render 崩潰，故測試中 override 回 `{}`。實際 IPC 恆回物件，非產品問題，未改產品碼。

### Commit

- `git commit --only`：上表 5 個產品檔 + 2 個測試檔 + 本工單 + BUG-107；不 push。hash 見塔台 `git log`（本回報寫於 commit 前）。

### 回報時間

2026-10-05T05:58:41+08:00
