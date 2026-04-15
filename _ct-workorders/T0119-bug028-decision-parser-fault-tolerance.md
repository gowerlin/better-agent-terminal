# 工單 T0119-bug028-decision-parser-fault-tolerance

## 元資料
- **工單編號**：T0119
- **任務名稱**：BUG-028 修復：決策日誌 Parser 支援 v3+v4 雙格式 + 容錯
- **狀態**：FIXED
- **建立時間**：2026-04-15 21:30 (UTC+8)
- **開始時間**：2026-04-15 21:45 (UTC+8)
- **完成時間**：2026-04-16 00:32 (UTC+8)
- **關聯 BUG**：BUG-028

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：低（單一元件修復）
- **降級策略**：無需降級

## Session 建議
- **建議類型**：🆕 新 Session
- **原因**：需讀取和修改 renderer 端 Parser 程式碼

## 任務指令

### 前置條件
需載入的文件清單：
- 本工單（完整閱讀）
- CT 面板決策頁籤相關元件（DecisionLogView 或同等）
- 決策日誌 Parser（解析 `_decision-log.md` 的模組）

### 輸入上下文

**問題**：CT 面板「決策」頁籤在使用 v4 格式的專案中，只顯示 D### ID，沒有標題/日期/摘要。

**根因**：決策日誌 Parser 只認 v3 格式，無法解析 v4 格式。

**兩種格式對照**：

#### v3 格式（BAT 專案，手動遷移產出）
```markdown
## 決策索引
| ID | 日期 | 標題 | 相關工單 |
|----|------|------|---------|
| D029 | 2026-04-12 | BUG 狀態流新增 VERIFY 中間態 | T0065 |

## 決策紀錄（降序，最新在上）

### D031 2026-04-13 — PLAN-008 Phase 2 可配置參數
- **背景**：...
- **決定**：...
- **相關工單**：T0109
```

特徵：
- 索引表欄位：`ID | 日期 | 標題 | 相關工單`
- 紀錄標題：`### D### YYYY-MM-DD — Title`（h3 + 日期 + em dash + 標題）
- 內容用 `- **背景**：` / `- **決定**：` 格式

#### v4 格式（Gogoro 專案，Control Tower v4 正式產生）
```markdown
## 索引
| ID | 時間 | 摘要 | 背景 |
|----|------|------|------|
| D001 | 2026-04-15 11:58 | 啟用全部 v4 功能 | 首次啟動... |

## D001：啟用全部 v4 功能
**時間**：2026-04-15 11:58 (UTC+8)
**決策**：首次啟動時啟用全部 6 項 v4 可升級功能
**背景**：...
**選項**：
- [A] 全部啟用 ← **選定**
**影響**：...
```

特徵：
- 索引表欄位：`ID | 時間 | 摘要 | 背景`
- 紀錄標題：`## D###：Title`（h2 + 全形冒號 + 標題，無日期）
- 日期在 body 中：`**時間**：YYYY-MM-DD HH:MM (UTC+8)`
- 內容用 `**決策**：` / `**背景**：` / `**選項**：` / `**影響**：` 格式

### 預期產出
- 修改後的 Decision Parser，能同時解析 v3 和 v4 格式
- 解析失敗時的 fallback 行為（至少顯示原文）

### 驗收條件
- [ ] v3 格式（BAT 專案）決策列表正常顯示 ID + 標題 + 日期
- [ ] v4 格式（Gogoro 專案）決策列表正常顯示 ID + 標題 + 日期
- [ ] 未知格式的決策條目：fallback 顯示原始文字，不靜默吞掉
- [ ] 展開決策詳情時正確顯示完整內容
- [ ] `npx vite build` 編譯通過

## Sub-session 執行指示

> **重要**：請在開始工作前，將「開始時間」填入當前時間。
> 完成後請填寫「回報區」。無論成功、失敗或需要後續指示，都必須填寫。

### 執行步驟
1. 讀取本工單全部內容
2. 更新「開始時間」欄位
3. 找到決策日誌 Parser 模組（搜尋 DecisionLog、parseDecision 等關鍵字）
4. 分析現有解析邏輯，確認只支援 v3 格式
5. 擴展 Parser 支援 v4 格式：
   - 標題行：同時匹配 `### D### date — title` 和 `## D###：title`
   - 索引表：同時匹配兩種欄位名
   - 日期提取：從標題行或 body `**時間**：` 欄位提取
6. 加入 fallback：解析失敗時保留原始文字作為 title
7. 用 BAT 專案的 `_decision-log.md` 測試 v3 格式
8. 用 Gogoro 專案的 `_decision-log.md` 測試 v4 格式
9. `npx vite build` 確認編譯通過
10. 填寫回報區，git commit

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
FIXED

### 產出摘要
修改檔案：
- `src/types/decision-log.ts` — 擴展 `parseDecisionLog` 支援 v3+v4 雙格式：
  - 索引表新增 `時間`（v4 日期欄）和 `摘要`（v4 標題欄）欄位別名
  - 新增 `parseFromHeadings` fallback：索引表解析失敗時從 heading 行提取
  - 支援 v3 heading `### D### YYYY-MM-DD — Title` 和 v4 heading `## D###：Title`
  - 新增 `extractDateFromBody`：從 v4 body 的 `**時間**：` 欄位提取日期
- `src/components/DecisionsView.tsx` — 擴展 `extractDecisionDetail`：
  - 匹配 `## D###`（v4 h2）和 `### D###`（v3 h3）雙格式
  - 自動偵測 heading level，正確判定 block 結束位置

### 互動紀錄
無

### Renew 歷程
無

### 遭遇問題
無

### sprint-status.yaml 已更新
不適用

### 回報時間
2026-04-16 00:32 (UTC+8)
