# PLAN-029 — Renderer hardening：R3 indexBench.ts 整理 + R5 setup-wizard chunk 切分（BUG-069 audit 衍生）

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-029 |
| 標題 | Renderer hardening：R3 indexBench.ts misplaced require + R5 setup-wizard manualChunks 切分 |
| 優先級 | 🟢 Low |
| 類型 | 技術改善 |
| 狀態 | 💡 IDEA — R5 已由 T0309（PLAN-030 合併）落地，僅剩 R3 indexBench.ts 整理待評估 |
| 建立時間 | 2026-04-26 20:42 (UTC+8) |
| 來源 | T0303 BUG-069 wider audit Risk Inventory R3 + R5 |
| 動機 | BUG-069 修復後仍有兩項 renderer 結構性風險：R3（src/ 下 misplaced require 腳本）+ R5（setup-wizard 未獨立 chunk 導致 wizard regression 影響 launch）。非阻塞但值得排程。 |

## 範圍

### R3：`src/components/git-poc/benchmark/indexBench.ts` 整理

**現況**：該檔用 `const fs = require('fs')` 等 4 處 require，在 `src/` 下但**未被 renderer entry 引用**（rollup 不打包）。屬於 misplaced 腳本。

**選項**：
- [A] 搬到 `tools/git-poc-bench/` 或 `scripts/git-poc/`，重設 import 為 ESM
- [B] 留在原位，加檔頭註解 + ESLint inline disable（T0304 已暫加，此為長期版）
- [C] 直接刪除（如果這個 benchmark 已不維護）

**建議**：先確認該檔還有沒有人在用，若無 → [C]；有 → [A]。

### R5：setup-wizard 獨立 chunk

**現況**：`vite.config.ts` `manualChunks` 只切 react-vendor / xterm / hljs，setup-wizard 進主 bundle。

**改動**：在 `manualChunks` 加 `setup-wizard: ['src/components/setup-wizard']`（或對應 glob），讓 wizard 獨立成 chunk。

**效益**：
- 主 bundle 變小，啟動稍快
- 未來 wizard regression 不會炸 launch
- 更好的 cache 命中（wizard 改動不會 invalidate 主 bundle）

**風險**：低，純 build config 調整。需驗證 chunk 切分後 wizard 仍能正常 lazy-load。

## 任務（拍板後拆 T 工單）

1. T-A：R3 處理 — 確認 indexBench.ts 用途 → 採選項 A/B/C
2. T-B：R5 setup-wizard chunk 切分 + 驗證

預估各 30 min。可一張工單合併做。

## 觸發點

- 任何時候有空 → 隨時可派
- 或下次 wizard 區域有大改動時順手做 R5
- 或下次有人 trip ESLint inline disable comment 時做 R3

## 不在範圍內

- R2 ESLint 守衛（已在 T0304 落地）
- R4 移除 `vite-plugin-electron-renderer` plugin（更大改動，需獨立評估）
- 其他 PLAN-007 / 016 衍生改善

## 關聯

- 來源：T0303 BUG-069 wider audit
- 對應決策：D090（Renderer 嚴禁 Node builtin import）
- 相關工單：T0304（BUG-069 fix，含 R2）

## 回報區

> （IDEA 階段，待拍板轉 PLANNED 後再填）
