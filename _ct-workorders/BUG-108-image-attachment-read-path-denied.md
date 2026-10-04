---
schema_version: 1
schema_kind: bug
id: BUG-108
title: "Claude 面板圖片附件走 proxied image:read-as-data-url：貼上圖片暫存於 os.tmpdir() 不在工作區白名單（本機疑似 Path access denied）；遠端視窗讀的是 server 檔案系統"
status: FIXED
severity: medium
reproducibility: always
created_at: "2026-10-05T05:51:45+08:00"
updated_at: "2026-10-05T06:56:06+08:00"
impact:
  - attachments
links:
  fix_workorder: T0436
  related: [T0421, BUG-107, BUG-105]
---

# BUG-108 — 圖片附件讀取路徑

| 欄位 | 內容 |
|------|------|
| 嚴重度 | 🟡 medium（推定：本機貼圖附件失敗；遠端視窗圖片附件讀錯檔案系統） |
| 可重現 | 必現（T0436 單元層級重現：`os.tmpdir()` 與工作區外圖片皆 `Path access denied`；未實機 GUI） |
| **狀態** | 🔧 FIXED（T0436，待實機驗收） |
| 回報者 | T0421 Worker（盤點表 #3 / #4） |

## 現象（程式碼推論，T0421）

- 貼上圖片：`clipboard:saveImage` 存 `os.tmpdir()/bat-clipboard-*.png`（`electron/main.ts` 約 :2442）→ `addImageByPath` → `image:read-as-data-url`；`os.tmpdir()` 不在 window registry 工作區白名單（`electron/path-guard.ts` 約 :68-76）→ 推定 `Path access denied`（本機也壞）
- 遠端視窗：`image:read-as-data-url` 為 proxied channel，讀的是 server 檔案系統，本機拖放 / 貼上的圖片不存在於遠端

## 修復方向

圖片附件改由 client 端讀取（拖放用 `File` + `FileReader`；`clipboard:saveImage` 直接回 data URL；對話框選圖由 main 本機讀），附件不再走 proxied `image:read-as-data-url`；檔案樹 / PathLinker 的預覽維持 proxied。新 channel 不可成為任意本機讀檔口。

## 修復（T0436，2026-10-05T06:56:06+08:00）

- 重現：本機確實壞——不只貼上，任何**工作區外**的圖片附件（拖放、對話框）都被 path guard 擋（`electron/__tests__/image-attachments.test.ts` `repro (BUG-108)`）
- 拖放：renderer `FileReader` 讀 `File`（`src/lib/image-attachment.ts`）
- 貼上：新 local-only channel `clipboard:read-image-data-url`（main 直接 `clipboard.readImage().toDataURL()`）
- 對話框：新 local-only channel `dialog:select-attachments`（main 開對話框並讀回傳路徑，renderer 不傳路徑）
- 兩 channel 為 `registerLocalHandlers` 內純 `ipcMain.handle`，不進 `PROXIED_CHANNELS` / handler registry（RemoteServer 呼叫不到），比 ALWAYS_LOCAL 更嚴格（塔台已接受此偏離）
- 檔案樹 / PathLinker 預覽維持 proxied `image:read-as-data-url`
- 待驗：T0436 回報區「使用者實機步驟」（本機 + WSL 遠端；拖放 / 貼上 / 對話框）
