---
schema_version: 1
schema_kind: workorder
id: T0747
title: "pre.8 工作區等待提示 ⚠️ 真實模型驗收（小額，Haiku）：Claude CLI 分頁權限詢問、auto mode、塔台分頁 AskUserQuestion、淡化"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T20:21:32+0800"
depends_on: [T0746]
related:
  - "T0735（`b4daaf1f`，D200–D203 工作區 ⚠️）；T0736（`0232034f`，`e2e/v072-pre8-workspace-waiting-real-agents.spec.ts`：真的 claude CLI / codex ＋假模型 ①–⑥ PASS；〈仍需手動實機驗收〉：真實模型、auto mode）；T0739 / T0746（真實模型 spec 的做法與用量記錄）"
  - "T0736 附註：claude 2.1.316 auto mode 在 gateway（假 API）下不觸發 `PermissionRequest` hook —— 本單要看真實模型下的行為"
  - "CLAUDE.md「Worker 分頁回收」節 T0735 段、「blocked 狀態偵測」節；`docs/agent-guide/worker-tab-recycle.md`、`docs/agent-guide/blocked-state.md`"
affects_files:
  - "e2e/v072-real-model-workspace-waiting.spec.ts（新增，檔名可調；🔴 必須預設 skip，只有 `BAT_E2E_REAL_MODEL=1` 才跑）"
  - docs/agent-guide/worker-tab-recycle.md
  - _ct-workorders/T0747-real-model-workspace-waiting-badge.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 使用者已同意（2026-11-01 第一百零三 session）以真實模型小額驗收工作區 ⚠️。Claude CLI 分頁一律以 `claude-haiku-5-5` 啟動（隔離實例的 Settings / 工作區 `agentCustomArgs` 加 `--model claude-haiku-5-5`，不改產品程式碼）；🔴 不得使用 Opus / Fable / Sonnet。用量上限：整張單合計 ≤ 10 個模型回合、估計費用 ≤ US$0.5，超過立即停止並回報 PARTIAL。費用來源：本單 session 的 JSONL（`~/.claude/projects/` 下目錄名含 `bat-e2e-t0747` 者）只讀 `usage` 欄位估算，讀不到就寫讀不到。不得在 Claude CLI 參數放 `--settings`（會讓 BAT 不注入 hooks）。"
  - "🔴 情境（隔離實例、至少兩個工作區：A = 正在看的、B = 放 agent 分頁的；斷言沿用 T0735 / T0736 的 DOM / selector，都在 A 看 B 的列）：① B 的 Claude CLI 分頁、預設權限模式（default）→ 請模型執行一個需要核准的 Bash（例 `echo t0747`）→ 權限詢問出現 → B 列實心 ⚠️、tooltip 是 permission 原因且不含指令內容 → 在 B 核准 → ⚠️ 依 D203 消失或淡化（寫明當下焦點）。② 同分頁切到 auto mode（claude 2.1.316 的 auto，依 CLI 實際方式切換）→ 送 2–3 個不同風險的動作（例 echo、在工作區外寫檔、刪檔），逐一記錄：claude 有沒有詢問、`PermissionRequest` hook 有沒有觸發、B 列有沒有 ⚠️（觀察記錄，與 ① 對照；不視為失敗）。③ B 的「以塔台開啟 Claude」分頁 → 請模型用 AskUserQuestion 問一題 → `question` → B 列 ⚠️ → 回答後清除。④ 等待在使用者沒看 B 時結束（例如 A 有焦點時由 spec 經 B 分頁 PTY 回答）→ B 列淡化 ⚠️；切到 B 分頁且視窗有焦點後清除（D203）。模型沒有照指示用某工具時照實記錄，同一情境重試不超過 1 次。"
  - "🔴 登入與隔離：用使用者現有的 claude 登入（隔離實例沿用真實 HOME）；🔴 不得複製、讀出、記錄或印出任何認證檔或權杖內容（`.credentials.json`、API key、`batcap.`），不得傾印整個 `process.env`。隔離實例 `e2e/fixtures/electron-isolation.ts`（獨立 userData 與 remote port），不碰使用者正在用的 BAT。工作區名稱 `e2e-t0747-*`，目錄放 `%ProgramData%\\bat-e2e-t0747-*`（避免載入上層 `.claude/CLAUDE.md`），跑完刪除；本單在 `~/.claude/projects/` 產生、目錄名含 `bat-e2e-t0747` 的 session 目錄跑完可刪除（只刪這些），其他一律不動。claude CLI 首次在該目錄啟動的信任畫面由 spec 經 PTY 回答，不改使用者的 claude 設定檔。"
  - "🔴 Build：使用 T0746 建好的 `dist` / `dist-electron`，🔴 不得再跑 `npx vite build`（與 T0748 並行）。不改產品程式碼（`src/` / `electron/` / `scripts/` 都不動）；發現產品缺陷 → 記在回報區〈發現的問題〉附重現步驟與證據，由塔台開 BUG。某情境做不到就寫明原因與已試過的做法，其餘照做，可回 PARTIAL。"
  - "🔴 驗證：spec 預設 skip；跑 1 次（不連跑）。重跑 `t0735-workspace-waiting-badge`（假模型、不耗 token）綠。`npm run typecheck` = 0、`npm run typecheck:electron` = 0（spec 在 tsconfig 範圍外則註明）。`docs/agent-guide/worker-tab-recycle.md` 的 T0735 驗證清單補一行：真實模型 spec 位置、啟用方式、本次結果與 auto mode 觀察。回報區附每回合模型、tokens、估計費用與〈仍需手動〉。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑或帳號。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0747 — pre.8 工作區等待提示 ⚠️ 真實模型驗收

## 元資料

- **工單編號**：T0747
- **類型**：implementation（驗收用 e2e，真實模型）
- **優先級**：P2
- **建立時間**：2026-11-01T20:21:32+0800
- **預估規模**：S

## 背景

T0736 已用真的 claude CLI / codex 加假模型驗過工作區 ⚠️ ①–⑥。剩下真實模型的行為，特別是 claude 2.1.316 預設的 auto mode：哪些動作會詢問、hook 會不會觸發、⚠️ 會不會出現（假 API 下 auto mode 不觸發 `PermissionRequest`）。使用者同意以 Haiku 5.5 小額驗收。

## 範圍

1. 情境 ①–④（見 frontmatter）。
2. 預設 skip 的 spec（`BAT_E2E_REAL_MODEL=1` 才跑）。
3. docs 一行。

## 不做

- 不用 Opus / Fable / Sonnet；不超過用量上限；不跑 codex 真實模型。
- 不改產品程式碼、不碰認證檔、不重新 build。

## 驗收

- [ ] 情境 ①–④ 逐項結果（PASS / 行為記錄 / 未涵蓋與原因），auto mode 對照表
- [ ] 每回合模型、tokens、估計費用；合計在上限內
- [ ] spec 預設 skip、`t0735` 綠、兩個 typecheck = 0
- [ ] 〈發現的問題〉與〈仍需手動〉

---

## 回報區

（Worker 填寫）
