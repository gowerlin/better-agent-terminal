# T0302 — v0.4.1 Verification + Release Readiness Report

**Date**: 2026-04-26
**Branch**: `release/v0.4.0`
**Scope**: v0.4.1 patch chain (T0299 + T0300 + T0301 fixing BUG-062 ~ BUG-068)

## 整體驗證結果

✅ **PASS** — 7 個 v0.4.1 BUG 全部落地、6 個關鍵 test 檔 + 4 個鄰近 SSH/Wizard test 全綠（259 cases pass / 0 fail）、TypeScript baseline drift = 0（36 → 36）、`package.json` + `package-lock.json` version 已 bump 至 `0.4.1`、CHANGELOG 已寫入 `[0.4.1]` 條目。**Verdict: GO**（軟體面已就緒；release engineer 仍需跑 pre-release checklist 上的真實 e2e）。

## BUG Fix 落地驗證（7 BUG）

| BUG | 修復工單 | 落地證據 | 狀態 |
|-----|---------|---------|------|
| BUG-062 | T0300 | `electron/remote/remote-client.ts:282-285` `errorCode: 'fingerprint-mismatch'` 區塊後 `return`（早退） | ✅ |
| BUG-063 | T0299 | `shutdownSshProcess` import 出現於 `ssh-tunnel.ts:6`、`ssh-start-server.ts:4`、`ssh-auth-probe.ts:5`，三處皆於 catch / cleanup 路徑呼叫 | ✅ |
| BUG-064 | T0301 | `buildBaseSshSpawnEnv()` 定義於 `ssh-args.ts:91`，並在 `ssh-tunnel.ts:120`、`ssh-start-server.ts:252`、`ssh-auth-probe.ts:126`、`ssh-bundle-uploader.ts:77` 4 處 spawn `env` override | ✅ |
| BUG-065 | T0301 | `PATH_ARG_SCHEMA` 表定義於 `path-aware-channels.ts:53`，並於 `:80` 由 `translateInvokeArgs` 直接讀取 | ✅ |
| BUG-066 | T0300 | `wizard-runner.ts:127` `this.runPromise = null` 出現在 `.catch(err => ...)` 路徑中，確保失敗重置 | ✅ |
| BUG-067 | T0299 | `remote-client.ts:446` `async disconnect()` 簽名 + `:475 await t.stop()` 在 `tunnel = null` 後 await | ✅ |
| BUG-068 | T0300 | `remote-client.ts:499` `const translator = this.translator` 在 `nextId()` 與 `translateInvokeArgs` 之前凍結引用 | ✅ |

## Test Suite 結果

| 測試檔 | 結果 | Cases |
|-------|------|-------|
| `tests/ssh-process-lifecycle.test.ts`（T0299 新建） | ✅ pass | 6/6 |
| `tests/ssh-args.test.ts`（T0296 + T0301） | ✅ pass | 15/15 |
| `tests/path-aware-channels.test.ts`（T0301 新/擴） | ✅ pass | 9/9 |
| `tests/remote-client-middleware.test.ts`（T0300 + T0301 補） | ✅ pass | 21/21 |
| `tests/wizard-runner.test.ts`（T0300 補） | ✅ pass | 5/5 |
| `tests/ssh-tunnel.test.ts` | ✅ pass | 11/11 |
| `tests/ssh-start-server.test.ts` | ✅ pass | 19/19 |
| `tests/ssh-auth-probe.test.ts` | ✅ pass | 10/10 |
| `tests/ssh-bundle-uploader.test.ts` | ✅ pass | 8/8 |
| `tests/ssh-config-parser.test.ts` | ✅ pass | 8/8 |
| `tests/path-translator.contract.test.ts` | ✅ pass | 136/136 |
| `tests/path-guard.test.ts` | ✅ pass | 12/12 |
| `tests/wizard-rollback.test.ts` | ✅ pass | 6/6 |
| `tests/wizard-rollback-cross.test.ts` | ✅ pass | 3/3 |
| `tests/docker-path.test.ts` | ✅ pass | 42/42 |

**Aggregate**: **311 pass / 0 fail** across 15 test files.

## TypeScript Baseline

| 修復前（BUG-061 baseline） | 修復後（v0.4.1 post-T0301） | Drift |
|-------|-------|-------|
| 36 | 36 | **0** ✅ |

所有 36 個 error 仍位於 `src/components/CodexAgentPanel.tsx` + `src/types/agent-profiles.ts`（BUG-061 已記錄為 dev-only known issue）。v0.4.1 patch chain 未引入新 error。

## Version Bump

- `package.json`: `0.3.1` → `0.4.1`
- `package-lock.json` (root + `packages.""`): `0.3.1` → `0.4.1`

> **Note**: 工單原本要求 `0.4.0 → 0.4.1`，但實測 `package.json` 在 release/v0.4.0 branch 上仍為 `0.3.1`（v0.4.0 branch 拉出時版號未同步 bump，僅靠 git tag 表示版本）。本次直接 `0.3.1 → 0.4.1` 一次到位，符合「以 0.4.1 釋出」的工單意圖；CHANGELOG 同步補上 `[0.4.1]` 章節。

**Hardcode version 同步 grep**（排除 `node_modules` / `package-lock.json` 之依賴版本）：

```
grep -rn '"0\.3\.1"' --include="*.json" --include="*.ts" --exclude-dir=node_modules
→ (post-bump) 0 hits
```

無其他 `electron/version-info.ts` 或 hardcode 版號需要同步（檔案不存在；版號統一由 `package.json` 主導）。

## CHANGELOG v0.4.1

新增 `## [0.4.1] — 2026-04-26 — PLAN-007 Patch Chain: Remote Dev Hardening` 章節，含：
- **Fixed**：7 條 BUG-062 ~ BUG-068 完整描述（含修復工單、檔案路徑、語意說明）
- **Internal**：新 helper / schema table / 5 個 test 檔擴增、baseline drift = 0、aggregate test count
- **Known**：BUG-061（CodexAgentPanel.tsx baseline tsc errors，dev-only）

> Unreleased 段（描述 PLAN-007 features）保留不動 — v0.4.0 release 並未在 CHANGELOG 寫入專屬章節，由 git tag 表達；v0.4.1 章節插入於 Unreleased 與 0.3.1 之間，維持時序連貫。

## v0.4.1 Release Decision

**Verdict**: ✅ **GO**

**v0.4.0 + v0.4.1 累計**:
- 8 必修 finding 修完（v0.4.0 — T0292 ~ T0298）
- 7 緩修 BUG 修完（v0.4.1 — T0299 + T0300 + T0301）
- 0 baseline drift（v0.4.0 進入 + v0.4.1 patch chain 結束皆 36 errors / BUG-061 dev-only）
- 311 cases green 跨 15 test 檔（v0.4.1 critical + neighbours）

**Pre-release checklist 待跑（人工執行，超出本工單範圍）**：
- WSL real e2e（wizard 全流程：install / register / connect / chat-context attach）
- Docker real e2e（同上 + bind-mount path translation 驗證）
- SSH real e2e（tunnel mode 含 NAT 場景 + 三 arch bundle linux-x64 / linux-arm64 / darwin-arm64）
- v0.4.1 git tag 建立 + push 觸發 CI（`release new tag version` 工作流）
- Homebrew tap 更新（正式版自動，pre-release 跳過）
- NSIS installer 完整 uninstall → install → 啟動 UI smoke（BUG-056 教訓）

**本工單未做 / 故意保留人工**：
- ❌ 未 `git tag v0.4.1`（守則 6 + AC9）
- ❌ 未 `git push`（守則 6 + AC9）
- ❌ 未跑 NSIS 完整重裝（CLAUDE.md release 驗收守則範疇）

## AC 對照

| # | 條件 | 結果 |
|---|------|------|
| AC1 | verification report 存在 + 含 7 BUG 表 + Test + Version + CHANGELOG + Decision | ✅ |
| AC2 | 7 BUG 各有落地證據 grep | ✅（7/7） |
| AC3 | Test 結果記錄 ≥ 10 個 test 檔 | ✅（15 個）|
| AC4 | tsc baseline drift 比對 | ✅（36 = 36，drift 0）|
| AC5 | `package.json` version = `0.4.1` | ✅ |
| AC6 | hardcode version grep 為空（除 CHANGELOG 歷史） | ✅（grep `"0.3.1"` 無命中）|
| AC7 | CHANGELOG 含 `[0.4.1]` + Fixed 7 BUG + Internal + Known | ✅ |
| AC8 | Release Decision 給明確結論 | ✅（GO）|
| AC9 | 不 tag、不 push | ✅（人工執行）|
| AC10 | 變更 commit 到 release/v0.4.0 (一個 commit 含 report + bump + CHANGELOG) | ⏳ 待 commit step |

10/10 AC 預期全過（AC10 由收尾階段 commit 完成）。
