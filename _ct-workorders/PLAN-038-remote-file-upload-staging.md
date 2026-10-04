---
schema_version: 1
schema_kind: plan
id: PLAN-038
title: 本機檔案上傳到遠端暫存目錄（SSH 附件、Docker 掛載外、遠端 CLI 貼圖）
status: IDEA
priority: low
created_at: "2026-10-05T05:51:45+08:00"
updated_at: "2026-10-05T05:51:45+08:00"
links:
  research_workorder: T0421
  related: [BUG-105, PLAN-036, D134]
---

# PLAN-038 — 本機檔案上傳到遠端暫存目錄

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-038 |
| 優先級 | 🟢 Low |
| 狀態 | 💡 IDEA |
| 建立時間 | 2026-10-05 05:51 (UTC+8) |
| 來源 | T0421 研究拆單第 7 列（使用者 05:51 裁決開 PLAN 記錄） |

## 背景與動機

遠端視窗（特別是 SSH，以及 Docker 掛載外、WSL 其他 distro）把本機檔案拖放 / 附加到 Claude 面板時，遠端主機上沒有這個檔案。T0421 Q1 裁決本期以「拒絕並提示」代替（T0437）。若要真正支援，需要把檔案內容傳到遠端暫存目錄，並把遠端路徑注入 prompt。另一情境：WSL claude CLI 的 Alt+V 貼圖讀的是遠端剪貼簿。

## 待研究

- 新 channel 設計（分塊、大小上限、進度）、暫存目錄位置與清理策略、權限
- 與 path sandbox（T0406 `workspace:sync-roots`）的關係
- 遠端 CLI 貼圖是否可經此通道解決

## 不在範圍

- 雙向同步、資料夾上傳
