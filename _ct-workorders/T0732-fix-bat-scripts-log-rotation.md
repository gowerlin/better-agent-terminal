---
schema_version: 1
schema_kind: workorder
id: T0732
title: "BUG-179：`bat-scripts.log` 啟動時輪替（> 10 MB 改名帶時間戳、保留 3 份；本機主行程與 headless bat-server）"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T12:25:49+0800"
started_at: ""
updated_at: "2026-11-01T12:25:49+0800"
completed_at: ""
depends_on: [T0730]
related:
  - "BUG-179；D198（規格）；T0731 回報區 Q-B3 與〈發現的問題〉1"
  - "T0192 / T0193（原本明訂先不輪替）；CLAUDE.md「Logging」（單一 userData、import 期不得取 `app.getPath('userData')`）"
  - "既有範本：debug log 保留最近 10 個（`electron/logger.ts` `MAX_LOG_FILES`）"
affects_files:
  - electron/remote/remote-logger.ts
  - electron/main.ts
  - electron/remote/headless-entry.ts
  - "electron/ 下新增的輪替模組（若抽出，位置由你決定）"
  - "electron/__tests__/ 或 electron/remote/__tests__/（輪替測試）"
  - CLAUDE.md
  - docs/agent-guide/logging.md
  - _ct-workorders/BUG-179-bat-scripts-log-unbounded-growth.md
  - _ct-workorders/T0732-fix-bat-scripts-log-rotation.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 規格（D198，不得自行更改）：本機主行程啟動時、headless bat-server 啟動時，各自檢查自己寫的 `bat-scripts.log`（本機在 `<userData>/Logs/`；headless 依 `BAT_HELPER_LOG_DIR` / 既有解析）；大小 > 10 MB（10 × 1024 × 1024 bytes）就改名為 `bat-scripts-<YYYYMMDD-HHMMSS>.log`（時間戳取執行當下的本機時間），之後只保留最近 3 份舊檔（依檔名時間戳排序，刪最舊的）。改名或刪除失敗（Windows `EBUSY` / `EPERM` 等）一律靜默略過、記一行到 debug log、下次啟動再試，不得丟例外或影響啟動。"
  - "🔴 不變：helper 端 `scripts/_bat-logger.mjs` 的寫入規則、檔名、欄位不變（舊 helper 照樣 append 到新的空檔）；`report-hook` 雙寫不調整；日誌寫入失敗不影響業務的既有政策不變。輪替只在啟動時做一次，不在 append 路徑加檢查。"
  - "🔴 CLAUDE.md「Logging」規則：任何模組不得在 import 期呼叫 `app.getPath('userData')`；`app-paths-bootstrap` 的 import 限制不得被破壞（`electron/__tests__/app-paths-bootstrap-order.test.ts`）。輪替呼叫放在 `logger.init` 之後、第一個寫 `bat-scripts.log` 的動作之前；說明你選的位置。"
  - "🔴 驗證：單元測試涵蓋 ≤ 10 MB 不動、> 10 MB 改名、保留 3 份刪最舊、改名失敗不丟例外、檔案不存在、headless 路徑。`npm run test:unit` 全過；`npm run test:legacy` 全過；`npm run typecheck` = 0；`npm run typecheck:electron` = 0；`npx vite build` 成功。不得對使用者真實的 `bat-scripts.log` 做輪替測試（用 temp 目錄）；不得以預設實例啟動 source build。"
  - "🔴 CLAUDE.md「Logging」補一行（輪替規則與唯一實作位置），細節寫 `docs/agent-guide/logging.md`，遵守檔頭撰寫規則。BUG-179 修好後由你改 `FIXED`（附 commit 與驗證摘要）；`_bug-tracker.md` 由塔台重建，不要改。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」。測試失敗輸出不得傾印整個 `process.env`。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0732 — BUG-179：`bat-scripts.log` 啟動時輪替

## 元資料

- **工單編號**：T0732
- **類型**：implementation
- **優先級**：P2
- **建立時間**：2026-11-01T12:25:49+0800
- **預估規模**：S

## 背景

T0731 查證 `bat-scripts.log` 從不輪替（本機 41.6 MB，10 月單月 35.6 MB）。使用者決定現在修、規格由塔台訂（D198）：啟動時 > 10 MB 輪替、保留 3 份。

## 範圍

1. 主行程與 headless bat-server 啟動時輪替。
2. 單元測試。
3. CLAUDE.md 一行、docs；BUG-179 改 FIXED。

## 不做

- 不改 helper 寫入、不減少 `report-hook` 雙寫。
- 不改 debug log 的保留規則。

## 驗收

- [ ] 輪替規則與 D198 一致（含失敗容錯）
- [ ] `test:unit` / `test:legacy` 全過、兩個 typecheck = 0、`vite build` 成功
- [ ] BUG-179 = FIXED

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

### 互動紀錄

### 回報時間
