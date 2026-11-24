---
schema_version: 1
schema_kind: workorder
id: T0910
title: "PLAN-068 W9（在 `v0.8.x`）：hook 註冊 —— host 記錄 hooks 啟動決定與原因代號、`--set-role` 的 `hooks:` 行（等 2 s）與 `hooksStatus`、提示與徽章 `🪝✕`、BAT repo 的 marketplace＋`bat-hooks` Claude Code plugin（launcher）、`--hook-list` / `plugin-outdated`、評估 `--plugin-dir`"
type: implementation
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T05:58:05+08:00"
updated_at: "2026-11-25T06:00:01+08:00"
started_at: "2026-11-25T06:00:01+08:00"
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
- **session_id**：

### 產出摘要

### 互動紀錄
- [06:04] Q-1（BAT 通道，`--ask --no-pty-write`）: `InboxPanel.tsx` 不在範圍，可否只加 import＋一行元件 → A（塔台）: A，已補進 affects_files，只做這兩行、不調整其他排版 → Action: 元件放 `src/components/inbox/`，`InboxPanel.tsx` 只加兩行
- [06:04] Q-2（BAT 通道，`--ask --submit`）: 新推送事件 `terminal:hooks-status` 需改 `preload.ts` → A（塔台）: A，已補進 affects_files；不塞進 `terminal:role-changed`；事件與相關 channel 不進 `HELPER_CHANNEL_ROLES` → Action: `PtyManager` 廣播＋`PROXIED_EVENTS`，`preload.ts` 只加 `pty.onHooksStatus`

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0910`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
