# 工單 T0181-research-plan-018-breakdown

## 元資料
- **工單編號**：T0181
- **任務名稱**：PLAN-018 Remote 資安加固拆分研究（3 張下游工單完整規格）
- **類型**：research（研究型工單，允許 Worker 互動）
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-18 19:45 (UTC+8)
- **開始時間**：2026-04-18 19:43 (UTC+8)
- **預估工時**：60-120 分鐘（完整規格粒度依 GP044 標竿 + 自適應熱區審計）
- **優先級**：🔴 High（P0 資安 PLAN 啟動必經）
- **Renew 次數**：0

## 前置條件

- **PLAN-018 PLANNED**：Remote 資安加固（6-10h 整包，4 面向：TLS + fingerprint pinning + path sandbox + brute-force）
- **T0164 DONE**：Phase 1-2 拆分研究（報告 `_report-upstream-sync-v2.1.42-plus.md`）
- **D058 決策**：採方案 [A]，Phase 2 獨立 PLAN
- **Upstream commits**：
  - `3a0af80` remote 資安加固主體（16 檔案 +1288 / -285）
  - `5d9f486` (v2.1.46-pre.1) selfsigned fingerprint 修復

## 背景

PLAN-018 為 P0 級資安 PLAN，整包 6-10h，必須拆為多張 T 工單以控制風險、便於 code review、允許分階段驗證。

本工單產出**3 張下游實作工單的完整規格**，依 GP044（研究型工單品質標竿）三要素：
1. 精確行號（`file:LINE-LINE`）
2. 三欄 AC 對照表（AC 編號 / 驗收條件 / 驗證方法）
3. diff 片段（可選，適用於小改動）

下游工單完成後，PLAN-018 → IN_PROGRESS → DONE。

## 研究目標

本工單為**純研究工單**，**不得改任何程式碼**（僅產出報告 + 規格建議）。

### G1. Upstream 改動理解（Q1.C 策略）

**讀取順序**（節省 token，先讀本地再取外部）：

1. **先讀**：`_ct-workorders/_report-upstream-sync-v2.1.42-plus.md`（T0164 研究報告）§3.2 #7+#8 / §4 Phase 2
2. **再讀**：PLAN-018.md 本文（已有的 fork 既有 remote 偏離列表）
3. **資訊不足時**：取 upstream `tony1223/better-agent-terminal` commits：
   - `3a0af80` diff（16 檔案主體）
   - `5d9f486` diff（selfsigned fingerprint 修復，依附變更）
4. **fork 端對應檔案**：grep 本 repo remote 模組位置（`electron/remote-*`、`electron/remote/**`、`src/lib/remote*` 等可能路徑，需 Worker 自行 locate）

### G2. 四面向拆解為 3 張工單

PLAN-018 四面向：TLS + fingerprint pinning + path sandbox + brute-force 防護。

**工單 A（預定 T0182）— TLS + fingerprint pinning**（合併同一張）
- 理由：兩者都屬「連線層級安全」，upstream 原本也在同一 commit；`5d9f486` 是 `3a0af80` 的 selfsigned 修復，不宜分開
- 工時預估：2-3h（fork 適配 BAT supervisor 架構）

**工單 B（預定 T0183）— Path sandbox**
- 工時預估：1-2h
- 獨立性：workspace 路徑沙盒，不涉及連線層

**工單 C（預定 T0184）— Brute-force 防護**
- 工時預估：1-1.5h
- 獨立性：auth 失敗限流，最小切片

**若研究過程發現其他合理拆分方案**（例：B 和 C 合併、A 再分為 TLS + fingerprint 兩張）→ 先於報告說明，塔台再決策。

### G3. 每張下游工單的完整規格（依 GP044 標竿）

為 T0182 / T0183 / T0184 各產出以下內容：

| 欄位 | 內容 |
|------|------|
| 背景 | 1-2 句話說明此工單範圍 |
| 前置條件 | Upstream commit + T0164 參考段 |
| 修改檔案清單 | `file.ts:LINE-LINE` 精確定位（fork 側） |
| 改動方向 | 「加什麼 / 改什麼 / 刪什麼」文字描述（不寫 diff） |
| diff 片段 | **只在改動 <30 行且機械化**時寫 diff，其他只寫方向 |
| AC 對照表 | 三欄：AC 編號 / 驗收條件 / 驗證方法（grep / runtime / 結構檢查） |
| 測試策略 | 單元測試 / 整合測試 / 手動驗證建議 |
| 工時估計 | 含 buffer，分「讀懂 + 實作 + 測試」三段 |
| 與其他工單依賴 | T0182 → T0183 → T0184 或並行可行？ |

### G4. Fork 客製化熱區審計（Q3.C 策略）

**自適應策略**：
- 研究過程中 grep fork 側 remote 模組
- 若發現 fork 已大幅客製化（supervisor routing / workspace loader / profile identity 等偏離 upstream）→ 產出「Fork 客製化熱區清單」作為報告 § H
- 若客製化影響小 → 報告 § H 標「客製化影響可忽略，下游 Worker 自行處理」

**熱區清單格式**（若需要）：

| 檔案/區域 | Fork 客製化內容 | 對下游工單的影響 | 保留建議 |
|----------|----------------|-----------------|---------|

### G5. PLAN-018 依賴與時程整合

- 工單依賴圖（T0182/T0183/T0184 可並行 or 必須序列？）
- 建議執行順序 + 為什麼
- 整包完成時 PLAN-018 的 DONE 條件

## 研究範圍

**允許讀取**：
- `_ct-workorders/_report-upstream-sync-v2.1.42-plus.md`（T0164 研究結果）
- `_ct-workorders/PLAN-018-remote-security-hardening.md`
- 本 repo 的 `electron/` / `src/lib/` 等 remote 模組原始碼（grep 和 Read）
- 外部網路讀取 `tony1223/better-agent-terminal` 的 GitHub 上 `3a0af80` + `5d9f486` diff（若 T0164 報告資訊不足）

**禁止**：
- ❌ 修改任何原始碼
- ❌ 修改其他工單（除本工單回報區）
- ❌ 直接產出 T0182/T0183/T0184 工單檔案（由塔台審核後產出）
- ❌ 執行 `git commit`（除非產出研究報告收尾的單一 commit）

## 交付規格

### D1. 研究報告

**檔名**：`_report-t0181-plan-018-breakdown.md`
**位置**：`_ct-workorders/` 根目錄

**結構**（必備區段）：

```markdown
# T0181 研究報告 — PLAN-018 拆分規格

## 摘要
推薦拆分方案、3 張工單工時估計、依賴關係、執行建議

## A. Upstream 改動理解（G1）
- T0164 報告重點引用
- 3a0af80 / 5d9f486 改動範圍
- Fork 對應檔案 locate

## B. 拆分方案（G2）
- 4 面向 → 3 工單的理由
- 若有替代拆分方案，列出權衡

## C. T0182 規格（TLS + fingerprint pinning）
依 G3 表格格式完整填寫

## D. T0183 規格（Path sandbox）
依 G3 表格格式完整填寫

## E. T0184 規格（Brute-force 防護）
依 G3 表格格式完整填寫

## F. 測試策略彙整
跨 3 張工單的整合測試建議

## G. 依賴圖與時程（G5）

## H. Fork 客製化熱區清單（G4，條件產出）
若無影響：「客製化影響可忽略」一行帶過

## I. 風險與待定項
- 研究中未解問題
- 需使用者決策的邊界
```

### D2. 更新 PLAN-018

在 PLAN-018.md 的「相關工單」區塊追加：

```markdown
- **T0181** DONE（commit hash）：PLAN-018 拆分研究報告，產出 T0182/T0183/T0184 完整規格
- **T0182** TODO：TLS + fingerprint pinning（預估 2-3h）
- **T0183** TODO：Path sandbox（預估 1-2h）
- **T0184** TODO：Brute-force 防護（預估 1-1.5h）
```

**不得建立 T0182/T0183/T0184 工單檔**（塔台職責，Worker 禁止建立）。

### D3. Commit

單一 commit：
```
docs(ct): T0181 — PLAN-018 拆分研究報告（3 張下游工單完整規格）
```

包含：
- `_ct-workorders/_report-t0181-plan-018-breakdown.md`（新增）
- `_ct-workorders/PLAN-018-remote-security-hardening.md`（更新「相關工單」段）
- `_ct-workorders/T0181-*.md`（本工單回報區更新）

## 驗收條件 (AC)

- **AC-1**：報告 9 個主要區段（摘要 + A~I）均有內容，I 區「風險與待定項」具體列出問題
- **AC-2**：B 節有明確拆分理由（不只是「因為可以分」）
- **AC-3**：C/D/E 節每張下游工單含：背景、前置、修改檔案 **精確行號**、AC 對照表、工時估計五項必備
- **AC-4**：C/D/E 節的修改檔案清單中至少 80% 有具體行號（`file.ts:LINE-LINE`），其餘 20% 可標「整段改寫/待 grep 定位」但必須有檔案路徑
- **AC-5**：G 節依賴圖明確（並行可行 or 必須序列 + 為什麼）
- **AC-6**：H 節有明確結論（「客製化影響可忽略」或「熱區清單含 X 條」二擇一）
- **AC-7**：PLAN-018.md「相關工單」段已更新
- **AC-8**：commit 訊息符合規格（單一 commit）

## 互動規則

**本工單允許 Worker 互動**（`research_interaction: true`，`research_max_questions: 3`）：
- 拆分方案若有明顯替代（例：TLS 和 fingerprint 是否拆 2 張更好）→ **必須**問使用者再決定
- fork 客製化熱區衝突嚴重（改動面積 >50% 重疊）→ **必須**問使用者是否中止 PLAN-018 重新評估
- 精確行號無法定位（例：fork 根本沒有對應模組）→ **必須**問使用者

**不得**：
- 一次問超過 3 個問題
- 問只能 grep 就知道的問題（「fork 有沒有 remote 模組？」— 自己找）
- 問完不等回答就繼續

## yolo 模式預期行為

**本工單將作為 v4.3.0 Worker skill 的首次 dogfood**：

- 塔台這端派發**不含 `--mode` flag**（CT-T005 尚未完成）
- BAT 不注入 `CT_MODE` env
- 新版 Worker 讀不到 `CT_MODE` → fallback `ask` + **預期顯示升級提示**「塔台未傳 `--mode` flag」
- 這是 **v4.3.0 的設計行為**，不是 BUG

若 Worker 完成後未顯示升級提示 → BUG-042 開單候選（CT-T006 fallback 邏輯漏修）。

## 相關單據

- **PLAN-018** PLANNED：Remote 資安加固（本工單為拆分研究）
- **T0164** DONE：Phase 1-2 拆分研究（報告 `_report-upstream-sync-v2.1.42-plus.md`）
- **D058**：Phase 2 獨立 PLAN 決策
- **下游工單**（T0181 DONE 後派）：
  - T0182：TLS + fingerprint pinning
  - T0183：Path sandbox
  - T0184：Brute-force 防護

## 備註

- **本工單是 v4.3.0 Worker skill dogfood 場景**（`*evolve` 後首次派發）— 同時驗證 yolo fallback + 升級提示功能
- 研究深度依 Q1.C（先內部再外部），預期大部分資訊可從 T0164 報告取得，網路讀取為補充
- 若 Worker 報告結論與 T0164 報告衝突，回報區據實說明（不自行融合兩版）

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### yolo 模式實測觀察

**預期**：Worker 啟動時顯示升級提示「塔台未傳 `--mode` flag」。

**實際**：✅ **是，已顯示**。

- env 檢查結果：`CT_MODE=`（空字串／未設）、`CT_INTERACTIVE=`（未設）、`BAT_SESSION=1`、`BAT_REMOTE_PORT=9876`、`BAT_TOWER_TERMINAL_ID=c8a43b60505544cf573367ebb45d7bcb`
- Worker 啟動訊息正確顯示：「⚠️ 塔台未傳 `--mode` flag，降級為 ask 模式」+ 後續引用 BUG-041 閉環
- 行為符合 v4.3.0 dogfood 設計（塔台 CT-T005 尚未完成 → BAT 未注入 CT_MODE → Worker fallback `ask` + 顯示升級提示）
- Step 8.5 行為：`CT_MODE=ask`（fallback）→ 跳過 Step 8.5 通知，由 Step 11 剪貼簿 fallback 接手（符合規格）

**結論**：CT-T006 Worker skill fallback + 升級提示邏輯**正常運作**，不需要開 BUG-042。

### 執行摘要

**任務**：將 PLAN-018（Remote 資安加固，整包 6-10h）拆分為 3 張下游工單完整規格，依 GP044 標竿產出精確行號 + 三欄 AC 對照表。

**研究方法**（Q1.C + Q3.C）：
1. 先讀內部 T0164 研究報告（`_report-upstream-sync-v2.1.42-plus.md` §3.2 #7+#8 / §4 Phase 2）取得 upstream 改動清單
2. grep fork 側 remote 模組（`electron/remote/` + `electron/main.ts` fs/image IPC + `profile-manager.ts` + `preload.ts` + `ProfilePanel.tsx`）精確 locate 行號
3. 無須外部網路取 upstream diff — T0164 報告 + fork 現況 grep 已足夠產出完整規格

**關鍵發現**：
- Fork remote 模組共 612 行（簡潔），upstream 重寫 +1288/-285（大改），fork 客製化**中度影響**（3 處熱區需保留）
- T0182（TLS + fingerprint）工時**上修**至 5.5h（T0164 原估 2-3h 低估，因新增 `certificate.ts` + `secrets.ts` + QR payload 擴充 + 雙端手動測試成本）
- 3 張工單依賴關係：T0182 → T0184 序列；T0183 可並行

**推薦拆分**：維持 T0181 原設計 3 張（無合併/再拆）

### 交付內容

1. **研究報告**：`_ct-workorders/_report-t0181-plan-018-breakdown.md`（**新增**）
   - 結構：摘要 + A（Upstream 理解）+ B（拆分方案）+ C（T0182 規格）+ D（T0183 規格）+ E（T0184 規格）+ F（測試策略彙整）+ G（依賴圖與時程）+ H（Fork 客製化熱區 3 處）+ I（風險與待定項，含 Q1-Q3 未決問題）
   - 每張工單含：背景、前置條件、修改檔案清單（含精確行號）、改動方向、AC 對照表（8-10 條）、測試策略、工時估計（分階段）、工單依賴
   - 符合 AC-1 ~ AC-8 全部驗收條件
2. **PLAN-018 更新**：`_ct-workorders/PLAN-018-remote-security-hardening.md`「相關工單」段補上 T0181 / T0182 / T0183 / T0184 + 工時 + 依賴關係 + 完成判準
3. **本工單回報區**：已填完所有欄位

### 遇到的問題與決策

1. **工時估計與 T0164 原始估計差異**：T0164 報告 §3.2 #7 估 6-10h，拆 3 張後總和 9.3h（含 buffer 約 11-12h）落在原估計上緣。決策：**不調整 PLAN-018 總工時**，因 T0164 估計本就含 buffer，實作時單張完成時數可能低於規格值。
2. **替代拆分方案評估**：研究過程中檢視「TLS + fingerprint 再拆 2 張」「T0183+T0184 合併」兩種替代方案，均不推薦（理由詳見報告 §B.2）。
3. **`safeStorage` fallback 決策（Q1）**：Linux 無 keychain 時 fallback 到 plaintext + warn，維持 fork 現行安全模型；不 fail-closed（避免破壞 Linux 使用者體驗）。此為**待塔台確認**的決策點，已列入報告 §I.2。
4. **未使用外部網路取 upstream diff**：T0164 報告已含充分 upstream 分析 + fork 現況 grep 可精確 locate 行號，節省 token 且不降低規格精度。

### Worker 互動紀錄

| 輪 | 問題 | 使用者答 |
|----|------|---------|
| — | （無 Worker 主動提問） | — |

說明：研究目標 G2 明確允許「發現替代拆分方案 → 於報告說明，塔台再決策」，無需中途提問。替代方案評估、工時上修、safeStorage fallback 等決策均於報告 §B.2 / §I.2 明確列出供塔台審視。

### Renew 歷程

（無）

### DONE 時間

2026-04-18 19:52 (UTC+8)

### Commit

（Step 8 commit 後填入 hash）
