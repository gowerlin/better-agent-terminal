---
schema_version: 1
schema_kind: workorder
id: T0910
title: "PLAN-068 W9（在 `v0.8.x`）：hook 註冊 —— host 記錄 hooks 啟動決定與原因代號、`--set-role` 的 `hooks:` 行（等 2 s）與 `hooksStatus`、提示與徽章 `🪝✕`、BAT repo 的 marketplace＋`bat-hooks` Claude Code plugin（launcher）、`--hook-list` / `plugin-outdated`、評估 `--plugin-dir`"
type: implementation
status: DONE
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T05:58:05+08:00"
updated_at: "2026-11-25T06:29:32+08:00"
started_at: "2026-11-25T06:00:01+08:00"
completed_at: "2026-11-25T06:29:32+08:00"
session_ids:
  - "0a69f438-adba-4d5a-8119-35a1f8c94bf0"
target_version: "0.8.x（與 CT 6.1.0 同日發佈）"
depends_on: [T0903, T0905]
related:
  - "PLAN-068；T0902〈第二版〉§3.1′（`hooks:` 行、`hooksStatus`）、R12、R13、§7（7.0–7.7）、第二版拆單 W9 列、待實機 T-9 / T-10 / T-11 / T-12；PLAN-068〈契約細節補充〉（`hooks:` 行文法，已告知 CT）；D329（R12 採用、R13 維持）"
  - "T0905（W3：`origin` / `set` 只在 `stop` 帶、`BAT_HOOK_SET = 2`、`getHookSet`、`acceptHookOrigin` 去重；〈互動紀錄〉05:24：W9 若要在 `stop` 前取得 `set` 需讓 `session-start` 也帶）；T0590 / T0600（hook 規則）、T0641（`claudeSessionNameRecords` 的 per-terminal 紀錄範本）、T0584（`buildBatMcpLaunchArgs`、`claudeHooksDisabledBy`、`userArgsPassClaudeSettings`）"
affects_files:
  - _ct-workorders/T0910-w9-hook-registration.md
  - scripts/bat-terminal.mjs
  - scripts/bat-hook.mjs
  - scripts/bat-mcp.mjs
  - scripts/__tests__/
  - electron/bat-mcp-launch.ts
  - electron/terminal-role.ts
  - electron/terminal-blocked-state.ts
  - electron/terminal-query-handlers.ts
  - electron/claude-hooks-status.ts
  - electron/pty-manager.ts
  - electron/remote/
  - electron/__tests__/
  - .claude-plugin/
  - plugins/bat-hooks/
  - src/lib/
  - src/lib/__tests__/
  - src/stores/
  - src/components/TerminalThumbnail.tsx
  - src/components/inbox/
  - src/components/InboxPanel.tsx
  - electron/preload.ts
  - src/components/__tests__/
  - src/locales/
  - src/types/
  - tests/bat-*.test.mjs
  - CLAUDE.md
  - docs/agent-guide/
  - README.md
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0910（塔台已預先從 `v0.8.x` `677860a4` 建立分支 `ct/T0910`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0910` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `677860a4816f17d4bf743c9329f8992ee031abe9`（含 W0–W4：T0903 / T0904 / T0905 / T0906），不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 規格來源：T0902 回報區（第一版＋〈第二版（Renew #1，D328）〉）是唯一規格；W0–W4 已在 `v0.8.x`（W0 T0903：`src/lib/tower-contract.ts`、`PtyManager.getTowerContract(id)`、`tower-contract-store`；W1＋W2 T0904：`NotifyHoldController` 的 `draft` / `reading` / 原子送出 / `enqueueAnswer`；W3 T0905：`electron/tower-cards.ts`、`tower-cards:*`、`src/stores/tower-cards-store.ts`；W4 T0906：`InboxPanel`、`src/lib/inbox-model.ts`（`inboxVerdict`、`stateFileContractStatus`）、`InboxSection`；文件 `docs/agent-guide/tower-inbox.md`），**新功能只對 `towerContract == 2` 的塔台分頁生效**（R9′ 全部綁版本），既有 T0788 保留與所有現有行為不綁版本、不得改變（🔴 不回歸）。只做本單列的範圍；其他 W 單的範圍不做。與本單平行的還有 T0908（W5）、T0909（W6）、T0910（W9），各自分支，由塔台的合併工單整合；改到共用檔（例 `electron/preload.ts`、`src/types/electron.d.ts`、proxied channel 清單、locales）時只做本單需要的增量。"
  - "🔴 驗證：worktree `npm ci`；**每次產品 commit 前先完整跑一次 `npm run test:unit`**（T0903 教訓：改回應形狀會打到既有 `toEqual` 斷言），最後在 head 上完整執行要第一次就全綠（附 passed / files 數）；`npm run test:legacy` 全綠；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；動到 helper 時 `npm run verify:helpers` exit 0。e2e 只用隔離實例（`launchIsolated`），不得以預設實例啟動；不碰使用者正在用的 BAT（安裝版）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn（需要真實回合的項目寫「待實機」並對應 T0902 待實機清單編號）。`TMP` 用系統預設（T0716）。程序清理照 D308。"
  - "🔴 文件：CLAUDE.md 只加一兩句＋唯一實作位置＋🔴 不變式，細節寫進 `docs/agent-guide/tower-inbox.md`（W0 已寫在 `tower-tab-title.md`；本單若需要新檔就建立並更新 `docs/agent-guide/README.md` 索引）。CLAUDE.md < 100k 字元、小節標題不改名（T0595）。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。`gh` 一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 公開 repo（D176）：程式、註解、回報區不寫真名、客戶名、家目錄路徑（寫 `<使用者資料夾>`）；日誌不記訊息內容、權杖、env。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
  - "🔴 本單範圍（W9）：① host 為每個 claude 分頁記錄 hooks 啟動決定與原因代號（per-terminal，比照 `claudeSessionNameRecords`）：`settings-off` / `user-settings-arg` / `claude-hooks-disabled` / `managed-hooks-only` / `no-report` / `not-launched-by-bat` / `no-endpoint` / `script-missing` / `unrepresentable-path`（T0902 §7.1 / §7.2）。② `--set-role tower --bat-contract 2` 時：claude 塔台若還沒有任何 hook 回報最多等 2 s，再輸出一行（契約文法已告知 CT，不得更改）：`  hooks: ok (<injected|plugin>, set <n>)`；只由 plugin 提供且事件清單比 BAT 舊時 `  hooks: ok (plugin, set <n>, plugin-outdated)`；injected 與 plugin 並存以 injected 為準、不出 `plugin-outdated`；`  hooks: none (<代號>)`；codex `  hooks: n/a (codex)`；🔴 只在帶 `--bat-contract` 時輸出，`bat-contract:` 行之後；不帶參數的舊呼叫輸出逐字不變。若需要在 `stop` 前取得 `set`，讓 `session-start` 也帶 `origin` / `set`（T0905 的提醒）；其他事件回報維持不變。③ `terminal:whoami` / `get-state` / `list`（含 `towers`）多 `hooksStatus: { state: 'ok' | 'none' | 'n/a', reason?, origin?, set? } | null`；BAT MCP 帶出（全唯讀）。④ 提示：縮圖徽章 `🪝✕`（tooltip 為 §7.2 文字）、待辦分頁該塔台標頭一行＋說明連結；只對契約 v2 塔台（R9′）。⑤ BAT repo 新增 Claude Code marketplace（`.claude-plugin/marketplace.json`）與 plugin `bat-hooks`（`plugins/bat-hooks/`：`.claude-plugin/plugin.json`、`hooks/hooks.json`、小型 launcher）：launcher 以 PTY env `BAT_HELPER_DIR` 執行 `bat-hook.mjs`（檢查絕對路徑、檔名固定、`BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` / `BAT_TERMINAL_ID` 都存在，否則立即 exit 0 無輸出）、帶 `origin: 'plugin'` 與 `--hook-list <n>`；遵守 T0590（exit 0、stdout 不輸出、時限、靜默失敗）；Windows（Git Bash / PowerShell）與 macOS / Linux 都能執行（`${CLAUDE_PLUGIN_ROOT}`、`node` 解析，`BAT_HELPER_NODE` 優先）。plugin 🔴 不進安裝檔（`build.files` / `extraResources` 不動，`verify-*` 不受影響）。⑥ `--hook-list` 比對 → `plugin-outdated`。⑦ 評估 (d1) BAT 注入 `--plugin-dir`（內嵌 2.1.331 的行為、與同名 marketplace plugin 的衝突），只寫結論與建議到回報區，不實作。⑧ R13 維持：Settings「BAT MCP」關閉時 hooks 也不注入，只顯示 `settings-off` 原因。⑨ README「與 BMad Control Tower 協作」章節：`bat-hooks` 的用途、何時需要、安裝 / 升級 / 移除步驟（T0902 §7.5），版本對照表新增 `bat-hooks` 一列（BAT 版號先寫「待定」，塔台定版時填）。"
  - "🔴 不得改變：BAT 自動注入（`buildBatMcpLaunchArgs` 的 `--settings=`）的現行行為；W3 的去重規則；T0590 對 hook 腳本的所有規則；BAT 不改使用者的 claude 設定、不替使用者安裝 plugin。安全：launcher 只執行 env 指定 BAT 的固定腳本，不接受其他路徑；回報區寫明信任模型。"
---

# T0910 — PLAN-068 W9：hook 註冊（BAT＋CT 使用者）

## 背景

使用者核定（D328 / D329）：hook 不只我們自己用，其他 BAT＋CT 使用者的 claude 可能沒有 BAT 注入的 hooks（手打 `claude`、自訂 `--settings`、關掉 BAT MCP、遠端手打等）。推薦 (a) 自動注入＋(c) 以 Claude Code plugin `bat-hooks` 補缺口；`hooks:` 行的文法已與 CT 約定（CT 6.1.0 依此解析）。CT 自己的 Bash 長度防護由 CT 另案（CT PLAN-019），不在本單。

## 驗收

- [ ] 啟動決定與原因代號紀錄；`--set-role` 的 `hooks:` 行（文法逐字、2 s 等待、只在帶 `--bat-contract` 時）；舊呼叫不變
- [ ] `hooksStatus` 查詢欄位與 MCP
- [ ] `🪝✕` 徽章與待辦分頁提示（三語系）
- [ ] marketplace＋`bat-hooks` plugin＋launcher（路徑檢查、沒有 `BAT_*` 立即結束、T0590 規則、跨平台）；不進安裝檔
- [ ] `--hook-list` / `plugin-outdated`；注入與 plugin 並存只算一次
- [ ] (d1) `--plugin-dir` 評估結論
- [ ] README 協作章節與版本對照表
- [ ] 驗證關卡（含 `verify:helpers`）、文件、隔離分支證據；待實機 T-9 / T-10 / T-11 / T-12 列出

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 待塔台決策

#### Q-1：待辦分頁的 hooks 提示一行要畫在 `src/components/InboxPanel.tsx`（不在 `affects_files`），可以改嗎？
- **提問時間**：2026-11-25T06:04:31+08:00
- **背景**：範圍 ④ 要在「待辦分頁該塔台標頭一行＋說明連結」。標頭在 `InboxPanel.tsx` 的 `header` 裡，`affects_files` 只有 `src/components/inbox/`。T0908（W5）/ T0909（W6）平行時也會改 `InboxPanel.tsx`。
- **選項**：
  - A（建議）：元件與判斷全放在 `src/components/inbox/InboxHooksHint.tsx`（新檔）＋ `src/lib/`，`InboxPanel.tsx` 只加 1 行 import＋1 行 `<InboxHooksHint terminalId={tower?.id} />`（放在 `{header}` 之後、相符時才出現），合併衝突最小。
  - B：不動 `InboxPanel.tsx`，本單只做元件，接線留給合併工單或 W7。
  - 其他。
- **建議與理由**：A。只加兩行、位置在 `header` 後，與 W5 / W6 改的區段（各 section）不重疊；B 會讓驗收項「待辦分頁提示」在本單無法驗證。
- **影響**：選 B 時本單的待辦分頁提示只有元件與單元測試，畫面接線待後續。
- **是否阻擋後續步驟**：否（先做其他部分，最後接線）。

#### Q-2：renderer 需要一個新的推送事件 `terminal:hooks-status`，要改 `electron/preload.ts`（不在 `affects_files`），可以改嗎？
- **提問時間**：2026-11-25T06:04:31+08:00
- **背景**：徽章 `🪝✕` 與待辦提示要知道每個塔台分頁的 `hooksStatus`，而且它會在 `--set-role` 之後改變（第一個 hook 回報到達、`no-report` → `ok`）。`terminal:role-changed` 只在 `--set-role` 時送一次；renderer 不能呼叫 helper 查詢 channel。打算由 `PtyManager` 在「已宣告契約的塔台」的 `hooksStatus` 改變時廣播 `terminal:hooks-status { id, hooksStatus }`（只有狀態與代號，無內容），遠端視窗經 `PROXIED_EVENTS`（`electron/remote/`，在範圍內）轉送。renderer 端要在 `preload.ts` 的 `pty` 下加 `onHooksStatus`（約 5 行），`src/types/electron.d.ts` 補型別（在範圍內）。不需要改 `main.ts`（`PtyManager` 的 `emit` 已轉給視窗與 broadcastHub），store 自己訂閱，不改 `App.tsx`。
- **選項**：
  - A（建議）：照上述加新事件，`preload.ts` 只加 `onHooksStatus` 一段（工單 memory_overrides 已把 `preload.ts` 列為「只做本單需要的增量」的共用檔）。
  - B：不加新事件，改把 `hooksStatus` 塞進既有 `terminal:role-changed` 重送（`PtyManager` 不知道該事件的完整欄位，要改 `handlers/terminal.ts` / `main.ts`，範圍更大，且重送 role-changed 會重跑標題邏輯）。
  - 其他。
- **建議與理由**：A。增量最小、語意清楚，與 `tower-cards:changed` 同一種做法。
- **影響**：選 B 需要動 `electron/handlers/terminal.ts`（也不在範圍內）。
- **是否阻擋後續步驟**：否（先做 host 端與 helper，最後做 renderer）。

### 完成狀態
- **狀態**：DONE（Worker 步驟全部完成；需要真實 claude 回合 / 登入 / 遠端的項目列為待實機 T-9 / T-10 / T-11 / T-12）
- **產品 commit**：`a8eb8236`（`ct/T0910`，worktree）
- **session_id**：0a69f438-adba-4d5a-8119-35a1f8c94bf0

### 產出摘要

**① 啟動決定與原因代號（host，per-terminal）**
- 新檔 `electron/claude-hooks-status.ts`：`ClaudeHooksRecords` / `claudeHooksRecords`（比照 `claudeSessionNameRecords`，512 筆上限、同 id 覆寫）、`computeHooksStatus`、`HOOKS_STATUS_WAIT_MS` = 2000、`hooksStatusKey`；`BAT_HOOK_SET` 改宣告在這裡、由 `bat-mcp-launch.ts` re-export（避免循環 import；值仍是 2，既有相等測試照過）。
- `electron/bat-mcp-launch.ts`：`hooksLaunchReasonOf` / `hooksLaunchRecordOf`；`createBatMcpLaunchArgs` 在有 terminal id 時記錄（claude / codex；其他 agent 清掉舊紀錄）。🔴 命令列不變（測試比對 `createBatMcpLaunchArgs` 與 `buildBatMcpLaunchArgs` 結果相同）；R13 照舊（Settings 關閉 → 不注入、記 `settings-off`）。不需改 `main.ts` / headless：預設寫進行程內的 `claudeHooksRecords`，main 與 headless 都走同一個 `createBatMcpLaunchArgs`。
- 代號：`settings-off` / `user-settings-arg` / `claude-hooks-disabled` / `managed-hooks-only` / `no-endpoint` / `script-missing`（含 hook 設定檔寫不進去）/ `unrepresentable-path`；詢問時另有 `no-report`（有紀錄且注入但沒回報；claude-cli preset 沒有紀錄時也算，BAT 重開後的保留分頁）與 `not-launched-by-bat`（沒有紀錄的塔台 / hint 為 claude）。

**② `--set-role` 的 `hooks:` 行與 2 s 等待**
- `electron/terminal-role.ts` `setTerminalRole`：只有帶 `batContract` 的呼叫回答多 `hooksStatus`；狀態為 `none` 時以 `PtyManager.waitForHookReport` 最多等 2 s（第一個回報被套用 / PTY 結束 / 逾時），回傳 Promise；🔴 不帶 `batContract` 的呼叫照舊同步回答、形狀逐字不變（不需改 `electron/handlers/terminal.ts`，handler registry 本來就 await）。`--agent` 另記為分頁 hint（`noteTowerAgentHint`，codex → `n/a (codex)`）。
- `scripts/bat-terminal.mjs`：`hooksLine` 在 `bat-contract:` 行之後印 `  hooks: ok (<injected|plugin>, set <n>[, plugin-outdated])` / `  hooks: none (<代號>)` / `  hooks: n/a (codex)`（文法逐字照 PLAN-068〈契約細節補充〉）；只在帶 `--bat-contract` 且 BAT 回了合法狀態時；帶 `--bat-contract` 的呼叫等回答 8 s（其他照舊 3 s）；`--help` 補一段；bat-scripts.log 的 `set-role` 事件多 `hooks`（只有代號）。
- `scripts/bat-hook.mjs`：`reportOrigin` —— 注入的 `session-start` 也帶 `origin: injected` / `set`（T0905 的提醒：讓 `--set-role` 在第一個 `Stop` 前就有 set）；其他注入事件的回報逐字不變；`--hook-list <n>`（plugin）→ 每個事件都帶 `origin: plugin`、`set: n`（缺 origin 會被當成 injected，使之後 plugin 回報被丟，所以 plugin 一律帶）。

**③ `hooksStatus` 查詢與 MCP**：`terminal:whoami` / `get-state` / `list`（含 `scope: 'towers'`）多 `hooksStatus`（結束的分頁 `null`）；`scripts/bat-mcp.mjs` 三個 tool 的說明補欄位、摘要加 `hooks=…`，全唯讀。`TerminalBlockedTracker.getHookOriginInfo`（per origin 的 set）。判定：有回報 → `ok`（injected 優先、不出 `plugin-outdated`；只有 plugin 且 `--hook-list` < `BAT_HOOK_SET` → `plugin-outdated`）→ codex → 啟動代號 → 沒有紀錄的規則。

**④ 提示（只對契約 v2 塔台，R9′）**
- 推送 `terminal:hooks-status { id, hooksStatus }`：`PtyManager.refreshHooksStatus` 只對「已宣告塔台＋有 `towerContract`」且狀態改變時送（`--set-role`、回報套用、⏻ / 結束、recovery）；`PROXIED_EVENTS`＋`path-aware-channels.ts`（不轉換）；`electron/preload.ts` 只在 `pty` 下加 `onHooksStatus`（Q-2 答覆）；🔴 不進 `HELPER_CHANNEL_ROLES`。
- renderer：`src/lib/hooks-status.ts`（形狀、代號、`hooksStatusLine`、`parseHooksStatus`、提示對應；electron 端 re-export 同一份）、`src/stores/hooks-status-store.ts`（自己訂閱一次、`pty:exit` 清除，不改 `App.tsx`）、縮圖 `🪝✕`（`TerminalThumbnail.tsx`，tooltip = 前綴＋原因）、待辦分頁標頭一行＋「怎麼修」連結（`src/components/inbox/InboxHooksHint.tsx`；`InboxPanel.tsx` 只多 import＋一行，Q-1 答覆）；三語系 `hooksStatus.*`（en / zh-TW / zh-CN，純增加）。`plugin-outdated` 只在待辦分頁顯示更新提示、不出徽章。

**⑤ marketplace＋`bat-hooks` plugin**：`.claude-plugin/marketplace.json`（`better-agent-terminal`）、`plugins/bat-hooks/.claude-plugin/plugin.json`（1.0.0）、`plugins/bat-hooks/hooks/hooks.json`（與 `BAT_CLAUDE_HOOKS` 同事件 / matcher / async / timeout 5；指令 `node "${CLAUDE_PLUGIN_ROOT}/scripts/bat-hooks-launcher.mjs" <event>`）、`plugins/bat-hooks/scripts/bat-hooks-launcher.mjs`（零依賴）。launcher：三個 `BAT_*` 都在、`BAT_HELPER_DIR` 絕對路徑、`bat-hook.mjs` 存在、事件在白名單才執行；在同一個 node 程序內載入該 BAT 的 `bat-hook.mjs`，`BAT_HELPER_NODE` 為存在的另一個絕對路徑時改用它（stdin 轉送、stdout / stderr 丟掉）；一律 exit 0、無輸出、2.5 s 上限。🔴 不進安裝檔（`build.files` / `extraResources` / `asarUnpack` 未動，測試守住；`verify:helpers` 照過）。
- **信任模型**：launcher 只執行 PTY env `BAT_HELPER_DIR` 指向的那個 BAT 的固定檔名 `bat-hook.mjs`（與 PATH 同等的信任：能改這個 env 的人本來就能控制該程序），不接受其他路徑 / 參數；plugin 不含權杖，由使用者以 claude 自己的 plugin 安裝流程同意；BAT 不替使用者安裝、不改 claude 設定。

**⑥ `--hook-list` / `plugin-outdated`**：launcher 的 `PLUGIN_HOOK_LIST` = 2（= `BAT_HOOK_SET`，測試守住；改 `BAT_CLAUDE_HOOKS` 時三處一起升）；注入與 plugin 並存只算一次（W3 去重不變，e2e 驗證 injected 之後的 plugin 回報不再改狀態）。

**⑦ (d1) `--plugin-dir` 評估（結論，不實作）**：內嵌 claude `2.1.331` 有 `--plugin-dir <path>`（session-only、可重複，另有 `--plugin-dir-no-mcp`）；執行檔字串顯示同名 plugin 已從 marketplace 安裝時，claude 會區分「`--plugin-dir` copy」與已安裝版本（`This --plugin-dir copy did not load …`、`synced-plugin-shadowed`），實際取哪份 / hooks 是否兩份都跑需真實 session（查證只用 `--help` 與唯讀字串搜尋，未開回合）。**建議不採用**：只補 G3（自訂 `--settings`），而 G3 已有 `user-settings-arg` 提示＋plugin；要注入就得把 plugin 打進安裝檔（違反本單「不進安裝檔」）；注入的回報會標成 `plugin`、與使用者自裝的同名 plugin 衝突，`hooks:` 行判讀更複雜。若日後要做，先把同名衝突併入待實機 T-10。

**⑧ R13 維持**：Settings「BAT MCP」關閉時 hooks 一起不注入，只顯示 `settings-off`（測試守住）。

**⑨ README**「與 BMad Control Tower 協作」新增「BAT hooks 與 `bat-hooks` plugin（選用）」小節（用途、何時需要、安裝 / 升級 / 移除、並存規則、自己的設定關掉 hooks 時），版本對照表新增 `bat-hooks` 一列（BAT 版號「待定」）。

**文件**：`docs/agent-guide/tower-inbox.md` 新增「hook 註冊（W9 / T0910）」整節（代號表、判定順序、`hooks:` 行、推送、提示、plugin 與信任模型、(d1)、已知限制、驗證）＋檔頭對照表；`docs/agent-guide/README.md` 索引；`CLAUDE.md` 新增小節「BAT hooks 狀態與 `bat-hooks` plugin（PLAN-068 W9 / T0910）」（CLAUDE.md 92,779 字元 < 100k，既有標題未改名）。

**改動檔案**（product commit `a8eb8236`，43 檔）：新增 `electron/claude-hooks-status.ts`、`src/lib/hooks-status.ts`、`src/stores/hooks-status-store.ts`、`src/components/inbox/InboxHooksHint.tsx`、`.claude-plugin/marketplace.json`、`plugins/bat-hooks/**`（3 檔）、測試 `electron/__tests__/claude-hooks-status.test.ts`、`scripts/__tests__/bat-hooks-plugin.test.mjs`、`src/components/__tests__/hooks-status-hint.test.tsx`；修改 `electron/{bat-mcp-launch,pty-manager,terminal-role,terminal-query-handlers,terminal-blocked-state,preload}.ts`、`electron/remote/{protocol,path-aware-channels}.ts`、`scripts/{bat-hook,bat-terminal,bat-mcp}.mjs`、`src/components/{TerminalThumbnail,InboxPanel}.tsx`、`src/types/electron.d.ts`、三個 locale、`README.md`、`CLAUDE.md`、`docs/agent-guide/{README,tower-inbox}.md`，以及因回應形狀新增欄位而更新斷言的既有測試（見〈遭遇問題〉）。

**驗證（在 head `a8eb8236` 上）**

| 關卡 | 結果 |
|---|---|
| `npm ci`（worktree） | exit 0 |
| `npm run test:unit` | exit 0：**484 files passed / 3 skipped（487）；8842 tests passed / 42 skipped**（head 上完整執行第一次即全綠；commit 前同內容也跑過一次全綠） |
| `npm run test:legacy` | exit 0：files 33 passed / 0 failed；tests 472 passed / 0 failed |
| `npx vite build` | exit 0 |
| `npm run typecheck` | 0 |
| `npm run typecheck:electron` | 0 |
| `npm run verify:helpers` | exit 0（6 個 helper，與 server bundle 同組） |
| e2e | 未跑 playwright（本單沒有新增 / 需要隔離實例的 e2e）；headless 真 node-pty e2e 在 unit 內：`headless-set-role-e2e`（`--bat-contract` 呼叫多 `hooks: none (not-launched-by-bat)`）、`headless-terminal-query-e2e`（`towers` 列帶 `hooksStatus`）。未碰安裝版 BAT / userData / Terminal Server / holder |

新增測試重點：判定表與 `hooks:` 文法、啟動代號（每種原因實際走 `buildBatMcpLaunchArgs`）、PtyManager 狀態 / 等待（fake timers：2 s 內回報即回答、逾時回原因）/ 推送只給契約塔台且只在改變時、舊呼叫同步不變；真 helper 對每種狀態印的行、舊呼叫沒有這行、3.5 s 才回答仍等得到；真 launcher → 真 `bat-hook.mjs` → RemoteServer（plugin 回報帶 origin / set、injected 之後 plugin 被丟、沒有 `BAT_*` / 相對路徑 / 錯誤目錄 / 未知事件都 exit 0 無輸出無回報）；launcher 對丟例外 / 卡住的腳本仍 exit 0 無輸出；hooks.json ↔ `BAT_CLAUDE_HOOKS`；plugin 不在安裝檔設定；renderer 徽章只在契約相符＋`none`、三語系 tooltip、待辦提示與連結。

**待實機（對應 T0902 待實機清單）**：T-9（Windows 經 Git Bash 與 PowerShell 時 `${CLAUDE_PLUGIN_ROOT}` 展開與 `node` 解析）、T-10（注入＋plugin 並存的實際去重、hooks 合併、CT guard 共存；含 (d1) 同名衝突）、T-11（專案 `disableAllHooks` → `no-report`）、T-12（WSL 手打 claude＋plugin、遠端沒有系統 node）。

### 互動紀錄
- [06:04] Q-1（BAT 通道，`--ask --no-pty-write`）: `InboxPanel.tsx` 不在範圍，可否只加 import＋一行元件 → A（塔台）: A，已補進 affects_files，只做這兩行、不調整其他排版 → Action: 元件放 `src/components/inbox/`，`InboxPanel.tsx` 只加兩行
- [06:04] Q-2（BAT 通道，`--ask --submit`）: 新推送事件 `terminal:hooks-status` 需改 `preload.ts` → A（塔台）: A，已補進 affects_files；不塞進 `terminal:role-changed`；事件與相關 channel 不進 `HELPER_CHANNEL_ROLES` → Action: `PtyManager` 廣播＋`PROXIED_EVENTS`，`preload.ts` 只加 `pty.onHooksStatus`

### Renew 歷程
無

### 遭遇問題
- 無阻斷。開工時範圍有兩處超出 `affects_files`（`InboxPanel.tsx`、`preload.ts`），以 Q-1 / Q-2 問塔台，答覆 A / A 後照做（塔台已補進 affects_files）。
- 回應形狀新增 `hooksStatus`（與 `session-start` 多帶 `origin` / `set`）讓 17 個既有 `toEqual` 斷言失敗（T0903 教訓所述類型），逐一補上新欄位：`codex-osc-state`、`terminal-blocked-state`（3）、`terminal-list-towers`（2）、`terminal-query-handlers`（3）、`terminal-role-contract`（5，改為先套用一個 hook 回報以免 2 s 等待；舊呼叫「不帶 batContract 時回答逐字不變」的斷言未改）、`tower-questions`、`headless-set-role-e2e`、`headless-terminal-query-e2e`。沒有任何舊呼叫的輸出改變。
- `setTerminalRole` 的回傳型別改為 `SetRoleResult | Promise<SetRoleResult>`（只有帶 `batContract` 且要等時才是 Promise）。既有呼叫端只有 handler registry（本來就 await）與測試的 `toEqual`，typecheck 兩邊 = 0。
- (d1) 查證以 `claude --help` 與執行檔唯讀字串搜尋完成，沒開 claude session / 回合；同名衝突的實際行為列待實機 T-10。
- 一處 `bat-mcp.mjs` 說明文字含英文撇號導致字串語法錯，已改寫（`node --check` 通過）。
- 過程中有幾次以 heredoc / 行內 Python 改檔（R-G005 建議改寫檔），結果都以測試與 bytes 檢查確認（新檔與改動檔皆 LF、無 CR）。
- 公開 repo：程式 / 文件 / 回報區沒有真名或家目錄路徑；marketplace `owner.name` 用 repo 的 GitHub 帳號 `gowerlin`（README / CLAUDE.md 既有公開資訊）。

### 隔離分支證據
- branch：`ct/T0910`
- base_sha：`06c3b8843caf4f34bbec6117b0de443b7a3fdbf9`（`CT_WORKTREE_BASE`；與 `v0.8.x` 的 merge-base 為 `677860a4816f17d4bf743c9329f8992ee031abe9`，開工時核對符合）
- validated_sha：`a8eb823669ff8a02b623a5f6829e05cb7e69b058`
- head_sha：`a8eb823669ff8a02b623a5f6829e05cb7e69b058`
- validated_sha ≠ head_sha 的說明：相同（commit 後在 head 上重跑 `test:unit` / 兩個 typecheck 全綠；`test:legacy` / `vite build` / `verify:helpers` 跑在內容與 head 完全相同的工作樹，commit 前後沒有任何檔案變動）
- `CT_HOME` 已設定；落點檢查：C-0 PASS（`repo` = `better-agent-terminal` = `basename "$CT_HOME"`），C-1 PASS（工單在 `$CT_HOME/_ct-workorders/`），C-3 PASS（affects_files 皆有既有上層目錄），C-2 不適用（無 `branch` 欄位）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 收單前 `git -C "$CT_WORKTREE" status --porcelain`：空

### 回報時間
2026-11-25T06:28:24+08:00
