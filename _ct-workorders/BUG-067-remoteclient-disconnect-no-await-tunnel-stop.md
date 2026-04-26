# BUG-067 — `RemoteClient.disconnect` 不 await `tunnel.stop()`，disconnect→reconnect 間 ssh 子行程 overlap

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-067 |
| 標題 | RemoteClient.disconnect 對 tunnel.stop() 不 await，舊 ssh 子行程未完全收尾就觸發新 reconnect → 兩個 ssh 子行程同時 bind 同 localPort（race） |
| 嚴重度 | 🟡 Medium |
| 可重現 | race condition（disconnect 後立即 reconnect 觸發） |
| Workaround | UI 在 disconnect 後加 ~500ms delay 再 reconnect |
| 狀態 | 🚫 CLOSED 2026-04-26 — T0299 fix commit `db496c7`（與 BUG-063 同批）；v0.4.1 patch chain T0299-T0302 全綠 GO verdict |
| 建立時間 | 2026-04-26 17:18 (UTC+8) |
| 報告者 | T0293 review EC-006 |
| 影響範圍 | `electron/remote/remote-client.ts::disconnect` |
| 修復策略 | `disconnect()` 改為 async `await this.tunnel.stop()` 確保子行程完全結束（與 BUG-063 SIGKILL escalation 配合：stop() 內含 escalation 才 await 才有意義） |
| 連帶 | BUG-063（SIGKILL escalation 修完後本問題效益最大化） |
| Release target | v0.4.1 patch |
