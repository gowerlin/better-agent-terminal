---
schema_version: 1
schema_kind: workorder
id: T0750
title: "BUG-183 / BUG-184 修正：隱藏（最小化到匣）的 profile 視窗按「開啟」要叫回來；匣選單不再殘留已移出 profile 的視窗"
type: implementation
status: DONE
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T22:06:40+0800"
updated_at: "2026-11-01T22:21:13+0800"
started_at: "2026-11-01T22:08:02+0800"
completed_at: "2026-11-01T22:21:13+0800"
session_ids:
  - "bdf29edf-9938-425b-af82-21b6498da80a"
depends_on: []
related:
  - "BUG-183（隱藏的 profile 視窗按「開啟」不顯示，只跳「此配置已在另一個視窗中開啟」）；BUG-184（匣選單殘留已 Remove from profile 的視窗，同名項目兩個）；兩者皆在 BUG-182 實機驗收時發現（2026-11-01，安裝版 `v0.7.3-pre.1`，Windows，WSL profile）"
  - "CLAUDE.md「多 remote profile 同時連線（PLAN-039）」、「Detached workspace 視窗的持久化（T0453 / T0491）」；`docs/agent-guide/multi-remote-profiles.md`、`docs/agent-guide/detached-workspace.md`"
affects_files:
  - "electron/main.ts（`openProfileWindows` 約 3624 行、視窗 close handler 約 1285–1372 行、`rebuildTrayMenu` 約 816 行；推測）"
  - "src/App.tsx（約 1026 行 `alreadyOpen` 通知；推測）"
  - "electron/window-registry.ts（推測，只在需要時）"
  - "對應的 unit test（新增或擴充；純邏輯可抽到可測的函式）"
  - "e2e 新 spec（隔離實例；名稱自訂，例 `e2e/t0750-profile-window-reopen.spec.ts`）"
  - docs/agent-guide/multi-remote-profiles.md
  - "CLAUDE.md（「多 remote profile 同時連線（PLAN-039）」節只在必守規則有變時補一句）"
  - _ct-workorders/T0750-fix-hidden-profile-window-reopen-and-tray-stale.md
  - _ct-workorders/BUG-183-hidden-profile-window-not-shown-on-open.md
  - _ct-workorders/BUG-184-tray-menu-lists-window-removed-from-profile.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 目標 1（BUG-183）：profile 的視窗被「最小化到匣」（`win.hide()`）後，在「配置」對該 profile 按「開啟」（↗）→ 原視窗要顯示並取得焦點（`show()` + `focus()`；最小化的照舊 `restore()`）。使用者期望：直接啟用原視窗、不跳「此配置已在另一個視窗中開啟」。成功叫回時不顯示通知；叫不回來（例外狀況）時的提示由你提案並寫明理由。先查證：使用者的 `minimizeToTray` 現值（只讀 settings，不改）、`openProfileWindows` 的分支是否正如 BUG-183〈塔台初步定位〉所述；與推論不符就以查證為準並寫進回報。"
  - "🔴 目標 2（BUG-184）：系統匣選單不得列出已 Remove from profile 的視窗。先查清殘留是怎麼來的：使用者從哪個入口移除不確定（關窗對話框的 Remove from profile、匣選單的 Remove from profile、「配置」畫面的 ✕），三個入口都要查；移出 profile 的視窗要確實 destroy 並重建匣選單，或在匣選單排除。另：匣選單兩個同名 `… - WSL Ubuntu-24.04:1` 無法分辨，是否改善標籤由你提案（不得把使用者路徑或帳號放進標籤）。查不出成因時，記錄已排除的路徑，回 PARTIAL，不要猜修。"
  - "🔴 不回歸（R-G003 已驗收案例）：Default（本機）profile 與遠端 profile 的開啟 / 關閉 / 最小化到匣 / Remove from profile / Close only / 最後一個視窗關閉 / quit 對話框行為，除本單兩個缺陷外都不變；detached workspace 視窗（T0453 / T0491 / T0504 / T0508：flush-save、`closed` 前不得從 `detachedWindows` 移除、reattach）不受影響；PLAN-039 多 profile 連線（每 profile 一條連線、`IDLE_GRACE_MS`、第 9 個被拒）不受影響；`minimizeToTray` 關閉時行為不變。回報區必列〈相關通過案例〉判定（逐案寫成立與否）。改共用的 close handler 前先 trace 全部 consumer（CLAUDE.md No Regressions Policy）。"
  - "🔴 驗證：unit test 涵蓋：隱藏視窗 → 開啟時 show + focus 且不回通知、最小化視窗 → restore + focus、沒有存活視窗 → 照舊開新視窗、移出 profile 後匣選單不列該視窗；e2e（隔離實例，本機 profile 即可，不需要真的連 WSL；遠端 profile 若要用，照 T0748 做法：測試專用 headless server `/tmp/bat-e2e-t0750`、不經 systemd、不動使用者 WSL bat-server，WSL 未執行就 skip）：最小化到匣 → 按開啟 → 視窗可見、沒有 `alreadyOpen` 通知；Remove from profile 後匣選單項目數正確。以未修正的程式確認 e2e 會失敗（突變檢查，結果寫回報區，還原後再 commit），修正後連跑 2 次綠。重跑 `t0512-profile-panel-layout`、`t0513-profile-status-light` 與 detached 相關 e2e 綠。`npm run test:unit` 全過、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功。"
  - "🔴 文件：`docs/agent-guide/multi-remote-profiles.md` 補開啟已隱藏視窗與匣選單的行為；CLAUDE.md 只在必守規則有變時補一句（遵守 CLAUDE.md 開頭的撰寫規則，`##` 標題不改名）。完成後 BUG-183 / 184 改 FIXED（附 commit、`fixed_at` 取系統時間）。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報、測試、spec、截圖檔名不得出現使用者家目錄路徑、使用者名稱、主機名或帳號。"
  - "🔴 範圍：只修 BUG-183 / 184；發現其他缺陷記在回報區〈發現的問題〉，由塔台開單。不改使用者的 settings.json、profiles 或 window registry 檔；不關閉、不操作使用者正在執行的 BAT 視窗。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0750 — BUG-183 / BUG-184 修正：profile 視窗叫回與匣選單殘留

## 元資料

- **工單編號**：T0750
- **類型**：implementation（bug fix）
- **優先級**：P2
- **建立時間**：2026-11-01T22:06:40+0800
- **預估規模**：S

## 背景

BUG-182 實機驗收時（安裝版 `v0.7.3-pre.1`，WSL profile），使用者關掉 WSL 視窗後在「配置」按「開啟」，只跳「此配置已在另一個視窗中開啟」，視窗沒出現，只能從系統匣「Show」叫回（BUG-183）。同時匣選單列出兩個 `Better Agent Terminal - WSL Ubuntu-24.04:1`，其中一個是先前已從 profile 移除的視窗（BUG-184）。塔台唯讀初步定位見兩張 BUG 單。使用者指示現在修。

## 範圍

1. 查證 BUG-183 / 184 的成因（含三個 Remove from profile 入口）。
2. 修正：隱藏視窗按「開啟」→ show + focus、成功時不跳通知；移出 profile 的視窗不留在匣選單。
3. unit test、e2e（含突變檢查）、相關 e2e 重跑。
4. docs；BUG-183 / 184 → FIXED。

## 不做

- 不改「最小化到匣」設定的預設值或關窗對話框的選項文字。
- 不改 detached 視窗、PLAN-039 連線管理。
- 不發版、不 push。

## 驗收

- [ ] 隱藏的 profile 視窗按「開啟」→ 視窗出現並取得焦點，不跳通知
- [ ] 最小化 / 沒有存活視窗的既有行為不變
- [ ] Remove from profile（三個入口）後匣選單不列該視窗
- [ ] 〈相關通過案例〉判定
- [ ] unit / e2e（突變檢查＋連跑 2 次）/ 相關 e2e / typecheck 0 / 0 / build

## 回報區

### 完成狀態

- **狀態**：DONE（BUG-183 / 184 → FIXED，待使用者實機驗收）
- **完成時間**：2026-11-01T22:21:13+0800
- **產品 commit**：`8a432d40`（base `bafffbc1`）
- **session_id**：bdf29edf-9938-425b-af82-21b6498da80a

### 落點檢查

- 結果：PASS
- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 REPO_ROOT 下 → PASS；C-3：`electron/main.ts` 等存在 → PASS；C-2：無 `branch` 欄位
- `CT_HOME` 未設定（不是 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`；`CT_MODE` = `yolo`、`CT_INTERACTIVE` = `0`；`BAT_REMOTE_TOKEN` 已設定

### 查證結果

**BUG-183**（與塔台初步定位一致）

- 使用者 `minimizeToTray` 現值 = `true`（只讀 settings.json，未改）。
- 關窗 handler：profile 只剩一個視窗且 `minimizeToTray` 開 → `win.hide()`，視窗留在 `windowMap`。`openProfileWindows` 以 `windowMap` 有未 destroyed 的視窗判定已開啟，只做 `restore()`（僅最小化時）+ `focus()`，沒有 `show()`，回 `{ alreadyOpen: true }` → `App.tsx` 跳 `profiles.alreadyOpen`。
- 本機（Default）profile 同樣受影響（同一段程式不分本機 / 遠端）。`app.on('second-instance')` 的 `--profile=` 路徑有同樣的 restore + focus 缺口，一併修（同一缺陷、同一修法）。
- `minimizeToTray` 關閉時，關窗的每個分支都 `destroy()`，沒有其他讓視窗留在 `windowMap` 而不可見的路徑。

**BUG-184**（成因與 BUG 單推論不同：不是 Remove from profile，是刪除 profile）

- 使用者 `windows.json`（唯讀）有 3 筆 entry，其中一筆存活視窗的 `profileId` = `wsl-ubuntu-24-04-<時間戳>`，此 profile 已不在 `profiles/index.json`；另一筆是重建的 `wsl-ubuntu-24-04`。兩個 profile 同名 → 兩個視窗標題都是 `Better Agent Terminal - WSL Ubuntu-24.04:1`。
- 當天日誌 `debug-20261101-213437.log`：13:45 `profile:create` + `profile:update`（精靈建 `wsl-ubuntu-24-04-<時間戳>`，開視窗）→ 13:51:53、13:52:25 兩次 `[wsl-keepalive] sync (profile:delete)` → 13:52:47 `profile:create`（重建 `wsl-ubuntu-24-04`）→ 13:52:57 開新視窗。
- 成因：`profile:delete`（「配置」卡片 ✕；WSL 精靈 `write-profile` 刪除前次嘗試 / rollback 也走它）只刪 profile 與 snapshot，不碰視窗，視窗留在 `windowMap` 與 registry，綁定已不存在的 profile，照列在匣選單。
- 三個入口逐一查：
  - 關窗對話框「Remove from profile」：`removeEntry` → `destroy()` → `closed` → `windowMap.delete` → `rebuildTrayMenu`。排除。
  - 匣選單「Remove from profile」：同上（`removeEntry` → `destroy()` → `rebuildTrayMenu`）。排除。
  - 「配置」卡片 ✕：是 `profile:delete`，不關視窗 → 成因。
  - 佐證：前兩條會刪 registry entry，而殘留視窗的 entry 還在。

### 修正內容

- `src/lib/profile-window-front.ts`（新增，main / renderer 共用，不 import electron / DOM）：
  - `bringWindowToFront`：隱藏 → `show()`；最小化 → `restore()`；再 `focus()`。回 `focused` / `restored` / `not-shown`。
  - `profileOpenNotice`：決定 renderer 通知。
  - `planDeletedProfileWindows`：決定刪除 profile 時要關的視窗、要刪的 stale entry、要不要先開 Default。
- `electron/main.ts`：
  - `openProfileWindows` 與 second-instance 改經 `bringWindowToFront`，回傳多 `broughtToFront`，並記 `[profile-window]` 日誌。
  - `profile:delete` 成功後呼叫 `closeWindowsOfDeletedProfile`：destroy 該 profile 的存活視窗（含隱藏的）、刪 registry entry、重建匣選單；那些視窗若是全部的存活視窗，先 `openProfileWindows('default')`，否則 `minimizeToTray` 關閉時 app 會結束。
- `src/App.tsx`：`handleProfileNewWindow` 改經 `profileOpenNotice`。
- `src/types/electron.d.ts`：回傳型別補 `broughtToFront` / `error`。
- `src/locales/{en,zh-TW,zh-CN}.json`：新增 `profiles.alreadyOpenNotShown`。
- 叫不回來時的提示（提案並已實作）：`show()` 後仍不可見 → 顯示「此配置的視窗已開啟，但無法顯示。請從系統匣圖示選單 → 該視窗 → Show 開啟。」
  - 理由：此時「已在另一個視窗中開啟」的舊訊息會誤導；系統匣 Show 是使用者唯一確定可用的路徑。
- 通知判準（我的裁量）：
  - 隱藏 / 最小化的視窗叫回來 → 不顯示。
  - 視窗本來就在畫面上（只是被蓋住或沒焦點）→ 照舊顯示 `profiles.alreadyOpen`，維持既有行為、不擴大改動。
- docs `docs/agent-guide/multi-remote-profiles.md` 補三點（開啟已存在的視窗、刪除 profile 關閉視窗、驗證）；CLAUDE.md「多 remote profile 同時連線（PLAN-039）」節補一行必守規則（`##` 標題未改）。

### 變更檔案

- `electron/main.ts`、`src/App.tsx`、`src/types/electron.d.ts`、`src/locales/en.json`、`src/locales/zh-TW.json`、`src/locales/zh-CN.json`
- 新增：`src/lib/profile-window-front.ts`、`src/lib/__tests__/profile-window-front.test.ts`、`e2e/t0750-profile-window-reopen.spec.ts`
- `docs/agent-guide/multi-remote-profiles.md`、`CLAUDE.md`
- `_ct-workorders/BUG-183-…md`、`_ct-workorders/BUG-184-…md`（→ FIXED，附成因與修正）、本工單
- 未改：關窗 handler、`rebuildTrayMenu`、`electron/window-registry.ts`（兩個缺陷都不在這裡）

### 驗證

| 項目 | 結果 |
|---|---|
| `npm run test:unit` | PASS — 360 files、6376 passed / 3 skipped |
| 新 unit `src/lib/__tests__/profile-window-front.test.ts` | PASS 17 項：隱藏 → show + focus（`restored`、不通知）；最小化 → restore + focus；隱藏且最小化；已在畫面上 → 只 focus（照舊通知）；`not-shown`；destroyed；舊 main 無 `broughtToFront` → 照舊通知；沒有存活視窗 → 開新視窗（`alreadyOpen: false` → 無通知）；刪除 profile 只關該 profile 的視窗、stale entry、全關時開 Default、隱藏視窗算存活；main.ts 接線 source guard |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npx vite build` | 成功 |
| e2e `t0750-profile-window-reopen`（隔離實例、只用本機 profile，未碰 WSL） | 修正後連跑 2 次 PASS（3.8 s / 3.7 s；另含首次 1 次 PASS） |
| 突變檢查 BUG-183 | 把 `openProfileWindows` 改回 restore + focus → FAIL（`Expected "visible" / Received "hidden"`） |
| 突變檢查 BUG-184 | 拿掉 `closeWindowsOfDeletedProfile` 呼叫 → FAIL（`Expected "gone" / Received "visible"`） |
| 突變還原 | 由 scratchpad 備份還原（未用 git stash / checkout），`grep -c MUTATION` = 0，重 build 後才跑上面的連跑 2 次與 commit |
| 相關 e2e：`t0513-profile-status-light`、detached 5 支（`detached-close-edges` ×2、`detached-flush-on-close`、`detached-terminal-persistence`、`detached-workspace`）、`t0530-detached-open-settings`、`t0742-adopt-detached-focus`、`plan039-multi-remote` M1–M4 | PASS（13 項） |
| `t0512-profile-panel-layout` 第 1 項（profiles dialog layout） | PASS |
| `t0512-profile-panel-layout` 第 2 項（setup wizard completion block） | ❌ FAIL — 與本單無關，見〈發現的問題〉 |

匣選單的驗證方式：e2e 不能直接讀 Tray 選單。`rebuildTrayMenu` 每列 = `windowMap` 中未 destroyed 的視窗（本單沒改），所以 e2e 以「該視窗已 destroy、存活視窗數 −1、registry 無該 profile 的 entry」證明匣選單不再列它；`planDeletedProfileWindows` 另由 unit test 覆蓋。

### 相關通過案例判定

工單 memory_overrides 列出的不回歸範圍逐案判定：

| 案例 | 判定 | 依據 |
|---|---|---|
| Default / 遠端 profile「開啟」：沒有存活視窗 → 開新視窗 / 還原 snapshot | 成立（未變） | `openProfileWindows` 該分支未改；e2e B / C 的 `openNewInstance` → `alreadyOpen: false`；plan039 / t0513 綠 |
| 「開啟」：視窗已在畫面上 → focus + 「已在另一個視窗中開啟」通知 | 成立（未變） | `focused` → `already-open`（unit） |
| 「開啟」：最小化的視窗 → `restore()` + focus | 成立；**唯一行為變化**是不再跳通知（屬本單目標「叫回時不顯示通知」） | unit |
| 關閉 / 最小化到匣 / Remove from profile / Close only / 最後一個視窗關閉 | 成立（未變） | 關窗 handler 未改；e2e 實測最後一個視窗 + `minimizeToTray` → hidden |
| 匣選單 Show / Remove from profile | 成立（未變） | `rebuildTrayMenu` 未改 |
| quit 對話框 | 成立（未變） | `before-quit` / quit 路徑未改；e2e teardown 走 quit 對話框正常 |
| `minimizeToTray` 關閉時的行為 | 成立（未變） | 關窗分支未改；`bringWindowToFront` 對可見視窗只 focus |
| detached 視窗（T0453 / T0491 / T0504 / T0508） | 成立 | `closed` handler、`detachedWindows` 處理未改；detached e2e 6 支 + t0742 綠 |
| PLAN-039 每 profile 一條連線、`IDLE_GRACE_MS`、第 9 個被拒 | 成立 | 連線管理未改；plan039 M1–M4 綠。刪除 profile 時關它的視窗 → 走既有 `closed` → `noteRemoteWindowClosed`，已刪 profile 的連線在 15 s 寬限後釋放（以前會一直留著） |
| 刪除 profile（「配置」✕、精靈刪前次嘗試 / rollback） | **行為改變（本單修正範圍）** | 以前視窗留著；現在關掉該 profile 的視窗（全關時先開 Default）。精靈刪的 profile 通常沒有視窗，那時無動作（`closeIds` 空、只清 stale entry） |

### 發現的問題

1. **`e2e/t0512-profile-panel-layout.spec.ts` 第 2 項（WSL 精靈完成區塊）失敗，與本單無關**：失敗在精靈第 5 步「設定並啟動伺服器服務」，訊息 alert「無法讀取目前的 BAT 服務」。spec 的 `WIZARD_STUBS` 沒有 T0554 新增的 `wsl-systemd:snapshot-unit` stub（`grep snapshot-unit` 在 spec 無結果）。失敗點在 `write-profile`（唯一會呼叫 `profile:delete` 的精靈步驟）之前，本單的改動碰不到。建議塔台開單補 stub。
2. 匣選單標籤提案（未實作，留塔台決定）：兩個 profile 同名時，標籤仍是一樣的 `… - <名稱>:1`。兩個做法：
   - (a) 隱藏的視窗在標籤後加「（hidden）」，並在 `hide` / `show` 事件重建選單；
   - (b) 選單內標籤重複時依序加 ` (2)`、` (3)`。
   - 兩者都不會放使用者路徑或帳號。本單修正後，同名重複只剩「使用者自己建了兩個同名 profile」這種情況，所以沒做。
3. 使用者目前執行中的 BAT 仍有那個已刪 profile 的視窗（registry entry 還在）。本單沒操作使用者的 BAT。裝新版之前，可從匣選單 → 該視窗 → Remove from profile 關掉；重開 BAT 時 registry 會由 profile snapshot 重建，所以不會帶到下次啟動。
4. `_bug-tracker.md` 不在本單 `affects_files`，沒有更新。BUG-183 / 184 的 FIXED 狀態要由塔台同步進索引（R-G003 第 4 點）。

### 遭遇問題

- 無。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### Commit 狀態

- 產品：`8a432d40`（`git commit --only` 指定檔案）
- 工單 + BUG-183 / 184：本次收尾 commit
- 未 push、未發版、未改 CHANGELOG
