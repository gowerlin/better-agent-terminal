---
schema_version: 1
schema_kind: bug
id: BUG-065
title: "`translateInvokeArgs` 預設只翻 args[0]，多 path arg channel（git:diff-files）跳過 args[1+]"
status: CLOSED
severity: medium
created_at: "2026-04-26T17:18:00+08:00"
---
# BUG-065 — `translateInvokeArgs` 預設只翻 args[0]，多 path arg channel（git:diff-files）跳過 args[1+]

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-065 |
| 標題 | path-aware-channels.ts 預設分支假設 args[0] 為唯一 path，但 `git:diff-files` 等 channel 簽名為 `(file1, file2)` 或 `(files: string[])`，args[1+] 未翻譯導致 server 端開錯路徑 |
| 嚴重度 | 🟡 Medium |
| 可重現 | 100%（如 git:diff-files 真的傳兩個 path） |
| Workaround | 暫時：caller 端先把 args[1+] 也翻完再 invoke（破壞抽象） |
| 狀態 | 🚫 CLOSED 2026-04-26 — T0301 fix commit `27d78c9`（與 BUG-064 同批）；v0.4.1 patch chain T0299-T0302 全綠 GO verdict |
| 建立時間 | 2026-04-26 17:18 (UTC+8) |
| 報告者 | T0293 review EC-004 |
| 影響範圍 | `electron/remote/path-aware-channels.ts:62-68`（default 分支） |
| 修復策略 | 改為 table-driven schema：`PATH_ARG_SCHEMA: Record<channel, 'first-string' \| 'all-strings' \| 'array-of-strings'>` |
| 對偶 | F-013（PATH_RETURNING_CHANNELS 漏 fs:stat 回流方向）— 也是 v0.4.1 一起修 |
| Release target | v0.4.1 patch |
