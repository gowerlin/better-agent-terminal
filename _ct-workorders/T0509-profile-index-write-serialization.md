---
schema_version: 1
schema_kind: workorder
id: T0509
title: "profile-manager：index.json 讀改寫未序列化 → 並行 profile:create 在 Windows rename EPERM（plan039 M3 重現）、共用 .tmp 互相覆蓋、可能遺失更新"
type: implementation
status: DONE
repo: better-agent-terminal
project: D139
priority: P2
sizing: S
created_at: "2026-10-14T01:00:02+08:00"
started_at: "2026-10-14T01:00:51+08:00"
updated_at: "2026-10-14T01:09:23+08:00"
completed_at: "2026-10-14T01:09:23+08:00"
target_version: v0.6.0-pre.5
depends_on:
  - "T0508"
related:
  - "T0508 回報區「偏差 / 殘餘風險」1：`electron/profile-manager.ts` `writeIndex()`（:310 起）先 `readIndexFile` + `copyFile(→ .bak)`、寫 `index.json.tmp`、再 `rename`；並行 `profile:create` → `EPERM: operation not permitted, rename '…\\profiles\\index.json.tmp' -> '…\\profiles\\index.json'`；e2e `plan039-multi-remote` M3 在「新 spec + 完整回歸集」組合 2/2 重現"
  - "呼叫點：`profile-manager.ts:418 / 468 / 503 / 537 / 552`（create / update / delete 等的讀改寫）；T0491 `WindowRegistry` 序列化佇列（`updateEntry` / `withEntry` / `whenIdle`）為範本"
affects_files:
  - "electron/profile-manager.ts"
  - "electron/__tests__/"
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不只 `writeIndex` 加鎖：整個「讀 index → 改 → 寫」要在同一序列化單元內（否則並行 create 仍會遺失更新），比照 T0491 `WindowRegistry.updateEntry`；所有呼叫點 trace 並遷移"
  - "🔴 `.bak` 輪替與 corruption fallback 語意不變；`.tmp` 檔名在序列化下可維持，若改唯一檔名須清理殘留"
  - "🔴 EPERM / EBUSY（Windows 防毒 / 索引器鎖檔）可做有限重試（次數與退避寫明），不得無限重試；不得吞掉錯誤"
  - "🔴 批次並行（D139）：`git commit --only` 本單檔案；不改 CLAUDE.md（建議文字寫回報區由 T0493 套用）；`npm run typecheck` / `npm run typecheck:electron` 維持 0"
  - "🔴 不得以預設實例（無 `--runtime`）啟動 source build；e2e 一律 isolated runtime"
  - "🔴 不 push、不觸發 workflow；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`；換行維持各檔現況"
---

# T0509 — profile index 序列化

## 實作

1. 盤點 `profile-manager.ts` 所有讀改寫 index 的路徑（含 IPC handler 與 remote 路徑）
2. 以單一序列化佇列（或 mutex）包住讀改寫；`writeIndex` 的 rename 對 EPERM / EBUSY 有限重試
3. 單元測試：並行 N 個 create / update / delete → 結果包含全部變更、無 EPERM、`.bak` 正確；對照組（移除序列化）會遺失更新或報錯
4. e2e：`plan039-multi-remote` 與 T0508 回報的完整回歸組合（含 `detached-close-edges`）連跑 ≥ 2 次皆綠

## 驗收條件

- [ ] 呼叫點遷移清單；單元（含對照組）；e2e 組合連跑證據
- [ ] `npm run test:unit`、`npx vite build`、`npm run typecheck`、`npm run typecheck:electron`
- [ ] 回報區：CLAUDE.md 建議文字、`git diff --stat`

## Sub-session 執行指示

1. 讀本工單 + D139 + T0508 回報區 + `electron/profile-manager.ts` + `electron/window-registry.ts`（佇列範本）
2. 填 `started_at`、`status: IN_PROGRESS`（取系統時間，R-G001）
3. 實作 → 驗收 → 填回報區 → `DONE`；`git commit --only` 本單檔案與改動；不 push；依派發 mode 通知塔台

---

## 回報區

### 結果摘要

DONE。`electron/profile-manager.ts` 新增模組層序列化佇列 `withIndexLock()`（比照 T0491 `WindowRegistry.exclusive`：`then(fn, fn)` + `catch` 吞掉鏈上錯誤、錯誤照樣回給呼叫者），`ProfileManager` **全部**讀 / 寫 index 的方法都把「`ensureInitialized()` 讀 → 改 → `writeIndex()`」包在同一個佇列單元內；`writeIndex` 的 rename 對 `EPERM` / `EBUSY` / `EACCES` 有限重試。

### Landing Zone

- C-0 PASS：`repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`（`REPO_ROOT` = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS；C-3 PASS（`electron/profile-manager.ts` 存在，`electron/__tests__/` 存在）；C-2 無 `branch` 欄位（HEAD `main`）
- `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 呼叫點遷移清單

`ensureInitialized()` 只剩在鎖內被呼叫（加註「caller must hold the index lock」）。`ProfileManager` 方法逐一遷移：

| 方法 | 原行為 | 現在 |
|---|---|---|
| `list` / `getProfile` / `getActiveProfileIds` | 無鎖讀（首次啟動會寫） | 鎖內讀（首次 init 寫入也在鎖內） |
| `create` | 讀 → push → 寫，無鎖 | 鎖內；建立邏輯抽成 `addProfileEntry(index, …)`（不取鎖） |
| `save` | 讀 → 寫 snapshot → bump `updatedAt` → 寫 | 整段鎖內（含 `windowRegistry.readAll()`，該佇列不回呼 profile，無死鎖） |
| `loadSnapshot` | 無鎖讀 | 鎖內 |
| `load` | `loadSnapshot()` + `activateProfile()` 兩段 | 合成**單一**鎖內單元（不呼叫公開方法，避免重入） |
| `delete` / `rename` / `update` / `activateProfile` / `deactivateProfile` | 讀改寫無鎖 | 鎖內（delete 的 unlink、rename 的 snapshot 改名也在鎖內） |
| `duplicate` | `readSnapshot` + `this.create()` + 寫 snapshot | 單一鎖內單元，改用 `addProfileEntry`（不再呼叫公開 `create`，避免重入死鎖） |

main.ts 的呼叫者（`profile:*` IPC handler、remote 連線 `getProfile`、quit / 關窗 `save` / `deactivateProfile`、啟動 `activateProfile` 等，約 50 處）API 簽章不變，不需改動；`main.ts:2014` 的 `Promise.all(save…)` 現在依序執行。headless / remote 端沒有 `ProfileManager` 實例（`remote-client.ts` 等只 import 型別 / `extractTargetOSMeta`）。

### rename 重試

- 退避 `INDEX_RENAME_RETRY_DELAYS_MS = [25, 50, 100, 200, 400, 800]`：最多 7 次嘗試、累計約 1.6 s；每次重試 `logger.warn`，用盡時 `logger.error` 並**拋出最後一個錯誤**（不吞）
- 重試碼 `EPERM` / `EBUSY` / `EACCES`。`EACCES` 是工單外的小延伸：Windows 同一種鎖依 API 路徑會回 `EPERM` 或 `EACCES`（graceful-fs 也重試這三個）。其他錯誤（如 `EXDEV` / `ENOENT`）不重試
- `.bak` 輪替、corruption fallback（讀 `.bak`、隔離 `.corrupt.<ts>`、不覆寫壞檔）語意不變；`.tmp` 維持共用檔名 `index.json.tmp`（序列化後無競爭，故無殘留需清理）

### 附帶修正（範圍內）

序列化後同名 create 會依序執行，舊的唯一化只做一次 `${slug}-${Date.now()}`，同一 ms 內第三個同名 create 會撞 id。改為衝突時再接 `-2`、`-3`…（第一次衝突的格式不變）。

### 單元測試 — `electron/__tests__/profile-index-serialization.test.ts`（新檔，9 tests）

- 並行 24 個 `create` → 全部落地、id 唯一、無 rejected、無殘留 `.tmp`、`.bak` = 最後一次寫入前的 index
- 同名並行 `create` ×6 + `duplicate` ×2 → id 全唯一
- 並行 `create` / `update` / `rename` / `delete` / `activate` / `deactivate` / `load` → 全部生效（含 snapshot 改名 / 刪除）
- 排在 `create` 後的 `getProfile` / `list` 看得到該 create
- **對照組（測試內）**：以未上鎖的 `__test__.readIndex` / `writeIndex` 重現舊的讀改寫交錯（全部讀完才寫）→ 斷言遺失更新（`kept < N`）
- **對照組（實證，未留在程式碼）**：暫時把 `withIndexLock` 改成直接 `return fn()` 跑同一測試檔 → 4 個並行測試失敗（24 個 create 有 21 個 rejected，錯誤為 `ENOENT`——共用 `.tmp` 已被另一呼叫 rename 走；另見 `EPERM`），還原後 9/9 綠（`git diff` 確認無殘留）
- 重試：`EPERM` → `EBUSY` → `EACCES` 後成功，sleep 序列 = `[25, 50, 100]`；永遠 `EPERM` → 7 次 rename 後拋 `EPERM`、`logger.error` 1 次、index 不變，且佇列未卡住（後續 create 成功）；`EXDEV` 不重試
- corruption fallback：壞 `index.json` → `list()` 回 `.bak` 內容，壞檔不被覆寫
- 測試以 `__test__.setSleep` 換掉退避 sleep（不靠真實時間），`fs/promises.rename` 以 `vi.fn(actual.rename)` 包裝

### 驗證證據

| 項目 | 結果 |
|---|---|
| `npx vitest run electron/__tests__/profile-index-serialization.test.ts` | PASS 9/9 |
| `npm run test:unit` | PASS — 204 files、3455 passed / 1 skipped，exit 0（輸出中的 `AttachConsole failed` 為既有 node-pty ConPTY 雜訊） |
| `npm run typecheck` | exit 0 |
| `npm run typecheck:electron` | exit 0 |
| `npx vite build` | exit 0 |
| e2e 完整回歸組合（T0508 重現 M3 EPERM 的組合）：`detached-close-edges` + `detached-flush-on-close` + `detached-terminal-persistence` + `detached-workspace` + `smoke` + `navigation-guard` + `plan039-multi-remote` | Run 1（01:06:13 開始）**11 passed**（1.3m）；Run 2（01:07:32 開始）**11 passed**（50.4s）；M3 兩輪皆綠 |

e2e 全部經 `e2e/fixtures/electron-isolation.ts` 以 `--runtime=e2e-…` isolated runtime 啟動，未以預設實例啟動 source build。

### 變更檔案（`git diff --stat`）

```
 .../__tests__/profile-index-serialization.test.ts  | 206 ++++++++++
 electron/profile-manager.ts                        | 434 +++++++++++++--------
 2 files changed, 477 insertions(+), 163 deletions(-)
```

（profile-manager.ts 的刪除行主要是方法體包進 `withIndexLock(async () => { … })` 後的縮排變動；檔案維持 CRLF，新測試檔 LF 與 Write 預設一致）

### 偏差 / 殘餘風險

- 讀取也排入佇列：`getProfile` 在 main.ts 多處熱路徑（建立終端、remote 連線）被呼叫，現在會等前面的寫入完成。寫入是小檔 I/O，影響應在毫秒級；但若 rename 正遇防毒鎖，最壞多等約 1.6 s
- `save()` 持鎖期間會 await `windowRegistry.readAll()`；目前 `WindowRegistry` 不回呼 profile-manager，無死鎖。日後若讓 registry 呼叫 `ProfileManager` 公開方法，須重新檢查
- 鎖只在單一 process 內有效；兩個 BAT 實例共用同一 userData（不同 `--runtime` 為不同目錄，不受影響）仍可能競爭，這是既有限制，本單不處理
- `EACCES` 納入重試碼（見上）

### CLAUDE.md 建議文字（由 T0493 套用）

建議接在「多 remote profile 同時連線（PLAN-039）」節末，或新增於 Logging 後的 userData 相關段：

> - **profile index 序列化（T0509）**：`profiles/index.json` 的讀改寫全部經 `electron/profile-manager.ts` 的 `withIndexLock()` 佇列（模組層，比照 T0491 `WindowRegistry`），`ProfileManager` 每個方法都把 `ensureInitialized()` → 修改 → `writeIndex()` 放在同一個單元（讀取也排隊）。🔴 鎖內程式碼不得呼叫 `ProfileManager` 公開方法（佇列不可重入，會等自己）；新增方法時建立邏輯用 `addProfileEntry()`。`writeIndex` 的 rename 對 `EPERM` / `EBUSY` / `EACCES` 依 `INDEX_RENAME_RETRY_DELAYS_MS`（25–800 ms，共 7 次）重試，用盡即拋錯。修正 plan039 e2e M3 在完整回歸組合下的 `EPERM … rename index.json.tmp -> index.json`。驗證：`electron/__tests__/profile-index-serialization.test.ts`。

### Commit

- `7e99831` fix: T0509 serialize profile index read-modify-write; retry EPERM rename（`git commit --only` `electron/profile-manager.ts` + 新測試檔）
- 本工單收尾另以 `chore: T0509 DONE (ct)` commit；未 push、未觸發 workflow
