---
schema_version: 1
schema_kind: workorder
id: T0618
title: "探針：CT v5.7.0 `worker_question_timeout: 0`（不用 BAT 通道、直接 BLOCKED）+ ct-done 補結"
type: verification
status: IN_PROGRESS
repo: better-agent-terminal
project: PLAN-048
priority: P2
sizing: S
created_at: "2026-10-18T11:02:10+0800"
started_at: "2026-10-18T11:16:18+0800"
updated_at: "2026-10-18T11:16:18+0800"
depends_on: [T0617]
related:
  - "PLAN-048 / CT-T019：CT v5.7.0 × BAT 0.7.0-pre.8 統一實機驗收第 5 張（T0614–T0618）"
affects_files:
  - _ct-workorders/T0618-probe-ct570-timeout-zero-ct-done.md
renew_count: 0
workdir: main repo
worker_question_timeout: 0
tower_question: open
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: guided-probe
memory_overrides:
  - "🔴 本單的受測對象是你自己的 ct-exec v5.7.0 提問流程（`ct-exec` § Questions For Tower ＋ control-tower `references/yolo-mode.md` § Worker 向塔台提問）。`worker_question_timeout: 0` 是刻意設定，照 skill 對 `0` 的規則做。"
  - "🔴 Q-1 是刻意安排的受測提問：一定要向塔台提問（不得問使用者）。"
  - "🔴 不讀產品程式碼、不改任何其他檔案、不跑 build / test。`src/styles/settings.css` 的 M 不是你的變更。不 push。commit 用 `git commit --only <本檔>`。回報區不得出現權杖值。"
---

# T0618 — 探針：`worker_question_timeout: 0` + ct-done 補結

## 目標

1. `worker_question_timeout: 0` 時 Worker 不用 BAT 通道：送一般 `T0618 提問` 後直接走 § 備援（`BLOCKED` + commit + `需要協助`）。
2. 塔台不在題目下答覆，只在 Renew 區段答覆。
3. 塔台以 **ct-done** 補結本單（驗 ct-done 在 notify 前的 commit 只含工單檔）。

## Step 1 — 受測提問 Q-1（ct-exec）

依 skill 規則向塔台提問（Q-1，阻塞：是）：探針 Q-1（timeout 0），選項 [A] 收到 / [B] 沒收到。之後照 skill 對 `0` 的規則收尾。

回報區另寫 `### 驗收證據`：有沒有呼叫 `--ask`（預期沒有）；一般 `提問` 的送出時間；`BLOCKED` 工單 commit hash；`需要協助` 送出時間；先後順序。

## Step 2 — 塔台補結（ct-done，由塔台另行派工）

塔台在 `## 塔台補充（Renew #1）` 寫 `塔台答覆 Q-1`，然後派 **ct-done**。ct-done Worker 依 ct-done 規則補結，並在回報區記：
讀到 Renew 答覆與否、最終狀態、notify 前那次 commit 的 hash 與 `git show --stat` 檔案清單（預期只有本工單檔）、notify 前 `git status --short`。

---

## 回報區

### 待塔台決策

#### Q-1：探針 Q-1（timeout 0）
- 提問時間：2026-10-18T11:16:18+0800
- 選項：[A] 收到 / [B] 沒收到 / [C] 其他：________
- Worker 建議：[A]，因為本單為受測探針，任一答覆皆可；`worker_question_timeout: 0`，Worker 不等答覆、直接走 § 備援
- 影響範圍：Step 1 收尾（BLOCKED）/ Step 2（塔台 Renew + ct-done 補結）
- 阻塞：是（Step 1 收尾後由塔台 Renew 答覆）
