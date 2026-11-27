---
schema_version: 1
schema_kind: workorder
id: T0940
title: "BUG-227：契約 2 塔台在 claude 的單鍵介面（意見調查列等）按數字鍵後不再被判成有草稿；待辦分頁回答不再卡在「📨 待送」"
type: bugfix
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-068
priority: P2
sizing: S
created_at: "2026-11-27T14:15:21+08:00"
started_at: "2026-11-27T14:16:50+08:00"
updated_at: "2026-11-27T14:16:50+08:00"
session_ids:
  - "d4db5adb-584b-4094-a95f-a7b5358a32f4"
target_version: "0.8.0-pre.9"
depends_on: []
related:
  - "BUG-227；D406；T0904（`draft` 保留，PLAN-068 W1＋W2）；T0939（發現，`ct620-accept/results-630/M-3.md` 與 S1-logs 有實錄）"
affects_files:
  - _ct-workorders/T0940-tower-draft-single-key-prompts.md
  - src/lib/tower-input-draft.ts
  - src/lib/__tests__/
  - electron/notify-hold.ts
  - electron/__tests__/
  - docs/agent-guide/tower-inbox.md
  - docs/agent-guide/notify-hold.md
  - CLAUDE.md
  - e2e/manual/README.md
renew_count: 0
isolation: worktree
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 分支：只在 `ct/T0940` 寫檔（base = 派工當下的 `main`）。不 merge / rebase / push、不動 `main`。主 checkout 只寫本工單檔（`git -C \"$CT_HOME\" commit --only _ct-workorders/<本檔>`）。"
  - "🔴 先查證再改：① 重現與原因——T0939 實錄在 `<使用者資料夾>/AppData/Local/ct620-accept/results-630/M-3.md`、`S1-logs/`（PTY 全文、debug log 的 `[notify-hold] held … reason=draft`；只讀，不改、不複製進 repo，D176）；確認 claude 意見調查列（「How is Claude doing this session? … 0: Dismiss」）以單鍵作答、輸入框其實是空的。② 盤點 claude CLI（內嵌 `@anthropic-ai/claude-code` 版本）還有哪些「按一個鍵就作答、不進輸入框」的介面（例：數字選項的確認列、`y/n` 提示），列在回報區。③ 提出修法（建議至少比較兩案），寫在回報區〈設計〉；如果需要擴大到讀 PTY 輸出或新增協定，先問塔台。"
  - "🔴 修法方向（塔台建議，Worker 可依查證調整，偏離時問塔台）：草稿判斷仍是唯一實作 `trackDraft`（`src/lib/tower-input-draft.ts`）＋ `NotifyHoldController`（`electron/notify-hold.ts`）；例：host 已在看該分頁的 PTY 輸出（只讀，不改寫），在 claude 顯示單鍵介面時，緊接的單一可列印鍵不算草稿；或單鍵介面消失、輸入框重繪成空提示時清除草稿。🔴 不得改 BAT 寫進 PTY 的內容、不得替使用者送鍵；判斷要保守——判不出來就維持現行（寧可多保留，不可把通知混進使用者打到一半的字）。"
  - "🔴 不回歸：T0904 / T0917 既有行為與測試斷言不改（一般打字、貼上、↑ / ↓、Enter / Ctrl+C 清除、Esc、滑鼠、`reading` 保留、「立即送出」）；只在契約 2 塔台分頁生效（`towerContractStatus` `match`），其他分頁與 T0566 / T0788 路徑逐字不變；`notify-hold.test.ts` 既有斷言不改（必然衝突就問塔台）。"
  - "🔴 測試：純函式與 controller 單元測試——意見調查列出現後按 `0`（及其他單鍵）→ 不保留；一般輸入框打字 → 照舊保留；判不出時 → 照舊保留。若改動 PTY 輸出判讀，以 T0939 實錄的序列（自行改寫成去識別化的最小樣本）當 fixture。"
  - "🔴 驗證：worktree `npm ci`；`npm run test:unit` 在 head 第一次完整執行全綠（附數字）；`npx vite build` exit 0；`npm run typecheck` = 0、`npm run typecheck:electron` = 0。實機以隔離實例（`e2e/manual/` 驅動，T0939 做法）重現一次修正前後，或寫〈待實機〉；不碰安裝版 BAT；若要開 claude 回合，只開最少的 1 個，碰到用量上限就停。"
  - "🔴 文件：`docs/agent-guide/notify-hold.md` / `tower-inbox.md`「通知保護」`draft` 規則補一段（T0940）；CLAUDE.md「塔台等使用者回答時保留 Worker 通知」節對應一點視需要補一句（小節標題不改名，T0595）；`e2e/manual/README.md`〈已知限制〉那條（T0939）改寫或移除。"
  - "🔴 Git：worktree 用 `git add <明確路徑>`；不 push、不觸發 workflow、不建 tag。禁止 `git stash`（含 list）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）；維持 LF；含反斜線的內容用 Write／Edit 寫（L129）。收單前 worktree `status --porcelain` 為空。"
  - "🔴 公開 repo（D176）：程式、註解、測試資料、回報區不寫真名、客戶名、外部專案名、主機名、IP、家目錄路徑（寫 `<使用者資料夾>`）。yolo：不得問使用者，判讀問題依 ct-exec § Questions For Tower 問塔台。工單狀態寫 `DONE`（`FIXED` 是 BUG 用的，L177）。"
---

# T0940 — 單鍵介面不算草稿（BUG-227）

## 背景

BUG-227（T0939 S1 M-3 發現）：契約 2 塔台分頁出現 claude 的意見調查列時，用數字鍵 `0` 關掉後，BAT 的草稿判斷（T0904 `trackDraft`）仍把那一鍵當成輸入框有字；下一則待辦分頁回答以 `reason=draft` 排進「📨 待送」，直到使用者在空輸入框按一次 Enter 才送出。回答不遺失、有提示，但使用者不知道要按 Enter。使用者 2026-11-27 指示開 BUG，並在 CT 判定（CT D913：BAT 端 0 項要改）回來後開修正單（D406）。

## 範圍

- 查證原因、盤點同類單鍵介面、比較修法。
- 修正：單鍵介面的作答鍵不算草稿（或介面結束時清除），判不出時照舊保守保留。
- 不回歸 T0904 / T0917 / T0788 / T0566。

## 驗收

- [ ] 回報區〈查證〉〈盤點〉〈設計〉
- [ ] 意見調查列按數字鍵後，待辦分頁回答立即送出；一般打字照舊保留
- [ ] 既有 notify-hold / tower-input-draft 測試斷言不改、全過；新增測試
- [ ] `npm run test:unit` head 第一次全綠；`npx vite build` exit 0；兩個 typecheck = 0
- [ ] 隔離實例重現修正前後，或〈待實機〉步驟
- [ ] 文件

---

## 回報區

（Worker 填寫）
