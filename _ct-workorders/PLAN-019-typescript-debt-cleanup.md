# PLAN-019-typescript-debt-cleanup

## 元資料
- **編號**：PLAN-019
- **標題**：清理 fork 既有 TypeScript 技術債（`tsc --noEmit` ~20 errors）
- **狀態**：DONE
- **派發工單**：T0185(研究盤點)· T0186-T0191(6 張實作)
- **優先級**：🟢 Low
- **建立時間**：2026-04-18 07:35 (UTC+8)
- **完成時間**：2026-04-18 23:30 (UTC+8)
- **發現來源**：T0165 PARTIAL 回報區「遭遇問題 #1」
- **關聯**：T0165(升級時順帶發現)· BUG-042(移出範圍殘留 2 errors)· BUG-043(dogfood 連帶發現)

## 完成摘要

**實質成果**:`tsc --noEmit` 從 **133 → 2 errors**(減 131,僅保留 BUG-042 範圍 2 錯誤),**超原估 20 的 6.6 倍**但仍在 ~3h 內完成(實際 ~1.5h,0.5x 壓縮)。

### 工單拆解與成果

| 工單 | Cluster | 錯誤數 | 耗時 | commit |
|------|---------|-------|------|--------|
| T0185 | 研究盤點 | 133 → (分類) | 5 min | — |
| T0186 | Cluster 1 ElectronAPI types | 133 → 60 (-73) | 8 min | `987137b` |
| T0187 | Cluster 2 Domain types | 60 → 46 (-14, PARTIAL) | 7 min | `708af69` |
| T0188 | Cluster 3 null narrowing | 46 → 39 (-7) | 9 min | `766135c` |
| T0189 | Cluster 5 implicit any | 39 → 39 (no-op,Cluster 1/2 順帶清) | 2 min | `012a583` |
| T0190 | Cluster 4 unused symbols | 39 → 26 (-13) | 9 min | `0ab85d3` |
| T0191 | Cluster 6/7/8 收尾 | 26 → 2 (-24) | 10 min | `2956192` |

### 殘留 2 errors(已移出 PLAN-019 範圍)

- TerminalPanel.tsx:210, 385 呼叫不存在的 `markAgentCommandSent` / `markHasUserInput` store action
- 屬功能邏輯問題,非純型別債 → 另案 **BUG-042** 追蹤

### 順帶修真實 bug(超出原範圍)

- **UpdateNotification.tsx** line 30-35:`settings.load()` 回傳 JSON 字串但 component 當物件讀,推測是「檢查更新 toggle 似乎沒效果」的根因(T0191 commit `2956192`)
- **electron.d.ts** GitStatusEntry `path` → `file` key 修正(T0186 順帶修,對齊 handler 實際輸出)
- **claude.abortSession** 補齊 type 宣告(T0186 順帶修)

### *evolve 萃取

- **L070** 研究工單 Worker 規模爆擊暫停門檻未自主觸發(盤點 133 vs 估 ~20,超 6× 未 pause)
- **L071** 研究工單盤點路徑/欄位誤標(~5% 準確率缺口,如 `stores/sprint-status.ts` 應為 `types/sprint-status.ts`,namespace `.window` 應為 `.app`,Cluster 6 誤標 Zustand 實為 Promise<unknown>)
- **L072** 技術假設需驗證再寫入工單(如「Zustand store」推測,實際專案用自製輕量 observable)
- **GP 候選**:型別債清理的 cluster 順序應優先補「定義層」(ElectronAPI types / Domain types),後修「使用層」(implicit any / null narrowing)— T0189 no-op 實證 ~11 個 TS7006 零成本消失
- **GP042 Worker time 第 16 hit**:0.3-0.5x 壓縮係數累積實證

### 拆單路線圖實證

塔台建議「Cluster 優先 + 投報比排序」替代「按模組順序」成功:
- 先打 Cluster 1(49%)→ 一口氣消半壁江山
- Cluster 順序 1→2→3→5→4→6/7/8,實測**下游 cluster 隨上游修補自動收斂**(T0189 no-op)

## 描述

Fork 在執行 T0165 時，sub-session 跑 `tsc --noEmit` 發現約 20 個 TypeScript 錯誤，分布於：
- `ThumbnailBar`
- `UpdateNotification`
- `WorkspaceView`
- `main.tsx`
- 其他若干模組（待精確盤點）

**關鍵事實**：
- 這些錯誤**全數存在於 T0165 升級前**，與 effort level / SDK 升級無關
- Fork 的正式 build 流程是 `npx vite build`（不跑 tsc strict），build 流程**全綠**
- 因此不影響 runtime、不影響 release；純屬維護品質問題

## 為什麼 Low 優先

1. **不影響 build / runtime**：vite build 照過，產品可正常交付
2. **不阻塞任何功能**：新功能開發不會被這些既有錯誤卡住
3. **與 upstream 同步無關**：這些錯誤可能也存在於 upstream（繼承），或 fork 演進過程累積，與同步策略無直接影響

## 為什麼值得追蹤

1. **`tsc` 檢查失去價值**：若持續累積，`tsc --noEmit` 無法作為新變更的 regression 防護
2. **IDE 訊號雜訊**：開發時 IDE 會一直顯示這些錯誤，干擾判斷新引入的真錯誤
3. **潛在 bug 隱藏風險**：有些錯誤（如 any cast / missing type）可能遮蔽真 bug
4. **未來升級 TS / React 版本的阻力**：技術債愈深，升級愈痛

## 建議執行方式（實作階段再定）

選項 A：**一次清光**（2-4h）
- 逐檔修正，可能分批 commit
- 風險：改動範圍可能大，需搭配 smoke test

選項 B：**分模組清理**（每輪 0.5-1h）
- 每次清一個模組（如只清 ThumbnailBar），獨立 commit
- 風險低，但時程拉長

選項 C：**降低 strict 層級**（10 分鐘）
- 調整 tsconfig 放寬檢查
- 治標不治本，**不建議**

## 前置工作（實作前需先做）

- [ ] 精確盤點：列出所有 20+ 錯誤的 **檔案 / 錯誤類型 / 錯誤訊息摘要**
- [ ] 分類：真 bug / 型別不精確 / 第三方型別缺失 / 需要 `// @ts-expect-error` 的情境
- [ ] 評估各分類的處理成本
- [ ] 決定要走選項 A 還是 B

## 相關工單
（實作階段另開 T####）

## 備註

- **無時程壓力**：可長期掛在 backlog，等有空檔時清
- **可作為新手任務**：分模組清理是很好的 fork 熟悉過程
- **與 PLAN-015 思路類似**：技術債追蹤型 PLAN，非必要但值得做
