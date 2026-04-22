# PLAN-028 — BAT dogfood 驗證 CT v4.4.x(CLT 對齊 6 項改良)

| 欄位 | 內容 |
|------|------|
| **狀態** | 💡 IDEA(等 BMad-Guide 主 PLAN 建立後進 PLANNED)|
| **優先級** | 🟡 Medium |
| **類型** | 技術改善(dogfood 驗證 / skill 升級觀察)|
| **建立時間** | 2026-04-22 |
| **建立者** | Gower |
| **驅動契機** | Kuan-Yu Hsieh FB 長文(2026 Q1)的 Cognitive Load Theory 拆解 × CT 對照分析(~400 行,存於 `D:/ForgejoGit/BMad-Guide/spec/`)指出 CT 設計有 6 項可系統性改良空間。BAT 作為成熟 consumer 需驗證這批改良不破壞既有工作流。|
| **主導 Repo** | `BMad-Guide` monorepo(skill 主 repo,主 PLAN CT-P### 待建)|
| **本 PLAN 定位** | **跨專案追蹤** — 本地登記用,實際 skill 改動在 BMad-Guide|
| **關聯** | CLT 分析文件(BMad-Guide/spec/)、CT-T010 DELEGATE(待派,主 PLAN 建立工單)、PLAN-025(auto-session dogfood 前例)、L088(devcontainer 假設失誤,strategic memory 案例)|

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

(PLAN 進行中由塔台於此區更新)

---

## 結案紀錄

(DONE 或 DROPPED 時填寫)

**結案條件**:BMad-Guide 主 PLAN CT-P### 所有 Phase 完成且 BAT dogfood 驗證無 regression。
