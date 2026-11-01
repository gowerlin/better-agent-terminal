---
schema_version: 1
schema_kind: workorder
id: T0770
title: "pre.4 自動化驗收（安裝版）：終端分頁類 —— BUG-188 滑鼠拒絕權限清 ⚠️、detached 視窗工作區 ⚠️（T0761）、視窗沒有焦點時等待結束留淡化 ⚠️"
type: implementation
status: DONE
started_at: "2026-11-02T05:14:22+0800"
updated_at: "2026-11-02T05:21:47+0800"
completed_at: "2026-11-02T05:21:47+0800"
session_ids:
  - "05cd957e-b3f8-45e6-b0fa-d8568e10d6a4"
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

- [x] 情境 ①–③ 逐項結果（PASS / FAIL / PARTIAL＋原因），每項寫明驗收對象（安裝版 / source build）
- [x] t0735 綠、兩個 typecheck = 0
- [x] 〈發現的問題〉與〈仍需手動〉

---

## 回報區

### 完成狀態

- **狀態**：DONE（情境 ①–③ 全部 PASS，對象皆為安裝版；t0735 綠；兩個 typecheck = 0）
- **session_id**：05cd957e-b3f8-45e6-b0fa-d8568e10d6a4
- **完成時間**：2026-11-02T05:21:47+0800

### 落點檢查

- 結果：**PASS**
- C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單位於 repo 根目錄下的 `_ct-workorders/` → PASS
- C-3（資訊用）：`e2e/`、`docs/agent-guide/worker-tab-recycle.md`、`docs/agent-guide/blocked-state.md` 都存在 → present
- C-2：工單沒有 `branch` 欄位，不適用（目前在 `main`）
- `CT_HOME` 未設定（非 worktree）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）；`CT_MODE` = `yolo`

### 驗收對象

- 全部情境都用**安裝版** `C:\Program Files\BetterAgentTerminal\BetterAgentTerminal.exe`（`0.7.3-pre.4`，塔台已確認），經 `BAT_E2E_EXECUTABLE` 啟動隔離實例；沒有改用 source build，也沒有跑 `npx vite build`。
- 安裝版內嵌 claude：`2.1.316`（`resources/app.asar.unpacked/.../claude-code/bin/claude.exe --version`，與 repo 的相同）。
- helper 腳本來源：t0735 / t0761 / t0757 沿用 spec 原寫法，在測試程序端跑本 repo 的 `scripts/`（塔台已確認與 tag `v0.7.3-pre.4` 無差異）；t0770 分頁內的 `bat-hook.mjs` 取 PTY 自己的 `BAT_HELPER_DIR`，實測為安裝版的 `resources\scripts`（`helperDirFromPty=true`）。
- Playwright `--output` 一律指到 session 暫存目錄（避免和並行的 T0771–T0773 共用 `e2e-results/` 而互相清掉）。

### 情境結果

| 情境 | 對象 | 結果 | 證據 |
|---|---|---|---|
| ① BUG-188（`e2e/t0757-mouse-answer-clears-waiting.spec.ts`） | 安裝版 | **PASS**（1 次即綠，1.0 min） | ② 點「4. No」拒絕權限 → `[blocked] … → cleared (mouse press)`，縮圖與工作區列 ⚠️ 消失、看著分頁不留淡化（主要驗收項）。不回歸：① 點「1. Yes」→ `cleared (mouse press)`、工具照常執行；③ AskUserQuestion 點「1. Alpha」→ `cleared (mouse press)`；④「Chat about this」/ ⑤ elicitation「Decline」→ 清除（claude 對話框仍開著，以 Esc 關）；W 6 次滾輪 → 仍 blocked、縮圖與列 ⚠️；K Enter → `cleared (user input)`；⑥ codex 0.166.0 點「Yes, proceed」→ 沒有 OSC、`input` 保留，`y` → `cleared (osc working)`。claude 滑鼠追蹤 `any`、alternate buffer。proxy 沒有任何對外連線、debug log 沒有權杖。 |
| ② T0761 detached（`e2e/t0761-detached-workspace-waiting.spec.ts`） | 安裝版 | **PASS**（1 次即綠，12.2 s） | B detach 後主視窗無 B 列 → B 的分頁 `ask-user-question` → 主視窗多一列 `↗ T0761-B` ＋ ⚠️（`data-waiting=waiting`、tooltip 列出分頁）、「工作區」頁籤標題 ⚠️、B 仍隱藏；detached 視窗看別的分頁時結束 → 淡化；再等 → 點該列 → detached 視窗在前（`focused window after the click: detached`、visible 且非最小化）並切到該分頁；在看時結束 → 列消失（`detached document.hasFocus() = true`）；關閉 detached 視窗 → 列消失、B 自己的列回來且 ⚠️。收合窄列由 ③ 同批的 t0735 驗（下一列）。 |
| ③ 視窗沒有焦點時結束（新寫 `e2e/t0770-unfocused-wait-missed.spec.ts`） | 安裝版 | **PASS**（A–D 全綠，13.8 s） | 失焦方式：先以 CDP `Emulation.setFocusEmulationEnabled(false)` 關掉 Playwright 的 focus emulation，再讓**隔離實例自己的另一個 BrowserWindow**（`t0770-focus-sink`）`focus()`。證據：A 前 `{"hasFocus":true,"focusedWindow":"window#1"}`；B 失焦後 `{"hasFocus":false,"focusedWindow":"focus-sink"}`。A 有焦點且看著該分頁時結束 → 縮圖與列都沒有淡化（再等 1.5 s 仍無）；B 該分頁仍是 active、失焦時結束 → 縮圖 `.attention-badge.missed`（tooltip 有時間）、工作區列 `data-waiting=missed`；C 失焦時以 DOM click 切到另一個分頁（`hasFocus` 仍 false）→ 關掉 focus-sink、主視窗取回焦點（`window#1`、`hasFocus:true`）→ 仍淡化；切回該分頁 → 縮圖與列都清除；D 分頁一直是 active、失焦時結束 → 淡化，只恢復焦點（不點擊）→ 清除。 |
| 不回歸 t0735（`e2e/t0735-workspace-waiting-badge.spec.ts`） | 安裝版 | **PASS**（1 次即綠，4.3 s） | 列 ⚠️ 在狀態點左邊、頁籤標題 ⚠️、未看時淡化、收合窄列 ⚠️ 與點擊展開、點列切到分頁、在看時結束不留淡化。 |

**重跑紀錄**：t0757 / t0761 / t0735 各跑 1 次即綠，沒有重跑。t0770 共跑 3 次，前兩次是 spec 本身的問題、修改 spec 後才跑第 3 次（不是同一份 spec 重跑，也不是 flake 或產品缺陷）：

1. 第 1 次：B 判 PARTIAL（spec 照設計寫成記錄後跳過）。Electron 端 `getFocusedWindow()` 已是 `focus-sink` / `none`，主視窗 `document.hasFocus()` 卻一直是 true。原因是 Playwright 預設對每個頁面做 focus emulation。修正：spec 以 CDP 關掉 emulation。
2. 第 2 次：A、B PASS，C 失敗。spec 用 Playwright 滑鼠點另一個分頁的縮圖，點完後 `hasFocus` 變成 true（作業系統焦點仍在 focus-sink），淡化 ⚠️ 在取回焦點前就消失了。修正：C 改用 DOM click 切分頁；「只恢復焦點就清除」另立為 D。見〈發現的問題〉觀察 2。
3. 第 3 次：A–D PASS。

### 驗證

- `npm run typecheck`：exit 0（0 錯誤）
- `npm run typecheck:electron`：exit 0（0 錯誤）
- 新 spec 不在兩個 tsconfig 的 `include` 範圍內（`src` / `electron/**` + `vite.config.ts`）。另外單檔跑 `npx tsc --noEmit --skipLibCheck --strict --esModuleInterop --target ES2022 --module commonjs --moduleResolution node --types node e2e/t0770-unfocused-wait-missed.spec.ts`（連同 fixture）→ 0 錯誤。
- 隔離與清理：每次都是 `--runtime=e2e-<name>-<ts>` 的獨立 userData 與 remote port；teardown 記錄 `Terminal Server … alive after teardown: false`、`runtime userData removed: true`；t0770 的 `%ProgramData%\bat-e2e-t0770-*` 已刪除（`t0770 folder removed: true`）；暫存目錄沒有 `bat-t0735-*` / `bat-t0761-*` / `bat-t0757-*` 殘留。另看到 `bat-e2e-t0773-*` 的目錄與 runtime，屬並行的 T0773，沒有動。
- 沒碰使用者正在用的 BAT：沒讀它的 userData、沒送 IPC、沒結束它的程序。新 spec 不讀任何權杖或認證檔（分頁內 hook 用 PTY 自己的範圍權杖）；t0735 / t0761 沿用原寫法，在測試程序內解密**隔離實例自己的** `server-token.json` 來建立分頁，沒有印出。沒有傾印 `process.env`。

### 變更檔案

- `e2e/t0770-unfocused-wait-missed.spec.ts`（新增）
- `docs/agent-guide/worker-tab-recycle.md`：T0735 驗證清單後補一行（情境 ③ 的 spec、失焦作法、安裝版結果，以及 Playwright focus emulation 的注意事項）
- `docs/agent-guide/blocked-state.md`：「滑鼠回答」補一行安裝版結果
- 沒有改產品程式碼（`src/` / `electron/` / `scripts/`）、`e2e/fixtures/electron-isolation.ts`、t0757 / t0761 spec。

### Commit

- 產品／測試／文件：`7ad66d1d`（`git commit --only` 三個檔案；diff 只有本單的 +295 行）
- 工單：本次回報的 commit（在此之後）
- 沒有 push、沒有發版、沒有改 CHANGELOG。

### 發現的問題

- **產品缺陷：無。**
- **觀察 1（測試，給塔台參考）**：Playwright 預設對每個頁面做 focus emulation，所以既有 spec 讀到的 `document.hasFocus()` 一律是 true。t0735 第 4 步、t0761 第 5 步、t0757 的「不留淡化」檢查因此都會走「有焦點」那一支，不能當作「作業系統真的有焦點」的證據；也不會因為失焦而走到 skip 分支。本次三支都綠，t0761 另有 Electron `getFocusedWindow()` = detached 可佐證；t0735 / t0757 沒有作業系統層的焦點證據。要讓它們量到真的焦點，可比照 t0770 加 CDP `Emulation.setFocusEmulationEnabled(false)`。這會改變那些 spec 的分支行為，需另開工單，本單依範圍沒有改。
- **觀察 2（行為，依 D203 定義屬預期，請塔台裁示是否接受）**：視窗沒有焦點時，等待中的分頁是 active 且已留淡化 ⚠️；這時用滑鼠點**另一個**分頁的縮圖，淡化會消失，使用者其實沒切到該分頁（t0770 第 2 次執行，Playwright 滑鼠點擊重現）。推論的機制：點擊先讓視窗取得焦點，那一刻等待中的分頁仍是 active，依 D203「有焦點時的 active 分頁 = 看過」而清除，之後才換分頁。重現：分頁 X 等待中且是 active → 視窗失焦 → X 結束（淡化）→ 用滑鼠點分頁 Y 的縮圖 → X 的淡化消失。真實作業系統的滑鼠點擊順序沒有另外實測（Playwright 經 CDP 送的點擊和實體滑鼠不一定相同）。

### 仍需手動

- 切到**其他應用程式**造成的失焦（Alt+Tab、點別的程式）、最小化 BAT 視窗：t0770 用的是同一個隔離實例的另一個視窗，renderer 收到的 `blur` / `hasFocus()` 相同，但作業系統層的路徑不同。
- 觀察 2 用實體滑鼠點擊時的實際表現。
- macOS / Linux：沒有涵蓋（t0757 只支援 Windows；t0770 / t0735 / t0761 這次只在 Windows 跑）。

### 互動紀錄

- 無（沒有向塔台提問）。

### 遭遇問題

- t0770 開發中的兩個 spec 問題（focus emulation、Playwright 點擊造成焦點），已在 spec 內修正，見〈重跑紀錄〉。
