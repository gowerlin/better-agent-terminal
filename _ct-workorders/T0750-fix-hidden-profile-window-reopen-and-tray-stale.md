---
schema_version: 1
schema_kind: workorder
id: T0750
title: "BUG-183 / BUG-184 修正：隱藏（最小化到匣）的 profile 視窗按「開啟」要叫回來；匣選單不再殘留已移出 profile 的視窗"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T22:06:40+0800"
updated_at: "2026-11-01T22:06:40+0800"
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

（Worker 填寫）
