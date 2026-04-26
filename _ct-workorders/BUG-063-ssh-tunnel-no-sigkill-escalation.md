# BUG-063 — SshTunnel.stop / start error path 只發 SIGTERM，無 SIGKILL escalation

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-063 |
| 標題 | SshTunnel 在 timeout / error 時只發 SIGTERM，stuck ssh 子行程（如卡密碼 prompt）收不到信號，造成殭屍進程 |
| 嚴重度 | 🟡 Medium |
| 可重現 | 100%（mock：ssh 子行程不響應 SIGTERM） |
| Workaround | 使用者手動 `taskkill` / `pkill` |
| 狀態 | 🐛 OPEN（v0.4.1 patch backlog） |
| 建立時間 | 2026-04-26 17:18 (UTC+8) |
| 報告者 | T0292 review F-007 + T0293 EC-009（同 pattern 跨檔：ssh-start-server.ts:runSsh + ssh-auth-probe.ts:152-164） |
| 影響範圍 | `electron/remote/ssh-tunnel.ts` + `ssh-start-server.ts` + `ssh-auth-probe.ts` 三處共用 pattern |
| 修復策略 | 抽共用 helper：SIGTERM → 等 N ms → SIGKILL escalation；3 處共用 |
| 連帶修 | EC-009（同 pattern，跨檔） |
| Release target | v0.4.1 patch |
