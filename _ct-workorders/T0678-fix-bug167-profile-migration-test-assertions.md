---
schema_version: 1
schema_kind: workorder
id: T0678
title: "BUG-167：profile-manager 遷移測試的 2 項斷言跟上新增的 profile 欄位；順帶盤點 tests/ 底下其他用 tsx 執行的測試"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-167
priority: P3
sizing: S
created_at: "2026-10-21T19:17:17+0800"
started_at: "2026-10-21T19:20:43+0800"
updated_at: "2026-10-21T19:51:06+0800"
completed_at: "2026-10-21T19:51:06+0800"
depends_on: []
related:
  - "BUG-167（T0677 Worker 發現：docker-linux、ssh-linux 兩個情境的 metadata 斷言失敗，HEAD 同樣 10 / 2）"
  - "多 remote profile 規則：CLAUDE.md「多 remote profile 同時連線（PLAN-039）」節、`docs/agent-guide/multi-remote-profiles.md`；profile index 讀改寫一律經 `withIndexLock()`（`electron/profile-manager.ts`）"
affects_files:
  - tests/profile-manager-migration.test.ts
  - _ct-workorders/BUG-167-profile-manager-migration-test-stale-assertions.md
  - _ct-workorders/T0678-fix-bug167-profile-migration-test-assertions.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 先查清楚再改：用 `git log -S`／`git log -p` 找出多出來的欄位是哪個 commit／工單加的，確認遷移後的 profile 應不應該帶這些欄位。是預期行為 → 只改 `tests/profile-manager-migration.test.ts` 的斷言；看起來是遷移邏輯錯誤 → **不要改產品程式**，依 ct-exec § Questions For Tower 問塔台（附證據）。"
  - "🔴 斷言要寫成能抓到真錯誤的樣子：列出預期的欄位與值，不要為了通過改成只比對部分欄位或拿掉斷言。若新欄位的值會隨環境變動（時間戳、隨機 id），只對那幾個欄位放寬，並在測試裡註明原因。"
  - "🔴 驗證：`npx tsx tests/profile-manager-migration.test.ts` 全過（記通過數）。只改測試檔時不必跑全套；若因故改到 `tests/` 以外的檔案，必跑 `npm run test:unit`、`npm run typecheck`、`npm run typecheck:electron`、`npx vite build`。"
  - "🔴 順帶盤點（只跑、不修）：列出 `tests/` 底下不在 `npm run test:unit` 範圍的測試檔（查 `vite.config.ts` 的 test.include 與 `package.json` scripts），逐一用它的實際跑法執行一次，記下通過／失敗數。手動 probe（例如 `_` 開頭、需要本機特定路徑的）只記「略過與原因」。有失敗的列出檔名與失敗項目名稱，不在本單修。"
  - "🔴 本單完成時把 BUG-167 的 `status` 改成 FIXED、`updated_at` 取自系統、狀態欄寫上 commit；`_bug-tracker.md` 由塔台同步，不要改。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，測試資料與回報只用代稱與 `demo`／`tester` 這類範例值。"
  - "🔴 Git：`git commit --only <檔案>`；不 push。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF。含反斜線的內容用 Write／Edit 工具寫（L129）。不跑 Playwright e2e。yolo：不得問使用者，判讀問題問塔台；不得在任何地方寫出權杖值。"
---

# T0678 — BUG-167：遷移測試的斷言跟上新增的 profile 欄位

## 目標

`tests/profile-manager-migration.test.ts` 有 2 項斷言失敗（docker-linux、ssh-linux 的 metadata），實際值比期望多了後來新增的 profile 欄位。這個檔案不在 `test:unit`，CI 沒跑，所以一直沒被發現。本單查清楚欄位來源，確認是測試沒跟上之後更新斷言；並順帶盤點 `tests/` 底下其他同樣沒被跑到的測試。

## 要做的事

1. 跑一次測試，記下兩個失敗項目的實際值與期望值差在哪些欄位。
2. 用 git 歷史找出這些欄位是哪個 commit／工單加的，讀那張工單的說明，判斷遷移後應不應該帶這些欄位。
3. 是預期行為：更新斷言（見 memory_overrides 的寫法要求）。不是：停下來問塔台。
4. 盤點 `tests/` 底下其他不在 `test:unit` 的測試（只跑、不修）。
5. 更新 BUG-167 狀態，commit。

## 驗收

- `npx tsx tests/profile-manager-migration.test.ts` 全過。
- 回報區寫明：多出來的欄位是什麼（欄位名即可）、來自哪個 commit／工單、為什麼判定是預期行為；盤點結果表（檔名、跑法、通過／失敗、略過原因）。
- 只改 `affects_files`；未 push。

---

## 回報區

### 完成狀態

DONE。兩項失敗斷言已跟上新增欄位；`npx tsx tests/profile-manager-migration.test.ts` 13 passed / 0 failed。盤點完成（只跑、不修）。

落點檢查：PASS。C-0 `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`；C-1 PASS；C-3 PASS（`tests/profile-manager-migration.test.ts` 存在）；無 `branch` 欄位（C-2 不適用），HEAD 在 `main`。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。`CT_MODE=yolo`、`CT_INTERACTIVE=0`。

### 欄位來源與判斷

- 失敗的不是遷移本身：`migrateProfile` 的 4 項一直通過。失敗的是 `extractTargetOSMeta`（`electron/profile-manager.ts`）的投影斷言。
- 改前實測：docker-linux 實際值多 `dockerMounts: []`；ssh-linux 實際值多 `serverHome: undefined`（`deepStrictEqual` 把值為 `undefined` 的鍵也算進去）。其他欄位與值都一致。

| 欄位 | 來源 commit | 工單 | 工單說明 |
|---|---|---|---|
| `dockerMounts` | `43d6eea4`（2026-04-26） | T0277 | 執行步驟明訂「`TargetOSMetadata` docker-linux case 加 `dockerMounts`（必填，因為 translator 需要）」「`extractTargetOSMeta` 中 docker-linux case 加 `dockerMounts: entry.dockerMounts ?? []`」，AC5 驗收此項；`DockerPathTranslator` 依它做路徑對應。 |
| `serverHome` | `462d4f88`（2026-04-26） | T0282 | Worker 範圍擴展「`ProfileEntry` / `TargetOSMetadata` / `extractTargetOSMeta` 三處同步加 `serverHome`」，`SshPathTranslator` 以它組路徑。 |

- 判定：預期行為。兩個欄位都是工單明訂加進投影的，consumer（`RemoteClient.maybeCreateTunnel`、path translator）依此型別；測試檔自 T0268（`81f58d36`）建立後只在 T0677 改過範例值，沒跟上 T0277 / T0282。測試不在 `test:unit`，所以沒被發現。未改產品程式，也不需問塔台。

### 修改內容

`tests/profile-manager-migration.test.ts`（只改這一個測試檔）：

- docker-linux：期望值補 `dockerMounts: []`（entry 未給 → 空陣列 fallback），測試名稱同步。
- 新增「docker-linux with dockerMounts → mounts passed through」：給一組 mount（範例路徑 `C:/Users/demo/project`），斷言完整物件，含 `dockerHost: undefined`。
- ssh-linux：entry 給 `serverHome: '/home/demo'`，期望值列出完整欄位含 `serverHome`，確保投影真的帶值（不是只放寬成 `undefined`）。
- ssh-darwin：補 `assert.strictEqual(meta.serverHome, undefined)`。
- 斷言都是完整物件比對，沒有放寬成部分欄位；新欄位的值都是確定值，不需要放寬。兩處加註解說明欄位來自 T0277 / T0282。

### 驗證結果

| 項目 | 結果 |
|---|---|
| `npx tsx tests/profile-manager-migration.test.ts`（改前） | 10 passed / 2 failed（docker-linux、ssh-linux） |
| `npx tsx tests/profile-manager-migration.test.ts`（改後） | ✅ 13 passed / 0 failed（原 12 項 + 新增 1 項） |
| 全套（test:unit / typecheck / vite build） | 未跑：只改 `tests/` 底下且不在 typecheck 與 test:unit 範圍的測試檔，依 memory_overrides 不必跑 |
| 換行 | commit 的 blob 為 LF（工作副本因 `core.autocrlf=true` 是 CRLF，與其他檔相同） |

### tests/ 盤點（只跑、不修）

範圍判定：`vite.config.ts` 的 `test.include` 對 `tests/` 只收 5 個 `.mjs`（`bat-terminal-msys` / `bat-notify-submit` / `bat-notify-auth-reject` / `bat-terminal-workorder-id` / `bat-terminal-response-correlation`），其餘全部不在 `test:unit`。跑法依檔案本身：自寫 harness（`passed` / `failed` 計數）→ `npx tsx <file>`；`import ... from 'node:test'` → `npx tsx --test <file>`（Node v24.22.0）。每檔上限 180 s；`BAT_HELPER_LOG_DIR` / `BAT_USER_DATA` 指到 scratchpad。執行時間 2026-10-21 19:2x–19:49（+0800）。

| 檔案 | 跑法 | 通過 | 失敗 | 備註 |
|---|---|---|---|---|
| `auth-result-metadata.test.ts` | tsx | 5 | 1 | ❌ RemoteClient catches pending translator implementations and falls back to Identity |
| `backlog-priority-parser.test.ts` | tsx | 8 | 0 | |
| `claude-code-path.test.ts` | tsx（`test:claude-code-path`） | 4 | 0 | |
| `claude-resolver.test.ts` | tsx | 20 | 0 | |
| `claude-runtime-router.test.ts` | tsx | 6 | 5 | ❌ T-R1、T-R3、T-R4、T-R5、T-R6 |
| `docker-flow.test.ts` | tsx --test | 2 | 1 | ❌ createDockerWizardContext seeds Docker-specific state（期望 9876，實際 undefined） |
| `docker-flow-journeys.test.ts` | tsx --test | 0 | — | ⏱ 逾時 180 s（停在 wizard 執行中，0 項完成） |
| `docker-path.test.ts` | tsx | 42 | 0 | |
| `docker-wizard-e2e.test.ts` | tsx --test | 0 | — | ⏱ 逾時 180 s |
| `docker-wizard-runner.test.ts` | tsx --test | 0 | — | ⏱ 逾時 180 s |
| `gpu-detector.test.ts` | tsx | 13 | 0 | |
| `node-resolver.test.ts` | tsx（`test:node-resolver`） | 19 | 0 | |
| `path-aware-channels.test.ts` | tsx --test | 9 | 0 | |
| `path-guard.test.ts` | tsx | 12 | 0 | |
| `path-translator.contract.test.ts` | tsx | 136 | 0 | |
| `plan-007-cross-env-smoke.test.ts` | tsx | 16 | 0 | |
| `profile-card.test.ts` | tsx --test | 9 | 4 | ❌ DockerDetails renders mount table…、ProfileCard is exported as a function component…、ProfileCard renders the per-env badge label…、SshDetails differentiates ssh-linux vs ssh-darwin… |
| `profile-manager-migration.test.ts` | tsx | 13 | 0 | 本單修正 |
| `profile-schema-migration.test.ts` | tsx | 18 | 0 | |
| `remote-client-middleware.test.ts` | tsx | 21 | 0 | |
| `remote-throttle.test.ts` | tsx | 15 | 0 | |
| `shell-path-resolver.test.ts` | tsx | 7 | 0 | |
| `ssh-args.test.ts` | tsx --test | 15 | 0 | |
| `ssh-auth-probe.test.ts` | tsx --test | 10 | 0 | |
| `ssh-bundle-uploader.test.ts` | tsx --test | 2 | 6 | ❌ test1、test2、test3、test4、test5c、test5d |
| `ssh-config-parser.test.ts` | tsx --test | 8 | 0 | |
| `ssh-flow.test.ts` | tsx --test | 5 | 0 | |
| `ssh-flow-journeys.test.ts` | tsx --test | 0 | — | ⏱ 逾時 180 s |
| `ssh-process-lifecycle.test.ts` | tsx --test | 6 | 0 | |
| `ssh-start-server.test.ts` | tsx --test | 14 | 5 | ❌ test1、test2、test3、test4、test8（systemd unit / launchd plist 內容與 ssh exec 順序） |
| `ssh-tunnel.test.ts` | tsx --test | 11 | 0 | |
| `ssh-wizard-e2e.test.ts` | tsx --test | 0 | — | ⏱ 逾時 180 s |
| `terminal-create-agent-command.integration.test.ts` | tsx | 1 | 0 | 無計數輸出，exit 0、1 項 ✅ |
| `wizard-rollback.test.ts` | tsx --test | 6 | 0 | |
| `wizard-rollback-cross.test.ts` | tsx --test | 0 | — | ⏱ 逾時 180 s |
| `wizard-runner.test.ts` | tsx --test | 1 | — | ⏱ 第 1 項（rolls back completed steps in reverse order）通過後，第 2 項卡住到逾時 |
| `wsl-detect.test.ts` | tsx --test | 9 | 1 | ❌ installBundle() rejects relative tarball paths before spawning WSL |
| `wsl-flow-journeys.test.ts` | tsx --test | 0 | — | ⏱ 逾時 180 s |
| `wsl-path.test.ts` | tsx --test | 21 | 0 | |
| `wsl-systemd.test.ts` | tsx --test | 3 | 6 | ❌ enableLinger ×2、renderSystemdUnit ×2、startService runs daemon-reload…、writeUnit writes via wsl tee stdin pipe |
| `wsl-wizard-e2e.test.ts` | tsx --test | 0 | — | ⏱ 逾時 180 s |

略過：

| 檔案 | 原因 |
|---|---|
| `_windows-probe.ts` | 手動 probe（檔頭：Not part of the test suite），偵測本機真實 claude |
| `console-test.js`（`test:console`） | 互動式終端（readline），需要人操作 |
| `console-controller.js` | 函式庫，不是測試 |
| `e2e/bug075-bat-auto-session.test.ts` | Playwright（`playwright.config` 的 `testMatch` 含 `tests/e2e/**/*.test.ts`），本單不跑 e2e |
| `__mocks__/electron-api.ts`、`testworkspace/*` | 測試輔助檔 / 資料 |

小計：不在 `test:unit` 的可執行測試 41 檔；全過 24 檔，有失敗 8 檔（共 29 項失敗），逾時 9 檔（`*-journeys`、`*-wizard-e2e`、`docker-wizard-runner`、`wizard-runner`、`wizard-rollback-cross`，看起來都卡在 `WizardRunner` 的某個步驟，未查原因）。

其他發現：`package.json` 的 `test:claude-ctrl-o`（`tests/test-claude-ctrl-o.js`）與 `diagnose:ctrl-o*`（`tests/diagnose-ctrl-o.js`）指向的檔案不存在。

### Commit

- 產品（測試）：`d90b3b50` `test(profile): T0678 align extractTargetOSMeta assertions with dockerMounts / serverHome (BUG-167)`（`git commit --only tests/profile-manager-migration.test.ts`）
- 工單與 BUG-167：本工單收尾 commit（`git commit --only` 兩個檔）。BUG-167 已改 `status: FIXED`、`updated_at` 取自系統、狀態欄寫上 `d90b3b50`，並補「修正結果」一節；`_bug-tracker.md` 未動（由塔台同步）。
- 未 push。

### 遭遇問題

- 無阻擋。盤點中有失敗與逾時的測試依工單只記錄、不修。建議塔台另開 BUG：① 9 個逾時檔（疑似 wizard 步驟等不到 mock 回應）；② 8 個有失敗的檔；③ 是否把 `tests/*.test.ts` 納入 `test:unit` 或 CI；④ `package.json` 兩組指向不存在檔案的 script。

### 回報時間

2026-10-21T19:50:09+0800
