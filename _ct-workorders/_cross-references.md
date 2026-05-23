# Cross-Project References

> 記錄本專案(better-agent-terminal)與其他專案的工單/PLAN/文件關聯。
> 首建:2026-04-22(PLAN-028 觸發)

## 跨專案 PLAN 對照表

| 本專案 ID | 對方 Repo | 對方 ID | 關係 | 狀態 |
|----------|----------|---------|------|------|
| PLAN-028 | BMad-Guide | **T0098**(planning 工單承載 meta-PLAN)| BAT = dogfood 驗證場 #1 + **接手 Phase 1-4 派發**,T0098 = 主 PLAN | 📐 PLANNED |

## 跨專案工單對照表

| 本專案 ID | 對方 Repo | 對方 Commit | 類型 | 狀態 |
|----------|----------|------------|------|------|
| CT-T008 | BMad-Guide | `61dec10` | DELEGATE(v4.3.2 release)| ✅ DONE |
| CT-T009 | BMad-Guide | `2b1dd1c` | DELEGATE(v4.3.3 JB Gateway patch)| ✅ DONE |
| CT-T010 | BMad-Guide | `e362ed1` | DELEGATE(CT v4.4.x meta-PLAN + Phase 1-4 骨架)| ✅ DONE |
| T0359 | 2026_Cooperative | `CP-T1148` | COORDINATED(BAT commit `d3f6580` supports ABANDONED workorder status parsing)| ✅ FIXED |

## 對方 Repo 骨架(BMad-Guide T0098 主 PLAN 下)

| 對方 ID | Phase | 內容 | 狀態 |
|---------|-------|------|------|
| T0098 | meta | CT v4.4.x CLT 對齊 主 PLAN | 🔄 IN_PROGRESS(Phase 1-2 DONE,Phase 3-4 TODO)|
| T0099 / T0100 / T0101 | Phase 1 | audit-only + 快勝 | ✅ DONE(commit `9ba3c8a` / `678d5a2` / `a9c5967`)|
| T0102 / T0103 / T0104 | Phase 2 | template v3.7 + evolve prompt | ✅ DONE(commit `0de4e2b` / `c3a4282` / `a61c066`,含 T0108 bootstrap 順修 `ebb7a63`)|
| T0105 | Phase 3 | *evolve 輸出拆 tactical / strategic | 📋 TODO |
| T0106 | Phase 4 | CT 設計依據 doctrine | 📋 TODO |

> ~~本 CT 塔台(BAT 端)**接手 Phase 1-4 派發**~~ — **D074 決定已過時**(2026-04-22 20:50)。對端塔台 BMad-Guide 在 2026-04-22 下午自主執行 Phase 1-2 全部完成並 push 到 `origin/dev-main`;BAT 未實際派發任何 CT-T### DELEGATE 工單。Phase 3-4 的處理方式待使用者決定(由對端續作 / BAT 派發 / 暫緩)。

## 相關文件(跨專案參考)

| 文件路徑 | 用途 | 本專案關聯 |
|---------|------|----------|
| `D:/ForgejoGit/BMad-Guide/spec/Cognitive Load × Agent Orchestration:深度拆解與 Control Tower 對照.md` | CLT 理論 × CT 對照分析(400 行)| PLAN-028 理論依據 |

## 2026_Cooperative 關聯(未來)

2026_Cooperative 作為 CT skill 激進 consumer(驗證場 #2),預期將建立對應 PLAN 追蹤同批改良。關聯表待對端 PLAN 建立後補完。

---

> 維護規則:每新增跨專案關聯時手動追加本檔。`*sync` 不自動更新本檔(避免覆蓋人工維護的語意資訊)。
