---
schema_version: 1
schema_kind: workorder
id: T0838
title: "PLAN-043 W1：INI 逐行編輯器（`.wslconfig` / `/etc/wsl.conf` 共用，純函式）＋備份檔名規則；`KNOWN_NETWORK_MODES` 補 `consomme`"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P3
sizing: S
created_at: "2026-11-04T09:17:09+0800"
started_at: ""
updated_at: "2026-11-04T09:17:09+0800"
completed_at: ""
session_ids: []
depends_on: []
related:
  - "PLAN-043 Phase 2；D272；T0831 回報區（〈建議下一步〉W1、〈調查結論〉2 P-2 / P-5、5 測試策略）"
affects_files:
  - _ct-workorders/T0838-wsl-ini-line-editor.md
  - electron/ini-line-editor.ts
  - electron/wsl-detect.ts
  - electron/__tests__/
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 純函式模組（不 import electron、不讀寫檔）：輸入文字＋要設定的 section / key / value，輸出新文字；只改目標行，其他行（含註解、空行、未知 key、順序）原樣保留。解析失敗回明確結果（呼叫端不得寫入）。本單不接進任何流程（W3 / W4 才用）。"
  - "🔴 `wsl-detect.ts` 只補 `KNOWN_NETWORK_MODES` 的 `consomme`（`virtioproxy` 保留相容），其他偵測行為不變。"
  - "🔴 yolo：不得問使用者；問題問塔台。不發版、不 push。Git：只 commit 本單範圍（`git add <明確路徑>`）。禁止 `git stash`（含 `git stash list`）/ `git reset` / `git checkout -- <path>` / `git restore`（L138）。其他 Worker 同時在 main 執行。"
---

# T0838 — PLAN-043 W1：INI 逐行編輯器

## 元資料
- **工單編號**：T0838｜**類型**：implementation｜**狀態**：PENDING｜**建立**：2026-11-04 09:17 (UTC+8)
- **規模**：S｜可與其他工單並行（不碰共用檔）

## 任務指令
1. 讀 `_ct-workorders/T0831-research-wsl-phase2-3.md` 回報區（W1 與測試策略）。
2. `electron/ini-line-editor.ts`：`setIniValue(text, section, key, value)` 一類 API；處理 CRLF / LF（保留原換行）、UTF-8 BOM、UTF-16（`.wslconfig` 可能是 UTF-16 LE：偵測並回報編碼，寫回時保持）、`#` / `;` 註解、section / key 大小寫（WSL 的規則寫進註解與測試）、重複 key（改最後一個或全部，依 WSL 行為決定並說明）、缺 section 時新增在檔尾、key 不存在時加在該 section 最後。
3. 備份檔名規則：`<原檔名>.bat-backup-<YYYYMMDD-HHMMSS>`（時間由呼叫端傳入，模組內不取時鐘）。
4. `KNOWN_NETWORK_MODES` 補 `consomme`。
5. 單元測試覆蓋上述情況；`npm run typecheck:electron` = 0、`npm run test:unit` 全過。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯（唯一例外：`### 待塔台決策` 的 `塔台答覆 Q-n` 行由塔台新增）

### 完成狀態

### 產出摘要

### 互動紀錄

### 遭遇問題

### 回報時間
