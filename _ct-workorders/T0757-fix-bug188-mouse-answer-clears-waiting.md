---
schema_version: 1
schema_kind: workorder
id: T0757
title: "修正 BUG-188：用滑鼠回答後 ⚠️ 也要清除（先以真 claude / codex 查證各路徑，再精準修）"
type: implementation
status: PENDING
updated_at: "2026-11-02T02:23:44+0800"
session_ids: []
repo: better-agent-terminal
project: maintenance
priority: P1
sizing: M
created_at: "2026-11-02T02:23:44+0800"
depends_on: []
related:
  - "BUG-188；D209；`docs/agent-guide/blocked-state.md`〈清除漏洞〉與事件表；T0594 / T0597 / T0620 / T0657（既有清除 hook）；T0735 / D203（工作區 ⚠️、淡化）"
  - "`electron/terminal-blocked-state.ts`（`TerminalBlockedTracker`、`hookEventReason`）、`scripts/bat-hook.mjs`、`electron/bat-mcp-launch.ts` `BAT_CLAUDE_HOOKS`、`electron/close-worker.ts` `isTerminalAutoReply`、`src/lib/terminal-attention.ts`、`src/stores/terminal-attention-store.ts`"
  - "假模型 e2e 基礎：`e2e/fixtures/fake-anthropic-api.ts`、`e2e/v072-pre8-workspace-waiting-real-agents.spec.ts`（T0736）、`e2e/t0735-workspace-waiting-badge.spec.ts`"
affects_files:
  - electron/terminal-blocked-state.ts
  - electron/bat-mcp-launch.ts
  - scripts/bat-hook.mjs
  - electron/handlers/pty.ts
  - electron/__tests__/
  - src/lib/terminal-attention.ts
  - src/stores/terminal-attention-store.ts
  - src/components/TerminalPanel.tsx
  - src/lib/__tests__/
  - src/stores/__tests__/
  - e2e/
  - docs/agent-guide/blocked-state.md
  - docs/agent-guide/worker-tab-recycle.md
  - CLAUDE.md
  - _ct-workorders/T0757-fix-bug188-mouse-answer-clears-waiting.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 先查證（D209：先查證再精準修）：以真的內嵌 claude CLI ＋假 Anthropic API（T0736 作法，不耗 token）在隔離實例重現，並以滑鼠點擊（xterm 滑鼠回報，與使用者實際操作相同）回答：① 權限對話框以滑鼠允許；② 以滑鼠拒絕；③ AskUserQuestion 以滑鼠選答案；④ 以滑鼠取消 / 拒絕 AskUserQuestion；⑤ elicitation 能觸發就驗、不能觸發照實寫。每條記錄 claude 送出的 hook 事件（`bat-scripts.log` / debug log）與 ⚠️ 何時清除。codex（內嵌 0.166）：⑥ 讓 codex 進入 `input` 等待後以滑鼠回答，記錄 OSC 7501 序列。先寫查證表（路徑 × hook / OSC × 清除時間），再動程式。"
  - "🔴 修正方向（D209）：有 agent 信號（hook / OSC）可用的路徑，用該信號精準清除（例：查證發現 `Stop` 或其他 hook 會到）；沒有信號可用的路徑，才退回「blocked 中的分頁收到滑鼠**按下**（SGR / X10 / urxvt 的 press，不含放開、滾輪、移動、拖曳）視同回答，清除 hook reason（`permission` / `question` / `elicitation`）」。🔴 不改 `isTerminalAutoReply` 的語意與 `--close-worker` 的取消規則（滑鼠仍不取消回收）；不改 `blocked` / `blockedReason` / `blockedDetection` 契約欄位與值（T0590 / T0600 / T0621 契約）；`tower` 問題不受滑鼠影響。🔴 codex `input`：CLAUDE.md 規定使用者輸入不清除；若查證 codex 滑鼠回答後自己會送狀態 → 不改；若不會 → 先問塔台（改契約需決策），不得自行放寬。"
  - "🔴 驗收情境（e2e，隔離實例＋假 API）：上列 ①–④（與 ⑥ 若有改）以滑鼠回答後，該分頁縮圖 ⚠️ 與工作區列 ⚠️ 清除；看著分頁時回答不留淡化；滾輪捲動 blocked 分頁不清除；鍵盤回答照舊清除。突變檢查：拿掉修正，滑鼠情境要失敗。重跑 `t0735-workspace-waiting-badge`、`v072-pre8-workspace-waiting-real-agents`、`t0609`、`t0590`（若存在）綠。"
  - "🔴 驗證：新增 / 修改的單元測試＋突變檢查（拿掉修正，測試要失敗）；`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npm run test:unit`、`npx vite build`（依上方 build 規則的位置）。"
  - "🔴 build（Lane A：T0757 → T0761 → T0762 → T0763 → T0764，依序執行）：本單在主 checkout 跑 `npx vite build` 與 e2e；Lane B（T0758 → T0759 → T0760）只在匯出目錄 build，不影響本單。e2e 一律用 `e2e/fixtures/electron-isolation.ts` 隔離實例，不碰使用者正在用的 BAT、userData 與 WSL bat-server。"
  - "🔴 文件：更新 `docs/agent-guide/blocked-state.md`〈清除漏洞〉為查證後的結果；CLAUDE.md「blocked 狀態偵測」或「Worker 分頁回收」節只加必要的一兩句（遵守 CLAUDE.md 撰寫規則 T0595）。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單範圍；同一 checkout 有其他 Worker 並行，不得 commit 或改動別人的未提交變更；`CLAUDE.md`、`docs/agent-guide/*.md` 等共用檔若已有別人的未提交修改，等對方 commit 後再改（`git diff <檔>` 確認）。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。用 Python 改檔一律 `newline=''`。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。不 push、不發版。"
---
# T0757 — 修正 BUG-188：用滑鼠回答後 ⚠️ 也要清除（先以真 claude / codex 查證各路徑，再精準修）

## 元資料

- **工單編號**：T0757
- **類型**：implementation
- **優先級**：P1
- **建立時間**：2026-11-02T02:23:44+0800
- **預估規模**：M

## 背景

使用者指示（D209）：不論鍵盤或滑鼠，回答後的結果一樣是有回答，⚠️ 都要清除。目前鍵盤輸入會清除；滑鼠回報不算輸入，部分路徑靠 hook 清除（部分未實機觸發），仍有路徑要等回合 `Stop` 才消失。使用者選「先查證再精準修」。

## 範圍

1. 以真 claude / codex ＋假模型重現各滑鼠路徑，產出查證表。
2. 依查證結果修正：先用 agent 信號，沒有才退回「滑鼠按下視同回答」。
3. e2e、單元測試、文件。

## 不做

- 不改 `--close-worker` 的使用者輸入判定；不改 blocked 契約欄位；不改 Claude Agent 面板（T0762）；不改 detached 視窗（T0761）；不發版。

## 驗收

- [ ] 查證表（路徑 × 信號 × 清除時間），修正前後對照
- [ ] 滑鼠情境 e2e 綠＋突變檢查；既有 ⚠️ e2e 綠
- [ ] typecheck 0 / 0、`test:unit`、`vite build`
- [ ] docs / CLAUDE.md 更新

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
