---
schema_version: 1
schema_kind: workorder
id: T0793
title: "BUG-199：`nvm-login-profile.test.ts` 的真 bash 測試在整套 `test:unit` 下逾時 —— 量測後讓它在全套負載下穩定通過"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-02T22:40:55+0800"
updated_at: "2026-11-02T22:40:55+0800"
session_ids: []
depends_on: []
related:
  - "BUG-199（low，OPEN → FIXING）；BUG-195 / T0786（同類前例：先量再改、per-describe timeout 附量測依據，4 檔）；T0556（這支測試的來源）；T0686（CI Test gate）；D234"
  - "`src/lib/remote-tools/__tests__/nvm-login-profile.test.ts`（第 193 行 `~/.profile layout: bash -lc finds it; bash -lic loads nvm once …`）；`vite.config.ts` 的 `test` 區塊；CLAUDE.md「Frontend unit tests」節"
affects_files:
  - src/lib/remote-tools/__tests__/nvm-login-profile.test.ts
  - _ct-workorders/BUG-199-nvm-login-profile-test-timeout-under-load.md
  - _ct-workorders/_bug-tracker.md
  - _ct-workorders/T0793-fix-bug199-nvm-login-profile-test-timeout.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先量再改（比照 T0786）：單檔與整套各跑數次，記錄 `nvm login profile block under real shells (T0556)` 內每個測試的耗時（`vitest run --reporter=verbose` 或暫時計時），找出每個測試開了幾個 `bash` 程序、哪一步在負載下變慢。量測用的暫時程式碼收尾移除。"
  - "🔴 修法優先序：① 縮短不必要的工作（重複的 shell 呼叫、可共用的暫存 HOME 準備）；② 若慢是真 bash 在負載下的固有成本，替這個真 shell 的 `describe` 設明確且合理的 timeout（例 `{ timeout: 30_000 }`，與 T0786 一致），註解寫量到的最大值與 BUG-199。🔴 不得改產品程式碼（`src/lib/remote-tools/**` 非測試檔）或產品常數；不得改全域 `testTimeout`（`vite.config.ts`）；不得 skip / retry 掩蓋。根因若在產品程式碼，停下回報 PARTIAL。"
  - "🔴 範圍控制：BUG-199〈修正方向〉提到「把真子程序測試集中到共用 helper / 標記」—— 本單**不做**，只在回報區評估（目前有幾支真子程序測試設了 per-describe timeout、共用 helper 的可行性與成本），供塔台日後決定。修完後整套若出現第六支以上逾時，不擴大範圍、回報（附檔名與耗時）。"
  - "🔴 驗證：修改前整套 `npm run test:unit` 連跑 3 次記錄失敗率（對照）；修改後整套連跑 3 次 exit 0（記錄這支測試耗時）＋負載下 1 次 exit 0（例：兩個 `npm run test:unit` 同時跑，寫明造負載的方式）。`npm run typecheck` = 0。同一 checkout 有 T0792 並行跑 e2e（隔離實例），可能造成額外負載，回報區註明；不得碰 T0792 的工單檔。"
  - "🔴 BUG-199：修好後 `status: FIXED`、加 `fixed_at` / `fix_commit`，表格狀態列同步，文末補〈T0793 結果〉（根因、修法、量測）；`_bug-tracker.md` 只把 BUG-199 那一列從「⏳ 修復中 (FIXING)」移到「✅ 已修復」（區段標題照 `_local-rules.md` parser 規則），FIXING 區段放回 `_（無）_` 佔位列，更新 frontmatter `breakdown` / `generated_at` 與〈統計〉行、〈最後同步〉加一筆。🔴 不用全檔 `sed` 或一次換掉多個佔位列的替換，改完跑 parser 測試（`src/types/__tests__/` 中 bug-tracker 相關測試，L179）。"
  - "🔴 不發版、不改 CHANGELOG、不 push。公開 repo 去識別化（D176）。yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台。Git：只用 `git commit --only` commit 本單範圍。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。完成狀態寫 `DONE`（BUG 的 FIXED 寫在 BUG 單，L177）。"
---

# T0793 — BUG-199：nvm-login-profile 測試逾時

## 元資料

- **工單編號**：T0793
- **類型**：implementation（測試穩定性）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P3
- **建立時間**：2026-11-02T22:40:55+0800
- **預估規模**：S

## 背景

`0.7.3-pre.9` 聯合驗證時，`src/lib/remote-tools/__tests__/nvm-login-profile.test.ts` 的真 bash 測試在整套 `test:unit` 下超過 vitest 預設 5 s（單檔 3 / 3 通過，整檔 7.2–8.7 s）。與 BUG-195（T0786 修了 4 檔）同類，是第五支。CI Test gate（T0686）撞到會擋發版。

## 範圍

1. 量測每個測試的耗時與 bash 程序數，找出負載下變慢的地方。
2. 依優先序修（先縮短，必要時才設這個 `describe` 的 timeout）。
3. 驗證：修改前後連跑對照、負載下 1 次。
4. 評估共用 helper / 標記（只寫評估，不實作）。
5. BUG-199 → FIXED、tracker 同步。

## 不做

- 不改產品程式碼與常數、不改全域 timeout、不 skip / retry；不實作共用 helper。

## 驗收

- [ ] 量測結果（單檔 vs 整套、各測試耗時）
- [ ] 修法與理由
- [ ] 修改前後的連跑結果、負載下結果
- [ ] `typecheck` = 0
- [ ] 共用 helper 評估
- [ ] BUG-199 FIXED、tracker 只動該列、parser 測試綠

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
