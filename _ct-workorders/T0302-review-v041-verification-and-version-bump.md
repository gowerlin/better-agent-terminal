# T0302 — Review v0.4.1 BUG Fix Verification + Version Bump 0.4.0→0.4.1 + CHANGELOG

## Metadata

| 欄位 | 內容 |
|------|------|
| 工單編號 | T0302 |
| 類型 | review + admin（驗證 + 版本 bump + CHANGELOG，**允許**寫 CHANGELOG / package.json / version-info.ts） |
| Phase | v0.4.1 patch chain 收尾（最後一張）|
| 狀態 | 📋 TODO |
| 建立時間 | 2026-04-26 18:58 (UTC+8) |
| 派發時間 | （待派） |
| 完成時間 | （待） |
| Wall time | （待） |
| Sizing | M（GP099 校準後預期 wall 10-20 min — 7 BUG fix grep 驗證 + 跑全 test + bump version + CHANGELOG + 給 release decision） |
| 依賴 | T0298 ✅、T0299 ✅、T0300 ✅、T0301 ✅、BUG-062~068（v0.4.1 backlog） |
| 後續 | v0.4.1 release decision：GO → 進行 tag + push trigger CI |
| 工作目錄 | **main repo**，branch **`release/v0.4.0`**（本工單會 bump version + CHANGELOG，但**不**做 git tag 也不 push；tag/push 留人工執行） |
| Renew 次數 | 0 |
| 互動旗標 | `--mode yolo --no-interactive`（fire-and-forget） |
| `affects_files` | `_ct-workorders/T0302-verification-report.md`（新建）、`package.json`（version bump）、`CHANGELOG.md`（v0.4.1 條目）、可能 `electron/version-info.ts` 或同步點 |

## 目標

對 T0299-T0301 的修復做 **v0.4.1 sanity check**，並完成 release prep：

1. 7 個 v0.4.1 BUG（BUG-062~068）每個一一比對 fix 落地
2. 跑全 test suite 確認 zero regression
3. 跑 baseline tsc 確認 error count drift = 0
4. **bump version 0.4.0→0.4.1**（`package.json` + 同步點）
5. **CHANGELOG.md v0.4.1 條目**（Added / Changed / Fixed / Known issues）
6. 給 v0.4.1 Release Decision：GO / NO-GO / GO-with-blocker

## 範圍

### 執行步驟

1. **讀 BUG-062~068 metadata + T0299/T0300/T0301 工單回報區**（refresh fix 範圍）
2. **比對 fix 落地**（7 個 BUG 一一驗證）：

| BUG | 修復工單 | 落地檢查 grep |
|-----|---------|------------|
| BUG-062 | T0300 | `grep -nA2 "fingerprint-mismatch" electron/remote/remote-client.ts` 含 `return` 在 close 後 |
| BUG-063 | T0299 | `grep -n shutdownSshProcess electron/remote/ssh-tunnel.ts ssh-start-server.ts ssh-auth-probe.ts` 三處皆有 |
| BUG-064 | T0301 | `grep -n buildBaseSshSpawnEnv electron/remote/ssh-args.ts` + 4 模組 spawn 處 env override |
| BUG-065 | T0301 | `grep -n PATH_ARG_SCHEMA electron/remote/path-aware-channels.ts` 含 schema table |
| BUG-066 | T0300 | `grep -nA3 "runPromise = null" src/components/setup-wizard/wizard-runner.ts` |
| BUG-067 | T0299 | `grep -nA2 "await this.tunnel" electron/remote/remote-client.ts` 在 disconnect 內 |
| BUG-068 | T0300 | `grep -nB2 "const translator = this.translator" electron/remote/remote-client.ts::invoke` |

3. **跑全 test suite**（npm test 或 npx tsx 各檔）：
   - ssh-process-lifecycle.test.ts（T0299 新建）
   - ssh-args.test.ts（T0296 + T0301）
   - path-aware-channels.test.ts（T0301 新建/擴）
   - remote-client-middleware.test.ts（T0300 + T0301 補）
   - wizard-runner.test.ts（T0300 補）
   - 既有所有 ssh / path-translator / docker-path / wizard-rollback test
4. **跑 tsc baseline**：應 = 36（沿用 BUG-061 family）
5. **Version bump**：
   - `package.json` 的 `"version"` 從 `0.4.0` (or current) → `0.4.1`
   - 若 `electron/version-info.ts` 或同步點有 hardcode → 同步更新
   - **grep 確認所有 hardcode version 同步**：`grep -rn '"0\.4\.0"' --include="*.json" --include="*.ts"` 等
6. **CHANGELOG.md v0.4.1 條目**：
   ```markdown
   ## [0.4.1] - 2026-04-26

   ### Fixed
   - **BUG-062** (F-006): RemoteClient fingerprint mismatch handler now early-returns
   - **BUG-063** (F-007 + EC-009): SSH child processes have SIGKILL escalation via `shutdownSshProcess`
   - **BUG-064** (F-008): SSH stderr i18n — `LANG=C LC_MESSAGES=C LC_ALL=C` injected for English-only stderr
   - **BUG-065** (EC-004): `translateInvokeArgs` schema-driven — supports `git:diff-files` etc. multi-path channels
   - **BUG-066** (EC-005): `WizardRunner.run()` now resets `runPromise` on failure to allow retry
   - **BUG-067** (EC-006): `RemoteClient.disconnect()` now async, awaits `tunnel.stop()`
   - **BUG-068** (EC-007): `RemoteClient.invoke` freezes translator reference per-invoke

   ### Internal
   - New shared helper `electron/remote/ssh-process-lifecycle.ts::shutdownSshProcess`
   - New `PATH_ARG_SCHEMA` table in `electron/remote/path-aware-channels.ts`
   - Cross-test-suite: 250+ tests pass / 0 fail / baseline drift 0

   ### Known
   - **BUG-061**: `src/components/CodexAgentPanel.tsx` baseline tsc errors (dev-only, runtime unaffected)
   ```
7. **產出 verification report**

### 報告格式（`T0302-verification-report.md`）

```markdown
# T0302 — v0.4.1 Verification + Release Readiness Report

## 整體驗證結果
<v0.4.1 7 個 BUG 是否全部落地 / test 全綠 / baseline drift 0 / release decision>

## BUG Fix 落地驗證（7 BUG）

| BUG | 修復工單 | 落地證據 | 狀態 |
|-----|---------|---------|------|
| BUG-062 | T0300 | <grep result> | ✅/❌ |
| ... | | | |

## Test Suite 結果

| 測試檔 | 結果 |
|-------|------|

## TypeScript Baseline

| 修復前 | 修復後 |
|-------|-------|
| 36 | <實際> |

## Version Bump

- package.json: 0.4.0 → 0.4.1
- 同步點: <列出>

## CHANGELOG v0.4.1

<已更新章節摘要>

## v0.4.1 Release Decision

**Verdict**: GO / NO-GO / GO-with-blocker

**v0.4.0+v0.4.1 累計**:
- 8 必修 finding 修完（v0.4.0）
- 7 緩修 BUG 修完（v0.4.1）
- 0 baseline drift
- 250+ tests green

**Pre-release checklist 待跑**（人工執行）：
- WSL/Docker/SSH real e2e
- v0.4.1 tag + push trigger CI
- Homebrew tap 更新
```

## AC（驗收條件）

| # | 條件 | 驗收方式 |
|---|------|---------|
| AC1 | `_ct-workorders/T0302-verification-report.md` 存在，含 7 BUG 落地表 + Test 結果 + Version bump + CHANGELOG + Release Decision | grep |
| AC2 | 7 BUG（062-068）每個都有「落地證據」grep 結果記錄 | 計數 |
| AC3 | Test Suite 結果記錄至少 10 個 test 檔（含 T0299/T0300/T0301 新建/擴 4 個 + 既有） | 計數 |
| AC4 | TypeScript baseline drift 比對：實際 error count 記錄 + 與 baseline 36 比對 | grep |
| AC5 | `package.json` version 已 bump 到 `0.4.1` | grep |
| AC6 | 同步點 hardcode version 全部更新（`grep -rn '"0\.4\.0"'` 應為空，除 CHANGELOG 歷史條目） | 跑指令 |
| AC7 | `CHANGELOG.md` 含 `[0.4.1]` section + Fixed 7 BUG 條目 + Internal + Known | grep |
| AC8 | Release Decision 給明確 GO / NO-GO / GO-with-blocker 結論 | grep |
| AC9 | Worker **不**做 `git tag` 也不 `git push`（留人工執行） | git log 確認無 tag |
| AC10 | 所有變更 commit 到 release/v0.4.0 branch（一個 commit 含 verification report + version bump + CHANGELOG） | git log |

## 守則（嚴格）

1. **工作分支**：main repo cwd，**`release/v0.4.0`** branch
2. **commit message**：`chore(release): T0302 v0.4.1 verification + version bump 0.4.0→0.4.1 + CHANGELOG\n\n工單：T0302\n依賴：T0298 + T0299 + T0300 + T0301 + BUG-062~068\nverdict: <GO/NO-GO/GO-with-blocker>`
3. **工單檔不寫**：Worker 嚴禁修改主線 `_ct-workorders/T0302-*.md` 工單檔本身（**例外**：產出 `T0302-verification-report.md` 為新檔）
4. **工具白名單**：Read / Write（verification-report + CHANGELOG + package.json + version-info.ts）/ Edit / Bash（git/grep/npx/npm test）/ Grep / Glob
5. **emoji**：✅/❌ 落地表用；其他禁用
6. **不 tag / 不 push**：留人工執行；本工單只 bump version + commit
7. **誠實判定**：fix 不在或 test fail，**直接** mark NO-GO
8. **CHANGELOG format**：沿用既有 conventions
9. **跑 test 必收**：每個 test 結果 pass/fail count 必記
10. **completion 判定**：10 AC 全過或 ≥ 8 → `T0302 完成`

## 預期 wall

**10-20 min**（GP099 校準後；7 BUG grep + ~10 test 跑 + version bump + CHANGELOG + report）

## 工單回報區

（Worker 完成後在此補回報；塔台會在收到「T0302 完成」訊息後從本檔讀回報區）
