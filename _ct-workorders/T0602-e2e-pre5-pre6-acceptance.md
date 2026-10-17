---
schema_version: 1
schema_kind: workorder
id: T0602
title: "驗證：pre.5 / pre.6 修正的隔離實例 e2e（t0590 / t0598 / t0599 / t0600）"
type: verification
status: TODO
repo: better-agent-terminal
project: PLAN-047
priority: P1
sizing: S
created_at: "2026-10-18T04:13:45+0800"
started_at: ""
updated_at: "2026-10-18T04:13:45+0800"
completed_at: ""
depends_on: [T0597, T0598, T0599, T0600]
related:
  - "BUG-150 / BUG-151 / BUG-152（FIXED，等實機）；T0601（同批，安裝版探針）"
affects_files:
  - _ct-workorders/T0602-e2e-pre5-pre6-acceptance.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 驗證單：**不改任何產品程式碼、測試、CLAUDE.md、docs**；只寫本工單回報區並 commit 本檔（`git commit --only <本檔>`）。不 push、不觸發 workflow、不建 tag；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。`src/styles/settings.css` 的 M 不是你的變更。"
  - "🔴 e2e 失敗時**不修**：記錄失敗的 spec、測試名稱、錯誤訊息前 30 行與 `test-results/` 內的附件路徑，判斷是產品回歸、環境問題還是測試本身不穩，回報 PARTIAL / FAILED 交塔台決定。同一 spec 失敗最多重跑 1 次，用來分辨不穩定。"
  - "🔴 只跑隔離實例（spec 內的 `launchIsolated`）；不得對使用者正在用的 BAT 視窗或安裝版做任何操作，不得關閉或結束任何 BAT / electron 程序以外於 playwright 自己啟動的實例。"
---

# T0602 — 驗證：pre.5 / pre.6 修正的隔離實例 e2e

## 背景

`v0.7.0-pre.5` / `pre.6` 的四項修正各自有 e2e，但只在各自工單跑過一次。本單在 `main` @ `bae3c278`（內容與 pre.6 相同，之後只有 `(ct)` 文件 commit）一次跑完，補上安裝版難以自動驗的「派工時在塔台打字」「畫面不跳」兩項。

| spec | 對應 |
|---|---|
| `e2e/t0590-blocked-state.spec.ts` | BUG-150：AskUserQuestion → `question`（T0597 修改的 3b 段） |
| `e2e/t0598-dispatch-input-before-command.spec.ts` | BUG-151：派工前打的字不接在指令前 |
| `e2e/t0599-dispatch-no-focus-steal.spec.ts` | BUG-152：派工分頁不搶焦點、字留在塔台 |
| `e2e/t0600-launch-confirmation.spec.ts` | T0600：`--wait-started` / exit 8 / `agentStarted` |

注意：這是**原始碼建置的隔離實例**，不是安裝檔；回報時請標明 lane。

## 步驟

1. 讀本工單、標 `IN_PROGRESS`。
2. `npx vite build`（必須成功）。
3. `npx playwright test e2e/t0590-blocked-state.spec.ts e2e/t0598-dispatch-input-before-command.spec.ts e2e/t0599-dispatch-no-focus-steal.spec.ts e2e/t0600-launch-confirmation.spec.ts`（`--reporter=list`）。
4. 有失敗依 memory_overrides 處理。
5. 回報區填：HEAD hash、vite build 結果、每個 spec 的 passed / failed / skipped 數與耗時、skipped 的原因、失敗細節（若有）。commit 本檔，依 ct-exec 流程通知塔台。

## 驗收

- 四個 spec 全部 passed（skipped 須說明原因）→ DONE；否則 PARTIAL / FAILED。
- 只 commit 本工單檔。

---

## 回報區

### 待塔台決策（僅 yolo Worker 有問題時）

### 完成狀態

### 產出摘要

### 互動紀錄

### 遭遇問題

### 回報時間
