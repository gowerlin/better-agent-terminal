---
schema_version: 1
schema_kind: workorder
id: T0792
title: "驗收 BUG-197 / BUG-198：以安裝版 `v0.7.3-pre.9` 跑 e2e `t0787` 多輪與 `t0694` 步驟 6（隔離實例＋假模型）"
type: verification
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-02T22:40:55+0800"
updated_at: "2026-11-02T22:40:55+0800"
session_ids: []
depends_on: []
related:
  - "BUG-197（medium，FIXED，T0790 `77ad79ea`，pre.8 起）；BUG-198（low，FIXED，T0791 `20bc7a88`，pre.9）；BUG-196（T0788，使用者實機驗收另做）；D233（驗收順序）；D234"
  - "安裝版自動化驗收前例：T0770 / T0771 / T0772 / T0777（`BAT_E2E_EXECUTABLE` 指向安裝版 exe，見 `e2e/fixtures/electron-isolation.ts` 第 18 行 T0510 註解）"
  - "`e2e/t0787-notify-into-blocked-tower.spec.ts`（T0790 拿掉 RACE 重跑 3 輪 30 情境 races 0）、`e2e/t0694-worker-resumed-badge.spec.ts`（T0791 新增步驟 6：晚到的 `stop`）"
affects_files:
  - _ct-workorders/T0792-acceptance-bug197-198-installed-pre9.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 受測對象是**已安裝的** `C:\\Program Files\\BetterAgentTerminal\\BetterAgentTerminal.exe`（`v0.7.3-pre.9`，第一百零八 session NSIS 重裝驗收 PASS）：先確認 FileVersion = `0.7.3-pre.9`、安裝版 `resources\\scripts\\bat-terminal.mjs --version` = `v0.7.3-pre.9`，不符就停下回報 BLOCKED。e2e 以 `BAT_E2E_EXECUTABLE` 指向它（隔離實例 `--runtime=<id>`），不要用 source build 代替；若某支 spec 實際仍用 repo 的 `scripts/` helper 或 hook 腳本而非安裝版 `resources/scripts`，在回報區寫明實際來源（安裝版的 hook 由安裝版 BAT 自己注入，以日誌或 `--settings` 檔路徑佐證）。"
  - "🔴 驗收項目：① BUG-197：`t0787` 跑 **3 輪**（每輪完整情境，含 UI 與 codex 情境；codex 找不到就記 skipped），記錄每輪通過數與 `races`（日誌中 `→ cleared (hook user-prompt-submit)` 出現在對話框仍在時的次數）及 `[blocked] … kept: … reported late` 出現次數。判準：3 輪全綠、races 0。② BUG-198：`t0694` 實跑（含步驟 6「晚到的 `stop` 不結束較晚開始的回合」），跑 **3 次**，記錄 `[turn] … kept: … reported late` 出現次數。判準：3 次全綠。③ 有任何失敗 → 單檔重跑 1 次判斷是偶發還是穩定失敗，兩次結果都記；不得改 spec 或產品程式碼讓它通過。"
  - "🔴 只驗收、不修：不改任何產品程式碼、spec、fixture。若 spec 需要的前置（例：`npx vite build` 才有的檔案）在安裝版模式下缺漏導致無法執行，先問塔台，不自行改 spec。BUG-197 / BUG-198 的狀態由塔台改，Worker 不動 BUG 單與 `_bug-tracker.md`。"
  - "🔴 隔離：一律隔離實例＋假模型（`fixtures/fake-anthropic-api.ts`），真實模型花費 0；不碰使用者正在用的 BAT 視窗、塔台分頁與 `%APPDATA%\\BetterAgentTerminal`。e2e 一律帶自己的 `--output`（例：系統暫存目錄下的 `t0792-<時間>`），不清、不寫共用的 `e2e-results/`；`cd` 失敗就中止，不得在 repo 根目錄跑整套 e2e（L180）。同一 checkout 有 T0793 並行（改 `src/lib/remote-tools/__tests__/nvm-login-profile.test.ts`、跑 `test:unit`），不得碰它的檔案；機器負載可能較高，回報區註明。"
  - "🔴 yolo：不得問使用者；判讀 / 範圍問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只 commit 本工單檔（`git commit --only`）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。不 push、不發版。公開 repo 去識別化（D176）：回報區的路徑把使用者家目錄寫成 `<使用者資料夾>`。完成狀態寫 `DONE`（驗收結論 PASS / FAIL 寫在回報區）。"
---

# T0792 — 驗收 BUG-197 / BUG-198（安裝版 pre.9）

## 元資料

- **工單編號**：T0792
- **類型**：verification（安裝版自動化驗收）
- **互動模式**：yolo（問題問塔台）
- **優先級**：P2
- **建立時間**：2026-11-02T22:40:55+0800
- **預估規模**：S

## 目標

BUG-197（T0790，pre.8 起）與 BUG-198（T0791，pre.9）都是 hook 回報亂序造成的狀態錯誤，修正時以 source build 驗證。本單用交付版 `v0.7.3-pre.9` 的安裝版 exe 重跑相同 e2e，作為兩張 BUG 改 CLOSED 的依據（R-G003：修正進入交付版並實測過）。

## 範圍

1. 確認安裝版版號。
2. `t0787` 跑 3 輪（BUG-197）。
3. `t0694` 跑 3 次（BUG-198，含步驟 6）。
4. 回報區列出每輪結果、日誌計數、helper / hook 實際來源、結論 PASS / FAIL。

## 不做

- 不改產品程式碼、spec、fixture；不改 BUG 單與 tracker；不用真實模型。

## 驗收

- [ ] 安裝版版號確認
- [ ] `t0787` 3 輪結果與 races 計數
- [ ] `t0694` 3 次結果（含步驟 6）
- [ ] helper / hook 實際來源
- [ ] 結論：BUG-197 PASS/FAIL、BUG-198 PASS/FAIL

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
