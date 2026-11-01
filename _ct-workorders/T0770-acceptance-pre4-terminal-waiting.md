---
schema_version: 1
schema_kind: workorder
id: T0770
title: "pre.4 自動化驗收（安裝版）：終端分頁類 —— BUG-188 滑鼠拒絕權限清 ⚠️、detached 視窗工作區 ⚠️（T0761）、視窗沒有焦點時等待結束留淡化 ⚠️"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T05:08:42+0800"
depends_on: []
related:
  - "BUG-188（T0757 `de8a4fd4`）、T0761（`d27ee3f5`，D212）、T0735（D200–D203，D203 淡化規則）；D215（本批自動化驗收）"
  - "既有 e2e：`e2e/t0757-mouse-answer-clears-waiting.spec.ts`、`e2e/t0761-detached-workspace-waiting.spec.ts`、`e2e/t0735-workspace-waiting-badge.spec.ts`；隔離實例 `e2e/fixtures/electron-isolation.ts`（`BAT_E2E_EXECUTABLE`，T0510）"
  - "CLAUDE.md「Worker 分頁回收」節（T0735 / T0761 段）、「blocked 狀態偵測」節（滑鼠回答 T0757）；`docs/agent-guide/blocked-state.md`、`docs/agent-guide/worker-tab-recycle.md`"
affects_files:
  - "e2e/t0770-*.spec.ts（新增，檔名可調；只放本單新寫的情境）"
  - "e2e/t0757-mouse-answer-clears-waiting.spec.ts、e2e/t0761-detached-workspace-waiting.spec.ts（只在需要讓它們支援安裝版時小改，不得改斷言語意）"
  - docs/agent-guide/worker-tab-recycle.md
  - docs/agent-guide/blocked-state.md
  - _ct-workorders/T0770-acceptance-pre4-terminal-waiting.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 驗收對象：優先用安裝版 `C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe`（FileVersion `0.7.3-pre.4`，塔台已確認）以 `BAT_E2E_EXECUTABLE` 啟動隔離實例。某 spec 無法在安裝版跑（例：依賴 source build 路徑）→ 改用現有 source build `dist` / `dist-electron`（2026-11-02 04:29 由 `31fa4974` 建出；HEAD 的 `src` / `electron` / `scripts` 與 tag `v0.7.3-pre.4` 無差異，塔台已以 `git diff --stat` 確認），並在回報逐情境寫明用哪一個。🔴 不得跑 `npx vite build`（T0770–T0773 四張並行）。🔴 不改 `e2e/fixtures/electron-isolation.ts`（四張共用；需要時在自己的 spec 內寫 helper）。"
  - "🔴 情境 ①（BUG-188）：跑 t0757（真 claude CLI fullscreen ＋假模型，滑鼠點擊）：權限以滑鼠**拒絕** → ⚠️ 立即消失（主要驗收項）；不回歸：滑鼠允許、AskUserQuestion 以滑鼠回答會清、滾輪不清、鍵盤照舊、codex `input` 不被滑鼠清。安裝版跑不了就用 source build，並寫明原因。"
  - "🔴 情境 ②（T0761 detached）：跑 t0761：detached 視窗分頁等待 → 主視窗列表多一列「↗ <名稱>（已分離）」＋ ⚠️，頁籤標題 / 收合窄列計入；點該列 → detached 視窗到前景並切到該分頁；回答後清除或淡化（D203）。"
  - "🔴 情境 ③（新寫，原為手動項）：分頁等待中，讓 BAT 視窗**沒有焦點**（例：`electronApp.evaluate` 對主視窗 `blur()`，或讓隔離實例的另一個視窗取得焦點；以實際能讓 renderer `document.hasFocus()` 為 false 的方式為準，並在回報寫出用哪種方式與證據）→ 等待在無焦點時結束（由 spec 經該分頁 PTY 回答，或以 hook 回報結束）→ 縮圖 / 工作區列留**淡化** ⚠️；視窗恢復焦點且切到該分頁後清除（D203）。另驗：視窗有焦點且正看著該分頁時結束 → 不留淡化。模擬不出真正的作業系統失焦就照實記錄、該項 PARTIAL，其他照做。"
  - "🔴 不回歸：同一個對象再跑 `t0735-workspace-waiting-badge` 綠。"
  - "🔴 隔離與安全：一律用隔離實例（獨立 userData 與 remote port），不碰使用者正在用的 BAT（不讀它的 userData、不送它任何 IPC、不結束它的任何程序）。工作區 / 目錄名含 `t0770`，放 `%ProgramData%\\bat-e2e-t0770-*` 一類位置，跑完刪除。不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷 → 記在回報區〈發現的問題〉附重現步驟與證據，由塔台開 BUG。不得複製、讀出或印出任何認證檔或權杖內容，不傾印整個 `process.env`。"
  - "🔴 驗證：新 spec 跑 1 次，失敗時同一情境最多重跑 1 次並記錄（四張並行，CPU 負載高可能造成逾時，要分清楚是 flake 還是缺陷）。`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 在 tsconfig 範圍外就註明）。docs：`worker-tab-recycle.md` 的 T0735 / T0761 驗證清單補一行（情境 ③ 的 spec 位置與本次結果）、`blocked-state.md`「滑鼠回答」補一行安裝版結果。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑或帳號。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0770 — pre.4 自動化驗收（安裝版）：終端分頁類

## 元資料

- **工單編號**：T0770
- **類型**：implementation（驗收用 e2e，不改產品程式碼）
- **優先級**：P2
- **建立時間**：2026-11-02T05:08:42+0800
- **預估規模**：S

## 背景

`v0.7.3-pre.4` 已發佈。使用者選擇以自動化取代手動實機驗收（D215），對安裝版跑，與 T0771–T0773 並行。本單負責終端分頁類：BUG-188（滑鼠拒絕權限後 ⚠️ 要消失）、detached 視窗的工作區 ⚠️（T0761）、以及原本列為手動的「視窗沒有焦點時等待結束」（D203 淡化）。

## 範圍

1. 情境 ①–③（見 frontmatter），③ 新寫 spec。
2. 不回歸 t0735。
3. docs 各一行。

## 不做

- 不改產品程式碼、不 build、不改共用 fixture。
- 不碰使用者正在用的 BAT。

## 驗收

- [ ] 情境 ①–③ 逐項結果（PASS / FAIL / PARTIAL＋原因），每項寫明驗收對象（安裝版 / source build）
- [ ] t0735 綠、兩個 typecheck = 0
- [ ] 〈發現的問題〉與〈仍需手動〉

---

## 回報區
