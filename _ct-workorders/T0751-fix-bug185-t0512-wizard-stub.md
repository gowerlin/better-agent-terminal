---
schema_version: 1
schema_kind: workorder
id: T0751
title: "BUG-185 修正：e2e `t0512-profile-panel-layout` 第 2 項補 `wsl-systemd:snapshot-unit` stub，並核對 `WIZARD_STUBS` 與精靈現況"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: XS
created_at: "2026-11-01T22:26:23+0800"
updated_at: "2026-11-01T22:26:23+0800"
depends_on: []
related:
  - "BUG-185（T0750 回報區〈發現的問題〉1）；T0750（`8a432d40`）；T0554（新增 `wsl-systemd:snapshot-unit`）；T0512（原 spec）；D205（與 T0750 / T0752 一起發版）"
affects_files:
  - e2e/t0512-profile-panel-layout.spec.ts
  - _ct-workorders/T0751-fix-bug185-t0512-wizard-stub.md
  - _ct-workorders/BUG-185-t0512-wizard-e2e-missing-snapshot-unit-stub.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 目標（BUG-185）：`e2e/t0512-profile-panel-layout.spec.ts` 第 2 項（setup wizard completion block）重新通過。先確認失敗原因（T0750 Worker 判讀：`WIZARD_STUBS` 缺 T0554 新增的 `wsl-systemd:snapshot-unit`，精靈第 5 步 alert「無法讀取目前的 BAT 服務」）；stub 回傳值依 handler 實際契約（讀 `electron/main.ts` / `electron/preload.ts` / 精靈 step 的呼叫端）。同時核對 `WIZARD_STUBS` 與精靈目前呼叫的所有 channel，還有其他落差就一併補，回報列出。"
  - "🔴 只改測試：產品程式碼不動。若查出是產品缺陷（stub 補齊後仍失敗且原因在產品端），停下，記在回報區〈發現的問題〉，回 PARTIAL，由塔台開單。斷言不得放寬來湊綠（版面斷言意圖保留）。"
  - "🔴 build 順序（D205，與 T0752 並行）：本單先跑 `npx vite build`，T0752 等本單 commit 後才 build。本單 commit 後就不要再 build。"
  - "🔴 驗證：`npx vite build` 成功；`t0512-profile-panel-layout` 兩項連跑 2 次綠；以拿掉新 stub 的版本確認第 2 項會失敗（突變檢查，結果寫回報區，還原後再 commit）。不需跑 `test:unit`（只改 e2e 檔）。完成後 BUG-185 改 FIXED（附 commit、`fixed_at` 取系統時間）。不發版、不 push、不改 CHANGELOG。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑、使用者名稱或主機名。"
  - "🔴 範圍：只修 BUG-185；發現其他缺陷記在回報區〈發現的問題〉。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0751 — BUG-185 修正：t0512 精靈 e2e 補 stub

## 元資料

- **工單編號**：T0751
- **類型**：implementation（test fix）
- **優先級**：P3
- **建立時間**：2026-11-01T22:26:23+0800
- **預估規模**：XS

## 背景

T0750 重跑相關 e2e 時發現 `t0512-profile-panel-layout` 第 2 項失敗：spec 的 `WIZARD_STUBS` 沒有 T0554 新增的 `wsl-systemd:snapshot-unit`，精靈第 5 步讀不到 BAT 服務就停下。只影響測試。使用者指示修，並與 T0750 / T0752 一起發版（D205）。

## 範圍

1. 確認失敗原因、補 stub，核對 `WIZARD_STUBS` 與精靈現況。
2. 突變檢查 + 連跑 2 次。
3. BUG-185 → FIXED。

## 不做

- 不改產品程式碼、不放寬斷言。

## 驗收

- [ ] 第 2 項通過、第 1 項不受影響（連跑 2 次）
- [ ] 突變檢查：拿掉 stub 會失敗
- [ ] `WIZARD_STUBS` 核對結果

## 回報區

（Worker 填寫）
