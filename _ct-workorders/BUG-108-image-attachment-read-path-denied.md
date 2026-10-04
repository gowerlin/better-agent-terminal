---
schema_version: 1
schema_kind: bug
id: BUG-108
title: "Claude 面板圖片附件走 proxied image:read-as-data-url：貼上圖片暫存於 os.tmpdir() 不在工作區白名單（本機疑似 Path access denied）；遠端視窗讀的是 server 檔案系統"
status: OPEN
severity: medium
reproducibility: unknown
created_at: "2026-10-05T05:51:45+08:00"
updated_at: "2026-10-05T05:51:45+08:00"
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
| 可重現 | 未實機（程式碼推論；T0436 第一步重現） |
| **狀態** | 📂 OPEN |
| 回報者 | T0421 Worker（盤點表 #3 / #4） |

## 現象（程式碼推論，T0421）

- 貼上圖片：`clipboard:saveImage` 存 `os.tmpdir()/bat-clipboard-*.png`（`electron/main.ts` 約 :2442）→ `addImageByPath` → `image:read-as-data-url`；`os.tmpdir()` 不在 window registry 工作區白名單（`electron/path-guard.ts` 約 :68-76）→ 推定 `Path access denied`（本機也壞）
- 遠端視窗：`image:read-as-data-url` 為 proxied channel，讀的是 server 檔案系統，本機拖放 / 貼上的圖片不存在於遠端

## 修復方向

圖片附件改由 client 端讀取（拖放用 `File` + `FileReader`；`clipboard:saveImage` 直接回 data URL；對話框選圖由 main 本機讀），附件不再走 proxied `image:read-as-data-url`；檔案樹 / PathLinker 的預覽維持 proxied。新 channel 不可成為任意本機讀檔口。
