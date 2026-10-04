---
schema_version: 1
schema_kind: workorder
id: T0419
title: "BUG-096：App.tsx initProfile 的 remote.connect 帶 fingerprint，或 main 重用已 pin 驗證的 client，不再以未驗證連線取代"
type: fix
status: PENDING
repo: better-agent-terminal
project: BUG-096
priority: P1
sizing: S
created_at: "2026-10-05T05:35:22+08:00"
started_at: null
updated_at: "2026-10-05T05:35:22+08:00"
completed_at: null
target_version: next
depends_on: []
related:
  - "BUG-096；T0385 / T0386；CLAUDE.md「Remote 資安」節（TOFU fingerprint pinning）"
  - "D134（本 session 排程表第 3 列）"
affects_files:
  - src/App.tsx
  - electron/main.ts
  - src/__tests__/
  - electron/__tests__/
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
renew_count: 0
workdir: main repo
memory_overrides:
  - "🔴 **先確認現況**：以程式碼證據回答 (a) `loadProfileSnapshotDetailed` 建立的 client 與 renderer `remote:connect` 建立的 client 是否同一個 `remoteClient` 槽位、後者是否真的取代前者；(b) 無 fingerprint 的 legacy profile 在 main 端目前怎麼處理；(c) 首次 TOFU（profile 尚無 `remoteFingerprint`）的流程走哪條路。若結論是取代不會發生，回報區附證據、只補防回歸測試即可 DONE。"
  - "🔴 修法偏好：**main 端重用已驗證且仍連線中的同目標 client**（host / port / token 一致即不重建），renderer 端同時傳 profile 的 `remoteFingerprint` 作為第二道防線。不得破壞首次 TOFU 寫入 fingerprint 的流程；與 main 現行 legacy 拒絕規則保持一致，不要另訂新規則。"
  - "🔴 同工作樹有其他 Worker 平行（T0417 / T0418 / 研究單）。`electron/main.ts` 只改 `remote:connect` 相關區段。**只跑 `npm run test:unit` + `npx tsc --noEmit`；不跑 `npx vite build` / `npm run test:e2e`**（L141）。"
  - "🔴 **禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`**（L138）；`git commit --only`；不 push；不部署 WSL。"
---

# T0419 — renderer 遠端重連不帶 fingerprint（BUG-096）

## 背景

- `src/App.tsx` initProfile 呼叫 `window.electronAPI.remote.connect(host, port, token)`，未傳 profile 的 `remoteFingerprint`
- `electron/main.ts` `remote:connect` handler 支援第 5 參數 `fingerprint`（目前約 `:2505`）
- `loadProfileSnapshotDetailed`（`electron/main.ts`）已用 pin 過的 fingerprint 建立 client；renderer 再 connect 可能以未 pin 驗證的新 client 取代

## 範圍

1. 現況確認（memory_overrides 第 1 條）
2. 依偏好修法實作
3. 測試：同目標重連不重建 client；renderer 傳入 fingerprint；fingerprint 不符時拒絕；首次 TOFU 不受影響
4. 回報區附使用者實機步驟（開遠端 profile 視窗 → 關閉重開 → 連線正常、log 無重建 client）

## 驗收條件

- [ ] 回報區附現況結論（程式碼證據）
- [ ] `npm run test:unit` 全綠（基線 1867）；`npx tsc --noEmit` ≤ 40
- [ ] 回報區附實機步驟

## Sub-session 執行指示
1. 讀本工單 + BUG-096 + CLAUDE.md「Remote 資安」節
2. 填 `started_at`、`status: IN_PROGRESS`（`date "+%Y-%m-%dT%H:%M:%S%z"`，R-G001）
3. 現況確認 → 實作 → 驗收
4. 填回報區；完成寫 **`DONE`**；BUG-096 改 `FIXED` 並填 `links.fix_workorder: T0419`
5. `git commit --only` 實際改動檔 + 本工單 + BUG-096；不 push
6. 依派發 mode 通知塔台

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 產出摘要

### 遭遇問題

### 回報時間
