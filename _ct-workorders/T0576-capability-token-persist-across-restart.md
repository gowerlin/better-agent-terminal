---
schema_version: 1
schema_kind: workorder
id: T0576
title: "PLAN-047 A2：本機範圍權杖跨 BAT 重開持久化（Terminal Server 存活 / T0108 replay）＋升級相容"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-047
priority: P1
sizing: M
created_at: "2026-10-17T19:04:59+0800"
target_version: "與 T0575（A1）同版發佈（D149）"
depends_on: [T0575]
related:
  - "T0575（A1，本單的前置；其回報區有「BAT 重開 + Terminal Server 存活」實測現象）"
  - "T0574 回報區 R3 缺口 2"
  - "T0108（Terminal Server replay）、T0537（已存 Worker 歸屬）、T0565（role / mode 不持久化的已知限制）"
affects_files:
  - electron/remote/helper-capability.ts
  - electron/main.ts
  - electron/pty-manager.ts
  - "electron/__tests__/**（新增權杖持久化 / replay 還原測試）"
  - "e2e/t0576-capability-persist-restart.spec.ts（新增）"
  - "CLAUDE.md（遠端 Tower 通知節的權杖生命週期、單一 userData 目錄清單）"
  - _ct-workorders/T0576-capability-token-persist-across-restart.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write 工具（L129）。commit 用 `git commit --only <你改的檔>`。"
  - "🔴 不碰使用者正在用的 BAT（port 9876）與它的 Terminal Server；實測一律用隔離實例（需先 `npx vite build`）。"
  - "🔴 **不得把 token 明文寫入任何檔案或日誌**；只能存 SHA-256 digest 與綁定欄位。遠端 headless 的生命週期（server 重啟全失效）不變。"
  - "🔴 開工前確認 T0575 已 DONE / FIXED 並已 commit；未完成 → 回報 BLOCKED，不要自己做 A1 的部分。"
---

# T0576 — PLAN-047 A2：範圍權杖跨 BAT 重開持久化

## 背景

T0575（A1）後，本機 PTY 的 `BAT_REMOTE_TOKEN` 是只存在記憶體的 `batcap.` 權杖。Windows 預設 Terminal Server 模式下，BAT 關閉但 Terminal Server 存活（quit 未勾停止）時，PTY 與其 env 保留；BAT 重開後 registry 是空的，這些分頁的 helper 全部 `Authentication failed`，CT auto-session 中斷（T0574 R3 缺口 2）。T0575 之前因 server token 有持久化而照常可用 → 這是 A1 引入的回歸，必須同版修正。

## 任務

1. **持久化**：`HelperCapabilityRegistry` 的簽發紀錄（digest、terminalId、role、towerId、issuedAt）寫入 userData 下的檔案（名稱自訂，例如 `helper-capabilities.json`；`app.getPath('userData')` 一律 lazy 取值，不得在 import 期呼叫，見 CLAUDE.md 單一 userData 目錄規則）。寫入原子化（tmp + rename），撤銷時同步移除。只存 digest，不存 token。
2. **還原**：BAT 啟動、Terminal Server replay（`pty:list`）完成後，只還原清單中仍存活的 terminalId 的紀錄，其餘丟棄並重寫檔案。replay 前收到的 helper 認證要能在還原後成功（或明確以可重試錯誤回應，helper 端行為在回報區說明）。
3. **direct 模式 / Terminal Server 未存活**：BAT 重開時 PTY 已全部結束 → 清空紀錄。
4. **順帶補齊**（T0565 已知限制）：replay PTY 若有還原的權杖紀錄，可得知 tower / worker 綁定；評估是否以此恢復 `isWorkerOf`（close-worker 歸屬）——與 T0537 已存分頁歸屬的優先序要寫清楚；`role` / `towerMode` 是否一併持久化交塔台決定（回報區建議即可，本單不做）。
5. **升級相容**：舊版 BAT 留下的存活分頁（env 為全權 server token）在新版照常可用（server token 仍被接受），CLAUDE.md 寫明。
6. **CLAUDE.md**：權杖生命週期（本機：跨 BAT 重開保留至 PTY 結束；headless：server 重啟全失效）、userData 檔案清單補上新檔。

## 驗收條件

1. `npx vite build` 成功；`npm run typecheck` = 0、`npm run typecheck:electron` = 0；`npm run test:unit` 全綠。
2. 單元測試：寫入 / 撤銷 / 原子寫、還原只留存活 id、檔案損毀時安全降級（清空 + `logger.warn`，不 crash）、不含明文 token（測試斷言檔案內容不含簽發的 token 字串）。
3. e2e `e2e/t0576-capability-persist-restart.spec.ts`（隔離實例）：派一個 Worker → 關 BAT（不停 Terminal Server）→ 重開 → 塔台分頁 `--set-role` / `--close-worker` 成功、Worker 分頁 `bat-notify` 成功；Worker 結束後其紀錄已移除。
4. 回報區附：T0575 回報的回歸現象在本單後已消失的實測對照。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯
