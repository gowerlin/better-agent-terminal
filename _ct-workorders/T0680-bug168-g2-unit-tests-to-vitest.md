---
schema_version: 1
schema_kind: workorder
id: T0680
title: "BUG-168 G2：auth-result-metadata／claude-runtime-router／docker-flow／profile-card 四個舊測試跟上產品並收進 vitest（profile-card 改 RTL 實際渲染）"
type: fix
status: DONE
repo: better-agent-terminal
project: BUG-168
priority: P2
sizing: M
created_at: "2026-10-21T20:38:28+0800"
started_at: "2026-10-21T20:41:10+0800"
updated_at: "2026-10-21T20:51:18+0800"
completed_at: "2026-10-21T20:51:18+0800"
depends_on:
  - "T0679（DONE `6fb40e70`：逐項分類與證據）"
related:
  - "D177（G1～G4 全做、往 vitest 收斂）；BUG-168；T0679 回報區「調查結論」表（本單四個檔的失敗原因、產品位置、commit 與工單）"
  - "既有 vitest 版：`electron/__tests__/claude-runtime-router.test.ts`、`src/components/profiles/__tests__/SshDetails.test.tsx`、`electron/remote/__tests__/remote-client-*.test.ts`"
affects_files:
  - tests/auth-result-metadata.test.ts
  - tests/claude-runtime-router.test.ts
  - tests/docker-flow.test.ts
  - tests/profile-card.test.ts
  - electron/__tests__/claude-runtime-router.test.ts
  - "electron/remote/__tests__/remote-client-*.test.ts 或新檔 electron/remote/__tests__/auth-result-metadata.test.ts（只限這兩種名稱）"
  - "src/components/profiles/__tests__/**"
  - "src/components/setup-wizard/__tests__/docker-flow*.test.ts（新檔，若需要）"
  - _ct-workorders/T0680-bug168-g2-unit-tests-to-vitest.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改測試，不改產品程式。T0679 已判定這四個檔的失敗全部是測試過時（A），期望值以 T0679 表中的工單與決策為準，不要把舊的錯誤期望搬進 vitest。"
  - "🔴 收斂規則（D177）：每個 `tests/` 檔逐項比對 vitest 版；重複的不搬，獨有且仍有效的搬進 vitest（更新成現行正確的期望），最後刪掉 `tests/` 的舊檔。沒有 vitest 版的就新建在 `affects_files` 允許的位置。"
  - "🔴 個別要求：auth-result-metadata 的 fallback 覆蓋改用缺 `wslDistro` 的 profile（T0679 建議），不要刪掉 fallback 情境；claude-runtime-router 的 stub 補 `embeddedClaudeExists`；docker-flow 斷言 `serverPort` 為 `undefined`（T0649）；profile-card 改用 React Testing Library 實際渲染並初始化 i18n（比照既有 `src/components/profiles/__tests__/SshDetails.test.tsx` 與 repo 內其他 RTL 測試的做法），涵蓋 T0679 列的 4 個情境，並補上 ProfileCard、DockerDetails 目前沒有的 vitest 覆蓋。"
  - "🔴 不改 `package.json`、`vite.config.ts`、`tests/__mocks__/**`（G4 的範圍）。刪檔後若有 `package.json` script 指向它們，列在回報區，由後續 CI 工單清理。"
  - "🔴 同時有 T0681（SSH／WSL 舊測試）與 T0683（CI 第一步）的 Worker 在跑：只動 `affects_files`；commit 用 `git commit --only <檔案>`（刪檔用 `git rm` 後同樣只 commit 自己的路徑），不要 `git add -A`。"
  - "🔴 驗證：`npm run test:unit` 全過（記通過數與檔數，應比基線 5661 / 322 增加）、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功；刪掉的四個 `tests/` 檔在 repo 內（`package.json` 以外）沒有其他引用。"
  - "🔴 公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，測試資料用 `demo`／`tester`／代稱。Git：不 push；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。不跑 Playwright e2e。yolo：不得問使用者，判讀問題問塔台；不得寫出權杖值。"
---

# T0680 — BUG-168 G2：四個舊測試收進 vitest

## 目標

`tests/` 底下 auth-result-metadata、claude-runtime-router、docker-flow、profile-card 四個檔共 11 項失敗，T0679 判定全部是測試過時。依 D177 往 vitest 收斂：獨有且仍有效的情境搬進 vitest（期望值改成現行正確行為），重複的不搬，刪掉舊檔；profile-card 改用 RTL 實際渲染，順便補上 ProfileCard、DockerDetails 的 vitest 覆蓋。

## 要做的事

1. 讀 T0679 回報區這四個檔的分類表。
2. 逐檔比對 vitest 版，搬移獨有情境、更新期望值；沒有 vitest 版的新建。
3. 刪掉四個 `tests/` 舊檔（`git rm`）。
4. 驗證、commit（不 push）。

## 驗收

- 四個舊檔已刪；獨有情境在 vitest 版都有對應（回報區列對照表：舊項目 → 新位置，或「重複，未搬」）。
- `test:unit` 全過且數量增加；typecheck 0／0；build 成功。
- 只改 `affects_files`；未 push。

---

## 回報區

### 完成狀態

DONE。四個 `tests/` 舊檔已 `git rm`；獨有且仍有效的情境搬進 vitest（期望值改成現行行為），重複的不搬；profile-card 改成 RTL 實際渲染 + i18n，並補上 ProfileCard、ProfileCardDetails、DockerDetails 的 vitest 覆蓋。只改測試，產品程式未動。

**Landing check**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 抽查的 `tests/*.test.ts`、`electron/__tests__/claude-runtime-router.test.ts`、`src/components/profiles/__tests__/` 都在；C-2 無 `branch` 欄位。`CT_HOME` 未設（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

### 對照表（舊項目 → vitest 位置／重複未搬）

**`tests/auth-result-metadata.test.ts`（6 項）→ 新檔 `electron/remote/__tests__/auth-result-metadata.test.ts`（6 項）**。原本沒有任何 vitest 覆蓋 `applyAuthResult` / `serverMetadata`。

| 舊項目 | 新位置 |
|---|---|
| AuthResult accepts legacy boolean true | 與下一項併為 `AuthResult accepts the legacy boolean and the metadata object` |
| AuthResult accepts metadata object payload | 同上 |
| RemoteClient stores metadata when auth-result carries an object | `stores the metadata when auth-result carries an object`（另斷言 local → Identity） |
| falls back to IdentityTranslator for legacy boolean auth-result | `a legacy boolean auth-result clears the metadata and uses Identity`（先套 metadata 再套 `true`，確認會清掉） |
| keeps IdentityTranslator when profile targetOS is undefined | `keeps Identity when the profile has no targetOS` |
| catches pending translator implementations and falls back to Identity（❌ 舊期望） | 改用缺 `wslDistro` 的 wsl-linux profile：`falls back to Identity when the profile cannot build its translator`（斷言 metadata 仍保存、Identity、`logger.warn` 一次且含 `missing wslDistro`）；另加 `a wsl-linux profile with wslDistro gets the WSL translator (T0273)` 斷言現行 `WslPathTranslator` |

讀 translator 改用公開 getter `pathTranslator`（T0437），不再讀私有欄位；`applyAuthResult` 仍是私有方法，比照舊檔以 cast 呼叫。

**`tests/claude-runtime-router.test.ts`（T-R1～T-R11）→ 附加到 `electron/__tests__/claude-runtime-router.test.ts` 的兩個 describe（`resolveClaudeRuntime fallback branches (T0233)`、`shouldEmitRuntimeEvent / clearRuntimeEventHistory (T0233)`），stub 補 `embeddedClaudeExists: () => true`**

| 舊項目 | vitest 既有覆蓋 | 處置 |
|---|---|---|
| T-R1 embedded，不呼叫 detector | `defaults to the configured layout…` 有回傳值，但沒斷言 detector 未被呼叫 | 搬（`T-R1: …`，`toEqual` 完整回傳 + `not.toHaveBeenCalled`） |
| T-R2 system healthy | customPath 系列有 path / systemVersion，沒有「無 customPath」且沒斷言 `degraded` undefined | 搬 |
| T-R3 system-not-found fallback | `does not treat an empty customPath as unsafe` 已涵蓋 | 實質重複；併在 T-R3～T-R6 的 `it.each` 一列（成本一列，保留完整分支表） |
| T-R4 system-too-old（detail 含版本） | 無 | 搬 |
| T-R5 spawn-failed → system-unhealthy | 無 | 搬 |
| T-R6 detect 丟例外 → detect-threw（detail 含訊息） | 無 | 搬 |
| T-R7 fallback=false 三種原因丟 `SystemClaudeUnavailableError` | 只有 unsafe path 一種 | 搬（`it.each` 3 列） |
| T-R8 version-warning 不 fallback | 無（`headless-claude.test.ts` 只當輸入用） | 搬 |
| T-R9～T-R11 事件去重 | 無 | 搬（`afterEach` 清掉用到的 session） |

**`tests/docker-flow.test.ts`（3 項）→ 新檔 `src/components/setup-wizard/__tests__/docker-flow.test.ts`（6 項）**

| 舊項目 | 處置 |
|---|---|
| buildDockerWizardSteps 9 步順序 | 搬（vitest 原本無完整順序斷言） |
| createDockerWizardContext seeds（❌ 期望 `serverPort === 9876`） | 搬，改為 `serverPort` `toBeUndefined()`（T0649）；另斷言 `profileDraft`。`serverPort` undefined 本身與 `steps/docker/__tests__/start-server.test.ts` 的 `the Docker wizard context presets no port` 重複，但其他 seed 欄位（targetOS / dockerMounts / containerMode / dockerImage）是獨有的，整項保留 |
| Docker-specific steps expose rollback handlers | 搬（`it.each` 4 列）；`wizard-rollback-ownership.test.ts` 測的是 rollback 行為，不是 flow 是否掛上 handler |

**`tests/profile-card.test.ts`（13 項）→ 新檔 `src/components/profiles/__tests__/ProfileCard.test.tsx`（30 項，RTL `render` + `i18n.changeLanguage`，比照 `SshDetails.test.tsx`）**

| 舊項目 | 新位置 |
|---|---|
| selectDetailsVariant 6 項（local / wsl / docker / ssh-linux+darwin / 無 targetOS / 未知 targetOS） | `selectDetailsVariant` describe（`it.each` 6 列 + unknown targetOS 1 項） |
| ProfileCardDetails dispatch 3 項（以 element.type 比對） | `ProfileCardDetails` describe：實際渲染，以各 details 的 `data-testid` 判斷（6 列） |
| ❌ SshDetails ssh-linux vs ssh-darwin（testid） | testid 併入上一列；另加 `SshDetails tells ssh-linux (systemd) and ssh-darwin (launchd) apart`（`ssh-service-badge`） |
| ❌ DockerDetails mount table | `renders the mount table when the profile carries dockerMounts`（逐列比對 host / container）；新增：無 mounts 不渲染、container / host:port / target 與預設值、zh-TW 表頭 |
| ❌ ProfileCard 匯出形式 | `renders the card with name and id, collapsed without details`；新增：展開時渲染 extras 與 details、header / toggle 展開而 switch / actions 不展開、edit / delete 只在有 callback 時出現、狀態燈（idle / connected / 明確狀態與 title，T0513）、remote meta `host:9876 → id` |
| ❌ per-env badge label | WSL / Docker / SSH (Linux) / SSH (macOS) 為產品名（4 列）；Local / Remote 依 i18n（T0652，en / zh-TW 各一項）。舊期望 `Remote` 已過時：現行 en 是 `profiles.remote` = `REMOTE` |

### 驗證結果

| 項目 | 結果 |
|---|---|
| 本單 4 個檔 `npx vitest run …` | PASS：4 files / 142 tests（router 100、auth 6、docker-flow 6、ProfileCard 30） |
| `npm run test:unit`（最後一次，工作樹含 T0681 的並行變更） | PASS：326 files passed、5751 passed / 3 skipped（基線 5661 / 322）。本單貢獻 +3 檔、+55 項（router 87 → 100 = +13、auth +6、docker-flow +6、ProfileCard +30）；其餘增量來自同時在跑的 T0681 |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0（中途曾出 2 個 TS7024：`it.each` 表內 throw 的 arrow 讓推論循環，改用明確型別 `Detect` 的陣列解決） |
| `npx vite build` | 成功（exit 0） |
| 刪除的四個檔在 repo 內的引用 | `package.json` 無；`.github/`、腳本無。剩下兩處在**產品程式的註解**（見遭遇問題 2），本單不改產品；其餘是 `_ct-workorders/` 歷史記錄與 fixture 文字 |
| validated_sha | 驗證時 HEAD `65127614`（工作樹含本單變更）；commit 前 T0681 先行 commit `eaf8c168`，本單 `--only` commit 只含自己的 8 個路徑 |

### 因刪檔而失效的 package.json script

無。`package.json` 沒有任何 script 指向這四個檔（`grep -n "tests/" package.json` 只有 console-test / ctrl-o / node-resolver / file-drag / claude-code-path）。

### Commit

- `21ce7b79` test: T0680 move four stale tests/ files into vitest (BUG-168 G2) — 4 個測試檔新增 / 修改、4 個 `tests/` 檔刪除；`git commit --only` 只含這 8 個路徑。
- 工單 commit 另一筆（本回報）。未 push。

### 遭遇問題

1. 第一次全量 `npm run test:unit` 有 1 項失敗：`electron/__tests__/ct-worktree-status.test.ts`（`makeRepo()` / `isolated(repo)` 那項，git 子行程），與本單無關；單獨重跑 21/21 過，之後兩次全量都 0 失敗。判斷為高負載下（同時有其他 Worker 跑測試）的偶發逾時，未處理。
2. 產品程式還有兩處註解提到已刪的舊檔：`src/components/profiles/ProfileCard.tsx:58`（「tests/profile-card.test.ts calls ProfileCard as a plain function」，T0513 為遷就舊測試把 hook 移到 `StatusDot` 的說明）、`src/components/profiles/types.ts:45`（「Tested in tests/profile-card.test.ts.」）。本單規定不改產品程式，留給塔台：建議後續順手把註解改成指向 `src/components/profiles/__tests__/ProfileCard.test.tsx`（`StatusDot` 拆分本身可保留，不影響行為）。
3. 工作樹裡有其他 Worker 的未 commit 變更（T0681 / T0683 工單、`electron/__tests__/pty-manager-helper-env.test.ts`、`.github/workflows/tests.yml`），未碰。

### 回報時間

"2026-10-21T20:50:37+0800"
