# BUG-061 — `src/components/CodexAgentPanel.tsx` baseline tsc errors（dev-only，pre-existing）

## Metadata

| 欄位 | 內容 |
|------|------|
| BUG 編號 | BUG-061 |
| 標題 | `src/components/CodexAgentPanel.tsx` 在 `tsc --noEmit` strict 模式有 15+ 個 baseline 編譯錯誤 |
| 嚴重度 | 🟢 Low |
| 可重現 | 100%（main + worktree 皆中） |
| Workaround | 無需 — vite build 不依賴 tsc strict，runtime 不受影響 |
| 狀態 | 🐛 OPEN（記錄為主，非阻塞） |
| 建立時間 | 2026-04-26 14:10 (UTC+8) |
| 報告者 | T0282 Worker AC8 驗收觀察（塔台補開） |
| 影響範圍 | dev-time tsc 顯示髒、PR 過程 type-check gate（如未來開啟） |

## 現象

T0282 Worker 跑 `npx tsc --noEmit -p tsconfig.json` 卡 AC8（自願 PARTIAL）。塔台跨 main 驗證確認 baseline，類別分佈：

| 類別 | 數量（估） | 範例 |
|------|----------|------|
| `SessionMeta` schema mismatch | ~4 | L133/L607/L1093-L1095（assignment + cast） |
| IPC API 不存在於 type definition | ~5 | `rewindToPrompt`（L1357）/ `authLogin`（L1546）/ `accountImportCurrent`（L1558）/ `electronAPI` arity（L1261/L1480） |
| Promise/Resolver 型別不一致 | ~2 | L1109/L1133 `(models: ModelInfo[]) => void` vs `(value: unknown) => void` |
| Unused declaration | 2 | L176 `claudeUsage` / L177 `usageAccount` |
| 雜項 | ~1-2 | L1481 `SetStateAction<SessionSummary[]>` mismatch |

**完整 error list**（main 跑 `tsc --noEmit` 結果）見對話 transcript（2026-04-26 14:09）。

## 性質判定

- **Pre-existing**：不是任何 Phase 4 / T0282 引入；commit history 顯示 CodexAgentPanel.tsx 自 codex 整合以來累積（PLAN-007 之前）
- **Dev-only**：vite build / electron-builder / runtime 全部不靠 `tsc --noEmit` strict pass
- **不阻塞 Phase 4**：所有 PLAN-007 工單以 contract test + AC8 為驗收，Worker 可在 PARTIAL 接受先例下繼續

## 不在 scope（不修）

- ❌ 此 BUG 不派修復工單於 Phase 4 期間（避免分散 PLAN-007 主線注意力）
- ❌ 不開 PLAN（純技術債清理，無設計決策）

## 後續處理

- **暫定**：Phase 5（PLAN-007 整合測試 + UX polish）期間順帶修，或開獨立 PLAN 追技術債清理
- **觸發條件**：若引入 CI tsc strict gate（目前無），或 SessionMeta 結構需擴充（如 BAT 加新 model），優先升級為 🟡 Medium 並派修復工單

## 相關工單

- T0282（首次撞到 + AC8 PARTIAL 接受先例）
- 未來 Phase 5 整合測試工單（暫定 T0289 / T0290）
