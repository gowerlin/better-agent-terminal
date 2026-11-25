---
schema_version: 1
schema_kind: workorder
id: T0922
title: "PLAN-069：待辦分頁推薦項（`awaiting_user[].recommended` 標記＋預設選取）與放棄 / 略過（單筆、勾選批次、全部；`inbox_features` 含 `dismiss` 才顯示），回答格式放寬到批次；對應 CT 6.2.0-pre.1"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-069
priority: P1
sizing: M
created_at: "2026-11-25T20:57:34+08:00"
started_at: "2026-11-25T20:59:21+08:00"
updated_at: "2026-11-25T20:59:21+08:00"
target_version: "0.8.0-pre.4（與 CT 6.2.0 同日發佈）"
depends_on: []
related:
  - "PLAN-069；交辦稿 `_ct-workorders/_handover-2026-11-25-inbox-recommended-dismiss.md`（C-1–C-5、CT 回覆、R6）；CT 回覆稿 ACCEPTED（CT D886 / D888），CT T0566 規範（CT D889）"
  - "PLAN-068 W4 / W5 / W6：T0906（待辦分頁、`inboxVerdict`）、T0908（清單解析、回答 IPC `tower-inbox:answer`、`checkInboxAnswer`、`enqueueAnswer`）；T0788（通知保護）"
affects_files:
  - _ct-workorders/T0922-inbox-recommended-and-dismiss.md
  - src/lib/tower-inbox.ts
  - src/lib/ct-tower-overview.ts
  - src/lib/inbox-model.ts
  - src/lib/inbox-answer.ts
  - src/lib/__tests__/
  - src/components/InboxPanel.tsx
  - src/components/inbox/
  - src/components/__tests__/
  - src/types/
  - src/locales/
  - src/styles/
  - electron/notify-hold.ts
  - electron/__tests__/
  - electron/remote/__tests__/
  - CLAUDE.md
  - docs/agent-guide/tower-inbox.md
  - site/tower-inbox.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: on
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0922` 寫檔（base = 派工當下的 `main`；D344：產品改動回到 `main`，`v0.8.x` 不再使用）。不 merge / rebase、不切分支、不 push、不動 `main`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 規格來源（唯一權威）：CT 6.2.0-pre.1 `references/memory-protocol.md` § 契約 v2 欄位（CT commit `7ea750f`）。檔案位置：從主 checkout 算 `../../BMad-Control-Tower/BMad-Control-Tower-v6.2.0-pre.1/skills/control-tower/references/memory-protocol.md`（`$CT_HOME` 的上兩層是 `BMad-Guide`）。行號：`inbox_features` :32 / :55 / :205；推薦項排法 :220、`recommended` :221；放棄 / 略過的處理 :268–:278；回答格式：放棄 / 略過判斷 :288–:294、批次 :295–:303、編號已結 :304、確認行 :305–:306；暫停改用原生選單（R6）:308–:328；完整範例 :348 起。範例狀態檔：同一個 CT 目錄下 `skills/control-tower/scripts/tests/fixtures/frontmatter/good/tower-state-v620.md`（含不認得的值 `future-value`、flow 與 block 兩種 `options` 寫法、推薦代號大小寫不同、自由回答；「原文標記QZX」是測試標記）。CT 檔案只讀，不得修改；要用範例時複製一份到 BAT 的測試 fixture。"
  - "🔴 驗證：worktree `npm ci`；每次產品 commit 前先完整跑一次 `npm run test:unit`，最後在 head 上完整執行要第一次就全綠（附 passed / files 數）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。e2e 只用隔離實例（`launchIsolated`），不得以預設實例啟動；不碰使用者正在用的 BAT（安裝版）與其 userData / Terminal Server / `bat-pty-holder`；不開會耗 token 的 claude / codex turn（需要真實回合的項目寫「待實機」）。程序清理照 D308。"
  - "🔴 文件：CLAUDE.md 只在「待辦分頁的契約 v2 清單與回答（PLAN-068 W5 / T0908）」節加一兩句＋唯一實作位置＋🔴 不變式（小節標題不改名，T0595；CLAUDE.md < 100k 字元），細節寫進 `docs/agent-guide/tower-inbox.md`；使用者說明 `site/tower-inbox.md`（網站頁）補推薦標記與放棄的操作。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑；日誌不記 `summary` / `options` / 回答內容 / 原因文字（只記 id、長度、筆數）。"
---

# T0922 — PLAN-069：待辦分頁推薦項與放棄

## 背景

PLAN-068 把塔台的「待你決定 / 待你執行」放進右側欄「待辦」分頁（T0906 / T0908，契約 v2）。使用者要兩件事（D346）：① 看得出塔台推薦哪個選項；② 能放棄——整批不做、原問題不合時宜、要改方向時，所有選項都不適用。CT 已依 BAT 交辦稿定案並出 6.2.0-pre.1 規範（CT D886 / D888 / D889），本單做 BAT 端。R6（CT 暫停改用原生選單）是 CT 端的事，BAT 不用改。

## 任務指令

### 前置條件

- 本工單全部（含 frontmatter `memory_overrides`）
- CT 規範（frontmatter 規格來源列的行號）與範例狀態檔
- BAT：`docs/agent-guide/tower-inbox.md`〈契約 v2 清單與回答〉〈版本判定〉、CLAUDE.md「右側欄「待辦」分頁」「待辦分頁的契約 v2 清單與回答」兩節
- 程式：`src/lib/tower-inbox.ts`（`parseTowerInboxLists`、`parseAwaitingOptions`、`checkInboxAnswer`）、`src/lib/ct-tower-overview.ts`（`parseTowerState`）、`src/lib/inbox-model.ts`（`inboxVerdict`、`inboxAnswerTargets`）、`src/lib/inbox-answer.ts`、`src/components/inbox/InboxLists.tsx`、`electron/notify-hold.ts`（`registerTowerInboxAnswerHandler`、`enqueueAnswer`）

### 範圍（塔台已定，Worker 照做）

1. **解析**
   - 頂層 `inbox_features`：字串陣列；不是陣列或不存在 = 空陣列；不認得的值忽略（例 `future-value`）。只在 `inboxVerdict` 判定相符時使用。
   - `awaiting_user[].recommended`：選填字串，與同筆 `options` 的代號**不分大小寫**比對；對不到、`options` 為空或改成自由回答欄時 = 沒有推薦；🔴 不報錯、不略過該筆。
2. **推薦標記**（不看 `inbox_features`，只看欄位本身；版本判定相符才有整個分頁）
   - 推薦的選項旁顯示「推薦」標記（三語系），並在使用者還沒選任何選項時預設選取它。
   - 顯示順序照 CT 寫的順序（CT 會把推薦項排第一），BAT 不重排；說明文字裡 CT 保留的「（推薦）」照原文顯示（不去除）。
3. **放棄 / 略過控制項**：只在 `inbox_features` 含 `dismiss` 時顯示；沒有時畫面與現在完全相同（🔴 不回歸）。
   - 單筆：待你決定每筆有「放棄」，待你執行每筆有「略過」；按下後展開一欄選填的「原因 / 新方向」＋送出 / 取消（頁內，不用 `window.confirm`；若做成 Dialog 必須用 `ModalOverlay`＋[X]＋`onEscape`，T0563 / T0567）。送出 `U-n：放棄` 或 `U-n：放棄 <文字>`；`A-n：略過` 或 `A-n：略過 <文字>`（全形冒號，文字換行改空白）。
   - 勾選批次：每筆加勾選框；每區一列工具列「放棄勾選（N）」/「略過勾選（N）」＋「全部放棄」/「全部略過」，共用一欄選填文字，送出前頁內確認一次（列出編號）。
   - 批次送出格式：每區一行，編號以 `、` 分隔，例 `U-1、U-3、U-4：放棄 <文字>`、`A-2、A-3：略過`。「全部」在**送出當下**展開成畫面上目前列出的明確編號；🔴 不送萬用字元或範圍。兩區同時送時各送一行（各自一次回答 IPC）。
   - 送出後沿用既有回答路徑（`tower-inbox:answer` → `enqueueAnswer`，受 prompt / `draft` 保護；面板塔台走既有面板路徑），「最近已結」照舊以清單消失判定。
4. **回答檢查放寬**（`checkInboxAnswer`，renderer 與 host 共用）
   - 既有單編號格式行為不變（🔴 既有測試不改）。
   - 新增多編號：冒號前是 `[UA]-\d+` 以 `、`、`,`、`，` 分隔（前後空白忽略），而且冒號後第一個詞是「放棄」或「略過」（第一個詞的定義照 CT :288–:290：後面是行尾、半形 / 全形空白，或 `，` `,` `。` `；` `;`）才接受；其他多編號行拒絕。仍是單行、≤ 1,000 字。
   - host 端 `registerTowerInboxAnswerHandler` 的拒絕規則與日誌形式不變（只記 id 數量 / 長度 / 結果）。
5. **i18n**：`src/locales/en.json`、`zh-TW.json`、`zh-CN.json` 都補。
6. **文件**：`docs/agent-guide/tower-inbox.md` 新增〈推薦項與放棄（PLAN-069）〉：`inbox_features` 讀法、推薦比對、控制項出現條件、送出格式、「全部」展開規則、相容表（舊 CT / 新 CT × 舊 BAT / 新 BAT）、R6 說明（CT 暫停開原生選單時，塔台分頁為 `question` blocked，待辦分頁送出的回答由通知保護保留到選單關閉；同一筆已在終端回答時 CT 回「編號已結」）、已知限制、驗證清單；CLAUDE.md 一兩句；`site/tower-inbox.md` 補使用者操作。

### 不做

- 不改 CT 任何檔；不改 `bat_contract` / `towerContractStatus` / `--set-role` 輸出；不改 W4 版本判定與 R6 規則；不改 T0788 既有保留規則與 `bat-notify` / `bat-terminal` 的 exit code、stdout。
- 不在 BAT 解讀回答內容或改寫 `_tower-state.md`（BAT 對 CT 檔唯讀）。
- 不發版、不改 `package.json` 版號、不改 README（發版時塔台另做）。

## 驗收

- [ ] 用 CT 範例狀態檔（複製成 BAT fixture）的單元測試：`inbox_features` 解析（含 `future-value` 忽略、非陣列 / 缺少 = 空）、`recommended` 不分大小寫比對、對不到 / 空選項 / 自由回答時無推薦且不略過。
- [ ] 元件測試：有 `recommended` → 標記＋預設選取；`inbox_features` 無 `dismiss` → 沒有任何放棄 / 略過 / 勾選 / 全部控制項（與修改前相同）；有 `dismiss` → 單筆與批次控制項出現、送出字串正確（含有無附文字、換行改空白、「全部」展開成目前列出的編號、兩區各一行）。
- [ ] `checkInboxAnswer`：既有測試不變全過；多編號＋放棄 / 略過接受，多編號＋選項代號 / 自由文字拒絕，萬用字元 / 範圍拒絕，單行與 1,000 字限制照舊；host handler 測試覆蓋批次行。
- [ ] 日誌不含 `summary` / `options` / 回答 / 原因文字（測試斷言）。
- [ ] `npm run test:unit` 在 head 第一次完整執行全綠（附數字）、`npm run test:legacy` 全綠、`npx vite build` exit 0、`npm run typecheck` = 0、`npm run typecheck:electron` = 0。
- [ ] 文件三處已更新；CLAUDE.md < 100k 字元。
- [ ] 回報區列出〈待實機〉：對應 CT T0566〈給塔台〉第 3 點 M-1–M-15 中需要真實塔台回合的項目（由塔台與 CT 安排雙方驗收）。

## Sub-session 執行指示

> 開始時填 `started_at`、狀態改 `IN_PROGRESS`；完成後填回報區、改狀態與 `completed_at`。

---

## 回報區

### 完成狀態

### 產出摘要

### 驗證

### 待實機

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 建議後續

### 隔離分支證據
- branch：`ct/T0922`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
