---
schema_version: 1
schema_kind: workorder
id: T0731
title: "研究：BMad-Guide ADVISORY（Worker session 對應與用量彙總）Q-B1–Q-B5 的現況查證、可行性與工作量，並起草回覆稿"
type: research
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-01T12:06:56+0800"
started_at: ""
updated_at: "2026-11-01T12:06:56+0800"
completed_at: ""
depends_on: []
related:
  - "來源（BMad-Guide repo，唯讀）：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\_ct-workorders\\_handover-2026-11-01-bat-worker-session-map-advisory.md`（schema_kind: cross-tower-advisory，2026-11-01T11:38:51+0800 送出）"
  - "CLAUDE.md「Claude 分頁的 session 名稱（PLAN-050 / T0641，D167）」（R3：`bat-hook.mjs session-start` 送 `sessionId`、日誌只記前 8 碼）、「Logging」（helper 日誌 `scripts/_bat-logger.mjs`）、「工作區層級 Agent / 啟動參數」"
  - "使用者 2026-11-01 第一百零二 session 選「先開研究單」"
affects_files:
  - _ct-workorders/T0731-research-worker-session-map-advisory.md
  - _ct-workorders/_reply-2026-11-01-bat-worker-session-map-advisory.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 只查不改：不改產品程式碼、測試、docs、README；不跑 `vite build` / 打包 / e2e（T0729 正在同一 repo build）。可讀程式碼、git log / 工單 / 決策紀錄；可讀本機 `bat-scripts.log` 的**大小、筆數、event 種類與欄位名**，不得把 log 內容、terminal id 以外的識別值、session id 全碼或任何權杖寫進回報或回覆稿。"
  - "🔴 逐題回答（每題分「現況（附 `檔案:行` 或工單 / 決策編號）」「可行性與工作量（S / M / L）」「風險 / 要遵守的既有規則」「建議：採納 / 部分採納 / 不採納」）：Q-B1 `report-hook.session` 記前 8 碼是不是刻意的（找出決策出處與理由，例如 T0642 / D167 的日誌政策），改記完整 UUID 的影響（隱私、公開 repo、log 外流）；Q-B2 `terminal-created` / `close-worker` 補 `claudeSessionId` / `role` / `agent` 或新增 `worker-session` 紀錄：資料在哪個行程、何時可得（session id 由 `SessionStart` hook 晚到）、helper log 與主行程 debug log 誰寫比較合理；Q-B3 `bat-scripts.log` 的實際保存 / 輪替行為（`_bat-logger.mjs`），目前大小，是否該開 BUG（無上限成長）；Q-B4 狀態列成本 / Token 的計算來源與 JSONL `message.usage` 是否同一口徑，依 Worker 分頁彙總的可行性；Q-B5 確認 skill 管理是否確實不需 BAT 整合（對照工作區層級啟動參數與 `--settings` 注入，注意 BAT 自己也用 `--settings=` 注入 hooks，使用者再加 `--settings` 會不會衝突）。"
  - "🔴 起草回覆稿 `_ct-workorders/_reply-2026-11-01-bat-worker-session-map-advisory.md`（frontmatter 比照同目錄既有 `_reply-*.md`；`status: DRAFT`；繁體中文；逐題給 BAT 的立場與依據），標明「採納與否待 BAT 使用者決定」。回覆稿不寫真名、家目錄路徑（`<使用者資料夾>`）、權杖、session id 全碼。不送出、不通知 BMad-Guide（塔台處理）。"
  - "🔴 回報區列：各題建議摘要表、若採納時建議的工單拆分（每張的範圍、affects_files 估計、是否改 helper 契約 / README 協作章節）、需要使用者決定的點。發現的缺陷（例如 log 無上限成長）列〈發現的問題〉由塔台開 BUG。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 本單與回覆稿兩個檔。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。"
---

# T0731 — 研究：Worker session 對應 ADVISORY

## 元資料

- **工單編號**：T0731
- **類型**：research
- **優先級**：P3
- **建立時間**：2026-11-01T12:06:56+0800
- **預估規模**：S

## 背景

BMad-Guide 塔台（CT 維護方）2026-11-01 送來 ADVISORY：CT PLAN-004 要在 `ct-insights` 把 Claude Code 用量歸到工單，CT 端不靠 BAT 新功能已可完成（JSONL 首訊息＋分頁標題，`report-hook.session` 前 8 碼交叉驗證）；另提 Q-B1–Q-B5 五點建議，不採納也不影響 CT。使用者決定先開研究單查證並起草回覆，採納與否之後決定。

## 範圍

1. Q-B1–Q-B5 逐題查證現況、可行性、工作量、建議。
2. 起草 `_reply-2026-11-01-bat-worker-session-map-advisory.md`（DRAFT）。

## 不做

- 不改任何產品檔案、不 build、不送出回覆。

## 驗收

- [ ] 五題各有現況證據與建議
- [ ] 回覆稿 DRAFT 已 commit，無敏感值
- [ ] 採納時的工單拆分建議與待決點

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 回報時間
