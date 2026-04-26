# BUG-064 — `classifyStderr` 只認英文 ssh stderr 訊息（i18n 脆弱）

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-064 |
| 標題 | ssh-auth-probe / ssh-tunnel 解析 stderr 時 hardcode 英文關鍵字（"Permission denied" / "Connection refused" / "Host key verification failed"），non-en locale 的 ssh 輸出會 fallback 到 "unknown" errorCode |
| 嚴重度 | 🟢 Low |
| 可重現 | 環境相關（需要 LANG / LC_MESSAGES 非 en_US） |
| Workaround | 設定 `LANG=C` 或 `LC_MESSAGES=C` 強制英文輸出 |
| 狀態 | 🚫 CLOSED 2026-04-26 — T0301 fix commit `27d78c9`（與 BUG-065 同批）；v0.4.1 patch chain T0299-T0302 全綠 GO verdict |
| 建立時間 | 2026-04-26 17:18 (UTC+8) |
| 報告者 | T0292 review F-008 |
| 影響範圍 | `electron/remote/ssh-auth-probe.ts:classifyStderr` + 各處 stderr parsing |
| 修復策略 | 1) spawn ssh 時注入 `LANG=C LC_MESSAGES=C` env 強制英文輸出（推薦）；2) 或基於 ssh exit code + 結構化 stderr pattern matching |
| Release target | v0.4.1 patch |
