# BUG-062 — RemoteClient fingerprint mismatch 後未 early-return（race window token leak）

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-062 |
| 標題 | RemoteClient upgrade handler 在 fingerprint mismatch 時 close ws 後缺 `return`，理論性 race window 可送 auth frame 到指紋不符的 server |
| 嚴重度 | 🟡 Medium |
| 可重現 | 理論性（需特定 ws 套件版本 + race window） |
| Workaround | 無需 — TLS handshake 已過，server 已能讀 wss payload，但實務 ws 多半不會在 close 後再 fire 'open' |
| 狀態 | 🚫 CLOSED 2026-04-26 — T0300 fix commit `a5841ae`（與 BUG-066 / BUG-068 同批）；v0.4.1 patch chain T0299-T0302 全綠 GO verdict |
| 建立時間 | 2026-04-26 17:18 (UTC+8) |
| 報告者 | T0292 review F-006 |
| 影響範圍 | `electron/remote/remote-client.ts:265-278` |
| 修復策略 | fingerprint mismatch 區塊末尾加 `return`，`_connected = false` 移到 settle 之前 |
| Release target | v0.4.1 patch |
