# BUG-044 — 塔台 CT Panel「包含封存」勾選無效（Bug Tracker + Backlog）

## 元資料
- **編號**:BUG-044
- **狀態**:🚫 CLOSED(複測通過)
- **嚴重度**:🟢 Low
- **建立時間**:2026-04-19 00:19 (UTC+8)
- **關閉時間**:2026-04-19 01:25 (UTC+8)
- **關閉依據**:T0194 根因定位 + T0196 實作修復（commit `bc37c71`），使用者複測勾 toggle UI 行為正確（含 35 張歸檔 BUG + 4 張歸檔 PLAN 顯示）
- **發現來源**:使用者回報（塔台 `*bug`）
- **關聯**:BUG-045（姊妹單,`*sync` parser 容錯）· T0194（研究）· T0196（實作）
- **可重現**:100%（fix 前）/ 0%（fix 後）
- **workaround**:（已不需要）

## 現象

CT Panel 塔台顯示層的 Bug Tracker 分頁與 Backlog 分頁皆有「包含封存」勾選（checkbox / toggle）。

**預期行為**:勾選後,清單同時顯示熱區 `_ct-workorders/BUG-*.md` / `PLAN-*.md` 與冷區 `_ct-workorders/_archive/bugs/` / `_archive/plans/` 的項目。

**實際行為**:勾選後 UI 沒變化,已封存項目仍不顯示。

## 調查範圍

兩個分頁都受影響,但 UI 實作可能共用同一個 hook 或元件,先定位主因再看要不要並修。

**盤點路徑建議**:
1. `src/components/CtPanel/` 或類似 CT 塔台面板目錄
2. `BugTracker` / `Backlog` 元件(命名推測,實際需 grep)
3. 讀檔邏輯:是否有 `includeArchived` / `showArchived` 類 prop/state
4. 歸檔目錄掃描:是否有 Glob `_archive/bugs/**` / `_archive/plans/**` 的呼叫

## 預期 vs 實際

| 項目 | 預期 | 實際 |
|------|------|------|
| Bug Tracker 勾選「包含封存」 | 顯示熱區 + `_archive/bugs/` 項目 | 只顯示熱區 |
| Backlog 勾選「包含封存」 | 顯示熱區 + `_archive/plans/` 項目 | 只顯示熱區 |

## 根因假設（三選一,待調查）

1. **Toggle 未接線**:UI 有 checkbox,但 state 沒傳到讀檔函式
2. **讀檔函式沒支援冷區**:`includeArchived=true` 時仍只 Glob 熱區
3. **歸檔檔案被過濾**:讀到了但被某個 filter 排除（如檔名 regex 不匹配 `_archive/` 路徑）

## 處理方向

修復工單預期包含:
1. grep 定位 checkbox 綁定的 state 與讀檔路徑
2. 確認 `includeArchived` 是否被傳遞
3. 補齊冷區 Glob（`_ct-workorders/_archive/bugs/**/*.md`、`_archive/plans/**/*.md`）
4. 驗收:勾選前後 UI 數量變化符合檔案系統實際計數

## 備註

- **姊妹單**:與 BUG-045（`*sync` parser 容錯 + DONE PLAN 未歸檔）一起修,修復工單可考慮合併一張 T####
- **不影響開發流程**:塔台 `*sync` 文字輸出與 `_bug-tracker.md` / `_backlog.md` markdown 檔皆正確,僅 UI 顯示層受影響
