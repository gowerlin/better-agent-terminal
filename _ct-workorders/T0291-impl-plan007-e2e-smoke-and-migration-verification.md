# T0291 — Impl PLAN-007 Phase 5 E2E Smoke + Profile Schema Migration Verification（PLAN-007 capstone）

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0291 |
| 類型 | impl（test only，無 production runtime code 改動） |
| Phase | PLAN-007 Phase 5（整合測試 + UX polish）第四張 = **PLAN-007 全案最終張** |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 16:25 (UTC+8) |
| 派發時間 | （待派） |
| 完成時間 | （待） |
| Wall time | （待） |
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

（Worker 完成後在此補回報；塔台會在收到「T0291 完成」訊息後從本檔讀回報區）
