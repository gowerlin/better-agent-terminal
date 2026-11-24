---
schema_version: 1
schema_kind: workorder
id: T0906
title: "PLAN-068 W4（在 `v0.8.x`）：右側欄「待辦」分頁骨架與版本判定 —— `DockablePanel` `inbox`、分區版面、`bat_contract` 解析、§6′ 判定表（分頁宣告 × 狀態檔）、P-3、分頁標題數字 / `!`、BAT 既有資料區（CT `todo` 全部、待驗收 BUG、BUG / PLAN / 工單數量、Worker 等你）、總覽 `todo` 改連結（R6）"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T05:12:00+08:00"
updated_at: "2026-11-25T05:15:40+08:00"
started_at: "2026-11-25T05:12:23+08:00"
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
- **session_id**：

### 產出摘要

### 互動紀錄
- [05:12] 開工：落點檢查、`git merge-base HEAD v0.8.x` = `d6b9ce86…` 相符；背景 `npm ci`。
- [05:14] Q-1: `WorkspaceView.tsx` 不在 `affects_files` → A（塔台，BAT 通道 `q-dee2b97e-dbc5b64ce4b68bee`）：加入本單、只做最小增量 → Action: 型別、寫死清單、`case 'inbox'`。
- [05:14] Q-2: 不符時 BAT 既有資料區是否停用、沒有塔台怎麼判定 → B（塔台，`q-dee2b97e-6d883ae615b76b2f`）：不符時整個分頁只留選擇器與提示；R6 只在選中塔台相符時生效（不符時總覽照舊顯示 `todo`）；沒有已宣告塔台 → 狀態檔 `2` 可用 / 缺或 `1` P-1 / `> 2` P-2；標題不符 `!` → Action: 照辦，補 R6 相符 / 不符兩種的總覽測試。

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0906`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
