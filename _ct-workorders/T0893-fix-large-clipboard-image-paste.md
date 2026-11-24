---
schema_version: 1
schema_kind: workorder
id: T0893
title: "修正 BUG-216（在 `v0.8.x`）：大型剪貼簿圖片的 Ctrl+V —— 不先讀整張圖就判斷上限、退回路徑失敗時提示使用者、錯誤日誌記原因"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-25T00:39:51+08:00"
updated_at: "2026-11-25T00:41:37+08:00"
started_at: "2026-11-25T00:41:37+08:00"
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
tower_question: open
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

### 待塔台決策

> 量測（隔離：只用 worktree 的 `node_modules/electron/dist/electron.exe` 跑一支自寫的量測腳本，不是 BAT、不碰任何 BAT 實例；`--user-data-dir` 指向暫存目錄）。
> 剪貼簿放 36.1 MB 雜訊 PNG（4000×3000），每步驟各一個新程序，主行程 Peak WS / 事件迴圈最大延遲：
>
> | 流程 | 耗時 | Peak WS（前 → 後） | 事件迴圈最大延遲 |
> |---|---|---|---|
> | 現行（`read()` → `getType` → `arrayBuffer` → `nativeImage` 解碼 → `toPNG`） | 790 ms（點陣圖剪貼簿 965 ms） | 65 → 356 MiB（點陣圖 371） | 770 ms |
> | 只到 `getType` 取 `blob.size` 早退 | 124 ms（點陣圖 299 ms） | 65 → 249 MiB（點陣圖 262） | 104 ms |
> | 只看 `read()` 的格式清單（`types`） | 0.7–0.9 ms | 65 → 65 MiB | 11 ms（= 計時器解析度） |
>
> 結論：`clipboard.read()` 只列格式、不讀資料；`getType` 才把資料讀進主行程（點陣圖剪貼簿還要在這一步編成 PNG），解碼＋重新編碼是最大的成本。

#### Q-1：終端 Ctrl+V 判斷「有沒有圖」要不要改成新的 IPC（只看格式清單），連帶要改 `src/__tests__/terminal-remote-upload.test.tsx` 的 mock？
- 提問時間：2026-11-25T00:44:43+0800
- 選項：[A] 新增 local-only IPC `clipboard:has-image`（main `clipboard.read()` 的 `types` 含 `image/png` → true，不呼叫 `getType`；preload / `electron.d.ts` 各加一行），`terminal-paste.ts` 的 `clipboardHasImage` 改用它；失敗時照舊退回 `navigator.clipboard.read()`。`terminal-remote-upload.test.tsx`（不在 `affects_files`）的 `clipboard` mock 要多一個 `hasImage`（約 3 行），否則它的 SSH / Docker 貼圖案例會因判斷不到圖而失敗 / [B] 不新增 IPC：終端照舊呼叫 `clipboard:read-image-data-url`，只靠 Q-2 的早退（每次約 124–299 ms、Peak +180 MiB），不動該測試檔 / [C] 其他
- Worker 建議：[A]。終端本來只需要「有沒有圖」，現在為了這個判斷每次把整張圖讀進主行程、解碼、重新編碼、轉 base64 再丟掉；[A] 讓終端完全不讀圖（量測 < 1 ms、不增加記憶體）。行為：超過 10 MiB 的圖改由 main 直接判定「有圖」→ 送貼圖鍵 / SSH・Docker 走上傳，與修正前「main 拒絕 → `navigator.clipboard.read()` 判定有圖」的結果相同，只是不再經過拒絕與退回。既有 channel 不變。
- 影響範圍：`electron/main.ts`、`electron/image-attachments.ts`、`electron/preload.ts`、`src/types/electron.d.ts`、`src/lib/terminal-paste.ts`、測試；新增範圍：`src/__tests__/terminal-remote-upload.test.tsx`（只改 mock）
- 阻塞：是（終端判斷的實作）

#### Q-2：`clipboard:read-image-data-url`（Claude / Codex 面板貼圖附件）要不要也在解碼前以剪貼簿 PNG 的原始大小早退？
- 提問時間：2026-11-25T00:44:43+0800
- 選項：[A] 要：`getType` 後先看 `blob.size`，大於 10 MiB 直接丟同樣格式的 `Image too large (<n> > 10485760 bytes)`，不讀 `arrayBuffer`、不解碼 / 編碼（量測 790→124 ms、Peak 356→249 MiB）；上限值不變，但比的是「剪貼簿 PNG 的位元組數」而非「主行程重新編碼後的位元組數」 / [B] 不要：面板路徑維持現狀（大圖仍約 0.8–1 s 才拒絕），只修終端 / [C] 其他
- Worker 建議：[A]。差異只在 10 MiB 附近的邊界：原始 > 10 MiB 但重新編碼後 ≤ 10 MiB 的圖，修正前會貼上、修正後會被拒絕（反之亦然的情況不受影響，因為通過早退的圖照舊重新編碼後再比一次）。量測兩者差距很小：Windows 點陣圖剪貼簿由 Chromium 自己編 PNG，差 0.08%（36,142,010 vs 36,114,249）；T0892 日誌的實例差 4.6%（50,913,361 vs 48,563,050）。小於上限的圖結果完全不變。`upload-client.ts`（50 MiB 上限、`TOO_LARGE` 錯誤碼）不在本單範圍，不改。
- 影響範圍：`electron/main.ts`、`electron/image-attachments.ts`、`electron/__tests__/image-attachments.test.ts`；面板程式不改
- 阻塞：否（先做 Q-3 以外不受影響的部分）

#### Q-3：同意把 `src/components/TerminalPanel.tsx` 加進範圍嗎？
- 提問時間：2026-11-25T00:44:43+0800
- 選項：[A] 同意：② 的提示與 ③ 的 catch 日誌都在 `TerminalPanel.tsx`（Ctrl+V / Command+V / 右鍵貼上的 `.catch(err => dlog(…, err))` 與 `handlePaste` 的 catch 都記成 `{}`；提示要用它既有的 `addNoticeToast`），改法：`terminal-paste.ts` 匯出 `describePasteError(err)`（只回 `name: message`）與「讀不到剪貼簿」的錯誤類型，`TerminalPanel.tsx` 三處 catch 改記 `describePasteError(err)`，讀不到剪貼簿時 `addNoticeToast(t('terminal.clipboardReadFailed'), 'warning', 8000)`；測試放在範圍內的 `terminal-paste-shortcuts.test.tsx` / `src/lib/__tests__/terminal-paste*.test.ts` / [B] 不同意：只改 `terminal-paste.ts` 內部的日誌，② 的提示另開工單 / [C] 其他
- Worker 建議：[A]。`readTerminalClipboard` 沒有 UI，提示只能由呼叫它的 `TerminalPanel.tsx` 顯示；不改它，② 與 ③ 的 `Ctrl+V paste failed {}` 都做不到。改動限於上述三處 catch 與一個 toast，不動貼上流程本身。
- 影響範圍：新增範圍 `src/components/TerminalPanel.tsx`
- 阻塞：是（② 與 ③ 的 TerminalPanel 部分）

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
