---
schema_version: 1
schema_kind: workorder
id: T0436
title: "BUG-108：Claude 面板圖片附件改由 client 端讀取（拖放 FileReader、clipboard:saveImage 回 data URL、對話框選圖本機讀），不再走 proxied image:read-as-data-url"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-108
priority: P1
sizing: M
created_at: "2026-10-05T05:51:45+08:00"
started_at: "2026-10-05T06:00:47+08:00"
updated_at: "2026-10-05T06:56:06+08:00"
completed_at: "2026-10-05T06:56:06+08:00"
target_version: next
depends_on:
  - T0435
related:
  - "BUG-108；T0421 研究回報區盤點表 #3 / #4 與拆單第 2 列"
  - "D134 追加（T0421 拆單）"
affects_files:
  - src/components/ClaudeAgentPanel.tsx
  - src/components/CodexAgentPanel.tsx
  - electron/main.ts
  - electron/preload.ts
  - src/types/electron.d.ts
  - electron/remote/protocol.ts
  - electron/remote/headless-channel-status.ts
  - electron/remote/path-aware-channels.ts
  - src/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **第一步先重現**本機貼圖附件是否失敗（`os.tmpdir()` 不在工作區白名單 → `Path access denied`）：以單元測試或 `path-guard` 直接驗證，回報區附結論。若本機其實沒壞，仍做遠端部分（遠端讀錯檔案系統是確定的）。"
  - "🔴 **安全**：新增或修改的 channel 不可變成任意本機讀檔口。偏好 `clipboard:saveImage`（或新 channel）直接回 `clipboard.readImage().toDataURL()`、拖放在 renderer 以 `FileReader` 讀；對話框選圖由 main 在對話框回傳後直接讀並回 data URL（路徑來自 main 自己的對話框，不接受 renderer 傳入任意路徑）。新 channel 必須列入 ALWAYS_LOCAL 並通過 T0416 / T0422 全分類守門。"
  - "🔴 檔案樹 / `PathLinker` 的圖片**預覽**維持 proxied `image:read-as-data-url`（讀遠端工作區檔案是正確行為），不要改。"
  - "🔴 依賴 T0435（同改 `ClaudeAgentPanel.tsx` / `preload.ts`）。T0431 可能平行改 `main.ts` / `protocol.ts` / `headless-channel-status.ts` / `path-aware-channels.ts`：開工前 `git status` 看這些檔是否 dirty；commit 前 `git diff <file>` 確認只含本單 hunk，混有他人改動不 commit 該檔，等對方 commit 或回報。"
  - "🔴 **只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。**禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push。"
---

# T0436 — 圖片附件 client 端讀取（BUG-108）

## 範圍

1. 重現（memory_overrides 第 1 條）
2. 三個圖片附件來源改 client 端取得 data URL：拖放、剪貼簿貼上、對話框選圖（Claude 面板；Codex 面板若共用同機制一併）
3. 附件路徑不再呼叫 `image:read-as-data-url`
4. 測試：三來源各自產生 data URL 附件；新 channel 為 ALWAYS_LOCAL；不接受任意路徑

## 驗收條件

- [ ] 回報區附重現結論
- [ ] `npm run test:unit` 全綠；`npx tsc --noEmit` ≤ 39（T0435 後基線）
- [ ] 回報區附實機步驟（本機與 WSL 遠端視窗：拖放 / 貼上 / 對話框各附一張圖並送出）
- [ ] BUG-108 改 `FIXED`

## Sub-session 執行指示
1. 讀本工單 + BUG-108 + T0421 回報區（盤點表 #3 / #4）+ T0435 回報區
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 重現 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**
5. `git commit --only` 實際改動檔 + 本工單 + BUG-108；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

**DONE**（程式碼 + 單元測試層；實機步驟待使用者，見下）

### Landing Zone Check

- 結果：**PASS**
- C-0：frontmatter `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal` → PASS
- C-1：工單位於 `REPO_ROOT/_ct-workorders/` → PASS
- C-3：`affects_files` 前 5 筆皆存在 → PASS（informational）
- C-2：工單無 `branch` 欄位；HEAD = `main`
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）
- 派發模式：`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 重現結論（memory_overrides 第 1 條）

**本機確實壞**（單元層級重現，未實機 GUI）。`electron/__tests__/image-attachments.test.ts` 的 `repro (BUG-108)` 區塊：以 Electron 的 `createPathAllowlist()`（白名單 = 工作區根）+ 共用 `registerFsHandlers` 掛上 `image:read-as-data-url`：

- 在 `os.tmpdir()` 寫一個 `bat-clipboard-t0436-<pid>.png`（與 `clipboard:saveImage` 同位置、同命名）→ `Path access denied`（檔案確實存在，是 guard 擋下而非 ENOENT）
- 工作區外的圖片（模擬從桌面拖放 / 對話框選取）→ 同樣 `Path access denied`

⇒ 不只貼上：**任何不在工作區內的圖片附件（拖放、對話框）本機也全部失敗**（面板只 `console.error`，使用者看到的是「沒反應」）。只有工作區內的圖片能成功。遠端視窗另外讀錯檔案系統（T0421 #3，程式碼推論）。

### 產出摘要

| 檔案 | 改動 |
|------|------|
| `electron/image-attachments.ts`（新） | 無 `electron` import 的純模組：`clipboardImageToDataUrl(image)`（空剪貼簿回 `null`、> `MAX_IMAGE_SIZE` throw）、`readSelectedAttachments(paths)`（依副檔名分 files / images，圖片本機讀成 data URL；讀失敗或過大 → `logger.warn` 略過，等同舊行為 `image:read-as-data-url` throw 後不附加）。mime 對照與 fallback 與 `image:read-as-data-url` 一致 |
| `electron/main.ts` | `registerLocalHandlers()` 新增兩個純 `ipcMain.handle`：`dialog:select-attachments`（`async (event) =>`，main 自己開對話框，對回傳路徑呼叫 `readSelectedAttachments`）、`clipboard:read-image-data-url`（`() =>`，`clipboardImageToDataUrl(clipboard.readImage())`）。**兩者都不接受 renderer 參數** → 不是任意讀檔口。`clipboard:saveImage` 保留（PromptBox 需要檔案路徑給 terminal agent） |
| `electron/preload.ts` | `dialog.selectAttachments()`、`clipboard.readImageDataUrl()`（皆無參數 invoke） |
| `src/types/electron.d.ts` | 對應型別 |
| `src/lib/image-attachment.ts`（新） | `readFileAsDataUrl(file)`（`FileReader`，> 10 MB 直接 reject 不讀）、`droppedImageKey(file, diskPath)`（有路徑用路徑，無路徑用 `dropped:<name>:<size>:<lastModified>`） |
| `src/components/ClaudeAgentPanel.tsx` / `CodexAgentPanel.tsx`（兩面板原碼逐字相同，同步改） | `addImageByPath` → `addImage(key, dataUrl)`（純 setState，維持 MAX_IMAGES 5 + 去重）；**拖放**：圖片用 `readFileAsDataUrl(file)`，非圖片仍走 `getPathForFile` + `addFileByPath`；**貼上**：`clipboard.readImageDataUrl()`；**對話框**：`dialog.selectAttachments()`，圖片直接用回傳 data URL、檔案照舊 by path；移除 `IMAGE_EXTENSIONS`（搬到 main）。面板不再呼叫 `image.readAsDataUrl` / `clipboard.saveImage` / `dialog.selectFiles` |
| `src/__tests__/image-attachment-client-read.test.tsx`（新） | 兩面板 × {拖放（含無磁碟路徑的圖片）、貼上、貼上空剪貼簿、對話框} + helper 3 項；每項斷言 `image.readAsDataUrl` 未被呼叫、縮圖 `src` 為 client 端 data URL |
| `electron/__tests__/image-attachments.test.ts`（新） | 重現 2 項 + main 模組 3 項 + 守門 5 項：新 channel 不在 `PROXIED_CHANNELS` / `ALWAYS_LOCAL_CHANNELS` / `PATH_ARG_SCHEMA`；位於 `registerLocalHandlers` 且 handler 簽章無 renderer 參數；全 `electron/` 無 `registerHandler(` / `register(` 註冊它們；preload 無參數 invoke；兩面板原始碼不含舊三個 API |
| `src/__tests__/drag-drop-get-path-for-file.test.tsx` | T0435 的「image drop reads the resolved path」改為斷言圖片從 File 讀、`readAsDataUrl` 未被呼叫（語意隨本單改變） |

未改：`FileTree.tsx:43` / `PathLinker.tsx:204` 的預覽（維持 proxied `image:read-as-data-url`）；`PromptBox.tsx` 的 `clipboard.saveImage`；`ClaudeRuntimeSection.tsx` 的 `dialog.selectFiles`。

### 驗證

| 閘 | 結果 | 證據 |
|----|------|------|
| 新測試 | PASS | `npx vitest run src/__tests__/image-attachment-client-read.test.tsx src/__tests__/drag-drop-get-path-for-file.test.tsx` → 17 passed；`npx vitest run electron/__tests__/image-attachments.test.ts` → 10 passed |
| 反向驗證（mutation） | PASS | 暫時把 Claude 面板貼上改回 `image.readAsDataUrl(await clipboard.saveImage())` → 3 項失敗（RTL 貼上 ×2、守門「panels no longer read by path」）；已由備份檔還原並確認 |
| `npm run test:unit` | PASS | `Test Files 130 passed (130)`、`Tests 2014 passed \| 1 skipped (2015)` |
| `npx tsc --noEmit` | **39**（= T0435 後基線） | `CodexAgentPanel.tsx` 32、`terminal-keyboard-event.test.ts` 5、`integration.transitions.test.ts` 1、`agent-profiles.ts` 1；本單 0 筆 |
| 附加：`npx tsc --noEmit -p tsconfig.node.json` | 本單 0 筆 | 該 project 全域 152 筆皆既有（TS2802 / TS6307 等），本單新增行與 `electron/image-attachments.ts` 無錯誤；非工單閘門 |
| `npx vite build` / `npm run test:e2e` | 未跑 | 依 memory_overrides（L141） |
| 實機 | 未做 | Worker 無法操作 GUI；見下方步驟 |

### 使用者實機步驟

前置：啟動含本修正的 BAT（`npm run dev` 或下一版安裝檔），開一個 Claude 面板。附件縮圖出現在輸入框上方即為成功；可再送出訊息確認 agent 看得到圖。

**本機視窗**
1. **拖放**：從檔案總管把一張**工作區外**的圖（例如 `C:\Users\<你>\Pictures\a.png`）拖進 Claude 面板 → 出現縮圖（修正前：無反應，DevTools console `Failed to read image: Error: ... Path access denied`）
2. **貼上**：`Win+Shift+S` 截圖 → 在輸入框 `Ctrl+V` → 出現縮圖（修正前同上，無反應）
3. **對話框**：點輸入列的 📎 → 選一張工作區外的 `.png` 和一個 `.md` → 圖片出現縮圖、`.md` 出現檔名 chip
4. 送出 → agent 回覆能描述圖片內容
5. Codex 面板重複 1-3

**WSL 遠端視窗**（remote profile 連 WSL）
6. 同 1-4：三種方式都應出現縮圖並能送出（修正前：圖片路徑被轉成 `/mnt/c/...` 送到 server 端讀，不在 synced roots → 失敗）
7. 回歸：在檔案樹點一張**工作區內**的圖片 → 預覽仍正常（仍走 proxied `image:read-as-data-url` 讀 server 檔案，屬正確行為）
8. ⚠️ 遠端視窗拖放 / 對話框附加的**非圖片檔**仍送 client 路徑（`@C:\...`）——由 T0437 處理，本單不驗

### 遭遇問題 / 偏離

1. **🔴 偏離 memory_overrides 第 2 條「新 channel 必須列入 ALWAYS_LOCAL」——改採更嚴格的 local-only（Worker 依 YOLO 自決，請塔台複核）**：
   - `ALWAYS_LOCAL_CHANNELS` 必須是 `PROXIED_CHANNELS` 的子集（`checkHeadlessParity` 的 `stale-always-local`），且要經 `registerHandler` 進 handler registry；而 `RemoteServer` 對任何已驗證 client 的 invoke frame 一律走 `invokeHandler`（`electron/remote/remote-server.ts:489`）。⇒ 列入 ALWAYS_LOCAL 等於讓**連到本機 RemoteServer 的遠端 client 能讀本機剪貼簿、在本機桌面彈出對話框**。
   - 改為與既有 `clipboard:saveImage` / `dialog:select-files` 同層的純 `ipcMain.handle`（`registerLocalHandlers`）：renderer 一定在本機處理、永不 proxy、RemoteServer 也呼叫不到。不在 `PROXIED_CHANNELS`，所以 T0416（`path-aware-channels-coverage`）/ T0422（`headless-parity` / `headless-always-local`）的全分類守門不涵蓋它們（守門範圍只有 proxied channel），全套測試照樣全綠。
   - 以新守門取代：`electron/__tests__/image-attachments.test.ts` 的「local-only channels」5 項（見上表）。若塔台仍要 ALWAYS_LOCAL 形式，需另評估 RemoteServer 端擋 ALWAYS_LOCAL invoke 的機制。
2. **超出 `affects_files` 的新檔**：`electron/image-attachments.ts`（main.ts 無法在測試中載入，抽出才可測）、`src/lib/image-attachment.ts`（兩面板共用的 FileReader helper）、`src/__tests__/image-attachment-client-read.test.tsx`（`src/__tests__/` 已列）、`electron/__tests__/image-attachments.test.ts`（`electron/__tests__/` 已列）。`protocol.ts` / `headless-channel-status.ts` / `path-aware-channels.ts` **未改**（見 1）。
3. **行為小變動**：拖放沒有磁碟路徑的圖片（例如從網頁拖出）現在也會附加（原本 `getPathForFile` 回 `''` 就略過）；非圖片無路徑仍略過。
4. **平行 Worker 共用檔**：開工後 `electron/main.ts` 被 T0431 改動並 **stage** 進 index；`electron/preload.ts` / `src/types/electron.d.ts` 含 T0426 未 commit 的 hunk。本單 hunk 與它們不重疊（main.ts 3 hunk、preload 2 hunk、electron.d.ts 2 hunk），commit 處理見下節。

## 塔台補充（ct-done 補救，2026-10-05 06:54）

> 原 Worker 於 06:07 寫完回報區後停在 commit 前（分頁疑似關閉 / 停住），無 commit。塔台接受偏離 1（local-only `ipcMain.handle`，比 ALWAYS_LOCAL 更嚴格）與 2-3。

補救步驟（ct-done Worker）：
1. **先驗證**：`npm run test:unit` + `npx tsc --noEmit`（≤ 39）在目前工作樹仍綠（工作樹含其他平行單未提交改動；若紅在本單檔案外，記錄不修）
2. **本單檔案**：新檔 `electron/image-attachments.ts`、`src/lib/image-attachment.ts`、`src/__tests__/image-attachment-client-read.test.tsx`、`electron/__tests__/image-attachments.test.ts` 直接 `git add`；`src/components/ClaudeAgentPanel.tsx`、`src/components/CodexAgentPanel.tsx`、`src/__tests__/drag-drop-get-path-for-file.test.tsx` 先 `git diff` 確認只含本單改動再 add
3. **共用檔精準 stage**：`electron/main.ts`（本單 3 hunk：`image-attachments` import、`dialog:select-attachments`、`clipboard:read-image-data-url`）、`electron/preload.ts`（2 hunk：`selectAttachments` / `readImageDataUrl`）、`src/types/electron.d.ts`（2 hunk）——工作樹另有 T0450 / T0453 等未提交 hunk，**必須**以 `git diff <file>` 擷取本單 hunk → `git apply --cached` 送進 index（T0431 / T0442 / T0443 做法），不得 `git add` 整檔、不得 `git commit --only <shared file>`
4. `git diff --cached --name-only` + `git diff --cached` 檢查只含本單內容 → `git commit`（不帶 pathspec），訊息含 `T0436`；本工單 frontmatter `status: DONE` + `completed_at` / `updated_at`（取 `date`）；BUG-108 改 `FIXED` + `links.fix_workorder: T0436`
5. **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；不 push

### ct-done 補救驗證（2026-10-05T06:56:06+08:00）

- Landing Zone Check：PASS（C-0 `better-agent-terminal` = repo basename；C-1 PASS；C-2 `main`，工單無 branch 欄位；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE=yolo`）
- 本單測試：`npx vitest run src/__tests__/image-attachment-client-read.test.tsx src/__tests__/drag-drop-get-path-for-file.test.tsx electron/__tests__/image-attachments.test.ts` → **27 passed**
- `npm run test:unit`（目前工作樹，含其他平行單未 commit 改動）：`Test Files 2 failed | 149 passed (151)`、`Tests 2 failed | 2424 passed | 1 skipped`；第二次跑失敗項為 `tests/bat-notify-submit.test.mjs`（submit LF）、`scripts/__tests__/smoke-remote-headless.test.mjs`（S13 `REMOTE_TOWER_ENV_KEYS`）、`electron/remote/__tests__/headless-helper-env.test.ts`（codex not detected）——皆在 T0434 / T0450 進行中的檔（`scripts/bat-notify.mjs`、`scripts/smoke-remote-headless.mjs`、`electron/remote/helper-capability.ts` 等，工作樹 dirty），**不在本單檔案範圍**，依塔台指示記錄不修
- `npx tsc --noEmit`：**39**（= 基線；CodexAgentPanel 32 / terminal-keyboard-event 5 / integration.transitions 1 / agent-profiles 1，本單 0 筆）
- 共用檔：`electron/main.ts` / `electron/preload.ts` / `src/types/electron.d.ts` 補救時的 `git diff` 只剩本單 hunk（3 / 2 / 2），仍以 `git diff <file> | git apply --cached` stage；面板 ×2 與 `drag-drop-get-path-for-file.test.tsx` 確認只含本單改動
- 未跑：`npx vite build` / `npm run test:e2e`（L141）；實機 GUI（待使用者，見上方步驟）

### Commit

本單程式碼 + 測試 + 本工單 + BUG-108 同一個 commit（訊息含 `T0436`；`git log --grep T0436`）。SHA 補記於下行。

### 回報時間

2026-10-05T06:56:06+08:00（ct-done 補救；原 Worker 回報區寫於 06:07 左右）
