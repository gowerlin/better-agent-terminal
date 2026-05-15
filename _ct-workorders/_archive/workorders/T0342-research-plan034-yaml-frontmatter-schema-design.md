---
schema_version: 1
schema_kind: workorder
id: T0342
title: Research PLAN-034 YAML frontmatter metadata schema 設計（BAT + CT 雙端，YOLO 自主拍板）
type: research
status: DONE
sizing: L
created_at: "2026-04-28T18:25:00+08:00"
started_at: "2026-04-28T19:16:49+08:00"
completed_at: "2026-04-28T19:22:13+08:00"
renew_count: 0
workdir: main repo（純讀取 + 文件產出，不需 worktree）
---
# T0342 — Research PLAN-034 YAML frontmatter metadata schema 設計（BAT + CT 雙端，YOLO 自主拍板）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0342 |
| 類型 | research（YOLO 自主拍板，6 大設計問題 + 雙端整合策略） |
| 所屬 | PLAN-034 — Workorder/Index 檔 YAML frontmatter metadata schema 強制化 |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-28 18:25 (UTC+8) |
| 開始時間 | 2026-04-28 19:16:49 +08:00 |
| 完成時間 | 2026-04-28 19:22:13 +08:00 |
| Sizing | L（estimate 60-120 min wall：6 設計問題 × 雙端整合 × spec + 範例檔產出） |
| 依賴 | 無（PLAN-034 已備齊背景 + 範圍 + 設計問題） |
| 後續 | 拍板後拆 Sprint 2-6 共 ~5-6 張實作工單（CT 先 → BAT 跟 → dogfood） |
| 互動旗標 | `--mode yolo --no-interactive`（YOLO 自主拍板，依 PLAN-034 已列 6 問題逕行決策） |
| Renew 次數 | 0 |
| 工作目錄 | main repo（純讀取 + 文件產出，不需 worktree） |
| `affects_files` | `_ct-workorders/T0342-*.md`（自身回報區）+ `_ct-workorders/_spec-yaml-frontmatter-schema.md`（產出 spec 檔）+ `_ct-workorders/examples/`（範例檔目錄，可選新建） |

---

## 背景

PLAN-034（Workorder YAML frontmatter schema 強制化）已立案（優先級 🔴 High / 類型 架構調整 + 技術改善）。觸發 BUG-077（指揮塔 UI parser 誤報 T0313/T0314 DONE 為 Pending），根因為 markdown table parser 對某些工單格式變形敏感。

PLAN-034 規劃 6 大設計問題待拍板，且需跨 BAT（指揮塔 UI parser、五大面板）+ CT（*sync / *archive / 模板 / skill 文件）雙端整合。

**範疇決策**（Q1=B）：本 research **一次涵蓋 BAT + CT 雙端 schema + parser 設計**，不切分。
**互動模式**（Q3=B）：YOLO 自主拍板，Worker 依 PLAN-034 已列問題自主決策，產出完整後塔台覆核。

## 任務目標

依 PLAN-034 列出的 6 大設計問題逐一拍板，產出 schema spec + 範例檔，作為 Sprint 2-6 實作 SoT。

### 6 大設計問題（必須全部拍板）

1. **list 欄位格式**：YAML list（人類友善）vs JSON-style array（escape 簡單）
   - 評估：可讀性、LLM 寫入正確率、parser 容錯
   - 建議產出：選定一種 + 範例 + 邊界 case（如 affects_files 含 glob、含中文路徑）

2. **frontmatter / body 漂移處理**：sync 時雙向比對 → 告警 vs 強制覆寫
   - 評估：人類為先（告警）vs 機器為先（覆寫）哲學
   - 建議產出：選定策略 + sync 偵測邏輯偽碼 + 漂移警示格式

3. **schema 版本管理**：當 schema v2 出現時，舊 v1 工單怎麼處理
   - 評估：lazy migration（讀時轉換）vs eager migration（一次性 script）vs 凍結舊版（only new）
   - 建議產出：選定策略 + version field 命名（`schema_version` vs `v` vs `meta.version`）+ 升版相容矩陣

4. **遷移時間點**：(a) 一次性 big bang / (b) 新工單用新 schema / (c) 雙寫過渡期
   - 評估：dogfood 風險、回滾成本、過渡期長度
   - 建議產出：選定策略 + 時程表 + 雙寫過渡期判斷標準（何時可下架舊 parser）

5. **schema 強制度**：strict（lint 失敗即拒絕）vs lax（warning + accept）
   - 評估：起步嚴謹 vs 漸進啟用、是否需要 lint 工具
   - 建議產出：選定策略 + 起步階段定義 + 升 strict 觸發條件（dogfood N 張無漂移後啟用？）

6. **索引檔 frontmatter 統計欄位**：要不要把 status breakdown 全塞 frontmatter
   - 評估：BAT 統計面板讀取成本 vs frontmatter 噪音
   - 建議產出：索引檔 schema 範例 + 統計欄位 inclusion 規則（only generated_at + total，還是含 breakdown）

### 雙端整合策略（額外拍板項）

7. **CT × BAT 發佈節奏**：誰先誰後、過渡期 parser 雙支援程度、共同 dogfood 起點
8. **schema namespace**：T/BUG/PLAN/EXP 共用 base + 各自 extension 的繼承結構（YAML schema 怎麼表達？JSON Schema $ref / 純文件規範）
9. **錯誤處理 contract**：Worker 寫錯 schema 時 *sync / parser 回應方式（log warning / abort sync / auto-fix 嘗試）

## 產出（Q2 塔台建議：[C] 報告 + spec + 範例）

### 必要產出

1. **本工單回報區**：6 大設計問題拍板紀錄 + 額外 3 項整合策略 + Sprint 2-6 拆單表
2. **`_ct-workorders/_spec-yaml-frontmatter-schema.md`**：完整 schema spec
   - Base schema（共用欄位 + 型別 + enum）
   - T/BUG/PLAN/EXP 4 種 extension 各自欄位
   - 索引檔 schema（_bug-tracker / _backlog / _decision-log / _tower-state）
   - frontmatter / body 漂移處理規範
   - schema 版本管理 + 升版相容規則
   - migration script 演算法（pseudocode）
3. **`_ct-workorders/examples/` 目錄**（如不存在則新建）：
   - `T-workorder.example.md`（含 frontmatter + body 完整範例）
   - `BUG.example.md`
   - `PLAN.example.md`
   - `EXP.example.md`
   - `_bug-tracker.example.md`（索引檔示範）

### 可選產出（依研究判斷）

- `_spec-yaml-frontmatter-schema.json`（JSON Schema 機讀版本，BAT/CT lint 引用）
- migration script 草稿（Node.js 或 PowerShell，工單目錄 batch 處理）

## 拍板標準（Worker YOLO 拍板原則）

由於 `--mode yolo --no-interactive`，Worker 無法問使用者。拍板時依以下原則：

1. **可讀性優先**：選 YAML list 而非 JSON-style array（人類速查更直覺）
2. **人類為先**：frontmatter / body 漂移時 sync 告警，不強制覆寫（人類可手動同步）
3. **保守起步**：schema 強制度起步 lax + warning，dogfood 穩定後升 strict
4. **過渡安全**：遷移策略選 (c) 雙寫過渡期，BAT/CT parser 都支援新舊 ≥1 個月，dogfood 無漂移後下架舊 parser
5. **明確 schema_version**：起步用 `schema_version: 1`，預留 `v2` 升版欄位
6. **雙端發佈節奏**：CT 先（schema + 模板 + sync 改造）→ BAT 跟（parser 對齊）→ 共同 dogfood ≥1 週 → 升 strict

> 若 Worker 認為某拍板原則不適用，必須在回報區明確記錄反駁理由，不能默默偏離。

## Sprint 2-6 拆單建議（research 後產出）

依 PLAN-034 預估，需在回報區產出：

| Sprint | 內容 | sizing 預估 | 涉及檔案 |
|--------|------|-----------|---------|
| 2 | CT 模板 + skill 文件更新 | M-L | work-order-template.md / bug-plan-system.md / archive-system.md / *sync 邏輯 |
| 3 | BAT UI parser 改造（5 面板） | L | BAT 工單面板 / 決策 / 史詩 / 待辦池 / 臭蟲 |
| 4 | Migration script + 一次性遷移 ~140 張熱區單據 | M | scripts/migrate-frontmatter.* + 全熱區單據 |
| 5 | 過渡相容 dogfood + BUG-077 收斂 + tests | M | parser 雙支援、漂移偵測、整合測試 |
| 6（可選）| schema strict 模式啟用 + lint 規則 | S-M | sync lint、worker 寫錯引導 |

> Worker 須在回報區補上各 Sprint 的具體任務拆解、依賴關係、affects_files 預估。

## 自檢清單（Worker 收尾前必跑）

- [ ] 6 大設計問題全部拍板（含理由）
- [ ] 3 項雙端整合策略全部拍板
- [ ] `_spec-yaml-frontmatter-schema.md` 產出（base + 4 extension + 索引檔 + 漂移 + 版本）
- [ ] `examples/` 目錄至少 5 個範例檔（4 工單類型 + 索引檔）
- [ ] Sprint 2-6 拆單表完整（含 sizing、affects_files、依賴）
- [ ] 回報區呼應 PLAN-034 標題 + 連結 + BUG-077 收斂路徑
- [ ] 任何偏離塔台拍板原則的決策皆有書面理由

## 重要約束

1. **禁止實作 schema 以外的代碼變更**：本 sprint 純研究 + 文件，不動 BAT/CT 任何 source
2. **不修 BUG-077 metadata**：等 Sprint 5 dogfood 驗證後再 CLOSED
3. **`_archive/` 不在範疇**：明確說明歸檔單據不遷移、不適用新 schema（凍結態）
4. **Sprint 6 為可選**：strict mode 啟用條件由 dogfood 結果決定，研究時列為條件啟動的 contingency

---

## 回報區（Worker 完成後填寫）

### 拍板紀錄

完成狀態：DONE

調查結論：PLAN-034 應採「YAML frontmatter = metadata SoT、markdown body = 人類可讀鏡像」的雙寫過渡方案。BAT parser 與 CT `*sync` 在 Sprint 2-5 期間必須同時支援 v1 frontmatter 與 legacy markdown table；等 dogfood 指標通過後，Sprint 6 才把 schema enforcement 提升到 strict。

1. **list 欄位格式**
   - 選定方案：YAML block list。
   - 理由：人類與 LLM worker 最容易追加單行，diff 小，glob/中文路徑可透過必要時加 quote 處理。
   - 排除方案：JSON-style array；它對 parser 簡單，但長路徑與 quote escape 對手寫/LLM 修改更容易出錯。
   - 邊界 case：`affects_files` 含 glob、中文路徑、`#`、`:`、`*` 起頭值時需 quote；路徑一律 repo-relative + forward slash。

2. **frontmatter / body 漂移處理**
   - 選定方案：frontmatter 為 SoT，body 漂移只告警，不自動覆寫人類 body。
   - 理由：工單 body 是人類閱讀與審計載體，強制覆寫會造成意外文本破壞；parser 穩定性則靠 frontmatter。
   - 排除方案：sync 強制覆寫 body；風險是破壞 Worker 回報與人工補註。
   - 邊界 case：generated index（如 `_bug-tracker.md`）可由 `*sync` 整檔重寫；human workorder 不可靜默改 body。

3. **schema 版本管理**
   - 選定方案：top-level `schema_version: 1` + lazy read adapter + explicit migration script。
   - 理由：允許 BAT/CT 發佈節奏錯開，也避免一次 v2 變更讓舊工單不可讀。
   - 排除方案：凍結舊版 only-new；會讓 UI parser 長期維護兩套不可收斂格式。
   - 邊界 case：v2 reader 必須能透過 v1 adapter 讀取；unsupported future version 在 strict mode 下報 invalid，不 fallback 成 Pending。

4. **遷移時間點**
   - 選定方案：雙寫過渡期。
   - 理由：PLAN-034 橫跨 CT skill 與 BAT UI，big bang 風險高；新工單先吃 v1，熱區舊單再 script 遷移。
   - 排除方案：一次性 big bang；BAT/CT 任一端落後就會中斷 dogfood。
   - 邊界 case：`_archive/` 明確不遷移，legacy parser 保留至少一個月或直到 dogfood 指標通過。

5. **schema 強制度**
   - 選定方案：lax → guarded → strict 三階段。
   - 理由：起步先收集 drift 與 parser parity；strict 只在新模板、migration、tests 穩定後啟用。
   - 排除方案：一開始 strict；會把既有 140 張熱區單據的歷史漂移變成阻塞。
   - 邊界 case：strict mode 下 unknown status 要顯示 invalid/error，不得 silently fallback `PENDING`。

6. **索引檔 frontmatter 統計欄位**
   - 選定方案：frontmatter 放 `generated_at`、`total`、compact `breakdown`；詳細表格留 body。
   - 理由：BAT 統計面板可 O(1) 讀 counts，body 保持完整報表；解決 BUG-077 類統計 91+2≠101 的可觀測性問題。
   - 排除方案：只放 `generated_at + total`；無法判斷 breakdown 是否與 total 矛盾。
   - 邊界 case：generated index 的 frontmatter/body 由同一 sync pass 產生，允許整檔重寫。

7. **CT × BAT 發佈節奏**
   - 選定方案：CT 先（schema + 模板 + sync）→ BAT 跟（parser frontmatter-first）→ migration → dogfood → optional strict。
   - 理由：CT 是寫入端，BAT 是讀取端；先讓新文件產生穩定 schema，再讓 UI 以 frontmatter 為 SoT。
   - 排除方案：BAT 先 only；新文件仍由 CT 寫 legacy table，無法累積 v1 dogfood。
   - 邊界 case：BAT parser 在 Sprint 3 必須保留 legacy fallback，避免 CT skill 尚未全部升級時 UI 空窗。

8. **schema namespace**
   - 選定方案：共用 base schema + `schema_kind` extension（`workorder` / `bug` / `plan` / `experiment` / `index`）。
   - 理由：五類文件有共通 ID/status/time/path 欄位，但 status enum 與業務欄位不同；extension 清楚又不過度工程化。
   - 排除方案：完全分散 schema；會重複欄位定義且 parser 難共用。
   - 邊界 case：JSON Schema 機讀版可在後續工單加 `$defs`/`$ref`，本工單先以 markdown spec 為 SoT。

9. **錯誤處理 contract**
   - 選定方案：parser/sync 回報 structured warning；strict mode 才 abort；invalid 不可被歸類為 Pending。
   - 理由：BUG-077 的核心風險是錯誤 fallback 成正常 bucket。新 contract 要保留可用性但讓錯誤可見。
   - 排除方案：全部錯誤都 fallback Pending；會再次污染 UI 統計。
   - 邊界 case：frontmatter missing 可 legacy fallback；frontmatter present but invalid 在 guarded/strict 要明確標示。

### Sprint 2-6 拆單表

| Sprint | 內容 | Sizing | 依賴 | affects_files | 預估 wall time |
|--------|------|--------|------|---------------|----------------|
| 2 | CT 模板 + skill 文件更新；新工單/BUG/PLAN/EXP/index 產出 v1 frontmatter；`*sync` 加 frontmatter SoT 與 drift warning。 | M-L | T0342 spec | `~/.codex/skills/control-tower/**`、`~/.codex/skills/ct-*/SKILL.md`、template/reference/sync/archive 文件 | 60-120 min |
| 3 | BAT UI parser 改造；workorders、bugs、plans、decisions、backlog 五面板 frontmatter-first，legacy fallback。 | L | Sprint 2 schema freeze | `src/types/control-tower.ts`、bug/backlog/decision parser、`ControlTowerPanel.tsx`、parser fixtures/tests | 90-150 min |
| 4 | Migration script；熱區約 140 張單據加 v1 frontmatter，idempotent，排除 `_archive/**`。 | M | Sprint 2-3 | `scripts/migrate-ct-frontmatter.*`、`_ct-workorders/*.md` hot zone | 45-90 min |
| 5 | 過渡相容 dogfood；BUG-077 收斂；T0313/T0314 regression、index breakdown parity、drift telemetry。 | M | Sprint 4 migrated docs | parser tests、T0313/T0314 fixtures、`_bug-tracker.md`、`_backlog.md`、sync logs | 60-100 min |
| 6（可選） | strict mode + lint；CI/worker 寫錯 schema 時的錯誤引導。 | S-M | Sprint 5 dogfood 指標通過 | sync lint rule、test scripts、worker-facing docs | 30-75 min |

### 產出檔案清單

- [x] `_spec-yaml-frontmatter-schema.md`
- [x] `examples/T-workorder.example.md`
- [x] `examples/BUG.example.md`
- [x] `examples/PLAN.example.md`
- [x] `examples/EXP.example.md`
- [x] `examples/_bug-tracker.example.md`
- [ ] （可選）`_spec-yaml-frontmatter-schema.json`
- [ ] （可選）migration script 草稿

### 偏離塔台原則的決策（如有）

無。全部沿用塔台拍板原則：YAML list、人類為先、lax 起步、雙寫過渡、`schema_version: 1`、CT 先 BAT 後。

### 後續動作建議

建議塔台覆核時先確認兩點：第一，index frontmatter 是否接受 `breakdown`（本研究推薦接受，因為可直接修統計漂移可觀測性）；第二，Sprint 2 是否先改 CT templates/sync，讓後續 BAT parser 有真實 v1 文件 dogfood。

BUG-077 收斂路徑：不要直接修 T0313/T0314 body metadata 後關單；等 Sprint 5 以 frontmatter parser 驗證 T0313/T0314 顯示 Done、總數與 breakdown 對齊，再把 BUG-077 轉 FIXED/VERIFY。

遭遇問題：無

互動紀錄：無（`CT_INTERACTIVE=0` 且工單指定 YOLO 自主拍板）

Renew 歷程：無

回報時間：2026-04-28 19:22:13 +08:00

commit：6e80b45

yaml：不適用（`sprint-status.yaml` 存在但未追蹤 T0342/PLAN-034）

BAT 通知：`CT_MODE=yolo`，已透過 `bat-notify.mjs --submit` 自動送出 `T0342 完成`
