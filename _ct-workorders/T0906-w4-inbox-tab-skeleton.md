---
schema_version: 1
schema_kind: workorder
id: T0906
title: "PLAN-068 W4（在 `v0.8.x`）：右側欄「待辦」分頁骨架與版本判定 —— `DockablePanel` `inbox`、分區版面、`bat_contract` 解析、§6′ 判定表（分頁宣告 × 狀態檔）、P-3、分頁標題數字 / `!`、BAT 既有資料區（CT `todo` 全部、待驗收 BUG、BUG / PLAN / 工單數量、Worker 等你）、總覽 `todo` 改連結（R6）"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T05:12:00+08:00"
updated_at: "2026-11-25T05:34:16+08:00"
started_at: "2026-11-25T05:12:23+08:00"
completed_at: "2026-11-25T05:34:16+08:00"
session_ids:
  - "d22e83e9-46ef-4b03-978d-6fff2a2fe9a1"
target_version: "0.8.x（與 CT 6.1.0 同日發佈）"
depends_on: [T0903]
related:
  - "PLAN-068；T0902（規格：§1 版面示意與分區、§2.1 / §2.2 的 BAT 可讀部分、§3、§5 檔案類清單、§6′ 判定表與 P-3、§3.3 `bat_contract` 與 `todo` 型別、R6 / R8、第二版拆單 W4 列、調查結論 §3 右側欄現況）；T0903（W0 的 `tower-contract.ts` / `tower-contract-store`）；D332 / D333"
  - "T0701 / D184（指揮塔總覽，`src/lib/ct-tower-overview.ts`、`ControlTowerPanel.tsx`，唯讀、契約 v1、512 KiB）、T0894（總覽 YAML 錯誤日誌）、T0735 / T0762（Worker 等待提示）、T0788（`notify-hold-store`）、T0766（被中斷的 agent）；CLAUDE.md「指揮塔總覽（T0701，D184）」節、`docs/agent-guide/ct-tower-overview.md`"
affects_files:
  - _ct-workorders/T0906-w4-inbox-tab-skeleton.md
  - src/types/index.ts
  - src/types/
  - src/App.tsx
  - src/components/InboxPanel.tsx
  - src/components/inbox/
  - src/components/ControlTowerPanel.tsx
  - src/components/WorkspaceView.tsx
  - src/components/TowerOverview.tsx
  - src/components/__tests__/
  - src/lib/ct-tower-overview.ts
  - src/lib/inbox-model.ts
  - src/lib/__tests__/
  - src/stores/
  - src/locales/
  - src/styles/
  - src/*.css
  - e2e/
  - CLAUDE.md
  - docs/agent-guide/
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0906（塔台已預先從 `v0.8.x` `d6b9ce86` 建立分支 `ct/T0906`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0906` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `d6b9ce86e30129a1ea8c29d1f5fe5b8e078454c8`（含 W0 T0903），不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 規格來源：T0902 回報區（第一版＋〈第二版（Renew #1，D328）〉）是唯一規格；W0 已完成（T0903，`src/lib/tower-contract.ts`、`PtyManager.getTowerContract(id)`、`tower-contract-store`、`terminal:role-changed` 的 `towerContract`），**新功能只對 `towerContract == 2` 的塔台分頁生效**（R9′ 全部綁版本），既有 T0788 保留與所有現有行為不綁版本、不得改變（🔴 不回歸）。只做本單列的範圍；其他 W 單的範圍不做。與本單平行的還有 T0904（W1+W2）、T0905（W3）、T0906（W4），各自分支，由塔台的合併工單整合；改到共用檔（例 `electron/preload.ts`、`src/types/electron.d.ts`、proxied channel 清單、locales）時只做本單需要的增量。"
  - "🔴 驗證：worktree `npm ci`；**每次產品 commit 前先完整跑一次 `npm run test:unit`**（T0903 教訓：改回應形狀會打到既有 `toEqual` 斷言），最後在 head 上完整執行要第一次就全綠（附 passed / files 數）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；動到 helper 時 `npm run verify:helpers` exit 0。e2e 只用隔離實例（`launchIsolated`），不得以預設實例啟動；不碰使用者正在用的 BAT（安裝版）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn（需要真實回合的項目寫「待實機」並對應 T0902 待實機清單編號）。`TMP` 用系統預設（T0716）。程序清理照 D308。"
  - "🔴 文件：CLAUDE.md 只加一兩句＋唯一實作位置＋🔴 不變式，細節寫進 `docs/agent-guide/tower-inbox.md`（W0 已寫在 `tower-tab-title.md`；本單若需要新檔就建立並更新 `docs/agent-guide/README.md` 索引）。CLAUDE.md < 100k 字元、小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）；日誌不記訊息內容、權杖、env。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
  - "🔴 本單範圍（W4 骨架；待你決定 / 待你執行 / 到期提醒的 CT 欄位解析與回答在 W5，卡片 UI 在 W6）：① `DockablePanel` 新增 `inbox`（顯示名「待辦」/ en `Inbox` / zh-CN 對應），預設在右側；`loadDockingConfig` 對舊存檔補預設、不需遷移（舊存檔不得壞）。② 分頁版面照 §1：分區順序固定（⏸ 待你決定、🙋 待你執行、⏰ 到期提醒、👷 Worker 等你、💬 塔台訊息、📋 塔台待辦、📊 數量列），每區可摺疊並記住（localStorage，try/catch），空區塊只留一行標題；W5 / W6 的區塊先放占位（「此區塊將由後續版本提供」不得出現在交付版；本單以元件介面＋空狀態實作，W5 / W6 填資料）。③ 塔台選擇器（同工作區 > 1 個已宣告塔台時出現）。④ 版本判定：`_tower-state.md` frontmatter 新欄位 `bat_contract`（整數；缺 / 非整數 = v1）在 `ct-tower-overview.ts` 解析（不升 `summary_version`、未知鍵仍忽略、錯誤隔離同 T0701 / T0894），照 §6′ 判定表結合 W0 的分頁宣告：檔案類清單在不符時停用並顯示 P-1 / P-2 / P-3（三語系）；分頁標題數字 = 需要你動手的件數（本單可算的：Worker 等你、待驗收 BUG），選中的塔台不符時改 `!`。⑤ BAT 既有資料區：CT `todo` 全部列出（長文摺疊）、待驗收 BUG（`_bug-tracker.md` 的 FIXED / VERIFY，點擊開指揮塔 Bugs 頁）、BUG 未結 / PLAN 進行中 / 非終態工單的數量列＋連結、Worker 等你（⚠️ 等使用者、📨 待送、⏸ 被中斷，沿用既有 store）。⑥ R6：指揮塔總覽的 `todo` 區改為「N 則 → 在待辦分頁查看」，總覽其他區塊不變。⑦ 提供「面板塔台以狀態檔 `bat_contract` 判定」的純函式給 W3 / W5 使用（`src/lib/inbox-model.ts` 或 `tower-contract.ts`）。⑧ 遠端工作區與 detached 視窗沿用指揮塔的讀取管線（proxied `readCtFile`、`fs.watch`），不新增 channel。"
  - "🔴 不得改變：指揮塔總覽唯讀、契約 v1 的既有判斷、「最後更新」比對、遠端行為（T0701 / D184）；右側欄既有分頁（程式碼片段 / Skills / Agents / 指揮塔等）的位置與行為；Dialog 規則（ModalOverlay、Esc，T0563 / T0567）若本單有 Dialog。"
---

# T0906 — PLAN-068 W4：右側欄「待辦」分頁骨架與版本判定

## 背景

PLAN-068 整合設計（T0902，雙方核定）：右側欄新分頁「待辦」集中顯示需要使用者處理的事與長期追蹤清單；BAT 與 CT 強制版本對齊（契約 v2）。W0（T0903）已做分頁宣告的版本閘門；本單做分頁本身、狀態檔 `bat_contract` 判定與 BAT 已有資料的區塊。CT 6.1.0 會在 `_tower-state.md` 寫 `bat_contract: 2`（CT D868）。

## 驗收

- [ ] `inbox` 分頁（三語系名稱）、舊 docking 存檔不壞、分區 / 摺疊 / 空狀態 / 塔台選擇器
- [ ] `bat_contract` 解析與 §6′ 判定表每一列的畫面（P-1 / P-2 / P-3、標題 `!`）
- [ ] BAT 既有資料區：`todo` 全部、待驗收 BUG、數量列、Worker 等你
- [ ] R6 總覽 `todo` 改連結；總覽其他部分不變
- [ ] （塔台答覆 Q-1 / Q-2，2026-11-25）`WorkspaceView.tsx` 最小增量（`inbox` 可停靠主區 / detached）；§6′ 不符時整個待辦分頁只留選擇器與提示（含 BAT 既有資料區）；R6 只在選中塔台契約相符時生效，不符時總覽照舊顯示 `todo`；沒有已宣告塔台時以狀態檔 `bat_contract` 判定
- [ ] 面板塔台判定純函式
- [ ] 遠端 / detached 沿用既有管線
- [ ] 驗證關卡、文件、隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：`inbox` 停靠到「主區」與 detached 視窗需要改 `src/components/WorkspaceView.tsx`（不在 `affects_files`），可以加入嗎？
- **提問時間**：2026-11-25T05:14:36+08:00
- **背景**：`DockablePanel` 加 `inbox` 後，右側欄的右鍵選單本來就有「移到主區」；主區的分頁列與內容由 `WorkspaceView.tsx` 畫（`WorkspaceTab` / `PinnedContentType` 型別、`renderTabContent` 的 switch）。detached 視窗沒有側欄，只畫 `WorkspaceView`，它的分頁清單是寫死的（`['terminal','files','git',…,'control-tower']`）。不改這個檔：停到主區時分頁按鈕會出現但內容空白；detached 視窗沒有待辦分頁（工單 ⑧ 要求 detached 沿用指揮塔管線）。
- **選項**：
  - A：把 `src/components/WorkspaceView.tsx` 加進本單範圍，只做最小增量：型別加 `inbox`、`loadWorkspaceTab` 認得 `inbox`、寫死清單在 `control-tower` 前加 `inbox`、`renderTabContent` 加一個 `case 'inbox'`。其他行為不變。
  - B：不改 `WorkspaceView`；`inbox` 的右鍵選單不提供「移到主區」，detached 視窗暫時沒有待辦分頁（記為已知限制，交後續 W 單）。
  - 其他
- **建議**：A。理由：改動只是照既有 `control-tower` 的寫法多一個值，風險低；B 會讓 detached 視窗缺這個功能、要再開單補，也要在 App.tsx 為單一分頁加特例。
- **影響**：A 多改一個檔（約 10 行）＋測試；B 要在 App.tsx 的停靠選單為 `inbox` 加特例並寫已知限制。
- **是否阻擋後續步驟**：只阻擋「主區 / detached」這一塊；其餘先做。

#### Q-2：§6′ 不符（P-1 / P-2 / P-3）時，BAT 既有資料區（Worker 等你、待驗收 BUG、📋 塔台待辦 `todo`、📊 數量列）要不要一起停用？工作區沒有已宣告塔台時怎麼判定？
- **提問時間**：2026-11-25T05:14:36+08:00
- **背景**：工單 ④ 寫「檔案類清單在不符時停用並顯示 P-1 / P-2 / P-3」；T0902 §6′ 把「檔案類清單」寫成（待你決定、待你執行、到期提醒），但 §5 又把 todo / BUG / PLAN 也算檔案類；P-1 文字是「…回合訊息卡與待辦清單都停用」。另外工作區可能沒有任何已宣告塔台（例如塔台還沒開、或塔台是 Claude 面板）。
- **選項**：
  - A：停用＋提示只套在 CT 契約 v2 的三區（⏸ 待你決定、🙋 待你執行的 CT 部分、⏰ 到期提醒；本單這三區是 W5 的占位，停用時改顯示 P-x 文字）；BAT 既有資料區（👷 Worker 等你、🙋 裡的待驗收 BUG、📋 todo、📊 數量列）不論版本都顯示。分頁標題在不符時照工單顯示 `!`。工作區沒有已宣告塔台 → 以狀態檔 `bat_contract` 判定（同「面板塔台」的純函式）：`2` 相符、缺 / `1` 停用並顯示「狀態檔是契約 v1，需要 CT 6.1.0」、`> 2` 停用並顯示 P-2。
  - B：不符時整個分頁只留塔台選擇器與提示（BAT 既有資料區也停用）；沒有塔台時同 A 的狀態檔判定。
  - 其他
- **建議**：A。理由：BAT 既有資料區的內容今天在指揮塔 / 縮圖就看得到、不依賴 CT 新欄位，停用它們不保護任何東西；R6 把總覽的 `todo` 改成「到待辦分頁查看」，若 B 停用 todo，舊 CT 使用者在 BAT 裡就完全看不到完整 `todo`（總覽也只剩連結），等於回歸。
- **影響**：A / B 只差條件式顯示；選錯要改畫面與畫面測試。
- **是否阻擋後續步驟**：阻擋版本判定的畫面與測試；資料讀取與區塊骨架先做。

### 完成狀態
- **狀態**：`DONE` —— 驗收七項全部完成，驗證關卡在 head `3d469fbb` 上第一次完整執行即全綠。
- **session_id**：d22e83e9-46ef-4b03-978d-6fff2a2fe9a1
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`；C-1 工單在 `$CT_HOME/_ct-workorders/`；C-3 `affects_files` 的祖先都在（新檔在既有目錄下）；C-2 沒有 `branch` 欄位。`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0906`；`git merge-base HEAD v0.8.x` = `d6b9ce86e30129a1ea8c29d1f5fe5b8e078454c8`，與工單相符。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。
- **環境**：`CT_MODE=yolo`、`CT_INTERACTIVE=0`；BAT helper env 齊全（`BAT_REMOTE_TOKEN` 已設定）。

### 產出摘要

**塔台答覆落實的規則（Q-2，依塔台要求寫明）**
- §6′ 不符（P-1 / P-2 / P-3）時，整個待辦分頁只留塔台選擇器與提示，BAT 既有資料區（Worker 等你、待驗收 BUG、`todo`、數量列）也不顯示；分頁標題顯示 `!`。
- R6 只在選中的塔台契約相符時生效：此時總覽的 `todo` 改成「N 則 → 在待辦分頁查看」；不符、`ControlTowerPanel` 沒拿到 `workspaceId`、或狀態檔沒讀到時，總覽照舊列出 `todo`（T0701 原行為）。
- 工作區沒有已宣告塔台：以狀態檔 `bat_contract` 判定 —— `2` 可用、缺 / `1` → P-1（狀態檔版本的文字 `inbox.gate.stateV1`）、`> 2` → P-2。沒有已宣告塔台也沒有 `_ct-workorders/` 時顯示「這個工作區沒有 Control Tower」，標題不出 `!`（不算版本不符）。
- 讀檔完成前不判定、不出 `!`（避免開窗時閃一下 P-3）。

**① 分頁與停靠**
- `DockablePanel` 新增 `inbox`（`workspace.inbox`：待辦 / Inbox / 待办），預設右側，排在 `control-tower` 前（右側欄：程式碼片段 │ Skills │ Agents │ 待辦 │ 塔台）；其他面板的相對順序與預設位置不變。收合列圖示 📥。
- 舊 docking 存檔：`loadDockingConfig` 改呼叫 `normalizeDockingConfig`（`src/types/index.ts`，邏輯與原本逐字相同，只抽出來可測）→ 沒有 `inbox` 鍵就補預設，其他鍵照存檔。
- 主區 / detached（Q-1 A）：`WorkspaceView.tsx` 型別、`loadWorkspaceTab`、兩處寫死清單（`control-tower` 前）、`case 'inbox'`；另把 `workspaceId` 傳給 `ControlTowerPanel`（一行，R6 在主區 / detached 也要知道工作區；沒傳時照舊列 `todo`）。`InboxPanel` 在 `WorkspaceView` 用靜態 import（App 已經靜態載入，lazy 會觸發 vite 的「同時靜態與動態 import」警告）。

**② 版面**：固定順序 ⏸ 待你決定 → 🙋 待你執行 → ⏰ 到期提醒 → 👷 Worker 等你 → 💬 塔台訊息 → 📋 塔台待辦 → 📊 數量列（`INBOX_SECTIONS`）。有內容的區塊可摺疊，狀態存 localStorage `bat-inbox-folded-sections`（try/catch；`todo` 預設摺疊）；空區塊只留一行「⏸ 待你決定（無）」。W5 / W6 的區塊（待你決定、到期提醒、塔台訊息）以同一個 `InboxSection` 介面＋空狀態呈現，沒有占位文字（測試斷言）。

**③ 塔台選擇器**：同工作區 > 1 個已宣告塔台（`tower-contract-store` 有紀錄的分頁）才出現下拉；選擇只在記憶體（`inbox-store`，依工作區 id），選中的分頁不再是塔台時改看第一個。

**④ 版本判定**
- `parseTowerState` 多 `batContract`（整數 ≥ 1 才採用；缺 / 字串 / 小數 / ≤ 0 / 陣列 / 布林 = v1、欄位不出現）；不升 `summary_version`、未知鍵照舊忽略、YAML 錯誤照舊隔離（T0701 / T0894 的既有測試全綠）。`towerStateBatContract` 取值。
- §6′ 判定 `inboxVerdict`（`src/lib/inbox-model.ts`）：2×2 相符、2×缺/1 P-3、2×>2 P-2、未宣告/1×任何 P-1、>2×任何 P-2、沒有塔台以狀態檔判定。P-1 / P-2 沿用 W0 的 `towerContract.*` 文字，P-3 與狀態檔版 P-1 新增 `inbox.gate.*`（三語系）。
- 標題：側欄（左 / 右）分頁名後的 `InboxTabBadge`：相符時 = Worker 等你項目數＋待驗收 BUG 數（0 不顯示），不符時 `!`；主區分頁列不顯示（Q-1 只做最小增量）。

**⑤ BAT 既有資料區（相符時）**
- 🙋 待你執行：`_bug-tracker.md` 的 `FIXED` / `VERIFY`（不含封存），「開啟」→ 指揮塔 Bugs 頁。
- 👷 Worker 等你：這個工作區的分頁 ⚠️（`waitingForUser`，最久的在前）、📨 待送（`notify-hold-store`）、⏸ 被中斷（`interrupted-agents-store`）；`?` / `✓` / `↻`（等塔台）不列。⚠️ / 📨 →「切到分頁」，⏸ →「恢復…」（開既有的被中斷對話框）。
- 📋 塔台待辦：CT `todo` 全部，超過 160 字或多行的摺疊成第一行、可展開。
- 📊 數量列：BUG 未結（`OPEN` / `FIXING`）· PLAN 進行中（`IN_PROGRESS`）· 工單（`workOrderPhase` = open），各連到指揮塔 Bugs / Backlog / 工單頁。
- 跨分頁開啟：`requestControlTowerTab` / `requestOpenInbox`（`inbox-store`）發 window 事件，App 依停靠位置切換（detached 走 `workspace-switch-tab`）；指揮塔面板還沒掛載時，掛載時取走請求。

**⑥ R6**：`TowerOverview` 新 prop `todoInInbox` / `onOpenInbox`；判斷在 `ControlTowerPanel`（`useInboxVerdict`，與待辦分頁同一個判定）。總覽其他區塊（狀態、`next_ids`、`*config`、sprint、進行中工單）與唯讀、契約 v1、「最後更新」比對都沒改。

**⑦ 純函式**：`stateFileContractStatus(batContract)`（面板塔台 / 沒有宣告分頁時以狀態檔判定），`inboxVerdict`、`pickInboxTower` 等都在 `src/lib/inbox-model.ts`，不 import electron / DOM，W3 / W5 可直接用。

**⑧ 遠端 / detached**：`InboxDataSource`（`src/components/inbox/InboxDataSource.tsx`）只用既有 `fs:readdir` / `fs:readFile` / `fs:stat` / `fs:watch` / `fs:changed`（遠端 proxied），沒有新增 channel；App 對作用中工作區、detached 視窗對自己的工作區各掛一個。

**附帶修正（防回歸）**：主行程的 `fs:watch` 一個路徑只有一個 watcher、`fs:unwatch` 不計數 → 指揮塔與待辦資料來源同時看 `_ct-workorders/` 會互相關掉自動更新。新增 `acquireDirWatch`（`src/stores/ct-dir-watch.ts`，同一視窗內計數），`ControlTowerPanel` 的 `_ct-workorders/` 監看改經它（`_bmad-output/`、`.git` 監看不變）。

**文件**：CLAUDE.md 新節「右側欄「待辦」分頁（PLAN-068 W4 / T0906）」（5 行，其他節標題未改；89,112 字元 < 100k）；新檔 `docs/agent-guide/tower-inbox.md`（判定表、區塊、跨分頁開啟、遠端、已知限制、驗證清單）；`docs/agent-guide/README.md` 索引；`ct-tower-overview.md` 補 `bat_contract`、R6、共用監看。

**變更檔案**（產品 commit `3d469fbb`）
- 新增：`src/lib/inbox-model.ts`、`src/components/InboxPanel.tsx`、`src/components/inbox/{InboxDataSource.tsx,InboxSection.tsx,useInboxModel.ts}`、`src/stores/{inbox-store.ts,ct-dir-watch.ts}`、`src/styles/inbox.css`、`docs/agent-guide/tower-inbox.md`
- 修改：`src/types/index.ts`、`src/App.tsx`、`src/components/{ControlTowerPanel,TowerOverview,WorkspaceView}.tsx`、`src/lib/ct-tower-overview.ts`、`src/stores/{tower-contract-store,notify-hold-store}.ts`（各加一個 version hook）、`src/locales/{en,zh-TW,zh-CN}.json`、`CLAUDE.md`、`docs/agent-guide/{README,ct-tower-overview}.md`
- 新測試：`src/lib/__tests__/inbox-model.test.ts`（17）、`src/lib/__tests__/ct-tower-overview-bat-contract.test.ts`（4）、`src/components/__tests__/inbox-panel.test.tsx`（24）

**驗證**（皆在 head `3d469fbb`，工作樹乾淨）
- `npm ci`：exit 0
- `npm run test:unit`：PASS，469 files passed、3 skipped；8,627 tests passed、42 skipped。commit 前也完整跑過兩次（第一次在文件與 `WorkspaceView` 靜態 import 修改之前：8,622 passed / 47 skipped；第二次在 commit 內容上：8,627 passed / 42 skipped；總數都是 8,669，差在環境相關的 skip），三次都全綠、沒有失敗過。
- `npm run test:legacy`：PASS，33 / 33 files、472 tests、0 failed
- `npx vite build`：exit 0（5 個既有的「同時靜態與動態 import」警告，都與本單無關）
- `npm run typecheck`：0；`npm run typecheck:electron`：0
- `npm run verify:helpers`：不適用（沒有動 helper）
- e2e：沒有跑、沒有新增（沒有啟動任何 BAT 實例，沒碰安裝版）；畫面以 jsdom 元件測試驗證，實機看畫面交 W8。

**各驗收項目**
- `inbox` 分頁、三語系、舊 docking 存檔、分區 / 摺疊 / 空狀態 / 選擇器：PASS
- `bat_contract` 解析與 §6′ 每一列的畫面（P-1 / P-2 / P-3、標題 `!`）：PASS（`inbox-panel.test.tsx` 每列一個畫面測試＋`inbox-model.test.ts` 判定表）
- BAT 既有資料區：PASS
- R6：PASS（`TowerOverview` 相符 / 不符，`ControlTowerPanel` 宣告 v2 塔台＋狀態檔 2 → 連結、未宣告 → 照舊列出、沒有 `workspaceId` → 照舊列出）
- 面板塔台判定純函式：PASS（`stateFileContractStatus`）
- 遠端 / detached 沿用既有管線：PASS（程式審查＋資料來源測試；遠端實機未驗）
- 驗證關卡、文件、隔離分支證據：PASS

### 互動紀錄
- [05:12] 開工：落點檢查、`git merge-base HEAD v0.8.x` = `d6b9ce86…` 相符；背景 `npm ci`。
- [05:14] Q-1: `WorkspaceView.tsx` 不在 `affects_files` → A（塔台，BAT 通道 `q-dee2b97e-dbc5b64ce4b68bee`）：加入本單、只做最小增量 → Action: 型別、寫死清單、`case 'inbox'`。
- [05:14] Q-2: 不符時 BAT 既有資料區是否停用、沒有塔台怎麼判定 → B（塔台，`q-dee2b97e-6d883ae615b76b2f`）：不符時整個分頁只留選擇器與提示；R6 只在選中塔台相符時生效（不符時總覽照舊顯示 `todo`）；沒有已宣告塔台 → 狀態檔 `2` 可用 / 缺或 `1` P-1 / `> 2` P-2；標題不符 `!` → Action: 照辦，補 R6 相符 / 不符兩種的總覽測試。
- [05:31] 產品 commit `3d469fbb`（commit 前完整 `test:unit` 全綠）；[05:33] 在 head 上重跑 typecheck ×2、vite build、`test:unit`、`test:legacy` 全綠。

### Renew 歷程
無

### 遭遇問題
- 無阻斷問題。
- 我在 05:14 寫入〈待塔台決策〉時誤刪了 `### 完成狀態` 標題（與其下的 `session_id` 行），收尾時補回；塔台在中間看到的工單少了這個標題。
- 以 heredoc 執行含 `\u{…}` 的 Python 編輯腳本時反斜線被收掉（R-G005 第 1 / 3 點），沒有寫入任何檔案；改用 Write 寫腳本檔再執行。
- 已知限制（寫進 `docs/agent-guide/tower-inbox.md`）：`_ct-workorders/` 在開啟後才建立不會自動開始監看（同指揮塔，按 ↻）；目錄監看計數只在同一視窗內（另一個 detached 視窗 unwatch 同路徑仍會關掉主行程 watcher，T0906 之前就有）；已宣告塔台只在記憶體（W0 限制）；待辦與指揮塔各讀一次工單檔。
- 待實機（交 W8）：右側欄實際畫面與寬度、遠端（WSL / SSH / Docker）工作區的讀檔與監看、detached 視窗的待辦分頁。

### 隔離分支證據
- branch：`ct/T0906`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`，與 `main` 的共同祖先，屬工單所述預期）；`git merge-base HEAD v0.8.x` = `d6b9ce86e30129a1ea8c29d1f5fe5b8e078454c8`
- validated_sha：`3d469fbb0e3c5dafeb42e095f3eb413585fae4cf`
- head_sha：`3d469fbb0e3c5dafeb42e095f3eb413585fae4cf`
- validated_sha ≠ head_sha 的說明：兩者相同（產品 commit 後在 head 上重跑全部關卡）。

### 回報時間
2026-11-25T05:33:07+08:00
