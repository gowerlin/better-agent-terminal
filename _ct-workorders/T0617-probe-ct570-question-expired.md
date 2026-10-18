---
schema_version: 1
schema_kind: workorder
id: T0617
title: "探針：CT v5.7.0 BAT 題目逾時 `expired` → BLOCKED → Renew"
type: verification
status: PENDING
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S
created_at: "2026-10-18T11:02:10+0800"
depends_on: [T0616]
related:
  - "PLAN-048 / CT-T019：CT v5.7.0 × BAT 0.7.0-pre.8 統一實機驗收第 4 張（T0614–T0618）"
affects_files:
  - _ct-workorders/T0617-probe-ct570-question-expired.md
renew_count: 0
workdir: main repo
worker_question_timeout: 1
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單的受測對象是你自己的 ct-exec v5.7.0 提問流程（`ct-exec` § Questions For Tower ＋ control-tower `references/yolo-mode.md` § Worker 向塔台提問 › § 備援）。照 skill 規則做，不要自己發明替代流程。"
  - "🔴 本單 `worker_question_timeout: 1` 是刻意設定；塔台**刻意不答** Q-1，讓題目逾時。照 skill 的 `expired` 規則收尾，不要延長等待、不要重送題目。"
  - "🔴 Q-1 是刻意安排的受測提問：一定要向塔台提問（不得問使用者）。"
  - "🔴 不讀產品程式碼、不改任何其他檔案、不跑 build / test。`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 用 `git commit --only <本檔>`。題目內容只走 stdin，暫存檔不得寫進 repo；回報區不得出現權杖值。"
---

# T0617 — 探針：BAT 題目逾時

## 目標

驗證 BAT 題目 `expired` 時 Worker 走 § 備援（`BLOCKED` + commit + `需要協助`），以及塔台在 Renew 區段答覆、重派後 Worker 讀到 Renew 答覆完成。

## Step 1 — 受測提問 Q-1

依 skill 規則向塔台提問（Q-1，阻塞：是）：探針 Q-1（逾時），選項 [A] 收到 / [B] 沒收到。
`--expires-min` 依 skill 取生效的 `worker_question_timeout`（本單 frontmatter = 1）。

## Step 2 — 等待與逾時

依 skill 等待。預期約 1 分鐘後 BAT 回 `expired`（或你的總等待上限先到）。記下每次等待呼叫的時間、最後的 `status` / `endReason`，然後照 § 備援收尾：
回報區照常填、`### 待塔台決策` 原樣保留、`tower_question: open` 保留 → `BLOCKED` → commit 工單 → （還有在等的 BAT 題目才取消）→ 送 `T0617 需要協助`。

## Step 3 — 重派後（Renew #1）

塔台會在 `## 塔台補充（Renew #1）` 寫 `塔台答覆 Q-1` 並重新派工。重派的 Worker 讀到 Renew 答覆 → 記入互動紀錄、刪 `tower_question` → 完成狀態 DONE → commit → 送 `T0617 完成`。

## 回報區另寫 `### 驗收證據`

- 第一輪：`--ask` 參數（不含題目內容）、exit code、id、`--expires-min` 值；每次等待呼叫時間；最終 `status` / `endReason`；`BLOCKED` 工單 commit hash；`需要協助` 送出時間；兩者先後
- 第二輪：讀到 Renew 答覆的時間與比對方式（是否只在 Renew 區段內比對）；互動紀錄寫法；最終 commit hash

## 驗收條件

- 第一輪以 `BLOCKED` + `需要協助` 收尾，工單 commit 在 notify 之前
- 第二輪讀到 Renew 答覆並 DONE

---

## 回報區

（Worker 填寫）
