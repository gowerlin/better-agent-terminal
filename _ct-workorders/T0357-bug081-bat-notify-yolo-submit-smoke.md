---
schema_version: 1
schema_kind: workorder
id: T0357
title: BUG-081 BAT yolo submit smoke after 250ms delay patch
type: verify
status: CLOSED
sizing: XS
created_at: "2026-05-17T16:05:00+08:00"
started_at: "2026-05-17T16:02:17+08:00"
completed_at: "2026-05-17T16:04:06+08:00"
closed_at: "2026-05-17T16:10:00+08:00"
updated_at: "2026-05-17T16:10:00+08:00"
commit: 8c802c3
verified_by: tower runtime smoke; auto-submit observed with trace c79021255a18868c
workdir: main repo
affects_files:
  - _ct-workorders/T0357-bug081-bat-notify-yolo-submit-smoke.md
  - C:\Program Files\BetterAgentTerminal\resources\scripts\bat-notify.mjs
---
# T0357 - BUG-081 BAT yolo submit smoke

## Goal

Verify the installed BAT `bat-notify.mjs` 250ms submit delay patch through a real yolo Worker closeout.

## Scope

- Do not modify source code.
- Do not commit.
- Do not push.
- Only update this workorder if the normal `ct-exec` lifecycle requires started/completed metadata.

## Task

1. Confirm this is a smoke-only workorder for BUG-081.
2. Complete the workorder normally.
3. Let the normal BAT Worker closeout path notify the tower with `bat-notify --submit`.

## Acceptance

Tower receives the Worker completion message through the yolo closeout path.

If the submit path is still not automatic, the tower operator will annotate the received message manually.

---

（以下為 Worker 回報區）

## Worker 回報

### 完成狀態

DONE

### 產出摘要

- 確認本工單為 BUG-081 smoke-only verify 工單。
- 未修改 source code；僅更新本工單 lifecycle metadata 與回報區。
- 已確認安裝版 `C:\Program Files\BetterAgentTerminal\resources\scripts\bat-notify.mjs` 存在。
- YOLO closeout 將透過 Step 8.5 執行 `bat-notify.mjs --submit "T0357 完成"`，作為本工單的真實 smoke。

### 驗證結果

- source/test/build：不適用，本工單範圍禁止 source 變更且只驗證 BAT yolo closeout path。
- commit/push：不適用，本工單明確禁止 commit / push。
- Tower receipt：由 Step 8.5 `bat-notify --submit` 實際送出後，由塔台端觀察是否自動 submit。

### 遭遇問題

無。

### 互動紀錄

無。

### Renew 歷程

無。

### sprint-status.yaml

不適用。根目錄檔案存在，但內容為舊里程碑摘要，未涵蓋 T0357 / BUG-081，未修改。

### 回報時間

2026-05-17T16:04:06+08:00

### commit

不適用（工單範圍明確禁止 commit）。

---

## Tower 驗收

### 結論

PASS - 塔台收到 `T0357 完成`，使用者未加註「非自動」，視為 yolo closeout auto-submit 成功。

### Runtime evidence

- `bat-scripts.log`
  - `2026-05-17T08:03:57.902Z` `terminal:notify` target `418c4016-b45e-464c-a5c1-37d04415787d` source `T0357`
  - `2026-05-17T08:03:58.157Z` `terminal:keypress` Enter trace `c79021255a18868c`
- renderer debug log
  - `remote Enter received` trace `c79021255a18868c`
  - `xterm onData` controls `CR`
  - `remote Enter dispatched` controls `CR`
- notify to keypress gap: approximately 255ms, matching the installed 250ms delay patch.
