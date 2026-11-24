---
schema_version: 1
schema_kind: workorder
id: T0893
title: "修正 BUG-216（在 `v0.8.x`）：大型剪貼簿圖片的 Ctrl+V —— 不先讀整張圖就判斷上限、退回路徑失敗時提示使用者、錯誤日誌記原因"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-25T00:39:51+08:00"
updated_at: "2026-11-25T00:39:51+08:00"
target_version: "0.8.0-pre.2"
depends_on: []
related:
  - "BUG-216；T0892（調查結論 §1、建議方向 A）；D318（使用者 2026-11-25：BUG-216 / BUG-217 一起修，放進 pre.2）；D307（產品改動在 `v0.8.x`）"
  - "CLAUDE.md「Electron Runtime」main 行程 clipboard（T0784）、「遠端附件上傳暫存」終端段（T0835 `imagePasteModeFor`）、「Logging」各節"
affects_files:
  - _ct-workorders/T0893-fix-large-clipboard-image-paste.md
  - electron/image-attachments.ts
  - electron/main.ts
  - electron/preload.ts
  - electron/__tests__/image-attachments.test.ts
  - src/lib/terminal-paste.ts
  - src/__tests__/terminal-paste-shortcuts.test.tsx
  - src/lib/__tests__/terminal-paste*.test.ts
  - src/locales/
  - src/types/electron.d.ts
renew_count: 0
isolation: worktree
workdir: worktree ct/T0893（塔台已預先從 `v0.8.x` 建立分支 `ct/T0893`，`bcb4bbe0`）
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0893` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `bcb4bbe0e2f300832bfa3bbfbfbebcc46f1f23a4`，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只改 `affects_files` 列的檔案（`src/locales/` 只加本單需要的字串，各語系都要補；`electron/preload.ts`、`src/types/electron.d.ts` 只在必須新增 IPC 時動）。**不改 CLAUDE.md、`package.json`、`package-lock.json`、`docs/agent-guide/`**（T0891 正在改這些，避免合併衝突）；需要補文件時把建議文字寫在回報區，由塔台合併後補。需要動其他檔 → 先問塔台。"
  - "🔴 不得改變的行為：既有 IPC channel 名稱、參數、回傳形狀不變（CLAUDE.md「Electron Runtime」main 行程 clipboard：`readClipboardPng` 的唯一實作地位、`[clipboard] read-image` 只記 MIME type 名稱）；10 MiB 上限值不變；小於上限的圖片貼上（本機貼圖鍵、SSH / Docker profile 上傳後貼路徑 `imagePasteModeFor`、Claude / Codex 面板附件）結果不變；純文字貼上不變。`readClipboardPng` 另有呼叫端 `electron/upload-client.ts`（T0835）與面板附件路徑，改動前追完所有 consumer（CLAUDE.md No Regressions Policy）。"
  - "🔴 修正目標（BUG-216 三點）：① 超過上限的圖不再讓主行程先把整張圖讀進記憶體再拒絕：先以不需完整解碼 / 編碼的方式判斷有沒有圖與大小（例如只看格式清單、或取得原生大小後早退）；做不到完全避免時，把卡住時間與峰值降到最低並在回報區附量測（例：50 MB 級 PNG 從 Ctrl+V 到拒絕的耗時與主行程 Peak WS，修正前後各一次）。② 退回路徑（`navigator.clipboard.read()` 與 `readText()`）都失敗時，給使用者看得到的提示（沿用既有 toast / 通知元件，不新增 Dialog）。③ 錯誤日誌改記 `err.name` / `err.message`（DOMException 也要看得到原因），🔴 不記剪貼簿內容、路徑、圖片資料。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 全綠（附 passed / files 數）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。新增 / 更新單元測試涵蓋三點（大圖早退不呼叫完整讀取、兩步失敗有提示、錯誤日誌含 name / message）。實機量測若要啟動 source build，只用隔離實例（`--runtime`），不得以預設實例啟動、不碰使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）與其 userData / Terminal Server / `bat-pty-holder`；量測用的大圖由腳本產生、放 repo 外暫存目錄並在收尾刪除，結束前把剪貼簿還原成空字串。`TMP` 用系統預設（T0716）。"
  - "🔴 程序清理（D308）：只結束本單啟動且可追溯到本單的程序；一次一個、不 `taskkill /T`、不以程序名稱或父 PID 大範圍結束。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "🔴 公開 repo（D176）：回報區路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0893 — 修正 BUG-216：大型剪貼簿圖片的 Ctrl+V

## 背景

T0892 在 `v0.8.0-pre.1` 日誌看到（詳見 `_ct-workorders/BUG-216-large-clipboard-image-paste.md`）：

1. 主行程 `readClipboardPng`（`electron/image-attachments.ts` 約 82 行）先讀出整張 PNG 才比 10 MiB 上限：50.9 MB / 36.5 MB 的圖讓主行程 Peak WS 到 671 MB、事件迴圈卡約 3 s，同時段 2 筆 hook 回報 `CONNECT_FAILED`。
2. 退回路徑（`src/lib/terminal-paste.ts`）`navigator.clipboard.read()` 與 `readText()` 都丟例外時，Ctrl+V 沒有效果也沒有提示。
3. 錯誤物件記成 `{}`。

既有程式，不是 `v0.8.x` 回歸；修正放在 `v0.8.x`，隨 `0.8.0-pre.2` 發佈。

## 實作

1. 確認 merge-base；worktree `npm ci`。
2. 追 `readClipboardPng` 與 `clipboard:read-image-data-url` 的所有 consumer（終端 Ctrl+V、遠端上傳、面板附件），列在回報區。
3. 照 `memory_overrides` 第 4 條修三點；不改既有 IPC 形狀。
4. 測試與量測；需要的文件補充寫在回報區（不改 docs / CLAUDE.md）。

## 驗收

- [ ] 超過上限的圖：主行程不再完整讀入（或附量測說明剩餘成本），拒絕路徑照舊
- [ ] 退回路徑兩步都失敗時有使用者看得到的提示
- [ ] 錯誤日誌含 `name` / `message`，不含內容
- [ ] 小圖、文字、遠端上傳、面板附件行為不變（附 consumer 清單與判定）
- [ ] `test:unit` 全綠、`vite build` exit 0、兩個 typecheck = 0
- [ ] 隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **session_id**：

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0893`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
