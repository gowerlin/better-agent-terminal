---
schema_version: 1
schema_kind: workorder
id: T0882
title: "e2e `launchIsolated` 預寫 `settings.json` 關閉檢查新版（T0864 後續）＋ protocol v1 測試 B 組改 `until()`（T0867 後續）"
type: implementation
status: DONE
updated_at: "2026-11-20T16:52:19+0800"
started_at: "2026-11-20T16:43:09+0800"
completed_at: "2026-11-20T16:52:19+0800"
session_ids:
  - "3ecbd17e-9b35-40f1-9cc7-fda8338d4e89"
repo: better-agent-terminal
project: ""
priority: P2
sizing: S
created_at: "2026-11-20T16:40:41+0800"
depends_on: []
related:
  - "D303；T0864 回報區〈殘留風險 / 後續建議〉1（`src/lib/check-for-updates-migration.ts`，標記 `checkForUpdatesMigrated`）；T0867 回報區〈後續建議〉1；CLAUDE.md「Frontend unit tests」fake timers 規則（T0508）"
affects_files:
  - _ct-workorders/T0882-e2e-no-update-check-and-protocol-test-until.md
  - e2e/fixtures/electron-isolation.ts
  - e2e/
  - electron/__tests__/terminal-server-protocol-v1.test.ts
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 只改測試與 e2e fixture，不改產品程式（`src/` 、`electron/` 非 `__tests__` 的檔都不動）。"
  - "🔴 A 項：`launchIsolated` 在 app 啟動前，若該 runtime 的 userData 還沒有 `settings.json`，就寫入 `{ checkForUpdates: false, checkForUpdatesMigrated: true }`（鍵名取自 `src/lib/check-for-updates-migration.ts` 的匯出常數，不要手寫字串）；已有 `settings.json`（`beforeLaunch` 預寫、或以 `runtimeId` 重開）一律不動。要測檢查新版的 spec 必須能關掉這個預寫（新增選項，名稱自訂，寫進 JSDoc）。userData 路徑的算法要與 app 實際用的一致（以 runtime id 推導或其他可靠作法，寫明）；🔴 寫入前確認目標目錄名含 `-runtime-<runtimeId>`（同既有 guard），絕不寫到預設 userData。"
  - "🔴 既有 7 個引用 `checkForUpdates` 的 e2e spec（`site-media`、`t0776`、`t0821`、`t0823`、`t0825`、`t0861`、`t0862`）的行為不得改變：盤點每個 spec 自己寫設定的方式，確認與預寫不衝突；需要時改用新選項，寫進回報區。"
  - "🔴 B 項：`terminal-server-protocol-v1.test.ts` B 組 `a connection that never says hello …` 的 `vi.waitUntil` 改用同檔既有的事件驅動 `until()`（或等效、不在 fake timers 下輪詢的作法），斷言與逾時值的意義不變，不得 skip。同檔若還有其他 fake timers 下的 `vi.waitFor` / `vi.waitUntil` 一併列出並改。"
  - "驗證只用可自動化的方式：`npm run test:unit` 全過、`npm run typecheck:electron` = 0；`npx vite build` 後在本機跑 `t0776`、`t0821`、`t0825`、`t0861` 四個 e2e spec 與任一個沒有寫設定的 e2e spec（自選、寫明），確認通過且隔離實例的 `settings.json` 內容符合預期；`t0862`（只在 GitHub Windows runner）、`site-media`（需 `BAT_SITE_MEDIA=1`）、`t0823`（需安裝環境，若本機不能跑寫明原因）不必跑。不需要人工驗收。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push、不觸發 workflow。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo（D176）：回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）。"
---

# T0882 — e2e 不連 GitHub 檢查新版＋ protocol v1 測試 B 組改 `until()`

## 元資料
- **工單編號**：T0882｜**類型**：implementation｜**狀態**：DONE｜**建立**：2026-11-20 16:40 (UTC+8)
- **規模**：S｜**依賴**：無｜**決策**：D303

## 背景
- **A（T0864 後續）**：T0864 把「檢查新版」預設改開，並以 `checkForUpdatesMigrated` 標記做一次遷移。e2e 隔離實例第一次啟動沒有 `settings.json` 時主行程本來就會檢查新版；經 UI 存過設定再以同一 runtime 重開時也會檢查。e2e 的結果因此可能受網路與 GitHub 影響。
- **B（T0867 後續）**：`electron/__tests__/terminal-server-protocol-v1.test.ts` 第 214 行在 fake timers 下用 `vi.waitUntil` 等 `tcpStates`，違反 CLAUDE.md T0508 規則（fake timers 下輪詢會偷推假時鐘）；目前在 Linux 通過，屬潛在的偶發失敗。

## 任務
1. A：`e2e/fixtures/electron-isolation.ts` `launchIsolated` 預寫 `settings.json`（規則見 frontmatter），加關閉選項；盤點 7 個引用 `checkForUpdates` 的 spec。
2. B：B 組改事件驅動等待。
3. 驗證（見 frontmatter）。

## 驗收條件
- [x] `launchIsolated` 預寫只在沒有 `settings.json` 時發生、可關閉、不會寫到預設 userData（回報區寫明怎麼確認）
- [x] 7 個 spec 盤點結果（各自是否受影響、是否改用新選項）
- [x] B 組改寫，同檔其他 fake timers 輪詢一併處理（或寫明沒有）
- [x] `npm run test:unit` 全過（附 passed / files 數）、`npm run typecheck:electron` = 0
- [x] 指定 e2e spec 通過（附各自結果）
- [x] commit 只含本單範圍

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態
- **狀態**：DONE
- **完成時間**：2026-11-20 16:51 (UTC+8)
- **session_id**：3ecbd17e-9b35-40f1-9cc7-fda8338d4e89
- **產品 commit**：`b9002712b5caf3011052ccc8ed5530446495f005`（只含 `e2e/fixtures/electron-isolation.ts`、`electron/__tests__/terminal-server-protocol-v1.test.ts`）

### 落點檢查
- **結果**：PASS
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`e2e/fixtures/electron-isolation.ts`、`e2e/`、`electron/__tests__/terminal-server-protocol-v1.test.ts` 皆存在 → PASS
- C-2：工單沒有 `branch` 欄位（目前 `main`）
- `CT_HOME` 未設定（非 worktree）；`BAT_WORKSPACE_ID` 已設定（只記存在）；`BAT_REMOTE_TOKEN` 已設定

### 結果摘要

**A：`launchIsolated` 預寫 `settings.json`（`e2e/fixtures/electron-isolation.ts`）**
- 新增 `seedNoUpdateCheckSettings`：在 `beforeLaunch` 之後、`electron.launch` 之前，若該 runtime 的 `settings.json` 不存在，寫入 `NO_UPDATE_CHECK_SETTINGS` = `{ checkForUpdates: false, checkForUpdatesMigrated: true }`。
  - 標記鍵取自 `src/lib/check-for-updates-migration.ts` 的 `CHECK_FOR_UPDATES_MIGRATED_KEY`（computed key）。`checkForUpdates` 該模組沒有匯出常數，改以 `Pick<AppSettings, 'checkForUpdates'>`（`src/types`，type-only import）讓鍵名受型別約束。
  - 新匯出常數 `NO_UPDATE_CHECK_SETTINGS`，供 spec 比對。
- **不寫的情況**（log `settings.json seed: <result>`）：
  - `exists`：已有 `settings.json`（`beforeLaunch` 預寫、以 `runtimeId` 重開）——一律不動；
  - `legacy-dir`：有 legacy `better-agent-terminal-runtime-<id>` 目錄。**本單發現的衝突**：若先建立目標目錄，app 的 BUG-119 遷移（`migrateRuntimeInstance`）會因 `target-exists` 跳過 rename，`bug119-userdata-unification` 與 `pre5-acceptance` A3x 的 legacy 測試會壞。這種 runtime 之後會由遷移帶來它自己的 `settings.json`，所以比照「已有 settings.json」不寫；
  - `not-runtime-dir`：目標目錄名不含 `-runtime-<runtimeId>`（與既有 guard 同一個 `isRuntimeUserData`）——絕不寫到預設 userData；
  - `disabled`：新選項 `allowUpdateCheck: true`（JSDoc 已寫）——要測檢查新版的 spec 用它，app 就和 T0882 前一樣在沒有 `settings.json` 下啟動。
- **userData 路徑算法**（`electronAppData(env)`，JSDoc 已寫）：`<appData>/BetterAgentTerminal-runtime-<runtimeId>`（= `targetUserDataDir(appData, runtimeSuffix(id))`）。appData：
  - Windows：Roaming known folder，跟著子程序的 `USERPROFILE`（T0741 註解已實測）；`USERPROFILE` 沒覆寫時用本程序的 `APPDATA`（與 `bug119` spec 斷言 `userData === path.join(electronAppData(), …)` 的算法相同）；
  - macOS：`<HOME>/Library/Application Support`；Linux：`$XDG_CONFIG_HOME` 否則 `<HOME>/.config`（取子程序 env）。
  - **防呆**：啟動後以 `app.getPath('userData')` 比對預測路徑；不一致 → 刪掉本次建立的種子目錄（只在本次新建、且名稱含 `-runtime-<id>` 時）並記 `settings.json seed MISSED: …`，不讓 spec 失敗（維持該 spec T0882 前的行為）。`electron.launch` 失敗時同樣清掉本次建立的種子目錄。
- **怎麼確認「只在沒有 settings.json 時寫、可關閉、不寫到預設 userData」**：暫時 spec（驗證後已刪除、未 commit）在隔離實例上實測——
  1. 預設：啟動後 `settings.json` = `{"checkForUpdates":false,"checkForUpdatesMigrated":true}`，debug log `[update-check] startup: off (checkForUpdates: false)`；改寫成含 `logLevel: 'warn'` 後以同一 `runtimeId` 重開 → `seed: exists`，內容原樣保留；
  2. `allowUpdateCheck: true` → `seed: disabled`，啟動後沒有 `settings.json`，log `[update-check] startup: latest current=0.7.5-pre.2 …`（檢查照舊執行）；
  3. `beforeLaunch` 預寫 `{logLevel, checkForUpdates, checkForUpdatesMigrated, language}` → `seed: exists`，內容逐鍵不變；
  4. 所有實例的 userData 都是 `<使用者資料夾>\AppData\Roaming\BetterAgentTerminal-runtime-e2e-…`（fixture 原有的 `-runtime-<id>` 斷言也通過），預測路徑全部命中、沒有 `MISSED`。

**7 個引用 `checkForUpdates` 的 spec 盤點**

| spec | 寫設定的方式 | 與預寫的關係 | 是否改用新選項 |
|---|---|---|---|
| `site-media` | `seed()`：`settings.load()` → `Object.assign(..., checkForUpdates: false, marker)` → `save()`；另有 `launchRecording` 不經 `launchIsolated` | 預寫的值與它自己寫的一致，`load` 讀到預寫內容再合併，結果相同；`launchRecording` 不受影響 | 否 |
| `t0776` | 啟動後 `load` → 合併 `claudeRuntime` ＋ `checkForUpdates: false` ＋ marker → `save` | 同上，一致 | 否 |
| `t0821` | `seed()`：`load` → 合併 false＋marker → `save`；以 `runtimeId` 重開 | 第一次 `written`、重開 `exists`（不動） | 否 |
| `t0823` | 同 `t0821` | 同上 | 否 |
| `t0825` | 同 `t0821`（不重開） | `written`，一致 | 否 |
| `t0861` | 啟動後 `load` → 合併 false＋marker → `save`；兩次以 `runtimeId` 重開 | 第一次 `written`、之後 `exists` | 否 |
| `t0862` | 直接寫已安裝 BAT 的預設 `USER_DATA/settings.json`，不用 `launchIsolated` | 不經本 fixture，不受影響 | 否 |

沒有任何 spec 在測檢查新版本身，所以都不需要 `allowUpdateCheck`。另外盤點到兩個會建立 legacy runtime 目錄的 spec（`bug119-userdata-unification`、`pre5-acceptance` A3x），由上面的 `legacy-dir` 規則處理、spec 本身不改。

**B：`terminal-server-protocol-v1.test.ts` B 組**
- `a connection that never says hello is closed after SERVER_HELLO_TIMEOUT_MS`：`vi.waitUntil(() => tcpStates.size === 1, { timeout: 2000 })` 改為事件驅動：連線前對 server 內部 `tcpServer` 掛 `nextEvent(…, 'connection')`（server 自己的 `acceptTcpConnection` listener 先註冊，所以觸發時 `tcpStates` 與 hello 計時器已建立），等到後 `expect(tcpStates.size).toBe(1)`，再 `advanceTimersByTime(SERVER_HELLO_TIMEOUT_MS)`、切回真計時器 `until(() => c.closed)`。斷言與 2 s 逾時意義不變，沒有 skip。
- 新 helper `nextEvent(emitter, event, timeoutMs = 2000)`：逾時用模組載入時保存的真 `setTimeout` / `clearTimeout`（這個測試 fake 了 `setTimeout`，既有 `until()` 的 `flush(10)` 會用到假計時器而卡住，所以不能直接用 `until()`）。
- 同檔其他 fake timers 下的輪詢：全檔只有這一處 `vi.waitFor` / `vi.waitUntil`。其餘 fake timers 區段：C 組（fake `setTimeout`，沒有輪詢）、E 組（只 fake `setInterval` / `clearInterval`，`until()` 用真 `setTimeout`，不違反 T0508）、E 組 `a refused hello` 在 `until()` 前先 `useRealTimers()`。不需另改。

### 修改檔案
- `e2e/fixtures/electron-isolation.ts`（+ `seedNoUpdateCheckSettings` / `electronAppData` / `envValue` / `NO_UPDATE_CHECK_SETTINGS`，`launchIsolated` 新選項 `allowUpdateCheck`）
- `electron/__tests__/terminal-server-protocol-v1.test.ts`（+ `nextEvent`，B 組一處改寫）
- 本工單
- 產品程式（`src/`、`electron/` 非 `__tests__`）未動。

### 驗證證據
- `npx vitest run electron/__tests__/terminal-server-protocol-v1.test.ts`：37 passed；B 組該測試單獨重跑 5 次全過。
- `npm run test:unit`：**Test Files 460 passed | 3 skipped (463)；Tests 8406 passed | 41 skipped (8447)**，exit 0。
- `npm run typecheck:electron`：exit 0（0 錯誤）。
- e2e 不在任何 tsconfig 內；另以 `npx tsc --noEmit --strict --skipLibCheck --module esnext --moduleResolution bundler --target es2022 --types node e2e/fixtures/electron-isolation.ts` 單檔檢查：0 錯誤。
- `npx vite build`：exit 0。
- e2e（Windows 本機、source build，`--workers=1`）：
  - `t0776-auto-dialog-focus`：1 passed（`seed: written`）
  - `t0821-upgrade-interruption`：2 passed（upgrade / control；各 `written` → 重開 `exists`）
  - `t0825-second-instance-startup`：2 passed（plain / profile；`written`）
  - `t0861-holder-reattach`：1 passed（`BAT_E2E_EXECUTABLE=release\win-unpacked\BetterAgentTerminal.exe`；`written` → `exists` → `exists`）。打包版沿用本機既有 `release/win-unpacked`（2026-11-17 11:19 打包，已含 T0864 遷移與 T0860/T0861 holder；之後的產品 commit 只有 T0878/T0879 mermaid，與本 spec 無關；本單未改產品程式），未重新 `build:dir`。
  - 沒有寫設定的 spec（自選）：`bug119-userdata-unification` 2 passed——fresh 測試 `seed: written`；legacy 測試 `seed: legacy-dir`，rename 遷移與 `logLevel: 'warn'` 保留照舊通過（驗證 `legacy-dir` 規則）。
  - 額外：`t0823-installer-graceful-quit` 在本機 source build 可跑（不需安裝程式），3 passed（upgrade / control / server-only）。
  - 隔離實例 `settings.json` 內容見〈結果摘要〉A 的暫時 spec 結果。
- 未跑：`t0862`（只在 GitHub Windows runner）、`site-media`（需 `BAT_SITE_MEDIA=1`），依工單不必跑。

### 遭遇問題
- 預寫會擋住 BUG-119 的 runtime 目錄 rename（見上 `legacy-dir`），已在 fixture 處理，不改 spec。
- 工單寫「鍵名取自匯出常數」，但模組只匯出標記鍵常數；`checkForUpdates` 以 `AppSettings` 型別約束代替。

### 偏差
- 無範圍偏差。暫時驗證 spec `e2e/t0882-tmp-settings-seed.spec.ts` 只在本機建立、跑完即刪除，未 commit。

### 互動紀錄
- 無（yolo，未向塔台提問）。

### 後續建議
- `site-media` 的 `launchRecording` 不經 `launchIsolated`，不會預寫；它自己的 `seed()` 已關檢查新版，但第一次啟動的 2 s 檢查仍可能在 `seed()` 存檔前執行。要完全不連 GitHub 可讓它也呼叫 `seedNoUpdateCheckSettings`（需匯出），本單未動（只在 `BAT_SITE_MEDIA=1` 時跑）。
