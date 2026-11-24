---
schema_version: 1
schema_kind: workorder
id: T0895
title: "遠端上傳 `clipboard-image`（SSH / Docker 終端貼圖）在讀完整張圖之前以剪貼簿原始大小早退，錯誤碼維持 `TOO_LARGE`（BUG-216 後續，在 `ct/T0893` 之上）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-25T00:57:53+08:00"
updated_at: "2026-11-25T00:57:53+08:00"
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
- **session_id**：

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0895`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
