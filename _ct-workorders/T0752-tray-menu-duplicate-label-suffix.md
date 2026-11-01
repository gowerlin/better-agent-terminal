---
schema_version: 1
schema_kind: workorder
id: T0752
title: "系統匣選單：視窗標籤重複時依序加 ` (2)`、` (3)`（D205，T0750 提案 (b)）"
type: implementation
status: DONE
started_at: "2026-11-01T22:28:06+0800"
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: XS
created_at: "2026-11-01T22:26:23+0800"
updated_at: "2026-11-01T22:32:03+0800"
completed_at: "2026-11-01T22:32:03+0800"
session_ids:
  - "99492c21-e37f-4241-9215-1a5173ad3341"
depends_on: []
related:
  - "D205（使用者選 (b)）；T0750 回報區〈發現的問題〉2（提案 (a) / (b)）；BUG-184（`8a432d40` 已修殘留，本單只處理同名標籤）"
  - "CLAUDE.md「多 remote profile 同時連線（PLAN-039）」；`docs/agent-guide/multi-remote-profiles.md`"
affects_files:
  - "electron/main.ts（`rebuildTrayMenu` 約 816 行：只改標籤組法）"
  - "src/lib/（新增純函式或併入 `src/lib/profile-window-front.ts`；不 import electron / DOM）"
  - "對應的 unit test"
  - docs/agent-guide/multi-remote-profiles.md
  - _ct-workorders/T0752-tray-menu-duplicate-label-suffix.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 目標（D205 (b)）：系統匣選單的每個視窗項目，標籤（`win.getTitle()` 或 `Window <id 前 8 碼>`）在同一次選單內重複時，第一個維持原樣，之後依序加 ` (2)`、` (3)`…；不重複的標籤完全不變。順序以選單本來的列出順序（`windowMap` 迭代順序）為準。標籤組法抽成純函式（不 import electron / DOM），`rebuildTrayMenu` 只接線。"
  - "🔴 行為不變：匣選單的項目數、Show All Windows、每個視窗的子選單（Show / Remove from profile）與其動作、選單重建時機都不改；不改視窗標題本身（`setTitle` / renderer 的標題）；不加「（hidden）」（D205 未採 (a)）。標籤不得含使用者路徑、帳號或 profile id。"
  - "🔴 不回歸（R-G003）：T0750 的修正（`bringWindowToFront`、`closeWindowsOfDeletedProfile`、`profileOpenNotice`）與其 unit / e2e 不受影響；detached 視窗、PLAN-039 不受影響。回報區列〈相關通過案例〉判定。"
  - "🔴 build 順序（D205，與 T0751 並行）：先做程式、unit test、兩個 typecheck；`npx vite build` 與 e2e 要等 T0751 commit（`git log --oneline -5` 看得到 T0751 的 commit）後才跑，避免同時 build。"
  - "🔴 驗證：unit 涵蓋：無重複 → 不變、兩個同名 → 第二個加 ` (2)`、三個同名 → ` (2)` / ` (3)`、多組重複互不影響、`Window <id>` 後備標籤；`npm run test:unit` 全過、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功；重跑 `e2e/t0750-profile-window-reopen.spec.ts` 綠。匣選單 e2e 讀不到，以 unit + main.ts 接線 source guard 證明。docs 補一句；CLAUDE.md 不改（非必守規則）。不發版、不 push、不改 CHANGELOG。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
  - "🔴 範圍：只做同名標籤；發現其他缺陷記在回報區〈發現的問題〉。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0752 — 系統匣選單同名標籤加序號

## 元資料

- **工單編號**：T0752
- **類型**：implementation（enhancement）
- **優先級**：P3
- **建立時間**：2026-11-01T22:26:23+0800
- **預估規模**：XS

## 背景

T0750 修好 BUG-184 的殘留後，兩個 profile 同名時，系統匣選單的視窗標籤仍一模一樣（`Better Agent Terminal - <名稱>:1`），無法分辨。使用者選 (b)：選單內標籤重複時依序加 ` (2)`、` (3)`（D205），與 T0750 / T0751 一起發版。

## 範圍

1. 標籤組法抽成純函式並接到 `rebuildTrayMenu`。
2. unit test、typecheck、build（等 T0751 commit）、T0750 e2e 重跑。
3. docs 一句。

## 不做

- 不加「（hidden）」、不改視窗標題、不改選單結構與動作。

## 驗收

- [x] 重複標籤依序加 ` (2)`、` (3)`；不重複的不變
- [x] 〈相關通過案例〉判定
- [x] unit / typecheck 0 / 0 / build / t0750 e2e

## 回報區

### 完成狀態

- **狀態**：DONE
- **完成時間**：2026-11-01T22:32:03+0800
- **session_id**：99492c21-e37f-4241-9215-1a5173ad3341
- **產品 commit**：`7775fa8f` feat(tray): T0752 number duplicate window labels in the tray menu (D205)

### 落點檢查

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（`REPO_ROOT` = 本機 repo 根目錄）
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`electron/main.ts`、`src/lib/`、`docs/agent-guide/multi-remote-profiles.md` 皆存在（「對應的 unit test」非路徑，不測）→ PASS（資訊用）
- C-2：工單無 `branch` 欄位；目前 `main`
- 未設 `CT_HOME`（非 worktree）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 結果摘要

- 新增純函式 `src/lib/tray-window-labels.ts`（不 import electron / DOM）：
  - `trayWindowBaseLabel({ id, title })` = ``title || `Window ${id.slice(0, 8)}` ``（與 T0752 前 main.ts 內聯寫法相同）
  - `trayWindowLabels(sources)`：依輸入順序，同一個標籤第一次出現維持原樣，第 n 次（n ≥ 2）加 `` (n)``；只出現一次的標籤不變。
- `electron/main.ts` `rebuildTrayMenu`：先取 `windowMap` 中未 destroyed 的視窗（迭代順序不變），以 `trayWindowLabels` 一次算出標籤，再逐一建項目。`for … continue` 改為 `filter` + `forEach`；每個項目的 `submenu`（Show / Remove from profile）與其 click 內容逐字未改，Show All Windows、separator、Quit 未改，重建時機未改，視窗標題（`setTitle` / renderer）未碰。標籤只來自視窗標題或 id 前 8 碼，不加入路徑、帳號或 profile id。
- docs：`docs/agent-guide/multi-remote-profiles.md` 在〈驗證（T0750）〉前加一條「匣選單同名視窗標籤（T0752 / D205）」。CLAUDE.md 未改。

### 修改檔案

- `electron/main.ts`（import 一行；`rebuildTrayMenu` 標籤組法）
- `src/lib/tray-window-labels.ts`（新增）
- `src/lib/__tests__/tray-window-labels.test.ts`（新增：7 個行為測試 + 2 個 main.ts 接線 source guard）
- `docs/agent-guide/multi-remote-profiles.md`（+1 行）
- `_ct-workorders/T0752-tray-menu-duplicate-label-suffix.md`（本回報）

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| unit（新檔 + T0750 檔） | PASS | `npx vitest run src/lib/__tests__/tray-window-labels.test.ts src/lib/__tests__/profile-window-front.test.ts`：2 files / 26 tests passed |
| unit 涵蓋項目 | PASS | 無重複 → 不變；空清單；兩個同名 → 第二個 ` (2)`；三個同名 → ` (2)` / ` (3)`；多組重複各自計數、中間的唯一標籤不變；`Window <id 前 8 碼>` 後備標籤（含後備標籤重複時編號）；不改輸入 |
| main.ts 接線 source guard | PASS | `rebuildTrayMenu` 含 `trayWindowLabels(liveWindows.map(...))`、`[...windowMap].filter(([, win]) => !win.isDestroyed())`、`labels[index]`；舊內聯標籤字串已不存在；Show All Windows / Show / Remove from profile / Quit 仍在 |
| `npm run test:unit` | PASS | 361 files passed；6385 passed / 3 skipped |
| `npm run typecheck` | PASS | exit 0 |
| `npm run typecheck:electron` | PASS | exit 0 |
| `npx vite build` | PASS | exit 0；在 T0751 commit `f9072e16` 出現後才跑（D205 build 順序）；現行 chunk `dist-electron/main-XJlsBn-d.js`（`main.js` 引用）內含新的標籤函式 |
| e2e `e2e/t0750-profile-window-reopen.spec.ts` | PASS | `npx playwright test e2e/t0750-profile-window-reopen.spec.ts`：1 passed（3.7 s）；隱藏視窗「開啟」後可見、刪除 C 後存活視窗 3 → 2、registry 無 C、Terminal Server 已結束、runtime userData 已刪 |
| 匣選單實際標籤 | 未以 e2e 驗證 | 匣選單 e2e 讀不到（工單已註明），以 unit + source guard 證明 |

### 相關通過案例判定

| 案例 | 判定 | 依據 |
|---|---|---|
| T0750 BUG-183：隱藏 profile 視窗按「開啟」叫回（`bringWindowToFront` / `profileOpenNotice`） | 不受影響 | 未改 `src/lib/profile-window-front.ts`、`openProfileWindows`、second-instance；unit 與 e2e 綠 |
| T0750 BUG-184：刪除 profile 時關閉其視窗（`closeWindowsOfDeletedProfile` / `planDeletedProfileWindows`） | 不受影響 | 未改；刪除後仍呼叫 `rebuildTrayMenu`，選單列 = 存活視窗，只差標籤可能加序號；e2e 綠 |
| 匣選單 Show All Windows / Show / Remove from profile / Quit | 不受影響 | 程式逐字未改，source guard 斷言 |
| 標籤不重複時的匣選單 | 不受影響 | `trayWindowLabels` 對只出現一次的標籤原樣回傳（unit） |
| detached 視窗、PLAN-039 多 remote profile | 不受影響 | 未改 detached / registry / remote 程式；`rebuildTrayMenu` 本來就只列 `windowMap` |

沒有任何通過案例的預期結果或畫面改變。

### 發現的問題

1. （理論邊界，未處理）若某視窗標題本身就以 ` (2)` 結尾，且同時有兩個與其去尾後同名的視窗，選單會出現兩個相同的 `… (2)`。實際標題格式為 `Better Agent Terminal - <名稱>:<n>`，profile 名稱需剛好以 `:1 (2)` 之類結尾才會撞到；依 D205 的「依序加 (2)、(3)」字面實作，不另做避撞。需要時可改為跳過已存在的編號。

### 遭遇問題

- 無。`dist-electron/` 留有多個舊 `main-*.js` chunk（`vite build` 不清目錄；`npm run build` 才清），不影響本單；判斷現行產物以 `main.js` 的引用為準。

### 互動紀錄

- 無（yolo，未向塔台提問）。

### Commit

- 產品：`7775fa8f`（`git commit --only` electron/main.ts、src/lib/tray-window-labels.ts、src/lib/__tests__/tray-window-labels.test.ts、docs/agent-guide/multi-remote-profiles.md）
- 工單：本回報以 `git commit --only _ct-workorders/T0752-tray-menu-duplicate-label-suffix.md` 另一個 commit
- 未 push、未發版、未改 CHANGELOG
- 去識別化：新增內容只含 `<名稱>` / `Profile A` 等範例字樣，無真名、家目錄路徑、權杖
