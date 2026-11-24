---
schema_version: 1
schema_kind: workorder
id: T0909
title: "PLAN-068 W6（在 `v0.8.x`）：塔台回合訊息卡 UI —— 待辦分頁「💬 塔台訊息」區（未讀 / 已讀 / 釘選 / 全部已讀 / 清除）、`⏸ 待你決定：` 行加亮、codex 說明行、縮圖 `💬N`、`createTowerCardsSync().start()` 接 `App.tsx`、Claude 面板塔台 `setPanelTower` 接線、claude 太舊提示"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T05:58:05+08:00"
started_at: "2026-11-25T05:59:58+08:00"
updated_at: "2026-11-25T06:14:09+08:00"
completed_at: "2026-11-25T06:14:09+08:00"
session_ids:
  - "c12b29ea-e614-4b2d-b9cf-c1038c80178b"
target_version: "0.8.x（與 CT 6.1.0 同日發佈）"
depends_on: [T0905, T0906]
related:
  - "PLAN-068；T0902（規格：§1 版面與「💬 塔台訊息」區、§2.3、§3 卡片列、§4 codex 說明、第二版拆單 W6 列、§7.1 G7）；T0905（W3 資料層：`electron/tower-cards.ts`、`tower-cards:*`、`src/stores/tower-cards-store.ts`、`stopsWithoutMessage`、`setPanelTower`）；T0906（W4：`InboxSection`、`stateFileContractStatus`）"
affects_files:
  - _ct-workorders/T0909-w6-tower-cards-ui.md
  - src/components/InboxPanel.tsx
  - src/components/inbox/
  - src/components/TerminalThumbnail.tsx
  - src/components/__tests__/
  - src/stores/tower-cards-store.ts
  - src/stores/
  - src/lib/
  - src/lib/__tests__/
  - src/types/
  - src/locales/
  - src/styles/
  - src/App.tsx
  - electron/tower-cards.ts
  - electron/claude-agent-manager.ts
  - electron/main.ts
  - electron/remote/
  - electron/preload.ts
  - electron/__tests__/
  - e2e/
  - CLAUDE.md
  - docs/agent-guide/
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0909（塔台已預先從 `v0.8.x` `677860a4` 建立分支 `ct/T0909`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0909` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `677860a4816f17d4bf743c9329f8992ee031abe9`（含 W0–W4：T0903 / T0904 / T0905 / T0906），不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 規格來源：T0902 回報區（第一版＋〈第二版（Renew #1，D328）〉）是唯一規格；W0–W4 已在 `v0.8.x`（W0 T0903：`src/lib/tower-contract.ts`、`PtyManager.getTowerContract(id)`、`tower-contract-store`；W1＋W2 T0904：`NotifyHoldController` 的 `draft` / `reading` / 原子送出 / `enqueueAnswer`；W3 T0905：`electron/tower-cards.ts`、`tower-cards:*`、`src/stores/tower-cards-store.ts`；W4 T0906：`InboxPanel`、`src/lib/inbox-model.ts`（`inboxVerdict`、`stateFileContractStatus`）、`InboxSection`；文件 `docs/agent-guide/tower-inbox.md`），**新功能只對 `towerContract == 2` 的塔台分頁生效**（R9′ 全部綁版本），既有 T0788 保留與所有現有行為不綁版本、不得改變（🔴 不回歸）。只做本單列的範圍；其他 W 單的範圍不做。與本單平行的還有 T0908（W5）、T0909（W6）、T0910（W9），各自分支，由塔台的合併工單整合；改到共用檔（例 `electron/preload.ts`、`src/types/electron.d.ts`、proxied channel 清單、locales）時只做本單需要的增量。"
  - "🔴 驗證：worktree `npm ci`；**每次產品 commit 前先完整跑一次 `npm run test:unit`**（T0903 教訓：改回應形狀會打到既有 `toEqual` 斷言），最後在 head 上完整執行要第一次就全綠（附 passed / files 數）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；動到 helper 時 `npm run verify:helpers` exit 0。e2e 只用隔離實例（`launchIsolated`），不得以預設實例啟動；不碰使用者正在用的 BAT（安裝版）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn（需要真實回合的項目寫「待實機」並對應 T0902 待實機清單編號）。`TMP` 用系統預設（T0716）。程序清理照 D308。"
  - "🔴 文件：CLAUDE.md 只加一兩句＋唯一實作位置＋🔴 不變式，細節寫進 `docs/agent-guide/tower-inbox.md`（W0 已寫在 `tower-tab-title.md`；本單若需要新檔就建立並更新 `docs/agent-guide/README.md` 索引）。CLAUDE.md < 100k 字元、小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）；日誌不記訊息內容、權杖、env。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
  - "🔴 本單範圍（W6）：① `App.tsx` 呼叫一次 `createTowerCardsSync().start()`（W3 留的接點；本機與遠端視窗、detached 各自的視窗都要正確）。② 待辦分頁「💬 塔台訊息」區（W4 已留 `InboxSection`）：選中塔台的卡片（新 → 舊），未讀 ●、展開 = 已讀、📌 釘選（置頂、上限照 host 的 `PIN_LIMIT`，超過時提示）、「全部已讀」、清除；卡片內容以純文字呈現（🔴 不以 HTML 解譯，避免注入），長內容摺疊；截斷過的顯示標記。區塊未讀數只顯示在區塊標題與縮圖 `💬N`，🔴 不算進分頁標題數字（僅告知不催人，T0902 §1）。③ 以 `⏸ 待你決定：` 或 `🙋 待你執行：` 開頭的行加亮，只是提示、不解析成資料（資料只來自 W5 的 frontmatter）。④ codex 塔台：卡片區固定一行說明（T0902 §4 文字，三語系），不嘗試其他來源。⑤ Claude 面板塔台：以 W4 的 `stateFileContractStatus`（面板沒有 `--set-role`，以狀態檔 `bat_contract` 判定）決定後呼叫 W3 的 `setPanelTower(id, bool)`（經 IPC，本機與 headless），判定改變時更新；面板 session dispose 照 W3 清空。⑥ G7：契約 v2 塔台的 `stopsWithoutMessage > 0` 且沒有任何卡片時，卡片區顯示「claude 版本太舊（需要 2.1.47 以上）」提示（三語系）。⑦ 全部只在 §6′ 判定相符時運作。"
  - "🔴 不得改變：W3 的保存規則（只收 v2 塔台、遮罩、上限、生命週期、不寫檔）與 `tower-cards:*` 不在 helper 權杖範圍；W4 的分頁判定與 R6；日誌不記卡片內容。"
---

# T0909 — PLAN-068 W6：塔台回合訊息卡 UI

## 背景

W3（T0905）已把契約 v2 塔台每回合的最後訊息存在 host 記憶體並提供 `tower-cards:*` 讀取；W4（T0906）已有待辦分頁骨架。本單把卡片顯示在待辦分頁「💬 塔台訊息」區並接上 App 與 Claude 面板塔台。

## 驗收

- [ ] `createTowerCardsSync().start()` 接上；遠端 / detached 正確
- [ ] 卡片區：未讀 / 已讀 / 釘選 / 全部已讀 / 清除、純文字呈現、摺疊、截斷標記；未讀不進分頁標題數字；縮圖 `💬N`
- [ ] `⏸ 待你決定：` / `🙋 待你執行：` 行加亮
- [ ] codex 說明行；claude 太舊提示（G7）
- [ ] Claude 面板塔台 `setPanelTower` 接線
- [ ] 版本不符時不運作；驗證關卡、文件、隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：哪些 Claude Agent 面板算「面板塔台」（呼叫 `setPanelTower(id, true)`），待辦「💬 塔台訊息」怎麼顯示它們的卡片？
- **提問時間**：2026-11-25T06:02:02+0800
- **背景**：本單 ⑤ 要以 `stateFileContractStatus`（狀態檔 `bat_contract`）決定後呼叫 `setPanelTower`，但規格（T0902 §6′、W3 / W4 回報）只定了「怎麼判版本」，沒定「哪一個面板是塔台」：面板沒有 `--set-role`，BAT 看不出面板裡跑的是不是 CT 塔台。W5（T0908 ⑤ 回答送進面板）也要同一個定義，兩單最好一致。
- **選項**：
  - A（建議）：工作區 `_tower-state.md` `bat_contract` = 2（`stateFileContractStatus` = `match`）**且這個工作區沒有已宣告的塔台分頁**時，該工作區所有 Claude Agent 面板分頁（`agentPreset` = `claude-code`，不含 codex 面板）都是面板塔台；有已宣告塔台分頁、或狀態檔不是 2 → `setPanelTower(id, false)`（W3 會清空該面板的卡片）。待辦的「💬 塔台訊息」：選中的是已宣告塔台 → 只顯示它的卡片；沒有已宣告塔台（判定 `source: state`）→ 合併顯示這個工作區所有面板塔台的卡片，每張標出來源分頁標題。不改 W4 的塔台選擇器。
  - B：同 A，但不管有沒有已宣告塔台，狀態檔 = 2 的工作區所有 Claude 面板都算（同時有 CLI 塔台與面板時，面板卡片也收）；「💬」只在沒有已宣告塔台時顯示面板卡片。
  - C：明確標記：面板加一個「以塔台使用此面板」開關（持久化，類似 T0644 `launchRole`），只有標記的面板才是面板塔台。精準，但多 UI、多存檔欄位，超出本單規格。
  - 其他
- **建議與理由**：A。不新增 UI / 存檔欄位；「有 CLI 塔台時面板不是塔台」避免使用者在塔台工作區開的旁支 Claude 面板也產生「塔台訊息」；卡片只在 host 記憶體、受同樣的遮罩與上限，誤把一般面板當塔台的代價只是多幾張卡片。已知限制：判定要讀該工作區的 `_tower-state.md`，只有讀過（作用中 / detached）的工作區才判得出，從未開過的工作區的面板在開到它之前不收卡片。
- **影響**：決定 `setPanelTower` 的呼叫條件、待辦「💬」區的資料來源與 W5 回答路徑的目標定義；選 C 要多做 UI＋持久化。
- **是否阻擋後續步驟**：只擋 ⑤ 與「💬」區對面板塔台的顯示；其他項目（App 接線、卡片區、加亮、codex 說明、G7、縮圖）先做。

### 完成狀態
- **狀態**：DONE（驗收 6 項全部完成；真實回合的畫面列為待實機，對應 T0902 T-4）
- **session_id**：c12b29ea-e614-4b2d-b9cf-c1038c80178b
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`，`basename "$CT_HOME"` = `better-agent-terminal`；C-1 工單在 `$CT_HOME/_ct-workorders/` 下；C-3 抽查 `src/components/InboxPanel.tsx`、`src/components/inbox/`、`src/components/TerminalThumbnail.tsx`、`src/stores/tower-cards-store.ts` 都存在；C-2 不適用（無 `branch` 欄位）。`CT_HOME` 已設定（主 checkout），`CT_WORKTREE_BRANCH` = `ct/T0909`，`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。開工時 `git merge-base HEAD v0.8.x` = `677860a4816f17d4bf743c9329f8992ee031abe9`（符合）。
- **commit**：產品 `efd6b3da`（worktree 分支 `ct/T0909`）；工單檔在主 checkout 另行 commit。

### 產出摘要

**① 卡片同步接 App**：`src/App.tsx` 新增一個 `useEffect`，呼叫一次 `createTowerCardsSync({ api, terminalIds, onPtyExit, onClientStatusChanged, log }).start()`。每個視窗（主視窗、detached、遠端 profile 視窗）各自執行自己的 App，讀自己綁定的 host；遠端重連時對帳由 W3 的 sync 處理。

**② 「💬 塔台訊息」區**（`src/components/inbox/TowerCardsSection.tsx`，由 `InboxPanel` 依選中的塔台給來源）：
- 排序：釘選在最上面，各自新 → 舊。卡片收合時顯示 ● 未讀、📌、時間 `HH:MM`、第一行預覽（120 字），下方列出加亮行。
- 展開 = 已讀（`towerCards.markRead(terminalId, [cardId])`），顯示全文；超過 24 行或 2,400 字先顯示開頭＋「顯示全部」。`truncated` 的卡片顯示「（內容過長，已截斷）」。
- 📌 釘選 / 取消釘選；host 回 `PIN_LIMIT` 時區內顯示「最多只能釘選 10 張」（`TOWER_CARDS_PINNED_MAX`）。區標題旁有「全部已讀」與「清除」（只清未釘選）。
- 🔴 內容只以 React 文字節點顯示，沒有 `dangerouslySetInnerHTML`（測試：`<img onerror>` / `<b>` 不會變成元素）。
- 未讀數只顯示在區標題（「N 未讀」，沒有未讀時「N 張」）與縮圖；🔴 `inboxActionCount` 不變，待辦分頁標題數字不含卡片（測試守住）。
- `InboxSection` 多三個選填 prop：`countLabel` / `actions` / `note`。按鈕放在摺疊鈕旁邊，不包在 `<button>` 裡。空區塊照舊只顯示「（無）」一行，W4 的既有測試不變。

**③ 加亮**：`isTowerCardHighlightLine`。`⏸ 待你決定：` / `🙋 待你執行：` 開頭的行會加亮，前面可以有空白或 `- ` / `* ` / `> ` / `1. `，半形冒號也算。只是提示，不解析成資料。

**④ codex 說明行**：選中的已宣告塔台若是 codex（`isCodexTower`：`terminal:role-changed` 的 `agent`，否則 `ptyAgent`，否則分頁 preset，以 `codex` 開頭），不顯示卡片，改顯示 T0902 §4 的固定一行（`inbox.cards.codexNote`，三語系）。為了拿到 agent，`tower-contract-store` 的 entry 多一個選填欄位 `agent`（只在 payload 有值時才放；W0 既有測試全綠）。

**⑤ Claude 面板塔台接線**（Q-1 塔台答覆 A）：
- 判定是純函式，給 T0908 共用：`workspaceHasPanelTowers(stateContract, declaredTowerCount)`、`panelTowerTerminalIds(terminals, stateContract, declaredTowerCount)`、常數 `CLAUDE_PANEL_PRESETS` = `['claude-code', 'claude-code-worktree']`，都在 `src/lib/inbox-model.ts`。
- 視窗端：`src/components/inbox/PanelTowerSync.tsx`（`decidePanelTowers`）。App 的主視窗與 detached 視窗各掛一個；歸屬用 `ownsTerminalForCloseRequest`，狀態檔讀 `inbox-store`，已宣告塔台讀 `tower-contract-store`；工作區、狀態檔、宣告任一改變就重新判定。
- 傳送：`src/stores/panel-tower-store.ts` 的 `createPanelTowerSync`。面板第一次出現時送一次（true 或 false），之後只送改變；遠端重連後全部重送；失敗時每個 id 只記一行。
- host 端：新增 proxied channel `tower-cards:set-panel-tower { terminalId, tower }`（`electron/tower-cards.ts` `registerTowerCardHandlers`，本機與 headless 共用）。🔴 不在 `HELPER_CHANNEL_ROLES`，handler 拒絕 `ctx.helper`（`FORBIDDEN`）。也已加進 `PROXIED_CHANNELS`、`path-aware-channels.ts`，preload 新增 `towerCards.setPanelTower`，型別 `TowerCardsApi.setPanelTower`。
- 收到 false 時 host 清掉該面板的卡片；面板 session dispose 照 W3 清空。
- 「💬」區：選中已宣告塔台時只顯示它的卡片；沒有已宣告塔台時，合併顯示這個工作區所有面板塔台的卡片，每張標出來源分頁標題（`towerCardsForSection`）。

**⑥ G7**：`showsClaudeTooOldHint`。條件是 `stopsWithoutMessage > 0` 且沒有任何卡片，顯示「claude 版本太舊（需要 2.1.47 以上）」（`inbox.cards.claudeTooOld`，三語系，版號常數 `TOWER_CARDS_MIN_CLAUDE_VERSION`）；有卡片後消失。

**⑦ 版本綁定**：
- 待辦分頁整個綁 §6′（W4）：不符時沒有「💬」區（測試守住）。
- 縮圖 `💬N`（`TerminalThumbnail.tsx`，`towerCardsBadgeCount`）只算 `towerContract.status === 'match'` 的塔台分頁，以及本視窗判定為面板塔台的面板；點擊會開待辦分頁（`requestOpenInbox`）。
- `setPanelTower(true)` 只在狀態檔判定相符時送出。

**不得改變的項目（已守住）**：
- W3 的保存規則沒有改，`tower-cards.ts` 只新增 handler。
- W4 的判定與 R6 沒有改（`inboxVerdict`、`InboxTabBadge`、總覽都未動）。
- 日誌只記 id 與布林。

**文件**：
- `docs/agent-guide/tower-inbox.md`：新增節「回合訊息卡：UI 與面板塔台（W6 / T0909）」；「版本判定」節補上面板塔台定義；W3 節裡「接線在 W6」的文字已更新。
- `docs/agent-guide/README.md` 索引已更新。
- `CLAUDE.md` 新增小節「塔台回合訊息卡 UI（PLAN-068 W6 / T0909）」，W3 節的「W4 接線」改為「W6 接線」。CLAUDE.md 約 92k 字元，未改任何既有標題。

**修改檔案**：
- 新增：`src/lib/tower-card-view.ts`、`src/stores/panel-tower-store.ts`、`src/components/inbox/TowerCardsSection.tsx`、`src/components/inbox/PanelTowerSync.tsx`
- 修改：`src/App.tsx`、`src/components/InboxPanel.tsx`、`src/components/inbox/InboxSection.tsx`、`src/components/TerminalThumbnail.tsx`、`src/lib/inbox-model.ts`、`src/stores/tower-cards-store.ts`（`useTowerCardsVersion`）、`src/stores/tower-contract-store.ts`、`src/types/tower-cards.ts`、`src/locales/{en,zh-TW,zh-CN}.json`、`src/styles/inbox.css`、`electron/tower-cards.ts`、`electron/preload.ts`、`electron/remote/protocol.ts`、`electron/remote/path-aware-channels.ts`、`CLAUDE.md`、`docs/agent-guide/tower-inbox.md`、`docs/agent-guide/README.md`
- 測試：新增 `src/lib/__tests__/tower-card-view.test.ts`、`src/stores/__tests__/panel-tower-store.test.ts`、`src/components/__tests__/inbox-tower-cards.test.tsx`（17）；修改 `electron/__tests__/tower-cards.test.ts`（頻道清單加入 `set-panel-tower`、新增 set-panel-tower 測試）

**驗證**（都在 head 的內容上跑）：
- `npm ci`：exit 0
- `npm run test:unit`：exit 0，**484 files passed / 3 skipped（487）；8820 tests passed / 47 skipped（8867）**，第一次完整執行即全綠
- `npm run test:legacy`：exit 0，files 33 passed / 0 failed；tests 472 passed / 0 failed
- `npx vite build`：exit 0
- `npm run typecheck`：0；`npm run typecheck:electron`：0
- `verify:helpers`：不適用（沒有改 helper）
- e2e：沒有新增。需要真實 claude / codex 回合的畫面未跑，列為**待實機**：T0902 T-4（真實 `last_assistant_message` 卡片內容與大小）；codex 塔台說明與 G7 提示在真實塔台上的畫面交 W8 整合驗收。沒有啟動任何 BAT 實例，沒有碰安裝版。

**建議後續（交塔台）**：
1. T0908（W5）的面板回答路徑請用 `panelTowerTerminalIds` / `workspaceHasPanelTowers`。
2. 共用檔衝突點在合併時處理：`InboxSection` 新增的 prop、`InboxPanel` 的 import 與「💬」區那一行、三份 locale 的 `inbox.cards` / `inbox.cardsBadgeTooltip`、`PROXIED_CHANNELS`。

### 互動紀錄
- [06:02] Q-1（BAT 通道 `q-dee2b97e-…`）: 哪些 Claude 面板算面板塔台、「💬」怎麼顯示 → A（塔台）: 選 A；判定做成純函式並在回報區寫出函式名（塔台轉告 T0908） → Action: 照 A 實作 `panelTowerTerminalIds` / `workspaceHasPanelTowers`（`src/lib/inbox-model.ts`）

### Renew 歷程
無

### 遭遇問題
- 無阻斷問題。
- 面板塔台要讀過該工作區的 `_tower-state.md` 才判得出（Q-1 A 的已知限制，已寫進 docs）：只有作用中（或 detached 視窗自己的）工作區會讀；從沒開過的工作區，面板在切到該工作區之前不收卡片。
- 塔台答覆寫的是「`claude-code`」，實作把 `claude-code-worktree` 也算進來：它是同一種 Claude Agent 面板（worktree 版）。塔台若要排除，只需改 `CLAUDE_PANEL_PRESETS`。
- 寫測試時一個 python 編修腳本把 `\n` 寫成真的換行，造成測試檔語法錯誤；已用 Edit 工具更正，重跑全部測試全綠。

### 隔離分支證據
- branch：`ct/T0909`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（BAT 的 `CT_WORKTREE_BASE`，是與 main 的共同祖先，工單說明屬預期）；分支起點 / 與 `v0.8.x` 的 merge-base = `677860a4816f17d4bf743c9329f8992ee031abe9`
- validated_sha：`efd6b3dad2102de048b96ae7da127cc56e9d6632`
- head_sha：`efd6b3dad2102de048b96ae7da127cc56e9d6632`
- validated_sha ≠ head_sha 的說明：兩者相同。驗證關卡在 commit 前的工作樹上執行（當時 HEAD 為 `677860a4`，變更尚未 commit），跑完後沒有再改任何檔案就把整個工作樹 commit 成 `efd6b3da`，所以驗證過的內容就是 head 的內容。

### 回報時間
- 2026-11-25T06:13:20+0800
