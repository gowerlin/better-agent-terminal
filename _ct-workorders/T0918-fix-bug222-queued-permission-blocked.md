---
schema_version: 1
schema_kind: workorder
id: T0918
title: "修 BUG-222：claude 排隊多個權限詢問時，回答第一個後 `blocked`（`permission`）不得提早清除"
type: bugfix
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-068
priority: P1
sizing: M
created_at: "2026-11-25T12:19:45+08:00"
updated_at: "2026-11-25T12:22:47+08:00"
started_at: "2026-11-25T12:22:47+08:00"
target_version: "0.8.0-pre.3（與 CT 6.1.0 同日發佈）"
depends_on: [T0915]
related:
  - "BUG-222；D337；BUG-196 / T0788（通知保留）；T0590（blocked 契約）、T0757（滑鼠回答）、T0790 / T0791（晚到的清除回報）；T0915 回報區〈建議開 BUG〉第 3 點"
affects_files:
  - _ct-workorders/T0918-fix-bug222-queued-permission-blocked.md
  - electron/terminal-blocked-state.ts
  - electron/__tests__/
  - electron/bat-mcp-launch.ts
  - scripts/bat-hook.mjs
  - scripts/__tests__/
  - tests/
  - docs/agent-guide/blocked-state.md
  - CLAUDE.md
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0918（塔台已預先從 `v0.8.x` `4f7484bc` 建立分支 `ct/T0918`）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0918` 寫檔；開工確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = `4f7484bceb4fac693f0d35fd0285b93bb4d8c146`，不符就停下問塔台。不 merge / rebase / push、不動 `main` 與 `v0.8.x`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 先查證：① 從 T0915 證據（本機 `C:/Users/Gower/AppData/Local/ct610-accept/results/M-C5.md`〈BAT 端備註〉、`results/M-C5/` 的 debug log 11:42:51–11:42:55、截圖；只讀，不改）整理事件時間線：3 個 `PermissionRequest` 到達、使用者回答、哪個事件清除了 `blocked`；② 讀內嵌 claude CLI（`@anthropic-ai/claude-code` 目前版本）與 hook 文件，確認排隊的權限詢問在使用者回答後會送哪些 hook（`PostToolUse`、`PermissionDenied`、`Notification` 等）、payload 有沒有可對應的 id（`tool_use_id` 等）。可用 headless / `-p` 以外不耗 token 的方式查（讀字串、文件）；🔴 不開會耗 token 的 claude 回合。"
  - "🔴 修法由你依證據選，方向：`permission` reason 依「尚未結束的權限詢問數」決定，而不是第一次使用者輸入就清除——例如每個 `PermissionRequest` 計數（有 id 就以 id 記），只在對應的結束事件（工具開始 / 完成 / 拒絕）或回合結束、PTY 結束等既有清除條件才減少，數到 0 才清；若 hook 送不出能對應的結束事件，說明並採最保守的可行做法（寧可多保留，不得替使用者作答）。🔴 hook 腳本規則不變（exit 0、stdout 不輸出、總時限 1.8 s、內容不進日誌）；若要多送 payload 欄位，只送 id 類欄位、改 docs 契約說明，並確認舊 BAT＋新 hook、新 BAT＋舊 hook 的組合不出錯。"
  - "🔴 不回歸（R-G003 第 3 點）：回報區列〈相關通過案例〉：T0590 契約（優先序、`blockedDetection`）、T0757 滑鼠回答（單一詢問用滑鼠回答仍清除）、T0790 / T0791 晚到回報、T0788 通知保留、T0915 M-C5 的 PASS 項；單一權限詢問的行為（回答即清除、⚠️ 消失）必須與修正前相同。"
  - "🔴 驗證：單元測試（3 個並行 `PermissionRequest` → 回答 1 個仍 blocked → 全部結束才清；單一詢問行為不變；亂序 / 晚到事件）；`npx vite build` exit 0；兩個 typecheck = 0；`npm run test:unit` 第一次完整執行即綠（附數字）；`npm run test:legacy` 全綠；e2e `e2e/t0787-notify-into-blocked-tower.spec.ts` 跑 1 次（隔離實例，需先 `npx vite build`）。程序清理照 D308。"
  - "🔴 文件：`docs/agent-guide/blocked-state.md` 事件表 / 清除規則更新；CLAUDE.md「blocked 狀態偵測」節只在有新不變式時加一句。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；commit 訊息 `fix(T0918): …`；不 push、不觸發 workflow、不建 tag；禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；收單前 worktree `status --porcelain` 為空。公開 repo（D176）：repo 內不寫本機驗收目錄的真實路徑。yolo：不得問使用者，判讀問題問塔台。"
---

# T0918 — 修 BUG-222：排隊的權限詢問期間維持 `blocked`

見 [BUG-222](BUG-222-queued-permission-prompts-clear-blocked-early.md)。

## 驗收

- [ ] 事件時間線與 claude hook 行為查證（附來源）
- [ ] 多個權限詢問排隊時，全部回答完才清除 `permission`；單一詢問行為不變
- [ ] 單元、e2e t0787、vite build、兩個 typecheck、`test:unit` 第一次即綠、`test:legacy`
- [ ] 〈相關通過案例〉逐案判定
- [ ] 文件同步

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）
