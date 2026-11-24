---
schema_version: 1
schema_kind: workorder
id: T0895
title: "遠端上傳 `clipboard-image`（SSH / Docker 終端貼圖）在讀完整張圖之前以剪貼簿原始大小早退，錯誤碼維持 `TOO_LARGE`（BUG-216 後續，在 `ct/T0893` 之上）"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-25T00:57:53+08:00"
started_at: "2026-11-25T00:58:47+08:00"
updated_at: "2026-11-25T01:05:25+08:00"
completed_at: "2026-11-25T01:05:25+08:00"
session_ids:
  - "eb72fa26-bf0d-47fb-a4ed-12bb4e5fcbad"
target_version: "0.8.0-pre.2"
depends_on: [T0893]
related:
  - "BUG-216；T0893（`readClipboardPng(…, { refuseAboveBytes })`、`CLIPBOARD_IMAGE_EARLY_REFUSE_BYTES`，回報區〈建議後續〉）；D320（使用者 2026-11-25：候選「安排」）；D319（合併計畫）"
  - "CLAUDE.md「遠端附件上傳暫存（PLAN-038 / T0832）」client 端與終端段（T0833 / T0835）、「Electron Runtime」main 行程 clipboard 各節；`docs/agent-guide/remote-file-upload.md`"
affects_files:
  - _ct-workorders/T0895-upload-client-clipboard-image-early-refuse.md
  - electron/upload-client.ts
  - electron/main.ts
  - electron/image-attachments.ts
  - electron/__tests__/upload-client.test.ts
  - electron/__tests__/image-attachments.test.ts
renew_count: 0
isolation: worktree
workdir: worktree ct/T0895（塔台已預先從 `ct/T0893` `43d290c9` 建立分支 `ct/T0895`，包含 T0893 的修正）
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0895` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" rev-parse HEAD` 的祖先含 `43d290c97f75c406b440bc86b3d1942976096e68`（`git merge-base --is-ancestor 43d290c9 HEAD` exit 0），不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main`、`v0.8.x`、`ct/T0893`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只改 `affects_files` 列的檔案。**不改 CLAUDE.md、`docs/agent-guide/`、`package*.json`、`src/**`**；文件要補的文字寫在回報區，由合併工單補。需要動其他檔 → 先問塔台。"
  - "🔴 修正目標：`upload-client.ts` 的 `clipboard-image` 來源目前 `readClipboardPng()` 讀完整張、重新編碼後才比 `UPLOAD_LIMITS.maxFileBytes`（50 MiB）。改成沿用 T0893 的 `readClipboardPng(clipboard, { refuseAboveBytes })`：剪貼簿原始 PNG 大小超過門檻就不讀資料、不解碼 / 編碼，直接回 `TOO_LARGE`（🔴 錯誤碼、訊息格式、`fail()` 的回傳形狀維持現狀；早退丟出的 `Image too large` 例外要對應成 `TOO_LARGE`，不得落到其他錯誤碼）。門檻：`UPLOAD_LIMITS.maxFileBytes` × 1.25（塔台裁決：T0893 實測原始與重新編碼的差距 ≤ 4.6%，留 25% 餘裕讓 50 MiB 邊界附近的結果不變；超過門檻才早退，50 MiB～門檻之間照舊讀完、重新編碼後比 50 MiB）。常數與理由寫在程式註解，不得改 `UPLOAD_LIMITS` 的值。"
  - "🔴 不得改變的行為：`readClipboardPng` 仍是唯一讀取實作；`clipboard:saveImage`、面板 `clipboard:read-image-data-url`（T0893 的 20 MiB 門檻）不變；`upload:*` channel、`UploadClient` 的協定（stop-and-wait、chunk 重送）、`path` / `file` 來源、host 端 `UploadStaging` 都不變；小於上限的圖上傳結果不變。日誌只記大小與結果，不記內容與路徑（CLAUDE.md「遠端附件上傳暫存」）。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 全綠（附 passed / files 數）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。單元測試涵蓋：超過門檻不呼叫讀取資料（`arrayBuffer` / 解碼）且回 `TOO_LARGE`；50 MiB～門檻之間照舊讀完再比；小圖照舊上傳。不需要啟動 BAT 實機；若要量測只用 worktree 的 electron 與暫存 `--user-data-dir`（比照 T0893），不碰使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）與其 userData / Terminal Server / `bat-pty-holder`，量測圖放 repo 外暫存並刪除、剪貼簿還原成空字串。`TMP` 用系統預設（T0716）。"
  - "🔴 程序清理（D308）：只結束本單啟動且可追溯到本單的程序；一次一個、不 `taskkill /T`、不以程序名稱或父 PID 大範圍結束。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "🔴 公開 repo（D176）：回報區路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0895 — 遠端上傳 `clipboard-image` 早退（BUG-216 後續）

## 背景

- T0893（BUG-216）讓終端判斷有沒有圖只看格式清單、面板貼圖在解碼前以原始大小早退（門檻 20 MiB），並在 `readClipboardPng` 加了 `refuseAboveBytes` 選項。
- SSH / Docker profile 的終端貼圖（T0835，`imagePasteModeFor`）要把圖上傳到遠端，走 `upload-client.ts` 的 `clipboard-image` 來源（main 注入 `readClipboardPng: () => readClipboardPng(clipboard)`，`electron/main.ts` 約 2956 行）。這條路徑仍是讀完整張、重新編碼後才比 50 MiB 上限，50 MB 級的圖同樣會讓主行程卡住、記憶體衝高。
- 使用者 2026-11-25 指示安排（D320）。本單從 `ct/T0893` 開分支（需要 T0893 的 `refuseAboveBytes`），由 D319 的合併工單一起併進 `v0.8.x`，隨 `0.8.0-pre.2` 發佈。

## 實作

1. 確認祖先含 `43d290c9`；worktree `npm ci`。
2. 照 `memory_overrides` 第 3 條在 `clipboard-image` 路徑早退，維持 `TOO_LARGE`。
3. 測試；文件要補的文字寫在回報區。

## 驗收

- [ ] 原始大小 > `maxFileBytes` × 1.25 的剪貼簿圖：不讀資料、不解碼，回 `TOO_LARGE`（形狀與訊息格式不變）
- [ ] 50 MiB～門檻之間、小圖：結果與修正前相同
- [ ] 面板 / `saveImage` / 其他上傳來源不變
- [ ] `test:unit` 全綠、`vite build` exit 0、兩個 typecheck = 0
- [ ] 隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（驗收 5 項全部通過；不需實機量測，本單未啟動 BAT / electron）
- **session_id**：eb72fa26-bf0d-47fb-a4ed-12bb4e5fcbad

### 產出摘要

**修正**（product commit `c6565a96`，分支 `ct/T0895`）

- `electron/upload-client.ts`
  - 新常數 `CLIPBOARD_UPLOAD_EARLY_REFUSE_BYTES = Math.floor(UPLOAD_LIMITS.maxFileBytes * 1.25)` = 65,536,000 bytes（62.5 MiB），註解寫明理由（T0893 實測原始與讀回差距 ≤ 4.6%，留 25% 餘裕，50 MiB～門檻之間照舊讀完再比 50 MiB；塔台裁決）。`UPLOAD_LIMITS` 的值沒改。
  - `UploadClientDeps.readClipboardPng` 改為 `(options?: ReadClipboardPngOptions) => Promise<Buffer | null>`；`clipboard-image` 來源呼叫時帶 `{ refuseAboveBytes: CLIPBOARD_UPLOAD_EARLY_REFUSE_BYTES }`。
  - 早退例外（`ClipboardImageTooLargeError`）→ `fail('TOO_LARGE', 'image is larger than 52428800 bytes')`，與原本讀完後超過 50 MiB 的回傳逐字相同（形狀 `{ ok: false, code, message }` 不變）。只認這個類別（`instanceof`），不比對訊息文字；其他讀取錯誤照舊 `SOURCE_ERROR`。
- `electron/image-attachments.ts`：新增 `ClipboardImageTooLargeError extends Error`（帶剪貼簿原始大小 `size`，訊息與 T0893 相同 `Image too large (<n> > 10485760 bytes)`），只用在 `refuseAboveBytes` 早退那一條；`clipboardImageToDataUrl` 的重新編碼檢查仍丟一般 `Error`。`readClipboardPng` 的讀取邏輯與日誌（`[clipboard] read-image … png=refused size=<n>`，只有大小）沒改，仍是唯一讀取實作。
- `electron/main.ts`：`UploadClient` 的注入改為 `readClipboardPng: options => readClipboardPng(clipboard, options),`（加一行註解）。`clipboard:saveImage`（不帶選項）、`clipboard:read-image-data-url`（T0893 的 20 MiB 門檻）、`upload-client:*` IPC 都沒改。

**測試**
- `electron/__tests__/upload-client.test.ts` 新增 describe「T0895: clipboard-image early refusal」6 個測試，以**真的** `readClipboardPng` 接 fake 剪貼簿（Blob 回報 `size`、`arrayBuffer` 是 spy），與 main 的接法相同：
  1. 門檻 = 1.25 × 50 MiB = 65,536,000，50 MiB 上限不變。
  2. 門檻 + 1：`prepare` 項目 `toEqual({ ok: false, code: 'TOO_LARGE', message: 'image is larger than 52428800 bytes' })`、`arrayBuffer` 未被呼叫、注入的 dep 收到 `{ refuseAboveBytes: 65536000 }`、沒有任何 `upload:*` invoke、沒有留下 transfer；經 renderer driver `uploadToRemoteHost` 結果相同。
  3. 70 MiB：`TOO_LARGE`，不是 `SOURCE_ERROR`。
  4. 一般 `Error('Image too large …')`（非該類別）→ 仍 `SOURCE_ERROR`（只靠類別對應）。
  5. 50 MiB～門檻：剛好門檻 → 讀完（`arrayBuffer` 1 次）後 `TOO_LARGE`；原始 50 MiB + 1 但讀回 50 MiB → 接受、`size` = 50 MiB；讀回 50 MiB + 1 → 讀完後 `TOO_LARGE`。與修正前相同。
  6. 3000 bytes 小圖：讀 1 次、經 host `UploadStaging` 上傳、內容逐位元相同、檔名 `clipboard-<時間>.png`。
  - 既有的 clipboard 測試（fake dep 忽略參數）照舊通過。
- `electron/__tests__/image-attachments.test.ts`：新增「T0895: early refusal 是 `ClipboardImageTooLargeError`、帶 `size`、訊息不變、`arrayBuffer` 未呼叫；`clipboardImageToDataUrl` 仍丟一般 Error」；source guard 改為 `readClipboardPng: options => readClipboardPng(clipboard, options),`，`saveImage` 不帶選項、`read-image-data-url` 帶 20 MiB 門檻兩個斷言保留不動。

**驗證（在 `c6565a96` 上）**
- worktree `npm ci`：exit 0（結尾 install-scripts 警告屬預期）。
- `npm run typecheck`：exit 0、`error TS` 0 個。
- `npm run typecheck:electron`：exit 0、`error TS` 0 個。
- `npx vite build`：exit 0。
- `npm run test:unit`：
  - 第 1 次：exit 1，`Test Files 6 failed | 457 passed | 3 skipped (466)`、`Tests 8420 passed | 95 skipped`（0 個測試失敗）；6 個失敗檔都是 RemoteServer / headless e2e 的 `Hook timed out in 10000ms`（`local-helper-capability`、`tower-questions`、`headless-blocked-state-e2e`、`headless-close-worker-e2e`、`headless-helper-narrowing`、`headless-remote-tower-e2e`），與本單改動無關（都不經 `upload-client` / clipboard）。
  - 這 6 檔單獨重跑：`6 passed`、`118 passed`。
  - 第 2 次完整執行：**exit 0，`Test Files 463 passed | 3 skipped (466)`、`Tests 8473 passed | 42 skipped (8515)`**。
- 實機量測：未做（工單寫明不需要；早退由單元測試以 `arrayBuffer` spy 證明不讀資料）。沒有啟動任何程序，沒有程序需要清理（D308）。

**驗收對照**
- [x] 原始大小 > `maxFileBytes` × 1.25：不讀資料、不解碼，回 `TOO_LARGE`，形狀與訊息不變（測試 2、3）。
- [x] 50 MiB～門檻、小圖：結果與修正前相同（測試 5、6）。
- [x] 面板 / `saveImage` / 其他上傳來源不變（source guard；`path` / `file` 來源、`upload:*` 協定、`UploadStaging` 沒改，既有測試全過）。
- [x] `test:unit` 全綠（第 2 次）、`vite build` exit 0、兩個 typecheck = 0。
- [x] 隔離分支證據（下方）。

**合併工單要補的文件文字（本單不改 CLAUDE.md / docs）**
- CLAUDE.md「遠端附件上傳暫存（PLAN-038 / T0832）」節的「終端（T0835）」那一點，`Ctrl+V 圖片只有 SSH / Docker profile … 改上傳 PNG 後貼路徑` 之後補一句：
  「剪貼簿原始 PNG 大於 `CLIPBOARD_UPLOAD_EARLY_REFUSE_BYTES`（50 MiB × 1.25，`electron/upload-client.ts`）時不讀資料、直接 `TOO_LARGE`（T0895；經 `readClipboardPng(…, { refuseAboveBytes })`，早退例外 `ClipboardImageTooLargeError`）。」
- `docs/agent-guide/remote-file-upload.md` 的 client 端 / 上限與錯誤碼段補一段：
  「`clipboard-image` 來源（T0895，BUG-216 後續）：main 以 `readClipboardPng(clipboard, { refuseAboveBytes: CLIPBOARD_UPLOAD_EARLY_REFUSE_BYTES })` 讀剪貼簿；原始 PNG 大於 65,536,000 bytes（50 MiB × 1.25）時不把資料讀進 main、不解碼，回 `TOO_LARGE`（訊息與讀完後超過 50 MiB 相同：`image is larger than 52428800 bytes`）。50 MiB～門檻之間照舊讀完、以讀回的位元組數比 50 MiB（T0893 實測原始與讀回差距 ≤ 4.6%，25% 餘裕讓邊界附近結果不變）。只有 `ClipboardImageTooLargeError` 對應 `TOO_LARGE`，其他讀取錯誤仍 `SOURCE_ERROR`。」
- CLAUDE.md「Electron Runtime」main 行程 clipboard 那一點不需改（`readClipboardPng` 仍是唯一讀圖實作）；若要更完整，可在「T0893 … `refuseAboveBytes`」相關敘述（若合併時已有）加上「upload-client 也帶選項（T0895）」。

### 互動紀錄
- [00:58] 開工：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；worktree HEAD `43d290c9`，`git merge-base --is-ancestor 43d290c9 HEAD` exit 0（`CT_WORKTREE_BASE` = `06c3b884…`，為與 main 的共同祖先，屬工單所述的預期）。
- [01:01] 設計判斷（範圍內、未問塔台）：早退例外以新類別 `ClipboardImageTooLargeError`（訊息不變）辨識，而不是比對 `Image too large` 字串，避免其他讀取錯誤被誤對應成 `TOO_LARGE`；`refuseAboveBytes` 由 upload-client 傳給注入的 dep（門檻與對應都在 upload-client 一處，測試可直接驗證）。
- 塔台補充段落：三個節點檢查皆無新段落。

### Renew 歷程
無

### 遭遇問題
- 第 1 次 `npm run test:unit` 有 6 個 RemoteServer / headless e2e 檔 `beforeAll` hook 逾時（10 s），單獨重跑與第 2 次完整執行皆通過，判斷為整套平行執行時的負載逾時，與本單無關。若塔台想追蹤這類 flaky，可另開工單（本單不處理）。

### 落點檢查
- **結果**：PASS
- C-0：`repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal` → PASS
- C-1：工單位於 `$CT_HOME/_ct-workorders/` → PASS
- C-3：`affects_files` 5 個產品檔都存在於 worktree → PASS（資訊性）
- C-2：工單沒有 `branch` 欄位；目前分支 `ct/T0895`
- `CT_HOME`：已設定（主 checkout）；`CT_WORKTREE_BRANCH`：`ct/T0895`；`BAT_WORKSPACE_ID`：`cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`BAT_REMOTE_TOKEN`：已設定

### 隔離分支證據
- branch：`ct/T0895`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`；分支實際起點為 `ct/T0893` `43d290c97f75c406b440bc86b3d1942976096e68`，祖先檢查 exit 0）
- validated_sha：`c6565a9665f7e5c3f2a1354c33c9f2d3d15dba9b`
- head_sha：`c6565a9665f7e5c3f2a1354c33c9f2d3d15dba9b`
- validated_sha ≠ head_sha 的說明：相同，不適用
- 收單前 `git -C "$CT_WORKTREE" status --porcelain`：空

### 回報時間
2026-11-25T01:04:37+0800
