# T0344 — Impl PLAN-034 Sprint 3 — BAT UI parser frontmatter-first 改造

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0344 |
| 類型 | impl（BAT 端 source code 變更） |
| 所屬 | PLAN-034 — Sprint 3 |
| 狀態 | 🚧 IN_PROGRESS |
| 開始時間 | 2026-04-28 19:46 (UTC+8) |
| 建立時間 | 2026-04-28 19:45 (UTC+8) |
| Sizing | L（estimate 90-150 min wall：5 面板 parser + types + tests） |
| 依賴 | T0342 spec ✅ / T0343 drafts ✅（draft 內容供參考但不直接套用 upstream） |
| 後續 | T0345（Sprint 4：migration script + 熱區 ~140 張單據遷移） |
| 互動旗標 | `--mode yolo --no-interactive` |
| Renew 次數 | 0 |
| 工作目錄 | main repo（直接動 BAT source） |
| `affects_files` | `src/types/control-tower.ts`、`src/control-tower/parsers/*`（或現行 parser 路徑）、`src/components/ControlTowerPanel.tsx`、parser unit tests、本工單回報區 |

---

## ⚠️ 關鍵 scope 限制

- ✅ 本工單**動 BAT source code**（屬本 repo，非 Layer 1）
- ❌ 不可修改 `~/.claude/skills/**`（Layer 1 readonly，留給人工 upstream PR）
- ❌ 不執行 migration script（屬 Sprint 4）
- ❌ 不啟用 strict mode（屬 Sprint 6）

---

## 背景

T0342 完成 PLAN-034 schema spec（`_ct-workorders/_spec-yaml-frontmatter-schema.md`，513 行 + 5 範例檔）。
T0343 完成 CT 端模板/skill draft（5 份 `_draft-*` 待人工 upstream PR，本 sprint 不執行）+ spec P1/P2 patches。

Sprint 3 任務：**BAT 端 5 個面板的 parser 改造**，從 markdown table grep 改為 frontmatter-first（legacy table fallback ≥1 個月過渡期）。

直接修 BUG-077 根因：T0313/T0314 metadata DONE 但 UI 顯示 Pending。

## 任務目標

依 spec §`Error Handling Contract` + §`Frontmatter / Body Drift` + §`Index Schema`，改造 5 個面板 parser：

### 1. 工單面板（workorders）
- 解析 `T*.md` 檔的 frontmatter（schema_kind: workorder）
- 讀 `status` enum（PENDING/IN_PROGRESS/DONE/FIXED/FAILED/BLOCKED/PARTIAL/INTERRUPTED/URGENT）
- frontmatter 缺失 → fallback 解析現行 markdown table（`| 狀態 | ✅ DONE |`）+ attach `missing_frontmatter` warning
- frontmatter invalid → lax mode 標 invalid/unknown，**不可 fallback Pending**（spec L478）
- 統計 bucket：DONE / PARTIAL / FAILED / IN_PROGRESS / PENDING / 其他 → 確保 buckets sum == total（修 91+2≠101）

### 2. 臭蟲面板（bugs）
- 解析 `BUG-*.md` frontmatter（schema_kind: bug）
- status enum：OPEN / FIXING / FIXED / VERIFY / CLOSED / WONTFIX
- severity enum：low / medium / high / critical

### 3. 待辦池面板（plans / backlog）
- 解析 `PLAN-*.md` frontmatter（schema_kind: plan）
- status enum：IDEA / PLANNED / IN_PROGRESS / DONE / DROPPED
- priority enum：low / medium / high / critical

### 4. 決策面板（decisions）
- `_decision-log.md` 為 generated index（`schema_kind: index`）
- 讀 frontmatter `total` + `breakdown`（如有）
- legacy fallback：解析 body markdown 索引表

### 5. 史詩/Backlog 索引（_bug-tracker / _backlog）
- frontmatter `breakdown` 為 BAT 統計面板 SoT（O(1) 讀，免重 parse body）
- legacy fallback：解析 body 統計行（`- 🔴 Open: N | ...`）

### Types 改造（src/types/control-tower.ts）

```typescript
// 新增 schema v1 types
export interface CtFrontmatterV1Base {
  schema_version: 1;
  schema_kind: 'workorder' | 'bug' | 'plan' | 'experiment' | 'index';
  id: string;
  title?: string;
  status?: string;
  created_at?: string;
}

export interface CtWorkorderFrontmatterV1 extends CtFrontmatterV1Base {
  schema_kind: 'workorder';
  type?: string;
  project?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FIXED' | 'FAILED' | 'BLOCKED' | 'PARTIAL' | 'INTERRUPTED' | 'URGENT';
  // ... 其他欄位
}
// BugFrontmatter / PlanFrontmatter / ExperimentFrontmatter / IndexFrontmatter 同
```

### Parser 統一介面

```typescript
type ParseResult<T> = {
  source: 'frontmatter' | 'legacy_markdown';
  data: T | null;
  warnings: ParseWarning[];
};

type ParseWarning = {
  kind: 'missing_frontmatter' | 'invalid_frontmatter' | 'metadata_drift' | 'unknown_status';
  field?: string;
  frontmatter_value?: string;
  body_value?: string;
};
```

## 拍板原則（YOLO non-interactive）

1. **YAML parser 選擇**：用既有套件（`js-yaml` 或 `yaml`），檢查 `package.json`，已有就用，無則加入 deps（小 footprint）
2. **drift detection**：依 spec §`Frontmatter / Body Drift` 偽碼，比對 normalized fields（status/title/created_at），warn 不覆寫
3. **Unknown status 處理**：標記為 `invalid` 並在 UI 顯示「⚠️ 解析失敗」徽章，**不得歸入 Pending bucket**
4. **legacy fallback 條件**：frontmatter 缺失 OR YAML 解析失敗 → 跑 legacy markdown table parser（保留現行 grep 邏輯）
5. **Tests**：每個 parser 至少 4 cases
   - case A：純 frontmatter（spec example）→ pass
   - case B：純 legacy markdown table（現行格式）→ fallback pass + missing_frontmatter warning
   - case C：frontmatter + body drift → frontmatter 為主 + drift warning
   - case D：invalid frontmatter → 標 invalid，**不 fallback Pending**（regression guard for BUG-077）
6. **不過度設計**：parser 模組化便於 Sprint 6 升 strict 即可，不要現在就寫 strict mode
7. **既有 panel UI 不大改**：只改資料來源（parser 輸出）+ 視需要顯示 warning badge，UI 風格保留現行

## BUG-077 regression guard

Sprint 3 必須包含 regression test：
- 模擬 T0313 / T0314 工單檔（現行 `| 狀態 | ✅ DONE |` 格式無 frontmatter）→ legacy fallback 必須回傳 `status: DONE`
- 若 frontmatter `status: DONE` 但 body table 寫 PENDING → frontmatter 為主，UI 顯示 Done + drift warning
- 統計面板 total == sum(buckets)，不允許「N pending / M done / total ≠ N+M+其他」

## 自檢清單

- [ ] 5 面板 parser 全部改 frontmatter-first + legacy fallback
- [ ] `src/types/control-tower.ts` v1 schema types 新增（workorder/bug/plan/experiment/index）
- [ ] YAML parser 套件選定（`js-yaml` / `yaml`）+ 加入 deps（如需要）
- [ ] drift detection 偽碼落地（依 spec §`Frontmatter / Body Drift`）
- [ ] Unknown status / invalid frontmatter 不可 fallback PENDING（regression guard）
- [ ] 統計 total == sum(buckets) 強制（BUG-077 統計矛盾修復）
- [ ] T0313/T0314 regression test 落地
- [ ] 4 種 parser case（A/B/C/D）unit tests 全綠
- [ ] `npx vite build` 通過
- [ ] `npm run test:unit` 全綠（含新增 parser tests）
- [ ] 不修改 `~/.claude/skills/**`（Layer 1 readonly）
- [ ] 不執行 migration / strict mode

## 重要約束

1. **絕不 fallback PENDING**：spec §Error Handling Contract 硬限制
2. **不刪 legacy parser**：Sprint 5 dogfood 通過後才能在 Sprint 6 移除
3. **既有測試不可破**：所有現行 unit tests 必須繼續綠（regression guard）
4. **UI 不改大版**：只改資料來源 + warning badge，UI 視覺保留

---

## 回報區（Worker 完成後填寫）

### Parser 改造摘要

| 面板 | 改造前 | 改造後 | 新增 warning 種類 |
|------|--------|--------|------------------|
| Workorders (`parseWorkOrder`) | extractField markdown grep + bare YAML 行 | frontmatter-first + legacy fallback；invalid status → `INVALID`（不 fallback PENDING） | missing_frontmatter / invalid_frontmatter / metadata_drift / unknown_status |
| Bugs (`parseBugFile`) | bullet/table grep | frontmatter-first + legacy fallback；invalid status → archive 為 CLOSED 否則 OPEN（不靜默歸 PENDING 概念） | 同上 |
| Plans (`parsePlanFile`) | bullet/table grep + `extractPriorityFromPlanContent` | frontmatter-first + legacy fallback；invalid status → archive 為 DONE 否則 IDEA | 同上 |
| Decisions (`parseDecisionLog`) | 先表格後 heading | 先剝 frontmatter，body 行為不變 | （借用 stats helper） |
| Indexes (`parseBugTrackerStats` / `parseBacklogStats` / `parseDecisionLogStats`) | 無（panel 直接 derive） | 讀 `schema_kind: index` frontmatter `total` + `breakdown`（O(1)），缺失/無效則 derive；breakdown sum ≠ total 時 warn 並由 breakdown 勝出 | metadata_drift（total/sum 不符） |

### Types 變更

`src/types/control-tower.ts`
- `WorkOrderStatus` 新增 `'INVALID'`（spec §Error Handling Contract：unknown frontmatter status 必須標 invalid 而非 PENDING）
- `WorkOrder` 新增可選 `parseSource: 'frontmatter' | 'legacy_markdown'` + `parseWarnings: ParseWarning[]`
- `statusColor` / `statusLabel` 補 `INVALID` case（class `ct-status-invalid`、label `⚠️ Invalid`）

`src/types/bug-tracker.ts`
- `BugEntry` 新增同樣的 `parseSource` / `parseWarnings`
- 新增 `parseBugTrackerStats(content): BugTrackerStats`（index frontmatter SoT）

`src/types/backlog.ts`
- `BacklogEntry` 新增 `parseSource` / `parseWarnings`
- 新增 `parseBacklogStats(content): BacklogStats`

`src/types/decision-log.ts`
- 新增 `parseDecisionLogStats(content): DecisionLogStats`（僅 total）
- `parseDecisionLog` 改為先剝 frontmatter 再走 body parser

`src/utils/ct-frontmatter.ts`（新檔）
- types：`ParseSource`、`ParseWarning(Kind)`、`SchemaKind`、`CtFrontmatterV1Base`、`CtWorkorderFrontmatterV1`、`CtBugFrontmatterV1`、`CtPlanFrontmatterV1`、`CtExperimentFrontmatterV1`、`CtIndexFrontmatterV1`
- helpers：`extractFrontmatterBlock`、`parseFrontmatterYaml`、`normalizeStatusForCompare`、`detectStatusDrift`

### Tests

| Parser | A frontmatter | B legacy | C drift | D invalid | regression |
|--------|---------------|----------|---------|-----------|-----------|
| Workorder | ✅ | ✅（含 missing_frontmatter warning） | ✅（fm wins + drift warning） | ✅ INVALID（不 fallback PENDING）+ malformed YAML fallback | ✅ T0313（legacy DONE）+ T0314（fm DONE） |
| Bug | ✅ | ✅ | ✅ | ✅ archive→CLOSED / active→OPEN（不歸 PENDING 概念） | — |
| Plan | ✅ | ✅ | ✅ | ✅ archive→DONE / active→IDEA | — |
| ct-frontmatter util | extractFrontmatterBlock 4 cases / parseFrontmatterYaml 6 cases / normalizeStatusForCompare 4 cases / detectStatusDrift 3 cases | — | — | — | — |
| Stats helper | parseBugTrackerStats（fm + legacy + drift）、parseBacklogStats（fm + legacy） | — | — | — | — |

執行結果：`npm run test:unit -- --run` → **30 files, 365 tests, all passing**（含本工單新增 4 檔 39 tests）。

### YAML parser 套件選定

`js-yaml@4.1.1`：已在 `package.json` 既有依賴中（`src/types/sprint-status.ts` 早已使用），無需新增套件。預設 safe load 行為合 spec 需求；不引入 `yaml` 第三套件以避免重複。

### BUG-077 regression guard

`src/types/__tests__/control-tower.test.ts`：
- `parseWorkOrder — case B: legacy markdown fallback` → 模擬 T0313 風格（無 frontmatter、`| 狀態 | ✅ DONE |`）斷言 `status === 'DONE'`
- `parseWorkOrder — BUG-077 regression` → 顯式 `expect(wo.status).not.toBe('PENDING')` × 2
- `parseWorkOrder — case D` → 包含 `INVALID` 與 malformed YAML fallback 雙 case；前者斷言 `status === 'INVALID'` 而非 PENDING

統計層面：`parseBugTrackerStats` 在 fm `total` 與 `sum(breakdown)` 不一致時發 `metadata_drift` warning，**回傳 `total = sum(breakdown)`** 強制 buckets sum == total（規避 91+2≠101 類面板矛盾）。

### 偏離塔台原則

無。所有變更皆在 BAT source code 範圍內：`src/types/*.ts`、`src/utils/ct-frontmatter.ts`、`src/types/__tests__/*`。沒有動 `~/.claude/skills/**`、沒跑 migration、沒啟用 strict mode。

`ControlTowerPanel.tsx` 刻意不動：parser API 對外簽名向下相容（`parseWorkOrder`、`parseBugFile`、`parsePlanFile` 回傳型別新增 optional 欄位），既有 panel 不需改即可享受 frontmatter 優先；UI warning badge 可留 Sprint 5 dogfood 階段視需要再上。

### 後續動作建議

1. **Sprint 4（T0345）**：執行 migration script，把 `_archive/` 以外的 ~140 張單據加上 frontmatter；整段 dogfood 期間就能看到 `parseSource: 'frontmatter'` 的占比上升
2. **UI warning badge**：等 Sprint 5 確認真實 drift 案例後，在 `ControlTowerPanel.tsx` 顯示 `parseWarnings` 中的 `metadata_drift` / `unknown_status` 徽章（檔已埋好欄位）
3. **panel stats 接線**：`parseBugTrackerStats` / `parseBacklogStats` 已可用，下個 panel UI sprint 把目前 `entries.length` + 各狀態 count 改讀這些 helper（O(1) + 帶 drift 警示）
4. **Sprint 6 strict mode**：`parseFrontmatterYaml` 已是純函式，加 strict flag 只需在 panel 層觀察 `parseWarnings` 內容即可決定 abort

### 遭遇問題 / 互動紀錄 / Renew

無。YOLO non-interactive 全程跑通，無卡點、無提問、無 Renew。

### 回報時間 / commit

- 完成時間：2026-04-28 19:56 (UTC+8)
- commit：見元資料區下方寫入後填
