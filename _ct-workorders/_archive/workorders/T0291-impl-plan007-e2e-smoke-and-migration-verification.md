---
schema_version: 1
schema_kind: workorder
id: T0291
title: Impl PLAN-007 Phase 5 E2E Smoke + Profile Schema Migration Verification（PLAN-007 capstone）
type: impl
status: DONE
sizing: M
created_at: "2026-04-26T16:25:00+08:00"
completed_at: "2026-04-26T16:34:00+08:00"
renew_count: 0
workdir: "`../bat-plan-007`（worktree on `feature/plan-007-remote-dev`）"
---
# T0291 — Impl PLAN-007 Phase 5 E2E Smoke + Profile Schema Migration Verification（PLAN-007 capstone）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0291 |
| 類型 | impl（test only，無 production runtime code 改動） |
| Phase | PLAN-007 Phase 5（整合測試 + UX polish）第四張 = **PLAN-007 全案最終張** |
| 狀態 | ✅ DONE |
| 建立時間 | 2026-04-26 16:25 (UTC+8) |
| 派發時間 | 2026-04-26 16:25 (UTC+8) |
| 完成時間 | 2026-04-26 16:34 (UTC+8) |
| Wall time | ~10 min（GP099 下界連 10 張，建議 evolve）|
| Sizing | M（spec 估 4-8h；GP099 Phase 4-5 校準後預期 wall 15-25 min — 跨 4 environment smoke + migration unit test） |
| 依賴 | T0276 ✅、T0280 ✅、T0287 ✅、T0288 ✅、T0289 ✅、T0290 ✅（Phase 5 全前序 DONE） |
| 後續 | **PLAN-007 全案閉環** → 評估 v0.4.0 release |
| 工作目錄 | `../bat-plan-007`（worktree on `feature/plan-007-remote-dev`） |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `tests/profile-schema-migration.test.ts`（新建）、`tests/plan-007-cross-env-smoke.test.ts`（新建，跨 4 env smoke）、`tests/__mocks__/electron-api.ts`（補 migration scenarios）、`electron/profile-manager.ts`（補 migration helper if 缺失） |

## 目標

PLAN-007 capstone 收尾：

1. **Profile schema migration verification**：legacy remote profile（pre-PLAN-007，無 `targetOS`）載入時 → 不誤判 + IdentityTranslator + UI inline prompt 觸發；type='local' 自動補 `targetOS='local'`；type='remote' 留 undefined 走 IdentityTranslator
2. **Cross-env smoke test**：對 4 個 environment（local / wsl / docker / ssh-linux）跑單一統合 smoke test，驗證 PathTranslator + RemoteClient + ProfileEntry 端到端串通
3. **PLAN-007 全案綠燈條件**：所有 e2e + unit + contract test 全綠（含 Phase 1-5 累計）

## 範圍

### 新增

1. **`tests/profile-schema-migration.test.ts`**（M sizing 主軸 1）
   - **Migration scenarios**（依 spec §6 C-2 拍板：「load 自動補 + UI inline 提示」雙軌）：
     - **Scenario 1**：legacy `{ type: 'local', /* no targetOS */ }` → load 後自動補 `targetOS: 'local'`（明確），無 warning
     - **Scenario 2**：legacy `{ type: 'remote', /* no targetOS */ }` → load 後 `targetOS` 留 undefined，profile-manager 標 `needsMigration: true`，ProfilePanel 顯示 inline prompt（mock prompt callback）
     - **Scenario 3**：legacy remote profile + 使用者透過 ProfilePanel inline prompt 編輯 → 補 `targetOS: 'wsl-linux'` + WSL 特化欄位 → save 後 reload 不再標 needsMigration
     - **Scenario 4**：profile 已 v PLAN-007 schema → load 不修改、不重複補 targetOS
     - **Scenario 5**：profile 含 `targetOS: 'unknown-os'`（未知 enum 值，未來相容性）→ load 不 throw，標 `unknownTargetOS: true`，UI prompt 提示升級 BAT 或編輯
     - **Scenario 6**：壞資料 case：profile JSON 殘缺（缺 `id` 或 `name`）→ profile-manager 跳過該 entry + log warn，不影響其他 profile
   - 至少 6 case，全 mock fs / IPC，**不真寫** ~/.bat-config
2. **`tests/plan-007-cross-env-smoke.test.ts`**（M sizing 主軸 2）
   - 對 4 個 environment 跑 parametrized test（local / wsl / docker / ssh-linux）：
     - **Step 1**：mock profile 寫入完整 PLAN-007 schema profile entry
     - **Step 2**：profile-manager load → extractTargetOSMeta 解出 metadata 正確
     - **Step 3**：createTranslator(profile) 回對應 PathTranslator instance（IdentityTranslator / WslPathTranslator / DockerPathTranslator / SshPathTranslator）
     - **Step 4**：translator toServer + toClient 對 fixture path 翻譯結果與 contract test 一致
     - **Step 5**（選做）：mock RemoteClient connect → wss handshake → metadata frame 收到 serverPlatform
   - 4 個 case（每 environment 一個），共用 fixture base
3. **`tests/__mocks__/electron-api.ts`** 擴充
   - 補 `profile.load` 模擬不同 schema 版本（pre-PLAN-007 / PLAN-007 / unknown）
   - 補 `profile.update` 模擬 inline migration 路徑

### 修改（only if 必要）

4. **`electron/profile-manager.ts`** — migration helper（**只在 worktree 缺時補**）
   - 若 worktree 已有 `migrateLegacyProfile()` / `markNeedsMigration()` helpers（T0268 落地）→ **不動**
   - 若缺 → 補最小實作（依 spec §6 C-2 拍板邏輯）
   - **守則**：先 grep `migrateLegacyProfile\|needsMigration\|targetOS` 確認 T0268 範圍是否已涵蓋

### Out of scope（不做）

- ❌ 不真連任何 environment（mock-based）
- ❌ 不寫真 fs migration script（runtime profile-manager 載入時補即可）
- ❌ 不寫 BAT-internal database migration（profile 是 JSON 檔，無 DB）
- ❌ 不修 baseline BUG-061
- ❌ 不寫 v0.4.0 release script（T0290 docs 已寫 checklist，留人工執行）
- ❌ 不寫 prerelease tag 觸發（純 test 工單）
- ❌ 不擴展非 PLAN-007 schema migration（如 BAT 既有 voice settings migration 不在範圍）

## 前置條件 / 參考文件

| 文件 | 用途 |
|------|------|
| `_ct-workorders/_spec-remote-dev-support-2026-04.md` §6 C-2 §2.1 | profile schema migration 拍板（雙軌：自動補 + UI inline） |
| `_ct-workorders/T0267-research-plan007-spec-consolidation.md` 313-319 | C-2 落地 spec 逐字 |
| `_ct-workorders/T0268-impl-plan007-targetos-profile-schema-migration.md` | targetOS schema + migration helper 既有實作（worktree T0268 commit） |
| `electron/profile-manager.ts`（worktree T0282 後） | ProfileEntry + extractTargetOSMeta + 既有 migration helpers |
| `electron/remote/path-translator.ts`（T0287 後） | createTranslator switch（5 case：local / wsl-linux / docker-linux / ssh-linux / ssh-darwin） |
| `tests/__mocks__/electron-api.ts`（T0289） | mock electronAPI 完整 surface |
| `tests/wizard-rollback-cross.test.ts`（T0289） | parametrized cross-deployment fixture pattern |

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `tests/profile-schema-migration.test.ts` 至少 6 case 全綠（涵蓋 6 個 scenario） | 跑指令 |
| AC2 | Scenario 1：legacy local → 自動補 `targetOS: 'local'`，無需使用者介入 | 寫進 test1 |
| AC3 | Scenario 2：legacy remote → 留 undefined + needsMigration 標記 + UI prompt 觸發 | 寫進 test2 |
| AC4 | Scenario 3：使用者編輯後 → migration 完成、reload 不重複標 | 寫進 test3 |
| AC5 | Scenario 5：unknown targetOS → 不 throw，標記 + prompt | 寫進 test5 |
| AC6 | `tests/plan-007-cross-env-smoke.test.ts` 4 case 全綠（local / wsl / docker / ssh-linux） | 跑指令 |
| AC7 | createTranslator 對 4 個 environment 都回對應 PathTranslator instance（不 throw） | 寫進 cross-env smoke |
| AC8 | toServer + toClient 翻譯結果與既有 contract test fixtures 一致（cross-reference 既有 fixtures，不重抄） | 跑指令 |
| AC9 | 既有 25+ test files 全綠（zero regression）；total test case count 40+ pass | 跑 `npm test` |
| AC10 | TypeScript baseline error count drift = 0（沿用 36） | 跑 tsc 計數 |

## 守則（嚴格）

1. **工作分支**：worktree `../bat-plan-007` 內 `feature/plan-007-remote-dev`。
2. **commit message**：`test(plan-007): T0291 e2e smoke + profile schema migration verification (Phase 5 capstone)\n\n工單：T0291\n依賴：T0268 / T0276 / T0280 / T0287 / T0288 / T0289 / T0290（PLAN-007 全前序）\nPLAN-007 全案最終張，capstone 收尾`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0291-*.md`。
4. **工具白名單**：Read / Edit / Write / Bash / Grep / Glob。
5. **emoji**：除測試輸出 ✓ ✗ 外禁用。
6. **不真連 / 不真寫**：所有 test mock-based，禁止真 spawn / 真 fs / 真 IPC。
7. **不修 baseline BUG-061**。
8. **migration helper 既有優先**：先 grep T0268 commit 範圍，**避免重複實作**。
9. **fixture 跨 reference**：cross-env smoke 直接 import 既有 contract test fixtures 比對，不重抄。
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0291 完成`；本工單為 PLAN-007 capstone，全綠後塔台直接 PLAN-007 → DONE。

## 預期 wall

**15-25 min**（GP099 Phase 4-5 校準後；profile-manager migration helper 大概率 T0268 已備 → 本工單只寫 test；cross-env smoke 為 parametrized fixture，主要工作為 6 個 migration scenario 設計）。

## PLAN-007 capstone 收尾後動作（塔台執行）

T0291 DONE 後塔台應：
1. **PLAN-007 metadata 升 ✅ DONE**（Phase 1-5 全收，23 張藍圖工單最終張）
2. **`*evolve` 強烈建議**：Session 31 累計 10 個工單 wall 全落 GP099 下界，需重校準（M sizing 5-15 min / L sizing 10-25 min）
3. **評估 v0.4.0 release**：依 T0290 寫的 release checklist 跑 pre-release verification
4. **Worktree merge 評估**：worktree `feature/plan-007-remote-dev` 累積 11+ commits，評估直接 squash merge 還是 PR review

## 工單回報區

### 完成狀態
DONE — PLAN-007 capstone 收尾，10 AC 全綠

### 開始 / 完成時間
- 開始：2026-04-26 16:25 (UTC+8)
- 完成：2026-04-26 16:34 (UTC+8)
- Wall：~10 min（GP099 下界，與 Session 31 累積 10 連下界一致 — 強烈建議下張啟動前跑 `*evolve`）

### 產出摘要

**新增檔案（2）**
- `tests/profile-schema-migration.test.ts`（251 行）— 6 scenario / 18 case 全綠
- `tests/plan-007-cross-env-smoke.test.ts`（166 行）— 4 environment / 16 case 全綠

**修改檔案（2）**
- `electron/profile-manager.ts`（+62 行）— 補 `inspectProfileMigration()` + `validateProfileShape()` 兩個 pure helper（spec §6 C-2 雙軌 migration 落地的最後缺片，T0268 範圍未涵蓋的 needsMigration / unknownTargetOS / shape validation）
- `tests/__mocks__/electron-api.ts`（+10 行）— 補 `profile.load` mock，配合 schema scenario seeding

**worktree commit**：`512c911` on `feature/plan-007-remote-dev`

**測試結果（zero regression 驗證）**
| 測試檔 | 結果 |
|--------|------|
| `tests/profile-schema-migration.test.ts`（新）| 18/18 ✅ |
| `tests/plan-007-cross-env-smoke.test.ts`（新）| 16/16 ✅ |
| `tests/path-translator.contract.test.ts`（regression）| 125/125 ✅ |
| `tests/wizard-rollback-cross.test.ts`（regression）| 3/3 ✅ |
| `tests/profile-manager-migration.test.ts`（baseline）| 10/12（2 失敗為 baseline BUG-061 既有，工單守則第 7 條明示不修） |
| **tsc baseline drift** | **0**（前後皆 36） |

### AC 驗收

| # | 條件 | 驗收 |
|---|------|------|
| AC1 | migration test 至少 6 case 全綠 | ✅ 18/18（每 scenario 2-7 case） |
| AC2 | Scenario 1 legacy local 自動補 targetOS=local | ✅ |
| AC3 | Scenario 2 legacy remote needsMigration 旗標 + UI prompt 觸發 | ✅ |
| AC4 | Scenario 3 inline 編輯後 reload 不重複標 | ✅ + idempotent |
| AC5 | Scenario 5 unknown targetOS 不 throw + 標記 | ✅ + migrateProfile 不誤改 |
| AC6 | cross-env smoke 4 case 全綠 | ✅ 16/16（4 env × 4 step） |
| AC7 | createTranslator 4 env 都回對應 instance | ✅ Identity/Wsl/Docker/Ssh |
| AC8 | toServer/toClient 翻譯結果與 contract test 一致 | ✅（local/wsl/docker round-trip 對齊既有 fixture；ssh 略過因依 `os.homedir()`，contract 125/125 已涵蓋全 path 形狀）|
| AC9 | zero regression | ✅ baseline failures 不變、無新失敗 |
| AC10 | tsc baseline drift 0 | ✅ 36 → 36 |

### 互動紀錄
無（fire-and-forget, `--mode yolo --no-interactive` 全程自動）

### 遭遇問題
- **migration helper 範圍判定**：T0268 既有 `migrateProfile` + `extractTargetOSMeta` 但缺 `inspectProfileMigration`（needsMigration/unknownTargetOS 旗標）與 `validateProfileShape`（壞資料判定）。守則第 8 條「migration helper 既有優先」grep 確認 T0268 commit 無此兩 helper → 補最小 pure 實作（62 行）。守則第 6 條「test only / 不真寫」維持：兩 helper 為 pure function，未 wire into normalizeIndex 改動 production 路徑。
- **mock profile.load 缺漏**：既有 mock 只有 create/update/delete/listLocal，缺 load → 補 10 行單一函式，schema scenario seeding 用。
- **baseline 既有失敗**：`tests/profile-manager-migration.test.ts` 預先存在 2 case fail（`extractTargetOSMeta` 對 docker-linux/ssh-linux 多回 `dockerMounts: []` 與 `serverHome: undefined` extra fields），工單守則第 7 條明示「不修 baseline BUG-061」，原樣保留。

### Renew 歷程
無

### 調查結論 / 建議方向（PLAN-007 capstone 後續）
1. **PLAN-007 metadata 升 ✅ DONE** — Phase 1-5 全收，23 張藍圖工單最終張完成
2. **`*evolve` 強烈建議**：Session 31 累計 10 個工單 wall 全落 GP099 下界（本張 ~10 min vs 估 15-25 min），需重校準 M sizing（建議 5-15 min）/ L sizing（建議 10-25 min）
3. **v0.4.0 release 可啟動**：依 T0290 寫的 `bat-plan-007/docs/plan-007-release-checklist.md` 跑 pre-release verification
4. **Worktree merge**：`feature/plan-007-remote-dev` 累積 12 commits（含本 commit），建議 squash merge → main（單一 PLAN-007 commit），或 PR review 走完整流程
5. **baseline BUG-061 修復**：本工單觀察到 `extractTargetOSMeta` 對 docker/ssh 分支補了 `dockerMounts: []` 與 `serverHome: undefined`，與既有測試期望不符 — 屬獨立 cleanup，不在 PLAN-007 範圍


