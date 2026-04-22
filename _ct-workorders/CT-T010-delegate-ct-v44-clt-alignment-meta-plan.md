# 工單 CT-T010-delegate-ct-v44-clt-alignment-meta-plan

## 元資料

- **工單編號**:CT-T010
- **任務名稱**:【受派】在 BMad-Guide 建立 CT v4.4.x 主 PLAN + Phase 1-4 拆單骨架(CLT 對齊 6 項改良)
- **類型**:planning(DELEGATE, 跨專案, meta-PLAN + 工單骨架)
- **狀態**:🚚 DISPATCHED
- **建立時間**:2026-04-22 11:45 (UTC+8)
- **派發時間**:2026-04-22 11:46 (UTC+8) — 剪貼簿指令寫入,等使用者切 `D:/ForgejoGit/BMad-Guide/` 貼上
- **派發模式**:`--mode yolo`(Worker 自動 commit + 回報主 PLAN 編號 + 所有 Phase 工單編號)
- **預估工時**:45-60 min(純規劃,不實作)
- **優先級**:🟡 Medium(策略性改良,非急件)
- **Renew 次數**:0
- **關聯**:
  - **來源文件**:`D:/ForgejoGit/BMad-Guide/spec/Cognitive Load × Agent Orchestration:深度拆解與 Control Tower 對照.md`(~400 行,2026 Q1 Kuan-Yu Hsieh FB 長文的 CLT 深度拆解 × CT 對照分析)
  - **BAT 本地追蹤**:PLAN-028(💡 IDEA,等本工單完成後回填 CT-P### 進 PLANNED)
  - **前置**:CT-T009 v4.3.3 已 ship
  - **後續**:Cooperative consumer 對端 PLAN(待建,另案)

## 跨專案協調

- **協調類型**:DELEGATE
- **來源專案**:better-agent-terminal (`D:\ForgejoGit\BMad-Guide\better-agent-terminal\better-agent-terminal\`)
- **來源 context**:2026-04-22 本 session 討論 CLT 分析文件對 CT 的啟示。文件列出 6 項系統性改良建議 + 三專案分工(CT-skill 主導 / stable consumer dogfood #1 / aggressive consumer dogfood #2)。本工單在 CT skill 主 repo 建立 meta-PLAN + Phase 拆單骨架,後續 Phase 工單由該 repo 的塔台接手派發。
- **目標專案**:claude-control-tower(BMad-Guide monorepo,路徑依使用者本機 clone 位置)
- **目標 branch**:`dev-main`
- **建議輸出位置**:該 repo 的工單追蹤目錄(Worker 自行判斷 — 可能是 `_ct-workorders/` 或 skill repo 慣例位置;若不存在,建議建立 `_ct-workorders/` 依 CT v4.3.3 慣例)

---

## 背景

### CLT 分析文件六項改良建議(綜合對照表)

| # | 改良 | 落地層 | 對 dogfood consumer 影響 |
|---|------|--------|----------------------|
| 1 | 工單模板加 `intervention_type` metadata(fire-and-forget / context-dependent / decision-requiring)| CT skill template | 所有新工單填寫多一欄 |
| 2 | audit `_tower-state.md` 資訊密度 | Review-only | Consumer 的 state file 被 audit |
| 3 | 工單模板加 `affects_files` + 塔台 static overlap check | CT skill template + 塔台邏輯 | 平行工單派發前多一層檢查 |
| 4 | 工單模板加 `spec_level_check` 自問清單 | CT skill template | 工單模板加 checklist 區段 |
| 5 | audit `*evolve` 最近輸出 episodic/strategic 比例 + prompt 強化 distillation | `*evolve` skill | Consumer 的 learnings 品質提升 |
| 6 | `*evolve` 輸出拆 tactical / strategic 兩類歸檔 | `*evolve` skill + `_learnings.md` 格式 | 分類歸檔,不同用途分流 |

### 核心理論依據(Worker 可讀來源文件)

- **Filesystem = disk, Context window = RAM, LLM = stateless process** 是同構關係,不是比喻(CT 架構本質是小型 OS)
- **Strategic Memory ≠ Episodic Memory**:distilled causality 才算 strategic
- **Double-loop Learning 要質疑設計假設本身**,不只質疑執行方法

---

## Scope

### AC-1 — 在目標 repo 建立主 PLAN

**建議編號**:CT-P001(或依該 repo 編號規則)

**建議標題**:`CT v4.4.x — CLT 對齊 6 項系統性改良(meta-PLAN)`

**主 PLAN 必含內容**:
- 元資料(狀態 💡 IDEA、優先級 🟡 Medium、類型 技術改善 / 理論對齊)
- 動機 / 背景(引用來源 FB 文章作者 + 理論依據,**不具名個人**)
- 對齊決議(三專案分工、驗證分工、回饋機制)
- 六項改良綜合對照表(見上方「背景」段)
- 非目標 / 範圍外
- Phase 1-4 工單索引(AC-2 建立後回填)
- 結案條件

### AC-2 — 拆 Phase 1-4 工單骨架(不實作)

每個 Phase 建立對應工單,狀態 📋 TODO,**不執行 Phase 內容**。

#### Phase 1 — 快勝(audit-only,預估 ~2-3h wall)

| 工單建議 | 內容 | 預估 |
|---------|------|------|
| Phase 1 / T 單 #1 | audit `_tower-state.md` 資訊密度(跨 consumer 抽樣)| 30 min |
| Phase 1 / T 單 #2 | audit `*evolve` 最近 5-10 次輸出 episodic/strategic 比例(跨 consumer)| 30 min |
| Phase 1 / T 單 #3 | 工單模板加 `spec_level_check` 自問清單(四項勾選 section)| 30 min |

#### Phase 2 — 中等改良(skill template + `*evolve` prompt patch,預估 ~1 day)

| 工單建議 | 內容 | 預估 |
|---------|------|------|
| Phase 2 / T 單 #4 | 工單模板 v3.7 — `intervention_type` metadata(三分類 + 填寫指引)| ~3h |
| Phase 2 / T 單 #5 | 工單模板 v3.7 — `affects_files` 欄位 + 塔台派發前 overlap check 邏輯 | ~3h |
| Phase 2 / T 單 #6 | `*evolve` prompt 強化 distillation 步驟(episodic → strategic 轉換)| ~2h |

#### Phase 3 — 大改(`*evolve` 輸出格式重構,預估 ~1-2 days)

| 工單建議 | 內容 | 預估 |
|---------|------|------|
| Phase 3 / T 單 #7 | `*evolve` 輸出拆 tactical / strategic 兩類歸檔(含 `_learnings.md` 格式改版 + 歷史條目不 retrofit 原則)| ~1.5 days |

#### Phase 4 — Doctrine & Onboarding(預估 ~半天)

| 工單建議 | 內容 | 預估 |
|---------|------|------|
| Phase 4 / T 單 #8 | 寫「CT 設計依據」onboarding 文件(用 CLT 文件當骨架,加 CT 實際決策對應)| ~4h |

**總計**:~4-5 工作天 wall time。

### AC-3 — 主 PLAN 與 Phase 工單元資料完整性

- 每張工單必有:狀態、類型、優先級、預估工時、關聯(主 PLAN 編號)、AC 列表、驗收依據
- 跨工單依賴:後 Phase 工單的「前置」欄位正確指向前 Phase 結案
- Sanitize 規則(upstream,不得出現):
  - 特定個人姓名(Gower / Selene / 其他真名)
  - 本專案名「better-agent-terminal」/「BAT」/「2026_Cooperative」
  - 本 BAT 工單編號(PLAN-028、CT-T010 等)
  - 特定 commit SHA
  - LINE / FB / 特定社群平台名
- 通用描述替代:「stable consumer(dogfood verification site #1)」「aggressive consumer(dogfood verification site #2 + feedback source)」

### AC-4 — 跨專案 _cross-references.md(目標 repo 側)

若目標 repo 有 `_cross-references.md`(或類似跨專案參照機制)→ 追加條目,連結主 PLAN ↔ 兩個 consumer 的追蹤 PLAN。

若目標 repo 沒有此機制 → 不建立(CT skill repo 的規範由該 repo 維護者決定,本工單不擴大範圍)。

### AC-5 — Worker yolo commit + 回報

依 `--mode yolo`:
1. 完成 AC-1 ~ AC-4 所有骨架建立
2. 在目標 repo(BMad-Guide monorepo, branch `dev-main`)建立 commit:
   - 訊息格式:`chore(control-tower): CT-P### meta-PLAN — CLT 對齊 6 項改良 (Phase 1-4 骨架)`(或依該 repo commit 慣例)
3. **不執行**:tag、push、merge、release publish、Phase 內容實作
4. 回報結構:
   - 目標 repo commit hash
   - 主 PLAN 編號(供 BAT 側 PLAN-028 回填)
   - Phase 1-4 所有 T 單編號(清單)
   - `_cross-references.md` 狀態(新增 / 不適用)
   - 剩餘手動動作(tag + push 交 Gower,若有需要)

---

## Acceptance Criteria

- [ ] AC-1:主 PLAN 建立,內容涵蓋動機 / 對照表 / 分工 / 非目標 / Phase 索引 / 結案條件
- [ ] AC-2:Phase 1-4 全部 8 張工單骨架建立,狀態 📋 TODO,未實作內容
- [ ] AC-3:所有新單據元資料完整 + sanitize 規則達標(無個人 / 專案 / commit 特定資訊)
- [ ] AC-4:目標 repo 的跨專案參照機制正確處理(追加 or 合理跳過)
- [ ] AC-5:Worker yolo commit 完成 + 結構化回報

## 驗收依據

- **AC-1 spot-check**:塔台讀主 PLAN 檔,確認 6 大必含段落齊全
- **AC-2 工單計數**:Glob 目標 repo 工單目錄,確認 Phase 1-4 共 8 張新檔(3+3+1+1)
- **AC-3 sanitize**:`grep -rn -iE "selene|gower|better-agent-terminal|cooperative" <新建檔案>` 應為 0 筆
- **AC-4**:Worker 回報說明該 repo 是否有跨專案機制
- **AC-5 commit hash**:塔台 `git log --oneline -1` 於 BMad-Guide 驗證

## 待使用者手動動作(Worker 不做)

```bash
# 1. Review Worker 建立的主 PLAN + Phase 工單骨架
cd D:/ForgejoGit/BMad-Guide
git log --oneline -1                       # 確認 Worker 交付 hash
# 讀 Worker 回報的主 PLAN 編號 CT-P### + Phase 工單編號
# 判斷 scope / 拆法是否接受,必要時調整後 push

# 2. 若接受則 push(本工單只建立骨架,非 release,不 tag)
git push origin dev-main

# 3. 回 BAT 塔台:告知主 PLAN 編號,塔台會回填 PLAN-028 + _cross-references.md
```

## 風險與備註

- **風險 1**:Worker 誤以為要實作 Phase 內容 → AC-2 明寫「不實作」+ AC-5 明寫「不執行 Phase 內容」
- **風險 2**:Worker 把 BAT 工單編號或個人姓名寫進 upstream → AC-3 sanitize 規則 + 通用描述替代
- **風險 3**:目標 repo 無 `_ct-workorders/` 慣例 → AC-4 明示「該 repo 無機制則合理跳過,不擴大範圍」
- **風險 4**:Phase 拆太細或太粗 → 本工單提供「建議」拆法,Worker 可依 repo 上下文微調(最終決定權在該 repo 塔台)

---

## 回報區

### 完成狀態

(待 Worker 填寫)

### 產出摘要

(待 Worker 填寫)
- 目標 repo commit hash:
- 主 PLAN 編號:
- Phase 1-4 工單編號清單:
- `_cross-references.md` 處理:

### 剩餘手動動作(交 Gower)

(待 Worker 填寫)

### Renew 歷程

無。
