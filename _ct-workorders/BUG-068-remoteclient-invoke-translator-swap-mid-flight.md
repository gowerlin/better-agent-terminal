# BUG-068 — `RemoteClient.invoke` 中途 reconnect 換 translator，in-flight invoke 用 A 翻 args / 用 B 翻 result

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-068 |
| 標題 | RemoteClient invoke 在 reconnect 中途若 translator instance 被替換（如 profile 編輯後），同個 invoke 的 args 用舊 translator 翻譯、result 用新 translator 翻譯 → 路徑不對稱 |
| 嚴重度 | 🟢 Low |
| 可重現 | 罕見 race（需在 reconnect 期間使用者編輯 profile + 同時有 in-flight invoke） |
| Workaround | reconnect 期間 invoke queue 會 hold，實務上 race window 極短 |
| 狀態 | 🚫 CLOSED 2026-04-26 — T0300 fix commit `a5841ae`（與 BUG-062 / BUG-066 同批）；v0.4.1 patch chain T0299-T0302 全綠 GO verdict |
| 建立時間 | 2026-04-26 17:18 (UTC+8) |
| 報告者 | T0293 review EC-007 |
| 影響範圍 | `electron/remote/remote-client.ts::invoke`（in-flight invoke 的 translator 一致性） |
| 修復策略 | 在 invoke 開始時 capture 當下 translator reference，args + result 翻譯都用同一 reference（freeze translator per-invoke） |
| Release target | v0.4.1 patch |
