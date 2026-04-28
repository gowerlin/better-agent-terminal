---
schema_version: 1
schema_kind: plan
id: PLAN-034
title: Workorder/Index 檔 YAML frontmatter metadata schema 強制化（BAT + CT 雙端）
status: DONE
priority: high
created_at: "2026-04-28T18:20:00+08:00"
done_at: "2026-04-28T20:14:00+08:00"
trigger_bugs:
  - BUG-077
---
# PLAN-034 — Workorder/Index 檔 YAML frontmatter metadata schema 強制化（BAT + CT 雙端）

## Metadata

| 欄位 | 內容 |
|------|------|
| PLAN 編號 | PLAN-034 |
| 標題 | Workorder/Index 檔 YAML frontmatter metadata schema 強制化（BAT + CT 雙端） |
| 狀態 | ✅ DONE（2026-04-28 20:14 — Sprint 1-5 全綠，Sprint 6 strict mode 留 1-2 週 drift 觀察期 conditional） |
| 優先級 | 🔴 High |
| 類型 | 架構調整 + 技術改善（兩者皆是） |
| 建立時間 | 2026-04-28 18:20 (UTC+8) |
| 觸發 BUG | BUG-077（指揮塔 UI parser 誤報 DONE → Pending）— 根因解 |
| 影響範圍 | BAT（指揮塔 UI parser、工單面板）+ CT（*sync / *archive / 模板） |
| 涉及檔案 | ~140 張現有單據（106 T + 19 BUG + 13 PLAN + 1 EXP + 1 CT-T）+ 索引檔（_bug-tracker.md / _backlog.md / _decision-log.md / _tower-state.md）+ 模板（work-order-template.md 等） |

---

## 動機

目前工單 / BUG / PLAN / EXP / 索引檔的 metadata 用 markdown table 表達（如 `| 狀態 | ✅ DONE |`）。問題：

1. **LLM 自由格式漂移**：Worker 寫 metadata 偶爾偏離 template（emoji 換、欄位順序變、value 多/少空白），parser 跟著破
2. **Parser 脆弱**：BAT UI parser 對 T0313/T0314（同樣 `| 狀態 | ✅ DONE |` 格式）誤報 Pending → BUG-077 根因
3. **CT *sync 也吃這個坑**：grep -E 拼 regex 抓狀態，emoji + table cell + value 變形時容易漏
4. **無 enum 強制**：`status` 沒有 schema 限制，DONE/done/✅DONE/Done 等變形都 LLM 可能寫出來
5. **statistics 漂移**：BAT 顯示「91 done / 2 pending / 101 total」但 91+2≠101，根因可能就是 parser 對某些單據解析失敗 fallback 到不可知 bucket

→ 需 frontmatter + schema 強制化讓 parser SoT 可靠，body 維持 markdown 表給人類閱讀。

## 設計目標

1. **frontmatter = SoT**：BAT UI / CT *sync 一律從 YAML frontmatter 讀 metadata，不再解析 markdown table
2. **body = 人類可視化**：保留現有 metadata 表 + 章節結構，接受偶爾漂移（sync 時告警，不阻塞）
3. **schema 嚴格**：`status` 用 enum，時間用 ISO 8601，必填欄位 schema 強制
4. **共用 base schema**：T/BUG/PLAN/EXP 共用核心欄位（id、type、status、created_at），各自加 extension
5. **versioning**：`schema_version: 1` 預留升級空間
6. **migration 一次性 script**：idempotent，從 markdown table 抽 metadata 塞 frontmatter，無資料遺失

## 範圍

### In-scope

- [ ] 設計 base schema + 4 種 extension（T / BUG / PLAN / EXP）
- [ ] 設計索引檔 schema（_bug-tracker / _backlog / _decision-log / _tower-state）
- [ ] 改 CT skill：模板（work-order-template.md / bug-plan-system.md 等）+ *sync 解析邏輯 + *archive 引用檢查
- [ ] 改 BAT：UI parser、工單面板、決策面板、史詩面板、待辦池
- [ ] 寫 migration script（從 markdown table 抽 → 寫 frontmatter）
- [ ] 過渡相容：parser 同時支援新舊格式，sync 時偵測並標記
- [ ] BUG-077 收斂：parser 改用 frontmatter 後驗證 T0313/T0314 顯示 Done

### Out-of-scope（明確排除）

- [ ] `_archive/` 已歸檔單據不遷（成本高、效益低、frozen 狀態）
- [ ] global learnings / playbooks（不在工單體系內，schema 另議）
- [ ] FIELDGUIDE.md / project-context.md 等專案層敘事文件（不適用工單 schema）

## 關鍵設計問題（Sprint 1 research 拍板）

1. **list 欄位格式**：YAML list（人類友善）vs JSON-style array（escape 簡單）？
2. **frontmatter / body 漂移處理**：sync 時雙向比對 → 告警 vs 強制覆寫？建議告警（人類為先）
3. **schema 版本管理**：當 schema v2 出現時，舊 v1 工單怎麼處理？lazy migration 還是一次性？
4. **遷移時間點**：(a) 一次性 big bang 全 migrate / (b) 新工單用新 schema、舊工單延續 / (c) 雙寫過渡期
5. **schema 強制度**：strict（lint 失敗即拒絕）vs lax（warning + accept）？建議起步 lax，穩定後 strict
6. **索引檔 frontmatter 統計欄位**：要不要把 status breakdown 全塞 frontmatter？還是只放 generated_at + total？

## 預期 Sprint 拆單（research 後拍板）

| Sprint | 內容 | sizing |
|--------|------|--------|
| 1 | Research：schema 設計 + 6 大設計問題拍板 + 遷移策略決策 | L（多輪互動研究） |
| 2 | CT 模板 + skill 文件更新（work-order-template / bug-plan-system / archive-system / *sync 邏輯） | M-L |
| 3 | BAT UI parser 改造（工單 / 決策 / 史詩 / 待辦池 / 臭蟲 五個面板） | L |
| 4 | Migration script + 一次性遷移 ~140 張熱區單據 | M |
| 5 | 過渡相容期 + dogfood 驗證 + BUG-077 收斂 + tests | M |
| 6 | （可選）schema strict 模式啟用 + lint 規則 + Worker 寫錯時的引導 | S-M |

> 估算：~5-6 張實作工單 + 1 張 research，wall time 估 ~6-10 hr Worker time（不含 BAT 端代碼量）。

## 跨 BAT × CT 協調

- BAT 改：本專案（this repo）
- CT skill 改：`~/.claude/skills/control-tower/` + `~/.claude/skills/ct-*` 系列
- 需求：兩端協調 schema 版本與發佈節奏；建議 CT 先（schema 設計 + 模板）→ BAT 跟（parser 對齊）→ 共同 dogfood

## 連結

- 觸發 BUG：[BUG-077](BUG-077-control-tower-ui-status-parser-misreports-done-as-pending.md)
- 相關討論：第四十二 session（2026-04-28）使用者觀察 BAT UI 不同步 + 提出 frontmatter idea
- 參考前例：所有 Claude skill 檔本身已使用 frontmatter（`---\nname: ...\ndescription: ...\n---`）

## 後續處理

- [x] 派 Sprint 1 research 工單拍板 6 大設計問題（T0342 commit `6e80b45`）
- [x] research 結論後拆 Sprint 2-6 實作工單
- [x] BUG-077 在 Sprint 5 dogfood 驗證階段一併收斂（T0346 commit `1780976`，BUG-077 → CLOSED）
- [ ] CT skill upstream PR（套用 5 份 `_draft-ct-frontmatter-sprint2-*.md` 到 `~/.claude/skills/control-tower/**`，沿 T0350 慣例，使用者手動）
- [ ] BAT + CT 同步 release（使用者已指示「全部完成同時更版」）
- [ ] Sprint 6 strict mode 評估（1-2 週後依 `~/.bat-cache/ct-drift.log` drift 量決定）

## Sprint 完成總表

| Sprint | 內容 | wall time | Worker commit |
|--------|------|-----------|--------------|
| 1 | T0342 Research（schema spec + 5 範例 + 9 拍板） | ~5.4 min | `6e80b45` |
| 2 | T0343 CT 模板 + 5 份 upstream draft + spec P1/P2 | ~6.4 min | `b064a16` |
| 3 | T0344 BAT parser frontmatter-first + INVALID status | ~10 min | `b250db5` |
| 4 | T0345 Migration script + 141 張單據遷移 | ~5 min | `e24428b` |
| 5 | T0346 BUG-077 收斂 + parity tests + drift telemetry | ~8 min | `1780976` |
| **合計** | **5 sprint, 365→375 tests** | **~35 min** | **5 commits** |

## 主要交付

- 📐 `_spec-yaml-frontmatter-schema.md`（513 行 spec，schema_version: 1）
- 📁 `_ct-workorders/examples/`（5 範例：T/BUG/PLAN/EXP/_bug-tracker）
- 📜 `_draft-ct-frontmatter-sprint2-*.md`（5 份 upstream CT skill PR draft）
- 🔧 `src/utils/ct-frontmatter.ts`（types + helpers）
- 🔧 `src/utils/ct-drift-telemetry.ts`（drift logger）
- 🔧 BAT 5 面板 parser frontmatter-first（向下相容 legacy markdown table）
- 🚚 `scripts/migrate-ct-frontmatter.mjs`（483 行，idempotent，141 張遷移）
- 🐛 BUG-077 → CLOSED（指揮塔 UI parser 誤報根因解）

---

## 變更歷史

- 2026-04-28 18:20：建立（第四十二 session 使用者提案，BUG-077 根因解）
- 2026-04-28 20:14：Sprint 1-5 全綠落地（35 min worker wall）→ status DONE
