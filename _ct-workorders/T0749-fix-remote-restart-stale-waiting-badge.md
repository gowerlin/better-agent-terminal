---
schema_version: 1
schema_kind: workorder
id: T0749
title: "BUG-182 修正：遠端 bat-server 重啟並重連後，舊 PTY 已不存在的分頁要清掉等待 ⚠️ 與淡化"
type: implementation
status: PENDING
repo: better-agent-terminal
project: maintenance
priority: P2
sizing: S
created_at: "2026-11-01T20:50:17+0800"
depends_on: []
related:
  - "BUG-182（T0748 回報區〈發現的問題〉1）；T0748（`b0358c8a`，`e2e/v072-pre8-remote-workspace-waiting.spec.ts` ⑤ 目前以 INFO 記錄殘留）；T0735（D200–D203 工作區 ⚠️、淡化）；T0609（Worker 標籤 ⚠️ / `?`）"
  - "CLAUDE.md「Worker 分頁回收」節（T0735 段、T0609 段）、「多 remote profile 同時連線（PLAN-039）」、「Terminal Server 存活判定與 recovery」；`docs/agent-guide/worker-tab-recycle.md`（已知限制：遠端 server 重啟時舊分頁的標示）"
affects_files:
  - "src/stores/terminal-attention-store.ts（推測）"
  - "src/lib/terminal-attention.ts（推測；`waitingForUser` / `nextWaitMemory` 唯一實作）"
  - "electron/terminal-attention.ts / electron/remote/remote-connection-registry.ts / electron/remote/remote-client.ts / electron/main.ts（推測：重連時的對帳或快照）"
  - "e2e/v072-pre8-remote-workspace-waiting.spec.ts（⑤ 由 INFO 改為斷言）"
  - "對應的 unit test（新增或擴充）"
  - docs/agent-guide/worker-tab-recycle.md
  - "CLAUDE.md（「Worker 分頁回收」節只補一句：唯一實作位置）"
  - _ct-workorders/T0749-fix-remote-restart-stale-waiting-badge.md
  - _ct-workorders/BUG-182-remote-server-restart-stale-waiting-badge.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: context-dependent
memory_overrides:
  - "🔴 目標（BUG-182）：遠端 profile 視窗的分頁在等待中（hook 或 OSC），遠端 bat-server 重啟、視窗重連後，該分頁在 server 端已沒有 PTY → 工作區列、頁籤標題總數、收合窄列、縮圖、Worker 標籤的實心 ⚠️ 都要清除；總數不再多算。重連後 server 端仍有 PTY 且仍在等待的分頁 → ⚠️ 保留（不得一律清空）。先查清楚現況再決定做法：重連時 renderer / main 是否重新取得 attention 快照、server 重啟後分頁沒有 PTY 是否符合預期（本單只需記錄，不改 PTY 重建行為）。做法候選：重連時依 server 端現存 PTY 對帳（不存在的 id 清 attention），或以 server 回報的 attention 快照取代該 profile 的舊狀態。🔴 判斷依據只能是 server 端的現況（PTY 是否存在 / attention），不得用主行程或遠端主機時間比對（沿用 T0694 規則）。"
  - "🔴 淡化（D203）：被對帳清除的等待算不算『使用者沒看就結束』要寫明選擇並記理由；建議：PTY 已消失 = 等待被中斷，比照 PTY 結束事件的既有處理（現在 PTY 結束時怎麼做就怎麼做，不新增規則）。"
  - "🔴 不回歸（R-G003 已驗收案例）：T0735 / T0736 / T0747 / T0748 的情境 ①–④ 與本機分頁行為不變；Worker 分頁 `✓` / `↻` / `?` / 批次關閉計數（T0538 / T0609 / T0694）不變；本機 Terminal Server recovery（T0704）不受影響；detached 視窗不涵蓋（D201）。回報區必列〈相關通過案例〉判定。"
  - "🔴 驗證：unit test 涵蓋：重連後 PTY 不存在 → 清除、PTY 存在且仍等待 → 保留、多 profile 互不影響；`e2e/v072-pre8-remote-workspace-waiting.spec.ts` ⑤ 改為斷言（重連後 ⚠️ 清除、總數正確），連跑 2 次綠，並以未修正的程式（例如暫時還原修正）確認 ⑤ 會失敗（突變檢查，結果寫回報區，還原後再 commit）；重跑 `t0735-workspace-waiting-badge`、`v072-pre8-workspace-waiting-real-agents`、`t0609-worker-attention-badge`、`t0694`（↻）相關 spec 綠。`npm run test:unit` 全過、`npm run typecheck` = 0、`npm run typecheck:electron` = 0、`npx vite build` 成功。WSL 測試做法沿用 T0748（`/tmp/bat-e2e-t07xx`、不經 systemd、不動使用者的 WSL bat-server，前後比對；WSL 未執行就 skip，不由測試啟動 WSL）。"
  - "🔴 文件：`docs/agent-guide/worker-tab-recycle.md` 已知限制改寫為修正後的行為；CLAUDE.md「Worker 分頁回收」節只補一句（唯一實作位置），細節寫 docs。完成後 BUG-182 改 FIXED（附 commit）。不發版、不改 CHANGELOG、不 push。公開 repo：依 `_local-rules.md`「公開 repo 去識別化（D176）」，回報與 spec 不得出現使用者家目錄路徑、WSL 使用者名稱或帳號。"
  - "🔴 範圍：只修 BUG-182；發現其他缺陷記在回報區〈發現的問題〉，由塔台開單。真正的網路中斷（server 仍在）若同一修正自然涵蓋就順便驗，否則記錄不做。"
  - "🔴 yolo：不得問使用者；判讀問題依 ct-exec § Questions For Tower 問塔台（每輪最多 3 題）。Git：只用 `git commit --only` commit 自己改的檔案。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）。"
---

# T0749 — BUG-182 修正：遠端 server 重啟後殘留的等待 ⚠️

## 元資料

- **工單編號**：T0749
- **類型**：implementation（bug fix）
- **優先級**：P2
- **建立時間**：2026-11-01T20:50:17+0800
- **預估規模**：S

## 背景

T0748 驗收 WSL 遠端工作區 ⚠️ 時發現：遠端 bat-server 重啟、視窗重連後，等待中的分頁在 server 端已沒有 PTY，但 ⚠️ 一直留著，看過、送 idle 都清不掉，總數多算 1，只有 ⏻ 重啟分頁才消失。docs 的已知限制假設「下一次變更」會來，實際上不會。使用者指示現在修。

## 範圍

1. 查清重連時 attention 的來源與現況，選定對帳做法並實作。
2. unit test、e2e ⑤ 改為斷言（含突變檢查）。
3. docs / CLAUDE.md 一句；BUG-182 → FIXED。

## 不做

- 不改 server 重啟後 PTY 是否重建的行為（只記錄現況）。
- 不做本機視窗顯示遠端工作區（另案）、不涵蓋 detached 視窗。

## 驗收

- [ ] 重連後 PTY 不存在 → ⚠️ 與總數清除；仍存在且等待 → 保留
- [ ] 淡化處理的選擇與理由
- [ ] unit / e2e（⑤ 連跑 2 次＋突變檢查）/ 相關 spec / typecheck 0 / 0 / build
- [ ] 〈相關通過案例〉判定、使用者 WSL 前後比對與清理
- [ ] BUG-182 → FIXED

---

## 回報區

（Worker 填寫）
