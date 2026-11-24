---
schema_version: 1
schema_kind: workorder
id: T0905
title: "PLAN-068 W3（在 `v0.8.x`）：塔台回合訊息卡的資料層 —— `Stop` hook 送 `last_assistant_message`、host 記憶體卡片 store（只收契約 v2 塔台、遮罩、上限、生命週期）、proxied 讀取＋事件、重連對帳、Claude 面板塔台來源"
type: implementation
status: PENDING
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T05:12:00+08:00"
updated_at: "2026-11-25T05:12:00+08:00"
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

- [ ] `stop` 送最後訊息＋`origin` / `set`；T0590 規則不回歸（既有 hook 測試全綠）
- [ ] host store：只收 v2 塔台、遮罩、上限 30 / 10 / 16 KiB、生命週期、去重；日誌不含內容
- [ ] proxied 讀取＋事件＋操作、重連對帳；不在 helper 權杖範圍
- [ ] Claude 面板塔台來源介面
- [ ] `last_assistant_message` 最低 claude 版號（docs）
- [ ] 驗證關卡、文件、隔離分支證據

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態
- **session_id**：

### 產出摘要

### 互動紀錄

### Renew 歷程
無

### 遭遇問題

### 隔離分支證據
- branch：`ct/T0905`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
