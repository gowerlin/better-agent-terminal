---
schema_version: 1
schema_kind: plan
id: PLAN-030
title: ProfilePanel + Setup Wizard UI 整體改善（套用 BUG Report stepper 視覺語言）
status: DONE
priority: high
completed_at: "2026-04-27T00:04:00+08:00"
---
# PLAN-030 — ProfilePanel + Setup Wizard UI 整體改善（套用 BUG Report stepper 視覺語言）

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-030 |
| 標題 | ProfilePanel 工具列群組化 + Setup Wizard 視覺重設計，建立統一 stepper 視覺語言 |
| 優先級 | 🔴 High |
| 類型 | 技術改善 + 架構調整（塔台協調 Worker 設計） |
| 狀態 | ✅ DONE — 2026-04-27 00:04 全案閉環（T0305→T0306→T0307+T0307b→T0308→T0309→T0310，6 工單 + 1 補丁，~50 min Worker wall） |
| 建立時間 | 2026-04-26 22:?? (UTC+8) |
| 完成時間 | 2026-04-27 00:04 (UTC+8) |
| 啟動工單 | T0305（research，Phase A 盤點 + Phase B 設計 spike + Phase C 拆單建議） |
| 收斂工單 | T0306 (BUG-070 fix → VERIFY) / T0307 (Stepper) / T0307b (vitest infra) / T0308 (BugWorkflowIndicator refactor) / T0309 (Setup Wizard + PLAN-029 R5 merged) / T0310 (design language docs) |
| 累計 unit tests | 47 cases all green |
| 收斂 BUG | BUG-070 → 🧪 VERIFY (T0306 commit `014da72`)，等使用者實機驗收 |
| 副效果 | PLAN-029 R5 (setup-wizard chunk 切分) 已由 T0309 順帶完成 |
| 來源 | v0.4.1 release dogfood — BUG-070 + Setup Wizard UX 痛點同時暴露 |
| 收斂 | BUG-070（Profile Dialog Add 按鈕橫向溢出）由本 PLAN 統一處理 |
| 相關 PLAN | PLAN-007（Remote Server Support，引入 WSL/Docker/SSH 觸發 ProfilePanel 溢出）、PLAN-029（renderer hardening R5 setup-wizard chunk 切分，可同步處理） |

## 動機

v0.4.1 release 後 dogfood 同時暴露兩個並行 UI 痛點，且發現現有 BUG Report 視覺語言（status stepper）成熟可作為設計基準：

### 痛點 A：ProfilePanel 工具列橫向溢出（BUG-070）

- Dialog 固定寬度，PLAN-007 Phase 2-4 累積 +WSL / +Docker / +SSH 後工具列被裁切
- 最右側按鈕完全無法觸及（Workaround: ❌ 無）
- 隨未來 profile 類型擴充（PLAN-014 等）只會更糟

### 痛點 B：Setup Wizard 視覺粗糙

參考 screenshot #3（Add SSH Profile Setup Wizard）：

| 問題 | 具體表現 |
|------|---------|
| Step ID 直接外露 | `configure-ssh-host` / `verify-ssh-auth` / `install-server-bundle` 等技術 ID 對使用者沒意義 |
| 失敗狀態散亂 | ❌ 圖示 + 紅字訊息 + `failed` 狀態文字三個元素分散，缺整合 |
| 缺進度視覺引導 | 純垂直 list，沒有 step indicator、沒有當前 step 高亮、沒有可點擊回到已完成 step |
| 訊息層級不清 | step 名稱 / step ID / 狀態描述 / 錯誤訊息混在一起 |
| 0% complete 過於原始 | 純文字百分比，沒視覺進度條 |

### 設計參考：BUG Report stepper（screenshot #4）

成熟可複用的視覺語言：
- Horizontal pill stepper（OPEN → FIXING → FIXED → VERIFY → CLOSED）
- 每 pill 含圖示 + 中文 label
- 當前狀態高亮（icon + label 變色）
- 底部單行說明文字（如「Worker 修復中，等待 commit 完成回報」）

## 範圍

### R1：抽出共用 Stepper 元件

設計 + 實作 `<HorizontalStepper>` 與（可能的）`<VerticalStepper>` / `<DropdownStepper>` 共用元件。

待 Worker 設計探索的問題：
- 是否該抽單一通用元件還是兩個專用元件？
- TS prop schema 設計（含狀態機、自訂 icon、可點擊回退等）
- 動畫策略（CSS-only vs framer-motion vs 既有 lib）
- 與既有 design system tokens 對齊

### R2：ProfilePanel 群組化下拉重構

主工具列保留高頻：`儲存目前狀態` / `+ 本機` / `+ 遠端` / `+ ▼`
群組化下拉：WSL Profile / Docker Profile / SSH Profile（未來擴充也進這裡）

待 Worker 設計探索的問題：
- 下拉選單套用既有「新增 Agent」模式（screenshot #2）還是設計新的？
- 下拉是否該分區（如「容器類」/「遠端類」/「實驗類」）？
- 主按鈕標籤要 `+` / `+ 進階` / `+ 更多` 哪個？

### R3：Setup Wizard 重設計

套用 stepper 視覺語言，隱藏技術 ID，分階段顯示。

待 Worker 設計探索的問題：
- Horizontal stepper 對 6+ steps 是否會太擁擠（SSH wizard 有 6 步）？
- 失敗 step 的恢復路徑視覺呈現（重試 / 跳過 / 編輯設定）
- step 群組化（如 SSH wizard 可分「連線」/「安裝」/「驗證」三大階段）
- 是否該允許使用者點 step 跳轉檢視（read-only）

### R4：設計規範文件

由 Worker 整理「BAT UI Stepper 視覺語言」規範文件，未來 `*fieldguide design` 子命令可直接萃取。

範圍：
- Stepper 元件 API 文件
- 狀態-視覺對應表（OPEN/FIXING/FIXED/VERIFY/CLOSED 配色與圖示）
- 訊息層級規範（標題 / 描述 / 狀態 / 錯誤）
- ID 隱藏原則（內部 ID 永不出現在 UI）

## 拍板結論（T0305 研究後定案，2026-04-26 22:30）

使用者全採塔台建議：

1. **拆單時序**：#3 (BUG-070 衝刺) → #1+#2 並行 → #4 大宗 → #5+#6
2. **#4 維持單張 L**（不拆子工單，視覺一致性必須一次完成）
3. **元件命名**：`<Stepper>` + CSS prefix `.bat-stepper-*`
4. **PLAN-029 R5 整合**：合併到 #4（同一改動範圍）
5. **CSS Token**：沿用既有 hex，後續另開 design token 治理 PLAN

### 落地工單對照（Phase C 拆單建議改 T0305 為唯一前置 research）

| # | 工單編號 | 目的 | 規模 | 依賴 |
|---|---------|------|------|------|
| 3 | T0306 | ProfilePanel 群組化下拉（reuse `.thumbnail-add-menu` + 分區 class）— 收斂 BUG-070 | S-M | — |
| 1 | T0307 | 共用 `<Stepper>` 元件抽出 + tests + a11y | M | — |
| 2 | T0308 | BugWorkflowIndicator refactor 內化到 `<Stepper>` + 視覺回歸 | S | T0307 |
| 4 | T0309 | Setup Wizard vertical stepper 重設計（含 PLAN-029 R5 chunk 切分 + 3 wizard 全套用 + jumpToStep API） | L | T0307 |
| 5 | T0310 | 設計規範文件 `docs/design/bat-stepper-design-language.md` | S | T0307/T0308/T0309 |

> 落地順序：T0306 獨立先發（不卡其他）→ T0307+T0308 並行 → T0309 大宗 → T0310

## 原始拆分建議（待研究工單收斂後定案）

預期 4-6 張工單：

| # | 類型 | 工單目的 | 依賴 |
|---|------|---------|------|
| 1 | research | Worker 設計探索：Stepper 元件 API / Wizard 視覺重設計 / 共用語言對齊 | 起手 |
| 2 | impl | R1 共用 Stepper 元件抽出 + unit tests | #1 |
| 3 | impl | R2 ProfilePanel 群組化下拉（收斂 BUG-070） | #2 |
| 4 | impl | R3 Setup Wizard stepper 化（含 6 個 wizard 全部套用） | #2 |
| 5 | docs | R4 設計規範文件 | #2-4 |
| 6 | (optional) | 與 PLAN-029 R5 setup-wizard chunk 切分整合 | #4 |

## 不在範圍

- ProfilePanel 內部 profile card 視覺改善（另案）
- Setup Wizard 後端 step 邏輯重構（純前端 UI）
- 跨平台適配（暫只考慮現有 Electron desktop）

## 後續處理

塔台建議：
1. 立刻派**研究工單**（T####，type: research）給 Worker 探索 R1/R2/R3 設計方向
2. 研究結論回報後，塔台拍板拆 4-6 張實作工單
3. BUG-070 維持 OPEN 狀態，由本 PLAN 統一收斂；本 PLAN 落地後 BUG-070 → CLOSED

## 連結

- BUG-070：[BUG-070-profile-dialog-add-buttons-overflow.md](BUG-070-profile-dialog-add-buttons-overflow.md)
- PLAN-007（觸發來源）：[PLAN-007-remote-container-dev-support.md](PLAN-007-remote-container-dev-support.md)
- PLAN-029（可能整合）：[PLAN-029-renderer-hardening-r3-r5-from-bug069-audit.md](PLAN-029-renderer-hardening-r3-r5-from-bug069-audit.md)
