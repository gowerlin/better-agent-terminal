# T0298 — Review T0294-T0297 Fix Verification + v0.4.0 Release Readiness Sanity Check

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0298 |
| 類型 | review（純讀，無 production code 修改） |
| Phase | PLAN-007 release prep — fix chain 收尾驗證 |
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 18:00 (UTC+8) |
| 派發時間 | （待派） |
| 完成時間 | （待） |
| Wall time | （待） |
| Sizing | M（GP099 校準後預期 wall 10-20 min — 比對 6 finding 的 fix 落地 + 跑全 test + 給 release decision） |
| 依賴 | T0292 / T0293 review reports + T0294-T0297 fix workorders |
| 後續 | release decision：GO / NO-GO（依 verdict 決定 v0.4.0 release 流程） |
| 工作目錄 | **main repo**，branch **`release/v0.4.0`** |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `_ct-workorders/T0298-verification-report.md`（新建，verification 產出檔；Worker 唯一寫入目標） |

## 目標

對 T0294-T0297 fix workorders 的修復做**最後 sanity check**：

1. **每個必修 finding 比對「fix 是否落地」**：F-001 / F-002 / F-003 / F-004 / F-005 / EC-001 / EC-002 / EC-003 共 8 個（含合併修）
2. **跑全 test suite 確認 zero regression**
3. **跑 baseline tsc 確認 error count drift = 0（沿用 36）**
4. **給 v0.4.0 release decision**：GO / NO-GO / GO-with-blocker

不做 fresh adversarial review（T0292/T0293 已涵蓋）；本工單**只**驗證 fix 是否確實落地 + 整體健康度。

## 範圍

### 執行步驟

1. **讀 T0292 + T0293 review reports**（refresh 必修 finding 清單）
2. **讀 T0294-T0297 工單檔的 commit body / 回報區**（確認 fix scope）
3. **比對 fix 落地**（每個 finding 一個 verify item）：

| Finding | 來源 | 修法落地檢查 |
|---------|------|------------|
| F-001 | T0292 | `grep -n startsWithPath electron/remote/path-translator.ts src/utils/docker-path.ts`（共用 helper 存在） + `grep -n "/Users/al" tests/path-translator.contract.test.ts`（fixture 存在） |
| EC-001 | T0293 | `grep -n "isValidMount\|degenerate" src/utils/docker-path.ts`（filter / throw 存在） + `grep -n "clientHome === ''" electron/remote/path-translator.ts`（throw 存在） |
| F-002 | T0292 | `grep -n "sha256" scripts/build-server-bundle.mjs`（README 不再含 sha 字串） |
| F-003 | T0292 | `grep -n "SHASUMS" scripts/build-server-bundle.mjs`（SHASUMS 下載 + 比對存在） |
| F-004 | T0292 | `grep -n "validateSshIdentifier\|leading.*-" electron/remote/ssh-args.ts`（leading `-` reject 存在） |
| EC-002 | T0293 | `grep -n "\\\\r" electron/remote/ssh-args.ts`（CR reject 存在） |
| EC-003 | T0293 | `grep -n "BatchMode" electron/remote/ssh-args.ts electron/remote/ssh-tunnel.ts`（BatchMode 存在於 4 個 ssh 模組共用 helper） |
| F-005 | T0292 | `grep -n "escapeXml\|escapeXML" electron/remote/ssh-start-server.ts`（XML escape 存在於 plist） |

4. **跑 test suite**：
   - `npx tsx tests/ssh-args.test.ts`
   - `npx tsx tests/ssh-start-server.test.ts`
   - `npx tsx tests/ssh-tunnel.test.ts`
   - `npx tsx tests/ssh-bundle-uploader.test.ts`
   - `npx tsx tests/ssh-auth-probe.test.ts`
   - `npx tsx tests/path-translator.contract.test.ts`
   - `npx tsx tests/docker-path.test.ts`
   - `npx tsx tests/wizard-rollback.test.ts`
   - 其他既有 PLAN-007 test
5. **跑 tsc baseline 比對**：
   - `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "error TS" | wc -l` → 應 = 36（baseline）
6. **產出 verification report**

### 報告格式（`T0298-verification-report.md`）

```markdown
# T0298 — Fix Verification + v0.4.0 Release Readiness Report

## 整體驗證結果
<3-5 句話：8 個必修 finding 是否全部落地 / test 是否全綠 / baseline drift 是否為 0 / release decision>

## Finding Fix 落地驗證

| Finding | Source | 修復工單 | 落地證據 | 狀態 |
|---------|--------|---------|---------|------|
| F-001 | T0292 | T0294 | grep startsWithPath: `electron/remote/path-translator.ts:N` + `src/utils/docker-path.ts:N` | ✅/❌ |
| EC-001 | T0293 | T0294 | grep degenerate handling: ... | ✅/❌ |
| F-002 | T0292 | T0295 | ... | ✅/❌ |
| F-003 | T0292 | T0295 | ... | ✅/❌ |
| F-004 | T0292 | T0296 | ... | ✅/❌ |
| EC-002 | T0293 | T0296 | ... | ✅/❌ |
| EC-003 | T0293 | T0296 | ... | ✅/❌ |
| F-005 | T0292 | T0297 | ... | ✅/❌ |

## Test Suite 結果

| 測試檔 | 結果 |
|-------|------|
| ssh-args.test.ts | N pass / 0 fail |
| ssh-start-server.test.ts | N pass / 0 fail |
| ... | ... |
| **Total** | **N pass / 0 fail** |

## TypeScript Baseline

| 指標 | 修復前 | 修復後 |
|------|-------|-------|
| Error count | 36 | <實際> |
| Drift | – | 0 / +N |

## v0.4.0 Release Decision

**Verdict**: GO / NO-GO / GO-with-blocker

**理由**：
- <8 個必修 finding 落地與否>
- <test regression 與否>
- <baseline drift 是否在 +0 或可接受 +N>

**v0.4.1 backlog 確認**：BUG-062~068 共 7 張 ✅ 已開單追蹤

**Pre-release checklist 待跑**（人工執行，依 docs/plan-007-release-checklist.md）：
- WSL real e2e
- Docker real e2e
- SSH real e2e (3 platform + 1 cross-OS)
- Migration verification
- v0.4.0 tag + push trigger CI
```

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `_ct-workorders/T0298-verification-report.md` 存在，含 4 個必要章節（整體驗證 / Finding Fix 落地表 / Test Suite 結果 / Release Decision） | grep + 視覺 |
| AC2 | 8 個必修 finding（F-001/F-002/F-003/F-004/F-005/EC-001/EC-002/EC-003）每個都有「落地證據」grep 結果記錄 | 計數 |
| AC3 | Test Suite 結果記錄至少 8 個 test 檔（含 ssh-args + ssh-* 4 個 + path-translator + docker-path + 其他） | 計數 |
| AC4 | TypeScript baseline drift 比對：實際 error count 記錄 + 與 baseline 36 比對 | grep |
| AC5 | Release Decision 給明確 GO / NO-GO / GO-with-blocker 結論 + 理由 | grep |
| AC6 | v0.4.1 backlog 確認 BUG-062~068 存在（grep `_ct-workorders/BUG-06[2-8]-*.md` 檔案存在） | grep |
| AC7 | Pre-release checklist 待跑項目列出（指向 `docs/plan-007-release-checklist.md`） | grep |
| AC8 | Worker **不修** 任何 production code | git diff 應只動 T0298-verification-report.md |
| AC9 | 報告引用至少 8 個具體檔:行 reference（避免空泛驗證） | grep |
| AC10 | 報告長度 100-400 行（簡潔 verification，不需 deep dive） | wc -l |

## 守則（嚴格）

1. **工作分支**：main repo cwd，**`release/v0.4.0`** branch
2. **review-only**：禁止修改 production code，唯一寫入 `T0298-verification-report.md`
3. **commit message**：`docs(review): T0298 fix verification + v0.4.0 release readiness report\n\n工單：T0298\n依賴：T0292/T0293 reviews + T0294-T0297 fixes\nverdict: <GO/NO-GO/GO-with-blocker>`
4. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0298-*.md` 工單檔本身
5. **工具白名單**：Read / Write（only verification-report.md）/ Bash（git/grep/npx tsx/tsc/npm test）/ Grep / Glob
6. **不重新 review**：不 fresh adversarial / edge-case review；只驗證 T0292/T0293 列出的 8 個必修 finding 是否落地
7. **誠實判定**：fix 不在或 test fail，**直接** mark NO-GO；不要為了「rush release」隱藏問題
8. **emoji**：✅/❌ 落地表用；其他禁用
9. **跑 test 必收**：每個 test 結果（pass/fail count）必記，不可跳過
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0298 完成`

## 預期 wall

**10-20 min**（GP099 校準後；review-only，主要工作為 grep 8 個 fix 落地 + 跑 ~8 個 test 檔 + 寫精簡 report）

## 工單回報區

（Worker 在 commit body / 完成訊息簡述產出；verification 詳情寫在 `T0298-verification-report.md`）
