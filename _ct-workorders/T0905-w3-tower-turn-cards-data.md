---
schema_version: 1
schema_kind: workorder
id: T0905
title: "PLAN-068 W3（在 `v0.8.x`）：塔台回合訊息卡的資料層 —— `Stop` hook 送 `last_assistant_message`、host 記憶體卡片 store（只收契約 v2 塔台、遮罩、上限、生命週期）、proxied 讀取＋事件、重連對帳、Claude 面板塔台來源"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T05:12:00+08:00"
started_at: "2026-11-25T05:12:20+08:00"
updated_at: "2026-11-25T05:36:07+08:00"
completed_at: "2026-11-25T05:36:07+08:00"
target_version: "0.8.x（與 CT 6.1.0 同日發佈）"
depends_on: [T0903]
related:
  - "PLAN-068；T0902（規格：§2.3、§3 卡片列、§4、§5 卡片、R1′、§7.4 注入＋plugin 去重、第二版拆單 W3 列、待實機 T-4 / T-10）；T0903（W0）；D328 R1 主案；D332 / D333"
  - "T0590 / T0600 / T0642 / T0790 / T0791（`bat-hook.mjs`、`TerminalBlockedTracker`、hook 規則）、T0607（記憶體＋`redactTerminalSecrets` 的隱私範本）、T0749（`registerAttentionSnapshotHandler` 對帳範本）；CLAUDE.md「blocked 狀態偵測」「Worker 啟動確認」「Claude 分頁的 session 名稱」節"
affects_files:
  - _ct-workorders/T0905-w3-tower-turn-cards-data.md
  - scripts/bat-hook.mjs
  - scripts/__tests__/
  - electron/bat-mcp-launch.ts
  - electron/terminal-blocked-state.ts
  - electron/tower-cards.ts
  - electron/claude-agent-manager.ts
  - electron/pty-manager.ts
  - electron/remote/
  - electron/preload.ts
  - electron/main.ts
  - electron/__tests__/
  - src/types/
  - src/stores/tower-cards-store.ts
  - src/stores/__tests__/
  - src/lib/
  - src/lib/__tests__/
  - tests/bat-*.test.mjs
  - CLAUDE.md
  - docs/agent-guide/
renew_count: 0
session_ids:
  - "bffdc206-438c-487c-b360-f0bb5b970ade"
isolation: worktree
workdir: "worktree ct/T0905（塔台已預先從 `v0.8.x` `d6b9ce86` 建立分支 `ct/T0905`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0905` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `d6b9ce86e30129a1ea8c29d1f5fe5b8e078454c8`（含 W0 T0903），不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 規格來源：T0902 回報區（第一版＋〈第二版（Renew #1，D328）〉）是唯一規格；W0 已完成（T0903，`src/lib/tower-contract.ts`、`PtyManager.getTowerContract(id)`、`tower-contract-store`、`terminal:role-changed` 的 `towerContract`），**新功能只對 `towerContract == 2` 的塔台分頁生效**（R9′ 全部綁版本），既有 T0788 保留與所有現有行為不綁版本、不得改變（🔴 不回歸）。只做本單列的範圍；其他 W 單的範圍不做。與本單平行的還有 T0904（W1+W2）、T0905（W3）、T0906（W4），各自分支，由塔台的合併工單整合；改到共用檔（例 `electron/preload.ts`、`src/types/electron.d.ts`、proxied channel 清單、locales）時只做本單需要的增量。"
  - "🔴 驗證：worktree `npm ci`；**每次產品 commit 前先完整跑一次 `npm run test:unit`**（T0903 教訓：改回應形狀會打到既有 `toEqual` 斷言），最後在 head 上完整執行要第一次就全綠（附 passed / files 數）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；動到 helper 時 `npm run verify:helpers` exit 0。e2e 只用隔離實例（`launchIsolated`），不得以預設實例啟動；不碰使用者正在用的 BAT（安裝版）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn（需要真實回合的項目寫「待實機」並對應 T0902 待實機清單編號）。`TMP` 用系統預設（T0716）。程序清理照 D308。"
  - "🔴 文件：CLAUDE.md 只加一兩句＋唯一實作位置＋🔴 不變式，細節寫進 `docs/agent-guide/tower-inbox.md`（W0 已寫在 `tower-tab-title.md`；本單若需要新檔就建立並更新 `docs/agent-guide/README.md` 索引）。CLAUDE.md < 100k 字元、小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）；日誌不記訊息內容、權杖、env。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
  - "🔴 本單範圍（W3 只做資料層，UI 是 W6）：① `bat-hook.mjs stop` 多送 `last_assistant_message`（只在 `stop` 事件讀這個欄位；stdin 沿用既有上限、送出前截到 16 KiB）、`origin`（`injected`，plugin 的 `plugin` 由 W9 加）、`set`（hook 組版本 `BAT_HOOK_SET = 2`，寫在 `BAT_CLAUDE_HOOKS` 旁）；🔴 T0590 其餘規則不變：exit 0、stdout 不輸出、總時限 1.8 s、任何失敗靜默、`at`（T0790）規則不變。② host 卡片 store（新檔 `electron/tower-cards.ts`，不 import electron，本機與 headless 共用）：只在「已宣告塔台＋`towerContract == 2`」時保留，其他分頁收到即丟、不記內容；收件即 `redactTerminalSecrets`；每個塔台分頁最近 30 張、釘選另計最多 10 張、單張 16 KiB（超過截斷並標示）；狀態 未讀 / 已讀 / 釘選在 host（多視窗一致）；PTY 結束 / ⏻ / Terminal Server recovery 清空；不寫檔；日誌只記 terminal id / 長度 / 張數。③ 同一 PTY 收過 `injected` 後丟棄 `plugin` 的回報；卡片以 session id＋內容雜湊去重（§7.4）。④ proxied channel `tower-cards:list` / 事件 `tower-cards:changed` ＋ 已讀 / 釘選 / 清除的操作 channel，重連對帳（比照 T0749）；🔴 全部不進 `HELPER_CHANNEL_ROLES`（agent 不能讀卡片）。⑤ Claude 面板塔台：卡片來源是面板的最後助理訊息（面板沒有 `--set-role`，依 §6′ 表以狀態檔 `bat_contract` 判定的部分由 W4 提供判定函式；本單只提供把面板訊息送進同一 store 的介面與測試，判定接線若需要 W4 的函式，留介面並在回報區註明）。⑥ renderer store `src/stores/tower-cards-store.ts`（只資料，不做 UI）。⑦ 查出 `last_assistant_message` 開始出現的最低 claude 版號（`npm pack` 逐版查字串，scratchpad，收尾刪除），寫進 docs（G7）。"
  - "🔴 不得改變：非塔台分頁與版本不符時 hook 行為、回報內容與今天相同（除了 `stop` 多帶的欄位在 host 端被丟棄）；`claudeSessionId` / `agentStarted` / blocked 判定不變；BAT MCP 維持全唯讀。"
---

# T0905 — PLAN-068 W3：塔台回合訊息卡的資料層

## 背景

PLAN-068 的整合設計（T0902，雙方核定）在右側欄「待辦」分頁放「💬 塔台訊息」卡片：每回合一張、可釘選、只在記憶體。來源是 claude `Stop` hook 的 `last_assistant_message`（官方描述就是為了不必解析 transcript）；使用者核定 R1 主案（D328：hook 送、host 過濾）。W0（T0903）已提供 `towerContract`。本單只做資料層，UI 在 W6。

## 驗收

- [x] `stop` 送最後訊息＋`origin` / `set`；T0590 規則不回歸（既有 hook 測試全綠）
- [x] host store：只收 v2 塔台、遮罩、上限 30 / 10 / 16 KiB、生命週期、去重；日誌不含內容
- [x] proxied 讀取＋事件＋操作、重連對帳；不在 helper 權杖範圍
- [x] Claude 面板塔台來源介面
- [x] `last_assistant_message` 最低 claude 版號（docs）
- [x] 驗證關卡、文件、隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **狀態**：DONE（W3 資料層全部完成；需要真實 claude 回合的項目列為待實機 T-4 / T-10）
- **session_id**：bffdc206-438c-487c-b360-f0bb5b970ade
- **落點檢查**：PASS。C-0 `repo` = `better-agent-terminal`、`basename "$CT_HOME"` = `better-agent-terminal`；C-1 工單在 `$CT_HOME/_ct-workorders/`；C-3 `affects_files` 祖先皆存在；C-2 無 `branch` 欄位。`CT_HOME` 已設定、`CT_WORKTREE_BRANCH` = `ct/T0905`、`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。`git merge-base HEAD v0.8.x` = `d6b9ce86e30129a1ea8c29d1f5fe5b8e078454c8`（含 W0 T0903），符合工單要求
- **產品 commit**：`1a468665`（`feat(T0905): PLAN-068 W3 Tower turn cards data layer`），24 檔、+2202 / −13

### 產出摘要

**① hook（`scripts/bat-hook.mjs`、`electron/bat-mcp-launch.ts`）**
- `stop` 讀 `last_assistant_message`（只有這個事件讀；非字串 / 空白不送），送出前以 `truncateUtf8` 截到 16 KiB UTF-8（切在字元邊界，截過帶 `messageTruncated: true`）；stdin 沿用 256 KiB 上限（超過照舊只回報 `stop`）。
- `stop` 另帶 `origin: 'injected'`、`set: BAT_HOOK_SET`（= 2）。`BAT_HOOK_SET` 寫在 `BAT_CLAUDE_HOOKS` 旁（`bat-mcp-launch.ts`），腳本內同名常數由測試守住相等。
- 🔴 T0590 規則不變：exit 0、stdout 空、1.8 s、靜默失敗、`at` 不變；bat-scripts.log 只多 `messageBytes`。**其他事件的回報逐字不變**（見〈互動紀錄〉05:24 的判斷）。

**② host store（新檔 `electron/tower-cards.ts`，不 import electron，本機與 headless 共用）**
- 只留 `towerContractStatus(role, towerContract) === 'match'` 的分頁；其他收到即丟、不存內容，每分頁只記一行（長度）。收件即 `redactTerminalSecrets`（含 server token），再截 16 KiB；每分頁 30 張未釘選＋釘選另計 10 張（第 11 張 → `PIN_LIMIT`）；未讀 / 已讀 / 釘選在 host；PTY 結束（exit / kill，含 ⏻）/ Terminal Server recovery 清空；不寫檔；日誌只記 terminal id / bytes / 張數 / 遮罩次數。
- 契約 v2 塔台送來沒有訊息的 `stop` 計 `stopsWithoutMessage`（G7：W6 可據此提示 claude 太舊）。

**③ 去重（§7.4）**
- `terminal:report-hook` 解析 `origin` / `set`（格式不對就忽略）；`TerminalBlockedTracker.acceptHookOrigin`：同一 PTY 收過 `injected` 後，`plugin` 回報回 `{ ok: true, terminalId, result: 'duplicate' }`、不套用（每 PTY 只記一行），PTY 結束 / recovery 時清除；沒有 `origin` = `injected`。
- 卡片以 session id（`getClaudeSessionId`）＋內容 SHA-256 去重，限 10 s 視窗內（`TOWER_CARDS_DEDUPE_WINDOW_MS`），見〈遭遇問題〉的實作判斷。

**④ proxied channel ＋ 事件 ＋ 對帳**
- `tower-cards:list` / `mark-read` / `pin` / `clear`（`PROXIED_CHANNELS`、`path-aware-channels` 歸為不轉換路徑）、事件 `tower-cards:changed`（`PROXIED_EVENTS`；只有 `{ terminalId, revision, unread, total }`）。🔴 都不在 `HELPER_CHANNEL_ROLES`，handler 另以 `ctx.helper` 回 `FORBIDDEN`（測試＋headless e2e 驗證塔台自己的 PTY 權杖被拒）。
- preload `window.electronAPI.towerCards`、`src/types/electron.d.ts`、型別 `src/types/tower-cards.ts`。
- 重連對帳：renderer `createTowerCardsSync().onStatus`（「未連線 → 已連線」以 `tower-cards:list` 強制取代，比照 T0749）。`revision` 為 host 全域遞增，沒有卡片的分頁回目前值，視窗據此丟掉副本。

**⑤ Claude 面板塔台來源**
- `ClaudeAgentManager.setTurnResultListener`：`success` result 的 `result` 文字每個 result 一次 → `TowerCardStore.offerPanelMessage`；面板是否塔台由 `setPanelTower(id, bool)` 決定（**介面已留，T0905 不呼叫**，判定接線屬 W4：§6′ 面板以 `_tower-state.md` `bat_contract` 判定，renderer 讀檔）。面板 session dispose 清空該面板卡片。Electron main 與 headless（`createHeadlessClaudeModule` `onTurnResult`）都接上。

**⑥ renderer `src/stores/tower-cards-store.ts`（只資料）**
- `createTowerCardsSync({ api, terminalIds, onPtyExit?, onClientStatusChanged?, log? }).start()`、`useTowerCards` / `getTowerCards` / `towerCardsUnread`、`applyTowerCardsEntries`（舊 revision 略過、`force` 對帳）。**未接到 `App.tsx`**（不在 affects_files）：W6 在 App 呼叫一次 `start()`。

**⑦ claude 最低版號（G7）**
- `Stop` hook 輸入的 `last_assistant_message` 最早在 **claude `2.1.47`**（`2.1.45` 沒有；`2.1.46` 未發佈）。`npm pack` 二分查（`cli.js` 版查 `cli.js`、原生二進位版查 `@anthropic-ai/claude-code-linux-x64` 執行檔），只讀字串不執行，scratchpad 已刪除。比對完整識別字：較舊版本有不相干的遙測欄位 `last_assistant_message_id`（`1.0.64` 起），第一次比對因此誤判為 1.0.64，改用「後面不接 `_`」後確認 2.1.47 的 schema（`Stop` / `SubagentStop` 的 `last_assistant_message: string().optional()`）。寫入 `docs/agent-guide/tower-inbox.md`。

**文件**：CLAUDE.md 新節「塔台回合訊息卡（PLAN-068 W3 / T0905）」（6 行，CLAUDE.md 由 88,213 字增為89,388 字 < 100k；既有標題未改）；新檔 `docs/agent-guide/tower-inbox.md`（W3 段落）＋ `docs/agent-guide/README.md` 索引一列。

**驗證關卡（全部在 `1a468665` 的內容上執行）**
- `npm ci`：exit 0。
- `npm run test:unit`：最後一次完整執行 **472 files passed / 3 skipped；8633 tests passed / 42 skipped，exit 0**。前兩次完整執行各有與本單無關的負載型失敗（見〈遭遇問題〉），第三次全綠。
- `npm run test:legacy`：exit 0，files 33 passed / 0 failed；tests 472 passed / 0 failed。
- `npx vite build`：exit 0。
- `npm run typecheck` = 0、`npm run typecheck:electron` = 0。
- `npm run verify:helpers`：exit 0（6 個 runtime helper，與 server bundle 同組）。
- 新測試：`electron/__tests__/tower-cards.test.ts`（19）、`tower-cards-report-hook.test.ts`（9）、`tower-cards-panel-source.test.ts`（3）、`scripts/__tests__/bat-hook-last-message.test.mjs`（含整支腳本 exit 0 / stdout 空）、`terminal-blocked-state.test.ts` 新增「T0905: Stop sends last_assistant_message …」（真腳本經 RemoteServer：欄位、16 KiB、日誌只有 `messageBytes`）、`src/stores/__tests__/tower-cards-store.test.ts`（7）、headless `electron/remote/__tests__/headless-tower-cards-e2e.test.ts`（4；真 headless＋node-pty：塔台 PTY 內 `--bat-contract 2` 後回報 → 視窗 list 到 1 張；Worker 與未宣告契約的塔台被丟；塔台權杖呼叫 `tower-cards:*` 被拒；mark-read；PTY 結束清空；事件不含文字）。
- e2e（Playwright）：未執行，本單沒有 UI；未啟動任何 BAT 實例、未碰安裝版 / userData / Terminal Server / holder；未開任何 claude / codex 回合。

**待實機（對應 T0902 待實機清單）**
- T-4：真實回合的 `last_assistant_message` 大小、多段文字 / 工具呼叫回合的內容（本單以 2.1.47 原始碼確認：最後一則助理訊息的文字區塊以空白串接後 trim）。
- T-10：注入＋plugin 並存的去重（plugin 由 W9 提供；本單以單元測試覆蓋規則）。

**不回歸**：非塔台分頁與版本不符時 hook 行為與回報內容不變（只有 `stop` 多帶的欄位在 host 被丟）；`claudeSessionId` / `agentStarted` / blocked 判定不變（既有 `terminal-blocked-state.test.ts` 53 項＋ `bat-hook.test.mjs` 全綠）；BAT MCP 未改（全唯讀）；T0788 保留未動。

### 互動紀錄
- [05:12] 開工：讀 `_local-rules.md`、CLAUDE.md、T0902 回報區（第一版＋第二版）；merge-base 確認符合；無塔台補充段落。
- [05:24] 實作判斷（範圍內，yolo 自行決定）：第一版讓每個回報都帶 `origin` / `set`，既有 `terminal-blocked-state.test.ts` 9 項以 `toEqual` 比對真腳本送出的 frame 而失敗。依 T0902 §7.4「注入的預設為 `injected`」與工單 ① 字面（`stop` 多送 `origin` / `set`），改為只有 `stop` 帶這兩個欄位，其他事件逐字不變 → 既有測試不必改、全綠。影響：W9 若要在 `stop` 以前取得 `set`（例如 `--set-role` 的 `hooks:` 行），需自行讓 `session-start` 也帶 `set`。
- [05:28] `last_assistant_message` 版號：第一次比對命中遙測欄位 `last_assistant_message_id`（誤判 1.0.64），改為完整識別字後得 2.1.47，並印出 2.1.47 的 schema 片段確認。

### Renew 歷程
無

### 遭遇問題
- **`npm run test:unit` 前兩次完整執行有負載型失敗（與本單無關）**：第 1 次 `electron/__tests__/shared-conout.test.ts`「kill under load … event loop ends by itself」watchdog（當時我同時跑 `vite build`）；第 2 次同一項＋ `src/__tests__/terminal-gpu-crash-redraw.test.tsx` 兩項（`Test timed out in 5000ms`、長度 4 ≠ 2）。兩檔都不 import 本單任何模組，各自單獨執行皆全綠（23 / 9 passed），第 3 次完整執行全綠。推測與平行 W 工單（T0904 / T0906）同時在本機跑測試的負載有關；若合併工單遇到，建議單獨重跑這兩檔。
- **去重的時間視窗（實作判斷，未問塔台）**：T0902 §7.4 只寫「session id＋內容雜湊去重」。若不設時間範圍，同一 session 中兩回合講了一樣的話（例如「完成」）會被吃掉第二張；因此只在 10 s 內去重（注入與 plugin 對同一個 `Stop` 的回報幾乎同時到）。數值在 `TOWER_CARDS_DEDUPE_WINDOW_MS`，要調只改常數。
- **塔台改宣告後的既有卡片**：判定在收件當下做；塔台之後重新 `--set-role` 不帶 `--bat-contract`，已收的卡片留到 PTY 結束（新的不收）。UI（W6）本來就以分頁契約狀態決定是否顯示，需要的話 W6 / W4 可呼叫 `clear`。
- **與 W4 / W6 / W9 的介面（交塔台的合併工單與後續工單）**：`setPanelTower` 無呼叫者（W4）；`createTowerCardsSync().start()` 未接 `App.tsx`（W6）；`plugin` origin 由 W9 的 launcher 帶、`getHookSet` 供 W9 的 `hooksStatus`。
- **共用檔增量**（平行工單合併時注意）：`electron/preload.ts`（新 `towerCards` 命名空間）、`src/types/electron.d.ts`（一行）、`electron/remote/protocol.ts` / `path-aware-channels.ts`（各加在清單尾端）、`electron/main.ts` / `headless-entry.ts`、CLAUDE.md（新節放在「塔台等使用者回答時保留 Worker 通知」之後）、新檔 `docs/agent-guide/tower-inbox.md`（T0904 / T0906 若也建立同名檔需合併）。
- R-G005：前段有幾次以 heredoc 寫 Python 修補腳本（內容無反斜線、長度遠低於上限），之後改用 Write 寫檔再執行。

### 隔離分支證據
- branch：`ct/T0905`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`，與 main 的共同祖先；實際分支點 `d6b9ce86e30129a1ea8c29d1f5fe5b8e078454c8` = `v0.8.x`，工單已說明屬預期）
- validated_sha：`1a4686653bbc380815bbadc5df5abe9ae188b823`（驗證在未提交的工作樹上執行，內容與此 commit 完全相同；commit 後工作樹乾淨、未再修改）
- head_sha：`1a4686653bbc380815bbadc5df5abe9ae188b823`
- validated_sha ≠ head_sha 的說明：相同，不適用

### 回報時間
2026-11-25T05:35:12+08:00
