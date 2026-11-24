---
schema_version: 1
schema_kind: workorder
id: T0897
title: "（在 `v0.8.x`）① claude 花費上限句型（`channel's monthly spend limit`、`usage credit limit` 等）讓 `usage-limit.ts` 辨識；② e2e t0592 `lacking \"shell\"` 情境穩定化"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-25T01:06:57+08:00"
updated_at: "2026-11-25T01:06:57+08:00"
target_version: "0.8.0-pre.2"
depends_on: [T0896]
related:
  - "T0891 回報區〈遭遇問題〉1（t0592 間歇失敗）與〈觀察〉1（claude 花費上限句型）；D321（使用者 2026-11-25：候選 1、2「也安排」）；D148 / T0566（用量限制自動繼續）；T0592"
  - "CLAUDE.md「用量限制自動繼續（PLAN-044 / T0566，D148）」「BAT MCP shim」各節；`docs/agent-guide/usage-limit-continue.md`、`docs/agent-guide/bat-mcp-shim.md`"
affects_files:
  - _ct-workorders/T0897-usage-limit-spend-phrases-and-t0592-stability.md
  - src/lib/usage-limit.ts
  - src/lib/__tests__/usage-limit.test.ts
  - docs/agent-guide/usage-limit-continue.md
  - e2e/t0592-codex-tower-worker.spec.ts
  - docs/agent-guide/bat-mcp-shim.md
renew_count: 0
isolation: worktree
workdir: "worktree ct/T0897（塔台 2026-11-25 01:14 從 `v0.8.x` `7094b993` 建立分支）"
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 分支與 worktree：只在 worktree 分支 `ct/T0897` 寫檔。開工時確認 `git -C \"$CT_WORKTREE\" merge-base HEAD v0.8.x` = 本工單〈派工補記〉寫的 `v0.8.x` SHA，不符就停下問塔台（BAT 印的 `base` / `CT_WORKTREE_BASE` 可能是與 main 的共同祖先，屬預期）。不 merge / rebase、不切分支、不 push、不動 `main` 與 `v0.8.x`。主 checkout 只能寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 只改 `affects_files` 列的檔案。CLAUDE.md 不改（需要時把建議文字寫在回報區）。需要動其他檔 → 先問塔台。"
  - "🔴 ① 句型：從內嵌 claude 2.1.331 binary 字串（比照 T0717 / T0891 的做法：`strcount` 計數＋抽前後文）找出所有花費 / 額度類限額訊息（至少 `channel's monthly spend limit`、`usage credit limit`，以及同一組名稱表裡其他 `You've hit your …` 變體），逐句判斷該歸哪一類（`claude-limit` 有重置時間 / `claude-blocked` 沒有重置時間的 `non-timed` 等，依 `usage-limit.ts` 既有分類與 D148 規則）。只做純追加：不刪、不改既有句型與決策表；🔴 claude 一律不送文字（D148）；引用在句中不算（比照既有測試）。測試每句至少一例（含彎引號 / 重置時間變體），回報區附句型來源（計數與前後文）。若某句的分類不明確或會改變既有行為 → 問塔台。"
  - "🔴 ② t0592：`codex Worker dispatch with settings.json lacking \"shell\"` 情境間歇失敗（T0891：Worker `bat-notify --submit` exit 0，但 tower 分頁的 pwsh buffer 20 s 內沒有 `T0592 完成`，buffer 混有使用者 PowerShell profile 的輸出）。先找根因（例如 tower shell 載入使用者 profile 的時序、prompt 重繪蓋掉輸出、等待條件太窄），再穩定化（例：tower shell 以 `-NoProfile` 啟動、改等更可靠的信號、合理延長等待）。🔴 不得放寬斷言到失去意義（仍要證明通知送達 tower）、不得改產品程式；只改 spec 與 `docs/agent-guide/bat-mcp-shim.md` 的紀錄。驗證：整份 spec 連續 5 次全綠（附每次結果）。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 全綠（完整跑第一次若有 RemoteServer / headless e2e 檔 `beforeAll` 逾時，單獨重跑後再完整跑一次，兩次都回報）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；e2e t0592（需先 `npx vite build`）。e2e 只用隔離實例；不得以預設實例啟動 source build；不碰使用者正在用的 BAT（安裝版 `0.8.0-pre.1`）與其 userData / Terminal Server / `bat-pty-holder`；不跑 `t0859-pty-holder.spec.ts`；不開會耗 token 的 claude / codex turn。`TMP` 用系統預設（T0716）。程序清理照 D308。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 工具寫（L129）。收單前 `git -C \"$CT_WORKTREE\" status --porcelain` 必須為空。"
  - "🔴 公開 repo（D176）：回報區路徑用 repo 相對路徑或 `<使用者資料夾>`。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。"
---

# T0897 — claude 花費上限句型＋ t0592 穩定化

## 背景

T0891（內嵌 claude 2.1.331 / codex 0.172.0 追版）回報的兩個候選，使用者 2026-11-25 指示安排（D321）：

1. **claude 花費上限句型**：`You've hit your channel's monthly spend limit`、`usage credit limit` 等句型從 2.1.316 就存在，`src/lib/usage-limit.ts` 一直不認，撞到時 BAT 不會顯示限額提示。
2. **e2e t0592 不穩**：`lacking "shell"` 情境 6 次失敗 2 次；codex 升版必跑這份 spec（CLAUDE.md「BAT MCP shim」），不穩會讓之後每次追版都要重跑判讀。

本單等 T0896（合併 T0891 / T0893 / T0895 進 `v0.8.x`）完成後，從新的 `v0.8.x` 開分支（`usage-limit.ts` 在 T0891 有改動），與 T0898（BUG-218）並行；兩張完成後由一張合併工單一起併進 `v0.8.x` 並做發版前最後一次完整驗收（D322，取代 D321 的「塔台直接合併」），隨 `0.8.0-pre.2` 發佈。

## 驗收

- [ ] ① 新句型都有分類、測試、來源證據；既有句型與決策表不變
- [ ] ② t0592 根因說明＋穩定化；整份連續 5 次全綠
- [ ] `test:unit` 全綠、`vite build` exit 0、兩個 typecheck = 0
- [ ] 隔離分支證據


## 派工補記

- 2026-11-25T01:14:52+08:00：T0896 已合併進 `v0.8.x`；`ct/T0897` 從 `v0.8.x` = `7094b993b67313db8f3c6b058a33f483896ec5b4` 建立。`memory_overrides` 第 1 條的 merge-base 檢查值 = `7094b993b67313db8f3c6b058a33f483896ec5b4`。
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
- branch：`ct/T0897`
- base_sha：
- validated_sha：
- head_sha：
- validated_sha ≠ head_sha 的說明：

### 回報時間
