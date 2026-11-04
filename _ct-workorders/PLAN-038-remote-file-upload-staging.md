---
schema_version: 1
schema_kind: plan
id: PLAN-038
title: 本機檔案上傳到遠端暫存目錄（SSH 附件、Docker 掛載外、遠端 CLI 貼圖）
status: IN_PROGRESS
priority: low
created_at: "2026-10-05T05:51:45+08:00"
updated_at: "2026-11-04T08:52:59+0800"
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
| 狀態 | 🔄 IN_PROGRESS |
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

## 2026-11-02 狀態核對（第一百零五 session）

- **維持 IDEA**：前提仍成立。遠端遇到本機附件仍是 T0437 的「拒絕並提示」，沒有上傳用的 channel；沒有使用者回報需要。

## 2026-11-04 → IN_PROGRESS（第一百一十六 session，D271）

- 使用者選「先研究再實作」：開研究單 T0828（上傳通道、暫存目錄與清理、權限、path sandbox、Alt+V 貼圖可行性），研究完再拆實作單。

## 2026-11-04 拆實作單（D272）

- T0828 研究完成（方案 A：WSS invoke 分塊 256 KiB stop-and-wait、暫存 `<dataDir>/uploads/`）。使用者裁決：上限單檔 50 MiB / 單次 100 MiB / 每 session 500 MiB；清理 = 關閉即刪＋ 24 h TTL；送出時上傳；不加 Settings 開關；**終端分頁納入**；本 PLAN 併入 `0.7.4-pre.7`。
- 實作單：T0832（host 暫存＋`upload:*`＋契約）→ T0833（client 驅動）→ T0834（Claude / Codex 面板）→ T0835（終端拖放與 SSH / Docker Ctrl+V 貼圖）→ T0836（e2e 與實機驗收清單）。
- 衍生 BUG-211（多張大圖可能超過 32 MiB frame，重現單 T0837）。
