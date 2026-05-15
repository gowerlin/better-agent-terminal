---
schema_version: 1
schema_kind: plan
id: PLAN-028
title: BAT dogfood 驗證 CT v4.4.x(CLT 對齊 6 項改良)
status: DONE
priority: medium
created_at: "2026-04-22T00:00:00+08:00"
---
# PLAN-028 — BAT dogfood 驗證 CT v4.4.x(CLT 對齊 6 項改良)

| 欄位 | 內容 |
|------|------|
| **狀態** | ✅ DONE 2026-04-26 — BAT 已透過 sessions 26-31 大規模 dogfood 驗證 CT v4.4.x:PLAN-007 23 工單一氣呵成、v0.4.0 + v0.4.1 雙 release GO、yolo 鏈式自主派發成熟、`*evolve` tactical/strategic 分類落地（GP076-080 + L103-107）;CLT 6 項改良在實戰中已內化,主 PLAN T0098 與 BMad-Guide 端 CT-T### 跟進結案 |
| **優先級** | 🟡 Medium |
| **類型** | 技術改善(dogfood 驗證 / skill 升級觀察 / **跨專案派發主導**)|
| **建立時間** | 2026-04-22 |
| **建立者** | Gower |
| **驅動契機** | Kuan-Yu Hsieh FB 長文(2026 Q1)的 Cognitive Load Theory 拆解 × CT 對照分析(~400 行,存於 `D:/ForgejoGit/BMad-Guide/spec/`)指出 CT 設計有 6 項可系統性改良空間。BAT 作為成熟 consumer 需驗證這批改良不破壞既有工作流。|
| **主導 Repo** | `BMad-Guide` monorepo(skill 主 repo)— **主 PLAN = T0098**(commit `e362ed1` @ `dev-main`,以 `類型:planning` 工單承載 meta-PLAN)|
| **本 PLAN 定位** | **跨專案追蹤 + 派發主導** — 本 CT 塔台(BAT 端)接手 Phase 1-4 派發,透過 CT-T### DELEGATE 工單推進 T0099-T0106;dogfood 驗證同步進行|
| **關聯** | CLT 分析文件(BMad-Guide/spec/)、CT-T010 ✅ DONE(主 PLAN + 8 張骨架交付)、T0098 主 PLAN、T0099-T0106 Phase 1-4 骨架、PLAN-025(auto-session dogfood 前例)、L088/L089(跨專案 DELEGATE 模式)、D074(BAT 接手 Phase 1-4 派發)|

---

## 動機 / 背景

### CLT 分析的 6 項改良建議(綜合對照表)

| # | 建議 | 落地層 | 對 BAT 的影響 |
|---|------|--------|--------------|
| 1 | 工單加 `intervention_type` metadata(fire-and-forget / context-dependent / decision-requiring)| CT skill template | 所有新工單模板改動 |
| 2 | audit `_tower-state.md` 資訊密度 | Review only | 本 repo tower-state 被 audit |
| 3 | 工單加 `affects_files` + 塔台 static overlap check | CT skill template + 塔台邏輯 | 平行工單派發前多一層檢查 |
| 4 | 工單加 `spec_level_check` 自問清單 | CT skill template | 工單模板加 checklist 區段 |
| 5 | audit `*evolve` 最近輸出 episodic/strategic 比例 + prompt 強化 distillation | `*evolve` skill | BAT 的 `_learnings.md` 觀察品質提升 |
| 6 | `*evolve` 輸出拆 tactical / strategic 兩類歸檔 | `*evolve` skill + `_learnings.md` 格式 | 分類歸檔,不同用途分流 |

### 三專案驗證分工

```
Control-Tower (BMad-Guide monorepo)     ←── 主導 (doctrine)
     │
     ├── 主 PLAN CT-P### — CT v4.4.x CLT 對齊
     │   拆 Phase 1-4 工單(audit / template patch / *evolve prompt / doctrine)
     │
     ├─→ BAT (穩定 dogfood)             ←── 驗證場 #1
     │   本 PLAN-028 追蹤
     │
     └─→ 2026_Cooperative (激進 dogfood) ←── 驗證場 #2 + 回饋源
           對端 PLAN 追蹤(需建立)
```

---

## 對齊決議(2026-04-22 本 session 討論)

| # | 決議 |
|---|------|
| 主導 repo | BMad-Guide monorepo(CT skill 主 repo)|
| 本地 PLAN 角色 | 跨專案追蹤 + dogfood 觀察記錄 |
| 驗證分工 | BAT(穩定)+ 2026_Cooperative(激進)平行驗證,任一 regression 就暫停 |
| 回饋機制 | 2026_Cooperative 的實驗觀察 → 回饋到 CT doctrine(double-loop 第二 loop)|

---

## 非目標 / 範圍外

- ❌ **不在本 repo 修改 skill** — 所有 skill 層改動應在 BMad-Guide repo
- ❌ **不直接影響 BAT 的執行時功能**(terminal / agent-manager 等)— 只影響塔台工作流與工單模板
- ❌ **不重寫 BAT 歷史工單**(往前的 T0001-T0228 不 retrofit 新 metadata)
- ❌ **不在本 PLAN 內做 CLT 理論延伸分析**(文件已在 `BMad-Guide/spec/`,本 PLAN 只做落地)

---

## BAT 這邊的工作項

等 BMad-Guide 主 PLAN 與各 Phase 工單建立後,BAT 本地進行:

### 準備階段

- [ ] 建立 `_cross-references.md`(若未建立),記錄 PLAN-028 ↔ CT-P### 關聯
- [ ] 等 BMad-Guide 主 PLAN CT-P### 建立後,把編號回填本 PLAN「主導 Repo」欄位

### dogfood 驗證階段(每個 CT skill 改動都做一輪)

針對每個 Phase 的 skill 改動:

- [ ] **Phase 1 audit** — BMad-Guide Worker 交付後,在本 repo 跑一次 `*sync` + `*evolve --status` 確認報表正確
- [ ] **Phase 2 template patch** — 下一張新工單用 v3.7 模板,觀察 `intervention_type` / `affects_files` / `spec_level_check` 三區段在本專案的實際貼合度
- [ ] **Phase 3 *evolve prompt 改進** — 本輪萃取後,比對改進前後的 distillation 品質
- [ ] **Phase 4 doctrine 文件** — 閱讀並回饋 Selene onboarding 筆記初稿

### 觀察記錄

每個 Phase 驗收時,記錄到本 PLAN 的「回報 / 決議紀錄」區:
- 是否破壞既有工作流?
- `intervention_type` 分類實際在本專案分布是什麼?
- `affects_files` 有實際被 overlap check 擋下過嗎?
- `*evolve` 輸出的 tactical/strategic 比例改進了多少?

---

## 回報 / 決議紀錄

### 2026-04-22 第十九 session — CT-T010 交付 + BAT 接手派發(D074)

**CT-T010 ✅ DONE**(yolo 模式自動交付,commit `e362ed1` @ BMad-Guide `dev-main`):
- 主 PLAN 編號:**T0098**(CT repo 未啟用 PLAN 系統,以 `類型:planning` 工單承載)
- Phase 1-4 骨架 8 張:
  - Phase 1(audit + 快勝):T0099 / T0100 / T0101
  - Phase 2(template v3.7 + evolve prompt):T0102 / T0103 / T0104
  - Phase 3(*evolve 輸出拆 tactical / strategic):T0105
  - Phase 4(CT 設計依據 doctrine):T0106
- 全部狀態 📋 TODO,內容未實作
- Sanitize:✅ 零 BAT 關鍵字洩漏
- CT repo `_cross-references.md`:無此機制,跳過(AC-4 合理)

**本輪決議(D074)**:本 CT 塔台(BAT 端)**接手 Phase 1-4 派發**,不交還 BMad-Guide 自行推進。
- 原因:BAT 已是 CT skill 的成熟 consumer,對 6 項改良的落地細節感最強;雙 loop(BAT dogfood + 2026_Cooperative 激進驗證)的第一 loop 就地承擔。
- 模式:以 CT-T### DELEGATE 工單逐張推進 T0099-T0106(BMad-Guide repo 的 worker 執行,BAT 塔台協調)。
- 派發順序:建議 Phase 1(audit,低風險熱身)→ Phase 2(template 改動,最高衝擊面)→ Phase 3 → Phase 4。

**下一步**:等 T0229 research(PLAN-027)回報後,評估是否先處理 PLAN-027 或先啟 Phase 1 派發。

---

## 結案紀錄

(DONE 或 DROPPED 時填寫)

**結案條件**:BMad-Guide 主 PLAN CT-P### 所有 Phase 完成且 BAT dogfood 驗證無 regression。
